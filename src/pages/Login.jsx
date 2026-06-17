import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useSiteConfig } from '../lib/siteConfig';
import { Eye, EyeOff, ShieldCheck, CheckCircle } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MLogo from '../components/MLogo';

const FEATURES = [
  'GST-Ready invoicing in under 2 seconds',
  'WhatsApp bill sharing & UPI payments',
  'Real-time inventory with expiry alerts',
  'Udhaar ledger & credit management',
  'Tally ERP export & CA portal access',
  'Works fully offline — no internet needed',
];

const METRICS = [
  { val: '12,847+', label: 'Active Outlets' },
  { val: '₹842Cr+', label: 'GMV Processed' },
  { val: '99.97%',  label: 'Uptime SLA'    },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; }
.lp-root {
  min-height: 100vh; width: 100%; display: flex;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  background: #0D1117; overflow-x: hidden;
}
.lp-brand {
  flex: 1; background: #0D1117; display: flex; flex-direction: column;
  justify-content: center; padding: clamp(40px,6vw,60px) clamp(32px,5vw,56px);
  position: relative; overflow: hidden;
  border-right: 1px solid rgba(255,255,255,0.07);
}
.lp-brand::before {
  content: ''; position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);
  background-size: 40px 40px; pointer-events: none;
}
.lp-brand::after {
  content: ''; position: absolute; top: 30%; left: 40%; transform: translate(-50%,-50%);
  width: 500px; height: 500px;
  background: radial-gradient(ellipse, rgba(79,70,229,0.15), transparent 65%);
  pointer-events: none;
}
.lp-form-side {
  width: min(480px, 100%); background: #161B22;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: clamp(32px,5vw,48px) clamp(20px,5vw,44px); min-height: 100vh; overflow-y: auto;
}
.lp-input {
  width: 100%; padding: 12px 14px;
  background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.12);
  border-radius: 9px; color: #fff; font-size: 14px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  transition: border-color .18s, box-shadow .18s; outline: none;
}
.lp-input:focus { border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79,70,229,0.18); }
.lp-input::placeholder { color: rgba(255,255,255,0.3); }
.lp-btn {
  width: 100%; padding: 13px; background: #4F46E5; color: #fff; border: none;
  border-radius: 9px; font-size: 15px; font-weight: 700; cursor: pointer;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: filter .15s, transform .1s; box-shadow: 0 0 24px rgba(79,70,229,0.4);
}
.lp-btn:hover:not(:disabled) { filter: brightness(1.1); }
.lp-btn:active { transform: scale(.98); }
.lp-btn:disabled { opacity:.6; cursor: not-allowed; }
.lp-feat { display: flex; align-items: center; gap: 10px; padding: 7px 0; }
.lp-metric {
  text-align: center; padding: 16px 20px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
}
.fade-in { animation: fadeIn .35s ease both; }
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes pulse  { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
@media(max-width:900px) {
  .lp-root { flex-direction: column; }
  .lp-brand { display: none !important; }
  .lp-form-side {
    width: 100% !important; min-width: unset !important;
    padding: clamp(32px,7vw,48px) clamp(20px,6vw,40px) !important;
    background: #0D1117 !important;
  }
}
`;

export default function Login() {
  const [phone,   setPhone]   = useState('');
  const [pass,    setPass]    = useState('');
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent,  setForgotSent]  = useState(false);

  const { login } = useAuth();
  const { config } = useSiteConfig();
  const navigate   = useNavigate();
  const googleEnabled = config?.googleLoginEnabled === true || config?.googleLoginEnabled === 'true';

  const handleLogin = async e => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) return setErr('Enter a valid 10-digit mobile number');
    if (!pass) return setErr('Enter your password or PIN');
    try {
      setLoading(true); setErr('');
      const user = await api.login(phone, pass);
      login(user);
      // Welcome toast based on role
      if (user.role === 'staff') {
        toast.success(`Welcome, ${user.name}! 👋`);
      }
      navigate('/dashboard');
    } catch (ex) {
      let msg = ex.message || 'Invalid credentials';
      if (msg.includes('Edge Function') || msg.includes('non-2xx') || msg.includes('Failed to fetch'))
        msg = "Can't reach the server. Check your internet and try again.";
      setErr(msg);
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    try {
      setGoogleLoading(true); setErr('');
      await api.signInWithGoogle();
    } catch (ex) {
      setErr(ex.message || 'Google sign-in is unavailable right now.');
      setGoogleLoading(false);
    }
  };

  const handleForgot = async e => {
    e.preventDefault();
    try {
      setLoading(true); setErr('');
      await api.requestPasswordReset(forgotEmail);
      setForgotSent(true);
    } catch (ex) {
      setErr(ex.message || 'Could not send reset link. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="lp-root">
      <style>{CSS}</style>

      {/* ── LEFT BRAND PANEL ── */}
      <div className="lp-brand">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <MLogo size={48} radius={13} />
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '-.02em' }}>MyStore OS</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em' }}>ENTERPRISE PLATFORM</div>
            </div>
          </div>

          <h1 style={{ fontSize: 'clamp(26px,3vw,36px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-.025em', marginBottom: 14, maxWidth: 460 }}>
            India's Most Powerful<br/>
            <span style={{ background: 'linear-gradient(135deg,#4F46E5,#818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Retail Operating System
            </span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7, marginBottom: 36, maxWidth: 420 }}>
            From kirana stores to FMCG distributors — bill faster, track smarter, grow bigger.
          </p>

          <div style={{ marginBottom: 40 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="lp-feat">
                <CheckCircle size={15} color="#10B981" strokeWidth={2.5} style={{ flexShrink: 0 }}/>
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13.5 }}>{f}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {METRICS.map(({ val, label }) => (
              <div key={label} className="lp-metric">
                <div style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{val}</div>
                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s infinite' }}/>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>All systems operational · 99.97% uptime</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="lp-form-side">
        <div className="fade-in" style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
            <MLogo size={36} radius={10} />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>MyStore OS</span>
          </div>

          {!showForgot ? (
            <>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <ShieldCheck size={24} color="#4F46E5" strokeWidth={2}/>
                </div>
                <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>
                  Welcome back
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5 }}>Sign in to your merchant account</p>
              </div>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '.02em' }}>MOBILE NUMBER</label>
                  <input className="lp-input" type="tel" inputMode="numeric" maxLength={10}
                    placeholder="10-digit mobile number" value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g,'').slice(0,10)); setErr(''); }}/>
                </div>

                <div style={{ marginBottom: 8, position: 'relative' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '.02em' }}>PASSWORD / PIN</label>
                  <input className="lp-input" type={showPw ? 'text' : 'password'}
                    placeholder="Password or 4-digit PIN (for staff)" value={pass}
                    onChange={e => { setPass(e.target.value); setErr(''); }}
                    style={{ paddingRight: 42 }}/>
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, bottom: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', lineHeight: 0 }}>
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>

                {/* Staff hint */}
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>👤</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                    Staff members: use your <strong style={{ color: '#6EE7B7' }}>4-digit PIN</strong> as your password
                  </span>
                </div>

                <div style={{ textAlign: 'right', marginBottom: 20 }}>
                  <button type="button" onClick={() => { setShowForgot(true); setErr(''); }}
                    style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Forgot password?
                  </button>
                </div>

                {err && (
                  <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#FCA5A5', fontSize: 12.5 }}>
                    {err}
                  </div>
                )}

                <button className="lp-btn" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : <><ShieldCheck size={16}/>Sign In Securely</>}
                </button>
              </form>

              {googleEnabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11.5, fontWeight: 600 }}>OR</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  </div>
                  <button type="button" onClick={handleGoogle} disabled={googleLoading}
                    style={{ width: '100%', padding: 12, background: '#fff', color: '#1f2937', border: 'none', borderRadius: 9, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: googleLoading ? 0.6 : 1, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/>
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                    </svg>
                    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                  </button>
                </>
              )}

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>New to MyStore OS? </span>
                <button onClick={() => navigate('/register')}
                  style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create account →</button>
              </div>

              <div style={{ marginTop: 32, padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, display: 'flex', gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', marginTop: 5, flexShrink: 0, animation: 'pulse 2s infinite' }}/>
                <div>
                  <div style={{ color: '#6EE7B7', fontSize: 11.5, fontWeight: 700, marginBottom: 2 }}>Protected & Encrypted</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>256-bit SSL · RBI-compliant data storage</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Reset Password</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5 }}>
                  {forgotSent ? 'Check your inbox' : 'Enter your registered email address'}
                </p>
              </div>

              {forgotSent ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '16px 18px', marginBottom: 18, color: '#6EE7B7', fontSize: 13.5, lineHeight: 1.6 }}>
                    If an account with that email exists, we've sent a password-reset link. Open it to choose a new password.
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 18 }}>
                    No email? Accounts created with a phone number only can be reset by contacting support.
                  </p>
                  <button onClick={() => { setShowForgot(false); setForgotSent(false); setErr(''); }}
                    style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    ← Back to login
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleForgot}>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>EMAIL ADDRESS</label>
                      <input className="lp-input" type="email" placeholder="you@example.com"
                        value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                    </div>
                    {err && (
                      <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#FCA5A5', fontSize: 12.5 }}>
                        {err}
                      </div>
                    )}
                    <button className="lp-btn" type="submit" disabled={loading}>
                      {loading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button onClick={() => { setShowForgot(false); setErr(''); }}
                      style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back to login</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <ToastContainer theme="dark" position="top-center"/>
    </div>
  );
}
