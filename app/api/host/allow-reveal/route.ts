import { NextResponse } from 'next/server';
import { assertHost } from '@/lib/host';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    assertHost(request);
    // Mark allow_reveal flag so UI enables each user to reveal their own vote
    const { error } = await (supabase.from('app_state') as any)
      .upsert({ key: 'allow_reveal', bool_value: true }, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.status || 500;
    return NextResponse.json({ error: 'Server error' }, { status: code });
  }
}


