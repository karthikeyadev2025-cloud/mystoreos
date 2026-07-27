-- ═══════════════════════════════════════════════════════════════════════
-- DIRECT SALE — a distributor selling from the counter or over the phone
--
-- THE GAP: a distributor could only ever FULFIL orders that a shop
-- placed through the app, or that a rep booked in the field. If a shop
-- phoned the godown — which is how most of this business actually
-- happens — the distributor had no way to create that order at all.
-- They'd fall back to a paper pad and lose it from the system entirely:
-- no invoice, no dispatch tracking, no credit ledger entry, nothing in
-- their reports.
--
-- FIX: create_direct_sale() lets the distributor raise the order
-- themselves, for a linked shop OR a walk-in customer, and it lands in
-- the SAME stock_orders pipeline the dashboard already handles
-- (accepted → dispatched → delivered). No parallel flow, no new
-- dispatch UI.
--
-- Starts at 'accepted' rather than 'pending' — deliberately. 'pending'
-- means "waiting for the distributor to accept", and a distributor
-- creating their own order has self-evidently already accepted it.
-- Leaving it pending would put it in their own action queue.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.stock_orders ADD COLUMN IF NOT EXISTS customer_name  text;
ALTER TABLE public.stock_orders ADD COLUMN IF NOT EXISTS customer_phone text;
-- Distinguishes an order the distributor raised themselves from one a
-- shop placed. Useful for reporting, and it's how the UI knows not to
-- show "accept/reject" on something the distributor created.
ALTER TABLE public.stock_orders ADD COLUMN IF NOT EXISTS created_by_distributor boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.create_direct_sale(
  p_distributor_id uuid,
  p_shop_id        uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_items          jsonb,
  p_total          numeric,
  p_payment_mode   text DEFAULT 'cash'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id        uuid;
  v_shop_name text;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one product';
  END IF;

  IF p_shop_id IS NULL AND (p_customer_name IS NULL OR trim(p_customer_name) = '') THEN
    RAISE EXCEPTION 'Select a shop or enter the customer name';
  END IF;

  -- Credit needs an account to owe against — same rule as van sales.
  -- A walk-in has no khata to post it to and nothing to chase it in.
  IF p_shop_id IS NULL AND p_payment_mode = 'credit' THEN
    RAISE EXCEPTION 'Credit sales need a linked shop. Take cash or UPI, or link the shop first.';
  END IF;

  IF p_shop_id IS NOT NULL THEN
    SELECT name INTO v_shop_name FROM public.users WHERE id = p_shop_id;
  END IF;

  INSERT INTO public.stock_orders (
    shop_id, shop_name, items, total, status, distributor_id,
    customer_name, customer_phone, created_by_distributor
  ) VALUES (
    p_shop_id,
    COALESCE(v_shop_name, trim(p_customer_name)),
    p_items, p_total, 'accepted', p_distributor_id,
    NULLIF(trim(COALESCE(p_customer_name, '')), ''),
    NULLIF(trim(COALESCE(p_customer_phone, '')), ''),
    true
  ) RETURNING id INTO v_id;

  -- Sold on credit → the shop owes this. Same ledger treatment as a van
  -- credit sale, so outstanding totals and reminders work identically
  -- regardless of how the sale was taken.
  IF p_payment_mode = 'credit' AND p_shop_id IS NOT NULL THEN
    INSERT INTO public.credits (from_id, to_shop_id, description, amount, paid)
    VALUES (p_distributor_id, p_shop_id,
            'Direct sale ' || to_char(now(), 'DD Mon'), p_total, false);
  END IF;

  RETURN v_id;
END;
$$;

SELECT 'create_direct_sale() installed — distributors can now sell directly' AS status;
