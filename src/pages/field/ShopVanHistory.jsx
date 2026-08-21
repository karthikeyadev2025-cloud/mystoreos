// ═══════════════════════════════════════════════════════════════════
// MY VAN PURCHASES — shopkeeper self-service
//
// Lives in the field/ module tree, not ShopDashboard.jsx, even though
// a SHOP uses this screen — it reads field-specific tables (van_
// invoices, van_returns) that have nothing to do with the rest of the
// shop dashboard, and keeping it separate means zero risk to that
// 9,000+ line file. Reachable at its own route from a shop login.
//
// This exists because the gap was real: a shop that bought something
// spot from a van, or had a return processed, previously had no way
// to see either anywhere in their own account.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, ShoppingBag, RotateCcw, Receipt } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';

export default function ShopVanHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // A shop's own staff must see the SHOP's history, not their own
  // (empty) record — same resolution ShopDashboard uses everywhere.
  const shopId = user?.role === 'staff' ? user.staff_of : user?.id;
  const [data, setData] = useState({ purchases: [], returns: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('purchases');
  const [busy, setBusy] = useState(null);

  // Van purchases had no route into the shop's inventory at all — the
  // stock-order flow has an "Add to Stock" step, van sales had nothing,
  // so a shopkeeper had to hand-edit every product after a van visit.
  const receiveIntoStock = async (item) => {
    setBusy(item.id);
    try {
      const r = await fieldApi.receiveVanInvoice(item.id, user.id);
      const parts = [];
      if (r?.updated) parts.push(`${r.updated} topped up`);
      if (r?.created) parts.push(`${r.created} added`);
      toast.success(parts.length ? parts.join(' · ') : 'Added to your stock');
      setData(d => ({
        ...d,
        purchases: d.purchases.map(p => p.id === item.id ? { ...p, receivedAt: new Date().toISOString() } : p),
      }));
    } catch (e) {
      toast.error(e.message || 'Could not add to stock');
    } finally { setBusy(null); }
  };


  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fieldApi.getShopVanHistory(shopId);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load your van purchase history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  const S = {
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 16, marginBottom: 10 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-muted)' }}>Loading…</div>;

  const items = tab === 'purchases' ? data.purchases : data.returns;

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/shop')}
        style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-ink)', margin: '0 0 4px' }}>My Van Purchases</h1>
      <p style={{ fontSize: 13, color: 'var(--c-muted)', margin: '0 0 20px' }}>
        Everything you've bought or returned directly from a distributor's van.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('purchases')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            border: `1px solid ${tab === 'purchases' ? 'var(--c-primary)' : 'var(--c-line)'}`,
            background: tab === 'purchases' ? 'var(--c-primary-soft)' : 'var(--c-surface)', color: tab === 'purchases' ? 'var(--c-primary-hover)' : 'var(--c-muted)' }}>
          <ShoppingBag size={14} /> Purchases ({data.purchases.length})
        </button>
        <button onClick={() => setTab('returns')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            border: `1px solid ${tab === 'returns' ? 'var(--c-danger-strong)' : 'var(--c-line)'}`,
            background: tab === 'returns' ? 'var(--c-danger-soft)' : 'var(--c-surface)', color: tab === 'returns' ? 'var(--c-danger-strong)' : 'var(--c-muted)' }}>
          <RotateCcw size={14} /> Returns ({data.returns.length})
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--c-faint)', padding: 40 }}>
          <Receipt size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13 }}>No {tab} yet.</p>
        </div>
      ) : items.map(item => (
        <div key={item.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-ink)' }}>{item.ref}</div>
              <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                {item.distributorName} · {new Date(item.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              {tab === 'returns' && (
                <div style={{ fontSize: 11, color: 'var(--c-danger-strong)', marginTop: 2, textTransform: 'capitalize' }}>{item.reason?.replace('_', ' ')}</div>
              )}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: tab === 'returns' ? 'var(--c-danger-strong)' : 'var(--c-success-strong)', whiteSpace: 'nowrap' }}>
              {tab === 'returns' ? '+' : ''}₹{item.total.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--c-line-soft)' }}>
            {item.lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-ink-2)', padding: '2px 0' }}>
                <span>{l.name} × {l.qty}</span>
                <span>₹{(l.qty * l.rate).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          {tab === 'purchases' && (
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-faint)', textTransform: 'uppercase' }}>
                Paid via {item.paymentMode}
              </span>
              {item.receivedAt ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-success-strong)' }}>✅ In your stock</span>
              ) : (
                <button onClick={() => receiveIntoStock(item)} disabled={busy === item.id}
                  style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary-hover)', border: '1px solid var(--c-primary-border)', padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  📦 {busy === item.id ? 'Adding…' : 'Add to my stock'}
                </button>
              )}
              <button
                onClick={() => {
                  const lines = item.lines.map(l => `${l.name} x${l.qty}`).join('\n');
                  const msg = `Hi, I'd like to reorder what I got in ${item.ref}:\n\n${lines}\n\nPlease let me know availability. Thanks!`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                style={{ background: 'var(--c-success-soft)', color: 'var(--c-success-strong)', border: '1px solid var(--c-success-soft)', padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                💬 Reorder via WhatsApp
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
