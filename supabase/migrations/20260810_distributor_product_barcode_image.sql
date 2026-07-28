-- ═══════════════════════════════════════════════════════════════════════
-- DISTRIBUTOR PRODUCT — BARCODE + IMAGE COLUMNS
--
-- FOUND WHILE AUDITING 17 externally-pushed commits before a client
-- demo. Two features were built with real UI and real API calls, but
-- the columns they write to were never added to distributor_products:
--
--   1. assignDistributorBarcode() writes barcode / barcode_format —
--      neither column existed. This is not a silent-data-loss bug,
--      it's a hard SAVE FAILURE: the insert/update would error.
--
--   2. The new "catalog product images" feature collects a base64
--      image in the UI (newProdImage) and includes it in the payload
--      as `image`, but addDistributorProduct/updateDistributorProduct
--      never read that field at all — so it was silently DROPPED.
--      Worse than the barcode case: no error, no signal, the
--      distributor uploads a photo, sees "success", and it never
--      saves. They would only discover this by refreshing the page.
--
-- Both closed the same way: add the columns, then wire the two API
-- functions to actually use them.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS barcode_format text;
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS image_url text;

-- A barcode is meant to be scanned to a specific product — duplicates
-- across the same distributor's own catalogue would make scanning
-- ambiguous (which of two products was just scanned?). Scoped to one
-- distributor, not global, since two different distributors' internal
-- barcodes are not required to be unique against each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_distributor_products_barcode
  ON public.distributor_products (distributor_id, barcode)
  WHERE barcode IS NOT NULL;

SELECT 'Distributor product barcode and image columns installed' AS status;
