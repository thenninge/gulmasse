import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import {
  archiveBodySchema,
  archiveEdition,
  getEditionStandings,
  listEditions,
  patchStanding,
  seedOfficial2025,
  standingPatchSchema,
} from '@/lib/history';

function statusCode(e: unknown): number {
  if (typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: unknown }).status === 'number') {
    return (e as { status: number }).status;
  }
  return 500;
}

function errorMessage(e: unknown, status: number): string {
  if (typeof e === 'object' && e !== null && 'issues' in e) return 'Ugyldig forespørsel';
  if (e instanceof Error && e.message) return e.message;
  if (status === 401) return 'Unauthorized';
  return 'Server error';
}

export async function GET(request: Request) {
  try {
    assertHost(request);
    const url = new URL(request.url);
    const editionId = url.searchParams.get('editionId');
    const editions = await listEditions();

    if (editionId) {
      const detail = await getEditionStandings(editionId);
      return NextResponse.json({ editions, ...detail });
    }

    const first = editions[0];
    if (!first) {
      return NextResponse.json({
        editions: [],
        edition: null,
        standings: [],
        hint: "Ingen historikk ennå. Kjør db/supabase_invite_setup.sql i Supabase, deretter «Importer Gulmasse '25».",
      });
    }
    const detail = await getEditionStandings(first.id);
    return NextResponse.json({ editions, ...detail });
  } catch (e: unknown) {
    const status = statusCode(e);
    return NextResponse.json({ error: errorMessage(e, status) }, { status });
  }
}

export async function POST(request: Request) {
  try {
    assertHost(request);
    const body = await request.json();

    if (
      body &&
      typeof body === 'object' &&
      'action' in body &&
      (body as { action?: unknown }).action === 'seed_2025'
    ) {
      const result = await seedOfficial2025();
      return NextResponse.json({
        ok: true,
        ...result,
        message: "Gulmasse '25 er importert (Martin 43.5, Tomas 42.5, …).",
      });
    }

    const parsed = archiveBodySchema.parse(body);
    const result = await archiveEdition(parsed);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const status = hasIssues ? 400 : statusCode(e);
    return NextResponse.json({ error: errorMessage(e, status) }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    assertHost(request);
    const body = await request.json();
    const parsed = standingPatchSchema.parse(body);
    const standing = await patchStanding(parsed);
    return NextResponse.json({ ok: true, standing });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const status = hasIssues ? 400 : statusCode(e);
    return NextResponse.json({ error: errorMessage(e, status) }, { status });
  }
}
