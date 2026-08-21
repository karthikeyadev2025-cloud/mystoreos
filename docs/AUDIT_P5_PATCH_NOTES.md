# Audit P5 — Payments, Edge Functions, RLS coverage

**Date:** 2026-08-21
**Scope:** the 21 Supabase Edge Functions and schema-wide RLS coverage — the two things P4 explicitly left out.

---

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Monthly plans never price-validated — any tier for ₹1 | **Critical** | Fixed |
| 2 | Price checks fail *open* on config error | **High** | Fixed |
| 3 | `credit_reminder_log` has no RLS — only table in the schema | **High** | Fixed |
| 4 | Webhook signature compared non-constant-time | Low | Fixed |
| 5 | `distributor-api` has no rate limit | Low | Noted |

Much of the Edge Function code is genuinely well built. `distributor-api`
hashes its keys and scopes every query by `distributor_id`.
`auth-otp-login` verifies the Firebase token's signature, issuer,
audience and expiry server-side and cross-checks the verified phone
against the requested one. `razorpay-verify-payment` treats the client's
`planId` and `userId` as untrusted hints and re-fetches the order from
Razorpay. The findings below are gaps in otherwise careful work.

---

## 1. Monthly plans were never price-validated (critical)

`razorpay-create-order` recomputed the price server-side like this:

```js
const m = planId.match(/^(starter|pro|...)_(quarterly|yearly)$/);
if (m) { /* recompute from pricing_v2 */ }
// no else — chargeAmount stays as the client sent it
```

A monthly plan id — `pro`, `starter`, `enterprise` — does not match that
pattern. Nine tiers, all unvalidated on the monthly cycle, which is the
default and the most common purchase.

**The chain:**

1. `POST razorpay-create-order` with `{planId: 'pro', amount: 1}`
2. A real Razorpay order is created for ₹1, `notes: {planId: 'pro', userId: <you>}`
3. Pay the ₹1 — legitimately, no tampering
4. `razorpay-verify-payment` verifies the HMAC ✓, refuses to trust the
   client's `planId` ✓, re-fetches the order from Razorpay's API ✓, and
   reads back `planId: 'pro'` — because that is what the order was
   created with
5. Full Pro month activated. ₹999 plan, ₹1 paid.

verify-payment's hardening was never the weak point. The tamper happened
one step earlier, and every subsequent check faithfully confirmed the
tampered order against itself. **Amount was never compared to price
anywhere in the flow.**

Why it went unnoticed: the quarterly and yearly paths *were* validated,
so the code reads as though pricing is handled.

## 2. The price check failed open (high)

```js
} catch (_e) { /* fall back to client amount */ }
```

A `site_config` read that errored, or a `pricing_v2` row missing that
tier (`base > 0` false), reverted to trusting the client — on the
discounted plans too. A price check that falls back to the client's
number on error is not a price check.

### Fix for 1 and 2

New `supabase/functions/_shared/pricing.ts`:

- `resolvePrice()` covers **every** plan id — monthly, quarterly, yearly,
  add-on. No cycle is special and none is skipped, so a new plan shape
  can't fall into an unvalidated branch the way monthly did.
- **Fails closed.** Authority order is admin `pricing_v2`, then the
  catalogue floor mirroring `planCatalogue.js`. If neither yields a
  usable number it throws and the order is refused. It never reaches for
  the client's amount.
- The client's `amount` is now a display hint only. A mismatch over ₹1 is
  logged, not rejected — a stale price in an open tab is an ordinary race.

`verify-payment` gets an independent second gate: resolve the price, and
refuse activation if the captured amount falls short (₹1 tolerance for
rounding; overpayment passes, since refusing to activate a plan someone
paid *more* for turns an edge case into a support ticket). Underpayments
are written to `payment_history` as `rejected_underpaid` rather than
dropped, so a genuine pricing bug is visible instead of looking like
customers who paid and got nothing.

Both gates exist because they fail differently: create-order can be
redeployed, rolled back, or bypassed entirely by an order minted through
Razorpay's own dashboard with arbitrary notes. A valid signature proves a
payment happened — it says nothing about whether the amount was right.

**Tests:** `tests/db/pricing.test.mjs`, 21 assertions. Proves the ₹1
exploit works against the old logic for all nine tiers, that
quarterly/yearly were protected (hence the blind spot), that the old code
failed open, and that the new resolver prices every plan, fails closed,
rejects unknown ids, and still honours promotional offers.

---

## 3. `credit_reminder_log` had no RLS (high)

46 of 47 tables have RLS enabled. This one, added in
`20260718_credit_payment_reminders.sql`, never got the `ALTER TABLE`.
With RLS off it is readable and writable by anyone holding the anon key —
which ships in the client bundle.

**Read:** `(credit_id, sent_at)` across every tenant reveals which shops
are behind on payment and how often they are being chased — a
competitor's collections list. It also hands out `credit_id` values,
which is exactly the ingredient the P4 row-scoped RPCs needed.

**Write:** worse and easier to miss. `send-payment-reminders` uses this
table for idempotency. Delete the rows and every overdue customer gets
messaged again next run; repeat for an unbounded WhatsApp/SMS send at the
operator's expense, aimed at their own customers. Insert fabricated rows
and reminders silently stop.

**Fix:** `20260821_p5_credit_reminder_log_rls.sql` enables RLS with a
single SELECT policy scoped through the parent credit. No write policies
— the only writer is the service-role Edge Function, which bypasses RLS.
The migration also sweeps `pg_class` for any other table without RLS and
warns, so the next one is caught at migration time.

---

## 4. Webhook signature comparison was not constant-time (low)

`expectedSig !== signature` short-circuits at the first differing
character, leaking through response time how many leading hex digits were
correct. Remote timing attacks are noisy and hard, but the endpoint is
public, unauthenticated, and grants subscriptions. Replaced with a
branch-free compare.

---

## 5. `distributor-api` has no rate limit (noted, not fixed)

Keys are `msk_live_` + random, SHA-256 hashed, so brute force isn't
realistic. But there's no throttle on request volume, and each call hits
the database with a service-role client. Worth a limit before Enterprise
volume grows. Not fixed here — it needs a decision about per-key quotas
that is a product question, not a security patch.

---

## Verification

```
npm run test:db      # 17 + 17 + 21
npm run test:theme   # 11
npm run build
npx eslint .
```

All green. Lint unchanged (0 errors, 36 pre-existing warnings).

**The Edge Function changes are NOT covered by an integration test.**
`pricing.test.mjs` tests a mirror of the resolver logic, not the deployed
TypeScript — Node can't load Deno modules with remote esm.sh imports. If
the mirror and `_shared/pricing.ts` drift, the test passes while the real
function is wrong. Keep them in step, and put a real ₹1 order through
Razorpay test mode against a deployed staging function before trusting
this in production.

---

## Still outstanding

1. **`users.pass` is plaintext** (from P4). Needs its own coordinated
   migration across login, reset and the PIN path.
2. **No staging run of P4 or P5.** Both migrations rewrite or alter live
   objects. Run them against staging and diff first.
3. **Remaining Edge Functions unreviewed in depth:** `add-staff`,
   `delete-user`, `update-staff`, `support-chat`, `user-data-export`.
   `user-data-export` is worth a look — it's a data-egress path.
4. **`distributor-api` rate limiting** (finding 5).
5. **No browser pass on the theme rebrand.**
