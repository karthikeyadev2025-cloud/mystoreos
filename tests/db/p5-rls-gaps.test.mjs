// P5 — proves two live RLS gaps, then proves the fix closes them.
//
// Unlike the P4 tests (which exercise SECURITY DEFINER functions), these
// need real RLS enforcement, so the harness creates actual anon /
// authenticated roles, grants like Supabase does, and switches roles with
// SET LOCAL ROLE. current_profile_id() reads a GUC in place of auth.uid().
//
// The point of both findings is the same Postgres rule: PERMISSIVE
// policies for one command are OR'd. A later correct policy does not
// override an earlier open one — it widens it. Reading the migration
// history suggests both were fixed. Running them shows otherwise.

import { PGlite } from '@electric-sql/pglite';

const db = await PGlite.create();
const q = (sql, p) => db.query(sql, p);
const x = (sql) => db.exec(sql);
const ok = [], bad = [];
const check = (n, c, d = '') =>
  (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '\n        ' + d : ''}`);

const SHOP_A  = '11111111-1111-1111-1111-111111111111';
const SHOP_B  = '22222222-2222-2222-2222-222222222222';
const CUST    = '33333333-3333-3333-3333-333333333333';

await x(`
CREATE ROLE anon;
CREATE ROLE authenticated;

CREATE TABLE users (
  id uuid PRIMARY KEY, role text, phone text, parent_shop_id uuid, staff_of uuid
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL, shop_id uuid, items jsonb, total numeric,
  status text DEFAULT 'Pending'
);
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid, provider_id uuid,
  appointment_date date, appointment_time time, duration_minutes integer,
  status text DEFAULT 'Pending',
  customer_name text, customer_phone text, service_name text, notes text
);

CREATE FUNCTION current_profile_id() RETURNS uuid LANGUAGE sql STABLE AS
  $fn$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $fn$;

CREATE FUNCTION current_user_role() RETURNS text LANGUAGE sql STABLE AS
  $fn$ SELECT role FROM users WHERE id = current_profile_id() $fn$;

CREATE FUNCTION owns_shop(p_shop_id uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER AS
  $fn$ SELECT p_shop_id = current_profile_id() OR current_user_role() = 'admin' $fn$;

CREATE FUNCTION current_user_shop_id() RETURNS uuid LANGUAGE sql STABLE AS
  $fn$ SELECT current_profile_id() $fn$;
`);

// Grants as Supabase issues them.
await x(`
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_all ON users FOR SELECT USING (true);
`);

// ── the policies exactly as the migration history leaves them ──
await x(`
-- 20260521_v4_foundations.sql
CREATE POLICY "orders_insert_any" ON public.orders FOR INSERT WITH CHECK (true);
-- 20260622_branch_rls_all_tables.sql — added, but the above was never dropped
CREATE POLICY "orders_insert_shop" ON public.orders
  FOR INSERT WITH CHECK (owns_shop(shop_id));
CREATE POLICY "orders_read_shop" ON public.orders
  FOR SELECT USING (owns_shop(shop_id) OR user_id = current_profile_id()::text);

-- 20260702_service_booking.sql
CREATE POLICY "appointments_owner_all" ON public.appointments
  FOR ALL USING (shop_id = current_user_shop_id());
-- 20260705_appointments_privacy_fix.sql — no TO clause, so ALL roles
CREATE POLICY "appointments_public_slot_check" ON public.appointments
  FOR SELECT USING (true);
`);

// The column GRANT that makes the anon case safe.
await x(`
REVOKE SELECT ON public.appointments FROM anon;
GRANT SELECT (id, shop_id, appointment_date, appointment_time, duration_minutes, status)
  ON public.appointments TO anon;
`);

await q(`INSERT INTO users (id, role, phone) VALUES ($1,'shop','9000000001')`, [SHOP_A]);
await q(`INSERT INTO users (id, role, phone) VALUES ($1,'shop','9000000002')`, [SHOP_B]);
await q(`INSERT INTO users (id, role, phone) VALUES ($1,'customer','9111111111')`, [CUST]);

await q(`INSERT INTO appointments
         (shop_id, appointment_date, appointment_time, duration_minutes,
          customer_name, customer_phone, service_name, notes)
         VALUES ($1, CURRENT_DATE, '10:00', 30,
                 'Priya R', '9333333333', 'Bridal package', 'allergic to henna')`,
        [SHOP_B]);

const asRole = async (role, uid, fn) => {
  await x('BEGIN');
  await q(`SELECT set_config('test.uid', $1, true)`, [uid ?? '']);
  await x(`SET LOCAL ROLE ${role}`);
  try { return await fn(); } finally { await x('ROLLBACK'); }
};

// ══════ BEFORE ══════════════════════════════════════════════════════
console.log('\n=== BEFORE FIX ===');

// Finding 1 — shop A inserts an order into shop B's books
await asRole('authenticated', SHOP_A, async () => {
  try {
    await q(`INSERT INTO orders (user_id, shop_id, items, total)
             VALUES ($1, $2, '[]'::jsonb, 0.01)`, [SHOP_A, SHOP_B]);
    check('orders: cross-shop direct insert succeeds', true,
          "shop A wrote an order into shop B's books at total 0.01, " +
          'bypassing place_order_atomic entirely');
  } catch (e) {
    check('orders: cross-shop direct insert succeeds', false, 'blocked: ' + e.message);
  }
});

// Finding 2 — any logged-in account reads every customer's PII
await asRole('authenticated', CUST, async () => {
  const r = await q(`SELECT customer_name, customer_phone, notes FROM appointments`);
  check('appointments: PII readable by any authenticated user', r.rows.length > 0,
        r.rows.length
          ? `a plain customer read: ${r.rows[0].customer_name} / ` +
            `${r.rows[0].customer_phone} / "${r.rows[0].notes}"`
          : 'no rows');
});

// anon is genuinely protected — the 20260705 column GRANT works
await asRole('anon', null, async () => {
  let blocked = false;
  try { await q(`SELECT customer_phone FROM appointments`); }
  catch { blocked = true; }
  check('appointments: anon correctly blocked from PII (column GRANT holds)', blocked);
});

// ══════ APPLY THE FIX ═══════════════════════════════════════════════
await x(`
DROP POLICY IF EXISTS "orders_insert_any" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_shop" ON public.orders;
CREATE POLICY "orders_insert_shop" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (owns_shop(shop_id));

DROP POLICY IF EXISTS "appointments_public_slot_check" ON public.appointments;
CREATE POLICY "appointments_slot_check_anon" ON public.appointments
  FOR SELECT TO anon USING (true);
CREATE POLICY "appointments_own_bookings" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    customer_phone IS NOT NULL
    AND customer_phone = (SELECT u.phone FROM public.users u WHERE u.id = current_profile_id())
  );

CREATE OR REPLACE FUNCTION get_booked_slots(p_shop_id uuid, p_date date, p_provider_id uuid DEFAULT NULL)
RETURNS TABLE (appointment_time time, duration_minutes integer, id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT a.appointment_time, a.duration_minutes, a.id FROM public.appointments a
   WHERE a.appointment_date = p_date AND a.status IS DISTINCT FROM 'cancelled'
     AND ((p_provider_id IS NOT NULL AND a.provider_id = p_provider_id)
       OR (p_provider_id IS NULL AND a.shop_id = p_shop_id AND a.provider_id IS NULL));
$fn$;
GRANT EXECUTE ON FUNCTION get_booked_slots(uuid, date, uuid) TO anon, authenticated;
`);

// ══════ AFTER ═══════════════════════════════════════════════════════
console.log('=== AFTER FIX ===');

await asRole('authenticated', SHOP_A, async () => {
  let blocked = false;
  try {
    await q(`INSERT INTO orders (user_id, shop_id, items, total)
             VALUES ($1::text, $2::uuid, '[]'::jsonb, 0.01)`, [SHOP_A, SHOP_B]);
  } catch (e) { blocked = /row-level security|violates/i.test(e.message); }
  check('orders: cross-shop insert now blocked', blocked);
});

await asRole('authenticated', CUST, async () => {
  const r = await q(`SELECT customer_name, customer_phone FROM appointments`);
  check('appointments: PII no longer readable by an unrelated customer',
        r.rows.length === 0, `${r.rows.length} row(s) returned`);
});

// ══════ REGRESSION ══════════════════════════════════════════════════
console.log('=== REGRESSION ===');

// shop still writes its own orders
await asRole('authenticated', SHOP_B, async () => {
  try {
    await q(`INSERT INTO orders (user_id, shop_id, items, total)
             VALUES ($1::text, $1::uuid, '[]'::jsonb, 500)`, [SHOP_B]);
    check('shop can still insert its own orders', true);
  } catch (e) { check('shop can still insert its own orders', false, e.message); }
});

// a customer gets NO direct-insert path — checkout goes through
// place_order_atomic (SECURITY DEFINER), which does the price check.
// Allowing "the row is mine" here would let any caller name any shop_id
// and any total, which is the original hole one step narrower.
await asRole('authenticated', CUST, async () => {
  let blocked = false;
  try {
    await q(`INSERT INTO orders (user_id, shop_id, items, total)
             VALUES ($1::text, $2::uuid, '[]'::jsonb, 0.01)`, [CUST, SHOP_B]);
  } catch (e) { blocked = /row-level security|violates/i.test(e.message); }
  check('customer direct insert blocked (must use the RPC)', blocked);
});

// shop still sees its own appointments in full
await asRole('authenticated', SHOP_B, async () => {
  const r = await q(`SELECT customer_name, customer_phone FROM appointments`);
  check('shop still sees its own appointments in full', r.rows.length === 1,
        `${r.rows.length} row(s)`);
});

// the customer who owns the booking still sees it
await q(`UPDATE users SET phone = '9333333333' WHERE id = $1`, [CUST]);
await asRole('authenticated', CUST, async () => {
  const r = await q(`SELECT customer_name FROM appointments`);
  check('customer still sees their OWN booking', r.rows.length === 1, `${r.rows.length} row(s)`);
});

// slot checking still works for both roles, without PII
for (const [role, uid] of [['anon', null], ['authenticated', CUST]]) {
  await asRole(role, uid, async () => {
    const r = await q(`SELECT * FROM get_booked_slots($1, CURRENT_DATE, NULL)`, [SHOP_B]);
    const cols = Object.keys(r.rows[0] ?? {});
    check(`slot check works for ${role}`, r.rows.length === 1, `${r.rows.length} slot(s)`);
    check(`slot check leaks no PII to ${role}`,
          !cols.some((c) => /name|phone|notes|service/.test(c)), cols.join(', '));
  });
}

console.log('\n' + [...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
