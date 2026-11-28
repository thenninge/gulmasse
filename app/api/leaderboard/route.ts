import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getLeaderboardKey } from '@/lib/leaderboardKey';
import { computeResults, type ExportParticipant } from '@/lib/exportCsv';
import { loadRevealedByRound } from '@/lib/reveals';

/**
 * Public Live Leaderboard data, protected by the secret ?k= key.
 * Shows a vote only once it is revealed in the app – same rule as the app's own
 * overview: «Avslør min stemme», «Avslør alle stemmer» or «Auto-avslør stemmer».
 */
const FACTOR = 0.5; // same default weighting as the lobby: terning + 0,5 × ekstra

type Participant = ExportParticipant & { active: boolean; beer_image_url?: string | null };
type Vote = { pin: string; recipient_pin: string | null; value: number; extra_value: number | null; round: number };
type StateRow = { key: string; int_value: number | null; bool_value: boolean | null; text_value?: string | null };

export async function GET(request: Request) {
  try {
    const k = new URL(request.url).searchParams.get('k') || '';
    const key = await getLeaderboardKey();
    if (!key || k !== key) {
      return NextResponse.json({ error: 'Ugyldig eller utløpt lenke' }, { status: 401 });
    }

    const [pRes, vRes, pkRes, sRes, revealed] = await Promise.all([
      supabase
        .from('participants')
        .select('pin,nickname,active,beer_name,producer,beer_type,abv,beer_image_url')
        .order('created_at', { ascending: true }),
      supabase.from('votes').select('pin,recipient_pin,value,extra_value,round,created_at').order('created_at', { ascending: true }),
      supabase.from('picks').select('pin,created_at').order('created_at', { ascending: true }),
      supabase.from('app_state').select('key,int_value,bool_value,text_value').in('key', ['current_round', 'picked_round', 'round_started', 'award_unlocked', 'wheel_spin_at']),
      loadRevealedByRound(),
    ]);
    for (const r of [pRes, vRes, pkRes, sRes]) if (r.error) throw r.error;
    const participants = (pRes.data as Participant[]) || [];
    const lockedVotes = (vRes.data as Vote[]) || [];
    // Only votes the giver has revealed (in that round) are shown anywhere on the leaderboard
    const votes = lockedVotes.filter((v) => revealed.get(Number(v.round))?.has(v.pin) === true);
    const pickRows = (pkRes.data as Array<{ pin: string; created_at: string | null }>) || [];
    const picks = pickRows.map((p) => p.pin);
    const state = new Map(((sRes.data as StateRow[]) || []).map((r) => [r.key, r]));
    const round = Number(state.get('current_round')?.int_value ?? 1);
    const pickedRound = Number(state.get('picked_round')?.int_value ?? 0);
    const roundStarted = state.get('round_started')?.bool_value === true;
    // «Nå snurrer hjulet!!» only right after someone actually spun the official wheel
    const spinAt = Date.parse(state.get('wheel_spin_at')?.text_value || '');
    const lastPickAt = Date.parse(pickRows[pickRows.length - 1]?.created_at || '');
    const spinningNow =
      roundStarted && Number.isFinite(spinAt) && Date.now() - spinAt < 25_000 && !(Number.isFinite(lastPickAt) && lastPickAt >= spinAt);

    const nameOf = (pin: string) => {
      const p = participants.find((x) => x.pin === pin);
      return (p?.nickname || '').trim() || '?';
    };

    // Pair maps (giver -> recipient) from ALL votes
    const pair: Record<string, Record<string, number>> = {};
    const extra: Record<string, Record<string, number>> = {};
    for (const v of votes) {
      if (!v.recipient_pin) continue;
      (pair[v.pin] ??= {})[v.recipient_pin] = (pair[v.pin]?.[v.recipient_pin] ?? 0) + (Number(v.value) || 0);
      if (typeof v.extra_value === 'number') {
        (extra[v.pin] ??= {})[v.recipient_pin] = (extra[v.pin]?.[v.recipient_pin] ?? 0) + v.extra_value;
      }
    }
    const results = computeResults(participants, pair, extra, FACTOR);

    // Each presented beer, in the order the wheel picked them
    const presented = pickRows.map(({ pin, created_at: pickedAt }) => {
      const vs = votes.filter((v) => v.recipient_pin === pin);
      const beerSum = vs.reduce((a, v) => a + (Number(v.value) || 0), 0);
      const extraSum = vs.reduce((a, v) => a + (Number(v.extra_value) || 0), 0);
      const p = participants.find((x) => x.pin === pin);
      return {
        pin,
        name: nameOf(pin),
        beer: (p?.beer_name || '').trim(),
        votes: vs.length,
        avgBeer: vs.length ? beerSum / vs.length : null,
        avgExtra: vs.length ? extraSum / vs.length : null,
        sum: beerSum + FACTOR * extraSum,
        round: vs.length ? Math.min(...vs.map((v) => Number(v.round))) : null,
        pickedAt,
      };
    });

    // Standings after each presented beer (cumulative) – for the race chart
    const progression: Array<{ label: string; totals: Record<string, number> }> = [];
    const running: Record<string, number> = Object.fromEntries(participants.map((p) => [p.pin, 0]));
    for (const b of presented) {
      for (const v of votes.filter((x) => x.recipient_pin === b.pin)) {
        running[b.pin] = (running[b.pin] ?? 0) + (Number(v.value) || 0) + FACTOR * (Number(v.extra_value) || 0);
      }
      progression.push({ label: b.name, totals: { ...running } });
    }

    // Who has been most generous (sum of dice given, per category)
    const givers = participants
      .map((p) => {
        const vs = votes.filter((v) => v.pin === p.pin);
        const beerGiven = vs.reduce((a, v) => a + (Number(v.value) || 0), 0);
        const extraGiven = vs.reduce((a, v) => a + (Number(v.extra_value) || 0), 0);
        return { pin: p.pin, name: nameOf(p.pin), votes: vs.length, beerGiven, extraGiven, total: beerGiven + extraGiven };
      })
      .filter((g) => g.votes > 0)
      .sort((a, b) => b.total - a.total || b.beerGiven - a.beerGiven || a.name.localeCompare(b.name, 'nb'));

    const activeCount = participants.filter((p) => p.active).length;
    const presenterPin = pickedRound === round && picks.length ? picks[picks.length - 1] : null;
    const presenter = presenterPin ? participants.find((p) => p.pin === presenterPin) : null;
    const votesThisRound = votes.filter((v) => Number(v.round) === round);
    const lockedThisRound = lockedVotes.filter((v) => Number(v.round) === round).length;
    const rated = presented.filter((b) => b.votes > 0 && b.avgBeer != null);
    const best = rated.length
      ? rated.reduce((a, b) => ((b.avgBeer ?? 0) + FACTOR * (b.avgExtra ?? 0) > (a.avgBeer ?? 0) + FACTOR * (a.avgExtra ?? 0) ? b : a))
      : null;

    return NextResponse.json(
      {
        factor: FACTOR,
        round,
        awardUnlocked: state.get('award_unlocked')?.bool_value === true,
        status: presenter ? 'voting' : spinningNow ? 'spinning' : roundStarted ? 'ready' : picks.length === 0 ? 'waiting' : 'between',
        presenter: presenter
          ? {
              pin: presenter.pin,
              name: nameOf(presenter.pin),
              beer: (presenter.beer_name || '').trim(),
              producer: (presenter.producer || '').trim(),
              type: (presenter.beer_type || '').trim(),
              abv: presenter.abv != null ? Number(presenter.abv) : null,
              image: presenter.beer_image_url || null,
              votes: votesThisRound.length, // revealed
              locked: lockedThisRound, // locked in the app (revealed or not)
              active: activeCount,
              // Each locked vote this round as [øl, presentasjon], oldest first – anonymous.
              // Lets the page animate new throws (both dice) as they come in.
              // Third element: an anonymous, stable key per vote (its position among ALL locked votes), so the page
              // can tell exactly which votes were just revealed – a reveal can surface an older vote.
              throws: votesThisRound.map((v) => [Number(v.value) || 0, Number(v.extra_value) || 0, `${round}-${lockedVotes.indexOf(v)}`]),
              // The presenter's vote on their OWN beer (for «6-er til Tomas – FRA Tomas!»); other votes stay anonymous
              selfVote: (() => {
                const own = votesThisRound.find((v) => v.pin === presenter.pin);
                return own ? [Number(own.value) || 0, Number(own.extra_value) || 0] : null;
              })(),
              avgExtra: votesThisRound.length
                ? votesThisRound.reduce((a, v) => a + (Number(v.extra_value) || 0), 0) / votesThisRound.length
                : null,
              avgBeer: votesThisRound.length
                ? votesThisRound.reduce((a, v) => a + (Number(v.value) || 0), 0) / votesThisRound.length
                : null,
            }
          : null,
        standings: results.map((r) => ({
          place: r.place,
          pin: r.pin,
          name: r.name,
          beer: r.beer,
          producer: r.producer,
          type: r.type,
          abv: r.abv,
          image: participants.find((p) => p.pin === r.pin)?.beer_image_url || null,
          beerPoints: r.beerPoints,
          extraPoints: r.extraPoints,
          sum: r.sum,
          presented: picks.includes(r.pin),
        })),
        presented,
        progression,
        givers,
        best: best ? { name: best.name, beer: best.beer, avgBeer: best.avgBeer, avgExtra: best.avgExtra } : null,
        counts: { presented: picks.length, participants: participants.length, votes: votes.length, locked: lockedVotes.length },
        updatedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: unknown) {
    console.error('LEADERBOARD_ERROR', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
