-- MyStore OS — Complete Supabase Schema (v4 — Phase 1.5 Security & Foundations)
-- Run this ONCE in Supabase SQL Editor
-- Phase 2a will switch RLS policies from anon-pass-through to auth.uid()-based enforcement
-- when Supabase Auth replaces the custom phone/password flow.

-- ============================================================
-- DROP existing tables (safe re-run)
-- ============================================================
DROP TABLE IF EXISTS public.active_sessions CASCADE;
DROP TABLE IF EXISTS public.payment_history CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.stock_orders CASCADE;
DROP TABLE IF EXISTS public.distributor_products CASCADE;
DROP TABLE IF EXISTS public.credits CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.site_config CASCADE;

-- ============================================================
-- Users table
-- ============================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL,                          -- bcrypt hash (Phase 1.5+), never plaintext
    role TEXT NOT NULL CHECK (role IN ('customer', 'shop', 'distributor', 'admin', 'staff', 'ca')),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending')),
    -- subscription values: trial | starter | pro | enterprise | active (legacy)
    subscription TEXT DEFAULT 'trial',
    subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'pro', 'enterprise')),
    plan_expires_at TIMESTAMPTZ,                 -- NULL = no expiry (trial or lifetime override)
    trial_started_at TIMESTAMPTZ DEFAULT NOW(),  -- set on shop registration
    upi_id TEXT,
    logo TEXT,
    avatar TEXT,
    payment_qr TEXT,
    shop_photos JSONB DEFAULT '[]'::jsonb,
    staff_of UUID REFERENCES public.users(id) ON DELETE CASCADE,
    latitude DECIMAL,
    longitude DECIMAL,
    gstin TEXT,
    state_code TEXT,
    business_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Products table
-- ============================================================
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    barcode TEXT,
    stock INT DEFAULT 100,
    batch_number TEXT,
    expiry_date DATE,
    variants TEXT,
    reorder_level INT DEFAULT 10,
    hsn_code TEXT,
    gst_rate INT DEFAULT 0,
    cost_price DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Orders table
-- ============================================================
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    shop_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Completed', 'Cancelled', 'Returned')),
    customer_gstin TEXT,
    customer_address TEXT,
    customer_state_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Credits table
-- ============================================================
CREATE TABLE public.credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    to_shop_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Distributor Products table
-- ============================================================
CREATE TABLE public.distributor_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Stock Orders table
-- ============================================================
CREATE TABLE public.stock_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Announcements table
-- ============================================================
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- System Settings
-- ============================================================
CREATE TABLE public.settings (
    id INT PRIMARY KEY DEFAULT 1,
    razorpay_key TEXT DEFAULT ''
);
INSERT INTO public.settings (id, razorpay_key) VALUES (1, '');

-- ============================================================
-- Site Config (CMS / subscription plan definitions)
-- ============================================================
CREATE TABLE public.site_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Active Sessions (multi-device enforcement — Phase 3)
-- Used to enforce Starter single-device limit.
-- Heartbeat updates last_seen_at every 5 minutes from the client.
-- Stale sessions (>30 days) are treated as expired.
-- ============================================================
CREATE TABLE public.active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    device_fingerprint TEXT,                     -- browser fingerprint hash
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_active_sessions_user ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_last_seen ON public.active_sessions(last_seen_at);

-- ============================================================
-- Payment History (Phase 4 — Razorpay webhook logging)
-- Idempotency: razorpay_event_id is UNIQUE to prevent double-processing
-- ============================================================
CREATE TABLE public.payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    razorpay_event_id TEXT UNIQUE NOT NULL,      -- idempotency key
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    event_type TEXT NOT NULL,                    -- payment.captured | subscription.charged | subscription.halted
    plan_id TEXT NOT NULL,                       -- starter | pro | enterprise
    amount DECIMAL(10, 2),
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL,                        -- success | failed | refunded
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    raw_payload JSONB                            -- full Razorpay webhook body for audit
);
CREATE INDEX idx_payment_history_user ON public.payment_history(user_id);
CREATE INDEX idx_payment_history_event ON public.payment_history(razorpay_event_id);

-- ============================================================
-- Seed: Super Admin
-- Password is bcrypt hash of 'Mystore@karthi@2025' (cost 10)
-- Change this password via the app's admin reset flow after first deploy.
-- ============================================================
INSERT INTO public.users (phone, pass, role, name, status, subscription, subscription_tier)
VALUES (
    '8885490495',
    '$2b$10$4CwI2L.smt1uigPQfARhVOSei62g6fYWK3SCU8Q7JnWV16HdB2vPC',
    'admin',
    'Super Admin',
    'active',
    'active',
    'enterprise'
);

-- ============================================================
-- Enable Row Level Security
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (Phase 1.5 — proper per-role enforcement)
--
-- IMPORTANT: These policies use auth.uid() which maps to the Supabase
-- Auth user ID. They become fully enforced in Phase 2a when the app
-- migrates from custom phone/pass auth to Supabase Auth.
-- Until then, the service_role key (server-side only) bypasses RLS,
-- which is the current behaviour used by the React client.
--
-- Design assumptions:
--   auth.uid() = users.id  (Supabase Auth UID == our users.id UUID)
--   role is stored on users row, used for admin/distributor/ca checks
-- ============================================================

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- ---- users ----
-- Anyone can register (INSERT); own row update; admin reads/updates all
CREATE POLICY "users_insert_registration"
  ON public.users FOR INSERT WITH CHECK (true);

CREATE POLICY "users_select_own_or_admin"
  ON public.users FOR SELECT
  USING (id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "users_select_public_profile"
  ON public.users FOR SELECT
  USING (role = 'shop');  -- shop profiles are public (for /s/:shopId directory)

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_admin"
  ON public.users FOR UPDATE
  USING (public.current_user_role() = 'admin');

CREATE POLICY "users_delete_admin"
  ON public.users FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ---- products ----
-- Shop owns their products; public read for catalog browsing
CREATE POLICY "products_read_public"
  ON public.products FOR SELECT USING (true);

CREATE POLICY "products_write_owner"
  ON public.products FOR INSERT
  WITH CHECK (shop_id = auth.uid());

CREATE POLICY "products_update_owner"
  ON public.products FOR UPDATE
  USING (shop_id = auth.uid());

CREATE POLICY "products_delete_owner"
  ON public.products FOR DELETE
  USING (shop_id = auth.uid());

-- ---- orders ----
-- Shop sees own shop orders; customer sees their own orders; insert open
CREATE POLICY "orders_read_shop"
  ON public.orders FOR SELECT
  USING (shop_id = auth.uid() OR user_id = auth.uid()::text OR public.current_user_role() = 'admin');

CREATE POLICY "orders_insert_any"
  ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "orders_update_shop"
  ON public.orders FOR UPDATE
  USING (shop_id = auth.uid() OR public.current_user_role() = 'admin');

-- ---- credits ----
-- Both parties (from_id and to_shop_id) can read; inserter must be from_id
CREATE POLICY "credits_read_parties"
  ON public.credits FOR SELECT
  USING (from_id = auth.uid() OR to_shop_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "credits_insert_from"
  ON public.credits FOR INSERT
  WITH CHECK (from_id = auth.uid());

CREATE POLICY "credits_update_parties"
  ON public.credits FOR UPDATE
  USING (from_id = auth.uid() OR to_shop_id = auth.uid());

-- ---- distributor_products ----
CREATE POLICY "dist_products_read_all"
  ON public.distributor_products FOR SELECT USING (true);

CREATE POLICY "dist_products_write_owner"
  ON public.distributor_products FOR INSERT
  WITH CHECK (distributor_id = auth.uid());

CREATE POLICY "dist_products_update_owner"
  ON public.distributor_products FOR UPDATE
  USING (distributor_id = auth.uid());

CREATE POLICY "dist_products_delete_owner"
  ON public.distributor_products FOR DELETE
  USING (distributor_id = auth.uid());

-- ---- stock_orders ----
CREATE POLICY "stock_orders_read_parties"
  ON public.stock_orders FOR SELECT
  USING (
    shop_id = auth.uid()
    OR public.current_user_role() = 'distributor'
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "stock_orders_insert_shop"
  ON public.stock_orders FOR INSERT
  WITH CHECK (shop_id = auth.uid());

CREATE POLICY "stock_orders_update_distributor"
  ON public.stock_orders FOR UPDATE
  USING (public.current_user_role() IN ('distributor', 'admin'));

-- ---- settings (admin only) ----
CREATE POLICY "settings_admin_all"
  ON public.settings FOR ALL
  USING (public.current_user_role() = 'admin');

-- ---- site_config (public read, shop+admin write) ----
-- Keys follow the pattern: <feature>_<shopId>[_<extra>]
-- A shop owner's auth.uid() IS their shopId, so LIKE check is safe.
CREATE POLICY "site_config_read_all"
  ON public.site_config FOR SELECT USING (true);

CREATE POLICY "site_config_admin_write"
  ON public.site_config FOR INSERT
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "site_config_admin_update"
  ON public.site_config FOR UPDATE
  USING (public.current_user_role() = 'admin');

-- Shop owners may write rows whose key contains their own user ID.
-- Covers: flashSales_<uid>, invoiceFooter_<uid>, invPrefix_<uid>,
--         invCounter_<uid>, dailyTarget_<uid>, expenses_<uid>_*, loyalty_<uid>_*
CREATE POLICY "site_config_shop_write"
  ON public.site_config FOR INSERT
  WITH CHECK (key LIKE '%' || auth.uid()::text || '%');

CREATE POLICY "site_config_shop_update"
  ON public.site_config FOR UPDATE
  USING (key LIKE '%' || auth.uid()::text || '%');

-- ---- announcements (public read, admin write) ----
CREATE POLICY "announcements_read_all"
  ON public.announcements FOR SELECT USING (true);

CREATE POLICY "announcements_admin_write"
  ON public.announcements FOR INSERT
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "announcements_admin_update"
  ON public.announcements FOR UPDATE
  USING (public.current_user_role() = 'admin');

-- ---- active_sessions (own only) ----
CREATE POLICY "sessions_own"
  ON public.active_sessions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---- payment_history (own read, server write via service_role) ----
CREATE POLICY "payment_history_read_own"
  ON public.payment_history FOR SELECT
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

-- INSERT/UPDATE comes only from Razorpay webhook handler (service_role key) — no client policy needed

-- ============================================================
-- Migration helpers (upgrading from v3 → v4, skip if re-creating)
-- ============================================================
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'starter';
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();
-- CREATE TABLE IF NOT EXISTS public.active_sessions (...);  -- see definition above
-- CREATE TABLE IF NOT EXISTS public.payment_history (...);  -- see definition above
-- UPDATE public.users SET subscription_tier = 'starter' WHERE subscription = 'trial' OR subscription = 'active';
-- UPDATE public.users SET subscription_tier = 'pro' WHERE subscription = 'pro';
-- UPDATE public.users SET subscription_tier = 'enterprise' WHERE subscription = 'enterprise';

-- ============================================================
-- STORAGE CONFIGURATION (mystore-assets Bucket & RLS Policies)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('mystore-assets', 'mystore-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'mystore-assets');

DROP POLICY IF EXISTS "Public Insert Access" ON storage.objects;
CREATE POLICY "Public Insert Access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'mystore-assets');

DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;
CREATE POLICY "Public Update Access"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'mystore-assets');

DROP POLICY IF EXISTS "Public Delete Access" ON storage.objects;
CREATE POLICY "Public Delete Access"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'mystore-assets');
