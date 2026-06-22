-- ─────────────────────────────────────────────────────────────────────────
-- Per-shop sequential invoice numbers. Indian GST audits expect human-
-- friendly bill numbers like INV-001, INV-002, … per shop (or per
-- branch — each branch is its own shop record). The orders.id UUID is
-- great for uniqueness but useless for audit trail and customer
-- communication ('show me invoice 47' is what a CA asks for).
--
-- Design:
--   • orders.invoice_no INTEGER — the human number for that order.
--     Unique per shop. NULL for legacy orders (pre-migration).
--   • users.last_invoice_no INTEGER — running counter per shop.
--     placeOrder increments this and stamps the new value onto the
--     order in one transaction-safe call via the Postgres function
--     below.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS invoice_no INTEGER;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_invoice_no INTEGER NOT NULL DEFAULT 0;

-- Unique per shop (allows NULL for legacy orders without invoice_no).
CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_no_per_shop_idx
  ON orders (shop_id, invoice_no)
  WHERE invoice_no IS NOT NULL;

-- Atomic increment-and-return so two concurrent placeOrder calls can't
-- both grab the same invoice_no. SECURITY DEFINER so it runs with the
-- function-owner's privileges (typically the schema owner) and can
-- bypass user-level RLS — without this, RLS would block the client
-- from updating users.last_invoice_no since the client isn't the
-- target shop.
CREATE OR REPLACE FUNCTION next_invoice_no(p_shop_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  UPDATE users
    SET last_invoice_no = COALESCE(last_invoice_no, 0) + 1
    WHERE id = p_shop_id
    RETURNING last_invoice_no INTO v_next;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Shop % not found', p_shop_id;
  END IF;
  RETURN v_next;
END;
$$;

-- Backfill: stamp sequential invoice_no on existing orders within each
-- shop, ordered by created_at, and seed each shop's last_invoice_no to
-- the max so newly-placed orders continue the sequence cleanly.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY created_at) AS n
  FROM orders
  WHERE invoice_no IS NULL
)
UPDATE orders o SET invoice_no = numbered.n FROM numbered WHERE o.id = numbered.id;

UPDATE users u SET last_invoice_no = (
  SELECT COALESCE(MAX(invoice_no), 0) FROM orders WHERE shop_id = u.id
)
WHERE u.role = 'shop';
