import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { getDemoStore, isLocalDemo } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

const HOST_PIN = process.env.HOST_PIN || '0808';

/**
 * Clean slate for Gulmasse '26:
 * - Keeps year_editions / year_standings (historikk)
 * - Clears live votes, picks, and old participants
 * - Keeps host PIN and anyone already påmeldt to gulmasse-2026
 */
export async function POST(request: Request) {
  try {
    assertHost(request);

    if (isLocalDemo()) {
      const store = getDemoStore();
      store.participants = store.participants.filter((p) => p.pin === HOST_PIN);
      store.registrations = store.registrations.filter((r) => r.status === 'accepted');
      return NextResponse.json({
        ok: true,
        year: 2026,
        kept_pins: [HOST_PIN],
        deleted_participants: 0,
        message: "Gulmasse '26 er klar (demo) – live-data nullstilt. Historikk for '25 er beholdt.",
        demo: true,
      });
    }

    // 1) Clear live competition scores
    const delVotes = await supabase.from('votes').delete().neq('pin', '');
    if (delVotes.error) throw delVotes.error;
    const delPicks = await supabase.from('picks').delete().neq('pin', '');
    if (delPicks.error) throw delPicks.error;

    // 2) Which PINs to keep: host + accepted 2026 registrations
    const keepPins = new Set<string>([HOST_PIN]);
    try {
      const eventRes = await supabase
        .from('events')
        .select('id')
        .eq('slug', 'gulmasse-2026')
        .maybeSingle();
      if (!eventRes.error && eventRes.data) {
        const regs = await supabase
          .from('event_registrations')
          .select('participant_pin')
          .eq('event_id', (eventRes.data as { id: string }).id)
          .eq('status', 'accepted');
        if (!regs.error) {
          for (const row of (regs.data || []) as Array<{ participant_pin?: string | null }>) {
            if (row.participant_pin && /^\d{4}$/.test(row.participant_pin)) {
              keepPins.add(row.participant_pin);
            }
          }
        }
      }
    } catch {
      // events table may not exist yet — keep only host
    }

    // 3) Delete participants not in keep set
    const all = await supabase.from('participants').select('pin');
    if (all.error) throw all.error;
    const toDelete = ((all.data || []) as Array<{ pin: string }>)
      .map((p) => p.pin)
      .filter((pin) => !keepPins.has(pin));

    for (const pin of toDelete) {
      const del = await supabase.from('participants').delete().eq('pin', pin);
      if (del.error) throw del.error;
    }

    // 4) Reset offsets on remaining participants + clear beer profiles from last year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resetLeft = await (supabase.from('participants') as any)
      .update({
        given_offset: 0,
        received_offset: 0,
        beer_name: null,
        producer: null,
        beer_type: null,
        abv: null,
      })
      .neq('pin', '');
    if (resetLeft.error) throw resetLeft.error;

    // Keep host nickname if any; ensure host row exists
    const hostRow = await supabase.from('participants').select('pin').eq('pin', HOST_PIN).maybeSingle();
    if (hostRow.error && (hostRow.error as { code?: string }).code !== 'PGRST116') throw hostRow.error;
    if (!hostRow.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ins = await (supabase.from('participants') as any).insert({
        pin: HOST_PIN,
        nickname: 'Host',
        active: true,
      });
      if (ins.error) throw ins.error;
    }

    // 5) Clear derived app_state
    const delRevealed = await supabase.from('app_state').delete().like('key', 'revealed_pins_round_%');
    if (delRevealed.error && (delRevealed.error as { code?: string }).code !== 'PGRST116') {
      throw delRevealed.error;
    }
    const delPairOffsets = await supabase.from('app_state').delete().eq('key', 'pair_offsets');
    if (delPairOffsets.error && (delPairOffsets.error as { code?: string }).code !== 'PGRST116') {
      throw delPairOffsets.error;
    }

    // 6) Reset flags + point active year to 2026
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'logins_locked', bool_value: false }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert(
        { key: 'active_event_slug', text_value: 'gulmasse-2026' },
        { onConflict: 'key' },
      ),
    ]);
    for (const r of ups) {
      if (r.error) throw r.error;
    }

    // 7) Ensure event row is open for registration (if table exists)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('events') as any)
        .update({
          status: 'registration',
          registration_open: true,
          name: "Gulmasse '26",
          event_date: '2026-11-28',
        })
        .eq('slug', 'gulmasse-2026');
    } catch {
      // ignore if missing
    }

    return NextResponse.json({
      ok: true,
      year: 2026,
      kept_pins: Array.from(keepPins),
      deleted_participants: toDelete.length,
      message: "Gulmasse '26 er klar – live-poeng og gamle deltakere er nullstilt. Historikk for '25 er beholdt.",
    });
  } catch (e: unknown) {
    const status =
      typeof e === 'object' && e !== null && 'status' in e
        ? Number((e as { status?: number }).status) || 500
        : 500;
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status });
  }
}
