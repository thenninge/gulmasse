"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Standing = {
  place: number; pin: string; name: string; beer: string; producer: string; abv: number | null;
  beerPoints: number; extraPoints: number; sum: number; presented: boolean;
};
type Presented = {
  pin: string; name: string; beer: string; votes: number;
  avgBeer: number | null; avgExtra: number | null; sum: number; round: number | null;
};
type Board = {
  factor: number;
  round: number;
  status: "voting" | "spinning" | "waiting" | "between";
  presenter: null | {
    pin: string; name: string; beer: string; producer: string; type: string; abv: number | null; image: string | null;
    votes: number; active: number; avgBeer: number | null; avgExtra?: number | null; throws?: Array<[number, number]>;
  };
  standings: Standing[];
  presented: Presented[];
  progression: Array<{ label: string; totals: Record<string, number> }>;
  givers?: Array<{ pin: string; name: string; votes: number; beerGiven: number; extraGiven: number; total: number }>;
  best: null | { name: string; beer: string; avgBeer: number | null; avgExtra: number | null };
  counts: { presented: number; participants: number; votes: number };
  updatedAt: string;
};

// Dark-surface categorical slots 1–3 (validated set) + recessive gray for the rest
const TOP_COLORS = ["#338ced", "#e76624", "#00a888"];
const OTHER = "#4b4b4b";
const BAR = "#d28e05";
const MEDALS = ["🥇", "🥈", "🥉"];

const fmt = (n: number | null | undefined, d = 1) =>
  n == null || !Number.isFinite(n) ? "—" : n.toFixed(d).replace(".", ",");

type FeedItem = { id: number; icon: string; text: string; at: Date };
type Announce = { id: number; name: string; beer: string };
type Toast = { id: number; icon: string; text: string };
type Die = { id: number; beer: number; extra: number; x: number };

/** Compare two consecutive polls and describe what just happened. */
function detectEvents(prev: Board, next: Board) {
  const ev: {
    pick?: { name: string; beer: string };
    leader?: string;
    allVoted?: { avg: number | null; beer: string };
    throws: Array<[number, number]>;
  } = { throws: [] };
  const np = next.presenter;
  const pp = prev.presenter;
  if (np && np.pin !== pp?.pin) ev.pick = { name: np.name, beer: np.beer };
  const nl = next.standings[0];
  const pl = prev.standings[0];
  if (nl && nl.sum > 0 && nl.pin !== pl?.pin && !(pl && pl.sum === nl.sum)) ev.leader = nl.name;
  if (np && pp && np.pin === pp.pin) {
    const before = pp.throws?.length ?? 0;
    ev.throws = (np.throws || []).slice(before);
    if (np.active > 0 && np.votes >= np.active && pp.votes < pp.active) ev.allVoted = { avg: np.avgBeer, beer: np.beer };
  }
  return ev;
}

export default function LeaderboardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [denied, setDenied] = useState(false);
  const [offline, setOffline] = useState(false);
  const [announce, setAnnounce] = useState<Announce | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dice, setDice] = useState<Die[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [confetti, setConfetti] = useState(0); // bump to fire a burst
  const prevRef = useRef<Board | null>(null);
  const idRef = useRef(1);

  const handleUpdate = useCallback((next: Board) => {
    const prev = prevRef.current;
    prevRef.current = next;
    setBoard(next);
    if (!prev) return; // first load: no fireworks for things that already happened
    const ev = detectEvents(prev, next);
    const now = new Date();
    const add: FeedItem[] = [];
    const nid = () => idRef.current++;
    const toast = (icon: string, text: string) => {
      const id = nid();
      setToasts((t) => [...t.slice(-2), { id, icon, text }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    };
    if (ev.pick) {
      const id = nid();
      setAnnounce({ id, name: ev.pick.name, beer: ev.pick.beer });
      window.setTimeout(() => setAnnounce((a) => (a && a.id === id ? null : a)), 6500);
      setConfetti((c) => c + 1);
      add.push({ id: nid(), icon: "🎡", text: `Hjulet valgte ${ev.pick.name}${ev.pick.beer ? ` – ${ev.pick.beer}` : ""}`, at: now });
    }
    if (ev.leader) {
      toast("👑", `${ev.leader} tar ledelsen!`);
      if (!ev.pick) setConfetti((c) => c + 1);
      add.push({ id: nid(), icon: "👑", text: `${ev.leader} tar ledelsen`, at: now });
    }
    if (ev.throws.length) {
      const fresh = ev.throws.map(([beer, extra], i) => ({ id: nid(), beer, extra, x: 8 + ((i * 29 + Math.random() * 40) % 70) }));
      setDice((d) => [...d, ...fresh]);
      window.setTimeout(() => setDice((d) => d.filter((x) => !fresh.some((f) => f.id === x.id))), 3400);
      const who = next.presenter?.name || "";
      const double6 = ev.throws.filter(([b, e]) => b === 6 && e === 6).length;
      const beer6 = ev.throws.filter(([b, e]) => b === 6 && e !== 6).length;
      const pres6 = ev.throws.filter(([b, e]) => e === 6 && b !== 6).length;
      if (double6) {
        toast("🎲🎲", `DOBBEL SEKSER til ${who}!`);
        setConfetti((c) => c + 1);
        add.push({ id: nid(), icon: "🎲", text: `Dobbel sekser (øl + presentasjon) til ${who}`, at: now });
      } else if (beer6 || pres6) {
        toast("🎲", beer6 ? `Sekser på ølen til ${who}!` : `Sekser på presentasjonen til ${who}!`);
        add.push({ id: nid(), icon: "🎲", text: beer6 ? `Sekser på ølen til ${who}` : `Sekser på presentasjonen til ${who}`, at: now });
      }
      if (ev.throws.some(([b]) => b === 1)) add.push({ id: nid(), icon: "🥶", text: `Au – en ener på ølen til ${who}`, at: now });
    }
    if (ev.allVoted) {
      toast("✅", `Alle har stemt! Snitt ${fmt(ev.allVoted.avg, 2)}`);
      add.push({ id: nid(), icon: "✅", text: `Alle har stemt på ${ev.allVoted.beer || "ølen"} – snitt ${fmt(ev.allVoted.avg, 2)}`, at: now });
    }
    if (add.length) {
      const newestFirst = add.slice().reverse();
      setFeed((f) => [...newestFirst, ...f].slice(0, 12));
    }
  }, []);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("k") || "";
    let stop = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetch(`/api/leaderboard?k=${encodeURIComponent(k)}`, { cache: "no-store" });
        if (res.status === 401) {
          setDenied(true);
          return; // stop polling
        }
        if (!res.ok) throw new Error();
        handleUpdate(await res.json());
        setOffline(false);
      } catch {
        setOffline(true);
      }
      if (!stop) timer = window.setTimeout(load, 3000);
    };
    load();
    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [handleUpdate]);

  if (denied) {
    return (
      <Shell>
        <div className="mx-auto mt-24 max-w-md rounded-2xl bg-[#191919] p-6 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-3 text-xl font-semibold">Ugyldig eller utløpt lenke</h1>
          <p className="mt-2 text-sm text-[#9c9c9c]">Be verten om en ny lenke til Live Leaderboard.</p>
        </div>
      </Shell>
    );
  }
  if (!board) {
    return (
      <Shell>
        <div className="mt-24 text-center text-[#9c9c9c]">Laster ledertavla…</div>
      </Shell>
    );
  }

  const top = board.standings.slice(0, 3).map((s) => s.pin);
  // «Best so far» + news feed: left column on desktop, below the rankings on mobile
  const extras = (
    <>
          {board.best && (
            <Card title="Høyest rangerte øl så langt">
              <div className="text-lg font-semibold">{board.best.beer || "—"}</div>
              <div className="text-sm text-[#9c9c9c]">{board.best.name}</div>
              <div className="mt-2 flex gap-6 text-sm">
                <div><div className="text-[#9c9c9c]">🍺 Snitt øl</div><div className="text-2xl font-bold tabular-nums">{fmt(board.best.avgBeer, 2)}</div></div>
                <div><div className="text-[#9c9c9c]">🎤 Snitt presentasjon</div><div className="text-2xl font-bold tabular-nums">{fmt(board.best.avgExtra, 2)}</div></div>
              </div>
            </Card>
          )}
          <Card title="Siste nytt">
            {feed.length === 0 ? (
              <div className="text-sm text-[#9c9c9c]">Følg med – her dukker det opp nyheter fra kvelden 🍻</div>
            ) : (
              <ul className="space-y-1.5">
                {feed.map((f, i) => (
                  <li key={f.id} className={`flex items-start gap-2 text-sm ${i === 0 ? "lb-pop" : ""}`}>
                    <span className="w-5 shrink-0 text-center">{f.icon}</span>
                    <span className="min-w-0 flex-1">{f.text}</span>
                    <span className="shrink-0 text-xs tabular-nums text-[#6b6b6b]">
                      {f.at.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
    </>
  );
  return (
    <Shell>
      {confetti > 0 && <ConfettiBurst key={`confetti-${confetti}`} />}
      {announce && <AnnounceOverlay key={`announce-${announce.id}`} name={announce.name} beer={announce.beer} onClose={() => setAnnounce(null)} />}
      <Toasts toasts={toasts} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3 sm:gap-4">
          {/* The juleølhatt – always on the page, gently rocking */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/mcga.png"
            alt="Juleølhatten"
            className="lb-rock h-16 w-16 shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] sm:h-24 sm:w-24"
          />
        <div>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-[#f2c14e]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            Live
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Gulmasse &apos;26</h1>
        </div>
        </div>
        <div className="text-left text-sm sm:text-right text-[#9c9c9c]">
          <div>
            <span className="text-[#efefef] font-semibold tabular-nums">{board.counts.presented}</span> av{" "}
            <span className="tabular-nums">{board.counts.participants}</span> øl presentert
          </div>
          <div className="text-xs">
            {offline ? "⚠︎ mister forbindelsen – prøver igjen" : `Oppdatert ${new Date(board.updatedAt).toLocaleTimeString("nb-NO")}`}
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <NowCard board={board} dice={dice} />
          <div className="hidden space-y-5 lg:block">{extras}</div>
        </div>
        <div className="space-y-5">
          <Card title="🏆 Hvem leder? – totalt">
            <Standings standings={board.standings} factor={board.factor} progression={board.progression} />
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card title="🍺 Øl-poeng">
              <MiniRanking
                rows={board.standings.map((s) => ({ pin: s.pin, name: s.name, sub: s.beer, value: s.beerPoints }))}
              />
            </Card>
            <Card title="🎤 Presentasjonspoeng">
              <MiniRanking
                rows={board.standings.map((s) => ({ pin: s.pin, name: s.name, sub: s.beer, value: s.extraPoints }))}
              />
            </Card>
          </div>
          {board.givers && board.givers.length > 0 && (
            <Card title="🎁 Hvem har gitt mest poeng?">
              <MiniRanking
                rows={board.givers.map((g) => ({
                  pin: g.pin,
                  name: g.name,
                  sub: `🍺 ${g.beerGiven} · 🎤 ${g.extraGiven} · snitt ${fmt(g.votes ? g.total / g.votes / 2 : null, 2)}`,
                  value: g.total,
                }))}
              />
            </Card>
          )}
        </div>
        <div className="space-y-5 lg:hidden">{extras}</div>
      </div>

      {board.progression.length > 0 && (
        <Card title="Kampen om toppen – poeng etter hver øl" className="mt-5">
          <RaceChart board={board} top={top} />
        </Card>
      )}

      {board.presented.length > 0 && (
        <Card title="Presentert så langt" className="mt-5">
          <PresentedTable presented={board.presented} />
        </Card>
      )}
      <footer className="mt-8 pb-6 text-center text-xs text-[#6b6b6b]">
        Poeng = øl-terning + {fmt(board.factor)} × presentasjon-terning · oppdateres automatisk
      </footer>
    </Shell>
  );
}

const STYLES = `
@keyframes lb-snow { 0% { transform: translate3d(0,-10vh,0); } 100% { transform: translate3d(var(--drift),110vh,0); } }
@keyframes lb-rock { 0%,100% { rotate: -9deg; } 50% { rotate: 9deg; } }
@keyframes lb-bob { 0%,100% { rotate: -6deg; translate: 0 0; } 50% { rotate: 6deg; translate: 0 -3px; } }
@keyframes lb-rise { 0% { transform: translateY(0) scale(.6); opacity: 0; } 15% { opacity: 1; transform: translateY(-20px) scale(1.15); } 100% { transform: translateY(-170px) scale(.9) rotate(25deg); opacity: 0; } }
@keyframes lb-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.04); opacity: 1; } 100% { transform: scale(1); } }
@keyframes lb-toast { 0% { transform: translateY(-20px); opacity: 0; } 10%,85% { transform: none; opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }
@keyframes lb-zoom { 0% { transform: scale(.4); opacity: 0; } 55% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
@keyframes lb-spin { to { rotate: 360deg; } }
@keyframes lb-glow { 0%,100% { box-shadow: 0 0 0 rgba(242,193,78,0); } 50% { box-shadow: 0 0 28px rgba(242,193,78,.35); } }
.lb-flake { position: absolute; top: 0; color: #fff; opacity: .55; animation: lb-snow linear infinite; }
.lb-bob { animation: lb-bob 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
.lb-rock { animation: lb-rock 3.2s ease-in-out infinite; transform-origin: 50% 85%; }
.lb-rise { animation: lb-rise 3s ease-out forwards; }
.lb-pop { animation: lb-pop 500ms ease-out both; }
.lb-toast { animation: lb-toast 5s ease-in-out forwards; }
.lb-zoom { animation: lb-zoom 700ms cubic-bezier(.2,.9,.3,1.2) both; }
.lb-glow { animation: lb-glow 2.5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .lb-flake, .animate-confetti { animation: none !important; display: none; }
  .lb-bob, .lb-rock, .lb-glow { animation: none !important; }
  .lb-rise, .lb-pop, .lb-toast, .lb-zoom, .animate-hatdrop { animation-duration: 1ms !important; }
}
`;

function Snow() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        left: (i * 37) % 100,
        size: 8 + ((i * 13) % 12),
        dur: 9 + ((i * 7) % 11),
        delay: -((i * 5) % 17),
        drift: `${((i % 5) - 2) * 18}px`,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="lb-flake"
          style={{ left: `${f.left}%`, fontSize: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, ["--drift" as string]: f.drift }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}

// Deterministic pseudo-random (render must stay pure)
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const CONFETTI = Array.from({ length: 90 }).map((_, i) => ({
  left: rnd(i, 1) * 100,
  top: -rnd(i, 2) * 20,
  color: ["#f2c14e", "#e76624", "#338ced", "#00a888", "#ee7fac", "#ffffff"][i % 6],
  delay: rnd(i, 3) * 0.6,
  dur: 2.2 + rnd(i, 4) * 1.2,
  rot: rnd(i, 5) * 360,
}));

function ConfettiBurst() {
  const pieces = CONFETTI;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute block h-2.5 w-1.5 animate-confetti rounded-[1px]"
          style={{ left: `${p.left}%`, top: `${p.top}%`, backgroundColor: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, animationFillMode: "both", rotate: `${p.rot}deg` }}
        />
      ))}
    </div>
  );
}

function AnnounceOverlay({ name, beer, onClose }: { name: string; beer: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="status"
      aria-live="assertive"
    >
      <div className="lb-zoom text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[#f2c14e] sm:text-base">🎡 Hjulet har valgt</div>
        <div className="relative mx-auto mt-24 inline-block sm:mt-32">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/mcga.png"
            alt=""
            className="animate-hatdrop pointer-events-none absolute -top-24 h-24 w-24 sm:-top-32 sm:h-32 sm:w-32"
            style={{ animationDelay: "350ms", animationDuration: "1100ms" }}
          />
          <div className="text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(242,193,78,0.45)] sm:text-7xl">{name}</div>
        </div>
        {beer && <div className="mt-4 text-2xl font-bold text-[#f2c14e] sm:text-3xl">{beer}</div>}
        <div className="mt-6 text-sm text-[#cfcfcf]">Skål! 🍻</div>
      </div>
    </div>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex flex-col items-center gap-2 px-3" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="lb-toast rounded-full border border-[#f2c14e]/40 bg-[#1d1608]/95 px-5 py-2.5 text-base font-semibold text-[#f7d98a] shadow-2xl sm:text-lg">
          <span className="mr-2">{t.icon}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(ellipse_at_top,#3a0f12_0%,#120b0b_55%,#0b0b0b_100%)] text-[#efefef]">
      <style>{STYLES}</style>
      <Snow />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/5 bg-[#191919]/95 p-4 shadow-lg sm:p-5 ${className}`}>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[#9c9c9c]">{title}</h2>
      {children}
    </section>
  );
}

function DieFace({ value, label, small = false }: { value: number; label: string; small?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/img/${value}.png`} alt={`${label}: ${value}`} className={small ? "h-9 w-9" : "h-11 w-11"} />
      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#f7d98a] drop-shadow">{label}</span>
    </div>
  );
}

function NowCard({ board, dice = [] }: { board: Board; dice?: Die[] }) {
  const p = board.presenter;
  if (!p) {
    const msg =
      board.status === "spinning" ? "Hjulet snurrer – hvem er neste?" :
      board.status === "waiting" ? "Konkurransen har ikke startet ennå" :
      board.counts.presented >= board.counts.participants ? "Alle øl er presentert – venter på premieutdeling 🏆" :
      "Pause før neste runde";
    return (
      <Card title={`Neste øl · ${board.counts.presented} av ${board.counts.participants} presentert`}>
        <div className="py-6 text-center text-lg text-[#cfcfcf]">{msg}</div>
      </Card>
    );
  }
  const pct = p.active > 0 ? Math.min(100, Math.round((p.votes / p.active) * 100)) : 0;
  return (
    <Card title={`Presenterer nå · øl ${board.counts.presented} av ${board.counts.participants}`}>
      <div className="relative">
        {/* Freshly locked votes float up: both dice per vote */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-0" aria-hidden>
          {dice.map((d) => (
            <div key={d.id} className="lb-rise absolute bottom-0 flex gap-1 rounded-xl bg-black/50 px-2 py-1 backdrop-blur-sm" style={{ left: `${d.x}%` }}>
              <DieFace value={d.beer} label="Øl" small />
              {d.extra > 0 && <DieFace value={d.extra} label="Pres." small />}
            </div>
          ))}
        </div>
      <div className="flex gap-4">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.beer || p.name} className="h-32 w-24 shrink-0 rounded-lg bg-white/5 object-contain sm:h-40 sm:w-28" />
        ) : (
          <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-lg bg-white/5 text-4xl sm:h-40 sm:w-28">🍺</div>
        )}
        <div className="min-w-0 pt-6">
          <div className="relative inline-block">
            {/* The hat: the chosen one wears it */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/mcga.png" alt="" className="lb-bob pointer-events-none absolute -top-9 left-1 h-11 w-11" />
            <div className="text-2xl font-extrabold leading-tight">{p.name}</div>
          </div>
          <div className="mt-1 text-lg font-semibold text-[#f2c14e]">{p.beer || "—"}</div>
          <div className="mt-1 text-sm text-[#9c9c9c]">
            {[p.producer, p.type, p.abv != null ? `${fmt(p.abv)} %` : ""].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="text-[#9c9c9c]">Stemmer avgitt</span>
          <span className="tabular-nums"><b>{p.votes}</b> / {p.active}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={p.votes} aria-valuemax={p.active}>
          <div className="h-full rounded-full bg-[#f2c14e] transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {p.avgBeer != null && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <div className="text-xs text-[#9c9c9c]">🍺 Snitt øl</div>
              <div className="text-2xl font-bold tabular-nums">{fmt(p.avgBeer, 2)}</div>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <div className="text-xs text-[#9c9c9c]">🎤 Snitt presentasjon</div>
              <div className="text-2xl font-bold tabular-nums">{fmt(p.avgExtra ?? null, 2)}</div>
            </div>
          </div>
        )}
      </div>
      </div>
    </Card>
  );
}

/** Number that counts smoothly to its new value. */
function CountUp({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(from + (value - from) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value]);
  return <>{fmt(shown, decimals)}</>;
}

function Standings({
  standings,
  factor,
  progression,
}: {
  standings: Standing[];
  factor: number;
  progression: Board["progression"];
}) {
  const max = Math.max(1, ...standings.map((s) => s.sum));
  const [hover, setHover] = useState<string | null>(null);

  // Places before the latest beer → ▲/▼ movement
  const prevPlace = useMemo(() => {
    const prev = progression[progression.length - 2];
    if (!prev) return null;
    const order = Object.entries(prev.totals).sort((a, b) => b[1] - a[1]);
    const m: Record<string, number> = {};
    order.forEach(([pin, v], i) => {
      const before = order[i - 1];
      m[pin] = before && before[1] === v ? m[before[0]] : i + 1;
    });
    return m;
  }, [progression]);

  // FLIP: rows glide to their new position when the order changes
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const lastTops = useRef(new Map<string, number>());
  const orderKey = standings.map((s) => s.pin).join(",");
  useLayoutEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    rowRefs.current.forEach((el, pin) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const old = lastTops.current.get(pin);
      if (!reduce && old != null && Math.abs(old - top) > 1) {
        el.style.transition = "none";
        el.style.transform = `translateY(${old - top}px)`;
        el.getBoundingClientRect(); // flush
        el.style.transition = "transform 900ms cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "";
      }
      lastTops.current.set(pin, top);
    });
  }, [orderKey]);

  return (
    <ol className="space-y-1.5">
      {standings.map((s, i) => {
        const moved = prevPlace && s.sum > 0 ? (prevPlace[s.pin] ?? s.place) - s.place : 0;
        return (
        <li
          key={s.pin}
          ref={(el) => {
            if (el) rowRefs.current.set(s.pin, el);
            else rowRefs.current.delete(s.pin);
          }}
          className={`relative grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-2 rounded-lg px-1 py-1 text-sm transition-colors hover:bg-white/5 ${i === 0 && s.sum > 0 ? "lb-glow bg-[#f2c14e]/5" : ""}`}
          onMouseEnter={() => setHover(s.pin)}
          onMouseLeave={() => setHover(null)}
        >
          <span className="text-center text-base tabular-nums">{s.sum > 0 && i < 3 ? MEDALS[i] : s.place}</span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="truncate font-semibold">{s.name}</span>
              <span className="hidden truncate text-xs text-[#9c9c9c] sm:inline">{s.beer}</span>
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#9c9c9c]">🍺 {fmt(s.beerPoints, 0)} · 🎤 {fmt(s.extraPoints, 0)}</span>
            </div>
            <div className="mt-1 h-2 rounded bg-white/5">
              <div
                className="h-full rounded transition-all duration-700"
                style={{ width: `${(s.sum / max) * 100}%`, backgroundColor: s.presented ? BAR : "#6b5320" }}
              />
            </div>
          </div>
          <span className="flex flex-col items-end leading-tight">
            <span className="text-base font-bold tabular-nums"><CountUp value={s.sum} /></span>
            {moved !== 0 && (
              <span className={`text-[11px] font-semibold ${moved > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {moved > 0 ? `▲${moved}` : `▼${-moved}`}
              </span>
            )}
          </span>
          {hover === s.pin && (
            <div className="pointer-events-none absolute right-16 top-full z-10 mt-1 rounded-lg border border-white/10 bg-[#0f0f0f] px-3 py-2 text-xs shadow-xl">
              <div className="font-semibold">{s.name}</div>
              <div className="text-[#9c9c9c]">🍺 Øl: <span className="text-[#efefef] tabular-nums">{fmt(s.beerPoints, 0)}</span></div>
              <div className="text-[#9c9c9c]">🎤 Presentasjon: <span className="text-[#efefef] tabular-nums">{fmt(s.extraPoints, 0)}</span> (× {fmt(factor)})</div>
              {!s.presented && <div className="mt-1 text-[#9c9c9c]">Har ikke presentert ennå</div>}
            </div>
          )}
        </li>
        );
      })}
    </ol>
  );
}

function RaceChart({ board, top }: { board: Board; top: string[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(700);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const steps = board.progression;
  const pins = board.standings.map((s) => s.pin);
  const nameOf = useMemo(() => Object.fromEntries(board.standings.map((s) => [s.pin, s.name])), [board.standings]);
  const h = w < 500 ? 240 : 300;
  const pad = { l: 34, r: w < 500 ? 70 : 96, t: 10, b: 28 };
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = h - pad.t - pad.b;
  const maxY = Math.max(1, ...steps.flatMap((s) => Object.values(s.totals)));
  const niceMax = Math.ceil(maxY / 10) * 10 || 10;
  const x = (i: number) => pad.l + (steps.length <= 1 ? iw / 2 : (i / (steps.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / niceMax) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  const order = [...pins.filter((p) => !top.includes(p)), ...top.slice().reverse()]; // top drawn last (on top)
  const path = (pin: string) => steps.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.totals[pin] ?? 0).toFixed(1)}`).join(" ");
  const last = steps.length - 1;
  // End-of-line labels for the top 3, pushed apart so close scores don't overlap
  const labelYs = top
    .map((pin) => ({ pin, ly: y(steps[last]?.totals[pin] ?? 0) }))
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < labelYs.length; i++) {
    if (labelYs[i].ly - labelYs[i - 1].ly < 15) labelYs[i].ly = labelYs[i - 1].ly + 15;
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#cfcfcf]">
        {top.map((pin, i) => (
          <span key={pin} className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-4 rounded" style={{ backgroundColor: TOP_COLORS[i] }} />
            {nameOf[pin]}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[#9c9c9c]">
          <span className="inline-block h-[2px] w-4 rounded" style={{ backgroundColor: OTHER }} />
          Øvrige
        </span>
      </div>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label="Poeng etter hver presenterte øl"
        onMouseLeave={() => setHi(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = e.clientX - r.left;
          if (steps.length <= 1) return setHi(0);
          const i = Math.round(((px - pad.l) / iw) * (steps.length - 1));
          setHi(Math.max(0, Math.min(steps.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="#2a2a2a" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#8a8a8a">{t}</text>
          </g>
        ))}
        {steps.map((s, i) =>
          steps.length <= 12 || i % Math.ceil(steps.length / 12) === 0 ? (
            <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize={11} fill="#8a8a8a">
              {w < 500 ? i + 1 : s.label.slice(0, 9)}
            </text>
          ) : null,
        )}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={pad.t + ih} stroke="#666" strokeWidth={1} strokeDasharray="3 3" />}
        {order.map((pin) => {
          const ti = top.indexOf(pin);
          const color = ti >= 0 ? TOP_COLORS[ti] : OTHER;
          return (
            <g key={pin}>
              <path d={path(pin)} fill="none" stroke={color} strokeWidth={ti >= 0 ? 2.5 : 1.5} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(last)} cy={y(steps[last].totals[pin] ?? 0)} r={ti >= 0 ? 4.5 : 3} fill={color} stroke="#191919" strokeWidth={2} />
            </g>
          );
        })}
        {labelYs.map(({ pin, ly }) => (
          <text key={pin} x={x(last) + 9} y={ly} dy="0.32em" fontSize={12} fontWeight={600} fill="#efefef">
            {nameOf[pin]?.slice(0, 11)}
          </text>
        ))}
      </svg>
      {hi != null && (
        <div
          className="pointer-events-none absolute top-8 z-10 rounded-lg border border-white/10 bg-[#0f0f0f] px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(Math.max(0, x(hi) + 12), w - 170) }}
        >
          <div className="mb-1 font-semibold">Etter {steps[hi].label}</div>
          {pins
            .map((pin) => ({ pin, v: steps[hi].totals[pin] ?? 0 }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 6)
            .map(({ pin, v }) => {
              const ti = top.indexOf(pin);
              return (
                <div key={pin} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ti >= 0 ? TOP_COLORS[ti] : OTHER }} />
                    {nameOf[pin]}
                  </span>
                  <span className="tabular-nums">{fmt(v)}</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function MiniRanking({ rows }: { rows: Array<{ pin: string; name: string; sub: string; value: number }> }) {
  const sorted = rows
    .slice()
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "nb"));
  const max = Math.max(1, ...sorted.map((r) => r.value));
  // Shared place for equal values
  const places = sorted.map((r) => sorted.findIndex((x) => x.value === r.value) + 1);
  return (
    <ol className="space-y-1">
      {sorted.map((r, i) => {
        const place = places[i];
        return (
          <li key={r.pin} className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-sm">
            <span className="text-center tabular-nums text-[#9c9c9c]">{r.value > 0 && place <= 3 ? MEDALS[place - 1] : place}</span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-medium">{r.name}</span>
                <span className="truncate text-[11px] text-[#7d7d7d]">{r.sub}</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded bg-white/5">
                <div className="h-full rounded transition-all duration-700" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: BAR }} />
              </div>
            </div>
            <span className="text-right font-semibold tabular-nums"><CountUp value={r.value} decimals={0} /></span>
          </li>
        );
      })}
    </ol>
  );
}

function PresentedTable({ presented }: { presented: Presented[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[#9c9c9c]">
            <th className="py-1 pr-2 font-medium">#</th>
            <th className="py-1 pr-2 font-medium">Presentert av</th>
            <th className="py-1 pr-2 font-medium">Øl</th>
            <th className="py-1 pr-2 text-right font-medium">Stemmer</th>
            <th className="py-1 pr-2 text-right font-medium">Snitt øl</th>
            <th className="py-1 pr-2 text-right font-medium">Snitt pres.</th>
            <th className="py-1 text-right font-medium">Poeng</th>
          </tr>
        </thead>
        <tbody>
          {presented.map((b, i) => (
            <tr key={b.pin} className="border-t border-white/5">
              <td className="py-1.5 pr-2 tabular-nums text-[#9c9c9c]">{i + 1}</td>
              <td className="py-1.5 pr-2 font-medium">{b.name}</td>
              <td className="max-w-[12rem] truncate py-1.5 pr-2 text-[#cfcfcf]">{b.beer || "—"}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{b.votes}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(b.avgBeer, 2)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(b.avgExtra, 2)}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{fmt(b.sum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
