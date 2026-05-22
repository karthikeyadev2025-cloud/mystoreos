import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { Clock, CheckCircle, Circle, RefreshCw, Phone, Store, Truck } from 'lucide-react';

const css = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  .ws-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);padding:20px;font-family:'Outfit',sans-serif}
  .ws-card{background:rgba(30,41,59,0.85);backdrop-filter:blur(20px);padding:40px 32px;border-radius:28px;border:1px solid rgba(255,255,255,0.1);max-width:480px;width:100%;box-shadow:0 30px 60px rgba(0,0,0,0.5);animation:fadeIn 0.4s ease}
  @media(max-width:480px){.ws-page{padding:12px;align-items:flex-start;padding-top:24px}.ws-card{padding:28px 18px;border-radius:20px}}
`;

const STEPS = [
  { key: 'submitted', label: 'Application Submitted', sub: 'Your details have been received' },
  { key: 'review',    label: 'Under Review',           sub: 'Admin is verifying your business' },
  { key: 'approved',  label: 'Account Activated',      sub: 'Ready to start selling!' },
];

function ProgressStepper() {
  return (
    <div style={{ margin: '32px 0', display: 'flex', alignItems: 'flex-start', gap: 0 }}>
      {STEPS.map((s, i) => {
        const done = i === 0;
        const active = i === 1;
        const last = i === STEPS.length - 1;
        return (
          <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {i > 0 && <div style={{ flex: 1, height: '2px', background: done ? '#10b981' : active ? 'linear-gradient(90deg,#10b981,#f59e0b)' : 'rgba(255,255,255,0.1)' }} />}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: done ? '#10b981' : active ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                border: done ? '2px solid #10b981' : active ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: active ? 'pulse 2s infinite' : 'none',
              }}>
                {done ? <CheckCircle size={18} color="#10b981" /> : active ? <Clock size={18} color="#f59e0b" /> : <Circle size={18} color="rgba(255,255,255,0.2)" />}
              </div>
              {!last && <div style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.1)' }} />}
            </div>
            <div style={{ marginTop: 10, textAlign: 'center', padding: '0 4px' }}>
              <div style={{ color: done ? '#10b981' : active ? '#f59e0b' : '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              <div style={{ color: '#475569', fontSize: '10px', marginTop: 2 }}>{s.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WaitingScreen() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.status === 'active') { navigate('/dashboard'); }
  }, [user, navigate]);

  const handleRefresh = async () => {
    if (!user?.phone) return;
    setChecking(true);
    setFeedback('');
    try {
      const fresh = await api.loginByPhone(user.phone);
      if (fresh?.status === 'active') {
        login(fresh);
        navigate('/dashboard');
      } else {
        setFeedback('Still under review. We\'ll notify you on WhatsApp once approved!');
      }
    } catch {
      setFeedback('Could not check status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const RoleIcon = user?.role === 'distributor' ? Truck : Store;
  const waText = encodeURIComponent(`Hi, I registered on MyStore OS as ${user?.name || 'a business'}. My mobile is ${user?.phone || ''}. Please approve my account.`);

  return (
    <>
      <style>{css}</style>
      <div className="ws-page">
        <div className="ws-card">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(139,92,246,0.2))', border: '2px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <RoleIcon size={30} color="#f59e0b" />
            </div>
            <h1 style={{ fontSize: '22px', color: '#f8fafc', margin: '0 0 6px', fontWeight: 900 }}>Application Under Review</h1>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>{user?.name || 'Your business'}</span> is pending admin approval
            </p>
          </div>

          <ProgressStepper />

          {/* Info box */}
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 700, marginBottom: 6 }}>What happens next?</div>
            <ul style={{ color: '#94a3b8', fontSize: '12px', margin: 0, paddingLeft: '16px', lineHeight: '1.8' }}>
              <li>Admin reviews your registration details</li>
              <li>Usually approved within 24 hours</li>
              <li>You'll receive a WhatsApp notification on <strong style={{ color: '#cbd5e1' }}>{user?.phone}</strong></li>
            </ul>
          </div>

          {feedback && (
            <div style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: 16, color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
              {feedback}
            </div>
          )}

          {/* Refresh button */}
          <button onClick={handleRefresh} disabled={checking} style={{
            width: '100%', padding: '14px', background: checking ? 'rgba(245,158,11,0.1)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
            color: checking ? '#f59e0b' : '#000', border: checking ? '1px solid rgba(245,158,11,0.4)' : 'none',
            borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: checking ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: 12,
            transition: 'all 0.2s',
          }}>
            <RefreshCw size={16} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
            {checking ? 'Checking...' : 'Check Approval Status'}
          </button>

          {/* WhatsApp support */}
          <a
            href={`https://wa.me/918885490495?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '100%', padding: '13px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)',
              borderRadius: '12px', fontSize: '14px', fontWeight: 700, color: '#25d366',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              textDecoration: 'none', boxSizing: 'border-box',
            }}
          >
            <Phone size={15} />
            Contact Support on WhatsApp
          </a>
        </div>
      </div>
    </>
  );
}
