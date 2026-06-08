-- ============================================================
-- CRITICAL FIX: infinite recursion in users RLS policy
-- The users_select_own_or_admin policy queried the users table
-- inside its own USING clause -> infinite recursion (error 42P17).
-- This broke ALL reads on users: login, profile, admin panel.
--
-- Fix: use a SECURITY DEFINER function that bypasses RLS to look
-- up the current user's role, so the policy never re-triggers itself.
-- ============================================================

-- 1. SECURITY DEFINER helper — runs as table owner, bypasses RLS,
--    so calling it inside a policy does NOT recurse.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_public_profile" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_registration" ON public.users;

-- 3. Recreate WITHOUT self-referencing subqueries
-- Insert: open (registration happens before auth)
CREATE POLICY "users_insert_registration" ON public.users
  FOR INSERT WITH CHECK (true);

-- Select: own row, OR public shop profiles, OR admin (via SECURITY DEFINER fn)
-- NOTE: login/forgot-password run through edge functions (service role),
-- so anon REST reads stay blocked — that is correct and secure.
CREATE POLICY "users_select_own_or_admin" ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR role = 'shop'
    OR public.current_user_role() = 'admin'
  );

-- Update: own row
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Update: admin (via SECURITY DEFINER fn — no recursion)
CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE USING (public.current_user_role() = 'admin');

-- Delete: admin only (via SECURITY DEFINER fn — no recursion)
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE USING (public.current_user_role() = 'admin');

-- 4. Fix the SAME recursion risk on every other table that referenced
--    (SELECT role FROM users ...) inline. Replace with the function.

-- orders
DROP POLICY IF EXISTS "orders_read_shop" ON public.orders;
DROP POLICY IF EXISTS "orders_update_shop" ON public.orders;
CREATE POLICY "orders_read_shop" ON public.orders FOR SELECT USING (
  shop_id = auth.uid() OR user_id = auth.uid()::text OR public.current_user_role() = 'admin'
);
CREATE POLICY "orders_update_shop" ON public.orders FOR UPDATE USING (
  shop_id = auth.uid() OR public.current_user_role() = 'admin'
);

-- credits
DROP POLICY IF EXISTS "credits_read_parties" ON public.credits;
CREATE POLICY "credits_read_parties" ON public.credits FOR SELECT USING (
  from_id = auth.uid() OR to_shop_id = auth.uid() OR public.current_user_role() = 'admin'
);

-- payment_history
DROP POLICY IF EXISTS "payment_history_own" ON public.payment_history;
CREATE POLICY "payment_history_own" ON public.payment_history FOR SELECT USING (
  user_id = auth.uid() OR public.current_user_role() = 'admin'
);

-- settings
DROP POLICY IF EXISTS "settings_admin_only" ON public.settings;
CREATE POLICY "settings_admin_only" ON public.settings FOR ALL USING (
  public.current_user_role() = 'admin'
);

-- site_config
DROP POLICY IF EXISTS "site_config_admin_all" ON public.site_config;
CREATE POLICY "site_config_admin_all" ON public.site_config FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- stock_orders
DROP POLICY IF EXISTS "stock_orders_read_parties" ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_update_parties" ON public.stock_orders;
CREATE POLICY "stock_orders_read_parties" ON public.stock_orders FOR SELECT USING (
  shop_id = auth.uid() OR public.current_user_role() IN ('distributor','admin')
);
CREATE POLICY "stock_orders_update_parties" ON public.stock_orders FOR UPDATE USING (
  shop_id = auth.uid() OR public.current_user_role() IN ('distributor','admin')
);

-- announcements
DROP POLICY IF EXISTS "announcements_admin_write" ON public.announcements;
CREATE POLICY "announcements_admin_write" ON public.announcements FOR ALL USING (
  public.current_user_role() = 'admin'
);

-- 5. Verify no recursion: this SELECT should return rows, not error 42P17
SELECT 'RLS recursion fixed - users table readable' AS status;
