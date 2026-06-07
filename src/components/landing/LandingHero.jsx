import { motion } from 'framer-motion';

const TRUST = ['🏦 UPI', '💬 WhatsApp', '💳 Razorpay', '📴 Works Offline', '🧾 GST Ready'];
const FLOAT_CARDS = [
  { label: '₹1.2L', sub: "Today's Sales", color: '#10b981', top: '8%', right: '-36px' },
  { label: '94 Bills', sub: 'Today', color: '#7C3AED', top: '52%', right: '-42px' },
  { label: '12', sub: 'Low Stock ⚠', color: '#f59e0b', bottom: '14%', left: '-28px' },
];
const FU = { initial: { opacity: 1, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.4,0,0.2,1] } };

export default function LandingHero({ hero, navigate, config = {} }) {
  const lines = (hero.headline || 'The Operating System\nfor Modern Business').split('\n');
  return (
    <section style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 64, background: '#0F172A', color: '#fff' }}>
      <div className="lorb lorb1" /><div className="lorb lorb2" /><div className="lorb lorb3" />
      <div className="lgrid" />

      <div className="lh" style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '40px 24px', display: 'grid', gap: 48, alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <motion.div {...FU}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 100, padding: '6px 16px', width: 'fit-content' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2F7FFF' }}>🏆 Trusted by 500+ Indian Businesses</span>
          </motion.div>

          <motion.h1 {...FU} transition={{ delay: 0.1, duration: 0.6 }}
            style={{ margin: 0, fontSize: 'clamp(34px,6vw,62px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px', color: '#f8fafc' }}>
            {lines[0]}<br />
            <span style={{ background: 'linear-gradient(90deg,#2F7FFF,#7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
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
              style={{ background: 'linear-gradient(135deg,#2F7FFF,#7C3AED)', border: 'none', color: '#fff', padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif", boxShadow: '0 0 30px rgba(244,63,94,0.3)' }}>
              Start Free 7-Day Trial 🚀
            </button>
            <button onClick={() => navigate('/pricing')}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif" }}>
              View Pricing →
            </button>
          </motion.div>

          <motion.div {...FU} transition={{ delay: 0.4 }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TRUST.map(b => (
              <span key={b} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#94a3b8' }}>{b}</span>
            ))}
          </motion.div>

          {/* ── App Store / Play Store download buttons ── */}
          <motion.div {...FU} transition={{ delay: 0.5 }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ color: '#475569', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', width: '100%', marginBottom: 2 }}>Download the App</div>

            {/* Google Play button */}
            <a
              href={config.playStoreUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: '#000', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12, padding: '10px 18px', textDecoration: 'none',
                color: '#fff', transition: 'border-color 0.2s, transform 0.15s',
                cursor: config.playStoreUrl && config.playStoreUrl !== '#' ? 'pointer' : 'default',
                opacity: config.playStoreUrl && config.playStoreUrl !== '#' ? 1 : 0.5,
              }}
              onClick={e => { if (!hero.playStoreUrl || hero.playStoreUrl === '#') e.preventDefault(); }}
            >
              {/* Play Store SVG */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3.18 23.5c.28.16.6.18.9.06l11.5-6.64L12.4 14l-9.22 9.5z" fill="#EA4335"/>
                <path d="M20.82 10.37l-2.8-1.62L14.7 12l3.32 3.25 2.8-1.62A1.7 1.7 0 0 0 22 12a1.7 1.7 0 0 0-.88-1.49l-.3-.14z" fill="#FBBC04"/>
                <path d="M3.18.5A1.68 1.68 0 0 0 2 2.06v19.88a1.68 1.68 0 0 0 1.18 1.56L12.4 14 3.18.5z" fill="#4285F4"/>
                <path d="M3.18.5L12.4 10l3.22-3.25L4.12.44A1.3 1.3 0 0 0 3.18.5z" fill="#34A853"/>
              </svg>
              <div>
                <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1 }}>GET IT ON</div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>Google Play</div>
              </div>
            </a>

            {/* App Store button */}
            <a
              href={config.appStoreUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: '#000', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12, padding: '10px 18px', textDecoration: 'none',
                color: '#fff', transition: 'border-color 0.2s, transform 0.15s',
                cursor: config.appStoreUrl && config.appStoreUrl !== '#' ? 'pointer' : 'default',
                opacity: config.appStoreUrl && config.appStoreUrl !== '#' ? 1 : 0.5,
              }}
              onClick={e => { if (!hero.appStoreUrl || hero.appStoreUrl === '#') e.preventDefault(); }}
            >
              {/* Apple SVG */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div>
                <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1 }}>Download on the</div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>App Store</div>
              </div>
            </a>

            {/* Coming soon badge if both links empty */}
            {(!config.playStoreUrl || config.playStoreUrl === '#') && (!config.appStoreUrl || config.appStoreUrl === '#') && (
              <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginLeft: 4 }}>
                (Links coming soon)
              </span>
            )}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2 }}
          style={{ display: 'flex', justifyContent: 'center', position: 'relative', padding: '20px 56px' }}>
          <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="lphone">
            <div className="lphone-notch" />
            <div style={{ padding: '3px 8px 2px', display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#64748b' }}><span>9:41</span><span>●●●</span></div>
            <div style={{ padding: '6px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#2F7FFF', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 5, marginBottom: 7 }}>Ravi Kirana Store</div>
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
        .lorb1{width:600px;height:600px;background:#7C3AED;top:-150px;left:-100px}
        .lorb2{width:400px;height:400px;background:#3b82f6;top:200px;right:-80px;animation-duration:15s;animation-direction:reverse}
        .lorb3{width:320px;height:320px;background:#2F7FFF;bottom:0;left:45%;animation-duration:18s;animation-delay:2s}
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
