import { useState, useRef, useEffect } from 'react';

export default function StorefrontProductDetail({ product, qty = 0, updateQty, onClose }) {
  const images = (Array.isArray(product?.images) && product.images.length
    ? product.images
    : product?.image ? [product.image] : []
  ).filter(Boolean);

  const [idx, setIdx]         = useState(0);
  const [imgLoaded, setLoaded] = useState({});
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
  const onTouchEnd   = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 30) go(dx < 0 ? idx + 1 : idx - 1);
    touchX.current = null;
  };

  // Discount — same logic as card
  let discPct = 0, displayPrice = Number(product.price) || 0, originalPrice = null;
  if (product.discountPct && Number(product.discountPct) > 0) {
    discPct = Number(product.discountPct);
    originalPrice = displayPrice;
    displayPrice = Math.round(originalPrice * (1 - discPct / 100));
  } else if (product.mrp && Number(product.mrp) > Number(product.price)) {
    originalPrice = Number(product.mrp);
    discPct = Math.round(((originalPrice - displayPrice) / originalPrice) * 100);
  }

  const saving = originalPrice ? (originalPrice - displayPrice) : 0;
  const outOfStock = (product.stock ?? 999) <= 0;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#FFFFFF', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, maxHeight: '93vh', overflow: 'auto', boxShadow: '0 -8px 40px rgba(15,23,42,0.2)' }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#CBD5E1' }} />
        </div>

        {/* Image */}
        <div
          style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#F8FAFC', overflow: 'hidden' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.5)', color: '#fff', fontSize: 18, cursor: 'pointer', padding: 0, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>

          {discPct > 0 && (
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8, boxShadow: '0 2px 8px rgba(239,68,68,0.4)', letterSpacing: '0.02em' }}>
              {discPct}% OFF
            </div>
          )}

          {n > 0 ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {images.map((src, i) => (
                <div key={i} style={{ position: 'absolute', inset: 0, opacity: i === idx ? 1 : 0, transition: 'opacity 0.25s ease' }}>
                  {/* Skeleton while loading */}
                  {!imgLoaded[i] && (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#F1F5F9 0%,#E2E8F0 50%,#F1F5F9 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  )}
                  <img
                    src={src}
                    alt={`${product.name} ${i + 1}`}
                    decoding="async"
                    onLoad={() => setLoaded(l => ({ ...l, [i]: true }))}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: imgLoaded[i] ? 1 : 0, transition: 'opacity 0.3s ease' }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>
              {product.icon || '📦'}
            </div>
          )}

          {n > 1 && (
            <>
              <button onClick={() => go(idx - 1)} aria-label="Previous" style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)', zIndex: 4, width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 18, padding: 0, boxShadow: '0 1px 6px rgba(0,0,0,0.15)' }}>‹</button>
              <button onClick={() => go(idx + 1)} aria-label="Next"     style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', zIndex: 4, width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 18, padding: 0, boxShadow: '0 1px 6px rgba(0,0,0,0.15)' }}>›</button>
              <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', gap: 5, justifyContent: 'center', zIndex: 4 }}>
                {images.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, background: i === idx ? '#4F46E5' : 'rgba(255,255,255,0.65)', border: 'none', padding: 0, cursor: 'pointer', transition: 'width 0.2s, background 0.2s', boxShadow: '0 0 3px rgba(0,0,0,0.3)' }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {n > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', overflowX: 'auto' }}>
            {images.map((src, i) => (
              <img key={i} src={src} alt="" onClick={() => setIdx(i)}
                style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: i === idx ? '2.5px solid #4F46E5' : '1.5px solid #E2E8F0', opacity: i === idx ? 1 : 0.65, transition: 'opacity 0.15s, border-color 0.15s' }}
              />
            ))}
          </div>
        )}

        {/* Info */}
        <div style={{ padding: '16px 16px 24px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: '#0F172A', lineHeight: 1.25 }}>{product.name}</h2>

          {(product.weight || product.unit) && (
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 14px', fontWeight: 500 }}>{product.weight || product.unit}</p>
          )}

          {/* Price block */}
          {originalPrice ? (
            <div style={{ background: 'linear-gradient(135deg, #FEF2F2, #FFF7ED)', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em' }}>₹{displayPrice}</span>
                  <span style={{ fontSize: 15, color: '#94A3B8', textDecoration: 'line-through', fontWeight: 500 }}>₹{originalPrice}</span>
                </div>
                <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 700, marginTop: 3 }}>
                  🎉 You save ₹{saving} ({discPct}% off)
                </div>
              </div>
              <div style={{ background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 800, padding: '6px 12px', borderRadius: 8, boxShadow: '0 2px 8px rgba(239,68,68,0.35)' }}>
                {discPct}% OFF
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em' }}>₹{displayPrice}</span>
            </div>
          )}

          {product.description && (
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 16px' }}>{product.description}</p>
          )}

          {/* Additional info */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {product.batchNumber && (
              <span style={{ fontSize: 11, background: '#F1F5F9', color: '#64748B', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>Batch: {product.batchNumber}</span>
            )}
            {product.expiryDate && (
              <span style={{ fontSize: 11, background: new Date(product.expiryDate) < new Date() ? '#FEF2F2' : '#F1F5F9', color: new Date(product.expiryDate) < new Date() ? '#DC2626' : '#64748B', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>Exp: {product.expiryDate}</span>
            )}
            {product.hsnCode && (
              <span style={{ fontSize: 11, background: '#F1F5F9', color: '#64748B', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>HSN: {product.hsnCode}</span>
            )}
            {product.stock != null && (
              <span style={{ fontSize: 11, background: outOfStock ? '#FEF2F2' : product.stock < 10 ? '#FEF3C7' : '#ECFDF5', color: outOfStock ? '#DC2626' : product.stock < 10 ? '#D97706' : '#16A34A', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                {outOfStock ? 'Out of stock' : product.stock < 10 ? `Only ${product.stock} left!` : 'In stock ✓'}
              </span>
            )}
          </div>

          {/* Add / Qty */}
          {qty > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, background: '#4F46E5', borderRadius: 14, boxShadow: '0 4px 16px rgba(79,70,229,0.3)' }}>
              <button aria-label="Remove one" onClick={() => updateQty(product.id, -1)} style={{ width: 60, height: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 24, fontWeight: 700, cursor: 'pointer' }}>−</button>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{qty} in cart</span>
              <button aria-label="Add one more" onClick={() => updateQty(product.id, 1)} style={{ width: 60, height: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 24, fontWeight: 700, cursor: 'pointer' }}>+</button>
            </div>
          ) : (
            <button
              disabled={outOfStock}
              onClick={() => !outOfStock && updateQty(product.id, 1)}
              style={{ width: '100%', height: 52, background: outOfStock ? '#F1F5F9' : '#4F46E5', border: 'none', color: outOfStock ? '#94A3B8' : '#fff', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: outOfStock ? 'not-allowed' : 'pointer', boxShadow: outOfStock ? 'none' : '0 4px 16px rgba(79,70,229,0.3)', letterSpacing: '0.3px' }}
            >
              {outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
