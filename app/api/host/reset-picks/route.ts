import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { assertHost } from '@/lib/host';

export async function POST(request: Request) {
  try {
    assertHost(request);
    await pgPool.query('DELETE FROM picks');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


