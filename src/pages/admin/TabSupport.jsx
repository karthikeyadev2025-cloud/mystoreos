import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, Shield, Clock, Download, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const ACTION_COLORS = {
  delete_user: '#ef4444', suspend_user: '#f59e0b', activate_user: '#10b981',
  upgrade_plan: '#8b5cf6', reset_password: '#3b82f6', update_razorpay_key: '#f59e0b',
  maintenance_mode: '#ef4444', send_announcement: '#f43f5e', update_branding: '#10b981',
  update_theme: '#8b5cf6', export_users_csv: '#3b82f6', export_orders_csv: '#3b82f6',
  admin_password_change: '#ef4444', default: '#64748b',
};

const ACTION_LABELS = {
  delete_user: 'Delete User', suspend_user: 'Suspend User', activate_user: 'Activate User',
  unsuspend_user: 'Activate User', upgrade_plan: 'Upgrade Plan', reset_password: 'Reset Password',
  admin_reset_password: 'Reset Password', update_razorpay_key: 'Update Razorpay Key',
  maintenance_mode: 'Maintenance Mode', send_announcement: 'Announcement', update_branding: 'Update Branding',
  update_theme: 'Update Theme', update_custom_css: 'Custom CSS', export_users_csv: 'Export Users',
  export_orders_csv: 'Export Orders', export_credits_csv: 'Export Credits', export_shops_csv: 'Export Shops',
  export_distributors_csv: 'Export Distributors', admin_password_change: 'Admin PW Change',
  upgrade_dist_plan: 'Upgrade Dist Plan', reset_dist_password: 'Reset Dist PW',
  delete_distributor: 'Delete Distributor', suspend_distributor: 'Suspend Distributor',
};

const S = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', padding: '8px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none' },
  th: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { color: '#f8fafc', fontSize: '13px', padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' },
};

function ActionBadge({ action }) {
  const color = ACTION_COLORS[action] || ACTION_COLORS.default;
  const label = ACTION_LABELS[action] || action.replace(/_/g, ' ');
  return <span style={{ background: `${color}22`, color, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>;
}

export default function TabSupport() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  const load = async () => {
    try { setLog(await api.getAdminAuditLog()); }
    catch { toast.error('Failed to load audit log'); }
    finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []);

  const uniqueActions = useMemo(() => ['all', ...new Set(log.map(e => e.action))], [log]);

  const filtered = useMemo(() => {
    let list = log;
    if (filterAction !== 'all') list = list.filter(e => e.action === filterAction);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.action || '').toLowerCase().includes(q) ||
        (e.targetId || '').toLowerCase().includes(q) ||
        (e.newVal || '').toString().toLowerCase().includes(q)
      );
    }
    return list;
  }, [log, filterAction, search]);

  const exportAuditCSV = async () => {
    const headers = ['Timestamp', 'Action', 'Target', 'Old Value', 'New Value'];
    const rows = log.map(e => [e.ts || '', e.action || '', e.targetId || '', String(e.oldVal || ''), String(e.newVal || '').slice(0, 100)]);
    const csv = api.buildCSV(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mystore_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit log exported');
  };

  const clearLog = async () => {
    if (!window.confirm('Clear the entire audit log? This cannot be undone.')) return;
    try {
      await api.saveSiteConfig('admin_audit_log', []);
      setLog([]);
      toast.success('Audit log cleared');
    } catch { toast.error('Failed to clear log'); }
  };

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayActions = log.filter(e => new Date(e.ts).toDateString() === today).length;
    const deleteActions = log.filter(e => e.action?.includes('delete')).length;
    const securityActions = log.filter(e => ['reset_password', 'admin_password_change', 'reset_dist_password', 'admin_reset_password'].includes(e.action)).length;
    return { total: log.length, today: todayActions, deletes: deleteActions, security: securityActions };
  }, [log]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>Support & Audit</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Admin action audit trail — every mutation is logged</p>
        </div>
        <button onClick={load} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: 'Outfit, sans-serif' }}>
          <RefreshCw size={13} />Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { icon: Shield, label: 'Total Actions', value: stats.total, color: '#3b82f6' },
          { icon: Clock, label: 'Today', value: stats.today, color: '#10b981' },
          { icon: Trash2, label: 'Deletions', value: stats.deletes, color: '#ef4444' },
          { icon: Shield, label: 'Security', value: stats.security, color: '#f59e0b' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ background: `${color}22`, borderRadius: '6px', padding: '6px', display: 'flex' }}><Icon size={14} color={color} /></div>
              <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
            </div>
            <div style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={13} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions, targets…" style={{ ...S.input, width: '100%', paddingLeft: '32px' }} />
          </div>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ ...S.input, cursor: 'pointer', minWidth: '160px' }}>
            {uniqueActions.map(a => <option key={a} value={a} style={{ background: '#1e293b' }}>{a === 'all' ? 'All Actions' : ACTION_LABELS[a] || a}</option>)}
          </select>
          <button onClick={exportAuditCSV} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} />Export
          </button>
          <button onClick={clearLog} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trash2 size={13} />Clear
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Loading audit log...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={S.th}>Timestamp</th>
                  <th style={S.th}>Action</th>
                  <th style={S.th}>Target</th>
                  <th style={S.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} style={{ ...S.td, textAlign: 'center', color: '#64748b', padding: '40px' }}>No audit entries{search ? ` matching "${search}"` : ''}</td></tr>
                )}
                {filtered.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ ...S.td, color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {entry.ts ? new Date(entry.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={S.td}><ActionBadge action={entry.action} /></td>
                    <td style={{ ...S.td, color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace' }}>
                      {entry.targetId ? entry.targetId.slice(0, 20) + (entry.targetId.length > 20 ? '…' : '') : '—'}
                    </td>
                    <td style={{ ...S.td, color: '#64748b', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.newVal ? String(entry.newVal).slice(0, 80) : (entry.oldVal ? `was: ${String(entry.oldVal).slice(0, 60)}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            Showing {filtered.length} of {log.length} entries — last 500 actions retained
          </div>
        )}
      </div>
    </div>
  );
}
