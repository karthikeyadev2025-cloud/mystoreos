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
    wrap: { minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
    header: { background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', padding: '28px 20px' },
    body: { padding: '20px', maxWidth: 720, margin: '0 auto' },
    card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' },
  };

  if (loading) {
    return (
      <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} className="animate-spin" color="#4F46E5" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
        <div>
          <Store size={40} color="#94A3B8" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#334155' }}>Catalog not found</h2>
          <p style={{ fontSize: 13, color: '#94A3B8' }}>Check the link and try again, or ask the distributor to resend it.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {distributor.logo ? (
            <img src={distributor.logo} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover', background: '#fff' }} />
          ) : (
            <div style={{ width: 54, height: 54, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={26} color="#fff" />
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
          style={{ width: '100%', padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, marginBottom: 18, boxSizing: 'border-box', background: '#fff' }}
        />

        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
            <Package size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ fontSize: 13, margin: 0 }}>No products in this catalog yet.</p>
          </div>
        ) : Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#475569', textTransform: 'uppercase', margin: '0 0 8px' }}>{cat}</h3>
            {items.map(p => (
              <div key={p.id} style={S.card}>
                {p.image ? (
                  <img src={p.image} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 8, background: '#F1F5F9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} color="#CBD5E1" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{p.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#4F46E5', marginTop: 2 }}>
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
                  style={{ flexShrink: 0, background: '#4F46E5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Order
                </button>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 24, textAlign: 'center', padding: 20, background: '#EEF2FF', borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: '#3730A3', fontWeight: 700, margin: '0 0 10px' }}>
            Want to order from {distributor.name}?
          </p>
          <button onClick={() => navigate(`/register?type=shop&distributor=${encodeURIComponent(code)}`)}
            style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            Start your 15-day free trial
          </button>
        </div>
      </div>
    </div>
  );
}
