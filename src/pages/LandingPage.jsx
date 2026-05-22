import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import CountUp from 'react-countup';
import {
  Receipt, Package, Wallet, Users, Truck, BarChart2,
  Check, ChevronDown, Star, Menu, X,
  Plus, Minus
} from 'lucide-react';
import { api } from '../lib/api';
import { useSiteConfig } from '../lib/siteConfig';

// ─── reduce-motion helper ───────────────────────────────────────────────────
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── DEFAULT CMS DATA ───────────────────────────────────────────────────────
const DEFAULT_HERO = {
  headline1: 'Your Kirana Shop.',
  headline2: 'One App.',
  headline3: 'Zero Paperwork.',
  sub: 'Bills • Inventory • Credit • Staff • Reports — all from your phone.\nTrusted by 500+ shops across Andhra & Telangana.',
  telugu: 'మీ షాపును స్మార్ట్ గా నడపండి',
  cta1: '🚀 Start Free — 7 Days PRO',
  cta2: '▶ Watch Demo',
};

const DEFAULT_STATS = [
  { value: 500, suffix: '+', label: 'Active Shops' },
  { value: 50000, suffix: '+', label: 'Bills Generated' },
  { value: 2, prefix: '₹', suffix: 'Cr+', label: 'GMV Processed' },
  { value: 12, suffix: '', label: 'Cities Covered' },
];

const DEFAULT_STORY = [
  { time: '8:00 AM', emoji: '⏰', title: 'Morning Check', desc: 'Ramesh opens his shop. Checks yesterday\'s profit in 2 seconds.', screen: 'daybook' },
  { time: '9:30 AM', emoji: '📦', title: 'First Customer', desc: 'First customer walks in. Bill ready in 30 seconds.', screen: 'billing' },
  { time: '11:00 AM', emoji: '💸', title: 'Credit Customer', desc: 'Suresh buys on credit. WhatsApp reminder sent automatically.', screen: 'credit' },
  { time: '2:00 PM', emoji: '📊', title: 'Stock Check', desc: '3 items near expiry flagged automatically.', screen: 'inventory' },
  { time: '4:00 PM', emoji: '🚚', title: 'Restock Order', desc: 'Low stock? One tap to order from your distributor.', screen: 'restock' },
  { time: '8:00 PM', emoji: '🌙', title: 'End of Day', desc: 'Shop closed. Full day report on WhatsApp in one tap.', screen: 'report' },
];

const DEFAULT_FEATURES = [
  { icon: Receipt, title: 'Paperless Billing', desc: '30-second bills. WhatsApp receipt. No printer needed.', glow: '#10b981', mini: 'bill' },
  { icon: Package, title: 'Smart Inventory', desc: 'Expiry tracking. Batch numbers. Auto-reorder alerts.', glow: '#fbbf24', mini: 'expiry' },
  { icon: Wallet, title: 'Credit & Collections', desc: 'Track who owes what. Send UPI payment links on WhatsApp.', glow: '#06b6d4', mini: 'credit' },
  { icon: Users, title: 'Staff Management', desc: 'PIN-locked staff access. Helper logs. Shift reports.', glow: '#3b82f6', mini: 'staff' },
  { icon: BarChart2, title: 'Daily Reports', desc: 'Profit/loss gauge. Day book. GST reports. Tally export.', glow: '#8b5cf6', mini: 'report' },
  { icon: Truck, title: 'Distributor Network', desc: 'Order from FMCG distributors. Credit ledger. Route planner.', glow: '#f43f5e', mini: 'dist' },
];

const DEFAULT_TESTIMONIALS = [
  { name: 'Ravi Kumar', city: 'Vijayawada', type: 'Kirana Shop', stars: 5, quote: 'రోజువారీ లెక్కలు ఇప్పుడు చాలా సులభం! Best app ever.' },
  { name: 'Suresh Babu', city: 'Guntur', type: 'Medical Store', stars: 5, quote: 'Credit customers ki WhatsApp reminder super useful!' },
  { name: 'Priya Lakshmi', city: 'Hyderabad', type: 'Supermarket', stars: 5, quote: 'Expiry tracking saved me ₹8,000 this month alone.' },
  { name: 'Mohammed Ali', city: 'Tirupati', type: 'General Store', stars: 5, quote: 'Staff management feature is excellent. Very secure.' },
  { name: 'Venkat Rao', city: 'Warangal', type: 'CA / Accountant', stars: 5, quote: 'GST reports and Tally export in one click. Excellent!' },
  { name: 'Lakshmi Devi', city: 'Nellore', type: 'Kirana Shop', stars: 5, quote: 'Best app for small shop owners. Very easy to use.' },
  { name: 'Arun Prasad', city: 'Visakhapatnam', type: 'Provision Store', stars: 5, quote: '7 day free trial lo convinced aipoya! Worth every rupee.' },
  { name: 'Srinivas', city: 'Karimnagar', type: 'Grocery Store', stars: 5, quote: 'Offline mode works perfectly even without internet.' },
];

const SHOP_PLANS = [
  { id: 'starter', name: 'Starter', price: 499, color: '#64748b', features: ['Up to 200 products', 'Standard billing', 'Basic day book', 'Single device'] },
  { id: 'pro', name: 'PRO', price: 999, color: '#8b5cf6', popular: true, features: ['Unlimited products', 'WhatsApp sharing', 'Staff accounts', 'Batch & expiry track', 'UPI payment links', 'Low stock alerts'] },
  { id: 'enterprise', name: 'Enterprise', price: 2499, color: '#fbbf24', features: ['Everything in PRO', 'GST compliance billing', 'CA Portal access', 'Tally ERP export', 'Multi-device sync (5)', 'Custom invoice footer', 'Priority support'] },
];

const DIST_PLANS = [
  { id: 'basic_dist', name: 'Basic', price: 999, color: '#64748b', features: ['Up to 10 shops', 'Basic order mgmt', 'Credit ledger'] },
  { id: 'pro_dist', name: 'PRO', price: 2499, color: '#8b5cf6', popular: true, features: ['Up to 50 shops', 'Route planner', 'Bulk order CSV', 'Tally export', 'Advanced analytics'] },
  { id: 'enterprise_dist', name: 'Enterprise', price: 4999, color: '#fbbf24', features: ['Unlimited shops', 'Multi-branch', 'API access', 'Staff accounts', 'Priority support'] },
];

const FAQS = [
  { q: 'Is MyStore OS really free to start?', a: 'Yes — 7-day free trial on PRO plan. No credit card needed. All PRO features unlocked from day 1.' },
  { q: 'Does it work without internet?', a: 'Yes — fully offline. Bills, inventory, credits all work offline. Data syncs automatically when you reconnect.' },
  { q: 'Can I use it on multiple devices?', a: 'PRO supports 1 device. Enterprise supports 5+ devices with real-time cloud sync across all.' },
  { q: 'How is my data protected?', a: 'Bank-grade encryption. All data stored securely in the cloud. Your data belongs only to you.' },
  { q: 'Does it support GST billing?', a: 'Yes — Enterprise plan includes full GST compliance billing with CGST, SGST, and IGST calculations.' },
  { q: 'Can I export to Tally?', a: 'Yes — Enterprise plan exports Tally XML directly. CA portal also available for your accountant.' },
  { q: 'What if I need help?', a: 'WhatsApp support at +91-8885490495. We respond within 2 hours on working days.' },
];

// ─── FLOATING 3D SHAPES (pure CSS — no Three.js needed) ─────────────────────
function FloatingShapes() {
  const shapes = [
    { size: 80, x: '10%', y: '20%', color: '#f43f5e', delay: 0, type: 'hex' },
    { size: 60, x: '85%', y: '15%', color: '#8b5cf6', delay: 1.2, type: 'tri' },
    { size: 100, x: '75%', y: '60%', color: '#06b6d4', delay: 0.6, type: 'hex' },
    { size: 50, x: '5%', y: '70%', color: '#10b981', delay: 1.8, type: 'tri' },
    { size: 70, x: '50%', y: '80%', color: '#fbbf24', delay: 0.9, type: 'hex' },
    { size: 40, x: '30%', y: '10%', color: '#f43f5e', delay: 2.1, type: 'tri' },
  ];
  if (prefersReduced()) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {shapes.map((s, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -20, 0], rotate: [0, 180, 360] }}
          transition={{ duration: 8 + i, repeat: Infinity, ease: 'easeInOut', delay: s.delay }}
          style={{
            position: 'absolute', left: s.x, top: s.y,
            width: s.size, height: s.size, opacity: 0.07,
            background: `conic-gradient(from 0deg, ${s.color}, transparent, ${s.color})`,
            clipPath: s.type === 'hex'
              ? 'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)'
              : 'polygon(50% 0%,0% 100%,100% 100%)',
            filter: `blur(1px) drop-shadow(0 0 8px ${s.color})`,
          }}
        />
      ))}
      {/* Particle dots */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={`p${i}`}
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
          transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: (i * 0.3) % 5 }}
          style={{
            position: 'absolute',
            left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`,
            width: 2, height: 2, borderRadius: '50%',
            background: ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#fbbf24'][i % 5],
          }}
        />
      ))}
    </div>
  );
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────────
function Navbar({ onLogin, onRegister }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
    padding: '0 24px', height: 64,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    transition: 'background 0.3s, backdrop-filter 0.3s',
    background: scrolled ? 'rgba(3,7,18,0.92)' : 'transparent',
    backdropFilter: scrolled ? 'blur(20px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
  };

  return (
    <>
      <nav style={navStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="MyStore OS" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', boxShadow: '0 0 12px rgba(251,191,36,0.3)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <span style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.3px' }}>MyStore OS</span>
        </div>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }} className="nav-desktop">
          {[['Features', '#features'], ['Pricing', '#pricing'], ['For Distributors', '#pricing']].map(([l, href]) => (
            <a key={l} href={href}
              style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = '#94a3b8'}
            >{l}</a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={onLogin} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Login</button>
          <button onClick={onRegister} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Start Free</button>
          <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }} className="nav-mobile-btn">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 999, background: 'rgba(3,7,18,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[['Features', '#features'], ['Pricing', '#pricing'], ['For Distributors', '#pricing'], ['FAQ', '#faq']].map(([l, href]) => (
              <a key={l} href={href} onClick={() => setMenuOpen(false)}
                style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 600, textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{l}</a>
            ))}
            <button onClick={() => { setMenuOpen(false); onLogin(); }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Login</button>
            <button onClick={() => { setMenuOpen(false); onRegister(); }} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🚀 Start Free Trial</button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── PHONE MOCKUP ─────────────────────────────────────────────────────────────
function PhoneMockup({ screen = 'billing' }) {
  const screens = {
    billing: (
      <div style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f43f5e' }}>🏪 Ravi Kirana Store</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>Invoice #INV-0042 • Today</div>
        </div>
        {[['Parle-G 200g', '₹30'], ['Sunflower Oil 1L', '₹145'], ['Toor Dal 500g', '₹68']].map(([n, p], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#cbd5e1' }}>
            <span>{n}</span><span style={{ color: '#10b981', fontWeight: 700 }}>{p}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 5, display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: '#fff', marginTop: 2 }}>
          <span>Total</span><span style={{ color: '#10b981' }}>₹243</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 8, color: '#8b5cf6', marginTop: 2 }}>📲 Shared on WhatsApp</div>
      </div>
    ),
    daybook: (
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>Today's Profit</div>
        <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'conic-gradient(#10b981 0% 68%, rgba(255,255,255,0.08) 68% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#10b981' }}>₹4,230</div>
            <div style={{ fontSize: 7, color: '#64748b' }}>Net Profit</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          {[['Sales', '₹8,450', '#10b981'], ['Expenses', '₹4,220', '#f43f5e']].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: c }}>{v}</div>
              <div style={{ fontSize: 7, color: '#64748b' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    credit: (
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Credit Customers</div>
        {[['Suresh', '₹1,200', 'overdue'], ['Raju', '₹850', 'today'], ['Meena', '₹300', 'ok']].map(([n, a, s]) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: s === 'overdue' ? '#f43f5e22' : '#10b98122', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: s === 'overdue' ? '#f43f5e' : '#10b981' }}>{n[0]}</div>
              <span style={{ fontSize: 9, color: '#cbd5e1' }}>{n}</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: s === 'overdue' ? '#f43f5e' : s === 'today' ? '#fbbf24' : '#10b981' }}>{a}</span>
          </div>
        ))}
        <div style={{ fontSize: 8, color: '#8b5cf6', textAlign: 'center' }}>📲 Send WhatsApp reminder</div>
      </div>
    ),
    inventory: (
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Inventory</div>
        {[['Dettol Soap', 'Exp: 3 days', '#f43f5e'], ['Biscuits', 'Exp: 14 days', '#fbbf24'], ['Rice 25kg', 'Stock: 8 bags', '#10b981']].map(([n, s, c]) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 6px' }}>
            <span style={{ fontSize: 9, color: '#cbd5e1' }}>{n}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: c, background: `${c}22`, padding: '1px 5px', borderRadius: 4 }}>{s}</span>
          </div>
        ))}
      </div>
    ),
    restock: (
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Restock Order</div>
        {[['Parle-G 20pkt', '₹180'], ['Sunflower Oil 6L', '₹870'], ['Toor Dal 5kg', '₹680']].map(([n, p]) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 6px' }}>
            <span style={{ fontSize: 9, color: '#cbd5e1' }}>{n}</span>
            <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700 }}>{p}</span>
          </div>
        ))}
        <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', borderRadius: 6, padding: '5px' }}>Place Order →</div>
      </div>
    ),
    report: (
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>Day Report</div>
        {[['Total Sales', '₹8,450', '#10b981'], ['Expenses', '₹4,220', '#f43f5e'], ['Net Profit', '₹4,230', '#8b5cf6'], ['Credit Given', '₹2,350', '#fbbf24']].map(([l, v, c]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
            <span>{l}</span><span style={{ color: c, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
        <div style={{ fontSize: 8, color: '#25D366', textAlign: 'center', marginTop: 2 }}>📤 Share on WhatsApp</div>
      </div>
    ),
  };

  return (
    <div style={{
      width: 140, minHeight: 260,
      background: '#0a0f1e',
      border: '6px solid #1e293b',
      borderRadius: 28,
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(244,63,94,0.1)',
    }}>
      {/* Notch */}
      <div style={{ height: 16, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 5, background: '#0f172a', borderRadius: 3 }} />
      </div>
      {/* Status bar */}
      <div style={{ padding: '3px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#64748b' }}>
        <span>9:41</span><span>●●●</span>
      </div>
      {/* Screen content */}
      <AnimatePresence mode="wait">
        <motion.div key={screen}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}>
          {screens[screen] || screens.billing}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── SECTION 1: HERO ─────────────────────────────────────────────────────────
function HeroSection({ config, onRegister }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (prefersReduced()) return;
    const r = heroRef.current?.getBoundingClientRect();
    if (!r) return;
    setMousePos({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
  }, []);

  const words1 = (config?.headline1 || DEFAULT_HERO.headline1).split(' ');
  const words2 = (config?.headline2 || DEFAULT_HERO.headline2).split(' ');
  const words3 = (config?.headline3 || DEFAULT_HERO.headline3).split(' ');

  return (
    <section ref={heroRef} onMouseMove={handleMouseMove}
      style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 20% 50%,rgba(244,63,94,0.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(139,92,246,0.08) 0%,transparent 50%),linear-gradient(180deg,#030712 0%,#050814 100%)' }}>

      <FloatingShapes />

      {/* Glow orbs */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(244,63,94,0.06) 0%,transparent 70%)', top: '-10%', left: '-10%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)', bottom: '0%', right: '-5%', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '80px 24px 40px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 48, position: 'relative', zIndex: 1 }} className="hero-grid">

        {/* Left / main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 100, padding: '6px 16px', width: 'fit-content' }}>
            <span style={{ fontSize: 12 }}>🏆</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f43f5e' }}>#1 Shop Management App in Andhra Pradesh</span>
          </motion.div>

          {/* Headline */}
          <div style={{ lineHeight: 1.1 }}>
            {[words1, words2, words3].map((words, lineIdx) => (
              <div key={lineIdx} style={{ overflow: 'hidden' }}>
                {words.map((w, wi) => (
                  <motion.span key={wi}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: lineIdx * 0.2 + wi * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      display: 'inline-block', marginRight: '0.3em',
                      fontSize: 'clamp(36px, 8vw, 72px)',
                      fontWeight: 900,
                      letterSpacing: '-2px',
                      ...(lineIdx === 1
                        ? { background: 'linear-gradient(90deg,#f43f5e,#8b5cf6,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                        : { color: '#fff' }),
                    }}>{w}</motion.span>
                ))}
              </div>
            ))}
          </div>

          {/* Sub */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.6 }}
            style={{ fontSize: 'clamp(15px,2vw,18px)', color: '#94a3b8', lineHeight: 1.6, maxWidth: 520, margin: 0 }}>
            {(config?.sub || DEFAULT_HERO.sub).split('\n').map((l, i) => <span key={i}>{l}{i === 0 && <br />}</span>)}
          </motion.p>

          {/* Telugu */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.6 }}
            style={{ fontSize: 16, color: '#fbbf24', fontWeight: 600, margin: 0 }}>
            {config?.telugu || DEFAULT_HERO.telugu}
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.5 }}
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={onRegister}
              style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 30px rgba(244,63,94,0.35)', letterSpacing: '-0.2px' }}>
              {config?.cta1 || DEFAULT_HERO.cta1}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#cbd5e1', padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              {config?.cta2 || DEFAULT_HERO.cta2}
            </motion.button>
          </motion.div>

          {/* Trust row */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
            style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {['No credit card', 'Works offline', 'Android + iPhone'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                <Check size={13} color="#10b981" strokeWidth={3} />{t}
              </div>
            ))}
          </motion.div>

          {/* Logo row */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
            style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {['UPI', 'WhatsApp', 'Razorpay', 'Tally'].map(b => (
              <span key={b} style={{ fontSize: 12, color: '#475569', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 10px', fontWeight: 600 }}>{b}</span>
            ))}
          </motion.div>
        </div>

        {/* Right: phone + floating cards (desktop) */}
        <motion.div className="hero-phone"
          initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.9, type: 'spring', stiffness: 80 }}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', minHeight: 320 }}>

          <motion.div
            animate={prefersReduced() ? {} : { y: [0, -12, 0] }}
            transition={prefersReduced() ? {} : { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
            <motion.div style={{ transform: `perspective(800px) rotateY(${mousePos.x * -8}deg) rotateX(${mousePos.y * 4}deg)`, transition: 'transform 0.1s' }}>
              <PhoneMockup screen="billing" />
            </motion.div>
          </motion.div>

          {/* Ambient glow */}
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(244,63,94,0.15) 0%,transparent 70%)', bottom: -20, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

          {/* Floating cards */}
          {[
            { text: '₹2,847 collected today', color: '#10b981', delay: 1.2, x: '-120px', y: '20px' },
            { text: '3 items near expiry ⚠', color: '#fbbf24', delay: 1.6, x: '110px', y: '60px' },
            { text: 'Ravi paid ₹500 via UPI', color: '#06b6d4', delay: 2, x: '-100px', y: '180px' },
          ].map((c, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
              transition={{ delay: c.delay, duration: 0.5, y: { duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: c.delay + 0.5 } }}
              style={{ position: 'absolute', left: `calc(50% + ${c.x})`, top: c.y, background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(12px)', border: `1px solid ${c.color}40`, borderRadius: 10, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', boxShadow: `0 4px 16px rgba(0,0,0,0.4), 0 0 10px ${c.color}20` }}>
              <span style={{ color: c.color }}>●</span> {c.text}
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#475569', fontSize: 12 }}>
        <span>Scroll to explore</span>
        <ChevronDown size={18} />
      </motion.div>
    </section>
  );
}

// ─── SECTION 2: STATS BAR ────────────────────────────────────────────────────
function StatsSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.3 });

  return (
    <section ref={ref} style={{ padding: 'clamp(40px,5vw,60px) 24px', background: 'linear-gradient(180deg,#050814,#070d1a)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '32px 24px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1 }} className="stats-grid">
        {DEFAULT_STATS.map((s, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.15, duration: 0.6 }}
            style={{ padding: '20px 16px', textAlign: 'center', borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <div style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 900, color: '#fff', lineHeight: 1, marginBottom: 6 }}>
              {s.prefix || ''}
              {inView ? <CountUp end={s.value} duration={2} separator="," /> : '0'}
              {s.suffix}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── SECTION 3: STORY ────────────────────────────────────────────────────────
function StorySection() {
  const [activeStep, setActiveStep] = useState(0);
  const [ref, inView] = useInView({ triggerOnce: false, threshold: 0.1 });

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setActiveStep(p => (p + 1) % DEFAULT_STORY.length), 2800);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <section ref={ref} style={{ padding: 'clamp(60px,8vw,100px) 24px', background: 'linear-gradient(180deg,#070d1a,#030712)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>Real Stories</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-1px' }}>A Day in the Life of a Smart Kirana Owner</h2>
          <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>See how MyStore OS transforms your daily routine</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 40, alignItems: 'center' }} className="story-grid">
          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
            {/* Vertical line */}
            <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: 'rgba(255,255,255,0.06)' }} />
            {DEFAULT_STORY.map((beat, i) => (
              <motion.div key={i} onClick={() => setActiveStep(i)}
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '12px 0', cursor: 'pointer', transition: 'opacity 0.3s', opacity: activeStep === i ? 1 : 0.45 }}>
                {/* Dot */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: activeStep === i ? 'linear-gradient(135deg,#f43f5e,#8b5cf6)' : 'rgba(255,255,255,0.06)', border: activeStep === i ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.3s', boxShadow: activeStep === i ? '0 0 20px rgba(244,63,94,0.4)' : 'none', zIndex: 1 }}>
                  {beat.emoji}
                </div>
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: '#f43f5e', fontWeight: 700 }}>{beat.time}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: activeStep === i ? '#fff' : '#94a3b8' }}>{beat.title}</span>
                  </div>
                  <AnimatePresence>
                    {activeStep === i && (
                      <motion.p key="desc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>{beat.desc}</motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Phone preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
              <PhoneMockup screen={DEFAULT_STORY[activeStep].screen} />
              <div style={{ position: 'absolute', inset: -20, borderRadius: 40, background: 'radial-gradient(circle,rgba(244,63,94,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 4: FEATURES ─────────────────────────────────────────────────────
function Feature3DCard({ feature, index }) {
  const [hovered, setHovered] = useState(false);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (prefersReduced()) return;
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientY - r.top - r.height / 2) / r.height * -10;
    const y = (e.clientX - r.left - r.width / 2) / r.width * 10;
    setRotate({ x, y });
  };

  const Icon = feature.icon;

  return (
    <motion.div ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setRotate({ x: 0, y: 0 }); }}
      initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      style={{
        background: hovered ? `rgba(${feature.glow === '#f43f5e' ? '244,63,94' : feature.glow === '#fbbf24' ? '251,191,36' : feature.glow === '#06b6d4' ? '6,182,212' : feature.glow === '#3b82f6' ? '59,130,246' : feature.glow === '#8b5cf6' ? '139,92,246' : '16,185,129'},0.06)` : 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${hovered ? feature.glow + '40' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 20,
        padding: '28px 24px',
        cursor: 'pointer',
        transform: `perspective(800px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateY(${hovered ? -8 : 0}px)`,
        transition: 'transform 0.15s, border-color 0.25s, background 0.25s, box-shadow 0.25s',
        boxShadow: hovered ? `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${feature.glow}18` : '0 4px 20px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', gap: 16,
        borderTop: `2px solid ${hovered ? feature.glow : 'rgba(255,255,255,0.06)'}`,
      }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${feature.glow}18`, border: `1px solid ${feature.glow}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', boxShadow: hovered ? `0 0 20px ${feature.glow}30` : 'none' }}>
        <motion.div animate={hovered && !prefersReduced() ? { rotate: [0, 10, -5, 0], scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.5 }}>
          <Icon size={22} color={feature.glow} />
        </motion.div>
      </div>
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#fff' }}>{feature.title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{feature.desc}</p>
      </div>
    </motion.div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" style={{ padding: 'clamp(60px,8vw,100px) 24px', background: 'linear-gradient(180deg,#030712,#050814)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f43f5e', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>Capabilities</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-1px' }}>Everything Your Shop Needs</h2>
          <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>Built for Indian kirana stores. Not generic software.</p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
          {DEFAULT_FEATURES.map((f, i) => <Feature3DCard key={i} feature={f} index={i} />)}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 5: INTERACTIVE PHONE DEMO ───────────────────────────────────────
function DemoSection() {
  const [activeTab, setActiveTab] = useState('billing');
  const tabs = [
    { id: 'billing', label: '🧾 Billing' },
    { id: 'inventory', label: '📦 Inventory' },
    { id: 'credit', label: '💸 Credit' },
    { id: 'daybook', label: '📊 Reports' },
  ];

  return (
    <section id="demo" style={{ padding: 'clamp(60px,8vw,100px) 24px', background: 'linear-gradient(180deg,#050814,#030712)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#06b6d4', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>Live Preview</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-1px' }}>See It In Action</h2>
          <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>Tap any feature to preview the actual app screen</p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          <motion.div style={{ transform: 'perspective(1200px) rotateY(-4deg) rotateX(2deg)', willChange: 'transform' }}
            initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <PhoneMockup screen={activeTab} />
          </motion.div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {tabs.map(t => (
              <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setActiveTab(t.id)}
                style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: activeTab === t.id ? 'linear-gradient(135deg,#f43f5e,#8b5cf6)' : 'rgba(255,255,255,0.04)', border: activeTab === t.id ? 'none' : '1px solid rgba(255,255,255,0.08)', color: activeTab === t.id ? '#fff' : '#94a3b8' }}>
                {t.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── MARQUEE ROW (module-level to avoid react-hooks/static-components) ────────
function MarqueeRow({ items, reverse }) {
  return (
    <div style={{ overflow: 'hidden', width: '100%', maskImage: 'linear-gradient(to right,transparent,black 10%,black 90%,transparent)' }}>
      <motion.div
        animate={prefersReduced() ? {} : { x: reverse ? ['0%', '50%'] : ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'flex', gap: 16, width: 'max-content' }}>
        {[...items, ...items].map((t, i) => (
          <div key={i} style={{ width: 280, flexShrink: 0, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${['#f43f5e','#8b5cf6','#06b6d4','#10b981','#fbbf24'][i % 5]}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {Array(t.stars).fill(0).map((_, si) => <Star key={si} size={12} fill="#fbbf24" color="#fbbf24" />)}
            </div>
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 12px', lineHeight: 1.5, fontStyle: 'italic' }}>"{t.quote}"</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>{t.name[0]}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>{t.type} • {t.city}</div>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── SECTION 6: TESTIMONIALS ──────────────────────────────────────────────────
function TestimonialsSection() {
  const half = Math.ceil(DEFAULT_TESTIMONIALS.length / 2);
  const row1 = DEFAULT_TESTIMONIALS.slice(0, half);
  const row2 = DEFAULT_TESTIMONIALS.slice(half);

  return (
    <section style={{ padding: 'clamp(60px,8vw,100px) 0', background: 'linear-gradient(180deg,#030712,#050814)', overflow: 'hidden' }}>
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        style={{ textAlign: 'center', marginBottom: 48, padding: '0 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>Social Proof</div>
        <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-1px' }}>Trusted by Shop Owners Across Andhra &amp; Telangana</h2>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
          {[['4.9★', 'Rating'], ['500+', 'Active Shops'], ['₹2Cr+', 'Monthly GMV']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24' }}>{v}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{l}</div>
            </div>
          ))}
        </div>
      </motion.div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <MarqueeRow items={row1} />
        <MarqueeRow items={row2} reverse />
      </div>
    </section>
  );
}

// ─── SECTION 7: PRICING ───────────────────────────────────────────────────────
function PricingSection({ onRegister }) {
  const [tab, setTab] = useState('shops');
  const plans = tab === 'shops' ? SHOP_PLANS : DIST_PLANS;

  return (
    <section id="pricing" style={{ padding: 'clamp(60px,8vw,100px) 24px', background: 'linear-gradient(180deg,#050814,#030712)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-1px' }}>Simple, Transparent Pricing</h2>

          {/* Toggle */}
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 4, gap: 4 }}>
            {[['shops', 'For Shops'], ['distributors', 'For Distributors']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ padding: '8px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: tab === id ? 'linear-gradient(135deg,#f43f5e,#8b5cf6)' : 'transparent', border: 'none', color: tab === id ? '#fff' : '#64748b' }}>
                {label}
              </button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20 }}>
            {plans.map((plan, i) => (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                whileHover={prefersReduced() ? {} : { y: -10, boxShadow: `0 24px 50px rgba(0,0,0,0.5), 0 0 30px ${plan.color}25` }}
                style={{ background: plan.popular ? 'linear-gradient(180deg,rgba(139,92,246,0.08),rgba(15,23,42,0.4))' : 'rgba(255,255,255,0.025)', border: `2px solid ${plan.popular ? plan.color : 'rgba(255,255,255,0.06)'}`, borderRadius: 20, padding: '28px 24px', position: 'relative', cursor: 'pointer', transition: 'border-color 0.3s' }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(90deg,${plan.color},#4f46e5)`, color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 20, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Most Popular</div>
                )}
                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#fff' }}>{plan.name}</h3>
                <div style={{ margin: '12px 0 20px', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>₹{plan.price}</span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>/mo</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Check size={14} color="#10b981" strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={onRegister}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: plan.popular ? `linear-gradient(135deg,${plan.color},#4f46e5)` : 'rgba(255,255,255,0.06)', border: plan.popular ? 'none' : `1px solid rgba(255,255,255,0.1)`, color: '#fff' }}>
                  {plan.id.includes('enterprise') ? 'Contact Sales' : 'Start Free Trial'}
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginTop: 32, padding: '16px 24px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 14 }}>
          <span style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600 }}>🎁 All plans start with <strong>7 days FREE</strong> on PRO features — no credit card needed</span>
        </motion.div>
      </div>
    </section>
  );
}

// ─── SECTION 8: HOW IT WORKS ──────────────────────────────────────────────────
function HowItWorksSection({ onRegister }) {
  const steps = [
    { emoji: '📱', title: 'Download & Register', desc: 'Sign up with your phone number. No documents needed. Takes 30 seconds.', color: '#f43f5e' },
    { emoji: '⚙️', title: 'Set Up Your Shop', desc: 'Add your shop name, upload logo, add 5 products to start.', color: '#8b5cf6' },
    { emoji: '🚀', title: 'Start Billing', desc: 'Create your first bill in 30 seconds. Share on WhatsApp instantly.', color: '#10b981' },
  ];

  return (
    <section id="how-it-works" style={{ padding: 'clamp(60px,8vw,100px) 24px', background: 'linear-gradient(180deg,#030712,#050814)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>Get Started</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-1px' }}>Get Started in 3 Minutes</h2>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 24, position: 'relative' }}>
          {steps.map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '32px 24px', textAlign: 'center', position: 'relative' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${s.color}15`, border: `2px solid ${s.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>{s.emoji}</div>
              <div style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>{i + 1}</div>
              <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: '#fff' }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 }}
          style={{ textAlign: 'center', marginTop: 48 }}>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={onRegister}
            style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '16px 36px', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 30px rgba(244,63,94,0.3)', letterSpacing: '-0.2px' }}>
            🚀 Start Free Now — No Setup Needed
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

// ─── SECTION 9: FAQ ───────────────────────────────────────────────────────────
function FAQSection() {
  const [open, setOpen] = useState(null);

  return (
    <section id="faq" style={{ padding: 'clamp(60px,8vw,100px) 24px', background: 'linear-gradient(180deg,#050814,#030712)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#06b6d4', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>FAQ</div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-1px' }}>Common Questions</h2>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQS.map((faq, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${open === i ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              <button onClick={() => setOpen(open === i ? null : i)}
                style={{ width: '100%', padding: '18px 20px', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{faq.q}</span>
                <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  {open === i ? <Minus size={16} color="#8b5cf6" /> : <Plus size={16} color="#64748b" />}
                </motion.div>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                    <p style={{ padding: '0 20px 18px', margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>{faq.a}</p>
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

// ─── SECTION 10: FINAL CTA ────────────────────────────────────────────────────
function FinalCTASection({ onRegister }) {
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowNotif(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <section style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(60px,8vw,100px) 24px', position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 50%,rgba(244,63,94,0.08) 0%,rgba(139,92,246,0.06) 40%,#030712 100%)' }}>

      {/* Particle field */}
      {!prefersReduced() && Array.from({ length: 20 }).map((_, i) => (
        <motion.div key={i}
          animate={{ y: ['100vh', '-10vh'], opacity: [0, 0.6, 0] }}
          transition={{ duration: 6 + (i % 5), repeat: Infinity, delay: (i * 0.8) % 8, ease: 'linear' }}
          style={{ position: 'absolute', left: `${(i * 17 + 5) % 95}%`, width: 1.5, height: 1.5, borderRadius: '50%', background: ['#f43f5e', '#8b5cf6', '#06b6d4'][i % 3], pointerEvents: 'none' }}
        />
      ))}

      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: 700 }}>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ fontSize: 'clamp(20px,3.5vw,28px)', color: '#fbbf24', fontWeight: 700, marginBottom: 8 }}>
          మీ షాపు, మీ అప్లికేషన్.
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
          style={{ fontSize: 'clamp(32px,6vw,60px)', fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-2px', lineHeight: 1.1 }}>
          Your Shop. Your App.
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
          style={{ fontSize: 16, color: '#64748b', marginBottom: 40 }}>
          Join 500+ smart shop owners across Andhra &amp; Telangana.
        </motion.p>
        <motion.button
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 60px rgba(244,63,94,0.5)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onRegister}
          style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', padding: '18px 48px', borderRadius: 16, fontSize: 18, fontWeight: 900, cursor: 'pointer', boxShadow: '0 0 40px rgba(244,63,94,0.35)', letterSpacing: '-0.3px', marginBottom: 20 }}>
          🚀 Start Your Free 7-Day Trial
        </motion.button>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
          style={{ fontSize: 13, color: '#475569' }}>
          No credit card &nbsp;•&nbsp; Cancel anytime &nbsp;•&nbsp; Works offline
        </motion.div>
      </div>

      {/* Live notification */}
      <AnimatePresence>
        {showNotif && (
          <motion.div initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}
            style={{ position: 'fixed', bottom: 80, right: 20, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#fff', zIndex: 100, maxWidth: 260, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
              <span><strong>Ravi</strong> from Vijayawada just started a free trial</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── SECTION 11: FOOTER ───────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#030712', borderTop: '1px solid rgba(255,255,255,0.06)', padding: 'clamp(40px,6vw,72px) 24px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 40, marginBottom: 48 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src="/logo.png" alt="MyStore OS" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
              <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>MyStore OS</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>The complete pocket OS for Indian kirana shop owners. Manage smarter, grow faster.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['WhatsApp', '📱'], ['Instagram', '📷']].map(([l, emoji]) => (
                <div key={l} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer' }}>{emoji}</div>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Product</h4>
            {[['Features', '#features'], ['Pricing', '#pricing'], ['For Distributors', '#pricing'], ['For CA / Accountants', '#faq']].map(([l, href]) => (
              <div key={l} style={{ marginBottom: 10 }}>
                <a href={href} style={{ fontSize: 14, color: '#475569', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = '#94a3b8'} onMouseLeave={e => e.target.style.color = '#475569'}>{l}</a>
              </div>
            ))}
          </div>

          {/* Company */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Company</h4>
            {['About Us', 'Contact', 'Privacy Policy', 'Terms of Service'].map(l => (
              <div key={l} style={{ marginBottom: 10 }}>
                <a href="#" style={{ fontSize: 14, color: '#475569', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = '#94a3b8'} onMouseLeave={e => e.target.style.color = '#475569'}>{l}</a>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Contact Us</h4>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.8 }}>
              <div>📱 +91-8885490495</div>
              <div>📧 support@mystoreos.in</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>📍 Andhra Pradesh, India</div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#334155' }}>© 2026 MyStore OS • Made with ❤️ in Andhra Pradesh</span>
          <span style={{ fontSize: 12, color: '#1e293b' }}>Powered by React • Supabase</span>
        </div>
      </div>
    </footer>
  );
}

// ─── RESPONSIVE CSS ───────────────────────────────────────────────────────────
const CSS = `
  html { scroll-behavior: smooth; }
  body { margin:0; font-family:'Outfit',sans-serif; background:#030712; color:#fff; }
  *, *::before, *::after { box-sizing:border-box; }
  .hero-grid { grid-template-columns: minmax(0,1fr); }
  .hero-phone { display:flex; }
  .stats-grid { grid-template-columns: repeat(2,1fr); }
  .story-grid { grid-template-columns: minmax(0,1fr); }
  .nav-mobile-btn { display:flex; }
  .nav-desktop { display:none; }
  @media(min-width:768px){
    .hero-grid { grid-template-columns: 1fr 1fr; }
    .stats-grid { grid-template-columns: repeat(4,1fr); }
    .story-grid { grid-template-columns: 1fr 1fr; }
    .nav-desktop { display:flex; }
    .nav-mobile-btn { display:none; }
  }
  @media(prefers-reduced-motion:reduce){
    *, *::before, *::after { animation-duration:0.01ms !important; transition-duration:0.01ms !important; }
  }
`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  useEffect(() => {
    api.seedSubscriptionPlans().catch(() => {});
  }, []);

  const onRegister = () => navigate('/register');
  const onLogin = () => navigate('/login');

  return (
    <>
      <style>{CSS}</style>
      <Navbar onLogin={onLogin} onRegister={onRegister} />
      <HeroSection config={config} onRegister={onRegister} />
      <StatsSection />
      <StorySection />
      <FeaturesSection />
      <DemoSection />
      <TestimonialsSection />
      <PricingSection onRegister={onRegister} />
      <HowItWorksSection onRegister={onRegister} />
      <FAQSection />
      <FinalCTASection onRegister={onRegister} />
      <Footer />
    </>
  );
};

export default LandingPage;
