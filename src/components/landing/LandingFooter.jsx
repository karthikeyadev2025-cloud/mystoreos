import { useNavigate } from 'react-router-dom';
import MLogo from '../MLogo';

export default function LandingFooter({ config = {} }) {
  const navigate = useNavigate();

  // Social + store links come from admin CMS settings; each shows only if set.
  const socials = [
    { key: 'instagramUrl', label: 'Instagram', icon: '📷' },
    { key: 'facebookUrl',  label: 'Facebook',  icon: '📘' },
    { key: 'twitterUrl',   label: 'X',         icon: '✖️' },
    { key: 'youtubeUrl',   label: 'YouTube',   icon: '▶️' },
    { key: 'linkedinUrl',  label: 'LinkedIn',  icon: '💼' },
    { key: 'whatsappUrl',  label: 'WhatsApp',  icon: '💬' },
  ].filter(s => config[s.key]);

  const stores = [
    { key: 'playStoreUrl', label: '▶ Get it on Google Play' },
    { key: 'appStoreUrl',  label: ' Download on the App Store' },
  ].filter(s => config[s.key]);

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

            {socials.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                {socials.map(s => (
                  <a key={s.key} href={config[s.key]} target="_blank" rel="noopener noreferrer"
                    title={s.label} aria-label={s.label}
                    style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 15, textDecoration: 'none' }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            )}

            {stores.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {stores.map(s => (
                  <a key={s.key} href={config[s.key]} target="_blank" rel="noopener noreferrer"
                    style={{ background: '#000', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8,
                      padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    {s.label}
                  </a>
                ))}
              </div>
            )}
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

        {/* An innovation by — Nikki Tech Labs */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: 24, marginTop: 48,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase' }}>
            An innovation by
          </span>
          <a href="https://mystoreos.in" style={{
            fontSize: 20, fontWeight: 800,
            background: 'linear-gradient(90deg,#818CF8,#F0ABFC)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', textDecoration: 'none', letterSpacing: '-0.5px',
          }}>
            Nikki Tech Labs
          </a>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          marginTop: 20,
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
