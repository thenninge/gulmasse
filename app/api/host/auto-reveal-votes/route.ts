import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';
import { getIntState } from '@/lib/voteGuards';
import { revealAllVotesInRound } from '@/lib/revealRound';

/**
 * «Auto-avslør stemmer» ON/OFF: while ON, every vote is revealed the moment it
 * is locked (done server-side in /api/vote). Switching ON also reveals the
 * votes already cast in the current round.
 */
export async function POST(request: Request) {
  try {
    assertHost(request);
    const body = (await request.json().catch(() => ({}))) as { on?: unknown };
    if (typeof body.on !== 'boolean') {
      return NextResponse.json({ error: 'Mangler on: true/false' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const up = await (supabase.from('app_state') as any).upsert(
      { key: 'auto_reveal_votes', bool_value: body.on },
      { onConflict: 'key' },
    );
    if (up.error) throw up.error;
    if (body.on) await revealAllVotesInRound(await getIntState('current_round', 1));
    return NextResponse.json({ ok: true, on: body.on });
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status?: number }).status) || 500 : 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
