import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { getActiveEvent, publicEventPayload, type EventRow } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const patchSchema = z.object({
  registration_open: z.boolean().optional(),
  status: z.enum(['draft', 'registration', 'live', 'archived']).optional(),
  location: z.string().trim().max(200).optional().nullable(),
  event_date: z.string().trim().optional().nullable(),
  event_time: z.string().trim().max(40).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  max_participants: z.number().int().positive().optional().nullable(),
});

function statusCode(e: unknown): number {
  if (typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: unknown }).status === 'number') {
    return (e as { status: number }).status;
  }
  return 500;
}

export async function GET(request: Request) {
  try {
    assertHost(request);
    const list = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    if (list.error) throw list.error;
    const active = await getActiveEvent();
    const events = ((list.data || []) as EventRow[]).map(publicEventPayload);
    return NextResponse.json({
      events,
      active_slug: active?.slug ?? null,
    });
  } catch (e: unknown) {
    const status = statusCode(e);
    return NextResponse.json(
      { error: status === 401 ? 'Unauthorized' : 'Server error' },
      { status },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    assertHost(request);
    const body = await request.json();
    const parsed = patchSchema.parse(body);
    const active = await getActiveEvent();
    if (!active) {
      return NextResponse.json({ error: 'Ingen aktivt event' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.registration_open !== undefined) update.registration_open = parsed.registration_open;
    if (parsed.status !== undefined) update.status = parsed.status;
    if (parsed.location !== undefined) update.location = parsed.location;
    if (parsed.event_date !== undefined) update.event_date = parsed.event_date;
    if (parsed.event_time !== undefined) update.event_time = parsed.event_time;
    if (parsed.description !== undefined) update.description = parsed.description;
    if (parsed.max_participants !== undefined) update.max_participants = parsed.max_participants;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, event: publicEventPayload(active) });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd = await (supabase.from('events') as any)
      .update(update)
      .eq('id', active.id)
      .select('*')
      .single();
    if (upd.error) throw upd.error;

    return NextResponse.json({ ok: true, event: publicEventPayload(upd.data as EventRow) });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const status = hasIssues ? 400 : statusCode(e);
    const msg = hasIssues ? 'Ugyldig forespørsel' : status === 401 ? 'Unauthorized' : 'Server error';
    return NextResponse.json({ error: msg }, { status });
  }
}
