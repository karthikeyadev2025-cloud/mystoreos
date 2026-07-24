-- ═══════════════════════════════════════════════════════════════════════
-- FIELD PHASE 2 — ROUTES, VISITS, PRESALE
--
-- Presale is the fully-online mode: a rep visits 40-50 outlets, books
-- orders, and the depot dispatches the next morning. No offline
-- billing, no van stock movement — which is why it's the right thing
-- to build before van sales.
--
-- SAFETY: additive only. All new tables. Nothing existing is altered
-- — not `users`, not `orders`, not `stock_orders`, not the shop panel.
-- Presale orders CONVERT into the existing stock_orders flow rather
-- than replacing it, so the dispatch path a distributor already knows
-- keeps working exactly as it does today.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 1. ROUTES (beats) ───────────────────────────────────────────────
-- A named territory a rep works. Deliberately durable: territories
-- follow rivers, highways and relationships, so they're set up once
-- and hand-adjusted, not recomputed nightly from coordinates.
CREATE TABLE IF NOT EXISTS public.routes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  warehouse_id   uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  assigned_rep_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Which weekdays this route runs. 0=Sun .. 6=Sat. A beat is usually
  -- visited on fixed days so outlets know when to expect the rep.
  weekdays       smallint[] NOT NULL DEFAULT '{}',
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_routes_distributor ON public.routes(distributor_id) WHERE active;


-- ─── 2. ROUTE STOPS ──────────────────────────────────────────────────
-- The ordered outlet list. `seq` is the driving order produced by the
-- sequencer; a supervisor can override it and the override sticks.
CREATE TABLE IF NOT EXISTS public.route_stops (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  shop_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seq        integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON public.route_stops(route_id, seq);


-- ─── 3. ROUTE VISITS ─────────────────────────────────────────────────
-- Planned vs actual. A skipped outlet with a reason is as valuable as
-- a completed one — "shop closed" three weeks running is a real signal
-- that a beat needs re-planning.
CREATE TABLE IF NOT EXISTS public.route_visits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  route_id       uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  shop_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rep_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  visit_date     date NOT NULL DEFAULT CURRENT_DATE,
  status         text NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned', 'visited', 'skipped')),
  skip_reason    text,
  -- Captured at visit boundaries only, never continuously — continuous
  -- tracking drains a rep's battery and buys nothing extra.
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  latitude       double precision,
  longitude      double precision,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, visit_date, route_id)
);
CREATE INDEX IF NOT EXISTS idx_route_visits_date ON public.route_visits(distributor_id, visit_date DESC);


-- ─── 4. PRESALE ORDERS ───────────────────────────────────────────────
-- Booked in the field today, dispatched from the depot tomorrow.
-- Distinct from stock_orders (which a shop raises itself) because the
-- originator, the approval path and the timing are all different —
-- but converts INTO a stock_order so the existing dispatch flow is
-- reused rather than duplicated.
CREATE TABLE IF NOT EXISTS public.field_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shop_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rep_id          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  route_id        uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  visit_id        uuid REFERENCES public.route_visits(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'booked'
                    CHECK (status IN ('booked', 'converted', 'cancelled')),
  total           numeric NOT NULL DEFAULT 0,
  requested_delivery_date date,
  note            text,
  -- Set when converted, so the booking and the resulting dispatch
  -- order stay linked for reconciliation.
  stock_order_id  uuid,
  converted_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_field_orders_dist ON public.field_orders(distributor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_orders_status ON public.field_orders(distributor_id, status);

CREATE TABLE IF NOT EXISTS public.field_order_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.field_orders(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.distributor_products(id) ON DELETE CASCADE,
  qty_base    numeric NOT NULL CHECK (qty_base > 0),
  rate        numeric NOT NULL DEFAULT 0,
  line_total  numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_field_order_lines_order ON public.field_order_lines(order_id);


-- ─── 5. ROW LEVEL SECURITY ───────────────────────────────────────────
ALTER TABLE public.routes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_visits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_order_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['routes','route_visits','field_orders']
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

DROP POLICY IF EXISTS route_stops_own ON public.route_stops;
CREATE POLICY route_stops_own ON public.route_stops FOR ALL
  USING (EXISTS (SELECT 1 FROM public.routes r
                 WHERE r.id = route_stops.route_id
                   AND r.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.routes r
                 WHERE r.id = route_stops.route_id
                   AND r.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS field_order_lines_own ON public.field_order_lines;
CREATE POLICY field_order_lines_own ON public.field_order_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.field_orders o
                 WHERE o.id = field_order_lines.order_id
                   AND o.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_orders o
                 WHERE o.id = field_order_lines.order_id
                   AND o.distributor_id = public.acting_distributor_id())
         OR public.current_user_role() = 'admin');


-- ─── 6. PRESALE → DISPATCH CONVERSION ────────────────────────────────
-- Turns a booked field order into a stock_order, which is the flow the
-- distributor dashboard ALREADY handles end to end (pending → accepted
-- → dispatched → delivered). Reusing it means presale needs no new
-- dispatch UI, and a distributor sees booked orders arrive in the same
-- place as shop-raised ones.
--
-- Idempotent: converting twice is rejected rather than silently
-- creating a duplicate dispatch.
CREATE OR REPLACE FUNCTION public.convert_field_order(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order    record;
  v_shop     record;
  v_items    jsonb;
  v_new_id   uuid;
BEGIN
  SELECT * INTO v_order FROM public.field_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Field order % not found', p_order_id; END IF;
  IF v_order.status = 'converted' THEN
    RAISE EXCEPTION 'Field order % already converted', p_order_id;
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Field order % is cancelled', p_order_id;
  END IF;

  SELECT id, name INTO v_shop FROM public.users WHERE id = v_order.shop_id;

  -- stock_orders stores its lines as a JSONB blob; match that shape
  -- exactly so the existing dashboard renders these identically to a
  -- shop-raised order.
  SELECT jsonb_agg(jsonb_build_object(
           'id',    l.product_id,
           'name',  p.name,
           'price', l.rate,
           'qty',   l.qty_base,
           'unit',  p.unit
         ))
    INTO v_items
    FROM public.field_order_lines l
    JOIN public.distributor_products p ON p.id = l.product_id
   WHERE l.order_id = p_order_id;

  IF v_items IS NULL THEN RAISE EXCEPTION 'Field order % has no lines', p_order_id; END IF;

  INSERT INTO public.stock_orders (shop_id, shop_name, items, total, status, distributor_id)
    VALUES (v_order.shop_id, COALESCE(v_shop.name, 'Shop'), v_items,
            v_order.total, 'pending', v_order.distributor_id)
    RETURNING id INTO v_new_id;

  UPDATE public.field_orders
     SET status = 'converted', stock_order_id = v_new_id, converted_at = now()
   WHERE id = p_order_id;

  RETURN v_new_id;
END;
$$;


SELECT 'Field Phase 2 installed — routes, visits, presale orders; converts into existing stock_orders flow' AS status;
