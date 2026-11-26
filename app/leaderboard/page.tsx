"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
    name: string; beer: string; producer: string; type: string; abv: number | null; image: string | null;
    votes: number; active: number; avgBeer: number | null;
  };
  standings: Standing[];
  presented: Presented[];
  progression: Array<{ label: string; totals: Record<string, number> }>;
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

export default function LeaderboardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [denied, setDenied] = useState(false);
  const [offline, setOffline] = useState(false);

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
        setBoard(await res.json());
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
  }, []);

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
  return (
    <Shell>
      <header className="flex flex-wrap items-end justify-between gap-3">
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
        <div className="text-right text-sm text-[#9c9c9c]">
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
          <NowCard board={board} />
          {board.best && (
            <Card title="Høyest rangerte øl så langt">
              <div className="text-lg font-semibold">{board.best.beer || "—"}</div>
              <div className="text-sm text-[#9c9c9c]">{board.best.name}</div>
              <div className="mt-2 flex gap-6 text-sm">
                <div><div className="text-[#9c9c9c]">Snitt terning</div><div className="text-2xl font-bold tabular-nums">{fmt(board.best.avgBeer, 2)}</div></div>
                <div><div className="text-[#9c9c9c]">Snitt ekstra</div><div className="text-2xl font-bold tabular-nums">{fmt(board.best.avgExtra, 2)}</div></div>
              </div>
            </Card>
          )}
        </div>
        <Card title="Hvem leder?">
          <Standings standings={board.standings} factor={board.factor} />
        </Card>
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
        Poeng = terning + {fmt(board.factor)} × ekstra · oppdateres automatisk
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-[radial-gradient(ellipse_at_top,#3a0f12_0%,#120b0b_55%,#0b0b0b_100%)] text-[#efefef]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
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

function NowCard({ board }: { board: Board }) {
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
      <div className="flex gap-4">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.beer || p.name} className="h-32 w-24 shrink-0 rounded-lg bg-white/5 object-contain sm:h-40 sm:w-28" />
        ) : (
          <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-lg bg-white/5 text-4xl sm:h-40 sm:w-28">🍺</div>
        )}
        <div className="min-w-0">
          <div className="text-2xl font-extrabold leading-tight">{p.name}</div>
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
          <div className="mt-2 text-sm text-[#9c9c9c]">
            Snitt terning så langt: <span className="font-semibold text-[#efefef] tabular-nums">{fmt(p.avgBeer, 2)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function Standings({ standings, factor }: { standings: Standing[]; factor: number }) {
  const max = Math.max(1, ...standings.map((s) => s.sum));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <ol className="space-y-1.5">
      {standings.map((s, i) => (
        <li
          key={s.pin}
          className="relative grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-2 rounded-lg px-1 py-1 text-sm transition-colors hover:bg-white/5"
          onMouseEnter={() => setHover(s.pin)}
          onMouseLeave={() => setHover(null)}
        >
          <span className="text-center text-base tabular-nums">{s.sum > 0 && i < 3 ? MEDALS[i] : s.place}</span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="truncate font-semibold">{s.name}</span>
              <span className="truncate text-xs text-[#9c9c9c]">{s.beer}</span>
            </div>
            <div className="mt-1 h-2 rounded bg-white/5">
              <div
                className="h-full rounded transition-all duration-700"
                style={{ width: `${(s.sum / max) * 100}%`, backgroundColor: s.presented ? BAR : "#6b5320" }}
              />
            </div>
          </div>
          <span className="text-right text-base font-bold tabular-nums">{fmt(s.sum)}</span>
          {hover === s.pin && (
            <div className="pointer-events-none absolute right-16 top-full z-10 mt-1 rounded-lg border border-white/10 bg-[#0f0f0f] px-3 py-2 text-xs shadow-xl">
              <div className="font-semibold">{s.name}</div>
              <div className="text-[#9c9c9c]">Terning: <span className="text-[#efefef] tabular-nums">{fmt(s.beerPoints, 0)}</span></div>
              <div className="text-[#9c9c9c]">Ekstra: <span className="text-[#efefef] tabular-nums">{fmt(s.extraPoints, 0)}</span> (× {fmt(factor)})</div>
              {!s.presented && <div className="mt-1 text-[#9c9c9c]">Har ikke presentert ennå</div>}
            </div>
          )}
        </li>
      ))}
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
            <th className="py-1 pr-2 text-right font-medium">Snitt terning</th>
            <th className="py-1 pr-2 text-right font-medium">Snitt ekstra</th>
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
