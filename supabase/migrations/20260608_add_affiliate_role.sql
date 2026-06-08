-- ============================================================
-- Add 'affiliate' to the users role check constraint
--
-- Bug found during testing: the app has an Affiliate dashboard (/affiliate),
-- role-based routing for 'affiliate', and api.createAffiliateUser() inserts
-- role='affiliate' — but the users_role_check constraint only permitted
-- ('customer','shop','distributor','admin','staff','ca'). Any attempt to
-- create an affiliate threw 23514 check_violation, so the affiliate program
-- could never onboard a single user.
--
-- Fix: extend the allowed role set to include 'affiliate'.
-- ============================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'shop', 'distributor', 'admin', 'staff', 'ca', 'affiliate'));

SELECT 'affiliate role added to users_role_check' AS status;
