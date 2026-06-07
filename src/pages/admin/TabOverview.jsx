import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Store, Users, Truck, ShoppingCart, IndianRupee, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const S = {
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '28px' },
  cardLabel: { color: '#94a3b8', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' },
  cardVal: { color: '#374163', fontSize: '32px', fontWeight: 700, lineHeight: 1 },
  cardSub: { color: '#64748b', fontSize: '13px', marginTop: '8px' },
  sectionTitle: { color: '#374163', fontSize: '20px', fontWeight: 700, marginBottom: '16px' },
  chartsRow: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' },
  chartCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '28px' },
};

const PIE_COLORS = ['#f43f5e', '#8b5cf6', '#10b981', '#f59e0b'];

const StatCard = ({ icon: Icon, label, value, sub, color = '#f43f5e' }) => (
  <div style={S.card}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
      <div style={{ background: `${color}22`, borderRadius: '8px', padding: '8px', display: 'flex' }}>
        <Icon size={18} color={color} />
      </div>
      <span style={S.cardLabel}>{label}</span>
    </div>
    <div style={S.cardVal}>{value}</div>
    {sub && <div style={S.cardSub}>{sub}</div>}
  </div>
);

export default function TabOverview() {
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [growthData, setGrowthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const [s, rev, growth] = await Promise.all([
        api.getAdminStats(),
        api.getRevenueByMonth(6),
        api.getUserGrowthByMonth(6),
      ]);
      setStats(s);
      setRevenueData(rev);
      setGrowthData(growth);
    } catch {
      toast.error('Failed to load overview data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { const t = setTimeout(() => load(), 0); return () => clearTimeout(t); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#94a3b8' }}>
      Loading metrics...
    </div>
  );

  const pieData = stats ? [
    { name: 'Shops', value: stats.totalShops || 0 },
    { name: 'Customers', value: stats.totalUsers || 0 },
    { name: 'Distributors', value: stats.totalDistributors || 0 },
  ] : [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#374163', fontSize: '20px', fontWeight: 700 }}>Command Center</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Platform-wide metrics at a glance</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={S.grid4} className="overview-grid4">
        <StatCard icon={IndianRupee} label="Monthly Revenue" value={stats?.revenue || '₹0'} sub={`Shops ₹${stats?.shopMRR || 0} + Dist ₹${stats?.distMRR || 0}`} color="#f43f5e" />
        <StatCard icon={Store} label="Total Shops" value={stats?.totalShops || 0} sub={`${stats?.paidShops || 0} paid`} color="#8b5cf6" />
        <StatCard icon={Truck} label="Distributors" value={stats?.totalDistributors || 0} color="#10b981" />
        <StatCard icon={Users} label="Customers" value={stats?.totalUsers || 0} color="#f59e0b" />
        <StatCard icon={ShoppingCart} label="Total Orders" value={stats?.totalOrders || 0} color="#3b82f6" />
        <StatCard icon={AlertCircle} label="Active Credit" value={`₹${Number(stats?.activeCredit || 0).toLocaleString()}`} sub="Unpaid dues" color="#ef4444" />
        <StatCard icon={TrendingUp} label="Shop MRR" value={`₹${stats?.shopMRR || 0}`} color="#06b6d4" />
        <StatCard icon={TrendingUp} label="Distributor MRR" value={`₹${stats?.distMRR || 0}`} color="#84cc16" />
      </div>

      <div style={S.chartsRow}>
        <div style={S.chartCard}>
          <div style={S.sectionTitle}>Revenue (Last 6 Months)</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="shopGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#374163' }} formatter={v => [`₹${v}`, '']} />
              <Area type="monotone" dataKey="shops" name="Shops" stroke="#f43f5e" fill="url(#shopGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="distributors" name="Distributors" stroke="#8b5cf6" fill="url(#distGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={S.chartCard}>
          <div style={S.sectionTitle}>User Mix</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#374163' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {pieData.map((d, i) => (
              <span key={d.name} style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PIE_COLORS[i], display: 'inline-block' }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={S.chartCard}>
        <div style={S.sectionTitle}>User Growth (Last 6 Months)</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={growthData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#374163' }} />
            <Bar dataKey="shops" name="Shops" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="customers" name="Customers" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="distributors" name="Distributors" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media(max-width:900px){.overview-grid4{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:480px){.overview-grid4{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  );
}
