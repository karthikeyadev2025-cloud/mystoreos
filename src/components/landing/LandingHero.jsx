import { motion } from 'framer-motion';

const TRUST = ['🏦 UPI', '💬 WhatsApp', '💳 Razorpay', '📴 Works Offline', '🧾 GST Ready'];
const FLOAT_CARDS = [
  { label: '₹1.2L', sub: "Today's Sales", color: '#10b981', top: '8%', right: '-36px' },
  { label: '94 Bills', sub: 'Today', color: '#8b5cf6', top: '52%', right: '-42px' },
  { label: '12', sub: 'Low Stock ⚠', color: '#f59e0b', bottom: '14%', left: '-28px' },
];
const FU = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } };

export default function LandingHero({ hero, navigate }) {
  const lines = (hero.headline || 'The Operating System\nfor Modern Business').split('\n');
  return (
    <section style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 64 }}>
      <div className="lorb lorb1" /><div className="lorb lorb2" /><div className="lorb lorb3" />
      <div className="lgrid" />

      <div className="lh" style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '40px 24px', display: 'grid', gap: 48, alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <motion.div {...FU}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 100, padding: '6px 16px', width: 'fit-content' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f43f5e' }}>🏆 Trusted by 500+ Indian Businesses</span>
          </motion.div>

          <motion.h1 {...FU} transition={{ delay: 0.1, duration: 0.6 }}
            style={{ margin: 0, fontSize: 'clamp(34px,6vw,62px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px', color: '#f8fafc' }}>
            {lines[0]}<br />
            <span style={{ background: 'linear-gradient(90deg,#f43f5e,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {lines[1] || 'for Modern Business'}
            </span>
          </motion.h1>

          {hero.telugu && (
            <motion.p {...FU} transition={{ delay: 0.15 }} style={{ margin: 0, color: '#f59e0b', fontSize: 15, fontStyle: 'italic', fontWeight: 600 }}>
              {hero.telugu}
            </motion.p>
          )}

          <motion.p {...FU} transition={{ delay: 0.2 }}
            style={{ margin: 0, fontSize: 'clamp(14px,1.8vw,17px)', color: '#94a3b8', lineHeight: 1.7, maxWidth: 500 }}>
            {hero.subheadline}
          </motion.p>

          <motion.div {...FU} transition={{ delay: 0.3 }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/register')}
              style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 0 30px rgba(244,63,94,0.3)' }}>
              Start Free 7-Day Trial 🚀
            </button>
            <button onClick={() => navigate('/pricing')}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              View Pricing →
            </button>
          </motion.div>

          <motion.div {...FU} transition={{ delay: 0.4 }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TRUST.map(b => (
              <span key={b} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#94a3b8' }}>{b}</span>
            ))}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2 }}
          style={{ display: 'flex', justifyContent: 'center', position: 'relative', padding: '20px 56px' }}>
          <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="lphone">
            <div className="lphone-notch" />
            <div style={{ padding: '3px 8px 2px', display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#64748b' }}><span>9:41</span><span>●●●</span></div>
            <div style={{ padding: '6px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#f43f5e', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 5, marginBottom: 7 }}>Ravi Kirana Store</div>
              {[['Parle-G 200g', '₹30'], ['Sunflower Oil 1L', '₹145'], ['Toor Dal 500g', '₹68']].map(([n, p], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#cbd5e1', marginBottom: 5 }}>
                  <span>{n}</span><span style={{ color: '#10b981', fontWeight: 700 }}>{p}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5, marginTop: 3, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800 }}>
                <span style={{ color: '#f8fafc' }}>Total</span><span style={{ color: '#10b981' }}>₹243</span>
              </div>
              <div style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', textAlign: 'center', padding: '8px', borderRadius: 7, marginTop: 8, fontSize: 10, fontWeight: 700 }}>
                📲 Share on WhatsApp
              </div>
            </div>
          </motion.div>

          {FLOAT_CARDS.map((c, i) => (
            <motion.div key={i}
              animate={{ y: [0, -8, 0] }} transition={{ duration: 3 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.9 }}
              style={{ position: 'absolute', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)', border: `1px solid ${c.color}44`, borderRadius: 10, padding: '8px 14px', ...Object.fromEntries(Object.entries(c).filter(([k]) => ['top','right','bottom','left'].includes(k))) }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.label}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{c.sub}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <style>{`
        .lorb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.12;pointer-events:none;animation:lorbFloat 20s ease-in-out infinite}
        .lorb1{width:600px;height:600px;background:#8b5cf6;top:-150px;left:-100px}
        .lorb2{width:400px;height:400px;background:#3b82f6;top:200px;right:-80px;animation-duration:15s;animation-direction:reverse}
        .lorb3{width:320px;height:320px;background:#f43f5e;bottom:0;left:45%;animation-duration:18s;animation-delay:2s}
        .lgrid{position:absolute;inset:0;background-image:linear-gradient(rgba(139,92,246,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.04) 1px,transparent 1px);background-size:50px 50px;pointer-events:none}
        .lphone{width:158px;background:#0a0f1e;border:6px solid #1e293b;border-radius:30px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.6),0 0 50px rgba(244,63,94,.1)}
        .lphone-notch{height:18px;background:#1e293b;display:flex;align-items:center;justify-content:center}
        .lphone-notch::after{content:'';width:44px;height:5px;background:#0f172a;border-radius:3px}
        @keyframes lorbFloat{0%,100%{transform:translate(0,0)}33%{transform:translate(20px,-20px)}66%{transform:translate(-15px,15px)}}
        @media(prefers-reduced-motion:reduce){.lorb{animation:none!important}}
      `}</style>
    </section>
  );
}
