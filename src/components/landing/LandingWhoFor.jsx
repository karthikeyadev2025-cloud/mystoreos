import { motion } from 'framer-motion';

const TYPES = [
  { icon: '🏪', title: 'Retail & Kirana', color: '#10b981', benefits: ['30-second smart billing', 'Credit khata tracking', 'WhatsApp receipts'] },
  { icon: '🚚', title: 'Wholesale Distributor', color: '#3b82f6', benefits: ['Route planning & delivery', 'Bulk order management', 'Credit settlements'] },
  { icon: '✂️', title: 'Service Providers', color: '#a78bfa', benefits: ['Appointment invoicing', 'Service history records', 'Customer loyalty points'] },
  { icon: '🏭', title: 'Chains & Franchises', color: '#f59e0b', benefits: ['Multi-location dashboard', 'Staff & PIN management', 'Consolidated reports'] },
];

export default function LandingWhoFor() {
  return (
    <section id="who" style={{ padding: 'clamp(56px,7vw,90px) clamp(16px,5vw,24px)', background: 'linear-gradient(180deg,#030712,#050814)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Who It&apos;s For</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>Built for Every Indian Business</h2>
          <p style={{ color: '#64748b', fontSize: 16, marginTop: 10 }}>From neighborhood kirana to national franchise chains</p>
        </motion.div>
        <div className="who-grid">
          {TYPES.map((t, i) => (
            <motion.div key={t.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)', borderTop: `3px solid ${t.color}`, borderRadius: 16, padding: 'clamp(18px,2.5vw,22px) clamp(14px,2vw,18px)', cursor: 'default', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 20px 40px ${t.color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{t.icon}</div>
              <h3 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>{t.title}</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {t.benefits.map(b => (
                  <li key={b} style={{ color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: t.color, fontWeight: 700, flexShrink: 0 }}>✓</span>{b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
      <style>{`
        .who-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }
        @media(max-width:900px) { .who-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media(max-width:480px) { .who-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
