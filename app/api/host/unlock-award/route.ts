import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { assertHost } from '@/lib/host';

export async function POST(request: Request) {
  try {
    assertHost(request);
    const { error } = await supabase
      .from('app_state')
      .upsert({ key: 'award_unlocked', bool_value: true }, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}


