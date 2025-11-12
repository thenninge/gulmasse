import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { createPinBodySchema, pinSchema } from '@/lib/schemas';

async function isPinTaken(pin: string) {
  const res = await pgPool.query('SELECT 1 FROM participants WHERE pin = $1', [pin]);
  return res.rowCount > 0;
}

function generateRandomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createPinBodySchema.parse(body);
    // Check if logins are locked
    const lock = await pgPool.query("SELECT bool_value FROM app_state WHERE key = 'logins_locked'");
    if (lock.rows[0]?.bool_value === true) {
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
    await pgPool.query(
      'INSERT INTO participants(pin, nickname, active) VALUES ($1, $2, TRUE)',
      [pin, nickname]
    );
    return NextResponse.json({ ok: true, pin });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


