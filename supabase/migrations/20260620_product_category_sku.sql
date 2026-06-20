-- Add product category + SKU/internal code — both were entirely absent
-- from the products table. The only "category" data anywhere in the app
-- was a weak 6-keyword name-guesser used purely for the customer
-- storefront's filter pills (rice/oil/dal/soap/milk/shampoo, everything
-- else dumped into "grocery") — there was no way for a shop owner to
-- actually set a real category, and no SKU/internal product code concept
-- existed at all.
--
-- category: free text but the UI offers a curated picker of common
-- retail categories (Grocery, Apparel, Electronics, etc.) so storefront
-- filtering stays meaningful instead of fragmenting into one-off typos.
-- sku: shop owner's own internal product code (barcode is separate —
-- many shops want a shorter internal reference code too).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT NULL;

-- Index for fast storefront category filtering at scale
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category) WHERE category IS NOT NULL;

SELECT 'category and sku columns added to products' AS status;
