import { randomBytes } from 'crypto';
import { supabase } from '@/lib/supabase';

/** Secret for the public /leaderboard?k=… link, stored in app_state so the host can rotate it. */
const KEY = 'leaderboard_key';

function newKey(): string {
  return randomBytes(9).toString('base64url'); // 12 URL-safe chars
}

export async function getLeaderboardKey(): Promise<string | null> {
  const res = await supabase.from('app_state').select('text_value').eq('key', KEY).maybeSingle();
  if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
  return (res.data as { text_value?: string | null } | null)?.text_value || null;
}

export async function setNewLeaderboardKey(): Promise<string> {
  const key = newKey();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up = await (supabase.from('app_state') as any).upsert({ key: KEY, text_value: key }, { onConflict: 'key' });
  if (up.error) throw up.error;
  return key;
}

export async function ensureLeaderboardKey(): Promise<string> {
  return (await getLeaderboardKey()) || setNewLeaderboardKey();
}
