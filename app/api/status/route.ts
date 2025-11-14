import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const [roundRes, revealRes, lockRes, revealedRoundRes, pickedRoundRes, roundStartedRes, allowRevealRes] = await Promise.all([
      supabase.from('app_state').select('int_value').eq('key', 'current_round').maybeSingle(),
      supabase.from('app_state').select('bool_value').eq('key', 'reveal_results').maybeSingle(),
      supabase.from('app_state').select('bool_value').eq('key', 'logins_locked').maybeSingle(),
      supabase.from('app_state').select('int_value').eq('key', 'revealed_round').maybeSingle(),
      supabase.from('app_state').select('int_value').eq('key', 'picked_round').maybeSingle(),
      supabase.from('app_state').select('bool_value').eq('key', 'round_started').maybeSingle(),
      supabase.from('app_state').select('bool_value').eq('key', 'allow_reveal').maybeSingle(),
    ]);
    if (roundRes.error) throw roundRes.error;
    if (revealRes.error) throw revealRes.error;
    if (lockRes.error) throw lockRes.error;
    if (revealedRoundRes.error) throw revealedRoundRes.error;
    if (pickedRoundRes.error) throw pickedRoundRes.error;
    if (roundStartedRes.error) throw roundStartedRes.error;
    if (allowRevealRes.error) throw allowRevealRes.error;
    const round = Number((roundRes.data as any)?.int_value ?? 1);
    const reveal = (revealRes.data as any)?.bool_value === true;
    const loginsLocked = (lockRes.data as any)?.bool_value === true;
    const revealedRound = Number((revealedRoundRes.data as any)?.int_value ?? 0);
    const pickedRound = Number((pickedRoundRes.data as any)?.int_value ?? 0);
    const roundStarted = (roundStartedRes.data as any)?.bool_value === true;
    const allowReveal = (allowRevealRes.data as any)?.bool_value === true;

    // Participants
    const participantsRes = await supabase
      .from('participants')
      .select('pin,nickname,active,beer_name,producer,beer_type,abv,given_offset,received_offset')
      .order('created_at', { ascending: true });
    if (participantsRes.error) throw participantsRes.error;
    const participants = ((participantsRes.data as any[]) || []) as Array<{
      pin: string; nickname: string | null; active: boolean;
      beer_name?: string | null; producer?: string | null; beer_type?: string | null; abv?: number | null;
      given_offset?: number | null; received_offset?: number | null;
    }>;

    const activePins = participants.filter((p) => p.active).map((p) => p.pin);
    const activeCount = activePins.length;

    // Votes for current round
    const votesRes = await supabase
      .from('votes')
      .select('pin,value,extra_value')
      .eq('round', round);
    if (votesRes.error) throw votesRes.error;
    const voteRows = ((votesRes.data as any[]) || []) as Array<{ pin: string; value: number; extra_value?: number | null }>;
    const votedPins = voteRows.map((v) => v.pin as string);
    const votedCount = voteRows.filter((v) => activePins.includes(v.pin as string)).length;

    // Per-user reveals for current round (only those who chose to reveal)
    const revealKey = `revealed_pins_round_${round}`;
    const revealedPinsRes = await supabase
      .from('app_state')
      .select('text_value')
      .eq('key', revealKey)
      .maybeSingle();
    if (revealedPinsRes.error && (revealedPinsRes.error as any).code !== 'PGRST116') throw revealedPinsRes.error;
    let revealedPins: string[] = [];
    try {
      const txt = (revealedPinsRes.data as any)?.text_value || '[]';
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) revealedPins = parsed.filter((x) => typeof x === 'string');
    } catch {
      revealedPins = [];
    }
    const revealedVotes = voteRows
      .filter((v) => revealedPins.includes(v.pin))
      .map((v) => ({ pin: v.pin, value: v.value }));
    const revealedVotesExtra = voteRows
      .filter((v) => revealedPins.includes(v.pin) && typeof v.extra_value === 'number')
      .map((v) => ({ pin: v.pin, value: Number(v.extra_value) }));

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
    const userGiven = participants.map((p) => {
      const raw = totalsMap[p.pin] ?? 0;
      const off = Number(p.given_offset ?? 0);
      return { pin: p.pin, total: Math.max(0, raw - off) };
    });

    // Pair totals (giver -> recipient across all rounds)
    const votesPairsRes = await supabase
      .from('votes')
      .select('pin,recipient_pin,value,extra_value,round');
    if (votesPairsRes.error) throw votesPairsRes.error;
    const pairTotals: Array<{ from: string; to: string; total: number }> = [];
    const pairTotalsExtra: Array<{ from: string; to: string; total: number }> = [];
    {
      const rows = ((votesPairsRes.data as any[]) || []) as Array<{ pin: string; recipient_pin: string; value: number; extra_value?: number | null; round: number }>;
      // Gather revealed pins per round
      const revealedAllRes = await supabase
        .from('app_state')
        .select('key,text_value')
        .like('key', 'revealed_pins_round_%');
      if (revealedAllRes.error && (revealedAllRes.error as any).code !== 'PGRST116') throw revealedAllRes.error;
      const roundToRevealed = new Map<number, Set<string>>();
      for (const r of ((revealedAllRes.data as any[]) || [])) {
        const key: string = String((r as any).key || '');
        const m = key.match(/revealed_pins_round_(\d+)/);
        if (!m) continue;
        const rnd = Number(m[1] || 0);
        let arr: string[] = [];
        try {
          const txt = (r as any)?.text_value || '[]';
          const parsed = JSON.parse(txt);
          if (Array.isArray(parsed)) arr = parsed.filter((x: any) => typeof x === 'string');
        } catch {}
        roundToRevealed.set(rnd, new Set(arr));
      }
      const pairAgg = new Map<string, number>();
      const pairAggExtra = new Map<string, number>();
      for (const r of rows) {
        const from = String((r as any).pin || '');
        const to = String((r as any).recipient_pin || '');
        const rnd = Number((r as any).round || 0);
        if (!from || !to) continue;
        const revealedSet = roundToRevealed.get(rnd) || new Set<string>();
        if (!revealedSet.has(from)) continue; // only include votes from givers who have revealed in that round
        const key = `${from}|${to}`;
        const v = Number((r as any).value) || 0;
        pairAgg.set(key, (pairAgg.get(key) ?? 0) + v);
        const vx = (r as any).extra_value;
        if (typeof vx === 'number') {
          const vv = Number(vx) || 0;
          pairAggExtra.set(key, (pairAggExtra.get(key) ?? 0) + vv);
        }
      }
      // subtract pair offsets baseline if present
      const pairOffsetsRes = await supabase.from('app_state').select('text_value').eq('key','pair_offsets').maybeSingle();
      if (pairOffsetsRes.error && (pairOffsetsRes.error as any).code !== 'PGRST116') throw pairOffsetsRes.error;
      let offsets: Record<string, number> = {};
      try {
        const txt = (pairOffsetsRes.data as any)?.text_value || '{}';
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === 'object') offsets = parsed as Record<string, number>;
      } catch {
        offsets = {};
      }
      for (const [k, total] of pairAgg.entries()) {
        const [from, to] = k.split('|');
        const baseline = Number(offsets[k] ?? 0);
        const adj = Math.max(0, total - baseline);
        if (adj > 0) pairTotals.push({ from, to, total: adj });
      }
      // For extra totals, no offsetting currently (kept independent)
      for (const [k, total] of pairAggExtra.entries()) {
        const [from, to] = k.split('|');
        const adj = Math.max(0, total);
        if (adj > 0) pairTotalsExtra.push({ from, to, total: adj });
      }
    }

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
    const userReceived = participants.map((p) => {
      const raw = recvMap[p.pin] ?? 0;
      const off = Number(p.received_offset ?? 0);
      return { pin: p.pin, total: Math.max(0, raw - off) };
    });

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
        revealedVotes,
      },
      votesExtra: {
        revealedVotes: revealedVotesExtra,
      },
      activeCount,
      votedCount,
      reveal,
      round,
      picks,
      loginsLocked,
      userGiven,
      userReceived,
      revealedRound,
      pickedRound,
      roundStarted,
      allowReveal,
      pairTotals,
      pairTotalsExtra,
    });
  } catch (e: any) {
    console.error('STATUS_ERROR', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}


