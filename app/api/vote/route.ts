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

    const round = await getCurrentRound();
    // Require an official pick for this round before accepting votes
    const pickedRoundRes = await supabase
      .from('app_state')
      .select('int_value')
      .eq('key', 'picked_round')
      .maybeSingle();
    if (pickedRoundRes.error && pickedRoundRes.error.code !== 'PGRST116') throw pickedRoundRes.error;
    const pickedRound = Number((pickedRoundRes.data as any)?.int_value ?? 0);
    if (pickedRound !== round) {
      return NextResponse.json({ error: 'No chosen participant this round' }, { status: 409 });
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
    const payload: any = { pin, round, value, recipient_pin: recipientPin };
    if (typeof extra === 'number') payload.extra_value = extra;
    // A locked vote is final: insert (not upsert), so a second vote in the same
    // round – reload, old tab, double tap – is refused instead of overwriting.
    // «Reset stemmer» in Admin deletes the round's votes so everyone can vote again.
    const ins = await (supabase.from('votes') as any).insert(payload);
    if (ins.error) {
      if (ins.error.code === '23505') {
        return NextResponse.json({ error: 'Du har allerede låst stemmen din i denne runden.' }, { status: 409 });
      }
      throw ins.error;
    }
    return NextResponse.json({ ok: true, round });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


