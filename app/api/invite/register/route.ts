import { NextResponse } from 'next/server';
import { inviteSignupBodySchema } from '@/lib/schemas';
import { getActiveEvent } from '@/lib/events';
import { supabase } from '@/lib/supabase';

async function isPinTaken(pin: string) {
  const res = await supabase.from('participants').select('pin').eq('pin', pin).maybeSingle();
  if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
  return !!res.data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = inviteSignupBodySchema.parse(body);

    const event = await getActiveEvent();
    if (!event) {
      return NextResponse.json({ error: 'Ingen aktivt event' }, { status: 404 });
    }
    if (!event.registration_open || event.status === 'archived' || event.status === 'draft') {
      return NextResponse.json({ error: 'Påmelding er stengt' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regs = supabase.from('event_registrations') as any;

    if (parsed.status === 'declined') {
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

    // accepted → create participant + registration
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinIns = await (supabase.from('participants') as any).insert({
      pin: parsed.pin,
      nickname: parsed.name,
      active: true,
    });
    if (pinIns.error) {
      if ((pinIns.error as { code?: string }).code === '23505') {
        return NextResponse.json(
          { error: 'PIN er allerede i bruk – velg en annen' },
          { status: 409 },
        );
      }
      throw pinIns.error;
    }

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
    return NextResponse.json(
      { error: hasIssues ? 'Ugyldig forespørsel' : 'Server error' },
      { status: hasIssues ? 400 : 500 },
    );
  }
}
