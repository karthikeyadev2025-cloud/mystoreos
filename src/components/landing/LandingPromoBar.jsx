import { useState, useEffect } from 'react';
import { Zap, X } from 'lucide-react';

// Admin-editable via getSiteConfig('landingPromo', ...) — same pattern as
// landingHero/landingStats/landingTestimonials so this can be updated from
// the admin panel without a code deploy. Defaults to a generic "free trial,
// no card needed" launch offer when nothing's been configured yet.
const DEFAULT_PROMO = {
  // Was true — this exact "First 500 shops" launch offer had been
  // showing to every visitor with no way to turn it off, since the
  // admin control the code comment above referenced was never
  // actually built (checked: same true of landingHero/landingStats/
  // landingTestimonials — none of them have a real admin UI despite
  // the same claim). Defaulting to off now; a real admin toggle is
  // being added so this can be turned back on for a genuine future
  // promotion without needing a code change.
  active: false,
  emoji: '🚀',
  text: 'Launch Offer — First 500 shops get PRO free for 30 days',
  ctaLabel: 'Claim Now',
  ctaHref: '/register',
  endsAt: null, // ISO date string, optional — shows a live countdown when set
};

function useCountdown(endsAt) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!endsAt) return;
    const target = new Date(endsAt).getTime();
    if (Number.isNaN(target)) return;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setLeft(null); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLeft({ d, h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}

export default function LandingPromoBar({ promo = DEFAULT_PROMO, navigate }) {
  const [dismissed, setDismissed] = useState(false);
  const left = useCountdown(promo?.endsAt);

  useEffect(() => {
    // Dismissal is per-browser-session only — re-shows on next visit /
    // after the dev server restarts, so it doesn't get permanently hidden
    // for a returning visitor across days.
    try { setDismissed(sessionStorage.getItem('mso_promo_dismissed') === '1'); } catch { /* sessionStorage unavailable — stay shown */ }
  }, []);

  if (!promo?.active || !promo?.text || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem('mso_promo_dismissed', '1'); } catch { /* sessionStorage unavailable — non-critical */ }
  };

  const handleCta = () => {
    const href = promo.ctaHref || '/register';
    if (href.startsWith('/') && navigate) navigate(href);
    else window.location.href = href;
  };

  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 60,
        background: 'linear-gradient(90deg,#4F46E5,#818CF8,#4F46E5)',
        backgroundSize: '200% 100%',
        animation: 'mso-promo-shimmer 6s ease-in-out infinite',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <style>{`
        @keyframes mso-promo-shimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @media (max-width: 640px) { .mso-promo-countdown { display: none !important; } }
      `}</style>
      <div style={{
        maxWidth: 1280, margin: '0 auto', padding: '9px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        flexWrap: 'wrap', position: 'relative',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span aria-hidden style={{ fontSize: 15 }}>{promo.emoji || '🚀'}</span>
          <span>{promo.text}</span>
          {left && (
            <span className="mso-promo-countdown" style={{
              display: 'inline-flex', gap: 4, fontFamily: 'monospace', fontWeight: 800,
              background: 'rgba(255,255,255,0.18)', padding: '2px 8px', borderRadius: 6, fontSize: 12,
            }}>
              {left.d > 0 && `${left.d}d `}{String(left.h).padStart(2,'0')}:{String(left.m).padStart(2,'0')}:{String(left.s).padStart(2,'0')}
            </span>
          )}
        </span>
        <button
          onClick={handleCta}
          style={{
            background: '#fff', color: '#4F46E5', border: 'none', borderRadius: 7,
            padding: '5px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
          }}
        >
          <Zap size={13} />
          {promo.ctaLabel || 'Claim Now'}
        </button>
        <button
          aria-label="Dismiss"
          onClick={dismiss}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
            width: 22, height: 22, color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

export { DEFAULT_PROMO };
