import { useState } from 'react';
import { api } from '../lib/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ToastContainer, toast } from 'react-toastify';
import { Eye, EyeOff, Home } from 'lucide-react';
import 'react-toastify/dist/ReactToastify.css';

const authStyles = `
  .auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);padding:20px}
  .auth-card{background:rgba(30,41,59,0.8);backdrop-filter:blur(10px);padding:32px 28px;border-radius:24px;border:1px solid rgba(255,255,255,0.1);max-width:420px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.5)}
  @media(max-width:480px){.auth-page{padding:12px;align-items:flex-start;padding-top:24px}.auth-card{padding:24px 16px;border-radius:20px}}
`;

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [businessType, setBusinessType] = useState(searchParams.get('type') || 'shop');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !phone || !pass) return toast.error('Please fill all fields');
    if (!/^\d{10}$/.test(phone)) return toast.error('Enter valid 10-digit mobile number (digits only)');
    try {
      setLoading(true);
      const newUser = await api.register(name, phone, pass, businessType);
      login(newUser);
      if (businessType === 'customer') {
        navigate('/dashboard');
      } else {
        navigate('/waiting');
      }
    } catch (err) {
      let msg = err.message || 'Registration failed';
      if (msg.includes('Edge Function') || msg.includes('non-2xx') || msg.includes('Failed to fetch') || msg.includes('TypeError'))
        msg = "Oops! We couldn't connect to our registration service. Please verify your internet connection and try again shortly!";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const inp = {
    width: '100%', padding: '13px 14px', background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px',
    color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
  };
  const lbl = { display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' };

  return (
    <>
      <style>{authStyles}</style>
      <div className="auth-page">
        <ToastContainer theme="dark" />
        <div className="auth-card">

          {/* Home button */}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', padding: 0, marginBottom: '20px', fontWeight: 500 }}>
            <Home size={14} /> Home
          </button>

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: '26px', color: '#fff', margin: '0 0 10px 0', fontWeight: 900 }}>
              {businessType === 'customer' ? 'Create Shopper Account' : 'Create Business'}
            </h1>
            <p style={{ color: '#94a3b8', margin: 0 }}>Join the paperless revolution</p>
          </div>

          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>{businessType === 'customer' ? 'Your Full Name' : 'Business Name'}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={businessType === 'customer' ? 'Enter your full name' : 'e.g. Sai Supermarket or Ravi Tailors'} style={inp} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Mobile Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" maxLength={10} style={inp} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Create Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" style={{ ...inp, paddingRight: '48px' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', zIndex: 10 }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={lbl}>Account Type</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} style={{ ...inp, background: '#0f172a' }}>
                <option value="shop">Retail Shop / Service (Salon, Tailor)</option>
                <option value="distributor">Wholesale / Distributor</option>
                <option value="customer">Customer / Shopper</option>
              </select>
            </div>
            <button disabled={loading} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#dc2626,#f59e0b)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 10px 20px rgba(220,38,38,0.3)' }}>
              {loading ? 'Submitting...' : (businessType === 'customer' ? 'Create Account' : 'Start Free 7-Day Trial 🚀')}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', marginTop: 20, marginBottom: 0 }}>
            Already have an account?{' '}
            <span onClick={() => navigate('/login')} style={{ color: '#fbbf24', cursor: 'pointer', fontWeight: 'bold' }}>Login here</span>
          </p>
        </div>
      </div>
    </>
  );
};

export default Register;
