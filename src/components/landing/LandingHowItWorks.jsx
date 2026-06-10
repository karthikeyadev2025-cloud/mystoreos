import { motion } from 'framer-motion';

const STEPS = [
  { num: '01', title: 'Create Account', body: 'Sign up free. Add your shop name, GSTIN (optional), and logo. 2 minutes total.', icon: '📝', color: '#f43f5e' },
  { num: '02', title: 'Add Products', body: 'Import via CSV or add manually. Barcode scan supported. Set prices and stock levels.', icon: '📦', color: '#8b5cf6' },
  { num: '03', title: 'Start Billing', body: 'First bill in 30 seconds. Share receipt on WhatsApp. You are live from day one.', icon: '⚡', color: '#10b981' },
];

export default function LandingHowItWorks({ navigate }) {
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) clamp(16px,5vw,24px)', background: 'linear-gradient(180deg,#030712,#050814)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>How It Works</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>Up and Running in Minutes</h2>
          <p style={{ color: '#64748b', fontSize: 16, marginTop: 10 }}>No training needed. No IT team. Just sign up and go.</p>
        </motion.div>

        <div className="hiw-grid">
          {STEPS.map((s, i) => (
            <motion.div key={s.num}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
              style={{ textAlign: 'center', padding: 'clamp(24px,3vw,32px) clamp(16px,2.5vw,24px)', background: '#1E293B', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, position: 'relative', overflow: 'hidden' }}>
              <motion.div
                initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.15 + 0.3, duration: 0.5 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${s.color},${s.color}00)`, transformOrigin: 'left' }} />
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${s.color}18`, border: `2px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color, letterSpacing: 2, marginBottom: 8 }}>STEP {s.num}</div>
              <h3 style={{ color: '#f8fafc', fontSize: 17, fontWeight: 800, margin: '0 0 10px' }}>{s.title}</h3>
              <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{s.body}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginTop: 44 }}>
          <button onClick={() => navigate('/register')}
            style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: 'clamp(12px,2vw,16px) clamp(24px,4vw,40px)', borderRadius: 14, fontSize: 'clamp(14px,2vw,16px)', fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 0 40px rgba(244,63,94,0.25)' }}>
            Start Your Free 15-Day Trial 🚀
          </button>
          <div style={{ color: '#475569', fontSize: 12, marginTop: 10 }}>No credit card required · Cancel anytime</div>
        </motion.div>
      </div>
      <style>{`
        .hiw-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }
        @media(max-width:768px) { .hiw-grid { grid-template-columns: 1fr !important; gap: 20px !important; } }
      `}</style>
    </section>
  );
}
