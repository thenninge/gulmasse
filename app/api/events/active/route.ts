import { NextResponse } from 'next/server';
import { getActiveEvent, publicEventPayload, formatEventDate } from '@/lib/events';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const event = await getActiveEvent();
    if (!event) {
      return NextResponse.json({ event: null });
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
    const msg = e instanceof Error ? e.message : 'Server error';
    // Graceful when migration not applied yet
    if (typeof msg === 'string' && /relation .* does not exist|Could not find the table/i.test(msg)) {
      return NextResponse.json({ event: null, counts: null, pending_migration: true });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
