import { useNavigate } from 'react-router-dom';
import MLogo from '../components/MLogo';
import LandingNav from '../components/landing/LandingNav';
import LandingFooter from '../components/landing/LandingFooter';
import { T, F, LANDING_CSS } from '../components/landing/_tokens';

// The company's own story, told the same way the product tells a shop
// owner's day: dated entries, ruled apart, figures at the end.

const ENTRIES = [
  ['2023', 'The problem', 'Shop owners across India were closing out each night by hand — tallying paper ledgers, losing track of who owed what, missing stock that had already gone bad. One missed entry could cost a week\u2019s profit.'],
  ['2024', 'The obsession', 'We sat inside kirana stores past 11pm watching owners fight calculators and notebooks. The question became specific: could one app replace every piece of paper — bills, stock, credit book, staff records — and still run on a ₹5,000 phone?'],
  ['2024', 'The build', 'Version after version, tested in real shops across Andhra Pradesh. When the internet dropped, the app kept working. When the power cut, the data survived. We didn\u2019t ship until both were true.'],
  ['2025', 'The launch', 'MyStore OS went live — not another billing app, but the books for a whole business: retail, wholesale, distribution, and, not long after, appointments and services too.'],
  ['Today', 'The mission', 'We are K² ADEXOS GLOBAL TECHNOLOGIES, building for India. Make proper business software affordable to every shop owner and every service business, regardless of size or budget.'],
];

const VALUES = [
  ['Relentless simplicity', 'If a shop owner can\u2019t use it in thirty seconds, we rebuild it until they can.'],
  ['Offline first, always', 'Indian networks are unpredictable. The software works whether or not the internet does.'],
  ['Built for Bharat', 'UPI, WhatsApp, GST, khata — every feature assumes Indian business realities, not a translated template.'],
  ['Your data, your trust', 'Bank-grade encryption. Never sold. Privacy isn\u2019t a feature here — it\u2019s the foundation everything else sits on.'],
];

export default function AboutUs() {
  const navigate = useNavigate();

  return (
    <div style={{ background: T.void, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{LANDING_CSS}</style>
      <LandingNav navigate={navigate} />

      {/* Header */}
      <header style={{
        background: T.voidLift, borderBottom: `1px solid ${T.edge}`,
        padding: 'clamp(56px,7vw,88px) clamp(20px,5vw,48px) clamp(44px,5vw,60px)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="lx-glow" style={{
          width: 500, height: 500, top: -220, right: '-10%',
          background: `radial-gradient(circle, ${T.brandGlow}, transparent 65%)`,
        }} />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
            <MLogo size={40} radius={11} />
            <span style={{ fontFamily: F.display, fontSize: 18, fontWeight: 800, color: T.text }}>
              {'MyStore OS'}
            </span>
          </div>
          <span className="lx-eyebrow">About</span>
          <h1 className="lx-title" style={{ fontSize: 'clamp(30px,4.6vw,48px)', margin: '14px 0 12px', maxWidth: '14ch' }}>
            Why we started keeping the books.
          </h1>
          <p className="lx-lede" style={{ maxWidth: 540 }}>
            A record of how a notebook on a shop counter became a platform for
            both kinds of business it was built to serve.
          </p>
        </div>
      </header>

      {/* Story — dated entries */}
      <main style={{ padding: 'clamp(48px,6vw,72px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto 72px' }}>
          <div style={{ borderTop: `2px solid ${T.text}` }}>
            {ENTRIES.map(([year, title, body], i) => (
              <div key={year + title} className="lx-post" style={{
                display: 'grid', gridTemplateColumns: '84px 1fr', gap: 20,
                padding: '26px 0', borderBottom: `1px solid ${T.edge}`,
                animationDelay: `${i * 60}ms`,
              }}>
                <span className="lx-fig" style={{ fontSize: 13, color: T.brandBright, fontWeight: 500, paddingTop: 3 }}>{year}</span>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 17.5, fontWeight: 700, color: T.text, marginBottom: 8, letterSpacing: '-0.015em' }}>{title}</div>
                  <div style={{ fontFamily: F.body, fontSize: 14.5, color: T.textSoft, lineHeight: 1.8, maxWidth: '62ch' }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Values — lit cards, same language as Features */}
        <div style={{ maxWidth: 900, margin: '0 auto 72px' }}>
          <span className="lx-eyebrow">What we hold to</span>
          <h2 className="lx-title" style={{ fontSize: 'clamp(24px,3.4vw,34px)', marginBottom: 30 }}>Four rules, kept without exception.</h2>
          <div className="lx-values-grid">
            {VALUES.map(([title, body], i) => (
              <div key={title} className="lx-post lx-surface lx-surface-hover" style={{ padding: 22, animationDelay: `${i * 70}ms` }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8, letterSpacing: '-0.01em' }}>{title}</div>
                <div style={{ fontFamily: F.body, fontSize: 13.5, color: T.textSoft, lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Close */}
        <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', paddingTop: 12 }}>
          <p style={{ fontFamily: F.body, fontSize: 15, color: T.textSoft, lineHeight: 1.75, marginBottom: 24 }}>
            If you keep a shop or run a service business and you\u2019re still doing this by hand,
            we\u2019d like fifteen days to change your mind.
          </p>
          <button className="lx-btn lx-btn-primary" onClick={() => navigate('/register')}>
            Start free for 15 days
          </button>
        </div>
      </main>

      <LandingFooter navigate={navigate} />

      <style>{`
        .lx-values-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (max-width: 640px) { .lx-values-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
