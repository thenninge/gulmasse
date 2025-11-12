import { NextResponse } from 'next/server';
import { loginBodySchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = loginBodySchema.parse(body);

    const lock = await supabase.from('app_state').select('bool_value').eq('key','logins_locked').maybeSingle();
    if (lock.error && lock.error.code !== 'PGRST116') throw lock.error;
    if ((lock.data as any)?.bool_value === true) {
      return NextResponse.json({ error: 'Logins are locked' }, { status: 423 });
    }

    const res = await supabase.from('participants').select('pin').eq('pin', pin).maybeSingle();
    if (res.error && res.error.code !== 'PGRST116') throw res.error;
    if (!res.data) {
      return NextResponse.json({ error: 'PIN not found' }, { status: 404 });
    }
    const upd = await supabase.from('participants').update({ active: true }).eq('pin', pin);
    if (upd.error) throw upd.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


