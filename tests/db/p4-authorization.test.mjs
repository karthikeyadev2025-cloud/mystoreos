// Verifies the P4 authorization fix against a real Postgres (PGlite).
//
//   1. proves the cross-tenant attack succeeds BEFORE the fix
//   2. applies the guards
//   3. proves the same attacks are rejected AFTER
//   4. proves owner / staff / admin access is unaffected
//
// Session identity is stubbed through a GUC so we can "log in" as different
// users without Supabase Auth.

import { PGlite } from '@electric-sql/pglite';

const db = await PGlite.create();
const q = (sql, p) => db.query(sql, p);   // single, parameterized
const x = (sql) => db.exec(sql);          // multi-statement DDL

const ok = [], bad = [];
const check = (name, cond, detail = '') =>
  (cond ? ok : bad).push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '\n        ' + detail : ''}`);

const DIST_A  = '11111111-1111-1111-1111-111111111111';
const DIST_B  = '22222222-2222-2222-2222-222222222222';
const PROD    = '33333333-3333-3333-3333-333333333333';
const STAFF_B = '44444444-4444-4444-4444-444444444444';
const ADMIN   = '55555555-5555-5555-5555-555555555555';
const BATCH   = '66666666-6666-6666-6666-666666666666';

const login = (id) => q(`SELECT set_config('test.uid', $1, false)`, [id]);

// ─── schema slice ───────────────────────────────────────────────────
await x(`
CREATE TABLE users (id uuid PRIMARY KEY, role text, staff_of uuid, pass text);
CREATE TABLE warehouses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), distributor_id uuid, name text);
CREATE TABLE stock_transfers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), distributor_id uuid,
  from_warehouse_id uuid, to_warehouse_id uuid, status text, confirmed_at timestamptz);
CREATE TABLE stock_transfer_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transfer_id uuid,
  product_id uuid, batch_id uuid, qty_base numeric, condition text DEFAULT 'good');
CREATE TABLE warehouse_stock (warehouse_id uuid, product_id uuid, batch_id uuid,
  qty_base numeric, condition text DEFAULT 'good', updated_at timestamptz,
  PRIMARY KEY (warehouse_id, product_id, batch_id, condition));
CREATE TABLE suppliers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), distributor_id uuid,
  name text, phone text, active boolean DEFAULT true);
CREATE TABLE purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), distributor_id uuid,
  supplier_id uuid, total numeric, amount_paid numeric, bill_date date);
CREATE TABLE vehicles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), distributor_id uuid, code text);
CREATE TABLE van_document_series (vehicle_id uuid, doc_type text, next_no int);
`);

// ─── session identity stubs ─────────────────────────────────────────
await x(`
CREATE FUNCTION current_profile_id() RETURNS uuid LANGUAGE sql STABLE AS
  $fn$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $fn$;

CREATE FUNCTION current_user_role() RETURNS text LANGUAGE sql STABLE AS
  $fn$ SELECT role FROM users WHERE id = current_profile_id() $fn$;

CREATE FUNCTION acting_distributor_id() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT CASE WHEN u.role = 'distributor' THEN u.id
              WHEN u.role = 'staff'       THEN u.staff_of
              ELSE NULL END
  FROM users u WHERE u.id = current_profile_id();
$fn$;

CREATE FUNCTION owns_shop(p_shop_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $fn$ SELECT p_shop_id = current_profile_id() OR current_user_role() = 'admin' $fn$;
`);

// ─── the vulnerable functions, as currently deployed ────────────────
await x(`
CREATE FUNCTION apply_stock_transfer(p_transfer_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_from uuid; v_to uuid; v_status text; ln record; v_available numeric;
BEGIN
  SELECT from_warehouse_id, to_warehouse_id, status INTO v_from, v_to, v_status
    FROM stock_transfers WHERE id = p_transfer_id;
  IF v_from IS NULL THEN RAISE EXCEPTION 'Transfer % not found', p_transfer_id; END IF;
  IF v_status = 'confirmed' THEN RAISE EXCEPTION 'Transfer % already applied', p_transfer_id; END IF;
  FOR ln IN SELECT * FROM stock_transfer_lines WHERE transfer_id = p_transfer_id LOOP
    SELECT COALESCE(qty_base,0) INTO v_available FROM warehouse_stock
      WHERE warehouse_id = v_from AND product_id = ln.product_id
        AND batch_id IS NOT DISTINCT FROM ln.batch_id AND condition = ln.condition;
    IF COALESCE(v_available,0) < ln.qty_base THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
    UPDATE warehouse_stock SET qty_base = qty_base - ln.qty_base, updated_at = now()
      WHERE warehouse_id = v_from AND product_id = ln.product_id
        AND batch_id IS NOT DISTINCT FROM ln.batch_id AND condition = ln.condition;
    INSERT INTO warehouse_stock (warehouse_id, product_id, batch_id, qty_base, condition)
      VALUES (v_to, ln.product_id, ln.batch_id, ln.qty_base, ln.condition)
      ON CONFLICT (warehouse_id, product_id, batch_id, condition)
      DO UPDATE SET qty_base = warehouse_stock.qty_base + EXCLUDED.qty_base;
  END LOOP;
  UPDATE stock_transfers SET status='confirmed', confirmed_at=now() WHERE id = p_transfer_id;
END; $fn$;

CREATE FUNCTION supplier_balances(p_distributor_id uuid)
RETURNS TABLE (supplier_id uuid, supplier_name text, outstanding numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT s.id, s.name, COALESCE(SUM(p.total),0) - COALESCE(SUM(p.amount_paid),0)
    FROM suppliers s LEFT JOIN purchases p ON p.supplier_id = s.id
   WHERE s.distributor_id = p_distributor_id AND s.active
   GROUP BY s.id, s.name;
$fn$;

CREATE FUNCTION record_purchase(p_distributor_id uuid, p_supplier_id uuid, p_total numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_id uuid;
BEGIN
  INSERT INTO purchases (distributor_id, supplier_id, total, amount_paid, bill_date)
  VALUES (p_distributor_id, p_supplier_id, p_total, 0, CURRENT_DATE)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $fn$;

CREATE FUNCTION get_van_series_position(p_vehicle_id uuid, p_doc_type text DEFAULT 'invoice')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT to_jsonb(s) FROM van_document_series s
   WHERE s.vehicle_id = p_vehicle_id AND s.doc_type = p_doc_type;
$fn$;
`);

// ─── fixtures ───────────────────────────────────────────────────────
await q(`INSERT INTO users (id, role, pass) VALUES ($1,'distributor','1234')`, [DIST_A]);
await q(`INSERT INTO users (id, role, pass) VALUES ($1,'distributor','9999')`, [DIST_B]);
await q(`INSERT INTO users (id, role, staff_of) VALUES ($1,'staff',$2)`, [STAFF_B, DIST_B]);
await q(`INSERT INTO users (id, role) VALUES ($1,'admin')`, [ADMIN]);

const whs = await q(
  `INSERT INTO warehouses (distributor_id, name) VALUES ($1,'B-main'),($1,'B-van') RETURNING id`,
  [DIST_B]);
const whB1 = whs.rows[0].id, whB2 = whs.rows[1].id;

await q(`INSERT INTO warehouse_stock (warehouse_id, product_id, batch_id, qty_base)
         VALUES ($1,$2,$3,500)`, [whB1, PROD, BATCH]);

const trB = (await q(
  `INSERT INTO stock_transfers (distributor_id, from_warehouse_id, to_warehouse_id, status)
   VALUES ($1,$2,$3,'draft') RETURNING id`, [DIST_B, whB1, whB2])).rows[0].id;
await q(`INSERT INTO stock_transfer_lines (transfer_id, product_id, batch_id, qty_base)
         VALUES ($1,$2,$3,300)`, [trB, PROD, BATCH]);

const supB = (await q(
  `INSERT INTO suppliers (distributor_id, name, phone)
   VALUES ($1,'B Wholesale','9000000000') RETURNING id`, [DIST_B])).rows[0].id;
await q(`INSERT INTO purchases (distributor_id, supplier_id, total, amount_paid, bill_date)
         VALUES ($1,$2,250000,50000,CURRENT_DATE)`, [DIST_B, supB]);

const vehB = (await q(`INSERT INTO vehicles (distributor_id, code)
                       VALUES ($1,'B-VAN-01') RETURNING id`, [DIST_B])).rows[0].id;
await q(`INSERT INTO van_document_series (vehicle_id, doc_type, next_no)
         VALUES ($1,'invoice',847)`, [vehB]);

// ════════ PHASE 1 — attack BEFORE the fix ═══════════════════════════
console.log('\n=== BEFORE FIX — distributor A attacking distributor B ===');
await login(DIST_A);

try {
  await q(`SELECT apply_stock_transfer($1)`, [trB]);
  const moved = (await q(`SELECT qty_base FROM warehouse_stock WHERE warehouse_id=$1`, [whB1])).rows[0];
  check('apply_stock_transfer is exploitable', Number(moved.qty_base) === 200,
        `B's warehouse went 500 -> ${moved.qty_base} on A's call`);
} catch (e) {
  check('apply_stock_transfer is exploitable', false, 'unexpectedly blocked: ' + e.message);
}

const leak = await q(`SELECT * FROM supplier_balances($1)`, [DIST_B]);
check('supplier_balances leaks cross-tenant', leak.rows.length > 0,
      `A read ${leak.rows.length} of B's supplier(s); outstanding = ${leak.rows[0]?.outstanding}`);

const inj = await q(`SELECT record_purchase($1,$2,99999) AS id`, [DIST_B, supB]);
check('record_purchase writes cross-tenant', !!inj.rows[0].id,
      "A inserted a fake purchase into B's ledger");

const ser = await q(`SELECT get_van_series_position($1) AS v`, [vehB]);
check('get_van_series_position leaks', ser.rows[0].v !== null,
      `A read B's invoice counter: ${JSON.stringify(ser.rows[0].v)}`);

// ════════ PHASE 2 — apply the guards ════════════════════════════════
await x(`
CREATE OR REPLACE FUNCTION assert_acting_distributor(p_distributor_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF current_user_role() = 'admin' THEN RETURN; END IF;
  IF p_distributor_id IS NULL OR p_distributor_id IS DISTINCT FROM acting_distributor_id() THEN
    RAISE EXCEPTION 'Not authorized for distributor %', p_distributor_id USING ERRCODE = '42501';
  END IF;
END; $fn$;

CREATE OR REPLACE FUNCTION assert_owns_shop(p_shop_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF p_shop_id IS NULL OR NOT owns_shop(p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for shop %', p_shop_id USING ERRCODE = '42501';
  END IF;
END; $fn$;
`);

// hand-written guards (sections 1-3 of the migration)
await x(`
CREATE OR REPLACE FUNCTION apply_stock_transfer(p_transfer_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_from uuid; v_to uuid; v_status text; v_dist uuid; ln record; v_available numeric;
BEGIN
  SELECT from_warehouse_id, to_warehouse_id, status, distributor_id
    INTO v_from, v_to, v_status, v_dist FROM stock_transfers WHERE id = p_transfer_id;
  IF v_from IS NULL THEN RAISE EXCEPTION 'Transfer % not found', p_transfer_id; END IF;
  PERFORM assert_acting_distributor(v_dist);
  IF v_status = 'confirmed' THEN RAISE EXCEPTION 'Transfer % already applied', p_transfer_id; END IF;
  FOR ln IN SELECT * FROM stock_transfer_lines WHERE transfer_id = p_transfer_id LOOP
    SELECT COALESCE(qty_base,0) INTO v_available FROM warehouse_stock
      WHERE warehouse_id = v_from AND product_id = ln.product_id
        AND batch_id IS NOT DISTINCT FROM ln.batch_id AND condition = ln.condition;
    IF COALESCE(v_available,0) < ln.qty_base THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
    UPDATE warehouse_stock SET qty_base = qty_base - ln.qty_base, updated_at = now()
      WHERE warehouse_id = v_from AND product_id = ln.product_id
        AND batch_id IS NOT DISTINCT FROM ln.batch_id AND condition = ln.condition;
    INSERT INTO warehouse_stock (warehouse_id, product_id, batch_id, qty_base, condition)
      VALUES (v_to, ln.product_id, ln.batch_id, ln.qty_base, ln.condition)
      ON CONFLICT (warehouse_id, product_id, batch_id, condition)
      DO UPDATE SET qty_base = warehouse_stock.qty_base + EXCLUDED.qty_base;
  END LOOP;
  UPDATE stock_transfers SET status='confirmed', confirmed_at=now() WHERE id = p_transfer_id;
END; $fn$;

CREATE OR REPLACE FUNCTION supplier_balances(p_distributor_id uuid)
RETURNS TABLE (supplier_id uuid, supplier_name text, outstanding numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM assert_acting_distributor(p_distributor_id);
  RETURN QUERY
    SELECT s.id, s.name, COALESCE(SUM(p.total),0) - COALESCE(SUM(p.amount_paid),0)
      FROM suppliers s LEFT JOIN purchases p ON p.supplier_id = s.id
     WHERE s.distributor_id = p_distributor_id AND s.active
     GROUP BY s.id, s.name;
END; $fn$;

CREATE OR REPLACE FUNCTION get_van_series_position(p_vehicle_id uuid, p_doc_type text DEFAULT 'invoice')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_dist uuid; v_result jsonb;
BEGIN
  SELECT distributor_id INTO v_dist FROM vehicles WHERE id = p_vehicle_id;
  IF v_dist IS NULL THEN RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id; END IF;
  PERFORM assert_acting_distributor(v_dist);
  SELECT to_jsonb(s) INTO v_result FROM van_document_series s
   WHERE s.vehicle_id = p_vehicle_id AND s.doc_type = p_doc_type;
  RETURN v_result;
END; $fn$;
`);

// the catalog-rewrite injection from section 4, exercised on record_purchase
await x(`
DO $inject$
DECLARE fn record; v_def text; v_guard text; v_call text;
        targets text[] := ARRAY['record_purchase'];
BEGIN
  FOR fn IN SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
              FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname='public' AND p.proname = ANY(targets)
  LOOP
    v_def := fn.def;
    IF position('assert_acting_distributor' in v_def) > 0 THEN CONTINUE; END IF;
    IF position('p_distributor_id' in v_def) = 0 THEN CONTINUE; END IF;
    v_call := 'PERFORM public.assert_acting_distributor(p_distributor_id);';
    v_guard := regexp_replace(v_def, '(AS \\$[a-zA-Z_]*\\$.*?[[:space:]]BEGIN[[:space:]])',
                              '\\1  ' || v_call || chr(10) || '  ', '');
    IF v_guard = v_def THEN
      RAISE WARNING 'INJECT-FAILED %', fn.proname; CONTINUE;
    END IF;
    EXECUTE v_guard;
  END LOOP;
END $inject$;
`);

const guarded = await q(
  `SELECT position('assert_acting_distributor' in pg_get_functiondef(p.oid)) > 0 AS g
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='record_purchase'`);
check('catalog-rewrite injection applied the guard', guarded.rows[0]?.g === true,
      'record_purchase definition now contains the assert');

// ════════ PHASE 3 — same attacks AFTER the fix ══════════════════════
console.log('=== AFTER FIX — same attacks, same attacker ===');
await login(DIST_A);

await q(`UPDATE stock_transfers SET status='draft', confirmed_at=NULL WHERE id=$1`, [trB]);
await q(`UPDATE warehouse_stock SET qty_base=500 WHERE warehouse_id=$1`, [whB1]);
await q(`DELETE FROM warehouse_stock WHERE warehouse_id=$1`, [whB2]);

const blocked = async (name, sql, params) => {
  try {
    await q(sql, params);
    check(name, false, 'call SUCCEEDED — still exploitable');
  } catch (e) {
    check(name, /Not authorized/.test(e.message), e.message.split('\n')[0]);
  }
};

await blocked('apply_stock_transfer blocks cross-tenant', `SELECT apply_stock_transfer($1)`, [trB]);
const still = (await q(`SELECT qty_base FROM warehouse_stock WHERE warehouse_id=$1`, [whB1])).rows[0];
check("B's stock untouched after blocked call", Number(still.qty_base) === 500,
      `qty_base = ${still.qty_base}`);

await blocked('supplier_balances blocks cross-tenant', `SELECT * FROM supplier_balances($1)`, [DIST_B]);
await blocked('record_purchase blocks cross-tenant', `SELECT record_purchase($1,$2,99999)`, [DIST_B, supB]);
await blocked('get_van_series_position blocks cross-tenant', `SELECT get_van_series_position($1)`, [vehB]);
await blocked('null distributor id is rejected', `SELECT * FROM supplier_balances(NULL)`, []);

// ════════ PHASE 4 — legitimate access must still work ═══════════════
console.log('=== REGRESSION — owner, staff and admin ===');
await login(DIST_B);

try {
  await q(`SELECT apply_stock_transfer($1)`, [trB]);
  const src = (await q(`SELECT qty_base FROM warehouse_stock WHERE warehouse_id=$1`, [whB1])).rows[0];
  const dst = (await q(`SELECT qty_base FROM warehouse_stock WHERE warehouse_id=$1`, [whB2])).rows[0];
  check('owner can still apply own transfer',
        Number(src.qty_base) === 200 && Number(dst?.qty_base) === 300,
        `from = ${src.qty_base}, to = ${dst?.qty_base}`);
} catch (e) {
  check('owner can still apply own transfer', false, e.message);
}

check('owner still reads own supplier_balances',
      (await q(`SELECT * FROM supplier_balances($1)`, [DIST_B])).rows.length === 1);
check('owner still records own purchase',
      !!(await q(`SELECT record_purchase($1,$2,1000) AS id`, [DIST_B, supB])).rows[0].id);
check('owner still reads own van series',
      (await q(`SELECT get_van_series_position($1) AS v`, [vehB])).rows[0].v !== null);

await login(STAFF_B);
check("B's staff still has access via staff_of",
      (await q(`SELECT * FROM supplier_balances($1)`, [DIST_B])).rows.length === 1);

await login(ADMIN);
check('admin override still works',
      (await q(`SELECT * FROM supplier_balances($1)`, [DIST_B])).rows.length === 1);

// ─── report ─────────────────────────────────────────────────────────
console.log('\n' + [...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
