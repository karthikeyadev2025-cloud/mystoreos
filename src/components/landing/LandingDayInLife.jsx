import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Two parallel day-in-the-life tracks. A salon owner scanning a page full
// of "reorder Parle-G" will assume the product isn't for them, no matter
// what the feature list says — so the narrative has to speak their
// language too. Both tracks are real flows the app actually supports.
const RETAIL_BEATS = [
  { time: '8:00 AM', title: 'Morning Stock Check', body: 'Open app — low-stock alerts ready. Reorder Parle-G with 1 tap.', icon: '🌅', screen: ['📦 Low Stock', 'Parle-G 200g — 8 left ⚠', 'Sunflower Oil — 3 left ⚠', 'Toor Dal 500g — 12 left', '→ Reorder Now'] },
  { time: '10:30 AM', title: 'Fast Customer Billing', body: 'Scan barcode or type first 3 letters. Bill in 30 seconds flat.', icon: '⚡', screen: ['🧾 New Bill', 'Parle-G 200g × 5 — ₹150', 'Toor Dal 500g × 2 — ₹136', 'GST: ₹14', 'Total: ₹300'] },
  { time: '1:00 PM', title: 'Credit Khata Entry', body: 'Customer pays next week? Add to khata. WhatsApp reminder auto-set.', icon: '💳', screen: ['👤 Ramesh Sharma', 'Previous: ₹500', 'Added Today: ₹300', 'Total Due: ₹800', '📲 Reminder Set'] },
  { time: '4:00 PM', title: 'UPI Collection', body: 'Send UPI payment link via WhatsApp. Instant confirmation.', icon: '💸', screen: ['🔗 UPI Link Sent', 'Amount: ₹800', 'To: Ramesh Sharma', '✅ Paid at 4:12 PM', 'Balance: ₹0'] },
  { time: '7:00 PM', title: 'Sales Analytics', body: 'Check hourly sales chart. Top products. Staff performance at a glance.', icon: '📊', screen: ["Today's Sales", '₹18,450 (↑12%)', 'Top: Sunflower Oil', 'Bills: 87 total', 'Staff: Suresh ★'] },
  { time: '9:00 PM', title: 'Day-End Report', body: 'Auto-generated P&L. Share with your CA on WhatsApp in one tap.', icon: '🌙', screen: ['📋 Day-End', 'Gross: ₹18,450', 'Returns: ₹200', 'Net: ₹18,250', '📤 Shared to CA'] },
];

const SERVICE_BEATS = [
  { time: '9:00 AM', title: "Today's Schedule", body: "Open app — see every appointment for the day, staff by staff.", icon: '📅', screen: ["📅 Today — 9 Bookings", '10:00 Haircut · Priya', '11:30 Facial · Anita', '01:00 Colour · Divya', '→ 2 slots free'] },
  { time: '9:15 AM', title: 'Overnight Bookings', body: 'Customers booked online while you slept. Push notification told you instantly.', icon: '🔔', screen: ['🔔 New Booking', 'Spa Package · Meera', 'Tomorrow 4:00 PM', 'Booked online ✅', '→ Confirm'] },
  { time: '11:00 AM', title: 'Walk-In, One Tap', body: 'Customer walks in. Log the booking, assign a stylist, done.', icon: '⚡', screen: ['➕ Walk-In', 'Service: Beard Trim', 'Staff: Ravi', 'Time: 11:15 AM', '✅ Booked'] },
  { time: '2:00 PM', title: 'Auto Reminders Fire', body: 'WhatsApp reminders go out 24h and 1h before each slot. No-shows drop.', icon: '📲', screen: ['📲 Reminders Sent', 'Meera — 24h ✅', 'Priya — 1h ✅', 'Anita — 1h ✅', 'No-shows: 0 today'] },
  { time: '5:00 PM', title: 'Complete & Bill', body: 'Service done? Mark complete and bill in the same tap. Thermal receipt prints.', icon: '🧾', screen: ['🧾 Complete Bill', 'Colour + Cut — ₹1,800', 'Staff: Divya', 'Paid: UPI', '🖨 Receipt printed'] },
  { time: '8:00 PM', title: 'Revenue at a Glance', body: 'Which services earn most, which staff are busiest — one dashboard.', icon: '📊', screen: ["Today's Revenue", '₹24,600 (↑18%)', 'Top: Hair Colour', 'Bookings: 14', 'Busiest: Divya ★'] },
];

const TRACKS = [
  { id: 'retail',  label: '🏪 Shop Owner',  beats: RETAIL_BEATS,  accent: '#f43f5e' },
  { id: 'service', label: '💇 Salon Owner',  beats: SERVICE_BEATS, accent: '#10b981' },
];

export default function LandingDayInLife() {
  const [track, setTrack] = useState('retail');
  const [active, setActive] = useState(0);
  const current = TRACKS.find(t => t.id === track) || TRACKS[0];
  const BEATS = current.beats;
  const accent = current.accent;
  const beat = BEATS[active];

  const switchTrack = (id) => { setTrack(id); setActive(0); };

  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) clamp(16px,5vw,24px)', background: 'linear-gradient(180deg,#050814,#030712)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10, transition: 'color .2s' }}>A Day in the Life</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>One App, All Day Long</h2>
        </motion.div>

        {/* Track switcher — retail vs service. Same app, two very
            different days; the visitor should see their own. */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
          {TRACKS.map(t => (
            <button key={t.id} onClick={() => switchTrack(t.id)}
              style={{
                padding: '10px 22px', borderRadius: 10, cursor: 'pointer', width: 'auto',
                fontSize: 13.5, fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif',
                background: track === t.id ? `${t.accent}1F` : 'rgba(255,255,255,0.04)',
                color: track === t.id ? '#f8fafc' : '#94a3b8',
                border: `1px solid ${track === t.id ? `${t.accent}66` : 'rgba(255,255,255,0.08)'}`,
                transition: 'all .18s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Desktop: side-by-side | Mobile: stacked (phone preview first) */}
        <div className="dayinlife-grid">
          {/* Button list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, order: 2 }}>
            {BEATS.map((b, i) => (
              <button key={i} onClick={() => setActive(i)}
                style={{ background: active === i ? `${accent}1A` : '#1E293B', border: `1px solid ${active === i ? `${accent}4D` : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: 'clamp(10px,2vw,14px) clamp(12px,2vw,18px)', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 14, alignItems: 'center', transition: 'all 0.2s', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                <span style={{ fontSize: 20 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{b.time}</div>
                  <div style={{ fontSize: 14, color: active === i ? '#f8fafc' : '#94a3b8', fontWeight: 700 }}>{b.title}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Phone preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, order: 1 }}>
            <AnimatePresence mode="wait">
              <motion.div key={active}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }}
                style={{ width: 180, background: '#0a0f1e', border: '6px solid #1e293b', borderRadius: 30, overflow: 'hidden', boxShadow: `0 30px 70px rgba(0,0,0,.6),0 0 50px ${accent}1A` }}>
                <div style={{ height: 18, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 44, height: 5, background: '#0f172a', borderRadius: 3 }} />
                </div>
                <div style={{ padding: '10px 12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: accent, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 8 }}>{beat.screen[0]}</div>
                  {beat.screen.slice(1).map((line, j) => (
                    <div key={j} style={{ fontSize: 11, color: /^[✅📲📤]/u.test(line) ? '#10b981' : '#cbd5e1', marginBottom: 5, padding: '2px 0' }}>{line}</div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{beat.icon} {beat.title}</div>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0, lineHeight: 1.6, maxWidth: 320 }}>{beat.body}</p>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .dayinlife-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: center;
        }
        @media(max-width:768px) {
          .dayinlife-grid {
            grid-template-columns: 1fr !important;
          }
          .dayinlife-grid > div:first-child { order: 1 !important; }
          .dayinlife-grid > div:last-child { order: 2 !important; }
        }
      `}</style>
    </section>
  );
}
