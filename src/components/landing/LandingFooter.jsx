import { useNavigate } from 'react-router-dom';
import MLogo from '../MLogo';
import { T, F } from './_tokens';

// Same routing as before — the link map is unchanged. Only the skin and
// the grouping labels are new: "Product / Company / Support" became
// plainer headings that say what's actually under them.

export default function LandingFooter({ config = {} }) {
  const navigate = useNavigate();

  const LINKS = {
    'Platform': [
      { label: 'What you get', action: () => { document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' }); } },
      { label: 'Pricing',      action: () => navigate('/pricing') },
      { label: 'For distributors', action: () => {
        if (window.location.pathname !== '/') {
          navigate('/#distributor');
        } else {
          document.querySelector('#distributor')?.scrollIntoView({ behavior: 'smooth' });
        }
      } },
      { label: 'Enterprise',   action: () => navigate('/pricing') },
    ],
    'Company': [
      { label: 'About',   action: () => navigate('/about') },
      { label: 'Blog',    action: () => navigate('/blog') },
      { label: 'Careers', action: null },
    ],
    'Help': [
      { label: 'Help centre',   action: () => navigate('/contact') },
      { label: 'Talk to sales', action: () => navigate('/contact') },
      { label: 'Privacy',       action: () => navigate('/privacy') },
      { label: 'Terms',         action: () => navigate('/terms') },
    ],
  };

  return (
    <footer style={{
      background: T.void,
      borderTop: `1px solid ${T.edgeLift}`,
      padding: 'clamp(48px,6vw,72px) clamp(20px,5vw,48px) 32px',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        <div className="lx-foot-grid">
          {/* Wordmark + line */}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: F.display, fontSize: 17, fontWeight: 800,
              letterSpacing: '-0.02em', color: T.text,
              display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14,
            }}>
              <MLogo size={32} radius={9} />
              {config.siteName || 'MyStore OS'}
            </div>
            <p style={{
              fontFamily: F.body, fontSize: 13.5, color: T.textSoft,
              lineHeight: 1.7, margin: 0, maxWidth: 260,
            }}>
              Billing and bookings for Indian businesses. Sell stock or sell time —
              one set of books either way.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([heading, items]) => (
            <div key={heading} style={{ minWidth: 0 }}>
              <div className="lx-eyebrow" style={{ marginBottom: 14 }}>{heading}</div>
              {items.map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action || undefined}
                  disabled={!action}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'none', border: 0, padding: '5px 0',
                    cursor: action ? 'pointer' : 'default',
                    fontFamily: F.body, fontSize: 13.5,
                    color: action ? T.textSoft : T.textFaint,
                    transition: 'color .15s',
                  }}
                  onMouseEnter={e => { if (action) e.currentTarget.style.color = T.text; }}
                  onMouseLeave={e => { if (action) e.currentTarget.style.color = T.textSoft; }}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom rule */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 16, flexWrap: 'wrap',
          borderTop: `1px solid ${T.edge}`, marginTop: 44, paddingTop: 20,
        }}>
          <span style={{ fontFamily: F.body, fontSize: 12.5, color: T.textFaint }}>
            © {new Date().getFullYear()} {config.siteName || 'MyStore OS'} · Made in India
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green }} />
            <span style={{
              fontFamily: F.mono, fontSize: 11, color: T.textFaint, letterSpacing: '0.04em',
            }}>All systems operational</span>
          </span>
        </div>
      </div>

      <style>{`
        .lx-foot-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr 1fr;
          gap: clamp(24px,4vw,48px);
        }
        @media (max-width: 760px) {
          .lx-foot-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
        }
        @media (max-width: 440px) {
          .lx-foot-grid { grid-template-columns: 1fr; gap: 28px; }
        }
      `}</style>
    </footer>
  );
}
