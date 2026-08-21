// ═══════════════════════════════════════════════════════════════════
// PUBLIC CATALOG — reachable with NO login at all
//
// This is the actual fix for the shared distributor link. The WhatsApp
// / "Copy Web Catalog Link" share pointed to /shop?distributor=CODE,
// which cannot work for its purpose: /shop requires a shop/staff login,
// and even that page has no code reading a distributor query param.
// The whole point of sharing this link is reaching shops who have
// NEVER signed up — Jyothi Foods alone has ~10,000 real-world shop
// relationships with no MyStore OS account yet. A login wall defeats
// the entire feature.
//
// Reads exactly two things, both deliberately public:
//   - the distributor's name/logo/address via a security-definer RPC
//     that returns only those four safe fields (see the migration)
//   - their product catalogue, which already had a public RLS policy
//     from day one (shops need to browse it before deciding to link)
//
// No cart, no ordering here — that still requires an account, which is
// the correct boundary. This page's job is showing a shop what's on
// offer clearly enough that they register.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Store, MapPin, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { UNIT_SUFFIX } from '../lib/units';

export default function PublicCatalog() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [distributor, setDistributor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const dist = await api.getDistributorPublicProfile(code);
        if (cancelled) return;
        if (!dist) { setNotFound(true); setLoading(false); return; }
        setDistributor(dist);
        const prods = await api.getDistributorProducts(dist.id);
        if (!cancelled) setProducts(prods || []);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const grouped = products
    .filter(p => !search.trim() || p.name?.toLowerCase().includes(search.toLowerCase()))
    .reduce((acc, p) => {
      const cat = p.category || 'Other';
      (acc[cat] ||= []).push(p);
      return acc;
    }, {});

  const S = {
    wrap: { minHeight: '100vh', background: 'var(--c-bg)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
    header: { background: 'linear-gradient(135deg,var(--c-primary),var(--c-primary-hover))', color: 'var(--c-surface)', padding: '28px 20px' },
    body: { padding: '20px', maxWidth: 720, margin: '0 auto' },
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' },
  };

  if (loading) {
    return (
      <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} className="animate-spin" color="var(--c-primary)" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
        <div>
          <Store size={40} color="var(--c-faint)" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-ink-2)' }}>Catalog not found</h2>
          <p style={{ fontSize: 13, color: 'var(--c-faint)' }}>Check the link and try again, or ask the distributor to resend it.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {distributor.logo ? (
            <img src={distributor.logo} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover', background: 'var(--c-surface)' }} />
          ) : (
            <div style={{ width: 54, height: 54, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={26} color="var(--c-surface)" />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>{distributor.name}</h1>
            {distributor.businessAddress && (
              <p style={{ fontSize: 12, opacity: 0.85, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} /> {distributor.businessAddress}
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={S.body}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search products…"
          style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--c-line)', borderRadius: 10, fontSize: 14, marginBottom: 18, boxSizing: 'border-box', background: 'var(--c-surface)' }}
        />

        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--c-faint)' }}>
            <Package size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ fontSize: 13, margin: 0 }}>No products in this catalog yet.</p>
          </div>
        ) : Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-ink-2)', textTransform: 'uppercase', margin: '0 0 8px' }}>{cat}</h3>
            {items.map(p => (
              <div key={p.id} style={S.card}>
                {p.image ? (
                  <img src={p.image} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--c-line)' }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--c-line-soft)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} color="var(--c-line-strong)" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-ink)' }}>{p.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-primary)', marginTop: 2 }}>
                    ₹{p.price}{p.unit ? ` / ${UNIT_SUFFIX[p.unit] || p.unit}` : ''}
                  </div>
                </div>
                {/* Real per-product order action, not just a generic CTA
                    at the bottom of the page. type=shop is explicit
                    rather than relying on Register's default, and
                    distributor carries through so registering auto-
                    links them — no separate manual code-entry step
                    after signup. */}
                <button
                  onClick={() => navigate(`/register?type=shop&distributor=${encodeURIComponent(code)}`)}
                  style={{ flexShrink: 0, background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Order
                </button>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 24, textAlign: 'center', padding: 20, background: 'var(--c-primary-soft)', borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: '#3730A3', fontWeight: 700, margin: '0 0 10px' }}>
            Want to order from {distributor.name}?
          </p>
          <button onClick={() => navigate(`/register?type=shop&distributor=${encodeURIComponent(code)}`)}
            style={{ background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            Start your 15-day free trial
          </button>
        </div>
      </div>
    </div>
  );
}
