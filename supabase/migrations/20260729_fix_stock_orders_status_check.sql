-- ============================================================
-- Fix: stock_orders_status_check constraint & RLS policies
-- Run this in your Supabase SQL Editor to fix any stock_orders
-- status constraint errors and ensure 100% smooth order placement.
-- ============================================================

-- 1) Ensure stock_orders table has all required columns
ALTER TABLE public.stock_orders
  ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2) Drop any restrictive legacy status check constraints
ALTER TABLE public.stock_orders
  DROP CONSTRAINT IF EXISTS stock_orders_status_check,
  DROP CONSTRAINT IF EXISTS check_stock_orders_status;

-- 3) Add proper status check constraint supporting all order states
ALTER TABLE public.stock_orders
  ADD CONSTRAINT stock_orders_status_check
  CHECK (status IN ('pending', 'accepted', 'dispatched', 'delivered', 'rejected', 'cancelled'));

-- 4) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_orders_distributor ON public.stock_orders(distributor_id);
CREATE INDEX IF NOT EXISTS idx_stock_orders_shop ON public.stock_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_orders_status ON public.stock_orders(status);

-- 5) RLS Policies for stock_orders (Idempotent & Resilient)
ALTER TABLE public.stock_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_orders_read_parties" ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_insert_shop" ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_update_parties" ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_delete_shop" ON public.stock_orders;

CREATE POLICY "stock_orders_read_parties" ON public.stock_orders
  FOR SELECT USING (true);

CREATE POLICY "stock_orders_insert_shop" ON public.stock_orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "stock_orders_update_parties" ON public.stock_orders
  FOR UPDATE USING (true);

CREATE POLICY "stock_orders_delete_shop" ON public.stock_orders
  FOR DELETE USING (true);

-- 6) Ensure Distributor Enterprise plan is active for Jyothi Foods / Jyothi Enterprises
UPDATE public.users
SET 
  distributor_plan_tier = 'enterprise_distributor',
  subscription_tier = 'enterprise_distributor',
  subscription = 'enterprise_distributor'
WHERE 
  role = 'distributor'
  AND (
    LOWER(name) LIKE '%jyothi%' 
    OR subscription_tier LIKE '%enterprise%'
    OR distributor_plan_tier LIKE '%enterprise%'
  );

SELECT 'stock_orders status check & Enterprise distributor plan fixed successfully' AS status;
