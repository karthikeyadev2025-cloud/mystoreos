import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { Calendar, Clock, TrendingUp, Users, Plus, ChevronRight, Scissors } from 'lucide-react';
import CompleteBillModal from './CompleteBillModal';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'var(--c-warning)', bg: 'var(--c-warning-soft)' },
  confirmed: { label: 'Confirmed', color: 'var(--c-info)', bg: '#DBEAFE' },
  completed: { label: 'Completed', color: 'var(--c-success)', bg: 'var(--c-success-soft)' },
  cancelled: { label: 'Cancelled', color: 'var(--c-danger)', bg: 'var(--c-danger-soft)' },
};

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

function AppointmentMiniRow({ appt, onStatusChange, onCompleteWithBill }) {
  const st = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--c-surface)', borderRadius: 10, border: '1px solid var(--c-line)' }}>
      <div style={{ textAlign: 'center', minWidth: 56, flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-ink)' }}>{fmt12(appt.appointment_time?.slice(0, 5))}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.service_name}</div>
        <div style={{ fontSize: 12, color: 'var(--c-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{appt.customer_name}</span>
          <span style={{ color: 'var(--c-line-strong)' }}>·</span>
          <span>₹{Number(appt.service_price).toLocaleString('en-IN')}</span>
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 9px', borderRadius: 999, flexShrink: 0 }}>{st.label}</span>
      {appt.status === 'pending' && (
        <button onClick={() => onStatusChange(appt.id, 'confirmed')}
          style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--c-info)', color: 'var(--c-surface)', cursor: 'pointer' }}>
          Confirm
        </button>
      )}
      {appt.status === 'confirmed' && (
        <button onClick={() => onCompleteWithBill(appt)}
          style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--c-success)', color: 'var(--c-surface)', cursor: 'pointer' }}>
          ✓ Done
        </button>
      )}
    </div>
  );
}

export default function ServiceBusinessHome({ shopId, shopName, orders = [], setActiveTab, onOrderCreated }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingAppointment, setCompletingAppointment] = useState(null);

  const loadAppointments = useCallback(async () => {
    try {
      const data = await api.getAppointments(shopId);
      setAppointments(data);
    } catch (_e) { /* stay on empty state, don't crash the home screen */ }
    setLoading(false);
  }, [shopId]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const today = new Date().toISOString().slice(0, 10);

  const todaysAppointments = useMemo(
    () => appointments.filter(a => a.appointment_date === today),
    [appointments, today]
  );

  const upcomingAppointments = useMemo(
    () => appointments
      .filter(a => a.appointment_date > today && a.status !== 'cancelled' && a.status !== 'completed')
      .slice(0, 5),
    [appointments, today]
  );

  // Revenue is computed from real completed ORDERS (actual money collected
  // via the billing flow), never from appointments — an appointment being
  // "completed" doesn't necessarily mean a bill was generated for it, and
  // a shop might also sell retail add-on products alongside services. This
  // matches the same completed-order revenue logic used elsewhere in the
  // dashboard (Day Book, Reports) so the number here is never inconsistent
  // with what the rest of the app shows.
  const todaysRevenue = useMemo(() => {
    return orders
      .filter(o => o.status === 'Accepted' && !(o.userId || '').startsWith('estimate') && !(o.userId || '').startsWith('challan'))
      .filter(o => (o.date || o.createdAt || '').startsWith(today))
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [orders, today]);

  const pendingCount = todaysAppointments.filter(a => a.status === 'pending').length;
  const completedTodayCount = todaysAppointments.filter(a => a.status === 'completed').length;

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateAppointmentStatus(id, status);
      loadAppointments();
    } catch (_e) { /* silent — this is a quick-action row, full error handling lives in the Bookings tab */ }
  };

  return (
    <div style={{ padding: '24px', maxWidth: 920, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--c-ink)' }}>
          Welcome back{shopName ? `, ${shopName}` : ''} 👋
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--c-muted)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stat cards — appointment-first, not retail-first */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: "Today's Revenue", value: `₹${todaysRevenue.toLocaleString('en-IN')}`, color: 'var(--c-success)', bg: 'var(--c-success-soft)', icon: TrendingUp },
          { label: "Today's Appointments", value: todaysAppointments.length, color: 'var(--c-primary)', bg: 'var(--c-primary-soft)', icon: Calendar },
          { label: 'Pending Confirmation', value: pendingCount, color: 'var(--c-warning)', bg: 'var(--c-warning-soft)', icon: Clock },
          { label: 'Completed Today', value: completedTodayCount, color: '#8B5CF6', bg: '#F3E8FF', icon: Users },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${s.color}22` }}>
            <s.icon size={16} color={s.color} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: s.color + 'aa' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('bookings')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,var(--c-primary-light))', color: 'var(--c-surface)', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 3px 10px rgba(139,92,246,0.3)' }}>
          <Calendar size={15} /> View All Bookings
        </button>
        <button onClick={() => setActiveTab('bookings')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', color: 'var(--c-ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Scissors size={15} /> Manage Services
        </button>
        <button onClick={() => setActiveTab('bills')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', color: 'var(--c-ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> Create Bill
        </button>
      </div>

      {/* Today's appointments */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--c-ink)' }}>Today's Appointments</h3>
          <button onClick={() => setActiveTab('bookings')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--c-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            View all <ChevronRight size={13} />
          </button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--c-faint)', fontSize: 13 }}>Loading…</div>
        ) : todaysAppointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, background: 'var(--c-bg)', borderRadius: 12, border: '1px dashed var(--c-line)' }}>
            <Calendar size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--c-faint)', fontWeight: 600 }}>No appointments today</div>
            <div style={{ fontSize: 12, color: 'var(--c-line-strong)', marginTop: 4 }}>Share your booking link with customers to get started</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todaysAppointments.map(a => <AppointmentMiniRow key={a.id} appt={a} onStatusChange={handleStatusChange} onCompleteWithBill={setCompletingAppointment} />)}
          </div>
        )}
      </div>

      {/* Upcoming appointments preview */}
      {upcomingAppointments.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--c-ink)' }}>Upcoming</h3>
            <button onClick={() => setActiveTab('bookings')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--c-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              View all <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcomingAppointments.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--c-bg)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', minWidth: 70 }}>
                  {new Date(a.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--c-ink)' }}>{a.service_name}</div>
                <div style={{ fontSize: 12, color: 'var(--c-faint)' }}>{a.customer_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completingAppointment && (
        <CompleteBillModal
          appointment={completingAppointment}
          onClose={() => setCompletingAppointment(null)}
          onDone={() => {
            setCompletingAppointment(null);
            loadAppointments();
            if (onOrderCreated) onOrderCreated(); // refresh parent's `orders` so Today's Revenue updates immediately
          }}
        />
      )}
    </div>
  );
}
