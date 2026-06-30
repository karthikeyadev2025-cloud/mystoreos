-- ─────────────────────────────────────────────────────────────────────────
-- REGRESSION FIX: products RLS lost staff_of coverage
--
-- Timeline:
--   20260619_fix_staff_orders_rls.sql  → made products_update_owner use
--     current_user_shop_id() = COALESCE(staff_of, id), so STAFF members
--     could update stock (deduct on sale, restore on return).
--   20260622_products_branch_rls.sql   → ran LATER, DROPPED and
--     RECREATED products_update_owner (and INSERT/DELETE) WITHOUT the
--     staff_of check — it only covers shop_id = current_profile_id() OR
--     parent_shop_id = current_profile_id() (branch ownership). This
--     silently regressed every staff/branch-login stock update: sales no
--     longer deducted stock, and returns no longer restored it. The
--     per-item try/catch in api.js swallowed the RLS error, so bills and
--     "return processed" toasts kept showing success with no visible sign
--     anything was wrong — only a stock-count mismatch over time.
--
-- This migration restores staff_of coverage AND keeps branch-owner
-- coverage, so all three cases work:
--   1. Owner managing their own shop's products
--   2. Main owner managing a branch's products (parent_shop_id)
--   3. Staff member working at a shop, including its branches (staff_of)
-- ─────────────────────────────────────────────────────────────────────────

-- INSERT
DROP POLICY IF EXISTS "products_write_owner" ON public.products;
CREATE POLICY "products_write_owner" ON public.products
  FOR INSERT WITH CHECK (
    shop_id = public.current_user_shop_id()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = products.shop_id
        AND parent_shop_id = public.current_profile_id()
    )
    OR public.current_user_role() = 'admin'
  );

-- UPDATE — this is the one that broke stock deduction (sales) and
-- stock restoration (returns) for every staff/branch login.
DROP POLICY IF EXISTS "products_update_owner" ON public.products;
CREATE POLICY "products_update_owner" ON public.products
  FOR UPDATE USING (
    shop_id = public.current_user_shop_id()
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
    shop_id = public.current_user_shop_id()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = products.shop_id
        AND parent_shop_id = public.current_profile_id()
    )
    OR public.current_user_role() = 'admin'
  );

SELECT 'products RLS: staff_of coverage restored alongside branch ownership' AS status;
