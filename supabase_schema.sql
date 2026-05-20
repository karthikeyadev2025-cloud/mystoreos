-- MyStore OS — Complete Supabase Schema (v3)
-- Run this ONCE in Supabase SQL Editor

-- Drop existing tables if re-running
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.stock_orders CASCADE;
DROP TABLE IF EXISTS public.distributor_products CASCADE;
DROP TABLE IF EXISTS public.credits CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.site_config CASCADE;

-- Users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer', 'shop', 'distributor', 'admin', 'staff')),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending')),
    subscription TEXT DEFAULT 'trial',
    upi_id TEXT,
    logo TEXT,
    payment_qr TEXT,
    shop_photos JSONB DEFAULT '[]'::jsonb,
    staff_of UUID REFERENCES public.users(id) ON DELETE CASCADE,
    latitude DECIMAL,
    longitude DECIMAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    shop_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Completed', 'Cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credits table
CREATE TABLE public.credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    to_shop_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Distributor Products table (NEW in v3)
CREATE TABLE public.distributor_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Orders table (NEW in v3)
CREATE TABLE public.stock_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements table (NEW in v3)
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Settings
CREATE TABLE public.settings (
    id INT PRIMARY KEY DEFAULT 1,
    razorpay_key TEXT DEFAULT ''
);
INSERT INTO public.settings (id, razorpay_key) VALUES (1, '');

-- Site Config (CMS)
CREATE TABLE public.site_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Super Admin
INSERT INTO public.users (phone, pass, role, name, status)
VALUES ('8885490495', 'Mystore@karthi@2025', 'admin', 'Super Admin', 'active');

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Allow public access (tighten for production later)
CREATE POLICY "Allow all" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.credits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.site_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.distributor_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.stock_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.announcements FOR ALL USING (true) WITH CHECK (true);

-- Migration helper: If upgrading from previous version, run these ALTER commands instead of full re-create:
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS latitude DECIMAL;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS longitude DECIMAL;
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS batch_number TEXT;
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry_date DATE;
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants TEXT;
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT 10;
-- Then create the 3 tables: distributor_products, stock_orders, announcements if not present.
