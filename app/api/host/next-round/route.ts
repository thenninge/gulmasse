import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // increment current_round and reset reveal_results
    const curr = await supabase.from('app_state').select('int_value').eq('key','current_round').maybeSingle();
    if (curr.error && curr.error.code !== 'PGRST116') throw curr.error;
    const nextRound = Number((curr.data as any)?.int_value ?? 1) + 1;
    const { error: err1 } = await (supabase
      .from('app_state') as any).upsert({ key: 'current_round', int_value: nextRound }, { onConflict: 'key' });
    if (err1) throw err1;
    const { error: err2 } = await (supabase
      .from('app_state') as any).upsert({ key: 'reveal_results', bool_value: false }, { onConflict: 'key' });
    if (err2) throw err2;
    const { error: err3 } = await (supabase
      .from('app_state') as any).upsert({ key: 'revealed_round', int_value: 0 }, { onConflict: 'key' });
    if (err3) throw err3;
    const { error: err4 } = await (supabase
      .from('app_state') as any).upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' });
    if (err4) throw err4;
    const { error: err5 } = await (supabase
      .from('app_state') as any).upsert({ key: 'round_started', bool_value: true }, { onConflict: 'key' });
    if (err5) throw err5;
    const { error: err6 } = await (supabase
      .from('app_state') as any).upsert({ key: 'allow_reveal', bool_value: false }, { onConflict: 'key' });
    if (err6) throw err6;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


