-- ═══════════════════════════════════════════════════════════════════════
-- Real box/jar wholesale invoicing — matches the client's actual
-- invoice format exactly (Jars-per-box × Boxes-ordered = total Qty,
-- rate charged per individual unit).
--
-- pack_size = how many individual jars/units are in ONE box for this
-- product (a fixed spec of the product itself, e.g. "8 jars per box").
-- Null means the product isn't sold by the box at all — ordered as
-- plain individual units, same as before this feature existed.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS pack_size integer;

SELECT 'distributor_products.pack_size column added' AS status;
