import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';

const safe = async (fn, fallback = null) => { try { return await fn(); } catch { return fallback; } };

const setMeta = (name, content) => {
  let t = document.head.querySelector(`meta[name="${name}"]`);
  if (!t) { t = document.createElement('meta'); t.setAttribute('name', name); document.head.appendChild(t); }
  t.setAttribute('content', content);
};

/* ─── Static distributor plans ─────────────────────────────────────── */
const DIST_PLANS = [
  { id: 'basic_distributor', name: 'Basic Distributor', price: 999, popular: false,
    features: [
      { label: 'Up to 10 assigned shops', on: true },
      { label: 'Stock order management', on: true },
      { label: 'Credit ledger (payables + receivables)', on: true },
      { label: 'WhatsApp order sharing', on: true },
      { label: 'Basic sales reports', on: true },
      { label: 'Route planner', on: false },
      { label: 'Bulk CSV export', on: false },
      { label: 'Tally ERP export', on: false },
      { label: 'Multi-device', on: false },
    ],
  },
  { id: 'pro_distributor', name: 'Pro Distributor', price: 2499, popular: true,
    features: [
      { label: 'Up to 50 assigned shops', on: true },
      { label: 'Everything in Basic', on: true },
      { label: 'Route planner (credit + distance)', on: true },
      { label: 'Bulk order CSV export', on: true },
      { label: 'Tally ERP export', on: true },
      { label: 'Multi-device (3 devices)', on: true },
      { label: 'Advanced analytics', on: true },
      { label: 'Auto payment reminders', on: true },
    ],
  },
  { id: 'enterprise_distributor', name: 'Enterprise Distributor', price: 4999, popular: false,
    features: [
      { label: 'Unlimited shops', on: true },
      { label: 'Everything in Pro', on: true },
      { label: 'Multi-branch support', on: true },
      { label: 'API access', on: true },
      { label: 'Custom branded reports', on: true },
      { label: 'Staff delivery agent accounts', on: true },
      { label: 'Priority 24/7 support', on: true },
    ],
  },
];

/* ─── Feature comparison rows ───────────────────────────────────────── */
const COMPARE = [
  { label: 'Products', starter: 'Up to 200', pro: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Devices', starter: '1', pro: '1', enterprise: '5' },
  { label: 'Digital billing & invoicing', starter: true, pro: true, enterprise: true },
  { label: 'WhatsApp bill sharing', starter: true, pro: true, enterprise: true },
  { label: 'Day Book (profit/loss)', starter: true, pro: true, enterprise: true },
  { label: 'Standard bill templates', starter: true, pro: true, enterprise: true },
  { label: 'Staff accounts + PIN locks', starter: false, pro: true, enterprise: true },
  { label: 'Batch & expiry tracking', starter: false, pro: true, enterprise: true },
  { label: 'UPI payment links', starter: false, pro: true, enterprise: true },
  { label: 'Auto-reorder alerts', starter: false, pro: true, enterprise: true },
  { label: 'Customer CRM', starter: false, pro: true, enterprise: true },
  { label: 'Expense tracker', starter: false, pro: true, enterprise: true },
  { label: 'Loyalty points', starter: false, pro: true, enterprise: true },
  { label: 'Flash sales', starter: false, pro: true, enterprise: true },
  { label: 'GST compliance (CGST/SGST/IGST)', starter: false, pro: false, enterprise: true },
  { label: 'Tally ERP XML export', starter: false, pro: false, enterprise: true },
  { label: 'GSTR-1 CSV generation', starter: false, pro: false, enterprise: true },
  { label: 'CA portal access', starter: false, pro: false, enterprise: true },
  { label: 'Multi-device sync', starter: false, pro: false, enterprise: true },
  { label: 'Custom invoice branding', starter: false, pro: false, enterprise: true },
  { label: '📅 Service Bookings & Appointments', starter: '₹249/mo add-on', pro: true, enterprise: true },
  { label: 'Zoho CRM export', starter: false, pro: false, enterprise: true },
  { label: 'Priority 24/7 support', starter: false, pro: false, enterprise: true },
];

const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes — every account starts with a 15-day free trial on PRO features. No credit card required.' },
  { q: 'Can I change my plan anytime?', a: 'Absolutely. Upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the next renewal.' },
  { q: 'How does billing work?', a: 'Plans are billed monthly via Razorpay (UPI, cards, net banking). You\'ll receive a digital receipt by WhatsApp.' },
  { q: 'What happens when my trial ends?', a: 'Your data is safe. Billing is paused and you\'ll be prompted to choose a plan. Existing bills and inventory remain accessible.' },
  { q: 'Do you offer annual discounts?', a: 'Yes — pay annually and get 2 months free (17% off). Contact support to switch to annual billing.' },
];

/* ─── Shared style tokens ───────────────────────────────────────────── */
const S = {
  check: { color: '#10b981', flexShrink: 0 },
  cross: { color: '#475569', flexShrink: 0 },
  th: { padding: '14px 16px', background: 'rgba(255,255,255,0.02)', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' },
  td: { padding: '12px 16px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center', color: '#94a3b8' },
  tdLabel: { padding: '12px 16px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'left', color: '#f8fafc', fontWeight: 500 },
};

function Cell({ val }) {
  if (val === true) return <Check size={16} style={S.check} />;
  if (val === false) return <X size={16} style={S.cross} />;
  return <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '13px' }}>{val}</span>;
}

function PlanCard({ plan, idx, popular, onCta, cycle = 'monthly', pricing = null, isShop = true }) {
  const TIER_STYLES = [
    { border: 'rgba(100,116,139,0.5)', glow: '' },
    { border: '#4F46E5', glow: '0 0 40px rgba(79,70,229,0.25)' },
    { border: 'rgba(245,158,11,0.7)', glow: '' },
  ];
  const ts = TIER_STYLES[idx] || TIER_STYLES[0];
  const features = plan.features || plan.capabilities
    ? buildFeaturesFromPlan(plan)
    : [];

  return (
    <div style={{
      background: popular ? 'linear-gradient(160deg,#1e1b4b,#0f172a)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${ts.border}`,
      borderRadius: '20px',
      padding: '32px 28px',
      display: 'flex', flexDirection: 'column',
      boxShadow: ts.glow,
      transform: popular ? 'scale(1.03)' : 'none',
      position: 'relative',
      flex: 1, minWidth: '260px',
    }}>
      {popular && (
        <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#818CF8,#4F46E5)', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '4px 14px', borderRadius: '99px', whiteSpace: 'nowrap', boxShadow: '0 0 20px rgba(79,70,229,0.5)', animation: 'pulse 2s ease-in-out infinite' }}>
          ⭐ Most Popular
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{plan.name}</div>
        {(() => {
          const cycleSuffix = { monthly: '/month', quarterly: '/3 months', yearly: '/year' };
          let pr = null;
          if (pricing && cycle !== 'monthly') {
            const base = Number(pricing.tiers?.[plan.id]?.[cycle]) || 0;
            if (base) {
              const cd = Number(pricing.discounts?.[cycle]) || 0;
              const afterCycle = Math.round(base * (1 - cd / 100));
              const offerOn = !!pricing.offer?.enabled && Number(pricing.offer?.remaining) > 0 && Number(pricing.offer?.percent) > 0;
              const final = offerOn ? Math.round(afterCycle * (1 - Number(pricing.offer.percent) / 100)) : afterCycle;
              pr = { base, final, totalPct: cd + (offerOn ? Number(pricing.offer.percent) : 0) };
            }
          }
          if (pr) {
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '22px', color: '#64748b', textDecoration: 'line-through', fontWeight: 700 }}>₹{pr.base.toLocaleString('en-IN')}</span>
                  <span style={{ fontSize: '42px', fontWeight: 900, color: '#f8fafc' }}>₹{pr.final.toLocaleString('en-IN')}</span>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>{cycleSuffix[cycle]}</span>
                </div>
                <div style={{ color: '#10b981', fontSize: '13px', fontWeight: 700, marginTop: 4 }}>Save {pr.totalPct}% vs monthly</div>
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '42px', fontWeight: 900, color: '#f8fafc' }}>₹{(plan.price || 0).toLocaleString('en-IN')}</span>
              <span style={{ color: '#64748b', fontSize: '14px' }}>{cycleSuffix.monthly}</span>
            </div>
          );
        })()}
        {plan.description && <p style={{ fontSize: '13px', color: '#64748b', marginTop: '10px', lineHeight: 1.5 }}>{plan.description}</p>}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: f.on ? '#f8fafc' : '#475569' }}>
            {f.on ? <Check size={15} style={S.check} /> : <X size={15} style={S.cross} />}
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      <Link to="/register" onClick={onCta}
        style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none',
          background: popular ? 'linear-gradient(135deg,#4F46E5,#818CF8)' : 'rgba(255,255,255,0.06)',
          border: popular ? 'none' : `1px solid ${ts.border}`,
          color: '#fff', transition: 'opacity 0.2s',
        }}>
        Start Free Trial
      </Link>
    </div>
  );
}

function buildFeaturesFromPlan(plan) {
  if (plan.features && Array.isArray(plan.features) && typeof plan.features[0] === 'object' && 'on' in plan.features[0]) {
    return plan.features;
  }
  if (plan.features && Array.isArray(plan.features) && typeof plan.features[0] === 'string') {
    const caps = plan.capabilities || {};
    const base = plan.features.map(f => ({ label: f, on: true }));
    // Service-business capabilities — highlighted so a salon/spa/clinic
    // prospect immediately sees the value of upgrading.
    const serviceOn = [
      // Show the services cap for anyone: unlimited on Pro+, small
      // starter cap otherwise. Never shown as "off" — shown as label.
      caps.maxServices === -1 && { label: 'Unlimited services & bookings', on: true },
      caps.maxServices > 0 && caps.maxServices !== -1 && { label: `Up to ${caps.maxServices} services`, on: true },
      caps.serviceStaffAssignment    && { label: 'Multi-staff scheduling', on: true },
      caps.serviceBufferTime         && { label: 'Buffer time between bookings', on: true },
      caps.serviceCustomerSelfService&& { label: 'Customer self-service reschedule', on: true },
      caps.serviceReminders          && { label: 'Automated booking reminders', on: true },
      caps.serviceProviderHours      && { label: 'Per-staff working hours', on: true },
      caps.serviceRecurring          && { label: 'Recurring / weekly bookings', on: true },
    ].filter(Boolean);
    const locked = [
      !caps.staffAccounts && { label: 'Staff accounts', on: false },
      !caps.batchExpiry && { label: 'Batch/expiry tracking', on: false },
      !caps.gst && { label: 'GST billing', on: false },
      !caps.tallyExport && { label: 'Tally export', on: false },
      !caps.caPortal && { label: 'CA portal', on: false },
      !caps.multiDevice && { label: 'Multi-device sync', on: false },
      !caps.serviceStaffAssignment && caps.maxServices !== -1 && { label: 'Multi-staff scheduling', on: false },
      !caps.serviceCustomerSelfService && caps.maxServices !== -1 && { label: 'Customer self-service links', on: false },
      !caps.serviceRecurring && { label: 'Recurring bookings', on: false },
    ].filter(Boolean);
    return [...base, ...serviceOn, ...locked];
  }
  return plan.features || [];
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#f8fafc', fontSize: '15px', fontWeight: 600, textAlign: 'left', gap: '16px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <span>{q}</span>
        {open ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </button>
      {open && <p style={{ margin: '0 0 18px', fontSize: '14px', color: '#94a3b8', lineHeight: 1.7 }}>{a}</p>}
    </div>
  );
}

export default function Pricing() {
  const [mode, setMode] = useState('shops');
  const [plans, setPlans] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [cycle, setCycle] = useState('monthly');

  useEffect(() => {
    const prev = document.title;
    document.title = 'Pricing — MyStore OS | Free 15-Day Trial';
    setMeta('description', 'Simple, transparent pricing for Indian shopkeepers and FMCG distributors. Start free, upgrade anytime. Plans from ₹499/month.');
    safe(() => api.getSubscriptionPlans()).then(p => { if (p?.length) setPlans(p); });
    safe(() => api.getPricing()).then(d => d && setPricing(d));
    return () => { document.title = prev; };
  }, []);

  const shopPlans = plans.length
    ? plans
    : [
        { id: 'starter', name: 'Starter', price: 499, popular: false, features: [
            { label: 'Up to 200 products', on: true }, { label: 'Digital billing & invoicing', on: true },
            { label: 'Basic Day Book', on: true }, { label: 'Single device', on: true },
            { label: 'Standard bill templates', on: true }, { label: 'WhatsApp bill sharing', on: true },
            { label: 'Staff accounts', on: false }, { label: 'Batch/expiry tracking', on: false },
            { label: 'GST billing', on: false }, { label: 'Tally export', on: false }, { label: 'CA portal', on: false },
          ] },
        { id: 'pro', name: 'PRO', price: 999, popular: true, features: [
            { label: 'Unlimited products', on: true }, { label: 'Everything in Starter', on: true },
            { label: 'WhatsApp invoice sharing', on: true }, { label: 'Staff accounts + PIN locks', on: true },
            { label: 'Batch & expiry tracking', on: true }, { label: 'UPI payment links', on: true },
            { label: 'Auto-reorder alerts', on: true }, { label: 'Customer CRM', on: true },
            { label: 'Expense tracker', on: true }, { label: 'Loyalty points', on: true },
            { label: 'Flash sales', on: true }, { label: 'GST billing', on: false },
            { label: 'Tally export', on: false }, { label: 'Multi-device sync', on: false },
          ] },
        { id: 'enterprise', name: 'Enterprise', price: 2499, popular: false, features: [
            { label: 'Everything in PRO', on: true }, { label: 'GST compliance (CGST/SGST/IGST)', on: true },
            { label: 'Tally ERP XML export', on: true }, { label: 'GSTR-1 CSV generation', on: true },
            { label: 'CA portal access', on: true }, { label: 'Multi-device sync (5 devices)', on: true },
            { label: 'Custom invoice branding', on: true }, { label: 'Priority 24/7 support', on: true },
            { label: 'Advanced analytics', on: true }, { label: 'Zoho CRM export', on: true },
          ] },
      ];

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f8fafc', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
        @media(max-width:900px){.plan-grid{flex-direction:column!important} .plan-grid>*{transform:none!important}}
      `}</style>

      {/* Nav */}
      <nav style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', maxWidth: '1200px', margin: '0 auto' }}>
        <Link to="/" style={{ color: '#4F46E5', fontWeight: 900, fontSize: '18px', textDecoration: 'none' }}>MyStore OS</Link>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/login" style={{ color: '#94a3b8', fontSize: '14px', textDecoration: 'none', padding: '8px 16px' }}>Sign In</Link>
          <Link to="/register" style={{ background: 'linear-gradient(135deg,#4F46E5,#818CF8)', color: '#fff', fontSize: '14px', fontWeight: 700, textDecoration: 'none', padding: '8px 18px', borderRadius: '8px' }}>Start Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '80px 24px 56px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#818CF8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '24px' }}>
          Pricing
        </div>
        <h1 style={{ fontSize: 'clamp(32px,6vw,56px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.1 }}>
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: '18px', color: '#94a3b8', margin: '0 0 36px' }}>
          Start free. Upgrade when ready. Cancel anytime.
        </p>

        {/* Toggle */}
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          {['shops', 'distributors'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s',
                background: mode === m ? 'linear-gradient(135deg,#4F46E5,#818CF8)' : 'transparent',
                color: mode === m ? '#fff' : '#94a3b8' }}>
              {m === 'shops' ? '🏪 For Shops' : '🚚 For Distributors'}
            </button>
          ))}
        </div>
      </section>

      {/* Plan Cards */}
      <section style={{ padding: '0 24px 72px', maxWidth: '1100px', margin: '0 auto' }}>
        {pricing && (() => {
          const cycles = ['monthly', 'quarterly', 'yearly'].filter(c => pricing.enabledCycles?.[c]);
          if (cycles.length <= 1) return null;
          const offerOn = !!pricing.offer?.enabled && Number(pricing.offer?.remaining) > 0 && Number(pricing.offer?.percent) > 0;
          const lbl = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
          return (
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 4, gap: 4, flexWrap: 'wrap' }}>
                {cycles.map(c => {
                  const d = c !== 'monthly' ? Number(pricing.discounts?.[c]) || 0 : 0;
                  return (
                    <button key={c} onClick={() => setCycle(c)} style={{ background: cycle === c ? 'linear-gradient(135deg,#818CF8,#4F46E5)' : 'transparent', border: 'none', color: cycle === c ? '#fff' : '#94a3b8', padding: '10px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      {lbl[c]}{d > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: cycle === c ? '#fff' : '#10b981', fontWeight: 800 }}>-{d}%</span>}
                    </button>
                  );
                })}
              </div>
              {offerOn && cycle !== 'monthly' && (
                <div style={{ marginTop: 12, display: 'inline-block', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', borderRadius: 20, padding: '6px 18px', fontSize: 13, fontWeight: 800 }}>
                  🎉 Launch offer: extra {pricing.offer.percent}% OFF — only {pricing.offer.remaining} slots left!
                </div>
              )}
            </div>
          );
        })()}
        <div className="plan-grid" style={{ display: 'flex', gap: '24px', alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap' }}>
          {(mode === 'shops' ? shopPlans : DIST_PLANS).map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} idx={i} cycle={cycle} pricing={pricing} isShop={mode === 'shops'} popular={plan.popular || (mode === 'shops' ? plan.id === 'pro' : plan.id === 'pro_distributor')} />
          ))}
        </div>

        {/* Bookings Add-on — shops only. Free during trial, included in
            Pro/Enterprise, ₹249/mo standalone add-on for Starter plan. */}
        {mode === 'shops' && (
          <div style={{
            marginTop: 40, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(236,72,153,0.09))',
            border: '1px solid rgba(139,92,246,0.35)', borderRadius: 20, padding: '28px 32px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 38 }}>📅</div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#a78bfa', background: 'rgba(139,92,246,0.2)', padding: '3px 10px', borderRadius: 999, marginBottom: 6 }}>
                  ADD-ON FOR SALONS, SPAS, CLINICS & GYMS
                </div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>Service Bookings Module</h3>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: '#94a3b8' }}>
                  Let customers book appointments online — you manage them from one dashboard.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
                  ₹249<span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>/mo</span>
                </div>
                <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>FREE with Pro / Enterprise</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 10, paddingTop: 4, borderTop: '1px solid rgba(139,92,246,0.2)' }}>
              {[
                'Customer online booking page',
                'Service catalogue & pricing',
                'Slot-based appointment calendar',
                'One-tap Confirm / Complete / Cancel',
                'Customer visit history',
                'WhatsApp notification on new booking',
              ].map(f => (
                <div key={f} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 13, color: '#cbd5e1' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 800, flexShrink: 0 }}>✓</span> {f}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Feature Comparison Table (shops only) */}
      {mode === 'shops' && (
        <section style={{ padding: '0 24px 72px', maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, textAlign: 'center', margin: '0 0 36px' }}>Full Feature Comparison</h2>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, textAlign: 'left', width: '40%' }}>Feature</th>
                    <th style={S.th}>Starter</th>
                    <th style={{ ...S.th, color: '#818CF8' }}>PRO</th>
                    <th style={{ ...S.th, color: '#fbbf24' }}>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={S.tdLabel}>{row.label}</td>
                      <td style={S.td}><div style={{ display: 'flex', justifyContent: 'center' }}><Cell val={row.starter} /></div></td>
                      <td style={S.td}><div style={{ display: 'flex', justifyContent: 'center' }}><Cell val={row.pro} /></div></td>
                      <td style={S.td}><div style={{ display: 'flex', justifyContent: 'center' }}><Cell val={row.enterprise} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section style={{ padding: '0 24px 72px', maxWidth: '720px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, textAlign: 'center', margin: '0 0 40px' }}>Frequently Asked Questions</h2>
        {FAQS.map((f, i) => <FAQ key={i} q={f.q} a={f.a} />)}
      </section>

      {/* Trial CTA banner */}
      <section style={{ padding: '0 24px 96px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(129,140,248,0.08))', border: '1px solid rgba(79,70,229,0.25)', borderRadius: '24px', padding: '48px 32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎁</div>
          <h2 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900, margin: '0 0 12px' }}>All plans start with 15 days FREE on PRO features</h2>
          <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 32px' }}>
            No credit card required &nbsp;•&nbsp; Cancel anytime &nbsp;•&nbsp; Instant setup
          </p>
          <Link to="/register"
            style={{ display: 'inline-block', background: 'linear-gradient(135deg,#4F46E5,#818CF8)', color: '#fff', fontWeight: 800, fontSize: '16px', padding: '16px 40px', borderRadius: '12px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(79,70,229,0.3)' }}>
            Start Your Free Trial →
          </Link>
          <p style={{ marginTop: '16px', fontSize: '12px', color: '#475569' }}>
            Already have an account? <Link to="/login" style={{ color: '#94a3b8' }}>Sign in</Link>
          </p>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px 24px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>An innovation by</span>
          <div style={{
            fontSize: 16, fontWeight: 800, marginTop: 4,
            background: 'linear-gradient(90deg,#818CF8,#F0ABFC)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Nikki Tech Labs
          </div>
        </div>
        © 2026 MyStore OS · Hyderabad, Telangana, India
      </footer>
    </div>
  );
}
