import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Calendar, Clock, AlertTriangle } from 'lucide-react';

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00',
];

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const getNext14Days = () => {
  const days = [];
  for (let i = 0; i < 14; i++) {
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

const STATUS_CONFIG = {
  pending:   { label: 'Pending Confirmation', color: 'var(--c-warning)', bg: 'var(--c-warning-soft)' },
  confirmed: { label: 'Confirmed',            color: 'var(--c-info)', bg: '#DBEAFE' },
  completed: { label: 'Completed',            color: 'var(--c-success)', bg: 'var(--c-success-soft)' },
  cancelled: { label: 'Cancelled',            color: 'var(--c-danger)', bg: 'var(--c-danger-soft)' },
};

export default function ManageBooking() {
  const { token } = useParams();
  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState('view'); // 'view' | 'reschedule'
  const [newDate, setNewDate] = useState(getNext14Days()[0].iso);
  const [newTime, setNewTime] = useState('');
  const [bookedRanges, setBookedRanges] = useState([]);
  const [dayAvailability, setDayAvailability] = useState({ isOpen: true, workingStart: null, workingEnd: null, onTimeOff: false });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAppt = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAppointmentByToken(token);
      if (!data) { setNotFound(true); }
      else { setAppt(data); }
    } catch (_e) {
      setNotFound(true);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadAppt(); }, [loadAppt]);

  useEffect(() => {
    if (mode !== 'reschedule' || !appt) return;
    setLoadingSlots(true);
    if (appt.provider_id) {
      api.getProviderAvailability(appt.provider_id, newDate)
        .then(avail => { setDayAvailability(avail); setBookedRanges(avail.bookedRanges || []); })
        .finally(() => setLoadingSlots(false));
    } else {
      setDayAvailability({ isOpen: true, workingStart: null, workingEnd: null, onTimeOff: false });
      api.getBookedSlots(appt.shop_id, newDate).then(setBookedRanges).finally(() => setLoadingSlots(false));
    }
  }, [mode, appt, newDate]);

  const isSlotTaken = (t) => {
    if (!appt) return false;
    const [h, m] = t.split(':').map(Number);
    const start = h * 60 + m;
    const end = start + (Number(appt.duration_minutes) || 30);
    if (appt.provider_id) {
      if (!dayAvailability.isOpen) return true;
      const [wsH, wsM] = (dayAvailability.workingStart || '00:00').split(':').map(Number);
      const [weH, weM] = (dayAvailability.workingEnd || '23:59').split(':').map(Number);
      if (start < wsH * 60 + wsM || end > weH * 60 + weM) return true;
    }
    return bookedRanges.some(r => start < r.end && end > r.start);
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this appointment? This cannot be undone.')) return;
    try {
      const updated = await api.cancelAppointmentByToken(token);
      setAppt(updated);
      toast.success('Booking cancelled');
    } catch (e) {
      toast.error(e.message || 'Could not cancel this booking');
    }
  };

  const handleReschedule = async () => {
    if (!newTime) return toast.error('Please select a time');
    setSaving(true);
    try {
      const updated = await api.rescheduleAppointmentByToken(token, newDate, newTime + ':00');
      setAppt(updated);
      setMode('view');
      toast.success('Booking rescheduled! The shop will confirm your new time.');
    } catch (e) {
      toast.error(e.message || 'Could not reschedule this booking');
    }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-faint)' }}>Loading your booking…</div>;
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24 }}>
        <AlertTriangle size={40} color="var(--c-warning)" />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-ink)' }}>Booking not found</div>
        <div style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center' }}>This link may be incorrect or the booking may no longer exist.</div>
      </div>
    );
  }

  const st = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  const canModify = appt.status !== 'completed' && appt.status !== 'cancelled';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}>
      <ToastContainer theme="light" position="top-center" />
      <div style={{ background: 'var(--c-surface)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        {mode === 'view' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-faint)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Your Booking</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-ink)', marginTop: 2 }}>{appt.service_name}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '4px 10px', borderRadius: 999, flexShrink: 0 }}>{st.label}</span>
            </div>

            <div style={{ background: 'var(--c-bg)', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--c-ink-2)' }}>
                <Calendar size={14} color="var(--c-faint)" />
                {new Date(appt.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--c-ink-2)' }}>
                <Clock size={14} color="var(--c-faint)" />
                {fmt12(appt.appointment_time?.slice(0, 5))} · {appt.duration_minutes} min
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-success)' }}>₹{Number(appt.service_price).toLocaleString('en-IN')}</div>
            </div>

            {canModify ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setMode('reschedule'); setNewTime(''); }}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', color: 'var(--c-ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  📅 Reschedule
                </button>
                <button onClick={handleCancel}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--c-danger-border)', background: '#FFF5F5', color: 'var(--c-danger)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  ✕ Cancel Booking
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--c-bg)', borderRadius: 10, fontSize: 12, color: 'var(--c-faint)' }}>
                {appt.status === 'completed' ? 'This appointment has already been completed.' : 'This booking has been cancelled.'}
              </div>
            )}
          </>
        )}

        {mode === 'reschedule' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-ink)' }}>Reschedule</div>
              <button onClick={() => setMode('view')} style={{ background: 'none', border: 'none', color: 'var(--c-faint)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            </div>
            <div style={{ background: 'var(--c-primary-soft)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 700, color: 'var(--c-primary)' }}>
              {appt.service_name}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 10 }}>Select New Date</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {getNext14Days().map(d => (
                  <button key={d.iso} onClick={() => { setNewDate(d.iso); setNewTime(''); }}
                    style={{ flexShrink: 0, width: 52, padding: '8px 4px', borderRadius: 10, border: '1px solid', cursor: 'pointer', textAlign: 'center', borderColor: newDate === d.iso ? 'var(--c-primary)' : 'var(--c-line)', background: newDate === d.iso ? 'var(--c-primary)' : 'var(--c-surface)', color: newDate === d.iso ? 'var(--c-surface)' : 'var(--c-ink-2)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{d.day}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>{d.date}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{d.month}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 10 }}>
                Select Time {loadingSlots && <span style={{ color: 'var(--c-faint)', fontWeight: 400 }}>(checking availability…)</span>}
              </div>
              {appt.provider_id && dayAvailability.onTimeOff ? (
                <div style={{ textAlign: 'center', padding: 20, background: '#FFF7ED', borderRadius: 10, fontSize: 13, color: '#C2410C' }}>Staff is on leave this day</div>
              ) : appt.provider_id && !dayAvailability.isOpen ? (
                <div style={{ textAlign: 'center', padding: 20, background: 'var(--c-bg)', borderRadius: 10, fontSize: 13, color: 'var(--c-faint)' }}>Not available this day</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {TIME_SLOTS.map(t => {
                    const taken = isSlotTaken(t);
                    return (
                      <button key={t} disabled={taken} onClick={() => !taken && setNewTime(t)}
                        style={{
                          padding: '9px 4px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600,
                          cursor: taken ? 'not-allowed' : 'pointer',
                          borderColor: taken ? 'var(--c-line-soft)' : (newTime === t ? 'var(--c-primary)' : 'var(--c-line)'),
                          background: taken ? 'var(--c-bg)' : (newTime === t ? 'var(--c-primary)' : 'var(--c-surface)'),
                          color: taken ? 'var(--c-line-strong)' : (newTime === t ? 'var(--c-surface)' : 'var(--c-ink-2)'),
                          textDecoration: taken ? 'line-through' : 'none',
                        }}>
                        {fmt12(t)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={handleReschedule} disabled={saving || !newTime}
              style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: (saving || !newTime) ? 'var(--c-faint)' : 'var(--c-primary)', color: 'var(--c-surface)', fontWeight: 800, fontSize: 14, cursor: (saving || !newTime) ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Confirm New Time'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
