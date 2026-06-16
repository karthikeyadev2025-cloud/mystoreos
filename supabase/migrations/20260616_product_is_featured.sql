-- ============================================================
-- Featured products: lets a shop mark products as "Featured" so they show
-- in a dedicated rail at the top of their storefront. When a shop hasn't
-- marked any, the storefront auto-surfaces their newest products instead.
--
-- Idempotent + safe to run on the live DB (Supabase SQL editor).
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Optional speed-up for the storefront's "featured first" query.
CREATE INDEX IF NOT EXISTS idx_products_featured
  ON public.products (shop_id, is_featured);
