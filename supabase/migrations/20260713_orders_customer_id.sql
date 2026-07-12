-- ═══════════════════════════════════════════════════════════════════════
-- "Bill in his portal automatically" — checked precisely rather than
-- assuming, and found two real problems, one much worse than the other.
--
-- PROBLEM 1 (this file, first half): every POS-created order stores
-- user_id as a formatted string ('walk-in:Name:Phone'), never the
-- customer's real account UUID, even when the phone matches an existing
-- account. Confirmed by reading the actual checkout code. Consequence:
-- the portal's realtime subscription (filtered on the customer's own
-- UUID) can never match these orders, and is UPDATE-only besides —
-- never fires for a brand new POS bill either way. Fix: add customer_id,
-- populated additively by placeOrder() when the phone matches, without
-- touching user_id or anything that already parses it.
--
-- PROBLEM 2 (below, the more serious one): while re-testing PROBLEM 1's
-- fix under GENUINE RLS enforcement — a real non-superuser role with
-- FORCE ROW LEVEL SECURITY, not the postgres superuser, which bypasses
-- RLS entirely and silently passes tests that prove nothing — found that
-- the phone-matching fallback getUserOrders() has relied on since it was
-- built has literally no RLS policy backing it. Confirmed 0 rows
-- visible under real enforcement for a query that should return 1. This
-- means the "bill shows up automatically once you make an account with
-- the same phone" promise has likely never actually worked in
-- production — RLS silently filters, never errors, so nothing would
-- have surfaced this without deliberately re-testing under a real role.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id) WHERE customer_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- SEPARATE, MORE SEVERE BUG found while validating the fix above: the
-- phone-matching fallback getUserOrders() has relied on since it was
-- built ('when a shop bills a guest and that phone later creates an
-- account, those bills show up automatically') has NO corresponding RLS
-- policy. orders_read_shop only ever permitted shop_id ownership or an
-- EXACT user_id match — never a customer_phone match. RLS silently
-- filters rows rather than erroring, so the client-side query for
-- 'orders matching my phone' has been returning zero rows for every
-- customer, always, with nothing to signal that anything was wrong.
--
-- Caught this specifically because I re-tested it under GENUINE RLS
-- enforcement (SET SESSION AUTHORIZATION to a real non-superuser role +
-- FORCE ROW LEVEL SECURITY) rather than as the postgres superuser, which
-- bypasses RLS entirely and would have kept silently passing a test that
-- proved nothing. Confirmed on local Postgres: 0 visible rows under
-- real enforcement, for a query that should have returned 1.
--
-- Phone comparison is normalized (strip non-digits, compare last 10)
-- to match the exact normalization getUserOrders() already does
-- client-side — a policy comparing raw strings would silently reject
-- '+91 98765 43210' against '9876543210' even though they're the same
-- number.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.normalized_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10)
$$;

DROP POLICY IF EXISTS "orders_read_shop" ON public.orders;
CREATE POLICY "orders_read_shop" ON public.orders FOR SELECT USING (
  public.owns_shop(shop_id)
  OR user_id = public.current_profile_id()::text
  OR customer_id = public.current_profile_id()
  OR (
    customer_phone IS NOT NULL
    AND public.normalized_phone(customer_phone) <> ''
    AND public.normalized_phone(customer_phone) = public.normalized_phone(
      (SELECT phone FROM public.users WHERE id = public.current_profile_id())
    )
  )
  OR public.current_user_role() = 'admin'
);

SELECT 'orders.customer_id added AND the missing customer_phone RLS policy created — the phone-matching reconciliation in getUserOrders can now actually return rows' AS status;
