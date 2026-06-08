-- ============================================================
-- SECURITY FIX: Close open table reads found by vibe-scan
-- Scanner found: users, orders, products, settings accessible
-- via anon key with no auth. This migration ensures RLS is
-- enabled and all permissive "Allow all" policies are dropped.
-- Run in Supabase SQL Editor immediately.
-- ============================================================

-- Ensure RLS is ON for all tables (idempotent)
ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements      ENABLE ROW LEVEL SECURITY;

-- Drop any lingering open/permissive policies
DROP POLICY IF EXISTS "Allow all"         ON public.users;
DROP POLICY IF EXISTS "Allow all"         ON public.orders;
DROP POLICY IF EXISTS "Allow all"         ON public.products;
DROP POLICY IF EXISTS "Allow all"         ON public.settings;
DROP POLICY IF EXISTS "Allow all"         ON public.credits;
DROP POLICY IF EXISTS "Allow all"         ON public.site_config;
DROP POLICY IF EXISTS "Allow all"         ON public.distributor_products;
DROP POLICY IF EXISTS "Allow all"         ON public.stock_orders;
DROP POLICY IF EXISTS "Allow all"         ON public.announcements;

-- settings table — only admin can read/write
DROP POLICY IF EXISTS "settings_admin_only" ON public.settings;
CREATE POLICY "settings_admin_only" ON public.settings
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- announcements — public read, admin write
DROP POLICY IF EXISTS "announcements_public_read" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin_write" ON public.announcements;
CREATE POLICY "announcements_public_read" ON public.announcements
  FOR SELECT USING (active = true);
CREATE POLICY "announcements_admin_write" ON public.announcements
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Verify: list all current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
