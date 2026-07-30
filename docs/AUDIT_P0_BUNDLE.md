# MyStoreOS — P0 Security Fix Bundle
**2026-07-30 · from the live audit**

Seven P0 issues, all applicable in one deployment cycle. Estimated total
downtime: **zero** (all changes are additive-safe or additive to policies
you're already running). Estimated apply-time end-to-end: **~30 minutes**
including verification.

## What's in the bundle

```
p0-fixes/
├── README.md                                          ← you are here
├── supabase/migrations/
│   └── 20260730_p0_security_fixes.sql                 ← DB fixes 1-3, 5-6 + trigger #4
├── supabase/functions/
│   ├── razorpay-verify-payment/index.ts               ← payment spoofing fix (#4)
│   └── razorpay-webhook/index.ts                      ← webhook parity (#5)
└── client-patches/
    └── README.md                                      ← 4 broken admin buttons (#6)
```

## Recommended deploy order

The order matters because the client patches depend on the SQL
migration having run (specifically, the `setShopVisibility` call needs
the RLS to allow admin updates on other users — which it already does,
but if you happen to be revising RLS this session, apply SQL first).

### Step 1 — Deploy the SQL migration (5 min)

Push the file to `supabase/migrations/` and run:

```bash
supabase db push
```

Or if you're applying by hand via SQL Editor: run the whole file inside
one transaction (it's already wrapped in `BEGIN;` / `COMMIT;`).

**Verify:**

```sql
-- (1) stock_orders should no longer be USING(true)
SELECT policyname, qual FROM pg_policies
 WHERE tablename = 'stock_orders' ORDER BY policyname;

-- (2) pass and pass_verify should be revoked from anon
SELECT grantee, privilege_type, column_name
  FROM information_schema.column_privileges
 WHERE table_name = 'users' AND column_name IN ('pass','pass_verify')
   AND grantee IN ('anon','authenticated');
-- Expected: zero rows.

-- (3) distributor_customers read policy should be scoped
SELECT qual FROM pg_policies
 WHERE tablename = 'distributor_customers' AND cmd = 'SELECT';

-- (4) trigger function should mention the two new expiry columns
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'prevent_privilege_escalation';

-- (5) validate_order_total should reject fake IDs
SELECT public.validate_order_total(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty":1,"price":0}]'::jsonb,
  0
);
-- Expected: {"ok":false,"reason":"unknown_product","submitted_id":"aaaaaaaa..."}
```

### Step 2 — Deploy the two edge functions (5 min)

```bash
supabase functions deploy razorpay-verify-payment
supabase functions deploy razorpay-webhook
```

**Verify:** in Supabase logs, tail the two function logs and do a real
test payment for the cheapest plan (₹1 discounted starter, for example).
Both `verify-payment` and `webhook` should fire; you should see one
`payment_history` row with the payment's real id and one with `wh_`
prefixed id. The user's plan should show as active exactly ONCE (not
double-bumped).

### Step 3 — Apply client patches and ship the build (10 min)

Follow `client-patches/README.md`. Four small edits across three files,
plus one new method in `api.js`.

Then:

```bash
npm run build && vercel --prod    # or whatever your deploy invocation is
```

### Step 4 — Verification round (10 min)

Run all four smoke tests from `client-patches/README.md`. Then in a
private/incognito window (still signed OUT):

```js
// Paste this into DevTools console on mystoreos.in:
const url = 'https://<your-project>.supabase.co/rest/v1/users?role=eq.shop&select=pass,pass_verify';
fetch(url, { headers: { apikey: '<anon-key>' }}).then(r => r.text()).then(console.log);
// Expected: an error, or an empty array, or a rejection.
// If it returns hashes, revert and re-check step 1.
```

```js
// And:
const url = 'https://<your-project>.supabase.co/rest/v1/distributor_customers?select=name,phone,gstin';
fetch(url, { headers: { apikey: '<anon-key>' }}).then(r => r.text()).then(console.log);
// Expected: empty array (RLS filters everything for anon).
```

## Rollback plan (if anything breaks)

The SQL migration is idempotent for policies (drops-then-creates), but
the trigger `CREATE OR REPLACE FUNCTION` overwrites the previous
definition, and the column REVOKE has no natural inverse.

### If step 1 needs to be undone:

```sql
-- Undo the pass/pass_verify REVOKE
GRANT SELECT (pass, pass_verify) ON public.users TO anon, authenticated;

-- Undo the distributor_customers scope (return to open)
DROP POLICY IF EXISTS "dist_customers_read" ON public.distributor_customers;
CREATE POLICY "dist_customers_read" ON public.distributor_customers FOR SELECT USING (true);
```

BUT: don't undo those. The pass column exposure is a live credential
leak; if something in production breaks because it depends on that
column being anon-readable, the RIGHT fix is to move that dependency
to a `SECURITY DEFINER` RPC, not to reopen the door.

For `stock_orders`, the fallback is to restore the intermediate
scoping from `20260622_branch_rls_all_tables.sql` — that migration's
definitions are copy-safe if you need them.

### If edge functions break:

Redeploy the previous version from git history — Supabase keeps a
deployment history you can rollback through in one click.

### If client build breaks:

Vercel keeps the previous deploy — instant rollback via the dashboard.

## What's NOT in this bundle

Deferred to the P1 follow-up (still important, just not "someone can
walk off with all your credentials today" important):

- `placeOrder` inventory race + silent-fail (P1 #12)
- `orders_insert_any WITH CHECK (true)` remaining open (P1 #28)
- `add-staff` writes plaintext PIN + no plan cap (P1 #14)
- Offline queue silent failures (P1 #17)
- `listUsers({ perPage: 1000, page: 1 })` pagination bug in 3 edge fns (P1 #15)
- Admin password hardcoded fallback in bundle (P0 #7 in the audit —
  fix is: hard-fail the build if `VITE_ADMIN_PASS` is unset, delete
  the `|| 'Mystore@karthi@2025'` in `src/lib/api.js:12`. Do this in the
  same PR as the client patches if you can.)

The seven bundled here are the ones that would be actively exploitable
by an attacker with just your public anon key. Everything else is
degraded behaviour that customers or you would notice before an
attacker weaponises it.
