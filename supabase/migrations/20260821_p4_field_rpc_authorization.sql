-- ═══════════════════════════════════════════════════════════════════════
-- P4 — Authorization guards for field-distribution RPCs
--
-- The field phases (1–5), direct sale, purchases and van-receive landed
-- AFTER the P0/P1/P3 hardening passes, so they never got the same review.
-- Their RLS policies are correct — every field table is scoped by
-- acting_distributor_id(). The gap is one level up.
--
-- Fourteen client-callable RPCs are SECURITY DEFINER, which by definition
-- bypasses RLS, and none of them check who is calling. They fall in two
-- shapes, both reachable from any authenticated session via
-- supabase.rpc(...):
--
--   1. Tenant id passed as a parameter. create_direct_sale,
--      create_field_vehicle, open_day_settlement, record_purchase,
--      supplier_balances, sync_van_invoice, sync_van_return and
--      post_stock_order_to_credit all take p_distributor_id from the
--      caller and trust it. Any logged-in user can pass another
--      distributor's id and write into their tenant — or, for
--      supplier_balances, read their entire payables ledger
--      (every supplier, what is owed, last bill date).
--
--   2. Row id passed as a parameter. apply_stock_transfer,
--      convert_field_order, close_day_settlement,
--      get_van_series_position, receive_van_invoice and
--      receive_stock_order take a uuid and act on whatever row it names,
--      without confirming the caller owns it. apply_stock_transfer is the
--      sharpest: it moves warehouse stock between locations, so a caller
--      who learns a transfer id can commit someone else's inventory
--      movement.
--
-- A uuid being hard to guess is not an authorization control. Ids leak
-- through exports, shared links, support threads, and — most realistically
-- here — through staff who legitimately held them and later left, or
-- through a shop linked to more than one distributor.
--
-- Fix: every one of these functions now establishes the caller's identity
-- server-side and rejects the call if it does not match. The
-- p_distributor_id / p_shop_id parameters are KEPT (dropping them would
-- change every call signature in the client) but are now verified against
-- the session rather than believed. Callers already pass their own id, so
-- correct traffic is unaffected.
--
-- CREATE OR REPLACE preserves existing grants throughout.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── 0. GUARD HELPERS ────────────────────────────────────────────────
-- One place to change if the tenancy model changes. Both raise rather
-- than return false: a caller reaching a tenant that is not theirs is a
-- bug or an attack, and should surface as an error, not an empty result.

CREATE OR REPLACE FUNCTION public.assert_acting_distributor(p_distributor_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_user_role() = 'admin' THEN RETURN; END IF;

  IF p_distributor_id IS NULL OR p_distributor_id IS DISTINCT FROM public.acting_distributor_id() THEN
    RAISE EXCEPTION 'Not authorized for distributor %', p_distributor_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_acting_distributor(uuid) IS
  'Raises 42501 unless the caller is an admin, or the given distributor id '
  'is the one their session resolves to (own id for a distributor, staff_of '
  'for their staff). Use at the top of any SECURITY DEFINER RPC that accepts '
  'a distributor id from the client.';

CREATE OR REPLACE FUNCTION public.assert_owns_shop(p_shop_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_shop_id IS NULL OR NOT public.owns_shop(p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for shop %', p_shop_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_owns_shop(uuid) IS
  'Raises 42501 unless owns_shop() accepts the given shop id (own shop, a '
  'branch of it, staff session, or admin).';

REVOKE ALL ON FUNCTION public.assert_acting_distributor(uuid) FROM public;
REVOKE ALL ON FUNCTION public.assert_owns_shop(uuid)          FROM public;
GRANT EXECUTE ON FUNCTION public.assert_acting_distributor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_owns_shop(uuid)          TO authenticated;


-- ─── 1. apply_stock_transfer ─────────────────────────────────────────
-- Ownership is derived from the transfer row itself, then checked. The
-- lookup moves above the existing not-found check so an unauthorized
-- caller cannot use timing or error text to probe which uuids exist.

CREATE OR REPLACE FUNCTION public.apply_stock_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from uuid; v_to uuid; v_status text; v_dist uuid;
  ln record; v_available numeric;
BEGIN
  SELECT from_warehouse_id, to_warehouse_id, status, distributor_id
    INTO v_from, v_to, v_status, v_dist
    FROM public.stock_transfers WHERE id = p_transfer_id;

  IF v_from IS NULL THEN RAISE EXCEPTION 'Transfer % not found', p_transfer_id; END IF;

  PERFORM public.assert_acting_distributor(v_dist);   -- ← added

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


-- ─── 2. supplier_balances ────────────────────────────────────────────
-- Was a plain cross-tenant read: pass any distributor id, get their whole
-- payables position. Rewritten as plpgsql purely so the guard can run
-- before the query.

CREATE OR REPLACE FUNCTION public.supplier_balances(p_distributor_id uuid)
RETURNS TABLE (
  supplier_id uuid, supplier_name text, phone text,
  total_purchased numeric, total_paid numeric, outstanding numeric,
  last_bill_date date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_acting_distributor(p_distributor_id);   -- ← added

  RETURN QUERY
  SELECT s.id, s.name, s.phone,
         COALESCE(pu.total_purchased, 0),
         COALESCE(pu.paid_on_bill, 0) + COALESCE(pa.paid_later, 0),
         COALESCE(pu.total_purchased, 0)
           - COALESCE(pu.paid_on_bill, 0) - COALESCE(pa.paid_later, 0),
         pu.last_bill
    FROM public.suppliers s
    LEFT JOIN (
      SELECT p.supplier_id,
             SUM(p.total)       AS total_purchased,
             SUM(p.amount_paid) AS paid_on_bill,
             MAX(p.bill_date)   AS last_bill
        FROM public.purchases p
       WHERE p.distributor_id = p_distributor_id
       GROUP BY p.supplier_id
    ) pu ON pu.supplier_id = s.id
    LEFT JOIN (
      SELECT sp.supplier_id, SUM(sp.amount) AS paid_later
        FROM public.supplier_payments sp
       WHERE sp.distributor_id = p_distributor_id
       GROUP BY sp.supplier_id
    ) pa ON pa.supplier_id = s.id
   WHERE s.distributor_id = p_distributor_id AND s.active
   ORDER BY (COALESCE(pu.total_purchased,0) - COALESCE(pu.paid_on_bill,0) - COALESCE(pa.paid_later,0)) DESC;
END;
$$;


-- ─── 3. get_van_series_position ──────────────────────────────────────
-- Reveals a competitor's document numbering, which is a direct read on
-- their sales volume. Scoped through the vehicle's owner.

DO $guard$
BEGIN
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION public.get_van_series_position(p_vehicle_id uuid, p_doc_type text DEFAULT 'invoice')
    RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $body$
    DECLARE v_dist uuid; v_result jsonb;
    BEGIN
      SELECT distributor_id INTO v_dist FROM public.vehicles WHERE id = p_vehicle_id;
      IF v_dist IS NULL THEN RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id; END IF;
      PERFORM public.assert_acting_distributor(v_dist);

      SELECT to_jsonb(s) INTO v_result
        FROM public.van_document_series s
       WHERE s.vehicle_id = p_vehicle_id AND s.doc_type = p_doc_type;

      RETURN v_result;
    END;
    $body$;
  $sql$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'get_van_series_position not replaced (%). Guard it manually.', SQLERRM;
END
$guard$;


-- ─── 3b. SPLICE HELPER ───────────────────────────────────────────────
-- Sections 4–6 guard functions by reading their deployed definition from
-- the catalog, inserting a call after the body's opening BEGIN, and
-- replacing them. That keeps the deployed logic byte-for-byte rather than
-- restating long bodies here, where they could drift from production.
--
-- The insertion point is found by line, NOT by regex. A regex was tried
-- first and was wrong in a way worth recording: in Postgres' POSIX engine
-- the greediness of the WHOLE pattern is set by its FIRST quantifier, so
-- a leading greedy `[a-zA-Z_]*` (matching the dollar-quote tag) overrode
-- the `.*?` that followed and matched the LAST `BEGIN` in the body. In
-- record_purchase that is the BEGIN of a nested block with an
-- `EXCEPTION WHEN OTHERS` handler — so the guard was injected inside a
-- block that swallows the very exception it raises. It read as installed
-- and enforced nothing.
--
-- Splicing on the first line that is exactly BEGIN has no such ambiguity.
-- If no such line exists the function is SKIPPED with a warning rather
-- than guessed at — a loud miss is recoverable, a silent misplacement is
-- not.
CREATE OR REPLACE FUNCTION public._p4_splice_guard(p_def text, p_call text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_lines text[];
  v_start int := 0;
  i int;
BEGIN
  v_lines := string_to_array(p_def, chr(10));

  -- Body begins after the AS <dollar-tag> line; ignore anything before it.
  FOR i IN 1 .. COALESCE(array_length(v_lines, 1), 0) LOOP
    IF v_lines[i] ~ '^AS \$[A-Za-z_0-9]*\$' THEN
      v_start := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_start = 0 THEN RETURN NULL; END IF;

  FOR i IN v_start .. array_length(v_lines, 1) LOOP
    IF btrim(v_lines[i]) = 'BEGIN' THEN
      v_lines[i] := v_lines[i] || chr(10) || '  ' || p_call;
      RETURN array_to_string(v_lines, chr(10));
    END IF;
  END LOOP;

  RETURN NULL;   -- no standalone BEGIN: caller warns and skips
END;
$$;


-- ─── 4. PARAMETER-SCOPED RPCs ────────────────────────────────────────
-- These take a tenant id and trusted it. Rather than restate each body
-- (they are long, and restating risks drift from what is deployed), the
-- guard is injected at the top of the existing definition, which is read
-- back from the catalog. Idempotent: skipped if the guard is already
-- present.

DO $inject$
DECLARE
  fn      record;
  v_def   text;
  v_guard text;
  v_call  text;
  targets text[] := ARRAY[
    'create_direct_sale', 'create_field_vehicle', 'open_day_settlement',
    'record_purchase',    'sync_van_invoice',     'sync_van_return',
    'post_stock_order_to_credit'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY(targets)
  LOOP
    v_def := fn.def;

    IF position('assert_acting_distributor' in v_def) > 0 THEN
      RAISE NOTICE 'skip %: already guarded', fn.proname;
      CONTINUE;
    END IF;

    IF position('p_distributor_id' in v_def) = 0 THEN
      RAISE NOTICE 'skip %: no p_distributor_id parameter', fn.proname;
      CONTINUE;
    END IF;

    v_call  := 'PERFORM public.assert_acting_distributor(p_distributor_id);';
    v_guard := public._p4_splice_guard(v_def, v_call);

    IF v_guard IS NULL THEN
      RAISE WARNING 'P4: could not guard % (no standalone BEGIN) — apply manually', fn.proname;
      CONTINUE;
    END IF;

    EXECUTE v_guard;
    RAISE NOTICE 'guarded %', fn.proname;
  END LOOP;
END
$inject$;


-- ─── 5. SHOP-SCOPED RPCs ─────────────────────────────────────────────
-- receive_van_invoice / receive_stock_order write stock into a shop's
-- inventory. Same injection, keyed on p_shop_id.

DO $inject$
DECLARE
  fn      record;
  v_def   text;
  v_guard text;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('receive_van_invoice', 'receive_stock_order')
  LOOP
    v_def := fn.def;

    IF position('assert_owns_shop' in v_def) > 0 THEN
      RAISE NOTICE 'skip %: already guarded', fn.proname;
      CONTINUE;
    END IF;

    v_guard := public._p4_splice_guard(
                 v_def, 'PERFORM public.assert_owns_shop(p_shop_id);');

    IF v_guard IS NULL THEN
      RAISE WARNING 'P4: could not guard % (no standalone BEGIN) — apply manually', fn.proname;
      CONTINUE;
    END IF;

    EXECUTE v_guard;
    RAISE NOTICE 'guarded %', fn.proname;
  END LOOP;
END
$inject$;


-- ─── 6. ROW-SCOPED RPCs ──────────────────────────────────────────────
-- convert_field_order and close_day_settlement take a row id, so the
-- tenant has to be resolved from the row before it can be checked. The
-- guard is a two-statement preamble rather than a one-liner, injected the
-- same way: read the deployed definition from the catalog, insert after
-- BEGIN, replace.
--
-- Both parent tables carry distributor_id directly (field_orders from
-- phase 2, day_settlements from phase 4), so the lookup is a single
-- SELECT ... INTO against the id parameter.

DO $rowscope$
DECLARE
  fn      record;
  v_def   text;
  v_guard text;
  v_pre   text;
  v_table text;
  v_param text;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('convert_field_order', 'close_day_settlement')
  LOOP
    v_def := fn.def;

    IF position('assert_acting_distributor' in v_def) > 0 THEN
      RAISE NOTICE 'skip %: already guarded', fn.proname;
      CONTINUE;
    END IF;

    IF fn.proname = 'convert_field_order' THEN
      v_table := 'public.field_orders';   v_param := 'p_order_id';
    ELSE
      v_table := 'public.day_settlements'; v_param := 'p_settlement_id';
    END IF;

    -- Declared inline via a nested block so no DECLARE section has to be
    -- edited — the existing one is left exactly as deployed.
    v_pre := format(
      'DECLARE v_p4_dist uuid; BEGIN '
      || 'SELECT distributor_id INTO v_p4_dist FROM %s WHERE id = %s; '
      || 'IF v_p4_dist IS NULL THEN RAISE EXCEPTION ''Record %% not found'', %s; END IF; '
      || 'PERFORM public.assert_acting_distributor(v_p4_dist); END;',
      v_table, v_param, v_param);

    v_guard := public._p4_splice_guard(v_def, v_pre);

    IF v_guard IS NULL THEN
      RAISE WARNING 'P4: could not guard % (no standalone BEGIN) — apply manually', fn.proname;
      CONTINUE;
    END IF;

    EXECUTE v_guard;
    RAISE NOTICE 'guarded % (via %)', fn.proname, v_table;
  END LOOP;
END
$rowscope$;


-- ─── 7. verify_admin_pin ─────────────────────────────────────────────
-- The existing COMMENT already flags this: short PIN, plaintext column,
-- granted to anon, no rate limit — a brute-force oracle against any shop
-- id. Two changes here, both narrow:
--
--   a. Drop the anon grant. Every caller of verifyAdminPin() in api.js is
--      inside an authenticated shop session; anon was never needed.
--   b. Rate limit per shop id, reusing check_rate_limit() from P1.
--
-- The plaintext storage is NOT fixed here. Hashing users.pass is a data
-- migration that has to be coordinated with the reset/login paths, and
-- doing it inside a security patch would make this migration much harder
-- to review and roll back. It stays on the list.

DO $pin$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'check_rate_limit'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_shop_id uuid, p_pin text)
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE v_ok boolean;
      BEGIN
        PERFORM public.check_rate_limit('verify_admin_pin:' || p_shop_id::text, 10, 300);

        SELECT EXISTS (
          SELECT 1 FROM public.users
          WHERE id = p_shop_id AND pass IS NOT NULL AND pass = p_pin
        ) INTO v_ok;

        RETURN v_ok;
      END;
      $body$;
    $sql$;
    RAISE NOTICE 'verify_admin_pin: rate limiting applied';
  ELSE
    RAISE NOTICE 'verify_admin_pin: check_rate_limit() absent, rate limiting SKIPPED';
  END IF;
END
$pin$;

REVOKE EXECUTE ON FUNCTION public.verify_admin_pin(uuid, text) FROM anon;

COMMENT ON FUNCTION public.verify_admin_pin(uuid, text) IS
  'Server-side Admin PIN check. Returns true/false only; never exposes users.pass. '
  'Authenticated callers only (anon grant removed 20260821) and rate limited per '
  'shop id. OUTSTANDING: users.pass is still stored in plaintext — hashing it is a '
  'separate coordinated migration across login and reset.';


DROP FUNCTION IF EXISTS public._p4_splice_guard(text, text);


SELECT 'P4 field RPC authorization installed' AS status;
