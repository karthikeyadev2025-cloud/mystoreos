
import { useNavigate } from 'react-router-dom';
import { useSiteConfig } from '../lib/siteConfig';

const S = {
  page: { minHeight: '100vh', background: '#030712', color: '#f1f5f9', fontFamily: 'Outfit, sans-serif' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(12px)', zIndex: 100 },
  logo: { fontSize: 18, fontWeight: 800, color: '#fff', cursor: 'pointer', letterSpacing: '-0.5px' },
  backBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  hero: { textAlign: 'center', padding: 'clamp(48px,6vw,80px) 24px 48px' },
  badge: { display: 'inline-block', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase' },
  h1: { fontSize: 'clamp(28px,4vw,52px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-1px' },
  sub: { color: '#64748b', fontSize: 16, margin: 0 },
  body: { maxWidth: 960, margin: '0 auto', padding: '0 24px 80px' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 48 },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '32px 24px', textAlign: 'center', transition: 'border-color 0.2s' },
  cardIcon: { fontSize: 40, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 8 },
  cardDesc: { color: '#64748b', fontSize: 14, marginBottom: 20, lineHeight: 1.6 },
  cardBtn: { display: 'inline-block', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', textDecoration: 'none' },
  formSection: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '36px', marginBottom: 40 },
  formTitle: { fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 },
  formSub: { color: '#64748b', fontSize: 14, marginBottom: 28 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  input: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: '#f1f5f9', fontSize: 14, fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box', outline: 'none' },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: '#f1f5f9', fontSize: 14, fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box', outline: 'none', resize: 'vertical', minHeight: 120 },
  sendBtn: { background: '#25D366', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', marginTop: 8 },
  faqSection: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '36px' },
  faqTitle: { fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 20 },
  faqItem: { borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '16px 0' },
  faqQ: { color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 6 },
  faqA: { color: '#64748b', fontSize: 14, lineHeight: 1.6 },
  footer: { textAlign: 'center', padding: '24px', borderTop: '1px solid rgba(255,255,255,0.04)', color: '#334155', fontSize: 13 },
};

const FAQS = [
  { q: 'How do I start a free trial?', a: 'Click "Start Free Trial" on the home page, register with your phone number, and get 15 days of PRO access instantly — no credit card needed.' },
  { q: 'Can I import my existing products?', a: 'Yes. Go to Inventory → Import CSV and upload a spreadsheet with your product list. Supports up to 5,000 products per import.' },
  { q: 'Does it work offline?', a: 'Yes. MyStore OS is a Progressive Web App. Billing and inventory work fully offline and sync automatically when you reconnect.' },
  { q: 'How do I generate a GST invoice?', a: 'Enter your GSTIN in Settings. Every bill you generate will automatically include GST breakdown and QR code.' },
  { q: 'How do I cancel my subscription?', a: 'Go to Settings → Subscription and click "Cancel Plan". Your data is retained permanently regardless of plan status.' },
];

export default function ContactUs() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const supportEmail = config?.supportEmail || 'adexosindia@gmail.com';

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <span style={S.logo} onClick={() => navigate('/')}>MyStore OS</span>
        <button style={S.backBtn} onClick={() => navigate('/')}>← Back to Home</button>
      </nav>

      <div style={S.hero}>
        <div style={S.badge}>Support</div>
        <h1 style={S.h1}>We're Here to Help</h1>
        <p style={S.sub}>Get instant answers from our AI assistant or raise a support ticket — our team responds fast.</p>
      </div>

      <div style={S.body}>
        <div style={S.cards}>
          <div style={S.card}>
            <div style={S.cardIcon}>💬</div>
            <div style={S.cardTitle}>In-App Support</div>
            <div style={S.cardDesc}>Chat with our AI assistant for instant answers, or raise a ticket and our team will reply right inside the app.</div>
            <button onClick={() => navigate('/support')} style={{ ...S.cardBtn, background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', color: '#fff', border: 'none', cursor: 'pointer' }}>Open Support</button>
          </div>

          <div style={S.card}>
            <div style={S.cardIcon}>✉️</div>
            <div style={S.cardTitle}>Email</div>
            <div style={S.cardDesc}>{supportEmail}<br />For billing queries, legal notices, or feature requests.</div>
            <a href={`mailto:${supportEmail}`} style={{ ...S.cardBtn, background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)' }}>Send Email</a>
          </div>

          <div style={S.card}>
            <div style={S.cardIcon}>📍</div>
            <div style={S.cardTitle}>Location</div>
            <div style={S.cardDesc}>Hyderabad, Telangana, India<br />Mon–Sat · 9 AM – 7 PM IST</div>
            <span style={{ ...S.cardBtn, background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', cursor: 'default' }}>India-Based Team</span>
          </div>
        </div>

        <div style={S.formSection}>
          <div style={S.formTitle}>Send Us a Message</div>
          <div style={S.formSub}>Raise a ticket inside the app — chat with our AI assistant or get a reply from our team, all tracked in one place.</div>
          <button style={S.sendBtn} onClick={() => navigate('/support')}>
            💬 Go to Support
          </button>
        </div>

        <div style={S.faqSection}>
          <div style={S.faqTitle}>Frequently Asked Questions</div>
          {FAQS.map((f, i) => (
            <div key={i} style={S.faqItem}>
              <div style={S.faqQ}>{f.q}</div>
              <div style={S.faqA}>{f.a}</div>
            </div>
          ))}
        </div>
      </div>

      <footer style={S.footer}>
        © 2026 MyStore OS · K² ADEXOS GLOBAL TECHNOLOGIES · Hyderabad, Telangana, India
      </footer>
    </div>
  );
}
