-- ─────────────────────────────────────────────────────────────────────────
-- Branch RLS: allow main owner to read/write all tables for their branches
--
-- Problem: every table policy checks shop_id = current_profile_id().
-- When the main owner operates on a branch (shop_id = branch UUID),
-- current_profile_id() = main UUID → check fails → RLS violation.
--
-- Fix: add an EXISTS subquery that allows access when the target shop
-- is a branch owned by the current user (parent_shop_id = current user).
--
-- Helper function to avoid repeating the subquery everywhere:
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owns_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p_shop_id = public.current_profile_id()        -- it's their own shop
    OR EXISTS (                                     -- or it's their branch
      SELECT 1 FROM public.users
      WHERE id = p_shop_id
        AND parent_shop_id = public.current_profile_id()
    )
    OR public.current_user_role() = 'admin';
$$;

-- ── PRODUCTS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "products_write_owner"  ON public.products;
DROP POLICY IF EXISTS "products_update_owner" ON public.products;
DROP POLICY IF EXISTS "products_delete_owner" ON public.products;

CREATE POLICY "products_write_owner"  ON public.products FOR INSERT WITH CHECK (public.owns_shop(shop_id));
CREATE POLICY "products_update_owner" ON public.products FOR UPDATE USING   (public.owns_shop(shop_id));
CREATE POLICY "products_delete_owner" ON public.products FOR DELETE USING   (public.owns_shop(shop_id));

-- ── ORDERS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_read_shop"   ON public.orders;
DROP POLICY IF EXISTS "orders_insert_shop" ON public.orders;
DROP POLICY IF EXISTS "orders_update_shop" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_shop" ON public.orders;

CREATE POLICY "orders_read_shop"   ON public.orders FOR SELECT USING (
  public.owns_shop(shop_id) OR user_id = public.current_profile_id()::text OR public.current_user_role() = 'admin'
);
CREATE POLICY "orders_insert_shop" ON public.orders FOR INSERT WITH CHECK (public.owns_shop(shop_id));
CREATE POLICY "orders_update_shop" ON public.orders FOR UPDATE USING (public.owns_shop(shop_id));
CREATE POLICY "orders_delete_shop" ON public.orders FOR DELETE USING (public.owns_shop(shop_id));

-- ── EXPENSES ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "expenses_read_shop"   ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_shop" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_shop" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_shop" ON public.expenses;

CREATE POLICY "expenses_read_shop"   ON public.expenses FOR SELECT USING (public.owns_shop(shop_id));
CREATE POLICY "expenses_insert_shop" ON public.expenses FOR INSERT WITH CHECK (public.owns_shop(shop_id));
CREATE POLICY "expenses_update_shop" ON public.expenses FOR UPDATE USING (public.owns_shop(shop_id));
CREATE POLICY "expenses_delete_shop" ON public.expenses FOR DELETE USING (public.owns_shop(shop_id));

-- ── STAFF ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_shop"   ON public.staff;
DROP POLICY IF EXISTS "staff_insert_shop" ON public.staff;
DROP POLICY IF EXISTS "staff_update_shop" ON public.staff;
DROP POLICY IF EXISTS "staff_delete_shop" ON public.staff;

CREATE POLICY "staff_read_shop"   ON public.staff FOR SELECT USING (public.owns_shop(shop_id) OR user_id = public.current_profile_id());
CREATE POLICY "staff_insert_shop" ON public.staff FOR INSERT WITH CHECK (public.owns_shop(shop_id));
CREATE POLICY "staff_update_shop" ON public.staff FOR UPDATE USING (public.owns_shop(shop_id));
CREATE POLICY "staff_delete_shop" ON public.staff FOR DELETE USING (public.owns_shop(shop_id));

-- ── CREDITS ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "credits_read_parties"   ON public.credits;
DROP POLICY IF EXISTS "credits_insert_parties" ON public.credits;
DROP POLICY IF EXISTS "credits_update_parties" ON public.credits;
DROP POLICY IF EXISTS "credits_delete_parties" ON public.credits;

CREATE POLICY "credits_read_parties"   ON public.credits FOR SELECT USING (
  public.owns_shop(to_shop_id) OR from_id = public.current_profile_id() OR public.current_user_role() = 'admin'
);
CREATE POLICY "credits_insert_parties" ON public.credits FOR INSERT WITH CHECK (
  public.owns_shop(to_shop_id) OR from_id = public.current_profile_id()
);
CREATE POLICY "credits_update_parties" ON public.credits FOR UPDATE USING (
  public.owns_shop(to_shop_id) OR from_id = public.current_profile_id()
);
CREATE POLICY "credits_delete_parties" ON public.credits FOR DELETE USING (
  public.owns_shop(to_shop_id) OR from_id = public.current_profile_id()
);

-- ── STOCK ORDERS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stock_orders_read_parties"  ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_insert_shop"   ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_update_shop"   ON public.stock_orders;

CREATE POLICY "stock_orders_read_parties" ON public.stock_orders FOR SELECT USING (
  public.owns_shop(shop_id) OR public.current_user_role() IN ('distributor','admin')
);
CREATE POLICY "stock_orders_insert_shop"  ON public.stock_orders FOR INSERT WITH CHECK (public.owns_shop(shop_id));
CREATE POLICY "stock_orders_update_shop"  ON public.stock_orders FOR UPDATE USING (public.owns_shop(shop_id));

-- ── FLASH SALES ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "flash_sales_write_owner"  ON public.flash_sales;
DROP POLICY IF EXISTS "flash_sales_delete_owner" ON public.flash_sales;

CREATE POLICY "flash_sales_write_owner"  ON public.flash_sales FOR INSERT WITH CHECK (public.owns_shop(shop_id));
CREATE POLICY "flash_sales_delete_owner" ON public.flash_sales FOR DELETE USING (public.owns_shop(shop_id));
CREATE POLICY "flash_sales_update_owner" ON public.flash_sales FOR UPDATE USING (public.owns_shop(shop_id));

SELECT 'Branch RLS fixed for all tables via owns_shop()' AS status;
