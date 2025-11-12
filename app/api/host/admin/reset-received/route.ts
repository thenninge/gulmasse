import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // Sum received per recipient_pin
    const votesRecvRes = await supabase.from('votes').select('recipient_pin,value');
    if (votesRecvRes.error) throw votesRecvRes.error;
    const recvTotals: Record<string, number> = {};
    for (const r of ((votesRecvRes.data as any[]) || [])) {
      const p = String((r as any).recipient_pin || '');
      const v = Number((r as any).value) || 0;
      if (!p) continue;
      recvTotals[p] = (recvTotals[p] ?? 0) + v;
    }
    // Update participants.received_offset
    for (const [pin, total] of Object.entries(recvTotals)) {
      const { error } = await (supabase.from('participants') as any)
        .update({ received_offset: total })
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

import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // Sum received per pin
    const sums = await supabase.from('votes').select('recipient_pin,value');
    if (sums.error) throw sums.error;
    const map: Record<string, number> = {};
    for (const r of (sums.data as any[]) || []) {
      const pin = String((r as any).recipient_pin || '');
      if (!pin) continue;
      const v = Number((r as any).value) || 0;
      map[pin] = (map[pin] ?? 0) + v;
    }
    // Update offsets
    const participants = await supabase.from('participants').select('pin');
    if (participants.error) throw participants.error;
    for (const p of (participants.data as any[]) || []) {
      const pin = String(p.pin);
      const off = map[pin] ?? 0;
      const upd = await (supabase.from('participants') as any)
        .update({ received_offset: off })
        .eq('pin', pin);
      if (upd.error) throw upd.error;
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


