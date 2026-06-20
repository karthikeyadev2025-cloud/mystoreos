import { useState, useRef, useEffect, useCallback } from 'react';

// ── Tiny blur-up placeholder (generated inline — no extra requests) ──────────
const BLUR_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23e2e8f0'/%3E%3C/svg%3E";

// ── Progressive image: skeleton → blur → sharp ───────────────────────────────
function ProgressiveImg({ src, alt, style = {} }) {
  const [state, setState] = useState('idle'); // idle | loading | loaded | error
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: '200px' }   // start loading 200px before visible
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !src) return;
    setState('loading');
    const img = new window.Image();
    img.onload  = () => setState('loaded');
    img.onerror = () => setState('error');
    img.src = src;
  }, [inView, src]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', background: '#F1F5F9', overflow: 'hidden', ...style }}>
      {/* Skeleton shimmer */}
      {state !== 'loaded' && state !== 'error' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, #F1F5F9 0%, #E2E8F0 50%, #F1F5F9 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s ease-in-out infinite',
        }} />
      )}
      {/* Actual image — fades in when loaded */}
      {(state === 'loading' || state === 'loaded') && src && (
        <img
          src={src}
          alt={alt}
          decoding="async"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: state === 'loaded' ? 1 : 0,
            transition: 'opacity 0.35s ease',
            willChange: 'opacity',
          }}
        />
      )}
      {/* Error fallback */}
      {state === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>
      )}
    </div>
  );
}

// ── Shimmer keyframe (injected once) ─────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('sfpc-styles')) {
  const s = document.createElement('style');
  s.id = 'sfpc-styles';
  s.textContent = `
    @keyframes shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    .sfpc-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
    .sfpc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,23,42,0.12) !important; }
    .sfpc-add { transition: background 0.15s, transform 0.1s; }
    .sfpc-add:active { transform: scale(0.96); }
  `;
  document.head.appendChild(s);
}

// ── Main Card ─────────────────────────────────────────────────────────────────
export default function StorefrontProductCard({ p, qty = 0, updateQty, onOpen }) {
  const images = (Array.isArray(p.images) && p.images.length
    ? p.images
    : p.image ? [p.image] : []
  ).filter(Boolean);

  const [idx, setIdx] = useState(0);
  const touchX = useRef(null);
  const n = images.length;

  const go = useCallback((next) => {
    if (n > 1) setIdx(((next % n) + n) % n);
  }, [n]);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 30) go(dx < 0 ? idx + 1 : idx - 1);
    touchX.current = null;
  };

  // ── Discount calculation ───────────────────────────────────────────────────
  // Priority: p.discountPct (set by owner in product form) > p.mrp (legacy)
  const hasVariantPricing = Array.isArray(p.variantPrices) && p.variantPrices.length > 0;
  // For variant-priced products, anchor the card's headline price to the
  // CHEAPEST variant (typical "from ₹X" retail convention) rather than the
  // shared base `price` field, which is now just a fallback reference.
  const anchorPrice = hasVariantPricing
    ? Math.min(...p.variantPrices.map(v => Number(v.price) || Infinity))
    : Number(p.price) || 0;

  let discPct = 0;
  let displayPrice = anchorPrice;
  let originalPrice = null;

  if (p.discountPct && Number(p.discountPct) > 0) {
    // Owner set a label discount on this product
    discPct = Number(p.discountPct);
    originalPrice = displayPrice;
    displayPrice = Math.round(originalPrice * (1 - discPct / 100));
  } else if (p.mrp && Number(p.mrp) > anchorPrice) {
    // Legacy MRP field
    originalPrice = Number(p.mrp);
    discPct = Math.round(((originalPrice - displayPrice) / originalPrice) * 100);
  }

  const outOfStock = (p.stock ?? 999) <= 0;
  // Card quick-add can't know which variant the shopper wants — for
  // variant-priced products, ADD opens the detail view's proper picker
  // instead of silently guessing (was a real billing-accuracy risk: a
  // bare "+" would previously add at the single shared price regardless
  // of which variant was actually meant).
  const handleQuickAdd = () => {
    if (outOfStock) return;
    if (hasVariantPricing) { onOpen?.(p); return; }
    updateQty(p.id, 1);
  };

  return (
    <div
      className="sfpc-card"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(15,23,42,0.07)',
        position: 'relative',
        opacity: outOfStock ? 0.7 : 1,
      }}
    >
      {/* Image area */}
      <div
        style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', cursor: onOpen ? 'pointer' : 'default' }}
        onClick={() => !outOfStock && onOpen?.(p)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Discount badge */}
        {discPct > 0 && (
          <div style={{
            position: 'absolute', top: 8, left: 8, zIndex: 3,
            background: '#EF4444', color: '#fff',
            fontSize: 10, fontWeight: 800,
            padding: '3px 7px', borderRadius: 6,
            letterSpacing: '0.02em',
            boxShadow: '0 2px 6px rgba(239,68,68,0.4)',
          }}>
            {discPct}% OFF
          </div>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 4,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}>
            <span style={{ background: '#0F172A', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6, letterSpacing: '0.05em' }}>OUT OF STOCK</span>
          </div>
        )}

        {n > 0 ? (
          /* Sliding image strip — only current image fetched via ProgressiveImg */
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {images.map((src, i) => (
              <div key={i} style={{
                position: 'absolute', inset: 0,
                opacity: i === idx ? 1 : 0,
                transition: 'opacity 0.25s ease',
                pointerEvents: i === idx ? 'auto' : 'none',
              }}>
                <ProgressiveImg src={src} alt={`${p.name} photo ${i + 1}`} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontSize: 44 }}>
            {p.icon || '📦'}
          </div>
        )}

        {/* Multi-image nav */}
        {n > 1 && (
          <>
            <button
              aria-label="Previous photo"
              onClick={(e) => { e.stopPropagation(); go(idx - 1); }}
              style={{ position: 'absolute', top: '50%', left: 5, transform: 'translateY(-50%)', zIndex: 3, width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 14, lineHeight: '24px', padding: 0, color: '#0F172A', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
            >‹</button>
            <button
              aria-label="Next photo"
              onClick={(e) => { e.stopPropagation(); go(idx + 1); }}
              style={{ position: 'absolute', top: '50%', right: 5, transform: 'translateY(-50%)', zIndex: 3, width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 14, lineHeight: '24px', padding: 0, color: '#0F172A', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
            >›</button>
            <div style={{ position: 'absolute', bottom: 7, left: 0, right: 0, display: 'flex', gap: 4, justifyContent: 'center', zIndex: 3 }}>
              {images.map((_, i) => (
                <span key={i} style={{ width: i === idx ? 14 : 5, height: 5, borderRadius: 3, background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'width 0.2s, background 0.2s', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#0F172A', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.name}
        </h3>

        {(p.weight || p.unit) && !hasVariantPricing && (
          <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>
            {p.weight || p.unit}
          </p>
        )}
        {hasVariantPricing && (
          <p style={{ fontSize: 10, color: '#94A3B8', margin: 0, fontWeight: 600 }}>
            {p.variantPrices.length} sizes available
          </p>
        )}

        {/* Price block */}
        <div style={{ marginTop: 'auto', paddingTop: 6 }}>
          {originalPrice ? (
            // Has discount — show MRP crossed + final price + savings
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {hasVariantPricing && <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>from</span>}
                <span style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  ₹{displayPrice}
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8', textDecoration: 'line-through', fontWeight: 500 }}>
                  ₹{originalPrice}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 700, marginTop: 2 }}>
                Save ₹{originalPrice - displayPrice}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {hasVariantPricing && <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginRight: 4 }}>from</span>}
              ₹{displayPrice}
            </span>
          )}
        </div>

        {/* Add / Qty button — for variant products, qty here reflects only
            the bare-product-id cart key, which is never used once a
            product has variant pricing (each variant gets its own compound
            cart key, tracked/shown inside the detail view's picker
            instead) — so variant products always show ADD, which opens
            the detail sheet rather than guessing a variant. */}
        {!hasVariantPricing && qty > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36, background: '#4F46E5', borderRadius: 10, marginTop: 6 }}>
            <button
              aria-label="Remove one"
              onClick={() => updateQty(p.id, -1)}
              style={{ width: 40, height: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >−</button>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{qty}</span>
            <button
              aria-label="Add one more"
              onClick={() => updateQty(p.id, 1)}
              style={{ width: 40, height: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >+</button>
          </div>
        ) : (
          <button
            className="sfpc-add"
            disabled={outOfStock}
            onClick={handleQuickAdd}
            style={{
              height: 36, marginTop: 6,
              background: outOfStock ? '#F1F5F9' : '#FFFFFF',
              border: `1.5px solid ${outOfStock ? '#CBD5E1' : '#4F46E5'}`,
              color: outOfStock ? '#94A3B8' : '#4F46E5',
              borderRadius: 10, fontSize: 13, fontWeight: 800,
              cursor: outOfStock ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
              width: '100%',
            }}
          >
            {outOfStock ? 'Unavailable' : hasVariantPricing ? 'SELECT SIZE' : 'ADD'}
          </button>
        )}
      </div>
    </div>
  );
}
