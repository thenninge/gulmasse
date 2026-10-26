import { NextResponse } from 'next/server';
import { getActiveEvent, publicEventPayload, formatEventDate } from '@/lib/events';
import { demoListRegistrations, isLocalDemo } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    if (isLocalDemo()) {
      const { event, counts } = demoListRegistrations();
      if (!event) return NextResponse.json({ event: null });
      return NextResponse.json({
        event: {
          ...publicEventPayload(event),
          formatted_date: formatEventDate(event.event_date, event.event_time),
        },
        counts: {
          accepted: counts.accepted ?? 0,
          invited: counts.invited ?? 0,
          declined: counts.declined ?? 0,
          total: counts.total ?? 0,
        },
        demo: true,
      });
    }

    const event = await getActiveEvent();
    if (!event) {
      // Branding fallback so the app always shows Gulmasse '26 even before seed
      return NextResponse.json({
        event: {
          id: 'fallback-2026',
          slug: 'gulmasse-2026',
          name: "Gulmasse '26",
          tagline: 'Christmas Beer Competition',
          description: null,
          location: null,
          event_date: '2026-11-28',
          event_time: null,
          status: 'registration',
          registration_open: true,
          max_participants: null,
          invite_code: 'GULMASSE26',
          formatted_date: 'lørdag 28. november 2026',
        },
        counts: { accepted: 0, invited: 0, declined: 0, total: 0 },
        pending_migration: true,
      });
    }

    const regs = await supabase
      .from('event_registrations')
      .select('status')
      .eq('event_id', event.id);
    if (regs.error) throw regs.error;

    const rows = (regs.data as Array<{ status: string }> | null) || [];
    const accepted = rows.filter((r) => r.status === 'accepted').length;
    const invited = rows.filter((r) => r.status === 'invited').length;
    const declined = rows.filter((r) => r.status === 'declined').length;

    return NextResponse.json({
      event: {
        ...publicEventPayload(event),
        formatted_date: formatEventDate(event.event_date, event.event_time),
      },
      counts: { accepted, invited, declined, total: rows.length },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    const code =
      typeof e === 'object' && e !== null && 'code' in e
        ? String((e as { code?: unknown }).code || '')
        : '';
    // Graceful when migration not applied yet
    if (
      code === '42P01' ||
      code === 'PGRST205' ||
      /relation .* does not exist|Could not find the table/i.test(msg)
    ) {
      return NextResponse.json({
        event: {
          id: 'pending',
          slug: 'gulmasse-2026',
          name: "Gulmasse '26",
          tagline: 'Christmas Beer Competition',
          description: null,
          location: null,
          event_date: '2026-11-28',
          event_time: null,
          status: 'registration',
          registration_open: true,
          max_participants: null,
          invite_code: 'GULMASSE26',
          formatted_date: 'lørdag 28. november 2026',
        },
        counts: { accepted: 0, invited: 0, declined: 0, total: 0 },
        pending_migration: true,
      });
    }
    return NextResponse.json(
      { error: msg || 'Server error' },
      { status: 500 },
    );
  }
}
