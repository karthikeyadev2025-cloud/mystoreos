import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Store, Users, Truck, ShoppingCart, IndianRupee, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const S = {
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' },
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardLabel: { color: '#64748B', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' },
  cardVal: { color: '#0F172A', fontSize: '26px', fontWeight: 800, lineHeight: 1.2 },
  cardSub: { color: '#64748B', fontSize: '12px', marginTop: '8px' },
  sectionTitle: { color: '#0F172A', fontSize: '16px', fontWeight: 700, marginBottom: '16px' },
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '24px' },
  chartCard: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
};

const PIE_COLORS = ['#4F46E5', '#8B5CF6', '#10B981', '#F59E0B'];

const StatCard = ({ icon: Icon, label, value, sub, color = '#4F46E5' }) => (
  <div style={S.card}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
      <div style={{ background: `${color}15`, borderRadius: '8px', padding: '8px', display: 'flex' }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#64748B', fontSize: '14px' }}>
      Loading metrics…
    </div>
  );

  if (!stats && !loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
      <div style={{ fontSize: '32px' }}>⚠️</div>
      <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '16px' }}>Failed to load metrics</div>
      <div style={{ color: '#64748B', fontSize: '13px' }}>Check Supabase connection or admin permissions</div>
      <button onClick={() => load()} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px', marginTop: '8px', width: 'auto' }}>Retry</button>
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
          <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 700 }}>Command Center</h2>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>Platform-wide metrics at a glance</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#475569', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', width: 'auto', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div className="overview-grid4" style={S.grid4}>
        <StatCard icon={IndianRupee} label="Monthly Revenue" value={stats?.revenue || '₹0'} sub={`Shops ₹${stats?.shopMRR || 0} + Dist ₹${stats?.distMRR || 0}`} color="#4F46E5" />
        <StatCard icon={Store} label="Total Shops" value={stats?.totalShops || 0} sub={`${stats?.paidShops || 0} paid`} color="#8B5CF6" />
        <StatCard icon={Truck} label="Distributors" value={stats?.totalDistributors || 0} color="#10B981" />
        <StatCard icon={Users} label="Customers" value={stats?.totalUsers || 0} color="#F59E0B" />
        <StatCard icon={ShoppingCart} label="Total Orders" value={stats?.totalOrders || 0} color="#3B82F6" />
        <StatCard icon={AlertCircle} label="Active Credit" value={`₹${Number(stats?.activeCredit || 0).toLocaleString()}`} sub="Unpaid dues" color="#EF4444" />
        <StatCard icon={TrendingUp} label="Shop MRR" value={`₹${stats?.shopMRR || 0}`} color="#06B6D4" />
        <StatCard icon={TrendingUp} label="Distributor MRR" value={`₹${stats?.distMRR || 0}`} color="#84CC16" />
      </div>

      <div className="admin-charts-grid">
        <div style={S.chartCard}>
          <div style={S.sectionTitle}>Revenue (Last 6 Months)</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="shopGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#0F172A' }} formatter={v => [`₹${v}`, '']} />
              <Area type="monotone" dataKey="shops" name="Shops" stroke="#4F46E5" fill="url(#shopGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="distributors" name="Distributors" stroke="#8B5CF6" fill="url(#distGrad)" strokeWidth={2} dot={false} />
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
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#0F172A' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {pieData.map((d, i) => (
              <span key={d.name} style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PIE_COLORS[i], display: 'inline-block' }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>

        <div style={S.chartCard}>
          <div style={S.sectionTitle}>User Growth (Last 6 Months)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={growthData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#0F172A' }} />
              <Bar dataKey="shops" name="Shops" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="customers" name="Customers" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="distributors" name="Distributors" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

