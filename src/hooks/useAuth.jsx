import { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("mystore_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(!!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        // Only clear session if there is NO locally stored fallback user
        // Fallback logins (DB direct) store user in localStorage without Supabase session
        if (!session) {
          const localUser = localStorage.getItem("mystore_session");
          if (!localUser) {
            setUser(null);
          }
          // If localUser exists, keep them logged in (DB fallback login)
        }
        setAuthLoading(false);
      })
      .catch(() => setAuthLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        try { localStorage.removeItem("mystore_session"); } catch (_e) { /* ignore */ }
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
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
    try { localStorage.setItem("mystore_session", JSON.stringify(userData)); } catch (_e) { /* ignore */ }
    setUser(userData);
  };

  const logout = async () => {
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
