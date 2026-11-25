import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

/** Clear all picks and unlock selection for a fresh draw. */
export async function POST(request: Request) {
  try {
    assertHost(request);
    const del = await supabase.from('picks').delete().neq('pin', ''); // delete all
    if (del.error) throw del.error;

    const up1 = await (supabase.from('app_state') as any)
      .upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' });
    if (up1.error) throw up1.error;
    const up2 = await (supabase.from('app_state') as any)
      .upsert({ key: 'round_started', bool_value: true }, { onConflict: 'key' });
    if (up2.error) throw up2.error;
    await (supabase.from('app_state') as any)
      .upsert({ key: 'allow_reveal', bool_value: false }, { onConflict: 'key' });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
