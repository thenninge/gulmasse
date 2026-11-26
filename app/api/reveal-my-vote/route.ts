import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { markRevealed } from '@/lib/reveals';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { pin?: unknown };
    const pin = typeof body?.pin === 'string' ? body.pin : null;
    if (!pin || !/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'Missing pin' }, { status: 400 });

    // current round
    const roundRes = await supabase.from('app_state').select('int_value').eq('key', 'current_round').maybeSingle();
    if (roundRes.error) throw roundRes.error;
    const round = Number((roundRes.data as { int_value?: number } | null)?.int_value ?? 1);

    // One row per reveal: simultaneous presses can't overwrite each other
    await markRevealed(round, [pin]);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status?: number }).status) || 500 : 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
