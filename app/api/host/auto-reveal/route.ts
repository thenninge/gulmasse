import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

/**
 * «Auto-allow avslør» ON/OFF. While ON, everyone who has voted may always
 * reveal their own vote (no need for the host to press «Tillat avslør stemme»
 * every round). Persists until switched off.
 */
export async function POST(request: Request) {
  try {
    assertHost(request);
    const body = (await request.json().catch(() => ({}))) as { on?: unknown };
    if (typeof body.on !== 'boolean') {
      return NextResponse.json({ error: 'Mangler on: true/false' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const up = await (supabase.from('app_state') as any).upsert(
      { key: 'auto_allow_reveal', bool_value: body.on },
      { onConflict: 'key' },
    );
    if (up.error) throw up.error;
    return NextResponse.json({ ok: true, on: body.on });
  } catch (e: unknown) {
    const code =
      typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status?: number }).status) || 500 : 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}
