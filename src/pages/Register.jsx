import { useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ToastContainer, toast } from 'react-toastify';
import { Eye, EyeOff } from 'lucide-react';
import 'react-toastify/dist/ReactToastify.css';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [businessType, setBusinessType] = useState('shop');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !phone || !pass) return toast.error('Please fill all fields');
    if (phone.length < 10) return toast.error('Enter valid 10 digit phone number');
    
    try {
      setLoading(true);
      const newUser = await api.register(name, phone, pass, businessType);
      toast.success("Welcome to MyStore OS! Logging you in...");
      login(newUser);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', padding: 20 }}>
      <ToastContainer theme="dark" />
      <div style={{ background: 'rgba(30,41,59,0.8)', backdropFilter: 'blur(10px)', padding: '40px 30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 400, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <h1 style={{ fontSize: '28px', color: '#fff', margin: '0 0 10px 0', fontWeight: 900 }}>
            {businessType === 'customer' ? 'Create Shopper Account' : 'Create Business'}
          </h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Join the paperless revolution</p>
        </div>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' }}>
              {businessType === 'customer' ? 'Your Full Name' : 'Business Name'}
            </label>
            <input 
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={businessType === 'customer' ? 'Enter your full name' : 'e.g. Sai Supermarket or Ravi Tailors'}
              style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' }}>Mobile Number</label>
            <input 
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' }}>Create Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '14px', paddingRight: '40px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 30 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' }}>Account Type</label>
            <select 
              value={businessType} onChange={(e) => setBusinessType(e.target.value)}
              style={{ width: '100%', padding: '14px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
            >
              <option value="shop">Retail Shop / Service (Salon, Tailor)</option>
              <option value="distributor">Wholesale / Distributor</option>
              <option value="customer">Customer / Shopper</option>
            </select>
          </div>

          <button 
            disabled={loading}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #dc2626, #f59e0b)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(220,38,38,0.3)' }}
          >
            {loading ? 'Submitting...' : (businessType === 'customer' ? 'Create Account' : 'Apply for Account')}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', marginTop: 20 }}>
          Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#fbbf24', cursor: 'pointer', fontWeight: 'bold' }}>Login here</span>
        </p>

      </div>
    </div>
  );
};

export default Register;
