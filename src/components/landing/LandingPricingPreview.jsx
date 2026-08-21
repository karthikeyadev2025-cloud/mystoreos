import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function LandingPricingPreview({ plans, servicePlans, distPlans, pricing, navigate }) {
  const [tab, setTab] = useState('shop');
  const [cycle, setCycle] = useState('monthly');
  const active = tab === 'shop' ? plans : tab === 'service' ? servicePlans : distPlans;

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
    <section id="pricing" style={{ padding: 'clamp(64px,8vw,104px) clamp(20px,5vw,48px)', background: 'var(--c-bg)', borderTop: '1px solid var(--c-line)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-accent-text)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: 'var(--c-ink)', letterSpacing: '-1px' }}>Simple, Honest Pricing</h2>
          <p style={{ color: 'var(--c-faint)', fontSize: 16, marginTop: 10 }}>Start free. Upgrade when ready. Cancel anytime.</p>
          <div style={{ display: 'inline-flex', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 4, marginTop: 20, gap: 4 }}>
            {['shop', 'service', 'distributor'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ background: tab === t ? 'var(--c-primary-soft)' : 'transparent', border: `1px solid ${tab === t ? 'var(--c-primary-border)' : 'transparent'}`, color: tab === t ? 'var(--c-primary)' : 'var(--c-muted)', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", transition: 'all 0.2s' }}>
                {t === 'shop' ? '🏪 Shopkeeper' : t === 'service' ? '💇 Service business' : '🚚 Distributor'}
              </button>
            ))}
          </div>

          {/* Billing cycle toggle (shop only, config-driven) */}
          {cycles.length > 1 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'inline-flex', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 4, gap: 4, flexWrap: 'wrap' }}>
                {cycles.map(c => {
                  const disc = c !== 'monthly' ? Number(pricing?.discounts?.[c]) || 0 : 0;
                  return (
                    <button key={c} onClick={() => setCycle(c)}
                      style={{ background: cycle === c ? 'linear-gradient(135deg,var(--c-primary-light),var(--c-primary))' : 'transparent', border: 'none', color: cycle === c ? 'var(--c-surface)' : 'var(--c-muted)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
                      {cycleLabel[c]}{disc > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: cycle === c ? 'var(--c-surface)' : 'var(--c-success-strong)', fontWeight: 800 }}>-{disc}%</span>}
                    </button>
                  );
                })}
              </div>
              {offerOn && cycle !== 'monthly' && (
                <div style={{ marginTop: 12, display: 'inline-block', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: 'var(--c-success-strong)', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 800 }}>
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
              style={{ background: 'var(--c-surface)', border: `1px solid ${p.popular ? 'var(--c-primary)' : 'var(--c-line)'}`, borderRadius: 16, boxShadow: p.popular ? '0 12px 32px -14px rgba(18,69,122,0.35)' : '0 1px 2px rgba(11,31,51,0.04)', padding: 'clamp(20px,3vw,28px) clamp(16px,2.5vw,24px)', position: 'relative', overflow: 'hidden' }}>
              {p.popular && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,var(--c-primary-light),var(--c-warning))' }} />}
              {p.popular && <div style={{ position: 'absolute', top: 14, right: 16, background: 'var(--c-accent)', color: 'var(--c-ink)', fontSize: 9.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', boxShadow: '0 2px 8px -2px rgba(18,69,122,0.35)' }}>POPULAR</div>}
              {isFree && <div style={{ position: 'absolute', top: 14, right: 16, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: 'var(--c-success-strong)', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>FREE FOREVER</div>}
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-ink)', marginBottom: 6 }}>{p.name}</div>
              <div style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 900, color: 'var(--c-ink)', marginBottom: 4 }}>
                {isFree ? 'Free' : (
                  tp ? (
                    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, color: 'var(--c-faint)', textDecoration: 'line-through', fontWeight: 600 }}>₹{tp.base.toLocaleString('en-IN')}</span>
                      <span>₹{tp.final.toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--c-faint)' }}>{cycleSuffix[cycle]}</span>
                    </span>
                  ) : (
                    <span>₹{monthlyBase(p).toLocaleString('en-IN')}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--c-faint)' }}>/mo</span></span>
                  )
                )}
              </div>
              {tp && <div style={{ color: 'var(--c-success-strong)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Save {tp.totalPct}% vs monthly</div>}
              {p.description && <p style={{ color: 'var(--c-faint)', fontSize: 13, margin: '8px 0 0' }}>{p.description}</p>}
              <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(p.features || []).map(f => (
                  <li key={f} style={{ color: 'var(--c-muted)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--c-success-strong)', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/register')} style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 10, background: p.popular ? 'var(--c-primary)' : 'var(--c-surface)', color: p.popular ? 'var(--c-ink-inverse)' : 'var(--c-primary)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif", border: p.popular ? 'none' : '1px solid rgba(255,255,255,0.16)' }}>
                {isFree ? 'Get Started Free' : 'Start Free Trial →'}
              </button>
            </motion.div>
            );
          })}
        </div>

        {/* Home Service Booking add-on — was advertising a DIFFERENT
            "Bookings add-on ₹249/mo" here that was never actually
            built or purchasable anywhere in the app (confirmed by
            tracing the whole codebase). Bookings itself is a plan-tier
            feature, not something anyone could actually buy separately.
            Replaced with the real add-on, and moved to show only under
            the Service tab specifically — it was previously showing
            regardless of which tab was active, including Distributor,
            which made no sense. */}
        {tab === 'service' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{
            marginTop: 32, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto',
            background: 'var(--c-surface)', border: '1px solid var(--c-line)',
            borderRadius: 8, padding: '28px 32px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 36 }}>🏠</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: 'var(--c-violet)', background: 'rgba(139,92,246,0.2)', padding: '3px 10px', borderRadius: 999, marginBottom: 6 }}>
                ADD-ON — ANY PLAN
              </div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--c-ink)', letterSpacing: '-0.5px' }}>
                Home Service Booking
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--c-muted)' }}>
                Let customers book at their own address — salons, spas, beauty, repairs
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--c-ink)', letterSpacing: '-1px' }}>
                ₹{pricing?.addons?.homeService ?? 199}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-muted)' }}>/mo</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-violet)', fontWeight: 600 }}>
                Works with Starter, Pro, or Enterprise
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10 }}>
            {[
              'Exact GPS for every visit address',
              'Staff check-in — on the way, arrived',
              'One-tap emergency alert for staff',
              'Optional per-visit travel fee',
              'Auto-alert if a visit runs overdue',
              'Same booking flow customers already use',
            ].map(f => (
              <div key={f} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--c-muted)' }}>
                <span style={{ color: 'var(--c-violet)', fontWeight: 800 }}>✓</span> {f}
              </div>
            ))}
          </div>
        </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginTop: 36, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/pricing')}
            style={{ background: 'var(--c-primary)', border: 'none', color: 'var(--c-ink-inverse)', padding: '14px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
            View Full Pricing →
          </button>
          <button onClick={() => navigate('/register')}
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', color: 'var(--c-ink)', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}>
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
