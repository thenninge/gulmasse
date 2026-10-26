import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import {
  getActiveEvent,
  getEventBySlug,
  hostRegistrationPatchSchema,
  syncParticipantsToRegistrations,
  type RegistrationRow,
} from '@/lib/events';
import { demoListRegistrations, getDemoStore, isLocalDemo } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

function statusCode(e: unknown): number {
  if (typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: unknown }).status === 'number') {
    return (e as { status: number }).status;
  }
  return 500;
}

export async function GET(request: Request) {
  try {
    assertHost(request);

    if (isLocalDemo()) {
      const { event, registrations, counts } = demoListRegistrations();
      if (!event) {
        return NextResponse.json({ error: 'Ingen aktivt event' }, { status: 404 });
      }
      return NextResponse.json({
        event: {
          id: event.id,
          slug: event.slug,
          name: event.name,
          invite_code: event.invite_code,
          registration_open: event.registration_open,
          status: event.status,
        },
        registrations,
        counts,
        demo: true,
      });
    }

    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const event = slug ? await getEventBySlug(slug) : await getActiveEvent();
    if (!event) {
      return NextResponse.json({ error: 'Ingen aktivt event' }, { status: 404 });
    }

    // Existing participants (main-app signup) → «Kommer» if missing from påmelding
    try {
      await syncParticipantsToRegistrations(event);
    } catch {
      // ignore sync failures; still return whatever registrations we have
    }

    const res = await supabase
      .from('event_registrations')
      .select(
        'id,name,email,phone,status,bringing_beer,beer_note,message,invite_token,participant_pin,created_at,responded_at',
      )
      .eq('event_id', event.id)
      .order('created_at', { ascending: true });
    if (res.error) throw res.error;

    const registrations = (res.data || []) as RegistrationRow[];
    const counts = {
      accepted: registrations.filter((r) => r.status === 'accepted').length,
      invited: registrations.filter((r) => r.status === 'invited').length,
      declined: registrations.filter((r) => r.status === 'declined').length,
      waitlist: registrations.filter((r) => r.status === 'waitlist').length,
      cancelled: registrations.filter((r) => r.status === 'cancelled').length,
      total: registrations.length,
    };

    return NextResponse.json({
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        invite_code: event.invite_code,
        registration_open: event.registration_open,
        status: event.status,
      },
      registrations,
      counts,
    });
  } catch (e: unknown) {
    const status = statusCode(e);
    const msg = status === 401 ? 'Unauthorized' : 'Server error';
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    assertHost(request);
    const body = await request.json();
    const parsed = hostRegistrationPatchSchema.parse(body);

    if (isLocalDemo()) {
      const store = getDemoStore();
      const reg = store.registrations.find((r) => r.id === parsed.id);
      if (!reg) {
        return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
      }
      reg.status = parsed.status;
      reg.responded_at = new Date().toISOString();
      return NextResponse.json({
        ok: true,
        registration: { id: reg.id, status: reg.status, name: reg.name },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd = await (supabase.from('event_registrations') as any)
      .update({
        status: parsed.status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', parsed.id)
      .select('id,status,name')
      .single();
    if (upd.error) throw upd.error;

    return NextResponse.json({ ok: true, registration: upd.data });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const status = hasIssues ? 400 : statusCode(e);
    const msg = hasIssues ? 'Ugyldig forespørsel' : status === 401 ? 'Unauthorized' : 'Server error';
    return NextResponse.json({ error: msg }, { status });
  }
}
