import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { voteBodySchema } from '@/lib/schemas';

async function getCurrentRound(): Promise<number> {
  const res = await pgPool.query(
    "SELECT int_value FROM app_state WHERE key = 'current_round'"
  );
  const round = res.rows[0]?.int_value ?? 1;
  return Number(round);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin, value } = voteBodySchema.parse(body);

    const exists = await pgPool.query(
      'SELECT active FROM participants WHERE pin = $1',
      [pin]
    );
    if (exists.rowCount === 0) {
      return NextResponse.json({ error: 'PIN not found' }, { status: 404 });
    }
    if (exists.rows[0].active !== true) {
      return NextResponse.json({ error: 'Participant not active' }, { status: 400 });
    }

    const round = await getCurrentRound();
    await pgPool.query(
      `INSERT INTO votes (pin, round, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (round, pin)
       DO UPDATE SET value = EXCLUDED.value, created_at = NOW()`,
      [pin, round, value]
    );
    return NextResponse.json({ ok: true, round });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


