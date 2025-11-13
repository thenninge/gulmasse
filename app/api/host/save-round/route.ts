import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // Mark current round as revealed/saved
    const curr = await supabase.from('app_state').select('int_value').eq('key', 'current_round').maybeSingle();
    if (curr.error && (curr.error as any).code !== 'PGRST116') throw curr.error;
    const round = Number(((curr.data as any)?.int_value) ?? 1);
    const up1 = await (supabase.from('app_state') as any).upsert(
      { key: 'revealed_round', int_value: round },
      { onConflict: 'key' }
    );
    if (up1.error) throw up1.error;
    // Disable allow_reveal after saving
    const up2 = await (supabase.from('app_state') as any).upsert(
      { key: 'allow_reveal', bool_value: false },
      { onConflict: 'key' }
    );
    if (up2.error) throw up2.error;
    return NextResponse.json({ ok: true, round });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


