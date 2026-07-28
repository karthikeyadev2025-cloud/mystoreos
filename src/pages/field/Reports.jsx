// ═══════════════════════════════════════════════════════════════════
// ENTERPRISE FINANCIAL REPORTS & BUSINESS ANALYTICS HUB
// Profit & Loss, GST Liability & Input Tax Credit (ITC) Matrix,
// Stock Valuation, and Overdue Receivables Aging.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, TrendingUp, Percent, Package, AlertTriangle, ShieldCheck, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { purchaseApi } from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';
import { getDistCaps } from '../../lib/features';
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
  const caps = getDistCaps(user);

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

  const [anchorNow] = useState(() => Date.now());
  const { from, to } = useMemo(() => {
    const days = PERIODS.find(p => p.k === period)?.days || 30;
    return { from: new Date(anchorNow - days * 86400000), to: new Date(anchorNow) };
  }, [period, anchorNow]);

  const pl = useMemo(() => profitAndLoss({ orders, products, purchases, from, to }), [orders, products, purchases, from, to]);
  const gst = useMemo(() => gstSummary({ orders, products, from, to }), [orders, products, from, to]);
  const input = useMemo(() => inputCreditSummary({ purchases, from, to }), [purchases, from, to]);
  const stock = useMemo(() => stockValuation(products), [products]);

  const netGst = gst.totalTax - input.tax;

  const S = {
    card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 22, marginBottom: 18, boxShadow: '0 4px 14px rgba(15,23,42,0.03)' },
    h: { fontSize: 16, fontWeight: 900, color: '#0F172A', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: 13 },
  };

  if (!caps.advancedAnalytics) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <button onClick={() => navigate('/distributor')}
          style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#4F46E5', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <TrendingUp size={36} color="#B45309" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#92400E', margin: '0 0 8px' }}>Reports &amp; Profit Analytics (Pro Feature)</h2>
          <p style={{ fontSize: 14, color: '#78350F', margin: 0, lineHeight: 1.6 }}>
            Gain complete clarity into your Gross Profit &amp; Margin, GST Output vs Input Credit (ITC), and Warehouse Stock Valuation at Cost.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#64748B', fontWeight: 'bold' }}>Loading Financial &amp; GST Reports…</div>;

  return (
    <div style={{ padding: '24px 16px', maxWidth: 960, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#0F172A' }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/distributor')}
        style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#4F46E5', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Dashboard
      </button>

      {/* Header Dark Indigo Banner */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)', borderRadius: 20, padding: '24px 28px', color: '#FFFFFF', marginBottom: 20, boxShadow: '0 8px 24px rgba(15,23,42,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>Financial &amp; GST Reports</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>
            Track Gross Profit, Cost of Goods Sold (COGS), GST Input Credit, and Inventory Valuation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.08)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)' }}>
          {PERIODS.map(p => (
            <button key={p.k} onClick={() => setPeriod(p.k)}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none',
                background: period === p.k ? '#4F46E5' : 'transparent',
                color: period === p.k ? '#FFFFFF' : '#CBD5E1',
                boxShadow: period === p.k ? '0 2px 8px rgba(79,70,229,0.4)' : 'none',
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 4 KPI Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Gross Revenue</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{inr(pl.revenue)}</div>
          <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 2 }}>{pl.orderCount} orders billed</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Gross Profit Margin</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: pl.grossProfit >= 0 ? '#059669' : '#DC2626', marginTop: 4 }}>
            {inr(pl.grossProfit)}
          </div>
          <div style={{ fontSize: 11, color: pl.grossProfit >= 0 ? '#059669' : '#DC2626', fontWeight: 700, marginTop: 2 }}>
            {pl.marginPct}% profit margin
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Net GST Payable</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: netGst > 0 ? '#C2410C' : '#059669', marginTop: 4 }}>
            {inr(Math.max(netGst, 0))}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>After ITC deduction ({inr(input.tax)})</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Stock Value at Cost</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#4338CA', marginTop: 4 }}>{inr(stock.atCost)}</div>
          <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 2 }}>{inr(stock.potentialProfit)} locked profit</div>
        </div>
      </div>

      {/* SECTION 1: PROFIT & LOSS STATEMENT */}
      <div style={S.card}>
        <h2 style={S.h}><TrendingUp size={18} color="#059669" /> Profit &amp; Loss Statement</h2>
        <div style={S.row}>
          <span style={{ color: '#64748B' }}>Total Sales Revenue ({pl.orderCount} Orders)</span>
          <strong style={{ color: '#0F172A' }}>{inr(pl.revenue)}</strong>
        </div>
        <div style={S.row}>
          <span style={{ color: '#64748B' }}>Cost of Goods Sold (COGS)</span>
          <span style={{ color: '#DC2626', fontWeight: 700 }}>− {inr(pl.cogs)}</span>
        </div>
        <div style={{ ...S.row, borderTop: '2px solid #F1F5F9', marginTop: 8, paddingTop: 14 }}>
          <strong style={{ fontSize: 16 }}>Gross Profit</strong>
          <strong style={{ fontSize: 22, color: pl.grossProfit >= 0 ? '#059669' : '#DC2626' }}>
            {inr(pl.grossProfit)} <span style={{ fontSize: 13, fontWeight: 800 }}>({pl.marginPct}%)</span>
          </strong>
        </div>

        {pl.purchaseValue > 0 && (
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '12px 0 0' }}>
            ℹ️ {inr(pl.purchaseValue)} of stock purchased during this period (captured in inventory, not expensed until sold).
          </p>
        )}

        {!pl.isComplete && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, fontSize: 12, color: '#92400E', display: 'flex', gap: 10, alignItems: 'center' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              {inr(pl.unknownCostValue)} of sales across {pl.unknownLines} line items have no cost price recorded. Real profit is <strong>higher than shown</strong>. Record inward supplier bills in Purchases to complete cost tracking.
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: GST LIABILITY & INPUT TAX CREDIT MATRIX */}
      <div style={S.card}>
        <h2 style={S.h}><Percent size={18} color="#4F46E5" /> GST Liability &amp; Input Tax Credit (ITC)</h2>
        {gst.slabs.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No taxable sales recorded in this period.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                    <th style={{ padding: '10px 8px', fontWeight: 800 }}>GST Rate</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>Taxable Subtotal</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>CGST</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>SGST</th>
                    <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>Output Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {gst.slabs.map(s => (
                    <tr key={s.rate} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 800 }}>{s.rate}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{inr(s.taxable)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#64748B' }}>{inr(s.cgst)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#64748B' }}>{inr(s.sgst)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 900, color: '#0F172A' }}>{inr(s.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
              <div style={S.row}>
                <span style={{ color: '#475569', fontWeight: 700 }}>Total Output Tax (Collected on Sales)</span>
                <strong style={{ color: '#0F172A' }}>{inr(gst.totalTax)}</strong>
              </div>
              <div style={S.row}>
                <span style={{ color: '#475569', fontWeight: 700 }}>Input Tax Credit (Paid on Purchases)</span>
                <span style={{ color: '#059669', fontWeight: 800 }}>− {inr(input.tax)}</span>
              </div>
              <div style={{ ...S.row, borderTop: '2px solid #E2E8F0', marginTop: 6, paddingTop: 12 }}>
                <strong style={{ fontSize: 15 }}>Net GST Payable to Govt</strong>
                <strong style={{ fontSize: 18, color: netGst > 0 ? '#DC2626' : '#059669' }}>
                  {inr(Math.max(netGst, 0))}
                </strong>
              </div>
              {netGst < 0 && (
                <p style={{ fontSize: 11, color: '#059669', margin: '6px 0 0', fontWeight: 800 }}>
                  ✅ Input Credit exceeds Output Tax by {inr(Math.abs(netGst))} — Carried forward to next period!
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* SECTION 3: WAREHOUSE STOCK VALUATION */}
      <div style={S.card}>
        <h2 style={S.h}><Package size={18} color="#D97706" /> Warehouse Inventory Valuation</h2>
        <div style={S.row}>
          <span style={{ color: '#64748B' }}>Total Stock Value at Purchase Cost</span>
          <strong>{inr(stock.atCost)}</strong>
        </div>
        <div style={S.row}>
          <span style={{ color: '#64748B' }}>Total Stock Value at Selling Price</span>
          <span>{inr(stock.atSale)}</span>
        </div>
        <div style={{ ...S.row, borderTop: '2px solid #F1F5F9', marginTop: 8, paddingTop: 12 }}>
          <strong style={{ fontSize: 15 }}>Potential Gross Profit Locked in Stock</strong>
          <strong style={{ fontSize: 18, color: '#059669' }}>{inr(stock.potentialProfit)}</strong>
        </div>
        {stock.unvaluedItems > 0 && (
          <p style={{ fontSize: 11, color: '#B45309', margin: '10px 0 0', fontWeight: 700 }}>
            ⚠️ {stock.unvaluedItems} products ({stock.unvaluedUnits} units) have no cost price entered. Record inward supplier bills to get exact valuation.
          </p>
        )}
      </div>
    </div>
  );
}
