-- ═══════════════════════════════════════════════════════════════════════
-- Unit support for distributor wholesale products — a distributor
-- selling something like pickles or honey needs to specify whether
-- they're priced per jar, per box/case, or per piece. This was
-- completely missing — the catalog only ever had a flat price with no
-- unit context at all.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS unit text;

SELECT 'distributor_products.unit column added' AS status;
