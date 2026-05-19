import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Store, ShieldCheck } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../lib/firebase';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // OTP State
  const [useOtp, setUseOtp] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const user = await api.login(phone, pass);
      login(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if(phone.length < 10) return setError("Enter a valid 10-digit mobile number");
    
    try {
      setLoading(true);
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible'
        });
      }
      
      const formatPhone = '+91' + phone; // Default to India
      const confirmationResult = await signInWithPhoneNumber(auth, formatPhone, window.recaptchaVerifier);
      window.confirmationResult = confirmationResult;
      
      setOtpSent(true);
      toast.success("OTP sent securely via Firebase!");
    } catch (err) {
      setError(err.message || "Failed to send OTP. Check Firebase config.");
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if(otp.length < 4) return setError("Enter valid OTP");
    
    try {
      setLoading(true);
      
      // If demo mode (for testing without SMS)
      if (otp === '1234' && (phone === '0000000000' || phone === '9876543210' || phone === '8888888888')) {
        const user = await api.login(phone, '1234');
        login(user);
        navigate('/dashboard');
        return;
      }

      // Real Firebase Verification
      await window.confirmationResult.confirm(otp);
      
      // OTP matched! Now fetch the user from our Database
      const user = await api.loginByPhone(phone);
      login(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || "Invalid OTP or User not found");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', padding: 20 }}>
      <ToastContainer theme="dark" />
      <div style={{ background: 'rgba(30,41,59,0.8)', backdropFilter: 'blur(20px)', padding: '40px 30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 400, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <Store size={48} color="#fbbf24" style={{ margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '28px', color: '#fff', margin: '0 0 10px 0', fontWeight: 900 }}>Welcome Back</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Login to MyStore OS</p>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px' }}>
          <button onClick={() => {setUseOtp(true); setOtpSent(false); setError('');}} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: useOtp ? '#3b82f6' : 'transparent', color: useOtp ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>OTP Login</button>
          <button onClick={() => {setUseOtp(false); setError('');}} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: !useOtp ? '#3b82f6' : 'transparent', color: !useOtp ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>Password Login</button>
        </div>

        {useOtp ? (
          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' }}>Mobile Number</label>
              <input 
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={otpSent}
                placeholder="10-digit mobile number"
                style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '15px' }}
              />
            </div>
            
            {otpSent && (
              <div style={{ marginBottom: 30 }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' }}>Enter 4-digit OTP</label>
                <input 
                  type="text" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={4}
                  placeholder="e.g. 1234"
                  style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }}
                />
              </div>
            )}
            
            <button disabled={loading} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <ShieldCheck size={20} />
              {loading ? 'Processing...' : (otpSent ? 'Verify & Login' : 'Send Firebase OTP')}
            </button>
            <div id="recaptcha-container" style={{marginTop: 16, display: 'flex', justifyContent: 'center'}}></div>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' }}>Mobile Number</label>
              <input 
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '15px' }}
              />
            </div>
            <div style={{ marginBottom: 30 }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: 8, fontWeight: 'bold' }}>Password</label>
              <input 
                type="password" value={pass} onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '15px' }}
              />
            </div>
            <button disabled={loading} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(59,130,246,0.3)' }}>
              {loading ? 'Logging in...' : 'Login securely'}
            </button>
          </form>
        )}
        
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', marginTop: 20 }}>
          Don't have an account? <span onClick={() => navigate('/register')} style={{ color: '#fbbf24', cursor: 'pointer', fontWeight: 'bold' }}>Register here</span>
        </p>

        <div style={{ marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          <b>Demo Logins (Pass/OTP: 1234)</b><br/>
          Admin: 0000000000 • Shop: 9876543210<br/>
          Distributor: 8888888888
        </div>
      </div>
    </div>
  );
};

export default Login;
