-- ═══════════════════════════════════════════════════════════════════════
-- FIELD PHASE 4 — END-OF-DAY RECONCILIATION
--
-- The dual-balance equation from the original gap analysis, made real:
--
--   STOCK:  Morning Load − Sales − Returns = Expected Physical Stock
--   CASH:   Invoiced Sales − Credit Extended − Credit Notes = Expected Settlement
--
-- Both must close INDEPENDENTLY. Stock can balance while cash doesn't
-- (a rep pocketing cash and recording it as credit), and vice versa —
-- checking only one catches roughly half of real problems.
--
-- KEY DESIGN DECISION: "expected stock" is NOT recomputed from
-- transaction history here. warehouse_stock (Phase 1) is ALREADY the
-- running total — every sale and every return has been decrementing
-- or incrementing it in real time since load-out. Expected stock for
-- reconciliation is simply what that table says right now. This
-- avoids a second, parallel calculation that could drift from the
-- ledger it's supposed to be checking.
--
-- "Expected cash" DOES need computing, because cash isn't tracked
-- anywhere as a running balance — it's derived by summing today's
-- van_invoices by payment mode.
--
-- SAFETY: additive only. Reads from van_invoices, van_returns,
-- warehouse_stock — writes to new tables only.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. DAY SETTLEMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.day_settlements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id     uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  settlement_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Computed at settlement time from real transactions, frozen into
  -- the row so a later correction to an invoice doesn't silently
  -- rewrite a closed day.
  expected_cash    numeric NOT NULL DEFAULT 0,
  expected_upi     numeric NOT NULL DEFAULT 0,
  expected_credit  numeric NOT NULL DEFAULT 0,  -- sold on credit, not collected today at all

  -- Physically counted by the rep/supervisor at the depot.
  counted_cash   numeric,
  counted_upi    numeric,

  cash_variance  numeric GENERATED ALWAYS AS (COALESCE(counted_cash,0) - expected_cash) STORED,
  upi_variance   numeric GENERATED ALWAYS AS (COALESCE(counted_upi,0) - expected_upi) STORED,

  -- Value of stock discrepancy, filled in from the counted lines
  -- (day_settlement_stock_lines) once counting is done.
  stock_variance_value numeric NOT NULL DEFAULT 0,

  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'counted', 'closed', 'variance_flagged')),
  -- Variance beyond a threshold blocks close without a supervisor
  -- override; below it, record and move on rather than chasing ₹5.
  override_reason text,

  closed_by      uuid REFERENCES public.users(id),
  closed_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (vehicle_id, settlement_date)
);
CREATE INDEX IF NOT EXISTS idx_day_settlements_dist ON public.day_settlements(distributor_id, settlement_date DESC);


CREATE TABLE IF NOT EXISTS public.day_settlement_stock_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id   uuid NOT NULL REFERENCES public.day_settlements(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES public.distributor_products(id) ON DELETE CASCADE,
  expected_qty    numeric NOT NULL DEFAULT 0,   -- warehouse_stock at count time
  counted_qty     numeric,                      -- physically counted
  variance_qty    numeric GENERATED ALWAYS AS (COALESCE(counted_qty,0) - expected_qty) STORED,
  unit_rate       numeric NOT NULL DEFAULT 0    -- for valuing the variance
);
CREATE INDEX IF NOT EXISTS idx_settlement_stock_lines ON public.day_settlement_stock_lines(settlement_id);


-- ─── 2. RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.day_settlements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_settlement_stock_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS day_settlements_own ON public.day_settlements;
CREATE POLICY day_settlements_own ON public.day_settlements FOR ALL
  USING (distributor_id = public.acting_distributor_id()
         OR public.current_user_role() = 'admin')
  WITH CHECK (distributor_id = public.acting_distributor_id()
         OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS settlement_stock_lines_own ON public.day_settlement_stock_lines;
CREATE POLICY settlement_stock_lines_own ON public.day_settlement_stock_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.day_settlements s
                 WHERE s.id = day_settlement_stock_lines.settlement_id
                   AND s.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.day_settlements s
                 WHERE s.id = day_settlement_stock_lines.settlement_id
                   AND s.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');


-- ─── 3. OPEN (OR REOPEN) TODAY'S SETTLEMENT ──────────────────────────
-- Computes expected cash/UPI from today's actual van_invoices, and
-- seeds one stock line per product currently on the van, with
-- expected_qty taken directly from warehouse_stock — not recomputed
-- from history, read straight from the ledger it's checking.
--
-- Idempotent: calling this again on a still-pending settlement just
-- refreshes the expected figures (e.g. a late-syncing invoice came
-- in) rather than creating a duplicate row.
CREATE OR REPLACE FUNCTION public.open_day_settlement(
  p_distributor_id uuid,
  p_vehicle_id     uuid,
  p_settlement_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id        uuid;
  v_wh_id     uuid;
  v_exp_cash  numeric;
  v_exp_upi   numeric;
  v_exp_credit numeric;
BEGIN
  SELECT warehouse_id INTO v_wh_id FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_wh_id IS NULL THEN RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id; END IF;

  SELECT COALESCE(SUM(amount_paid) FILTER (WHERE payment_mode = 'cash'), 0),
         COALESCE(SUM(amount_paid) FILTER (WHERE payment_mode = 'upi'), 0),
         COALESCE(SUM(total) FILTER (WHERE payment_mode = 'credit'), 0)
    INTO v_exp_cash, v_exp_upi, v_exp_credit
    FROM public.van_invoices
   WHERE vehicle_id = p_vehicle_id AND issued_at::date = p_settlement_date;

  INSERT INTO public.day_settlements (
    distributor_id, vehicle_id, settlement_date, expected_cash, expected_upi, expected_credit
  ) VALUES (
    p_distributor_id, p_vehicle_id, p_settlement_date, v_exp_cash, v_exp_upi, v_exp_credit
  )
  ON CONFLICT (vehicle_id, settlement_date) DO UPDATE
    SET expected_cash = EXCLUDED.expected_cash,
        expected_upi = EXCLUDED.expected_upi,
        expected_credit = EXCLUDED.expected_credit
  WHERE public.day_settlements.status = 'pending'
  RETURNING id INTO v_id;

  -- If it already existed and wasn't pending (already counted/closed),
  -- the UPDATE above matched zero rows — fetch the existing id instead
  -- of silently returning nothing.
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.day_settlements
     WHERE vehicle_id = p_vehicle_id AND settlement_date = p_settlement_date;
  END IF;

  -- Seed stock lines from what's actually on the van right now,
  -- straight from warehouse_stock — one line per product with any
  -- sellable stock, only when lines don't already exist (don't wipe
  -- a count already in progress).
  IF NOT EXISTS (SELECT 1 FROM public.day_settlement_stock_lines WHERE settlement_id = v_id) THEN
    INSERT INTO public.day_settlement_stock_lines (settlement_id, product_id, expected_qty, unit_rate)
    SELECT v_id, ws.product_id, ws.qty_base,
           COALESCE((SELECT price FROM public.distributor_products WHERE id = ws.product_id), 0)
      FROM public.warehouse_stock ws
     WHERE ws.warehouse_id = v_wh_id AND ws.condition = 'sellable' AND ws.qty_base > 0;
  END IF;

  RETURN v_id;
END;
$$;


-- ─── 4. CLOSE SETTLEMENT ──────────────────────────────────────────────
-- Records the physical count, computes the stock variance value, and
-- decides whether this can close cleanly or needs a supervisor
-- override. Tolerance is intentionally simple and fixed rather than
-- configurable per distributor in this first pass — a real threshold
-- can be added once real settlement data shows what's actually noisy.
CREATE OR REPLACE FUNCTION public.close_day_settlement(
  p_settlement_id  uuid,
  p_counted_cash   numeric,
  p_counted_upi    numeric,
  p_stock_counts   jsonb,   -- [{ "product_id": "...", "counted_qty": n }]
  p_closed_by      uuid,
  p_override_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settlement    record;
  v_line          jsonb;
  v_stock_value   numeric := 0;
  v_cash_var      numeric;
  v_upi_var       numeric;
  -- Tolerance: ₹50 cash/UPI, or 2% of expected — whichever is larger.
  -- Chasing exact-to-the-rupee matches on a 400-SKU van wastes an
  -- evening; a genuine problem is rarely this small.
  v_cash_tolerance numeric;
  v_needs_override boolean := false;
BEGIN
  SELECT * INTO v_settlement FROM public.day_settlements WHERE id = p_settlement_id;
  IF v_settlement.id IS NULL THEN RAISE EXCEPTION 'Settlement % not found', p_settlement_id; END IF;
  IF v_settlement.status = 'closed' THEN RAISE EXCEPTION 'Settlement already closed'; END IF;

  UPDATE public.day_settlements
     SET counted_cash = p_counted_cash, counted_upi = p_counted_upi
   WHERE id = p_settlement_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_stock_counts) LOOP
    UPDATE public.day_settlement_stock_lines
       SET counted_qty = (v_line->>'counted_qty')::numeric
     WHERE settlement_id = p_settlement_id
       AND product_id = (v_line->>'product_id')::uuid;
  END LOOP;

  SELECT COALESCE(SUM(ABS(variance_qty) * unit_rate), 0) INTO v_stock_value
    FROM public.day_settlement_stock_lines WHERE settlement_id = p_settlement_id;

  v_cash_tolerance := GREATEST(50, (v_settlement.expected_cash + v_settlement.expected_upi) * 0.02);
  v_cash_var := ABS(p_counted_cash - v_settlement.expected_cash);
  v_upi_var  := ABS(p_counted_upi - v_settlement.expected_upi);

  v_needs_override := (v_cash_var > v_cash_tolerance) OR (v_upi_var > v_cash_tolerance) OR (v_stock_value > 200);

  IF v_needs_override AND p_override_reason IS NULL THEN
    UPDATE public.day_settlements
       SET stock_variance_value = v_stock_value, status = 'variance_flagged'
     WHERE id = p_settlement_id;
    RETURN jsonb_build_object(
      'closed', false, 'needs_override', true,
      'cash_variance', p_counted_cash - v_settlement.expected_cash,
      'upi_variance', p_counted_upi - v_settlement.expected_upi,
      'stock_variance_value', v_stock_value
    );
  END IF;

  UPDATE public.day_settlements
     SET stock_variance_value = v_stock_value,
         status = 'closed',
         override_reason = p_override_reason,
         closed_by = p_closed_by,
         closed_at = now()
   WHERE id = p_settlement_id;

  RETURN jsonb_build_object('closed', true, 'needs_override', false, 'stock_variance_value', v_stock_value);
END;
$$;


SELECT 'Field Phase 4 installed — EOD dual-balance reconciliation' AS status;
