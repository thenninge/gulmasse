import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = loginBodySchema.parse(body);
    const upd = await (supabase.from('participants') as any)
      .update({ active: false })
      .eq('pin', pin);
    if (upd.error) throw upd.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


