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
