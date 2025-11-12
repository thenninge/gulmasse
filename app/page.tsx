"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type View = "login" | "user" | "lobby" | "voting" | "picker";

export default function Home() {
  const [view, setView] = useState<View>("login");
  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [beerType, setBeerType] = useState<string>("");
  const [strength, setStrength] = useState<string>("");
  const [voted, setVoted] = useState<number | null>(null);
  const isHost = useMemo(() => pin === "0808", [pin]);

  // status state from /api/status
  const [statusLoading, setStatusLoading] = useState(false);
  const [participants, setParticipants] = useState<Array<{ pin: string; nickname: string | null; active: boolean }>>([]);
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
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const selected = useMemo(() => {
    const pinSel = picks.length > 0 ? picks[picks.length - 1] : null;
    if (!pinSel) return null;
    const name =
      (participants.find((x) => x.pin === pinSel)?.nickname || "").trim() || pinSel;
    return { pin: pinSel, name };
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
    }
    const savedCompetitor = localStorage.getItem("competitor") || "";
    const savedType = localStorage.getItem("beerType") || "";
    const savedStrength = localStorage.getItem("strength") || "";
    setCompetitor(savedCompetitor);
    setBeerType(savedType);
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

  function goToLogin() {
    try {
      localStorage.removeItem("pin");
      localStorage.removeItem("competitor");
      localStorage.removeItem("beerType");
      localStorage.removeItem("strength");
    } catch {}
    setPin("");
    setNickname("");
    setCompetitor("");
    setBeerType("");
    setStrength("");
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

  return (
    <div className="min-h-dvh w-full bg-white text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Christmas Beer Competition '25!</h1>
          {pin ? (
            <button
              className="text-sm text-blue-600 underline"
              onClick={logout}
            >
              Logg ut
            </button>
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

      <main className="mx-auto max-w-md px-4 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {view === "user" && (
          <section className="space-y-5">
            <h2 className="text-xl font-semibold">Bruker</h2>
            <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Navn</label>
                <input
                  className="w-full rounded-xl border border-zinc-300 px-4 py-2"
                  placeholder="Ditt navn"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Konkurrent</label>
                <input
                  className="w-full rounded-xl border border-zinc-300 px-4 py-2"
                  placeholder="Navn på konkurrent"
                  value={competitor}
                  onChange={(e) => {
                    setCompetitor(e.target.value);
                    localStorage.setItem("competitor", e.target.value);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Type</label>
                <select
                  className="w-full rounded-xl border border-zinc-300 px-4 py-2 bg-white"
                  value={beerType}
                  onChange={(e) => {
                    setBeerType(e.target.value);
                    localStorage.setItem("beerType", e.target.value);
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
                </select>
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
                      await fetch("/api/pin/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pin, nickname: nickname || undefined }),
                      }).catch(() => {});
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
            </div>
          </section>
        )}

        {view === "login" && (
          <section className="space-y-5">
            <h2 className="text-xl font-semibold">Logg inn eller opprett PIN</h2>
            <div className="rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <label className="mb-2 block text-sm text-zinc-600">4-sifret PIN</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="____"
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-center text-2xl tracking-widest"
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
                  className="w-full rounded-xl border border-zinc-300 px-4 py-2"
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
            <div className="rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                  Deltakere: {activeCount}/{participants.length} aktive
                </p>
                <p className="text-xs text-zinc-500">
                  Runde {round} {statusLoading ? "…" : ""}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
                {participants.length === 0 && (
                  <li className="px-3 py-2 text-sm text-zinc-500">Ingen deltakere</li>
                )}
                {participants
                  .slice()
                  .sort((a, b) => (userGiven[b.pin] ?? 0) - (userGiven[a.pin] ?? 0))
                  .map((p, idx) => {
                    const name = (p.nickname || "").trim() || "Uten navn";
                    const given = userGiven[p.pin] ?? 0;
                    const rank = idx + 1;
                    const received = "—";
                    const theirContender = "—";
                    return (
                      <li
                        key={p.pin}
                        className={`grid grid-cols-5 items-center gap-2 px-3 py-2 text-sm ${
                          p.active ? "" : "text-zinc-400 bg-zinc-50"
                        }`}
                      >
                        <div className="col-span-1 tabular-nums">{rank}</div>
                        <div className="col-span-1 tabular-nums">{received}</div>
                        <div className="col-span-1 truncate">{name}</div>
                        <div className="col-span-1 truncate">{theirContender}</div>
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
                Gå til Voting
              </button>
              <button
                className="rounded-xl bg-emerald-600 px-4 py-4 text-white active:opacity-90 disabled:opacity-50"
                disabled={!isHost}
                onClick={() => setView("picker")}
              >
                Gå til Utvelger {isHost ? "" : "(host)"}
              </button>
            </div>
          </section>
        )}

        {view === "voting" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Voting</h2>
              <button className="text-sm text-zinc-600 underline" onClick={() => setView("lobby")}>
                Tilbake
              </button>
            </div>
            {selected && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                Vi stemmer over..: <span className="font-medium">{selected.name}</span>
              </div>
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
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  className={`h-16 rounded-xl text-2xl font-semibold ${
                    voted === n ? "bg-blue-700 text-white" : "bg-zinc-100"
                  }`}
                  onClick={() => castVote(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4 shadow-sm">
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
            <button
              className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-white active:opacity-90 disabled:opacity-50"
              disabled={!isHost}
              onClick={pickOne}
            >
              Velg
            </button>
            <div className="rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <p className="text-sm text-zinc-500">
                Trekte: {picks.length > 0 ? picks.map((ppin) => {
                  const name = (participants.find(x => x.pin === ppin)?.nickname || "").trim() || "Uten navn";
                  return name;
                }).join(", ") : "—"}<br />
                Gjenstår (blant aktive): {Math.max(0, activeCount - picks.length)}
              </p>
              <button
                className="mt-3 w-full rounded-xl border border-zinc-300 px-4 py-3 active:bg-zinc-50 disabled:opacity-50"
                disabled={!isHost}
                onClick={resetPicks}
              >
                Tilbakestill utvalg
              </button>
            </div>
          </section>
        )}

        {view === "lobby" && isHost && (
          <section className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-zinc-600">Host</h3>
            <div className="grid grid-cols-2 gap-3">
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
          </section>
        )}
      </main>
    </div>
  );
}
