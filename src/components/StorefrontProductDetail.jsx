import { useState, useRef, useEffect } from 'react';

// Full-screen product detail with an enlarged, swipeable gallery of all photos.
// product: the product; qty: cart qty; updateQty(id, delta); onClose().
export default function StorefrontProductDetail({ product, qty = 0, updateQty, onClose }) {
  const images = (Array.isArray(product?.images) && product.images.length ? product.images : (product?.image ? [product.image] : [])).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const touchX = useRef(null);
  const n = images.length;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!product) return null;
  const go = (next) => { if (n > 1) setIdx(((next % n) + n) % n); };
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 30) go(dx < 0 ? idx + 1 : idx - 1);
    touchX.current = null;
  };
  const pct = (product.mrp && product.mrp > product.price) ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(15,23,42,0.25)' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#F8FAFC', overflow: 'hidden' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, zIndex: 3, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.55)', color: '#fff', fontSize: 17, cursor: 'pointer', padding: 0 }}>×</button>
          {pct > 0 && (
            <span style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 7 }}>{pct}% OFF</span>
          )}
          {n > 0 ? (
            <div style={{ display: 'flex', height: '100%', transition: 'transform 0.28s ease', transform: `translateX(-${idx * 100}%)` }}>
              {images.map((src, i) => (
                <img key={i} src={src} alt={product.name} style={{ flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ))}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>{product.icon || '📦'}</div>
          )}
          {n > 1 && (
            <>
              <button aria-label="Previous" onClick={() => go(idx - 1)} style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 17, padding: 0 }}>‹</button>
              <button aria-label="Next" onClick={() => go(idx + 1)} style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 17, padding: 0 }}>›</button>
            </>
          )}
        </div>

        {n > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px 0', overflowX: 'auto' }}>
            {images.map((src, i) => (
              <img key={i} src={src} alt="" onClick={() => setIdx(i)}
                style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: i === idx ? '2px solid #4F46E5' : '1px solid #E2E8F0' }} />
            ))}
          </div>
        )}

        <div style={{ padding: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: '#0F172A' }}>{product.name}</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 12px' }}>{product.weight || product.unit || '1 unit'}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: product.description ? 12 : 16 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>₹{product.price}</span>
            {product.mrp && product.mrp > product.price && <span style={{ fontSize: 14, color: '#94A3B8', textDecoration: 'line-through' }}>₹{product.mrp}</span>}
            {pct > 0 && <span style={{ fontSize: 13, color: '#10B981', fontWeight: 700 }}>{pct}% off</span>}
          </div>
          {product.description && (
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '0 0 16px' }}>{product.description}</p>
          )}

          {qty > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 46, background: '#4F46E5', borderRadius: 11 }}>
              <button aria-label="Decrease" onClick={() => updateQty(product.id, -1)} style={{ width: 56, height: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>−</button>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{qty} in cart</span>
              <button aria-label="Increase" onClick={() => updateQty(product.id, 1)} style={{ width: 56, height: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>+</button>
            </div>
          ) : (
            <button onClick={() => updateQty(product.id, 1)} style={{ width: '100%', height: 46, background: '#4F46E5', border: 'none', color: '#fff', borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Add to cart</button>
          )}
        </div>
      </div>
    </div>
  );
}
