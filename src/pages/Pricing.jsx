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
  { label: 'Zoho CRM export', starter: false, pro: false, enterprise: true },
  { label: 'Priority 24/7 support', starter: false, pro: false, enterprise: true },
];

const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes — every account starts with a 7-day free trial on PRO features. No credit card required.' },
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

function PlanCard({ plan, idx, popular, onCta }) {
  const TIER_STYLES = [
    { border: 'rgba(100,116,139,0.5)', glow: '' },
    { border: '#8b5cf6', glow: '0 0 40px rgba(139,92,246,0.25)' },
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
        <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#8b5cf6,#f43f5e)', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '4px 14px', borderRadius: '99px', whiteSpace: 'nowrap', boxShadow: '0 0 20px rgba(139,92,246,0.5)', animation: 'pulse 2s ease-in-out infinite' }}>
          ⭐ Most Popular
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{plan.name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '42px', fontWeight: 900, color: '#f8fafc' }}>₹{(plan.price || 0).toLocaleString('en-IN')}</span>
          <span style={{ color: '#64748b', fontSize: '14px' }}>/month</span>
        </div>
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
          background: popular ? 'linear-gradient(135deg,#f43f5e,#8b5cf6)' : 'rgba(255,255,255,0.06)',
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
    const locked = [
      !caps.staffAccounts && { label: 'Staff accounts', on: false },
      !caps.batchExpiry && { label: 'Batch/expiry tracking', on: false },
      !caps.gst && { label: 'GST billing', on: false },
      !caps.tallyExport && { label: 'Tally export', on: false },
      !caps.caPortal && { label: 'CA portal', on: false },
      !caps.multiDevice && { label: 'Multi-device sync', on: false },
    ].filter(Boolean);
    return [...base, ...locked];
  }
  return plan.features || [];
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#f8fafc', fontSize: '15px', fontWeight: 600, textAlign: 'left', gap: '16px', fontFamily: 'Outfit,sans-serif' }}>
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

  useEffect(() => {
    const prev = document.title;
    document.title = 'Pricing — MyStore OS | Free 7-Day Trial';
    setMeta('description', 'Simple, transparent pricing for Indian shopkeepers and FMCG distributors. Start free, upgrade anytime. Plans from ₹499/month.');
    safe(() => api.getSubscriptionPlans()).then(p => { if (p?.length) setPlans(p); });
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
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
        @media(max-width:900px){.plan-grid{flex-direction:column!important} .plan-grid>*{transform:none!important}}
      `}</style>

      {/* Nav */}
      <nav style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', maxWidth: '1200px', margin: '0 auto' }}>
        <Link to="/" style={{ color: '#f43f5e', fontWeight: 900, fontSize: '18px', textDecoration: 'none' }}>MyStore OS</Link>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/login" style={{ color: '#94a3b8', fontSize: '14px', textDecoration: 'none', padding: '8px 16px' }}>Sign In</Link>
          <Link to="/register" style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', color: '#fff', fontSize: '14px', fontWeight: 700, textDecoration: 'none', padding: '8px 18px', borderRadius: '8px' }}>Start Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '80px 24px 56px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '24px' }}>
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
              style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: 'Outfit,sans-serif', transition: 'all 0.2s',
                background: mode === m ? 'linear-gradient(135deg,#f43f5e,#8b5cf6)' : 'transparent',
                color: mode === m ? '#fff' : '#94a3b8' }}>
              {m === 'shops' ? '🏪 For Shops' : '🚚 For Distributors'}
            </button>
          ))}
        </div>
      </section>

      {/* Plan Cards */}
      <section style={{ padding: '0 24px 72px', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="plan-grid" style={{ display: 'flex', gap: '24px', alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap' }}>
          {(mode === 'shops' ? shopPlans : DIST_PLANS).map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} idx={i} popular={plan.popular || (mode === 'shops' ? plan.id === 'pro' : plan.id === 'pro_distributor')} />
          ))}
        </div>
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
                    <th style={{ ...S.th, color: '#a78bfa' }}>PRO</th>
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
        <div style={{ background: 'linear-gradient(135deg,rgba(244,63,94,0.1),rgba(139,92,246,0.08))', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '24px', padding: '48px 32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎁</div>
          <h2 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900, margin: '0 0 12px' }}>All plans start with 7 days FREE on PRO features</h2>
          <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 32px' }}>
            No credit card required &nbsp;•&nbsp; Cancel anytime &nbsp;•&nbsp; Instant setup
          </p>
          <Link to="/register"
            style={{ display: 'inline-block', background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', color: '#fff', fontWeight: 800, fontSize: '16px', padding: '16px 40px', borderRadius: '12px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(244,63,94,0.3)' }}>
            Start Your Free Trial →
          </Link>
          <p style={{ marginTop: '16px', fontSize: '12px', color: '#475569' }}>
            Already have an account? <Link to="/login" style={{ color: '#94a3b8' }}>Sign in</Link>
          </p>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>
        © 2026 MyStore OS · K² ADEXOS GLOBAL TECHNOLOGIES · Hyderabad, Telangana, India
      </footer>
    </div>
  );
}
