import { motion } from 'framer-motion';

function TmlCard({ t }) {
  return (
    <div style={{ minWidth: 260, maxWidth: 280, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 18px', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {Array.from({ length: t.stars }, (_, i) => <span key={i} style={{ color: '#f59e0b', fontSize: 13 }}>★</span>)}
      </div>
      <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, margin: '0 0 14px', fontStyle: 'italic' }}>&quot;{t.quote}&quot;</p>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
        <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 13 }}>{t.name}</div>
        <div style={{ color: '#475569', fontSize: 12 }}>{t.city}</div>
      </div>
    </div>
  );
}

export default function LandingTestimonials({ testimonials }) {
  const half = Math.ceil(testimonials.length / 2);
  const row1 = testimonials.slice(0, half);
  const row2 = testimonials.slice(half);
  const dur1 = Math.max(30, row1.length * 7);
  const dur2 = Math.max(30, row2.length * 7);

  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 0', background: 'linear-gradient(180deg,#030712,#050814)', overflow: 'hidden' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        style={{ textAlign: 'center', marginBottom: 44, padding: '0 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Testimonials</div>
        <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px' }}>Loved by Indian Business Owners</h2>
      </motion.div>

      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(90deg,#030712,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: 'linear-gradient(270deg,#030712,transparent)', zIndex: 2, pointerEvents: 'none' }} />

        <div style={{ overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, padding: '0 16px', width: 'max-content', animation: `ml ${dur1}s linear infinite` }}>
            {[...row1, ...row1].map((t, i) => <TmlCard key={i} t={t} />)}
          </div>
        </div>

        <div style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 16, padding: '0 16px', width: 'max-content', animation: `mr ${dur2}s linear infinite` }}>
            {[...row2, ...row2].map((t, i) => <TmlCard key={i} t={t} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
