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
    // Votes already cast this round belonged to the undone pick: remove them so
    // nobody is locked out of voting for the re-picked beer and no points stick
    // to the beer that was put back.
    const roundRes = await supabase.from('app_state').select('int_value').eq('key', 'current_round').maybeSingle();
    if (roundRes.error && roundRes.error.code !== 'PGRST116') throw roundRes.error;
    const round = Number((roundRes.data as { int_value?: number } | null)?.int_value ?? 1);
    const delVotes = await supabase.from('votes').delete().eq('round', round);
    if (delVotes.error) throw delVotes.error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('app_state') as any).upsert({ key: `revealed_pins_round_${round}`, text_value: '[]' }, { onConflict: 'key' });
    // clear picked_round and mark round_started=true so pick is unlocked again
    await (supabase.from('app_state') as any).upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' });
    await (supabase.from('app_state') as any).upsert({ key: 'round_started', bool_value: true }, { onConflict: 'key' });
    return NextResponse.json({ ok: true, pin: last.pin as string });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


