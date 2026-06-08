import { useNavigate } from 'react-router-dom';
import MLogo from '../MLogo';

export default function LandingFooter({ config = {} }) {
  const navigate = useNavigate();
  const LINKS = {
    Product: [
      { label: 'Features', action: () => { document.querySelector('#features')?.scrollIntoView({ behavior:'smooth' }); } },
      { label: 'Pricing',  action: () => navigate('/pricing') },
      { label: 'For Distributors', action: () => {
        if (window.location.pathname !== '/') {
          navigate('/#distributor');
        } else {
          window.location.hash = '';
          window.location.hash = '#distributor';
        }
      } },
      { label: 'Enterprise', action: () => navigate('/pricing') },
      { label: 'Changelog', action: null },
    ],
    Company: [
      { label: 'About Us', action: () => navigate('/about') },
      { label: 'Blog',     action: () => navigate('/blog')  },
      { label: 'Careers',  action: null },
      { label: 'Press Kit', action: null },
    ],
    Support: [
      { label: 'Help Center',    action: () => navigate('/contact') },
      { label: 'Contact Sales',  action: () => navigate('/contact') },
      { label: 'Status Page',    action: null },
      { label: 'Privacy Policy', action: () => navigate('/privacy') },
      { label: 'Terms of Service', action: () => navigate('/terms') },
    ],
  };

  return (
    <footer style={{
      background: '#0D1117', borderTop: '1px solid rgba(255,255,255,0.07)',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
      padding: 'clamp(40px,6vw,56px) clamp(16px,5vw,40px) clamp(24px,4vw,32px)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <MLogo size={34} radius={9} />
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-.02em' }}>
                {config.brandName || 'MyStore OS'}
              </span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13.5, lineHeight: 1.7,
              maxWidth: 280, marginBottom: 18 }}>
              India's most powerful retail operating system — built for kirana stores, supermarkets, and FMCG distributors.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['GST Compliant', 'UPI Ready', 'Works Offline'].map(t => (
                <span key={t} style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '3px 10px', color: 'rgba(255,255,255,0.45)', fontSize: 11,
                }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {Object.entries(LINKS).map(([group, links]) => (
            <div key={group}>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700,
                letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 16 }}>{group}</div>
              {links.map(({ label, action }) => (
                <div key={label} style={{ marginBottom: 9 }}>
                  <button onClick={action || undefined} disabled={!action} style={{
                    background: 'none', border: 'none', padding: 0,
                    color: action ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.2)',
                    fontSize: 13.5, textDecoration: 'none', cursor: action ? 'pointer' : 'default',
                    fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                    transition: 'color .15s', textAlign: 'left',
                  }}
                    onMouseEnter={e => { if (action) e.target.style.color='rgba(255,255,255,0.75)'; }}
                    onMouseLeave={e => { if (action) e.target.style.color='rgba(255,255,255,0.38)'; }}
                  >{label}</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          marginTop: 48,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12.5 }}>
            © 2026 MyStore OS. All rights reserved. Made with ❤️ in India.
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }}/>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>All systems operational</span>
          </div>
        </div>
      </div>

      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 40px;
        }
        .footer-brand { grid-column: 1; }
        @media(max-width:900px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 28px !important;
          }
          .footer-brand { grid-column: span 2 !important; }
        }
        @media(max-width:480px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
          .footer-brand { grid-column: 1 !important; }
        }
      `}</style>
    </footer>
  );
}
