"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PickerWheel from "@/components/PickerWheel";

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

  // status state from /api/status
  const [statusLoading, setStatusLoading] = useState(false);
  const [participants, setParticipants] = useState<Array<{
    pin: string; nickname: string | null; active: boolean;
    beer_name?: string | null; producer?: string | null; beer_type?: string | null; abv?: number | null;
  }>>([]);
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
  const [awardUnlocked, setAwardUnlocked] = useState(false);
  const [pairTotalsMap, setPairTotalsMap] = useState<Record<string, Record<string, number>>>({});
  const [pairTotalsExtraMap, setPairTotalsExtraMap] = useState<Record<string, Record<string, number>>>({});
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
  function beerImageForName(name: string): string | null {
    const key = (name || "").toLowerCase().trim();
    const first = key.split(/\s+/)[0] || key;
    const map: Record<string, string> = {
      adam: "/img/adam.png",
      eirik: "/img/eirik.png",
      konrad: "/img/konrad.jpg",
      martin: "/img/martin.jpg",
      tomas: "/img/tomas.jpg",
      roald: "/img/roald.png",
      kathinka: "/img/kathinka.png",
      magnus: "/img/magnus.png",
    };
    return map[first] || null;
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
    const image = beerImageForName(name);
    return { pin: pinSel, name, beerName, producer, beerType, abv, image };
  }, [picks, participants]);

  const fetchStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error("Status fetch failed");
      const data = await res.json();
      setParticipants(data.participants || []);
      setActiveCount(data.activeCount || 0);
      setVotedCount(data.votedCount || 0);
      setRound(data.round || 1);
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
      setPickedRound(data.pickedRound || 0);
      setRoundStarted(Boolean(data.roundStarted));
      setAllowReveal(Boolean(data.allowReveal));
      setAwardUnlocked(Boolean(data.awardUnlocked));
      // build pair totals map: from -> to -> total
      const pMap: Record<string, Record<string, number>> = {};
      (data.pairTotals || []).forEach((pt: { from: string; to: string; total: number }) => {
        const f = String(pt?.from || "");
        const t = String(pt?.to || "");
        const val = Number(pt?.total || 0);
        if (!f || !t) return;
        if (!pMap[f]) pMap[f] = {};
        pMap[f][t] = (pMap[f][t] ?? 0) + val;
      });
      setPairTotalsMap(pMap);
      const pxMap: Record<string, Record<string, number>> = {};
      (data.pairTotalsExtra || []).forEach((pt: { from: string; to: string; total: number }) => {
        const f = String(pt?.from || "");
        const t = String(pt?.to || "");
        const val = Number(pt?.total || 0);
        if (!f || !t) return;
        if (!pxMap[f]) pxMap[f] = {};
        pxMap[f][t] = (pxMap[f][t] ?? 0) + val;
      });
      setPairTotalsExtraMap(pxMap);
    } catch {
      // noop
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // read pin from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("pin") || "";
    if (saved) {
      setPin(saved);
      setView("user");
      // Prefill from DB for existing session
      loadProfile(saved);
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
    // initial fetch
    fetchStatus();
    // interval
    pollRef.current = window.setInterval(fetchStatus, 2000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [fetchStatus]);
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
  
  // Drop hat on voter view when selected changes; keep until leaving voting
  useEffect(() => {
    if (view === "voting" && selected) {
      setHatDrop(true);
    }
  }, [view, selected?.pin]);
  // Clear hat when leaving voting
  useEffect(() => {
    if (view !== "voting") {
      setHatDrop(false);
    }
  }, [view]);

  // When round changes, reset local voting state so everyone can vote again
  useEffect(() => {
    setVoted(null);
    setPendingVote(null);
    setPendingExtraVote(null);
    setShowMyReveal(false);
    setRevealedVotesMap({});
    setRevealedExtraMap({});
    setVotedPins([]);
  }, [round]);
 

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

  async function castVote(value: number, extra: number) {
    setError(null);
    if (pin.length !== 4) {
      setError("Du må være innlogget");
      return;
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
        return;
      }
      setVoted(value);
      fetchStatus();
    } catch {
      setError("Nettverksfeil");
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

  const revealResults = () => hostPost("/api/host/reveal");
  const nextRound = async () => {
    const r = await hostPost("/api/host/next-round");
    if (r) setVoted(null);
  };
  const pickOne = () => hostPost("/api/host/pick");
  const resetPicks = () => hostPost("/api/host/reset-picks");
  const lockLogins = () => hostPost("/api/host/lock-logins");
  const unlockLogins = () => hostPost("/api/host/unlock-logins");

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
  const adminConfirmActionRef = useRef<null | (() => void | Promise<void>)>(null);
  function confirmAdmin(action: () => void | Promise<void>) {
    adminConfirmActionRef.current = action;
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
    return audioCtxRef.current;
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
  function playFanfare() {
    const ctx = getAudio();
    if (!ctx) return;
    const notes = [
      { t: 0,    f: 523.25 }, // C5
      { t: 0.08, f: 659.25 }, // E5
      { t: 0.16, f: 783.99 }, // G5
      { t: 0.28, f: 1046.5 }, // C6
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = n.f;
      const start = ctx.currentTime + n.t;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    }
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
  async function revealMyVote() {
    const hasVotedLocally = voted !== null;
    const hasVotedServer = pin.length === 4 && votedPins.includes(pin);
    if (pin.length !== 4 || !(hasVotedLocally || hasVotedServer)) return;
    try {
      await fetch("/api/reveal-my-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
    } finally {
      setShowMyReveal(true);
      fetchStatus();
    }
  }

  async function loadProfile(currentPin: string) {
    try {
      const res = await fetch("/api/pin/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: currentPin }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const p = data.participant as {
        nickname?: string | null;
        beer_name?: string | null;
        producer?: string | null;
        beer_type?: string | null;
        abv?: number | null;
      };
      if (p.nickname !== undefined) setNickname(p.nickname || "");
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
          "Barleywine","Belgian Double","Belgian Quad","Belgian Tripple","Bock","Dobblebock","Double IPA","Home Brew","Imperial Stout","IPA","Julebrygg","Lager","Mjød","Other","Pilsner","Stout","Tripplebock","Nuclear Surprise"
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
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-dvh w-full bg-transparent text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Christmas Beer Competition '25!</h1>
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
                    <div className="text-lg text-zinc-800">The GULMASSE 2025 trophy is awarded to</div>
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
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 animate-hatdrop h-16 w-16 md:h-20 md:w-20"
                style={{ top: "-80px" } as any}
              />
              <div className="text-2xl font-extrabold tracking-wide text-emerald-700">
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
                onPick={async (picked) => {
                  const match = participants.find(x => x.pin === picked.id);
                  setLastPicked({
                    name: (match?.nickname || "").trim() || picked.name,
                    beerName: (match?.beer_name || "").trim() || undefined,
                  });
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
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
                  <div className="rounded-2xl border border-emerald-300 bg-white px-6 py-5 text-center shadow-xl relative">
                    <div className="text-xs uppercase tracking-wide text-emerald-700">Valgt</div>
                    <div className="mt-1 relative">
                      {hatDrop && (
                        <img
                          src="/img/mcga.png"
                          alt=""
                          className="pointer-events-none absolute left-1/2 -translate-x-1/2 animate-hatdrop h-16 w-16 md:h-20 md:w-20"
                          style={{ top: "-80px" } as any}
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
            <h2 className="text-xl font-semibold text-center">Velkommen til Gulmasse '25!</h2>
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
                  <option value="Other">Other</option>
                  <option value="Pilsner">Pilsner</option>
                  <option value="Stout">Stout</option>
                  <option value="Tripplebock">Tripplebock</option>
                  <option value="Nuclear Surprise">Nuclear Surprise</option>
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

        {/* Lobby beer image modal */}
        {lobbyImageSrc && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setLobbyImageSrc(null)}
          >
            <div
              className="relative max-h-[90vh] max-w-[90vw] rounded-xl bg-white p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-sm shadow"
                onClick={() => setLobbyImageSrc(null)}
                aria-label="Lukk"
              >
                ✕
              </button>
              <img
                src={lobbyImageSrc}
                alt={lobbyImageName || "Ølbilde"}
                className="max-h-[80vh] max-w-[80vw] rounded-lg object-contain"
              />
              {(lobbyImageName || lobbyImageBeerName || lobbyImageProducer || lobbyImageBeerType || lobbyImageAbv) && (
                <div className="mt-2 px-2 text-center text-sm text-zinc-700">
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
                onChange={(e) => setPin(e.target.value.replace(/\\D/g, "").slice(0, 4))}
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
                <label className="mb-1 block text-sm text-zinc-600">Kallenavn (valgfritt)</label>
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
            <h2 className="text-xl font-semibold">Lobby</h2>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                  Deltakere: {activeCount}/{participants.length} aktive
                </p>
                <p className="text-xs text-zinc-500">
                  Runde {round} {statusLoading ? "…" : ""}
          </p>
        </div>
              <div className="mt-2 flex items-center justify-between">
                {isHost ? (
                  <button
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white active:opacity-90"
                    onClick={() => confirmAdmin(async () => { await nextRound(); fetchStatus(); })}
                  >
                    Start ny runde
                  </button>
                ) : <span />}
                <button
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm active:opacity-90"
                  onClick={() => setShowPodium(true)}
                >
                  Podium
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
                {participants.length === 0 && (
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
                            const img = beerImageForName(name);
                            if (img && p.beer_name) {
                              return (
                                <button
                                  className="underline text-blue-700 hover:text-blue-800"
                                  onClick={() => {
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
              </ul>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                className="rounded-xl bg-blue-600 px-4 py-4 text-white active:opacity-90"
                onClick={() => setView("voting")}
              >
                Til Votéring!
              </button>
              <button
                className="rounded-xl bg-emerald-600 px-4 py-4 text-white active:opacity-90 disabled:opacity-50"
                onClick={() => setView("picker")}
                disabled={!roundStarted || pickedRound === round}
              >
                Find the chosen one
              </button>
              <button
                className="rounded-xl bg-[#D94E53] px-4 py-4 text-white opacity-80 active:opacity-90"
                onClick={() => setView("overview")}
              >
                Full oversikt
              </button>
            </div>
          </section>
        )}

        {/* Podium modal */}
        {showPodium && (
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
                      const img = beerImageForName(t.name);
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
                  className="w-full rounded-xl px-4 py-3 text-white text-sm font-medium active:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: awardUnlocked ? '#d4af37' : '#9ca3af' }}
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
            {selected && (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4">
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
                  <div className="relative min-w-0 text-center">
                    {hatDrop && (
                      <img
                        src="/img/mcga.png"
                        alt=""
                        className="pointer-events-none absolute left-1/2 -translate-x-1/2 animate-hatdrop h-[4.5rem] w-[4.5rem] md:h-[5.25rem] md:w-[5.25rem]"
                        style={{ top: "-84px" } as any}
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
                  onClick={() => setShowLockConfirm(true)}
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
                  !((activeCount > 0 && votedCount >= activeCount) || allowReveal) ||
                  !(voted !== null || (pin && votedPins.includes(pin)))
                }
              >
                Avslør min stemme
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
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4 relative overflow-hidden">
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
                disabled={pickedRound === round}
                participants={participants
                  .filter(p => p.active)
                  .map(p => ({ id: p.pin, name: (p.nickname || "").trim() || p.pin, selected: picks.includes(p.pin) }))}
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
                      if (res.status === 409) {
                        // Known conflict cases: already picked this round or no candidates left
                        if (/already picked/i.test(msg)) {
                          setError("Det er allerede gjort et valg i denne runden.");
                        } else if (/No candidates left/i.test(msg)) {
                          setError("Ingen deltakere igjen å velge. Bruk 'Resett alle deltakere'.");
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
                  playFanfare();
                  setHatDrop(true);
                  setShowCelebration(true);
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    // @ts-ignore
                    navigator.vibrate?.([60, 40, 80]);
                  }
                  setTimeout(() => { setShowCelebration(false); setHatDrop(false); }, 3000);
                  // Oppdater status slik at "Ferdig dystet!" og Votering reflekterer valget
                  fetchStatus();
                }}
              />
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
                      await fetch("/api/host/undo-pick", { method: "POST", headers: { "x-host-pin": pin } }).catch(()=>null);
                      fetchStatus();
                    }}
                    disabled={picks.length === 0}
                  >
                    Legg tilbake
                  </button>
                </div>
              )}
              <div className="pt-2">
                <button
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white active:opacity-90"
                  onClick={() => setView("voting")}
                >
                  Til Votéring!
                </button>
              </div>
              {showCelebration && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
                  <div className="rounded-2xl border border-emerald-300 bg-white px-6 py-5 text-center shadow-xl relative">
                    <div className="text-xs uppercase tracking-wide text-emerald-700">Valgt</div>
                    <div className="mt-1 relative">
                      {hatDrop && (
                        <img
                          src="/img/mcga.png"
                          alt=""
                          className="pointer-events-none absolute left-1/2 -translate-x-1/2 animate-hatdrop h-16 w-16 md:h-20 md:w-20"
                          style={{ top: "-80px" } as any}
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm overflow-x-auto">
              <div className="mb-2 text-sm font-bold text-zinc-700">
                Beer points:
              </div>
              {isHost && (
                <div className="mb-3 flex justify-end">
                  <button
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white active:opacity-90"
                    onClick={() => {
                      // build CSV of beer info + totals + pairwise given
                      const giverOrder = participants.map(p => p.pin);
                      const toOrder = participants.map(p => p.pin);
                      const header = [
                        "PIN","Navn","Ølnavn","Produsent","Øltype","ABV",
                        "Poeng gitt (total)","Poeng fått (total)",
                        ...toOrder.map(pin => {
                          const name = (participants.find(x=>x.pin===pin)?.nickname || "").trim() || pin;
                          return `Gitt til ${name}`;
                        })
                      ];
                      function cell(v: any) {
                        const s = v === null || v === undefined ? "" : String(v);
                        if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
                        return s;
                      }
                      const rows = giverOrder.map(fromPin => {
                        const p = participants.find(x=>x.pin===fromPin);
                        const name = (p?.nickname || "").trim() || fromPin;
                        const beer = (p?.beer_name || "").trim();
                        const prod = (p?.producer || "").trim();
                        const type = (p?.beer_type || "").trim();
                        const abv = p?.abv != null ? Number(p.abv).toFixed(1) : "";
                        const givenTot = userGiven[fromPin] ?? 0;
                        const recvTot = userReceived[fromPin] ?? 0;
                        const pairVals = toOrder.map(toPin => pairTotalsMap[fromPin]?.[toPin] ?? 0);
                        const row = [fromPin,name,beer,prod,type,abv, givenTot, recvTot, ...pairVals];
                        return row.map(cell).join(",");
                      });
                      const csvMain = [header.map(cell).join(","), ...rows].join("\n");
                      // Extra matrix (no totals for now)
                      const headerExtra = [
                        "Giver",
                        ...toOrder.map(pin => {
                          const name = (participants.find(x=>x.pin===pin)?.nickname || "").trim() || pin;
                          return `${name}`;
                        }),
                        "Sum gitt (ekstra)"
                      ];
                      const rowsExtra = giverOrder.map(fromPin => {
                        const name = (participants.find(x=>x.pin===fromPin)?.nickname || "").trim() || fromPin;
                        const pairVals = toOrder.map(toPin => pairTotalsExtraMap[fromPin]?.[toPin] ?? 0);
                        const sumGiven = pairVals.reduce((a, b) => a + (Number(b) || 0), 0);
                        const row = [name, ...pairVals, sumGiven];
                        return row.map(cell).join(",");
                      });
                      const csvExtra = [headerExtra.map(cell).join(","), ...rowsExtra].join("\n");
                      // Combined (factor)
                      const headerCombined = [
                        `Giver (Sum of points; factor=${sumFactor})`,
                        ...toOrder.map(pin => {
                          const name = (participants.find(x=>x.pin===pin)?.nickname || "").trim() || pin;
                          return `${name}`;
                        }),
                        "Sum gitt (sum)"
                      ];
                      const rowsCombined = giverOrder.map(fromPin => {
                        const name = (participants.find(x=>x.pin===fromPin)?.nickname || "").trim() || fromPin;
                        const pairVals = toOrder.map(toPin => {
                          const main = pairTotalsMap[fromPin]?.[toPin] ?? 0;
                          const extra = pairTotalsExtraMap[fromPin]?.[toPin] ?? 0;
                          const val = Number(main) + Number(sumFactor) * Number(extra);
                          return Number.isFinite(val) ? Number(val.toFixed(1)) : 0;
                        });
                        const sumGiven = pairVals.reduce((a, b) => a + (Number(b) || 0), 0);
                        const row = [name, ...pairVals, Number(sumGiven.toFixed(1))];
                        return row.map(cell).join(",");
                      });
                      const csvCombined = [headerCombined.map(cell).join(","), ...rowsCombined].join("\n");
                      const csv = [csvMain, "", csvExtra, "", csvCombined].join("\n");
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `poengtabell.csv`;
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
                            const val = pairTotalsMap[giver.pin]?.[rec.pin] ?? 0;
                            return (
                              <td key={rec.pin} className="p-2 border-b border-zinc-200 tabular-nums text-center">
                                {val > 0 ? val : "—"}
                              </td>
                            );
                          })}
                          <td className="p-2 border-b border-zinc-200 tabular-nums text-right font-medium">
                            {(revealedGivenByPin[giver.pin] ?? 0) > 0 ? (revealedGivenByPin[giver.pin] ?? 0) : "—"}
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
                        const colSum = revealedReceivedByPin[rec.pin] ?? 0;
                        return (
                          <td key={`sum-${rec.pin}`} className="p-2 border-t border-zinc-200 tabular-nums text-center font-semibold">
                            {colSum > 0 ? colSum : "—"}
                          </td>
                        );
                      })}
                      <td className="p-2 border-t border-zinc-200 tabular-nums text-right font-semibold">
                        {totalRevealedMain > 0 ? totalRevealedMain : "—"}
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
                            const val = pairTotalsExtraMap[giver.pin]?.[rec.pin] ?? 0;
                            return (
                              <td key={`x-${rec.pin}`} className="p-2 border-b border-zinc-200 tabular-nums text-center">
                                {val > 0 ? val : "—"}
                              </td>
                            );
                          })}
                          <td className="p-2 border-b border-zinc-200 tabular-nums text-right font-medium">
                            {(extraGivenByPin[giver.pin] ?? 0) > 0 ? (extraGivenByPin[giver.pin] ?? 0) : "—"}
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
                        const colSum = extraReceivedByPin[rec.pin] ?? 0;
                        return (
                          <td key={`x-sum-${rec.pin}`} className="p-2 border-t border-zinc-200 tabular-nums text-center font-semibold">
                            {colSum > 0 ? colSum : "—"}
                          </td>
                        );
                      })}
                      <td className="p-2 border-t border-zinc-200 tabular-nums text-right font-semibold">
                        {totalRevealedExtra > 0 ? totalRevealedExtra : "—"}
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
                      return (
                        <tr key={`s-${giver.pin}`} className="odd:bg-white even:bg-zinc-50">
                          <th className="sticky left-0 z-10 bg-inherit p-2 text-left font-medium text-zinc-700 border-b border-zinc-200">
                            {giverName}
                          </th>
                          {participants.map((rec) => {
                            const raw = combinedPairTotalsMap[giver.pin]?.[rec.pin] ?? 0;
                            const val = Number(raw);
                            const txt = Number.isFinite(val) ? val.toFixed(1) : "—";
                            return (
                              <td key={`s-${rec.pin}`} className="p-2 border-b border-zinc-200 tabular-nums text-center">
                                {val > 0 ? txt : "—"}
                              </td>
                            );
                          })}
                          <td className="p-2 border-b border-zinc-200 tabular-nums text-right font-medium">
                            {(combinedGivenByPin[giver.pin] ?? 0) > 0 ? (combinedGivenByPin[giver.pin] ?? 0).toFixed(1) : "—"}
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
                        const colSum = combinedReceivedByPin[rec.pin] ?? 0;
                        return (
                          <td key={`s-sum-${rec.pin}`} className="p-2 border-t border-zinc-200 tabular-nums text-center font-semibold">
                            {colSum > 0 ? colSum.toFixed(1) : "—"}
                          </td>
                        );
                      })}
                      <td className="p-2 border-t border-zinc-200 tabular-nums text-right font-semibold">
                        {totalCombined > 0 ? totalCombined.toFixed(1) : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
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
                {" "}Revealed: <span className="font-medium">{reveal ? "ja" : "nei"}</span> ·
                {" "}Pålogging: <span className="font-medium">{loginsLocked ? "låst" : "åpen"}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-white active:opacity-90"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/admin/reset-competition", {
                        method: "POST",
                        headers: { "x-host-pin": pin },
                      });
                      // local clears
                      setVoted(null);
                      setPendingVote(null);
                      setShowMyReveal(false);
                      setRevealedVotesMap({});
                      setVotedPins([]);
                      fetchStatus();
                    })
                  }
                >
                  Ny konkurranse
                </button>
                <button
                  className="rounded-xl bg-pink-600 px-4 py-3 text-white active:opacity-90"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/unlock-selection", { method: "POST", headers: { "x-host-pin": pin } });
                      fetchStatus();
                    })
                  }
                >
                  Lås opp utvalg
                </button>
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-white active:opacity-90"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/unlock-award", { method: "POST", headers: { "x-host-pin": pin } });
                      fetchStatus();
                    })
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
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() => confirmAdmin(async () => { await revealResults(); })}
                  disabled={revealedRound === round}
                >
                  Avslør resultater (én gang)
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/reset-votes", { method: "POST", headers: { "x-host-pin": pin } });
                      // local hint: clear my local locked state immediately
                      setVoted(null);
                      setPendingVote(null);
                      fetchStatus();
                    })
                  }
                >
                  Reset stemmer
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/admin/reset-received", { method: "POST", headers: { "x-host-pin": pin } });
                      fetchStatus();
                    })
                  }
                >
                  Reset poeng fått = 0
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/reset-picks", { method: "POST", headers: { "x-host-pin": pin } });
                      fetchStatus();
                    })
                  }
                >
                  Resett alle deltakere
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/allow-reveal", { method: "POST", headers: { "x-host-pin": pin } });
                      fetchStatus();
                    })
                  }
                >
                  Tillat avslør stemme
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/admin/reset-given", { method: "POST", headers: { "x-host-pin": pin } });
                      fetchStatus();
                    })
                  }
                >
                  Reset poeng gitt = 0
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={() =>
                    confirmAdmin(async () => {
                      await fetch("/api/host/admin/reset-round", { method: "POST", headers: { "x-host-pin": pin } });
                      fetchStatus();
                    })
                  }
                >
                  Reset rundenr = 0
                </button>
                {loginsLocked ? (
                  <button
                    className="rounded-xl bg-amber-600 px-4 py-3 text-white active:opacity-90"
                    onClick={() => confirmAdmin(async () => { await unlockLogins(); })}
                  >
                    Åpne pålogging
                  </button>
                ) : (
                  <button
                    className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                    onClick={() => confirmAdmin(async () => { await lockLogins(); })}
                  >
                    Lås pålogging
                  </button>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-2">Deltakere</h4>
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200">
                  {participants.map((p) => {
                    const name = (p.nickname || "").trim() || p.pin;
                    return (
                      <li key={p.pin} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="truncate">
                          {name} {p.beer_name ? `— ${p.beer_name}` : ""}
                        </div>
                        <button
                          className="rounded-md border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50"
                          onClick={() =>
                            confirmAdmin(async () => {
                              await fetch("/api/host/admin/delete-participant", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "x-host-pin": pin },
                                body: JSON.stringify({ pin: p.pin }),
                              });
                              fetchStatus();
                            })
                          }
                        >
                          Slett
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1" />
          </section>
        )}
        {showAdminConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowAdminConfirm(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">Er du sikker?</h3>
              <p className="mt-2 text-sm text-zinc-700">Denne handlingen kan ikke angres.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  className="rounded-lg border border-zinc-300 px-4 py-2 active:bg-zinc-50"
                  onClick={() => setShowAdminConfirm(false)}
                >
                  Nei
                </button>
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white active:opacity-90"
                  onClick={async () => {
                    try {
                      await (adminConfirmActionRef.current?.() as any);
                    } finally {
                      setShowAdminConfirm(false);
                      adminConfirmActionRef.current = null;
                    }
                  }}
                >
                  Ja
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
