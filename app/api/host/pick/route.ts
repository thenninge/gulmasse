import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    const body = await request.json().catch(() => ({}));
    const requestedPin = typeof (body as any)?.pin === 'string' ? (body as any).pin : undefined;
    // current round
    const roundRes = await supabase.from('app_state').select('int_value').eq('key','current_round').maybeSingle();
    if (roundRes.error) throw roundRes.error;
    const round = Number((roundRes.data as any)?.int_value ?? 1);
    // block if already picked this round
    const pickedRoundRes = await supabase.from('app_state').select('int_value').eq('key','picked_round').maybeSingle();
    if (pickedRoundRes.error) throw pickedRoundRes.error;
    const pickedRound = Number((pickedRoundRes.data as any)?.int_value ?? 0);
    if (pickedRound === round) {
      return NextResponse.json({ error: 'Already picked this round' }, { status: 409 });
    }
    const participantsRes = await supabase
      .from('participants')
      .select('pin')
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (participantsRes.error) throw participantsRes.error;
    const activePins = ((participantsRes.data as any[]) || []).map((p: any) => p.pin as string);
    const pickedRes = await supabase.from('picks').select('pin').order('created_at', { ascending: true });
    if (pickedRes.error) throw pickedRes.error;
    const alreadyPicked = new Set(((pickedRes.data as any[]) || []).map((r: any) => r.pin as string));
    const candidates = activePins.filter((p) => !alreadyPicked.has(p));
    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No candidates left' }, { status: 409 });
    }
    let chosen = candidates[0];
    if (requestedPin && candidates.includes(requestedPin)) {
      chosen = requestedPin;
    } else {
      const idx = Math.floor(Math.random() * candidates.length);
      chosen = candidates[idx];
    }
    const ins = await (supabase.from('picks') as any).insert({ pin: chosen });
    if (ins.error) throw ins.error;
    const up = await (supabase.from('app_state') as any).upsert({ key: 'picked_round', int_value: round }, { onConflict: 'key' });
    if (up.error) throw up.error;
    await (supabase.from('app_state') as any).upsert({ key: 'round_started', bool_value: false }, { onConflict: 'key' });
    await (supabase.from('app_state') as any).upsert({ key: 'allow_reveal', bool_value: false }, { onConflict: 'key' });
    return NextResponse.json({ ok: true, pin: chosen });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


