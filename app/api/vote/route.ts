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
    const { pin, value, extra } = voteBodySchema.parse(body);

    const exists = await supabase.from('participants').select('active').eq('pin', pin).maybeSingle();
    if (exists.error && exists.error.code !== 'PGRST116') throw exists.error;
    if (!exists.data) {
      return NextResponse.json({ error: 'PIN not found' }, { status: 404 });
    }
    if ((exists.data as any).active !== true) {
      return NextResponse.json({ error: 'Participant not active' }, { status: 400 });
    }

    // Find currently selected participant (last pick)
    const pickRes = await supabase
      .from('picks')
      .select('pin')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pickRes.error && pickRes.error.code !== 'PGRST116') throw pickRes.error;
    const recipientPin = (pickRes.data as any)?.pin as string | undefined;
    if (!recipientPin) {
      return NextResponse.json({ error: 'No selected participant to receive points' }, { status: 400 });
    }

    const round = await getCurrentRound();
    const payload: any = { pin, round, value, recipient_pin: recipientPin };
    if (typeof extra === 'number') {
      payload.extra_value = extra;
    }
    const { error } = await (supabase
      .from('votes') as any).upsert(payload, { onConflict: 'round,pin' });
    if (error) throw error;
    return NextResponse.json({ ok: true, round });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


