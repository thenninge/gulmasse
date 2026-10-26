import { NextResponse } from 'next/server';
import {
  formatEventDate,
  getEventByInviteCode,
  getEventBySlug,
  publicEventPayload,
} from '@/lib/events';
import { supabase } from '@/lib/supabase';

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const raw = decodeURIComponent(code || '').trim();
    if (!raw) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    let event = await getEventByInviteCode(raw);
    if (!event) event = await getEventBySlug(raw.toLowerCase());
    if (!event) {
      return NextResponse.json({ error: 'Event ikke funnet' }, { status: 404 });
    }

    const regs = await supabase
      .from('event_registrations')
      .select('status')
      .eq('event_id', event.id);
    if (regs.error) throw regs.error;
    const rows = (regs.data as Array<{ status: string }> | null) || [];
    const accepted = rows.filter((r) => r.status === 'accepted').length;

    return NextResponse.json({
      event: {
        ...publicEventPayload(event),
        formatted_date: formatEventDate(event.event_date, event.event_time),
      },
      counts: {
        accepted,
        spots_left:
          event.max_participants != null
            ? Math.max(0, event.max_participants - accepted)
            : null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
