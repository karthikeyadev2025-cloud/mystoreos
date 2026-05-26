// Social icons SVGs (inline — no external dependency)
const SocialIcons = {
  instagram: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  ),
  facebook: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  twitter: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  youtube: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  whatsapp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  ),
  linkedin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
};

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

  // Social links — admin configures URLs, empty = hidden
  const socials = [
    { key: 'instagram', label: 'Instagram', url: config.instagramUrl || '' },
    { key: 'facebook',  label: 'Facebook',  url: config.facebookUrl  || '' },
    { key: 'twitter',   label: 'X / Twitter', url: config.twitterUrl || '' },
    { key: 'youtube',   label: 'YouTube',   url: config.youtubeUrl   || '' },
    { key: 'whatsapp',  label: 'WhatsApp',  url: config.whatsappUrl  || 'https://wa.me/918885490495' },
    { key: 'linkedin',  label: 'LinkedIn',  url: config.linkedinUrl  || '' },
  ].filter(s => s.url);

  // App store links
  const playUrl     = config.playStoreUrl  || '';
  const appStoreUrl = config.appStoreUrl   || '';

  return (
    <footer style={{ padding: 'clamp(48px,6vw,72px) 24px 32px', background: '#020509', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── App Download + Social row ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24, marginBottom: 48, paddingBottom: 40, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

          {/* App download buttons */}
          <div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Download the App</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>

              {/* Play Store */}
              <a
                href={playUrl || '#'}
                target={playUrl ? '_blank' : '_self'}
                rel="noopener noreferrer"
                onClick={e => { if (!playUrl) e.preventDefault(); }}
                title={playUrl ? 'Get on Google Play' : 'Android app coming soon'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: playUrl ? '#000' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${playUrl ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10, padding: '9px 16px', textDecoration: 'none',
                  color: playUrl ? '#fff' : '#475569',
                  transition: 'all 0.2s', cursor: playUrl ? 'pointer' : 'default',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={playUrl ? 'currentColor' : '#475569'}>
                  <path d="M3.18 23.5c.28.16.6.18.9.06l11.5-6.64L12.4 14l-9.22 9.5z" fill={playUrl ? '#EA4335' : '#475569'}/>
                  <path d="M20.82 10.37l-2.8-1.62L14.7 12l3.32 3.25 2.8-1.62A1.7 1.7 0 0 0 22 12a1.7 1.7 0 0 0-.88-1.49l-.3-.14z" fill={playUrl ? '#FBBC04' : '#475569'}/>
                  <path d="M3.18.5A1.68 1.68 0 0 0 2 2.06v19.88a1.68 1.68 0 0 0 1.18 1.56L12.4 14 3.18.5z" fill={playUrl ? '#4285F4' : '#475569'}/>
                  <path d="M3.18.5L12.4 10l3.22-3.25L4.12.44A1.3 1.3 0 0 0 3.18.5z" fill={playUrl ? '#34A853' : '#475569'}/>
                </svg>
                <div>
                  <div style={{ fontSize: 8, opacity: 0.7, lineHeight: 1 }}>{playUrl ? 'GET IT ON' : 'COMING TO'}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>Google Play</div>
                </div>
              </a>

              {/* App Store */}
              <a
                href={appStoreUrl || '#'}
                target={appStoreUrl ? '_blank' : '_self'}
                rel="noopener noreferrer"
                onClick={e => { if (!appStoreUrl) e.preventDefault(); }}
                title={appStoreUrl ? 'Download on App Store' : 'iOS app coming soon'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: appStoreUrl ? '#000' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${appStoreUrl ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10, padding: '9px 16px', textDecoration: 'none',
                  color: appStoreUrl ? '#fff' : '#475569',
                  transition: 'all 0.2s', cursor: appStoreUrl ? 'pointer' : 'default',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={appStoreUrl ? 'white' : '#475569'}>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div>
                  <div style={{ fontSize: 8, opacity: 0.7, lineHeight: 1 }}>{appStoreUrl ? 'DOWNLOAD ON THE' : 'COMING TO'}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>App Store</div>
                </div>
              </a>
            </div>
          </div>

          {/* Social icons */}
          <div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Follow Us</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {socials.length > 0 ? socials.map(s => (
                <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" title={s.label}
                  style={{
                    width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#64748b',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    textDecoration: 'none', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color='#f43f5e'; e.currentTarget.style.borderColor='rgba(244,63,94,0.4)'; e.currentTarget.style.background='rgba(244,63,94,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color='#64748b'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
                >
                  {SocialIcons[s.key]}
                </a>
              )) : (
                // Placeholder icons when no URLs configured yet
                ['instagram','facebook','twitter','youtube','whatsapp'].map(key => (
                  <div key={key} title="Coming soon — configure in Admin"
                    style={{
                      width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#334155',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'default',
                    }}
                  >
                    {SocialIcons[key]}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Footer nav columns ── */}
        <div style={{ display: 'grid', gap: 32, gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', marginBottom: 40 }}>
          <div>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 0, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>M</div>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>{config.siteName || 'MyStore OS'}</span>
            </button>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, margin: '0 0 16px' }}>
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

        {/* ── Bottom bar ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ color: '#334155', fontSize: 13 }}>© 2026 K² ADEXOS. All rights reserved. Built for Bharat 🇮🇳</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ color: '#334155', fontSize: 12 }}>Made with ❤️ in India</div>
            {/* Inline mini app download links */}
            {(playUrl || appStoreUrl) && (
              <div style={{ display: 'flex', gap: 8 }}>
                {playUrl && <a href={playUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#475569', fontSize: 11, textDecoration: 'none' }} onMouseEnter={e=>e.currentTarget.style.color='#34A853'} onMouseLeave={e=>e.currentTarget.style.color='#475569'}>▶ Play Store</a>}
                {appStoreUrl && <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#475569', fontSize: 11, textDecoration: 'none' }} onMouseEnter={e=>e.currentTarget.style.color='#94a3b8'} onMouseLeave={e=>e.currentTarget.style.color='#475569'}>🍎 App Store</a>}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
