-- ═══════════════════════════════════════════════════════════════════════
-- WALK-IN CUSTOMERS — bill anyone, not just pre-linked shops
--
-- REAL-WORLD PROBLEM: a van rep drives a route and passes shops that
-- aren't in the system. Today they cannot sell to them at all — van
-- billing only lists shops with a row in shop_distributor_links, and
-- van_invoices.shop_id is NOT NULL. So the rep either loses the sale or
-- has to stop and run the whole mutual code-linking flow at the
-- counter, which nobody does with a customer waiting.
--
-- FIX: shop_id becomes nullable, and a walk-in is recorded by name and
-- phone instead. A sale to a linked shop is unchanged and still carries
-- shop_id, so nothing about existing behaviour or the shop's own
-- purchase history moves.
--
-- ONE DELIBERATE RESTRICTION: a walk-in cannot buy on CREDIT.
-- Credit means "this account owes us money", and an account is exactly
-- what a walk-in doesn't have — there'd be no khata to post it to, no
-- outstanding balance to chase it in, and nothing for EOD
-- reconciliation to reconcile against. Cash and UPI settle at the
-- counter and are always fine. If a rep wants to extend credit, the
-- shop needs to be linked first — which is the correct business rule,
-- not a technical limitation.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.van_invoices ALTER COLUMN shop_id DROP NOT NULL;
ALTER TABLE public.van_invoices ADD COLUMN IF NOT EXISTS customer_name  text;
ALTER TABLE public.van_invoices ADD COLUMN IF NOT EXISTS customer_phone text;

-- Either a real linked shop, or a named walk-in. Never neither —
-- an invoice with no idea who bought it is unusable for returns,
-- disputes or reconciliation.
ALTER TABLE public.van_invoices DROP CONSTRAINT IF EXISTS van_invoices_has_buyer;
ALTER TABLE public.van_invoices ADD CONSTRAINT van_invoices_has_buyer
  CHECK (shop_id IS NOT NULL OR (customer_name IS NOT NULL AND length(trim(customer_name)) > 0));

-- Same treatment for returns, so a walk-in can bring goods back.
ALTER TABLE public.van_returns ALTER COLUMN shop_id DROP NOT NULL;
ALTER TABLE public.van_returns ADD COLUMN IF NOT EXISTS customer_name  text;
ALTER TABLE public.van_returns ADD COLUMN IF NOT EXISTS customer_phone text;

ALTER TABLE public.van_returns DROP CONSTRAINT IF EXISTS van_returns_has_buyer;
ALTER TABLE public.van_returns ADD CONSTRAINT van_returns_has_buyer
  CHECK (shop_id IS NOT NULL OR (customer_name IS NOT NULL AND length(trim(customer_name)) > 0));


-- CRITICAL: drop the OLD signatures explicitly.
--
-- CREATE OR REPLACE only replaces a function when the argument list
-- matches exactly. Adding p_customer_name/p_customer_phone creates a
-- SECOND overload instead, and Postgres then cannot resolve a call that
-- could match either one:
--   "function sync_van_invoice(...) is not unique"
-- Every existing van sale and return would start failing. Caught this
-- in testing; dropping the old signatures first is the fix.
DROP FUNCTION IF EXISTS public.sync_van_invoice(
  uuid, uuid, uuid, integer, text, timestamptz, numeric, text, numeric, jsonb, uuid);
DROP FUNCTION IF EXISTS public.sync_van_return(
  uuid, uuid, uuid, integer, text, timestamptz, text, numeric, jsonb, text, uuid);


-- ─── SALE ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_van_invoice(
  p_distributor_id uuid,
  p_vehicle_id     uuid,
  p_shop_id        uuid,
  p_invoice_no     integer,
  p_invoice_ref    text,
  p_issued_at      timestamptz,
  p_total          numeric,
  p_payment_mode   text,
  p_amount_paid    numeric,
  p_lines          jsonb,
  p_rep_id         uuid DEFAULT NULL,
  p_customer_name  text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing  uuid;
  v_id        uuid;
  v_wh_id     uuid;
  v_line      jsonb;
  v_needed    numeric;
  v_take      numeric;
  v_stock     record;
  v_batch_in  uuid;
BEGIN
  -- Already synced? Return it. A device retrying after a dropped
  -- connection is normal on a rural route, not an error.
  SELECT id INTO v_existing FROM public.van_invoices
   WHERE vehicle_id = p_vehicle_id AND invoice_no = p_invoice_no;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF p_shop_id IS NULL AND (p_customer_name IS NULL OR trim(p_customer_name) = '') THEN
    RAISE EXCEPTION 'Select a shop or enter the customer name';
  END IF;

  -- Credit needs an account to owe against. A walk-in has none, so
  -- there would be no khata to post it to and nothing to chase it in.
  IF p_shop_id IS NULL AND p_payment_mode = 'credit' THEN
    RAISE EXCEPTION 'Credit sales need a linked shop. Take cash or UPI, or link the shop first.';
  END IF;

  SELECT warehouse_id INTO v_wh_id FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_wh_id IS NULL THEN RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id; END IF;

  INSERT INTO public.van_invoices (
    distributor_id, vehicle_id, shop_id, rep_id, invoice_no, invoice_ref,
    subtotal, total, payment_mode, amount_paid, issued_at, stock_applied,
    customer_name, customer_phone
  ) VALUES (
    p_distributor_id, p_vehicle_id, p_shop_id, p_rep_id, p_invoice_no, p_invoice_ref,
    p_total, p_total, p_payment_mode, p_amount_paid, p_issued_at, false,
    NULLIF(trim(COALESCE(p_customer_name, '')), ''), NULLIF(trim(COALESCE(p_customer_phone, '')), '')
  ) RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_batch_in := NULLIF(v_line->>'batch_id','')::uuid;
    v_needed   := (v_line->>'qty_base')::numeric;

    INSERT INTO public.van_invoice_lines (invoice_id, product_id, batch_id, qty_base, rate, line_total)
    VALUES (v_id, (v_line->>'product_id')::uuid, v_batch_in, v_needed,
            (v_line->>'rate')::numeric, v_needed * (v_line->>'rate')::numeric);

    IF v_batch_in IS NOT NULL THEN
      UPDATE public.warehouse_stock
         SET qty_base = GREATEST(qty_base - v_needed, 0), updated_at = now()
       WHERE warehouse_id = v_wh_id
         AND product_id = (v_line->>'product_id')::uuid
         AND batch_id = v_batch_in
         AND condition = 'sellable';
    ELSE
      -- FEFO: nearest-expiry first, spanning batches if the front one
      -- runs short.
      FOR v_stock IN
        SELECT ws.id, ws.qty_base
          FROM public.warehouse_stock ws
          LEFT JOIN public.product_batches b ON b.id = ws.batch_id
         WHERE ws.warehouse_id = v_wh_id
           AND ws.product_id = (v_line->>'product_id')::uuid
           AND ws.condition = 'sellable'
           AND ws.qty_base > 0
         ORDER BY b.expiry_date ASC NULLS LAST
      LOOP
        EXIT WHEN v_needed <= 0;
        v_take := LEAST(v_stock.qty_base, v_needed);
        UPDATE public.warehouse_stock
           SET qty_base = qty_base - v_take, updated_at = now()
         WHERE id = v_stock.id;
        v_needed := v_needed - v_take;
      END LOOP;
    END IF;
  END LOOP;

  -- Credit sale = money the shop now owes. Guarded by the shop_id check
  -- above, so this only ever runs for a real linked account.
  IF p_payment_mode = 'credit' AND p_shop_id IS NOT NULL THEN
    INSERT INTO public.credits (from_id, to_shop_id, description, amount, paid)
    VALUES (p_distributor_id, p_shop_id, 'Van sale: ' || p_invoice_ref, p_total, false);
  END IF;

  UPDATE public.van_invoices SET stock_applied = true WHERE id = v_id;

  UPDATE public.van_document_series
     SET last_synced_no = GREATEST(last_synced_no, p_invoice_no)
   WHERE vehicle_id = p_vehicle_id AND doc_type = 'invoice';

  RETURN v_id;
END;
$$;


-- ─── RETURN ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_van_return(
  p_distributor_id uuid,
  p_vehicle_id     uuid,
  p_shop_id        uuid,
  p_credit_no      integer,
  p_credit_ref     text,
  p_issued_at      timestamptz,
  p_reason         text,
  p_total_credit   numeric,
  p_lines          jsonb,
  p_photo_url      text DEFAULT NULL,
  p_rep_id         uuid DEFAULT NULL,
  p_customer_name  text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing uuid;
  v_id       uuid;
  v_wh_id    uuid;
  v_line     jsonb;
  v_condition text := CASE WHEN p_reason IN ('expired','damaged') THEN 'damaged' ELSE 'quarantine' END;
BEGIN
  SELECT id INTO v_existing FROM public.van_returns
   WHERE vehicle_id = p_vehicle_id AND credit_no = p_credit_no;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF p_shop_id IS NULL AND (p_customer_name IS NULL OR trim(p_customer_name) = '') THEN
    RAISE EXCEPTION 'Select a shop or enter the customer name';
  END IF;

  SELECT warehouse_id INTO v_wh_id FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_wh_id IS NULL THEN RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id; END IF;

  INSERT INTO public.van_returns (
    distributor_id, vehicle_id, shop_id, rep_id, credit_no, credit_ref,
    reason, photo_url, total_credit, issued_at, stock_applied,
    customer_name, customer_phone
  ) VALUES (
    p_distributor_id, p_vehicle_id, p_shop_id, p_rep_id, p_credit_no, p_credit_ref,
    p_reason, p_photo_url, p_total_credit, p_issued_at, false,
    NULLIF(trim(COALESCE(p_customer_name, '')), ''), NULLIF(trim(COALESCE(p_customer_phone, '')), '')
  ) RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.van_return_lines (return_id, product_id, batch_id, qty_base, rate, line_total)
    VALUES (
      v_id, (v_line->>'product_id')::uuid, NULLIF(v_line->>'batch_id','')::uuid,
      (v_line->>'qty_base')::numeric, (v_line->>'rate')::numeric,
      (v_line->>'qty_base')::numeric * (v_line->>'rate')::numeric
    );

    -- Back onto the van as quarantine/damaged — NEVER sellable. This is
    -- what stops expired goods being resold at the next stop.
    INSERT INTO public.warehouse_stock (warehouse_id, product_id, batch_id, qty_base, condition)
    VALUES (v_wh_id, (v_line->>'product_id')::uuid, NULLIF(v_line->>'batch_id','')::uuid,
            (v_line->>'qty_base')::numeric, v_condition)
    ON CONFLICT (warehouse_id, product_id, batch_id, condition)
    DO UPDATE SET qty_base = public.warehouse_stock.qty_base + EXCLUDED.qty_base, updated_at = now();
  END LOOP;

  -- Only a real account can hold a credit balance. A walk-in return is
  -- settled in cash at the counter, so there's nothing to post.
  IF p_shop_id IS NOT NULL THEN
    INSERT INTO public.credits (from_id, to_shop_id, description, amount, paid)
    VALUES (p_distributor_id, p_shop_id, 'Return: ' || p_credit_ref || ' (' || p_reason || ')', -p_total_credit, false);
  END IF;

  UPDATE public.van_returns SET stock_applied = true WHERE id = v_id;

  UPDATE public.van_document_series
     SET last_synced_no = GREATEST(last_synced_no, p_credit_no)
   WHERE vehicle_id = p_vehicle_id AND doc_type = 'credit_note';

  RETURN v_id;
END;
$$;

SELECT 'Walk-in billing enabled — vans can now sell to any customer' AS status;
