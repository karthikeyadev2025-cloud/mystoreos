import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Check, X, Clock, Calendar, Phone, User, ChevronLeft, ChevronRight, Scissors } from 'lucide-react';
import CompleteBillModal from './CompleteBillModal';

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

function AppointmentRow({ appt, onStatusChange, onCompleteWithBill }) {
  const st = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  const timeStr = appt.appointment_time ? appt.appointment_time.slice(0, 5) : '';
  const dateStr = appt.appointment_date ? new Date(appt.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
      {/* Time */}
      <div style={{ textAlign: 'center', minWidth: 48, flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{timeStr}</div>
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{dateStr}</div>
      </div>
      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{appt.service_name}</div>
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

export default function DesktopBookings({ shopId, shopName }) {
  const [tab, setTab] = useState('appointments'); // 'appointments' | 'services'
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState('today'); // 'today' | 'upcoming' | 'all'
  const [completingAppointment, setCompletingAppointment] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [svcs, appts] = await Promise.all([
        api.getShopServices(shopId),
        api.getAppointments(shopId),
      ]);
      setServices(svcs);
      setAppointments(appts);
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
                <AppointmentRow key={a.id} appt={a} onStatusChange={handleStatusChange} onCompleteWithBill={setCompletingAppointment} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SERVICES TAB ── */}
      {tab === 'services' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => { setEditingService(null); setShowServiceForm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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

      {completingAppointment && (
        <CompleteBillModal
          appointment={completingAppointment}
          shopId={shopId}
          onClose={() => setCompletingAppointment(null)}
          onDone={() => { setCompletingAppointment(null); loadData(); }}
        />
      )}
    </div>
  );
}
