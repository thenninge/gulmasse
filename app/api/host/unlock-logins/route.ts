import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { assertHost } from '@/lib/host';

export async function POST(request: Request) {
  try {
    assertHost(request);
    await pgPool.query(`
      INSERT INTO app_state(key, bool_value) VALUES ('logins_locked', FALSE)
      ON CONFLICT (key) DO UPDATE SET bool_value = EXCLUDED.bool_value
    `);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


