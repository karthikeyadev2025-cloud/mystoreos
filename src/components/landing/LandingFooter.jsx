const COLS = [
  { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '/pricing' }, { label: 'For Distributors', href: '#distributor' }, { label: 'Mobile App', href: '/register' }] },
  { title: 'Company', links: [{ label: 'About', href: '/about' }, { label: 'Blog', href: '/blog' }, { label: 'Careers', href: '/careers' }, { label: 'Contact', href: '/contact' }] },
  { title: 'Support', links: [{ label: 'Help Center', href: '/help' }, { label: 'WhatsApp Support', href: '/contact' }, { label: 'Status', href: '/status' }, { label: 'Privacy Policy', href: '/privacy' }] },
  { title: 'Legal', links: [{ label: 'Terms of Service', href: '/terms' }, { label: 'Privacy Policy', href: '/privacy' }, { label: 'Refund Policy', href: '/refund' }, { label: 'GST Invoice', href: '/gst' }] },
];

export default function LandingFooter({ config, navigate }) {
  const go = (href) => {
    if (href.startsWith('#')) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(href);
    }
  };

  return (
    <footer style={{ padding: 'clamp(48px,6vw,72px) 24px 32px', background: '#020509', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gap: 32, gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', marginBottom: 48 }}>
          <div>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 0, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>M</div>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>{config.siteName || 'MyStore OS'}</span>
            </button>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              Complete billing &amp; ERP for Indian shopkeepers and distributors.
            </p>
          </div>
          {COLS.map(col => (
            <div key={col.title}>
              <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>{col.title}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(l => (
                  <li key={l.label}>
                    <button onClick={() => go(l.href)}
                      style={{ background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'Outfit, sans-serif', transition: 'color 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}>
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ color: '#334155', fontSize: 13 }}>© 2026 K² ADEXOS. All rights reserved. Built for Bharat 🇮🇳</div>
          <div style={{ color: '#334155', fontSize: 12 }}>Made with ❤️ in India</div>
        </div>
      </div>
    </footer>
  );
}
