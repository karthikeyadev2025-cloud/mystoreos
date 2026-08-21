import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Award, Users } from 'lucide-react';

const EMPTY_PLAN = {
  name: '', description: '', duration_days: 30, price: '',
  discount_percent: 10, free_services: 0, color: '#4A7CAD', active: true,
};

const COLORS = ['#4A7CAD', 'var(--c-rose)', 'var(--c-success)', 'var(--c-warning)', 'var(--c-info)', 'var(--c-danger)'];

function PlanCard({ plan, onEdit, onDelete, onIssue }) {
  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, borderTop: `4px solid ${plan.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--c-ink)' }}>{plan.name}</div>
          {plan.description && <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>{plan.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onEdit(plan)} title="Edit"
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--c-line)', background: 'var(--c-bg)', color: 'var(--c-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={13} /></button>
          <button onClick={() => onDelete(plan.id)} title="Delete"
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--c-danger-soft)', background: 'var(--c-danger-soft)', color: 'var(--c-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: plan.color }}>₹{Number(plan.price).toLocaleString('en-IN')}</span>
        <span style={{ fontSize: 12, color: 'var(--c-faint)' }}>/ {plan.duration_days} days</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--c-ink-2)' }}>
        {plan.discount_percent > 0 && <div>✓ {plan.discount_percent}% off every bill</div>}
        {plan.free_services > 0 && <div>✓ {plan.free_services} free service{plan.free_services > 1 ? 's' : ''}</div>}
        <div>✓ Valid for {plan.duration_days} days</div>
      </div>
      <button onClick={() => onIssue(plan)}
        style={{ marginTop: 4, padding: '8px 12px', borderRadius: 8, border: 'none', background: plan.color, color: 'var(--c-surface)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
        + Issue to Customer
      </button>
    </div>
  );
}

function PlanForm({ plan, shopId, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_PLAN, ...plan });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Plan name required');
    if (!form.price) return toast.error('Enter price');
    setSaving(true);
    try {
      await api.saveMembershipPlan(shopId, form);
      toast.success(plan?.id ? 'Plan updated' : 'Plan created');
      onSave();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const field = (label, key, extra = {}) => (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>{label}</label>
      <input value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} {...extra}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );

  return (
    <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{plan?.id ? 'Edit Plan' : 'New Membership Plan'}</div>
      {field('Plan Name *', 'name', { placeholder: 'e.g. Gold Monthly' })}
      {field('Description', 'description', { placeholder: 'Optional benefits summary' })}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Duration</label>
          <select value={form.duration_days} onChange={e => setForm(p => ({ ...p, duration_days: Number(e.target.value) }))}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, background: 'var(--c-surface)', outline: 'none' }}>
            <option value={30}>1 Month (30 days)</option>
            <option value={90}>3 Months (90 days)</option>
            <option value={180}>6 Months (180 days)</option>
            <option value={365}>1 Year (365 days)</option>
          </select>
        </div>
        {field('Price (₹) *', 'price', { type: 'number', min: 0 })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {field('Discount % on every bill', 'discount_percent', { type: 'number', min: 0, max: 100 })}
        {field('Free services / period', 'free_services', { type: 'number', min: 0 })}
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 6 }}>Card Colour</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
              style={{ width: 30, height: 30, borderRadius: 8, border: form.color === c ? '3px solid var(--c-ink)' : '1px solid var(--c-line)', background: c, cursor: 'pointer' }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--c-line)', background: 'var(--c-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--c-primary)', color: 'var(--c-surface)', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : (plan?.id ? 'Save' : 'Create Plan')}
        </button>
      </div>
    </div>
  );
}

function IssueMembershipForm({ plan, shopId, onSaved, onCancel }) {
  const [form, setForm] = useState({ customerName: '', customerPhone: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.customerName.trim()) return toast.error('Customer name required');
    if (!/^\d{10}$/.test(form.customerPhone)) return toast.error('Enter 10-digit phone');
    setSaving(true);
    try {
      await api.issueMembership(shopId, { plan, ...form });
      toast.success('Membership issued!');
      onSaved();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--c-ink)' }}>Issue {plan.name}</div>
        <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>₹{Number(plan.price).toLocaleString('en-IN')} · {plan.duration_days} days · {plan.discount_percent}% off</div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Customer Name *</label>
        <input value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))} placeholder="Full name"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Mobile Number *</label>
        <input value={form.customerPhone} maxLength={10} onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value.replace(/\D/g, '') }))} placeholder="10-digit mobile"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Notes (optional)</label>
        <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Payment ref, source, anything…"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--c-line)', background: 'var(--c-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: plan.color, color: 'var(--c-surface)', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Issuing…' : 'Issue Membership'}
        </button>
      </div>
    </div>
  );
}

function MemberRow({ member, onStatusChange }) {
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = member.expires_on < today;
  const effectiveStatus = isExpired && member.status === 'active' ? 'expired' : member.status;
  const daysLeft = Math.max(0, Math.floor((new Date(member.expires_on) - new Date()) / 86400000));
  const statusConfig = {
    active:    { label: 'Active',    color: 'var(--c-success)', bg: 'var(--c-success-soft)' },
    expired:   { label: 'Expired',   color: 'var(--c-faint)', bg: 'var(--c-line-soft)' },
    cancelled: { label: 'Cancelled', color: 'var(--c-danger)', bg: 'var(--c-danger-soft)' },
  }[effectiveStatus];

  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-ink)' }}>{member.customer_name}</div>
        <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>{member.customer_phone} · {member.plan_name}</div>
        <div style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 2 }}>
          {new Date(member.starts_on + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} → {new Date(member.expires_on + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          {effectiveStatus === 'active' && ` · ${daysLeft} days left`}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusConfig.color, background: statusConfig.bg, padding: '2px 10px', borderRadius: 999 }}>{statusConfig.label}</span>
        {effectiveStatus === 'active' && (
          <button onClick={() => onStatusChange(member.id, 'cancelled')} style={{ fontSize: 10, background: 'none', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
        )}
      </div>
    </div>
  );
}

export default function DesktopMembership({ shopId }) {
  const [tab, setTab] = useState('members');
  const [plans, setPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [issuingForPlan, setIssuingForPlan] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([api.getMembershipPlans(shopId), api.getMemberships(shopId)]);
      setPlans(p); setMembers(m);
    } catch (_e) { toast.error('Failed to load'); }
    setLoading(false);
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().slice(0, 10);
  const activeMembers = members.filter(m => m.status === 'active' && m.expires_on >= today);
  const expiringSoon = activeMembers.filter(m => {
    const d = Math.floor((new Date(m.expires_on) - new Date()) / 86400000);
    return d >= 0 && d <= 7;
  });

  const deletePlan = async (id) => {
    if (!confirm('Delete this plan? Existing members keep their subscription.')) return;
    try { await api.deleteMembershipPlan(id); toast.success('Deleted'); loadData(); }
    catch (e) { toast.error(e.message); }
  };
  const cancelMember = async (id, status) => {
    if (!confirm('Cancel this membership?')) return;
    try { await api.updateMembershipStatus(id, status); toast.success('Updated'); loadData(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--c-warning),var(--c-orange))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Award size={22} color="var(--c-surface)" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--c-ink)' }}>Memberships</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--c-muted)' }}>Sell subscription plans with benefits & discounts</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active Members', value: activeMembers.length, color: 'var(--c-success)', bg: 'var(--c-success-soft)' },
          { label: 'Expiring in 7 days', value: expiringSoon.length, color: 'var(--c-warning)', bg: 'var(--c-warning-soft)' },
          { label: 'Plans Live', value: plans.filter(p => p.active).length, color: 'var(--c-primary)', bg: 'var(--c-primary-soft)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 18px', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: s.color + 'aa' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'var(--c-line-soft)', borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {[{ id: 'members', label: '👤 Members' }, { id: 'plans', label: '🏆 Plans' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: tab === t.id ? 'var(--c-surface)' : 'transparent', color: tab === t.id ? 'var(--c-primary)' : 'var(--c-muted)', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'plans' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => { setEditingPlan(null); setShowPlanForm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--c-primary)', color: 'var(--c-surface)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Plus size={15} /> New Plan
            </button>
          </div>
          {showPlanForm && (
            <div style={{ marginBottom: 16 }}>
              <PlanForm plan={editingPlan} shopId={shopId}
                onSave={() => { setShowPlanForm(false); setEditingPlan(null); loadData(); }}
                onCancel={() => { setShowPlanForm(false); setEditingPlan(null); }} />
            </div>
          )}
          {issuingForPlan && (
            <div style={{ marginBottom: 16 }}>
              <IssueMembershipForm plan={issuingForPlan} shopId={shopId}
                onSaved={() => { setIssuingForPlan(null); setTab('members'); loadData(); }}
                onCancel={() => setIssuingForPlan(null)} />
            </div>
          )}
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-faint)' }}>Loading…</div>
            : plans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--c-faint)' }}>
                <Award size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>No membership plans yet</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Create plans to offer subscription benefits to loyal customers</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {plans.map(p => (
                  <PlanCard key={p.id} plan={p}
                    onEdit={pl => { setEditingPlan(pl); setShowPlanForm(true); }}
                    onDelete={deletePlan}
                    onIssue={pl => setIssuingForPlan(pl)} />
                ))}
              </div>
            )}
        </div>
      )}

      {tab === 'members' && (
        <div>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-faint)' }}>Loading…</div>
            : members.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--c-faint)' }}>
                <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>No members yet</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Create plans and issue memberships to your loyal customers</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(m => <MemberRow key={m.id} member={m} onStatusChange={cancelMember} />)}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
