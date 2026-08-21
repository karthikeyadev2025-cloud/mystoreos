import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Line, LineChart } from 'recharts';
import {
  Store, Users, Truck, ShoppingCart, IndianRupee,
  AlertCircle, RefreshCw, Activity, ArrowUpRight, ArrowDownRight, Sparkles,
  Clock, CheckCircle2
} from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

// Enterprise admin cockpit tokens — deeper indigo→violet hero, muted
// monochrome cards. Keeps focus on numbers, not chrome.
const T = {
  cardBg:        'var(--c-surface)',
  cardBorder:    'var(--c-line)',
  ink:           'var(--c-ink)',
  inkMuted:      'var(--c-ink-2)',
  inkFaint:      'var(--c-faint)',
  accent:        'var(--c-primary)',
  positive:      'var(--c-success)',
  negative:      'var(--c-danger)',
  warn:          'var(--c-warning)',
  heroGradient:  'linear-gradient(135deg,var(--c-primary) 0%,#7C3AED 45%,var(--c-primary-hover) 100%)',
};

const styles = {
  hero: {
    background: T.heroGradient, borderRadius: 20, padding: '28px 32px',
    marginBottom: 20, color: 'var(--c-surface)', position: 'relative', overflow: 'hidden',
    boxShadow: '0 10px 30px -10px rgba(79,70,229,0.5)',
  },
  heroGlow: {
    position: 'absolute', top: -80, right: -80, width: 260, height: 260,
    borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 65%)',
    pointerEvents: 'none',
  },
  heroTitle:     { fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 },
  heroSubtitle:  { fontSize: 13, opacity: 0.85, marginTop: 4 },
  heroStatRow:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 24, marginTop: 22, position: 'relative' },
  heroStatLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75, fontWeight: 600 },
  heroStatValue: { fontSize: 26, fontWeight: 800, marginTop: 4, letterSpacing: '-0.02em' },
  heroStatDelta: { fontSize: 11, marginTop: 4, opacity: 0.9 },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 20 },
  kpi: {
    background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 14,
    padding: '16px 18px', position: 'relative', overflow: 'hidden',
    transition: 'transform .15s, box-shadow .15s',
  },
  kpiLabel: { color: T.inkFaint, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  kpiValue: { color: T.ink, fontSize: 24, fontWeight: 800, marginTop: 6, letterSpacing: '-0.02em', lineHeight: 1.1 },
  kpiDeltaRow: { marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 },

  panelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 },
  panel: {
    background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16,
    padding: '20px 22px',
  },
  panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  panelTitle:  { color: T.ink, fontSize: 14, fontWeight: 700 },
  panelHint:   { color: T.inkFaint, fontSize: 11 },
};

const PIE_COLORS = ['var(--c-primary)', '#7C3AED', 'var(--c-success)', 'var(--c-warning)'];

// Delta chip. Guards against Infinity (previous period was 0) and NaN
// so the dashboard never shows a broken number.
function DeltaChip({ pct }) {
  if (pct === Infinity || pct === -Infinity) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: T.positive, background: 'var(--c-success-soft)', border: '1px solid #A7F3D0', padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
      <Sparkles size={10} /> NEW
    </span>
  );
  if (pct == null || isNaN(pct)) return <span style={{ color: T.inkFaint, fontSize: 11 }}>—</span>;
  const zero = pct === 0;
  const positive = pct > 0;
  const color = zero ? T.inkFaint : (positive ? T.positive : T.negative);
  const bg    = zero ? 'var(--c-line-soft)' : (positive ? 'var(--c-success-soft)' : 'var(--c-danger-soft)');
  const border= zero ? 'var(--c-line)' : (positive ? '#A7F3D0' : '#FECACA');
  const Icon  = zero ? null : (positive ? ArrowUpRight : ArrowDownRight);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color, background: bg, border: `1px solid ${border}`, padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
      {Icon && <Icon size={10} />}{positive && '+'}{pct}%
    </span>
  );
}

// Inline sparkline; degrades to nothing when data is too sparse rather
// than showing an empty rectangle.
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height: 32, marginTop: 8, marginRight: -4 }}>
      <ResponsiveContainer width="100%" height={32}>
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ Icon, label, value, sub, deltaPct, spark, color = T.accent }) {
  return (
    <div style={styles.kpi} className="admin-kpi-hover">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={color} />
        </div>
        <span style={styles.kpiLabel}>{label}</span>
      </div>
      <div style={styles.kpiValue}>{value}</div>
      {sub && <div style={{ color: T.inkFaint, fontSize: 11, marginTop: 4 }}>{sub}</div>}
      {deltaPct !== undefined && (
        <div style={styles.kpiDeltaRow}>
          <DeltaChip pct={deltaPct} />
          <span style={{ color: T.inkFaint, fontSize: 10 }}>vs last 30d</span>
        </div>
      )}
      {spark && <Sparkline data={spark} color={color} />}
    </div>
  );
}

function HealthPill({ level, text }) {
  const c = level === 'ok' ? T.positive : level === 'warn' ? T.warn : T.negative;
  const bg = level === 'ok' ? 'rgba(16,185,129,0.15)' : level === 'warn' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: bg, padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: c, border: `1px solid ${c}40` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
      {text}
    </span>
  );
}

export default function TabOverview() {
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [growthData, setGrowthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoaded, setLastLoaded] = useState(null);

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
      setLastLoaded(new Date());
    } catch {
      toast.error('Failed to load overview data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { const t = setTimeout(() => load(), 0); return () => clearTimeout(t); }, []);

  const sparks = useMemo(() => {
    if (!growthData || growthData.length === 0) return {};
    return {
      shops:        growthData.map(d => Number(d.shops || 0)),
      customers:    growthData.map(d => Number(d.customers || 0)),
      distributors: growthData.map(d => Number(d.distributors || 0)),
    };
  }, [growthData]);

  const revenueSpark = useMemo(() => {
    if (!revenueData || revenueData.length === 0) return null;
    return revenueData.map(d => Number(d.shops || 0) + Number(d.distributors || 0));
  }, [revenueData]);

  // System-health rollup. Priority order: approval queue → open credit → GMV drop.
  const health = useMemo(() => {
    if (!stats) return { level: 'ok', text: 'Loading…' };
    if ((stats.pendingApprovals || 0) >= 5) return { level: 'warn', text: `${stats.pendingApprovals} approvals waiting` };
    if ((stats.activeCredit || 0) > 50_000) return { level: 'warn', text: 'High open credit' };
    if ((stats.gmvDeltaPct || 0) < -20)     return { level: 'warn', text: 'GMV down 20%+ MoM' };
    return { level: 'ok', text: 'All systems healthy' };
  }, [stats]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: T.inkMuted, fontSize: 14, gap: 10 }}>
      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading command center…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!stats) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ color: T.ink, fontWeight: 700, fontSize: 16 }}>Failed to load metrics</div>
      <div style={{ color: T.inkMuted, fontSize: 13 }}>Check Supabase connection or admin permissions</div>
      <button onClick={() => load()} style={{ background: T.accent, color: 'var(--c-surface)', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, marginTop: 8, width: 'auto' }}>Retry</button>
    </div>
  );

  const pieData = [
    { name: 'Shops',        value: stats.totalShops        || 0 },
    { name: 'Customers',    value: stats.totalUsers        || 0 },
    { name: 'Distributors', value: stats.totalDistributors || 0 },
  ];
  const totalMRR = (stats.shopMRR || 0) + (stats.distMRR || 0);

  return (
    <div>
      {/* HERO */}
      <div style={styles.hero}>
        <div style={styles.heroGlow} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={styles.heroTitle}>Command Center</h2>
            <div style={styles.heroSubtitle}>Real-time platform pulse — MyStore OS Enterprise Admin</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <HealthPill level={health.level} text={health.text} />
            <button onClick={() => load(true)} disabled={refreshing}
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: 'var(--c-surface)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, backdropFilter: 'blur(6px)', width: 'auto' }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={styles.heroStatRow}>
          <div>
            <div style={styles.heroStatLabel}>Monthly Recurring Revenue</div>
            <div style={styles.heroStatValue}>₹{totalMRR.toLocaleString('en-IN')}</div>
            <div style={styles.heroStatDelta}>Shops ₹{stats.shopMRR} · Dist ₹{stats.distMRR}</div>
          </div>
          <div>
            <div style={styles.heroStatLabel}>GMV (30 days)</div>
            <div style={styles.heroStatValue}>₹{Number(stats.gmvLast30 || 0).toLocaleString('en-IN')}</div>
            <div style={styles.heroStatDelta}><DeltaChip pct={stats.gmvDeltaPct} /></div>
          </div>
          <div>
            <div style={styles.heroStatLabel}>New Signups (30 days)</div>
            <div style={styles.heroStatValue}>{(stats.shopsLast30 || 0) + (stats.custLast30 || 0)}</div>
            <div style={styles.heroStatDelta}>{stats.shopsLast30 || 0} shops · {stats.custLast30 || 0} customers</div>
          </div>
          <div>
            <div style={styles.heroStatLabel}>Pending Approvals</div>
            <div style={styles.heroStatValue}>{stats.pendingApprovals || 0}</div>
            <div style={styles.heroStatDelta}>
              {(stats.pendingApprovals || 0) === 0
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Queue clear</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> Needs review</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPI ROW */}
      <div style={styles.kpiGrid}>
        <Kpi Icon={Store}        color="var(--c-primary)" label="Total Shops"    value={stats.totalShops || 0}         sub={`${stats.paidShops || 0} paying`} deltaPct={stats.shopsDeltaPct}   spark={sparks.shops} />
        <Kpi Icon={Users}        color="#7C3AED" label="Customers"      value={stats.totalUsers || 0}         deltaPct={stats.custDeltaPct}                                       spark={sparks.customers} />
        <Kpi Icon={Truck}        color="var(--c-success)" label="Distributors"   value={stats.totalDistributors || 0}                                                                     spark={sparks.distributors} />
        <Kpi Icon={ShoppingCart} color="var(--c-info)" label="Orders (30d)"   value={Number(stats.ordersLast30 || 0).toLocaleString('en-IN')} deltaPct={stats.ordersDeltaPct} />
        <Kpi Icon={IndianRupee}  color="#06B6D4" label="Revenue Total"  value={stats.revenue || '₹0'}         sub="MRR run rate" spark={revenueSpark} />
        <Kpi Icon={AlertCircle}  color="var(--c-danger)" label="Open Credit"    value={`₹${Number(stats.activeCredit || 0).toLocaleString('en-IN')}`} sub="Unpaid dues" />
      </div>

      {/* PANELS */}
      <div style={styles.panelGrid}>
        <div style={{ ...styles.panel, gridColumn: 'span 2', minWidth: 0 }}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitle}>Revenue trend (6 months)</div>
            <span style={styles.panelHint}>Shops vs distributors</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="shopGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: T.inkFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.inkFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <Tooltip contentStyle={{ background: 'var(--c-surface)', border: `1px solid ${T.cardBorder}`, borderRadius: 10, color: T.ink, fontSize: 12 }} formatter={v => [`₹${v}`, '']} />
              <Area type="monotone" dataKey="shops"        name="Shops"        stroke="#4F46E5" fill="url(#shopGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="distributors" name="Distributors" stroke="#7C3AED" fill="url(#distGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitle}>User composition</div>
            <span style={styles.panelHint}>All-time</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={54} outerRadius={82} dataKey="value" paddingAngle={3}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--c-surface)', border: `1px solid ${T.cardBorder}`, borderRadius: 10, color: T.ink, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            {pieData.map((d, i) => (
              <span key={d.name} style={{ fontSize: 11, color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i], display: 'inline-block' }} />
                {d.name} · {d.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* GROWTH BAR */}
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div style={styles.panelTitle}>Sign-up velocity (6 months)</div>
          <span style={styles.panelHint}>New shops, customers, distributors per month</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={growthData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <XAxis dataKey="month" tick={{ fill: T.inkFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.inkFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'var(--c-surface)', border: `1px solid ${T.cardBorder}`, borderRadius: 10, color: T.ink, fontSize: 12 }} cursor={{ fill: 'rgba(79,70,229,0.05)' }} />
            <Bar dataKey="shops"        name="Shops"        fill="#4F46E5" radius={[6, 6, 0, 0]} />
            <Bar dataKey="customers"    name="Customers"    fill="#7C3AED" radius={[6, 6, 0, 0]} />
            <Bar dataKey="distributors" name="Distributors" fill="#10B981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {lastLoaded && (
        <div style={{ marginTop: 14, textAlign: 'right', color: T.inkFaint, fontSize: 11 }}>
          <Activity size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
          Snapshot: {lastLoaded.toLocaleTimeString('en-IN')}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .admin-kpi-hover:hover { transform: translateY(-1px); box-shadow: 0 4px 16px -8px rgba(15,23,42,0.15); }
      `}</style>
    </div>
  );
}
