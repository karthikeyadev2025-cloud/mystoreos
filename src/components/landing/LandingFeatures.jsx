import { motion } from 'framer-motion';

const FEATURES = [
  { icon: '⚡', title: '30-Second Billing', desc: 'Scan or search products. Bill instantly with UPI or cash. Receipt on WhatsApp in seconds.', color: '#f43f5e' },
  { icon: '📦', title: 'Smart Inventory', desc: 'Barcode scanning, batch & expiry tracking, low-stock alerts. Never run out of hot items.', color: '#10b981' },
  { icon: '💳', title: 'Credit Khata', desc: 'Track customer credit, send WhatsApp reminders, collect via UPI link. Zero awkward conversations.', color: '#8b5cf6' },
  { icon: '📊', title: 'Live Analytics', desc: 'Sales by hour, top products, staff performance. Day-end P&L in one tap.', color: '#3b82f6' },
  { icon: '🧾', title: 'GST & Tally', desc: 'Auto-compute CGST/SGST, generate GSTR-1 XML, push to Tally ERP. CA-ready in one click.', color: '#f59e0b' },
  { icon: '📴', title: 'Works Offline', desc: 'Full functionality without internet. Auto-syncs to cloud when reconnected. No downtime ever.', color: '#06b6d4' },
  { icon: '👥', title: 'Staff & PIN', desc: 'Role-based logins with PIN. Cashiers see only billing; managers see full reports.', color: '#ec4899' },
  { icon: '🚚', title: 'Route Planning', desc: 'For distributors: drag-and-drop daily routes, delivery order management, collection tracking.', color: '#a78bfa' },
  { icon: '🔗', title: 'Integrations', desc: 'UPI, Razorpay, WhatsApp Business, Tally ERP, GSTN portal, Zoho CRM. One ecosystem.', color: '#34d399' },
];

export default function LandingFeatures() {
  return (
    <section id="features" style={{ padding: 'clamp(56px,7vw,90px) 24px', background: 'linear-gradient(180deg,#030712,#050814)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Features</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>Everything Your Business Needs</h2>
          <p style={{ color: '#64748b', fontSize: 16, marginTop: 10 }}>One platform. No more juggling 5 different apps.</p>
        </motion.div>
        <div className="l3" style={{ display: 'grid', gap: 18 }}>
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              whileHover={{ y: -6 }}
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px 20px', cursor: 'default', transition: 'box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 20px 40px ${f.color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ fontSize: 30, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ color: '#f8fafc', fontSize: 15, fontWeight: 800, margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
