import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { assertHost } from '@/lib/host';

export async function POST(request: Request) {
  try {
    assertHost(request);
    const { rows: participants } = await pgPool.query(
      'SELECT pin FROM participants WHERE active = TRUE ORDER BY created_at ASC'
    );
    const activePins = participants.map((p) => p.pin);
    const { rows: pickedRows } = await pgPool.query(
      'SELECT pin FROM picks ORDER BY created_at ASC'
    );
    const alreadyPicked = new Set(pickedRows.map((r) => r.pin));
    const candidates = activePins.filter((p) => !alreadyPicked.has(p));
    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No candidates left' }, { status: 409 });
    }
    const idx = Math.floor(Math.random() * candidates.length);
    const chosen = candidates[idx];
    await pgPool.query('INSERT INTO picks(pin) VALUES ($1)', [chosen]);
    return NextResponse.json({ ok: true, pin: chosen });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


