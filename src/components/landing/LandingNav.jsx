import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Menu } from 'lucide-react';
import { T, F } from './_tokens';

const NAV_LINKS = [
  { label: 'What you get', href: '#features' },
  { label: 'Who it\u2019s for', href: '#who' },
  { label: 'Pricing',      href: '#pricing'  },
  { label: 'Questions',    href: '#faq'      },
];

export default function LandingNav({ config = {} }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [open]);

  const go = (link) => {
    setOpen(false);
    if (link.to) { navigate(link.to); return; }
    if (!link.href) return;
    if (window.location.pathname !== '/') { navigate('/' + link.href); return; }
    const el = document.querySelector(link.href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: scrolled ? 'rgba(250,248,243,0.88)' : T.paper,
      backdropFilter: scrolled ? 'saturate(180%) blur(12px)' : 'none',
      borderBottom: `1px solid ${scrolled ? T.rule : 'transparent'}`,
      transition: 'background .2s, border-color .2s',
    }}>
      <div style={{
        maxWidth: 1080, margin: '0 auto',
        padding: '14px clamp(20px,5vw,48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        {/* Wordmark — set in the display face, not a logo lockup */}
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: 0, cursor: 'pointer', padding: 0, width: 'auto',
            fontFamily: F.display, fontSize: 17, fontWeight: 800,
            letterSpacing: '-0.02em', color: T.inkDeep,
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <span style={{ width: 3, height: 15, background: T.marginRed, borderRadius: 1 }} />
          {config.siteName || 'MyStore OS'}
        </button>

        {/* Desktop links */}
        <nav className="lx-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {NAV_LINKS.map(l => (
            <button
              key={l.label}
              onClick={() => go(l)}
              style={{
                background: 'none', border: 0, cursor: 'pointer', padding: '4px 0', width: 'auto',
                fontFamily: F.body, fontSize: 14, fontWeight: 500, color: T.inkSoft,
                transition: 'color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.inkDeep; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.inkSoft; }}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="lx-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: 0, cursor: 'pointer', width: 'auto',
              fontFamily: F.body, fontSize: 14, fontWeight: 500, color: T.inkSoft, padding: '8px 4px',
            }}
          >
            Sign in
          </button>
          <button
            className="lx-btn lx-btn-primary"
            onClick={() => navigate('/register')}
            style={{ fontSize: 14, padding: '9px 17px' }}
          >
            Start free
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="lx-nav-burger"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{
            display: 'none', background: 'none', border: 0, cursor: 'pointer',
            color: T.ink, padding: 6, width: 'auto',
          }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div style={{
          borderTop: `1px solid ${T.rule}`, background: T.paper,
          padding: '8px clamp(20px,5vw,48px) 20px',
        }}>
          {NAV_LINKS.map(l => (
            <button
              key={l.label}
              onClick={() => go(l)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 0, borderBottom: `1px solid ${T.rule}`,
                padding: '14px 0', cursor: 'pointer',
                fontFamily: F.body, fontSize: 15, color: T.ink,
              }}
            >
              {l.label}
            </button>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="lx-btn lx-btn-ghost" onClick={() => { setOpen(false); navigate('/login'); }} style={{ flex: 1, justifyContent: 'center' }}>
              Sign in
            </button>
            <button className="lx-btn lx-btn-primary" onClick={() => { setOpen(false); navigate('/register'); }} style={{ flex: 1, justifyContent: 'center' }}>
              Start free
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .lx-nav-links   { display: none !important; }
          .lx-nav-actions { display: none !important; }
          .lx-nav-burger  { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
