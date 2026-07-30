# P3 client-side changes

Two small changes in this bundle. The full-file replacement for
`useRealtimeTable.js` is in `src/hooks/useRealtimeTable.js` — the file
below covers the session-heartbeat additions to `useAuth`, plus the
recommended UI wiring for the new DPDP data-export flow.

---

## 1) `src/hooks/useAuth.jsx` — session-consistency heartbeat

The current `useAuth` handles auth restoration cleanly (localStorage
session, Supabase `onAuthStateChange` listener). It doesn't have a
mechanism for detecting the case where localStorage still holds a
session but Supabase's own token has expired or been revoked —
"zombie session." Users report seeing their name in the top-right,
then every subsequent action returns 401.

Add a lightweight periodic check that pings a cheap authenticated
endpoint and clears the local session if it fails with 401. Fits in
one new `useEffect` inside `AuthProvider`.

Add near the existing effects (after the localStorage restore, before
the return):

```jsx
  // Session-consistency heartbeat. Every 5 minutes while the app is
  // visible, do a cheap authenticated round-trip. If the auth check
  // reports the session is missing/expired but our localStorage still
  // holds one, clear the local copy so the UI doesn't keep pretending
  // the user is signed in.
  //
  // Not aggressive enough to be a rate-limit concern (12/hour maximum
  // per client), and it only runs while the tab is visible so a
  // backgrounded phone doesn't burn traffic on this.
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error || !data?.session) {
          // Supabase says no session, but we still have one locally.
          // Clear the local copy. Do NOT flip _explicitLogout — this
          // isn't a user-initiated logout, and we want the next auth
          // event to be able to restore normally if the user re-signs.
          try { localStorage.removeItem('mystore_session'); } catch {}
          setUser(null);
        }
      } catch { /* network blip — try again next tick */ }
    };

    // Fire once soon after mount (catches the "opened a stale tab from
    // yesterday" case), then every 5 minutes.
    const initial = setTimeout(check, 5_000);
    const interval = setInterval(check, 5 * 60_000);

    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval); };
  }, [user?.id]);
```

You'll need to import `supabase` at the top of the file if it's not
already there:

```jsx
import { supabase, isSupabaseConfigured } from '../lib/supabase';
```

---

## 2) Wiring the DPDP data-export button

Add a "Download my data" button somewhere in Settings (either the shop
settings tab or a new "Privacy" subsection). It calls the new
`user-data-export` edge function and triggers a download.

Recommended location: `src/components/DesktopSettings.jsx` in whatever
section currently holds the "Delete my account" action, or a new
"Privacy & Data" panel.

```jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';

// … inside the settings component:

const [exporting, setExporting] = useState(false);

const downloadMyData = async () => {
  setExporting(true);
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) { toast.error('Please sign in first'); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const res = await fetch(`${supabaseUrl}/functions/v1/user-data-export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());

    // The edge function sets Content-Disposition with a filename;
    // browsers will honour it via the standard download flow when we
    // use a blob URL + anchor click. Doing it this way instead of a
    // plain <a href> lets us surface errors first.
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mystoreos-my-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Your data export has been downloaded');
  } catch (e) {
    toast.error(e.message || 'Export failed');
  } finally {
    setExporting(false);
  }
};

// In the JSX:
<button onClick={downloadMyData} disabled={exporting} className="...">
  {exporting ? 'Preparing…' : 'Download my data'}
</button>
```

---

## 3) Consent capture on registration (deferred, but the column exists)

The migration added `users.privacy_consent_v1_at timestamptz`. Wire the
Register.jsx form so that when the user submits, it stamps this column
with `now()`. Same pattern as the existing acceptance of Terms and
Conditions — a checkbox required before Submit is enabled, and on
success, a followup update to the user row sets the column.

Suggested minimal wiring in `src/pages/Register.jsx` (near the submit
handler):

```jsx
// After successful registration, before redirecting:
try {
  await supabase.from('users').update({
    privacy_consent_v1_at: new Date().toISOString(),
  }).eq('id', createdUser.id);
} catch { /* non-blocking */ }
```

The trigger `prevent_privilege_escalation` doesn't guard this column,
so the user's own UPDATE goes through fine. For legacy users, add a
one-time interstitial the first time they log in after this ships:
"We've updated our Privacy Policy — tap Agree to continue."

---

## Verification

**Realtime channel names:** Open the browser devtools Network tab
after loading the shop dashboard. Filter for websocket frames or
search for `mystore_rt_`. Channel names should now show a full UUID
suffix rather than 8-char.

**Session heartbeat:** In one browser, log in and stay on the
dashboard. In another browser, log in as admin and hit
`delete-user` on the first browser's account. Wait up to 5 minutes.
The first browser should silently transition to logged-out on the
next heartbeat tick.

**Data export:** Click "Download my data." A JSON file downloads
containing your profile, orders, products, appointments, credits,
payment history, and subscription events. Open it — no `pass` or
`pass_verify` field should be present.

**Subscription audit:** As admin, change a test user's plan (via
Razorpay checkout or `razorpay-verify-payment` test invocation).
Then query as that user:
```js
const { data } = await supabase.from('subscription_events').select('*');
console.log(data);
```
Should show one row per changed column with old/new values.
