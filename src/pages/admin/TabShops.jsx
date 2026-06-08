import { useState, useEffect, useMemo } from 'react';
import { Search, CheckCircle, XCircle, Trash2, Key, ShieldCheck, RefreshCw, ChevronDown, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const TIER_COLORS = { starter: '#f59e0b', pro: '#8b5cf6', enterprise: '#10b981', trial: '#64748b' };
const TIER_LABELS = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise', trial: 'Trial' };

const S = {
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  badge: (tier) => ({ background: `${TIER_COLORS[tier] || '#64748b'}15`, color: TIER_COLORS[tier] || '#64748b', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }),
  btn: (color = '#4F46E5') => ({ height: '36px', background: `${color}15`, border: `1px solid ${color}30`, color, borderRadius: '8px', padding: '0 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }),
  input: { background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', color: '#0F172A', padding: '8px 12px', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none' },
  th: { color: '#64748B', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { color: '#0F172A', fontSize: '13px', padding: '14px 16px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' },
};

const FILTERS = ['all', 'trial', 'starter', 'pro', 'enterprise', 'pending'];

function ResetPassModal({ shop, onClose, onDone }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pass.length < 6) return toast.error('Password must be at least 6 characters');
    setBusy(true);
    try {
      await api.adminResetPassword(shop.id, pass);
      await api.logAdminAction('reset_password', shop.id, null, null);
      toast.success(`Password reset for ${shop.name}`);
      onDone();
    } catch { toast.error('Reset failed'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', width: '360px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#0F172A', fontWeight: 700, marginBottom: '8px' }}>Reset Password</h3>
        <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '16px' }}>Set new password for <b>{shop.name}</b></p>
        <input value={pass} onChange={e => setPass(e.target.value)} placeholder="New password (min 6 chars)" type="password" style={{ ...S.input, width: '100%', marginBottom: '16px' }} required />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" disabled={busy} style={{ flex: 1, background: '#4F46E5', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>{busy ? 'Saving...' : 'Reset'}</button>
          <button type="button" onClick={onClose} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#475569', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function UpgradeModal({ shop, onClose, onDone }) {
  const [tier, setTier] = useState(shop.subscriptionTier || 'starter');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.updateUserSubscription(shop.id, tier, null);
      await api.logAdminAction('upgrade_plan', shop.id, shop.subscriptionTier, tier);
      toast.success(`${shop.name} upgraded to ${TIER_LABELS[tier]}`);
      onDone();
    } catch { toast.error('Failed to update plan'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '24px', width: '360px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#0F172A', fontWeight: 700, marginBottom: '8px' }}>Change Plan</h3>
        <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '16px' }}><b>{shop.name}</b></p>
        {['trial', 'starter', 'pro', 'enterprise'].map(t => (
          <button key={t} onClick={() => setTier(t)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${tier === t ? TIER_COLORS[t] : '#E5E7EB'}`, background: tier === t ? `${TIER_COLORS[t]}15` : 'transparent', color: tier === t ? TIER_COLORS[t] : '#475569', cursor: 'pointer', marginBottom: '8px', fontFamily: 'Plus Jakarta Sans, sans-serif', textAlign: 'left' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TIER_COLORS[t], display: 'inline-block' }} />
            {TIER_LABELS[t]}
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

export default function TabShops() {
  const [shops, setShops] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [resetModal, setResetModal] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [busy, setBusy] = useState({});

  const load = async () => {
    try {
      const [all, pend] = await Promise.all([api.getAllUsers(), api.getPendingApprovals()]);
      setShops(all.filter(u => u.role === 'shop' || u.role === 'staff'));
      setPending(pend);
    } catch { toast.error('Failed to load shops'); }
    finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => {
    let list = shops;
    if (filter === 'pending') list = pending.filter(u => u.role === 'shop');
    else if (filter !== 'all') list = shops.filter(s => (s.subscriptionTier || 'trial') === filter || s.subscription === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q) || s.phone?.includes(q));
    }
    return list;
  }, [shops, pending, filter, search]);

  const act = async (id, fn, label) => {
    setBusy(b => ({ ...b, [id]: true }));
    try { await fn(); await load(); toast.success(label); }
    catch { toast.error(`${label} failed`); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  };

  const approve = (u) => act(u.id, () => api.approveUser(u.id), `${u.name} approved`);
  const suspend = (u) => act(u.id, async () => { await api.suspendUser(u.id); await api.logAdminAction('suspend_user', u.id, 'active', 'pending'); }, `${u.name} suspended`);
  const unsuspend = (u) => act(u.id, async () => { await api.unsuspendUser(u.id); await api.logAdminAction('unsuspend_user', u.id, 'pending', 'active'); }, `${u.name} activated`);
  const del = (u) => {
    if (!window.confirm(`Delete ${u.name}? This is permanent.`)) return;
    act(u.id, async () => { await api.deleteUser(u.id); await api.logAdminAction('delete_user', u.id, null, null); }, `${u.name} deleted`);
  };

  if (loading) return <div style={{ textAlign: 'center', color: '#64748B', padding: '60px' }}>Loading shops...</div>;

  const now = new Date().getTime();
  const expiredTrials = shops.filter(s => s.subscription === 'trial' && s.trialStartedAt && (now - new Date(s.trialStartedAt).getTime()) > 7 * 864e5);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 600, margin: 0 }}>Shop Management</h2>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px', margin: '4px 0 0' }}>{shops.length} shops · {pending.filter(u=>u.role==='shop').length} pending · {expiredTrials.length} expired trials</p>
        </div>
        <button onClick={load} style={S.btn('#475569')}><RefreshCw size={13} />Refresh</button>
      </div>

      {expiredTrials.length > 0 && (
        <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={16} color="#E11D48" />
          <span style={{ color: '#E11D48', fontSize: '13px', fontWeight: 500 }}><b>{expiredTrials.length}</b> shop(s) with expired trials — consider converting or cleaning up.</span>
        </div>
      )}

      <div style={S.card}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…" style={{ ...S.input, width: '100%', paddingLeft: '32px' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${filter === f ? '#4F46E5' : '#E5E7EB'}`, background: filter === f ? 'rgba(79,70,229,0.08)' : '#FFFFFF', color: filter === f ? '#4F46E5' : '#475569', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: filter === f ? 600 : 400, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                <th style={S.th}>Shop</th>
                <th style={S.th}>Phone</th>
                <th style={S.th}>Plan</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Joined</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#64748B', padding: '40px' }}>No shops found</td></tr>
              )}
              {filtered.map(shop => {
                const tier = shop.subscriptionTier || shop.subscription || 'trial';
                const isBusy = busy[shop.id];
                return (
                  <tr>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {shop.logo
                          ? <img src={shop.logo} alt="" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
                          : <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#4F46E5,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(shop.name||'S')[0]}</div>
                        }
                        <span title={shop.name} style={{ fontWeight: 500, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{shop.name}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, color: '#475569' }}>{shop.phone}</td>
                    <td style={S.td}><span style={S.badge(tier)}>{TIER_LABELS[tier] || tier}</span></td>
                    <td style={S.td}>
                      <span style={{ color: shop.status === 'active' ? '#10B981' : '#F59E0B', fontSize: '12px', fontWeight: 600 }}>
                        {shop.status === 'active' ? '● Active' : '● Pending'}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#64748B', fontSize: '12px' }}>{shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ ...S.td, minWidth: '320px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                        {shop.status === 'pending'
                          ? <button disabled={isBusy} onClick={() => approve(shop)} style={S.btn('#10B981')}><CheckCircle size={12} />Approve</button>
                          : shop.status === 'active'
                            ? <button disabled={isBusy} onClick={() => suspend(shop)} style={S.btn('#F59E0B')}><XCircle size={12} />Suspend</button>
                            : <button disabled={isBusy} onClick={() => unsuspend(shop)} style={S.btn('#10B981')}><ShieldCheck size={12} />Activate</button>
                        }
                        <button disabled={isBusy} onClick={() => setUpgradeModal(shop)} style={S.btn('#8B5CF6')}><ChevronDown size={12} />Plan</button>
                        <button disabled={isBusy} onClick={() => setResetModal(shop)} style={S.btn('#475569')}><Key size={12} />Reset PW</button>
                        <button disabled={isBusy} onClick={() => del(shop)} style={S.btn('#EF4444')}><Trash2 size={12} />Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {resetModal && <ResetPassModal shop={resetModal} onClose={() => setResetModal(null)} onDone={() => { setResetModal(null); load(); }} />}
      {upgradeModal && <UpgradeModal shop={upgradeModal} onClose={() => setUpgradeModal(null)} onDone={() => { setUpgradeModal(null); load(); }} />}
    </div>
  );
}
