import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import {
  archiveBodySchema,
  archiveEdition,
  getEditionStandings,
  listEditions,
  patchStanding,
  standingPatchSchema,
} from '@/lib/history';

function statusCode(e: unknown): number {
  if (typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: unknown }).status === 'number') {
    return (e as { status: number }).status;
  }
  return 500;
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
      return NextResponse.json({ editions: [], edition: null, standings: [] });
    }
    const detail = await getEditionStandings(first.id);
    return NextResponse.json({ editions, ...detail });
  } catch (e: unknown) {
    const status = statusCode(e);
    const msg = e instanceof Error && status !== 500 ? e.message : status === 401 ? 'Unauthorized' : 'Server error';
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    assertHost(request);
    const body = await request.json();
    const parsed = archiveBodySchema.parse(body);
    const result = await archiveEdition(parsed);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const status = hasIssues ? 400 : statusCode(e);
    const msg = hasIssues
      ? 'Ugyldig forespørsel'
      : e instanceof Error && status !== 500
        ? e.message
        : status === 401
          ? 'Unauthorized'
          : 'Server error';
    return NextResponse.json({ error: msg }, { status });
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
    const msg = hasIssues
      ? 'Ugyldig forespørsel'
      : e instanceof Error && status !== 500
        ? e.message
        : status === 401
          ? 'Unauthorized'
          : 'Server error';
    return NextResponse.json({ error: msg }, { status });
  }
}
