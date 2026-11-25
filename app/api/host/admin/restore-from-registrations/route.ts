import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { getActiveEvent, getEventBySlug } from '@/lib/events';
import { isLocalDemo, getDemoStore } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

/**
 * After an accidental live wipe: recreate participants from accepted
 * Gulmasse '26 registrations that no longer have a live PIN.
 * Does NOT touch year_standings / '25 history.
 */
async function freePin(exclude: Set<string>): Promise<string | null> {
  for (let i = 0; i < 40; i++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    if (exclude.has(pin)) continue;
    const exists = await supabase.from('participants').select('pin').eq('pin', pin).maybeSingle();
    if (exists.error && (exists.error as { code?: string }).code !== 'PGRST116') throw exists.error;
    if (!exists.data) return pin;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    assertHost(request);

    if (isLocalDemo()) {
      const store = getDemoStore();
      return NextResponse.json({
        ok: true,
        demo: true,
        restored: [],
        already_linked: store.registrations.filter((r) => r.status === 'accepted' && r.participant_pin).length,
        message: 'Demo: ingen gjenoppretting nødvendig',
      });
    }

    const event =
      (await getEventBySlug('gulmasse-2026')) || (await getActiveEvent());
    if (!event) {
      return NextResponse.json({ error: 'Finner ikke gulmasse-2026 event' }, { status: 404 });
    }

    const regs = await supabase
      .from('event_registrations')
      .select('id,name,status,participant_pin')
      .eq('event_id', event.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: true });
    if (regs.error) throw regs.error;

    const rows = (regs.data || []) as Array<{
      id: string;
      name: string;
      status: string;
      participant_pin: string | null;
    }>;

    const existingPins = await supabase.from('participants').select('pin,nickname');
    if (existingPins.error) throw existingPins.error;
    const pinSet = new Set(
      ((existingPins.data || []) as Array<{ pin: string }>).map((p) => p.pin),
    );
    const nicknameSet = new Set(
      ((existingPins.data || []) as Array<{ nickname: string | null }>)
        .map((p) => (p.nickname || '').trim().toLowerCase())
        .filter(Boolean),
    );

    const restored: Array<{ name: string; pin: string; registration_id: string }> = [];
    const alreadyLinked: Array<{ name: string; pin: string }> = [];
    const skipped: Array<{ name: string; reason: string }> = [];

    for (const row of rows) {
      const name = (row.name || '').trim();
      if (!name) continue;

      // Still linked to a living participant?
      if (row.participant_pin && pinSet.has(row.participant_pin)) {
        alreadyLinked.push({ name, pin: row.participant_pin });
        continue;
      }

      // Avoid duplicate nickname if someone already re-created manually
      const key = name.toLowerCase();
      if (nicknameSet.has(key)) {
        skipped.push({ name, reason: 'Deltaker med samme navn finnes allerede' });
        continue;
      }

      const pin = await freePin(pinSet);
      if (!pin) {
        skipped.push({ name, reason: 'Fant ikke ledig PIN' });
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ins = await (supabase.from('participants') as any).insert({
        pin,
        nickname: name,
        active: true,
      });
      if (ins.error) {
        skipped.push({ name, reason: ins.error.message || 'Insert feilet' });
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const link = await (supabase.from('event_registrations') as any)
        .update({ participant_pin: pin })
        .eq('id', row.id);
      if (link.error) {
        skipped.push({ name, reason: 'Opprettet PIN men klarte ikke koble påmelding' });
      }

      pinSet.add(pin);
      nicknameSet.add(key);
      restored.push({ name, pin, registration_id: row.id });
    }

    // Ensure competition flags are usable
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'current_round', int_value: 1 }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'picked_round', int_value: 0 }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert({ key: 'round_started', bool_value: false }, { onConflict: 'key' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('app_state') as any).upsert(
        { key: 'active_event_slug', text_value: 'gulmasse-2026' },
        { onConflict: 'key' },
      ),
    ]);

    return NextResponse.json({
      ok: true,
      restored,
      already_linked: alreadyLinked,
      skipped,
      message:
        restored.length > 0
          ? `Gjenopprettet ${restored.length} deltaker(e) fra påmelding. De må fylle inn ølinfo / få ny PIN.`
          : alreadyLinked.length > 0
            ? 'Ingen manglet — påmeldte er allerede koblet til live deltakere.'
            : 'Fant ingen accepted-påmeldinger å gjenopprette fra.',
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
