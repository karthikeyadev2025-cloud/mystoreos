# MyStoreOS — P1 Fix Bundle
**2026-07-31 · follow-up to P0**

Eight P1 issues from the July 30 audit, deployed on top of the P0
bundle. Estimated apply-time: **~90 minutes** including verification
across the four workflows. No downtime.

## What's in the bundle

```
p1-fixes/
├── README.md                                              ← you are here
├── supabase/
│   ├── migrations/
│   │   └── 20260731_p1_atomic_orders_and_rate_limit.sql   ← atomic RPCs + rate limit
│   └── functions/
│       ├── _shared/paginated-list-users.ts                ← reusable pagination helper
│       ├── add-staff/index.ts                             ← full rewrite (no PIN plaintext, plan cap)
│       └── support-chat/index.ts                          ← full rewrite (auth + rate limit)
└── client-patches/
    ├── src/lib/offlineQueue.js                            ← full rewrite (dead-letter, uuid fallback, resilience)
    └── PATCH_NOTES.md                                     ← smaller diffs: api.js x3, auth-login/register/delete-user
```

## What gets fixed

| # | From audit | Fix |
|---|---|---|
| 12 | `placeOrder` inventory race + silent fail on every sale | `place_order_atomic` RPC — check + decrement + insert in one transaction |
|    | `processReturn` same class | `process_return_atomic` RPC |
| 14 | `add-staff` writes plaintext PIN in `pass_verify`, no plan cap | full rewrite — bcrypt only, server-side cap check, restricted CORS |
| 15 | `listUsers({perPage:1000, page:1})` breaks past 1000 users in 4 fns | shared paginated helper, patched in add-staff / auth-login / auth-register / delete-user |
| 16 | `support-chat` unauthenticated, no rate limit | auth required, `check_rate_limit` RPC-backed (15/hr per user, 30/hr per IP) |
| 17 | Offline queue silent per-op failure — stuck ops retry forever | dead-letter store after 5 retries, per-op error logged |
| 18 | `crypto.randomUUID()` in offline queue no fallback (older Android WebView) | v4-format fallback using `getRandomValues` |
| 19 | Cached `_db` doesn't survive IndexedDB close on mobile background | probe-and-reopen on `InvalidStateError` |
| 7  | Hardcoded admin password + real phone in prod bundle | remove fallback, hard-fail if `VITE_ADMIN_PASS` unset |

## Recommended deploy order

Do the SQL migration BEFORE deploying the client patches, because the
new placeOrder client calls `place_order_atomic` which won't exist
until the migration runs. Reverse order = every checkout errors.

### Step 1 — SQL migration (10 min)

```bash
supabase db push   # or paste into SQL Editor — one BEGIN/COMMIT
```

**Verify:**

```sql
-- place_order_atomic is installed
SELECT proname FROM pg_proc WHERE proname IN ('place_order_atomic','process_return_atomic','check_rate_limit');
-- Expect 3 rows.

-- rate_limit_log has RLS on with zero policies (service-role only)
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'rate_limit_log';
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'rate_limit_log';
-- Expect rowsecurity=t, policy count=0.

-- Dry-run place_order_atomic with an intentional insufficient stock
-- (replace uuids with a real product + shop from your DB)
SELECT public.place_order_atomic(
  '<shop-uuid>'::uuid,
  'walk-in:Test:0000000000',
  '[{"id":"<product-uuid>","qty":99999,"price":1}]'::jsonb,
  99999
);
-- Expect: {"ok":false, "reason":"insufficient_stock", ...}
```

### Step 2 — Edge functions (10 min)

Deploy in this order — the shared helper must exist before the
functions that import it:

```bash
# The _shared folder is a Deno import target, not a function itself.
# Supabase deploys share the folder automatically as long as it's inside
# supabase/functions/. No separate deploy command for _shared.

supabase functions deploy add-staff
supabase functions deploy support-chat

# The listUsers pagination fix in auth-login / auth-register / delete-user
# requires code edits per PATCH_NOTES.md. Do those, then deploy:
supabase functions deploy auth-login
supabase functions deploy auth-register
supabase functions deploy delete-user
```

**Verify support-chat rate limit:**

Log in to a test account. Send 16 messages from the support chat
widget. The 16th should return the rate-limit response instead of a
Gemini reply.

**Verify add-staff plan cap:**

As a Starter shop, hit the add-staff endpoint. Should return 402 with
"Your plan does not include staff accounts."

### Step 3 — Client patches (15 min + build)

Apply the diffs in `client-patches/PATCH_NOTES.md` (four small changes
to `api.js`). Replace `src/lib/offlineQueue.js` with the file from
this bundle.

**Set your env vars before building:**

```bash
# .env.production or Vercel env panel
VITE_ADMIN_PASS=<your real admin password>   # required now, no fallback
```

Then:

```bash
npm run build && vercel --prod
```

**Verify the bundle no longer leaks:**

```bash
grep 'Mystore@karthi' dist/assets/*.js
grep '8885490495' dist/assets/*.js
# Both should return zero matches.
```

### Step 4 — End-to-end smoke tests (30 min)

Run through these in order. The last one is the most important since
placeOrder is the highest-traffic write path.

1. **Register a new test shop** → OTP → onboarding → dashboard loads.
2. **Add a product** → shows in POS.
3. **Sell 5 units of stock=10 product from POS window A**. Before
   clicking "Complete Bill," open POS window B in a different browser,
   log in as the same shop, and add the same product with qty=5.
   Complete both bills. Result should be: both succeed, stock ends
   at exactly 0. Or one succeeds and the other errors — never both
   succeed with stock ending at 5 (the lost-update bug).
4. **Trigger a return** on the bill from step 3. Stock should
   increment by exactly the returned quantity, no more.
5. **Log in as admin** → suspend a test account → try logging in as
   that account → should be blocked. Activate → login works.
6. **Turn off wifi mid-checkout, complete a bill offline**. Reconnect
   after 30s. Bill should sync. Verify with:
   ```js
   import { getPendingCount, getFailedCount } from './lib/offlineQueue';
   console.log('pending:', await getPendingCount());
   console.log('failed:', await getFailedCount());
   ```
   Both should be 0 after a successful sync.

## Rollback plan

### SQL migration

The migration adds three RPCs and one table. Rolling back means:

```sql
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, text, jsonb, numeric, text, text, text, text, uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.process_return_atomic(uuid, jsonb, numeric, text, boolean);
DROP FUNCTION IF EXISTS public.check_rate_limit(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.prune_rate_limit_log();
DROP TABLE IF EXISTS public.rate_limit_log;
NOTIFY pgrst, 'reload schema';
```

But: the client will still try to call `place_order_atomic` on
checkout. So if you're rolling back, roll back the client build
first.

### Client build

Vercel keeps the previous deploy; instant rollback in the dashboard.

### Edge functions

Supabase keeps function versions; redeploy the last-known-good
version from git for any of them.

### If the offline queue rewrite corrupts state

The migration bumped `DB_VERSION` from 1 to 2 to add the
`failed_writes` store. Rolling back to the old queue will trigger a
downgrade error (`onblocked`) since browsers refuse to open an older
version. If you need to roll back the client but keep users unblocked,
add a one-shot delete step first:

```js
// Paste in DevTools console, refresh once:
indexedDB.deleteDatabase('mystore_offline_queue');
```

Users lose pending offline writes but their session is intact. Same
mechanism if any user reports the queue looking stuck after upgrade.

## What's NOT in this bundle

Deferred to P2 (from the audit):

- `products_read_public USING (true)` exposing cost_price to anon (#20)
- `site_config_shop_write` substring match for auth (#21)
- `useAuth` non-destructive merge can't clear DB fields (#22)
- Duplicate object keys in `UserDashboard.jsx` (#23)
- `ShopDashboard.jsx` bundle size (1.12 MB) (#24)
- `CompleteBillModal` double-toast (#25)
- `expire-trials` doesn't handle addon expiry (#27)
- Password strength (#29, #30)

Plus everything in P3 (hardening).

The eight bundled here are the ones that cause active operational
harm — silent inventory drift on every sale, wrong charges to
customers, stuck offline queues, credential leaks in the bundle,
support-chat cost explosions, breakage above 1000 users. Everything
in P2/P3 is quality-of-life or defense-in-depth.
