import { useState } from 'react';
import { api } from '../lib/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSiteConfig } from '../lib/siteConfig';
import { ToastContainer, toast } from 'react-toastify';
import { Eye, EyeOff, ArrowLeft, Zap, ShieldCheck } from 'lucide-react';
import 'react-toastify/dist/ReactToastify.css';
import MLogo from '../components/MLogo';

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  .reg-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0D1117;
    padding: clamp(16px, 4vw, 32px);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }
  .reg-card {
    background: #161B22;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px;
    padding: clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px);
    width: 100%;
    max-width: 440px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }
  .reg-input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.12);
    border-radius: 9px;
    color: #fff;
    font-size: 14px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    transition: border-color .18s, box-shadow .18s;
    outline: none;
  }
  .reg-input:focus {
    border-color: #4F46E5;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.18);
  }
  .reg-input::placeholder { color: rgba(255,255,255,0.28); }
  .reg-label {
    display: block;
    color: rgba(255,255,255,0.5);
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 7px;
    letter-spacing: .04em;
  }
  .reg-submit {
    width: 100%;
    padding: 14px;
    background: #4F46E5;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: filter .15s, transform .1s;
    box-shadow: 0 0 24px rgba(79,70,229,0.4);
  }
  .reg-submit:hover:not(:disabled) { filter: brightness(1.1); }
  .reg-submit:active { transform: scale(.98); }
  .reg-submit:disabled { opacity: .6; cursor: not-allowed; }
  .reg-type-btn {
    flex: 1;
    padding: 11px 8px;
    background: transparent;
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: rgba(255,255,255,0.45);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    text-align: center;
    transition: all .15s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .reg-type-btn.active {
    background: rgba(79,70,229,0.15);
    border-color: rgba(79,70,229,0.4);
    color: #fff;
  }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fade-in { animation: fadeIn .3s ease both; }
`;

const TYPES = [
  { value: 'shop', icon: '🏪', label: 'Retail Shop' },
  { value: 'distributor', icon: '🚚', label: 'Distributor' },
  { value: 'customer', icon: '🛒', label: 'Customer' },
];

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { config } = useSiteConfig();
  const registrationClosed = config?.registrationOpen === false;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [businessType, setBusinessType] = useState(searchParams.get('type') || 'shop');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registrationClosed) return toast.error('New registrations are temporarily closed. Please check back later.');
    if (!name || !phone || !pass) return toast.error('Please fill all fields');
    if (!/^\d{10}$/.test(phone)) return toast.error('Enter valid 10-digit mobile number (digits only)');
    try {
      setLoading(true);
      const newUser = await api.register(name, phone, pass, businessType);
      login(newUser);
      if (businessType === 'customer') {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      let msg = err.message || 'Registration failed';
      if (msg.includes('Edge Function') || msg.includes('non-2xx') || msg.includes('Failed to fetch') || msg.includes('TypeError'))
        msg = "Couldn't connect to our servers. Please check your internet and try again.";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="reg-page">
        <ToastContainer theme="dark" position="top-center"/>
        <div className="reg-card fade-in">
          {/* Back */}
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, padding: 0, marginBottom: 24, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
            fontWeight: 500,
          }}>
            <ArrowLeft size={14}/> Back to Home
          </button>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 52, height: 52, background: 'rgba(79,70,229,0.15)',
              border: '1px solid rgba(79,70,229,0.3)', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Zap size={24} color="#4F46E5" strokeWidth={2}/>
            </div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>
              {businessType === 'customer' ? 'Create Shopper Account' : 'Start Your Free Trial'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5 }}>
              {businessType === 'customer' ? 'Join the digital shopping revolution' : 'No credit card · 7 days free · Cancel anytime'}
            </p>
          </div>

          <form onSubmit={handleRegister}>
            {/* Business Type Selector */}
            <div style={{ marginBottom: 20 }}>
              <label className="reg-label">ACCOUNT TYPE</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TYPES.map(({ value, icon, label }) => (
                  <button key={value} type="button"
                    onClick={() => setBusinessType(value)}
                    className={`reg-type-btn${businessType === value ? ' active' : ''}`}
                  >
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ fontSize: 11 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label className="reg-label">
                {businessType === 'customer' ? 'YOUR FULL NAME' : 'BUSINESS NAME'}
              </label>
              <input
                className="reg-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={businessType === 'customer' ? 'Enter your full name' : 'e.g. Sai Supermarket or Ravi Traders'}
              />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 16 }}>
              <label className="reg-label">MOBILE NUMBER</label>
              <input
                className="reg-input"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="numeric"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label className="reg-label">CREATE PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="reg-input"
                  type={showPassword ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="Min 4 characters"
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, lineHeight: 0,
                }}>
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {registrationClosed && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, color: '#FCA5A5', fontSize: 13, textAlign: 'center' }}>
                New registrations are temporarily closed. Please check back later.
              </div>
            )}

            <button className="reg-submit" type="submit" disabled={loading || registrationClosed}>
              {loading ? 'Creating account…' : (
                businessType === 'customer'
                  ? <><ShieldCheck size={16}/>Create Account</>
                  : <><Zap size={16}/>Start Free 7-Day Trial</>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 20 }}>
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} style={{
              background: 'none', border: 'none', color: '#818CF8',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Sign in →</button>
          </p>

          {/* Trust */}
          <div style={{ marginTop: 24, padding: '12px 14px', background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.18)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
            <div>
              <div style={{ color: '#6EE7B7', fontSize: 11, fontWeight: 700, marginBottom: 1 }}>Safe & Secure</div>
              <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5 }}>256-bit SSL · Your data is private</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
