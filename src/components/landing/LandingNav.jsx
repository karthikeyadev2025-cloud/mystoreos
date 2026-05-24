import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { label: 'Features', target: '#features' },
  { label: 'Pricing', target: '/pricing', route: true },
  { label: 'For Distributors', target: '#distributor' },
  { label: 'About', target: '/about', route: true },
];

export default function LandingNav({ config, navigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const go = (target, route) => {
    setOpen(false);
    if (route) { navigate(target); return; }
    const el = document.querySelector(target);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(3,7,18,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'background 0.3s',
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>M</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#f8fafc' }}>{config.siteName || 'MyStore OS'}</span>
        </button>

        <div className="ln" style={{ gap: 28, alignItems: 'center' }}>
          {LINKS.map(l => (
            <button key={l.label} onClick={() => go(l.target, l.route)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: '4px 0', transition: 'color 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f8fafc'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>
              {l.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/login')}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
            className="ln">
            Login
          </button>
          <button onClick={() => navigate('/register')}
            style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
            className="ln">
            Start Free Trial
          </button>
          <button onClick={() => setOpen(v => !v)} className="mb"
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 1001, background: 'rgba(3,7,18,0.97)', backdropFilter: 'blur(20px)', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {LINKS.map(l => (
              <button key={l.label} onClick={() => go(l.target, l.route)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: '12px 0', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {l.label}
              </button>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setOpen(false); navigate('/login'); }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Login
              </button>
              <button onClick={() => { setOpen(false); navigate('/register'); }}
                style={{ flex: 1, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Start Free Trial
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
