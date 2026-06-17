-- Add label discount percentage to products
-- Used by Barcode Manager to print MRP-crossed price labels
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_pct integer NOT NULL DEFAULT 0;

SELECT 'discount_pct column added to products' AS status;
