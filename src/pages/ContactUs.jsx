import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, MapPin, ArrowRight } from 'lucide-react';
import { useSiteConfig } from '../lib/siteConfig';
import LandingNav from '../components/landing/LandingNav';
import LandingFooter from '../components/landing/LandingFooter';
import { T, F, LANDING_CSS } from '../components/landing/_tokens';

const FAQS = [
  { q: 'How do I start a free trial?', a: 'Register with your phone number from the home page and get 15 days of full access instantly — no card needed.' },
  { q: 'Can I import my existing products?', a: 'Yes. Inventory → Import CSV, up to 5,000 products per upload.' },
  { q: 'Does it work offline?', a: 'Yes. Billing and inventory both work fully offline and sync automatically once you\u2019re back online.' },
  { q: 'How do I generate a GST invoice?', a: 'Add your GSTIN in Settings — every bill after that includes the GST breakdown and QR code automatically.' },
  { q: 'How do I cancel my subscription?', a: 'Settings → Subscription → Cancel Plan. Your data stays yours regardless of plan status.' },
];

export default function ContactUs() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const supportEmail = config?.supportEmail || 'adexosindia@gmail.com';
  const [open, setOpen] = useState(null);

  const ROUTES = [
    { Icon: MessageSquare, accent: T.brandBright, title: 'In-app support', body: 'Chat with the assistant for instant answers, or raise a ticket the team replies to inside the app.', action: 'Open support', go: () => navigate('/support') },
    { Icon: Mail, accent: T.gold, title: 'Email', body: `${supportEmail} — for billing, legal notices, or feature requests.`, action: 'Send email', go: () => window.location.href = `mailto:${supportEmail}` },
    { Icon: MapPin, accent: T.green, title: 'Based in', body: 'Hyderabad, Telangana. Monday to Saturday, 9am to 7pm IST.', action: null },
  ];

  return (
    <div style={{ background: T.void, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{LANDING_CSS}</style>
      <LandingNav navigate={navigate} />

      <header style={{
        background: T.voidLift, borderBottom: `1px solid ${T.edge}`,
        padding: 'clamp(56px,7vw,88px) clamp(20px,5vw,48px) clamp(44px,5vw,60px)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <span className="lx-eyebrow">Contact</span>
          <h1 className="lx-title" style={{ fontSize: 'clamp(30px,4.6vw,48px)', margin: '14px 0 12px', maxWidth: '12ch' }}>
            Talk to a person, not a form.
          </h1>
          <p className="lx-lede" style={{ maxWidth: 480 }}>
            Three ways to reach us. The in-app route gets the fastest reply.
          </p>
        </div>
      </header>

      <main style={{ padding: 'clamp(48px,6vw,72px) clamp(20px,5vw,48px)' }}>
        {/* Three routes — lit cards */}
        <div style={{ maxWidth: 900, margin: '0 auto 64px' }}>
          <div className="lx-contact-grid">
            {ROUTES.map(({ Icon, accent, title, body, action, go }, i) => (
              <div key={title} className="lx-post lx-surface lx-surface-hover" style={{ padding: 24, animationDelay: `${i * 70}ms` }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11,
                  background: `linear-gradient(145deg, ${accent}26, ${accent}0D)`,
                  border: `1px solid ${accent}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18, boxShadow: `0 0 24px -6px ${accent}59`,
                }}>
                  <Icon size={19} color={accent} strokeWidth={1.9} />
                </div>
                <div style={{ fontFamily: F.display, fontSize: 16.5, fontWeight: 700, color: T.text, marginBottom: 8 }}>{title}</div>
                <div style={{ fontFamily: F.body, fontSize: 13.5, color: T.textSoft, lineHeight: 1.65, marginBottom: action ? 18 : 0 }}>{body}</div>
                {action && (
                  <button onClick={go} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 'auto',
                    fontFamily: F.body, fontSize: 13, fontWeight: 700, color: accent,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    {action} <ArrowRight size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ — same disclosure pattern as the landing FAQ */}
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <span className="lx-eyebrow">Common questions</span>
          <h2 className="lx-title" style={{ fontSize: 'clamp(22px,3vw,30px)', marginBottom: 28 }}>Before you write in.</h2>

          <div style={{ borderTop: `2px solid ${T.text}` }}>
            {FAQS.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} style={{ borderBottom: `1px solid ${T.edge}` }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'baseline',
                      justifyContent: 'space-between', gap: 18,
                      background: 'none', border: 0, cursor: 'pointer',
                      padding: '17px 0', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{item.q}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 15, color: T.textFaint, flexShrink: 0, width: 12, textAlign: 'center' }}>{isOpen ? '\u2013' : '+'}</span>
                  </button>
                  {isOpen && (
                    <p className="lx-post" style={{ fontFamily: F.body, fontSize: 14, color: T.textSoft, lineHeight: 1.75, margin: '0 0 18px', maxWidth: '60ch' }}>{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <LandingFooter navigate={navigate} />

      <style>{`
        .lx-contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }
      `}</style>
    </div>
  );
}
