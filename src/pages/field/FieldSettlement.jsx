// ═══════════════════════════════════════════════════════════════════
// EOD SETTLEMENT — the evening crush, 20 drivers returning at once
//
// Two independent balances, both must close:
//   STOCK: what the ledger says is on the van vs what's physically there
//   CASH:  what today's invoices say was collected vs what's in hand
//
// A clean match closes in one tap. A real variance is BLOCKED, not
// silently accepted — closing past tolerance requires a typed reason,
// which is permanently recorded. This is the check that stops a
// shortfall being waved through because it's 7pm and everyone wants
// to go home.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, Scale, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';

export default function FieldSettlement() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);

  const [countedCash, setCountedCash] = useState('');
  const [countedUpi, setCountedUpi] = useState('');
  const [counts, setCounts] = useState({});
  const [blockedResult, setBlockedResult] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await fieldApi.getVehicles(distId);
        if (cancelled) return;
        setVehicles(v);
        if (v.length === 1) setVehicleId(v[0].id);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId]);

  const openToday = async () => {
    setOpening(true);
    try {
      const id = await fieldApi.openSettlement(distId, vehicleId);
      const s = await fieldApi.getSettlement(id);
      setSettlement(s);
      setCounts(Object.fromEntries(s.lines.map(l => [l.productId, l.countedQty ?? l.expectedQty])));
      if (s.countedCash != null) setCountedCash(String(s.countedCash));
      if (s.countedUpi != null) setCountedUpi(String(s.countedUpi));
    } catch (e) {
      toast.error(e.message || 'Could not open settlement');
    } finally { setOpening(false); }
  };

  const doClose = async (withOverride = false) => {
    setClosing(true);
    try {
      const result = await fieldApi.closeSettlement(settlement.id, {
        countedCash: parseFloat(countedCash) || 0,
        countedUpi: parseFloat(countedUpi) || 0,
        stockCounts: Object.entries(counts).map(([productId, countedQty]) => ({ productId, countedQty: parseFloat(countedQty) || 0 })),
        closedBy: user.id,
        overrideReason: withOverride ? overrideReason : null,
      });
      if (result.closed) {
        toast.success('Settlement closed');
        setBlockedResult(null);
        setOverrideReason('');
        const refreshed = await fieldApi.getSettlement(settlement.id);
        setSettlement(refreshed);
      } else {
        setBlockedResult(result);
        toast.warn('Variance outside tolerance — a reason is needed to close');
      }
    } catch (e) {
      toast.error(e.message || 'Could not close settlement');
    } finally { setClosing(false); }
  };

  const cashDiff = settlement && countedCash !== '' ? (parseFloat(countedCash) || 0) - settlement.expectedCash : null;
  const upiDiff = settlement && countedUpi !== '' ? (parseFloat(countedUpi) || 0) - settlement.expectedUpi : null;

  const S = {
    card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.06)', marginBottom: 16 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 },
  };

  const diffColor = (d) => d == null ? '#64748B' : d === 0 ? '#059669' : '#DC2626';

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>End-of-Day Settlement</h1>
        {/* The screen this session was missing — settlement only ever
            showed today. Without this link it would only be reachable
            by typing the URL directly. */}
        <button onClick={() => navigate('/field/settlement/history')}
          style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          📊 Day Reports
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
        Stock and cash both close independently — a real gap in either is blocked, not waved through.
      </p>

      <select value={vehicleId} onChange={e => { setVehicleId(e.target.value); setSettlement(null); }}
        style={{ ...S.input, marginBottom: 14, fontWeight: 700 }}>
        <option value="">— pick a van —</option>
        {vehicles.map(v => <option key={v.id} value={v.id}>{v.code} · {v.warehouseName}</option>)}
      </select>

      {vehicleId && !settlement && (
        <div style={{ ...S.card, textAlign: 'center' }}>
          <Scale size={24} color="#4F46E5" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px' }}>
            Pulls today's actual sales and current van stock to compute what's expected.
          </p>
          <button onClick={openToday} disabled={opening}
            style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            {opening ? 'Opening…' : "Open Today's Settlement"}
          </button>
        </div>
      )}

      {settlement && (
        <>
          {settlement.status === 'closed' ? (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={20} color="#059669" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#047857' }}>Settlement closed</div>
                {settlement.overrideReason && <div style={{ fontSize: 11, color: '#065F46', marginTop: 2 }}>Override: {settlement.overrideReason}</div>}
              </div>
            </div>
          ) : (
            <>
              {/* CASH SIDE */}
              <div style={S.card}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 14px' }}>Cash &amp; UPI</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={S.label}>Expected cash</label>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>₹{settlement.expectedCash.toLocaleString('en-IN')}</div>
                    <label style={S.label}>Counted cash</label>
                    <input type="number" value={countedCash} onChange={e => setCountedCash(e.target.value)} placeholder="0" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Expected UPI</label>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>₹{settlement.expectedUpi.toLocaleString('en-IN')}</div>
                    <label style={S.label}>Counted UPI (from app)</label>
                    <input type="number" value={countedUpi} onChange={e => setCountedUpi(e.target.value)} placeholder="0" style={S.input} />
                  </div>
                </div>
                {(cashDiff !== null || upiDiff !== null) && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 20, fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: diffColor(cashDiff) }}>Cash diff: {cashDiff > 0 ? '+' : ''}₹{cashDiff?.toLocaleString('en-IN')}</span>
                    <span style={{ color: diffColor(upiDiff) }}>UPI diff: {upiDiff > 0 ? '+' : ''}₹{upiDiff?.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {settlement.expectedCredit > 0 && (
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 10 }}>
                    + ₹{settlement.expectedCredit.toLocaleString('en-IN')} sold on credit today — added to shop khatas, not counted as cash.
                  </p>
                )}
              </div>

              {/* STOCK SIDE */}
              <div style={S.card}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 14px' }}>Physical Stock Count</h2>
                {settlement.lines.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94A3B8' }}>Van shows no stock to count.</p>
                ) : settlement.lines.map(l => {
                  const counted = counts[l.productId] ?? '';
                  const diff = counted !== '' ? (parseFloat(counted) || 0) - l.expectedQty : null;
                  return (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.productName}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>Expected {l.expectedQty}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {diff !== null && diff !== 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>{diff > 0 ? '+' : ''}{diff}</span>
                        )}
                        <input type="number" value={counted}
                          onChange={e => setCounts(c => ({ ...c, [l.productId]: e.target.value }))}
                          style={{ width: 80, padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 13, textAlign: 'center' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {blockedResult && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <AlertTriangle size={16} color="#B45309" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>Variance outside normal tolerance</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#78350F', margin: '0 0 10px' }}>
                    Cash {blockedResult.cash_variance > 0 ? '+' : ''}₹{blockedResult.cash_variance} · UPI {blockedResult.upi_variance > 0 ? '+' : ''}₹{blockedResult.upi_variance} · Stock variance value ₹{blockedResult.stock_variance_value}
                  </p>
                  <label style={S.label}>Reason (required to close)</label>
                  <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g. Rep gave ₹200 advance, confirmed by shop owner"
                    style={{ ...S.input, marginBottom: 10 }} />
                  <button onClick={() => doClose(true)} disabled={closing || !overrideReason.trim()}
                    style={{ background: overrideReason.trim() ? '#B45309' : '#CBD5E1', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: overrideReason.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={13} /> Close With Reason
                  </button>
                </div>
              )}

              {!blockedResult && (
                <button onClick={() => doClose(false)} disabled={closing}
                  style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', padding: 14, borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                  {closing ? 'Checking…' : 'Close Settlement'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
