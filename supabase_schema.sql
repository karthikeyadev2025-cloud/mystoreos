-- MyStore OS — Complete Supabase Schema (v2)
-- Run this ONCE in Supabase SQL Editor

-- Drop existing tables if re-running
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

-- Insert Demo Shopkeeper
INSERT INTO public.users (phone, pass, role, name, status, subscription, upi_id)
VALUES ('9876543210', '1234', 'shop', 'Sai Supermarket', 'active', 'trial', '9876543210@ybl');

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Allow public access (tighten for production later)
CREATE POLICY "Allow all" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.credits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.site_config FOR ALL USING (true) WITH CHECK (true);
