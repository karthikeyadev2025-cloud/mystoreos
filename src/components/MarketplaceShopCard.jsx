import { MapPin, MessageCircle, Star, Clock } from 'lucide-react';

// Swiggy/Instamart-style shop card for the consumer marketplace.
// shop: shop object (logo, shopPhotos[], name, category, openNow, subscription, phone);
// dist: distance in km (number|null); onOpen(): open the storefront; onWhatsApp(): WA order.
export default function MarketplaceShopCard({ shop, dist, onOpen, onWhatsApp }) {
  const photo = (Array.isArray(shop.shopPhotos) && shop.shopPhotos[0]) || '';   // real wide store photo
  const logo = shop.logo || '';                                                  // small square logo
  const initial = (shop.name || '?').trim().charAt(0).toUpperCase();
  const open = !!shop.openNow;
  const category = (shop.category || 'store').toString();
  // Real rating only if the shop has one; otherwise show an honest "New" tag.
  const rating = typeof shop.rating === 'number' && shop.rating > 0 ? shop.rating.toFixed(1) : null;
  // Delivery time is an honest estimate derived from the real distance.
  const eta = (dist !== null && dist !== undefined) ? Math.max(8, Math.round(10 + dist * 7)) : null;

  return (
    <div
      onClick={onOpen}
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', transition: 'transform .15s, box-shadow .15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.10)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)'; }}
    >
      {/* Banner: a real photo fills it; otherwise a clean gradient with the logo
          shown as a SHARP centered medallion (never stretched) or the initial. */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: photo ? 'var(--c-ink)' : 'linear-gradient(135deg,var(--c-primary),var(--c-primary-light))', overflow: 'hidden' }}>
        {photo ? (
          <img src={photo} alt={shop.name} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : logo ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={logo} alt={shop.name} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', background: 'var(--c-surface)', border: '2px solid rgba(255,255,255,0.7)', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }} />
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-surface)', fontSize: 40, fontWeight: 800 }}>{initial}</div>
        )}
        {/* subtle gradient so overlay text stays legible on photos */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.5), rgba(15,23,42,0) 50%)' }} />
        {/* status pill */}
        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: open ? 'var(--c-success)' : 'var(--c-muted)', color: 'var(--c-surface)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--c-surface)' }} />{open ? 'Open' : 'Closed'}
        </span>
        {shop.subscription && shop.subscription !== 'trial' && (
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 8.5, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: 'var(--c-warning)', color: 'var(--c-surface)' }}>PRO</span>
        )}
        {/* distance chip */}
        <span style={{ position: 'absolute', bottom: 7, left: 8, fontSize: 10.5, fontWeight: 600, color: 'var(--c-surface)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <MapPin size={10} />{dist !== null && dist !== undefined ? `${dist.toFixed(1)} km` : 'Nearby'}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--c-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--c-muted)', textTransform: 'capitalize', flexWrap: 'wrap' }}>
          <span style={{ background: 'var(--c-line-soft)', padding: '2px 7px', borderRadius: 6, fontWeight: 600, color: 'var(--c-ink-2)' }}>{category}</span>
          {/* Multi-branch brands get a "N locations" pill so customers
              immediately see this brand has multiple outlets. Tapping the
              card lands on the main shop's storefront which carries the
              "Also visit our other locations" cross-link card built in
              Phase 4 of branches. */}
          {shop.branchCount > 0 && (
            <span style={{ background: 'var(--c-primary-soft)', padding: '2px 7px', borderRadius: 6, fontWeight: 700, color: 'var(--c-primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              🏪 {shop.branchCount + 1} locations
            </span>
          )}
          {rating ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, color: 'var(--c-success-strong)' }}>
              <Star size={11} fill="#15803D" color="#15803D" />{rating}
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, color: 'var(--c-primary)' }}>
              <Star size={11} color="var(--c-primary)" />New
            </span>
          )}
          {eta && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--c-muted)' }}>
              <Clock size={11} />~{eta}m
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 'auto', paddingTop: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
            style={{ flex: 1, padding: '8px', background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Order now
          </button>
          <button onClick={(e) => { e.stopPropagation(); onWhatsApp?.(); }} aria-label="WhatsApp order"
            style={{ width: 36, flexShrink: 0, padding: '8px', background: 'rgba(37,211,102,0.12)', color: 'var(--c-success)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
