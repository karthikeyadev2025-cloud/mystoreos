import { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const AuthContext = createContext(null);

// Fields where a null/empty value from a partial or racing DB read must
// NOT overwrite a good cached value — historically caused publicCode to
// vanish intermittently (see the merge effect below). Kept intentionally
// small: only include a field here if you've seen it arrive spuriously
// null from a fetch that wasn't a deliberate user clear. Every other
// field (upiId, merchantUpiId, paymentQr, logo, etc.) takes the fresh
// value unconditionally, including null, so a user-initiated clear from
// Settings actually sticks instead of being masked by the cached copy.
const ALWAYS_PROTECTED_FIELDS = new Set(['publicCode', 'id', 'role', 'phone']);

// Module-level flag: true only when the user explicitly tapped Logout.
// Prevents onAuthStateChange(SIGNED_OUT) — which fires on token expiry too —
// from wiping the local session on Android when the app resumes after being
// backgrounded (Capacitor WebView kill → Supabase refresh fails → SIGNED_OUT).
let _explicitLogout = false;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("mystore_session");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Reject malformed sessions (must have at least an id) so a stale
      // localStorage write from older code doesn't keep showing the
      // customer as 'logged in' with no id — which slipped past the
      // existing checkout guards and crashed at Postgres with the
      // 'null value in column user_id' error.
      if (!parsed?.id) {
        try { localStorage.removeItem("mystore_session"); } catch { /* ignore */ }
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(!!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Hard safety net: nothing below GUARANTEES setAuthLoading(false)
    // fires within any bounded time — both getSession() and the first
    // onAuthStateChange event are expected to resolve quickly, but
    // there was no fallback if the underlying network call ever hangs
    // (a real risk on a flaky mobile connection specifically, which is
    // where this class of issue would show up most). Without this, a
    // hang here means authLoading never becomes false, and BOTH gates
    // in App.jsx block the entire app behind a permanent loading
    // screen with no way to recover short of the user manually
    // reloading. This forces resolution no matter what.
    const safetyTimeout = setTimeout(() => setAuthLoading(false), 8000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          const localUser = localStorage.getItem("mystore_session");
          if (!localUser) {
            setUser(null);
          }
          // If localUser exists, keep them logged in (DB fallback login)
          // and try a silent token refresh so Supabase session is restored
          else {
            // Attempt silent re-auth using stored Supabase refresh token
            supabase.auth.refreshSession().catch(() => {/* ignore — keep local session */});
          }
        }
        clearTimeout(safetyTimeout);
        setAuthLoading(false);
      })
      .catch(() => { clearTimeout(safetyTimeout); setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // IMPORTANT: Only clear the local session on EXPLICIT logout (user tapped
      // Logout) — not on Supabase token expiry events. On Android/Capacitor the
      // WebView gets killed when backgrounded; Supabase fires SIGNED_OUT when the
      // refresh fails, which previously wiped mystore_session and forced re-login
      // every time the app was reopened. The logout() function below sets a flag
      // before calling supabase.signOut() so we can distinguish the two cases.
      if ((event === "SIGNED_OUT" || event === "USER_DELETED") && _explicitLogout) {
        try { localStorage.removeItem("mystore_session"); } catch (_e) { /* ignore */ }
        setUser(null);
        _explicitLogout = false;
      }
      clearTimeout(safetyTimeout);
      setAuthLoading(false);
    });

    return () => { subscription.unsubscribe(); clearTimeout(safetyTimeout); };
  }, []);

  // Refresh the cached user's profile from the DB once on load AND after
  // every in-SPA login (deps: user id), so stale sessions or a partial
  // login payload (e.g. the auth-login edge function forgetting a field
  // like business_kind) get corrected within moments — without this,
  // service businesses stayed on the retail POS layout until a manual
  // reload. Loop-safe: the merge preserves the same id, so setUser(merged)
  // does not re-trigger this effect, and an unchanged merge skips setUser.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = localStorage.getItem("mystore_session");
        if (!saved) return;
        const cached = JSON.parse(saved);
        if (!cached?.id) return;
        const { api } = await import("../lib/api");
        const fresh = await api.getUserById(cached.id);
        if (cancelled || !fresh) return;
        // Merge: fresh DB values win for everything by default. The one
        // exception is CLEARABLE_ALWAYS_PROTECTED below — fields that
        // historically arrived null/empty from a partial DB read (not a
        // deliberate user action) and wiping them caused real bugs, e.g.
        // publicCode vanishing whenever a fetch raced an unrelated write.
        // Everything else — including upiId, merchantUpiId, paymentQr,
        // logo — now takes the fresh value even when it's null, because
        // those ARE fields a user legitimately clears from Settings, and
        // the old blanket protection meant a cleared QR code kept showing
        // in the cached session until the next full logout/login.
        const merged = { ...cached };
        for (const k of Object.keys(fresh)) {
          const v = fresh[k];
          const isProtected = ALWAYS_PROTECTED_FIELDS.has(k);
          if (!isProtected || (v !== null && v !== undefined && v !== '')) {
            merged[k] = v;
          }
        }
        if (JSON.stringify(merged) !== JSON.stringify(cached)) {
          try { localStorage.setItem("mystore_session", JSON.stringify(merged)); } catch (_e) { /* ignore */ }
          setUser(merged);
        }
      } catch (_e) { /* keep cached session on any error */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const handleStorageChange = (e) => {
      if (e.key === "mystore_session") {
        try {
          setUser(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = (userData) => {
    // Hard-validate: never persist a user object without an id. This
    // sidesteps the entire class of bugs where some half-finished code
    // path passes a partial profile and downstream code (placeOrder,
    // RoleRouter, etc.) silently picks it up and crashes at the DB.
    if (!userData || !userData.id) {
      console.warn('login(): refused to set user without id', userData);
      return;
    }
    try { localStorage.setItem("mystore_session", JSON.stringify(userData)); } catch (_e) { /* ignore */ }
    setUser(userData);
  };

  const logout = async () => {
    _explicitLogout = true;  // tell onAuthStateChange this is intentional
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    try { localStorage.removeItem("mystore_session"); } catch (_e) { /* ignore */ }
    setUser(null);
  };

  return (
    <AuthContext value={{ user, setUser, login, logout, authLoading }}>
      {children}
    </AuthContext>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
