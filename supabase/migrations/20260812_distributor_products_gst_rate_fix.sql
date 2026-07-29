-- Migration 20260812: Ensure all distributor_products columns exist and reload PostgREST schema cache
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 0;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS hsn_code text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS pack_size integer;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS barcode_format text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS image_url text;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'distributor_products columns & schema cache reloaded' AS status;
