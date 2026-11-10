import { NextResponse } from 'next/server';
import { pinSchema } from '@/lib/schemas';
import {
  BEER_IMAGE_BUCKET,
  BEER_IMAGE_MAX_BYTES,
  BEER_IMAGE_MIME,
} from '@/lib/beerImages';
import { getDemoStore, isLocalDemo } from '@/lib/demoStore';
import { supabase } from '@/lib/supabase';

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const pinRaw = String(form.get('pin') || '');
    const pin = pinSchema.parse(pinRaw);
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Mangler bildefil' }, { status: 400 });
    }
    if (!BEER_IMAGE_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Kun JPEG, PNG, WebP eller GIF' },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > BEER_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: 'Bildet må være under 5 MB' }, { status: 400 });
    }

    if (isLocalDemo()) {
      const store = getDemoStore();
      const p = store.participants.find((x) => x.pin === pin);
      if (!p) return NextResponse.json({ error: 'Ukjent PIN' }, { status: 404 });
      const buf = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${file.type};base64,${buf.toString('base64')}`;
      p.beer_image_url = dataUrl;
      return NextResponse.json({ ok: true, beer_image_url: dataUrl, demo: true });
    }

    const exists = await supabase.from('participants').select('pin').eq('pin', pin).maybeSingle();
    if (exists.error && (exists.error as { code?: string }).code !== 'PGRST116') throw exists.error;
    if (!exists.data) {
      return NextResponse.json({ error: 'Ukjent PIN' }, { status: 404 });
    }

    const ext = extForMime(file.type);
    const path = `${pin}/${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const up = await supabase.storage.from(BEER_IMAGE_BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });
    if (up.error) {
      const msg = up.error.message || 'Opplasting feilet';
      if (/bucket|not found|row-level security/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              'Bildelagring er ikke satt opp. Kjør db/setup_beer_images.sql i Supabase SQL Editor.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(BEER_IMAGE_BUCKET).getPublicUrl(path);
    const beer_image_url = pub?.publicUrl;
    if (!beer_image_url) {
      return NextResponse.json({ error: 'Kunne ikke hente bilde-URL' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd = await (supabase.from('participants') as any)
      .update({ beer_image_url })
      .eq('pin', pin);
    if (upd.error) {
      // Column missing
      if (/beer_image_url|column/i.test(upd.error.message || '')) {
        return NextResponse.json(
          {
            error:
              'Kolonnen beer_image_url mangler. Kjør db/setup_beer_images.sql i Supabase.',
          },
          { status: 503 },
        );
      }
      throw upd.error;
    }

    return NextResponse.json({ ok: true, beer_image_url });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    return NextResponse.json(
      { error: hasIssues ? 'Ugyldig forespørsel' : 'Server error' },
      { status: hasIssues ? 400 : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = pinSchema.parse(String((body as { pin?: string }).pin || ''));

    if (isLocalDemo()) {
      const store = getDemoStore();
      const p = store.participants.find((x) => x.pin === pin);
      if (!p) return NextResponse.json({ error: 'Ukjent PIN' }, { status: 404 });
      p.beer_image_url = null;
      return NextResponse.json({ ok: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd = await (supabase.from('participants') as any)
      .update({ beer_image_url: null })
      .eq('pin', pin);
    if (upd.error) throw upd.error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const hasIssues = typeof e === 'object' && e !== null && 'issues' in e;
    return NextResponse.json(
      { error: hasIssues ? 'Ugyldig forespørsel' : 'Server error' },
      { status: hasIssues ? 400 : 500 },
    );
  }
}
