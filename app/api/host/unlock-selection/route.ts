import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';
import { conflict, countVotes, getIntState } from '@/lib/voteGuards';

/**
 * Re-open picking for the current round:
 * - clear picked_round so /api/pick no longer returns "Already picked"
 * - set round_started so lobby unlocks "Finn en utvalgt"
 * - remove the latest pick so that person can be drawn again
 */
export async function POST(request: Request) {
  try {
    assertHost(request);

    const round = await getIntState('current_round', 1);
    const pickedRound = await getIntState('picked_round', 0);
    const pickedThisRound = pickedRound === round;

    // Never undo a pick that already has votes: those points would stay with
    // the beer and it could be drawn (and scored) a second time.
    if (pickedThisRound && (await countVotes({ round })) > 0) {
      return conflict(
        'Det er allerede stemt i denne runden. Bruk «Reset stemmer» først hvis du virkelig vil trekke på nytt.',
      );
    }

    const lastRes = await supabase
      .from('picks')
      .select('id,pin,created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (lastRes.error) throw lastRes.error;
    const rows = (lastRes.data as any[]) || [];
    let undonePin: string | null = null;
    // Only put back a pick made in *this* round (never last round's beer)
    if (pickedThisRound && rows.length > 0) {
      const last = rows[0] as any;
      const del = await supabase.from('picks').delete().eq('id', last.id);
      if (del.error) throw del.error;
      undonePin = last.pin as string;
    }

    const up1 = await (supabase.from('app_state') as any)
      .upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' });
    if (up1.error) throw up1.error;
    const up2 = await (supabase.from('app_state') as any)
      .upsert({ key: 'round_started', bool_value: true }, { onConflict: 'key' });
    if (up2.error) throw up2.error;
    // Keep reveal locked until voting completes again
    await (supabase.from('app_state') as any)
      .upsert({ key: 'allow_reveal', bool_value: false }, { onConflict: 'key' });

    return NextResponse.json({ ok: true, pin: undonePin });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
