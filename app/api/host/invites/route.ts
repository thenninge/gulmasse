import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { getActiveEvent, getEventBySlug, hostInviteBodySchema } from '@/lib/events';
import { supabase } from '@/lib/supabase';

function statusCode(e: unknown): number {
  if (typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: unknown }).status === 'number') {
    return (e as { status: number }).status;
  }
  return 500;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

export async function POST(request: Request) {
  try {
    assertHost(request);
    const body = await request.json();
    const parsed = hostInviteBodySchema.parse(body);
    const slug = typeof body.slug === 'string' ? body.slug : null;
    const event = slug ? await getEventBySlug(slug) : await getActiveEvent();
    if (!event) {
      return NextResponse.json({ error: 'Ingen aktivt event' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = await (supabase.from('event_registrations') as any)
      .insert({
        event_id: event.id,
        name: parsed.name,
        email: parsed.email || null,
        phone: parsed.phone || null,
        status: 'invited',
        bringing_beer: parsed.bringing_beer ?? true,
        beer_note: parsed.beer_note || null,
        message: parsed.message || null,
      })
      .select('id,name,email,status,invite_token')
      .single();

    if (ins.error) {
      if (isUniqueViolation(ins.error)) {
        return NextResponse.json(
          { error: 'Det finnes allerede en påmelding med denne e-posten' },
          { status: 409 },
        );
      }
      throw ins.error;
    }

    const origin = new URL(request.url).origin;
    const inviteUrl = `${origin}/invite?token=${ins.data.invite_token}`;

    return NextResponse.json({
      ok: true,
      registration: ins.data,
      invite_url: inviteUrl,
      event_invite_url: `${origin}/invite`,
    });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const status = hasIssues ? 400 : statusCode(e);
    const msg = hasIssues ? 'Ugyldig forespørsel' : status === 401 ? 'Unauthorized' : 'Server error';
    return NextResponse.json({ error: msg }, { status });
  }
}
