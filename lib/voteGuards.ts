import { supabase } from '@/lib/supabase';

/** Number of votes stored, optionally limited to one round. */
export async function countVotes(opts: { round?: number } = {}): Promise<number> {
  let query = supabase.from('votes').select('id', { count: 'exact', head: true });
  if (typeof opts.round === 'number') query = query.eq('round', opts.round);
  const res = await query;
  if (res.error) throw res.error;
  return res.count ?? 0;
}

/** Votes given by or received by a participant. */
export async function countVotesForParticipant(pin: string): Promise<number> {
  const res = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .or(`pin.eq.${pin},recipient_pin.eq.${pin}`);
  if (res.error) throw res.error;
  return res.count ?? 0;
}

export async function getIntState(key: string, fallback: number): Promise<number> {
  const res = await supabase.from('app_state').select('int_value').eq('key', key).maybeSingle();
  if (res.error && res.error.code !== 'PGRST116') throw res.error;
  const v = (res.data as { int_value?: number | null } | null)?.int_value;
  return v == null ? fallback : Number(v);
}

export function conflict(message: string) {
  return Response.json({ error: message }, { status: 409 });
}
