# Client-side P0 patches — four broken admin buttons

Every admin Suspend / Activate / Toggle Shop Visibility click has been
silently no-op'd because the api.js methods that TabUsers, TabShops, and
DistributorDashboard call don't exist. The client's try/catch swallows
the resulting `TypeError` and shows "Action failed". Fix in three places.

Apply the changes in this order — the first one adds the missing api.js
method, the next three rewrite the call sites to use the correct names.

---

## 1) `src/lib/api.js`

**Add a new method** (recommended location: right after `suspendUser`
which currently exists around line 4963).

The current `suspendUser` sets status='pending' — that's the pre-approval
state, not suspended. Auth-login blocks status='suspended' explicitly
(api.js:440), so pending users can still log in from the login flow.
That's a separate bug worth fixing but the safer immediate change is to
add a distinct `setUserStatus` that does exactly what the admin UI expects:

```js
  // Explicit status setter for admin actions. suspendUser above sets
  // status='pending' which is semantically different (it re-queues the
  // user for admin approval). Suspended accounts should be status =
  // 'suspended' so the login guard at auth-login/index.ts triggers.
  async setUserStatus(userId, status) {
    if (!['active', 'suspended', 'pending'].includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users').update({ status }).eq('id', userId)
        .select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('User not found or status change not permitted.');
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.status = status; saveDB(db); }
  },
```

---

## 2) `src/pages/admin/TabUsers.jsx` — lines 69-90

Replace both call sites of the non-existent `api.updateUserStatus`.

```diff
   const suspend = async (u) => {
     setBusy(prev => ({ ...prev, [u.id]: true }));
     try {
-      await api.updateUserStatus(u.id, 'suspended');
+      await api.setUserStatus(u.id, 'suspended');
       await api.logAdminAction('suspend_user', u.id, null, null);
       toast.success(`${u.name} suspended`);
       load();
     } catch { toast.error('Action failed'); }
     finally { setBusy(prev => ({ ...prev, [u.id]: false })); }
   };

   const activate = async (u) => {
     setBusy(prev => ({ ...prev, [u.id]: true }));
     try {
-      await api.updateUserStatus(u.id, 'active');
+      await api.setUserStatus(u.id, 'active');
       await api.approveUser(u.id);
       await api.logAdminAction('activate_user', u.id, null, null);
       toast.success(`${u.name} activated`);
       load();
     } catch { toast.error('Action failed'); }
     finally { setBusy(prev => ({ ...prev, [u.id]: false })); }
   };
```

---

## 3) `src/pages/admin/TabShops.jsx` — line 289 and line 369

The `?.` guard on line 388 already fails silently — the real bug is the
unguarded call on line 289 that throws, and the data-source fallback on
line 369 that returns the WRONG data (all shops instead of all users;
empty pending queue).

```diff
                 icon={shop.hideFromSearch ? <Eye size={18} color="#0EA5E9" /> : <EyeOff size={18} color="#64748B" />}
                 title={shop.hideFromSearch ? 'Show in Search' : 'Hide from Search'}
                 desc={shop.hideFromSearch ? 'Make this shop visible in the marketplace' : 'Hide this shop from public search results'}
                 action={shop.hideFromSearch ? 'Show' : 'Hide'} color={shop.hideFromSearch ? '#0EA5E9' : '#64748B'}
-                onClick={() => act(() => api.toggleShopVisibility(shop.id, !shop.hideFromSearch), `Visibility updated`)}
+                onClick={() => act(() => api.setShopVisibility(shop.id, !shop.hideFromSearch), `Visibility updated`)}
                 busy={busy}
               />
```

And around line 369, the load function:

```diff
   const load = useCallback(async () => {
     setLoading(true);
     try {
-      const [all, pend] = await Promise.all([api.getAdminUsers?.() || api.getAllShops(), api.getPendingUsers?.() || []]);
+      const [all, pend] = await Promise.all([api.getAllUsers(), api.getPendingApprovals()]);
       setShops(Array.isArray(all) ? all.filter(u => u.role === 'shop' || u.role === 'distributor') : []);
       setPending(Array.isArray(pend) ? pend : []);
     } catch { toast.error('Failed to load shops'); }
     finally { setLoading(false); }
   }, []);
```

Also line 388 uses the guarded form — clean it up for consistency:

```diff
-  const toggleVis     = s => act(s.id, () => api.toggleShopVisibility?.(s.id, !s.hideFromSearch), `Visibility updated`);
+  const toggleVis     = s => act(s.id, () => api.setShopVisibility(s.id, !s.hideFromSearch), `Visibility updated`);
```

---

## 4) `src/pages/DistributorDashboard.jsx` — line 639

Silently swallowed in `safe()` today; the distributor's own profile row
never populates until useAuth's refresh happens on next mount.

```diff
       safe(() => api.getOwnedDistributorBranches(user.id)),
       safe(() => api.getDistributorApiKeyInfo(user.id)),
       safe(() => api.getActiveDeviceCount(user.id)),
       safe(() => api.getSettings()),
-      safe(() => api.getProfile(user.id)),
+      safe(() => api.getUserById(user.id)),
     ]);
```

---

## Verification after applying

Fastest smoke test after deploying:

1. Log in as admin. Go to Users tab. Click Suspend on a test account,
   then log in as that account — should be blocked with "Account
   suspended" message.
2. Same admin, click Activate — same account should now log in.
3. Go to Shops tab. Toggle a test shop's visibility. Log out and browse
   the customer-facing marketplace — the shop should disappear/reappear.
4. Log in as a distributor. On first dashboard load, check the profile
   card at the top — it should show name / phone / plan correctly
   (previously blank on first mount until refresh).
