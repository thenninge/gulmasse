import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // Sum given per pin
    const votesAllRes = await supabase.from('votes').select('pin,value');
    if (votesAllRes.error) throw votesAllRes.error;
    const givenTotals: Record<string, number> = {};
    for (const r of ((votesAllRes.data as any[]) || [])) {
      const p = String(r.pin || '');
      const v = Number(r.value) || 0;
      if (!p) continue;
      givenTotals[p] = (givenTotals[p] ?? 0) + v;
    }
    // Update participants.given_offset
    for (const [pin, total] of Object.entries(givenTotals)) {
      const { error } = await (supabase.from('participants') as any)
        .update({ given_offset: total })
        .eq('pin', pin);
      if (error) throw error;
    }
    // Build pair offsets baseline so "Full oversikt" resets to zero
    const pairsRes = await supabase.from('votes').select('pin,recipient_pin,value');
    if (pairsRes.error) throw pairsRes.error;
    const pairAgg: Record<string, number> = {};
    for (const r of ((pairsRes.data as any[]) || [])) {
      const from = String(r.pin || '');
      const to = String((r as any).recipient_pin || '');
      if (!from || !to) continue;
      const key = `${from}|${to}`;
      pairAgg[key] = (pairAgg[key] ?? 0) + (Number(r.value) || 0);
    }
    const { error: upErr } = await (supabase.from('app_state') as any)
      .upsert({ key: 'pair_offsets', text_value: JSON.stringify(pairAgg) }, { onConflict: 'key' });
    if (upErr) throw upErr;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
