import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginBodySchema.extend({
      nickname: z.string().optional(),
      beer_name: z.string().optional(),
      producer: z.string().optional(),
      beer_type: z.string().optional(),
      abv: z.number().optional(),
    }).parse(body);
    const pin = parsed.pin as string;
    const { nickname, beer_name, producer, beer_type, abv } = parsed as any;
    const update: Record<string, any> = {};
    if (nickname !== undefined) update.nickname = nickname;
    if (beer_name !== undefined) update.beer_name = beer_name;
    if (producer !== undefined) update.producer = producer;
    if (beer_type !== undefined) update.beer_type = beer_type;
    if (abv !== undefined) update.abv = abv;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true });
    }
    const upd = await (supabase.from('participants') as any)
      .update(update)
      .eq('pin', pin);
    if (upd.error) throw upd.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


