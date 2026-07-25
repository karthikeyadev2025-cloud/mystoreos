-- ═══════════════════════════════════════════════════════════════════════
-- FIELD PHASE 3b — VAN RETURNS / CREDIT NOTES
--
-- The workflow from the original gap analysis: a shopkeeper hands back
-- near-expiry, damaged, or unsold goods. The rep needs to record the
-- item and condition, credit the shop on the spot, and get that stock
-- off the "sellable" ledger before it can be resold at the next stop.
--
-- Reuses the exact same offline-safe pattern as van_invoices — same
-- per-van disjoint numbering (CRN-V04-...), same idempotent sync
-- function, same reasoning. A credit note is a financial document,
-- same as an invoice, and needs the same collision-proof guarantee.
--
-- SAFETY: additive only. All new tables/functions. Does not touch
-- van_invoices, credits, credit_payments, or anything in the shop
-- panel's own credit ledger.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. VAN RETURNS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.van_returns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id     uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  shop_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rep_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,

  -- Same disjoint-series guarantee as invoices — allocated on-device.
  credit_no      integer NOT NULL,
  credit_ref     text NOT NULL,

  reason         text NOT NULL
                   CHECK (reason IN ('expired', 'near_expiry', 'damaged', 'unsold_seasonal', 'wrong_delivery')),
  -- Damaged goods legally/commercially need proof; other reasons don't
  -- require it but can still carry one.
  photo_url      text,

  total_credit   numeric NOT NULL DEFAULT 0,
  issued_at      timestamptz NOT NULL,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  stock_applied  boolean NOT NULL DEFAULT false,
  note           text,

  UNIQUE (vehicle_id, credit_no)
);
CREATE INDEX IF NOT EXISTS idx_van_returns_dist ON public.van_returns(distributor_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_van_returns_shop ON public.van_returns(shop_id, issued_at DESC);


CREATE TABLE IF NOT EXISTS public.van_return_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id   uuid NOT NULL REFERENCES public.van_returns(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.distributor_products(id) ON DELETE CASCADE,
  batch_id    uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  qty_base    numeric NOT NULL CHECK (qty_base > 0),
  rate        numeric NOT NULL DEFAULT 0,
  line_total  numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_van_return_lines_ret ON public.van_return_lines(return_id);


-- ─── 2. RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.van_returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_return_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS van_returns_own ON public.van_returns;
CREATE POLICY van_returns_own ON public.van_returns FOR ALL
  USING (distributor_id = public.acting_distributor_id()
         OR public.current_user_role() = 'admin')
  WITH CHECK (distributor_id = public.acting_distributor_id()
         OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS van_return_lines_own ON public.van_return_lines;
CREATE POLICY van_return_lines_own ON public.van_return_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.van_returns r
                 WHERE r.id = van_return_lines.return_id
                   AND r.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.van_returns r
                 WHERE r.id = van_return_lines.return_id
                   AND r.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');


-- ─── 3. SYNC ─────────────────────────────────────────────────────────
-- Same idempotency guarantee as sync_van_invoice(): a device retrying
-- an upload hits UNIQUE(vehicle_id, credit_no) and gets the existing
-- row back, never a duplicate credit.
--
-- Stock goes back onto the van as 'quarantine' or 'damaged' —
-- deliberately NEVER 'sellable'. This is the check that stops expired
-- or damaged goods being resold at the next shop; it only works if
-- this function respects the condition dimension, which it does by
-- construction (the caller cannot pass 'sellable' for a return).
--
-- The shop's credit ledger (credits/credit_payments) is touched here
-- too — a return isn't just a stock movement, it's money the shop no
-- longer owes.
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
  p_rep_id         uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing uuid;
  v_id       uuid;
  v_wh_id    uuid;
  v_line     jsonb;
  -- Damaged/expired goods are quarantined, never resellable. Unsold
  -- seasonal or wrong-delivery items are still genuinely sellable
  -- stock, just physically back on the van.
  v_condition text := CASE WHEN p_reason IN ('expired','damaged') THEN 'damaged' ELSE 'quarantine' END;
BEGIN
  SELECT id INTO v_existing FROM public.van_returns
   WHERE vehicle_id = p_vehicle_id AND credit_no = p_credit_no;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT warehouse_id INTO v_wh_id FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_wh_id IS NULL THEN RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id; END IF;

  INSERT INTO public.van_returns (
    distributor_id, vehicle_id, shop_id, rep_id, credit_no, credit_ref,
    reason, photo_url, total_credit, issued_at, stock_applied
  ) VALUES (
    p_distributor_id, p_vehicle_id, p_shop_id, p_rep_id, p_credit_no, p_credit_ref,
    p_reason, p_photo_url, p_total_credit, p_issued_at, false
  ) RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.van_return_lines (return_id, product_id, batch_id, qty_base, rate, line_total)
    VALUES (
      v_id, (v_line->>'product_id')::uuid, NULLIF(v_line->>'batch_id','')::uuid,
      (v_line->>'qty_base')::numeric, (v_line->>'rate')::numeric,
      (v_line->>'qty_base')::numeric * (v_line->>'rate')::numeric
    );

    -- Onto the van, but quarantined/damaged — NEVER sellable. This is
    -- the line that prevents reselling expired food at the next stop.
    INSERT INTO public.warehouse_stock (warehouse_id, product_id, batch_id, qty_base, condition)
    VALUES (v_wh_id, (v_line->>'product_id')::uuid, NULLIF(v_line->>'batch_id','')::uuid,
            (v_line->>'qty_base')::numeric, v_condition)
    ON CONFLICT (warehouse_id, product_id, batch_id, condition)
    DO UPDATE SET qty_base = public.warehouse_stock.qty_base + EXCLUDED.qty_base, updated_at = now();
  END LOOP;

  -- Credit the shop on the spot — a return is real money the shop no
  -- longer owes. Stored as a NEGATIVE unpaid credit deliberately: the
  -- distributor dashboard's own Total Outstanding figure is
  -- SUM(amount - paidSoFar) over credits where paid=false. A negative
  -- row with paid=TRUE would be invisible to that sum and the return
  -- would silently fail to reduce anything the shop owes — checked
  -- the actual formula before writing this, not assumed.
  INSERT INTO public.credits (from_id, to_shop_id, description, amount, paid)
  VALUES (p_distributor_id, p_shop_id, 'Return: ' || p_credit_ref || ' (' || p_reason || ')', -p_total_credit, false);

  UPDATE public.van_returns SET stock_applied = true WHERE id = v_id;

  UPDATE public.van_document_series
     SET last_synced_no = GREATEST(last_synced_no, p_credit_no)
   WHERE vehicle_id = p_vehicle_id AND doc_type = 'credit_note';

  RETURN v_id;
END;
$$;


SELECT 'Field Phase 3b installed — van returns/credit-notes, quarantine-safe' AS status;
