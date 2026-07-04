import { motion } from 'framer-motion';

const TYPES = [
  { icon: '🏪', title: 'Retail & Kirana',      color: '#10b981', benefits: ['30-second smart billing', 'Credit khata tracking', 'WhatsApp receipts'] },
  { icon: '💇', title: 'Salon & Beauty',        color: '#ec4899', benefits: ['Online appointment booking', 'Service catalogue & pricing', 'Customer visit history'], badge: 'BOOKINGS-READY' },
  { icon: '🧖', title: 'Spa & Wellness',        color: '#8b5cf6', benefits: ['Slot-based bookings', 'Package & membership plans', 'Therapist scheduling'],           badge: 'BOOKINGS-READY' },
  { icon: '🩺', title: 'Clinic & Doctor',       color: '#06b6d4', benefits: ['Patient appointment slots', 'Visit ledger & billing', 'Prescription-ready invoices'],   badge: 'BOOKINGS-READY' },
  { icon: '🍴', title: 'Restaurant & Café',     color: '#f97316', benefits: ['Fast counter billing', 'KOT & thermal printing', 'Menu categorisation'] },
  { icon: '🏋️', title: 'Gym & Fitness',         color: '#eab308', benefits: ['Membership expiry alerts', 'Trainer session booking', 'Attendance tracking'],           badge: 'BOOKINGS-READY' },
  { icon: '🔧', title: 'Repair & Workshop',     color: '#64748b', benefits: ['Job-card style bookings', 'Parts & labour billing', 'Service estimate + invoice'],     badge: 'BOOKINGS-READY' },
  { icon: '💊', title: 'Medical & Pharmacy',    color: '#22c55e', benefits: ['HSN + GST compliant', 'Batch & expiry tracking', 'Fast repeat billing'] },
  { icon: '🚚', title: 'Wholesale Distributor', color: '#3b82f6', benefits: ['Route planning & delivery', 'Bulk order management', 'Credit settlements'] },
];

export default function LandingWhoFor() {
  return (
    <section id="who" style={{ padding: 'clamp(56px,7vw,90px) clamp(16px,5vw,24px)', background: 'linear-gradient(180deg,#030712,#050814)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Who It&apos;s For</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>Built for Every Indian Business</h2>
          <p style={{ color: '#64748b', fontSize: 16, marginTop: 10 }}>Retail, services, wholesale — one platform, one price</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 20 }}>
          {TYPES.map((t, i) => (
            <motion.div key={t.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              style={{ position: 'relative', padding: 24, background: 'rgba(15,23,42,0.6)', border: `1px solid ${t.color}33`, borderRadius: 16, backdropFilter: 'blur(20px)' }}>
              {t.badge && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 800, letterSpacing: 1, color: t.color, background: `${t.color}22`, border: `1px solid ${t.color}55`, padding: '3px 8px', borderRadius: 999 }}>
                  📅 {t.badge}
                </div>
              )}
              <div style={{ fontSize: 32, marginBottom: 12 }}>{t.icon}</div>
              <h3 style={{ margin: '0 0 12px', color: '#f8fafc', fontSize: 18, fontWeight: 800 }}>{t.title}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {t.benefits.map(b => (
                  <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: '#94a3b8' }}>
                    <span style={{ color: t.color, fontWeight: 700, flexShrink: 0 }}>✓</span>{b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
