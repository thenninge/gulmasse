import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = typeof (body as any)?.pin === 'string' ? (body as any).pin : null;
    if (!pin) return NextResponse.json({ error: 'Missing pin' }, { status: 400 });

    // current round
    const roundRes = await supabase.from('app_state').select('int_value').eq('key', 'current_round').maybeSingle();
    if (roundRes.error) throw roundRes.error;
    const round = Number((roundRes.data as any)?.int_value ?? 1);
    const key = `revealed_pins_round_${round}`;

    const getRes = await supabase.from('app_state').select('text_value').eq('key', key).maybeSingle();
    if (getRes.error && (getRes.error as any).code !== 'PGRST116') throw getRes.error;
    let arr: string[] = [];
    try {
      const txt = (getRes.data as any)?.text_value || '[]';
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) arr = parsed.filter((x) => typeof x === 'string');
    } catch {
      arr = [];
    }
    if (!arr.includes(pin)) arr.push(pin);
    const { error } = await (supabase.from('app_state') as any).upsert(
      { key, text_value: JSON.stringify(arr) },
      { onConflict: 'key' }
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


