import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    const lastRes = await supabase
      .from('picks')
      .select('id,pin,created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (lastRes.error) throw lastRes.error;
    const rows = (lastRes.data as any[]) || [];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, pin: null });
    }
    const last = rows[0] as any;
    const del = await supabase.from('picks').delete().eq('id', last.id);
    if (del.error) throw del.error;
    // clear picked_round so next pick is allowed this round
    await (supabase.from('app_state') as any).upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' });
    return NextResponse.json({ ok: true, pin: last.pin as string });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


