-- ─────────────────────────────────────────────────────────────────────────
-- Products RLS: allow main owner to write to branch products
--
-- The original policy: shop_id = auth.uid()
-- This blocks the main owner from inserting/updating/deleting products on
-- a branch, because branch.id ≠ auth.uid() (auth.uid() = main shop UUID).
--
-- Fix: also allow writes when the target shop is a branch whose
-- parent_shop_id = auth.uid() (or current_profile_id() for custom auth).
-- ─────────────────────────────────────────────────────────────────────────

-- INSERT
DROP POLICY IF EXISTS "products_write_owner" ON public.products;
CREATE POLICY "products_write_owner" ON public.products
  FOR INSERT WITH CHECK (
    shop_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = products.shop_id
        AND parent_shop_id = public.current_profile_id()
    )
    OR public.current_user_role() = 'admin'
  );

-- UPDATE
DROP POLICY IF EXISTS "products_update_owner" ON public.products;
CREATE POLICY "products_update_owner" ON public.products
  FOR UPDATE USING (
    shop_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = products.shop_id
        AND parent_shop_id = public.current_profile_id()
    )
    OR public.current_user_role() = 'admin'
  );

-- DELETE
DROP POLICY IF EXISTS "products_delete_owner" ON public.products;
CREATE POLICY "products_delete_owner" ON public.products
  FOR DELETE USING (
    shop_id = public.current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = products.shop_id
        AND parent_shop_id = public.current_profile_id()
    )
    OR public.current_user_role() = 'admin'
  );

SELECT 'Products branch RLS fixed' AS status;
