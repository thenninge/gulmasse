"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PickerWheel from "@/components/PickerWheel";

type View = "login" | "user" | "lobby" | "voting" | "picker" | "admin";

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
      setHistogram(data.votes?.histogram || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
      setVoteCount(data.votes?.count || 0);
      setAverage(typeof data.votes?.average === "number" ? data.votes.average : 0);
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
    setCompetitor(savedCompetitor);
    setProducer(savedProducer);
    setBeerType(savedType);
    setCustomBeerType(savedTypeCustom);
    setStrength(savedStrength);
  }, []);

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
      // New user likely has empty profile; still try to load
      await loadProfile(pin);
    } catch {
      setError("Nettverksfeil");
    }
  }

  async function castVote(value: number) {
    setError(null);
    if (pin.length !== 4) {
      setError("Du må være innlogget");
      return;
    }
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, value }),
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
  const [showPodium, setShowPodium] = useState(false);

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

        {view === "user" && (
          <section className="space-y-5">
            <h2 className="text-xl font-semibold">Bruker</h2>
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
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
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
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-white active:opacity-90"
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
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
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
              <div className="mt-2 flex justify-end">
                <button
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium active:bg-zinc-50"
                  onClick={() => setShowPodium(true)}
                >
                  Podium
                </button>
              </div>
              <div className="mt-2 grid [grid-template-columns:28px_36px_1.2fr_1.4fr_56px] gap-1 px-3 py-2 text-xs font-medium text-zinc-600">
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
                    if (sortKey === "received") {
                      setSortDir(sortDir === "desc" ? "asc" : "desc");
                    } else {
                      setSortKey("received");
                      setSortDir("desc");
                    }
                  }}
                >
                  Pts {sortKey === "received" ? (sortDir === "desc" ? "▼" : "▲") : ""}
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
                    if (sortKey === "given") {
                      setSortDir(sortDir === "desc" ? "asc" : "desc");
                    } else {
                      setSortKey("given");
                      setSortDir("desc");
                    }
                  }}
                >
                  Gitt {sortKey === "given" ? (sortDir === "desc" ? "▼" : "▲") : ""}
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
                    const aGiven = userGiven[a.pin] ?? 0;
                    const bGiven = userGiven[b.pin] ?? 0;
                    const aRecv = userReceived[a.pin] ?? 0;
                    const bRecv = userReceived[b.pin] ?? 0;
                    const dir = sortDir === "asc" ? 1 : -1;
                    if (sortKey === "received") {
                      if (aRecv !== bRecv) return (aRecv - bRecv) * dir;
                      if (aGiven !== bGiven) return (aGiven - bGiven) * -1; // tie-break by given desc
                      return aName.localeCompare(bName);
                    }
                    if (sortKey === "given") {
                      if (aGiven !== bGiven) return (aGiven - bGiven) * dir;
                      if (aRecv !== bRecv) return (aRecv - bRecv) * -1; // tie-break by received desc
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
                    if (aGiven !== bGiven) return (aGiven - bGiven) * -1;
                    return aName.localeCompare(bName);
                  })
                  .map((p, idx) => {
                    const name = (p.nickname || "").trim() || "Uten navn";
                    const given = userGiven[p.pin] ?? 0;
                    const rank = receivedRankMap[p.pin] ?? idx + 1;
                    const received = userReceived[p.pin] ?? 0;
                    const beerName = (p.beer_name || "").trim() || "—";
                    return (
                      <li
                        key={p.pin}
                        className={`grid [grid-template-columns:28px_36px_1.2fr_1.4fr_56px] items-center gap-1 px-3 py-2 text-sm ${
                          p.active ? "" : "text-zinc-400 bg-zinc-50"
                        }`}
                      >
                        <div className="col-span-1 tabular-nums">{rank}</div>
                        <div className="col-span-1 tabular-nums">{received}</div>
                        <div className="col-span-1 truncate">{name}</div>
                        <div className="col-span-1 truncate">{beerName}</div>
                        <div className="col-span-1 tabular-nums text-right">{given}</div>
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
              >
                Find the chosen one
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
              {(() => {
                const items = participants.map((p) => ({
                  pin: p.pin,
                  name: (p.nickname || "").trim() || p.pin,
                  beer: (p.beer_name || "").trim(),
                  received: userReceived[p.pin] ?? 0,
                  given: userGiven[p.pin] ?? 0,
                }));
                items.sort((a, b) => {
                  if (a.received !== b.received) return b.received - a.received;
                  if (a.given !== b.given) return b.given - a.given;
                  return a.name.localeCompare(b.name);
                });
                const top = items.slice(0, 3);
                const maxVal = Math.max(1, ...top.map((t) => t.received));
                return (
                  <div className="grid grid-cols-3 items-end gap-3">
                    {top.map((t, i) => {
                      const height = 60 + (t.received / maxVal) * 80; // 60-140px
                      // order: 2nd, 1st, 3rd visually (left, center, right)
                      const orderClass = i === 0 ? "order-2" : i === 1 ? "order-1" : "order-3";
                      const crown = i === 0 ? " 👑" : "";
                      return (
                        <div key={t.pin} className={`flex flex-col items-center ${orderClass}`}>
                          <div
                            className="w-full rounded-t-lg bg-emerald-600 text-white"
                            style={{ height }}
                            title={`${t.received} pts`}
                          />
                          <div className="mt-2 truncate text-center text-sm font-medium">
                            {t.name}{crown}
                          </div>
                          <div className="truncate text-center text-xs text-zinc-600">{t.beer || "—"}</div>
                          <div className="text-xs text-zinc-700">{t.received} pts</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {view === "voting" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Votering</h2>
              <button className="text-sm text-zinc-600 underline" onClick={() => setView("lobby")}>
                Tilbake
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
                    <div className="min-w-0 text-center">
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
            {isHost && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={revealResults}
                >
                  Avslør
                </button>
                <button
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-white active:opacity-90"
                  onClick={nextRound}
                >
                  Ny runde
                </button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const isSel = voted === n;
                return (
                  <button
                    key={n}
                    className={`flex h-20 items-center justify-center rounded-xl border ${
                      isSel ? "border-blue-700 ring-2 ring-blue-400" : "border-zinc-200"
                    } bg-white active:opacity-90`}
                    onClick={() => castVote(n)}
                    aria-label={`Gi ${n} poeng`}
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-zinc-600">
                Status: {votedCount}/{activeCount} har stemt
              </div>
              {(reveal || (activeCount > 0 && votedCount >= activeCount)) ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-6 gap-2">
                    {[1,2,3,4,5,6].map((n) => (
                      <div key={n} className="text-center">
                        <div className="text-xs text-zinc-500">{n}</div>
                        <div className="mx-auto mt-1 h-2 w-full rounded bg-zinc-100">
                          <div
                            className="h-2 rounded bg-blue-600"
                            style={{ width: `${Math.min(100, (histogram[n] || 0) * 20)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs">{histogram[n] || 0}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-zinc-700">
                    Snitt: <span className="font-medium">{average.toFixed(2)}</span> ({voteCount} stemmer)
                  </div>
                </div>
              ) : (
                <div className="mt-2 h-24 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">
                  Resultater vises når alle har stemt eller host avslører.
                </div>
              )}
            </div>
          </section>
        )}

        {view === "picker" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Utvelger</h2>
              <button className="text-sm text-zinc-600 underline" onClick={() => setView("lobby")}>
                Tilbake
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
                <button
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm active:bg-zinc-50 disabled:opacity-50"
                  disabled={!isHost}
                  onClick={resetPicks}
                >
                  Tilbakestill
                </button>
              </div>
              {/* PickerWheel component */}
              <PickerWheel
                participants={participants
                  .filter(p => p.active)
                  .map(p => ({ id: p.pin, name: (p.nickname || "").trim() || p.pin, selected: picks.includes(p.pin) }))}
                disabled={!isHost}
                onPick={async (picked) => {
                  // Persist picked on server so alle er i sync
                  await fetch("/api/host/pick", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-host-pin": pin },
                    body: JSON.stringify({ pin: picked.id }),
                  }).catch(() => null);
                  const match = participants.find(x => x.pin === picked.id);
                  setLastPicked({
                    name: (match?.nickname || "").trim() || picked.name,
                    beerName: (match?.beer_name || "").trim() || undefined,
                  });
                  playFanfare();
                  setShowCelebration(true);
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    // @ts-ignore
                    navigator.vibrate?.([60, 40, 80]);
                  }
                  setTimeout(() => setShowCelebration(false), 2200);
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
              {showCelebration && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
                  <div className="rounded-2xl border border-emerald-300 bg-white px-6 py-5 text-center shadow-xl">
                    <div className="text-xs uppercase tracking-wide text-emerald-700">Valgt</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-900">
                      {lastPicked?.name || selected?.name}
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
                  <style jsx global>{`
                    @keyframes confetti-fall {
                      0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
                      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
                    }
                    .animate-confetti {
                      animation-name: confetti-fall;
                      animation-timing-function: linear;
                    }
                  `}</style>
                </div>
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
            <h2 className="text-xl font-semibold">Admin tools</h2>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
              <div className="text-sm text-zinc-600">
                Runde: <span className="font-medium">{round}</span> ·
                {" "}Revealed: <span className="font-medium">{reveal ? "ja" : "nei"}</span> ·
                {" "}Pålogging: <span className="font-medium">{loginsLocked ? "låst" : "åpen"}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={revealResults}
                  disabled={revealedRound === round}
                >
                  Avslør resultater (én gang)
                </button>
                <button
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-white active:opacity-90"
                  onClick={nextRound}
                >
                  Ny runde
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={async () => {
                    await fetch("/api/host/admin/reset-received", { method: "POST", headers: { "x-host-pin": pin } });
                    fetchStatus();
                  }}
                >
                  Reset poeng fått = 0
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={async () => {
                    await fetch("/api/host/admin/reset-given", { method: "POST", headers: { "x-host-pin": pin } });
                    fetchStatus();
                  }}
                >
                  Reset poeng gitt = 0
                </button>
                <button
                  className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                  onClick={async () => {
                    await fetch("/api/host/admin/reset-round", { method: "POST", headers: { "x-host-pin": pin } });
                    fetchStatus();
                  }}
                >
                  Reset rundenr = 0
                </button>
                {loginsLocked ? (
                  <button
                    className="rounded-xl bg-amber-600 px-4 py-3 text-white active:opacity-90"
                    onClick={unlockLogins}
                  >
                    Åpne pålogging
                  </button>
                ) : (
                  <button
                    className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                    onClick={lockLogins}
                  >
                    Lås pålogging
                  </button>
                )}
              </div>
              <div className="text-xs text-zinc-500">
                Trekte: {picks.length > 0 ? picks.join(", ") : "—"}
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
                          onClick={async () => {
                            await fetch("/api/host/admin/delete-participant", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "x-host-pin": pin },
                              body: JSON.stringify({ pin: p.pin }),
                            });
                            fetchStatus();
                          }}
                        >
                          Slett
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1">
              <button
                className="rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50"
                onClick={() => setView("lobby")}
              >
                Tilbake til lobby
              </button>
        </div>
          </section>
        )}
      </main>
    </div>
  );
}
