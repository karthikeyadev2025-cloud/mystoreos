import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Store, ShieldCheck, ArrowLeft, KeyRound, Eye, EyeOff, Home } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const authStyles = `
  .auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);padding:20px}
  .auth-card{background:rgba(30,41,59,0.85);backdrop-filter:blur(20px);padding:32px 28px;border-radius:24px;border:1px solid rgba(255,255,255,0.1);max-width:420px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.5)}
  @media(max-width:480px){.auth-page{padding:12px;align-items:flex-start;padding-top:24px}.auth-card{padding:24px 16px;border-radius:20px}}
`;

const Login = () => {
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) return setError('Enter a valid 10-digit mobile number');
    if (!pass) return setError('Enter your password');
    try {
      setLoading(true); setError('');
      const user = await api.login(phone, pass);
      login(user);
      navigate('/dashboard');
    } catch (err) {
      let msg = err.message || 'Invalid credentials';
      if (msg.includes('Edge Function') || msg.includes('non-2xx') || msg.includes('Failed to fetch') || msg.includes('TypeError'))
        msg = "Oops! We couldn't reach the login server. Please check your internet connection and try again!";
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(forgotPhone)) return setError('Enter a valid 10-digit mobile number');
    if (newPass.length < 4) return setError('Password must be at least 4 characters');
    if (newPass !== confirmPass) return setError('Passwords do not match');
    try {
      setLoading(true); setError('');
      await api.resetPassword(forgotPhone, newPass);
      toast.success('Password reset successful! Please login with your new password.');
      setShowForgot(false);
      setPhone(forgotPhone); setPass('');
      setForgotPhone(''); setNewPass(''); setConfirmPass('');
    } catch (err) {
      let msg = err.message || 'Failed to reset password';
      if (msg.includes('Edge Function') || msg.includes('non-2xx') || msg.includes('Failed to fetch') || msg.includes('TypeError'))
        msg = "Oops! We couldn't reach the password reset server. Please check your internet connection and try again shortly!";
      setError(msg);
    } finally { setLoading(false); }
  };

  const inp = {
    width: '100%', padding: '13px 14px', background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px',
    color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
  };
  const eyeBtn = {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: '44px',
    background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  };
  const lbl = { display: 'block', color: '#cbd5e1', fontSize: '12px', marginBottom: 6, fontWeight: 'bold' };
  const errBox = { background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', textAlign: 'center' };

  return (
    <>
      <style>{authStyles}</style>
      <div className="auth-page">
        <ToastContainer theme="dark" position="top-center" />
        <div className="auth-card">

          {/* Home button */}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', padding: 0, marginBottom: '20px', fontWeight: 500 }}>
            <Home size={14} /> Home
          </button>

          {showForgot ? (
            <>
              <button onClick={() => { setShowForgot(false); setError(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: 0, marginBottom: '20px' }}>
                <ArrowLeft size={16} /> Back to Login
              </button>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <KeyRound size={44} color="#f59e0b" style={{ margin: '0 auto 14px' }} />
                <h1 style={{ fontSize: '22px', color: '#fff', margin: '0 0 8px 0', fontWeight: 900 }}>Reset Password</h1>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Enter your registered mobile and set a new password</p>
              </div>
              {error && <div style={errBox}>{error}</div>}
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Registered Mobile Number</label>
                  <input type="tel" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)} placeholder="10-digit mobile number" maxLength={10} style={inp} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="At least 4 characters" style={{ ...inp, paddingRight: '48px' }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtn}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={lbl}>Confirm Password</label>
                  <input type={showPassword ? 'text' : 'password'} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Retype password" style={inp} />
                </div>
                <button disabled={loading} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 10px 20px rgba(245,158,11,0.25)' }}>
                  {loading ? 'Resetting...' : '🔑 Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <Store size={44} color="#fbbf24" style={{ margin: '0 auto 14px' }} />
                <h1 style={{ fontSize: '26px', color: '#fff', margin: '0 0 8px 0', fontWeight: 900 }}>Welcome Back</h1>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Login to MyStore OS</p>
              </div>
              {error && <div style={errBox}>{error}</div>}
              <form onSubmit={handlePasswordLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Mobile Number</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" maxLength={10} style={inp} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ ...inp, paddingRight: '48px' }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtn}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginBottom: 24 }}>
                  <span onClick={() => { setShowForgot(true); setError(''); }} style={{ color: '#f59e0b', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>Forgot Password?</span>
                </div>
                <button disabled={loading} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 10px 20px rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} />
                  {loading ? 'Logging in...' : 'Login Securely'}
                </button>
              </form>
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', marginTop: 20, marginBottom: 0 }}>
                Don't have an account?{' '}
                <span onClick={() => navigate('/register')} style={{ color: '#fbbf24', cursor: 'pointer', fontWeight: 'bold' }}>Register here</span>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;
