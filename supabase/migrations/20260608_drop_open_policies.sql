-- ============================================================
-- SECURITY FIX: Drop all open/permissive "allow all" policies
-- These override the restricted policies because Supabase ORs
-- all PERMISSIVE policies — one open policy = table is open.
-- Run this in Supabase SQL Editor NOW.
-- ============================================================

-- ---- active_sessions ----
-- "sessions_all" has qual=true = fully open. Replace with own-row only.
DROP POLICY IF EXISTS "sessions_all" ON public.active_sessions;
CREATE POLICY "sessions_own" ON public.active_sessions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---- announcements ----
-- Drop the old open ones (read_all, update_all, write_all remain from old schema)
DROP POLICY IF EXISTS "announcements_read_all"   ON public.announcements;
DROP POLICY IF EXISTS "announcements_update_all" ON public.announcements;
DROP POLICY IF EXISTS "announcements_write_all"  ON public.announcements;
-- Keep: announcements_public_read (active=true) and announcements_admin_write (admin only)

-- ---- credits ----
-- All three are fully open (qual=true / null = no restriction)
DROP POLICY IF EXISTS "credits_read_all"   ON public.credits;
DROP POLICY IF EXISTS "credits_insert_all" ON public.credits;
DROP POLICY IF EXISTS "credits_update_all" ON public.credits;
-- Add proper restricted policies
CREATE POLICY "credits_read_parties" ON public.credits
  FOR SELECT USING (
    from_id = auth.uid() OR
    to_shop_id = auth.uid() OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "credits_insert_from" ON public.credits
  FOR INSERT WITH CHECK (from_id = auth.uid());
CREATE POLICY "credits_update_parties" ON public.credits
  FOR UPDATE USING (
    from_id = auth.uid() OR to_shop_id = auth.uid()
  );

-- ---- distributor_products ----
-- delete_all, update_all, write_all are open
DROP POLICY IF EXISTS "dist_products_delete_all" ON public.distributor_products;
DROP POLICY IF EXISTS "dist_products_update_all" ON public.distributor_products;
DROP POLICY IF EXISTS "dist_products_write_all"  ON public.distributor_products;
-- Add owner-restricted write policies
CREATE POLICY "dist_products_write_owner"  ON public.distributor_products
  FOR INSERT WITH CHECK (distributor_id = auth.uid());
CREATE POLICY "dist_products_update_owner" ON public.distributor_products
  FOR UPDATE USING (distributor_id = auth.uid());
CREATE POLICY "dist_products_delete_owner" ON public.distributor_products
  FOR DELETE USING (distributor_id = auth.uid());

-- ---- orders ----
-- orders_read_all and orders_update_all are open
DROP POLICY IF EXISTS "orders_read_all"   ON public.orders;
DROP POLICY IF EXISTS "orders_update_all" ON public.orders;
-- Add restricted policies
CREATE POLICY "orders_read_shop" ON public.orders
  FOR SELECT USING (
    shop_id = auth.uid() OR
    user_id = auth.uid()::text OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "orders_update_shop" ON public.orders
  FOR UPDATE USING (
    shop_id = auth.uid() OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ---- payment_history ----
-- payment_history_all has qual=true = fully open
DROP POLICY IF EXISTS "payment_history_all" ON public.payment_history;
CREATE POLICY "payment_history_own" ON public.payment_history
  FOR SELECT USING (
    user_id = auth.uid() OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ---- settings ----
-- settings_all is open and overrides settings_admin_only
DROP POLICY IF EXISTS "settings_all" ON public.settings;
-- Keep: settings_admin_only (already correct)

-- ---- site_config ----
-- admin_write_v1.5 has qual=true = fully open for ALL operations
-- site_config_live_patch allows anon writes (auth.uid() IS NULL) = dangerous
DROP POLICY IF EXISTS "admin_write_v1.5"                      ON public.site_config;
DROP POLICY IF EXISTS "site_config_live_patch"                ON public.site_config;
DROP POLICY IF EXISTS "site_config_client_passthrough_update" ON public.site_config;
DROP POLICY IF EXISTS "site_config_client_passthrough_write"  ON public.site_config;
DROP POLICY IF EXISTS "site_config_admin_update"              ON public.site_config;
DROP POLICY IF EXISTS "site_config_admin_write"               ON public.site_config;
-- Keep: public_read_v1.5 (SELECT only), add clean admin write
CREATE POLICY "site_config_admin_all" ON public.site_config
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ---- stock_orders ----
-- All three are open
DROP POLICY IF EXISTS "stock_orders_read_all"   ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_insert_all" ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_update_all" ON public.stock_orders;
CREATE POLICY "stock_orders_read_parties" ON public.stock_orders
  FOR SELECT USING (
    shop_id = auth.uid() OR
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('distributor', 'admin')
  );
CREATE POLICY "stock_orders_insert_shop" ON public.stock_orders
  FOR INSERT WITH CHECK (shop_id = auth.uid());
CREATE POLICY "stock_orders_update_parties" ON public.stock_orders
  FOR UPDATE USING (
    shop_id = auth.uid() OR
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('distributor', 'admin')
  );

-- ---- users ----
-- users_select_all and users_update_all are fully open — most critical
DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_update_all" ON public.users;
-- Add proper restricted policies
CREATE POLICY "users_select_own_or_admin" ON public.users
  FOR SELECT USING (
    id = auth.uid() OR
    role = 'shop' OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- VERIFY: Run this SELECT to confirm no open policies remain
-- Expected: zero rows with qual = 'true'
-- ============================================================
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
ORDER BY tablename;
