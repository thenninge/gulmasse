import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { loginBodySchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = loginBodySchema.parse(body);

    const lock = await pgPool.query("SELECT bool_value FROM app_state WHERE key = 'logins_locked'");
    if (lock.rows[0]?.bool_value === true) {
      return NextResponse.json({ error: 'Logins are locked' }, { status: 423 });
    }

    const res = await pgPool.query('SELECT pin FROM participants WHERE pin = $1', [pin]);
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'PIN not found' }, { status: 404 });
    }
    await pgPool.query('UPDATE participants SET active = TRUE WHERE pin = $1', [pin]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


