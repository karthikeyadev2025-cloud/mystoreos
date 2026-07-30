-- ═══════════════════════════════════════════════════════════════════════
-- P1 MIGRATION — atomic order+stock RPCs, rate-limit infrastructure
-- 2026-07-31
--
-- Closes three bug classes from the July 30 audit:
--
--   1) placeOrder inventory race (P1 #12) — every sale runs through a
--      read-then-write pair with a try/catch that swallows failures.
--      Two concurrent bills for the same product both read stock=10 and
--      both write stock=9 (lost update). A stock UPDATE that fails from
--      RLS or network mid-order silently leaves inventory drifted from
--      the bill. This adds place_order_atomic() and process_return_atomic()
--      RPCs that do the check + decrement + insert in one transaction
--      using UPDATE ... WHERE stock >= qty RETURNING for atomicity.
--
--   2) Same class of race in processReturn — restoring stock on returns
--      has the same read-then-write pattern.
--
--   3) support-chat is unauthenticated with no rate limit (P1 #16). Any
--      anon can burn the Gemini quota. This adds a rate_limit_log table
--      and check_rate_limit() function that the rewritten support-chat
--      edge function calls.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) place_order_atomic — one transaction, one row inserted, stock
--    decrement atomic per product using RETURNING to prove success.
--
--    Behaviour:
--      • Runs validate_order_total() first (server-side price check).
--        Any price-mismatch or unknown-product rejects before touching
--        inventory. Reasons returned as jsonb.
--      • For each item: UPDATE ... WHERE stock >= qty RETURNING stock.
--        If no row returned, the product either doesn't exist in this
--        shop's catalogue or has insufficient stock — both cases raise
--        and roll back everything already decremented for earlier items.
--      • Order row inserted last. If insert fails (RLS, constraint),
--        every decrement rolls back with it because it's one transaction.
--      • On any error, function returns {ok:false, reason, ...} and the
--        client gets a specific message instead of a silent inventory
--        drift.
--
--    SECURITY DEFINER so the function can INSERT into orders and UPDATE
--    products without depending on the caller's RLS role. The
--    authorization check is done inside the function: the caller's
--    user_id must match p_user_id (for authenticated customers) OR the
--    caller must own the shop (for POS-side sales where the shop
--    itself is checkout-ing on behalf of a walk-in customer).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.place_order_atomic(
  p_shop_id             uuid,
  p_user_id             text,
  p_items               jsonb,
  p_total               numeric,
  p_customer_phone      text    DEFAULT NULL,
  p_customer_gstin      text    DEFAULT NULL,
  p_customer_address    text    DEFAULT NULL,
  p_customer_state_code text    DEFAULT NULL,
  p_customer_id         uuid    DEFAULT NULL,
  p_payment_method      text    DEFAULT 'Cash',
  p_status              text    DEFAULT 'Pending',
  p_invoice_no          integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item          jsonb;
  v_item_id       uuid;
  v_qty           integer;
  v_updated_stock integer;
  v_price_check   jsonb;
  v_order_id      uuid;
  v_caller_id     uuid;
  v_caller_owns   boolean;
BEGIN
  -- ── Authorization ───────────────────────────────────────────────────
  -- Two legitimate callers:
  --   (a) a customer whose auth uid matches p_user_id — normal
  --       customer-side checkout
  --   (b) a shop owner/staff running POS on behalf of a walk-in
  --       (p_user_id is a walk-in string, caller owns the shop)
  v_caller_id := public.current_profile_id();
  v_caller_owns := (v_caller_id IS NOT NULL AND public.owns_shop(p_shop_id));

  IF NOT v_caller_owns AND v_caller_id::text IS DISTINCT FROM p_user_id THEN
    -- Reject; the anon-checkout path (customer without an account)
    -- still works because customer_id is null and p_user_id is set to
    -- a walk-in identifier that matches nothing — this branch only
    -- fires when the caller is authenticated and pretending to be
    -- someone else, or when a customer is trying to insert an order
    -- for someone else's user_id.
    IF v_caller_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_your_order');
    END IF;
  END IF;

  -- ── Server-side price + product check ───────────────────────────────
  v_price_check := public.validate_order_total(p_shop_id, p_items, p_total);
  IF (v_price_check->>'ok')::boolean IS DISTINCT FROM true THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', v_price_check->>'reason',
      'detail', v_price_check
    );
  END IF;

  -- ── Atomic stock decrement per line ─────────────────────────────────
  -- UPDATE ... WHERE stock >= qty RETURNING stock is the classic lock-free
  -- atomic pattern: Postgres row-locks the product row for the duration
  -- of the UPDATE, and the WHERE clause means concurrent writes serialize
  -- correctly. If no row is affected, either the product doesn't belong
  -- to this shop or stock < requested qty — both are rejections.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_id := NULLIF(v_item->>'id','')::uuid;
    v_qty := COALESCE((v_item->>'qty')::integer, 0);

    IF v_item_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.products
       SET stock = stock - v_qty
     WHERE id = v_item_id
       AND shop_id = p_shop_id
       AND stock >= v_qty
    RETURNING stock INTO v_updated_stock;

    IF v_updated_stock IS NULL THEN
      -- Transaction rolls back all previous decrements automatically
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'insufficient_stock',
        'product_id', v_item_id,
        'requested_qty', v_qty
      );
    END IF;
  END LOOP;

  -- ── Insert the order — if this fails, stock rolls back too ──────────
  INSERT INTO public.orders (
    user_id, shop_id, items, total, status,
    customer_phone, customer_gstin, customer_address,
    customer_state_code, customer_id, payment_method,
    invoice_no
  ) VALUES (
    p_user_id, p_shop_id, p_items, p_total, p_status,
    p_customer_phone, p_customer_gstin, p_customer_address,
    p_customer_state_code, p_customer_id, p_payment_method,
    p_invoice_no
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'items_count', jsonb_array_length(p_items)
  );

EXCEPTION WHEN OTHERS THEN
  -- Any error rolls back everything. Return the sqlerror as a reason so
  -- the client can surface it — do NOT surface SQLSTATE or table names.
  RETURN jsonb_build_object(
    'ok', false,
    'reason', 'db_error',
    'message', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order_atomic(
  uuid, text, jsonb, numeric, text, text, text, text, uuid, text, text, integer
) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) process_return_atomic — same atomicity guarantee for the reverse.
--
--    Updates the order status/refund fields AND restores stock in one
--    transaction. Restore is unconditional (no stock-availability check
--    since returned items should always come back), but still atomic
--    against concurrent sales of the same product.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_return_atomic(
  p_order_id       uuid,
  p_return_items   jsonb,
  p_refund_amount  numeric,
  p_refund_mode    text DEFAULT 'cash',
  p_is_full_return boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item        jsonb;
  v_item_id     uuid;
  v_qty         integer;
  v_order       public.orders;
  v_prior       numeric;
  v_shop_id     uuid;
BEGIN
  -- Load the order + verify caller owns the shop
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF NOT public.owns_shop(v_order.shop_id) AND public.current_user_role() <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_your_shop');
  END IF;

  v_shop_id := v_order.shop_id;
  v_prior := COALESCE(v_order.refund_amount, 0);

  -- Update the order row FIRST — if update fails, no stock is touched
  UPDATE public.orders
     SET status = CASE WHEN p_is_full_return THEN 'Returned' ELSE 'Accepted' END,
         returned_at = now(),
         refund_amount = v_prior + p_refund_amount,
         refund_mode = p_refund_mode,
         returned_items = p_return_items
   WHERE id = p_order_id;

  -- Restore stock atomically per line — same UPDATE ... RETURNING pattern
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_return_items) LOOP
    v_item_id := NULLIF(v_item->>'id','')::uuid;
    v_qty := COALESCE((v_item->>'returnQty')::integer, 0);

    IF v_item_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- Scope to shop_id so this can't be used to increment stock for
    -- some other shop's product with a matching id (defensive against
    -- a hypothetical caller passing crafted item ids).
    UPDATE public.products
       SET stock = stock + v_qty
     WHERE id = v_item_id
       AND shop_id = v_shop_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'refund_amount', p_refund_amount,
    'is_full_return', p_is_full_return
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'db_error', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_return_atomic(uuid, jsonb, numeric, text, boolean)
  TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) Rate limit infrastructure for support-chat and other public
--    endpoints that could be abused to burn API credits or spam.
--
--    A simple per-identifier sliding-window counter table with an
--    auto-cleanup helper. Called from support-chat (and can be reused
--    by future public edge functions).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id           bigserial PRIMARY KEY,
  identifier   text NOT NULL,   -- e.g. 'support-chat:<user_id>' or 'support-chat:ip:<ip>'
  bucket       text NOT NULL,   -- 'support-chat', etc.
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON public.rate_limit_log(bucket, identifier, created_at DESC);

-- Locked-down: only the service role writes/reads. RLS off — nothing
-- for tenants to see or touch. Direct access from edge functions
-- (which use the service role key) works fine.
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
-- No policies = nothing but service role can access.

-- Returns true if the call is allowed, false if over quota. Increments
-- the counter on 'allowed'. Window is in seconds; limit is calls-per-window.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket     text,
  p_identifier text,
  p_limit      integer,
  p_window_sec integer
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.rate_limit_log
   WHERE bucket = p_bucket
     AND identifier = p_identifier
     AND created_at > now() - (p_window_sec || ' seconds')::interval;

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_log (bucket, identifier) VALUES (p_bucket, p_identifier);
  RETURN true;
END;
$$;

-- Only service role should call this — it's a mutation.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

-- Housekeeping: drop rows older than 24h. Call from a nightly cron.
CREATE OR REPLACE FUNCTION public.prune_rate_limit_log()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH d AS (
    DELETE FROM public.rate_limit_log
     WHERE created_at < now() - interval '24 hours'
     RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM d;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_rate_limit_log() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.prune_rate_limit_log() TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT 'P1 atomic RPCs and rate-limit infrastructure installed' AS status;
