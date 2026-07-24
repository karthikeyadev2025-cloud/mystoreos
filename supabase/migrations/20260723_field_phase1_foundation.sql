-- ═══════════════════════════════════════════════════════════════════════
-- FIELD DISTRIBUTION — PHASE 1 FOUNDATION
--
-- Everything needed before any van sales feature can be built. No
-- user-visible features here; this is the structural layer.
--
-- SAFETY: additive only. Every object below is NEW. Nothing the shop
-- panel reads or writes is altered — not `products`, not `orders`,
-- not `next_invoice_no()`, not `users.last_invoice_no`. The shop
-- billing path is untouched by design.
--
-- Architectural decisions this encodes:
--   • A van IS a warehouse (type='van'). Load-out, EOD unload, and
--     inter-van moves therefore all use ONE transfer mechanism.
--   • Stock is warehouse-owned; the rep is custodian, not owner.
--   • Reps are distributor staff assigned to a specific depot.
--   • Batches are core (not optional) — food/beverage is the first
--     target industry and cannot be sold without expiry handling.
--   • Invoice numbers are allocated per-van, offline-safe.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. WAREHOUSES (main depots, vans, quarantine bays) ──────────────
-- A van is a warehouse that moves. Quarantine is a warehouse that
-- can't sell. Modelling all three the same way means one transfer
-- mechanism covers load-out, EOD unload, and returns disposition.
CREATE TABLE IF NOT EXISTS public.warehouses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  type           text NOT NULL DEFAULT 'main'
                   CHECK (type IN ('main', 'van', 'quarantine')),
  -- For type='van' only: which depot this van reports to.
  parent_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  address        text,
  latitude       double precision,
  longitude      double precision,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warehouses_distributor ON public.warehouses(distributor_id) WHERE active;


-- ─── 2. VEHICLES ─────────────────────────────────────────────────────
-- The physical van. Separate from its warehouse row because a vehicle
-- can be reassigned, serviced, or retired independently of the stock
-- ledger attached to it.
CREATE TABLE IF NOT EXISTS public.vehicles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  warehouse_id   uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  code           text NOT NULL,              -- 'V04' — also the invoice series prefix
  registration_no text,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distributor_id, code)
);


-- ─── 3. FIELD REPS ───────────────────────────────────────────────────
-- Reps are distributor staff (users.role='staff', staff_of=distributor).
-- This adds the field-specific assignment: which depot they work from
-- and which vehicle they're currently driving. Without the depot link,
-- a north-depot rep could see south-depot vans.
CREATE TABLE IF NOT EXISTS public.field_reps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  distributor_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_warehouse_id   uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  assigned_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  field_role          text NOT NULL DEFAULT 'route_sales_rep'
                        CHECK (field_role IN ('route_sales_rep', 'presale_booker', 'driver', 'supervisor')),
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_field_reps_distributor ON public.field_reps(distributor_id) WHERE active;


-- ─── 4. UNIT-OF-MEASURE LADDER ───────────────────────────────────────
-- Replaces the single unit + pack_size model. One product can now sell
-- as piece OR box OR crate, each with its own price and barcode.
-- ALL stock is stored in BASE units; the UI converts at entry/display.
CREATE TABLE IF NOT EXISTS public.product_uoms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES public.distributor_products(id) ON DELETE CASCADE,
  uom_code            text NOT NULL,        -- 'pcs' | 'box' | 'crate' | 'kg' | 'jar' ...
  conversion_to_base  numeric NOT NULL CHECK (conversion_to_base > 0),  -- 1 box = 24 base
  price               numeric NOT NULL DEFAULT 0,
  barcode             text,
  is_base             boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, uom_code)
);
CREATE INDEX IF NOT EXISTS idx_product_uoms_product ON public.product_uoms(product_id);
-- Exactly one base unit per product.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_uoms_one_base
  ON public.product_uoms(product_id) WHERE is_base;


-- ─── 5. BATCHES ──────────────────────────────────────────────────────
-- Core, not optional — packaged food cannot be sold without expiry
-- handling, and near-expiry drives most returns.
CREATE TABLE IF NOT EXISTS public.product_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.distributor_products(id) ON DELETE CASCADE,
  batch_no      text NOT NULL,
  mfg_date      date,
  expiry_date   date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, batch_no)
);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON public.product_batches(expiry_date);


-- ─── 6. WAREHOUSE STOCK ──────────────────────────────────────────────
-- Per-warehouse, per-batch stock in BASE units. This is what makes a
-- van a real sub-warehouse: selling from Van 04 decrements Van 04's
-- row, never the main depot's.
--
-- `condition` keeps returned/damaged goods from being resold at the
-- next shop — a genuine food-safety requirement, not bookkeeping.
CREATE TABLE IF NOT EXISTS public.warehouse_stock (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id  uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.distributor_products(id) ON DELETE CASCADE,
  batch_id      uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  qty_base      numeric NOT NULL DEFAULT 0,
  condition     text NOT NULL DEFAULT 'sellable'
                  CHECK (condition IN ('sellable', 'quarantine', 'damaged')),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_id, batch_id, condition)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_wh ON public.warehouse_stock(warehouse_id);


-- ─── 7. STOCK TRANSFERS ──────────────────────────────────────────────
-- ONE mechanism for every stock movement between warehouses:
-- morning load-out, evening unload, inter-van transfer, returns to
-- quarantine. Two-party confirmation so neither side can silently
-- change what moved.
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  to_warehouse_id   uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  kind             text NOT NULL DEFAULT 'load_out'
                     CHECK (kind IN ('load_out', 'unload', 'inter_van', 'return_to_quarantine')),
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_by       uuid REFERENCES public.users(id),
  confirmed_by     uuid REFERENCES public.users(id),
  confirmed_at     timestamptz,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (from_warehouse_id <> to_warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dist ON public.stock_transfers(distributor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id  uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES public.distributor_products(id) ON DELETE CASCADE,
  batch_id     uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  qty_base     numeric NOT NULL CHECK (qty_base > 0),
  condition    text NOT NULL DEFAULT 'sellable'
                 CHECK (condition IN ('sellable', 'quarantine', 'damaged'))
);
CREATE INDEX IF NOT EXISTS idx_transfer_lines_transfer ON public.stock_transfer_lines(transfer_id);


-- ─── 8. PER-VAN INVOICE SERIES (the offline blocker) ─────────────────
-- The existing next_invoice_no() is an atomic SERVER-side counter and
-- is correct for online shop billing — it is NOT touched here.
--
-- It cannot work offline: the number doesn't exist until the server
-- assigns it, and the unique index would reject a locally-invented one
-- on sync, silently losing a rep's entire day of invoices.
--
-- Fix: every van owns a disjoint series (INV-V04-00001). Collision is
-- structurally impossible, so a device can allocate numbers with zero
-- connectivity. `last_synced_no` lets the server detect gaps.
CREATE TABLE IF NOT EXISTS public.van_document_series (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id     uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type       text NOT NULL CHECK (doc_type IN ('invoice', 'credit_note')),
  prefix         text NOT NULL,             -- 'INV-V04-'
  last_synced_no integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, doc_type)
);


-- ─── 9. MASTER DATA VERSIONING ───────────────────────────────────────
-- HQ→device sync. Devices send their last known version and receive
-- only deltas — small payloads that work on 2G.
-- Conflict rule: HQ always wins on master data; the van always wins on
-- its own stock. No three-way merge exists anywhere by design.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS master_version bigint NOT NULL DEFAULT 1;


-- ─── 10. ROW LEVEL SECURITY ──────────────────────────────────────────
-- Additive only. Every policy below is on a NEW table.
ALTER TABLE public.warehouses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_reps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_uoms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_document_series  ENABLE ROW LEVEL SECURITY;

-- Resolves the acting distributor for the current user: either the
-- distributor themselves, or the distributor a staff member works for.
CREATE OR REPLACE FUNCTION public.acting_distributor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN u.role = 'distributor' THEN u.id
    WHEN u.role = 'staff' THEN u.staff_of
    ELSE NULL
  END
  FROM public.users u
  WHERE u.id = public.current_profile_id();
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['warehouses','vehicles','field_reps','stock_transfers','van_document_series']
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

-- Child tables scope through their parent.
DROP POLICY IF EXISTS product_uoms_own ON public.product_uoms;
CREATE POLICY product_uoms_own ON public.product_uoms FOR ALL
  USING (EXISTS (SELECT 1 FROM public.distributor_products p
                 WHERE p.id = product_uoms.product_id
                   AND p.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.distributor_products p
                 WHERE p.id = product_uoms.product_id
                   AND p.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS product_batches_own ON public.product_batches;
CREATE POLICY product_batches_own ON public.product_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM public.distributor_products p
                 WHERE p.id = product_batches.product_id
                   AND p.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.distributor_products p
                 WHERE p.id = product_batches.product_id
                   AND p.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS warehouse_stock_own ON public.warehouse_stock;
CREATE POLICY warehouse_stock_own ON public.warehouse_stock FOR ALL
  USING (EXISTS (SELECT 1 FROM public.warehouses w
                 WHERE w.id = warehouse_stock.warehouse_id
                   AND w.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.warehouses w
                 WHERE w.id = warehouse_stock.warehouse_id
                   AND w.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS stock_transfer_lines_own ON public.stock_transfer_lines;
CREATE POLICY stock_transfer_lines_own ON public.stock_transfer_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.stock_transfers st
                 WHERE st.id = stock_transfer_lines.transfer_id
                   AND st.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.stock_transfers st
                 WHERE st.id = stock_transfer_lines.transfer_id
                   AND st.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');


-- ─── 11. TRANSFER APPLICATION ────────────────────────────────────────
-- Applies a confirmed transfer atomically: decrement source, increment
-- destination, in one transaction. Rejects the move if the source
-- doesn't actually hold the stock — the check that stops goods being
-- "lost between the factory gate and the shop."
CREATE OR REPLACE FUNCTION public.apply_stock_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from uuid; v_to uuid; v_status text; ln record; v_available numeric;
BEGIN
  SELECT from_warehouse_id, to_warehouse_id, status
    INTO v_from, v_to, v_status
    FROM public.stock_transfers WHERE id = p_transfer_id;

  IF v_from IS NULL THEN RAISE EXCEPTION 'Transfer % not found', p_transfer_id; END IF;
  IF v_status = 'confirmed' THEN RAISE EXCEPTION 'Transfer % already applied', p_transfer_id; END IF;
  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'Transfer % is cancelled', p_transfer_id; END IF;

  FOR ln IN SELECT * FROM public.stock_transfer_lines WHERE transfer_id = p_transfer_id LOOP
    SELECT COALESCE(qty_base, 0) INTO v_available
      FROM public.warehouse_stock
      WHERE warehouse_id = v_from AND product_id = ln.product_id
        AND batch_id IS NOT DISTINCT FROM ln.batch_id AND condition = ln.condition;

    IF COALESCE(v_available, 0) < ln.qty_base THEN
      RAISE EXCEPTION 'Insufficient stock: product % has % available, transfer needs %',
        ln.product_id, COALESCE(v_available, 0), ln.qty_base;
    END IF;

    UPDATE public.warehouse_stock
      SET qty_base = qty_base - ln.qty_base, updated_at = now()
      WHERE warehouse_id = v_from AND product_id = ln.product_id
        AND batch_id IS NOT DISTINCT FROM ln.batch_id AND condition = ln.condition;

    INSERT INTO public.warehouse_stock (warehouse_id, product_id, batch_id, qty_base, condition)
      VALUES (v_to, ln.product_id, ln.batch_id, ln.qty_base, ln.condition)
      ON CONFLICT (warehouse_id, product_id, batch_id, condition)
      DO UPDATE SET qty_base = public.warehouse_stock.qty_base + EXCLUDED.qty_base,
                    updated_at = now();
  END LOOP;

  UPDATE public.stock_transfers
    SET status = 'confirmed', confirmed_at = now()
    WHERE id = p_transfer_id;
END;
$$;


SELECT 'Field distribution Phase 1 foundation installed — 9 new tables, 0 changes to shop billing' AS status;
