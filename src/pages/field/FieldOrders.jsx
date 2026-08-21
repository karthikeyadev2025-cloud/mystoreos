// ═══════════════════════════════════════════════════════════════════
// BOOKED ORDERS — the depot side of presale
//
// Reps book in the field during the day; someone at the depot reviews
// and releases them for dispatch. Without this screen, bookings pile
// up with no way to act on them — the loop the rep app starts has to
// close somewhere.
//
// Converting produces a real stock_order, which the distributor
// dashboard's Orders tab ALREADY handles end to end (pending →
// accepted → dispatched → delivered). So conversion isn't the start of
// a parallel process; it hands off into the one that already exists.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, ClipboardList, Send, CheckCircle2, PackageCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';

export default function FieldOrders() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState('booked');

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fieldApi.getFieldOrders(distId, { limit: 100 });
        if (!cancelled) setOrders(data);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId, reloadKey]);

  const convert = async (o) => {
    setBusy(o.id);
    try {
      await fieldApi.convertFieldOrder(o.id);
      toast.success(`${o.shopName} released for dispatch — now in your Orders tab`);
      setReloadKey(k => k + 1);
    } catch (e) {
      toast.error(e.message || 'Could not convert');
    } finally { setBusy(null); }
  };

  // Convert every outstanding booking at once. This is the actual
  // morning routine — a depot doesn't release 40 bookings one at a
  // time. Failures are counted rather than aborting the batch, so one
  // bad order can't block the other thirty-nine.
  const convertAll = async () => {
    const pending = orders.filter(o => o.status === 'booked');
    if (pending.length === 0) return;
    if (!window.confirm(`Release all ${pending.length} booked orders for dispatch?`)) return;
    setBusy('all');
    let ok = 0, failed = 0;
    for (const o of pending) {
      try { await fieldApi.convertFieldOrder(o.id); ok++; }
      catch { failed++; }
    }
    if (failed === 0) toast.success(`${ok} orders released for dispatch`);
    else toast.warn(`${ok} released · ${failed} failed — check them individually`);
    setBusy(null);
    setReloadKey(k => k + 1);
  };

  const shown = orders.filter(o => filter === 'all' || o.status === filter);
  const bookedCount = orders.filter(o => o.status === 'booked').length;
  const bookedValue = orders.filter(o => o.status === 'booked').reduce((s, o) => s + o.total, 0);

  const TABS = [
    { k: 'booked', l: `Awaiting dispatch (${bookedCount})` },
    { k: 'converted', l: 'Released' },
    { k: 'all', l: 'All' },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-muted)' }}>Loading orders…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-ink)', margin: '0 0 4px' }}>Booked Orders</h1>
      <p style={{ fontSize: 13, color: 'var(--c-muted)', margin: '0 0 20px' }}>
        Orders your reps booked in the field. Releasing one sends it to your normal Orders tab for dispatch.
      </p>

      {bookedCount > 0 && (
        <div style={{ background: 'var(--c-primary-soft)', border: '1px solid var(--c-primary-border)', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-primary)' }}>
              {bookedCount} order{bookedCount === 1 ? '' : 's'} awaiting dispatch
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-primary-hover)', marginTop: 2 }}>
              ₹{bookedValue.toLocaleString('en-IN')} total
            </div>
          </div>
          <button onClick={convertAll} disabled={busy !== null}
            style={{ background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Send size={14} /> {busy === 'all' ? 'Releasing…' : 'Release All'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${filter === t.k ? 'var(--c-primary)' : 'var(--c-line)'}`,
              background: filter === t.k ? 'var(--c-primary-soft)' : 'var(--c-surface)',
              color: filter === t.k ? 'var(--c-primary-hover)' : 'var(--c-muted)',
            }}>{t.l}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--c-faint)' }}>
          <ClipboardList size={32} style={{ opacity: 0.4, marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 13 }}>
            {filter === 'booked' ? 'Nothing awaiting dispatch.' : 'No orders here yet.'}
          </p>
        </div>
      ) : shown.map(o => (
        <div key={o.id} style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-line)',
          borderLeft: `4px solid ${o.status === 'booked' ? 'var(--c-primary)' : o.status === 'converted' ? 'var(--c-success-strong)' : 'var(--c-faint)'}`,
          borderRadius: 12, padding: 16, marginBottom: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-ink)' }}>{o.shopName}</div>
              <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                {new Date(o.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {' · '}{o.lines.length} item{o.lines.length === 1 ? '' : 's'}
              </div>
              <div style={{ marginTop: 10 }}>
                {o.lines.map(l => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-ink-2)', padding: '3px 0' }}>
                    <span>{l.productName} × {l.qtyBase}</span>
                    <span style={{ color: 'var(--c-muted)' }}>₹{(l.qtyBase * l.rate).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--c-success-strong)', marginBottom: 8 }}>
                ₹{o.total.toLocaleString('en-IN')}
              </div>
              {o.status === 'booked' ? (
                <button onClick={() => convert(o)} disabled={busy !== null}
                  style={{ background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', padding: '9px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <Send size={12} />{busy === o.id ? 'Releasing…' : 'Release'}
                </button>
              ) : o.status === 'converted' ? (
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-success-strong)', background: 'var(--c-success-soft)', padding: '5px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <CheckCircle2 size={11} /> Dispatched
                </span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-muted)', background: 'var(--c-line-soft)', padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  {o.status}
                </span>
              )}
            </div>
          </div>

          {o.status === 'converted' && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--c-line-soft)', fontSize: 11, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PackageCheck size={12} color="var(--c-success-strong)" />
              Now in your Orders tab — track dispatch from there.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
