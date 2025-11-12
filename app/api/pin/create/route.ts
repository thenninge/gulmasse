import { NextResponse } from 'next/server';
import { createPinBodySchema, pinSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

async function isPinTaken(pin: string) {
  const res = await supabase.from('participants').select('pin').eq('pin', pin).maybeSingle();
  if (res.error && res.error.code !== 'PGRST116') throw res.error; // 116 = not found on single()
  return !!res.data;
}

function generateRandomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createPinBodySchema.parse(body);
    // Check if logins are locked
    const lock = await supabase.from('app_state').select('bool_value').eq('key','logins_locked').maybeSingle();
    if (lock.error && lock.error.code !== 'PGRST116') throw lock.error;
    if ((lock.data as any)?.bool_value === true) {
      return NextResponse.json({ error: 'Logins are locked' }, { status: 423 });
    }
    let pin = parsed.pin ?? '';
    if (pin) {
      pinSchema.parse(pin);
      if (await isPinTaken(pin)) {
        return NextResponse.json({ error: 'PIN already exists' }, { status: 409 });
      }
    } else {
      // propose a free random pin, try up to 20 times
      let attempts = 0;
      do {
        pin = generateRandomPin();
        attempts += 1;
        if (!(await isPinTaken(pin))) break;
      } while (attempts < 20);
      if (!pin) {
        return NextResponse.json({ error: 'Could not generate a free PIN' }, { status: 500 });
      }
    }

    const nickname = parsed.nickname ?? null;
    const ins = await (supabase.from('participants') as any).insert({ pin, nickname, active: true });
    if (ins.error) throw ins.error;
    return NextResponse.json({ ok: true, pin });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


