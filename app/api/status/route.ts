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
    const round = Number((roundRes.data as any)?.int_value ?? 1);
    const reveal = (revealRes.data as any)?.bool_value === true;
    const loginsLocked = (lockRes.data as any)?.bool_value === true;

    // Participants
    const participantsRes = await supabase
      .from('participants')
      .select('pin,nickname,active,beer_name,producer,beer_type,abv')
      .order('created_at', { ascending: true });
    if (participantsRes.error) throw participantsRes.error;
    const participants = ((participantsRes.data as any[]) || []) as Array<{
      pin: string; nickname: string | null; active: boolean;
      beer_name?: string | null; producer?: string | null; beer_type?: string | null; abv?: number | null;
    }>;

    const activePins = participants.filter((p) => p.active).map((p) => p.pin);
    const activeCount = activePins.length;

    // Votes for current round
    const votesRes = await supabase
      .from('votes')
      .select('pin,value')
      .eq('round', round);
    if (votesRes.error) throw votesRes.error;
    const voteRows = ((votesRes.data as any[]) || []) as Array<{ pin: string; value: number }>;
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

    // Aggregate total given points per user (across all rounds)
    const votesAllRes = await supabase
      .from('votes')
      .select('pin,value');
    if (votesAllRes.error) throw votesAllRes.error;
    const totalsMap: Record<string, number> = {};
    for (const r of (votesAllRes.data as any[]) || []) {
      const k = String(r.pin);
      const v = Number(r.value) || 0;
      totalsMap[k] = (totalsMap[k] ?? 0) + v;
    }
    const userGiven = participants.map((p) => ({
      pin: p.pin,
      total: totalsMap[p.pin] ?? 0,
    }));

    // Aggregate total received points per user (across all rounds)
    const votesRecvRes = await supabase
      .from('votes')
      .select('recipient_pin,value');
    if (votesRecvRes.error) throw votesRecvRes.error;
    const recvMap: Record<string, number> = {};
    for (const r of (votesRecvRes.data as any[]) || []) {
      const k = String((r as any).recipient_pin || '');
      if (!k) continue;
      const v = Number((r as any).value) || 0;
      recvMap[k] = (recvMap[k] ?? 0) + v;
    }
    const userReceived = participants.map((p) => ({
      pin: p.pin,
      total: recvMap[p.pin] ?? 0,
    }));

    // Picks history (order by created_at)
    const picksRes = await supabase
      .from('picks')
      .select('pin')
      .order('created_at', { ascending: true });
    if (picksRes.error) throw picksRes.error;
    const picks = (((picksRes.data as any[]) || []) as Array<{ pin: string }>).map((r) => r.pin as string);

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
      userGiven,
      userReceived,
    });
  } catch (e: any) {
    console.error('STATUS_ERROR', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}


