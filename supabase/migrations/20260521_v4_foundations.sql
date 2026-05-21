-- Migration: v3 → v4 (Phase 1.5 foundations)
-- Run this in Supabase SQL Editor if upgrading an existing v3 project.
-- For fresh installs, use supabase_schema.sql instead.

-- ---- users table additions ----
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'starter'
    CHECK (subscription_tier IN ('starter', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill subscription_tier from legacy subscription values
UPDATE public.users SET subscription_tier = 'pro'        WHERE subscription = 'pro';
UPDATE public.users SET subscription_tier = 'enterprise' WHERE subscription = 'enterprise';
UPDATE public.users SET subscription_tier = 'starter'    WHERE subscription IN ('trial', 'active') OR subscription IS NULL;

-- ---- active_sessions table ----
CREATE TABLE IF NOT EXISTS public.active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    device_fingerprint TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user     ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen ON public.active_sessions(last_seen_at);
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_own" ON public.active_sessions;
CREATE POLICY "sessions_own" ON public.active_sessions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---- payment_history table ----
CREATE TABLE IF NOT EXISTS public.payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    razorpay_event_id TEXT UNIQUE NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    event_type TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    amount DECIMAL(10, 2),
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    raw_payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_payment_history_user  ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_event ON public.payment_history(razorpay_event_id);
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_history_read_own" ON public.payment_history;
CREATE POLICY "payment_history_read_own" ON public.payment_history FOR SELECT
  USING (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- ---- Replace Allow-all RLS with per-role policies ----
-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all" ON public.users;
DROP POLICY IF EXISTS "Allow all" ON public.products;
DROP POLICY IF EXISTS "Allow all" ON public.orders;
DROP POLICY IF EXISTS "Allow all" ON public.credits;
DROP POLICY IF EXISTS "Allow all" ON public.settings;
DROP POLICY IF EXISTS "Allow all" ON public.site_config;
DROP POLICY IF EXISTS "Allow all" ON public.distributor_products;
DROP POLICY IF EXISTS "Allow all" ON public.stock_orders;
DROP POLICY IF EXISTS "Allow all" ON public.announcements;

-- Helper function
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- Re-create per-role policies (see supabase_schema.sql for full definitions)
-- users
CREATE POLICY "users_insert_registration"  ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_select_own_or_admin"  ON public.users FOR SELECT USING (id = auth.uid() OR public.current_user_role() = 'admin');
CREATE POLICY "users_select_public_profile" ON public.users FOR SELECT USING (role = 'shop');
CREATE POLICY "users_update_own"           ON public.users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_admin"         ON public.users FOR UPDATE USING (public.current_user_role() = 'admin');
CREATE POLICY "users_delete_admin"         ON public.users FOR DELETE USING (public.current_user_role() = 'admin');
-- products
CREATE POLICY "products_read_public"   ON public.products FOR SELECT USING (true);
CREATE POLICY "products_write_owner"   ON public.products FOR INSERT WITH CHECK (shop_id = auth.uid());
CREATE POLICY "products_update_owner"  ON public.products FOR UPDATE USING (shop_id = auth.uid());
CREATE POLICY "products_delete_owner"  ON public.products FOR DELETE USING (shop_id = auth.uid());
-- orders
CREATE POLICY "orders_read_shop"     ON public.orders FOR SELECT USING (shop_id = auth.uid() OR user_id = auth.uid()::text OR public.current_user_role() = 'admin');
CREATE POLICY "orders_insert_any"    ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update_shop"   ON public.orders FOR UPDATE USING (shop_id = auth.uid() OR public.current_user_role() = 'admin');
-- credits
CREATE POLICY "credits_read_parties"  ON public.credits FOR SELECT USING (from_id = auth.uid() OR to_shop_id = auth.uid() OR public.current_user_role() = 'admin');
CREATE POLICY "credits_insert_from"   ON public.credits FOR INSERT WITH CHECK (from_id = auth.uid());
CREATE POLICY "credits_update_parties" ON public.credits FOR UPDATE USING (from_id = auth.uid() OR to_shop_id = auth.uid());
-- distributor_products
CREATE POLICY "dist_products_read_all"    ON public.distributor_products FOR SELECT USING (true);
CREATE POLICY "dist_products_write_owner" ON public.distributor_products FOR INSERT WITH CHECK (distributor_id = auth.uid());
CREATE POLICY "dist_products_update_owner" ON public.distributor_products FOR UPDATE USING (distributor_id = auth.uid());
CREATE POLICY "dist_products_delete_owner" ON public.distributor_products FOR DELETE USING (distributor_id = auth.uid());
-- stock_orders
CREATE POLICY "stock_orders_read_parties"     ON public.stock_orders FOR SELECT USING (shop_id = auth.uid() OR public.current_user_role() IN ('distributor','admin'));
CREATE POLICY "stock_orders_insert_shop"      ON public.stock_orders FOR INSERT WITH CHECK (shop_id = auth.uid());
CREATE POLICY "stock_orders_update_distributor" ON public.stock_orders FOR UPDATE USING (public.current_user_role() IN ('distributor','admin'));
-- settings, site_config, announcements
CREATE POLICY "settings_admin_all"       ON public.settings FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY "site_config_read_all"     ON public.site_config FOR SELECT USING (true);
CREATE POLICY "site_config_admin_write"  ON public.site_config FOR INSERT WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "site_config_admin_update" ON public.site_config FOR UPDATE USING (public.current_user_role() = 'admin');
CREATE POLICY "announcements_read_all"   ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements_admin_write"  ON public.announcements FOR INSERT WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "announcements_admin_update" ON public.announcements FOR UPDATE USING (public.current_user_role() = 'admin');
