import { NextResponse } from 'next/server';
import { voteBodySchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

async function getCurrentRound(): Promise<number> {
  const res = await supabase.from('app_state').select('int_value').eq('key','current_round').maybeSingle();
  if (res.error && res.error.code !== 'PGRST116') throw res.error;
  const round = (res.data as any)?.int_value ?? 1;
  return Number(round);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin, value } = voteBodySchema.parse(body);

    const exists = await supabase.from('participants').select('active').eq('pin', pin).maybeSingle();
    if (exists.error && exists.error.code !== 'PGRST116') throw exists.error;
    if (!exists.data) {
      return NextResponse.json({ error: 'PIN not found' }, { status: 404 });
    }
    if (exists.data.active !== true) {
      return NextResponse.json({ error: 'Participant not active' }, { status: 400 });
    }

    const round = await getCurrentRound();
    const { error } = await supabase
      .from('votes')
      .upsert({ pin, round, value }, { onConflict: 'round,pin' });
    if (error) throw error;
    return NextResponse.json({ ok: true, round });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


