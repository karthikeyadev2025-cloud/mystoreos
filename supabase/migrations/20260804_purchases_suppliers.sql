-- ═══════════════════════════════════════════════════════════════════════
-- PURCHASES & SUPPLIERS — the missing half of a distributor's business
--
-- A distributor's actual cycle is:
--     BUY from manufacturer  →  HOLD stock  →  SELL to shops
--
-- MyStore OS only ever modelled the SELL half. Stock came into
-- existence by someone typing a number into "Add Product", which means:
--
--   • no purchase invoices to reconcile against a supplier's bill
--   • no supplier ledger — a distributor cannot see what they OWE,
--     only what they're owed
--   • no real cost basis, so "profit" was never actually computable —
--     the app knew the selling price and nothing else
--   • no purchase GST input credit, which is a large real cost
--
-- This is the single biggest gap versus Vyapar / MyBillBook, and it's
-- the reason those tools get used alongside this one rather than
-- instead of it.
--
-- DESIGN: mirrors the existing sell-side structures deliberately.
-- Receivables already live in `credits` (money owed TO the
-- distributor); purchases create PAYABLES (money the distributor
-- owes), kept in their own table so the two are never accidentally
-- summed together into a meaningless net figure.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. SUPPLIERS ────────────────────────────────────────────────────
-- The parties a distributor buys from. A separate table rather than
-- reusing `users` because a manufacturer is not an app account — they
-- never log in, they're a contact record with a balance.
CREATE TABLE IF NOT EXISTS public.suppliers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  phone          text,
  gstin          text,
  address        text,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_dist ON public.suppliers(distributor_id) WHERE active;


-- ─── 2. PURCHASES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supplier_id    uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  -- The supplier's OWN invoice number, not one we generate. This is
  -- what a distributor matches against the paper bill in their hand,
  -- and what an auditor asks for.
  supplier_bill_no text,
  bill_date      date NOT NULL DEFAULT CURRENT_DATE,

  subtotal       numeric NOT NULL DEFAULT 0,
  gst_amount     numeric NOT NULL DEFAULT 0,
  total          numeric NOT NULL DEFAULT 0,
  amount_paid    numeric NOT NULL DEFAULT 0,

  payment_mode   text NOT NULL DEFAULT 'credit'
                   CHECK (payment_mode IN ('cash', 'upi', 'credit', 'cheque', 'bank')),
  notes          text,
  -- Guards the stock increment so a retried save can't double a
  -- distributor's inventory.
  stock_applied  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (distributor_id, supplier_id, supplier_bill_no)
);
CREATE INDEX IF NOT EXISTS idx_purchases_dist ON public.purchases(distributor_id, bill_date DESC);

CREATE TABLE IF NOT EXISTS public.purchase_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.distributor_products(id) ON DELETE SET NULL,
  -- Kept even when product_id is set: a supplier may rename an item,
  -- and the purchase record must still say what was actually billed.
  product_name text NOT NULL,
  qty          numeric NOT NULL CHECK (qty > 0),
  cost_rate    numeric NOT NULL DEFAULT 0,
  gst_pct      numeric NOT NULL DEFAULT 0,
  line_total   numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_lines ON public.purchase_lines(purchase_id);


-- ─── 3. SUPPLIER PAYMENTS ────────────────────────────────────────────
-- Part-payments against what's owed, mirroring credit_payments on the
-- receivables side.
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_id    uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  amount         numeric NOT NULL CHECK (amount > 0),
  mode           text NOT NULL DEFAULT 'cash',
  note           text,
  paid_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments ON public.supplier_payments(distributor_id, paid_at DESC);


-- ─── 4. COST BASIS ON PRODUCTS ───────────────────────────────────────
-- Without a cost price the app knows what things SELL for and nothing
-- about what they COST, so margin and profit were never computable.
-- Updated on each purchase to the latest cost actually paid.
ALTER TABLE public.distributor_products ADD COLUMN IF NOT EXISTS cost_price numeric;


-- ─── 5. RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','purchases','supplier_payments']
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_own ON public.%1$s;
      CREATE POLICY %1$s_own ON public.%1$s FOR ALL
        USING (distributor_id = public.acting_distributor_id()
               OR public.current_user_role() = 'admin')
        WITH CHECK (distributor_id = public.acting_distributor_id()
               OR public.current_user_role() = 'admin');
    $f$, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS purchase_lines_own ON public.purchase_lines;
CREATE POLICY purchase_lines_own ON public.purchase_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.purchases p
                 WHERE p.id = purchase_lines.purchase_id
                   AND p.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchases p
                 WHERE p.id = purchase_lines.purchase_id
                   AND p.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');


-- ─── 6. RECORD A PURCHASE ────────────────────────────────────────────
-- One call: creates the bill, its lines, increases stock, and updates
-- each product's cost basis. Atomic — a partial purchase that added
-- stock but no bill (or vice versa) would corrupt both inventory and
-- payables.
CREATE OR REPLACE FUNCTION public.record_purchase(
  p_distributor_id uuid,
  p_supplier_id    uuid,
  p_bill_no        text,
  p_bill_date      date,
  p_lines          jsonb,
  p_payment_mode   text DEFAULT 'credit',
  p_amount_paid    numeric DEFAULT 0,
  p_notes          text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id        uuid;
  v_line      jsonb;
  v_sub       numeric := 0;
  v_gst       numeric := 0;
  v_qty       numeric;
  v_rate      numeric;
  v_gstpct    numeric;
  v_line_tot  numeric;
  v_prod      uuid;
BEGIN
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one item to the purchase';
  END IF;

  INSERT INTO public.purchases (
    distributor_id, supplier_id, supplier_bill_no, bill_date,
    payment_mode, amount_paid, notes, stock_applied
  ) VALUES (
    p_distributor_id, p_supplier_id, NULLIF(trim(COALESCE(p_bill_no,'')),''),
    COALESCE(p_bill_date, CURRENT_DATE), p_payment_mode,
    GREATEST(COALESCE(p_amount_paid,0), 0), p_notes, false
  ) RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty    := (v_line->>'qty')::numeric;
    v_rate   := COALESCE((v_line->>'cost_rate')::numeric, 0);
    v_gstpct := COALESCE((v_line->>'gst_pct')::numeric, 0);
    v_prod   := NULLIF(v_line->>'product_id','')::uuid;

    CONTINUE WHEN v_qty IS NULL OR v_qty <= 0;

    v_line_tot := v_qty * v_rate;
    v_sub := v_sub + v_line_tot;
    v_gst := v_gst + (v_line_tot * v_gstpct / 100);

    INSERT INTO public.purchase_lines (
      purchase_id, product_id, product_name, qty, cost_rate, gst_pct, line_total
    ) VALUES (
      v_id, v_prod, COALESCE(NULLIF(trim(v_line->>'product_name'),''), 'Item'),
      v_qty, v_rate, v_gstpct, v_line_tot
    );

    -- Stock in, and record what it actually cost. Without the cost
    -- update, margin stays unknowable no matter how many purchases are
    -- recorded.
    IF v_prod IS NOT NULL THEN
      UPDATE public.distributor_products
         SET stock = COALESCE(stock, 0) + v_qty,
             cost_price = v_rate
       WHERE id = v_prod AND distributor_id = p_distributor_id;
    END IF;
  END LOOP;

  UPDATE public.purchases
     SET subtotal = v_sub, gst_amount = v_gst, total = v_sub + v_gst,
         stock_applied = true
   WHERE id = v_id;

  RETURN v_id;
END;
$$;


-- ─── 7. SUPPLIER BALANCES (PAYABLES) ─────────────────────────────────
-- What the distributor owes each supplier. Deliberately a separate
-- figure from customer receivables — netting the two produces a number
-- that looks meaningful and tells you nothing about either.
CREATE OR REPLACE FUNCTION public.supplier_balances(p_distributor_id uuid)
RETURNS TABLE (
  supplier_id uuid, supplier_name text, phone text,
  total_purchased numeric, total_paid numeric, outstanding numeric,
  last_bill_date date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.phone,
         COALESCE(pu.total_purchased, 0),
         COALESCE(pu.paid_on_bill, 0) + COALESCE(pa.paid_later, 0),
         COALESCE(pu.total_purchased, 0)
           - COALESCE(pu.paid_on_bill, 0) - COALESCE(pa.paid_later, 0),
         pu.last_bill
    FROM public.suppliers s
    LEFT JOIN (
      SELECT supplier_id,
             SUM(total)       AS total_purchased,
             SUM(amount_paid) AS paid_on_bill,
             MAX(bill_date)   AS last_bill
        FROM public.purchases
       WHERE distributor_id = p_distributor_id
       GROUP BY supplier_id
    ) pu ON pu.supplier_id = s.id
    LEFT JOIN (
      SELECT supplier_id, SUM(amount) AS paid_later
        FROM public.supplier_payments
       WHERE distributor_id = p_distributor_id
       GROUP BY supplier_id
    ) pa ON pa.supplier_id = s.id
   WHERE s.distributor_id = p_distributor_id AND s.active
   ORDER BY (COALESCE(pu.total_purchased,0) - COALESCE(pu.paid_on_bill,0) - COALESCE(pa.paid_later,0)) DESC;
$$;

SELECT 'Purchases, suppliers and payables installed' AS status;
