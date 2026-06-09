-- ============================================================
-- Proper relationship model for shops ↔ distributors ↔ CAs
--
-- Problem: Distributor, CA and Customer dashboards all called getAllShops(),
-- so every distributor and CA saw EVERY shop on the platform. Correct model:
--   - Customers: see all shops that are visible in search (hide_from_search=false)
--   - Distributors: see only shops they have a wholesale relationship with
--     (an existing stock_orders row links shop_id ↔ distributor_id)
--   - CAs: see only shops that explicitly assigned them as their accountant
--
-- This migration adds the CA link (shop assigns one CA by phone) and the RLS
-- so a CA can read only their assigned shops' orders. The distributor link
-- already exists implicitly via stock_orders (shop_id + distributor_id).
-- ============================================================

-- Shop's assigned accountant (NULL = none). Set by the shop in Settings.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ca_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_ca_id ON public.users(ca_id) WHERE ca_id IS NOT NULL;

-- ── Orders RLS: CA reads only orders of shops that assigned them ──
-- Previously orders_read_shop allowed role='ca' to read ALL orders. Tighten it
-- so a CA only sees orders for shops where users.ca_id = the CA's profile id.
DROP POLICY IF EXISTS "orders_read_shop" ON public.orders;
CREATE POLICY "orders_read_shop" ON public.orders
  FOR SELECT
  USING (
    shop_id = public.current_profile_id()
    OR user_id = public.current_profile_id()::text
    OR public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'ca'
      AND shop_id IN (
        SELECT id FROM public.users WHERE ca_id = public.current_profile_id()
      )
    )
  );

-- A CA must be able to read the shop profile rows that assigned them (for the
-- client list + names/addresses). users_select already lets anon read shop
-- rows, so CAs can read shop profiles fine — no extra policy needed here.

SELECT 'ca_id link added; CA order access scoped to assigned shops' AS status;
