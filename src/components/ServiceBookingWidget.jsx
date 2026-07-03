import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Clock, Calendar, ChevronRight, CheckCircle, Scissors } from 'lucide-react';

const SERVICE_CATEGORIES = [
  { id: 'hair',     label: '✂️ Hair' },
  { id: 'beauty',   label: '💄 Beauty' },
  { id: 'skincare', label: '🧴 Skincare' },
  { id: 'nail',     label: '💅 Nails' },
  { id: 'spa',      label: '🧖 Spa' },
  { id: 'bridal',   label: '👰 Bridal' },
  { id: 'mens',     label: '🪒 Men\'s' },
  { id: 'general',  label: '🛎️ General' },
];

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

const getNext7Days = () => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      date: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
    });
  }
  return days;
};

export default function ServiceBookingWidget({ shopId, shopName, customerPhone, customerName }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1=pick service, 2=pick date/time, 3=confirm, 4=done
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getNext7Days()[0].iso);
  const [selectedTime, setSelectedTime] = useState('');
  const [form, setForm] = useState({ name: customerName || '', phone: customerPhone || '', notes: '' });
  const [booking, setBooking] = useState(false);
  const [confirmedAppt, setConfirmedAppt] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    api.getShopServices(shopId).then(svcs => {
      setServices(svcs.filter(s => s.active));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [shopId]);

  const days = getNext7Days();
  const usedCategories = [...new Set(services.map(s => s.category))];
  const filteredServices = categoryFilter === 'all' ? services : services.filter(s => s.category === categoryFilter);

  const handleBook = async () => {
    if (!form.name.trim()) return toast.error('Please enter your name');
    if (!form.phone.match(/^\d{10}$/)) return toast.error('Enter a valid 10-digit phone number');
    if (!selectedTime) return toast.error('Please select a time slot');
    setBooking(true);
    try {
      const appt = await api.bookAppointment(shopId, {
        service_id: selectedService.id,
        service_name: selectedService.name,
        service_price: selectedService.price,
        duration_minutes: selectedService.duration_minutes,
        customer_name: form.name,
        customer_phone: form.phone,
        appointment_date: selectedDate,
        appointment_time: selectedTime + ':00',
        notes: form.notes,
        booked_via: 'consumer_portal',
      });
      setConfirmedAppt(appt);
      setStep(4);
      toast.success('Appointment booked!');
    } catch (e) {
      toast.error(e.message || 'Booking failed. Please try again.');
    }
    setBooking(false);
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>✂️</div>
      Loading services…
    </div>
  );

  if (services.length === 0) return null; // No services — don't show the widget

  // ── STEP 4: Confirmed ─────────────────────────────────────────────────
  if (step === 4) {
    const dateDisplay = confirmedAppt?.appointment_date
      ? new Date(confirmedAppt.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
      : selectedDate;
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle size={32} color="#10B981" />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Appointment Booked!</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748B' }}>We'll confirm your appointment shortly</p>
        <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, textAlign: 'left', marginBottom: 20, border: '1px solid #E2E8F0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', marginBottom: 10 }}>{selectedService?.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#475569' }}>
            <div>📅 {dateDisplay}</div>
            <div>⏰ {fmt12(selectedTime)}</div>
            <div>⏱️ {selectedService?.duration_minutes} min</div>
            <div>💰 ₹{Number(selectedService?.price).toLocaleString('en-IN')}</div>
          </div>
        </div>
        <button onClick={() => { setStep(1); setSelectedService(null); setSelectedTime(''); setConfirmedAppt(null); }}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Book Another Appointment
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: 6, padding: '16px 16px 0', marginBottom: 16 }}>
        {['Service', 'Date & Time', 'Confirm'].map((label, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, cursor: i < step - 1 ? 'pointer' : 'default' }}
            onClick={() => { if (i < step - 1) setStep(i + 1); }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: step > i + 1 ? '#10B981' : step === i + 1 ? '#4F46E5' : '#E2E8F0', color: step >= i + 1 ? '#fff' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: step === i + 1 ? '#4F46E5' : '#94A3B8', whiteSpace: 'nowrap' }}>{label}</span>
            {i < 2 && <div style={{ flex: 1, height: 1, background: step > i + 1 ? '#10B981' : '#E2E8F0' }} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Pick Service ─────────────────────────────────────────── */}
      {step === 1 && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Category filter */}
          {usedCategories.length > 1 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
              <button onClick={() => setCategoryFilter('all')}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 999, border: '1px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderColor: categoryFilter === 'all' ? '#4F46E5' : '#E2E8F0', background: categoryFilter === 'all' ? '#EEF2FF' : '#fff', color: categoryFilter === 'all' ? '#4F46E5' : '#64748B' }}>
                All
              </button>
              {SERVICE_CATEGORIES.filter(c => usedCategories.includes(c.id)).map(c => (
                <button key={c.id} onClick={() => setCategoryFilter(c.id)}
                  style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 999, border: '1px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderColor: categoryFilter === c.id ? '#4F46E5' : '#E2E8F0', background: categoryFilter === c.id ? '#EEF2FF' : '#fff', color: categoryFilter === c.id ? '#4F46E5' : '#64748B' }}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredServices.map(svc => (
              <button key={svc.id} onClick={() => { setSelectedService(svc); setStep(2); }}
                style={{ width: '100%', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {(SERVICE_CATEGORIES.find(c => c.id === svc.category) || SERVICE_CATEGORIES[7]).label.split(' ')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', marginBottom: 2 }}>{svc.name}</div>
                  {svc.description && <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.description}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981' }}>₹{Number(svc.price).toLocaleString('en-IN')}</span>
                    <span style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {svc.duration_minutes} min</span>
                  </div>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Date & Time ──────────────────────────────────────────── */}
      {step === 2 && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Selected service summary */}
          <div style={{ background: '#EEF2FF', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#4F46E5' }}>{selectedService?.name}</div>
              <div style={{ fontSize: 12, color: '#6366F1' }}>₹{Number(selectedService?.price).toLocaleString('en-IN')} · {selectedService?.duration_minutes} min</div>
            </div>
            <button onClick={() => setStep(1)} style={{ fontSize: 11, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Change</button>
          </div>

          {/* Date picker */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Select Date</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {days.map(d => (
                <button key={d.iso} onClick={() => setSelectedDate(d.iso)}
                  style={{ flexShrink: 0, width: 52, padding: '8px 4px', borderRadius: 10, border: '1px solid', cursor: 'pointer', textAlign: 'center', transition: 'all .15s', borderColor: selectedDate === d.iso ? '#4F46E5' : '#E2E8F0', background: selectedDate === d.iso ? '#4F46E5' : '#fff', color: selectedDate === d.iso ? '#fff' : '#475569' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{d.day}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>{d.date}</div>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>{d.month}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time slots */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Select Time</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TIME_SLOTS.map(t => (
                <button key={t} onClick={() => setSelectedTime(t)}
                  style={{ padding: '9px 4px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .1s', borderColor: selectedTime === t ? '#4F46E5' : '#E2E8F0', background: selectedTime === t ? '#4F46E5' : '#fff', color: selectedTime === t ? '#fff' : '#475569' }}>
                  {fmt12(t)}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => { if (!selectedTime) return toast.error('Please select a time'); setStep(3); }}
            style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            Continue →
          </button>
        </div>
      )}

      {/* ── STEP 3: Confirm & Book ───────────────────────────────────────── */}
      {step === 3 && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Summary */}
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #E2E8F0' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', marginBottom: 10 }}>{selectedService?.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#475569' }}>
              <div>📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <div>⏰ {fmt12(selectedTime)}</div>
              <div>⏱️ {selectedService?.duration_minutes} min</div>
              <div style={{ fontWeight: 700, color: '#10B981' }}>💰 ₹{Number(selectedService?.price).toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Customer details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Your Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Mobile Number *</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit mobile"
                type="tel" maxLength={10}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Special Requests (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any preferences or special requests…" rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#475569' }}>← Back</button>
            <button onClick={handleBook} disabled={booking}
              style={{ flex: 1, padding: 13, borderRadius: 10, border: 'none', background: booking ? '#94A3B8' : 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: booking ? 'wait' : 'pointer' }}>
              {booking ? 'Booking…' : '✓ Confirm Appointment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
