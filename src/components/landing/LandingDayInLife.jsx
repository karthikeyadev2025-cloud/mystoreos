import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BEATS = [
  { time: '8:00 AM', title: 'Morning Stock Check', body: 'Open app — low-stock alerts ready. Reorder Parle-G with 1 tap.', icon: '🌅', screen: ['📦 Low Stock', 'Parle-G 200g — 8 left ⚠', 'Sunflower Oil — 3 left ⚠', 'Toor Dal 500g — 12 left', '→ Reorder Now'] },
  { time: '10:30 AM', title: 'Fast Customer Billing', body: 'Scan barcode or type first 3 letters. Bill in 30 seconds flat.', icon: '⚡', screen: ['🧾 New Bill', 'Parle-G 200g × 5 — ₹150', 'Toor Dal 500g × 2 — ₹136', 'GST: ₹14', 'Total: ₹300'] },
  { time: '1:00 PM', title: 'Credit Khata Entry', body: 'Customer pays next week? Add to khata. WhatsApp reminder auto-set.', icon: '💳', screen: ['👤 Ramesh Sharma', 'Previous: ₹500', 'Added Today: ₹300', 'Total Due: ₹800', '📲 Reminder Set'] },
  { time: '4:00 PM', title: 'UPI Collection', body: 'Send UPI payment link via WhatsApp. Instant confirmation.', icon: '💸', screen: ['🔗 UPI Link Sent', 'Amount: ₹800', 'To: Ramesh Sharma', '✅ Paid at 4:12 PM', 'Balance: ₹0'] },
  { time: '7:00 PM', title: 'Sales Analytics', body: 'Check hourly sales chart. Top products. Staff performance at a glance.', icon: '📊', screen: ["Today's Sales", '₹18,450 (↑12%)', 'Top: Sunflower Oil', 'Bills: 87 total', 'Staff: Suresh ★'] },
  { time: '9:00 PM', title: 'Day-End Report', body: 'Auto-generated P&L. Share with your CA on WhatsApp in one tap.', icon: '🌙', screen: ['📋 Day-End', 'Gross: ₹18,450', 'Returns: ₹200', 'Net: ₹18,250', '📤 Shared to CA'] },
];

export default function LandingDayInLife() {
  const [active, setActive] = useState(0);
  const beat = BEATS[active];

  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 24px', background: 'linear-gradient(180deg,#050814,#030712)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>A Day in the Life</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>One App, All Day Long</h2>
        </motion.div>
        <div className="lh" style={{ display: 'grid', gap: 32, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {BEATS.map((b, i) => (
              <button key={i} onClick={() => setActive(i)}
                style={{ background: active === i ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${active === i ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 14, alignItems: 'center', transition: 'all 0.2s', fontFamily: 'Outfit, sans-serif' }}>
                <span style={{ fontSize: 20 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{b.time}</div>
                  <div style={{ fontSize: 14, color: active === i ? '#f8fafc' : '#94a3b8', fontWeight: 700 }}>{b.title}</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <AnimatePresence mode="wait">
              <motion.div key={active}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }}
                style={{ width: 180, background: '#0a0f1e', border: '6px solid #1e293b', borderRadius: 30, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,.6),0 0 50px rgba(244,63,94,.1)' }}>
                <div style={{ height: 18, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 44, height: 5, background: '#0f172a', borderRadius: 3 }} />
                </div>
                <div style={{ padding: '10px 12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#f43f5e', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 8 }}>{beat.screen[0]}</div>
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
    </section>
  );
}
