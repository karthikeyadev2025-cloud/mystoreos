import { useNavigate } from 'react-router-dom';

const S = {
  page: { minHeight: '100vh', background: '#030712', color: '#f8fafc', fontFamily: "'Outfit', sans-serif", padding: '0 0 60px' },
  hero: { background: 'linear-gradient(135deg, rgba(244,63,94,0.08), rgba(139,92,246,0.08)), #030712', padding: 'clamp(80px,10vw,120px) 24px 60px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  badge: { display: 'inline-block', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', padding: '6px 16px', borderRadius: 20, marginBottom: 20 },
  h1: { margin: '0 0 14px', fontSize: 'clamp(28px,4vw,52px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#fff' },
  sub: { margin: 0, fontSize: 16, color: '#94a3b8', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 },
  wrap: { maxWidth: 960, margin: '0 auto', padding: '0 24px' },
  section: { padding: '48px 24px' },
  card: { background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '28px 24px' },
  label: { fontSize: 11, fontWeight: 700, color: '#8b5cf6', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  h2: { margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#fff' },
  p: { margin: 0, color: '#94a3b8', lineHeight: 1.7, fontSize: 15 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: '#cbd5e1', margin: '4px' },
};

const STACK = [
  { icon: '⚛️', name: 'React 19', desc: 'PWA frontend' },
  { icon: '⚡', name: 'Vite 8', desc: 'Build system' },
  { icon: '🐘', name: 'Supabase', desc: 'Backend & auth' },
  { icon: '📦', name: 'Vercel', desc: 'Edge hosting' },
  { icon: '🔒', name: 'Row-Level Security', desc: 'Data isolation' },
  { icon: '🌐', name: 'PWA + Service Worker', desc: 'Offline mode' },
];

const TRUST = [
  { icon: '🔐', title: 'Bank-Grade Encryption', desc: 'All data encrypted at rest and in transit using AES-256 and TLS 1.3.' },
  { icon: '🧱', title: 'Row-Level Security', desc: 'Each shop sees only its own data — enforced at the database layer by Supabase RLS.' },
  { icon: '📵', title: 'Works Offline', desc: 'Full billing and inventory access without internet. Data syncs when reconnected.' },
  { icon: '🇮🇳', title: 'India-Hosted', desc: 'Infrastructure on Indian cloud edges for lowest latency for AP & Telangana shopkeepers.' },
];

export default function AboutUs() {
  const navigate = useNavigate();

  return (
    <div style={S.page}>
      {/* Nav back */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(3,7,18,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif' }}>
          ← Home
        </button>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>MyStore OS</span>
        <button onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #f43f5e, #8b5cf6)', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
          Start Free Trial
        </button>
      </div>

      {/* Hero */}
      <div style={S.hero}>
        <div style={{ paddingTop: 60 }}>
          <div style={S.badge}>About Us</div>
          <h1 style={S.h1}>K² ADEXOS<br />GLOBAL TECHNOLOGIES</h1>
          <p style={S.sub}>Building the operating system for India's 63 million small businesses — starting with kirana shops in Andhra Pradesh.</p>
        </div>
      </div>

      <div style={S.wrap}>

        {/* Mission */}
        <div style={{ ...S.section }}>
          <div style={{ ...S.card, borderLeft: '3px solid #f43f5e' }}>
            <div style={S.label}>Our Mission</div>
            <h2 style={S.h2}>Zero Paper. Full Control. Every Business.</h2>
            <p style={S.p}>
              MyStore OS exists to give every kirana shop, medical store, salon, tailor, and wholesale distributor in India a world-class digital operating system — without the complexity of Tally, the cost of SAP, or the hardware requirements of traditional POS. We believe digital transformation shouldn't be reserved for big businesses. Every shopkeeper deserves clean books, fast billing, and instant WhatsApp receipts.
            </p>
          </div>
        </div>

        {/* Founder */}
        <div style={{ padding: '0 24px 48px' }}>
          <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={S.label}>Founder & CEO</div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #f43f5e, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#fff', flexShrink: 0 }}>K</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ ...S.h2, marginBottom: 4 }}>Karthikeya Vempati</h2>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#8b5cf6', fontWeight: 700 }}>Founder &amp; CEO — K² ADEXOS GLOBAL TECHNOLOGIES</p>
                <p style={S.p}>Guntur, Andhra Pradesh-based entrepreneur building technology that empowers micro-retailers across India. Passionate about making enterprise-grade software accessible to every shopkeeper, regardless of size or tech literacy.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div style={{ padding: '0 24px 48px' }}>
          <div style={S.grid2}>
            <div style={S.card}>
              <div style={S.label}>Contact</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {[
                  { icon: '📍', label: 'Guntur, Andhra Pradesh, India' },
                  { icon: '📞', label: '+91-8885490495' },
                  { icon: '✉️', label: 'adexosindia@gmail.com' },
                ].map(({ icon, label }) => (
                  <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <span style={{ fontSize: 14, color: '#cbd5e1' }}>{label}</span>
                  </div>
                ))}
              </div>
              <a
                href="https://wa.me/918885490495?text=Hi%20Karthikeya%21%20I%20want%20to%20know%20more%20about%20MyStore%20OS."
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, background: '#25D366', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
              >
                💬 Chat on WhatsApp
              </a>
            </div>

            <div style={S.card}>
              <div style={S.label}>Legal</div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Company', 'K² ADEXOS GLOBAL TECHNOLOGIES'],
                  ['Product', 'MyStore OS'],
                  ['Founded', '2025'],
                  ['HQ', 'Guntur, AP, India'],
                  ['Disclaimer', 'Not affiliated with ONDC or Mystore.in'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                    <span style={{ color: '#64748b' }}>{k}</span>
                    <span style={{ color: '#f8fafc', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tech stack */}
        <div style={{ padding: '0 24px 48px' }}>
          <div style={S.label}>Technology Stack</div>
          <h2 style={{ ...S.h2, marginBottom: 20 }}>Built with Modern, Production-Grade Tech</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {STACK.map(({ icon, name, desc }) => (
              <div key={name} style={{ ...S.card, textAlign: 'center', padding: '20px 14px' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div style={{ padding: '0 24px 48px' }}>
          <div style={S.label}>Security &amp; Privacy</div>
          <h2 style={{ ...S.h2, marginBottom: 20 }}>Your Data is Safe with Us</h2>
          <div style={S.grid2}>
            {TRUST.map(({ icon, title, desc }) => (
              <div key={title} style={{ ...S.card, display: 'flex', gap: 14 }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{icon}</span>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</h3>
                  <p style={{ ...S.p, fontSize: 13 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: '0 24px', textAlign: 'center' }}>
          <div style={{ ...S.card, background: 'linear-gradient(135deg, rgba(244,63,94,0.06), rgba(139,92,246,0.06))', textAlign: 'center', padding: '40px 24px' }}>
            <h2 style={{ ...S.h2, marginBottom: 8 }}>Ready to go paperless?</h2>
            <p style={{ ...S.p, marginBottom: 24 }}>Start your free 7-day trial. No documents. No credit card.</p>
            <button onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #f43f5e, #8b5cf6)', border: 'none', color: '#fff', padding: '14px 36px', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              Start Free 7-Day Trial →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
