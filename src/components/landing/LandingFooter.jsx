import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function LandingFooter({ config = {} }) {
  const navigate = useNavigate();
  const LINKS = {
    Product: ['Features', 'Pricing', 'For Distributors', 'Enterprise', 'Changelog'],
    Company:  ['About Us', 'Blog', 'Careers', 'Press Kit'],
    Support:  ['Help Center', 'Contact Sales', 'Status Page', 'Privacy Policy', 'Terms of Service'],
  };

  return (
    <footer style={{
      background: '#0D1117', borderTop: '1px solid rgba(255,255,255,0.07)',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", padding: '56px 40px 32px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, background: '#4F46E5', borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={17} color="#fff" strokeWidth={2.5}/>
              </div>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-.02em' }}>
                {config.brandName || 'MyStore OS'}
              </span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13.5, lineHeight: 1.7,
              maxWidth: 280, marginBottom: 18 }}>
              India's most powerful retail operating system — built for kirana stores, supermarkets, and FMCG distributors.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
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
              {links.map(l => (
                <div key={l} style={{ marginBottom: 9 }}>
                  <a href="#" onClick={e => e.preventDefault()} style={{
                    color: 'rgba(255,255,255,0.38)', fontSize: 13.5, textDecoration: 'none',
                    transition: 'color .15s',
                  }}
                    onMouseEnter={e => e.target.style.color='rgba(255,255,255,0.75)'}
                    onMouseLeave={e => e.target.style.color='rgba(255,255,255,0.38)'}
                  >{l}</a>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
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
      <style>{`@media(max-width:768px){footer>div>div:first-child{grid-template-columns:1fr!important;gap:32px}}`}</style>
    </footer>
  );
}
