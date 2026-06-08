import { motion } from 'framer-motion';

const BADGES = [
  { icon: '🏦', title: 'UPI Certified', sub: 'NPCI compliant payments', color: '#10b981' },
  { icon: '🔒', title: 'SSL Secured', sub: 'End-to-end encryption', color: '#3b82f6' },
  { icon: '🧾', title: 'GST Ready', sub: 'GSTIN compliant billing', color: '#f59e0b' },
  { icon: '☁️', title: 'Cloud Backup', sub: 'Auto-sync every 30 mins', color: '#8b5cf6' },
];

const LOGOS = ['Razorpay', 'WhatsApp', 'Tally', 'GSTN', 'NPCI', 'Zoho'];

export default function LandingTrust() {
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) clamp(16px,5vw,24px)', background: 'linear-gradient(180deg,#050814,#030712)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Trust & Security</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>Your Data is Safe With Us</h2>
        </motion.div>

        <div className="trust-grid" style={{ marginBottom: 48 }}>
          {BADGES.map((b, i) => (
            <motion.div key={b.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: '#1E293B', border: `1px solid ${b.color}33`, borderRadius: 16, padding: 'clamp(18px,2.5vw,24px) clamp(14px,2vw,20px)', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{b.icon}</div>
              <div style={{ color: b.color, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{b.title}</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{b.sub}</div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ textAlign: 'center' }}>
          <div style={{ color: '#475569', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>Integrated with</div>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
            {LOGOS.map(l => (
              <div key={l} style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 20px', color: '#64748b', fontSize: 13, fontWeight: 600 }}>{l}</div>
            ))}
          </div>
        </motion.div>
      </div>
      <style>{`
        .trust-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }
        @media(max-width:900px) { .trust-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media(max-width:480px) { .trust-grid { grid-template-columns: 1fr 1fr !important; gap: 12px !important; } }
      `}</style>
    </section>
  );
}
