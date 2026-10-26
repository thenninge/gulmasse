"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ScoreMatrix = {
  order: string[];
  cells: Record<string, Record<string, number>>;
};

type Edition = {
  id: string;
  year: number;
  name: string;
  event_date: string | null;
  notes: string | null;
  sum_factor?: number | null;
  beer_matrix?: ScoreMatrix | null;
  extra_matrix?: ScoreMatrix | null;
  combined_matrix?: ScoreMatrix | null;
};

type Standing = {
  id: string;
  edition_id: string;
  rank: number;
  name: string;
  beer_name: string | null;
  producer: string | null;
  beer_type: string | null;
  abv: number | null;
  points: number;
  given_points: number;
  is_winner: boolean;
};

type LiveStanding = {
  rank: number;
  name: string;
  beer_name?: string | null;
  producer?: string | null;
  beer_type?: string | null;
  abv?: number | null;
  points: number;
  given_points?: number;
};

type Props = {
  hostPin: string;
  liveStandings?: LiveStanding[];
};

type MatrixTab = "combined" | "beer" | "extra";

function beerImageForName(name: string): string | null {
  const key = name.trim().toLowerCase();
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
  return map[key] || null;
}

function MatrixTable({ matrix, title }: { matrix: ScoreMatrix; title: string }) {
  const order = matrix.order || [];
  const colReceived = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const to of order) {
      let sum = 0;
      for (const from of order) {
        const v = matrix.cells?.[from]?.[to];
        if (typeof v === "number") sum += v;
      }
      acc[to] = sum;
    }
    return acc;
  }, [matrix, order]);

  const rowGiven = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const from of order) {
      let sum = 0;
      for (const to of order) {
        const v = matrix.cells?.[from]?.[to];
        if (typeof v === "number") sum += v;
      }
      acc[from] = sum;
    }
    return acc;
  }, [matrix, order]);

  const grand = Object.values(colReceived).reduce((a, b) => a + b, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <div className="border-b border-zinc-100 bg-zinc-50 px-2 py-1.5 text-[11px] font-medium text-zinc-700">
        {title}
      </div>
      <table className="min-w-full text-[10px]">
        <thead>
          <tr className="bg-white text-zinc-500">
            <th className="sticky left-0 z-10 bg-white p-1 text-left">Giver ↓ / Mottaker →</th>
            {order.map((n) => (
              <th key={n} className="p-1 text-center font-medium text-zinc-700">
                {n}
              </th>
            ))}
            <th className="p-1 text-right">Gitt</th>
          </tr>
        </thead>
        <tbody>
          {order.map((from) => (
            <tr key={from} className="border-t border-zinc-100">
              <td className="sticky left-0 z-10 bg-white p-1 font-medium text-zinc-800">{from}</td>
              {order.map((to) => {
                const v = matrix.cells?.[from]?.[to];
                return (
                  <td key={to} className="p-1 text-center tabular-nums text-zinc-700">
                    {typeof v === "number" ? v : "—"}
                  </td>
                );
              })}
              <td className="p-1 text-right font-medium tabular-nums">
                {rowGiven[from]?.toFixed?.(1)?.replace(/\.0$/, "") ?? rowGiven[from]}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 bg-zinc-50">
            <td className="sticky left-0 z-10 bg-zinc-50 p-1 font-semibold">Sum mottatt</td>
            {order.map((to) => (
              <td key={to} className="p-1 text-center font-semibold tabular-nums">
                {colReceived[to]?.toFixed?.(1)?.replace(/\.0$/, "") ?? colReceived[to]}
              </td>
            ))}
            <td className="p-1 text-right font-semibold tabular-nums">
              {grand.toFixed(1).replace(/\.0$/, "")}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function HostHistory({ hostPin, liveStandings = [] }: Props) {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [editionId, setEditionId] = useState<string>("");
  const [edition, setEdition] = useState<Edition | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [archiveYear, setArchiveYear] = useState(String(new Date().getFullYear()));
  const [message, setMessage] = useState<string | null>(null);
  const [matrixTab, setMatrixTab] = useState<MatrixTab>("combined");

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", "x-host-pin": hostPin }),
    [hostPin],
  );

  const load = useCallback(
    async (id?: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = id ? `?editionId=${encodeURIComponent(id)}` : "";
        const res = await fetch(`/api/host/history${qs}`, {
          headers: { "x-host-pin": hostPin },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Kunne ikke hente historikk");
        setEditions(data.editions || []);
        setEdition(data.edition || null);
        setStandings(data.standings || []);
        setEditionId(data.edition?.id || "");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Feil");
      } finally {
        setLoading(false);
      }
    },
    [hostPin],
  );

  useEffect(() => {
    load();
  }, [load]);

  const podium = useMemo(() => standings.slice(0, 3), [standings]);
  const maxPts = useMemo(
    () => Math.max(1, ...podium.map((p) => Number(p.points) || 0)),
    [podium],
  );

  const activeMatrix = useMemo(() => {
    if (!edition) return null;
    if (matrixTab === "beer") return edition.beer_matrix || null;
    if (matrixTab === "extra") return edition.extra_matrix || null;
    return edition.combined_matrix || null;
  }, [edition, matrixTab]);

  async function savePoints(row: Standing, points: number) {
    setSavingId(row.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/host/history", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ id: row.id, points }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke lagre");
      const next = (data.standing as Standing) || { ...row, points };
      setStandings((prev) => {
        const updated = prev.map((s) => (s.id === row.id ? { ...s, ...next, points } : s));
        return updated
          .slice()
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
          .map((s, idx) => ({ ...s, rank: idx + 1, is_winner: idx === 0 }));
      });
      setMessage("Poeng lagret");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil");
    } finally {
      setSavingId(null);
    }
  }

  async function seed2025() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/host/history", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ action: "seed_2025" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke importere '25");
      setMessage(data.message || "Gulmasse '25 importert");
      await load(data.edition?.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil");
    }
  }

  async function archiveLive() {
    setError(null);
    setMessage(null);
    const year = Number(archiveYear);
    if (!Number.isFinite(year)) {
      setError("Ugyldig år");
      return;
    }
    if (!liveStandings.length) {
      setError("Ingen live-resultater å arkivere ennå. For fjoråret: bruk «Importer Gulmasse '25».");
      return;
    }
    try {
      const res = await fetch("/api/host/history", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          year,
          name: `Gulmasse '${String(year).slice(-2)}`,
          standings: liveStandings.map((s) => ({
            rank: s.rank,
            name: s.name,
            beer_name: s.beer_name ?? null,
            producer: s.producer ?? null,
            beer_type: s.beer_type ?? null,
            abv: s.abv ?? null,
            points: s.points,
            given_points: s.given_points ?? 0,
            is_winner: s.rank === 1,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke arkivere");
      setMessage(`Arkivert ${data.edition?.name || year}`);
      await load(data.edition?.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil");
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-800">Tidligere år</h3>
          <p className="text-xs text-zinc-500">
            Poeng, podium og hvem-ga-hvem
            {loading ? " …" : ""}
          </p>
        </div>
        <button
          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs active:bg-zinc-50"
          onClick={() => load(editionId || undefined)}
        >
          Oppdater
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
        <p className="text-xs text-amber-950">
          Fjorårets resultater ligger som ferdige tall (Martin 43.5 osv.). Importer dem hit — trenger ikke live-lobby.
        </p>
        <button
          className="w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-medium text-white active:opacity-90"
          onClick={seed2025}
        >
          Importer Gulmasse &apos;25
        </button>
      </div>

      {editions.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Ingen arkiverte år ennå. Hvis import feiler: kjør <code className="text-[10px]">db/supabase_invite_setup.sql</code> i Supabase.
        </p>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">Velg år</label>
            <select
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={editionId}
              onChange={(e) => {
                const id = e.target.value;
                setEditionId(id);
                load(id);
              }}
            >
              {editions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.year})
                </option>
              ))}
            </select>
            {edition?.notes && (
              <p className="mt-1 text-[11px] text-zinc-500">{edition.notes}</p>
            )}
          </div>

          <div className="rounded-xl bg-zinc-50 p-3">
            <h4 className="mb-3 text-center text-sm font-semibold text-zinc-800">
              Podium {edition?.name || ""}
            </h4>
            {podium.length === 0 ? (
              <p className="text-center text-xs text-zinc-500">Ingen resultater</p>
            ) : (
              <div className="grid grid-cols-3 items-end gap-2">
                {podium.map((t, i) => {
                  const height = 48 + ((Number(t.points) || 0) / maxPts) * 72;
                  const orderClass = i === 0 ? "order-2" : i === 1 ? "order-1" : "order-3";
                  const img = beerImageForName(t.name);
                  return (
                    <div key={t.id} className={`flex flex-col items-center ${orderClass}`}>
                      {img && (
                        <img
                          src={img}
                          alt={t.name}
                          className="mb-1 h-auto w-3/4 rounded-md object-contain ring-1 ring-zinc-200"
                        />
                      )}
                      <div
                        className="w-full rounded-t-lg bg-emerald-600 text-white"
                        style={{ height }}
                        title={`${t.points} pts`}
                      />
                      <div className="mt-1 truncate text-center text-xs font-medium">
                        {t.name}
                        {t.is_winner || i === 0 ? " 👑" : ""}
                      </div>
                      <div className="truncate text-center text-[10px] text-zinc-600">
                        {t.beer_name || "—"}
                      </div>
                      <div className="text-[11px] text-zinc-700">
                        {Number(t.points).toFixed(1)} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-zinc-500">
                <tr>
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Navn</th>
                  <th className="py-1 pr-2">Øl</th>
                  <th className="py-1 text-right">Poeng</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-2 tabular-nums">{row.rank}</td>
                    <td className="py-2 pr-2 font-medium text-zinc-800">
                      {row.name}
                      {row.is_winner ? " 👑" : ""}
                    </td>
                    <td className="py-2 pr-2 text-zinc-600">{row.beer_name || "—"}</td>
                    <td className="py-2 text-right">
                      <input
                        className="w-16 rounded border border-zinc-300 px-1 py-0.5 text-right tabular-nums"
                        type="number"
                        step="0.1"
                        min="0"
                        defaultValue={Number(row.points)}
                        key={`${row.id}-${row.points}`}
                        disabled={savingId === row.id}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next) || next === Number(row.points)) return;
                          savePoints(row, next);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(edition?.combined_matrix || edition?.beer_matrix || edition?.extra_matrix) && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["combined", "Sum of points"],
                    ["beer", "Beer points"],
                    ["extra", "Extra points"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`rounded-lg px-2 py-1 text-[11px] ${
                      matrixTab === key
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-300 bg-white text-zinc-700"
                    }`}
                    onClick={() => setMatrixTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {activeMatrix ? (
                <MatrixTable
                  matrix={activeMatrix}
                  title={
                    matrixTab === "combined"
                      ? `Sum of points (factor ${edition?.sum_factor ?? 0.5})`
                      : matrixTab === "beer"
                        ? "Beer points"
                        : "Extra points"
                  }
                />
              ) : (
                <p className="text-[11px] text-zinc-500">Ingen matrise for denne fanen.</p>
              )}
            </div>
          )}
        </>
      )}

      <div className="space-y-2 border-t border-zinc-100 pt-3">
        <p className="text-xs font-medium text-zinc-700">Arkiver årets live-resultater</p>
        <p className="text-[11px] text-zinc-500">
          Tar snapshot av nåværende poengstilling (krever avslørte resultater i lobby).
        </p>
        <div className="flex gap-2">
          <input
            className="w-24 rounded-lg border border-zinc-300 px-2 py-2 text-sm"
            value={archiveYear}
            onChange={(e) => setArchiveYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2026"
          />
          <button
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white active:opacity-90"
            onClick={archiveLive}
          >
            Arkiver podium ({liveStandings.length} deltakere)
          </button>
        </div>
      </div>
    </div>
  );
}
