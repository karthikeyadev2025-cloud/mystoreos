import React from 'react';
import { IndianRupee, Trash2, Plus, TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { api } from '../lib/api';
import { localDateStr } from '../lib/dateUtils';

const EXPENSE_CATS = ['Rent', 'Electricity', 'Wages', 'Supplies', 'Packaging', 'Transport', 'Maintenance', 'Misc'];

const CAT_COLORS = {
  Rent: 'var(--c-danger)', Electricity: 'var(--c-warning)', Wages: '#4A7CAD',
  Supplies: 'var(--c-info)', Packaging: 'var(--c-cyan)', Transport: 'var(--c-success)',
  Maintenance: 'var(--c-orange)', Misc: 'var(--c-muted)',
};

// Local calendar day/month — was new Date().toISOString(), which is UTC
// and would default the expense-entry date / month filter to yesterday
// for anyone logging an expense between midnight and 5:30 AM IST.
const todayStr = () => localDateStr();
const nowYM = () => localDateStr().slice(0, 7);

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

const StatCard = ({ label, value, color, icon: Icon, sub }) => (
  <div style={{ background: 'var(--c-surface)', border: `1px solid var(--c-line)`, borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '14px', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
    <div style={{ background: `${color}18`, color, width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} />
    </div>
    <div>
      <h4 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--c-ink)' }}>{value}</h4>
      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--c-ink-2)' }}>{label}</p>
      {sub && <p style={{ margin: '1px 0 0 0', fontSize: '10px', color, fontWeight: '500' }}>{sub}</p>}
    </div>
  </div>
);

const DesktopExpenses = ({ targetShopId, orders }) => {
  const [yearMonth, setYearMonth] = React.useState(nowYM());
  const [expenses, setExpenses] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ date: todayStr(), category: 'Rent', description: '', amount: '' });

  React.useEffect(() => {
    let cancelled = false;
    api.getExpenses(targetShopId, yearMonth)
      .then(list => { if (!cancelled) setExpenses(list); })
      .catch(() => { if (!cancelled) setExpenses([]); });
    return () => { cancelled = true; };
  }, [targetShopId, yearMonth]);

  const monthRevenue = React.useMemo(() => {
    return (orders || [])
      .filter(o => (o.createdAt || o.created_at || '').slice(0, 7) === yearMonth && o.status !== 'draft')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [orders, yearMonth]);

  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const netProfit = monthRevenue - totalExpenses;

  const handleAdd = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0 || !form.date) return;
    setSaving(true);
    try {
      const entry = { date: form.date, category: form.category, description: form.description.trim(), amount: parseFloat(form.amount) };
      await api.addExpense(targetShopId, entry);
      const updated = await api.getExpenses(targetShopId, yearMonth);
      setExpenses(updated);
      setForm(f => ({ ...f, description: '', amount: '' }));
    } catch {
      // toast not imported here — fail silently but at least unspin the button
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await api.deleteExpense(targetShopId, id, yearMonth);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const byCategory = React.useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + parseFloat(e.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const sorted = [...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
      <div className="premium-glass" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--c-line)', background: 'var(--c-surface)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--c-ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IndianRupee size={22} color="#12457A" /> Expense Tracker
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--c-ink-2)' }}>
              Log daily shop costs and track profit vs revenue each month.
            </p>
          </div>
          <input
            type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
            style={{ padding: '8px 14px', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '10px', color: 'var(--c-ink)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
          />
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
          <StatCard label="Revenue this month" value={fmt(monthRevenue)} color="var(--c-success)" icon={TrendingUp} />
          <StatCard label="Total Expenses" value={fmt(totalExpenses)} color="var(--c-danger)" icon={TrendingDown}
            sub={byCategory.length > 0 ? `Top: ${byCategory[0][0]}` : undefined} />
          <StatCard label="Net Profit" value={fmt(netProfit)} color={netProfit >= 0 ? 'var(--c-primary)' : '#12457A'} icon={Activity}
            sub={netProfit >= 0 ? 'Profitable month' : 'Loss — check expenses'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
          {/* Left — add form + list */}
          <div>
            {/* Add form */}
            <div style={{ background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-soft)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--c-rose-strong)' }}>
                <Plus size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Add Expense
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ padding: '8px 10px', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '8px', color: 'var(--c-ink)', fontSize: '12px', outline: 'none' }} />
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ padding: '8px 10px', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '8px', color: 'var(--c-ink)', fontSize: '12px', outline: 'none' }}>
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" placeholder="Description (optional)" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ padding: '8px 10px', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '8px', color: 'var(--c-ink)', fontSize: '12px', outline: 'none' }} />
                <input type="number" placeholder="Amount (₹)" value={form.amount} min="0"
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ padding: '8px 10px', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '8px', color: 'var(--c-ink)', fontSize: '12px', outline: 'none' }} />
              </div>
              <button onClick={handleAdd} disabled={saving || !form.amount}
                style={{ background: saving ? 'var(--c-faint)' : '#12457A', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer', opacity: !form.amount ? 0.5 : 1 }}>
                {saving ? 'Saving…' : '+ Add Expense'}
              </button>
            </div>

            {/* Expense list */}
            {sorted.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-muted)' }}>
                <IndianRupee size={36} style={{ opacity: 0.2, marginBottom: '10px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>No expenses logged for this month.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sorted.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '10px' }}>
                    <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: `${CAT_COLORS[e.category] || 'var(--c-muted)'}18`, color: CAT_COLORS[e.category] || 'var(--c-muted)', border: `1px solid ${CAT_COLORS[e.category] || 'var(--c-muted)'}30`, fontWeight: 'bold', flexShrink: 0 }}>
                      {e.category}
                    </span>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--c-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.description || e.category}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--c-muted)', flexShrink: 0 }}>{e.date}</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--c-danger-strong)', flexShrink: 0 }}>-{fmt(e.amount)}</span>
                    <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: 'var(--c-faint)', cursor: 'pointer', padding: '2px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — category breakdown */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '14px', padding: '16px' }}>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: '700', color: 'var(--c-ink)' }}>Breakdown by Category</p>
            {byCategory.length === 0 ? (
              <p style={{ color: 'var(--c-muted)', fontSize: '12px', margin: 0 }}>No data yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {byCategory.map(([cat, amt]) => {
                  const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
                  const color = CAT_COLORS[cat] || 'var(--c-muted)';
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color, fontWeight: 'bold' }}>{cat}</span>
                        <span style={{ fontSize: '12px', color: 'var(--c-ink)' }}>{fmt(amt)} <span style={{ color: 'var(--c-muted)' }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--c-line-soft)', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default DesktopExpenses;
