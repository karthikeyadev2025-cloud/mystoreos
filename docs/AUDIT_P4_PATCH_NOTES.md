# Audit P4 — Field distribution RPC authorization

**Date:** 2026-08-21
**Migration:** `supabase/migrations/20260821_p4_field_rpc_authorization.sql`
**Tests:** `tests/db/p4-authorization.test.mjs`, `tests/db/p4-injection.test.mjs` (`npm run test:db`)
**Scope:** field phases 1–5, direct sale, purchases, van receive, admin PIN

---

## Why this pass exists

P0/P1/P3 hardened the shop and billing surface. The field-distribution work
(phases 1–5), `distributor_direct_sale`, `purchases_suppliers` and
`receive_van_invoice` all landed *after* those passes and never got the same
review. This audit covers that gap.

The RLS is not the problem. Every field table is scoped correctly through
`acting_distributor_id()`, with child tables scoped through their parent. That
part was done well.

The gap is one level up: **`SECURITY DEFINER` bypasses RLS by design.** Fourteen
client-callable RPCs run as definer and none of them checked who was calling.
The policies were never consulted on these paths.

---

## Findings

All fourteen are reachable from any authenticated session via
`supabase.rpc(...)`. Two shapes:

### 1. Tenant id taken from the caller and trusted

| Function | Effect if abused |
|---|---|
| `supplier_balances` | Reads any distributor's full payables ledger — every supplier, amount outstanding, last bill date |
| `create_direct_sale` | Writes a sale into another tenant |
| `record_purchase` | Writes a purchase into another tenant's ledger |
| `create_field_vehicle` | Creates a vehicle in another tenant |
| `open_day_settlement` | Opens a settlement in another tenant |
| `sync_van_invoice` / `sync_van_return` | Writes van documents into another tenant |
| `post_stock_order_to_credit` | Posts credit against another tenant |

`supplier_balances` is the sharpest read: one call with someone else's
`distributor_id` returns their entire supplier position.

### 2. Row id taken from the caller, ownership never checked

| Function | Effect if abused |
|---|---|
| `apply_stock_transfer` | Commits a stock movement between another distributor's warehouses |
| `convert_field_order` | Converts another tenant's field order |
| `close_day_settlement` | Closes another tenant's day settlement |
| `get_van_series_position` | Reads a competitor's invoice counter — a direct read on their sales volume |
| `receive_van_invoice` | Writes stock into a shop's inventory |
| `receive_stock_order` | Writes stock into a shop's inventory |

**A uuid is not an authorization control.** Ids leak through exports, shared
links, support threads, and most realistically here through staff who
legitimately held them and later left, or a shop linked to more than one
distributor.

### 3. `verify_admin_pin`

Flagged in its own `COMMENT` when it was written, not yet acted on:

- granted to `anon` — callable with no session at all
- no rate limit — a 4-digit PIN is ~10k guesses against any `shop_id`
- PIN stored in plaintext in `users.pass`

---

## What changed

Two guard helpers, then applied throughout:

- `assert_acting_distributor(uuid)` — raises `42501` unless the caller is an
  admin or the id matches their session (own id for a distributor, `staff_of`
  for their staff)
- `assert_owns_shop(uuid)` — raises `42501` unless `owns_shop()` accepts it

The `p_distributor_id` / `p_shop_id` parameters are **kept**, so no client call
site changes. They are now verified against the session rather than believed.
Correct traffic is unaffected.

`verify_admin_pin`: `anon` grant revoked, rate limited to 10 attempts per 5
minutes per `shop_id` via the existing `check_rate_limit()` from P1.

### On the injection approach

Sections 4–6 read each function's deployed definition from `pg_proc`, splice the
guard in after the body's opening `BEGIN`, and replace it. Restating those
bodies in this migration would risk drifting from what is actually in
production, since several were amended by later migrations.

Insertion is by **line**, not regex. A regex was tried first and was wrong in a
way worth recording:

> In Postgres' POSIX engine, the greediness of the whole pattern is set by its
> **first** quantifier. A leading greedy `[a-zA-Z_]*` (matching the dollar-quote
> tag) overrode the `.*?` that followed, so the pattern matched the **last**
> `BEGIN` in the body. In `record_purchase` that is the `BEGIN` of a nested
> block with an `EXCEPTION WHEN OTHERS` handler — the guard was injected inside
> a block that swallows the very exception it raises.

It read as installed and enforced nothing. A "is the guard present?" check
passed. Only executing the attack caught it. `tests/db/p4-injection.test.mjs`
now asserts the guard lands before the handler.

If a function has no standalone `BEGIN` line it is **skipped with a warning**
rather than guessed at. Check the migration output for `P4: could not guard`.

---

## Verification

Run against a real Postgres 18 (PGlite), not reasoned about on paper:

```
npm run test:db
```

`p4-authorization.test.mjs` (17 assertions) sets up two distributors and:

1. proves each attack **succeeds** against the current code — A moves B's stock
   500 → 200, reads B's payables, writes into B's ledger, reads B's invoice
   counter
2. applies the guards
3. proves every attack is now rejected, and B's data is untouched
4. proves owner, staff-via-`staff_of`, and admin access all still work

`p4-injection.test.mjs` (17 assertions) runs the migration's own DO-blocks
against functions shaped like the real ones (nested `BEGIN`, `EXCEPTION`
handlers, `DEFAULT` params, `$tag$` delimiters) and checks placement,
enforcement, and idempotency on re-run.

Both: **34 passed, 0 failed.** `npm run build` and `npx eslint .` unchanged
(0 errors, 36 pre-existing warnings).

---

## Deploying

`CREATE OR REPLACE` throughout; existing grants preserved. No data migration, no
downtime. Watch the migration output for `P4: could not guard` warnings.

Rollback is the previous definitions — but note that rolling back restores the
cross-tenant access described above.

---

## Outstanding

1. **`users.pass` is still plaintext.** Hashing it has to be coordinated across
   login, reset and the PIN path, and doing it inside a security patch would
   make this migration much harder to review and roll back. It needs its own
   change.
2. **Edge Functions not covered.** This pass is database-side only. The 21
   Supabase Edge Functions — particularly `distributor-api` and the three
   Razorpay handlers — need the same "does the caller own this?" review.
3. **No negative tests in the Playwright suite.** The DB tests above cover these
   paths; the app-level suite still only tests the happy path.
4. **Remaining unguarded definers.** `dispatch_stock_orders`,
   `get_distributor_public_profile` and `enforce_retention_policy` were seen but
   not in scope here. `get_distributor_public_profile` is likely intentional
   (public catalog) — worth confirming it exposes only public fields.
