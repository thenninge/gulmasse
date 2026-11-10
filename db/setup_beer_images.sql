-- Lim inn i Supabase → SQL Editor → Run
-- 1) Kolonne for bilde-URL
-- 2) Public storage-bucket «beer-images» + policies

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS beer_image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'beer-images',
  'beer-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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

SELECT column_name FROM information_schema.columns
WHERE table_name = 'participants' AND column_name = 'beer_image_url';

SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'beer-images';
