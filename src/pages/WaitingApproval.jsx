import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';
import { api } from '../lib/api';

export default function WaitingApproval() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.status === 'active') { navigate('/dashboard'); return; }
    if (user.role === 'customer') { navigate('/dashboard'); return; }
    // Defensive: if a shop/distributor lands here but hasn't completed the
    // onboarding form yet (closed the browser before step 3), send them
    // back to /onboarding to finish — otherwise admin sees a half-filled
    // application and can't approve.
    if ((user.role === 'shop' || user.role === 'distributor') && user.onboardingCompleted === false) {
      navigate('/onboarding');
      return;
    }
    const interval = setInterval(async () => {
      try {
        const fresh = await api.getUserById(user.id);
        if (fresh && fresh.status === 'active') {
          login(fresh);
          navigate('/dashboard');
        }
      } catch (_e) { /* status check failed, will retry */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [user, navigate, login]);

  const isDistributor = user?.role === 'distributor';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ background: 'rgba(30,41,59,0.9)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '48px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }}>

        <div style={{ fontSize: 64, marginBottom: 24 }}>⏳</div>

        <h1 style={{ color: 'var(--c-surface)', fontSize: 26, fontWeight: 900, margin: '0 0 12px' }}>
          Profile Under Review
        </h1>
        <p style={{ color: 'var(--c-faint)', fontSize: 15, lineHeight: 1.7, margin: '0 0 32px' }}>
          Thank you for registering <b style={{ color: 'var(--c-surface)' }}>{user?.name}</b>!<br />
          Our team is reviewing your {isDistributor ? 'distributor' : 'business'} profile.<br />
          You will be notified once approved.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {['Submitted ✅', 'Under Review 🔍', 'Approved ⭐'].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: i === 1 ? 'rgba(79,70,229,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 1 ? 'rgba(79,70,229,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? 'var(--c-success)' : i === 1 ? 'var(--c-primary)' : 'rgba(255,255,255,0.15)', flexShrink: 0, boxShadow: i === 1 ? '0 0 8px var(--c-primary)' : 'none' }} />
              <span style={{ color: i < 2 ? 'var(--c-surface)' : 'var(--c-muted)', fontSize: 14, fontWeight: i === 1 ? 700 : 400 }}>{step}</span>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--c-muted)', fontSize: 13, margin: '0 0 24px' }}>
          Typical approval time: within 24 hours<br />
          Support: <a href="/support" style={{ color: 'var(--c-success)' }}>Open Support</a>
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => window.location.reload()} style={{ background: 'linear-gradient(135deg, var(--c-primary), var(--c-primary-light))', border: 'none', borderRadius: 10, padding: '11px 24px', color: 'var(--c-surface)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Check Status
          </button>
          <button onClick={() => { logout(); navigate('/'); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 24px', color: 'var(--c-faint)', fontSize: 14, cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
