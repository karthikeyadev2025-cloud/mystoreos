-- ─────────────────────────────────────────────────────────────────────────
-- Phone-based bill reconciliation: every bill is tagged with the customer's
-- phone (normalized to last 10 digits, just numerals), so when the customer
-- later creates a MyStore OS account with the same phone, their past bills
-- automatically appear in "My Bills" — no manual claim step needed.
--
-- The orders table already had user_id, but for walk-in bills the shop
-- enters customer_phone but no user account exists yet. We encoded phone
-- into a synthetic user_id string (`walk-in:Name:9063878382`) which made
-- querying by phone awkward. A dedicated indexed column is the clean fix.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Index for the union lookup in getUserOrders(): rows where user_id = me
-- OR customer_phone = my normalized phone. Without an index this would be
-- a sequential scan over the entire orders table for every customer load.
CREATE INDEX IF NOT EXISTS orders_customer_phone_idx
  ON orders (customer_phone)
  WHERE customer_phone IS NOT NULL;

-- Backfill: parse the phone out of existing 'walk-in:Name:phone…' user_id
-- strings so historical bills work too. Only updates rows that don't
-- already have customer_phone set.
UPDATE orders
SET customer_phone = REGEXP_REPLACE(
  COALESCE(SPLIT_PART(user_id, ':', 3), ''),
  '\D', '', 'g'
)
WHERE customer_phone IS NULL
  AND user_id LIKE 'walk-in:%'
  AND SPLIT_PART(user_id, ':', 3) IS NOT NULL
  AND LENGTH(REGEXP_REPLACE(SPLIT_PART(user_id, ':', 3), '\D', '', 'g')) BETWEEN 10 AND 15;

-- Trim backfilled phones to last 10 digits for consistent matching with
-- new bills (which save the normalized form).
UPDATE orders
SET customer_phone = RIGHT(customer_phone, 10)
WHERE customer_phone IS NOT NULL
  AND LENGTH(customer_phone) > 10;
