import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // increment current_round and reset reveal_results
    const curr = await supabase.from('app_state').select('int_value').eq('key','current_round').maybeSingle();
    if (curr.error && curr.error.code !== 'PGRST116') throw curr.error;
    const nextRound = Number(curr.data?.int_value ?? 1) + 1;
    const up1 = await supabase.from('app_state').upsert({ key: 'current_round', int_value: nextRound });
    if (up1.error) throw up1.error;
    const up2 = await supabase.from('app_state').upsert({ key: 'reveal_results', bool_value: false });
    if (up2.error) throw up2.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


