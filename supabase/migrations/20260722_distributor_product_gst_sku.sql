-- ═══════════════════════════════════════════════════════════════════════
-- Product code (SKU), HSN, and GST rate for distributor products —
-- the real invoice format the client uses has a "Code" column
-- (269, 17, 31...) and proper GST-compliant invoicing needs HSN/GST
-- per item, but the catalog had no way to set any of these. The
-- invoice generation code was hardcoding hsn:'' and gstPct:0 for
-- every single item, regardless of what a real product actually is.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS hsn_code text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 0;

SELECT 'distributor_products.sku/hsn_code/gst_rate columns added' AS status;
