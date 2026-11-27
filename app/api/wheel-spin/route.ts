import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * The official wheel just started spinning – lets the Live Leaderboard show
 * «Nå snurrer hjulet!!». Only recorded while a pick is actually possible.
 */
export async function POST() {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('key,int_value,bool_value')
      .in('key', ['current_round', 'picked_round', 'round_started']);
    if (error) throw error;
    const st = new Map(((data as Array<{ key: string; int_value: number | null; bool_value: boolean | null }>) || []).map((r) => [r.key, r]));
    const round = Number(st.get('current_round')?.int_value ?? 1);
    const picked = Number(st.get('picked_round')?.int_value ?? 0);
    if (st.get('round_started')?.bool_value !== true || picked === round) return NextResponse.json({ ok: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same untyped upsert as the other routes
    const up = await (supabase.from('app_state') as any).upsert({ key: 'wheel_spin_at', text_value: new Date().toISOString() }, { onConflict: 'key' });
    if (up.error) throw up.error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('WHEEL_SPIN_ERROR', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
