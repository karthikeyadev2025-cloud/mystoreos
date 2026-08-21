// ═══════════════════════════════════════════════════════════════════
// SETTLEMENT HISTORY — day reports, per van, across dates
//
// FieldSettlement only ever handled TODAY's open/close cycle. Once a
// day closed, there was no way to look back — "what did Van 01 collect
// last Tuesday" or a week's totals across every van had nowhere to be
// seen, even though every closed day was already being saved to
// day_settlements. This reads that history back; writes nothing.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, Calendar, AlertTriangle, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';

const STATUS_LABEL = {
  pending: { l: 'Pending', c: 'var(--c-faint)' },
  counted: { l: 'Counted', c: 'var(--c-warning-strong)' },
  closed: { l: 'Closed', c: 'var(--c-success-strong)' },
  variance_flagged: { l: 'Variance flagged', c: 'var(--c-danger-strong)' },
};

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export default function FieldSettlementHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const distId = distributorIdOf(user);

  const [vehicles, setVehicles] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await fieldApi.getVehicles(distId);
        if (!cancelled) setVehicles(v || []);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load vans');
      }
    })();
    return () => { cancelled = true; };
  }, [distId]);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const h = await fieldApi.getSettlementHistory(distId, { vehicleId: vehicleFilter || null });
        if (!cancelled) setHistory(h);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load settlement history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId, vehicleFilter]);

  const totals = history.reduce((acc, h) => ({
    cash: acc.cash + (h.countedCash ?? h.expectedCash ?? 0),
    upi: acc.upi + (h.countedUpi ?? h.expectedUpi ?? 0),
    credit: acc.credit + h.expectedCredit,
    varianceDays: acc.varianceDays + (h.status === 'variance_flagged' ? 1 : 0),
  }), { cash: 0, upi: 0, credit: 0, varianceDays: 0 });

  const S = {
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 16, marginBottom: 10 },
  };

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/settlement')}
        style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Today's Settlement
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-ink)', margin: '0 0 4px' }}>Day Reports</h1>
      <p style={{ fontSize: 13, color: 'var(--c-muted)', margin: '0 0 16px' }}>
        Past van settlements — cash collected, UPI, and any variance flagged at close.
      </p>

      <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
        style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--c-line)', borderRadius: 9, fontSize: 14, marginBottom: 16, background: 'var(--c-surface)' }}>
        <option value="">All vans</option>
        {vehicles.map(v => <option key={v.id} value={v.id}>{v.code}</option>)}
      </select>

      {!loading && history.length > 0 && (
        <div style={{ ...S.card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--c-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cash</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--c-ink)' }}>{inr(totals.cash)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--c-muted)', fontWeight: 700, textTransform: 'uppercase' }}>UPI</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--c-ink)' }}>{inr(totals.upi)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--c-muted)', fontWeight: 700, textTransform: 'uppercase' }}>On Credit</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--c-ink)' }}>{inr(totals.credit)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--c-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Variance Days</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: totals.varianceDays > 0 ? 'var(--c-danger-strong)' : 'var(--c-success-strong)' }}>{totals.varianceDays}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-muted)' }}>Loading…</div>
      ) : history.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--c-faint)', padding: 36 }}>
          <FileText size={26} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13 }}>No settlements recorded yet{vehicleFilter ? ' for this van' : ''}.</p>
        </div>
      ) : history.map(h => {
        const st = STATUS_LABEL[h.status] || STATUS_LABEL.pending;
        return (
          <div key={h.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-ink)' }}>{h.vehicleCode}</span>
                <span style={{ fontSize: 11, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Calendar size={11} />
                  {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: st.c, background: `${st.c}18`, padding: '3px 10px', borderRadius: 20 }}>
                {st.l}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--c-faint)', fontSize: 10 }}>Cash</div>
                <div style={{ fontWeight: 700 }}>{inr(h.countedCash ?? h.expectedCash)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--c-faint)', fontSize: 10 }}>UPI</div>
                <div style={{ fontWeight: 700 }}>{inr(h.countedUpi ?? h.expectedUpi)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--c-faint)', fontSize: 10 }}>On Credit</div>
                <div style={{ fontWeight: 700 }}>{inr(h.expectedCredit)}</div>
              </div>
            </div>

            {h.status === 'variance_flagged' && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-border)', borderRadius: 8, fontSize: 11, color: 'var(--c-danger-strong)', display: 'flex', gap: 6 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Cash {h.cashVariance < 0 ? 'short' : 'over'} by {inr(Math.abs(h.cashVariance))}
                  {h.upiVariance !== 0 && `, UPI ${h.upiVariance < 0 ? 'short' : 'over'} by ${inr(Math.abs(h.upiVariance))}`}
                  {h.overrideReason && ` — ${h.overrideReason}`}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
