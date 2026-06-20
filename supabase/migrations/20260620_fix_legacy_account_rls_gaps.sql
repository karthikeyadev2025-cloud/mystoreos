-- Corrective fix — found while auditing RLS on the newer tables (variant
-- pricing, returns) per request, by tracing the full history of the
-- products_update_owner policy and finding it had been rewritten 5 times
-- across migrations for two DIFFERENT, both-real problems that were never
-- actually merged together:
--
--   1. current_profile_id() (20260608_robust_profile_id_rls.sql) — some
--      shops have public.users.id that doesn't match auth.users.id
--      (legacy/seed accounts created before a schema change). Plain
--      "shop_id = auth.uid()" silently returns zero rows for those
--      shops. current_profile_id() fixes this with a fallback: match by
--      phone number (via the {phone}@mystore.internal synthetic email)
--      when the direct id match fails.
--
--   2. current_user_shop_id() (20260619_fix_staff_orders_rls.sql, this
--      session) — staff accounts log in with their OWN auth.uid(), not
--      the shop owner's, so "shop_id = auth.uid()" never matches a staff
--      session at all. Needed to resolve staff_of -> owning shop id.
--
-- Problem: 20260619_fix_staff_orders_rls.sql rewrote 5 policies
-- (orders_read_shop, orders_update_shop, products_update_owner,
-- credits_read_parties, credits_update_parties) to use ONLY
-- current_user_shop_id(), which has no legacy-account fallback —
-- silently re-breaking RLS for any shop with a legacy/seed account that
-- problem #1 had already fixed. Two correct, narrow fixes that
-- overwrote each other instead of being combined.
--
-- Fix: rewrite current_user_shop_id() to use the SAME legacy-account
-- resilient lookup as current_profile_id(), AND resolve staff_of on top
-- of it. One function, both problems solved together. The 5 policies
-- themselves don't need to change again — they already call
-- current_user_shop_id(), which now does the complete job.

CREATE OR REPLACE FUNCTION public.current_user_shop_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(u.staff_of, u.id)
  FROM public.users u
  WHERE u.id = auth.uid()
     OR u.phone = split_part(
          (SELECT email FROM auth.users WHERE id = auth.uid()),
          '@', 1
        )
  LIMIT 1
$$;

SELECT 'current_user_shop_id() now handles legacy accounts AND staff sessions together' AS status;

-- Separate, related gap found while checking for the same regression
-- pattern elsewhere: the Reset Test Data DELETE policies
-- (20260619_reset_test_data_delete_policies.sql) use plain
-- "shop_id = auth.uid()" — deliberately staff-excluded (so staff can't
-- trigger a destructive shop-wide wipe), which is correct and must stay
-- that way. But plain auth.uid() has the SAME legacy-account gap
-- current_profile_id() exists to fix — a shop owner on a legacy/seed
-- account would be unable to use Reset Test Data at all, since their
-- auth.uid() never matches orders.shop_id directly.
--
-- Fix: use current_profile_id() (legacy-account-safe, but NOT staff-
-- aware — no staff_of resolution) instead of current_user_shop_id()
-- (which would also let staff trigger the reset) or plain auth.uid()
-- (which has the legacy-account bug). This is the one place in the
-- schema where "fix legacy accounts" and "stay staff-excluded" are both
-- required at once.
DROP POLICY IF EXISTS "orders_delete_shop" ON public.orders;
CREATE POLICY "orders_delete_shop"
  ON public.orders FOR DELETE
  USING (shop_id = public.current_profile_id() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "credits_delete_shop" ON public.credits;
CREATE POLICY "credits_delete_shop"
  ON public.credits FOR DELETE
  USING (to_shop_id = public.current_profile_id() OR from_id = public.current_profile_id() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "stock_orders_delete_shop" ON public.stock_orders;
CREATE POLICY "stock_orders_delete_shop"
  ON public.stock_orders FOR DELETE
  USING (shop_id = public.current_profile_id() OR distributor_id = public.current_profile_id() OR public.current_user_role() = 'admin');

SELECT 'Reset Test Data delete policies now legacy-account-safe, still staff-excluded' AS status;
