import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function LandingFAQ({ faq }) {
  const [open, setOpen] = useState(null);

  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 24px', background: 'linear-gradient(180deg,#050814,#030712)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>FAQ</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>Frequently Asked Questions</h2>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faq.map((item, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              style={{ background: '#1E293B', border: `1px solid ${open === i ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              <button onClick={() => setOpen(open === i ? null : i)}
                style={{ width: '100%', padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontFamily: 'Plus Jakarta Sans, sans-serif', textAlign: 'left' }}>
                <span style={{ color: '#f8fafc', fontSize: 15, fontWeight: 700 }}>{item.q}</span>
                <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0 }}>
                  <ChevronDown size={18} color="#64748b" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '0 20px 18px', color: '#94a3b8', fontSize: 14, lineHeight: 1.7 }}>{item.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
