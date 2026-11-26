import { supabase } from '@/lib/supabase';
import { markRevealed } from '@/lib/reveals';

/**
 * Mark every vote cast in `round` as revealed, so it counts in lobby / podium /
 * award totals even if the voter never pressed «Avslør min stemme».
 */
export async function revealAllVotesInRound(round: number): Promise<void> {
  if (!Number.isFinite(round) || round < 1) return;
  const votesRes = await supabase.from('votes').select('pin').eq('round', round);
  if (votesRes.error) throw votesRes.error;
  const voters = ((votesRes.data as Array<{ pin: string }>) || []).map((v) => String(v.pin));
  await markRevealed(round, voters);
}
