import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertHost } from '@/lib/host';
import { pinSchema } from '@/lib/schemas';
import { getDemoStore, isLocalDemo } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

const bodySchema = z.object({
  pin: pinSchema,
  nickname: z.string().trim().max(80).optional().nullable(),
  beer_name: z.string().trim().max(120).optional().nullable(),
  producer: z.string().trim().max(120).optional().nullable(),
  beer_type: z.string().trim().max(80).optional().nullable(),
  abv: z.number().min(0).max(100).optional().nullable(),
  active: z.boolean().optional(),
  beer_image_url: z.string().trim().max(2000).optional().nullable(),
});

function statusCode(e: unknown): number {
  if (typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: unknown }).status === 'number') {
    return (e as { status: number }).status;
  }
  return 500;
}

export async function PATCH(request: Request) {
  try {
    assertHost(request);
    const parsed = bodySchema.parse(await request.json());
    const { pin, ...fields } = parsed;

    const update: Record<string, unknown> = {};
    if (fields.nickname !== undefined) update.nickname = fields.nickname || null;
    if (fields.beer_name !== undefined) update.beer_name = fields.beer_name || null;
    if (fields.producer !== undefined) update.producer = fields.producer || null;
    if (fields.beer_type !== undefined) update.beer_type = fields.beer_type || null;
    if (fields.abv !== undefined) update.abv = fields.abv;
    if (fields.active !== undefined) update.active = fields.active;
    if (fields.beer_image_url !== undefined) update.beer_image_url = fields.beer_image_url || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true });
    }

    if (isLocalDemo()) {
      const store = getDemoStore();
      const p = store.participants.find((x) => x.pin === pin);
      if (!p) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
      Object.assign(p, update);
      return NextResponse.json({ ok: true, participant: p });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd = await (supabase.from('participants') as any)
      .update(update)
      .eq('pin', pin)
      .select('pin,nickname,active,beer_name,producer,beer_type,abv,beer_image_url')
      .maybeSingle();

    if (upd.error) {
      // Retry without beer_image_url if column missing
      if (update.beer_image_url !== undefined && /beer_image_url|column/i.test(upd.error.message || '')) {
        delete update.beer_image_url;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const retry = await (supabase.from('participants') as any)
          .update(update)
          .eq('pin', pin)
          .select('pin,nickname,active,beer_name,producer,beer_type,abv')
          .maybeSingle();
        if (retry.error) throw retry.error;
        if (!retry.data) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
        return NextResponse.json({ ok: true, participant: retry.data });
      }
      throw upd.error;
    }
    if (!upd.data) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });

    // Keep påmelding name in sync when nickname changes
    if (typeof update.nickname === 'string' && update.nickname) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('event_registrations') as any)
          .update({ name: update.nickname })
          .eq('participant_pin', pin)
          .neq('status', 'cancelled');
      } catch {
        // optional
      }
    }

    return NextResponse.json({ ok: true, participant: upd.data });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    const status = hasIssues ? 400 : statusCode(e);
    const msg =
      hasIssues
        ? 'Ugyldig forespørsel'
        : e instanceof Error && e.message
          ? e.message
          : status === 401
            ? 'Unauthorized'
            : 'Server error';
    return NextResponse.json({ error: msg }, { status });
  }
}
