import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Clock, ChevronRight, CheckCircle, MapPin } from 'lucide-react';
import { getCurrentLocation, isGeolocationSupported } from '../lib/geolocation';

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

export default function ServiceBookingWidget({ shopId, shopName, shopPhone, customerPhone, customerName }) {
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  // Steps: 1=service, 2=provider (skipped if shop has no active staff),
  // 3=date/time, 4=confirm, 5=done
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [bookedRanges, setBookedRanges] = useState([]); // [{start, end}] in minutes, for the selected date
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [dayAvailability, setDayAvailability] = useState({ isOpen: true, workingStart: null, workingEnd: null, onTimeOff: false });
  const [selectedDate, setSelectedDate] = useState(getNext7Days()[0].iso);
  const [selectedTime, setSelectedTime] = useState('');
  const [form, setForm] = useState({ name: customerName || '', phone: customerPhone || '', notes: '' });
  // Home service — 'in_shop' | 'at_home'. Only relevant when the selected
  // service has home_service_enabled; defaults to in_shop otherwise.
  const [serviceLocation, setServiceLocation] = useState('in_shop');
  const [address, setAddress] = useState('');
  // Precise GPS for the visit address — optional, purely additive to
  // the typed address above. Helps staff actually find the place and
  // gives a verifiable record of where the visit was meant to happen.
  const [preciseLocation, setPreciseLocation] = useState(null); // { lat, lng, accuracy } | null
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmedAppt, setConfirmedAppt] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  // Whether the shop's plan includes customer self-service (reschedule
  // / cancel via manage-link). If false (Starter tier), the confirmation
  // screen hides the 'Manage This Booking' button — the RPCs would also
  // reject it, but hiding the link first is a better UX than a red
  // error toast after the customer tries to use it.
  const [selfServiceOn, setSelfServiceOn] = useState(false);
  // Whether the shop's Home Service add-on is CURRENTLY active. Checked
  // independently of each service's home_service_enabled flag — a shop
  // could have that flag left on from before their add-on lapsed, and
  // the booking widget must not offer a home visit the shop can no
  // longer actually fulfil (or bill correctly) just because the RPC
  // gate would also reject it — same reasoning as selfServiceOn above.
  const [homeServiceOn, setHomeServiceOn] = useState(false);

  const hasProviders = providers.length > 0;

  useEffect(() => {
    Promise.all([
      api.getShopServices(shopId),
      api.getProviders(shopId).catch(() => []), // non-fatal — shop may not have set up staff
      api.shopHasSelfService(shopId).catch(() => false),
      api.shopHasHomeServiceAddon(shopId).catch(() => false),
    ]).then(([svcs, provs, selfSrv, homeSrv]) => {
      setServices(svcs.filter(s => s.active));
      setProviders((provs || []).filter(p => p.active));
      setSelfServiceOn(!!selfSrv);
      setHomeServiceOn(!!homeSrv);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [shopId]);

  // Refetch availability whenever the selected date OR provider changes.
  // If a provider is selected, this respects THEIR specific working
  // hours and time off (via getProviderAvailability) — not just a fixed
  // 9am-8pm grid with bookings greyed out. If no provider is selected
  // (shop has no staff set up), falls back to the original shop-wide
  // fixed-grid behaviour.
  useEffect(() => {
    setLoadingSlots(true);
    if (selectedProvider) {
      api.getProviderAvailability(selectedProvider.id, selectedDate)
        .then(avail => {
          setDayAvailability(avail);
          setBookedRanges(avail.bookedRanges || []);
        })
        .finally(() => setLoadingSlots(false));
    } else {
      setDayAvailability({ isOpen: true, workingStart: null, workingEnd: null, onTimeOff: false });
      api.getBookedSlots(shopId, selectedDate)
        .then(setBookedRanges)
        .finally(() => setLoadingSlots(false));
    }
  }, [shopId, selectedDate, selectedProvider]);

  const isSlotTaken = (timeStr) => {
    if (!selectedService) return false;
    const [h, m] = timeStr.split(':').map(Number);
    const slotStart = h * 60 + m;
    const slotEnd = slotStart + (Number(selectedService.duration_minutes) || 30);
    // If a provider is selected, slots outside their working hours for
    // this day are also "taken" (from the customer's perspective — they
    // simply can't book it), in addition to already-booked ranges.
    if (selectedProvider) {
      if (!dayAvailability.isOpen) return true;
      const [wsH, wsM] = (dayAvailability.workingStart || '00:00').split(':').map(Number);
      const [weH, weM] = (dayAvailability.workingEnd || '23:59').split(':').map(Number);
      const workStart = wsH * 60 + wsM;
      const workEnd = weH * 60 + weM;
      if (slotStart < workStart || slotEnd > workEnd) return true;
    }
    return bookedRanges.some(r => slotStart < r.end && slotEnd > r.start);
  };

  const days = getNext7Days();
  const usedCategories = [...new Set(services.map(s => s.category))];
  const filteredServices = categoryFilter === 'all' ? services : services.filter(s => s.category === categoryFilter);

  const handleBook = async () => {
    if (!form.name.trim()) return toast.error('Please enter your name');
    if (!form.phone.match(/^\d{10}$/)) return toast.error('Enter a valid 10-digit phone number');
    if (!selectedTime) return toast.error('Please select a time slot');
    if (serviceLocation === 'at_home' && !address.trim()) return toast.error('Please enter your address for the home visit');
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
        provider_id: selectedProvider?.id || null,
        service_location: serviceLocation,
        customer_address: serviceLocation === 'at_home' ? address.trim() : null,
        customer_lat: serviceLocation === 'at_home' ? (preciseLocation?.lat ?? null) : null,
        customer_lng: serviceLocation === 'at_home' ? (preciseLocation?.lng ?? null) : null,
        home_service_fee: serviceLocation === 'at_home' ? (Number(selectedService.home_service_fee) || 0) : 0,
      });
      setConfirmedAppt(appt);
      setStep(5);
      toast.success('Appointment booked!');

      // Notify the shop owner via WhatsApp — opens a wa.me link pre-filled
      // with the booking details. The shop owner still has to tap Send in
      // WhatsApp; this is the honest, no-server-required version. If they
      // set up the WhatsApp Cloud API later, we can switch to silent push.
      if (shopPhone) {
        try {
          const cleanShopPhone = String(shopPhone).replace(/\D/g, '').slice(-10);
          if (cleanShopPhone.length === 10) {
            const dateNice = new Date(selectedDate + 'T00:00:00')
              .toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
            const timeNice = fmt12(selectedTime);
            const msg = [
              `🔔 *New Booking at ${shopName || 'your shop'}*`,
              ``,
              `👤 ${form.name}`,
              `📞 ${form.phone}`,
              ``,
              `✂️ ${selectedService.name}`,
              selectedProvider ? `💇 With: ${selectedProvider.name}` : null,
              `📅 ${dateNice} · ${timeNice}`,
              `⏱️ ${selectedService.duration_minutes} min`,
              serviceLocation === 'at_home'
                ? `🏠 *HOME VISIT* — ₹${Number(selectedService.price).toLocaleString('en-IN')} + ₹${Number(selectedService.home_service_fee || 0).toLocaleString('en-IN')} visit fee`
                : `💰 ₹${Number(selectedService.price).toLocaleString('en-IN')}`,
              serviceLocation === 'at_home' ? `📍 ${address.trim()}` : null,
              form.notes ? `📝 ${form.notes}` : null,
              ``,
              `Open your MyStoreOS Bookings tab to confirm.`,
            ].filter(Boolean).join('\n');
            // Use +91 prefix (Indian numbers). wa.me strips the + but requires digits.
            const waUrl = `https://wa.me/91${cleanShopPhone}?text=${encodeURIComponent(msg)}`;
            // Open in a new tab so it doesn't blow away the customer's
            // confirmation screen. On mobile, WhatsApp intercepts wa.me.
            window.open(waUrl, '_blank', 'noopener');
          }
        } catch (_e) {
          // Non-fatal — the booking itself already succeeded.
        }
      }
    } catch (e) {
      toast.error(e.message || 'Booking failed. Please try again.');
    }
    setBooking(false);
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--c-faint)' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>✂️</div>
      Loading services…
    </div>
  );

  if (services.length === 0) return null; // No services — don't show the widget

  // ── STEP 5: Confirmed ─────────────────────────────────────────────────
  if (step === 5) {
    const dateDisplay = confirmedAppt?.appointment_date
      ? new Date(confirmedAppt.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
      : selectedDate;
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--c-success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle size={32} color="var(--c-success)" />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--c-ink)' }}>Appointment Booked!</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--c-muted)' }}>We'll confirm your appointment shortly</p>
        <div style={{ background: 'var(--c-bg)', borderRadius: 12, padding: 16, textAlign: 'left', marginBottom: 20, border: '1px solid var(--c-line)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-ink)', marginBottom: 10 }}>{selectedService?.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--c-ink-2)' }}>
            {selectedProvider && <div>💇 With {selectedProvider.name}</div>}
            <div>📅 {dateDisplay}</div>
            <div>⏰ {fmt12(selectedTime)}</div>
            <div>⏱️ {selectedService?.duration_minutes} min</div>
            {serviceLocation === 'at_home' ? (
              <>
                <div style={{ fontWeight: 700, color: 'var(--c-primary)' }}>🏠 Home visit — {address}</div>
                <div>💰 ₹{Number(selectedService?.price).toLocaleString('en-IN')}{Number(selectedService?.home_service_fee) > 0 ? ` + ₹${Number(selectedService.home_service_fee).toLocaleString('en-IN')} visit fee` : ''}</div>
              </>
            ) : (
              <div>💰 ₹{Number(selectedService?.price).toLocaleString('en-IN')}</div>
            )}
          </div>
        </div>
        <button onClick={() => { setStep(1); setSelectedService(null); setSelectedProvider(null); setSelectedTime(''); setConfirmedAppt(null); setServiceLocation('in_shop'); setAddress(''); setPreciseLocation(null); }}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: 'var(--c-primary)', color: 'var(--c-surface)', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
          Book Another Appointment
        </button>
        {confirmedAppt?.manage_token && selfServiceOn && (
          <a href={`/manage-booking/${confirmedAppt.manage_token}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', color: 'var(--c-ink-2)', fontWeight: 700, fontSize: 13, textDecoration: 'none', boxSizing: 'border-box' }}>
            📋 Manage This Booking
          </a>
        )}
        {confirmedAppt?.manage_token && selfServiceOn && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--c-faint)', textAlign: 'center' }}>
            Save this link to reschedule or cancel later — we can't recover it if lost.
          </p>
        )}
        {confirmedAppt && !selfServiceOn && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--c-faint)', textAlign: 'center' }}>
            To reschedule or cancel, please contact the shop directly.
          </p>
        )}
      </div>
    );
  }

  // Dynamic step labels depending on whether this shop has staff set up
  const stepLabels = hasProviders ? ['Service', 'Staff', 'Date & Time', 'Confirm'] : ['Service', 'Date & Time', 'Confirm'];
  // Maps the internal step number (1,2,3,4,5) to a 0-indexed position in
  // stepLabels, skipping the 'Staff' step entirely when hasProviders is false.
  const stepPosition = (s) => {
    if (!hasProviders) return s === 1 ? 0 : s === 3 ? 1 : s === 4 ? 2 : 0;
    return s - 1;
  };

  return (
    <div>
      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: 6, padding: '16px 16px 0', marginBottom: 16 }}>
        {stepLabels.map((label, i) => {
          const currentPos = stepPosition(step);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, cursor: i < currentPos ? 'pointer' : 'default' }}
              onClick={() => { if (i < currentPos) setStep(hasProviders ? i + 1 : (i === 0 ? 1 : i === 1 ? 3 : 4)); }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: currentPos > i ? 'var(--c-success)' : currentPos === i ? 'var(--c-primary)' : 'var(--c-line)', color: currentPos >= i ? 'var(--c-surface)' : 'var(--c-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                {currentPos > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: currentPos === i ? 'var(--c-primary)' : 'var(--c-faint)', whiteSpace: 'nowrap' }}>{label}</span>
              {i < stepLabels.length - 1 && <div style={{ flex: 1, height: 1, background: currentPos > i ? 'var(--c-success)' : 'var(--c-line)' }} />}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Pick Service ─────────────────────────────────────────── */}
      {step === 1 && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Category filter */}
          {usedCategories.length > 1 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
              <button onClick={() => setCategoryFilter('all')}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 999, border: '1px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderColor: categoryFilter === 'all' ? 'var(--c-primary)' : 'var(--c-line)', background: categoryFilter === 'all' ? 'var(--c-primary-soft)' : 'var(--c-surface)', color: categoryFilter === 'all' ? 'var(--c-primary)' : 'var(--c-muted)' }}>
                All
              </button>
              {SERVICE_CATEGORIES.filter(c => usedCategories.includes(c.id)).map(c => (
                <button key={c.id} onClick={() => setCategoryFilter(c.id)}
                  style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 999, border: '1px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderColor: categoryFilter === c.id ? 'var(--c-primary)' : 'var(--c-line)', background: categoryFilter === c.id ? 'var(--c-primary-soft)' : 'var(--c-surface)', color: categoryFilter === c.id ? 'var(--c-primary)' : 'var(--c-muted)' }}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredServices.map(svc => (
              <button key={svc.id} onClick={() => { setSelectedService(svc); setServiceLocation('in_shop'); setAddress(''); setPreciseLocation(null); setStep(hasProviders ? 2 : 3); }}
                style={{ width: '100%', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--c-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {(SERVICE_CATEGORIES.find(c => c.id === svc.category) || SERVICE_CATEGORIES[7]).label.split(' ')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-ink)', marginBottom: 2 }}>{svc.name}</div>
                  {svc.description && <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.description}</div>}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-success)' }}>₹{Number(svc.price).toLocaleString('en-IN')}</span>
                    <span style={{ fontSize: 12, color: 'var(--c-faint)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {svc.duration_minutes} min</span>
                    {svc.home_service_enabled && homeServiceOn && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-primary)', background: 'var(--c-primary-soft)', padding: '2px 7px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        🏠 Home visit available
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--c-faint)" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Choose Staff (only shown if the shop has staff set up) ── */}
      {step === 2 && hasProviders && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ background: 'var(--c-primary-soft)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-primary)' }}>{selectedService?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--c-primary-light)' }}>₹{Number(selectedService?.price).toLocaleString('en-IN')} · {selectedService?.duration_minutes} min</div>
            </div>
            <button onClick={() => setStep(1)} style={{ fontSize: 11, color: 'var(--c-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Change</button>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 10 }}>Who would you like to book with?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {providers.map(p => (
              <button key={p.id} onClick={() => { setSelectedProvider(p); setSelectedTime(''); setStep(3); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--c-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--c-primary)', fontWeight: 800, fontSize: 15 }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-ink)' }}>{p.name}</div>
                  {p.title && <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{p.title}</div>}
                </div>
                <ChevronRight size={16} color="var(--c-faint)" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 3: Date & Time ──────────────────────────────────────────── */}
      {step === 3 && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Selected service summary */}
          <div style={{ background: 'var(--c-primary-soft)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-primary)' }}>{selectedService?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--c-primary-light)' }}>
                ₹{Number(selectedService?.price).toLocaleString('en-IN')} · {selectedService?.duration_minutes} min
                {selectedProvider && ` · with ${selectedProvider.name}`}
              </div>
            </div>
            <button onClick={() => setStep(hasProviders ? 2 : 1)} style={{ fontSize: 11, color: 'var(--c-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Change</button>
          </div>

          {/* Date picker */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 10 }}>Select Date</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {days.map(d => (
                <button key={d.iso} onClick={() => { setSelectedDate(d.iso); setSelectedTime(''); }}
                  style={{ flexShrink: 0, width: 52, padding: '8px 4px', borderRadius: 10, border: '1px solid', cursor: 'pointer', textAlign: 'center', transition: 'all .15s', borderColor: selectedDate === d.iso ? 'var(--c-primary)' : 'var(--c-line)', background: selectedDate === d.iso ? 'var(--c-primary)' : 'var(--c-surface)', color: selectedDate === d.iso ? 'var(--c-surface)' : 'var(--c-ink-2)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{d.day}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>{d.date}</div>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>{d.month}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time slots */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 10 }}>
              Select Time {loadingSlots && <span style={{ color: 'var(--c-faint)', fontWeight: 400 }}>(checking availability…)</span>}
            </div>
            {selectedProvider && dayAvailability.onTimeOff ? (
              <div style={{ textAlign: 'center', padding: 24, background: 'var(--c-orange-soft)', borderRadius: 10, border: '1px dashed var(--c-orange-soft)' }}>
                <div style={{ fontSize: 13, color: 'var(--c-orange-strong)', fontWeight: 600 }}>{selectedProvider.name} is on leave this day</div>
                <div style={{ fontSize: 12, color: 'var(--c-orange)', marginTop: 4 }}>Please pick a different date</div>
              </div>
            ) : selectedProvider && !dayAvailability.isOpen ? (
              <div style={{ textAlign: 'center', padding: 24, background: 'var(--c-bg)', borderRadius: 10, border: '1px dashed var(--c-line)' }}>
                <div style={{ fontSize: 13, color: 'var(--c-faint)', fontWeight: 600 }}>{selectedProvider.name} doesn't work this day</div>
                <div style={{ fontSize: 12, color: 'var(--c-line-strong)', marginTop: 4 }}>Please pick a different date</div>
              </div>
            ) : (
              <>
                {selectedProvider && dayAvailability.isOpen && (
                  <div style={{ fontSize: 11, color: 'var(--c-faint)', marginBottom: 8 }}>
                    {selectedProvider.name} works {fmt12(dayAvailability.workingStart)} – {fmt12(dayAvailability.workingEnd)} this day
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {TIME_SLOTS.map(t => {
                    const taken = isSlotTaken(t);
                    return (
                      <button key={t} disabled={taken} onClick={() => !taken && setSelectedTime(t)}
                        style={{
                          padding: '9px 4px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600,
                          cursor: taken ? 'not-allowed' : 'pointer', transition: 'all .1s',
                          borderColor: taken ? 'var(--c-line-soft)' : (selectedTime === t ? 'var(--c-primary)' : 'var(--c-line)'),
                          background: taken ? 'var(--c-bg)' : (selectedTime === t ? 'var(--c-primary)' : 'var(--c-surface)'),
                          color: taken ? 'var(--c-line-strong)' : (selectedTime === t ? 'var(--c-surface)' : 'var(--c-ink-2)'),
                          textDecoration: taken ? 'line-through' : 'none',
                        }}>
                        {fmt12(t)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button onClick={() => { if (!selectedTime) return toast.error('Please select a time'); setStep(4); }}
            style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: 'var(--c-primary)', color: 'var(--c-surface)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            Continue →
          </button>
        </div>
      )}

      {/* ── STEP 4: Confirm & Book ───────────────────────────────────────── */}
      {step === 4 && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Summary — price includes the home visit fee when selected */}
          <div style={{ background: 'var(--c-bg)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--c-line)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--c-ink)', marginBottom: 10 }}>{selectedService?.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: 'var(--c-ink-2)' }}>
              {selectedProvider && <div>💇 With {selectedProvider.name}</div>}
              <div>📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <div>⏰ {fmt12(selectedTime)}</div>
              <div>⏱️ {selectedService?.duration_minutes} min</div>
              {serviceLocation === 'at_home' && Number(selectedService?.home_service_fee) > 0 ? (
                <>
                  <div>💰 ₹{Number(selectedService?.price).toLocaleString('en-IN')} + ₹{Number(selectedService?.home_service_fee).toLocaleString('en-IN')} home visit fee</div>
                  <div style={{ fontWeight: 700, color: 'var(--c-success)' }}>Total: ₹{(Number(selectedService?.price) + Number(selectedService?.home_service_fee)).toLocaleString('en-IN')}</div>
                </>
              ) : (
                <div style={{ fontWeight: 700, color: 'var(--c-success)' }}>💰 ₹{Number(selectedService?.price).toLocaleString('en-IN')}</div>
              )}
            </div>
          </div>

          {/* Home visit toggle — only shown for services the shop has
              enabled for home visits. Defaults to in-shop; the customer
              actively opts in to a home visit, since it's the exception,
              not the default, for most service businesses. */}
          {selectedService?.home_service_enabled && homeServiceOn && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 8 }}>Where should we come?</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: serviceLocation === 'at_home' ? 12 : 0 }}>
                <button onClick={() => setServiceLocation('in_shop')}
                  style={{ padding: '12px 10px', borderRadius: 10, border: serviceLocation === 'in_shop' ? '2px solid var(--c-primary)' : '1px solid var(--c-line)', background: serviceLocation === 'in_shop' ? 'var(--c-primary-soft)' : 'var(--c-surface)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: serviceLocation === 'in_shop' ? 'var(--c-primary)' : 'var(--c-ink)' }}>🏪 Visit the shop</div>
                  <div style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 2 }}>No extra charge</div>
                </button>
                <button onClick={() => setServiceLocation('at_home')}
                  style={{ padding: '12px 10px', borderRadius: 10, border: serviceLocation === 'at_home' ? '2px solid var(--c-primary)' : '1px solid var(--c-line)', background: serviceLocation === 'at_home' ? 'var(--c-primary-soft)' : 'var(--c-surface)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: serviceLocation === 'at_home' ? 'var(--c-primary)' : 'var(--c-ink)' }}>🏠 Home visit</div>
                  <div style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 2 }}>
                    {Number(selectedService.home_service_fee) > 0 ? `+₹${Number(selectedService.home_service_fee).toLocaleString('en-IN')}` : 'No extra charge'}
                  </div>
                </button>
              </div>
              {serviceLocation === 'at_home' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Your Address *</label>
                  <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="House/flat no., street, area, landmark…" rows={2}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                  {/* Optional precise location — supplements the typed
                      address, doesn't replace it. Helps staff actually
                      find the place, and is a real safety measure: it's
                      a verifiable record of exactly where the visit was
                      meant to happen. */}
                  {isGeolocationSupported() && (
                    <div style={{ marginTop: 8 }}>
                      {preciseLocation ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-success-strong)', fontWeight: 700 }}>
                          <CheckCircle size={13} /> Exact location added — helps our staff find you
                        </div>
                      ) : (
                        <button type="button" onClick={async () => {
                          setLocatingAddress(true);
                          try {
                            const loc = await getCurrentLocation({ highAccuracy: false });
                            setPreciseLocation(loc);
                            toast.success('Location added — thanks, this helps us find you');
                          } catch (e) {
                            toast.error(e.message || 'Could not get your location');
                          }
                          setLocatingAddress(false);
                        }} disabled={locatingAddress}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, cursor: locatingAddress ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--c-primary)', width: 'auto' }}>
                          <MapPin size={13} /> {locatingAddress ? 'Getting your location…' : 'Add my exact location (recommended)'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Customer details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Your Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Mobile Number *</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit mobile"
                type="tel" maxLength={10}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 }}>Special Requests (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any preferences or special requests…" rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(3)} style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid var(--c-line)', background: 'var(--c-surface)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--c-ink-2)' }}>← Back</button>
            <button onClick={handleBook} disabled={booking}
              style={{ flex: 1, padding: 13, borderRadius: 10, border: 'none', background: booking ? 'var(--c-faint)' : 'linear-gradient(135deg,var(--c-primary),var(--c-primary-light))', color: 'var(--c-surface)', fontWeight: 800, fontSize: 14, cursor: booking ? 'wait' : 'pointer' }}>
              {booking ? 'Booking…' : '✓ Confirm Appointment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
