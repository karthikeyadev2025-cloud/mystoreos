import { useNavigate } from 'react-router-dom';

export default function AboutUs() {
  const navigate = useNavigate();

  return (
    <div style={{
      background: '#03060f',
      minHeight: '100vh',
      fontFamily: 'Outfit, sans-serif',
      color: '#f1f5f9',
      padding: '100px 20px 60px',
    }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 14,
            padding: '8px 16px',
            marginBottom: 48,
          }}
        >
          ← Back to Home
        </button>

        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 24,
        }}>
          K²
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem,5vw,3rem)',
          fontWeight: 900,
          margin: '0 0 16px',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: '#fff',
        }}>
          K² ADEXOS GLOBAL TECHNOLOGIES
        </h1>

        <p style={{
          color: '#94a3b8',
          fontSize: 18,
          lineHeight: 1.8,
          margin: '0 0 48px',
          maxWidth: 560,
        }}>
          A technology company born in India, building world-class business
          software for every Indian shop owner, distributor, and entrepreneur
          — regardless of their size or budget.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 48,
        }}>
          {[
            ['🎯', 'Our Mission', 'Make paperless billing accessible to every Indian business.'],
            ['🛡️', 'Offline-First', 'Works without internet. Data never lost.'],
            ['❤️', 'Built for Bharat', 'Designed for Indian shops, UPI, WhatsApp, GST.'],
            ['🔒', 'Your Data', 'Bank-grade security. Never sold. Always yours.'],
          ].map(([icon, title, desc]) => (
            <div
              key={title}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
              <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>{title}</h3>
              <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 48,
        }}>
          {[
            ['500+', 'Businesses'],
            ['₹2Cr+', 'GMV'],
            ['12', 'Cities'],
            ['99.9%', 'Uptime'],
          ].map(([num, label]) => (
            <div
              key={label}
              style={{
                background: 'rgba(244,63,94,0.06)',
                border: '1px solid rgba(244,63,94,0.12)',
                borderRadius: 14,
                padding: '20px 16px',
                textAlign: 'center',
              }}
            >
              <div style={{
                fontSize: 26, fontWeight: 900,
                background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {num}
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 18,
          padding: 32,
          marginBottom: 40,
        }}>
          <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 20px' }}>
            Contact Us
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <a
              href="mailto:adexosindia@gmail.com"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(251,191,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✉️</span>
              adexosindia@gmail.com
            </a>
            <a
              href="https://wa.me/918885490495"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💬</span>
              WhatsApp Support
            </a>
            <span style={{ color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📍</span>
              Andhra Pradesh, India
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate('/register')}
          style={{
            background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)',
            border: 'none',
            borderRadius: 12,
            padding: '14px 32px',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            marginBottom: 24,
          }}
        >
          Start Free 7-Day Trial 🚀
        </button>

        <p style={{ color: '#334155', fontSize: 12, textAlign: 'center', margin: 0 }}>
          © 2025 MyStore OS — K² ADEXOS GLOBAL TECHNOLOGIES
          &nbsp;·&nbsp;
          <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Privacy</button>
          &nbsp;·&nbsp;
          <button onClick={() => navigate('/terms')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Terms</button>
        </p>

      </div>
    </div>
  );
}
