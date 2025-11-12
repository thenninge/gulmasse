import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    const body = await request.json().catch(() => ({}));
    const pin = String(body?.pin || '');
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Invalid pin' }, { status: 400 });
    }
    const del = await supabase.from('participants').delete().eq('pin', pin);
    if (del.error) throw del.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


