import { z } from 'zod';
import { getDemoStore, isLocalDemo } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';
import {
  YEAR_2025_BEER,
  YEAR_2025_COMBINED,
  YEAR_2025_EXTRA,
  YEAR_2025_STANDINGS,
  type ScoreMatrix,
} from '@/lib/year2025';

export type YearEdition = {
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

export type YearStanding = {
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

export const standingPatchSchema = z.object({
  id: z.string().min(1),
  rank: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  beer_name: z.string().trim().max(120).optional().nullable(),
  producer: z.string().trim().max(120).optional().nullable(),
  beer_type: z.string().trim().max(80).optional().nullable(),
  abv: z.number().min(0).max(100).optional().nullable(),
  points: z.number().min(0).optional(),
  given_points: z.number().min(0).optional(),
  is_winner: z.boolean().optional(),
});

export const archiveBodySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  name: z.string().trim().min(1).max(80).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  standings: z
    .array(
      z.object({
        rank: z.number().int().positive(),
        name: z.string().trim().min(1).max(80),
        beer_name: z.string().trim().max(120).optional().nullable(),
        producer: z.string().trim().max(120).optional().nullable(),
        beer_type: z.string().trim().max(80).optional().nullable(),
        abv: z.number().min(0).max(100).optional().nullable(),
        points: z.number().min(0),
        given_points: z.number().min(0).optional(),
        is_winner: z.boolean().optional(),
      }),
    )
    .min(1),
  beer_matrix: z.any().optional().nullable(),
  extra_matrix: z.any().optional().nullable(),
  combined_matrix: z.any().optional().nullable(),
  sum_factor: z.number().optional().nullable(),
});

type DemoEdition = YearEdition & { standings: YearStanding[] };

function demoHistory(): DemoEdition[] {
  const store = getDemoStore() as ReturnType<typeof getDemoStore> & {
    history?: DemoEdition[];
    historyVersion?: number;
  };
  // Bump when canonical 2025 seed changes
  if (!store.history || store.historyVersion !== 2) {
    const editionId = '00000000-0000-4000-8000-000000002025';
    store.historyVersion = 2;
    store.history = [
      {
        id: editionId,
        year: 2025,
        name: "Gulmasse '25",
        event_date: '2025-12-13',
        notes: 'Endelig stilling – Martin vant med Postludium (43.5). Factor (extra) = 0.5.',
        sum_factor: 0.5,
        beer_matrix: YEAR_2025_BEER,
        extra_matrix: YEAR_2025_EXTRA,
        combined_matrix: YEAR_2025_COMBINED,
        standings: YEAR_2025_STANDINGS.map((s) => ({
          id: `2025-standing-${s.rank}`,
          edition_id: editionId,
          rank: s.rank,
          name: s.name,
          beer_name: s.beer_name,
          producer: null,
          beer_type: null,
          abv: null,
          points: s.points,
          given_points: s.given_points,
          is_winner: s.is_winner,
        })),
      },
    ];
  }
  return store.history;
}

function mapEditionRow(row: Record<string, unknown>): YearEdition {
  return {
    id: String(row.id),
    year: Number(row.year),
    name: String(row.name),
    event_date: (row.event_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    sum_factor: row.sum_factor == null ? null : Number(row.sum_factor),
    beer_matrix: (row.beer_matrix as ScoreMatrix | null) ?? null,
    extra_matrix: (row.extra_matrix as ScoreMatrix | null) ?? null,
    combined_matrix: (row.combined_matrix as ScoreMatrix | null) ?? null,
  };
}

export async function listEditions(): Promise<YearEdition[]> {
  if (isLocalDemo()) {
    return demoHistory().map((e) => ({
      id: e.id,
      year: e.year,
      name: e.name,
      event_date: e.event_date,
      notes: e.notes,
      sum_factor: e.sum_factor ?? null,
    }));
  }
  const res = await supabase
    .from('year_editions')
    .select('id,year,name,event_date,notes,sum_factor')
    .order('year', { ascending: false });
  if (res.error) throw res.error;
  return ((res.data || []) as Record<string, unknown>[]).map(mapEditionRow);
}

export async function getEditionStandings(editionId: string): Promise<{
  edition: YearEdition | null;
  standings: YearStanding[];
}> {
  if (isLocalDemo()) {
    const edition = demoHistory().find((e) => e.id === editionId) || null;
    if (!edition) return { edition: null, standings: [] };
    const { standings, ...meta } = edition;
    return {
      edition: meta,
      standings: [...standings].sort((a, b) => a.rank - b.rank),
    };
  }

  const ed = await supabase
    .from('year_editions')
    .select('id,year,name,event_date,notes,sum_factor,beer_matrix,extra_matrix,combined_matrix')
    .eq('id', editionId)
    .maybeSingle();
  if (ed.error) throw ed.error;
  if (!ed.data) return { edition: null, standings: [] };

  const st = await supabase
    .from('year_standings')
    .select(
      'id,edition_id,rank,name,beer_name,producer,beer_type,abv,points,given_points,is_winner',
    )
    .eq('edition_id', editionId)
    .order('rank', { ascending: true });
  if (st.error) throw st.error;

  return {
    edition: mapEditionRow(ed.data as Record<string, unknown>),
    standings: ((st.data || []) as YearStanding[]).map((row) => ({
      ...row,
      points: Number(row.points),
      given_points: Number(row.given_points),
      abv: row.abv == null ? null : Number(row.abv),
    })),
  };
}

export async function patchStanding(
  parsed: z.infer<typeof standingPatchSchema>,
): Promise<YearStanding> {
  if (isLocalDemo()) {
    for (const edition of demoHistory()) {
      const row = edition.standings.find((s) => s.id === parsed.id);
      if (!row) continue;
      if (parsed.rank !== undefined) row.rank = parsed.rank;
      if (parsed.name !== undefined) row.name = parsed.name;
      if (parsed.beer_name !== undefined) row.beer_name = parsed.beer_name;
      if (parsed.producer !== undefined) row.producer = parsed.producer;
      if (parsed.beer_type !== undefined) row.beer_type = parsed.beer_type;
      if (parsed.abv !== undefined) row.abv = parsed.abv;
      if (parsed.points !== undefined) row.points = parsed.points;
      if (parsed.given_points !== undefined) row.given_points = parsed.given_points;
      if (parsed.is_winner !== undefined) {
        if (parsed.is_winner) {
          edition.standings.forEach((s) => {
            s.is_winner = s.id === row.id;
          });
        } else {
          row.is_winner = false;
        }
      }
      edition.standings
        .slice()
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
        .forEach((s, idx) => {
          s.rank = idx + 1;
          s.is_winner = idx === 0;
        });
      return { ...row };
    }
    throw Object.assign(new Error('Ikke funnet'), { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.rank !== undefined) update.rank = parsed.rank;
  if (parsed.name !== undefined) update.name = parsed.name;
  if (parsed.beer_name !== undefined) update.beer_name = parsed.beer_name;
  if (parsed.producer !== undefined) update.producer = parsed.producer;
  if (parsed.beer_type !== undefined) update.beer_type = parsed.beer_type;
  if (parsed.abv !== undefined) update.abv = parsed.abv;
  if (parsed.points !== undefined) update.points = parsed.points;
  if (parsed.given_points !== undefined) update.given_points = parsed.given_points;
  if (parsed.is_winner !== undefined) update.is_winner = parsed.is_winner;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upd = await (supabase.from('year_standings') as any)
    .update(update)
    .eq('id', parsed.id)
    .select(
      'id,edition_id,rank,name,beer_name,producer,beer_type,abv,points,given_points,is_winner',
    )
    .single();
  if (upd.error) throw upd.error;
  return {
    ...upd.data,
    points: Number(upd.data.points),
    given_points: Number(upd.data.given_points),
    abv: upd.data.abv == null ? null : Number(upd.data.abv),
  } as YearStanding;
}

export async function archiveEdition(
  body: z.infer<typeof archiveBodySchema>,
): Promise<{ edition: YearEdition; standings: YearStanding[] }> {
  const name = body.name || `Gulmasse '${String(body.year).slice(-2)}`;

  if (isLocalDemo()) {
    const history = demoHistory();
    if (history.some((e) => e.year === body.year)) {
      throw Object.assign(new Error(`År ${body.year} er allerede arkivert`), { status: 409 });
    }
    const editionId = `demo-year-${body.year}`;
    const edition: DemoEdition = {
      id: editionId,
      year: body.year,
      name,
      event_date: null,
      notes: body.notes ?? null,
      sum_factor: body.sum_factor ?? 0.5,
      beer_matrix: (body.beer_matrix as ScoreMatrix | null) ?? null,
      extra_matrix: (body.extra_matrix as ScoreMatrix | null) ?? null,
      combined_matrix: (body.combined_matrix as ScoreMatrix | null) ?? null,
      standings: body.standings.map((s, i) => ({
        id: `${editionId}-${i + 1}`,
        edition_id: editionId,
        rank: s.rank,
        name: s.name,
        beer_name: s.beer_name ?? null,
        producer: s.producer ?? null,
        beer_type: s.beer_type ?? null,
        abv: s.abv ?? null,
        points: s.points,
        given_points: s.given_points ?? 0,
        is_winner: s.is_winner ?? s.rank === 1,
      })),
    };
    history.unshift(edition);
    const { standings, ...meta } = edition;
    return { edition: meta, standings };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edIns = await (supabase.from('year_editions') as any)
    .insert({
      year: body.year,
      name,
      notes: body.notes ?? null,
      sum_factor: body.sum_factor ?? 0.5,
      beer_matrix: body.beer_matrix ?? null,
      extra_matrix: body.extra_matrix ?? null,
      combined_matrix: body.combined_matrix ?? null,
    })
    .select('id,year,name,event_date,notes,sum_factor,beer_matrix,extra_matrix,combined_matrix')
    .single();
  if (edIns.error) {
    if ((edIns.error as { code?: string }).code === '23505') {
      throw Object.assign(new Error(`År ${body.year} er allerede arkivert`), { status: 409 });
    }
    throw edIns.error;
  }

  const rows = body.standings.map((s) => ({
    edition_id: edIns.data.id,
    rank: s.rank,
    name: s.name,
    beer_name: s.beer_name ?? null,
    producer: s.producer ?? null,
    beer_type: s.beer_type ?? null,
    abv: s.abv ?? null,
    points: s.points,
    given_points: s.given_points ?? 0,
    is_winner: s.is_winner ?? s.rank === 1,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stIns = await (supabase.from('year_standings') as any)
    .insert(rows)
    .select(
      'id,edition_id,rank,name,beer_name,producer,beer_type,abv,points,given_points,is_winner',
    )
    .order('rank', { ascending: true });
  if (stIns.error) throw stIns.error;

  return {
    edition: mapEditionRow(edIns.data as Record<string, unknown>),
    standings: ((stIns.data || []) as YearStanding[]).map((row) => ({
      ...row,
      points: Number(row.points),
      given_points: Number(row.given_points),
      abv: row.abv == null ? null : Number(row.abv),
    })),
  };
}
