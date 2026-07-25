-- ═══════════════════════════════════════════════════════════════════════
-- FIELD PHASE 3a — VAN INVOICES (offline-safe numbering)
--
-- The hardest part of the whole build, so it gets the most careful
-- structure.
--
-- THE PROBLEM: next_invoice_no() (shop billing) is a server-side
-- atomic counter. Correct online, unusable offline — the number
-- doesn't exist until the server assigns it, and the unique index
-- would reject a locally-invented one on sync, silently losing a
-- rep's entire day of invoices.
--
-- THE FIX: each van owns a DISJOINT series. Van 04 issues
-- INV-V04-00001.., Van 11 issues INV-V11-00001.. Two vans cannot
-- collide even with a week of no connectivity, because their number
-- spaces never overlap. The device allocates; the server validates.
--
-- UNIQUE (vehicle_id, invoice_no) makes a duplicate structurally
-- impossible rather than merely unlikely. A device replaying the same
-- invoice hits the constraint and is treated as already-synced, not
-- as a new sale.
--
-- SAFETY: additive only. next_invoice_no(), orders.invoice_no and
-- users.last_invoice_no are NOT touched. Shop billing is untouched.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. VAN INVOICES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.van_invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id     uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  shop_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rep_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  visit_id       uuid REFERENCES public.route_visits(id) ON DELETE SET NULL,

  -- Allocated on the DEVICE, not here. invoice_no is the sequence
  -- within this van's series; invoice_ref is the printed form the
  -- customer sees on their copy.
  invoice_no     integer NOT NULL,
  invoice_ref    text NOT NULL,

  subtotal       numeric NOT NULL DEFAULT 0,
  discount       numeric NOT NULL DEFAULT 0,
  total          numeric NOT NULL DEFAULT 0,
  payment_mode   text NOT NULL DEFAULT 'cash'
                   CHECK (payment_mode IN ('cash', 'upi', 'credit', 'cheque')),
  amount_paid    numeric NOT NULL DEFAULT 0,

  -- issued_at is DEVICE time (when the customer actually got their
  -- copy); synced_at is when it reached the server. They differ by
  -- hours on a rural route, and reconciliation needs the device time.
  issued_at      timestamptz NOT NULL,
  synced_at      timestamptz NOT NULL DEFAULT now(),

  -- Set true once the sale's stock movement has been applied, so a
  -- replayed sync can't decrement van stock twice.
  stock_applied  boolean NOT NULL DEFAULT false,

  note           text,

  -- The structural guarantee. A device retrying an upload hits this
  -- and is handled as a duplicate, never as a second sale.
  UNIQUE (vehicle_id, invoice_no)
);
CREATE INDEX IF NOT EXISTS idx_van_invoices_dist ON public.van_invoices(distributor_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_van_invoices_vehicle ON public.van_invoices(vehicle_id, issued_at DESC);


CREATE TABLE IF NOT EXISTS public.van_invoice_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.van_invoices(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.distributor_products(id) ON DELETE CASCADE,
  batch_id    uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  qty_base    numeric NOT NULL CHECK (qty_base > 0),
  rate        numeric NOT NULL DEFAULT 0,
  line_total  numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_van_invoice_lines_inv ON public.van_invoice_lines(invoice_id);


-- ─── 2. RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.van_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS van_invoices_own ON public.van_invoices;
CREATE POLICY van_invoices_own ON public.van_invoices FOR ALL
  USING (distributor_id = public.acting_distributor_id()
         OR public.current_user_role() = 'admin')
  WITH CHECK (distributor_id = public.acting_distributor_id()
         OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS van_invoice_lines_own ON public.van_invoice_lines;
CREATE POLICY van_invoice_lines_own ON public.van_invoice_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.van_invoices i
                 WHERE i.id = van_invoice_lines.invoice_id
                   AND i.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.van_invoices i
                 WHERE i.id = van_invoice_lines.invoice_id
                   AND i.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');


-- ─── 3. SERIES SEEDING ───────────────────────────────────────────────
-- A device must know where its van's series currently stands before it
-- can allocate offline. Called while online (at load-out) so a fresh
-- or reinstalled device doesn't restart the series at 1 and collide
-- with numbers already issued.
--
-- Returns the highest number ACTUALLY USED, not last_synced_no, so a
-- gap in syncing can't hand the same number out twice.
CREATE OR REPLACE FUNCTION public.get_van_series_position(p_vehicle_id uuid, p_doc_type text DEFAULT 'invoice')
RETURNS TABLE (prefix text, last_no integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT s.prefix,
         GREATEST(
           s.last_synced_no,
           COALESCE((SELECT MAX(i.invoice_no) FROM public.van_invoices i
                      WHERE i.vehicle_id = p_vehicle_id), 0)
         )::integer
  FROM public.van_document_series s
  WHERE s.vehicle_id = p_vehicle_id AND s.doc_type = p_doc_type;
END;
$$;


-- ─── 4. INVOICE SYNC ─────────────────────────────────────────────────
-- Accepts an invoice allocated on a device. Idempotent by design: if
-- this van already has that invoice number, the existing row is
-- returned instead of raising, because a retried upload after a
-- dropped connection is NORMAL on a rural route, not an error.
--
-- Stock is decremented in the same transaction and only once, guarded
-- by stock_applied.
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
  v_existing uuid;
  v_id       uuid;
  v_wh_id    uuid;
  v_line     jsonb;
  v_avail    numeric;
BEGIN
  -- Already synced? Return it. A device retrying is expected.
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
    INSERT INTO public.van_invoice_lines (invoice_id, product_id, batch_id, qty_base, rate, line_total)
    VALUES (
      v_id,
      (v_line->>'product_id')::uuid,
      NULLIF(v_line->>'batch_id','')::uuid,
      (v_line->>'qty_base')::numeric,
      (v_line->>'rate')::numeric,
      (v_line->>'qty_base')::numeric * (v_line->>'rate')::numeric
    );

    -- Decrement the VAN's stock, never the depot's. The van is the
    -- authoritative owner of its own stock, which is what makes
    -- offline selling safe.
    SELECT qty_base INTO v_avail FROM public.warehouse_stock
     WHERE warehouse_id = v_wh_id
       AND product_id = (v_line->>'product_id')::uuid
       AND batch_id IS NOT DISTINCT FROM NULLIF(v_line->>'batch_id','')::uuid
       AND condition = 'sellable';

    IF COALESCE(v_avail, 0) < (v_line->>'qty_base')::numeric THEN
      -- Does NOT abort. The sale physically happened — goods left the
      -- van and the customer holds a printed invoice. Refusing it here
      -- would lose real revenue to fix a bookkeeping mismatch. It's
      -- recorded, stock floors at zero, and the variance surfaces at
      -- end-of-day reconciliation where a human resolves it.
      UPDATE public.warehouse_stock SET qty_base = 0, updated_at = now()
       WHERE warehouse_id = v_wh_id
         AND product_id = (v_line->>'product_id')::uuid
         AND batch_id IS NOT DISTINCT FROM NULLIF(v_line->>'batch_id','')::uuid
         AND condition = 'sellable';
    ELSE
      UPDATE public.warehouse_stock
         SET qty_base = qty_base - (v_line->>'qty_base')::numeric, updated_at = now()
       WHERE warehouse_id = v_wh_id
         AND product_id = (v_line->>'product_id')::uuid
         AND batch_id IS NOT DISTINCT FROM NULLIF(v_line->>'batch_id','')::uuid
         AND condition = 'sellable';
    END IF;
  END LOOP;

  UPDATE public.van_invoices SET stock_applied = true WHERE id = v_id;

  -- Track how far this van's series has synced, so gaps are detectable.
  UPDATE public.van_document_series
     SET last_synced_no = GREATEST(last_synced_no, p_invoice_no)
   WHERE vehicle_id = p_vehicle_id AND doc_type = 'invoice';

  RETURN v_id;
END;
$$;


SELECT 'Field Phase 3a installed — van invoices with offline-safe per-van numbering' AS status;
