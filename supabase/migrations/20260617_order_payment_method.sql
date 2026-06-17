-- Add payment method to orders table
-- Values: Cash, UPI, Card, Credit
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';

SELECT 'payment_method column added to orders' AS status;
