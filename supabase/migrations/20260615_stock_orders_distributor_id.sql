-- ============================================================
-- Fix: stock_orders is missing the distributor_id column on the
-- LIVE database, so every query like
--   stock_orders?select=*&distributor_id=eq.<id>
-- returns HTTP 400 ("column stock_orders.distributor_id does not exist").
--
-- Impact: Distributor "Incoming Orders" can never load, and a shop's
-- wholesale restock order can't be linked to the distributor it was
-- placed with — the whole shop -> distributor order workflow is broken.
--
-- Idempotent and safe to run on the live DB (Supabase SQL editor).
-- ============================================================

-- 1) Add the missing column (FK to users; NULL = legacy/unlinked order)
ALTER TABLE public.stock_orders
  ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- 2) Index for the distributor_id lookups the app runs on every load
CREATE INDEX IF NOT EXISTS idx_stock_orders_distributor
  ON public.stock_orders(distributor_id);

-- 3) Re-scope RLS so each party sees only their own orders.
--    (Previously any distributor could read EVERY shop's orders.)
--    Uses the same helper functions the rest of the schema uses.
DROP POLICY IF EXISTS "stock_orders_read_parties"     ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_update_parties"   ON public.stock_orders;

CREATE POLICY "stock_orders_read_parties" ON public.stock_orders
  FOR SELECT USING (
    shop_id        = public.current_profile_id()
    OR distributor_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "stock_orders_update_parties" ON public.stock_orders
  FOR UPDATE USING (
    distributor_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );
