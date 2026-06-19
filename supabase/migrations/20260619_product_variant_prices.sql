-- Per-variant pricing — e.g. a Rice Bag product sold as 5kg / 20kg / 50kg,
-- each at a genuinely different price (previously every variant of a
-- product was forced to share the single `price` field; switching variants
-- in the POS only changed the display label, never the billed amount —
-- a real billing-accuracy bug for any weight/size-based product).
--
-- Backward compatible by design: variant_prices is NULL by default, so
-- every existing product keeps working exactly as before (one shared
-- price across all variants) until a shop owner explicitly sets per-
-- variant pricing for a product. The old `variants` comma-separated
-- string column is untouched and still used as a fallback when
-- variant_prices is not set.
--
-- Shape: [{"name": "5kg", "price": 350, "stock": 0}, {"name": "20kg", "price": 1300, "stock": 0}]
-- `stock` per variant is optional and defaults to 0 (not tracked separately
-- unless the shop owner sets it) — total product stock remains the
-- authoritative figure used everywhere else in the app.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variant_prices JSONB DEFAULT NULL;

SELECT 'variant_prices column added to products — backward compatible' AS status;
