-- ═══════════════════════════════════════════════════════════════════════
-- DISPATCH SCHEDULING for stock orders.
--
-- Real distributor problem: accepting a shop's order today doesn't mean
-- a vehicle goes out today. A distributor doesn't send a truck for one
-- box — they wait until enough orders have piled up along a delivery
-- route to make the trip worth it, THEN dispatch everything for that
-- route together.
--
-- Before this migration, 'accepted' was the only state past pending —
-- no way to say "I'll fulfil this, but not yet" versus "this just left
-- the warehouse." Both looked identical to the shop.
--
-- New status: 'dispatched' — sits between accepted and (implicitly)
-- delivered. New columns:
--   expected_dispatch_date  — distributor's estimate, set at accept
--                             time or edited later. Optional; NULL means
--                             "no ETA given yet."
--   dispatched_at           — real timestamp, set the moment the
--                             distributor actually marks it dispatched.
--                             Independent of expected_dispatch_date so
--                             an estimate slipping doesn't corrupt the
--                             real dispatch record once it happens.
--
-- Deliberately did NOT move the credit-ledger entry (created when a
-- stock order is accepted, per updateStockOrderStatus) to fire on
-- dispatch instead — that's a working, already-fixed piece of the money
-- flow; this migration is purely additive logistics tracking on top of
-- it, not a restructure of billing timing.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.stock_orders
  ADD COLUMN IF NOT EXISTS expected_dispatch_date date,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

-- ── Bulk dispatch RPC ──────────────────────────────────────────────
-- The actual "route is full, send it all" action: a distributor selects
-- every accepted order for one route/area and dispatches them together
-- in one tap, rather than clicking Dispatch on each order individually.
-- Only touches rows that are (a) currently 'accepted' and (b) actually
-- belong to the calling distributor — silently skips anything that
-- doesn't match rather than erroring, so a stale selection (an order
-- someone else already dispatched a moment ago) doesn't block the rest.
CREATE OR REPLACE FUNCTION public.dispatch_stock_orders(p_order_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatched integer;
BEGIN
  IF public.current_user_role() NOT IN ('distributor', 'admin') THEN
    RAISE EXCEPTION 'Only distributors can dispatch stock orders' USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH updated AS (
    UPDATE public.stock_orders
    SET status = 'dispatched', dispatched_at = now()
    WHERE id = ANY(p_order_ids)
      AND status = 'accepted'
      AND (distributor_id = public.current_profile_id() OR public.current_user_role() = 'admin')
    RETURNING id
  )
  SELECT count(*) INTO v_dispatched FROM updated;

  RETURN jsonb_build_object('dispatched', v_dispatched, 'requested', array_length(p_order_ids, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_stock_orders(uuid[]) TO authenticated;

SELECT 'dispatch scheduling added — expected_dispatch_date, dispatched_at, dispatch_stock_orders() bulk RPC' AS status;
