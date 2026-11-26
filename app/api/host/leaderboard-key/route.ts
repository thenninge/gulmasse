import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { ensureLeaderboardKey, setNewLeaderboardKey } from '@/lib/leaderboardKey';

function statusOf(e: unknown): number {
  return typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status?: number }).status) || 500 : 500;
}

/** Host: get (creating if needed) the secret leaderboard key. */
export async function GET(request: Request) {
  try {
    assertHost(request);
    return NextResponse.json({ key: await ensureLeaderboardKey() });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Server error' }, { status: statusOf(e) });
  }
}

/** Host: replace the key – the old link stops working immediately. */
export async function POST(request: Request) {
  try {
    assertHost(request);
    return NextResponse.json({ key: await setNewLeaderboardKey() });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Server error' }, { status: statusOf(e) });
  }
}
