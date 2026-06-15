-- ============================================================
-- Storefront upgrade: allow each product to carry up to 4 photos
-- (an image gallery), in addition to the existing single image_url.
--
-- images is a JSONB array of public Supabase Storage URLs, e.g.
--   ["https://.../products/a.jpg", "https://.../products/b.jpg"]
-- image_url continues to hold the cover (first) image for backward
-- compatibility with anything still reading it.
--
-- Idempotent and safe to run on the live DB (Supabase SQL editor).
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Backfill: seed the gallery with the existing single image where present,
-- so products that already have a photo show it in the new gallery too.
UPDATE public.products
   SET images = jsonb_build_array(image_url)
 WHERE image_url IS NOT NULL
   AND image_url <> ''
   AND (images IS NULL OR images = '[]'::jsonb);
