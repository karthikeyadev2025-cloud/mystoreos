-- ============================================================
-- SECURITY FIX ROUND 2: Fix remaining open policies
-- products_update_owner and products_delete_owner show qual=true
-- (should restrict to shop_id = auth.uid())
-- users_delete_admin shows qual=true (anyone can delete users!)
-- ============================================================

-- ---- products ----
-- update_owner and delete_owner show qual=true — drop and recreate properly
DROP POLICY IF EXISTS "products_update_owner" ON public.products;
DROP POLICY IF EXISTS "products_delete_owner" ON public.products;

CREATE POLICY "products_update_owner" ON public.products
  FOR UPDATE
  USING (shop_id = auth.uid())
  WITH CHECK (shop_id = auth.uid());

CREATE POLICY "products_delete_owner" ON public.products
  FOR DELETE
  USING (shop_id = auth.uid());

-- ---- users ----
-- users_delete_admin shows qual=true = anyone can delete any user!
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ---- site_config ----
-- site_config_read_all is a duplicate of public_read_v1.5 — remove redundancy
DROP POLICY IF EXISTS "site_config_read_all" ON public.site_config;

-- ============================================================
-- FINAL VERIFY — should return zero rows with qual='true'
-- except distributor_products read and products read (intentional)
-- ============================================================
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
ORDER BY tablename;
