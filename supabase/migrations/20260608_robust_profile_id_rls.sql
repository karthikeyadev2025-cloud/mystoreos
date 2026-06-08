-- ============================================================
-- ROBUST RLS: resolve profile id from auth user reliably
--
-- Problem: public.users.id was sometimes created independently of
-- auth.users.id (legacy/seed accounts), so RLS checks of the form
-- "id = auth.uid()" or "shop_id = auth.uid()" silently returned no
-- rows for those users — blocking their own data after login.
--
-- Fix: a SECURITY DEFINER function current_profile_id() that maps the
-- logged-in auth user to their profile row. It first tries id match
-- (new accounts where auth.uid() == users.id), then falls back to
-- matching the auth email ({phone}@mystore.internal) to users.phone.
-- This makes RLS correct for BOTH new and legacy accounts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.id = auth.uid()
     OR u.phone = split_part(
          (SELECT email FROM auth.users WHERE id = auth.uid()),
          '@', 1
        )
  LIMIT 1
$$;

-- Update current_user_role() to use the same resilient mapping
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role FROM public.users WHERE id = public.current_profile_id()
$$;

-- ---- users ----
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_select_own_or_admin" ON public.users FOR SELECT USING (
  id = public.current_profile_id() OR role = 'shop' OR public.current_user_role() = 'admin'
);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE
  USING (id = public.current_profile_id())
  WITH CHECK (id = public.current_profile_id());

-- ---- products ----
DROP POLICY IF EXISTS "products_write_owner" ON public.products;
DROP POLICY IF EXISTS "products_update_owner" ON public.products;
DROP POLICY IF EXISTS "products_delete_owner" ON public.products;
CREATE POLICY "products_write_owner"  ON public.products FOR INSERT WITH CHECK (shop_id = public.current_profile_id());
CREATE POLICY "products_update_owner" ON public.products FOR UPDATE USING (shop_id = public.current_profile_id()) WITH CHECK (shop_id = public.current_profile_id());
CREATE POLICY "products_delete_owner" ON public.products FOR DELETE USING (shop_id = public.current_profile_id());

-- ---- orders ----
DROP POLICY IF EXISTS "orders_read_shop" ON public.orders;
DROP POLICY IF EXISTS "orders_update_shop" ON public.orders;
CREATE POLICY "orders_read_shop" ON public.orders FOR SELECT USING (
  shop_id = public.current_profile_id() OR user_id = public.current_profile_id()::text OR public.current_user_role() = 'admin'
);
CREATE POLICY "orders_update_shop" ON public.orders FOR UPDATE USING (
  shop_id = public.current_profile_id() OR public.current_user_role() = 'admin'
);

-- ---- credits ----
DROP POLICY IF EXISTS "credits_read_parties" ON public.credits;
DROP POLICY IF EXISTS "credits_insert_from" ON public.credits;
DROP POLICY IF EXISTS "credits_update_parties" ON public.credits;
CREATE POLICY "credits_read_parties" ON public.credits FOR SELECT USING (
  from_id = public.current_profile_id() OR to_shop_id = public.current_profile_id() OR public.current_user_role() = 'admin'
);
CREATE POLICY "credits_insert_from" ON public.credits FOR INSERT WITH CHECK (from_id = public.current_profile_id());
CREATE POLICY "credits_update_parties" ON public.credits FOR UPDATE USING (
  from_id = public.current_profile_id() OR to_shop_id = public.current_profile_id()
);

-- ---- distributor_products ----
DROP POLICY IF EXISTS "dist_products_write_owner" ON public.distributor_products;
DROP POLICY IF EXISTS "dist_products_update_owner" ON public.distributor_products;
DROP POLICY IF EXISTS "dist_products_delete_owner" ON public.distributor_products;
CREATE POLICY "dist_products_write_owner"  ON public.distributor_products FOR INSERT WITH CHECK (distributor_id = public.current_profile_id());
CREATE POLICY "dist_products_update_owner" ON public.distributor_products FOR UPDATE USING (distributor_id = public.current_profile_id());
CREATE POLICY "dist_products_delete_owner" ON public.distributor_products FOR DELETE USING (distributor_id = public.current_profile_id());

-- ---- stock_orders ----
DROP POLICY IF EXISTS "stock_orders_read_parties" ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_insert_shop" ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_update_parties" ON public.stock_orders;
CREATE POLICY "stock_orders_read_parties" ON public.stock_orders FOR SELECT USING (
  shop_id = public.current_profile_id() OR public.current_user_role() IN ('distributor','admin')
);
CREATE POLICY "stock_orders_insert_shop" ON public.stock_orders FOR INSERT WITH CHECK (shop_id = public.current_profile_id());
CREATE POLICY "stock_orders_update_parties" ON public.stock_orders FOR UPDATE USING (
  shop_id = public.current_profile_id() OR public.current_user_role() IN ('distributor','admin')
);

-- ---- payment_history ----
DROP POLICY IF EXISTS "payment_history_own" ON public.payment_history;
CREATE POLICY "payment_history_own" ON public.payment_history FOR SELECT USING (
  user_id = public.current_profile_id() OR public.current_user_role() = 'admin'
);

-- ---- site_config (shop owners write their own keys) ----
DROP POLICY IF EXISTS "site_config_shop_write" ON public.site_config;
DROP POLICY IF EXISTS "site_config_shop_update" ON public.site_config;
CREATE POLICY "site_config_shop_write" ON public.site_config FOR INSERT
  WITH CHECK (key LIKE '%' || public.current_profile_id()::text || '%');
CREATE POLICY "site_config_shop_update" ON public.site_config FOR UPDATE
  USING (key LIKE '%' || public.current_profile_id()::text || '%');

SELECT 'Robust profile-id RLS applied - works for new and legacy accounts' AS status;
