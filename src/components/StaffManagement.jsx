import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, User } from 'lucide-react';

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const DEFAULT_HOURS = {
  mon: { start: '10:00', end: '19:00' }, tue: { start: '10:00', end: '19:00' },
  wed: { start: '10:00', end: '19:00' }, thu: { start: '10:00', end: '19:00' },
  fri: { start: '10:00', end: '19:00' }, sat: { start: '10:00', end: '19:00' },
  sun: null,
};

const EMPTY_PROVIDER = { name: '', title: '', phone: '', active: true, working_hours: DEFAULT_HOURS };

function WorkingHoursEditor({ hours, onChange }) {
  const toggleDay = (key) => {
    onChange({ ...hours, [key]: hours[key] ? null : { start: '10:00', end: '19:00' } });
  };
  const setTime = (key, field, value) => {
    onChange({ ...hours, [key]: { ...hours[key], [field]: value } });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {DAYS.map(d => {
        const dayHours = hours[d.key];
        return (
          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => toggleDay(d.key)}
              style={{ width: 60, padding: '6px 4px', borderRadius: 6, border: '1px solid', borderColor: dayHours ? '#10B981' : '#E2E8F0', background: dayHours ? '#D1FAE5' : '#F8FAFC', color: dayHours ? '#10B981' : '#94A3B8', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {d.label}
            </button>
            {dayHours ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                <input type="time" value={dayHours.start} onChange={e => setTime(d.key, 'start', e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                <span style={{ color: '#94A3B8', fontSize: 12 }}>to</span>
                <input type="time" value={dayHours.end} onChange={e => setTime(d.key, 'end', e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic' }}>Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimeOffManager({ providerId }) {
  const [timeOff, setTimeOff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!providerId) return;
    try { setTimeOff(await api.getProviderTimeOff(providerId)); } catch (_e) { /* non-fatal for this sub-panel */ }
  }, [providerId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (endDate < startDate) return toast.error('End date must be after start date');
    try {
      await api.addProviderTimeOff(providerId, startDate, endDate, reason);
      toast.success('Time off added');
      setShowForm(false); setReason('');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    try { await api.deleteProviderTimeOff(id); load(); } catch (e) { toast.error(e.message); }
  };

  if (!providerId) return null; // only available once the provider is saved

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Time Off / Vacation</label>
        <button type="button" onClick={() => setShowForm(s => !s)}
          style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>
      {showForm && (
        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
          </div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional) — e.g. Vacation"
            style={{ padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
          <button type="button" onClick={add} style={{ padding: '7px', borderRadius: 6, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Save Time Off
          </button>
        </div>
      )}
      {timeOff.length === 0 ? (
        <div style={{ fontSize: 11, color: '#CBD5E1' }}>No time off scheduled</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {timeOff.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: '#FFF7ED', borderRadius: 6, padding: '6px 10px' }}>
              <span>
                {new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                {t.start_date !== t.end_date && ` → ${new Date(t.end_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                {t.reason && <span style={{ color: '#94A3B8' }}> · {t.reason}</span>}
              </span>
              <button type="button" onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderForm({ provider, shopId, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_PROVIDER, ...provider, working_hours: provider?.working_hours || DEFAULT_HOURS });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      await api.saveProvider(shopId, form);
      toast.success(provider?.id ? 'Staff member updated' : 'Staff member added');
      onSave();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{provider?.id ? 'Edit Staff Member' : 'Add Staff Member'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Priya"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Title</label>
          <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Senior Stylist"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Phone (optional)</label>
        <input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit mobile"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Weekly Working Hours</label>
        <WorkingHoursEditor hours={form.working_hours} onChange={wh => setForm(p => ({ ...p, working_hours: wh }))} />
      </div>

      {provider?.id && <TimeOffManager providerId={provider.id} />}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : (provider?.id ? 'Save Changes' : 'Add Staff Member')}
        </button>
      </div>
    </div>
  );
}

function ProviderCard({ provider, onEdit, onDelete, onToggle }) {
  const workingDays = Object.entries(provider.working_hours || {}).filter(([, v]) => v).length;
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <User size={18} color="#4F46E5" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{provider.name}</span>
          {!provider.active && <span style={{ fontSize: 10, color: '#94A3B8', background: '#F1F5F9', padding: '1px 7px', borderRadius: 999 }}>Inactive</span>}
        </div>
        <div style={{ fontSize: 12, color: '#64748B' }}>
          {provider.title || 'Staff Member'} · Works {workingDays} day{workingDays !== 1 ? 's' : ''}/week
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onToggle(provider)} title={provider.active ? 'Deactivate' : 'Activate'}
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: provider.active ? '#10B981' : '#94A3B8' }}>
          {provider.active ? '✓' : '✕'}
        </button>
        <button onClick={() => onEdit(provider)} title="Edit"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#4F46E5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Edit2 size={13} />
        </button>
        <button onClick={() => onDelete(provider.id)} title="Delete"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function StaffManagement({ shopId }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try { setProviders(await api.getProviders(shopId)); }
    catch (e) { toast.error('Failed to load staff'); }
    setLoading(false);
  }, [shopId]);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this staff member? Existing appointments keep their history but lose the assignment.')) return;
    try { await api.deleteProvider(id); toast.success('Deleted'); loadProviders(); }
    catch (e) { toast.error(e.message); }
  };

  const handleToggle = async (provider) => {
    try { await api.toggleProviderActive(provider.id, !provider.active); loadProviders(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
          Add staff members customers can choose when booking. Each person can have their own working hours.
        </p>
        <button onClick={() => { setEditingProvider(null); setShowForm(true); }}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> Add Staff
        </button>
      </div>

      {showForm && (
        <div style={{ marginBottom: 16 }}>
          <ProviderForm
            provider={editingProvider}
            shopId={shopId}
            onSave={() => { setShowForm(false); setEditingProvider(null); loadProviders(); }}
            onCancel={() => { setShowForm(false); setEditingProvider(null); }}
          />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading…</div>
      ) : providers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
          <User size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>No staff members added yet</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Without staff, all bookings are treated as a single-resource business.<br />
            Add staff if customers should be able to pick who they want.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providers.map(p => (
            <ProviderCard key={p.id} provider={p} onEdit={pr => { setEditingProvider(pr); setShowForm(true); }} onDelete={handleDelete} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
