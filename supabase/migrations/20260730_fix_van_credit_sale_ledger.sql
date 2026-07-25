-- ═══════════════════════════════════════════════════════════════════════
-- FIELD FIX — van credit sales were never reaching the credit ledger
--
-- BUG FOUND DURING FULL END-TO-END WORKFLOW AUDIT:
-- sync_van_return() correctly INSERTs into public.credits (a return is
-- money the shop no longer owes). sync_van_invoice() does NOT — so a
-- rep selling ₹5,000 of stock on CREDIT recorded the invoice and
-- decremented van stock correctly, but the ₹5,000 the shop now owes
-- appeared in NO ledger anywhere.
--
-- Consequences of leaving this:
--   • The shop's khata / outstanding balance is understated
--   • The distributor's Total Outstanding is understated
--   • EOD reconciliation's expected_credit figure has nothing to
--     reconcile against
--   • The money is simply never chased, because nothing records it
--
-- This is the exact mirror of the return-side bug caught earlier
-- (paid=true making a credit invisible to the outstanding SUM) —
-- same table, same consequence, opposite direction.
--
-- FIX: only for payment_mode='credit'. Cash and UPI sales are settled
-- at the counter and correctly create no ledger entry. Inserted with
-- paid=false so it counts toward SUM(amount - paidSoFar) WHERE
-- paid=false, which is how the distributor dashboard actually computes
-- Total Outstanding — verified against that formula, not assumed.
--
-- Idempotency is preserved: the early-return for an already-synced
-- invoice happens BEFORE this code, so a retried sync cannot create a
-- second credit entry.
-- ═══════════════════════════════════════════════════════════════════════

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
  p_rep_id         uuid DEFAULT NULL
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
  -- connection is normal on a rural route, not an error. Everything
  -- below (stock decrement, credit ledger) is therefore guaranteed to
  -- run exactly once per invoice.
  SELECT id INTO v_existing FROM public.van_invoices
   WHERE vehicle_id = p_vehicle_id AND invoice_no = p_invoice_no;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT warehouse_id INTO v_wh_id FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_wh_id IS NULL THEN RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id; END IF;

  INSERT INTO public.van_invoices (
    distributor_id, vehicle_id, shop_id, rep_id, invoice_no, invoice_ref,
    subtotal, total, payment_mode, amount_paid, issued_at, stock_applied
  ) VALUES (
    p_distributor_id, p_vehicle_id, p_shop_id, p_rep_id, p_invoice_no, p_invoice_ref,
    p_total, p_total, p_payment_mode, p_amount_paid, p_issued_at, false
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
      -- FEFO: consume nearest-expiry first, spanning batches if the
      -- front batch runs short.
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

  -- THE FIX: a credit sale is money the shop now owes. Without this,
  -- the sale is recorded but the debt exists nowhere — not in the
  -- shop's khata, not in the distributor's outstanding total, and with
  -- nothing for EOD reconciliation's expected_credit to reconcile
  -- against. Cash/UPI are settled at the counter and correctly create
  -- no entry.
  IF p_payment_mode = 'credit' THEN
    INSERT INTO public.credits (from_id, to_shop_id, description, amount, paid)
    VALUES (p_distributor_id, p_shop_id,
            'Van sale: ' || p_invoice_ref, p_total, false);
  END IF;

  UPDATE public.van_invoices SET stock_applied = true WHERE id = v_id;

  UPDATE public.van_document_series
     SET last_synced_no = GREATEST(last_synced_no, p_invoice_no)
   WHERE vehicle_id = p_vehicle_id AND doc_type = 'invoice';

  RETURN v_id;
END;
$$;

SELECT 'Van credit sales now post to the credit ledger' AS status;
