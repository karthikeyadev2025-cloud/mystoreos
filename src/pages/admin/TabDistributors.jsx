import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Trash2, Key, ChevronDown, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const TIER_COLORS = { basic_distributor: '#64748b', pro_distributor: '#4F46E5', enterprise_distributor: '#10b981' };
const TIER_LABELS = { basic_distributor: 'Basic', pro_distributor: 'Pro', enterprise_distributor: 'Enterprise' };
const TIERS = ['basic_distributor', 'pro_distributor', 'enterprise_distributor'];

const S = {
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  badge: (tier) => ({ background: `${TIER_COLORS[tier] || '#64748b'}15`, color: TIER_COLORS[tier] || '#64748b', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }),
  btn: (color = '#4F46E5') => ({ background: `${color}15`, border: `1px solid ${color}30`, color, borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }),
  input: { background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', color: '#0F172A', padding: '8px 12px', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none' },
  th: { color: '#64748B', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { color: '#0F172A', fontSize: '13px', padding: '12px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' },
};

function UpgradeModal({ dist, onClose, onDone, tierPrices }) {
  const [tier, setTier] = useState(dist.distributorPlanTier || 'basic_distributor');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.updateDistributorSubscription(dist.id, tier, null);
      await api.logAdminAction('upgrade_dist_plan', dist.id, dist.distributorPlanTier, tier);
      toast.success(`${dist.name} upgraded to ${TIER_LABELS[tier]}`);
      onDone();
    } catch { toast.error('Failed'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', width: '360px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#0F172A', fontWeight: 700, marginBottom: '8px' }}>Change Distributor Plan</h3>
        <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '16px' }}><b>{dist.name}</b></p>
        {TIERS.map(t => (
          <button key={t} onClick={() => setTier(t)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${tier === t ? TIER_COLORS[t] : '#E5E7EB'}`, background: tier === t ? `${TIER_COLORS[t]}15` : 'transparent', color: tier === t ? TIER_COLORS[t] : '#475569', cursor: 'pointer', marginBottom: '8px', fontFamily: 'Plus Jakarta Sans, sans-serif', textAlign: 'left' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TIER_COLORS[t] }} />
              {TIER_LABELS[t]}
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>₹{tierPrices[t]}/mo</span>
          </button>
        ))}
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={save} disabled={busy} style={{ flex: 1, background: '#4F46E5', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>{busy ? 'Saving...' : 'Apply'}</button>
          <button onClick={onClose} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#475569', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ResetModal({ dist, onClose, onDone }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pass.length < 6) return toast.error('Min 6 characters');
    setBusy(true);
    try {
      await api.adminResetPassword(dist.id, pass);
      await api.logAdminAction('reset_dist_password', dist.id, null, null);
      toast.success(`Password reset for ${dist.name}`);
      onDone();
    } catch { toast.error('Reset failed'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', width: '340px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#0F172A', fontWeight: 700, marginBottom: '8px' }}>Reset Password</h3>
        <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '14px' }}><b>{dist.name}</b></p>
        <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="New password" style={{ ...S.input, width: '100%', marginBottom: '14px' }} required />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" disabled={busy} style={{ flex: 1, background: '#4F46E5', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>{busy ? '...' : 'Reset'}</button>
          <button type="button" onClick={onClose} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#475569', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function TabDistributors() {
  const [distributors, setDistributors] = useState([]);
  const [topByCredit, setTopByCredit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [busy, setBusy] = useState({});
  // Was a hardcoded TIER_PRICES constant, never reflecting whatever an
  // admin actually configured in Settings > Pricing. Fetched live now,
  // same source of truth as everywhere else this was fixed tonight.
  const [tierPrices, setTierPrices] = useState({ basic_distributor: 999, pro_distributor: 2499, enterprise_distributor: 4999 });

  const load = async () => {
    try {
      const [all, top, pricing] = await Promise.all([api.getAllUsers(), api.getTopDistributorsByCredit(5), api.getPricing()]);
      setDistributors(all.filter(u => u.role === 'distributor'));
      setTopByCredit(top);
      setTierPrices({
        basic_distributor: Number(pricing?.tiers?.basic_distributor?.monthly) || 999,
        pro_distributor: Number(pricing?.tiers?.pro_distributor?.monthly) || 2499,
        enterprise_distributor: Number(pricing?.tiers?.enterprise_distributor?.monthly) || 4999,
      });
    } catch { toast.error('Failed to load distributors'); }
    finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => {
    let list = distributors;
    if (filterTier !== 'all') list = list.filter(d => (d.distributorPlanTier || 'basic_distributor') === filterTier);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name?.toLowerCase().includes(q) || d.phone?.includes(q));
    }
    return list;
  }, [distributors, filterTier, search]);

  const act = async (id, fn, label) => {
    setBusy(b => ({ ...b, [id]: true }));
    try { await fn(); await load(); toast.success(label); }
    catch { toast.error(`${label} failed`); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  };

  const suspend = (d) => act(d.id, async () => { await api.suspendUser(d.id); await api.logAdminAction('suspend_distributor', d.id, 'active', 'pending'); }, `${d.name} suspended`);
  const activate = (d) => act(d.id, async () => { await api.unsuspendUser(d.id); await api.logAdminAction('activate_distributor', d.id, 'pending', 'active'); }, `${d.name} activated`);
  const del = (d) => {
    if (!window.confirm(`Delete ${d.name}? This is permanent.`)) return;
    act(d.id, async () => { await api.deleteUser(d.id); await api.logAdminAction('delete_distributor', d.id, null, null); }, `${d.name} deleted`);
  };

  if (loading) return <div style={{ textAlign: 'center', color: '#64748B', padding: '60px' }}>Loading distributors...</div>;

  const totalMRR = distributors.reduce((s, d) => s + (tierPrices[d.distributorPlanTier] || 0), 0);

  return (
    <div className="admin-tab-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 700 }}>Distributor Network</h2>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>{distributors.length} distributors · ₹{totalMRR.toLocaleString()} MRR</p>
        </div>
        <button onClick={load} style={S.btn('#475569')}><RefreshCw size={13} />Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {['all', ...TIERS].map(t => {
          const count = t === 'all' ? distributors.length : distributors.filter(d => (d.distributorPlanTier || 'basic_distributor') === t).length;
          return (
            <button key={t} onClick={() => setFilterTier(t)} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${filterTier === t ? (TIER_COLORS[t] || '#4F46E5') : '#E5E7EB'}`, background: filterTier === t ? `${TIER_COLORS[t] || '#4F46E5'}15` : '#FFFFFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'Plus Jakarta Sans, sans-serif', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: TIER_COLORS[t] || '#0F172A', fontWeight: 700, fontSize: '20px' }}>{count}</div>
              <div style={{ color: '#64748B', fontSize: '11px', textTransform: t === 'all' ? 'capitalize' : 'none' }}>{t === 'all' ? 'All Distributors' : TIER_LABELS[t]}</div>
            </button>
          );
        })}
      </div>

      {topByCredit.length > 0 && (
        <div style={{ ...S.card, marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <TrendingUp size={15} color="#10B981" />
            <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: 600 }}>Top Distributors by Credit Issued</span>
          </div>
          {topByCredit.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: i < topByCredit.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <span style={{ color: '#64748B', fontSize: '12px', width: '20px' }}>#{i + 1}</span>
              <span style={{ color: '#0F172A', fontSize: '13px', flex: 1 }}>{d.name}</span>
              <span style={{ color: '#10B981', fontWeight: 600, fontSize: '13px' }}>₹{Number(d.total).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…" style={{ ...S.input, width: '100%', paddingLeft: '32px' }} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                <th style={S.th}>Distributor</th>
                <th style={S.th}>Phone</th>
                <th style={S.th}>Plan</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>MRR</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#64748B', padding: '40px' }}>No distributors found</td></tr>
              )}
              {filtered.map(d => {
                const tier = d.distributorPlanTier || 'basic_distributor';
                const isBusy = busy[d.id];
                return (
                  <tr key={d.id}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#4F46E5,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(d.name||'D')[0]}</div>
                        <span style={{ fontWeight: 500 }}>{d.name}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, color: '#475569' }}>{d.phone}</td>
                    <td style={S.td}><span style={S.badge(tier)}>{TIER_LABELS[tier]}</span></td>
                    <td style={S.td}><span style={{ color: d.status === 'active' ? '#10B981' : '#F59E0B', fontSize: '12px', fontWeight: 600 }}>{d.status === 'active' ? '● Active' : '● Pending'}</span></td>
                    <td style={{ ...S.td, color: '#10B981', fontWeight: 600 }}>₹{tierPrices[tier] || 0}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                        {d.status === 'active'
                          ? <button disabled={isBusy} onClick={() => suspend(d)} style={S.btn('#F59E0B')}><XCircle size={12} />Suspend</button>
                          : <button disabled={isBusy} onClick={() => activate(d)} style={S.btn('#10B981')}><CheckCircle size={12} />Activate</button>
                        }
                        <button disabled={isBusy} onClick={() => setUpgradeModal(d)} style={S.btn('#4F46E5')}><ChevronDown size={12} />Plan</button>
                        <button disabled={isBusy} onClick={() => setResetModal(d)} style={S.btn('#475569')}><Key size={12} />Reset PW</button>
                        <button disabled={isBusy} onClick={() => del(d)} style={S.btn('#EF4444')}><Trash2 size={12} />Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {upgradeModal && <UpgradeModal dist={upgradeModal} onClose={() => setUpgradeModal(null)} onDone={() => { setUpgradeModal(null); load(); }} tierPrices={tierPrices} />}
      {resetModal && <ResetModal dist={resetModal} onClose={() => setResetModal(null)} onDone={() => { setResetModal(null); }} />}
    </div>
  );
}
