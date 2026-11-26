import { supabase } from '@/lib/supabase';

/**
 * «Avslør min stemme» bookkeeping in app_state.
 *
 * Each reveal is its own row (`revealed_pins_round_<round>__<pin>`), so many
 * people pressing the button at the same moment can't overwrite each other.
 * The older format — one JSON array per round in `revealed_pins_round_<round>`
 * — is still read, so existing data keeps working.
 */
const KEY_RE = /^revealed_pins_round_(\d+)(?:__(\d{4}))?$/;

function pinRowKey(round: number, pin: string) {
  return `revealed_pins_round_${round}__${pin}`;
}

type Row = { key: string; text_value: string | null };

async function loadRows(): Promise<Row[]> {
  const res = await supabase.from('app_state').select('key,text_value').like('key', 'revealed_pins_round_%');
  if (res.error && (res.error as { code?: string }).code !== 'PGRST116') throw res.error;
  return ((res.data as Row[]) || []).filter((r) => KEY_RE.test(String(r.key)));
}

/** round -> set of PINs that have revealed in that round */
export async function loadRevealedByRound(): Promise<Map<number, Set<string>>> {
  const out = new Map<number, Set<string>>();
  for (const r of await loadRows()) {
    const m = String(r.key).match(KEY_RE);
    if (!m) continue;
    const round = Number(m[1]);
    const set = out.get(round) ?? new Set<string>();
    if (m[2]) {
      set.add(m[2]);
    } else {
      try {
        const parsed = JSON.parse(r.text_value || '[]');
        if (Array.isArray(parsed)) for (const x of parsed) if (typeof x === 'string') set.add(x);
      } catch {
        // ignore malformed legacy value
      }
    }
    out.set(round, set);
  }
  return out;
}

/** Mark the given PINs as revealed in `round` (idempotent, race-free). */
export async function markRevealed(round: number, pins: string[]): Promise<void> {
  const unique = Array.from(new Set(pins.filter((p) => /^\d{4}$/.test(p))));
  if (unique.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up = await (supabase.from('app_state') as any).upsert(
    unique.map((pin) => ({ key: pinRowKey(round, pin), text_value: JSON.stringify([pin]) })),
    { onConflict: 'key' },
  );
  if (up.error) throw up.error;
}

/** Remove all reveals for one round (both storage formats). */
export async function clearRevealsForRound(round: number): Promise<void> {
  const keys = (await loadRows())
    .map((r) => String(r.key))
    .filter((k) => Number(k.match(KEY_RE)?.[1]) === round);
  if (keys.length === 0) return;
  const del = await supabase.from('app_state').delete().in('key', keys);
  if (del.error) throw del.error;
}
