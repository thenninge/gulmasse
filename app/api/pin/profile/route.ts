import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginBodySchema.extend({ nickname: z.string().optional() }).parse(body);
    const pin = parsed.pin as string;
    const nickname = (parsed as any).nickname as string | undefined;
    if (!nickname) return NextResponse.json({ ok: true }); // nothing to update yet
    const upd = await (supabase.from('participants') as any)
      .update({ nickname })
      .eq('pin', pin);
    if (upd.error) throw upd.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


