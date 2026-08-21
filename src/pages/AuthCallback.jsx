import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import MLogo from '../components/MLogo';

// Google redirects here after sign-in. Supabase has already established the
// auth session (detectSessionInUrl handles the URL fragment). We resolve the
// session to a local profile and route:
//   - existing user  -> their dashboard
//   - brand-new user -> /onboarding to pick account type (shop/distributor/customer)
export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.resolveOAuthProfile();
        if (cancelled) return;
        // Claim-mode roundtrip: customer tapped 'Continue with Google' on a
        // /register?phone=X&claim=1 link. We stashed the phone in
        // sessionStorage before redirecting; pick it up here.
        let claimPhone = null;
        try {
          const claim = JSON.parse(sessionStorage.getItem('mystore_oauth_claim') || 'null');
          if (claim?.phone && /^\d{10}$/.test(claim.phone)) claimPhone = claim.phone;
        } catch { /* no valid claim stashed — proceed without it */ }

        if (res.isNew) {
          // If we're in claim mode, skip the role-picker — they're a
          // customer by definition (a shop bill was sent to their phone),
          // create the profile directly with phone + Google email, and
          // send them straight to /dashboard where past bills appear.
          if (claimPhone) {
            try {
              const profile = await api.createOAuthProfile({
                email: res.email, name: res.name, authUid: res.authUid,
                role: 'customer', phone: claimPhone,
              });
              sessionStorage.removeItem('mystore_oauth_claim');
              login(profile);
              navigate('/dashboard', { replace: true });
              return;
            } catch (createErr) {
              // Fall through to the normal role-picker flow if direct
              // create fails (e.g. duplicate phone constraint elsewhere).
              if (!cancelled) setError(createErr.message || 'Could not finish sign-in.');
              return;
            }
          }
          // Normal new-user OAuth flow — role picker
          sessionStorage.setItem('oauth_pending', JSON.stringify({
            email: res.email, name: res.name, authUid: res.authUid,
          }));
          navigate('/onboarding?oauth=1', { replace: true });
          return;
        }
        // Existing user — log in. If they came from claim mode, the
        // phone-based reconciliation in getUserOrders does the rest.
        sessionStorage.removeItem('mystore_oauth_claim');
        login(res.profile);
        navigate('/dashboard', { replace: true });
      } catch (ex) {
        if (!cancelled) setError(ex.message || 'Sign-in could not be completed.');
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, login]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--c-ink-surface)',
      fontFamily: 'var(--font-sans)', padding: 24 }}>
      <MLogo size={48} radius={13} />
      {!error ? (
        <>
          <div style={{ color: 'var(--c-surface)', fontSize: 18, fontWeight: 700, marginTop: 20 }}>
            Finishing sign-in…
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
            One moment while we set things up.
          </div>
        </>
      ) : (
        <>
          <div style={{ color: 'var(--c-danger-border)', fontSize: 15, fontWeight: 600, marginTop: 20, textAlign: 'center', maxWidth: 360 }}>
            {error}
          </div>
          <button onClick={() => navigate('/login', { replace: true })}
            style={{ marginTop: 20, padding: '10px 20px', background: 'var(--c-primary)', color: 'var(--c-surface)',
              border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Back to login
          </button>
        </>
      )}
    </div>
  );
}
