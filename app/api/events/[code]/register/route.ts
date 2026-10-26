import { NextResponse } from 'next/server';
import {
  getEventByInviteCode,
  getEventBySlug,
  registerBodySchema,
} from '@/lib/events';
import { supabase } from '@/lib/supabase';

type Params = { params: Promise<{ code: string }> };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const raw = decodeURIComponent(code || '').trim();
    const body = await request.json();
    const parsed = registerBodySchema.parse(body);

    let event = await getEventByInviteCode(raw);
    if (!event) event = await getEventBySlug(raw.toLowerCase());

    if (!event && parsed.invite_code) {
      event = await getEventByInviteCode(parsed.invite_code);
    }
    if (!event) {
      return NextResponse.json({ error: 'Event ikke funnet' }, { status: 404 });
    }

    if (event.status === 'archived' || event.status === 'draft') {
      return NextResponse.json({ error: 'Påmelding er ikke åpen' }, { status: 403 });
    }
    if (!event.registration_open) {
      return NextResponse.json({ error: 'Påmelding er stengt' }, { status: 403 });
    }

    if (
      parsed.invite_code &&
      parsed.invite_code.toUpperCase() !== event.invite_code.toUpperCase()
    ) {
      return NextResponse.json({ error: 'Ugyldig invitasjonskode' }, { status: 403 });
    }

    const payload = {
      event_id: event.id,
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone || null,
      bringing_beer: parsed.bringing_beer ?? true,
      beer_note: parsed.beer_note || null,
      message: parsed.message || null,
      responded_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regs = supabase.from('event_registrations') as any;

    if (event.max_participants != null && parsed.status === 'accepted') {
      const countRes = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'accepted');
      if (countRes.error) throw countRes.error;
      const accepted = countRes.count ?? 0;
      if (accepted >= event.max_participants) {
        const wait = await regs
          .insert({ ...payload, status: 'waitlist' })
          .select('id,invite_token,status,name')
          .single();
        if (wait.error) {
          if (isUniqueViolation(wait.error)) {
            return NextResponse.json({ error: 'Du er allerede påmeldt med denne e-posten' }, { status: 409 });
          }
          throw wait.error;
        }
        return NextResponse.json({
          ok: true,
          waitlisted: true,
          registration: wait.data,
          message: 'Arrangementet er fullt – du er satt på venteliste.',
        });
      }
    }

    const ins = await regs
      .insert({ ...payload, status: parsed.status })
      .select('id,invite_token,status,name,email,bringing_beer')
      .single();

    if (ins.error) {
      if (isUniqueViolation(ins.error)) {
        return NextResponse.json(
          { error: 'Du er allerede påmeldt med denne e-posten' },
          { status: 409 },
        );
      }
      throw ins.error;
    }

    return NextResponse.json({
      ok: true,
      registration: ins.data,
      message:
        parsed.status === 'accepted'
          ? 'Du er påmeldt! Vi gleder oss.'
          : 'Svaret ditt er registrert.',
    });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const msg = hasIssues ? 'Ugyldig forespørsel' : 'Server error';
    const code = hasIssues ? 400 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
