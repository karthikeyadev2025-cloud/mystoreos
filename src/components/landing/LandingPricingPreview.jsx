import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function LandingPricingPreview({ plans, distPlans, pricing, navigate }) {
  const [tab, setTab] = useState('shop');
  const [cycle, setCycle] = useState('monthly');
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

  // Config-driven cycles + offer (both shop and distributor read pricing_v2)
  const cycles = pricing ? ['monthly', 'quarterly', 'yearly'].filter(c => pricing.enabledCycles?.[c]) : ['monthly'];
  const offerOn = !!pricing?.offer?.enabled && Number(pricing?.offer?.remaining) > 0 && Number(pricing?.offer?.percent) > 0;
  const cycleSuffix = { monthly: '/mo', quarterly: '/3mo', yearly: '/yr' };
  const cycleLabel = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

  // Resolve the monthly base price for a plan from pricing_v2 (falls back to the
  // plan's own .price). Works for both shop and distributor tiers.
  const monthlyBase = (p) => Number(pricing?.tiers?.[p.id]?.monthly) || Number(p.price) || 0;

  // Compute a tier's price for the selected cycle from pricing_v2.
  const tierPrice = (p) => {
    if (!pricing || cycle === 'monthly' || p.price === 0 || p.id === 'free') return null;
    const base = Number(pricing.tiers?.[p.id]?.[cycle]) || 0;
    if (!base) return null;
    const cycleDisc = Number(pricing.discounts?.[cycle]) || 0;
    const afterCycle = Math.round(base * (1 - cycleDisc / 100));
    const final = offerOn ? Math.round(afterCycle * (1 - Number(pricing.offer.percent) / 100)) : afterCycle;
    return { base, final, totalPct: cycleDisc + (offerOn ? Number(pricing.offer.percent) : 0) };
  };

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
                style={{ background: tab === t ? 'rgba(244,63,94,0.15)' : 'transparent', border: `1px solid ${tab === t ? 'rgba(244,63,94,0.3)' : 'transparent'}`, color: tab === t ? '#f8fafc' : '#64748b', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s' }}>
                {t === 'shop' ? '🏪 Shopkeeper' : '🚚 Distributor'}
              </button>
            ))}
          </div>

          {/* Billing cycle toggle (shop only, config-driven) */}
          {cycles.length > 1 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'inline-flex', background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 4, gap: 4, flexWrap: 'wrap' }}>
                {cycles.map(c => {
                  const disc = c !== 'monthly' ? Number(pricing?.discounts?.[c]) || 0 : 0;
                  return (
                    <button key={c} onClick={() => setCycle(c)}
                      style={{ background: cycle === c ? 'linear-gradient(135deg,#f43f5e,#8b5cf6)' : 'transparent', border: 'none', color: cycle === c ? '#fff' : '#94a3b8', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      {cycleLabel[c]}{disc > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: cycle === c ? '#fff' : '#10b981', fontWeight: 800 }}>-{disc}%</span>}
                    </button>
                  );
                })}
              </div>
              {offerOn && cycle !== 'monthly' && (
                <div style={{ marginTop: 12, display: 'inline-block', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 800 }}>
                  🎉 Launch offer: extra {pricing.offer.percent}% OFF — only {pricing.offer.remaining} slots left!
                </div>
              )}
            </div>
          )}
        </motion.div>

        <div className="pricing-grid" style={{ display: 'grid', gap: 20 }}>
          {active.map((p, i) => {
            const tp = tierPrice(p);
            const isFree = (p.price === 0 || p.id === 'free');
            return (
            <motion.div key={p.id || i}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              style={{ background: p.popular ? 'linear-gradient(135deg,rgba(244,63,94,0.08),rgba(139,92,246,0.08))' : '#1E293B', border: `1px solid ${p.popular ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 20, padding: 'clamp(20px,3vw,28px) clamp(16px,2.5vw,24px)', position: 'relative', overflow: 'hidden' }}>
              {p.popular && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#f43f5e,#8b5cf6)' }} />}
              {p.popular && <div style={{ position: 'absolute', top: 14, right: 16, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>POPULAR</div>}
              {isFree && <div style={{ position: 'absolute', top: 14, right: 16, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>FREE FOREVER</div>}
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>{p.name}</div>
              <div style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 900, color: isFree ? '#10b981' : p.popular ? '#f43f5e' : '#f8fafc', marginBottom: 4 }}>
                {isFree ? 'Free' : (
                  tp ? (
                    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, color: '#64748b', textDecoration: 'line-through', fontWeight: 600 }}>₹{tp.base.toLocaleString('en-IN')}</span>
                      <span>₹{tp.final.toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>{cycleSuffix[cycle]}</span>
                    </span>
                  ) : (
                    <span>₹{monthlyBase(p).toLocaleString('en-IN')}<span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>/mo</span></span>
                  )
                )}
              </div>
              {tp && <div style={{ color: '#10b981', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Save {tp.totalPct}% vs monthly</div>}
              {p.description && <p style={{ color: '#64748b', fontSize: 13, margin: '8px 0 0' }}>{p.description}</p>}
              <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(p.features || []).map(f => (
                  <li key={f} style={{ color: '#94a3b8', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/register')} style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 10, background: isFree ? 'rgba(16,185,129,0.15)' : p.popular ? 'linear-gradient(135deg,#f43f5e,#8b5cf6)' : 'rgba(255,255,255,0.08)', color: isFree ? '#10b981' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', border: isFree ? '1px solid rgba(16,185,129,0.3)' : 'none' }}>
                {isFree ? 'Get Started Free' : 'Start Free Trial →'}
              </button>
            </motion.div>
            );
          })}
        </div>

        {/* Bookings Add-on card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{
            marginTop: 32, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.10))',
            border: '1px solid rgba(139,92,246,0.35)', borderRadius: 20, padding: '28px 32px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 36 }}>📅</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#a78bfa', background: 'rgba(139,92,246,0.2)', padding: '3px 10px', borderRadius: 999, marginBottom: 6 }}>
                POPULAR ADD-ON
              </div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.5px' }}>
                Bookings Module
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                For salons, spas, clinics, gyms, and workshops
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>
                ₹249<span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>/mo</span>
              </div>
              <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>
                or FREE with Pro / Enterprise
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10 }}>
            {[
              'Customer online booking',
              'Service catalogue & pricing',
              'Slot-based appointments',
              'One-tap confirm & complete',
              'Visit history per customer',
              'WhatsApp booking updates',
            ].map(f => (
              <div key={f} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#cbd5e1' }}>
                <span style={{ color: '#a78bfa', fontWeight: 800 }}>✓</span> {f}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginTop: 36, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/pricing')}
            style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            View Full Pricing →
          </button>
          <button onClick={() => navigate('/register')}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
