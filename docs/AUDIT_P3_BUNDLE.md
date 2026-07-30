# MyStoreOS — P3 Hardening Bundle
**2026-08-01**

Defense-in-depth on top of P0 and P1. Not exploitable-today issues —
these are the "if a competitor becomes hostile" or "if a regulator
knocks" scenarios. Estimated apply time: ~60 minutes for code, plus
the operational tasks in `docs/DPDP_COMPLIANCE.md` which are on you.

## What's in the bundle

```
p3-fixes/
├── README.md                                          ← you are here
├── supabase/
│   ├── migrations/
│   │   └── 20260801_p3_hardening_and_compliance.sql   ← PII minimize, audit log, DPDP infra
│   └── functions/
│       └── user-data-export/index.ts                  ← DPDP §11 data-export endpoint
├── client-patches/
│   ├── src/hooks/useRealtimeTable.js                  ← full UUID channel names
│   └── PATCH_NOTES.md                                 ← useAuth heartbeat, export button, consent
└── docs/
    ├── BACKUPS.md                                     ← PITR verification runbook
    └── DPDP_COMPLIANCE.md                             ← what's still on the operator side
```

## What gets fixed

| # | From audit | Fix |
|---|---|---|
| 38 | `get_appointment_by_token` returns full customer row | RPC returns only the 10 fields ManageBooking renders |
| 39 | Realtime channel names 32-bit slice (collision risk at scale) | Full UUID |
| 42 | No audit log on subscription state changes | `subscription_events` table + trigger, exposed via `export_my_data` |
| 46 | DPDP Act compliance gaps (data access, retention, consent) | RPC + edge function + retention cleanup + consent column |
| 47 | Zombie session detection (WebView background revival) | 5-min visibility-aware heartbeat in useAuth |
| — | Backups + BC-DR guidance | `docs/BACKUPS.md` |
| — | Operator compliance checklist | `docs/DPDP_COMPLIANCE.md` |

## What's NOT in the bundle (and why)

From the P3 audit list, three items are already resolved and don't
need work:

- **#35 CSRF protection** — not needed with Bearer tokens (verified,
  Supabase uses Authorization: Bearer, not cookies)
- **#36 Content-Security-Policy** — already present in your
  `vercel.json` and covers the right sources (Razorpay, Firebase,
  Gemini, MSG91). Verified.
- **#40 DB triggers blocking writes** — `notify_fanout_webpush` uses
  `pg_net` (async HTTP). Not a blocker. Verified.
- **#41 CA subquery perf** — the `idx_users_ca_id` index added in the
  P0 bundle covers this. Verified.

Two items surfaced in the code review that are worth flagging even
though they're not in the audit list:

- **Push-fanout secret is `'qwertyuiopasdfghjklzxcvbnm'`** —
  hardcoded in `supabase/migrations/20260707_push_fanout_trigger.sql`.
  A keyboard mash, not a real secret. Rotate it: generate a new
  random string, update the migration file (or run an ad-hoc
  `CREATE OR REPLACE FUNCTION` with the new value), and update the
  `PUSH_FANOUT_SECRET` env var on the `push-fanout` edge function.
  Both have to match.
- **`docker-init.sql` / `supabase_schema.sql` are stale** relative to
  the migrations folder. Whoever bootstraps a fresh environment via
  those files gets a broken schema. Regenerate:
  ```bash
  supabase db dump --schema public > supabase_schema.sql
  ```
  Do this whenever you finish a batch of migrations, not on every
  change (too noisy for git).

## Recommended deploy order

Unlike P0/P1, P3 has no ordering constraint — each fix is independent.
Convenient order:

### Step 1 — SQL migration (5 min)

```bash
supabase db push
```

Verify:

```sql
-- The token RPC returns only 10 columns now
SELECT * FROM public.get_appointment_by_token('00000000-0000-0000-0000-000000000000'::uuid);
-- Expect zero rows (nonexistent token), but no error, and psql shows exactly 10 output columns.

-- Subscription audit table exists
SELECT COUNT(*) FROM public.subscription_events;

-- Data export RPC exists
SELECT proname FROM pg_proc WHERE proname IN ('export_my_data', 'enforce_retention_policy', 'log_subscription_change');
-- Expect 3 rows.

-- Consent column exists
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'users' AND column_name = 'privacy_consent_v1_at';
```

### Step 2 — Edge function (2 min)

```bash
supabase functions deploy user-data-export
```

Test: while logged in, run in DevTools:
```js
const { data: sess } = await supabase.auth.getSession();
const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-data-export`, {
  headers: { Authorization: `Bearer ${sess.session.access_token}` },
});
console.log(await res.text());
```
Should return a JSON blob with your profile, orders, products, etc.

### Step 3 — Client patches (15 min + build)

Replace `src/hooks/useRealtimeTable.js`. Add the useAuth heartbeat and
the "Download my data" button per `client-patches/PATCH_NOTES.md`.

### Step 4 — Schedule retention cleanup

In Supabase Dashboard → Database → Cron Jobs (via pg_cron), add:

```sql
SELECT cron.schedule(
  'daily-retention-cleanup',
  '0 3 * * *',   -- 3 AM UTC daily = 8:30 AM IST
  $$SELECT public.enforce_retention_policy();$$
);
```

Or if you prefer an external scheduler, hit the RPC via the REST API
from any cron service.

### Step 5 — Operator tasks

Work through the checklist in `docs/DPDP_COMPLIANCE.md`. The Privacy
Policy page + DPO email are the two operational tasks that need to
happen before the next regulatory audit — everything else is
supportive.

## Rollback plan

Same as P0/P1 — each piece is independently reversible.

### SQL migration

```sql
DROP TRIGGER IF EXISTS trg_log_subscription_change ON public.users;
DROP FUNCTION IF EXISTS public.log_subscription_change();
DROP FUNCTION IF EXISTS public.enforce_retention_policy();
DROP FUNCTION IF EXISTS public.export_my_data();
DROP TABLE IF EXISTS public.subscription_events;
ALTER TABLE public.users DROP COLUMN IF EXISTS privacy_consent_v1_at;

-- Restore the original get_appointment_by_token (returns full row):
CREATE OR REPLACE FUNCTION public.get_appointment_by_token(p_token uuid)
RETURNS SETOF public.appointments
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.appointments WHERE manage_token = p_token;
$$;
```

The token RPC rollback restores the current PII-leaky behaviour;
don't do it unless something specifically broke that depends on the
extra fields. If ManageBooking is happy and no other consumer of the
RPC exists (grep'd the codebase — none found), no rollback needed.

### Edge function + client patches

Standard Vercel + Supabase deploy history rollback.

## Where you are after all three bundles

**Fixed:**

- All 7 P0 issues (live-fire security)
- All 8 P1 issues bundled (data integrity, silent failures, quota abuse)
- 5 P3 issues (hardening, compliance)
- Plus 2 items surfaced during code review that weren't in the original
  audit list

**Still worth addressing when you have time (P2 from the audit):**

- `products_read_public USING (true)` exposing cost_price to anon
- `site_config_shop_write` substring match for auth
- `useAuth` non-destructive merge can't clear DB fields
- Duplicate object keys in `UserDashboard.jsx`
- `ShopDashboard.jsx` bundle size (1.12 MB)
- `CompleteBillModal` double-toast
- Password strength enforcement
- Dead tables cleanup

P2 items are quality-of-life bugs — they'll cost you support tickets
and slow you down, but they won't cost you customers or fines.

You're materially safer than you were 24 hours ago. Good work.
