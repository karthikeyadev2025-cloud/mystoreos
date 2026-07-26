// ═══════════════════════════════════════════════════════════════════
// STOCK OVERVIEW — where everything is, right now
//
// At 20 vans, "check each van individually" isn't a workable answer.
// This is the single view that tells you what's on every vehicle and
// in every depot.
//
// Two things are surfaced deliberately rather than left for someone
// to work out:
//   • Near-expiry stock, especially on a van — it's the thing that
//     turns into a return tomorrow if nobody catches it today.
//   • Quarantine stock shown separately and never mixed into the
//     sellable total, so a damaged-goods figure can't be mistaken
//     for stock that's available to sell.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, Warehouse, Truck, AlertTriangle, Package } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';

const TYPE_META = {
  main:       { label: 'Depot',          color: '#4F46E5', Icon: Warehouse },
  van:        { label: 'Van',            color: '#059669', Icon: Truck },
  quarantine: { label: 'Quarantine Bay', color: '#DC2626', Icon: AlertTriangle },
};

// Anything inside 30 days is worth flagging — that's roughly the
// window where it still has a chance of selling through if it's
// pushed, and past which it becomes a return.
const EXPIRY_WARN_DAYS = 30;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr + 'T00:00:00').getTime() - Date.now();
  return Math.floor(ms / 86400000);
}

export default function FieldStock() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fieldApi.getAllStock(distId);
        if (!cancelled) setLocations(data);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load stock');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId]);

  const describeQty = (l) => {
    if (l.packSize && l.qtyBase % l.packSize === 0) {
      return `${l.qtyBase} ${l.unit || 'units'} · ${l.qtyBase / l.packSize} boxes`;
    }
    return `${l.qtyBase} ${l.unit || 'units'}`;
  };

  const S = {
    card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.06)', marginBottom: 16 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading stock…</div>;

  // Expiry alerts are pulled to the top rather than left buried inside
  // a location's product list — nobody scrolls 20 vans looking for them.
  const expiringSoon = locations.flatMap(loc =>
    loc.lines
      .filter(l => l.condition === 'sellable' && l.expiryDate !== null)
      .map(l => ({ ...l, locationName: loc.name, locationType: loc.type, days: daysUntil(l.expiryDate) }))
      .filter(l => l.days !== null && l.days <= EXPIRY_WARN_DAYS)
  ).sort((a, b) => a.days - b.days);

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>Stock Overview</h1>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 24px' }}>
        Live stock across every depot and van.
      </p>

      {expiringSoon.length > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={16} color="#B45309" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#92400E' }}>
              {expiringSoon.length} batch{expiringSoon.length === 1 ? '' : 'es'} expiring within {EXPIRY_WARN_DAYS} days
            </span>
          </div>
          {expiringSoon.slice(0, 6).map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#78350F', padding: '4px 0' }}>
              <span>
                <strong>{l.productName}</strong>
                {l.batchNo && <span style={{ opacity: 0.7 }}> · {l.batchNo}</span>}
                <span style={{ opacity: 0.7 }}> · {l.locationName}</span>
              </span>
              <span style={{ fontWeight: 800, whiteSpace: 'nowrap', marginLeft: 12 }}>
                {l.days < 0 ? 'EXPIRED' : l.days === 0 ? 'Today' : `${l.days}d`}
              </span>
            </div>
          ))}
          {expiringSoon.length > 6 && (
            <div style={{ fontSize: 11, color: '#92400E', marginTop: 6, opacity: 0.8 }}>
              + {expiringSoon.length - 6} more
            </div>
          )}
        </div>
      )}

      {locations.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#64748B' }}>
          No locations yet — set up a depot first.
        </div>
      ) : locations.map(loc => {
        const meta = TYPE_META[loc.type] || TYPE_META.main;
        const { Icon } = meta;
        const sellable = loc.lines.filter(l => l.condition === 'sellable');
        const held = loc.lines.filter(l => l.condition !== 'sellable');

        return (
          <div key={loc.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={18} color={meta.color} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{loc.name}</div>
                  <div style={{ fontSize: 11, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.label}</div>
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                {loc.lines.length} line{loc.lines.length === 1 ? '' : 's'}
              </span>
            </div>

            {loc.lines.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '12px 0', margin: 0 }}>
                {loc.type === 'van' ? 'Van is empty — nothing loaded.' : 'No stock here.'}
              </p>
            ) : (
              <>
                {sellable.map(l => {
                  const d = daysUntil(l.expiryDate);
                  const warn = d !== null && d <= EXPIRY_WARN_DAYS;
                  return (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.productName}</div>
                        {l.batchNo && (
                          <div style={{ fontSize: 11, color: warn ? '#B45309' : '#64748B', fontWeight: warn ? 700 : 400 }}>
                            Batch {l.batchNo}
                            {l.expiryDate && ` · exp ${new Date(l.expiryDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', whiteSpace: 'nowrap', marginLeft: 12 }}>
                        {describeQty(l)}
                      </span>
                    </div>
                  );
                })}

                {held.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #FECACA' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Package size={12} /> Not for sale
                    </div>
                    {held.map(l => (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.productName}</div>
                          <div style={{ fontSize: 11, color: '#B91C1C', textTransform: 'capitalize' }}>{l.condition}</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', whiteSpace: 'nowrap', marginLeft: 12 }}>
                          {describeQty(l)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
