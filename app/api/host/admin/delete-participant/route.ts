import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';
import { conflict, countVotesForParticipant } from '@/lib/voteGuards';

export async function POST(request: Request) {
  try {
    assertHost(request);
    const body = await request.json().catch(() => ({}));
    const pin = String(body?.pin || '');
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Invalid pin' }, { status: 400 });
    }
    // Deleting cascades to the votes they gave and drops points they received.
    if ((await countVotesForParticipant(pin)) > 0) {
      return conflict(
        'Deltakeren har gitt eller fått stemmer og kan ikke slettes (poengene ville forsvunnet). Sett deltakeren som inaktiv via «Rediger» i stedet.',
      );
    }
    const del = await supabase.from('participants').delete().eq('pin', pin);
    if (del.error) throw del.error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status?: number }).status) || 500 : 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
