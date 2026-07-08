import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Check, X, Clock, Calendar, Phone, User, ChevronLeft, ChevronRight, Scissors } from 'lucide-react';
import CompleteBillModal from './CompleteBillModal';
import { useServiceFeatures } from '../hooks/useServiceFeatures';
import FeatureUpgradePrompt, { UpgradeChip } from './FeatureUpgradePrompt';
import StaffManagement from './StaffManagement';

const SERVICE_CATEGORIES = [
  { id: 'hair',     label: '✂️ Hair',          color: '#8B5CF6' },
  { id: 'beauty',   label: '💄 Beauty',        color: '#EC4899' },
  { id: 'skincare', label: '🧴 Skincare',      color: '#10B981' },
  { id: 'nail',     label: '💅 Nails',         color: '#F59E0B' },
  { id: 'spa',      label: '🧖 Spa / Massage', color: '#3B82F6' },
  { id: 'bridal',   label: '👰 Bridal',        color: '#EF4444' },
  { id: 'mens',     label: '🪒 Men\'s Salon',  color: '#6366F1' },
  { id: 'general',  label: '🛎️ General',       color: '#64748B' },
];

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#F59E0B', bg: '#FEF3C7' },
  confirmed: { label: 'Confirmed', color: '#3B82F6', bg: '#DBEAFE' },
  completed: { label: 'Completed', color: '#10B981', bg: '#D1FAE5' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: '#FEE2E2' },
};

const EMPTY_SERVICE = { name: '', description: '', category: 'general', duration_minutes: 30, price: '', active: true };

function ServiceCard({ service, onEdit, onDelete, onToggle }) {
  const cat = SERVICE_CATEGORIES.find(c => c.id === service.category) || SERVICE_CATEGORIES[7];
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: cat.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        {cat.label.split(' ')[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{service.name}</span>
          <span style={{ fontSize: 11, color: cat.color, background: cat.color + '18', padding: '1px 7px', borderRadius: 999, fontWeight: 600 }}>{cat.label}</span>
          {!service.active && <span style={{ fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '1px 7px', borderRadius: 999 }}>Inactive</span>}
        </div>
        {service.description && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>{service.description}</p>}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>₹{Number(service.price).toLocaleString('en-IN')}</span>
          <span style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {service.duration_minutes} min</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onToggle(service)} title={service.active ? 'Deactivate' : 'Activate'}
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: service.active ? '#10B981' : '#94A3B8' }}>
          {service.active ? <Check size={14} /> : <X size={14} />}
        </button>
        <button onClick={() => onEdit(service)} title="Edit"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
          <Edit2 size={13} />
        </button>
        <button onClick={() => onDelete(service.id)} title="Delete"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function AppointmentRow({ appt, providers = [], onStatusChange, onCompleteWithBill }) {
  const st = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  const timeStr = appt.appointment_time ? appt.appointment_time.slice(0, 5) : '';
  const dateStr = appt.appointment_date ? new Date(appt.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
  const provider = appt.provider_id ? providers.find(p => p.id === appt.provider_id) : null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
      {/* Time */}
      <div style={{ textAlign: 'center', minWidth: 48, flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{timeStr}</div>
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{dateStr}</div>
      </div>
      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{appt.service_name}</span>
          {provider && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '1px 8px', borderRadius: 999 }}>
              💇 {provider.name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 3 }}><User size={11} />{appt.customer_name}</span>
          <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} />{appt.customer_phone}</span>
          <span style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{appt.duration_minutes} min</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>₹{Number(appt.service_price).toLocaleString('en-IN')}</span>
        </div>
        {appt.notes && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Note: {appt.notes}</div>}
      </div>
      {/* Status + Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 999 }}>{st.label}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {appt.status === 'pending' && (
            <>
              <button onClick={() => onStatusChange(appt.id, 'confirmed')}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer' }}>Confirm</button>
              <button onClick={() => onStatusChange(appt.id, 'cancelled')}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FFF5F5', color: '#EF4444', cursor: 'pointer' }}>✕</button>
            </>
          )}
          {appt.status === 'confirmed' && (
            <>
              <button onClick={() => onCompleteWithBill(appt)}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#10B981', color: '#fff', cursor: 'pointer' }}>✓ Done</button>
              <button onClick={() => onStatusChange(appt.id, 'cancelled')}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FFF5F5', color: '#EF4444', cursor: 'pointer' }}>✕</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceForm({ service, shopId, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_SERVICE, ...service });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Service name is required');
    if (!form.price || isNaN(Number(form.price))) return toast.error('Enter a valid price');
    setSaving(true);
    try {
      await api.saveService(shopId, form);
      toast.success(service?.id ? 'Service updated!' : 'Service added!');
      onSave();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const field = (label, key, type = 'text', extra = {}) => (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{label}</label>
      <input type={type} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        {...extra} />
    </div>
  );

  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{service?.id ? 'Edit Service' : 'Add New Service'}</div>
      {field('Service Name *', 'name', 'text', { placeholder: 'e.g. Haircut & Styling' })}
      {field('Description', 'description', 'text', { placeholder: 'Optional short description' })}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Category</label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
            {SERVICE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Duration (minutes)</label>
          <select value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
            {[15,20,30,45,60,90,120,150,180].map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
      </div>
      {field('Price (₹) *', 'price', 'number', { placeholder: '0', min: '0', step: '1' })}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : (service?.id ? 'Save Changes' : 'Add Service')}
        </button>
      </div>
    </div>
  );
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00',
];

const fmt12 = (t) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Lets a shop owner/staff manually add a walk-in or phone booking —
// previously the ONLY way an appointment could exist was through the
// customer-facing widget, which doesn't reflect how real service
// businesses actually operate (phone calls, walk-ins are extremely
// common, not just online self-service). Reuses the exact same
// conflict-checking (api.bookAppointment / api.getBookedSlots) as the
// consumer widget, so a walk-in can never double-book a slot either.
function NewWalkInBookingModal({ shopId, services, providers, onClose, onSaved }) {
  // The parent already calls this hook, but sub-components mount their
  // own tree so we call it again here — cheap useMemo, no extra fetches.
  const features = useServiceFeatures();
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [providerId, setProviderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [bookedRanges, setBookedRanges] = useState([]);
  const [dayAvailability, setDayAvailability] = useState({ isOpen: true, workingStart: null, workingEnd: null, onTimeOff: false });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedService = services.find(s => s.id === serviceId);
  const selectedProvider = providers.find(p => p.id === providerId);

  useEffect(() => {
    if (providerId) {
      api.getProviderAvailability(providerId, date)
        .then(avail => { setDayAvailability(avail); setBookedRanges(avail.bookedRanges || []); })
        .catch(() => setBookedRanges([]));
    } else {
      setDayAvailability({ isOpen: true, workingStart: null, workingEnd: null, onTimeOff: false });
      api.getBookedSlots(shopId, date).then(setBookedRanges).catch(() => setBookedRanges([]));
    }
  }, [shopId, date, providerId]);

  const isSlotTaken = (t) => {
    if (!selectedService) return false;
    const [h, m] = t.split(':').map(Number);
    const start = h * 60 + m;
    const end = start + (Number(selectedService.duration_minutes) || 30);
    if (providerId) {
      if (!dayAvailability.isOpen) return true;
      const [wsH, wsM] = (dayAvailability.workingStart || '00:00').split(':').map(Number);
      const [weH, weM] = (dayAvailability.workingEnd || '23:59').split(':').map(Number);
      if (start < wsH * 60 + wsM || end > weH * 60 + weM) return true;
    }
    return bookedRanges.some(r => start < r.end && end > r.start);
  };

  const save = async () => {
    if (!selectedService) return toast.error('Select a service');
    if (!customerName.trim()) return toast.error('Enter customer name');
    if (!/^\d{10}$/.test(customerPhone)) return toast.error('Enter a valid 10-digit phone number');
    if (!time) return toast.error('Select a time');
    setSaving(true);
    try {
      await api.bookAppointment(shopId, {
        service_id: selectedService.id,
        service_name: selectedService.name,
        service_price: selectedService.price,
        duration_minutes: selectedService.duration_minutes,
        customer_name: customerName,
        customer_phone: customerPhone,
        appointment_date: date,
        appointment_time: time + ':00',
        notes: notes || null,
        booked_via: 'walk_in',
        provider_id: providerId || null,
        status: 'confirmed', // owner already knows this is happening — skip the pending review step
      });
      toast.success('Booking added!');
      onSaved();
    } catch (e) {
      toast.error(e.message || 'Failed to add booking');
    }
    setSaving(false);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A', marginBottom: 18 }}>+ New Walk-in / Phone Booking</div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Service *</label>
        <select value={serviceId} onChange={e => setServiceId(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none', marginBottom: 14 }}>
          {services.length === 0 && <option value="">No services yet — add one first</option>}
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name} — ₹{Number(s.price).toLocaleString('en-IN')} ({s.duration_minutes} min)</option>
          ))}
        </select>

        {providers.length > 0 && features.canAssignStaffPerService && (
          <>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Staff Member</label>
            <select value={providerId} onChange={e => { setProviderId(e.target.value); setTime(''); }}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none', marginBottom: 14 }}>
              <option value="">No preference / single resource</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.title ? ` — ${p.title}` : ''}</option>
              ))}
            </select>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Customer Name *</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full name"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Mobile *</label>
            <input value={customerPhone} maxLength={10} onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))} placeholder="10-digit"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Date *</label>
        <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Time *</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14, maxHeight: 160, overflow: 'auto' }}>
          {TIME_SLOTS.map(t => {
            const taken = isSlotTaken(t);
            return (
              <button key={t} type="button" disabled={taken} onClick={() => !taken && setTime(t)}
                style={{
                  padding: '7px 4px', borderRadius: 6, border: '1px solid', fontSize: 11.5, fontWeight: 600,
                  cursor: taken ? 'not-allowed' : 'pointer',
                  borderColor: taken ? '#F1F5F9' : (time === t ? '#4F46E5' : '#E2E8F0'),
                  background: taken ? '#F8FAFC' : (time === t ? '#4F46E5' : '#fff'),
                  color: taken ? '#CBD5E1' : (time === t ? '#fff' : '#475569'),
                  textDecoration: taken ? 'line-through' : 'none',
                }}>
                {fmt12(t)}
              </button>
            );
          })}
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Notes (optional)</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requests…"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving || services.length === 0}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: saving ? '#94A3B8' : '#4F46E5', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Saving…' : '+ Add Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DesktopBookings({ shopId, shopName, initialTab = 'appointments' }) {
  const features = useServiceFeatures();
  const [tab, setTab] = useState(initialTab); // 'appointments' | 'services' | 'staff'
  // If the parent switches the top-level sidebar entry (e.g. Services →
  // Staff), keep the internal sub-tab in sync. useState only reads the
  // initial value once, so without this, clicking a different sidebar
  // entry would land back on whatever sub-tab was last selected.
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState('today'); // 'today' | 'upcoming' | 'all'
  const [completingAppointment, setCompletingAppointment] = useState(null);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [providers, setProviders] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [svcs, appts, provs] = await Promise.all([
        api.getShopServices(shopId),
        api.getAppointments(shopId),
        api.getProviders(shopId).catch(() => []),
      ]);
      setServices(svcs);
      setAppointments(appts);
      setProviders(provs || []);
    } catch (e) { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateAppointmentStatus(id, status);
      toast.success(`Appointment ${status}!`);
      loadData();
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteService = async (id) => {
    if (!confirm('Delete this service?')) return;
    try { await api.deleteService(id); toast.success('Service deleted'); loadData(); }
    catch (e) { toast.error(e.message); }
  };

  const handleToggleService = async (service) => {
    try {
      await api.toggleServiceActive(service.id, !service.active);
      toast.success(service.active ? 'Service deactivated' : 'Service activated');
      loadData();
    } catch (e) { toast.error(e.message); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const filteredAppts = appointments.filter(a => {
    if (viewMode === 'today') return a.appointment_date === today;
    if (viewMode === 'upcoming') return a.appointment_date >= today && a.status !== 'completed' && a.status !== 'cancelled';
    return true;
  }).filter(a => !filterStatus || a.status === filterStatus);

  const counts = {
    today: appointments.filter(a => a.appointment_date === today).length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Scissors size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Service Bookings</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Manage appointments and your services catalogue</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: "Today's Appts", value: counts.today, color: '#4F46E5', bg: '#EEF2FF' },
          { label: 'Pending', value: counts.pending, color: '#F59E0B', bg: '#FEF3C7' },
          { label: 'Confirmed', value: counts.confirmed, color: '#10B981', bg: '#D1FAE5' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 18px', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: s.color + 'aa' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {[
          { id: 'appointments', label: '📅 Appointments' },
          { id: 'services', label: '🛎️ Services' },
          { id: 'staff', label: '👤 Staff' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? '#4F46E5' : '#64748B', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── APPOINTMENTS TAB ── */}
      {tab === 'appointments' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { id: 'today', label: "Today" },
              { id: 'upcoming', label: "Upcoming" },
              { id: 'all', label: "All" },
            ].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderColor: viewMode === v.id ? '#4F46E5' : '#E2E8F0', background: viewMode === v.id ? '#EEF2FF' : '#fff', color: viewMode === v.id ? '#4F46E5' : '#64748B' }}>
                {v.label}
              </button>
            ))}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 600, color: '#475569', background: '#fff', cursor: 'pointer', outline: 'none' }}>
              <option value="">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => setShowWalkInModal(true)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              <Plus size={14} /> New Booking
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Loading appointments…</div>
          ) : filteredAppts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
              <Calendar size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No appointments found</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>Share your booking link with customers to start receiving bookings</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredAppts.map(a => (
                <AppointmentRow key={a.id} appt={a} providers={providers} onStatusChange={handleStatusChange} onCompleteWithBill={setCompletingAppointment} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SERVICES TAB ── */}
      {tab === 'services' && (
        <div>
          {/* Plan-cap enforcement: Starter shops get 3 services max.
              Rather than surprise them by silently failing at insert,
              we tell them upfront and offer the upgrade path. Pro
              and above return -1 (unlimited) → banner never renders. */}
          {!features.canAddMoreServices(services.length) && (
            <div style={{ marginBottom: 16 }}>
              <FeatureUpgradePrompt
                title={`Service limit reached (${features.maxServices} on your current plan)`}
                body="Upgrade to Pro for unlimited services, per-staff assignment, buffer time, and customer self-service links."
                requiredPlan={features.labelFor('bookings')}
                hint={`You have ${services.length} services — add more by upgrading.`}
              />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, alignItems: 'center', gap: 8 }}>
            {features.maxServices > 0 && features.maxServices !== -1 && (
              <span style={{ fontSize: 11, color: '#64748B' }}>
                {services.length} / {features.maxServices} services
              </span>
            )}
            <button
              onClick={() => {
                if (!features.canAddMoreServices(services.length)) {
                  toast.info('Service limit reached — upgrade to add more.');
                  return;
                }
                setEditingService(null); setShowServiceForm(true);
              }}
              disabled={!features.canAddMoreServices(services.length)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none',
                background: features.canAddMoreServices(services.length) ? '#4F46E5' : '#94A3B8',
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: features.canAddMoreServices(services.length) ? 'pointer' : 'not-allowed',
                opacity: features.canAddMoreServices(services.length) ? 1 : 0.7,
              }}>
              <Plus size={15} /> Add Service
            </button>
          </div>

          {showServiceForm && (
            <div style={{ marginBottom: 16 }}>
              <ServiceForm
                service={editingService}
                shopId={shopId}
                onSave={() => { setShowServiceForm(false); setEditingService(null); loadData(); }}
                onCancel={() => { setShowServiceForm(false); setEditingService(null); }}
              />
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Loading services…</div>
          ) : services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
              <Scissors size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No services added yet</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>Add your services so customers can book appointments</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {services.map(s => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onEdit={svc => { setEditingService(svc); setShowServiceForm(true); }}
                  onDelete={handleDeleteService}
                  onToggle={handleToggleService}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'staff' && (
        features.canAssignStaffPerService
          ? <StaffManagement shopId={shopId} />
          : <FeatureUpgradePrompt
              title="Multi-staff scheduling"
              body="Assign services to individual staff members, track per-staff working hours, and let customers pick their preferred provider when they book."
              requiredPlan={features.labelFor('serviceStaffAssignment')}
              hint="Great for salons with multiple stylists, clinics with multiple doctors, or gyms with several trainers."
            />
      )}

      {completingAppointment && (
        <CompleteBillModal
          appointment={completingAppointment}
          shopId={shopId}
          onClose={() => setCompletingAppointment(null)}
          onDone={() => { setCompletingAppointment(null); loadData(); }}
        />
      )}

      {showWalkInModal && (
        <NewWalkInBookingModal
          shopId={shopId}
          services={services.filter(s => s.active)}
          providers={providers.filter(p => p.active)}
          onClose={() => setShowWalkInModal(false)}
          onSaved={() => { setShowWalkInModal(false); loadData(); }}
        />
      )}
    </div>
  );
}
