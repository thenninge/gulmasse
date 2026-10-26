import { NextResponse } from 'next/server';
import {
  formatEventDate,
  publicEventPayload,
  registrationStatusSchema,
  type EventRow,
  type RegistrationRow,
} from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

type Params = { params: Promise<{ token: string }> };

const patchSchema = z.object({
  status: z.enum(['accepted', 'declined']),
  bringing_beer: z.boolean().optional(),
  beer_note: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().max(500).optional().or(z.literal('')),
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const res = await supabase
      .from('event_registrations')
      .select(
        'id,name,email,phone,status,bringing_beer,beer_note,message,invite_token,created_at,responded_at,event_id',
      )
      .eq('invite_token', token)
      .maybeSingle();
    if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
    if (!res.data) {
      return NextResponse.json({ error: 'Invitasjon ikke funnet' }, { status: 404 });
    }

    const registration = res.data as RegistrationRow & { event_id: string };
    const eventRes = await supabase
      .from('events')
      .select('*')
      .eq('id', registration.event_id)
      .maybeSingle();
    if (eventRes.error) throw eventRes.error;
    if (!eventRes.data) {
      return NextResponse.json({ error: 'Event ikke funnet' }, { status: 404 });
    }

    const event = eventRes.data as EventRow;
    return NextResponse.json({
      registration,
      event: {
        ...publicEventPayload(event),
        formatted_date: formatEventDate(event.event_date, event.event_time),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const update: Record<string, unknown> = {
      status: registrationStatusSchema.parse(parsed.status),
      responded_at: new Date().toISOString(),
    };
    if (parsed.bringing_beer !== undefined) update.bringing_beer = parsed.bringing_beer;
    if (parsed.beer_note !== undefined) update.beer_note = parsed.beer_note || null;
    if (parsed.message !== undefined) update.message = parsed.message || null;
    if (parsed.name !== undefined) update.name = parsed.name;
    if (parsed.email !== undefined) update.email = parsed.email || null;
    if (parsed.phone !== undefined) update.phone = parsed.phone || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd = await (supabase.from('event_registrations') as any)
      .update(update)
      .eq('invite_token', token)
      .select('id,name,email,status,invite_token,bringing_beer')
      .single();
    if (upd.error) throw upd.error;

    return NextResponse.json({ ok: true, registration: upd.data });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const msg = hasIssues ? 'Ugyldig forespørsel' : 'Server error';
    const code = hasIssues ? 400 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
