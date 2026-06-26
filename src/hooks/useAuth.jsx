import { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const AuthContext = createContext(null);

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
        setAuthLoading(false);
      })
      .catch(() => setAuthLoading(false));

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
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refresh the cached user's profile from the DB once on load, so stale
  // sessions (e.g. created before public_code backfill or a tier change) pick
  // up the latest fields like publicCode, subscription, plan tier, etc.
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
        // Non-destructive merge: fresh DB values win, but a null/undefined/empty
        // fresh field must NOT wipe a good cached value (e.g. publicCode). This
        // is why the shop ID "sometimes showed, sometimes not" — a partial fresh
        // read overwrote the cached code with null.
        const merged = { ...cached };
        for (const k of Object.keys(fresh)) {
          const v = fresh[k];
          if (v !== null && v !== undefined && v !== '') merged[k] = v;
        }
        if (JSON.stringify(merged) !== JSON.stringify(cached)) {
          try { localStorage.setItem("mystore_session", JSON.stringify(merged)); } catch (_e) { /* ignore */ }
          setUser(merged);
        }
      } catch (_e) { /* keep cached session on any error */ }
    })();
    return () => { cancelled = true; };
  }, []);

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
