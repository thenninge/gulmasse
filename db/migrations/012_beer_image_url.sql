-- User-uploaded beer photos (URL from Supabase Storage)

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS beer_image_url TEXT;

-- Public bucket for beer images (run in Supabase SQL Editor if storage schema exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'beer-images',
  'beer-images',
  TRUE,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anon can upload/update/read (PIN app has no Supabase Auth users)
DROP POLICY IF EXISTS "beer_images_public_read" ON storage.objects;
CREATE POLICY "beer_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'beer-images');

DROP POLICY IF EXISTS "beer_images_anon_insert" ON storage.objects;
CREATE POLICY "beer_images_anon_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'beer-images');

DROP POLICY IF EXISTS "beer_images_anon_update" ON storage.objects;
CREATE POLICY "beer_images_anon_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'beer-images')
  WITH CHECK (bucket_id = 'beer-images');

DROP POLICY IF EXISTS "beer_images_anon_delete" ON storage.objects;
CREATE POLICY "beer_images_anon_delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'beer-images');
