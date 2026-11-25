import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

/**
 * Safe "restart tonight's scoring":
 * - Deletes votes + picks
 * - Resets round flags
 * - KEEPS all participants and their beer profiles
 */
export async function POST(request: Request) {
  try {
    assertHost(request);
    const delVotes = await supabase.from('votes').delete().neq('pin', '');
    if (delVotes.error) throw delVotes.error;
    const delPicks = await supabase.from('picks').delete().neq('pin', '');
    if (delPicks.error) throw delPicks.error;

    // Clear derived reveal state, keep participants intact
    const delRevealed = await supabase.from('app_state').delete().like('key', 'revealed_pins_round_%');
    if (delRevealed.error && (delRevealed.error as { code?: string }).code !== 'PGRST116') {
      throw delRevealed.error;
    }
    const delPairOffsets = await supabase.from('app_state').delete().eq('key', 'pair_offsets');
    if (delPairOffsets.error && (delPairOffsets.error as { code?: string }).code !== 'PGRST116') {
      throw delPairOffsets.error;
    }

    // Reset offsets so lobby totals match empty votes (do not wipe beer fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resetOffsets = await (supabase.from('participants') as any)
      .update({ given_offset: 0, received_offset: 0 })
      .neq('pin', '');
    if (resetOffsets.error) throw resetOffsets.error;

    const ups = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'current_round', int_value: 1 }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'reveal_results', bool_value: false }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'revealed_round', int_value: 0 }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'round_started', bool_value: false }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'allow_reveal', bool_value: false }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'award_unlocked', bool_value: false }, { onConflict: 'key' }),
    ]);
    for (const r of ups) {
      if (r.error) throw r.error;
    }

    return NextResponse.json({
      ok: true,
      message: 'Kveldens poeng/utvalg er nullstilt. Deltakere og ølprofiler er beholdt.',
    });
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'status' in e
        ? Number((e as { status?: number }).status) || 500
        : 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
