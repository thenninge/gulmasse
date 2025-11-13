import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // current round
    const roundRes = await supabase.from('app_state').select('int_value').eq('key','current_round').maybeSingle();
    if (roundRes.error && (roundRes.error as any).code !== 'PGRST116') throw roundRes.error;
    const round = Number(((roundRes.data as any)?.int_value) ?? 1);
    // delete votes for this round
    const del = await supabase.from('votes').delete().eq('round', round);
    if (del.error) throw del.error;
    // clear any per-user revealed votes store for this round
    const key = `revealed_pins_round_${round}`;
    await (supabase.from('app_state') as any).upsert({ key, text_value: '[]' }, { onConflict: 'key' });
    // also clear reveal_results flag for safety
    await (supabase.from('app_state') as any).upsert({ key: 'reveal_results', bool_value: false }, { onConflict: 'key' });
    return NextResponse.json({ ok: true, round });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


