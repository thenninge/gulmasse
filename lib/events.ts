import { z } from 'zod';
import { demoActiveEvent, isLocalDemo } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

export const registrationStatusSchema = z.enum([
  'invited',
  'accepted',
  'declined',
  'waitlist',
  'cancelled',
]);

export const registerBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  status: z.enum(['accepted', 'declined']).default('accepted'),
  bringing_beer: z.boolean().optional(),
  beer_note: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().max(500).optional().or(z.literal('')),
  invite_code: z.string().trim().min(4).max(40).optional(),
});

export const hostInviteBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  bringing_beer: z.boolean().optional(),
  beer_note: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().max(500).optional().or(z.literal('')),
});

export const hostRegistrationPatchSchema = z.object({
  id: z.string().uuid(),
  status: registrationStatusSchema,
});

export type EventRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  location: string | null;
  event_date: string | null;
  event_time: string | null;
  status: 'draft' | 'registration' | 'live' | 'archived';
  invite_code: string;
  registration_open: boolean;
  max_participants: number | null;
  created_at?: string;
};

export type RegistrationRow = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: z.infer<typeof registrationStatusSchema>;
  bringing_beer: boolean | null;
  beer_note: string | null;
  message: string | null;
  invite_token: string;
  participant_pin: string | null;
  created_at: string;
  responded_at: string | null;
};

export async function getActiveEventSlug(): Promise<string | null> {
  if (isLocalDemo()) {
    return demoActiveEvent()?.slug ?? 'gulmasse-2026';
  }
  const res = await supabase
    .from('app_state')
    .select('text_value')
    .eq('key', 'active_event_slug')
    .maybeSingle();
  if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
  const slug = (res.data as { text_value?: string | null } | null)?.text_value;
  return slug || null;
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  if (isLocalDemo()) {
    const event = demoActiveEvent();
    return event && event.slug === slug ? event : null;
  }
  const res = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
  if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
  return (res.data as EventRow | null) ?? null;
}

export async function getEventByInviteCode(code: string): Promise<EventRow | null> {
  if (isLocalDemo()) {
    const event = demoActiveEvent();
    if (!event) return null;
    return event.invite_code.toUpperCase() === code.toUpperCase() ? event : null;
  }
  const res = await supabase
    .from('events')
    .select('*')
    .ilike('invite_code', code)
    .maybeSingle();
  if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
  return (res.data as EventRow | null) ?? null;
}

export async function getActiveEvent(): Promise<EventRow | null> {
  if (isLocalDemo()) {
    return demoActiveEvent();
  }
  const slug = await getActiveEventSlug();
  if (slug) {
    const bySlug = await getEventBySlug(slug);
    if (bySlug) return bySlug;
  }
  // Fallback: newest non-archived event
  const res = await supabase
    .from('events')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
  return (res.data as EventRow | null) ?? null;
}

export function publicEventPayload(event: EventRow) {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    tagline: event.tagline,
    description: event.description,
    location: event.location,
    event_date: event.event_date,
    event_time: event.event_time,
    status: event.status,
    registration_open: event.registration_open,
    max_participants: event.max_participants,
    invite_code: event.invite_code,
  };
}

export function formatEventDate(date: string | null, time: string | null): string | null {
  if (!date) return null;
  try {
    const d = new Date(`${date}T12:00:00`);
    const formatted = d.toLocaleDateString('nb-NO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return time ? `${formatted} kl. ${time}` : formatted;
  } catch {
    return date;
  }
}

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return typeof e.message === 'string' && /relation .* does not exist|Could not find the table/i.test(e.message);
}

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

type RegLite = {
  id: string;
  name: string;
  status: string;
  participant_pin: string | null;
  created_at?: string;
};

function statusRank(status: string): number {
  switch (status) {
    case 'accepted':
      return 5;
    case 'waitlist':
      return 4;
    case 'invited':
      return 3;
    case 'declined':
      return 2;
    default:
      return 1;
  }
}

function pickPreferredReg(rows: RegLite[]): RegLite {
  return rows.slice().sort((a, b) => {
    const pinScore = (r: RegLite) => (r.participant_pin ? 1 : 0);
    const diff =
      statusRank(b.status) - statusRank(a.status) ||
      pinScore(b) - pinScore(a) ||
      String(a.created_at || '').localeCompare(String(b.created_at || ''));
    return diff;
  })[0];
}

async function listEventRegistrationsLite(eventId: string): Promise<RegLite[]> {
  const res = await supabase
    .from('event_registrations')
    .select('id,name,status,participant_pin,created_at')
    .eq('event_id', eventId);
  if (res.error) {
    if (isMissingRelation(res.error)) return [];
    throw res.error;
  }
  return (res.data || []) as RegLite[];
}

/**
 * Collapse duplicate rows for the same person (same normalized name).
 * Keeps the strongest row; marks the rest cancelled.
 */
export async function dedupeRegistrationsByName(eventId: string): Promise<number> {
  if (isLocalDemo()) return 0;
  const rows = await listEventRegistrationsLite(eventId);
  const byName = new Map<string, RegLite[]>();
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    const key = normName(row.name);
    if (!key || key === 'anonym') continue;
    const list = byName.get(key) || [];
    list.push(row);
    byName.set(key, list);
  }

  let cancelled = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regs = supabase.from('event_registrations') as any;
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const keep = pickPreferredReg(group);
    const drop = group.filter((r) => r.id !== keep.id);
    for (const d of drop) {
      // Prefer moving PIN onto the kept row if keep lacks it
      if (!keep.participant_pin && d.participant_pin) {
        const link = await regs
          .update({ participant_pin: d.participant_pin })
          .eq('id', keep.id)
          .is('participant_pin', null);
        if (!link.error) keep.participant_pin = d.participant_pin;
      }
      const upd = await regs.update({ status: 'cancelled' }).eq('id', d.id);
      if (!upd.error) cancelled += 1;
    }
  }
  return cancelled;
}

/** Link a live participant to the active event as «Kommer» (accepted). Reuses invited/same-name rows. */
export async function ensureAcceptedRegistration(opts: {
  eventId: string;
  pin: string;
  name: string;
}): Promise<{ created: boolean; updated: boolean }> {
  const name = opts.name.trim() || opts.pin;
  const key = normName(name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regs = supabase.from('event_registrations') as any;

  const rows = await listEventRegistrationsLite(opts.eventId);
  const byPin = rows.find((r) => r.participant_pin === opts.pin && r.status !== 'cancelled');
  const byName = rows
    .filter((r) => r.status !== 'cancelled' && normName(r.name) === key)
    .sort((a, b) => statusRank(b.status) - statusRank(a.status));

  const target = byPin || byName[0] || null;

  if (target) {
    const needsUpdate =
      target.status !== 'accepted' ||
      target.participant_pin !== opts.pin ||
      normName(target.name) !== key;
    if (needsUpdate) {
      const upd = await regs
        .update({
          status: 'accepted',
          name,
          participant_pin: opts.pin,
          responded_at: new Date().toISOString(),
        })
        .eq('id', target.id);
      if (upd.error) throw upd.error;
    }
    // Cancel other same-name duplicates
    for (const extra of byName) {
      if (extra.id === target.id) continue;
      await regs.update({ status: 'cancelled' }).eq('id', extra.id);
    }
    return { created: false, updated: needsUpdate };
  }

  const ins = await regs.insert({
    event_id: opts.eventId,
    name,
    status: 'accepted',
    bringing_beer: true,
    participant_pin: opts.pin,
    responded_at: new Date().toISOString(),
  });
  if (ins.error) {
    if (isMissingRelation(ins.error)) return { created: false, updated: false };
    throw ins.error;
  }
  return { created: true, updated: false };
}

/** Record NEI without stacking duplicate declined rows for the same name. */
export async function ensureDeclinedRegistration(opts: {
  eventId: string;
  name: string;
}): Promise<{ created: boolean; updated: boolean }> {
  const name = opts.name.trim() || 'Anonym';
  const key = normName(name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regs = supabase.from('event_registrations') as any;

  const rows = await listEventRegistrationsLite(opts.eventId);
  const existing = rows
    .filter((r) => r.status !== 'cancelled' && normName(r.name) === key)
    .sort((a, b) => statusRank(b.status) - statusRank(a.status))[0];

  if (existing) {
    // Don't downgrade someone who already accepted / has a PIN
    if (existing.status === 'accepted' || existing.participant_pin) {
      return { created: false, updated: false };
    }
    if (existing.status !== 'declined') {
      const upd = await regs
        .update({
          status: 'declined',
          bringing_beer: false,
          responded_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (upd.error) throw upd.error;
      return { created: false, updated: true };
    }
    return { created: false, updated: false };
  }

  const ins = await regs.insert({
    event_id: opts.eventId,
    name,
    status: 'declined',
    bringing_beer: false,
    responded_at: new Date().toISOString(),
  });
  if (ins.error) {
    if (isMissingRelation(ins.error)) return { created: false, updated: false };
    throw ins.error;
  }
  return { created: true, updated: false };
}

/**
 * Backfill: any active participant without a linked registration
 * becomes «Kommer». Host PIN is skipped. Also dedupes same-name rows.
 */
export async function syncParticipantsToRegistrations(event: EventRow): Promise<number> {
  if (isLocalDemo()) return 0;
  const hostPin = process.env.HOST_PIN || '0808';

  await dedupeRegistrationsByName(event.id);

  const parts = await supabase
    .from('participants')
    .select('pin,nickname,active')
    .eq('active', true);
  if (parts.error) {
    if (isMissingRelation(parts.error)) return 0;
    throw parts.error;
  }

  const existing = await listEventRegistrationsLite(event.id);
  const linkedPins = new Set(
    existing
      .filter((r) => r.status !== 'cancelled' && r.participant_pin)
      .map((r) => r.participant_pin as string),
  );

  let created = 0;
  for (const p of (parts.data || []) as Array<{ pin: string; nickname: string | null }>) {
    if (!p.pin || p.pin === hostPin) continue;
    if (linkedPins.has(p.pin)) continue;
    const result = await ensureAcceptedRegistration({
      eventId: event.id,
      pin: p.pin,
      name: (p.nickname || '').trim() || p.pin,
    });
    if (result.created) created += 1;
    linkedPins.add(p.pin);
  }
  return created;
}
