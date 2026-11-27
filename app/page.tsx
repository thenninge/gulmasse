"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PickerWheel from "@/components/PickerWheel";
import HostParticipantEditor from "@/components/HostParticipantEditor";
import { resolveBeerImage } from "@/lib/beerImages";
import { shrinkImageForUpload } from "@/lib/resizeImage";
import { buildResultsCsv } from "@/lib/exportCsv";
import { playFanfare as playFanfareSound } from "@/lib/fanfare";
import { DEFAULT_FUN_SOUND, FUN_SOUNDS, isFunSoundId, pitchForDie, playConfirmSound, playFunSound, type FunSoundId } from "@/lib/funSounds";

type View = "login" | "user" | "lobby" | "voting" | "picker" | "admin" | "overview" | "wheel";

export default function Home() {
  const [view, setView] = useState<View>("login");
  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [producer, setProducer] = useState("");
  const [beerType, setBeerType] = useState<string>("");
  const [customBeerType, setCustomBeerType] = useState<string>("");
  const [strength, setStrength] = useState<string>("");
  const [voted, setVoted] = useState<number | null>(null);
  const isHost = useMemo(() => pin === "0808", [pin]);
  const [activeEvent, setActiveEvent] = useState<{
    name: string;
    invite_code: string;
    registration_open: boolean;
    status: string;
    formatted_date?: string | null;
  } | null>(null);

  // status state from /api/status
  const [statusLoading, setStatusLoading] = useState(false);
  const [participants, setParticipants] = useState<Array<{
    pin: string; nickname: string | null; active: boolean;
    beer_name?: string | null; producer?: string | null; beer_type?: string | null; abv?: number | null;
    beer_image_url?: string | null;
  }>>([]);
  const [expectedGuests, setExpectedGuests] = useState<Array<{ name: string; status: string }>>([]);
  const [beerImageUrl, setBeerImageUrl] = useState<string | null>(null);
  const [beerImageBusy, setBeerImageBusy] = useState(false);
  const [beerImageError, setBeerImageError] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [votedCount, setVotedCount] = useState(0);
  const [round, setRound] = useState(1);
  const [reveal, setReveal] = useState(false);
  const [histogram, setHistogram] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const [voteCount, setVoteCount] = useState(0);
  const [average, setAverage] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [loginsLocked, setLoginsLocked] = useState(false);
  const [userGiven, setUserGiven] = useState<Record<string, number>>({});
  const [userReceived, setUserReceived] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const [sortKey, setSortKey] = useState<"rank" | "received" | "name" | "beer" | "given">("received");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [revealedRound, setRevealedRound] = useState(0);
  const [pickedRound, setPickedRound] = useState(0);
  const [roundStarted, setRoundStarted] = useState(false);
  const [allowReveal, setAllowReveal] = useState(false);
  const [autoAllowReveal, setAutoAllowReveal] = useState(false);
  const [awardUnlocked, setAwardUnlocked] = useState(false);
  const [pairTotalsMap, setPairTotalsMap] = useState<Record<string, Record<string, number>>>({});
  const [pairTotalsExtraMap, setPairTotalsExtraMap] = useState<Record<string, Record<string, number>>>({});
  /** Live (unrevealed) pair totals — host Full oversikt uses these to verify scoring */
  const [pairTotalsAllMap, setPairTotalsAllMap] = useState<Record<string, Record<string, number>>>({});
  const [pairTotalsExtraAllMap, setPairTotalsExtraAllMap] = useState<Record<string, Record<string, number>>>({});
  const [sumFactor, setSumFactor] = useState<number>(0.5);
  const [showWelcome, setShowWelcome] = useState(false);
  const extraGivenByPin = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const from of Object.keys(pairTotalsExtraMap || {})) {
      const row = pairTotalsExtraMap[from] || {};
      let sum = 0;
      for (const to of Object.keys(row)) {
        const v = Number(row[to] || 0);
        if (v > 0) sum += v;
      }
      acc[from] = sum;
    }
    return acc;
  }, [pairTotalsExtraMap]);
  const extraReceivedByPin = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const from of Object.keys(pairTotalsExtraMap || {})) {
      const row = pairTotalsExtraMap[from] || {};
      for (const to of Object.keys(row)) {
        const v = Number(row[to] || 0);
        if (v > 0) acc[to] = (acc[to] ?? 0) + v;
      }
    }
    return acc;
  }, [pairTotalsExtraMap]);
  const totalRevealedExtra = useMemo(() => {
    let sum = 0;
    for (const from of Object.keys(pairTotalsExtraMap || {})) {
      const row = pairTotalsExtraMap[from] || {};
      for (const to of Object.keys(row)) {
        sum += Number(row[to] || 0);
      }
    }
    return sum;
  }, [pairTotalsExtraMap]);
  const revealedGivenByPin = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const from of Object.keys(pairTotalsMap || {})) {
      const row = pairTotalsMap[from] || {};
      for (const to of Object.keys(row)) {
        const v = Number(row[to] || 0);
        if (v > 0) acc[from] = (acc[from] ?? 0) + v;
      }
    }
    return acc;
  }, [pairTotalsMap]);
  const revealedReceivedByPin = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const from of Object.keys(pairTotalsMap || {})) {
      const row = pairTotalsMap[from] || {};
      for (const to of Object.keys(row)) {
        const v = Number(row[to] || 0);
        if (v > 0) acc[to] = (acc[to] ?? 0) + v;
      }
    }
    return acc;
  }, [pairTotalsMap]);
  const revealedRankMap = useMemo(() => {
    const items = participants.map((p) => ({
      pin: p.pin,
      received: revealedReceivedByPin[p.pin] ?? 0,
      given: revealedGivenByPin[p.pin] ?? 0,
      name: (p.nickname || "").trim(),
    }));
    items.sort((a, b) => {
      if (a.received !== b.received) return b.received - a.received;
      if (a.given !== b.given) return b.given - a.given;
      return a.name.localeCompare(b.name);
    });
    const map: Record<string, number> = {};
    items.forEach((item, idx) => {
      map[item.pin] = idx + 1;
    });
    return map;
  }, [participants, revealedReceivedByPin, revealedGivenByPin]);
  const totalRevealedMain = useMemo(() => {
    let sum = 0;
    for (const from of Object.keys(pairTotalsMap || {})) {
      const row = pairTotalsMap[from] || {};
      for (const to of Object.keys(row)) {
        sum += Number(row[to] || 0);
      }
    }
    return sum;
  }, [pairTotalsMap]);
  // Combined (main + factor * extra)
  const combinedPairTotalsMap = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    const fromPins = new Set<string>([
      ...Object.keys(pairTotalsMap || {}),
      ...Object.keys(pairTotalsExtraMap || {}),
    ]);
    for (const from of fromPins) {
      const rowMain = pairTotalsMap[from] || {};
      const rowExtra = pairTotalsExtraMap[from] || {};
      const toPins = new Set<string>([
        ...Object.keys(rowMain),
        ...Object.keys(rowExtra),
      ]);
      for (const to of toPins) {
        const main = Number(rowMain[to] || 0);
        const extra = Number(rowExtra[to] || 0);
        const val = main + sumFactor * extra;
        if (!out[from]) out[from] = {};
        out[from][to] = val;
      }
    }
    return out;
  }, [pairTotalsMap, pairTotalsExtraMap, sumFactor]);
  const combinedGivenByPin = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const from of Object.keys(combinedPairTotalsMap || {})) {
      const row = combinedPairTotalsMap[from] || {};
      let sum = 0;
      for (const to of Object.keys(row)) {
        sum += Number(row[to] || 0);
      }
      acc[from] = sum;
    }
    return acc;
  }, [combinedPairTotalsMap]);
  const combinedReceivedByPin = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const from of Object.keys(combinedPairTotalsMap || {})) {
      const row = combinedPairTotalsMap[from] || {};
      for (const to of Object.keys(row)) {
        const v = Number(row[to] || 0);
        acc[to] = (acc[to] ?? 0) + v;
      }
    }
    return acc;
  }, [combinedPairTotalsMap]);
  const totalCombined = useMemo(() => {
    let sum = 0;
    for (const from of Object.keys(combinedPairTotalsMap || {})) {
      const row = combinedPairTotalsMap[from] || {};
      for (const to of Object.keys(row)) {
        sum += Number(row[to] || 0);
      }
    }
    return sum;
  }, [combinedPairTotalsMap]);

  // Rank is always based on "poeng fått" (received), independent of current sort
  const receivedRankMap = useMemo(() => {
    const items = participants.map((p) => ({
      pin: p.pin,
      received: userReceived[p.pin] ?? 0,
      given: userGiven[p.pin] ?? 0,
      name: (p.nickname || "").trim(),
    }));
    items.sort((a, b) => {
      if (a.received !== b.received) return b.received - a.received;
      if (a.given !== b.given) return b.given - a.given;
      return a.name.localeCompare(b.name);
    });
    const map: Record<string, number> = {};
    items.forEach((item, idx) => {
      map[item.pin] = idx + 1;
    });
    return map;
  }, [participants, userReceived, userGiven]);
  // Show lobby scores whenever overview has revealed data (combined), or if revealed for the round
  const canShowScores = useMemo(() => {
    const anyPair = Object.values(combinedPairTotalsMap || {}).some((toMap) =>
      Object.values(toMap || {}).some((v) => (Number(v) || 0) > 0)
    );
    return anyPair || revealedRound === round;
  }, [combinedPairTotalsMap, revealedRound, round]);
  // Rank map based on combined totals (used in Lobby)
  const combinedRankMap = useMemo(() => {
    const items = participants.map((p) => ({
      pin: p.pin,
      received: combinedReceivedByPin[p.pin] ?? 0,
      given: combinedGivenByPin[p.pin] ?? 0,
      name: (p.nickname || "").trim(),
    }));
    items.sort((a, b) => {
      if (a.received !== b.received) return b.received - a.received;
      if (a.given !== b.given) return b.given - a.given;
      return a.name.localeCompare(b.name);
    });
    const map: Record<string, number> = {};
    items.forEach((item, idx) => {
      map[item.pin] = idx + 1;
    });
    return map;
  }, [participants, combinedReceivedByPin, combinedGivenByPin]);
  function beerImageForParticipant(p: {
    nickname?: string | null;
    beer_image_url?: string | null;
  } | null | undefined): string | null {
    if (!p) return null;
    return resolveBeerImage({
      beer_image_url: p.beer_image_url,
      name: p.nickname,
    });
  }

  function beerImageForName(name: string): string | null {
    return resolveBeerImage({ name });
  }

  async function uploadBeerImage(file: File) {
    setBeerImageError(null);
    if (pin.length !== 4) {
      setBeerImageError("Logg inn først");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setBeerImageError("Velg et bilde");
      return;
    }
    setBeerImageBusy(true);
    try {
      const body = new FormData();
      body.append("pin", pin);
      body.append("file", await shrinkImageForUpload(file));
      const res = await fetch("/api/pin/beer-image", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Opplasting feilet");
      setBeerImageUrl(data.beer_image_url || null);
      fetchStatus();
    } catch (e: unknown) {
      setBeerImageError(e instanceof Error ? e.message : "Opplasting feilet");
    } finally {
      setBeerImageBusy(false);
    }
  }

  async function removeBeerImage() {
    setBeerImageError(null);
    if (pin.length !== 4) return;
    setBeerImageBusy(true);
    try {
      const res = await fetch("/api/pin/beer-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke fjerne bilde");
      setBeerImageUrl(null);
      fetchStatus();
    } catch (e: unknown) {
      setBeerImageError(e instanceof Error ? e.message : "Feil");
    } finally {
      setBeerImageBusy(false);
    }
  }

  const selected = useMemo(() => {
    const pinSel = picks.length > 0 ? picks[picks.length - 1] : null;
    if (!pinSel) return null;
    const p = participants.find((x) => x.pin === pinSel);
    const name = (p?.nickname || "").trim() || pinSel;
    const beerName = (p?.beer_name || "").trim();
    const producer = (p?.producer || "").trim();
    const abv = p?.abv != null ? Number(p.abv) : undefined;
    const beerType = (p?.beer_type || "").trim();
    const image = beerImageForParticipant(p);
    return { pin: pinSel, name, beerName, producer, beerType, abv, image };
  }, [picks, participants]);

  const pinRef = useRef("");
  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);
  const lastRoundRef = useRef<number | null>(null);
  const lastStatusTextRef = useRef<string | null>(null);
  const statusInFlightRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyStatus = useCallback((data: any) => {
      setParticipants(data.participants || []);
      setExpectedGuests(Array.isArray(data.expectedGuests) ? data.expectedGuests : []);
      setActiveCount(data.activeCount || 0);
      setVotedCount(data.votedCount || 0);
      // When the round changes, reset local voting state so everyone can vote again.
      // Done here (not in an effect on `round`) so the first load doesn't wipe the
      // server's list of who has voted – that briefly unlocked the dice after a reload.
      const newRound = Number(data.round || 1);
      if (lastRoundRef.current !== null && lastRoundRef.current !== newRound) {
        setVoted(null);
        setPendingVote(null);
        setPendingExtraVote(null);
        setShowMyReveal(false);
      }
      lastRoundRef.current = newRound;
      setRound(newRound);
      setReveal(data.reveal === true);
      setVotedPins(Array.isArray(data.votes?.votedPins) ? data.votes.votedPins : []);
      setHistogram(data.votes?.histogram || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
      setVoteCount(data.votes?.count || 0);
      setAverage(typeof data.votes?.average === "number" ? data.votes.average : 0);
      const rmap: Record<string, number> = {};
      (data.votes?.revealedVotes || []).forEach((rv: { pin: string; value: number }) => {
        if (rv && typeof rv.pin === "string") rmap[rv.pin] = Number(rv.value);
      });
      setRevealedVotesMap(rmap);
      const rxmap: Record<string, number> = {};
      (data.votesExtra?.revealedVotes || []).forEach((rv: { pin: string; value: number }) => {
        if (rv && typeof rv.pin === "string") rxmap[rv.pin] = Number(rv.value);
      });
      setRevealedExtraMap(rxmap);
      setPicks(data.picks || []);
      setLoginsLocked(data.loginsLocked === true);
      const givenMap: Record<string, number> = {};
      (data.userGiven || []).forEach((u: { pin: string; total: number }) => {
        givenMap[u.pin] = u.total || 0;
      });
      setUserGiven(givenMap);
      const recvMap: Record<string, number> = {};
      (data.userReceived || []).forEach((u: { pin: string; total: number }) => {
        recvMap[u.pin] = u.total || 0;
      });
      setUserReceived(recvMap);
      setRevealedRound(data.revealedRound || 0);
      setPickedRound(typeof data.pickedRound === "number" ? data.pickedRound : 0);
      setRoundStarted(Boolean(data.roundStarted));
      setAllowReveal(Boolean(data.allowReveal));
      setAutoAllowReveal(Boolean(data.autoAllowReveal));
      setAwardUnlocked(Boolean(data.awardUnlocked));
      // build pair totals map: from -> to -> total
      function buildPairMap(
        rows: Array<{ from: string; to: string; total: number }> | undefined,
      ): Record<string, Record<string, number>> {
        const m: Record<string, Record<string, number>> = {};
        (rows || []).forEach((pt) => {
          const f = String(pt?.from || "");
          const t = String(pt?.to || "");
          const val = Number(pt?.total || 0);
          if (!f || !t) return;
          if (!m[f]) m[f] = {};
          m[f][t] = (m[f][t] ?? 0) + val;
        });
        return m;
      }
      setPairTotalsMap(buildPairMap(data.pairTotals));
      setPairTotalsExtraMap(buildPairMap(data.pairTotalsExtra));
      setPairTotalsAllMap(buildPairMap(data.pairTotalsAll));
      setPairTotalsExtraAllMap(buildPairMap(data.pairTotalsExtraAll));
  }, []);

  /**
   * Fetch /api/status. The 2s poll (`poll: true`) never overlaps a request still
   * in flight and skips re-rendering when nothing changed. Explicit calls (after
   * a button press) always apply, since the UI may have cleared local state.
   * The last response is cached in localStorage so a reload renders instantly.
   */
  const fetchStatus = useCallback(async (opts?: { poll?: boolean }) => {
    const poll = opts?.poll === true;
    if (poll && statusInFlightRef.current) return;
    statusInFlightRef.current = true;
    try {
      if (!poll) setStatusLoading(true);
      // Host gets live totals incl. unrevealed votes; everyone else revealed only
      const hostPin = pinRef.current === "0808" ? pinRef.current : "";
      const res = await fetch("/api/status", {
        cache: "no-store",
        headers: hostPin ? { "x-host-pin": hostPin } : undefined,
      });
      if (!res.ok) throw new Error("Status fetch failed");
      const text = await res.text();
      if (poll && text === lastStatusTextRef.current) return;
      lastStatusTextRef.current = text;
      applyStatus(JSON.parse(text));
      try {
        localStorage.setItem("statusCache", text);
      } catch {
        // storage full / private mode – fine
      }
    } catch {
      // noop
    } finally {
      statusInFlightRef.current = false;
      if (!poll) setStatusLoading(false);
    }
  }, [applyStatus]);

  // Active event (invitasjon / påmelding)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/events/active");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.event) {
          setActiveEvent({
            name: data.event.name,
            invite_code: data.event.invite_code,
            registration_open: !!data.event.registration_open,
            status: data.event.status,
            formatted_date: data.event.formatted_date,
          });
        }
      } catch {
        // ignore when migration not applied
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // read pin from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("pin") || "";
    if (saved) {
      setPin(saved);
      setView("lobby");
      // Prefill from DB for existing session. If the saved PIN no longer exists
      // (e.g. deleted by an admin wipe, or left over from last year), send the user
      // back to login instead of letting them sit on a page where voting fails.
      loadProfile(saved).then((found) => {
        if (found === false) {
          goToLogin();
          setError("Fant ikke brukeren din – logg inn med PIN-en du har fått, eller opprett bruker på nytt.");
        }
      });
    }
    const savedCompetitor = localStorage.getItem("competitor") || "";
    const savedProducer = localStorage.getItem("producer") || "";
    const savedType = localStorage.getItem("beerType") || "";
    const savedTypeCustom = localStorage.getItem("beerTypeCustom") || "";
    const savedStrength = localStorage.getItem("strength") || "";
    const savedSumFactor = localStorage.getItem("sumFactor");
    setCompetitor(savedCompetitor);
    setProducer(savedProducer);
    setBeerType(savedType);
    setCustomBeerType(savedTypeCustom);
    setStrength(savedStrength);
    if (savedSumFactor != null) {
      const f = Number(savedSumFactor);
      if (Number.isFinite(f) && f >= 0) setSumFactor(f);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("sumFactor", String(sumFactor));
  }, [sumFactor]);

  // polling status every 2s
  useEffect(() => {
    // Show the last known state immediately (stale-while-revalidate), then refresh
    try {
      const cached = localStorage.getItem("statusCache");
      if (cached) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists client-side
        applyStatus(JSON.parse(cached));
        lastStatusTextRef.current = cached;
      }
    } catch {
      // ignore bad cache
    }
    fetchStatus();
    pollRef.current = window.setInterval(() => fetchStatus({ poll: true }), 2000);
    // Phone unlocked / tab back in focus: refresh right away instead of waiting
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchStatus({ poll: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchStatus, applyStatus]);
  // Welcome splash lifecycle
  useEffect(() => {
    if (showWelcome) {
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = audioCtxRef.current || new Ctx();
        audioCtxRef.current = ctx;
        function bell(freq: number, t0: number) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(freq, ctx.currentTime + t0);
          g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
          g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + 1.0);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + t0);
          o.stop(ctx.currentTime + t0 + 1.1);
        }
        bell(880, 0);
        bell(1319, 0.15);
        bell(988, 0.3);
      }
      const id = window.setTimeout(() => setShowWelcome(false), 2600);
      return () => window.clearTimeout(id);
    }
  }, [showWelcome]);
  
  // Hat on voting: drop when this round has an official pick; do NOT clear while on
  // picker (celebration uses the same hatDrop flag). Clear only when leaving both.
  useEffect(() => {
    if (view === "voting" && selected && pickedRound === round) {
      setHatDrop(true);
    } else if (view !== "voting" && view !== "picker") {
      setHatDrop(false);
    }
  }, [view, selected?.pin, pickedRound, round]);

 

  async function login() {
    setError(null);
    if (pin.length !== 4) {
      setError("PIN må være 4 siffer");
      return;
    }
    try {
      const res = await fetch("/api/pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Feil ved innlogging" }));
        setError(msg || "Feil ved innlogging");
        return;
      }
      localStorage.setItem("pin", pin);
      setView("user");
      setShowWelcome(true);
      // Load existing profile from DB
      await loadProfile(pin);
    } catch {
      setError("Nettverksfeil");
    }
  }

  async function createPin() {
    setError(null);
    if (pin.length !== 4) {
      setError("PIN må være 4 siffer");
      return;
    }
    try {
      const res = await fetch("/api/pin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, nickname: nickname || undefined }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Feil ved opprettelse" }));
        setError(msg || "Feil ved opprettelse");
        return;
      }
      localStorage.setItem("pin", pin);
      setView("user");
      setShowWelcome(true);
      // New user likely has empty profile; still try to load
      await loadProfile(pin);
    } catch {
      setError("Nettverksfeil");
    }
  }

  async function castVote(value: number, extra: number): Promise<boolean> {
    setError(null);
    if (pin.length !== 4) {
      setError("Du må være innlogget");
      return false;
    }
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, value, extra }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Kunne ikke lagre stemme" }));
        setError(msg || "Kunne ikke lagre stemme");
        return false;
      }
      setVoted(value);
      fetchStatus();
      return true;
    } catch {
      setError("Nettverksfeil");
      return false;
    }
  }

  // host helpers
  async function hostPost(path: string) {
    if (!isHost) {
      setError("Host‑funksjon krever host‑PIN");
      return null;
    }
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "x-host-pin": pin },
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Feil ved host‑kall" }));
        setError(msg || "Feil ved host‑kall");
        return null;
      }
      return await res.json().catch(() => ({}));
    } catch {
      setError("Nettverksfeil");
      return null;
    } finally {
      fetchStatus();
    }
  }

  const nextRound = async () => {
    const r = await hostPost("/api/host/next-round");
    if (r) setVoted(null);
  };

  const [profileSaved, setProfileSaved] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastPicked, setLastPicked] = useState<{ name: string; beerName?: string } | null>(null);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [wheelNames, setWheelNames] = useState<Array<{ pin: string; name: string }>>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const drumRef = useRef<number | null>(null);
  const [showBeerImage, setShowBeerImage] = useState(false);
  const [lobbyImageSrc, setLobbyImageSrc] = useState<string | null>(null);
  const [lobbyBeerOpen, setLobbyBeerOpen] = useState(false);
  const [lobbyImageTitle, setLobbyImageTitle] = useState<string>("");
  const [lobbyImageProducer, setLobbyImageProducer] = useState<string>("");
  const [lobbyImageBeerType, setLobbyImageBeerType] = useState<string>("");
  const [lobbyImageName, setLobbyImageName] = useState<string>("");
  const [lobbyImageBeerName, setLobbyImageBeerName] = useState<string>("");
  const [lobbyImageAbv, setLobbyImageAbv] = useState<string>("");
  const [showPodium, setShowPodium] = useState(false);
  const [showAward, setShowAward] = useState(false);
  const [hatDrop, setHatDrop] = useState(false);
  const [pendingVote, setPendingVote] = useState<number | null>(null);
  const [pendingExtraVote, setPendingExtraVote] = useState<number | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [votedPins, setVotedPins] = useState<string[]>([]);
  const [showMyReveal, setShowMyReveal] = useState(false);
  const [revealedVotesMap, setRevealedVotesMap] = useState<Record<string, number>>({});
  const [revealedExtraMap, setRevealedExtraMap] = useState<Record<string, number>>({});
  // If server no longer lists my pin in votedPins, unlock local vote UI (handles admin "Reset stemmer")
  useEffect(() => {
    if (pin && voted !== null && !votedPins.includes(pin)) {
      setVoted(null);
      setPendingVote(null);
      setShowMyReveal(false);
    }
  }, [votedPins, pin, voted]);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [adminConfirmTitle, setAdminConfirmTitle] = useState("Er du sikker?");
  const [adminConfirmMessage, setAdminConfirmMessage] = useState("Denne handlingen kan ikke angres.");
  const [adminConfirmPhrase, setAdminConfirmPhrase] = useState<string | null>(null);
  const [adminConfirmTyped, setAdminConfirmTyped] = useState("");
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [leaderboardKey, setLeaderboardKey] = useState<string | null>(null);
  const [leaderboardCopied, setLeaderboardCopied] = useState(false);
  const leaderboardUrl =
    leaderboardKey && typeof window !== "undefined"
      ? `${window.location.origin}/leaderboard?k=${leaderboardKey}`
      : "";
  async function loadLeaderboardKey(rotate = false) {
    try {
      const res = await fetch("/api/host/leaderboard-key", {
        method: rotate ? "POST" : "GET",
        headers: { "x-host-pin": pin },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Feil");
      setLeaderboardKey(data.key || null);
      if (rotate) setAdminNotice("Ny leaderboard-lenke laget. Den gamle virker ikke lenger.");
    } catch {
      setError("Kunne ikke hente leaderboard-lenke");
    }
  }
  /** POST a host action; shows the server's error (or a success note) in Admin tools. */
  async function adminCall(path: string, successMsg: string, body?: unknown): Promise<boolean> {
    setAdminNotice(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "x-host-pin": pin, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Feil (${res.status})`);
        return false;
      }
      setError(null);
      setAdminNotice(successMsg);
      return true;
    } catch {
      setError("Nettverksfeil – prøv igjen");
      return false;
    } finally {
      fetchStatus();
    }
  }
  const adminConfirmActionRef = useRef<null | (() => void | Promise<void>)>(null);
  function confirmAdmin(
    action: () => void | Promise<void>,
    opts?: { title?: string; message?: string; confirmPhrase?: string },
  ) {
    adminConfirmActionRef.current = action;
    setAdminConfirmTitle(opts?.title || "Er du sikker?");
    setAdminConfirmMessage(opts?.message || "Denne handlingen kan ikke angres.");
    setAdminConfirmPhrase(opts?.confirmPhrase || null);
    setAdminConfirmTyped("");
    setShowAdminConfirm(true);
  }

  function getAudio(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        audioCtxRef.current = null;
      }
    }
    const ctx = audioCtxRef.current;
    // Browsers suspend AudioContext until a user gesture; resume on spin click
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playBeep(freq: number, durationMs: number, gainLevel = 0.06) {
    const ctx = getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = gainLevel;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      try { osc.stop(); } catch {}
      try { osc.disconnect(); gain.disconnect(); } catch {}
    }, durationMs);
  }

  function playSnareHit() {
    const ctx = getAudio();
    if (!ctx) return;
    // Noise buffer
    const bufferSize = 2048;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // quick decay
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    noise.connect(bandpass).connect(gain).connect(ctx.destination);
    noise.start();
    setTimeout(() => {
      try { noise.stop(); } catch {}
      try { noise.disconnect(); bandpass.disconnect(); gain.disconnect(); } catch {}
    }, 120);
  }

  function startDrumroll() {
    stopDrumroll();
    drumRef.current = window.setInterval(() => {
      playSnareHit();
    }, 100);
  }
  function stopDrumroll() {
    if (drumRef.current) {
      window.clearInterval(drumRef.current);
      drumRef.current = null;
    }
  }
  // «Velg din terninglyd»: chosen silly sound, remembered on this phone
  const [diceSound, setDiceSound] = useState<FunSoundId>(DEFAULT_FUN_SOUND);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("diceSound");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists client-side
      if (isFunSoundId(saved)) setDiceSound(saved);
    } catch {
      // storage unavailable
    }
  }, []);
  function chooseDiceSound(id: FunSoundId) {
    setDiceSound(id);
    try {
      localStorage.setItem("diceSound", id);
    } catch {
      // storage unavailable
    }
    const ctx = getAudio();
    if (ctx) playFunSound(ctx, id);
  }
  // Test: a random sound of the five on every die tap (never the same twice in a row).
  // Set to false to go back to each player's own choice on Brukerside.
  const RANDOM_DICE_SOUNDS = true;
  const lastRandomSoundRef = useRef<FunSoundId | null>(null);
  function playDiceSound(die: number) {
    const ctx = getAudio();
    if (!ctx) return;
    let id: FunSoundId = diceSound;
    if (RANDOM_DICE_SOUNDS) {
      const options = FUN_SOUNDS.map((x) => x.id).filter((x) => x !== lastRandomSoundRef.current);
      id = options[Math.floor(Math.random() * options.length)];
      lastRandomSoundRef.current = id;
    }
    playFunSound(ctx, id, pitchForDie(die));
  }

  function playFanfare() {
    const ctx = getAudio();
    if (!ctx) return;
    // Full brass fanfare with timpani, cymbal and reverb (lib/fanfare)
    playFanfareSound(ctx);
  }

  function goToLogin() {
    try {
      localStorage.removeItem("pin");
      localStorage.removeItem("competitor");
      localStorage.removeItem("producer");
      localStorage.removeItem("beerType");
      localStorage.removeItem("strength");
      localStorage.removeItem("beerTypeCustom");
    } catch {}
    setPin("");
    setNickname("");
    setCompetitor("");
    setProducer("");
    setBeerType("");
    setStrength("");
    setCustomBeerType("");
    setVoted(null);
    setView("login");
  }

  async function logout() {
    try {
      if (pin.length === 4) {
        await fetch("/api/pin/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }).catch(() => {});
      }
    } finally {
      goToLogin();
      fetchStatus();
    }
  }

  async function confirmLockVote() {
    if (pendingVote == null || pendingExtraVote == null) return;
    await castVote(pendingVote, pendingExtraVote);
    setShowLockConfirm(false);
    setPendingVote(null);
    setPendingExtraVote(null);
  }
  const [revealingVote, setRevealingVote] = useState(false);
  async function revealMyVote() {
    const hasVotedLocally = voted !== null;
    const hasVotedServer = pin.length === 4 && votedPins.includes(pin);
    if (pin.length !== 4 || !(hasVotedLocally || hasVotedServer) || revealingVote) return;
    // Drum roll for ~1 s, then show the vote (the reveal request runs meanwhile)
    setRevealingVote(true);
    getAudio();
    startDrumroll();
    const request = fetch("/api/reveal-my-vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }).catch(() => null);
    try {
      await Promise.all([request, new Promise((r) => setTimeout(r, 1000))]);
    } finally {
      stopDrumroll();
      setRevealingVote(false);
      setShowMyReveal(true);
      fetchStatus();
    }
  }

  /** Returns false only when the server says the PIN does not exist. */
  async function loadProfile(currentPin: string): Promise<boolean | null> {
    try {
      const res = await fetch("/api/pin/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: currentPin }),
      });
      if (res.status === 404) return false;
      if (!res.ok) return null;
      const data = await res.json();
      // Opening the app with a saved PIN never went through «Logg inn», so someone
      // who had logged out (or was set inactive) stayed unable to vote. Re-activate.
      if (data.participant && data.participant.active === false) {
        const act = await fetch("/api/pin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: currentPin }),
        }).catch(() => null);
        if (act && act.status === 423) {
          setError("Du står som inaktiv og kan ikke stemme. Be verten aktivere deg (Admin → Rediger → Aktiv).");
        }
        fetchStatus();
      }
      const p = data.participant as {
        nickname?: string | null;
        beer_name?: string | null;
        producer?: string | null;
        beer_type?: string | null;
        abv?: number | null;
        beer_image_url?: string | null;
      };
      if (p.nickname !== undefined) setNickname(p.nickname || "");
      if (p.beer_image_url !== undefined) setBeerImageUrl(p.beer_image_url || null);
      if (p.beer_name !== undefined) {
        setCompetitor(p.beer_name || "");
        localStorage.setItem("competitor", p.beer_name || "");
      }
      if (p.producer !== undefined) {
        setProducer(p.producer || "");
        localStorage.setItem("producer", p.producer || "");
      }
      if (p.beer_type !== undefined) {
        const known = new Set([
          "Barleywine","Belgian Double","Belgian Quad","Belgian Tripple","Bock","Dobblebock","Double IPA","Home Brew","Imperial Stout","IPA","Julebrygg","Lager","Mjød","Other","Pilsner","Stout","Tripplebock","Nuclear Surprise","Brown ale"
        ]);
        const t = (p.beer_type || "").trim();
        if (t && !known.has(t)) {
          setBeerType("__custom__");
          setCustomBeerType(t);
          localStorage.setItem("beerType", "__custom__");
          localStorage.setItem("beerTypeCustom", t);
        } else {
          setBeerType(t);
          localStorage.setItem("beerType", t);
          localStorage.removeItem("beerTypeCustom");
        }
      }
      if (p.abv !== undefined && p.abv !== null) {
        const s = Number(p.abv).toFixed(1);
        setStrength(s);
        localStorage.setItem("strength", s);
      }
      return true;
    } catch {
      // ignore (network) – keep session
      return null;
    }
  }

  return (
    <div className="min-h-dvh w-full bg-transparent text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">{activeEvent?.name || "Gulmasse '26"}</h1>
          {pin ? (
            view === "user" ? (
              <button
                className="text-sm text-blue-600 underline"
                onClick={() => setView("lobby")}
              >
                Skål!
              </button>
            ) : (
              <button
                className="text-sm text-blue-600 underline"
                onClick={() => {
                  setView("user");
                  if (pin.length === 4) {
                    loadProfile(pin);
                  }
                }}
              >
                Brukerside
              </button>
            )
          ) : (
            <button
              className="text-sm text-blue-600 underline"
              onClick={() => setView("login")}
            >
              Ikke innlogget
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto mt-6 md:mt-8 max-w-md px-4 py-6 bg-white/85 rounded-2xl shadow-lg">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {showAward && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowAward(false)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-1 text-sm shadow"
                onClick={() => setShowAward(false)}
                aria-label="Lukk"
              >
                ✕
              </button>
              {(() => {
                // Find winner based on combined totals
                const items = participants.map((p) => ({
                  pin: p.pin,
                  name: (p.nickname || "").trim() || p.pin,
                  beer: (p.beer_name || "").trim(),
                  producer: (p.producer || "").trim(),
                  abv: p.abv != null ? Number(p.abv) : undefined,
                  beerPts: revealedReceivedByPin[p.pin] ?? 0,
                  extraPts: extraReceivedByPin[p.pin] ?? 0,
                  sumPts: combinedReceivedByPin[p.pin] ?? 0,
                }));
                items.sort((a, b) => {
                  if (a.sumPts !== b.sumPts) return b.sumPts - a.sumPts;
                  if (a.beerPts !== b.beerPts) return b.beerPts - a.beerPts;
                  return a.name.localeCompare(b.name);
                });
                const w = items[0];
                return (
                  <div className="space-y-3 text-center relative">
                    <div className="text-2xl font-extrabold text-emerald-700">Congratulations!</div>
                    <div className="text-lg text-zinc-800">The GULMASSE 2026 trophy is awarded to</div>
                    <img src="/img/trophy.png" alt="Trophy" className="mx-auto h-72 w-72 md:h-80 md:w-80 object-contain" />
                    <div className="text-3xl md:text-4xl font-extrabold text-zinc-900">{w.name}</div>
                    <div className="text-base md:text-lg text-zinc-800 font-semibold">{w.beer || "—"}</div>
                    {(w.producer || Number.isFinite(w.abv as any)) && (
                      <div className="text-sm text-zinc-700">
                        {w.producer ? <>Produsent: <span className="font-medium">{w.producer}</span></> : null}
                        {(w.producer && Number.isFinite(w.abv as any)) ? " · " : null}
                        {Number.isFinite(w.abv as any) ? <>ABV: <span className="font-medium">{Number(w.abv).toFixed(1)}%</span></> : null}
                      </div>
                    )}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <div className="text-zinc-500">Beer points</div>
                        <div className="font-semibold tabular-nums">{w.beerPts}</div>
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <div className="text-zinc-500">Extra points</div>
                        <div className="font-semibold tabular-nums">{w.extraPts}</div>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <div className="text-emerald-700">Sum of points</div>
                        <div className="font-semibold tabular-nums">{w.sumPts.toFixed(1)}</div>
                      </div>
                    </div>
                    {/* Confetti overlay */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      {Array.from({ length: 120 }).map((_, i) => (
                        <span
                          key={i}
                          className="absolute block h-2 w-2 animate-confetti rounded-[1px]"
                          style={{
                            left: `${Math.random() * 100}%`,
                            top: `-${Math.random() * 20}%`,
                            backgroundColor: ['#10b981', '#d4af37', '#3b82f6', '#ef4444'][i % 4],
                            animationDelay: `${Math.random() * 0.6}s`,
                            animationDuration: `${1.8 + Math.random() * 0.8}s`,
                            transform: `rotate(${Math.random() * 360}deg)`
                          } as any}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {showWelcome && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowWelcome(false)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src="/img/mcga.png"
                alt=""
                className="pointer-events-none absolute left-1/2 animate-hatdrop h-16 w-16 md:h-20 md:w-20"
                style={{ top: "8px" } as any}
              />
              <div className="mt-14 text-2xl font-extrabold tracking-wide text-emerald-700">
                WELCOME TO GULMASSE!
              </div>
              <div className="mt-1 text-lg font-semibold text-zinc-800">
                {(nickname || pin || "").trim()}
              </div>
              <div className="mt-2 text-sm text-zinc-600">🎄✨</div>
              {/* Confetti overlay */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 90 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute block h-2 w-2 animate-confetti rounded-[1px]"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `-${Math.random() * 20}%`,
                      backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'][i % 4],
                      animationDelay: `${Math.random() * 0.6}s`,
                      animationDuration: `${1.8 + Math.random() * 0.8}s`,
                      transform: `rotate(${Math.random() * 360}deg)`
                    } as any}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "wheel" && isHost && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Snurrehjul</h2>
              <button
                className="rounded-md bg-purple-600 px-3 py-1 text-sm text-white active:opacity-90"
                onClick={() => setView("lobby")}
              >
                Lobby
              </button>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="text-sm text-zinc-600">Separat snurrehjul (ikke koblet til poeng/oversikt).</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm relative overflow-hidden">
              <PickerWheel
                participants={participants
                  .map(p => ({ id: p.pin, name: (p.nickname || "").trim() || p.pin, selected: false }))}
                onSpinStart={() => {
                  getAudio();
                  startDrumroll();
                }}
                onSpinEnd={() => {
                  stopDrumroll();
                }}
                onPick={async (picked) => {
                  const match = participants.find(x => x.pin === picked.id);
                  setLastPicked({
                    name: (match?.nickname || "").trim() || picked.name,
                    beerName: (match?.beer_name || "").trim() || undefined,
                  });
                  stopDrumroll();
                  playFanfare();
                  setHatDrop(true);
                  setShowCelebration(true);
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    // @ts-ignore
                    navigator.vibrate?.([60, 40, 80]);
                  }
                  setTimeout(() => { setShowCelebration(false); setHatDrop(false); }, 3000);
                }}
              />
              {showCelebration && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-visible bg-white/85 backdrop-blur-sm">
                  <div className="rounded-2xl border border-emerald-300 bg-white px-6 py-5 pt-16 text-center shadow-xl relative">
                    <div className="text-xs uppercase tracking-wide text-emerald-700">Valgt</div>
                    <div className="mt-1 relative">
                      {hatDrop && (
                        <img
                          key={`wheel-hat-${lastPicked?.name || "x"}`}
                          src="/img/mcga.png"
                          alt=""
                          className="pointer-events-none absolute left-1/2 animate-hatdrop h-16 w-16 md:h-20 md:w-20"
                          style={{ top: "-72px" } as any}
                        />
                      )}
                      <div className="text-2xl font-bold text-emerald-900">
                        {lastPicked?.name}
                      </div>
                    </div>
                    { lastPicked?.beerName ? (
                      <div className="text-lg text-emerald-800">
                        {lastPicked?.beerName}
                      </div>
                    ) : null}
                  </div>
                  {/* Simple confetti */}
                  <div className="absolute inset-0 overflow-hidden">
                    {Array.from({ length: 80 }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute block h-2 w-2 animate-confetti rounded-[1px]"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `-${Math.random() * 20}%`,
                          backgroundColor: ['#10b981', '#34d399', '#059669', '#6ee7b7'][i % 4],
                          animationDelay: `${Math.random() * 0.6}s`,
                          animationDuration: `${1.6 + Math.random() * 0.8}s`,
                          transform: `rotate(${Math.random() * 360}deg)`
                        } as any}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        {view === "user" && (
          <section className="space-y-5">
            <h2 className="text-xl font-semibold text-center">
              Velkommen til {activeEvent?.name || "Gulmasse '26"}!
            </h2>
            <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Navn</label>
                <input
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
                  placeholder="Ditt navn"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Konkurrent</label>
                <input
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
                  placeholder="Navn på øl"
                  value={competitor}
                  onChange={(e) => {
                    setCompetitor(e.target.value);
                    localStorage.setItem("competitor", e.target.value);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Produsent</label>
                <input
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
                  placeholder="Produsent"
                  value={producer}
                  onChange={(e) => {
                    setProducer(e.target.value);
                    localStorage.setItem("producer", e.target.value);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Type</label>
                <select
                  className="w-full rounded-xl border border-zinc-300 px-4 py-2 bg-white"
                  value={beerType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBeerType(v);
                    localStorage.setItem("beerType", v);
                    if (v !== "__custom__") {
                      setCustomBeerType("");
                      localStorage.removeItem("beerTypeCustom");
                    }
                  }}
                >
                  <option value="">Velg type</option>
                  <option value="Barleywine">Barleywine</option>
                  <option value="Brown ale">Brown ale</option>
                  <option value="Belgian Double">Belgian Double</option>
                  <option value="Belgian Quad">Belgian Quad</option>
                  <option value="Belgian Tripple">Belgian Tripple</option>
                  <option value="Bock">Bock</option>
                  <option value="Dobblebock">Dobblebock</option>
                  <option value="Double IPA">Double IPA</option>
                  <option value="Home Brew">Home Brew</option>
                  <option value="Imperial Stout">Imperial Stout</option>
                  <option value="IPA">IPA</option>
                  <option value="Julebrygg">Julebrygg</option>
                  <option value="Lager">Lager</option>
                  <option value="Mjød">Mjød</option>
                  <option value="Nuclear Surprise">Nuclear Surprise</option>
                  <option value="Other">Other</option>
                  <option value="Pilsner">Pilsner</option>
                  <option value="Stout">Stout</option>
                  <option value="Tripplebock">Tripplebock</option>
                  <option value="__custom__">Annet (skriv selv)</option>
                </select>
                {beerType === "__custom__" && (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs text-zinc-500">Egen type</label>
                    <input
                      className="w-full rounded-xl border border-zinc-300 px-4 py-2 bg-white"
                      placeholder="Skriv øltype"
                      value={customBeerType}
                      onChange={(e) => {
                        setCustomBeerType(e.target.value);
                        localStorage.setItem("beerTypeCustom", e.target.value);
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Styrke</label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-xl border border-zinc-300 px-4 py-2"
                    inputMode="decimal"
                    placeholder="5.0"
                    value={strength}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, "");
                      const parts = val.split(".");
                      const normalized =
                        parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 1)}` : parts[0];
                      setStrength(normalized);
                      localStorage.setItem("strength", normalized);
                    }}
                  />
                  <span className="text-sm text-zinc-600">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="mb-1 block text-sm text-zinc-600">Bilde av ølen</label>
                {(beerImageUrl || resolveBeerImage({ beer_image_url: beerImageUrl, name: nickname })) && (
                  <img
                    src={beerImageUrl || resolveBeerImage({ name: nickname }) || ""}
                    alt="Ølbilde"
                    className="mx-auto max-h-48 w-auto rounded-xl object-contain ring-1 ring-zinc-200"
                  />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  capture="environment"
                  disabled={beerImageBusy || pin.length !== 4}
                  className="block w-full text-xs text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:text-white"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) uploadBeerImage(f);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {beerImageUrl && (
                    <button
                      type="button"
                      disabled={beerImageBusy}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs active:bg-zinc-50 disabled:opacity-60"
                      onClick={removeBeerImage}
                    >
                      Fjern opplastet bilde
                    </button>
                  )}
                  {beerImageBusy && (
                    <span className="text-xs text-zinc-500">Laster opp…</span>
                  )}
                </div>
                {beerImageError && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    {beerImageError}
                  </div>
                )}
                <p className="text-[11px] text-zinc-500">
                  JPEG/PNG/WebP, max 5 MB. Vises i lobby og ved presentasjon.
                </p>
              </div>
              {!RANDOM_DICE_SOUNDS && (
              <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-medium text-zinc-800">Velg din terninglyd</p>
                <p className="text-[11px] text-zinc-500">
                  Trykk for å høre. Lyden du trykket sist, spilles når du velger terning i voteringen.
                </p>
                <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Velg din terninglyd">
                  {FUN_SOUNDS.map((snd) => {
                    const active = diceSound === snd.id;
                    return (
                      <button
                        key={snd.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => chooseDiceSound(snd.id)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center active:scale-95 transition ${
                          active ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400" : "border-zinc-300 bg-white"
                        }`}
                      >
                        <span className="text-2xl leading-none">{snd.emoji}</span>
                        <span className="text-[10px] font-medium leading-tight text-zinc-700">{snd.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-white active:opacity-90"
                  onClick={async () => {
                    if (pin.length === 4) {
                      const res = await fetch("/api/pin/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          pin,
                          nickname: nickname || undefined,
                          beer_name: competitor || undefined,
                          producer: producer || undefined,
                          beer_type: (beerType === "__custom__" ? (customBeerType || undefined) : (beerType || undefined)),
                          abv: strength ? Number(strength) : undefined,
                        }),
                      }).catch(() => null);
                      if (res && res.ok) {
                        setProfileSaved(true);
                        setTimeout(() => setProfileSaved(false), 2000);
                      }
                    }
                  }}
                >
                  Lagre
                </button>
                <button
                  className="rounded-xl bg-purple-600 px-4 py-3 text-white active:opacity-90"
                  onClick={() => setView("lobby")}
                >
                  Fortsett til lobby
                </button>
              </div>
              {profileSaved && (
                <div className="text-xs text-emerald-700">Detaljer lagret!</div>
              )}
              <div className="pt-2">
                <button
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={logout}
                >
                  Logg ut
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Lobby beer info modal: image (if any) shrinks to fit, info always visible */}
        {lobbyBeerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => { setLobbyBeerOpen(false); setLobbyImageSrc(null); }}
          >
            <div
              className="relative flex max-h-[90dvh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute right-2 top-2 z-10 rounded-md bg-white/90 px-2 py-1 text-sm shadow"
                onClick={() => { setLobbyBeerOpen(false); setLobbyImageSrc(null); }}
                aria-label="Lukk"
              >
                ✕
              </button>
              {lobbyImageSrc && (
                <div className="flex shrink items-center justify-center p-2">
                  {/* Fixed max height (not %): tall, narrow photos can never push the info out */}
                  <img
                    src={lobbyImageSrc}
                    alt={lobbyImageBeerName || lobbyImageName || "Ølbilde"}
                    className="max-h-[min(55dvh,calc(90dvh-12rem))] w-auto max-w-full rounded-lg object-contain"
                  />
                </div>
              )}
              {(lobbyImageName || lobbyImageBeerName || lobbyImageProducer || lobbyImageBeerType || lobbyImageAbv) && (
                <div className="shrink-0 px-4 pb-3 pt-2 text-center text-sm text-zinc-700">
                  {lobbyImageName && <div className="font-semibold text-base">{lobbyImageName}</div>}
                  {lobbyImageBeerName && (
                    <div>Ølnavn: <span className="font-medium text-zinc-800">{lobbyImageBeerName}</span></div>
                  )}
                  {lobbyImageProducer && (
                    <div>Produsent: <span className="font-medium text-zinc-800">{lobbyImageProducer}</span></div>
                  )}
                  {lobbyImageBeerType && (
                    <div>Øltype: <span className="font-medium text-zinc-800">{lobbyImageBeerType}</span></div>
                  )}
                  {lobbyImageAbv && (
                    <div>ABV: <span className="font-medium text-zinc-800">{lobbyImageAbv}%</span></div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {view === "login" && (
          <section className="space-y-5">
            <h2 className="text-xl font-semibold">Logg inn eller opprett PIN</h2>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <label className="mb-2 block text-sm text-zinc-600">4-sifret PIN</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="____"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-2xl tracking-widest"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-white active:opacity-90"
                  onClick={login}
                >
                  Logg inn
                </button>
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-white active:opacity-90"
                  onClick={createPin}
                >
                  Opprett bruker
                </button>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-sm text-zinc-600">Fornavn (påkrevd)</label>
                <input
                  placeholder="Navn"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            </div>
          </section>
        )}

        {view === "lobby" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Lobby</h2>
              {/* The juleølhatt, gently rocking – lined up with the Podium button below */}
              <img
                src="/img/mcga.png"
                alt="Juleølhatten"
                className="animate-hatrock mr-[17px] h-12 w-12 drop-shadow-md"
              />
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                  Deltakere: {activeCount}/{participants.length} aktive
                  {expectedGuests.length > 0
                    ? ` · ${expectedGuests.length} forventet`
                    : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  Runde {round} {statusLoading ? "…" : ""}
          </p>
        </div>
              <div className="mt-2 flex items-center justify-between">
                {isHost ? (
                  <button
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white active:opacity-90"
                    onClick={() => confirmAdmin(async () => {
                      setError(null);
                      await nextRound();
                      fetchStatus();
                    })}
                  >
                    Start ny runde
                  </button>
                ) : <span />}
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-sm active:opacity-90 disabled:opacity-60 ${
                    awardUnlocked ? "bg-amber-500" : "bg-zinc-400"
                  }`}
                  onClick={() => setShowPodium(true)}
                  disabled={!awardUnlocked}
                  title={awardUnlocked ? undefined : "Låses opp når verten trykker «Unlock award ceremony»"}
                >
                  {awardUnlocked ? "Podium" : "🔒 Podium"}
                </button>
              </div>
              <div className="mt-2 grid [grid-template-columns:28px_1.1fr_1.9fr_56px] gap-1 px-3 py-2 text-xs font-medium text-zinc-600">
                <button
                  className="text-left"
                  onClick={() => {
                    if (sortKey === "rank") {
                      // toggle rank defaults to received desc
                      setSortKey("received");
                      setSortDir("desc");
                    } else {
                      setSortKey("rank");
                      setSortDir("desc");
                    }
                  }}
                >
                  Rang
                </button>
                <button
                  className="text-left"
                  onClick={() => {
                    if (sortKey === "name") {
                      setSortDir(sortDir === "asc" ? "desc" : "asc");
                    } else {
                      setSortKey("name");
                      setSortDir("asc");
                    }
                  }}
                >
                  Navn {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </button>
                <button
                  className="text-left"
                  onClick={() => {
                    if (sortKey === "beer") {
                      setSortDir(sortDir === "asc" ? "desc" : "asc");
                    } else {
                      setSortKey("beer");
                      setSortDir("asc");
                    }
                  }}
                >
                  Ølnavn {sortKey === "beer" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </button>
                <button
                  className="text-right"
                  onClick={() => {
                    if (sortKey === "received") {
                      setSortDir(sortDir === "desc" ? "asc" : "desc");
                    } else {
                      setSortKey("received");
                      setSortDir("desc");
                    }
                  }}
                >
                  Points {sortKey === "received" ? (sortDir === "desc" ? "▼" : "▲") : ""}
                </button>
              </div>
              <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
                {participants.length === 0 && expectedGuests.length === 0 && (
                  <li className="px-3 py-2 text-sm text-zinc-500">Ingen deltakere</li>
                )}
                {participants
                  .slice()
                  .sort((a, b) => {
                    const aName = (a.nickname || "").trim();
                    const bName = (b.nickname || "").trim();
                    const aBeer = (a.beer_name || "").trim();
                    const bBeer = (b.beer_name || "").trim();
                    // Use revealed-only totals when reflecting overview
                    const aRecv = canShowScores ? (combinedReceivedByPin[a.pin] ?? 0) : 0;
                    const bRecv = canShowScores ? (combinedReceivedByPin[b.pin] ?? 0) : 0;
                    const dir = sortDir === "asc" ? 1 : -1;
                    if (sortKey === "received") {
                      if (aRecv !== bRecv) return (aRecv - bRecv) * dir;
                      // tie-break by name if equal
                      return aName.localeCompare(bName);
                    }
                    if (sortKey === "name") {
                      const cmp = aName.localeCompare(bName);
                      if (cmp !== 0) return cmp * (sortDir === "asc" ? 1 : -1);
                      return (aRecv - bRecv) * -1;
                    }
                    if (sortKey === "beer") {
                      const cmp = aBeer.localeCompare(bBeer);
                      if (cmp !== 0) return cmp * (sortDir === "asc" ? 1 : -1);
                      return (aRecv - bRecv) * -1;
                    }
                    // rank default: received desc
                    if (aRecv !== bRecv) return (aRecv - bRecv) * -1;
                    return aName.localeCompare(bName);
                  })
                  .map((p, idx) => {
                    const name = (p.nickname || "").trim() || "Uten navn";
                    const rank = combinedRankMap[p.pin] ?? idx + 1;
                    const received = combinedReceivedByPin[p.pin] ?? 0;
                    const beerName = (p.beer_name || "").trim() || "—";
                    return (
                      <li
                        key={p.pin}
                        className={`grid [grid-template-columns:28px_1.1fr_1.9fr_56px] items-center gap-1 px-3 py-2 text-sm ${
                          p.active ? "" : "text-zinc-400 bg-zinc-50"
                        }`}
                      >
                        <div className="col-span-1 tabular-nums">{canShowScores ? rank : "—"}</div>
                        <div className="col-span-1 truncate">{name}</div>
                        <div className="col-span-1 truncate">
                          {(() => {
                            const img = beerImageForParticipant(p);
                            if (p.beer_name) {
                              return (
                                <button
                                  className="underline text-blue-700 hover:text-blue-800"
                                  onClick={() => {
                                    setLobbyBeerOpen(true);
                                    setLobbyImageSrc(img);
                                    setLobbyImageName(name);
                                    setLobbyImageBeerName(p.beer_name || "");
                                    setLobbyImageProducer((p.producer || "").trim());
                                    setLobbyImageBeerType((p.beer_type || "").trim());
                                    const abvVal = p.abv != null ? Number(p.abv) : NaN;
                                    setLobbyImageAbv(Number.isFinite(abvVal) ? abvVal.toFixed(1) : "");
                                  }}
                                >
                                  {beerName}
                                </button>
                              );
                            }
                            return <span>{beerName}</span>;
                          })()}
                        </div>
                        <div className="col-span-1 tabular-nums text-right">
                          {canShowScores ? Number(received).toFixed(1) : "—"}
                        </div>
                      </li>
                    );
                  })}
                {expectedGuests.map((g) => (
                  <li
                    key={`expected-${g.name}`}
                    className="grid [grid-template-columns:28px_1.1fr_1.9fr_56px] items-center gap-1 bg-amber-50/70 px-3 py-2 text-sm text-zinc-600"
                  >
                    <div className="col-span-1 tabular-nums text-zinc-400">—</div>
                    <div className="col-span-1 truncate font-medium text-zinc-800">
                      {g.name}
                    </div>
                    <div className="col-span-1 truncate text-xs text-amber-900/80">
                      Kommer · oppretter bruker på kvelden
                    </div>
                    <div className="col-span-1 text-right text-zinc-400">—</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(() => {
                // Flow: Start ny runde → Finn en utvalgt → Til Votéring
                const hasChosenThisRound = pickedRound === round;
                // Not gated on statusLoading: that flips on every 2s poll and made the
                // buttons flicker/ignore taps. Initial state already keeps both locked.
                const canFindChosen = roundStarted && !hasChosenThisRound;
                const canGoVote = hasChosenThisRound;
                return (
                  <>
                    <button
                      className="rounded-xl bg-emerald-600 px-4 py-4 text-white active:opacity-90 disabled:opacity-50"
                      onClick={() => setView("picker")}
                      disabled={!canFindChosen}
                      title={
                        statusLoading
                          ? "Laster…"
                          : !roundStarted
                            ? "Verten må starte ny runde først"
                            : hasChosenThisRound
                              ? "Utvalgt er allerede funnet denne runden"
                              : undefined
                      }
                    >
                      1. Finn en utvalgt
                    </button>
                    <button
                      className="rounded-xl bg-blue-600 px-4 py-4 text-white active:opacity-90 disabled:opacity-50"
                      onClick={() => setView("voting")}
                      disabled={!canGoVote}
                      title={!canGoVote ? "Finn en utvalgt først" : undefined}
                    >
                      2. Til Votéring!
                    </button>
                  </>
                );
              })()}
              <button
                className="rounded-xl bg-[#D94E53] px-4 py-4 text-white opacity-80 active:opacity-90"
                onClick={() => setView("overview")}
              >
                Full oversikt
              </button>
              <a
                href="/invite"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center text-zinc-900 active:bg-zinc-50"
              >
                Om Gulmasse
              </a>
            </div>
          </section>
        )}

        {/* Podium modal */}
        {showPodium && awardUnlocked && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowPodium(false)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-1 text-sm shadow"
                onClick={() => setShowPodium(false)}
                aria-label="Lukk"
              >
                ✕
              </button>
              <h3 className="mb-4 text-center text-lg font-semibold">Podium</h3>
              {canShowScores ? (() => {
                const items = participants.map((p) => ({
                  pin: p.pin,
                  name: (p.nickname || "").trim() || p.pin,
                  beer: (p.beer_name || "").trim(),
                  image: beerImageForParticipant(p),
                  received: combinedReceivedByPin[p.pin] ?? 0,
                  given: combinedGivenByPin[p.pin] ?? 0,
                }));
                items.sort((a, b) => {
                  if (a.received !== b.received) return b.received - a.received;
                  if (a.given !== b.given) return b.given - a.given;
                  return a.name.localeCompare(b.name);
                });
                const top = items.slice(0, 3);
                const maxVal = Math.max(1, ...top.map((t) => Number(t.received) || 0));
                return (
                  <div className="grid grid-cols-3 items-end gap-3">
                    {top.map((t, i) => {
                      const height = 60 + ((Number(t.received) || 0) / maxVal) * 80; // 60-140px
                      // order: 2nd, 1st, 3rd visually (left, center, right)
                      const orderClass = i === 0 ? "order-2" : i === 1 ? "order-1" : "order-3";
                      const crown = i === 0 ? " 👑" : "";
                      const img = t.image;
                      return (
                        <div key={t.pin} className={`flex flex-col items-center ${orderClass}`}>
                          <div className="w-full flex flex-col items-center">
                            {img && (
                              <img
                                src={img}
                                alt={t.beer || t.name}
                                className="w-3/4 h-auto rounded-md object-contain ring-1 ring-zinc-200 mb-2"
                              />
                            )}
                            <div
                              className="w-full rounded-t-lg bg-emerald-600 text-white"
                              style={{ height }}
                              title={`${t.received} pts`}
                            />
                          </div>
                          <div className="mt-2 truncate text-center text-sm font-medium">
                            {t.name}{crown}
                          </div>
                          <div className="truncate text-center text-xs text-zinc-600">{t.beer || "—"}</div>
                          <div className="text-xs text-zinc-700">{Number(t.received).toFixed(1)} pts</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <div className="rounded-lg bg-zinc-50 p-4 text-center text-sm text-zinc-600">
                  Podium oppdateres når resultater blir avslørt.
                </div>
              )}
              <div className="mt-4">
                <button
                  className={`w-full rounded-xl px-4 py-3 text-white text-sm font-medium active:opacity-90 disabled:opacity-50 ${awardUnlocked ? 'bg-amber-500' : 'bg-zinc-400'}`}
                  onClick={() => { setShowPodium(false); setShowAward(true); }}
                  disabled={!awardUnlocked}
                >
                  Award ceremony
                </button>
        </div>
            </div>
          </div>
        )}

        {view === "voting" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Votering</h2>
              <button
                className="rounded-md bg-purple-600 px-3 py-1 text-sm text-white active:opacity-90"
                onClick={() => setView("lobby")}
              >
                Lobby
              </button>
        </div>
            {pickedRound === round && selected ? (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 overflow-visible">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Vi stemmer over:</div>
                  <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-4">
                    {selected.image && (
                      <button
                        className="focus:outline-none"
                        onClick={() => setShowBeerImage(true)}
                        aria-label="Vis større bilde"
                      >
                        <img
                          src={selected.image}
                          alt={selected.beerName || selected.name}
                          className="h-28 w-28 md:h-32 md:w-32 flex-shrink-0 rounded-lg object-cover ring-1 ring-zinc-200"
                        />
                      </button>
                    )}
                  <div className="relative min-w-0 pt-16 text-center">
                    {hatDrop && (
                      <img
                        key={`vote-hat-${selected.pin}-${pickedRound}`}
                        src="/img/mcga.png"
                        alt=""
                        className="pointer-events-none absolute left-1/2 animate-hatdrop h-[4.5rem] w-[4.5rem] md:h-[5.25rem] md:w-[5.25rem]"
                        style={{ top: "0px" } as any}
                      />
                    )}
                      <div className="text-2xl md:text-3xl font-bold text-zinc-900 truncate">
                        {selected.name}
        </div>
                      {selected.beerName ? (
                        <div className="mt-0.5 text-xl md:text-2xl text-zinc-700 truncate">
                          {selected.beerName}
                        </div>
                      ) : null}
                      <div className="mt-2 space-y-1 text-sm text-zinc-700">
                        {selected.producer && (
                          <div>
                            <span className="text-zinc-500">Produsent:</span>{" "}
                            <span className="font-medium">{selected.producer}</span>
                          </div>
                        )}
                        {selected.beerType && (
                          <div>
                            <span className="text-zinc-500">Øltype:</span>{" "}
                            <span className="font-medium">{selected.beerType}</span>
                          </div>
                        )}
                        {selected.abv != null && !Number.isNaN(selected.abv) && (
                          <div>
                            <span className="text-zinc-500">ABV:</span>{" "}
                            <span className="font-medium">{Number(selected.abv).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Alle kan spinne lokalt her – påvirker ikke den offisielle utvelgelsen */}
                {/* (Fjernet lokal spinner i votering) */}
                {showBeerImage && selected.image && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setShowBeerImage(false)}
                  >
                    <div
                      className="relative max-h-[90vh] max-w-[90vw] rounded-xl bg-white p-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-sm shadow"
                        onClick={() => setShowBeerImage(false)}
                        aria-label="Lukk"
                      >
                        ✕
                      </button>
                      <img
                        src={selected.image}
                        alt={selected.beerName || selected.name}
                        className="max-h-[80vh] max-w-[80vw] rounded-lg object-contain"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-600">
                Ingen utvalgt denne runden ennå. Gå til <span className="font-medium">Finn en utvalgt</span> først.
              </div>
            )}
            <div className="text-center text-sm font-medium text-zinc-700">Beer points:</div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const isSel = (pendingVote ?? voted) === n;
                const alreadyVoted = voted != null || (Boolean(pin) && votedPins.includes(pin));
                const canVoteNow = pickedRound === round && Boolean(selected);
                return (
                  <button
                    key={n}
                    className={`flex h-20 items-center justify-center rounded-xl border ${
                      isSel ? "border-blue-700 ring-2 ring-blue-400" : "border-zinc-200"
                    } bg-white active:opacity-90`}
                    onClick={() => {
                      if (!canVoteNow || alreadyVoted) return;
                      setPendingVote(n);
                      playDiceSound(n);
                    }}
                    aria-label={`Gi ${n} poeng`}
                    disabled={!canVoteNow || alreadyVoted}
                  >
                    <img
                      src={`/img/${n}.png`}
                      alt={`${n}`}
                      className="h-16 w-16 object-contain"
                    />
                    <span className="sr-only">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-zinc-700 text-center">
                Generell opplevelse, pitch, etikett, x-faktor
              </div>
              <div className="grid grid-cols-6 gap-2">
                {[1,2,3,4,5,6].map((n) => {
                  const isSel = pendingExtraVote === n;
                  const alreadyVoted = voted != null || (Boolean(pin) && votedPins.includes(pin));
                  const canVoteNow = pickedRound === round && Boolean(selected);
                  return (
                    <button
                      key={`x-${n}`}
                      className={`flex h-14 items-center justify-center rounded-lg border ${
                        isSel ? "border-amber-700 ring-2 ring-amber-400" : "border-zinc-200"
                      } bg-white active:opacity-90`}
                      onClick={() => {
                        if (!canVoteNow || alreadyVoted) return;
                        setPendingExtraVote(n);
                        playDiceSound(n);
                      }}
                      aria-label={`Ekstra ${n} poeng`}
                      disabled={!canVoteNow || alreadyVoted}
                    >
                      <img
                        src={`/img/${n}.png`}
                        alt={`${n}`}
                        className="h-10 w-10 object-contain"
                      />
                      <span className="sr-only">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {!(voted != null || (Boolean(pin) && votedPins.includes(pin))) ? (
              <div>
                <button
                  className="w-full rounded-xl bg-blue-600 px-4 py-4 text-white active:opacity-90 disabled:opacity-50"
                  onClick={() => {
                    // Same «pling-pling» for everyone when pressing «Lås poeng»
                    const ctx = getAudio();
                    if (ctx) playConfirmSound(ctx);
                    setShowLockConfirm(true);
                  }}
                  disabled={!(pickedRound === round && Boolean(selected)) || pendingVote == null || pendingExtraVote == null}
                >
                  Lås poeng
                </button>
                <div className="mt-2 text-center text-sm text-zinc-600">
                  {!(pickedRound === round && Boolean(selected))
                    ? `Venter på utvelgelse`
                    : ((pendingVote != null || pendingExtraVote != null)
                        ? `Valgt: ${pendingVote ?? "—"} poeng · Ekstra: ${pendingExtraVote ?? "—"}`
                        : `Velg terning!`)}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-emerald-700">Stemme avgitt, poeng låst, venter på ny runde</div>
            )}

            {showLockConfirm && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                onClick={() => setShowLockConfirm(false)}
              >
                <div
                  className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold">Lås poeng</h3>
                  <p className="mt-2 text-sm text-zinc-700">
                    Er du sikker? Poeng blir låst for denne stemmerunden.
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-zinc-600">
                    <div>Smak: {pendingVote != null ? pendingVote : "—"} poeng</div>
                    <div>Ekstra: {pendingExtraVote != null ? pendingExtraVote : "—"} poeng</div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      className="rounded-lg border border-zinc-300 px-4 py-2 active:bg-zinc-50"
                      onClick={() => setShowLockConfirm(false)}
                    >
                      Avbryt
                    </button>
                    <button
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white active:opacity-90 disabled:opacity-50"
                      onClick={confirmLockVote}
                      disabled={pendingVote == null || pendingExtraVote == null}
                    >
                      Bekreft
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-zinc-600">
                Status: {votedCount}/{activeCount} har stemt
              </div>
              <table className="mt-2 w-full table-fixed text-xs">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[30%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="text-zinc-600">
                    <th className="px-1 py-1 text-left font-medium">Navn</th>
                    <th className="px-1 py-1 text-center font-medium">Status</th>
                    <th className="px-1 py-1 text-center font-medium">Beer dice</th>
                    <th className="px-1 py-1 text-center font-medium">Extra dice</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => {
                    const name = (p.nickname || "").trim() || p.pin;
                    const hasVoted = votedPins.includes(p.pin);
                    const beerVal = revealedVotesMap[p.pin];
                    const extraVal = revealedExtraMap[p.pin];
                    const revealedAny = typeof beerVal === "number" || typeof extraVal === "number";
                    return (
                      <tr key={p.pin} className="odd:bg-white even:bg-zinc-50">
                        <td className="px-1 py-1">
                          <span className="truncate text-sm text-zinc-800 block">{name}</span>
                        </td>
                        <td className="px-1 py-1 text-center">
                          {hasVoted && !revealedAny ? (
                            <span className="inline-block whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 ring-1 ring-emerald-200">
                              Stemme avgitt!
                            </span>
                          ) : ""}
                        </td>
                        <td className="px-1 py-1 text-center tabular-nums">
                          {typeof beerVal === "number" ? beerVal : (hasVoted ? "—" : "")}
                        </td>
                        <td className="px-1 py-1 text-center tabular-nums">
                          {typeof extraVal === "number" ? extraVal : (hasVoted ? "—" : "")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(activeCount > 0 && votedCount >= activeCount) ? (
                <div className="mt-3 space-y-2">
                  {(() => {
                    const revealedValues = Object.values(revealedVotesMap || {});
                    const revCount = revealedValues.length;
                    const revHist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
                    for (const v of revealedValues) {
                      if (v >= 1 && v <= 6) revHist[v] += 1;
                    }
                    const maxBar = Math.max(1, ...[1,2,3,4,5,6].map((n) => revHist[n] || 0));
                    const innerHeightPx = 48; // compact bars
                    const blockHeightPx = Math.max(4, Math.floor(innerHeightPx / maxBar) - 2);
                    if (revCount === 0) {
                      return (
                        <div className="mt-2 h-24 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">
                          Ingen avslørte stemmer ennå.
                        </div>
                      );
                    }
                    const sum = revealedValues.reduce((a, b) => a + (Number(b) || 0), 0);
                    const revAvg = revCount > 0 ? Number((sum / revCount).toFixed(2)) : 0;
                    return (
                      <>
                        <div className="flex items-end gap-3">
                          {[1,2,3,4,5,6].map((n) => {
                            const count = revHist[n] || 0;
                            return (
                              <div key={n} className="flex flex-1 min-w-0 flex-col items-center">
                                <div className="relative w-full rounded-md border border-zinc-200 bg-zinc-50 p-1" style={{ height: innerHeightPx }}>
                                  <div className="flex h-full w-full flex-col justify-end gap-1">
                                    {Array.from({ length: count }).map((_, i) => (
                                      <div
                                        key={i}
                                        className="w-full rounded-sm bg-blue-600"
                                        style={{ height: blockHeightPx }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">{n}</div>
                                <div className="text-xs">{count}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-sm text-zinc-700">
                          Snitt (av avslørte): <span className="font-medium">{revAvg.toFixed(2)}</span> ({revCount} avslørt{revCount === 1 ? "" : "e"})
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-2 h-24 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">
                  Resultater vises når alle har stemt.
                </div>
              )}
            </div>
            <div>
              <button
                className="w-full rounded-xl bg-zinc-900 px-4 py-4 text-white active:opacity-90 disabled:opacity-50"
                onClick={revealMyVote}
                disabled={
                  revealingVote ||
                  !((activeCount > 0 && votedCount >= activeCount) || allowReveal) ||
                  !(voted !== null || (pin && votedPins.includes(pin)))
                }
              >
                {revealingVote ? "🥁 Trommevirvel…" : "Avslør min stemme"}
              </button>
            </div>
            {showMyReveal && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                onClick={() => setShowMyReveal(false)}
              >
                <div
                  className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold">Din stemme</h3>
                  <div className="mt-3 flex flex-col items-center">
                    {(() => {
                      const val = voted != null ? voted : (revealedVotesMap[pin] ?? null);
                      if (val == null) return null;
                      return (
                      <>
                        <img
                          src={`/img/${val}.png`}
                          alt={`${val}`}
                          className="h-20 w-20 object-contain"
                        />
                        <div className="mt-2 text-2xl font-bold">{val}</div>
                      </>
                      );
                    })()}
                  </div>
                  <div className="mt-4">
                    <button
                      className="w-full rounded-lg border border-zinc-300 px-4 py-2 active:bg-zinc-50"
                      onClick={() => setShowMyReveal(false)}
                    >
                      Lukk
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {view === "picker" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Utvelger</h2>
              <button
                className="rounded-md bg-purple-600 px-3 py-1 text-sm text-white active:opacity-90"
                onClick={() => setView("lobby")}
              >
                Lobby
              </button>
            </div>
              <div className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4 relative ${showCelebration ? "overflow-visible" : "overflow-hidden"}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">
                  Gjenstående:{" "}
                  <span className="font-medium">
                    {Math.max(0, participants.filter(p=>p.active).length - picks.length)}
                  </span>
                </div>
              </div>
              {/* PickerWheel component */}
              <PickerWheel
                disabled={pickedRound === round || !roundStarted}
                participants={participants
                  .filter(p => p.active)
                  .map(p => ({ id: p.pin, name: (p.nickname || "").trim() || p.pin, selected: picks.includes(p.pin) }))}
                onSpinStart={() => {
                  getAudio();
                  startDrumroll();
                }}
                onSpinEnd={() => {
                  stopDrumroll();
                }}
                onPick={async (picked) => {
                  // Persist pick server-side; only proceed if it succeeds so voting recipient is authoritative
                  let persistedPin: string | null = null;
                  try {
                    const res = await fetch("/api/pick", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ pin: picked.id }),
                    });
                    if (res.ok) {
                      const j = await res.json().catch(() => ({}));
                      if (typeof j?.pin === "string") persistedPin = j.pin;
                    } else {
                      let msg = "";
                      try {
                        const jerr = await res.json();
                        msg = jerr?.error || "";
                      } catch {}
                      stopDrumroll();
                      if (res.status === 409) {
                        // Known conflict cases: already picked this round or no candidates left
                        if (/already picked/i.test(msg)) {
                          setError("Det er allerede gjort et valg i denne runden.");
                        } else if (/No candidates left/i.test(msg)) {
                          setError("Ingen deltakere igjen å velge. Bruk 'Resett alle deltakere'.");
                        } else if (/Round not started/i.test(msg)) {
                          setError("Runden er ikke startet. Verten må trykke «Start ny runde».");
                        } else {
                          setError(msg || "Kan ikke gjøre nytt valg nå.");
                        }
                        await fetchStatus();
                        return;
                      }
                      setError(msg || "Kunne ikke lagre utvalg – prøv igjen");
                      return;
                    }
                  } catch {
                    // network error handled below
                  }
                  if (!persistedPin) {
                    stopDrumroll();
                    setError("Kunne ikke lagre utvalg – prøv igjen");
                    return;
                  }
                  const match = participants.find(x => x.pin === persistedPin);
                  setLastPicked({
                    name: (match?.nickname || "").trim() || picked.name,
                    beerName: (match?.beer_name || "").trim() || undefined,
                  });
                  // Reset local voting UI immediately for new selection
                  setVoted(null);
                  setPendingVote(null);
                  setShowMyReveal(false);
                  setRevealedVotesMap({});
                  setVotedPins([]);
                  stopDrumroll();
                  playFanfare();
                  setHatDrop(true);
                  setShowCelebration(true);
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    // @ts-ignore
                    navigator.vibrate?.([60, 40, 80]);
                  }
                  setTimeout(() => { setShowCelebration(false); /* keep hat for voting view */ }, 3000);
                  // Oppdater status slik at "Ferdig dystet!" og Votering reflekterer valget
                  fetchStatus();
                }}
              />
              {/* Right under the wheel so nobody has to scroll to find it.
                  Grey until someone is actually picked in this round. */}
              <button
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white active:opacity-90 disabled:bg-zinc-400 disabled:opacity-70"
                onClick={() => setView("voting")}
                disabled={pickedRound !== round}
                title={pickedRound !== round ? "Snurr hjulet først" : undefined}
              >
                Til Votéring!
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-zinc-600 mb-1">Gjenstående deltakere</div>
                  <div className="flex flex-wrap gap-2">
                    {participants.filter(p=>p.active && !picks.includes(p.pin)).length === 0 && (
                      <span className="text-xs text-zinc-400">Ingen</span>
                    )}
                    {participants.filter(p=>p.active && !picks.includes(p.pin)).map(p=>{
                      const n = (p.nickname || "").trim() || p.pin;
                      return <span key={p.pin} className="rounded-full border border-zinc-300 px-3 py-1 text-xs">{n}</span>;
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-600 mb-1">Ferdig dystet!</div>
                  <div className="flex flex-wrap gap-2">
                    {picks.length === 0 && <span className="text-xs text-zinc-400">Ingen</span>}
                    {picks.map(ppin => {
                      const n = (participants.find(x=>x.pin===ppin)?.nickname || "").trim() || ppin;
                      return <span key={ppin} className="rounded-full border border-zinc-300 px-3 py-1 text-xs">{n}</span>;
                    })}
                  </div>
                </div>
              </div>
              {isHost && (
                <div className="pt-2">
                  <button
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm active:bg-zinc-50"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/host/undo-pick", {
                          method: "POST",
                          headers: { "x-host-pin": pin },
                        });
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          setError(data.error || "Kunne ikke legge tilbake");
                          return;
                        }
                        setError(null);
                        fetchStatus();
                      } catch {
                        setError("Nettverksfeil ved legg tilbake");
                      }
                    }}
                    disabled={picks.length === 0}
                  >
                    Legg tilbake
                  </button>
                </div>
              )}
              {showCelebration && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-visible bg-white/85 backdrop-blur-sm">
                  <div className="rounded-2xl border border-emerald-300 bg-white px-6 py-5 pt-16 text-center shadow-xl relative">
                    <div className="text-xs uppercase tracking-wide text-emerald-700">Valgt</div>
                    <div className="mt-1 relative">
                      {hatDrop && (
                        <img
                          key={`pick-hat-${lastPicked?.name || selected?.name || "x"}`}
                          src="/img/mcga.png"
                          alt=""
                          className="pointer-events-none absolute left-1/2 animate-hatdrop h-16 w-16 md:h-20 md:w-20"
                          style={{ top: "-72px" } as any}
                        />
                      )}
                      <div className="text-2xl font-bold text-emerald-900">
                        {lastPicked?.name || selected?.name}
                      </div>
                    </div>
                    { (lastPicked?.beerName || selected?.beerName) ? (
                      <div className="text-lg text-emerald-800">
                        {(lastPicked?.beerName || selected?.beerName)}
                      </div>
                    ) : null}
                  </div>
                  {/* Simple confetti */}
                  <div className="absolute inset-0 overflow-hidden">
                    {Array.from({ length: 80 }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute block h-2 w-2 animate-confetti rounded-[1px]"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `-${Math.random() * 20}%`,
                          backgroundColor: ['#10b981', '#34d399', '#059669', '#6ee7b7'][i % 4],
                          animationDelay: `${Math.random() * 0.6}s`,
                          animationDuration: `${1.6 + Math.random() * 0.8}s`,
                          transform: `rotate(${Math.random() * 360}deg)`
                        } as any}
                      />
                    ))}
                  </div>
                </div>
              )}
              {pickedRound === round && (
                <div className="pt-2 text-center text-sm text-zinc-600">
                  Denne runden er valgt. Vent til neste runde eller bruk "Legg tilbake".
                </div>
              )}
              {!roundStarted && pickedRound !== round && (
                <div className="pt-2 text-center text-sm text-zinc-600">
                  Verten må trykke «Start ny runde» før dere kan spinne.
                </div>
              )}
            </div>
          </section>
        )}

        {view === "overview" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Full oversikt</h2>
              <button
                className="rounded-md bg-purple-600 px-3 py-1 text-sm text-white active:opacity-90"
                onClick={() => setView("lobby")}
              >
                Lobby
              </button>
            </div>
            {(() => {
              // Host sees live votes (all); others only after reveal — so host can verify scoring
              const ovPair = isHost ? pairTotalsAllMap : pairTotalsMap;
              const ovExtra = isHost ? pairTotalsExtraAllMap : pairTotalsExtraMap;
              const ovGiven: Record<string, number> = {};
              const ovRecv: Record<string, number> = {};
              let ovTotal = 0;
              for (const from of Object.keys(ovPair)) {
                for (const to of Object.keys(ovPair[from] || {})) {
                  const v = Number(ovPair[from][to] || 0);
                  if (v <= 0) continue;
                  ovGiven[from] = (ovGiven[from] ?? 0) + v;
                  ovRecv[to] = (ovRecv[to] ?? 0) + v;
                  ovTotal += v;
                }
              }
              const ovExtraGiven: Record<string, number> = {};
              const ovExtraRecv: Record<string, number> = {};
              let ovExtraTotal = 0;
              for (const from of Object.keys(ovExtra)) {
                for (const to of Object.keys(ovExtra[from] || {})) {
                  const v = Number(ovExtra[from][to] || 0);
                  if (v <= 0) continue;
                  ovExtraGiven[from] = (ovExtraGiven[from] ?? 0) + v;
                  ovExtraRecv[to] = (ovExtraRecv[to] ?? 0) + v;
                  ovExtraTotal += v;
                }
              }
              return (
            <>
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm overflow-x-auto">
              <div className="mb-1 text-sm font-bold text-zinc-700">
                Beer points:
              </div>
              <div className="mb-2 text-[11px] text-zinc-500">
                {isHost
                  ? "Vert: viser alle stemmer live (også før avsløring)."
                  : "Viser kun stemmer som er avslørt."}
              </div>
              {isHost && (
                <div className="mb-3 flex justify-end">
                  <button
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white active:opacity-90"
                    onClick={() => {
                      // Results + who-gave-what matrices, Excel-friendly (see lib/exportCsv)
                      const csv = buildResultsCsv({
                        participants,
                        pair: ovPair,
                        extra: ovExtra,
                        factor: Number(sumFactor) || 0,
                      });
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `gulmasse-26-resultat-${new Date().toISOString().slice(0, 10)}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Last ned CSV
                  </button>
                </div>
              )}
              {participants.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500">Ingen deltakere</div>
              ) : (
                <table className="min-w-full border-collapse text-xs md:text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white p-2 text-left font-medium text-zinc-600 border-b border-zinc-200">
                        Giver → Mottaker
                      </th>
                      {participants.map((rec) => {
                        const name = (rec.nickname || "").trim() || rec.pin;
                        return (
                          <th key={rec.pin} className="p-2 text-left font-medium text-zinc-600 border-b border-zinc-200">
                            {name}
                          </th>
                        );
                      })}
                      <th className="p-2 text-right font-medium text-zinc-600 border-b border-zinc-200">
                        Gitt (sum)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((giver) => {
                      const giverName = (giver.nickname || "").trim() || giver.pin;
                      return (
                        <tr key={giver.pin} className="odd:bg-white even:bg-zinc-50">
                          <th className="sticky left-0 z-10 bg-inherit p-2 text-left font-medium text-zinc-700 border-b border-zinc-200">
                            {giverName}
                          </th>
                          {participants.map((rec) => {
                            const val = ovPair[giver.pin]?.[rec.pin] ?? 0;
                            return (
                              <td key={rec.pin} className="p-2 border-b border-zinc-200 tabular-nums text-center">
                                {val > 0 ? val : "—"}
                              </td>
                            );
                          })}
                          <td className="p-2 border-b border-zinc-200 tabular-nums text-right font-medium">
                            {(ovGiven[giver.pin] ?? 0) > 0 ? (ovGiven[giver.pin] ?? 0) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-50">
                      <th className="sticky left-0 z-10 bg-zinc-50 p-2 text-left font-semibold text-zinc-700 border-t border-zinc-200">
                        Sum mottatt
                      </th>
                      {participants.map((rec) => {
                        const colSum = ovRecv[rec.pin] ?? 0;
                        return (
                          <td key={`sum-${rec.pin}`} className="p-2 border-t border-zinc-200 tabular-nums text-center font-semibold">
                            {colSum > 0 ? colSum : "—"}
                          </td>
                        );
                      })}
                      <td className="p-2 border-t border-zinc-200 tabular-nums text-right font-semibold">
                        {ovTotal > 0 ? ovTotal : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm overflow-x-auto">
              <div className="mb-2 text-sm font-bold text-zinc-700">
                Extra points:
              </div>
              {participants.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500">Ingen deltakere</div>
              ) : (
                <table className="min-w-full border-collapse text-xs md:text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white p-2 text-left font-medium text-zinc-600 border-b border-zinc-200">
                        Giver → Mottaker
                      </th>
                      {participants.map((rec) => {
                        const name = (rec.nickname || "").trim() || rec.pin;
                        return (
                          <th key={`x-${rec.pin}`} className="p-2 text-left font-medium text-zinc-600 border-b border-zinc-200">
                            {name}
                          </th>
                        );
                      })}
                      <th className="p-2 text-right font-medium text-zinc-600 border-b border-zinc-200">
                        Gitt (ekstra)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((giver) => {
                      const giverName = (giver.nickname || "").trim() || giver.pin;
                      return (
                        <tr key={`x-${giver.pin}`} className="odd:bg-white even:bg-zinc-50">
                          <th className="sticky left-0 z-10 bg-inherit p-2 text-left font-medium text-zinc-700 border-b border-zinc-200">
                            {giverName}
                          </th>
                          {participants.map((rec) => {
                            const val = ovExtra[giver.pin]?.[rec.pin] ?? 0;
                            return (
                              <td key={`x-${rec.pin}`} className="p-2 border-b border-zinc-200 tabular-nums text-center">
                                {val > 0 ? val : "—"}
                              </td>
                            );
                          })}
                          <td className="p-2 border-b border-zinc-200 tabular-nums text-right font-medium">
                            {(ovExtraGiven[giver.pin] ?? 0) > 0 ? (ovExtraGiven[giver.pin] ?? 0) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-50">
                      <th className="sticky left-0 z-10 bg-zinc-50 p-2 text-left font-semibold text-zinc-700 border-t border-zinc-200">
                        Sum mottatt (ekstra)
                      </th>
                      {participants.map((rec) => {
                        const colSum = ovExtraRecv[rec.pin] ?? 0;
                        return (
                          <td key={`x-sum-${rec.pin}`} className="p-2 border-t border-zinc-200 tabular-nums text-center font-semibold">
                            {colSum > 0 ? colSum : "—"}
                          </td>
                        );
                      })}
                      <td className="p-2 border-t border-zinc-200 tabular-nums text-right font-semibold">
                        {ovExtraTotal > 0 ? ovExtraTotal : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm overflow-x-auto">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold text-zinc-700">
                  Sum of points
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-600" htmlFor="sumFactor">Factor (extra):</label>
                  <input
                    id="sumFactor"
                    type="number"
                    step="0.1"
                    min="0"
                    className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-right text-xs"
                    value={Number.isFinite(sumFactor) ? sumFactor : 0}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) setSumFactor(v);
                    }}
                  />
                </div>
              </div>
              {participants.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500">Ingen deltakere</div>
              ) : (
                <table className="min-w-full border-collapse text-xs md:text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white p-2 text-left font-medium text-zinc-600 border-b border-zinc-200">
                        Giver → Mottaker
                      </th>
                      {participants.map((rec) => {
                        const name = (rec.nickname || "").trim() || rec.pin;
                        return (
                          <th key={`s-${rec.pin}`} className="p-2 text-left font-medium text-zinc-600 border-b border-zinc-200">
                            {name}
                          </th>
                        );
                      })}
                      <th className="p-2 text-right font-medium text-zinc-600 border-b border-zinc-200">
                        Gitt (sum)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((giver) => {
                      const giverName = (giver.nickname || "").trim() || giver.pin;
                      let rowSum = 0;
                      return (
                        <tr key={`s-${giver.pin}`} className="odd:bg-white even:bg-zinc-50">
                          <th className="sticky left-0 z-10 bg-inherit p-2 text-left font-medium text-zinc-700 border-b border-zinc-200">
                            {giverName}
                          </th>
                          {participants.map((rec) => {
                            const main = ovPair[giver.pin]?.[rec.pin] ?? 0;
                            const extra = ovExtra[giver.pin]?.[rec.pin] ?? 0;
                            const val = Number(main) + Number(sumFactor) * Number(extra);
                            rowSum += Number.isFinite(val) ? val : 0;
                            const txt = Number.isFinite(val) ? val.toFixed(1) : "—";
                            return (
                              <td key={`s-${rec.pin}`} className="p-2 border-b border-zinc-200 tabular-nums text-center">
                                {val > 0 ? txt : "—"}
                              </td>
                            );
                          })}
                          <td className="p-2 border-b border-zinc-200 tabular-nums text-right font-medium">
                            {rowSum > 0 ? rowSum.toFixed(1) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-50">
                      <th className="sticky left-0 z-10 bg-zinc-50 p-2 text-left font-semibold text-zinc-700 border-t border-zinc-200">
                        Sum mottatt (sum)
                      </th>
                      {participants.map((rec) => {
                        const colSum =
                          (ovRecv[rec.pin] ?? 0) + Number(sumFactor) * (ovExtraRecv[rec.pin] ?? 0);
                        return (
                          <td key={`s-sum-${rec.pin}`} className="p-2 border-t border-zinc-200 tabular-nums text-center font-semibold">
                            {colSum > 0 ? colSum.toFixed(1) : "—"}
                          </td>
                        );
                      })}
                      <td className="p-2 border-t border-zinc-200 tabular-nums text-right font-semibold">
                        {(() => {
                          const t = ovTotal + Number(sumFactor) * ovExtraTotal;
                          return t > 0 ? t.toFixed(1) : "—";
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            </>
              );
            })()}
          </section>
        )}

        {view === "lobby" && isHost && (
          <section className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-zinc-600">Host</h3>
            <div className="grid grid-cols-1">
              <button
                className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                onClick={() => setView("admin")}
              >
                Admin tools
              </button>
            </div>
          </section>
        )}

        {view === "admin" && isHost && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Admin tools</h2>
              <button
                className="rounded-md bg-purple-600 px-3 py-1 text-xs text-white active:opacity-90"
                onClick={() => setView("lobby")}
              >
                Tilbake til lobby
              </button>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
              <div className="text-sm text-zinc-600">
                Runde: <span className="font-medium">{round}</span> ·
                {" "}Valgt i runde: <span className="font-medium">{pickedRound > 0 ? pickedRound : "—"}</span> ·
                {" "}Utvalg: <span className="font-medium">{roundStarted ? "åpent" : "låst"}</span>
              </div>
              <div className="text-sm text-zinc-600">
                Stemt: <span className="font-medium">{votedCount}/{activeCount}</span> ·
                {" "}Revealed: <span className="font-medium">{reveal ? "ja" : "nei"}</span> ·
                {" "}Pålogging: <span className="font-medium">{loginsLocked ? "låst" : "åpen"}</span>
              </div>
              {adminNotice && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {adminNotice}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-white active:opacity-90"
                  onClick={() =>
                    confirmAdmin(
                      async () => {
                        const ok = await adminCall("/api/host/admin/reset-competition", "Kveldens poeng og trekninger er nullstilt. Deltakere er beholdt.");
                        if (!ok) return;
                        setVoted(null);
                        setPendingVote(null);
                        setShowMyReveal(false);
                        setRevealedVotesMap({});
                        setVotedPins([]);
                        setPairTotalsMap({});
                        setPairTotalsExtraMap({});
                        setPairTotalsAllMap({});
                        setPairTotalsExtraAllMap({});
                      },
                      {
                        title: "Ny konkurranse",
                        message: "Sletter ALLE stemmer og trekninger i kveld og starter på runde 1. Deltakere og ølinfo beholdes.",
                        confirmPhrase: "NY KONKURRANSE",
                      },
                    )
                  }
                >
                  Ny konkurranse
                </button>
                <button
                  className="rounded-xl bg-pink-600 px-4 py-3 text-white active:opacity-90"
                  onClick={() =>
                    confirmAdmin(
                      async () => { await adminCall("/api/host/unlock-selection", "Utvalget er låst opp."); },
                      {
                        title: "Lås opp utvalg",
                        message: "Åpner hjulet. Er det allerede trukket en øl i denne runden (og ingen har stemt), legges den tilbake så du kan snurre på nytt.",
                      },
                    )
                  }
                >
                  Lås opp utvalg
                </button>
                <button
                  className="rounded-xl px-4 py-3 text-white active:opacity-90"
                  style={{ backgroundColor: "#d4af37" }}
                  onClick={() =>
                    confirmAdmin(
                      async () => { await adminCall("/api/host/unlock-award", "Award ceremony er låst opp."); },
                      { title: "Unlock award ceremony", message: "Gjør premieutdelingen tilgjengelig fra Podium for alle." },
                    )
                  }
                >
                  Unlock award ceremony
                </button>
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-white active:opacity-90"
                  onClick={() => setView("wheel")}
                >
                  Snurrehjul
                </button>
                <button
                  className="rounded-xl bg-teal-500 px-4 py-3 text-white active:opacity-90"
                  onClick={() =>
                    confirmAdmin(
                      async () => { await adminCall("/api/host/allow-reveal", "«Avslør min stemme» er åpnet for alle som har stemt."); },
                      { title: "Tillat avslør stemme", message: "Lar de som har stemt avsløre stemmen sin selv om ikke alle har stemt ennå." },
                    )
                  }
                >
                  Tillat avslør stemme
                </button>
                <button
                  className={`rounded-xl px-4 py-3 active:opacity-90 ${
                    autoAllowReveal ? "bg-teal-600 text-white" : "border-2 border-teal-500 text-teal-700"
                  }`}
                  aria-pressed={autoAllowReveal}
                  onClick={() =>
                    confirmAdmin(
                      async () => {
                        const turnOn = !autoAllowReveal;
                        const ok = await adminCall(
                          "/api/host/auto-reveal",
                          turnOn
                            ? "Auto-allow avslør er ON – alle som har stemt kan alltid avsløre."
                            : "Auto-allow avslør er OFF – avsløring åpnes når alle har stemt eller du tillater det.",
                          { on: turnOn },
                        );
                        if (ok) setAutoAllowReveal(turnOn);
                      },
                      {
                        title: autoAllowReveal ? "Slå av auto-allow avslør" : "Slå på auto-allow avslør",
                        message: autoAllowReveal
                          ? "Etter dette åpnes «Avslør min stemme» først når alle har stemt, eller når du trykker «Tillat avslør stemme»."
                          : "Alle som har stemt kan alltid avsløre stemmen sin, i hver runde, uten at du må inn i Admin.",
                      },
                    )
                  }
                >
                  Auto-allow avslør: <span className="font-bold">{autoAllowReveal ? "ON" : "OFF"}</span>
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50 disabled:opacity-50"
                  onClick={() =>
                    confirmAdmin(
                      async () => { await adminCall("/api/host/reveal", "Alle stemmer i denne runden er avslørt og telles med."); },
                      { title: "Avslør resultater", message: "Avslører alle stemmer i denne runden, også for de som ikke har trykket «Avslør min stemme». Bruk etter siste runde." },
                    )
                  }
                  disabled={revealedRound === round}
                >
                  Avslør resultater (én gang)
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(
                      async () => {
                        const ok = await adminCall("/api/host/reset-votes", `Stemmene i runde ${round} er slettet – alle kan stemme på nytt.`);
                        if (!ok) return;
                        setVoted(null);
                        setPendingVote(null);
                      },
                      { title: "Reset stemmer", message: `Sletter alle stemmer i runde ${round}, så alle må stemme på nytt. Tidligere runder røres ikke.` },
                    )
                  }
                >
                  Reset stemmer
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(
                      async () => { await adminCall("/api/host/admin/reset-received", "Poeng fått er nullstilt i visningen."); },
                      {
                        title: "Reset poeng fått = 0",
                        message: "Skjuler alle poeng som er gitt hittil i lobby/podium (stemmene ligger fortsatt i databasen). Kan ikke angres uten «Ny konkurranse».",
                        confirmPhrase: "NULLSTILL",
                      },
                    )
                  }
                >
                  Reset poeng fått = 0
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(
                      async () => { await adminCall("/api/host/reset-picks", "Alle deltakere er tilbake på hjulet."); },
                      { title: "Resett alle deltakere", message: "Legger alle tilbake på hjulet. Sperret når det finnes stemmer (bruk da «Ny konkurranse»)." },
                    )
                  }
                >
                  Resett alle deltakere
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(
                      async () => { await adminCall("/api/host/admin/reset-given", "Poeng gitt er nullstilt i visningen."); },
                      {
                        title: "Reset poeng gitt = 0",
                        message: "Nullstiller «poeng gitt»-tellerne (stemmene ligger fortsatt i databasen).",
                        confirmPhrase: "NULLSTILL",
                      },
                    )
                  }
                >
                  Reset poeng gitt = 0
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(
                      async () => { await adminCall("/api/host/admin/reset-round", "Rundenummer er nullstilt."); },
                      { title: "Reset rundenr = 0", message: "Setter rundetelleren tilbake. Sperret når det finnes stemmer (de ville blitt overskrevet)." },
                    )
                  }
                >
                  Reset rundenr = 0
                </button>
                {loginsLocked ? (
                  <button
                    className="rounded-xl bg-amber-600 px-4 py-3 text-white active:opacity-90"
                    onClick={() =>
                      confirmAdmin(
                        async () => { await adminCall("/api/host/unlock-logins", "Pålogging er åpnet."); },
                        { title: "Åpne pålogging", message: "Nye brukere kan logge inn / opprette PIN igjen." },
                      )
                    }
                  >
                    Åpne pålogging
                  </button>
                ) : (
                  <button
                    className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                    onClick={() =>
                      confirmAdmin(
                        async () => { await adminCall("/api/host/lock-logins", "Pålogging er låst."); },
                        { title: "Lås pålogging", message: "Hindrer nye innlogginger og nye brukere. De som er logget inn fortsetter som før." },
                      )
                    }
                  >
                    Lås pålogging
                  </button>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-2">Deltakere</h4>
                <p className="mb-2 text-[11px] text-zinc-500">
                  Trykk Rediger for å endre navn, øl, %, bilde eller sette en som ikke kommer til inaktiv.
                </p>
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
                  {participants.map((p) => (
                    <HostParticipantEditor
                      key={p.pin}
                      hostPin={pin}
                      participant={p}
                      onChanged={() => fetchStatus()}
                      onDelete={() =>
                        confirmAdmin(
                          async () => {
                            await adminCall(
                              "/api/host/admin/delete-participant",
                              `${(p.nickname || "").trim() || p.pin} er slettet.`,
                              { pin: p.pin },
                            );
                          },
                          {
                            title: `Slett ${(p.nickname || "").trim() || p.pin}?`,
                            message: "Fjerner deltakeren helt. Er det gitt eller fått stemmer blir slettingen avvist – sett deltakeren som inaktiv i stedet.",
                            confirmPhrase: "SLETT",
                          },
                        )
                      }
                    />
                  ))}
                </ul>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-zinc-900">Live Leaderboard</h3>
              <p className="text-xs text-zinc-500">
                Hemmelig lenke for folk utenfor. Viser alle stemmer live – ikke del den med deltakerne.
              </p>
              {leaderboardKey ? (
                <>
                  <div className="break-all rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700">{leaderboardUrl}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white active:opacity-90"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(leaderboardUrl);
                          setLeaderboardCopied(true);
                          setTimeout(() => setLeaderboardCopied(false), 2000);
                        } catch {
                          setError("Kunne ikke kopiere – merk og kopier lenken manuelt");
                        }
                      }}
                    >
                      {leaderboardCopied ? "Kopiert ✓" : "Kopier"}
                    </button>
                    <a
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs active:bg-zinc-50"
                      href={leaderboardUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Åpne
                    </a>
                    <button
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-xs active:bg-zinc-50"
                      onClick={() =>
                        confirmAdmin(async () => { await loadLeaderboardKey(true); }, {
                          title: "Lag ny lenke",
                          message: "Den gamle leaderboard-lenken slutter å virke med en gang. Bruk dette hvis lenken har lekket til deltakerne.",
                        })
                      }
                    >
                      Lag ny lenke
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white active:opacity-90"
                  onClick={() => loadLeaderboardKey(false)}
                >
                  Vis leaderboard-lenke
                </button>
              )}
            </div>
          </section>
        )}
        {showAdminConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => {
              setShowAdminConfirm(false);
              adminConfirmActionRef.current = null;
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{adminConfirmTitle}</h3>
              <p className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{adminConfirmMessage}</p>
              {adminConfirmPhrase && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-red-800">
                    Skriv <span className="font-mono">{adminConfirmPhrase}</span> for å bekrefte
                  </label>
                  <input
                    className="w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-mono"
                    value={adminConfirmTyped}
                    onChange={(e) => setAdminConfirmTyped(e.target.value)}
                    placeholder={adminConfirmPhrase}
                    autoFocus
                  />
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  className="rounded-lg border border-zinc-300 px-4 py-2 active:bg-zinc-50"
                  onClick={() => {
                    setShowAdminConfirm(false);
                    adminConfirmActionRef.current = null;
                  }}
                >
                  Avbryt
                </button>
                <button
                  className={`rounded-lg px-4 py-2 text-white active:opacity-90 disabled:opacity-40 ${
                    adminConfirmPhrase ? "bg-red-700" : "bg-blue-600"
                  }`}
                  disabled={Boolean(adminConfirmPhrase) && adminConfirmTyped.trim() !== adminConfirmPhrase}
                  onClick={async () => {
                    try {
                      await (adminConfirmActionRef.current?.() as any);
                    } finally {
                      setShowAdminConfirm(false);
                      adminConfirmActionRef.current = null;
                      setAdminConfirmTyped("");
                      setAdminConfirmPhrase(null);
                    }
                  }}
                >
                  Bekreft
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
