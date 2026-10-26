import { z } from 'zod';
import { getDemoStore, isLocalDemo } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

export type YearEdition = {
  id: string;
  year: number;
  name: string;
  event_date: string | null;
  notes: string | null;
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
  id: z.string().uuid(),
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
});

type DemoEdition = YearEdition & { standings: YearStanding[] };

function demoHistory(): DemoEdition[] {
  const store = getDemoStore() as ReturnType<typeof getDemoStore> & {
    history?: DemoEdition[];
  };
  if (!store.history) {
    const editionId = '00000000-0000-4000-8000-000000002025';
    const names = [
      'Magnus',
      'Kathinka',
      'Tomas',
      'Eirik',
      'Adam',
      'Martin',
      'Konrad',
      'Roald',
    ];
    store.history = [
      {
        id: editionId,
        year: 2025,
        name: "Gulmasse '25",
        event_date: '2025-12-13',
        notes: 'Christmas Beer Competition 2025 – fyll inn poeng i admin',
        standings: names.map((name, i) => ({
          id: `2025-standing-${i + 1}`,
          edition_id: editionId,
          rank: i + 1,
          name,
          beer_name: null,
          producer: null,
          beer_type: null,
          abv: null,
          points: 0,
          given_points: 0,
          is_winner: i === 0,
        })),
      },
    ];
  }
  return store.history;
}

export async function listEditions(): Promise<YearEdition[]> {
  if (isLocalDemo()) {
    return demoHistory().map((e) => ({
      id: e.id,
      year: e.year,
      name: e.name,
      event_date: e.event_date,
      notes: e.notes,
    }));
  }
  const res = await supabase
    .from('year_editions')
    .select('id,year,name,event_date,notes')
    .order('year', { ascending: false });
  if (res.error) throw res.error;
  return (res.data || []) as YearEdition[];
}

export async function getEditionStandings(editionId: string): Promise<{
  edition: YearEdition | null;
  standings: YearStanding[];
}> {
  if (isLocalDemo()) {
    const edition = demoHistory().find((e) => e.id === editionId) || null;
    return {
      edition: edition
        ? {
            id: edition.id,
            year: edition.year,
            name: edition.name,
            event_date: edition.event_date,
            notes: edition.notes,
          }
        : null,
      standings: edition ? [...edition.standings].sort((a, b) => a.rank - b.rank) : [],
    };
  }

  const ed = await supabase
    .from('year_editions')
    .select('id,year,name,event_date,notes')
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
    edition: ed.data as YearEdition,
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
      // Re-rank by points after edits
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
    return {
      edition: {
        id: edition.id,
        year: edition.year,
        name: edition.name,
        event_date: edition.event_date,
        notes: edition.notes,
      },
      standings: edition.standings,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edIns = await (supabase.from('year_editions') as any)
    .insert({
      year: body.year,
      name,
      notes: body.notes ?? null,
    })
    .select('id,year,name,event_date,notes')
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
    edition: edIns.data as YearEdition,
    standings: ((stIns.data || []) as YearStanding[]).map((row) => ({
      ...row,
      points: Number(row.points),
      given_points: Number(row.given_points),
      abv: row.abv == null ? null : Number(row.abv),
    })),
  };
}
