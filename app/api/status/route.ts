import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const [roundRes, revealRes, lockRes] = await Promise.all([
      supabase.from('app_state').select('int_value').eq('key', 'current_round').maybeSingle(),
      supabase.from('app_state').select('bool_value').eq('key', 'reveal_results').maybeSingle(),
      supabase.from('app_state').select('bool_value').eq('key', 'logins_locked').maybeSingle(),
    ]);
    if (roundRes.error) throw roundRes.error;
    if (revealRes.error) throw revealRes.error;
    if (lockRes.error) throw lockRes.error;
    const round = Number(roundRes.data?.int_value ?? 1);
    const reveal = revealRes.data?.bool_value === true;
    const loginsLocked = lockRes.data?.bool_value === true;

    // Participants
    const participantsRes = await supabase
      .from('participants')
      .select('pin,nickname,active')
      .order('created_at', { ascending: true });
    if (participantsRes.error) throw participantsRes.error;
    const participants = participantsRes.data || [];

    const activePins = participants.filter((p) => p.active).map((p) => p.pin);
    const activeCount = activePins.length;

    // Votes for current round
    const votesRes = await supabase
      .from('votes')
      .select('pin,value')
      .eq('round', round);
    if (votesRes.error) throw votesRes.error;
    const voteRows = votesRes.data || [];
    const votedPins = voteRows.map((v) => v.pin as string);
    const votedCount = voteRows.filter((v) => activePins.includes(v.pin as string)).length;

    const histogram: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let sum = 0;
    let cnt = 0;
    for (const v of voteRows) {
      const val = Number(v.value);
      histogram[val] = (histogram[val] ?? 0) + 1;
      sum += val;
      cnt += 1;
    }
    const average = cnt > 0 ? Number((sum / cnt).toFixed(2)) : 0;

    // Picks history (order by created_at)
    const picksRes = await supabase
      .from('picks')
      .select('pin')
      .order('created_at', { ascending: true });
    if (picksRes.error) throw picksRes.error;
    const picks = (picksRes.data || []).map((r) => r.pin as string);

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
    console.error('STATUS_ERROR', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}


