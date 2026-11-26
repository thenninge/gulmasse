import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { revealedByRoundFromRows } from '@/lib/reveals';

type ParticipantRow = {
  pin: string; nickname: string | null; active: boolean;
  beer_name?: string | null; producer?: string | null; beer_type?: string | null; abv?: number | null;
  beer_image_url?: string | null;
  given_offset?: number | null; received_offset?: number | null;
};
type AppStateRow = { key: string; int_value: number | null; bool_value: boolean | null; text_value: string | null };
type VoteRow = { pin: string; recipient_pin: string | null; value: number; extra_value?: number | null; round: number };

async function fetchParticipants(): Promise<ParticipantRow[]> {
  const withImage = await supabase
    .from('participants')
    .select('pin,nickname,active,beer_name,producer,beer_type,abv,beer_image_url,given_offset,received_offset')
    .order('created_at', { ascending: true });
  if (!withImage.error) return (withImage.data as ParticipantRow[]) || [];
  // Older schema without beer_image_url
  const fallback = await supabase
    .from('participants')
    .select('pin,nickname,active,beer_name,producer,beer_type,abv,given_offset,received_offset')
    .order('created_at', { ascending: true });
  if (fallback.error) throw fallback.error;
  return (fallback.data as ParticipantRow[]) || [];
}

async function fetchVotes(): Promise<VoteRow[]> {
  const withExtra = await supabase.from('votes').select('pin,recipient_pin,value,extra_value,round');
  if (!withExtra.error) return (withExtra.data as VoteRow[]) || [];
  // Older schema without extra_value
  const noExtra = await supabase.from('votes').select('pin,recipient_pin,value,round');
  if (noExtra.error) throw noExtra.error;
  return (noExtra.data as VoteRow[]) || [];
}

type EventLite = { id: string; slug: string; status: string | null; created_at: string | null };
type RegLite = { event_id: string; name: string; status: string; participant_pin: string | null };

/** Events + open registrations in parallel (tables may be missing → null). */
async function fetchEventsAndRegistrations(): Promise<{ events: EventLite[]; regs: RegLite[] } | null> {
  try {
    const [ev, rg] = await Promise.all([
      supabase.from('events').select('id,slug,status,created_at'),
      supabase
        .from('event_registrations')
        .select('event_id,name,status,participant_pin')
        .in('status', ['accepted', 'invited']),
    ]);
    if (ev.error || rg.error) return null;
    return { events: (ev.data as EventLite[]) || [], regs: (rg.data as RegLite[]) || [] };
  } catch {
    return null;
  }
}

/** Same choice as getActiveEvent(): active_event_slug, else newest non-archived. */
function pickActiveEvent(events: EventLite[], slug: string | null | undefined): EventLite | null {
  if (slug) {
    const bySlug = events.find((e) => e.slug === slug);
    if (bySlug) return bySlug;
  }
  const open = events
    .filter((e) => e.status !== 'archived')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return open[0] ?? null;
}

export async function GET() {
  try {
    // Everything in ONE parallel round-trip to the database (was ~19 sequential
    // calls). app_state and votes are each read once and derived in memory.
    const [stateRes, participants, allVotes, picksRes, eventData] = await Promise.all([
      supabase.from('app_state').select('key,int_value,bool_value,text_value'),
      fetchParticipants(),
      fetchVotes(),
      supabase.from('picks').select('pin').order('created_at', { ascending: true }),
      fetchEventsAndRegistrations(),
    ]);
    if (stateRes.error) throw stateRes.error;
    if (picksRes.error) throw picksRes.error;
    const stateRows = (stateRes.data as AppStateRow[]) || [];
    const state = new Map(stateRows.map((r) => [r.key, r]));
    const intOf = (k: string, d: number) => Number(state.get(k)?.int_value ?? d);
    const boolOf = (k: string) => state.get(k)?.bool_value === true;

    const round = intOf('current_round', 1);
    const reveal = boolOf('reveal_results');
    const loginsLocked = boolOf('logins_locked');
    const revealedRound = intOf('revealed_round', 0);
    const pickedRound = intOf('picked_round', 0);
    const roundStarted = boolOf('round_started');
    const allowReveal = boolOf('allow_reveal');
    const awardUnlocked = boolOf('award_unlocked');

    const activePins = participants.filter((p) => p.active).map((p) => p.pin);
    const activeCount = activePins.length;

    // Votes for current round
    const voteRows = allVotes.filter((v) => Number(v.round) === round);
    const votedPins = voteRows.map((v) => v.pin as string);
    const votedCount = voteRows.filter((v) => activePins.includes(v.pin as string)).length;

    // Per-user reveals (one row per reveal; legacy per-round arrays still read)
    const roundToRevealed = revealedByRoundFromRows(stateRows);
    const revealedPins: string[] = Array.from(roundToRevealed.get(round) ?? []);
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
    const totalsMap: Record<string, number> = {};
    for (const r of allVotes) {
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
    const votesPairsRows = allVotes;
    const pairTotals: Array<{ from: string; to: string; total: number }> = [];
    const pairTotalsExtra: Array<{ from: string; to: string; total: number }> = [];
    // Live (all votes) — used by host Full oversikt so scores can be verified before reveal
    const pairTotalsAll: Array<{ from: string; to: string; total: number }> = [];
    const pairTotalsExtraAll: Array<{ from: string; to: string; total: number }> = [];
    {
      const rows = votesPairsRows;
      const pairAgg = new Map<string, number>();
      const pairAggExtra = new Map<string, number>();
      const pairAggAll = new Map<string, number>();
      const pairAggExtraAll = new Map<string, number>();
      for (const r of rows) {
        const from = String((r as any).pin || '');
        const to = String((r as any).recipient_pin || '');
        const rnd = Number((r as any).round || 0);
        if (!from || !to) continue;
        const key = `${from}|${to}`;
        const v = Number((r as any).value) || 0;
        pairAggAll.set(key, (pairAggAll.get(key) ?? 0) + v);
        const vx = (r as any).extra_value;
        if (typeof vx === 'number') {
          const vv = Number(vx) || 0;
          pairAggExtraAll.set(key, (pairAggExtraAll.get(key) ?? 0) + vv);
        }
        const revealedSet = roundToRevealed.get(rnd) || new Set<string>();
        if (!revealedSet.has(from)) continue; // public matrices: only revealed givers
        pairAgg.set(key, (pairAgg.get(key) ?? 0) + v);
        if (typeof vx === 'number') {
          const vv = Number(vx) || 0;
          pairAggExtra.set(key, (pairAggExtra.get(key) ?? 0) + vv);
        }
      }
      // subtract pair offsets baseline if present
      let offsets: Record<string, number> = {};
      try {
        const txt = state.get('pair_offsets')?.text_value || '{}';
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
      for (const [k, total] of pairAggExtra.entries()) {
        const [from, to] = k.split('|');
        const adj = Math.max(0, total);
        if (adj > 0) pairTotalsExtra.push({ from, to, total: adj });
      }
      for (const [k, total] of pairAggAll.entries()) {
        const [from, to] = k.split('|');
        const baseline = Number(offsets[k] ?? 0);
        const adj = Math.max(0, total - baseline);
        if (adj > 0) pairTotalsAll.push({ from, to, total: adj });
      }
      for (const [k, total] of pairAggExtraAll.entries()) {
        const [from, to] = k.split('|');
        const adj = Math.max(0, total);
        if (adj > 0) pairTotalsExtraAll.push({ from, to, total: adj });
      }
    }

    // Aggregate total received points per user (across all rounds)
    const recvMap: Record<string, number> = {};
    for (const r of allVotes) {
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
    const picks = (((picksRes.data as any[]) || []) as Array<{ pin: string }>).map((r) => r.pin as string);

    // Expected guests: påmeldt/invitert uten koblet PIN (eller PIN som ikke finnes ennå)
    let expectedGuests: Array<{ name: string; status: string }> = [];
    const activeEvent = eventData ? pickActiveEvent(eventData.events, state.get('active_event_slug')?.text_value) : null;
    const regs = activeEvent && eventData ? eventData.regs.filter((r) => r.event_id === activeEvent.id) : null;
    if (regs) {
      const participantPins = new Set(participants.map((p) => p.pin));
      const participantNames = new Set(
        participants.map((p) => (p.nickname || '').trim().toLowerCase()).filter(Boolean),
      );
      const seen = new Set<string>();
      for (const r of regs) {
        const name = (r.name || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key) || participantNames.has(key)) continue;
        if (r.participant_pin && participantPins.has(r.participant_pin)) continue;
        seen.add(key);
        expectedGuests.push({ name, status: r.status });
      }
      expectedGuests.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    }

    return NextResponse.json({
      participants,
      expectedGuests,
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
      awardUnlocked,
      pairTotals,
      pairTotalsExtra,
      pairTotalsAll,
      pairTotalsExtraAll,
    });
  } catch (e: any) {
    console.error('STATUS_ERROR', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}


