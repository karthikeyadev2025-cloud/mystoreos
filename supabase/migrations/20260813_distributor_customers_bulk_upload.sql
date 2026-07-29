-- Migration 20260813: Distributor Customers & Bulk Upload Directory
CREATE TABLE IF NOT EXISTS public.distributor_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  gstin text,
  address text,
  city text,
  credit_limit numeric DEFAULT 0,
  owed numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.distributor_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dist_customers_read" ON public.distributor_customers;
DROP POLICY IF EXISTS "dist_customers_write" ON public.distributor_customers;
DROP POLICY IF EXISTS "dist_customers_update" ON public.distributor_customers;
DROP POLICY IF EXISTS "dist_customers_delete" ON public.distributor_customers;

CREATE POLICY "dist_customers_read"   ON public.distributor_customers FOR SELECT USING (true);
CREATE POLICY "dist_customers_write"  ON public.distributor_customers FOR INSERT WITH CHECK (distributor_id = auth.uid() OR distributor_id = public.current_profile_id());
CREATE POLICY "dist_customers_update" ON public.distributor_customers FOR UPDATE USING (distributor_id = auth.uid() OR distributor_id = public.current_profile_id());
CREATE POLICY "dist_customers_delete" ON public.distributor_customers FOR DELETE USING (distributor_id = auth.uid() OR distributor_id = public.current_profile_id());

-- Indexes for instant search
CREATE INDEX IF NOT EXISTS idx_dist_cust_distributor ON public.distributor_customers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_dist_cust_phone ON public.distributor_customers(phone);
CREATE INDEX IF NOT EXISTS idx_dist_cust_name ON public.distributor_customers(name);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'distributor_customers table & policies created' AS status;
