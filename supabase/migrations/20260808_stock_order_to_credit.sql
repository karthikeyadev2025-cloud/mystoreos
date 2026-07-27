-- ═══════════════════════════════════════════════════════════════════════
-- POST A DELIVERED STOCK ORDER TO THE CREDIT LEDGER
--
-- FOUND IN PHASE 6 (shop <-> distributor connection testing):
-- an inconsistency across the three ways a distributor sells.
--
--   van sale on credit    -> posts to credits automatically
--   direct/counter sale   -> posts to credits automatically
--   STOCK ORDER           -> nothing. The distributor has to open the
--                            credit tab and re-type the amount by hand.
--
-- Stock orders are the most common flow of the three, and the one where
-- the amount is already known exactly. Re-typing it invites a
-- transposed digit, and forgetting entirely means the shop's debt is
-- simply never recorded — the distributor's outstanding total quietly
-- understates what they're owed.
--
-- DELIBERATELY NOT AUTOMATIC. stock_orders has no payment_mode column,
-- so the system genuinely doesn't know whether a given delivery was
-- paid cash on arrival or taken on credit. Auto-posting every delivery
-- would invent debt for shops that already paid. This makes it ONE TAP
-- with the correct amount pre-filled, which removes the typo and the
-- forgetting without guessing at something the data can't tell us.
--
-- Idempotent: an order already posted cannot be posted twice, so a
-- double-tap can't double a shop's debt.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.stock_orders ADD COLUMN IF NOT EXISTS credit_posted_id uuid;

CREATE OR REPLACE FUNCTION public.post_stock_order_to_credit(
  p_order_id       uuid,
  p_distributor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order  record;
  v_credit uuid;
BEGIN
  SELECT * INTO v_order FROM public.stock_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.distributor_id IS DISTINCT FROM p_distributor_id THEN
    RAISE EXCEPTION 'This order belongs to another distributor';
  END IF;

  -- Posting twice would silently double what the shop appears to owe,
  -- which is worse than an error message.
  IF v_order.credit_posted_id IS NOT NULL THEN
    RAISE EXCEPTION 'This order is already on the credit ledger';
  END IF;

  IF v_order.shop_id IS NULL THEN
    RAISE EXCEPTION 'Walk-in orders have no account to owe against';
  END IF;

  IF COALESCE(v_order.total, 0) <= 0 THEN
    RAISE EXCEPTION 'Order total is zero';
  END IF;

  -- paid=false so it counts toward the dashboard's own outstanding
  -- figure, which sums (amount - paidSoFar) over unpaid credits.
  INSERT INTO public.credits (from_id, to_shop_id, description, amount, paid)
  VALUES (
    p_distributor_id,
    v_order.shop_id,
    'Stock supply · ' || to_char(COALESCE(v_order.delivered_at, v_order.created_at), 'DD Mon'),
    v_order.total,
    false
  )
  RETURNING id INTO v_credit;

  UPDATE public.stock_orders SET credit_posted_id = v_credit WHERE id = p_order_id;

  RETURN v_credit;
END;
$$;

SELECT 'post_stock_order_to_credit() installed' AS status;
