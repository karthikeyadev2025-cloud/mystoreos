import { useState } from 'react';
import { Download, Users, Store, ShoppingCart, CreditCard, Truck, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';

const S = {
  card: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' },
  input: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '8px', color: 'var(--c-ink)', padding: '9px 12px', fontSize: '13px', fontFamily: 'var(--font-sans), sans-serif', outline: 'none' },
  dlBtn: (busy, color = 'var(--c-primary)') => ({ background: busy ? 'var(--c-line-soft)' : `${color}10`, border: `1px solid ${busy ? 'var(--c-line-strong)' : color + '30'}`, color: busy ? 'var(--c-muted)' : color, borderRadius: '8px', padding: '10px 18px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-sans), sans-serif', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }),
};

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportCard({ icon: Icon, title, description, color, action, children }) {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{ background: `${color}15`, borderRadius: '10px', padding: '10px', display: 'flex', flexShrink: 0 }}><Icon size={18} color={color} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--c-ink)', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
          <div style={{ color: 'var(--c-muted)', fontSize: '12px', marginBottom: '14px' }}>{description}</div>
          {children}
          <div style={{ marginTop: '14px' }}>{action}</div>
        </div>
      </div>
    </div>
  );
}

export default function TabExports() {
  const [busy, setBusy] = useState({});
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const run = async (key, fn) => {
    setBusy(b => ({ ...b, [key]: true }));
    try { await fn(); }
    catch (e) { toast.error(`Export failed: ${e.message}`); }
    finally { setBusy(b => ({ ...b, [key]: false })); }
  };

  const exportUsers = () => run('users', async () => {
    const csv = await api.exportUsersCSV();
    downloadCSV(csv, `mystore_users_${new Date().toISOString().slice(0, 10)}.csv`);
    await api.logAdminAction('export_users_csv', 'exports', null, null);
    toast.success('Users exported');
  });

  const exportOrders = () => run('orders', async () => {
    const csv = await api.exportOrdersCSV(dateRange.start || undefined, dateRange.end || undefined);
    downloadCSV(csv, `mystore_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    await api.logAdminAction('export_orders_csv', 'exports', null, null);
    toast.success('Orders exported');
  });

  const exportCredits = () => run('credits', async () => {
    const csv = await api.exportCreditsCSV();
    downloadCSV(csv, `mystore_credits_${new Date().toISOString().slice(0, 10)}.csv`);
    await api.logAdminAction('export_credits_csv', 'exports', null, null);
    toast.success('Credits exported');
  });

  const exportShops = () => run('shops', async () => {
    const users = await api.getAllUsers();
    const shops = users.filter(u => u.role === 'shop');
    const headers = ['ID', 'Name', 'Phone', 'Subscription', 'Tier', 'GSTIN', 'State', 'Latitude', 'Longitude', 'Joined'];
    const rows = shops.map(s => [s.id, s.name, s.phone, s.subscription || '', s.subscriptionTier || '', s.gstin || '', s.stateCode || '', s.latitude || '', s.longitude || '', s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '']);
    const csv = api.buildCSV(headers, rows);
    downloadCSV(csv, `mystore_shops_${new Date().toISOString().slice(0, 10)}.csv`);
    await api.logAdminAction('export_shops_csv', 'exports', null, null);
    toast.success('Shops exported');
  });

  const exportDistributors = () => run('distributors', async () => {
    const users = await api.getAllUsers();
    const dists = users.filter(u => u.role === 'distributor');
    const headers = ['ID', 'Name', 'Phone', 'Plan Tier', 'Status', 'Joined'];
    const rows = dists.map(d => [d.id, d.name, d.phone, d.distributorPlanTier || '', d.status || '', d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : '']);
    const csv = api.buildCSV(headers, rows);
    downloadCSV(csv, `mystore_distributors_${new Date().toISOString().slice(0, 10)}.csv`);
    await api.logAdminAction('export_distributors_csv', 'exports', null, null);
    toast.success('Distributors exported');
  });

  const exportExpiredTrials = () => run('trials', async () => {
    const expired = await api.getExpiredTrials();
    const headers = ['ID', 'Name', 'Phone', 'Trial Started', 'Days Expired'];
    const now = new Date();
    const rows = expired.map(s => [s.id, s.name, s.phone, s.trialStartedAt ? new Date(s.trialStartedAt).toLocaleDateString('en-IN') : '', s.trialStartedAt ? Math.floor((now - new Date(s.trialStartedAt)) / 864e5) : '']);
    const csv = api.buildCSV(headers, rows);
    downloadCSV(csv, `mystore_expired_trials_${new Date().toISOString().slice(0, 10)}.csv`);
    await api.logAdminAction('export_expired_trials_csv', 'exports', null, null);
    toast.success(`${expired.length} expired trials exported`);
  });

  return (
    <div className="admin-tab-content" style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#22C55E15", border: "1px solid #22C55E30", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Download size={22} color="var(--c-success)" />
          </div>
          <div>
            <h2 style={{ color: "var(--c-ink)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Data Exports</h2>
            <p style={{ color: "var(--c-muted)", fontSize: 13, margin: "4px 0 0 0" }}>Download CSV snapshots of shops, users, orders, credits, and distributors</p>
          </div>
        </div>
        <p style={{ color: 'var(--c-muted)', fontSize: '13px', marginTop: '4px' }}>Download platform data as UTF-8 CSV (Telugu name safe)</p>
      </div>

      <ExportCard icon={Users} title="All Users" description="Full user directory across all roles with subscription and join date." color="var(--c-info)"
        action={<button onClick={exportUsers} disabled={busy.users} style={S.dlBtn(busy.users, 'var(--c-info)')}><Download size={14} />{busy.users ? 'Exporting...' : 'Download Users CSV'}</button>}
      />

      <ExportCard icon={Store} title="Shops Only" description="All shop accounts with GSTIN, location, and subscription tier." color="var(--c-danger)"
        action={<button onClick={exportShops} disabled={busy.shops} style={S.dlBtn(busy.shops, 'var(--c-danger)')}><Download size={14} />{busy.shops ? 'Exporting...' : 'Download Shops CSV'}</button>}
      />

      <ExportCard icon={Truck} title="Distributors" description="All distributor accounts with plan tier and status." color="var(--c-success)"
        action={<button onClick={exportDistributors} disabled={busy.distributors} style={S.dlBtn(busy.distributors, 'var(--c-success)')}><Download size={14} />{busy.distributors ? 'Exporting...' : 'Download Distributors CSV'}</button>}
      />

      <ExportCard icon={ShoppingCart} title="Orders" description="All transactions with optional date range filter." color="var(--c-violet)"
        action={<button onClick={exportOrders} disabled={busy.orders} style={S.dlBtn(busy.orders, 'var(--c-violet)')}><Download size={14} />{busy.orders ? 'Exporting...' : 'Download Orders CSV'}</button>}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div>
            <label style={{ color: 'var(--c-ink-2)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>From</label>
            <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} style={S.input} />
          </div>
          <div>
            <label style={{ color: 'var(--c-ink-2)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>To</label>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} style={S.input} />
          </div>
          {(dateRange.start || dateRange.end) && (
            <button onClick={() => setDateRange({ start: '', end: '' })} style={{ background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', marginTop: '16px', fontSize: '12px', fontFamily: 'var(--font-sans), sans-serif' }}>Clear</button>
          )}
        </div>
      </ExportCard>

      <ExportCard icon={CreditCard} title="Credits & Ledger" description="All credit entries between distributors and shops (paid/unpaid)." color="var(--c-warning)"
        action={<button onClick={exportCredits} disabled={busy.credits} style={S.dlBtn(busy.credits, 'var(--c-warning)')}><Download size={14} />{busy.credits ? 'Exporting...' : 'Download Credits CSV'}</button>}
      />

      <ExportCard icon={FileText} title="Expired Trials" description="All shop accounts whose 7-day trial has expired without upgrading." color="var(--c-danger)"
        action={<button onClick={exportExpiredTrials} disabled={busy.trials} style={S.dlBtn(busy.trials, 'var(--c-danger)')}><Download size={14} />{busy.trials ? 'Exporting...' : 'Download Expired Trials CSV'}</button>}
      />
    </div>
  );
}
