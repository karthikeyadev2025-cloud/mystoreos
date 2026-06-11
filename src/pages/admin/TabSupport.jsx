import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, Shield, Clock, Download, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const ACTION_COLORS = {
  delete_user: '#ef4444', suspend_user: '#f59e0b', activate_user: '#10b981',
  upgrade_plan: '#4F46E5', reset_password: '#3b82f6', update_razorpay_key: '#f59e0b',
  maintenance_mode: '#ef4444', send_announcement: '#f43f5e', update_branding: '#10b981',
  update_theme: '#4F46E5', export_users_csv: '#3b82f6', export_orders_csv: '#3b82f6',
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
  card: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' },
  input: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', padding: '8px 12px', fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none' },
  th: { color: '#475569', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  td: { color: '#0f172a', fontSize: '13px', padding: '11px 12px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' },
};

function ActionBadge({ action }) {
  const color = ACTION_COLORS[action] || ACTION_COLORS.default;
  const label = ACTION_LABELS[action] || action.replace(/_/g, ' ');
  return <span style={{ background: `${color}15`, color, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>;
}

export default function TabSupport() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  // Support tickets
  const [tickets, setTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('open');
  const [activeTicket, setActiveTicket] = useState(null);
  const [tMessages, setTMessages] = useState([]);
  const [adminReply, setAdminReply] = useState('');
  const [tBusy, setTBusy] = useState(false);

  const loadTickets = async (status = ticketFilter) => {
    try { setTickets(await api.getAllTickets(status)); } catch { /* ignore */ }
  };
  useEffect(() => { loadTickets(ticketFilter); /* eslint-disable-next-line */ }, [ticketFilter]);

  const openAdminTicket = async (t) => {
    setActiveTicket(t);
    setTMessages(await api.getTicketMessages(t.id).catch(() => []));
  };
  const sendAdminReply = async () => {
    if (!adminReply.trim() || !activeTicket) return;
    setTBusy(true);
    try {
      await api.postTicketMessage(activeTicket.id, 'admin', adminReply);
      setAdminReply('');
      setTMessages(await api.getTicketMessages(activeTicket.id));
    } catch { toast.error('Could not send reply'); }
    finally { setTBusy(false); }
  };
  const resolveTicket = async () => {
    if (!activeTicket) return;
    await api.setTicketStatus(activeTicket.id, 'resolved').catch(() => {});
    toast.success('Ticket resolved');
    setActiveTicket(null);
    loadTickets(ticketFilter);
  };

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
      {/* ── Support Tickets Inbox ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h2 style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700, margin: 0 }}>🎫 Support Tickets</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {['open', 'pending', 'resolved', 'all'].map(s => (
              <button key={s} onClick={() => { setActiveTicket(null); setTicketFilter(s); }}
                style={{ background: ticketFilter === s ? '#4F46E5' : '#fff', color: ticketFilter === s ? '#fff' : '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
            ))}
          </div>
        </div>

        {!activeTicket ? (
          tickets.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No {ticketFilter} tickets.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tickets.map(t => (
                <div key={t.id} onClick={() => openAdminTicket(t)} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{t.subject}</div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{t.name || 'User'} · {t.role || '—'} · {t.category} · {new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.status === 'open' ? '#10b981' : t.status === 'pending' ? '#f59e0b' : '#64748b', textTransform: 'capitalize' }}>{t.status}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div>
            <button onClick={() => setActiveTicket(null)} style={{ background: 'transparent', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: 13, marginBottom: 10, padding: 0 }}>← Back to list</button>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>{activeTicket.subject}</div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>{activeTicket.name} · {activeTicket.role} · {activeTicket.category}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
              {tMessages.map(m => (
                <div key={m.id} style={{ alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '80%', background: m.sender === 'admin' ? '#4F46E5' : '#f1f5f9', color: m.sender === 'admin' ? '#fff' : '#0f172a', borderRadius: 10, padding: '8px 12px', fontSize: 13 }}>
                  <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2, textTransform: 'capitalize' }}>{m.sender}</div>
                  {m.body}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={adminReply} onChange={e => setAdminReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAdminReply()} placeholder="Reply to user..." style={{ ...S.input, flex: 1 }} />
              <button onClick={sendAdminReply} disabled={tBusy} style={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', cursor: 'pointer', fontWeight: 600 }}>Send</button>
              <button onClick={resolveTicket} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Resolve</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#0f172a', fontSize: '20px', fontWeight: 700 }}>Support &amp; Audit</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Admin action audit trail — every mutation is logged</p>
        </div>
        <button onClick={load} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: 'Outfit, sans-serif' }}>
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
          <div key={label} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ background: `${color}15`, borderRadius: '6px', padding: '6px', display: 'flex' }}><Icon size={14} color={color} /></div>
              <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
            </div>
            <div style={{ color: '#0f172a', fontSize: '24px', fontWeight: 700 }}>{value}</div>
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
            {uniqueActions.map(a => <option key={a} value={a}>{a === 'all' ? 'All Actions' : ACTION_LABELS[a] || a}</option>)}
          </select>
          <button onClick={exportAuditCSV} style={{ background: '#ffffff', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} />Export
          </button>
          <button onClick={clearLog} style={{ background: '#ffffff', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trash2 size={13} />Clear
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Loading audit log...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...S.td, color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {entry.ts ? new Date(entry.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={S.td}><ActionBadge action={entry.action} /></td>
                    <td style={{ ...S.td, color: '#475569', fontSize: '12px', fontFamily: 'monospace' }}>
                      {entry.targetId ? entry.targetId.slice(0, 20) + (entry.targetId.length > 20 ? '…' : '') : '—'}
                    </td>
                    <td style={{ ...S.td, color: '#475569', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.newVal ? String(entry.newVal).slice(0, 80) : (entry.oldVal ? `was: ${String(entry.oldVal).slice(0, 60)}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #cbd5e1' }}>
            Showing {filtered.length} of {log.length} entries — last 500 actions retained
          </div>
        )}
      </div>
    </div>
  );
}
