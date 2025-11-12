import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // Determine current round
    const curr = await supabase.from('app_state').select('int_value').eq('key','current_round').maybeSingle();
    if (curr.error && curr.error.code !== 'PGRST116') throw curr.error;
    const round = Number((curr.data as any)?.int_value ?? 1);
    // Ensure not already revealed this round
    const rr = await supabase.from('app_state').select('int_value').eq('key','revealed_round').maybeSingle();
    if (rr.error && rr.error.code !== 'PGRST116') throw rr.error;
    const revealedRound = Number((rr.data as any)?.int_value ?? 0);
    if (revealedRound === round) {
      return NextResponse.json({ error: 'Already revealed this round' }, { status: 409 });
    }
    const up1 = await (supabase.from('app_state') as any)
      .upsert({ key: 'reveal_results', bool_value: true }, { onConflict: 'key' });
    if (up1.error) throw up1.error;
    const up2 = await (supabase.from('app_state') as any)
      .upsert({ key: 'revealed_round', int_value: round }, { onConflict: 'key' });
    if (up2.error) throw up2.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


