import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { RefreshCw, TrendingDown, TrendingUp, Target, Brain, AlertTriangle, Package } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const S = {
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
  sectionTitle: { color: '#0F172A', fontSize: '15px', fontWeight: 600, marginBottom: '16px' },
  th: { color: '#64748B', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'left' },
  td: { color: '#0F172A', fontSize: '13px', padding: '10px 12px', borderBottom: '1px solid #F3F4F6' },
};

const CHART_STYLE = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#0F172A', fontSize: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };

const HEAT_COLORS = ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6'];

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

  if (loading) return <div style={{ textAlign: 'center', color: '#64748B', padding: '60px' }}>Loading analytics...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 700 }}>Analytics</h2>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>Growth trends, retention, and churn signals</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#475569', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
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
                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="aCust" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={CHART_STYLE} />
            <Area type="monotone" dataKey="shops" name="Shops" stroke="#4F46E5" fill="url(#aShop)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="customers" name="Customers" stroke="#8B5CF6" fill="url(#aCust)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="distributors" name="Distributors" stroke="#10B981" strokeWidth={2} dot={false} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Revenue Trend — 12 Months</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={revenue} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
            <Tooltip contentStyle={CHART_STYLE} formatter={v => [`₹${v}`, '']} />
            <Bar dataKey="shops" name="Shops" fill="#4F46E5" stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="distributors" name="Distributors" fill="#8B5CF6" stackId="a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-grid-2col">
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <TrendingUp size={15} color="#10B981" />
            <span style={S.sectionTitle}>Top Shops by Revenue</span>
          </div>
          {topShops.length === 0 ? <div style={{ color: '#64748B', fontSize: '13px' }}>No order data yet</div> : (
            topShops.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < topShops.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ color: '#64748B', fontSize: '11px', width: '18px', flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ color: '#0F172A', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: '#10B981', fontWeight: 600, fontSize: '12px', flexShrink: 0 }}>₹{Number(s.total).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Target size={15} color="#8B5CF6" />
            <span style={S.sectionTitle}>Top Distributors by Credit</span>
          </div>
          {topDists.length === 0 ? <div style={{ color: '#64748B', fontSize: '13px' }}>No credit data yet</div> : (
            topDists.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < topDists.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ color: '#64748B', fontSize: '11px', width: '18px', flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ color: '#0F172A', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span style={{ color: '#8B5CF6', fontWeight: 600, fontSize: '12px', flexShrink: 0 }}>₹{Number(d.total).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-grid-2col">
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <TrendingDown size={15} color="#EF4444" />
            <span style={S.sectionTitle}>Churn Risk — Expired Trials ({expiredTrials.length})</span>
          </div>
          {churnRisk.length === 0 ? <div style={{ color: '#64748B', fontSize: '13px' }}>No expired trials</div> : (
            churnRisk.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < churnRisk.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ color: '#0F172A', fontSize: '13px', flex: 1 }}>{s.name}</span>
                <span style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{s.days}d expired</span>
              </div>
            ))
          )}
          {expiredTrials.length > 5 && <div style={{ color: '#64748B', fontSize: '12px', marginTop: '8px' }}>+{expiredTrials.length - 5} more in Exports tab</div>}
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
                    <td style={{ ...S.td, padding: '6px 8px', color: '#64748B', fontSize: '11px' }}>{row.month}</td>
                    {[100, Math.max(0, row.retention), Math.max(0, row.retention - 15)].map((val, _j) => {
                      const idx = Math.min(5, Math.floor(val / 20));
                      return <td key={_j} style={{ ...S.td, padding: '6px 8px', background: HEAT_COLORS[idx], color: val > 40 ? '#0F172A' : '#475569', textAlign: 'center', fontWeight: 600, fontSize: '11px' }}>{val}%</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ color: '#64748B', fontSize: '11px', marginTop: '8px' }}>*Estimated — connect real order data for precise cohort analysis</div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── AI Demand Forecasting — Platform Overview ── */}
      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '20px', marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Brain size={20} color="#4F46E5" />
          <div>
            <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '15px' }}>AI Demand Forecasting — Platform Feature</div>
            <div style={{ color: '#64748B', fontSize: '12px' }}>Available on Pro + Enterprise shop plans. Runs client-side — no API cost.</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px', marginBottom: '16px' }}>
          {[
            { icon: '🧠', title: 'Algorithm', body: 'Exponential smoothing (α=0.3) + trend + day-of-week seasonality correction. Projects 7d (Pro) or 30d (Enterprise) demand per SKU.' },
            { icon: '📦', title: 'Reorder Alerts', body: 'Reorder point = avgDaily × 3d lead time + 2d safety stock. Red URGENT badge when stock ≤ reorder point in shopkeeper Day Book.' },
            { icon: '🔒', title: 'Plan Gating', body: 'Trial & Starter: locked with upgrade CTA. Pro ₹999/mo: 7-day · top 10 SKUs. Enterprise ₹2499/mo: 30-day · all SKUs.' },
          ].map((item, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '18px', marginBottom: '6px' }}>{item.icon}</div>
              <div style={{ color: '#0F172A', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{item.title}</div>
              <div style={{ color: '#64748B', fontSize: '11px', lineHeight: 1.5 }}>{item.body}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Trial / Starter', badge: 'Locked', color: '#64748B' },
            { label: 'Pro ₹999/mo', badge: '7-day · 10 SKUs', color: '#4F46E5' },
            { label: 'Enterprise ₹2499/mo', badge: '30-day · All SKUs', color: '#10B981' },
          ].map((t, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: `1px solid #E5E7EB`, borderRadius: '8px', padding: '6px 14px', display: 'flex', gap: '8px', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#64748B', fontSize: '12px' }}>{t.label}</span>
              <span style={{ color: t.color, fontWeight: 700, fontSize: '12px' }}>{t.badge}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
