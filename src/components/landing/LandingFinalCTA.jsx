import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TICKERS = [
  'Ravi from Vijayawada just started a free trial',
  'Suresh in Hyderabad upgraded to PRO plan',
  'Priya from Tirupati generated her 50th bill today',
  'Mohammed Ali in Nellore added 200 products',
  'Venkat Rao from Warangal shared his GST report',
];

export default function LandingFinalCTA({ navigate }) {
  const [tickerIdx, setTickerIdx] = useState(0);
  const [tickerVisible, setTickerVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTickerVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!tickerVisible) return;
    const id = setInterval(() => setTickerIdx(i => (i + 1) % TICKERS.length), 4000);
    return () => clearInterval(id);
  }, [tickerVisible]);

  return (
    <section style={{ padding: 'clamp(64px,8vw,100px) 24px', background: 'linear-gradient(180deg,#050814,#020509)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 50%,rgba(244,63,94,0.08),transparent)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>Get Started Today</div>
          <h2 style={{ margin: '0 0 16px', fontSize: 'clamp(28px,5vw,52px)', fontWeight: 900, color: '#f8fafc', lineHeight: 1.15, letterSpacing: '-1px' }}>
            Your Business Deserves<br />
            <span style={{ background: 'linear-gradient(90deg,#f43f5e,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Better Tools
            </span>
          </h2>
          <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
            Join 500+ Indian businesses already running on MyStore OS. 7 days free, no credit card, cancel anytime.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            <motion.button onClick={() => navigate('/register')}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '16px 40px', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 0 50px rgba(244,63,94,0.35)' }}>
              Start Free 7-Day Trial 🚀
            </motion.button>
            <button onClick={() => navigate('/pricing')}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', padding: '16px 28px', borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              View Pricing
            </button>
          </div>

          <AnimatePresence mode="wait">
            {tickerVisible && (
              <motion.div key={tickerIdx}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 100, padding: '6px 16px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'lcta-pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                <span style={{ color: '#6ee7b7', fontSize: 12, fontWeight: 600 }}>{TICKERS[tickerIdx]}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <style>{`@keyframes lcta-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
    </section>
  );
}
