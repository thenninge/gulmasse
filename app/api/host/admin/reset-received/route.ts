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


