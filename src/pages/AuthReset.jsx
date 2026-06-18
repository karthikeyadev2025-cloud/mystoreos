import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';
import MLogo from '../components/MLogo';

// The Supabase reset email links here. Supabase establishes a recovery session
// from the link, so the user can set a new password without being logged in
// the normal way. If there's no recovery session, the link was invalid/expired.
export default function AuthReset() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [pw, setPw] = useState('');
  const [conf, setConf] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // detectSessionInUrl exchanges the recovery token for a session.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setValidLink(!!session);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    if (pw !== conf) return setErr('Passwords do not match.');
    try {
      setLoading(true); setErr('');
      await api.completePasswordReset(pw);
      setDone(true);
    } catch (ex) {
      setErr(ex.message || 'Could not reset password. Request a new link.');
    } finally { setLoading(false); }
  };

  const box = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', background: '#0D1117', padding: 24,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };
  const input = { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 9, color: '#fff', fontSize: 14, outline: 'none' };
  const btn = { width: '100%', padding: 13, background: '#4F46E5', color: '#fff', border: 'none',
    borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 };

  if (!ready) {
    return <div style={box}><MLogo size={44} radius={12} /><div style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>Loading…</div></div>;
  }

  return (
    <div style={box}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center' }}>
          <MLogo size={36} radius={10} />
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>MyStore OS</span>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Password updated</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 20 }}>
              You can now sign in with your new password.
            </p>
            <button style={btn} onClick={() => navigate('/login', { replace: true })}>Go to login</button>
          </div>
        ) : !validLink ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Link expired</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 20 }}>
              This password-reset link is invalid or has expired. Request a new one from the login page.
            </p>
            <button style={btn} onClick={() => navigate('/login', { replace: true })}>Back to login</button>
          </div>
        ) : (
          <>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 6, textAlign: 'center' }}>
              Set a new password
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5, marginBottom: 22, textAlign: 'center' }}>
              Choose a strong password you'll remember.
            </p>
            <form onSubmit={submit}>
              <div style={{ marginBottom: 12, position: 'relative' }}>
                <input style={{ ...input, paddingRight: 42 }} type={showPw ? 'text' : 'password'}
                  placeholder="New password (min 6 chars)" value={pw} onChange={e => setPw(e.target.value)} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, width: 28, height: 28,
                    color: 'rgba(255,255,255,0.85)', cursor: 'pointer', lineHeight: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s, color .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,70,229,0.25)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <input style={input} type="password" placeholder="Confirm new password"
                  value={conf} onChange={e => setConf(e.target.value)} />
              </div>
              {err && (
                <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#FCA5A5', fontSize: 12.5 }}>
                  {err}
                </div>
              )}
              <button style={{ ...btn, opacity: loading ? 0.6 : 1 }} type="submit" disabled={loading}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
