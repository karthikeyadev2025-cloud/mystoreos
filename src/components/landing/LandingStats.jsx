import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

function CountUp({ target, suffix, prefix, decimals, started }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    let cur = 0;
    const step = target / 60;
    const id = setInterval(() => {
      cur = Math.min(cur + step, target);
      setVal(cur);
      if (cur >= target) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [started, target]);
  const display = decimals > 0 ? val.toFixed(decimals) : Math.floor(val).toLocaleString('en-IN');
  return <>{prefix}{display}{suffix}</>;
}

const STATS = [
  { key: 'shops', label: 'Businesses Served', suffix: '+', prefix: '', decimals: 0, color: '#10b981' },
  { key: 'orders', label: 'Bills Generated', suffix: '+', prefix: '', decimals: 0, color: '#8b5cf6' },
  { key: 'cities', label: 'Cities Covered', suffix: '+', prefix: '', decimals: 0, color: '#3b82f6' },
  { key: 'uptime', label: 'Uptime SLA', suffix: '%', prefix: '', decimals: 1, color: '#f59e0b' },
];

export default function LandingStats({ stats }) {
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} style={{ padding: 'clamp(40px,5vw,64px) 24px', background: 'linear-gradient(180deg,#050814,#030712)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="l4" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid' }}>
        {STATS.map((s, i) => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 900, color: s.color, letterSpacing: '-1px' }}>
              <CountUp target={stats[s.key] ?? 0} suffix={s.suffix} prefix={s.prefix} decimals={s.decimals} started={started} />
            </div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 6, fontWeight: 600 }}>{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
