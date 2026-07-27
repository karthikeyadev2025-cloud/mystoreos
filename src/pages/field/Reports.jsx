// ═══════════════════════════════════════════════════════════════════
// REPORTS — P&L, GST liability, stock valuation
//
// None of this was computable before purchases recorded a real cost
// basis. The app knew selling prices and nothing about cost, so any
// profit figure would have been invented.
//
// Every number here is derived from data already loaded, and anything
// the data can't support is stated plainly rather than estimated.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, TrendingUp, Percent, Package, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { purchaseApi } from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';
import { profitAndLoss, gstSummary, inputCreditSummary, stockValuation } from '../../lib/distributorReports';

const PERIODS = [
  { k: '30', label: 'Last 30 days', days: 30 },
  { k: '90', label: 'Last 90 days', days: 90 },
  { k: '365', label: 'This year', days: 365 },
];

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export default function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const distId = distributorIdOf(user);

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [o, p, pu] = await Promise.all([
          api.getDistributorOrders(distId),
          api.getDistributorProducts(distId),
          purchaseApi.getPurchases(distId, 500),
        ]);
        if (cancelled) return;
        setOrders(o || []); setProducts(p || []); setPurchases(pu || []);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load reports');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId]);

  // "Now" is captured ONCE when the screen opens rather than read during
  // render. Two figures computed a render apart would otherwise cover
  // very slightly different windows, and a report whose totals shift
  // under you isn't a report.
  const [anchorNow] = useState(() => Date.now());
  const { from, to } = useMemo(() => {
    const days = PERIODS.find(p => p.k === period)?.days || 30;
    return { from: new Date(anchorNow - days * 86400000), to: new Date(anchorNow) };
  }, [period, anchorNow]);

  const pl = useMemo(() => profitAndLoss({ orders, products, purchases, from, to }), [orders, products, purchases, from, to]);
  const gst = useMemo(() => gstSummary({ orders, products, from, to }), [orders, products, from, to]);
  const input = useMemo(() => inputCreditSummary({ purchases, from, to }), [purchases, from, to]);
  const stock = useMemo(() => stockValuation(products), [products]);

  // Output tax minus input credit — what's actually payable. Showing
  // output tax alone would badly overstate the liability for anyone
  // who buys stock, which is every distributor.
  const netGst = gst.totalTax - input.tax;

  const S = {
    card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18, marginBottom: 14 },
    h: { fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading reports…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 780, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/distributor')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 12px' }}>Reports</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button key={p.k} onClick={() => setPeriod(p.k)}
            style={{ padding: '8px 15px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${period === p.k ? '#4F46E5' : '#E2E8F0'}`,
              background: period === p.k ? '#EEF2FF' : '#fff', color: period === p.k ? '#4338CA' : '#64748B' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── PROFIT & LOSS ────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.h}><TrendingUp size={16} color="#059669" /> Profit &amp; Loss</h2>
        <div style={S.row}><span style={{ color: '#64748B' }}>Revenue ({pl.orderCount} orders)</span><strong>{inr(pl.revenue)}</strong></div>
        <div style={S.row}><span style={{ color: '#64748B' }}>Cost of goods sold</span><span style={{ color: '#DC2626' }}>− {inr(pl.cogs)}</span></div>
        <div style={{ ...S.row, borderTop: '1px solid #E2E8F0', marginTop: 6, paddingTop: 12 }}>
          <strong style={{ fontSize: 15 }}>Gross profit</strong>
          <strong style={{ fontSize: 20, color: pl.grossProfit >= 0 ? '#059669' : '#DC2626' }}>
            {inr(pl.grossProfit)} <span style={{ fontSize: 12, fontWeight: 700 }}>({pl.marginPct}%)</span>
          </strong>
        </div>

        {pl.purchaseValue > 0 && (
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '10px 0 0' }}>
            {inr(pl.purchaseValue)} of stock purchased this period. Not deducted above — buying stock isn&apos;t an
            expense until it sells, so subtracting it would make any restocking month look like a loss.
          </p>
        )}

        {!pl.isComplete && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', gap: 8 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {inr(pl.unknownCostValue)} of sales across {pl.unknownLines} line{pl.unknownLines === 1 ? '' : 's'} have
              no recorded cost, so real profit is <strong>higher than shown</strong>. Record those items on a purchase
              bill to complete the picture.
            </span>
          </div>
        )}
      </div>

      {/* ── GST ──────────────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.h}><Percent size={16} color="#4F46E5" /> GST Summary</h2>
        {gst.slabs.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No sales in this period.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Rate', 'Taxable', 'CGST', 'SGST', 'Total tax'].map(h => (
                      <th key={h} style={{ padding: '7px 8px', textAlign: h === 'Rate' ? 'left' : 'right', color: '#64748B', fontSize: 10, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gst.slabs.map(s => (
                    <tr key={s.rate} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '7px 8px', fontWeight: 700 }}>{s.rate}%</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>{inr(s.taxable)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>{inr(s.cgst)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>{inr(s.sgst)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700 }}>{inr(s.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
              <div style={S.row}><span style={{ color: '#64748B' }}>Output tax (on sales)</span><span>{inr(gst.totalTax)}</span></div>
              <div style={S.row}><span style={{ color: '#64748B' }}>Input credit (on purchases)</span><span style={{ color: '#059669' }}>− {inr(input.tax)}</span></div>
              <div style={{ ...S.row, borderTop: '1px solid #E2E8F0', marginTop: 4, paddingTop: 10 }}>
                <strong>Net GST payable</strong>
                <strong style={{ fontSize: 17, color: netGst > 0 ? '#DC2626' : '#059669' }}>{inr(Math.max(netGst, 0))}</strong>
              </div>
              {netGst < 0 && (
                <p style={{ fontSize: 11, color: '#059669', margin: '6px 0 0' }}>
                  Input credit exceeds output tax by {inr(Math.abs(netGst))} — carried forward, nothing payable.
                </p>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '10px 0 0' }}>
              Computed from each item&apos;s actual GST rate. Assumes intra-state supply (CGST/SGST) — inter-state
              IGST needs the buyer&apos;s state code, which isn&apos;t captured yet. Confirm with your CA before filing.
            </p>
          </>
        )}
      </div>

      {/* ── STOCK VALUATION ──────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.h}><Package size={16} color="#CA8A04" /> Stock on Hand</h2>
        <div style={S.row}><span style={{ color: '#64748B' }}>Value at cost</span><strong>{inr(stock.atCost)}</strong></div>
        <div style={S.row}><span style={{ color: '#64748B' }}>Value at selling price</span><span>{inr(stock.atSale)}</span></div>
        <div style={{ ...S.row, borderTop: '1px solid #E2E8F0', marginTop: 6, paddingTop: 10 }}>
          <strong>Profit locked in stock</strong>
          <strong style={{ color: '#059669' }}>{inr(stock.potentialProfit)}</strong>
        </div>
        {stock.unvaluedItems > 0 && (
          <p style={{ fontSize: 11, color: '#B45309', margin: '10px 0 0' }}>
            {stock.unvaluedItems} product{stock.unvaluedItems === 1 ? '' : 's'} ({stock.unvaluedUnits} units) have no
            cost recorded, so the cost figure is understated. They&apos;ll be included once bought through Purchases.
          </p>
        )}
      </div>
    </div>
  );
}
