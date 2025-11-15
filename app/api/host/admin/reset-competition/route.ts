import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // 1) Delete all votes and picks (history)
    const delVotes = await supabase.from('votes').delete().neq('pin', '');
    if (delVotes.error) throw delVotes.error;
    const delPicks = await supabase.from('picks').delete().neq('pin', '');
    if (delPicks.error) throw delPicks.error;

    // 2) Reset offsets to zero
    const resetOffsets = await (supabase.from('participants') as any)
      .update({ given_offset: 0, received_offset: 0 })
      .neq('pin', '');
    if (resetOffsets.error) throw resetOffsets.error;

    // 3) Clear app_state derived data
    // - remove all revealed pin lists
    const delRevealed = await supabase.from('app_state').delete().like('key', 'revealed_pins_round_%');
    if (delRevealed.error && (delRevealed.error as any).code !== 'PGRST116') throw delRevealed.error;
    // - remove pair offsets baseline
    const delPairOffsets = await supabase.from('app_state').delete().eq('key', 'pair_offsets');
    if (delPairOffsets.error && (delPairOffsets.error as any).code !== 'PGRST116') throw delPairOffsets.error;

    // 4) Reset control flags and round numbers
    const ups: Array<Promise<any>> = [];
    ups.push((supabase.from('app_state') as any).upsert({ key: 'current_round', int_value: 1 }, { onConflict: 'key' }));
    ups.push((supabase.from('app_state') as any).upsert({ key: 'reveal_results', bool_value: false }, { onConflict: 'key' }));
    ups.push((supabase.from('app_state') as any).upsert({ key: 'revealed_round', int_value: 0 }, { onConflict: 'key' }));
    ups.push((supabase.from('app_state') as any).upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' }));
    ups.push((supabase.from('app_state') as any).upsert({ key: 'round_started', bool_value: false }, { onConflict: 'key' }));
    ups.push((supabase.from('app_state') as any).upsert({ key: 'allow_reveal', bool_value: false }, { onConflict: 'key' }));
    // lock award ceremony
    ups.push((supabase.from('app_state') as any).upsert({ key: 'award_unlocked', bool_value: false }, { onConflict: 'key' }));
    const upAll = await Promise.all(ups);
    for (const r of upAll) {
      if (r.error) throw r.error;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


