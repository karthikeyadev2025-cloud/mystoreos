import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, User } from 'lucide-react';
import { useServiceFeatures } from '../hooks/useServiceFeatures';
import { UpgradeChip } from './FeatureUpgradePrompt';

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

const EMPTY_PROVIDER = { name: '', title: '', phone: '', active: true, working_hours: DEFAULT_HOURS, buffer_minutes: 0 };

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
              style={{ width: 60, padding: '6px 4px', borderRadius: 6, border: '1px solid', borderColor: dayHours ? 'var(--c-success)' : 'var(--c-line)', background: dayHours ? 'var(--c-success-soft)' : 'var(--c-bg)', color: dayHours ? 'var(--c-success)' : 'var(--c-faint)', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {d.label}
            </button>
            {dayHours ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                <input type="time" value={dayHours.start} onChange={e => setTime(d.key, 'start', e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid var(--c-line)', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                <span style={{ color: 'var(--c-faint)', fontSize: 12 }}>to</span>
                <input type="time" value={dayHours.end} onChange={e => setTime(d.key, 'end', e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid var(--c-line)', borderRadius: 6, fontSize: 12, outline: 'none' }} />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--c-line-strong)', fontStyle: 'italic' }}>Closed</span>
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
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--c-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)' }}>Time Off / Vacation</label>
        <button type="button" onClick={() => setShowForm(s => !s)}
          style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>
      {showForm && (
        <div style={{ background: 'var(--c-bg)', borderRadius: 8, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid var(--c-line)', borderRadius: 6, fontSize: 12, outline: 'none' }} />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid var(--c-line)', borderRadius: 6, fontSize: 12, outline: 'none' }} />
          </div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional) — e.g. Vacation"
            style={{ padding: '6px 8px', border: '1px solid var(--c-line)', borderRadius: 6, fontSize: 12, outline: 'none' }} />
          <button type="button" onClick={add} style={{ padding: '7px', borderRadius: 6, border: 'none', background: 'var(--c-primary)', color: 'var(--c-surface)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Save Time Off
          </button>
        </div>
      )}
      {timeOff.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--c-line-strong)' }}>No time off scheduled</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {timeOff.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: '#FFF7ED', borderRadius: 6, padding: '6px 10px' }}>
              <span>
                {new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                {t.start_date !== t.end_date && ` → ${new Date(t.end_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                {t.reason && <span style={{ color: 'var(--c-faint)' }}> · {t.reason}</span>}
              </span>
              <button type="button" onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderForm({ provider, shopId, onSave, onCancel }) {
  const features = useServiceFeatures();
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
    <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{provider?.id ? 'Edit Staff Member' : 'Add Staff Member'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Priya"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Title</label>
          <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Senior Stylist"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Phone (optional)</label>
        <input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit mobile"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>
          Buffer Time Between Appointments
          {!features.canConfigureBufferTime && <UpgradeChip requiredPlan="Pro" />}
        </label>
        <select
          value={form.buffer_minutes || 0}
          onChange={e => setForm(p => ({ ...p, buffer_minutes: Number(e.target.value) }))}
          disabled={!features.canConfigureBufferTime}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, background: features.canConfigureBufferTime ? 'var(--c-surface)' : 'var(--c-bg)', outline: 'none', cursor: features.canConfigureBufferTime ? 'pointer' : 'not-allowed', opacity: features.canConfigureBufferTime ? 1 : 0.65 }}>
          <option value={0}>No buffer — back-to-back bookings allowed</option>
          <option value={5}>5 minutes</option>
          <option value={10}>10 minutes</option>
          <option value={15}>15 minutes</option>
          <option value={20}>20 minutes</option>
          <option value={30}>30 minutes</option>
        </select>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--c-faint)' }}>
          {features.canConfigureBufferTime
            ? 'Extra time reserved after each appointment for cleanup/prep before the next one can be booked.'
            : `Upgrade to ${features.labelFor('serviceBufferTime')} to configure buffer time between bookings.`}
        </p>
      </div>

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 8 }}>
          Weekly Working Hours
          {!features.canConfigureProviderHours && <UpgradeChip requiredPlan="Pro" />}
        </label>
        {features.canConfigureProviderHours ? (
          <WorkingHoursEditor hours={form.working_hours} onChange={wh => setForm(p => ({ ...p, working_hours: wh }))} />
        ) : (
          <div style={{ padding: 12, background: 'var(--c-bg)', border: '1px dashed var(--c-line-strong)', borderRadius: 8, fontSize: 12, color: 'var(--c-muted)' }}>
            Per-staff working hours are on {features.labelFor('serviceProviderHours')}. All staff share the shop's default hours on your current plan.
          </div>
        )}
      </div>

      {provider?.id && <TimeOffManager providerId={provider.id} />}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--c-line)', background: 'var(--c-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--c-primary)', color: 'var(--c-surface)', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : (provider?.id ? 'Save Changes' : 'Add Staff Member')}
        </button>
      </div>
    </div>
  );
}

function ProviderCard({ provider, onEdit, onDelete, onToggle }) {
  const workingDays = Object.entries(provider.working_hours || {}).filter(([, v]) => v).length;
  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--c-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <User size={18} color="var(--c-primary)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-ink)' }}>{provider.name}</span>
          {!provider.active && <span style={{ fontSize: 10, color: 'var(--c-faint)', background: 'var(--c-line-soft)', padding: '1px 7px', borderRadius: 999 }}>Inactive</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
          {provider.title || 'Staff Member'} · Works {workingDays} day{workingDays !== 1 ? 's' : ''}/week
          {provider.buffer_minutes > 0 && ` · ${provider.buffer_minutes} min buffer`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onToggle(provider)} title={provider.active ? 'Deactivate' : 'Activate'}
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--c-line)', background: 'var(--c-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: provider.active ? 'var(--c-success)' : 'var(--c-faint)' }}>
          {provider.active ? '✓' : '✕'}
        </button>
        <button onClick={() => onEdit(provider)} title="Edit"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--c-line)', background: 'var(--c-bg)', color: 'var(--c-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Edit2 size={13} />
        </button>
        <button onClick={() => onDelete(provider.id)} title="Delete"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--c-danger-soft)', background: '#FFF5F5', color: 'var(--c-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    catch (_e) { toast.error('Failed to load staff'); }
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
        <p style={{ margin: 0, fontSize: 13, color: 'var(--c-muted)' }}>
          Add staff members customers can choose when booking. Each person can have their own working hours.
        </p>
        <button onClick={() => { setEditingProvider(null); setShowForm(true); }}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--c-primary)', color: 'var(--c-surface)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--c-faint)' }}>Loading…</div>
      ) : providers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--c-faint)' }}>
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
