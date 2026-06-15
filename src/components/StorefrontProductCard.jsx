import { useState, useRef } from 'react';

// Instamart-style storefront product card.
// p: product (uses p.images[] with fallback to [p.image]); qty: current cart qty;
// updateQty(id, delta): cart mutator already used by the storefront.
export default function StorefrontProductCard({ p, qty = 0, updateQty }) {
  const images = (Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : [])).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const touchX = useRef(null);

  const n = images.length;
  const go = (next) => { if (n > 1) setIdx(((next % n) + n) % n); };
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 30) go(dx < 0 ? idx + 1 : idx - 1);
    touchX.current = null;
  };

  const pct = (p.mrp && p.mrp > p.price) ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <div
        style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#F8FAFC', overflow: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        {pct > 0 && (
          <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: '#4F46E5', color: '#FFFFFF', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>{pct}% OFF</span>
        )}

        {n > 0 ? (
          <div style={{ display: 'flex', height: '100%', transition: 'transform 0.28s ease', transform: `translateX(-${idx * 100}%)` }}>
            {images.map((src, i) => (
              <img key={i} src={src} alt={p.name} loading="lazy"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                style={{ flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ))}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{p.icon || '📦'}</div>
        )}

        {n > 1 && (
          <>
            <button aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); go(idx - 1); }}
              style={{ position: 'absolute', top: '50%', left: 6, transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, lineHeight: '22px', padding: 0, color: '#0F172A' }}>‹</button>
            <button aria-label="Next photo" onClick={(e) => { e.stopPropagation(); go(idx + 1); }}
              style={{ position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, lineHeight: '22px', padding: 0, color: '#0F172A' }}>›</button>
            <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', gap: 4, justifyContent: 'center' }}>
              {images.map((_, i) => (
                <span key={i} style={{ width: i === idx ? 14 : 5, height: 5, borderRadius: 3, background: i === idx ? '#4F46E5' : 'rgba(120,120,120,0.4)', transition: 'width 0.2s' }} />
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#0F172A', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</h3>
        <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{p.weight || p.unit || '1 unit'}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 'auto', paddingTop: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>₹{p.price}</span>
          {p.mrp && p.mrp > p.price && <span style={{ fontSize: 11, color: '#94A3B8', textDecoration: 'line-through' }}>₹{p.mrp}</span>}
        </div>

        {qty > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 34, background: '#4F46E5', borderRadius: 9, marginTop: 2 }}>
            <button aria-label="Decrease" onClick={() => updateQty(p.id, -1)} style={{ width: 36, height: '100%', background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 18, fontWeight: 700, cursor: 'pointer', padding: 0 }}>−</button>
            <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 700 }}>{qty}</span>
            <button aria-label="Increase" onClick={() => updateQty(p.id, 1)} style={{ width: 36, height: '100%', background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 18, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+</button>
          </div>
        ) : (
          <button onClick={() => updateQty(p.id, 1)} style={{ height: 34, marginTop: 2, background: '#FFFFFF', border: '1px solid #4F46E5', color: '#4F46E5', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px' }}>ADD</button>
        )}
      </div>
    </div>
  );
}
