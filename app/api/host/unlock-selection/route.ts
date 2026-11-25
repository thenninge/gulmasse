import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

/**
 * Re-open picking for the current round:
 * - clear picked_round so /api/pick no longer returns "Already picked"
 * - set round_started so lobby unlocks "Finn en utvalgt"
 * - remove the latest pick so that person can be drawn again
 */
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
    let undonePin: string | null = null;
    if (rows.length > 0) {
      const last = rows[0] as any;
      const del = await supabase.from('picks').delete().eq('id', last.id);
      if (del.error) throw del.error;
      undonePin = last.pin as string;
    }

    const up1 = await (supabase.from('app_state') as any)
      .upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' });
    if (up1.error) throw up1.error;
    const up2 = await (supabase.from('app_state') as any)
      .upsert({ key: 'round_started', bool_value: true }, { onConflict: 'key' });
    if (up2.error) throw up2.error;
    // Keep reveal locked until voting completes again
    await (supabase.from('app_state') as any)
      .upsert({ key: 'allow_reveal', bool_value: false }, { onConflict: 'key' });

    return NextResponse.json({ ok: true, pin: undonePin });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
