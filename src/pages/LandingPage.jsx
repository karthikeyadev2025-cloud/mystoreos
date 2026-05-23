import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Check, ChevronDown, Star, Menu, X, Zap, Shield, BarChart2, Package, CreditCard, Users, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { useSiteConfig } from '../lib/siteConfig';

const CountUp = ({ end, duration = 2, separator = ',', decimals = 0 }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTimestamp = null;
    const endVal = Number(end) || 0;
    const durationMs = duration * 1000;
    let raf;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      const eased = progress * (2 - progress);
      setCount(parseFloat((eased * endVal).toFixed(decimals)));
      if (progress < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => { if (raf) window.cancelAnimationFrame(raf); };
  }, [end, duration, decimals]);
  return count.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
};

const C = { bg: '#030712', card: '#0d1424', border: '#1e293b', cobalt: '#1e3a8a', emerald: '#10b981', amber: '#f59e0b', primary: '#f43f5e', text: '#f1f5f9', muted: '#64748b', grad: 'linear-gradient(135deg,#f43f5e,#8b5cf6)' };
const safe = async (fn, def = null) => { try { return await fn(); } catch { return def; } };

const DSP = [
  { id: 'starter', name: 'Starter', price: 499, color: '#64748b', features: ['Up to 200 products', 'Standard billing', 'Basic day book', 'Single device'] },
  { id: 'pro', name: 'PRO', price: 999, color: '#8b5cf6', popular: true, features: ['Unlimited products', 'WhatsApp sharing', 'Staff accounts', 'Batch & expiry track', 'UPI payment links', 'Low stock alerts'] },
  { id: 'enterprise', name: 'Enterprise', price: 2499, color: '#f59e0b', features: ['Everything in PRO', 'GST compliance billing', 'CA Portal access', 'Tally ERP export', 'Multi-device sync (5)', 'Priority support'] },
];
const DDP = [
  { id: 'basic_dist', name: 'Basic', price: 999, color: '#64748b', features: ['Up to 10 shops', 'Basic order mgmt', 'Credit ledger'] },
  { id: 'pro_dist', name: 'PRO', price: 2499, color: '#8b5cf6', popular: true, features: ['Up to 50 shops', 'Route planner', 'Bulk order CSV', 'Tally export', 'Advanced analytics'] },
  { id: 'enterprise_dist', name: 'Enterprise', price: 4999, color: '#f59e0b', features: ['Unlimited shops', 'Multi-branch', 'API access', 'Staff accounts', 'Priority support'] },
];
const FAQS = [
  { q: 'Is my data safe?', a: 'Bank-grade encryption. All data stored securely in the cloud. Your data belongs only to you.' },
  { q: 'Does it work offline?', a: 'Fully offline. Bills, inventory, credits all work without internet. Data syncs on reconnect.' },
  { q: 'Can I export to Tally?', a: 'Enterprise plan exports Tally XML directly. CA portal also available for your accountant.' },
  { q: 'What happens after the trial?', a: 'After 7 days pick a plan. If you do nothing, you move to Starter tier — no charges.' },
  { q: 'How many staff accounts?', a: 'PRO includes 2 staff accounts. Enterprise includes unlimited staff with PIN-locked access.' },
  { q: 'WhatsApp invoice sharing — how?', a: 'One tap shares a PDF invoice to any WhatsApp number. No printer required.' },
  { q: 'Can I use it for multiple shops?', a: 'Enterprise supports multi-outlet chains with 5+ device sync and consolidated reports.' },
];
const STATS = [{ end: 500, suffix: '+', label: 'Active Businesses' }, { prefix: '₹', end: 2, suffix: 'Cr+ GMV', label: 'GMV Processed' }, { end: 12, suffix: '', label: 'Cities' }, { end: 99.9, suffix: '%', label: 'Uptime', decimals: 1 }];
const TMLS = [{ name: 'Ravi Kumar', city: 'Vijayawada', type: 'Kirana Shop', stars: 5, quote: 'రోజువారీ లెక్కలు ఇప్పుడు చాలా సులభం! Best app ever.' }, { name: 'Suresh Babu', city: 'Guntur', type: 'Medical Store', stars: 5, quote: 'Credit customers ki WhatsApp reminder super useful!' }, { name: 'Priya Lakshmi', city: 'Hyderabad', type: 'Supermarket', stars: 5, quote: 'Expiry tracking saved me ₹8,000 this month alone.' }, { name: 'Mohammed Ali', city: 'Tirupati', type: 'General Store', stars: 5, quote: 'Staff management feature is excellent. Very secure.' }, { name: 'Venkat Rao', city: 'Warangal', type: 'CA / Accountant', stars: 5, quote: 'GST reports and Tally export in one click. Excellent!' }, { name: 'Lakshmi Devi', city: 'Nellore', type: 'Kirana', stars: 5, quote: 'Best app for small shop owners. Very easy to use.' }, { name: 'Arun Prasad', city: 'Visakhapatnam', type: 'Provision', stars: 5, quote: '7 day free trial lo convinced aipoya! Worth every rupee.' }, { name: 'Srinivas', city: 'Karimnagar', type: 'Grocery', stars: 5, quote: 'Offline mode works perfectly even without internet.' }, { name: 'Deepa Reddy', city: 'Kurnool', type: 'Fancy Store', stars: 5, quote: 'Reports ki WhatsApp share cheyyadam super convenient!' }, { name: 'Ramesh Naidu', city: 'Ongole', type: 'Kirana Shop', stars: 5, quote: 'Billing time 30 seconds — customers are very happy.' }, { name: 'Kavitha', city: 'Kakinada', type: 'Medical', stars: 5, quote: 'Batch number tracking saved me from expired goods issue.' }, { name: 'Pavan Kumar', city: 'Rajahmundry', type: 'Supermarket', stars: 5, quote: 'Multi-outlet sync is the best feature. Great app!' }];
const FEATS = [{ icon: CreditCard, title: 'Billing & Cashflow', desc: '30-second bills. WhatsApp receipt. No printer. UPI payment links.', bdr: C.emerald }, { icon: Package, title: 'Smart Inventory', desc: 'Expiry tracking. Batch numbers. Auto-reorder alerts.', bdr: C.cobalt }, { icon: Users, title: 'Credit Khata', desc: 'Track who owes what. Send UPI links on WhatsApp. Auto reminders.', bdr: C.amber }, { icon: Shield, title: 'Staff Auditing', desc: 'PIN-locked staff access. Helper logs. Daily shift reports.', bdr: C.primary }, { icon: BarChart2, title: 'Profit Analytics', desc: 'Profit/loss gauge. Day book. GST reports. Tally export.', bdr: '#8b5cf6' }, { icon: Truck, title: 'Distributor Network', desc: 'Order from FMCG distributors. Credit ledger. Route planner.', bdr: '#06b6d4' }];
const WHO = [{ emoji: '🏪', title: 'Retail Shops', color: C.emerald, features: ['30-sec billing', 'Expiry tracking', 'WhatsApp receipts'] }, { emoji: '🚚', title: 'Wholesale Distributors', color: '#3b82f6', features: ['Route planner', 'Bulk orders CSV', 'Multi-shop dashboard'] }, { emoji: '🛍️', title: 'For Customers', color: C.amber, features: ['Find nearby shops', 'Scan & order instantly', 'Track your credit khata'] }, { emoji: '🏭', title: 'Multi-outlet Chains', color: '#8b5cf6', features: ['5+ device sync', 'Consolidated P&L', 'Central inventory'] }];
const STEPS = [{ n: 1, title: 'Register in 2 min', desc: 'Sign up with phone number. No documents needed.', color: C.primary }, { n: 2, title: 'Setup Your Shop', desc: 'Add shop name, logo, and your first 5 products.', color: '#8b5cf6' }, { n: 3, title: 'Start Billing Today', desc: 'Create your first bill. Share instantly on WhatsApp.', color: C.emerald }];

const CSS = `html{scroll-behavior:smooth}body{margin:0;font-family:'Outfit',sans-serif;background:#030712;color:#fff}*,*::before,*::after{box-sizing:border-box}
.ln{display:none}.mb{display:flex}.lh{grid-template-columns:1fr}.l4{grid-template-columns:repeat(2,1fr)}.l3{grid-template-columns:1fr}
@media(min-width:768px){.ln{display:flex}.mb{display:none}.lh{grid-template-columns:1fr 1fr}.l4{grid-template-columns:repeat(4,1fr)}.l3{grid-template-columns:repeat(3,1fr)}}
@keyframes ml{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes mr{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@keyframes pg{0%,100%{box-shadow:0 0 20px rgba(244,63,94,0.35)}50%{box-shadow:0 0 50px rgba(244,63,94,0.7)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}`;

// ─── NAV ──────────────────────────────────────────────────────────────────────
function Nav({ navigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 40); window.addEventListener('scroll', fn, { passive: true }); return () => window.removeEventListener('scroll', fn); }, []);
  const navSt = { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.3s', background: scrolled ? 'rgba(3,7,18,0.92)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none' };
  return (
    <>
      <nav style={navSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="MyStore OS" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>MyStore OS</span>
        </div>
        <div className="ln" style={{ gap: 32, alignItems: 'center' }}>
          {[['Features', '#features'], ['Pricing', '#pricing'], ['About', '/about'], ['Alternatives', '/alternative/vyapar']].map(([l, h]) => (
            <a key={l} href={h} style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/login')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Login</button>
          <button onClick={() => navigate('/register')} style={{ background: C.grad, border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Start Free Trial</button>
          <button onClick={() => setOpen(v => !v)} className="mb" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 999, background: 'rgba(3,7,18,0.97)', backdropFilter: 'blur(20px)', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[['Features', '#features'], ['Pricing', '#pricing'], ['About', '/about'], ['Alternatives', '/alternative/vyapar']].map(([l, h]) => (
              <a key={l} href={h} onClick={() => setOpen(false)} style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 600, textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{l}</a>
            ))}
            <button onClick={() => { setOpen(false); navigate('/login'); }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Login</button>
            <button onClick={() => { setOpen(false); navigate('/register'); }} style={{ background: C.grad, border: 'none', color: '#fff', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Start Free Trial</button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function Hero() {
  const navigate = useNavigate();
  return (
    <section style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', background: `radial-gradient(ellipse at 20% 50%,rgba(244,63,94,0.08),transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(139,92,246,0.08),transparent 50%),${C.bg}` }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />
      <div className="lh" style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '80px 24px 40px', display: 'grid', gap: 48, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 100, padding: '6px 16px', width: 'fit-content' }}>
            <Zap size={12} color={C.primary} /><span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>The Operating System for Modern Business</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            style={{ margin: 0, fontSize: 'clamp(36px,7vw,68px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.1, color: '#fff' }}>
            The Operating System<br /><span style={{ background: C.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>for Modern Business</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ margin: 0, fontSize: 'clamp(14px,2vw,17px)', color: '#94a3b8', lineHeight: 1.7 }}>
            Bills • Inventory • Credit • Staff — One App for Every Business Type<br /><span style={{ color: C.amber, fontWeight: 600 }}>మీ వ్యాపారాన్ని స్మార్ట్‌గా నడపండి</span>
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            onClick={() => navigate('/register')}
            style={{ background: C.grad, border: 'none', color: '#fff', padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', width: 'fit-content', animation: 'pg 2.5s ease-in-out infinite' }}>
            Start Free 7-Day Trial →
          </motion.button>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['UPI Verified', 'Bank-Grade Security', 'Works Offline', 'WhatsApp Native'].map(b => (
              <span key={b} style={{ fontSize: 11, fontWeight: 700, color: C.muted, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={10} color={C.emerald} strokeWidth={3} />{b}
              </span>
            ))}
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, type: 'spring', stiffness: 70 }}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', minHeight: 300 }}>
          <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 148, minHeight: 280, background: '#0a0f1e', border: '6px solid #1e293b', borderRadius: 30, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6),0 0 40px rgba(244,63,94,0.1)' }}>
            <div style={{ height: 18, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 44, height: 5, background: '#0f172a', borderRadius: 3 }} /></div>
            <div style={{ padding: '4px 8px 2px', display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#64748b' }}><span>9:41</span><span>●●●</span></div>
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.primary, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4 }}>Ravi Kirana Store</div>
              {[['Parle-G 200g', '₹30'], ['Sunflower Oil 1L', '₹145'], ['Toor Dal 500g', '₹68']].map(([n, p], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#cbd5e1' }}><span>{n}</span><span style={{ color: C.emerald, fontWeight: 700 }}>{p}</span></div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800 }}><span style={{ color: '#fff' }}>Total</span><span style={{ color: C.emerald }}>₹243</span></div>
              <div style={{ textAlign: 'center', fontSize: 8, color: '#8b5cf6', marginTop: 2 }}>Shared on WhatsApp</div>
            </div>
          </motion.div>
          {[{ text: '₹2,847 collected', color: C.emerald, delay: 1.1, x: '-115px', y: '20px' }, { text: '3 items expiring ⚠', color: C.amber, delay: 1.5, x: '105px', y: '60px' }, { text: 'Ravi paid ₹500 UPI', color: '#06b6d4', delay: 1.9, x: '-95px', y: '180px' }].map((fc, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
              transition={{ delay: fc.delay, duration: 0.4, y: { duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: fc.delay + 0.5 } }}
              style={{ position: 'absolute', left: `calc(50% + ${fc.x})`, top: fc.y, background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(12px)', border: `1px solid ${fc.color}40`, borderRadius: 10, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              <span style={{ color: fc.color }}>●</span> {fc.text}
            </motion.div>
          ))}
        </motion.div>
      </div>
      <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }} style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#475569', fontSize: 12 }}>
        <span>Scroll to explore</span><ChevronDown size={16} />
      </motion.div>
    </section>
  );
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────
function StatsBar() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.3 });
  return (
    <section ref={ref} style={{ padding: '48px 24px', background: 'linear-gradient(180deg,#050814,#070d1a)', overflowX: 'auto' }}>
      <div className="l4" style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 1, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20 }}>
        {STATS.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: i * 0.12 }}
            style={{ padding: '28px 16px', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <div style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 900, color: '#fff', lineHeight: 1, marginBottom: 6 }}>
              {s.prefix || ''}{inView ? <CountUp end={s.end} duration={2} separator="," decimals={s.decimals || 0} /> : '0'}{s.suffix}
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── FOR WHO ──────────────────────────────────────────────────────────────────
function ForWho() {
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,#070d1a,${C.bg})` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.emerald, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Who It&apos;s For</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Built for Every Business Type</h2>
        </motion.div>
        <div className="l4" style={{ display: 'grid', gap: 18 }}>
          {WHO.map((w, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `3px solid ${w.color}`, borderRadius: 16, padding: '22px 18px' }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{w.emoji}</div>
              <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: '#fff' }}>{w.title}</h3>
              {w.features.map(f => (<div key={f} style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 7, fontSize: 13, color: '#94a3b8' }}><Check size={12} color={w.color} strokeWidth={3} />{f}</div>))}
              <a href="/register" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 700, color: w.color, textDecoration: 'none' }}>Get Started →</a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FEATURES ─────────────────────────────────────────────────────────────────
function Features() {
  const [hov, setHov] = useState(null);
  return (
    <section id="features" style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,${C.bg},#050814)` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Capabilities</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Everything Your Shop Needs</h2>
        </motion.div>
        <div className="l3" style={{ display: 'grid', gap: 18 }}>
          {FEATS.map((f, i) => { const Icon = f.icon; const h = hov === i; return (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
              style={{ background: h ? `${f.bdr}0d` : 'rgba(255,255,255,0.025)', backdropFilter: 'blur(16px)', border: `1px solid ${h ? f.bdr + '50' : 'rgba(255,255,255,0.06)'}`, borderTop: `2px solid ${f.bdr}`, borderRadius: 18, padding: '22px 18px', transform: h ? 'translateY(-4px)' : 'none', boxShadow: h ? `0 16px 40px rgba(0,0,0,0.35),0 0 16px ${f.bdr}18` : 'none', transition: 'all 0.22s' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `${f.bdr}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon size={19} color={f.bdr} /></div>
              <h3 style={{ margin: '0 0 7px', fontSize: 15, fontWeight: 800, color: '#fff' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ); })}
        </div>
      </div>
    </section>
  );
}

// ─── ROI CALCULATOR ───────────────────────────────────────────────────────────
function RoiCalc() {
  const [sales, setSales] = useState(500000);
  const savings = Math.round(sales * 0.012), hours = Math.round((sales / 50000) * 8), roi = Math.round((savings / 999) * 100);
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,#050814,${C.bg})` }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>ROI Calculator</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,36px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>See Your Return on Investment</h2>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '30px 26px' }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Monthly Sales: <span style={{ color: '#fff', fontWeight: 800 }}>₹{(sales / 100000).toFixed(1)}L</span></label>
          <input type="range" min={50000} max={5000000} step={50000} value={sales} onChange={e => setSales(Number(e.target.value))} style={{ width: '100%', accentColor: C.primary, marginBottom: 26 }} />
          <div className="l3" style={{ display: 'grid', gap: 12 }}>
            {[{ label: 'Monthly Savings', val: `₹${savings.toLocaleString()}`, color: C.emerald, sub: '1.2% from reduced waste' }, { label: 'Hours Saved/Month', val: `${hours}h`, color: '#8b5cf6', sub: 'Automated tasks' }, { label: 'ROI vs ₹999/mo', val: `${roi}%`, color: C.amber, sub: 'Return on investment' }].map(r => (
              <div key={r.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: r.color }}>{r.val}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 4 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.sub}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── DAY IN THE LIFE ──────────────────────────────────────────────────────────
const BEATS = [
  { icon: '🌅', title: 'Open Shop', sub: 'Check stock levels & yesterday\'s summary', screen: ['Parle-G  45 units', 'Atta 5kg  8 ⚠', 'Sunflower 22 units'], color: '#3b82f6' },
  { icon: '🧾', title: 'First Bill', sub: 'Customer walks in — 30-second billing', screen: ['Parle-G  ₹10', 'Atta 5kg  ₹65', '─────────────', 'Total  ₹75 ✓'], color: '#10b981' },
  { icon: '🤝', title: 'Credit Customer', sub: 'Record credit & send WhatsApp reminder', screen: ['Ravi Kumar  Credit', '₹320 added', 'WhatsApp sent ✓', 'Due: ₹320'], color: '#f59e0b' },
  { icon: '📦', title: 'Stock Check', sub: 'AI alerts on near-expiry & low stock', screen: ['⚠ Atta 5kg: 8 left', '⚠ Dove: expiring', 'Reorder now?', '→ Order from dist.'], color: '#8b5cf6' },
  { icon: '🚚', title: 'Restock Order', sub: 'Order from distributor in one tap', screen: ['Guntur FMCG Supply', 'Atta Bulk  ₹1,950', 'Order sent ✓', 'Delivers: Tomorrow'], color: '#06b6d4' },
  { icon: '📊', title: 'Day End', sub: 'Profit report & cash summary auto-ready', screen: ['Cash In  ₹4,820', 'Cash Out  ₹1,950', 'Net Profit  ₹2,870', 'Margin  59% 🎉'], color: '#f43f5e' },
];

function DayInLife() {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBeat(b => (b + 1) % BEATS.length), 4000);
    return () => clearInterval(t);
  }, []);
  const b = BEATS[beat];
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,${C.bg},#050814)` }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>A Day in the Life</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>MyStore OS Runs Your Entire Day</h2>
        </motion.div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
          {BEATS.map((bx, i) => (
            <button key={i} onClick={() => setBeat(i)} style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${beat === i ? bx.color : 'rgba(255,255,255,0.08)'}`, background: beat === i ? `${bx.color}18` : 'transparent', color: beat === i ? bx.color : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{bx.icon}</span>{bx.title}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 36, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <AnimatePresence mode="wait">
            <motion.div key={beat} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }}
              style={{ background: C.card, border: `1px solid ${b.color}40`, borderLeft: `4px solid ${b.color}`, borderRadius: 20, padding: '30px 28px', maxWidth: 380, flex: 1 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{b.icon}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#fff' }}>{b.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{b.sub}</p>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div key={`phone-${beat}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.28 }}
              style={{ width: 148, background: '#0a0f1e', border: '6px solid #1e293b', borderRadius: 28, overflow: 'hidden', boxShadow: `0 20px 60px rgba(0,0,0,0.6),0 0 30px ${b.color}18`, flexShrink: 0 }}>
              <div style={{ height: 18, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 44, height: 5, background: '#0f172a', borderRadius: 3 }} /></div>
              <div style={{ padding: '4px 8px 2px', display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#64748b' }}><span>9:41</span><span>●●●</span></div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 8, fontWeight: 800, color: b.color, textAlign: 'center', borderBottom: `1px solid ${b.color}30`, paddingBottom: 5, marginBottom: 7 }}>{b.title}</div>
                {b.screen.map((line, li) => (
                  <div key={li} style={{ fontSize: 9, fontFamily: 'monospace', marginBottom: 4, color: line.startsWith('─') ? '#334155' : line.includes('✓') ? '#10b981' : line.includes('⚠') ? '#f59e0b' : '#cbd5e1' }}>{line}</div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ─── COMPETITIVE MATRIX ───────────────────────────────────────────────────────
const MATRIX_ROWS = [
  { label: 'Price/month', vals: ['From ₹499', 'Free (your time)', '₹5,000+', 'From ₹699'] },
  { label: 'Works Offline', vals: [true, false, false, true] },
  { label: 'Mobile App', vals: [true, false, false, true] },
  { label: 'WhatsApp Bills', vals: [true, false, false, true] },
  { label: 'GST Compliance', vals: [true, false, true, true] },
  { label: 'Staff Auditing', vals: [true, false, false, true] },
  { label: 'Distributor Network', vals: [true, false, false, false] },
  { label: 'Credit Khata AI', vals: [true, false, false, 'Basic'] },
];
const MATRIX_COLS = ['MyStore OS', 'Paper Ledger', 'Desktop Software', 'Vyapar'];

function CompMatrix() {
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,#050814,${C.bg})` }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Comparison</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,36px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Why Businesses Choose MyStore OS</h2>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Feature</th>
                  {MATRIX_COLS.map((col, ci) => (
                    <th key={ci} style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: ci === 0 ? C.primary : C.muted, background: ci === 0 ? 'rgba(244,63,94,0.06)' : 'transparent', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                      {col}{ci === 0 && <span style={{ display: 'block', fontSize: 9, color: C.emerald, fontWeight: 700, marginTop: 2 }}>✓ BEST</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((row, ri) => (
                  <tr key={ri} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{row.label}</td>
                    {row.vals.map((val, vi) => (
                      <td key={vi} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, background: vi === 0 ? 'rgba(244,63,94,0.04)' : 'transparent', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                        {val === true ? <span style={{ fontSize: 16, color: '#10b981' }}>✓</span>
                          : val === false ? <span style={{ fontSize: 16, color: '#334155' }}>✗</span>
                          : <span style={{ fontSize: 11, fontWeight: 600, color: vi === 0 ? C.primary : C.muted }}>{val}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
const TMLCOLORS = [C.primary, '#8b5cf6', '#06b6d4', C.emerald, C.amber];
function TmlCard({ t, idx }) {
  return (
    <div style={{ width: 260, flexShrink: 0, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${TMLCOLORS[idx % 5]}`, borderRadius: 14, padding: '14px 16px', margin: '0 8px' }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 7 }}>{Array(t.stars).fill(0).map((_, si) => <Star key={si} size={11} fill="#f59e0b" color="#f59e0b" />)}</div>
      <p style={{ fontSize: 12, color: '#cbd5e1', margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>"{t.quote}"</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{t.name[0]}</div>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{t.name}</div><div style={{ fontSize: 10, color: '#475569' }}>{t.type} · {t.city}</div></div>
      </div>
    </div>
  );
}
function TmlRow({ items, dir }) {
  return (
    <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(to right,transparent,black 10%,black 90%,transparent)' }}>
      <div style={{ display: 'flex', width: 'max-content', animation: `${dir === 'r' ? 'mr' : 'ml'} 35s linear infinite` }}>
        {[...items, ...items].map((t, i) => <TmlCard key={i} t={t} idx={i} />)}
      </div>
    </div>
  );
}
function Testimonials() {
  const half = Math.ceil(TMLS.length / 2);
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 0', background: `linear-gradient(180deg,${C.bg},#050814)`, overflow: 'hidden' }}>
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 36, padding: '0 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Social Proof</div>
        <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Trusted by 500+ Businesses Across India</h2>
      </motion.div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TmlRow items={TMLS.slice(0, half)} dir="l" />
        <TmlRow items={TMLS.slice(half)} dir="r" />
      </div>
    </section>
  );
}

// ─── TRUST BAR ────────────────────────────────────────────────────────────────
const TRUST_ITEMS = [
  { icon: '🔐', title: 'Bank-Grade Security', desc: 'AES-256 encryption + TLS 1.3. Data isolated per shop with Row-Level Security.' },
  { icon: '📵', title: 'Works Offline', desc: 'Full billing & inventory without internet. Syncs automatically when reconnected.' },
  { icon: '🏢', title: 'K² ADEXOS', desc: 'Built by Karthikeya Vempati in Guntur, AP. Proudly Indian product, Indian data centres.' },
  { icon: '⚡', title: '99.9% Uptime', desc: 'Hosted on Vercel edge + Supabase with global failover. Built for mission-critical use.' },
];
function TrustBar() {
  return (
    <section style={{ padding: 'clamp(48px,6vw,80px) 24px', background: '#030712', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Why Trust Us</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(20px,3vw,34px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Built for the Long Run</h2>
        </motion.div>
        <div className="l4" style={{ display: 'grid', gap: 16 }}>
          {TRUST_ITEMS.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{t.icon}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: '#fff' }}>{t.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{t.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FOR SHOPPERS ─────────────────────────────────────────────────────────────
function ForShoppers() {
  const navigate = useNavigate();
  const cards = [
    { icon: '🔍', title: 'Find Nearby Shops', desc: 'Discover local stores, browse their catalogue, and order via WhatsApp — all in one tap.' },
    { icon: '📱', title: 'Scan & Order', desc: 'Scan any shop\'s QR code to instantly view their menu and place an order without calling.' },
    { icon: '💬', title: 'Track Your Credit', desc: 'See how much you owe to local shops — all in one place. Never lose track of your khata.' },
  ];
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,${C.bg},#050814)` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>For Shoppers Too</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Shop Smarter with MyStore OS</h2>
          <p style={{ marginTop: 12, color: C.muted, fontSize: 16 }}>Not just for shop owners — customers love it too.</p>
        </motion.div>
        <div className="l3" style={{ display: 'grid', gap: 20, marginBottom: 40 }}>
          {cards.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '28px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 16 }}>{c.icon}</div>
              <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#fff' }}>{c.title}</h3>
              <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{c.desc}</p>
            </motion.div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <button onClick={() => navigate('/register?type=customer')} style={{ background: `linear-gradient(135deg,${C.amber},#d97706)`, border: 'none', color: '#000', padding: '14px 36px', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
            Create Free Customer Account →
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── PRICING ──────────────────────────────────────────────────────────────────
function Pricing({ plans, distPlans }) {
  const [tab, setTab] = useState('biz');
  const navigate = useNavigate();
  const active = tab === 'biz' ? plans : distPlans;
  return (
    <section id="pricing" style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,#050814,${C.bg})` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px', marginBottom: 20 }}>Simple, Transparent Pricing</h2>
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 4, gap: 4 }}>
            {[['biz', 'Businesses'], ['dist', 'Distributors']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: '8px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: tab === id ? C.grad : 'transparent', border: 'none', color: tab === id ? '#fff' : C.muted, transition: 'all 0.2s' }}>{label}</button>
            ))}
          </div>
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.28 }} className="l3" style={{ display: 'grid', gap: 20 }}>
            {active.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                style={{ background: p.popular ? 'linear-gradient(180deg,rgba(139,92,246,0.08),rgba(15,23,42,0.4))' : 'rgba(255,255,255,0.025)', border: `2px solid ${p.popular ? p.color : 'rgba(255,255,255,0.06)'}`, borderRadius: 20, padding: '26px 22px', position: 'relative' }}>
                {p.popular && (<div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(90deg,${p.color},#4f46e5)`, color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>Most Popular</div>)}
                <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#fff' }}>{p.name}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '10px 0 18px' }}><span style={{ fontSize: 34, fontWeight: 900, color: '#fff' }}>₹{p.price}</span><span style={{ fontSize: 13, color: C.muted }}>/mo</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {p.features.map(f => (<div key={f} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}><Check size={13} color={C.emerald} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} /><span style={{ fontSize: 13, color: '#94a3b8' }}>{f}</span></div>))}
                </div>
                <button onClick={() => navigate('/register')} style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: p.popular ? `linear-gradient(135deg,${p.color},#4f46e5)` : 'rgba(255,255,255,0.06)', border: p.popular ? 'none' : '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                  {p.id.includes('enterprise') ? 'Contact Sales' : 'Start Free Trial'}
                </button>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ textAlign: 'center', marginTop: 26, padding: '14px 20px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 14 }}>
          <span style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600 }}>All plans start with <strong>7 days FREE</strong> on PRO — no credit card needed</span>
        </motion.div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,${C.bg},#050814)` }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.emerald, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>Get Started</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Up & Running in Minutes</h2>
        </motion.div>
        <div className="l3" style={{ display: 'grid', gap: 22 }}>
          {STEPS.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.18 }}
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '26px 20px', textAlign: 'center', position: 'relative' }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: `${s.color}18`, border: `2px solid ${s.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.n}</span>
              </div>
              <h3 style={{ margin: '0 0 7px', fontSize: 15, fontWeight: 800, color: '#fff' }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function Faq() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq" style={{ padding: 'clamp(56px,7vw,90px) 24px', background: `linear-gradient(180deg,#050814,${C.bg})` }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>FAQ</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Common Questions</h2>
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((faq, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
              style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${open === i ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', padding: '15px 18px', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{faq.q}</span>
                <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={16} color={open === i ? '#8b5cf6' : C.muted} /></motion.div>
              </button>
              <AnimatePresence>
                {open === i && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}><p style={{ padding: '0 18px 14px', margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>{faq.a}</p></motion.div>)}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FINAL CTA ────────────────────────────────────────────────────────────────
function FinalCta() {
  const navigate = useNavigate();
  const [notif, setNotif] = useState(false);
  useEffect(() => { const t = setTimeout(() => setNotif(true), 3000); return () => clearTimeout(t); }, []);
  return (
    <section style={{ padding: 'clamp(64px,9vw,110px) 24px', background: `radial-gradient(ellipse at 50% 50%,rgba(244,63,94,0.09),rgba(139,92,246,0.06) 40%,${C.bg} 100%)`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ margin: '0 0 14px', fontSize: 'clamp(28px,5vw,52px)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.15 }}>
          Join 500+ Smart Businesses Across India
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
          style={{ fontSize: 16, color: C.muted, marginBottom: 34 }}>No credit card required · Cancel anytime · Works offline</motion.p>
        <motion.button initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 }}
          onClick={() => navigate('/register')}
          style={{ background: C.grad, border: 'none', color: '#fff', padding: '16px 44px', borderRadius: 14, fontSize: 17, fontWeight: 900, cursor: 'pointer', animation: 'pg 2.5s ease-in-out infinite' }}>
          Start Your Free 7-Day Trial
        </motion.button>
      </div>
      <AnimatePresence>
        {notif && (
          <motion.div initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}
            style={{ position: 'fixed', bottom: 72, right: 18, background: 'rgba(15,23,42,0.96)', backdropFilter: 'blur(16px)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: '11px 15px', fontSize: 13, color: '#fff', zIndex: 200, maxWidth: 256, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.emerald, flexShrink: 0 }} />
              <span><strong>Arjun</strong> from Hyderabad just started a free trial</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer({ navigate: _navigate }) {
  const lnk = (label, href) => (<div key={label} style={{ marginBottom: 9 }}><a href={href} style={{ fontSize: 14, color: '#475569', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }} onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}>{label}</a></div>);
  return (
    <footer style={{ background: C.bg, borderTop: '1px solid rgba(255,255,255,0.06)', padding: 'clamp(40px,6vw,72px) 24px 26px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 36, marginBottom: 44 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src="/logo.png" alt="MyStore OS" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
              <span style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>MyStore OS</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 14px' }}>The complete pocket OS for Indian retail. Manage smarter, grow faster.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['📱', 'https://wa.me/918885490495'], ['📷', 'https://instagram.com/mystoreos']].map(([ic, href]) => (
                <a key={href} href={href} target="_blank" rel="noreferrer" style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, textDecoration: 'none' }}>{ic}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Product</h4>
            {lnk('Features', '#features')}{lnk('Pricing', '#pricing')}{lnk('For Distributors', '#pricing')}{lnk('vs Vyapar', '/alternative/vyapar')}
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Company</h4>
            {lnk('About', '/about')}{lnk('Contact', '/contact')}{lnk('Privacy Policy', '/privacy')}{lnk('Terms of Service', '/terms')}
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Contact Us</h4>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 2 }}>
              <div>+91-8885490495</div><div>adexosindia@gmail.com</div><div style={{ fontSize: 12, marginTop: 4 }}>Andhra Pradesh, India</div>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#334155' }}>© 2026 MyStore OS · Made with ❤️ in Guntur, AP</span>
            <span style={{ fontSize: 12, color: '#1e293b' }}>Powered by K² ADEXOS GLOBAL TECHNOLOGIES</span>
          </div>
          <div style={{ fontSize: 11, color: '#1e293b', textAlign: 'center' }}>MyStore OS is independent and not affiliated with ONDC or Mystore.in</div>
        </div>
      </div>
    </footer>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const { config: _config } = useSiteConfig();
  const [plans, setPlans] = useState(DSP);
  const [distPlans, setDistPlans] = useState(DDP);

  useEffect(() => {
    safe(() => api.seedSubscriptionPlans());
    safe(() => api.getSubscriptionPlans()).then(d => { if (d) setPlans(d); });
    safe(() => api.getDistributorSubscriptionPlans()).then(d => { if (d) setDistPlans(d); });
  }, []);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      <style>{CSS}</style>
      <Nav navigate={navigate} />
      <Hero />
      <StatsBar />
      <ForWho />
      <Features />
      <DayInLife />
      <RoiCalc />
      <CompMatrix />
      <ForShoppers />
      <Testimonials />
      <TrustBar />
      <Pricing plans={plans} distPlans={distPlans} />
      <HowItWorks />
      <Faq />
      <FinalCta />
      <Footer navigate={navigate} />
    </div>
  );
}
