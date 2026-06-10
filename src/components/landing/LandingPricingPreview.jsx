import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function LandingPricingPreview({ plans, distPlans, navigate }) {
  const [tab, setTab] = useState('shop');
  const active = tab === 'shop' ? plans : distPlans;

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#distributor') {
        setTab('distributor');
        setTimeout(() => {
          const el = document.getElementById('pricing');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else if (window.location.hash === '#pricing') {
        setTab('shop');
        setTimeout(() => {
          const el = document.getElementById('pricing');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return (
    <section id="pricing" style={{ padding: 'clamp(56px,7vw,90px) clamp(16px,5vw,24px)', background: 'linear-gradient(180deg,#030712,#050814)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>Simple, Honest Pricing</h2>
          <p style={{ color: '#64748b', fontSize: 16, marginTop: 10 }}>Start free. Upgrade when ready. Cancel anytime.</p>
          <div style={{ display: 'inline-flex', background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 4, marginTop: 20, gap: 4 }}>
            {['shop', 'distributor'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ background: tab === t ? 'rgba(244,63,94,0.15)' : 'transparent', border: `1px solid ${tab === t ? 'rgba(244,63,94,0.3)' : 'transparent'}`, color: tab === t ? '#f8fafc' : '#64748b', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s' }}>
                {t === 'shop' ? '🏪 Shopkeeper' : '🚚 Distributor'}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="pricing-grid" style={{ display: 'grid', gap: 20 }}>
          {active.map((p, i) => (
            <motion.div key={p.id || i}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              style={{ background: p.popular ? 'linear-gradient(135deg,rgba(244,63,94,0.08),rgba(139,92,246,0.08))' : '#1E293B', border: `1px solid ${p.popular ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 20, padding: 'clamp(20px,3vw,28px) clamp(16px,2.5vw,24px)', position: 'relative', overflow: 'hidden' }}>
              {p.popular && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#f43f5e,#8b5cf6)' }} />}
              {p.popular && <div style={{ position: 'absolute', top: 14, right: 16, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>POPULAR</div>}
              {/* Free badge */}
              {(p.price === 0 || p.id === 'free') && <div style={{ position: 'absolute', top: 14, right: 16, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>FREE FOREVER</div>}
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>{p.name}</div>
              <div style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 900, color: (p.price === 0 || p.id === 'free') ? '#10b981' : p.popular ? '#f43f5e' : '#f8fafc', marginBottom: 4 }}>
                {(p.price === 0 || p.id === 'free') ? 'Free' : `₹${(p.price || 0).toLocaleString('en-IN')}`}
                {(p.price > 0 && p.id !== 'free') && <span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>/mo</span>}
              </div>
              {p.description && <p style={{ color: '#64748b', fontSize: 13, margin: '8px 0 0' }}>{p.description}</p>}
              <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(p.features || []).map(f => (
                  <li key={f} style={{ color: '#94a3b8', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/register')} style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: (p.price === 0 || p.id === 'free') ? 'rgba(16,185,129,0.15)' : p.popular ? 'linear-gradient(135deg,#f43f5e,#8b5cf6)' : 'rgba(255,255,255,0.08)', color: (p.price === 0 || p.id === 'free') ? '#10b981' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', border: (p.price === 0 || p.id === 'free') ? '1px solid rgba(16,185,129,0.3)' : 'none' }}>
                {(p.price === 0 || p.id === 'free') ? 'Get Started Free' : 'Start Free Trial →'}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginTop: 36, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/pricing')}
            style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            View Full Pricing →
          </button>
          <button onClick={() => navigate('/register')}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            Start Free 15-Day Trial
          </button>
        </motion.div>
      </div>
      <style>{`
        .pricing-grid {
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
        }
        @media(max-width:540px){
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
