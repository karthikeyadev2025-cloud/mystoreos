import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, LabelList, Cell } from 'recharts';
import { RefreshCw, TrendingUp, IndianRupee, Store, Truck, CreditCard } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const TIER_PRICES = { starter: 499, pro: 999, enterprise: 2499 };
const DIST_PRICES = { basic_distributor: 999, pro_distributor: 2499, enterprise_distributor: 4999 };
const TIER_COLORS = { starter: '#f59e0b', pro: '#8b5cf6', enterprise: '#10b981' };
const DIST_COLORS = { basic_distributor: '#64748b', pro_distributor: '#8b5cf6', enterprise_distributor: '#10b981' };

const S = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' },
  label: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' },
  val: { color: '#f8fafc', fontSize: '26px', fontWeight: 700 },
  sub: { color: '#64748b', fontSize: '12px', marginTop: '4px' },
  th: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 12px', textAlign: 'left' },
  td: { color: '#f8fafc', fontSize: '13px', padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
};

const CHART_STYLE = { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' };

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ background: `${color}22`, borderRadius: '8px', padding: '7px', display: 'flex' }}><Icon size={16} color={color} /></div>
        <span style={S.label}>{label}</span>
      </div>
      <div style={S.val}>{value}</div>
      {sub && <div style={S.sub}>{sub}</div>}
    </div>
  );
}

export default function TabRevenue() {
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [shops, setShops] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const [s, rev, all] = await Promise.all([
        api.getAdminStats(),
        api.getRevenueByMonth(12),
        api.getAllUsers(),
      ]);
      setStats(s);
      setRevenueData(rev);
      setShops(all.filter(u => u.role === 'shop'));
      setDistributors(all.filter(u => u.role === 'distributor'));
    } catch { toast.error('Failed to load revenue data'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []);

  if (loading) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px' }}>Loading revenue...</div>;

  const shopTierBreakdown = ['starter', 'pro', 'enterprise'].map(t => ({
    name: t.charAt(0).toUpperCase() + t.slice(1),
    count: shops.filter(s => (s.subscriptionTier || 'starter') === t).length,
    mrr: shops.filter(s => (s.subscriptionTier || 'starter') === t).length * TIER_PRICES[t],
    color: TIER_COLORS[t],
  }));

  const distTierBreakdown = ['basic_distributor', 'pro_distributor', 'enterprise_distributor'].map(t => ({
    name: t.replace('_distributor', '').replace('_', ' '),
    count: distributors.filter(d => (d.distributorPlanTier || 'basic_distributor') === t).length,
    mrr: distributors.filter(d => (d.distributorPlanTier || 'basic_distributor') === t).length * DIST_PRICES[t],
    color: DIST_COLORS[t],
  }));

  const funnelData = [
    { name: 'Total Shops', value: shops.length, fill: '#f43f5e' },
    { name: 'Active (paid)', value: shops.filter(s => s.subscriptionTier !== 'trial' && s.subscription !== 'trial').length, fill: '#8b5cf6' },
    { name: 'Pro+', value: shops.filter(s => ['pro', 'enterprise'].includes(s.subscriptionTier)).length, fill: '#10b981' },
    { name: 'Enterprise', value: shops.filter(s => s.subscriptionTier === 'enterprise').length, fill: '#f59e0b' },
  ];

  const totalMRR = (stats?.shopMRR || 0) + (stats?.distMRR || 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>Revenue & Billing</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>MRR breakdown and subscription analytics</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: 'Outfit, sans-serif' }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={S.grid}>
        <StatCard icon={IndianRupee} label="Total MRR" value={`₹${totalMRR.toLocaleString()}`} sub="Shops + Distributors" color="#f43f5e" />
        <StatCard icon={Store} label="Shop MRR" value={`₹${(stats?.shopMRR || 0).toLocaleString()}`} sub={`${stats?.paidShops || 0} paid shops`} color="#8b5cf6" />
        <StatCard icon={Truck} label="Distributor MRR" value={`₹${(stats?.distMRR || 0).toLocaleString()}`} sub={`${distributors.length} distributors`} color="#10b981" />
        <StatCard icon={TrendingUp} label="Annualized ARR" value={`₹${(totalMRR * 12).toLocaleString()}`} color="#f59e0b" />
        <StatCard icon={CreditCard} label="Outstanding Credit" value={`₹${Number(stats?.activeCredit || 0).toLocaleString()}`} sub="Unpaid dues across platform" color="#ef4444" />
        <StatCard icon={Store} label="Paid Shops" value={stats?.paidShops || 0} sub={`of ${stats?.totalShops || 0} total`} color="#06b6d4" />
      </div>

      <div style={{ ...S.card, marginBottom: '20px' }}>
        <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Monthly Revenue (12 Months)</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="rShop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rDist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
            <Tooltip contentStyle={CHART_STYLE} formatter={v => [`₹${v}`, '']} />
            <Area type="monotone" dataKey="shops" name="Shops" stroke="#f43f5e" fill="url(#rShop)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="distributors" name="Distributors" stroke="#8b5cf6" fill="url(#rDist)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Shop Tier Breakdown</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={S.th}>Tier</th><th style={S.th}>Count</th><th style={S.th}>MRR</th></tr>
            </thead>
            <tbody>
              {shopTierBreakdown.map(row => (
                <tr key={row.name}>
                  <td style={S.td}><span style={{ color: row.color, fontWeight: 600 }}>{row.name}</span></td>
                  <td style={S.td}>{row.count}</td>
                  <td style={S.td}>₹{row.mrr.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={shopTierBreakdown} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
                <Tooltip contentStyle={CHART_STYLE} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {shopTierBreakdown.map((row, i) => <Cell key={i} fill={row.color} />)}
                  <LabelList dataKey="count" position="right" style={{ fill: '#64748b', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Distributor Tier Breakdown</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={S.th}>Tier</th><th style={S.th}>Count</th><th style={S.th}>MRR</th></tr>
            </thead>
            <tbody>
              {distTierBreakdown.map(row => (
                <tr key={row.name}>
                  <td style={S.td}><span style={{ color: row.color, fontWeight: 600, textTransform: 'capitalize' }}>{row.name}</span></td>
                  <td style={S.td}>{row.count}</td>
                  <td style={S.td}>₹{row.mrr.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Conversion Funnel</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 40 }}>
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
            <Tooltip contentStyle={CHART_STYLE} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {funnelData.map((row, i) => <Cell key={i} fill={row.fill} />)}
              <LabelList dataKey="value" position="right" style={{ fill: '#94a3b8', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
