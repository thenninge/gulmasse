import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    const participantsRes = await supabase
      .from('participants')
      .select('pin')
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (participantsRes.error) throw participantsRes.error;
    const activePins = (participantsRes.data || []).map((p) => p.pin as string);
    const pickedRes = await supabase.from('picks').select('pin').order('created_at', { ascending: true });
    if (pickedRes.error) throw pickedRes.error;
    const alreadyPicked = new Set((pickedRes.data || []).map((r) => r.pin as string));
    const candidates = activePins.filter((p) => !alreadyPicked.has(p));
    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No candidates left' }, { status: 409 });
    }
    const idx = Math.floor(Math.random() * candidates.length);
    const chosen = candidates[idx];
    const ins = await supabase.from('picks').insert({ pin: chosen });
    if (ins.error) throw ins.error;
    return NextResponse.json({ ok: true, pin: chosen });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


