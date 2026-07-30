import { useState } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';

// Shared "Complete & Bill" confirmation modal. Closes the loop between
// "the appointment happened" and "money was actually collected" — see
// api.completeAppointmentWithBill for the full reasoning. Used from both
// the Bookings tab (DesktopBookings.jsx) and the Dashboard quick-actions
// (ServiceBusinessHome.jsx) so the workflow is identical everywhere a
// shop owner can mark an appointment complete.
export default function CompleteBillModal({ appointment, onClose, onDone }) {
  const { user } = useAuth();
  // Was defaulting to service_price alone — for a home-visit booking,
  // that silently dropped the visit fee from the bill unless the shop
  // owner happened to notice and add it back manually. Every home
  // booking would have quietly undercharged by the fee amount.
  const isHomeVisit = appointment.service_location === 'at_home';
  const defaultAmount = Number(appointment.service_price) + (isHomeVisit ? Number(appointment.home_service_fee || 0) : 0);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    const finalAmount = Number(amount);
    if (!finalAmount || finalAmount < 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      await api.completeAppointmentWithBill(appointment, {
        finalAmount, paymentMethod,
        completedBy: user?.id || null,
        completedByName: user?.name || null,
      });
      toast.success('Appointment completed & bill created!');
      try {
        // onDone() is the caller's own follow-up (closing the modal,
        // refreshing a list, etc). If it throws, the bill itself still
        // succeeded — the success toast above is correct and should
        // stand. Isolating this in its own try/catch stops a failure
        // here from also firing the error toast below, which used to
        // show both 'Appointment completed!' and 'Failed to complete
        // appointment' for a single click.
        onDone();
      } catch (doneErr) {
        console.error('CompleteBillModal onDone() failed after a successful bill:', doneErr);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to complete appointment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 380, width: '100%', padding: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A', marginBottom: 4 }}>Complete & Bill</div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: isHomeVisit ? 4 : 18 }}>{appointment.service_name} for {appointment.customer_name}</div>
        {isHomeVisit && (
          <div style={{ fontSize: 12, color: '#EA580C', fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            🏠 Home visit — {appointment.customer_address}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Final Amount (₹)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: -10, marginBottom: 14 }}>
          {isHomeVisit
            ? `Pre-filled from the service price (₹${Number(appointment.service_price).toLocaleString('en-IN')}) + home visit fee (₹${Number(appointment.home_service_fee || 0).toLocaleString('en-IN')}) — adjust for discounts or add-ons before billing.`
            : 'Pre-filled from the service price — adjust for discounts or add-ons before billing.'}
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Payment Method</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 20 }}>
          {['Cash', 'UPI', 'Card'].map(m => (
            <button key={m} onClick={() => setPaymentMethod(m)}
              style={{ padding: '8px', borderRadius: 8, border: '1px solid', borderColor: paymentMethod === m ? '#10B981' : '#E2E8F0', background: paymentMethod === m ? '#D1FAE5' : '#fff', color: paymentMethod === m ? '#10B981' : '#475569', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {m}
            </button>
          ))}
        </div>

        {/* Who's confirming — the actual "finish confirmation" for a home
            visit, where nobody at the shop otherwise sees the work happen.
            Recorded on the appointment (completed_by/completed_at) when
            confirmed below. */}
        {user?.name && (
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 14px', textAlign: 'center' }}>
            {isHomeVisit ? 'Confirming this home visit is done, as' : 'Confirming as'} <strong style={{ color: '#475569' }}>{user.name}</strong>
          </p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={confirm} disabled={saving}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: saving ? '#94A3B8' : '#10B981', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Saving…' : `✓ Complete & Bill ₹${Number(amount || 0).toLocaleString('en-IN')}`}
          </button>
        </div>
      </div>
    </div>
  );
}
