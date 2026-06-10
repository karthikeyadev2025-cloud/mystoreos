import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Menu } from 'lucide-react';
import MLogo from '../MLogo';

const NAV_LINKS = [
  { label: 'Features',         href: '#features'     },
  { label: 'Pricing',          href: '#pricing'       },
  { label: 'For Distributors', href: '#distributor'   },
  { label: 'About',            to:   '/about'         },
];

export default function LandingNav({ config = {} }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close on outside click / resize
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [open]);

  const handleLink = (link) => {
    setOpen(false);
    if (link.to) {
      navigate(link.to);
    } else if (link.href) {
      if (window.location.pathname !== '/') {
        navigate('/' + link.href);
      } else {
        if (link.href === '#distributor') {
          window.location.hash = '';
          window.location.hash = '#distributor';
        } else {
          const el = document.querySelector(link.href);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    }
  };

  const navBase = {
    position: 'sticky', top: 0, zIndex: 1000,
    background: scrolled ? 'rgba(13,17,23,0.97)' : 'rgba(13,17,23,0.92)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    transition: 'background 0.25s',
  };

  const btnStyle = {
    background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13, fontWeight: 500,
    padding: '8px 14px', borderRadius: 7,
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    transition: 'color .15s, background .15s',
    whiteSpace: 'nowrap',
  };

  return (
    <nav style={navBase}>
      {/* ── Desktop / Tablet bar ── */}
      <div style={{
        height: 60, display: 'flex', alignItems: 'center',
        padding: '0 clamp(16px,4vw,40px)', justifyContent: 'space-between',
        maxWidth: 1400, margin: '0 auto',
      }}>
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => navigate('/')}
        >
          <MLogo size={36} radius={10} />
          <div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: '-.02em' }}>
              {config.brandName || 'MyStore OS'}
            </span>
            <span style={{
              marginLeft: 7, background: 'rgba(244,63,94,0.15)',
              color: '#fca5a5', fontSize: 9, fontWeight: 700,
              padding: '2px 7px', borderRadius: 20,
              border: '1px solid rgba(244,63,94,0.3)', letterSpacing: '.07em',
            }}>ENTERPRISE</span>
          </div>
        </div>

        {/* Desktop nav links */}
        <div className="nav-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV_LINKS.map(link => (
            <button key={link.label} style={btnStyle}
              onClick={() => handleLink(link)}
              onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.55)'; e.currentTarget.style.background='transparent'; }}
            >{link.label}</button>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="nav-desktop-cta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate('/login')} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
            color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600,
            padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
            fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", transition: 'all .15s',
            whiteSpace: 'nowrap',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.4)'; e.currentTarget.style.color='#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.18)'; e.currentTarget.style.color='rgba(255,255,255,0.75)'; }}
          >Login</button>
          <button onClick={() => navigate('/register')} style={{
            background: '#4F46E5', border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 700, padding: '9px 20px', borderRadius: 8,
            cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
            boxShadow: '0 0 22px rgba(79,70,229,0.5)', transition: 'filter .15s',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
            onMouseEnter={e => e.currentTarget.style.filter='brightness(1.12)'}
            onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Start Free Trial
          </button>
        </div>

        {/* Hamburger (mobile only) */}
        <button
          className="nav-hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', borderRadius: 8, width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {open ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </div>

      {/* ── Mobile Drawer ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 61, left: 0, right: 0,
          background: '#0D1117',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 16px 20px',
          display: 'flex', flexDirection: 'column', gap: 4,
          zIndex: 999,
          animation: 'slideDown 0.18s ease both',
        }}>
          {NAV_LINKS.map(link => (
            <button key={link.label}
              onClick={() => handleLink(link)}
              style={{
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 600,
                padding: '13px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                transition: 'background .12s, color .12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.7)'; }}
            >{link.label}</button>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' }}/>
          <button onClick={() => { setOpen(false); navigate('/login'); }} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            padding: '13px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          }}>Login</button>
          <button onClick={() => { setOpen(false); navigate('/register'); }} style={{
            background: '#4F46E5', border: 'none', color: '#fff',
            fontSize: 14, fontWeight: 700,
            padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
            boxShadow: '0 0 20px rgba(79,70,229,0.4)',
          }}>⚡ Start Free 15-Day Trial</button>
        </div>
      )}

      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .nav-hamburger { display: none !important; }
        .nav-desktop-links { display: flex !important; }
        .nav-desktop-cta { display: flex !important; }
        @media (max-width: 768px) {
          .nav-hamburger { display: flex !important; }
          .nav-desktop-links { display: none !important; }
          .nav-desktop-cta { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
