"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatNumber, isLang, LANGS, LOCALE, translate, type Lang } from "@/lib/leaderboardI18n";
import { commentary, type CommentKind } from "@/lib/commentator";

type Standing = {
  place: number; pin: string; name: string; beer: string; producer: string; type?: string; abv: number | null;
  image?: string | null; beerPoints: number; extraPoints: number; sum: number; presented: boolean;
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

type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  f: (n: number | null | undefined, decimals?: number) => string;
};
const makeI18n = (lang: Lang, setLang: (l: Lang) => void): I18n => ({
  lang,
  setLang,
  t: (key, params) => translate(lang, key, params),
  f: (n, decimals = 1) => formatNumber(lang, n, decimals),
});
const I18nCtx = createContext<I18n>(makeI18n("no", () => {}));
const useI18n = () => useContext(I18nCtx);

// Events are stored as a text key + raw params and translated when shown,
// so switching language also translates news that already happened.
type EvParams = { name?: string; beer?: string; avg?: number | null };
type FeedItem = { id: number; icon: string; key: string; params: EvParams; at: Date; kind?: CommentKind };
type Announce = { id: number; name: string; beer: string };
type Toast = { id: number; icon: string; key: string; params: EvParams };

/** News feed line: the sports commentator where available, else the plain text. */
function feedText(i: I18n, item: FeedItem): string {
  if (item.kind) {
    const line = commentary(i.lang, item.kind, item.params, item.id, (n) => i.f(n, 2));
    if (line) return line;
  }
  return evText(i, item.key, item.params);
}

function evText(i: I18n, key: string, p: EvParams): string {
  return i.t(key, {
    name: p.name ?? "",
    beer: key === "evPick" ? (p.beer ? ` – ${p.beer}` : "") : p.beer || i.t("theBeer"),
    avg: i.f(p.avg ?? null, 2),
  });
}
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
  const [openPin, setOpenPin] = useState<string | null>(null); // clicked participant → beer card
  const prevRef = useRef<Board | null>(null);
  const idRef = useRef(1);
  const [lang, setLangState] = useState<Lang>("no");
  // ?lang=en|ja|no in the link wins, otherwise the last choice on this device
  useEffect(() => {
    let initial: Lang | null = null;
    const q = new URLSearchParams(window.location.search).get("lang");
    if (isLang(q)) initial = q;
    else {
      try {
        const saved = localStorage.getItem("lbLang");
        if (isLang(saved)) initial = saved;
      } catch {
        // storage unavailable
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL/localStorage only exist client-side
    if (initial) setLangState(initial);
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lbLang", l);
    } catch {
      // storage unavailable
    }
  }, []);
  const i18n = useMemo(() => makeI18n(lang, setLang), [lang, setLang]);
  const { t, f } = i18n;
  const wrap = (node: React.ReactNode) => <I18nCtx.Provider value={i18n}>{node}</I18nCtx.Provider>;

  const handleUpdate = useCallback((next: Board) => {
    const prev = prevRef.current;
    prevRef.current = next;
    setBoard(next);
    if (!prev) return; // first load: no fireworks for things that already happened
    const ev = detectEvents(prev, next);
    const now = new Date();
    const add: FeedItem[] = [];
    const nid = () => idRef.current++;
    const toast = (icon: string, key: string, params: EvParams) => {
      const id = nid();
      setToasts((t) => [...t.slice(-2), { id, icon, key, params }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    };
    if (ev.pick) {
      const id = nid();
      setAnnounce({ id, name: ev.pick.name, beer: ev.pick.beer });
      window.setTimeout(() => setAnnounce((a) => (a && a.id === id ? null : a)), 6500);
      setConfetti((c) => c + 1);
      add.push({ id: nid(), icon: "🎡", key: "evPick", kind: "pick", params: { name: ev.pick.name, beer: ev.pick.beer }, at: now });
    }
    if (ev.leader) {
      toast("👑", "evLeaderToast", { name: ev.leader });
      if (!ev.pick) setConfetti((c) => c + 1);
      add.push({ id: nid(), icon: "👑", key: "evLeader", kind: "leader", params: { name: ev.leader }, at: now });
    }
    if (ev.throws.length) {
      const fresh = ev.throws.map(([beer, extra], i) => ({ id: nid(), beer, extra, x: 8 + ((i * 29 + Math.random() * 40) % 70) }));
      setDice((d) => [...d, ...fresh]);
      window.setTimeout(() => setDice((d) => d.filter((x) => !fresh.some((f) => f.id === x.id))), 3400);
      const who = next.presenter?.name || "";
      const whoBeer = next.presenter?.beer || "";
      const double6 = ev.throws.filter(([b, e]) => b === 6 && e === 6).length;
      const beer6 = ev.throws.filter(([b, e]) => b === 6 && e !== 6).length;
      const pres6 = ev.throws.filter(([b, e]) => e === 6 && b !== 6).length;
      if (double6) {
        toast("🎲🎲", "evDouble6Toast", { name: who });
        setConfetti((c) => c + 1);
        add.push({ id: nid(), icon: "🎲", key: "evDouble6", kind: "double6", params: { name: who, beer: whoBeer }, at: now });
      } else if (beer6 || pres6) {
        toast("🎲", beer6 ? "evBeer6Toast" : "evPres6Toast", { name: who });
        add.push({ id: nid(), icon: "🎲", key: beer6 ? "evBeer6" : "evPres6", kind: beer6 ? "beer6" : "pres6", params: { name: who, beer: whoBeer }, at: now });
      }
      if (ev.throws.some(([b]) => b === 1)) add.push({ id: nid(), icon: "🥶", key: "evOne", kind: "beer1", params: { name: who, beer: whoBeer }, at: now });
      if (ev.throws.some(([, e]) => e > 0 && e <= 2)) add.push({ id: nid(), icon: "😬", key: "evPresLow", kind: "presLow", params: { name: who, beer: whoBeer }, at: now });
    }
    if (ev.allVoted) {
      toast("✅", "evAllVotedToast", { avg: ev.allVoted.avg });
      add.push({ id: nid(), icon: "✅", key: "evAllVoted", kind: "allVoted", params: { beer: ev.allVoted.beer, avg: ev.allVoted.avg }, at: now });
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
    return wrap(
      <Shell>
        <div className="mx-auto mt-24 max-w-md rounded-2xl bg-[#191919] p-6 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-3 text-xl font-semibold">{t("denied")}</h1>
          <p className="mt-2 text-sm text-[#9c9c9c]">{t("deniedHelp")}</p>
        </div>
      </Shell>,
    );
  }
  if (!board) {
    return wrap(
      <Shell>
        <div className="mt-24 text-center text-[#9c9c9c]">{t("loading")}</div>
      </Shell>,
    );
  }

  const top = board.standings.slice(0, 3).map((s) => s.pin);
  // «Best so far» + news feed: left column on desktop, below the rankings on mobile
  const extras = (
    <>
          {board.best && (
            <Card title={t("bestSoFar")}>
              <div className="text-lg font-semibold">{board.best.beer || "—"}</div>
              <div className="text-sm text-[#9c9c9c]">{board.best.name}</div>
              <div className="mt-2 flex gap-6 text-sm">
                <div><div className="text-[#9c9c9c]">{t("avgBeer")}</div><div className="text-2xl font-bold tabular-nums">{f(board.best.avgBeer, 2)}</div></div>
                <div><div className="text-[#9c9c9c]">{t("avgPres")}</div><div className="text-2xl font-bold tabular-nums">{f(board.best.avgExtra, 2)}</div></div>
              </div>
            </Card>
          )}
          <Card title={t("news")}>
            {feed.length === 0 ? (
              <div className="text-sm text-[#9c9c9c]">{t("newsEmpty")}</div>
            ) : (
              <ul className="space-y-1.5">
                {feed.map((item, i) => (
                  <li key={item.id} className={`flex items-start gap-2 text-sm ${i === 0 ? "lb-pop" : ""}`}>
                    <span className="w-5 shrink-0 text-center">{item.icon}</span>
                    <span className="min-w-0 flex-1">{feedText(i18n, item)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-[#6b6b6b]">
                      {item.at.toLocaleTimeString(LOCALE[lang], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
    </>
  );
  return wrap(
    <Shell>
      {confetti > 0 && <ConfettiBurst key={`confetti-${confetti}`} />}
      {announce && <AnnounceOverlay key={`announce-${announce.id}`} name={announce.name} beer={announce.beer} onClose={() => setAnnounce(null)} />}
      <Toasts toasts={toasts} />
      {openPin && (() => {
        const st = board.standings.find((x) => x.pin === openPin);
        return st ? <BeerModal s={st} rank={board.standings.indexOf(st)} factor={board.factor} onClose={() => setOpenPin(null)} /> : null;
      })()}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3 sm:gap-4">
          {/* The juleølhatt – always on the page, gently rocking */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/mcga.png"
            alt={t("hatAlt")}
            className="lb-rock h-16 w-16 shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] sm:h-24 sm:w-24"
          />
        <div>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-[#f2c14e]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            {t("live")}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Gulmasse &apos;26</h1>
        </div>
        </div>
        <div className="text-left text-sm sm:text-right text-[#9c9c9c]">
          <div>{t("presentedCount", { n: board.counts.presented, total: board.counts.participants })}</div>
          <div className="text-xs">
            {offline ? t("offline") : t("updated", { time: new Date(board.updatedAt).toLocaleTimeString(LOCALE[lang]) })}
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <NowCard board={board} dice={dice} />
          <div className="hidden space-y-5 lg:block">{extras}</div>
        </div>
        <div className="space-y-5">
          <Card title={t("whoLeads")}>
            <Standings standings={board.standings} progression={board.progression} onOpen={setOpenPin} />
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card title={t("beerPoints")}>
              <MiniRanking
                onOpen={setOpenPin}
                rows={board.standings.map((s) => ({ pin: s.pin, name: s.name, sub: s.beer, value: s.beerPoints }))}
              />
            </Card>
            <Card title={t("presPoints")}>
              <MiniRanking
                onOpen={setOpenPin}
                rows={board.standings.map((s) => ({ pin: s.pin, name: s.name, sub: s.beer, value: s.extraPoints }))}
              />
            </Card>
          </div>
          {board.givers && board.givers.length > 0 && (
            <Card title={t("givers")}>
              <MiniRanking
                onOpen={setOpenPin}
                rows={board.givers.map((g) => ({
                  pin: g.pin,
                  name: g.name,
                  sub: `🍺 ${g.beerGiven} · 🎤 ${g.extraGiven} · ${t("avgShort", { v: f(g.votes ? g.total / g.votes / 2 : null, 2) })}`,
                  value: g.total,
                }))}
              />
            </Card>
          )}
        </div>
        <div className="space-y-5 lg:hidden">{extras}</div>
      </div>

      {board.progression.length > 0 && (
        <Card title={t("race")} className="mt-5">
          <RaceChart board={board} top={top} />
        </Card>
      )}

      {board.presented.length > 0 && (
        <Card title={t("presentedSoFar")} className="mt-5">
          <PresentedTable presented={board.presented} onOpen={setOpenPin} />
        </Card>
      )}
      <footer className="mt-8 pb-6 text-center text-xs text-[#6b6b6b]">
        {t("footer", { f: f(board.factor) })}
      </footer>
    </Shell>,
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
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="status"
      aria-live="assertive"
    >
      <div className="lb-zoom text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[#f2c14e] sm:text-base">{t("wheelChose")}</div>
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
        <div className="mt-6 text-sm text-[#cfcfcf]">{t("cheers")}</div>
      </div>
    </div>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  const i18n = useI18n();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex flex-col items-center gap-2 px-3" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="lb-toast rounded-full border border-[#f2c14e]/40 bg-[#1d1608]/95 px-5 py-2.5 text-base font-semibold text-[#f7d98a] shadow-2xl sm:text-lg">
          <span className="mr-2">{toast.icon}</span>
          {evText(i18n, toast.key, toast.params)}
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
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-2 flex justify-end">
          <LangSwitch />
        </div>
        {children}
      </div>
    </div>
  );
}

function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t("language")} className="inline-flex overflow-hidden rounded-full border border-white/15 bg-black/30 text-xs font-semibold">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          title={l.name}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
          className={`px-3 py-1.5 transition-colors ${lang === l.code ? "bg-[#f2c14e] text-[#1d1608]" : "text-[#cfcfcf] hover:bg-white/10"}`}
        >
          {l.label}
        </button>
      ))}
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
  const { t, f } = useI18n();
  const p = board.presenter;
  const counts = { n: board.counts.presented, total: board.counts.participants };
  if (!p) {
    const msg =
      board.status === "spinning" ? t("spinning") :
      board.status === "waiting" ? t("notStarted") :
      board.counts.presented >= board.counts.participants ? t("allDone") :
      t("pause");
    return (
      <Card title={t("nextBeer", counts)}>
        <div className="py-6 text-center text-lg text-[#cfcfcf]">{msg}</div>
      </Card>
    );
  }
  const pct = p.active > 0 ? Math.min(100, Math.round((p.votes / p.active) * 100)) : 0;
  return (
    <Card title={t("presentingNow", counts)}>
      <div className="relative">
        {/* Freshly locked votes float up: both dice per vote */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-0" aria-hidden>
          {dice.map((d) => (
            <div key={d.id} className="lb-rise absolute bottom-0 flex gap-1 rounded-xl bg-black/50 px-2 py-1 backdrop-blur-sm" style={{ left: `${d.x}%` }}>
              <DieFace value={d.beer} label={t("dieBeer")} small />
              {d.extra > 0 && <DieFace value={d.extra} label={t("diePres")} small />}
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
            {[p.producer, p.type, p.abv != null ? `${f(p.abv)} %` : ""].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="text-[#9c9c9c]">{t("votesCast")}</span>
          <span className="tabular-nums"><b>{p.votes}</b> / {p.active}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={p.votes} aria-valuemax={p.active}>
          <div className="h-full rounded-full bg-[#f2c14e] transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {p.avgBeer != null && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <div className="text-xs text-[#9c9c9c]">{t("avgBeer")}</div>
              <div className="text-2xl font-bold tabular-nums">{f(p.avgBeer, 2)}</div>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <div className="text-xs text-[#9c9c9c]">{t("avgPres")}</div>
              <div className="text-2xl font-bold tabular-nums">{f(p.avgExtra ?? null, 2)}</div>
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
  const { f } = useI18n();
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
  return <>{f(shown, decimals)}</>;
}

function Standings({
  standings,
  progression,
  onOpen,
}: {
  standings: Standing[];
  progression: Board["progression"];
  onOpen: (pin: string) => void;
}) {
  const { t, f } = useI18n();
  const max = Math.max(1, ...standings.map((s) => s.sum));

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
          className={`relative grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-2 rounded-lg px-1 py-1 text-sm transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2c14e] ${i === 0 && s.sum > 0 ? "lb-glow bg-[#f2c14e]/5" : ""}`}
          {...clickable(() => onOpen(s.pin), t("showBeer", { name: s.name }))}
        >
          <span className="text-center text-base tabular-nums">{s.sum > 0 && i < 3 ? MEDALS[i] : s.place}</span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="truncate font-semibold">{s.name}</span>
              <span className="hidden truncate text-xs text-[#9c9c9c] sm:inline">{s.beer}</span>
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#9c9c9c]">🍺 {f(s.beerPoints, 0)} · 🎤 {f(s.extraPoints, 0)}</span>
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
        </li>
        );
      })}
    </ol>
  );
}

function RaceChart({ board, top }: { board: Board; top: string[] }) {
  const { t, f } = useI18n();
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
          {t("others")}
        </span>
      </div>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={t("chartAria")}
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
          <div className="mb-1 font-semibold">{t("after", { name: steps[hi].label })}</div>
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
                  <span className="tabular-nums">{f(v)}</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function MiniRanking({
  rows,
  onOpen,
}: {
  rows: Array<{ pin: string; name: string; sub: string; value: number }>;
  onOpen: (pin: string) => void;
}) {
  const { t } = useI18n();
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
          <li
            key={r.pin}
            className="grid cursor-pointer grid-cols-[1.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-md text-sm hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
            {...clickable(() => onOpen(r.pin), t("showBeer", { name: r.name }))}
          >
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

/** Props that make a row act like a button (click, Enter/Space, screen readers). */
function clickable(onActivate: () => void, label: string) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

function BeerModal({ s, rank, factor, onClose }: { s: Standing; rank: number; factor: number; onClose: () => void }) {
  const { t, f } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const place = s.sum > 0 && rank < 3 ? MEDALS[rank] : `${s.place}.`;
  return (
    <div role="dialog" aria-modal="true" aria-label={t("beerOf", { name: s.name })} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className="lb-pop relative flex max-h-[90dvh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#191919] text-[#efefef] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="absolute right-2 top-2 z-10 rounded-md bg-black/60 px-2 py-1 text-sm" onClick={onClose} aria-label={t("close")}>
          ✕
        </button>
        {s.image ? (
          <div className="flex shrink items-center justify-center p-3">
            {/* Fixed max height: tall, narrow photos can never push the info out */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.image} alt={s.beer || s.name} className="max-h-[min(50dvh,calc(90dvh-17rem))] w-auto max-w-full rounded-lg object-contain" />
          </div>
        ) : (
          <div className="flex h-28 shrink-0 items-center justify-center text-6xl">🍺</div>
        )}
        <div className="shrink-0 px-4 pb-4 pt-1 text-center text-sm text-[#cfcfcf]">
          <div className="text-xl font-bold text-white">{s.name}</div>
          {s.beer && <div className="mt-0.5 text-lg font-semibold text-[#f2c14e]">{s.beer}</div>}
          <div className="mt-1 space-y-0.5">
            {s.producer && <div>{t("producer")}: <span className="font-medium text-white">{s.producer}</span></div>}
            {s.type && <div>{t("style")}: <span className="font-medium text-white">{s.type}</span></div>}
            {s.abv != null && <div>{t("abv")}: <span className="font-medium text-white">{f(s.abv)}%</span></div>}
          </div>
          {s.presented ? (
            <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-white/5 p-2">
              <div><div className="text-[11px] text-[#9c9c9c]">{t("place")}</div><div className="text-lg font-bold">{place}</div></div>
              <div><div className="text-[11px] text-[#9c9c9c]">{t("total")}</div><div className="text-lg font-bold tabular-nums">{f(s.sum)}</div></div>
              <div><div className="text-[11px] text-[#9c9c9c]">{t("beerShort")}</div><div className="text-lg font-bold tabular-nums">{f(s.beerPoints, 0)}</div></div>
              <div><div className="text-[11px] text-[#9c9c9c]">{t("presShort")}</div><div className="text-lg font-bold tabular-nums">{f(s.extraPoints, 0)}</div></div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-white/5 p-2 text-[#9c9c9c]">{t("notPresented")}</div>
          )}
          {s.presented && <div className="mt-1 text-[10px] text-[#6b6b6b]">{t("totalFormula", { f: f(factor) })}</div>}
        </div>
      </div>
    </div>
  );
}

function PresentedTable({ presented, onOpen }: { presented: Presented[]; onOpen: (pin: string) => void }) {
  const { t, f } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[#9c9c9c]">
            <th className="py-1 pr-2 font-medium">#</th>
            <th className="py-1 pr-2 font-medium">{t("thBy")}</th>
            <th className="py-1 pr-2 font-medium">{t("thBeer")}</th>
            <th className="py-1 pr-2 text-right font-medium">{t("thVotes")}</th>
            <th className="py-1 pr-2 text-right font-medium">{t("thAvgBeer")}</th>
            <th className="py-1 pr-2 text-right font-medium">{t("thAvgPres")}</th>
            <th className="py-1 text-right font-medium">{t("thPoints")}</th>
          </tr>
        </thead>
        <tbody>
          {presented.map((b, i) => (
            <tr
              key={b.pin}
              className="cursor-pointer border-t border-white/5 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2c14e]"
              {...clickable(() => onOpen(b.pin), t("showBeer", { name: b.name }))}
            >
              <td className="py-1.5 pr-2 tabular-nums text-[#9c9c9c]">{i + 1}</td>
              <td className="py-1.5 pr-2 font-medium">{b.name}</td>
              <td className="max-w-[12rem] truncate py-1.5 pr-2 text-[#cfcfcf]">{b.beer || "—"}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{b.votes}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{f(b.avgBeer, 2)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{f(b.avgExtra, 2)}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{f(b.sum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
