import { useNavigate } from 'react-router-dom';

const S = {
  page: { minHeight: '100vh', background: '#030712', color: '#f1f5f9', fontFamily: 'Plus Jakarta Sans, sans-serif' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(12px)', zIndex: 100 },
  logo: { fontSize: 18, fontWeight: 800, color: '#fff', cursor: 'pointer', letterSpacing: '-0.5px' },
  backBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  hero: { textAlign: 'center', padding: 'clamp(48px,6vw,80px) 24px 32px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  badge: { display: 'inline-block', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase' },
  h1: { fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-1px' },
  sub: { color: '#64748b', fontSize: 15, margin: 0 },
  body: { maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' },
  section: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 32px', marginBottom: 20 },
  h2: { fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10 },
  p: { color: '#94a3b8', lineHeight: 1.75, fontSize: 15, margin: '0 0 12px' },
  ul: { color: '#94a3b8', lineHeight: 1.75, fontSize: 15, paddingLeft: 20, margin: '0 0 12px' },
  highlight: { color: '#60a5fa', fontWeight: 600 },
  warn: { color: '#f59e0b', fontWeight: 600 },
  footer: { textAlign: 'center', padding: '24px', borderTop: '1px solid rgba(255,255,255,0.04)', color: '#334155', fontSize: 13 },
};

const SECTIONS = [
  {
    icon: '✅', title: 'Acceptance of Terms',
    content: () => (
      <p style={S.p}>By registering for or using MyStore OS, you agree to be bound by these Terms of Service and our <a href="/privacy" style={{ color: '#60a5fa' }}>Privacy Policy</a>. If you do not agree, please do not use the platform. These terms constitute a legally binding agreement between you and <span style={S.highlight}>K² ADEXOS GLOBAL TECHNOLOGIES</span>.</p>
    ),
  },
  {
    icon: '🛍️', title: 'Service Description',
    content: () => (
      <>
        <p style={S.p}>MyStore OS is a <span style={S.highlight}>cloud-based billing and inventory management platform</span> designed for Indian retail businesses. It provides GST invoicing, inventory tracking, credit ledger management, WhatsApp integration, distributor networking, and analytics.</p>
        <p style={S.p}>The service is provided on a subscription basis with optional free trial periods.</p>
      </>
    ),
  },
  {
    icon: '🎁', title: 'Free Trial',
    content: () => (
      <>
        <p style={S.p}>New accounts receive a <span style={S.highlight}>15-day free trial</span> of PRO features. No credit card is required to start a trial.</p>
        <p style={S.p}>After the trial period, your account will be downgraded to the Starter plan unless you subscribe. Your data is retained regardless of plan.</p>
      </>
    ),
  },
  {
    icon: '💳', title: 'Subscription & Billing',
    content: () => (
      <>
        <p style={S.p}>Subscriptions are billed monthly on a recurring basis via <span style={S.highlight}>Razorpay</span>. Available plans:</p>
        <ul style={S.ul}>
          <li><strong>Starter</strong> — Free, limited features</li>
          <li><strong>PRO</strong> — ₹499/month, full features</li>
          <li><strong>Enterprise</strong> — ₹999/month, multi-outlet + API access</li>
        </ul>
        <p style={S.p}>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</p>
      </>
    ),
  },
  {
    icon: '↩️', title: 'Refund Policy',
    content: () => (
      <p style={S.p}><span style={S.warn}>No refunds are issued after the 15-day trial period.</span> We encourage you to fully test all features during the trial before subscribing. In exceptional circumstances (billing errors, double charges), contact us within 7 days of the charge for a review.</p>
    ),
  },
  {
    icon: '⚠️', title: 'Acceptable Use',
    content: () => (
      <>
        <p style={S.p}>You agree NOT to:</p>
        <ul style={S.ul}>
          <li>Use the platform for any illegal activity or to facilitate tax evasion</li>
          <li>Scrape, crawl, or programmatically extract data from the platform</li>
          <li>Resell access to the platform or attempt to sublicense it</li>
          <li>Reverse-engineer, decompile, or copy any part of the software</li>
          <li>Upload malware, spam, or any content that violates Indian law</li>
        </ul>
        <p style={S.p}>Violations may result in immediate account suspension without refund.</p>
      </>
    ),
  },
  {
    icon: '©️', title: 'Intellectual Property',
    content: () => (
      <>
        <p style={S.p}><span style={S.highlight}>K² ADEXOS GLOBAL TECHNOLOGIES</span> retains all rights to the MyStore OS software, code, design, brand, and algorithms.</p>
        <p style={S.p}><span style={S.highlight}>You own your data.</span> Your product catalogue, orders, customer records, and business data belong to you. You may export it at any time, and we will never use it for our own commercial purposes.</p>
      </>
    ),
  },
  {
    icon: '🛡️', title: 'Limitation of Liability',
    content: () => (
      <p style={S.p}>MyStore OS is not liable for any indirect, incidental, or consequential damages including lost profits, lost data, or business interruption arising from use of the platform. Our maximum liability in any circumstance is limited to the amount you paid us in the 3 months preceding the claim.</p>
    ),
  },
  {
    icon: '⚖️', title: 'Governing Law',
    content: () => (
      <p style={S.p}>These terms are governed by the laws of the <span style={S.highlight}>Republic of India</span>. Any disputes shall be subject to the exclusive jurisdiction of courts in <span style={S.highlight}>Hyderabad, Telangana</span>.</p>
    ),
  },
  {
    icon: '✉️', title: 'Contact',
    content: () => (
      <>
        <p style={S.p}>For questions about these terms, contact us:</p>
        <p style={S.p}><span style={S.highlight}>Email:</span> adexosindia@gmail.com</p>
        <p style={S.p}><span style={S.highlight}>Support:</span> Raise a ticket in-app at /support</p>
      </>
    ),
  },
];

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <span style={S.logo} onClick={() => navigate('/')}>MyStore OS</span>
        <button style={S.backBtn} onClick={() => navigate('/')}>← Back to Home</button>
      </nav>

      <div style={S.hero}>
        <div style={S.badge}>Legal</div>
        <h1 style={S.h1}>Terms of Service</h1>
        <p style={S.sub}>Last updated: May 2025 · K² ADEXOS GLOBAL TECHNOLOGIES</p>
      </div>

      <div style={S.body}>
        {SECTIONS.map((sec, i) => (
          <div key={i} style={S.section}>
            <h2 style={S.h2}><span>{sec.icon}</span>{sec.title}</h2>
            {sec.content()}
          </div>
        ))}
      </div>

      <footer style={S.footer}>
        © 2026 MyStore OS · K² ADEXOS GLOBAL TECHNOLOGIES · Hyderabad, Telangana, India
      </footer>
    </div>
  );
}
