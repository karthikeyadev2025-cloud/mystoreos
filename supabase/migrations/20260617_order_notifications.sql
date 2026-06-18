-- Add shopkeeper communication fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shop_message TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ DEFAULT NULL;

SELECT 'order notification columns added' AS status;
