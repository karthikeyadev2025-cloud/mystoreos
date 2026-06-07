import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, ShieldCheck, CheckCircle, ArrowRight } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
.lp-root{position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;display:flex;font-family:'Inter',system-ui,sans-serif;background:#0D1117;z-index:999;overflow:hidden}
.lp-brand{flex:1;background:#0D1117;display:flex;flex-direction:column;justify-content:center;padding:60px 56px;position:relative;overflow:hidden;border-right:1px solid rgba(255,255,255,0.07);overflow-y:auto}
.lp-brand::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
.lp-brand::after{content:'';position:absolute;top:30%;left:40%;transform:translate(-50%,-50%);width:500px;height:500px;background:radial-gradient(ellipse,rgba(37,99,235,0.15),transparent 65%);pointer-events:none}
.lp-form-side{width:480px;min-width:480px;background:#161B22;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 44px;overflow-y:auto}
.lp-input{width:100%;padding:12px 14px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);border-radius:9px;color:#fff;font-size:14px;font-family:'Inter',system-ui,sans-serif;transition:border-color .18s,box-shadow .18s;outline:none}
.lp-input:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,0.18)}
.lp-input::placeholder{color:rgba(255,255,255,0.3)}
.lp-btn{width:100%;padding:13px;background:#2563EB;color:#fff;border:none;border-radius:9px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Inter',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;transition:filter .15s,transform .1s;box-shadow:0 0 24px rgba(37,99,235,0.4)}
.lp-btn:hover:not(:disabled){filter:brightness(1.1)}
.lp-btn:active{transform:scale(.98)}
.lp-btn:disabled{opacity:.6;cursor:not-allowed}
.lp-feat{display:flex;align-items:center;gap:10px;padding:7px 0}
.lp-metric{text-align:center;padding:16px 20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px}
.fade-in{animation:fadeIn .35s ease both}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}
@media(max-width:900px){
  .lp-root{flex-direction:column}
  .lp-brand{display:none}
  .lp-form-side{width:100%;min-width:unset;padding:40px 24px;background:#0D1117;min-height:100vh;justify-content:center}
}
`;

export default function Login() {
  const [phone, setPhone] = useState('');
  const [pass,  setPass]  = useState('');
  const [err,   setErr]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPass, setNewPass]  = useState('');
  const [confPass,setConfPass] = useState('');
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleLogin = async e => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) return setErr('Enter a valid 10-digit mobile number');
    if (!pass) return setErr('Enter your password');
    try {
      setLoading(true); setErr('');
      const user = await api.login(phone, pass);
      login(user);
      navigate('/dashboard');
    } catch (ex) {
      let msg = ex.message || 'Invalid credentials';
      if (msg.includes('Edge Function') || msg.includes('non-2xx') || msg.includes('Failed to fetch'))
        msg = "Can't reach the server. Check your internet and try again.";
      setErr(msg);
    } finally { setLoading(false); }
  };

  const handleForgot = async e => {
    e.preventDefault();
    if (!/^\d{10}$/.test(forgotPhone)) return setErr('Enter a valid 10-digit mobile number');
    if (newPass.length < 4) return setErr('Password must be at least 4 characters');
    if (newPass !== confPass) return setErr('Passwords do not match');
    try {
      setLoading(true); setErr('');
      await api.resetPassword(forgotPhone, newPass);
      toast.success('Password reset! Login with your new password.');
      setShowForgot(false);
      setPhone(forgotPhone); setPass('');
    } catch (ex) {
      setErr(ex.message || 'Reset failed. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="lp-root">
      <style>{CSS}</style>

      {/* ── LEFT BRAND PANEL ── */}
      <div className="lp-brand">
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <img src="/logo.png" alt="MyStore OS" style={{
              width: 48, height: 48, borderRadius: 11, objectFit: 'contain',
              boxShadow: '0 0 24px rgba(37,99,235,0.4)'
            }}/>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '-.02em' }}>MyStore OS</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em' }}>ENTERPRISE PLATFORM</div>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.15,
            letterSpacing: '-.025em', marginBottom: 14, maxWidth: 460 }}>
            India's Most Powerful<br/>
            <span style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Retail Operating System
            </span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7,
            marginBottom: 36, maxWidth: 420 }}>
            From kirana stores to FMCG distributors — bill faster, track smarter, grow bigger.
          </p>

          {/* Feature list */}
          <div style={{ marginBottom: 40 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="lp-feat">
                <CheckCircle size={15} color="#10B981" strokeWidth={2.5} style={{ flexShrink: 0 }}/>
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13.5 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {METRICS.map(({ val, label }) => (
              <div key={label} className="lp-metric">
                <div style={{ fontFamily: "'JetBrains Mono','Courier New',monospace",
                  fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{val}</div>
                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981',
              display: 'inline-block', animation: 'pulse 2s infinite' }}/>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>All systems operational · 99.97% uptime</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="lp-form-side">
        <div className="fade-in" style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile logo (hidden on desktop via CSS) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, justifyContent: 'center' }}
            className="mobile-logo">
            <img src="/logo.png" alt="MyStore OS" style={{
              width: 36, height: 36, borderRadius: 9, objectFit: 'contain'
            }}/>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>MyStore OS</span>
          </div>

          {!showForgot ? (
            <>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, background: 'rgba(37,99,235,0.15)',
                  border: '1px solid rgba(37,99,235,0.3)', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <ShieldCheck size={24} color="#2563EB" strokeWidth={2}/>
                </div>
                <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>
                  Welcome back
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5 }}>Sign in to your merchant account</p>
              </div>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12,
                    fontWeight: 600, marginBottom: 6, letterSpacing: '.02em' }}>MOBILE NUMBER</label>
                  <input className="lp-input" type="tel" inputMode="numeric" maxLength={10}
                    placeholder="10-digit mobile number" value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}/>
                </div>

                <div style={{ marginBottom: 8, position: 'relative' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12,
                    fontWeight: 600, marginBottom: 6, letterSpacing: '.02em' }}>PASSWORD</label>
                  <input className="lp-input" type={showPw ? 'text' : 'password'}
                    placeholder="Enter your password" value={pass}
                    onChange={e => setPass(e.target.value)}
                    style={{ paddingRight: 42 }}/>
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, bottom: 12, background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.35)', cursor: 'pointer', lineHeight: 0 }}>
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>

                <div style={{ textAlign: 'right', marginBottom: 20 }}>
                  <button type="button" onClick={() => { setShowForgot(true); setErr(''); }}
                    style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer' }}>Forgot password?</button>
                </div>

                {err && (
                  <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#FCA5A5', fontSize: 12.5 }}>
                    {err}
                  </div>
                )}

                <button className="lp-btn" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : <><ShieldCheck size={16}/>Sign In Securely</>}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>New to MyStore OS? </span>
                <button onClick={() => navigate('/register')}
                  style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: 13,
                    fontWeight: 700, cursor: 'pointer' }}>Create account →</button>
              </div>

              <div style={{ marginTop: 32, padding: '14px 16px', background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, display: 'flex', gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981',
                  display: 'inline-block', marginTop: 5, flexShrink: 0, animation: 'pulse 2s infinite' }}/>
                <div>
                  <div style={{ color: '#6EE7B7', fontSize: 11.5, fontWeight: 700, marginBottom: 2 }}>
                    Protected & Encrypted
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    256-bit SSL · RBI-compliant data storage
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Reset Password</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5 }}>Enter your registered mobile number</p>
              </div>

              <form onSubmit={handleForgot}>
                {[
                  { label:'MOBILE NUMBER', type:'tel', val:forgotPhone, set:setForgotPhone, ph:'10-digit mobile' },
                  { label:'NEW PASSWORD',  type:'password', val:newPass,  set:setNewPass,  ph:'Min 4 characters' },
                  { label:'CONFIRM PASSWORD', type:'password', val:confPass, set:setConfPass, ph:'Re-enter password' },
                ].map(({label,type,val,set,ph}) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12,
                      fontWeight: 600, marginBottom: 6 }}>{label}</label>
                    <input className="lp-input" type={type} placeholder={ph} value={val}
                      onChange={e => set(e.target.value)}/>
                  </div>
                ))}

                {err && (
                  <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#FCA5A5', fontSize: 12.5 }}>
                    {err}
                  </div>
                )}

                <button className="lp-btn" type="submit" disabled={loading}>
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => { setShowForgot(false); setErr(''); }}
                  style={{ background: 'none', border: 'none', color: '#60A5FA',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back to login</button>
              </div>
            </>
          )}
        </div>
      </div>

      <ToastContainer theme="dark" position="top-center"/>
    </div>
  );
}
