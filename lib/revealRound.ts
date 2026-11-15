import { supabase } from '@/lib/supabase';

/**
 * Mark every vote cast in `round` as revealed, so it counts in lobby / podium /
 * award totals even if the voter never pressed «Avslør min stemme».
 */
export async function revealAllVotesInRound(round: number): Promise<void> {
  if (!Number.isFinite(round) || round < 1) return;
  const votesRes = await supabase.from('votes').select('pin').eq('round', round);
  if (votesRes.error) throw votesRes.error;
  const voters = ((votesRes.data as Array<{ pin: string }>) || []).map((v) => String(v.pin));
  if (voters.length === 0) return;

  const key = `revealed_pins_round_${round}`;
  const getRes = await supabase.from('app_state').select('text_value').eq('key', key).maybeSingle();
  if (getRes.error && (getRes.error as { code?: string }).code !== 'PGRST116') throw getRes.error;
  let existing: string[] = [];
  try {
    const parsed = JSON.parse((getRes.data as { text_value?: string } | null)?.text_value || '[]');
    if (Array.isArray(parsed)) existing = parsed.filter((x) => typeof x === 'string');
  } catch {
    existing = [];
  }
  const merged = Array.from(new Set([...existing, ...voters]));
  if (merged.length === existing.length) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up = await (supabase.from('app_state') as any).upsert(
    { key, text_value: JSON.stringify(merged) },
    { onConflict: 'key' },
  );
  if (up.error) throw up.error;
}
