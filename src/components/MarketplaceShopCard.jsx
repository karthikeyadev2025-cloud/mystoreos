import { MapPin, MessageCircle } from 'lucide-react';

// Swiggy/Instamart-style shop card for the consumer marketplace.
// shop: shop object (logo, shopPhotos[], name, category, openNow, subscription, phone);
// dist: distance in km (number|null); onOpen(): open the storefront; onWhatsApp(): WA order.
export default function MarketplaceShopCard({ shop, dist, onOpen, onWhatsApp }) {
  const banner = (Array.isArray(shop.shopPhotos) && shop.shopPhotos[0]) || shop.logo || '';
  const initial = (shop.name || '?').trim().charAt(0).toUpperCase();
  const open = !!shop.openNow;
  const category = (shop.category || 'store').toString();

  return (
    <div
      onClick={onOpen}
      style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', transition: 'transform .15s, box-shadow .15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.10)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)'; }}
    >
      {/* Image banner */}
      <div style={{ position: 'relative', width: '100%', height: 128, background: banner ? '#0F172A' : 'linear-gradient(135deg,#4F46E5,#6366F1)', overflow: 'hidden' }}>
        {banner ? (
          <img src={banner} alt={shop.name} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 44, fontWeight: 800 }}>{initial}</div>
        )}
        {/* dark gradient for legible overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.55), rgba(15,23,42,0) 55%)' }} />
        {/* status pill */}
        <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: open ? '#10B981' : '#64748B', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />{open ? 'Open now' : 'Closed'}
        </span>
        {shop.subscription && shop.subscription !== 'trial' && (
          <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 6, background: '#F59E0B', color: '#fff' }}>PRO</span>
        )}
        {/* distance chip bottom-left over gradient */}
        <span style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 11, fontWeight: 600, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <MapPin size={11} />{dist !== null && dist !== undefined ? `${dist.toFixed(2)} km` : 'Nearby'}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B', textTransform: 'capitalize' }}>
          <span style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: 6, fontWeight: 600, color: '#475569' }}>{category}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
            style={{ flex: 1, padding: '9px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Order now
          </button>
          <button onClick={(e) => { e.stopPropagation(); onWhatsApp?.(); }} aria-label="WhatsApp order"
            style={{ width: 40, flexShrink: 0, padding: '9px', background: 'rgba(37,211,102,0.12)', color: '#1FAD53', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
