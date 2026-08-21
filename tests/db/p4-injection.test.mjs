// Exercises the migration's catalog-rewrite blocks (sections 4, 5, 6)
// against function bodies shaped like the real ones — nested BEGIN/END,
// $$ and $tag$ delimiters, DECLARE sections, DEFAULT parameters.
//
// The blocks are read straight out of the migration file so this tests the
// SQL that will actually ship, not a paraphrase of it.

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = await PGlite.create();
const q = (sql, p) => db.query(sql, p);
const x = (sql) => db.exec(sql);
const ok = [], bad = [];
const check = (n, c, d = '') =>
  (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '\n        ' + d : ''}`);

const MIG = 'supabase/migrations/20260821_p4_field_rpc_authorization.sql';
const sql = readFileSync(MIG, 'utf8');

// pull the three DO blocks out of the migration by their tags
const block = (tag) => {
  const m = sql.match(new RegExp(`DO \\$${tag}\\$[\\s\\S]*?\\$${tag}\\$;`));
  if (!m) throw new Error(`block ${tag} not found in migration`);
  return m[0];
};

const DIST_A = '11111111-1111-1111-1111-111111111111';
const DIST_B = '22222222-2222-2222-2222-222222222222';
const login = (id) => q(`SELECT set_config('test.uid', $1, false)`, [id]);

await x(`
CREATE TABLE users (id uuid PRIMARY KEY, role text, staff_of uuid);
CREATE TABLE field_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid, shop_id uuid, status text, total numeric);
CREATE TABLE day_settlements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid, vehicle_id uuid, status text);
CREATE TABLE purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid, supplier_id uuid, total numeric);
CREATE TABLE shop_inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid, name text, qty numeric);
`);

await x(`
CREATE FUNCTION current_profile_id() RETURNS uuid LANGUAGE sql STABLE AS
  $fn$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $fn$;
CREATE FUNCTION current_user_role() RETURNS text LANGUAGE sql STABLE AS
  $fn$ SELECT role FROM users WHERE id = current_profile_id() $fn$;
CREATE FUNCTION acting_distributor_id() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT CASE WHEN u.role='distributor' THEN u.id WHEN u.role='staff' THEN u.staff_of END
  FROM users u WHERE u.id = current_profile_id();
$fn$;
CREATE FUNCTION owns_shop(p_shop_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $fn$ SELECT p_shop_id = current_profile_id() OR current_user_role()='admin' $fn$;

CREATE FUNCTION assert_acting_distributor(p_distributor_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF current_user_role() = 'admin' THEN RETURN; END IF;
  IF p_distributor_id IS NULL OR p_distributor_id IS DISTINCT FROM acting_distributor_id() THEN
    RAISE EXCEPTION 'Not authorized for distributor %', p_distributor_id USING ERRCODE='42501';
  END IF;
END; $fn$;

CREATE FUNCTION assert_owns_shop(p_shop_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF p_shop_id IS NULL OR NOT owns_shop(p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for shop %', p_shop_id USING ERRCODE='42501';
  END IF;
END; $fn$;
`);

// ─── awkward-shaped targets ─────────────────────────────────────────
// nested BEGIN/END, a DEFAULT param, a $tag$ delimiter, a loop.
await x(`
CREATE FUNCTION record_purchase(p_distributor_id uuid, p_supplier_id uuid,
                                p_total numeric, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
DECLARE
  v_id uuid;
  v_n  int := 0;
BEGIN
  BEGIN
    v_n := 1;
  EXCEPTION WHEN OTHERS THEN
    v_n := -1;
  END;
  INSERT INTO purchases (distributor_id, supplier_id, total)
  VALUES (p_distributor_id, p_supplier_id, p_total) RETURNING id INTO v_id;
  RETURN v_id;
END; $body$;

CREATE FUNCTION receive_stock_order(p_order_id uuid, p_shop_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_created int := 0;
BEGIN
  INSERT INTO shop_inventory (shop_id, name, qty) VALUES (p_shop_id, 'widget', 5);
  v_created := 1;
  RETURN jsonb_build_object('created', v_created);
END; $$;

CREATE FUNCTION convert_field_order(p_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order record;
BEGIN
  SELECT * INTO v_order FROM field_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Field order % not found', p_order_id; END IF;
  UPDATE field_orders SET status='converted' WHERE id = p_order_id;
  RETURN p_order_id;
END; $$;

CREATE FUNCTION close_day_settlement(p_settlement_id uuid, p_counted_cash numeric,
                                     p_counted_upi numeric, p_stock_counts jsonb,
                                     p_closed_by uuid, p_override_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s record; v_line jsonb;
BEGIN
  SELECT * INTO v_s FROM day_settlements WHERE id = p_settlement_id;
  UPDATE day_settlements SET status='closed' WHERE id = p_settlement_id;
  RETURN jsonb_build_object('closed', true);
END; $$;
`);

await q(`INSERT INTO users (id, role) VALUES ($1,'distributor')`, [DIST_A]);
await q(`INSERT INTO users (id, role) VALUES ($1,'distributor')`, [DIST_B]);

const foB = (await q(`INSERT INTO field_orders (distributor_id, shop_id, status, total)
                      VALUES ($1,$1,'pending',100) RETURNING id`, [DIST_B])).rows[0].id;
const dsB = (await q(`INSERT INTO day_settlements (distributor_id, status)
                      VALUES ($1,'open') RETURNING id`, [DIST_B])).rows[0].id;

// ─── install the splice helper from the migration ───────────────────
const helper = sql.match(/CREATE OR REPLACE FUNCTION public\._p4_splice_guard[\s\S]*?\n\$\$;/)[0];
await x(helper);

// ─── run the migration's own blocks ─────────────────────────────────
for (const tag of ['inject', 'rowscope']) {
  try { await x(block(tag)); check(`migration block $${tag}$ executes`, true); }
  catch (e) { check(`migration block $${tag}$ executes`, false, e.message); }
}
// section 5 is the second $inject$ block — grab it explicitly
const injectBlocks = sql.match(/DO \$inject\$[\s\S]*?\$inject\$;/g) || [];
check('migration has both $inject$ blocks', injectBlocks.length === 2,
      `found ${injectBlocks.length}`);
if (injectBlocks[1]) {
  try { await x(injectBlocks[1]); check('shop-scoped $inject$ block executes', true); }
  catch (e) { check('shop-scoped $inject$ block executes', false, e.message); }
}

// ─── did the guards actually land? ──────────────────────────────────
const guardedIn = async (fname, needle) => (await q(
  `SELECT position($2 in pg_get_functiondef(p.oid)) > 0 AS g FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=$1`, [fname, needle])).rows[0]?.g;

check('record_purchase guarded',      await guardedIn('record_purchase', 'assert_acting_distributor'));
check('receive_stock_order guarded',  await guardedIn('receive_stock_order', 'assert_owns_shop'));
check('convert_field_order guarded',  await guardedIn('convert_field_order', 'assert_acting_distributor'));
check('close_day_settlement guarded', await guardedIn('close_day_settlement', 'assert_acting_distributor'));

// regression: the guard must land in the OUTER block, not inside the
// nested BEGIN/EXCEPTION handler that swallows WHEN OTHERS.
const pos = await q(
  `SELECT strpos(pg_get_functiondef(p.oid),'assert_acting_distributor') AS guard_at,
          strpos(pg_get_functiondef(p.oid),'EXCEPTION WHEN OTHERS')     AS handler_at
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='record_purchase'`);
check('guard sits outside the exception handler',
      pos.rows[0].guard_at > 0 && pos.rows[0].guard_at < pos.rows[0].handler_at,
      `guard@${pos.rows[0].guard_at} handler@${pos.rows[0].handler_at}`);

// ─── behaviour: A attacking B ───────────────────────────────────────
await login(DIST_A);
const blocked = async (name, s, p) => {
  try { await q(s, p); check(name, false, 'SUCCEEDED — still exploitable'); }
  catch (e) { check(name, /Not authorized/.test(e.message), e.message.split('\n')[0]); }
};
await blocked('record_purchase blocked',      `SELECT record_purchase($1,$1,500)`, [DIST_B]);
await blocked('receive_stock_order blocked',  `SELECT receive_stock_order($1,$2)`, [foB, DIST_B]);
await blocked('convert_field_order blocked',  `SELECT convert_field_order($1)`, [foB]);
await blocked('close_day_settlement blocked',
              `SELECT close_day_settlement($1,0,0,'[]'::jsonb,$2)`, [dsB, DIST_A]);

const rows = await q(`SELECT count(*)::int AS c FROM purchases WHERE distributor_id=$1`, [DIST_B]);
check('no cross-tenant rows written', rows.rows[0].c === 0, `${rows.rows[0].c} purchase row(s)`);

// ─── behaviour: B doing its own work ────────────────────────────────
await login(DIST_B);
try {
  await q(`SELECT record_purchase($1,$1,500)`, [DIST_B]);
  await q(`SELECT convert_field_order($1)`, [foB]);
  await q(`SELECT close_day_settlement($1,0,0,'[]'::jsonb,$2)`, [dsB, DIST_B]);
  check('owner unaffected by guards', true);
} catch (e) { check('owner unaffected by guards', false, e.message); }

const st = await q(`SELECT status FROM field_orders WHERE id=$1`, [foB]);
check('owner conversion took effect', st.rows[0].status === 'converted', st.rows[0].status);

// ─── idempotency: re-running must not double-inject ─────────────────
for (const b of [block('inject'), injectBlocks[1], block('rowscope')].filter(Boolean)) await x(b);
const dbl = await q(
  `SELECT (length(pg_get_functiondef(p.oid))
           - length(replace(pg_get_functiondef(p.oid),'assert_acting_distributor','')))
          / length('assert_acting_distributor') AS n
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='record_purchase'`);
check('re-running the migration is idempotent', Number(dbl.rows[0].n) === 1,
      `guard appears ${dbl.rows[0].n}x`);

console.log('\n' + [...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
