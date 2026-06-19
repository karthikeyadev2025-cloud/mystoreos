-- Track return details so a reopened bill shows what was returned, when,
-- and how much was refunded — instead of just a bare 'Returned' status
-- with no audit trail.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_mode TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS returned_items JSONB DEFAULT NULL;

SELECT 'return tracking columns added to orders' AS status;
