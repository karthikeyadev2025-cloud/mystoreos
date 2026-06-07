import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TRUST = ['GST Compliant', 'UPI Ready', 'WhatsApp Billing', 'Tally Export', 'Works Offline', 'Razorpay'];

function Counter({ target, duration = 1800 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setVal(Math.round(target * ease));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

export default function LandingHero({ hero = {}, navigate: nav, config = {} }) {
  const navigate = nav || useNavigate();
  const headline = (hero.headline || 'The Operating System\nfor Modern Business').split('\n');

  const METRICS = [
    { label: 'Active Outlets',   val: 12847,  suffix: '+',  prefix: '' },
    { label: 'Daily Invoices',   val: 240000, suffix: '+',  prefix: '', fmt: v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v.toLocaleString('en-IN') },
    { label: 'GMV Processed',    val: 842,    suffix: 'Cr+', prefix: '₹' },
    { label: 'States Covered',   val: 28,     suffix: '+',  prefix: '' },
  ];

  return (
    <section style={{
      minHeight: '100vh', background: '#0D1117', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '80px 40px 60px', position: 'relative', overflow: 'hidden',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
        backgroundSize: '44px 44px',
      }}/>
      {/* Blue radial glow */}
      <div style={{
        position: 'absolute', top: '38%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 700, height: 700,
        background: 'radial-gradient(ellipse,rgba(79,70,229,0.13),transparent 65%)',
        pointerEvents: 'none',
      }}/>

      {/* Logo */}
      <div style={{ marginBottom: 20, animation: 'fadeSlide .3s ease both' }}>
        <img src="/logo.png" alt="MyStore OS" style={{ height: 56, objectFit: 'contain', display: 'block', margin: '0 auto' }}/>
      </div>

      {/* Trust badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.35)',
        borderRadius: 20, padding: '5px 16px', marginBottom: 28,
        animation: 'fadeSlide .4s ease both',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s infinite' }}/>
        <span style={{ color: '#93C5FD', fontSize: 12, fontWeight: 600 }}>India's #1 Enterprise Retail Operating System</span>
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: 'clamp(36px,5vw,58px)', fontWeight: 800,
        lineHeight: 1.1, letterSpacing: '-.03em',
        margin: '0 0 18px', maxWidth: 780, animation: 'fadeSlide .4s .06s ease both',
      }}>
        {headline.map((line, i) => (
          <span key={i} style={{ display: 'block',
            ...(i === headline.length - 1 ? {
              background: 'linear-gradient(135deg,#2563EB,#60A5FA,#93C5FD)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            } : { color: '#fff' }),
          }}>{line}</span>
        ))}
      </h1>

      {/* Subheadline */}
      <p style={{
        color: 'rgba(255,255,255,0.52)', fontSize: 18, lineHeight: 1.72,
        maxWidth: 560, margin: '0 0 38px', animation: 'fadeSlide .4s .12s ease both',
      }}>
        {hero.subheadline || 'Complete billing, inventory, credit, and analytics — built for Indian shopkeepers and FMCG distributors.'}
      </p>

      {/* CTAs */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
        marginBottom: 36, animation: 'fadeSlide .4s .18s ease both',
      }}>
        <button onClick={() => navigate('/register')} style={{
          background: '#4F46E5', color: '#fff', border: 'none',
          padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
          cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          boxShadow: '0 0 36px rgba(79,70,229,0.55)',
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'filter .15s',
        }}
          onMouseEnter={e => e.currentTarget.style.filter='brightness(1.12)'}
          onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Start Free 14-Day Trial
        </button>
        <button onClick={() => navigate('/login')} style={{
          background: 'transparent', color: 'rgba(255,255,255,0.75)',
          border: '1.5px solid rgba(255,255,255,0.22)',
          padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600,
          cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'border-color .15s, color .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.5)'; e.currentTarget.style.color='#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.22)'; e.currentTarget.style.color='rgba(255,255,255,0.75)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
          </svg>
          View Live Demo
        </button>
      </div>

      {/* Trust pills */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
        marginBottom: 52, animation: 'fadeSlide .4s .24s ease both',
      }}>
        {TRUST.map(t => (
          <span key={t} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: '5px 13px', color: 'rgba(255,255,255,0.58)', fontSize: 12,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {t}
          </span>
        ))}
      </div>

      {/* Metrics strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        gap: 0, maxWidth: 860, width: '100%',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, overflow: 'hidden', animation: 'fadeSlide .4s .3s ease both',
      }}>
        {METRICS.map(({ label, val, suffix, prefix, fmt }, i) => (
          <div key={i} style={{
            padding: '24px 20px', textAlign: 'center',
            borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }}>
            <div style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
              {prefix}<Counter target={val} duration={1600 + i * 200}/>{suffix}
              {fmt && (() => {
                /* handled inside Counter via fmt — skip duplicate */
                return null;
              })()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, fontWeight: 500, marginTop: 7 }}>{label}</div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeSlide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
        @keyframes gradMove{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
      `}</style>
    </section>
  );
}
