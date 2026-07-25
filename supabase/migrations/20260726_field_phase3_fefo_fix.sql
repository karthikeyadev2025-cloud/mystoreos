-- ═══════════════════════════════════════════════════════════════════════
-- FIELD PHASE 3a-fix — FEFO batch allocation on van sales
--
-- BUG FOUND IN TESTING: sync_van_invoice() matched stock rows on
-- `batch_id IS NOT DISTINCT FROM <line batch>`. When a device sent a
-- line with no batch (the normal case — a rep selling off a van does
-- not pick batch numbers at the counter), that matched only stock rows
-- with a NULL batch. Real stock, which HAS a batch, was never matched.
--
-- The decrement then silently did nothing. No error, no stock change,
-- invoice recorded as synced. That's the worst possible failure mode:
-- the van's ledger drifts from physical reality with nothing flagged
-- until end-of-day reconciliation, by which point the cause is gone.
--
-- FIX: when a line names no batch, allocate FEFO — First Expired,
-- First Out. That's also the correct behaviour for food regardless of
-- this bug: you sell the oldest-expiry stock first, and a rep pulling
-- physically from the van reaches for what's in front, which is what
-- FEFO models. A single sale may span multiple batches if the nearest-
-- expiry batch runs short.
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
  -- connection is normal on a rural route, not an error.
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
      -- Device named a specific batch — honour it exactly.
      UPDATE public.warehouse_stock
         SET qty_base = GREATEST(qty_base - v_needed, 0), updated_at = now()
       WHERE warehouse_id = v_wh_id
         AND product_id = (v_line->>'product_id')::uuid
         AND batch_id = v_batch_in
         AND condition = 'sellable';
    ELSE
      -- FEFO: consume nearest-expiry first, spanning batches if the
      -- front batch runs short. Rows with no expiry sort last, since a
      -- dated batch should always clear before an undated one.
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
      -- Any remainder means the van sold more than its ledger says it
      -- held. Deliberately NOT an error: the goods physically left the
      -- van and the customer holds a printed invoice. Refusing it here
      -- would lose real revenue to fix a bookkeeping mismatch. The
      -- variance surfaces at end-of-day reconciliation, where a human
      -- resolves it.
    END IF;
  END LOOP;

  UPDATE public.van_invoices SET stock_applied = true WHERE id = v_id;

  UPDATE public.van_document_series
     SET last_synced_no = GREATEST(last_synced_no, p_invoice_no)
   WHERE vehicle_id = p_vehicle_id AND doc_type = 'invoice';

  RETURN v_id;
END;
$$;

SELECT 'FEFO batch allocation fix applied' AS status;
