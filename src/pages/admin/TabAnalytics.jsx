import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { RefreshCw, TrendingDown, TrendingUp, Target, Brain, AlertTriangle, Package } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const S = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
  sectionTitle: { color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '16px' },
  th: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'left' },
  td: { color: '#f8fafc', fontSize: '13px', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
};

const CHART_STYLE = { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' };

const HEAT_COLORS = ['#0f172a', '#1e3a5f', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa'];

export default function TabAnalytics() {
  const [growth, setGrowth] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [topShops, setTopShops] = useState([]);
  const [topDists, setTopDists] = useState([]);
  const [expiredTrials, setExpiredTrials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const [g, rev, ts, td, et] = await Promise.all([
        api.getUserGrowthByMonth(12),
        api.getRevenueByMonth(12),
        api.getTopShopsByRevenue(8),
        api.getTopDistributorsByCredit(8),
        api.getExpiredTrials(),
      ]);
      setGrowth(g);
      setRevenue(rev);
      setTopShops(ts);
      setTopDists(td);
      setExpiredTrials(et);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []);

  const cohort = growth.map((m, i) => ({
    month: m.month,
    retention: i === 0 ? 100 : Math.max(0, 100 - i * 8),
  }));

  const churnRisk = expiredTrials.slice(0, 5).map(u => ({
    name: u.name,
    days: u.trialStartedAt ? Math.floor((new Date() - new Date(u.trialStartedAt)) / 864e5) : 0,
  }));

  if (loading) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px' }}>Loading analytics...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>Analytics</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Growth trends, retention, and churn signals</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: 'Outfit, sans-serif' }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>User Growth — 12 Months</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={growth} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="aShop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="aCust" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={CHART_STYLE} />
            <Area type="monotone" dataKey="shops" name="Shops" stroke="#f43f5e" fill="url(#aShop)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="customers" name="Customers" stroke="#8b5cf6" fill="url(#aCust)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="distributors" name="Distributors" stroke="#10b981" strokeWidth={2} dot={false} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Revenue Trend — 12 Months</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={revenue} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
            <Tooltip contentStyle={CHART_STYLE} formatter={v => [`₹${v}`, '']} />
            <Bar dataKey="shops" name="Shops" fill="#f43f5e" stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="distributors" name="Distributors" fill="#8b5cf6" stackId="a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <TrendingUp size={15} color="#10b981" />
            <span style={S.sectionTitle}>Top Shops by Revenue</span>
          </div>
          {topShops.length === 0 ? <div style={{ color: '#64748b', fontSize: '13px' }}>No order data yet</div> : (
            topShops.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < topShops.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ color: '#64748b', fontSize: '11px', width: '18px', flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ color: '#f8fafc', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: '#10b981', fontWeight: 600, fontSize: '12px', flexShrink: 0 }}>₹{Number(s.total).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Target size={15} color="#8b5cf6" />
            <span style={S.sectionTitle}>Top Distributors by Credit</span>
          </div>
          {topDists.length === 0 ? <div style={{ color: '#64748b', fontSize: '13px' }}>No credit data yet</div> : (
            topDists.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < topDists.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ color: '#64748b', fontSize: '11px', width: '18px', flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ color: '#f8fafc', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span style={{ color: '#8b5cf6', fontWeight: 600, fontSize: '12px', flexShrink: 0 }}>₹{Number(d.total).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <TrendingDown size={15} color="#ef4444" />
            <span style={S.sectionTitle}>Churn Risk — Expired Trials ({expiredTrials.length})</span>
          </div>
          {churnRisk.length === 0 ? <div style={{ color: '#64748b', fontSize: '13px' }}>No expired trials</div> : (
            churnRisk.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < churnRisk.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ color: '#f8fafc', fontSize: '13px', flex: 1 }}>{s.name}</span>
                <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.days}d expired</span>
              </div>
            ))
          )}
          {expiredTrials.length > 5 && <div style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>+{expiredTrials.length - 5} more in Exports tab</div>}
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>Simulated Cohort Retention</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, padding: '6px 8px' }}>Month</th>
                  <th style={{ ...S.th, padding: '6px 8px' }}>M0</th>
                  <th style={{ ...S.th, padding: '6px 8px' }}>M1</th>
                  <th style={{ ...S.th, padding: '6px 8px' }}>M3</th>
                </tr>
              </thead>
              <tbody>
                {cohort.slice(-4).map((row) => (
                  <tr key={row.month}>
                    <td style={{ ...S.td, padding: '6px 8px', color: '#94a3b8', fontSize: '11px' }}>{row.month}</td>
                    {[100, Math.max(0, row.retention), Math.max(0, row.retention - 15)].map((val, _j) => {
                      const idx = Math.min(5, Math.floor(val / 20));
                      return <td key={_j} style={{ ...S.td, padding: '6px 8px', background: HEAT_COLORS[idx], color: val > 40 ? '#f8fafc' : '#94a3b8', textAlign: 'center', fontWeight: 600, fontSize: '11px' }}>{val}%</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '8px' }}>*Estimated — connect real order data for precise cohort analysis</div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── AI Demand Forecasting — Platform Overview ── */}
      <div style={{ background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '12px', padding: '20px', marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Brain size={20} color="#8b5cf6" />
          <div>
            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px' }}>AI Demand Forecasting — Platform Feature</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Available on Pro + Enterprise shop plans. Runs client-side — no API cost.</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px', marginBottom: '16px' }}>
          {[
            { icon: '🧠', title: 'Algorithm', body: 'Exponential smoothing (α=0.3) + trend + day-of-week seasonality correction. Projects 7d (Pro) or 30d (Enterprise) demand per SKU.' },
            { icon: '📦', title: 'Reorder Alerts', body: 'Reorder point = avgDaily × 3d lead time + 2d safety stock. Red URGENT badge when stock ≤ reorder point in shopkeeper Day Book.' },
            { icon: '🔒', title: 'Plan Gating', body: 'Trial & Starter: locked with upgrade CTA. Pro ₹999/mo: 7-day · top 10 SKUs. Enterprise ₹2499/mo: 30-day · all SKUs.' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '18px', marginBottom: '6px' }}>{item.icon}</div>
              <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{item.title}</div>
              <div style={{ color: '#64748b', fontSize: '11px', lineHeight: 1.5 }}>{item.body}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Trial / Starter', badge: 'Locked', color: '#64748b' },
            { label: 'Pro ₹999/mo', badge: '7-day · 10 SKUs', color: '#8b5cf6' },
            { label: 'Enterprise ₹2499/mo', badge: '30-day · All SKUs', color: '#10b981' },
          ].map((t, i) => (
            <div key={i} style={{ background: `${t.color}18`, border: `1px solid ${t.color}30`, borderRadius: '8px', padding: '6px 14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>{t.label}</span>
              <span style={{ color: t.color, fontWeight: 700, fontSize: '12px' }}>{t.badge}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
