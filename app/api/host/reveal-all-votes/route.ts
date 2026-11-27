import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { getIntState } from '@/lib/voteGuards';
import { revealAllVotesInRound } from '@/lib/revealRound';

/** Host: reveal every vote cast so far in the current round (can be pressed repeatedly). */
export async function POST(request: Request) {
  try {
    assertHost(request);
    const round = await getIntState('current_round', 1);
    await revealAllVotesInRound(round);
    return NextResponse.json({ ok: true, round });
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status?: number }).status) || 500 : 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
