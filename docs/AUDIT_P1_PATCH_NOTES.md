# P1 code changes — apply as diffs

Two full-file replacements ship in this bundle (`add-staff/index.ts`,
`support-chat/index.ts`, `offlineQueue.js`, `_shared/paginated-list-users.ts`).
This document covers the four smaller changes that are cleaner as
targeted edits than as full replacements.

---

## 1) `src/lib/api.js` — remove hardcoded admin password fallback

**File:** `src/lib/api.js`, line 12.

The bundled fallback `'Mystore@karthi@2025'` gets baked into every
production build when `VITE_ADMIN_PASS` isn't set at build time.
Verified in the current `dist/` — `grep Mystore@karthi` finds it in
`TabCMS-*.js` and `dashboard-admin-*.js`. Same for phone `8885490495`.

Change:

```diff
-const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'Mystore@karthi@2025';
+const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS;
+if (!ADMIN_PASS && import.meta.env.PROD) {
+  throw new Error('VITE_ADMIN_PASS is required in production builds');
+}
```

Also in the same file, `mockDB.users[0].phone` is your real phone
`8885490495` (lines 34 and 82). The mock DB is only used when Supabase
is unconfigured — never in prod — but the string is still shipped in
the bundle regardless of tree-shaking. Rotate to a placeholder:

```diff
-    { id: 'admin', phone: '8885490495', pass: ADMIN_PASS, role: 'admin', name: 'Super Admin', status: 'active' },
+    { id: 'admin', phone: '0000000000', pass: ADMIN_PASS, role: 'admin', name: 'Super Admin', status: 'active' },
```

And the check on line 80:

```diff
-          const hasAdmin = db.users.some(u => u.phone === '8885490495');
+          const hasAdmin = db.users.some(u => u.id === 'admin');
```

Also line 82 (matching insert):

```diff
-          db.users.push({ id: 'admin', phone: '8885490495', pass: ADMIN_PASS, role: 'admin', name: 'Super Admin', status: 'active' });
+          db.users.push({ id: 'admin', phone: '0000000000', pass: ADMIN_PASS, role: 'admin', name: 'Super Admin', status: 'active' });
```

And line 4411 — the DEMO_PHONES set that includes it as a test-account
filter. Drop your real number and use a demo prefix:

```diff
-    const DEMO_PHONES = new Set(['8885490495', '9876543210', '9000000000', '9999999999', '8888888888', '7777777777', '1111111111']);
+    const DEMO_PHONES = new Set(['9876543210', '9000000000', '9999999999', '8888888888', '7777777777', '1111111111']);
```

You'll need to set `VITE_ADMIN_PASS` in your Vercel env vars before the
next production build, or the build will hard-fail (which is the point).

---

## 2) `src/lib/api.js` — route placeOrder through the atomic RPC

**File:** `src/lib/api.js`, replace lines 1666-1690 (the stock-decrement
loop inside `async placeOrder`).

Current code — read-then-write per item with a swallow catch:

```js
      // Decrement product inventory stock levels in Supabase
      if (items && Array.isArray(items)) {
        for (const item of items) {
          try {
            const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.id).maybeSingle();
            if (prodData) {
              const currentStock = parseInt(prodData.stock) || 0;
              const newStock = Math.max(0, currentStock - (parseInt(item.qty) || 1));
              await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
            }
          } catch (err) {
            console.error("Failed to update stock in Supabase for item:", item.id, err);
          }
        }
      }
      
      return toOrder(data);
```

Replace the whole loop with a call to the atomic RPC, and route the
INSERT through the RPC too by moving it BEFORE this block. New shape:

```js
      // Server-side atomic path — one transaction: price check, stock
      // decrement per item using UPDATE ... WHERE stock >= qty
      // RETURNING, and order insert. Failures roll back both the row
      // and every stock change. Replaces the previous read-then-write
      // loop with a swallow-catch (which silently drifted inventory on
      // any RLS/network hiccup and lost updates on concurrent bills).
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('place_order_atomic', {
        p_shop_id: resolvedId,
        p_user_id: userId,
        p_items: items,
        p_total: total,
        p_customer_phone: normalizedPhone,
        p_customer_gstin: customerData.gstin || null,
        p_customer_address: customerData.address || null,
        p_customer_state_code: customerData.stateCode || null,
        p_customer_id: matchedCustomerId,
        p_payment_method: paymentMethod || 'Cash',
        p_status: status,
        p_invoice_no: invoiceNo,
      });

      if (rpcErr) throw new Error(rpcErr.message);

      if (!rpcRes?.ok) {
        // Rejected server-side. Turn the reason code into a human message.
        if (rpcRes?.reason === 'price_mismatch') {
          throw new Error(
            `Prices have changed since you added these items (this shop now totals ₹${rpcRes.detail?.expected}). Please refresh and try again.`
          );
        }
        if (rpcRes?.reason === 'insufficient_stock') {
          throw new Error(`One or more items are out of stock — please refresh your cart.`);
        }
        if (rpcRes?.reason === 'unknown_product') {
          throw new Error(`One of the items is no longer available in this shop's catalogue.`);
        }
        if (rpcRes?.reason === 'not_your_order') {
          throw new Error('You cannot place an order on behalf of another user.');
        }
        throw new Error(rpcRes?.message || 'Order could not be placed. Please try again.');
      }

      // Load the inserted row so toOrder() gets the same shape as before.
      // The RPC returns just the id + confirmation; the client still
      // wants the full row for subsequent operations.
      const { data: fullOrder } = await supabase
        .from('orders').select('*').eq('id', rpcRes.order_id).maybeSingle();

      return toOrder(fullOrder || { id: rpcRes.order_id, ...insertObj, created_at: new Date().toISOString() });
```

Note: this replaces BOTH the old stock decrement loop AND the earlier
direct `supabase.from('orders').insert(attempt)` block. Delete both.
Also delete the `validate_order_total` best-effort call earlier in the
function (lines 1568-1591) — the RPC now handles that inline, so the
double round-trip goes away.

The self-heal-around-missing-columns retry loop (lines 1660-1668) can
also be deleted; the RPC doesn't depend on client-side column
knowledge and won't hit that error.

---

## 3) `src/lib/api.js` — route processReturn through the atomic RPC

**File:** `src/lib/api.js`, lines 1787-1830 (the `processReturn` body).

Replace the whole Supabase branch — from `if (isSupabaseConfigured) {`
down to the closing `return { refundAmount, isFullReturn };` — with:

```js
    if (isSupabaseConfigured) {
      // Look up existing order to compute isFullReturn
      const { data: orderRow } = await supabase.from('orders')
        .select('items').eq('id', orderId).maybeSingle();
      const originalQtyTotal = (orderRow?.items || []).reduce((s, it) => s + (Number(it.qty) || 1), 0);
      const returnedQtyTotal = (returnItems || []).reduce((s, it) => s + (Number(it.returnQty) || 0), 0);
      const isFullReturn = returnedQtyTotal >= originalQtyTotal;

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('process_return_atomic', {
        p_order_id: orderId,
        p_return_items: returnItems,
        p_refund_amount: refundAmount,
        p_refund_mode: refundMode,
        p_is_full_return: isFullReturn,
      });

      if (rpcErr) throw new Error(rpcErr.message);

      if (!rpcRes?.ok) {
        if (rpcRes?.reason === 'order_not_found') {
          throw new Error('Order not found.');
        }
        if (rpcRes?.reason === 'not_your_shop') {
          throw new Error('You do not have permission to process this return.');
        }
        throw new Error(rpcRes?.message || 'Return could not be processed.');
      }

      return { refundAmount, isFullReturn };
    }
```

Delete the old read-then-write stock loop and the fire-and-forget
order update — the RPC handles both atomically.

---

## 4) Edge functions using `listUsers({ perPage: 1000, page: 1 })`

Three edge functions have the same pagination bug: they take the first
page of 1000 users and search that array with `.find()`. Above ~1000
accounts, the target is invisibly absent.

Replace with `findAuthUserByEmail` from `_shared/paginated-list-users.ts`.

### `supabase/functions/auth-login/index.ts`

Import at the top:

```typescript
import { findAuthUserByEmail } from '../_shared/paginated-list-users.ts';
```

Find the block near "User already registered but with different
password — find and update" (around line 167). Replace:

```typescript
        const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
        existing = users?.find((u) => u.email === email) || null;
```

with:

```typescript
        existing = await findAuthUserByEmail(admin, email);
```

### `supabase/functions/auth-register/index.ts`

Import and replace the block (around line 55) similarly:

```typescript
import { findAuthUserByEmail } from '../_shared/paginated-list-users.ts';
```

Then:

```diff
-        const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
-        if (listErr) return json({ error: `Auth listing failed: ${listErr.message}` }, 500, req);
-        const existingAuth = users?.find(u => u.email === email);
+        const existingAuth = await findAuthUserByEmail(admin, email);
         if (!existingAuth) return json({ error: 'Auth user conflict, please contact support.' }, 500, req);
         uid = existingAuth.id;
```

### `supabase/functions/delete-user/index.ts`

Same pattern. Import:

```typescript
import { findAuthUserByEmail } from '../_shared/paginated-list-users.ts';
```

Replace the fallback block (around line 71):

```diff
     if (!authDeleted && target?.phone) {
       const email = `${target.phone}@mystore.internal`;
-      const { data: list } = await admin.auth.admin.listUsers();
-      const match = list?.users?.find((u) => u.email === email);
+      const match = await findAuthUserByEmail(admin, email);
       if (match) {
         await admin.auth.admin.deleteUser(match.id).catch(() => {});
       }
     }
```

Deploy all three functions after changing them.

---

## Verification after applying

**placeOrder atomic:**

Two side-by-side POS windows on the same shop. Load the same product
with stock=10 into carts. Complete both bills within a second of each
other. Before: both bills succeed and stock ends at 9. After: one
succeeds, one errors with "One or more items are out of stock" (or
completes fine if there was enough headroom).

**processReturn atomic:**

Return a bill. Check the product stock: it should go up by exactly the
returned quantity, no more, no less. Concurrent returns of the same
product from different admin sessions should each increment
correctly (previously could lose one).

**add-staff plan cap:**

Log in as a Starter shop. Try adding a staff account. Before: worked
because the client-side cap was the only check. After: 402 error
"Your plan does not include staff accounts."

**support-chat rate limit:**

Log in as any user. Send 16 support chat messages in a row within an
hour. The 16th returns "You've reached the support chat limit for this
hour."

**offline queue dead-letter:**

Turn off wifi mid-checkout with an intentionally malformed order
(e.g. a `total` field set to `"nope"`). The op enqueues. Reconnect.
Watch the sync — after 5 retries, the op should move to
`failed_writes` and stop appearing in the pending count. Inspect via:

```js
import { getFailedWrites } from './lib/offlineQueue';
console.log(await getFailedWrites());
```

**Pagination fix (for auth-login/register/delete-user):**

Hard to verify without >1000 accounts. Instead, drop a `console.log`
inside `findAuthUserByEmail` that logs each page number, then trigger
the flow that hits the fallback path and confirm you see page 1
(and only page 1) for a small user base — pagination is used but
short-circuits on the first page.
