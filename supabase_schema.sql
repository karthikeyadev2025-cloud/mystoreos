-- MyStore OS Supabase Schema

-- Users table (Customers, Shopkeepers, Distributors, Admins)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL, -- Note: In a real production app, use Supabase Auth instead of plaintext
    role TEXT NOT NULL CHECK (role IN ('customer', 'shop', 'distributor', 'admin')),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    subscription TEXT DEFAULT 'trial',
    upi_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    mrp DECIMAL(10, 2),
    weight TEXT,
    icon TEXT,
    category TEXT,
    barcode TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    shop_id UUID REFERENCES public.users(id),
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Completed', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credits / Distributor Ledgers table
CREATE TABLE public.credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_id UUID REFERENCES public.users(id), -- The distributor giving the credit
    to_shop_id UUID REFERENCES public.users(id), -- The shop receiving the credit
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Settings
CREATE TABLE public.settings (
    id INT PRIMARY KEY DEFAULT 1,
    razorpay_key TEXT
);
INSERT INTO public.settings (id, razorpay_key) VALUES (1, '');

-- Insert Demo Admin
INSERT INTO public.users (id, phone, pass, role, name) 
VALUES ('00000000-0000-0000-0000-000000000000', '0000000000', '1234', 'admin', 'Super Admin');
