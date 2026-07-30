-- ═══════════════════════════════════════════════════════════════════════
-- P0 SECURITY FIXES — 2026-07-30
--
-- Six live-fire issues found in the July 30 audit. All applied atomically
-- so a partial failure rolls back. Reads and writes are all preserved
-- for legitimate tenants; the changes here CLOSE anon-side leaks and
-- tenant-side bypasses that the prior migrations left open.
--
-- Order of fixes:
--   1. stock_orders — revert accidentally-open RLS from 20260729
--   2. users.pass / pass_verify — column-level SELECT revoke
--   3. distributor_customers — remove public read policy
--   4. prevent_privilege_escalation trigger — plug two missing columns
--   5. validate_order_total — reject unknown product IDs
--   6. Missing hot-path indexes
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) stock_orders — RLS restore
--
-- 20260729_fix_stock_orders_status_check.sql set all four policies to
-- USING (true) / WITH CHECK (true) while debugging a check-constraint
-- issue. That fix went through, the constraint was corrected, and the
-- open policies stayed — every anon can currently read, insert, update,
-- or delete any shop's stock orders across the platform. Restore proper
-- tenant scoping using the owns_shop() + distributor_id pattern already
-- used in 20260622_branch_rls_all_tables.sql.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "stock_orders_read_parties"   ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_insert_shop"    ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_update_parties" ON public.stock_orders;
DROP POLICY IF EXISTS "stock_orders_delete_shop"    ON public.stock_orders;

CREATE POLICY "stock_orders_read_parties" ON public.stock_orders
  FOR SELECT USING (
    public.owns_shop(shop_id)
    OR distributor_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "stock_orders_insert_shop" ON public.stock_orders
  FOR INSERT WITH CHECK (public.owns_shop(shop_id));

CREATE POLICY "stock_orders_update_parties" ON public.stock_orders
  FOR UPDATE USING (
    public.owns_shop(shop_id)
    OR distributor_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "stock_orders_delete_shop" ON public.stock_orders
  FOR DELETE USING (
    public.owns_shop(shop_id)
    OR public.current_user_role() = 'admin'
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 2) users.pass / pass_verify — column-level SELECT revoke
--
-- users_select_public_profile grants row-level SELECT on any role='shop'
-- row to anon (needed for shop discovery / marketplace). It has NEVER
-- been column-scoped, so anon can currently read:
--   - pass         (bcrypt hash — offline-crackable)
--   - pass_verify  (plaintext copy, INTENTIONAL by design in api.js
--                   branch-create logic for "share credentials with
--                   branch staff", but publicly readable via SELECT)
--
-- Row-level policies control which rows are visible. Column-level
-- privileges are separate; a column-level REVOKE on these two closes
-- the leak without touching any working feature.
-- ═══════════════════════════════════════════════════════════════════════

REVOKE SELECT (pass, pass_verify) ON public.users FROM anon, authenticated;

-- Note: the postgres/service_role still has full column access via its
-- superuser-equivalent grants. Edge functions and admin RPCs continue
-- to work. Only anon (public web) and authenticated (logged-in) roles
-- are restricted from reading these two columns.

-- ═══════════════════════════════════════════════════════════════════════
-- 3) distributor_customers — scope reads to owning distributor
--
-- 20260813_distributor_customers_bulk_upload.sql shipped with a plain
-- FOR SELECT USING (true) policy. Every distributor's customer
-- database (name, phone, GSTIN, address, city, credit_limit, owed) is
-- currently readable by any anon.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "dist_customers_read" ON public.distributor_customers;

CREATE POLICY "dist_customers_read" ON public.distributor_customers
  FOR SELECT USING (
    distributor_id = auth.uid()
    OR distributor_id = public.current_profile_id()
    OR public.current_user_role() = 'admin'
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 4) prevent_privilege_escalation — plug the two missing expiry columns
--
-- The trigger currently protects: role, status, phone, subscription,
-- subscription_tier, plan_expires_at, distributor_plan_tier.
-- Missing:
--   - distributor_plan_expires_at   (any distributor can self-extend)
--   - home_service_addon_expires_at (any shop can self-extend the addon)
-- Both are set by razorpay-verify-payment on real payments and by admin.
-- Non-admins can currently PATCH their own row to push these dates
-- arbitrarily far into the future and get the plan/addon for free.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.current_user_role() = 'admin' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- edge function / service role

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Not allowed to change status';
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'Not allowed to change phone';
  END IF;
  IF NEW.subscription IS DISTINCT FROM OLD.subscription THEN
    RAISE EXCEPTION 'Not allowed to change subscription';
  END IF;
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Not allowed to change subscription tier';
  END IF;
  IF NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN
    RAISE EXCEPTION 'Not allowed to change plan expiry';
  END IF;
  IF NEW.distributor_plan_tier IS DISTINCT FROM OLD.distributor_plan_tier THEN
    RAISE EXCEPTION 'Not allowed to change distributor plan';
  END IF;
  -- ── NEWLY GUARDED ────────────────────────────────────────────────
  IF NEW.distributor_plan_expires_at IS DISTINCT FROM OLD.distributor_plan_expires_at THEN
    RAISE EXCEPTION 'Not allowed to change distributor plan expiry';
  END IF;
  IF NEW.home_service_addon_expires_at IS DISTINCT FROM OLD.home_service_addon_expires_at THEN
    RAISE EXCEPTION 'Not allowed to change home service addon expiry';
  END IF;

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) validate_order_total — reject unknown product IDs
--
-- The previous version counted unknown-product lines at the client-
-- submitted price to accommodate "custom lines a shop added manually."
-- That path was exploitable: anon submits items with fake UUIDs at
-- price 0, RPC returns ok:true, order lands via orders_insert_any
-- WITH CHECK (true). Reject unknown products explicitly.
--
-- A shop entering a custom line on the POS uses a real product row in
-- their catalogue (created on the fly in the POS UI), so no legitimate
-- flow depends on the unknown-product fallback.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_order_total(
  p_shop_id uuid,
  p_items   jsonb,
  p_total   numeric
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item        jsonb;
  v_prod        record;
  v_qty         numeric;
  v_unit_price  numeric;
  v_variant     text;
  v_server_total numeric := 0;
  v_tolerance   numeric;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_order');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'qty')::numeric, 0);
    CONTINUE WHEN v_qty <= 0;

    SELECT id, price, variant_prices, discount_pct
      INTO v_prod
      FROM public.products
     WHERE id = NULLIF(v_item->>'id','')::uuid
       AND shop_id = p_shop_id;

    IF v_prod.id IS NULL THEN
      -- Was: count at submitted price. New: reject the whole order.
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'unknown_product',
        'submitted_id', v_item->>'id'
      );
    END IF;

    v_variant := NULLIF(v_item->>'variant','');
    v_unit_price := NULL;
    IF v_variant IS NOT NULL AND v_prod.variant_prices IS NOT NULL THEN
      v_unit_price := NULLIF(v_prod.variant_prices->>v_variant, '')::numeric;
    END IF;
    v_unit_price := COALESCE(v_unit_price, v_prod.price, 0);

    IF COALESCE(v_prod.discount_pct, 0) > 0 THEN
      v_unit_price := v_unit_price * (1 - v_prod.discount_pct::numeric / 100);
    END IF;

    v_server_total := v_server_total + (v_unit_price * v_qty);
  END LOOP;

  v_tolerance := GREATEST(1, v_server_total * 0.01);

  IF p_total < v_server_total - v_tolerance THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'price_mismatch',
      'submitted', p_total,
      'expected', round(v_server_total, 2)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'expected', round(v_server_total, 2)
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6) Missing hot-path indexes
--
-- Every login scans users.phone with no index (linear scan).
-- Every shop dashboard load scans orders and products by shop_id with
-- no index. Add the eight indexes covering the actual query patterns.
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON public.users(phone);

CREATE INDEX IF NOT EXISTS idx_users_parent_shop
  ON public.users(parent_shop_id) WHERE parent_shop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_staff_of
  ON public.users(staff_of) WHERE staff_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_ca_id
  ON public.users(ca_id) WHERE ca_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shop_created
  ON public.orders(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_shop
  ON public.products(shop_id);

CREATE INDEX IF NOT EXISTS idx_credits_from
  ON public.credits(from_id);

CREATE INDEX IF NOT EXISTS idx_credits_to_shop
  ON public.credits(to_shop_id);

-- Force PostgREST to see the new policies + function immediately
NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT 'P0 security fixes applied — verify: run smoke tests before closing this session' AS status;
