-- ============================================================
-- ADMIN OVERRIDE for product management
--
-- Gap found during testing: products_update_owner / products_delete_owner
-- and the distributor_products equivalents only allowed the owner
-- (shop_id / distributor_id = current_profile_id()). Admins could VIEW
-- shop inventory (public-read) but could not edit or remove it — blocking
-- support actions like fixing a bad price, correcting stock, or removing
-- a policy-violating listing.
--
-- This migration adds "OR current_user_role() = 'admin'" so platform
-- admins can manage any shop's / distributor's catalog. current_user_role()
-- is a SECURITY DEFINER function (no RLS recursion) defined earlier.
--
-- Owner behaviour is unchanged; this only ADDS an admin path.
-- ============================================================

-- ---- products: allow admin to update / delete any shop's items ----
DROP POLICY IF EXISTS "products_update_owner" ON public.products;
DROP POLICY IF EXISTS "products_delete_owner" ON public.products;

CREATE POLICY "products_update_owner" ON public.products
  FOR UPDATE
  USING (shop_id = public.current_profile_id() OR public.current_user_role() = 'admin')
  WITH CHECK (shop_id = public.current_profile_id() OR public.current_user_role() = 'admin');

CREATE POLICY "products_delete_owner" ON public.products
  FOR DELETE
  USING (shop_id = public.current_profile_id() OR public.current_user_role() = 'admin');

-- Note: products_write_owner (INSERT) intentionally left owner-only.
-- Admins shouldn't be creating inventory under a shop's identity; if an
-- admin needs to add a product they act through normal shop tooling.

-- ---- distributor_products: same admin override ----
DROP POLICY IF EXISTS "dist_products_update_owner" ON public.distributor_products;
DROP POLICY IF EXISTS "dist_products_delete_owner" ON public.distributor_products;

CREATE POLICY "dist_products_update_owner" ON public.distributor_products
  FOR UPDATE
  USING (distributor_id = public.current_profile_id() OR public.current_user_role() = 'admin')
  WITH CHECK (distributor_id = public.current_profile_id() OR public.current_user_role() = 'admin');

CREATE POLICY "dist_products_delete_owner" ON public.distributor_products
  FOR DELETE
  USING (distributor_id = public.current_profile_id() OR public.current_user_role() = 'admin');

-- ---- credits: let admin update for dispute resolution / support ----
-- (read already allows admin; update was owner-only — inconsistent)
DROP POLICY IF EXISTS "credits_update_parties" ON public.credits;
CREATE POLICY "credits_update_parties" ON public.credits
  FOR UPDATE
  USING (
    from_id = public.current_profile_id()
    OR to_shop_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

SELECT 'Admin override added to product + distributor_product update/delete policies' AS status;
