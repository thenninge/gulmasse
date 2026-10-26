import { NextResponse } from 'next/server';
import { inviteSignupBodySchema } from '@/lib/schemas';
import { getActiveEvent } from '@/lib/events';
import {
  demoRegisterAccepted,
  demoRegisterDeclined,
  isLocalDemo,
} from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return typeof e.message === 'string' && /relation .* does not exist|Could not find the table/i.test(e.message);
}

function errorMessage(error: unknown): string {
  if (isMissingRelation(error)) {
    return 'Database mangler events-tabeller. Kjør SQL i Supabase (db/supabase_invite_setup.sql).';
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Server error');
  }
  return 'Server error';
}

async function isPinTaken(pin: string) {
  const res = await supabase.from('participants').select('pin').eq('pin', pin).maybeSingle();
  if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
  return !!res.data;
}

async function createParticipant(pin: string, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinIns = await (supabase.from('participants') as any).insert({
    pin,
    nickname: name,
    active: true,
  });
  if (pinIns.error) {
    if ((pinIns.error as { code?: string }).code === '23505') {
      const err = new Error('PIN er allerede i bruk – velg en annen');
      (err as Error & { status?: number }).status = 409;
      throw err;
    }
    throw pinIns.error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = inviteSignupBodySchema.parse(body);

    if (isLocalDemo()) {
      if (parsed.status === 'declined') {
        const registration = demoRegisterDeclined(parsed.name);
        return NextResponse.json({
          ok: true,
          status: 'declined',
          message: 'Takk for svaret – hyggelig om du får det til en annen gang!',
          registration,
        });
      }
      try {
        const registration = demoRegisterAccepted(parsed.name, parsed.pin);
        return NextResponse.json({
          ok: true,
          status: 'accepted',
          pin: parsed.pin,
          name: parsed.name,
          message: 'Du er påmeldt! Husk PIN-koden din til kvelden.',
          registration,
        });
      } catch (e: unknown) {
        const status =
          typeof e === 'object' && e !== null && 'status' in e
            ? Number((e as { status?: number }).status) || 500
            : 500;
        return NextResponse.json({ error: errorMessage(e) }, { status });
      }
    }

    let event = null;
    try {
      event = await getActiveEvent();
    } catch (e: unknown) {
      if (!isMissingRelation(e)) throw e;
      // Tables not migrated yet — continue with participant-only signup
      event = null;
    }

    if (parsed.status === 'declined') {
      if (!event) {
        return NextResponse.json({
          ok: true,
          status: 'declined',
          message: 'Takk for svaret – hyggelig om du får det til en annen gang!',
          pending_migration: true,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const regs = supabase.from('event_registrations') as any;
      const name = (parsed.name || '').trim() || 'Anonym';
      const ins = await regs
        .insert({
          event_id: event.id,
          name,
          status: 'declined',
          bringing_beer: false,
          responded_at: new Date().toISOString(),
        })
        .select('id,status,name')
        .single();
      if (ins.error) throw ins.error;
      return NextResponse.json({
        ok: true,
        status: 'declined',
        message: 'Takk for svaret – hyggelig om du får det til en annen gang!',
        registration: ins.data,
      });
    }

    // accepted
    if (event && (!event.registration_open || event.status === 'archived' || event.status === 'draft')) {
      return NextResponse.json({ error: 'Påmelding er stengt' }, { status: 403 });
    }

    const lock = await supabase
      .from('app_state')
      .select('bool_value')
      .eq('key', 'logins_locked')
      .maybeSingle();
    if (lock.error && (lock.error as { code?: string }).code !== 'PGRST116') throw lock.error;
    if ((lock.data as { bool_value?: boolean } | null)?.bool_value === true) {
      return NextResponse.json({ error: 'Pålogging er midlertidig låst' }, { status: 423 });
    }

    if (await isPinTaken(parsed.pin)) {
      return NextResponse.json(
        { error: 'PIN er allerede i bruk – velg en annen' },
        { status: 409 },
      );
    }

    await createParticipant(parsed.pin, parsed.name);

    if (!event) {
      return NextResponse.json({
        ok: true,
        status: 'accepted',
        pin: parsed.pin,
        name: parsed.name,
        message: 'Bruker opprettet! Husk PIN-koden. (Kjør database-setup for full påmeldingsliste.)',
        pending_migration: true,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regs = supabase.from('event_registrations') as any;
    const regIns = await regs
      .insert({
        event_id: event.id,
        name: parsed.name,
        status: 'accepted',
        bringing_beer: true,
        participant_pin: parsed.pin,
        responded_at: new Date().toISOString(),
      })
      .select('id,status,name,participant_pin,invite_token')
      .single();

    if (regIns.error) {
      // Best-effort cleanup of orphan pin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('participants') as any).delete().eq('pin', parsed.pin);
      throw regIns.error;
    }

    return NextResponse.json({
      ok: true,
      status: 'accepted',
      pin: parsed.pin,
      name: parsed.name,
      message: 'Du er påmeldt! Husk PIN-koden din til kvelden.',
      registration: regIns.data,
    });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const status =
      hasIssues
        ? 400
        : typeof e === 'object' && e !== null && 'status' in e
          ? Number((e as { status?: number }).status) || 500
          : 500;
    return NextResponse.json(
      { error: hasIssues ? 'Ugyldig forespørsel' : errorMessage(e) },
      { status },
    );
  }
}
