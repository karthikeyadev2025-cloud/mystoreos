import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Trash2, Key, UserCheck, UserX } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const ROLE_COLORS = { customer: '#3b82f6', shop: '#f43f5e', distributor: '#10b981', admin: '#f59e0b', staff: '#8b5cf6', ca: '#06b6d4' };
const ROLES = ['all', 'customer', 'shop', 'distributor', 'staff', 'ca', 'admin'];

const S = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
  badge: (role) => ({ background: `${ROLE_COLORS[role] || '#64748b'}22`, color: ROLE_COLORS[role] || '#64748b', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }),
  btn: (color = '#f43f5e') => ({ background: `${color}22`, border: `1px solid ${color}44`, color, borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }),
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', padding: '8px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none' },
  th: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { color: '#f8fafc', fontSize: '13px', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' },
};

function ResetModal({ user, onClose }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pass.length < 6) return toast.error('Min 6 characters');
    setBusy(true);
    try {
      await api.adminResetPassword(user.id, pass);
      await api.logAdminAction('reset_user_password', user.id, null, null);
      toast.success(`Password reset for ${user.name}`);
      onClose();
    } catch { toast.error('Reset failed'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '24px', width: '340px' }}>
        <h3 style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '8px' }}>Reset Password</h3>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '14px' }}>Set new password for <b>{user.name}</b></p>
        <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="New password (min 6)" style={{ ...S.input, width: '100%', marginBottom: '14px' }} required />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" disabled={busy} style={{ flex: 1, background: '#f43f5e', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{busy ? '...' : 'Reset'}</button>
          <button type="button" onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function TabUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [resetModal, setResetModal] = useState(null);
  const [busy, setBusy] = useState({});
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const load = async () => {
    try { setUsers(await api.getAllUsers()); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (filterRole !== 'all') list = list.filter(u => u.role === filterRole);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name?.toLowerCase().includes(q) || u.phone?.includes(q));
    }
    return list;
  }, [users, filterRole, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const act = async (id, fn, label) => {
    setBusy(b => ({ ...b, [id]: true }));
    try { await fn(); await load(); toast.success(label); }
    catch { toast.error(`${label} failed`); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  };

  const suspend = (u) => act(u.id, async () => { await api.suspendUser(u.id); await api.logAdminAction('suspend_user', u.id, 'active', 'pending'); }, `${u.name} suspended`);
  const activate = (u) => act(u.id, async () => { await api.unsuspendUser(u.id); await api.logAdminAction('activate_user', u.id, 'pending', 'active'); }, `${u.name} activated`);
  const del = (u) => {
    if (u.role === 'admin') return toast.error('Cannot delete admin');
    if (!window.confirm(`Delete ${u.name}? This is permanent.`)) return;
    act(u.id, async () => { await api.deleteUser(u.id); await api.logAdminAction('delete_user', u.id, null, null); }, `${u.name} deleted`);
  };

  const roleCounts = useMemo(() => {
    const counts = {};
    users.forEach(u => { counts[u.role] = (counts[u.role] || 0) + 1; });
    return counts;
  }, [users]);

  if (loading) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px' }}>Loading users...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>User Directory</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>{users.length} total users across all roles</p>
        </div>
        <button onClick={load} style={S.btn('#94a3b8')}><RefreshCw size={13} />Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {ROLES.map(r => (
          <button key={r} onClick={() => { setFilterRole(r); setPage(0); }} style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${filterRole === r ? (ROLE_COLORS[r] || '#f43f5e') : 'rgba(255,255,255,0.1)'}`, background: filterRole === r ? `${ROLE_COLORS[r] || '#f43f5e'}18` : 'transparent', color: filterRole === r ? (ROLE_COLORS[r] || '#f43f5e') : '#94a3b8', fontSize: '12px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textTransform: 'capitalize' }}>
            {r === 'all' ? `All (${users.length})` : `${r} (${roleCounts[r] || 0})`}
          </button>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search by name or phone…" style={{ ...S.input, width: '100%', paddingLeft: '32px' }} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={S.th}>User</th>
                <th style={S.th}>Phone</th>
                <th style={S.th}>Role</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Joined</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#64748b', padding: '40px' }}>No users found</td></tr>
              )}
              {paginated.map(u => {
                const isBusy = busy[u.id];
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {u.avatar || u.logo
                          ? <img src={u.avatar || u.logo} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                          : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${ROLE_COLORS[u.role] || '#64748b'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: ROLE_COLORS[u.role] || '#64748b', flexShrink: 0 }}>{(u.name||'U')[0]}</div>
                        }
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, color: '#94a3b8' }}>{u.phone}</td>
                    <td style={S.td}><span style={S.badge(u.role)}>{u.role}</span></td>
                    <td style={S.td}><span style={{ color: u.status === 'active' ? '#10b981' : '#f59e0b', fontSize: '12px', fontWeight: 600 }}>{u.status === 'active' ? '● Active' : '● Pending'}</span></td>
                    <td style={{ ...S.td, color: '#64748b', fontSize: '12px' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {u.status === 'active'
                          ? <button disabled={isBusy || u.role === 'admin'} onClick={() => suspend(u)} style={S.btn('#f59e0b')}><UserX size={12} />Suspend</button>
                          : <button disabled={isBusy} onClick={() => activate(u)} style={S.btn('#10b981')}><UserCheck size={12} />Activate</button>
                        }
                        <button disabled={isBusy} onClick={() => setResetModal(u)} style={S.btn('#94a3b8')}><Key size={12} />Reset PW</button>
                        {u.role !== 'admin' && <button disabled={isBusy} onClick={() => del(u)} style={S.btn('#ef4444')}><Trash2 size={12} />Delete</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#64748b', fontSize: '12px' }}>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ ...S.btn('#94a3b8'), padding: '6px 12px' }}>Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ ...S.btn('#94a3b8'), padding: '6px 12px' }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {resetModal && <ResetModal user={resetModal} onClose={() => setResetModal(null)} />}
    </div>
  );
}
