import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loginBodySchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = loginBodySchema.parse(body);
    const res = await supabase
      .from('participants')
      .select('pin,nickname,beer_name,producer,beer_type,abv,beer_image_url,active')
      .eq('pin', pin)
      .maybeSingle();
    if (res.error) {
      if (res.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      // Fallback without beer_image_url column
      const fallback = await supabase
        .from('participants')
        .select('pin,nickname,beer_name,producer,beer_type,abv,active')
        .eq('pin', pin)
        .maybeSingle();
      if (fallback.error && fallback.error.code !== 'PGRST116') throw fallback.error;
      if (!fallback.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ participant: fallback.data });
    }
    if (!res.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ participant: res.data });
  } catch (e: any) {
    const msg = e?.issues ? 'Invalid request' : 'Server error';
    const code = e?.issues ? 400 : e?.status || 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}


