import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';
import { conflict, countVotes } from '@/lib/voteGuards';

/** Reset round counter and unlock picking (does not delete picks/votes). */
export async function POST(request: Request) {
  try {
    assertHost(request);
    // Round numbers key the votes (unique round+pin): restarting the counter with
    // votes stored would overwrite earlier rounds' votes.
    if ((await countVotes()) > 0) {
      return conflict(
        'Det finnes allerede stemmer. Rundenummer kan ikke nullstilles uten å overskrive dem – bruk «Ny konkurranse» hvis alt skal startes på nytt.',
      );
    }
    const { error: e1 } = await (supabase.from('app_state') as any)
      .upsert({ key: 'current_round', int_value: 0 }, { onConflict: 'key' });
    if (e1) throw e1;
    const { error: e2 } = await (supabase.from('app_state') as any)
      .upsert({ key: 'reveal_results', bool_value: false }, { onConflict: 'key' });
    if (e2) throw e2;
    // Avoid picked_round === current_round (both 0) which blocks all picks
    const { error: e3 } = await (supabase.from('app_state') as any)
      .upsert({ key: 'picked_round', int_value: -1 }, { onConflict: 'key' });
    if (e3) throw e3;
    const { error: e4 } = await (supabase.from('app_state') as any)
      .upsert({ key: 'round_started', bool_value: true }, { onConflict: 'key' });
    if (e4) throw e4;
    const { error: e5 } = await (supabase.from('app_state') as any)
      .upsert({ key: 'revealed_round', int_value: 0 }, { onConflict: 'key' });
    if (e5) throw e5;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
