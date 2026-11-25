import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';
import { conflict, countVotes, getIntState } from '@/lib/voteGuards';

/**
 * «Legg tilbake»: put back the beer drawn in the *current* round so the wheel
 * can be spun again. Refused once anyone has voted, so points never stay with a
 * beer that goes back on the wheel (it would be scored twice).
 */
export async function POST(request: Request) {
  try {
    assertHost(request);
    const round = await getIntState('current_round', 1);
    const pickedRound = await getIntState('picked_round', 0);
    if (pickedRound !== round) {
      return conflict('Ingen øl er trukket i denne runden – ingenting å legge tilbake.');
    }
    if ((await countVotes({ round })) > 0) {
      return conflict(
        'Det er allerede stemt i denne runden. Bruk «Reset stemmer» i Admin først hvis du virkelig vil trekke på nytt.',
      );
    }

    const lastRes = await supabase
      .from('picks')
      .select('id,pin,created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (lastRes.error) throw lastRes.error;
    const rows = (lastRes.data as Array<{ id: string; pin: string }>) || [];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, pin: null });
    }
    const last = rows[0];
    const del = await supabase.from('picks').delete().eq('id', last.id);
    if (del.error) throw del.error;
    // clear picked_round and mark round_started=true so pick is unlocked again
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('app_state') as any).upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('app_state') as any).upsert({ key: 'round_started', bool_value: true }, { onConflict: 'key' });
    return NextResponse.json({ ok: true, pin: last.pin });
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status?: number }).status) || 500 : 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
