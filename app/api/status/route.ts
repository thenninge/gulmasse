import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

export async function GET() {
  try {
    // Fetch core state
    const [{ rows: roundRows }, { rows: revealRows }, { rows: lockRows }] =
      await Promise.all([
        pgPool.query("SELECT int_value FROM app_state WHERE key = 'current_round'"),
        pgPool.query("SELECT bool_value FROM app_state WHERE key = 'reveal_results'"),
        pgPool.query("SELECT bool_value FROM app_state WHERE key = 'logins_locked'"),
      ]);
    const round = Number(roundRows[0]?.int_value ?? 1);
    const reveal = revealRows[0]?.bool_value === true;
    const loginsLocked = lockRows[0]?.bool_value === true;

    // Participants
    const { rows: participants } = await pgPool.query(
      'SELECT pin, nickname, active FROM participants ORDER BY created_at ASC'
    );

    const activePins = participants.filter((p) => p.active).map((p) => p.pin);
    const activeCount = activePins.length;

    // Votes for current round
    const { rows: voteRows } = await pgPool.query(
      'SELECT pin, value FROM votes WHERE round = $1',
      [round]
    );
    const votedPins = voteRows.map((v) => v.pin);
    const votedCount = voteRows.filter((v) => activePins.includes(v.pin)).length;

    const histogram: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let sum = 0;
    let cnt = 0;
    for (const v of voteRows) {
      histogram[v.value as number] = (histogram[v.value as number] ?? 0) + 1;
      sum += Number(v.value);
      cnt += 1;
    }
    const average = cnt > 0 ? Number((sum / cnt).toFixed(2)) : 0;

    // Picks history (order by created_at)
    const { rows: picksRows } = await pgPool.query(
      'SELECT pin FROM picks ORDER BY created_at ASC'
    );
    const picks = picksRows.map((r) => r.pin);

    return NextResponse.json({
      participants,
      votes: {
        histogram,
        count: cnt,
        average,
        votedPins,
      },
      activeCount,
      votedCount,
      reveal,
      round,
      picks,
      loginsLocked,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


