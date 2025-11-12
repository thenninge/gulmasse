import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    const { error: e1 } = await (supabase.from('app_state') as any)
      .upsert({ key: 'current_round', int_value: 0 }, { onConflict: 'key' });
    if (e1) throw e1;
    const { error: e2 } = await (supabase.from('app_state') as any)
      .upsert({ key: 'reveal_results', bool_value: false }, { onConflict: 'key' });
    if (e2) throw e2;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


