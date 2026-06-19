-- Fix: staff accounts could not see ANY orders for their shop — including
-- bills they had just created themselves — and this silently affected the
-- owner's view too in some cases (a staff-session read of the same shop's
-- orders would return zero rows, since RLS filters rows out invisibly
-- rather than erroring).
--
-- Root cause: orders_read_shop only matched shop_id = auth.uid() (the
-- OWNER's own auth uid) or user_id = auth.uid() (a CUSTOMER's own auth
-- uid). A staff member logs in with their own separate auth.uid(), which
-- is neither of those — it's linked to the shop via users.staff_of, which
-- the policy never checked.

-- Helper: resolve which shop the CURRENT auth session belongs to —
-- the owner's own id if they're a shop, or their staff_of parent shop id
-- if they're staff. SECURITY DEFINER so this lookup itself isn't blocked
-- by RLS on the users table.
CREATE OR REPLACE FUNCTION public.current_user_shop_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(staff_of, id) FROM public.users WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "orders_read_shop" ON public.orders;
CREATE POLICY "orders_read_shop"
  ON public.orders FOR SELECT
  USING (
    shop_id = public.current_user_shop_id()
    OR user_id = auth.uid()::text
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "orders_update_shop" ON public.orders;
CREATE POLICY "orders_update_shop"
  ON public.orders FOR UPDATE
  USING (
    shop_id = public.current_user_shop_id()
    OR public.current_user_role() = 'admin'
  );

-- Same fix applied to the DELETE policy added earlier for Reset Test Data,
-- so staff's own actions stay scoped consistently — but note: deleting
-- test data should remain OWNER-ONLY, so this intentionally still uses
-- shop_id = auth.uid() (the owner's literal id), NOT the staff-aware
-- helper, to make sure staff cannot trigger a shop-wide data reset.
-- (No change needed here — left as-is on purpose, documented for clarity.)

SELECT 'orders RLS now correctly recognizes staff sessions via staff_of' AS status;

-- Same root cause, second occurrence: placeOrder() decrements product
-- stock on every sale, but staff could never actually do that — every
-- staff-created bill silently failed to reduce inventory (the UPDATE was
-- blocked by RLS, caught by a per-item try/catch in api.js, and just
-- logged to console — the bill itself still saved, but stock never moved).
-- Same fix: allow the update if the requester's resolved shop matches.
DROP POLICY IF EXISTS "products_update_owner" ON public.products;
CREATE POLICY "products_update_owner"
  ON public.products FOR UPDATE
  USING (shop_id = public.current_user_shop_id());

SELECT 'products RLS now allows staff to update stock on their shop''s items' AS status;

-- Same root cause, third occurrence: a staff member adding a customer to
-- the credit/khata book during billing (Credit payment method) would hit
-- the identical RLS blindspot on the credits table.
DROP POLICY IF EXISTS "credits_read_parties" ON public.credits;
CREATE POLICY "credits_read_parties"
  ON public.credits FOR SELECT
  USING (
    from_id = auth.uid()
    OR to_shop_id = public.current_user_shop_id()
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "credits_update_parties" ON public.credits;
CREATE POLICY "credits_update_parties"
  ON public.credits FOR UPDATE
  USING (
    from_id = auth.uid()
    OR to_shop_id = public.current_user_shop_id()
  );

SELECT 'credits RLS now recognizes staff sessions for their shop''s khata book' AS status;


