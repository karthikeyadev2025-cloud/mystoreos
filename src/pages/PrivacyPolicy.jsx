import { useNavigate } from 'react-router-dom';

const S = {
  page: { minHeight: '100vh', background: '#030712', color: '#f1f5f9', fontFamily: 'Outfit, sans-serif' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(12px)', zIndex: 100 },
  logo: { fontSize: 18, fontWeight: 800, color: '#fff', cursor: 'pointer', letterSpacing: '-0.5px' },
  backBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  hero: { textAlign: 'center', padding: 'clamp(48px,6vw,80px) 24px 32px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  badge: { display: 'inline-block', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase' },
  h1: { fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-1px' },
  sub: { color: '#64748b', fontSize: 15, margin: 0 },
  body: { maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' },
  section: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 32px', marginBottom: 20 },
  h2: { fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10 },
  p: { color: '#94a3b8', lineHeight: 1.75, fontSize: 15, margin: '0 0 12px' },
  ul: { color: '#94a3b8', lineHeight: 1.75, fontSize: 15, paddingLeft: 20, margin: '0 0 12px' },
  highlight: { color: '#10b981', fontWeight: 600 },
  footer: { textAlign: 'center', padding: '24px', borderTop: '1px solid rgba(255,255,255,0.04)', color: '#334155', fontSize: 13 },
};

const SECTIONS = [
  {
    icon: '📋', title: 'Introduction',
    content: () => (
      <>
        <p style={S.p}>MyStore OS, operated by <span style={S.highlight}>K² ADEXOS GLOBAL TECHNOLOGIES</span>, respects your privacy and is committed to protecting your personal data. This policy explains how we collect, use, and safeguard your information when you use our platform.</p>
        <p style={S.p}>By using MyStore OS, you agree to the collection and use of information in accordance with this policy.</p>
      </>
    ),
  },
  {
    icon: '📊', title: 'Data We Collect',
    content: () => (
      <>
        <p style={S.p}>We collect the following types of information:</p>
        <ul style={S.ul}>
          <li><strong>Identity</strong> — business name, owner name, phone number</li>
          <li><strong>Transaction data</strong> — orders, invoices, product catalogue, credit ledger</li>
          <li><strong>Device info</strong> — browser type, OS, device model (for PWA optimisation)</li>
          <li><strong>Location</strong> — GPS coordinates if you enable the nearby-shop discovery feature</li>
          <li><strong>Payment metadata</strong> — plan tier, payment date via Razorpay (we never store card numbers)</li>
        </ul>
      </>
    ),
  },
  {
    icon: '🎯', title: 'How We Use It',
    content: () => (
      <>
        <p style={S.p}>Your data is used exclusively to:</p>
        <ul style={S.ul}>
          <li>Provide billing, inventory, and GST management services</li>
          <li>Generate analytics and reports for your own business</li>
          <li>Improve platform features and fix bugs</li>
          <li>Send critical service notifications (trial expiry, payment confirmation)</li>
        </ul>
        <p style={S.p}><span style={S.highlight}>We never sell, rent, or share your data with third parties for advertising or marketing purposes.</span></p>
      </>
    ),
  },
  {
    icon: '🏢', title: 'Data Storage',
    content: () => (
      <p style={S.p}>All data is stored on <span style={S.highlight}>Supabase</span> hosted on AWS Mumbai region (<span style={S.highlight}>ap-south-1</span>). Your business data never leaves India. Row-Level Security ensures your data is isolated from other tenants. Backups are taken daily with 30-day retention.</p>
    ),
  },
  {
    icon: '⚖️', title: 'Your Rights',
    content: () => (
      <>
        <p style={S.p}>You have the right to:</p>
        <ul style={S.ul}>
          <li><strong>Access</strong> — download all your data in CSV/JSON format from the Data Exports section</li>
          <li><strong>Correct</strong> — update your business name, phone number, or UPI ID at any time</li>
          <li><strong>Delete</strong> — request permanent deletion of your account and all associated data by emailing us</li>
          <li><strong>Portability</strong> — export your product catalogue, orders, and credits in standard formats</li>
        </ul>
      </>
    ),
  },
  {
    icon: '🔐', title: 'Security',
    content: () => (
      <p style={S.p}>We implement industry-standard security: <span style={S.highlight}>256-bit SSL/TLS</span> for all data in transit, <span style={S.highlight}>AES-256 encryption</span> for data at rest, <span style={S.highlight}>bcrypt password hashing</span> (no plain-text passwords ever stored), and Supabase Row-Level Security to prevent cross-tenant data access. We undergo regular security audits.</p>
    ),
  },
  {
    icon: '🍪', title: 'Cookies',
    content: () => (
      <p style={S.p}>We use only <span style={S.highlight}>essential session cookies</span> required to keep you logged in. We do not use tracking cookies, advertising cookies, or third-party analytics cookies. You can clear cookies at any time via your browser settings.</p>
    ),
  },
  {
    icon: '✉️', title: 'Contact Us',
    content: () => (
      <>
        <p style={S.p}>For any privacy-related requests — data deletion, data export, or questions about this policy — contact us:</p>
        <p style={S.p}><span style={S.highlight}>Email:</span> adexosindia@gmail.com</p>
        <p style={S.p}><span style={S.highlight}>WhatsApp:</span> +91 88854 90495</p>
        <p style={S.p}>We respond to all privacy requests within 48 hours.</p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <span style={S.logo} onClick={() => navigate('/')}>MyStore OS</span>
        <button style={S.backBtn} onClick={() => navigate('/')}>← Back to Home</button>
      </nav>

      <div style={S.hero}>
        <div style={S.badge}>Legal</div>
        <h1 style={S.h1}>Privacy Policy</h1>
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
        © 2026 MyStore OS · K² ADEXOS GLOBAL TECHNOLOGIES · Guntur, Andhra Pradesh, India
      </footer>
    </div>
  );
}
