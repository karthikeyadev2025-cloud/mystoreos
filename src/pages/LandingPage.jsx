import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Receipt, Package, Book, Wallet, Smartphone, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const DEFAULT_HERO_CONFIG = {
  headline: 'The Fast, Simple, WhatsApp-Native\nRetail Operating System.',
  subtitle: 'No GST headaches. No heavy computers. No paper printouts.\nRun your entire retail shop from your phone with paperless bills & UPI payment deep links.',
  buttonText: '🚀 Start Billing Free'
};

const DEFAULT_PRICING_CONFIG = {
  proPrice: '999',
  freeFeatures: 'Standard billing, 50 products catalog, Basic day book',
  proFeatures: 'Unlimited invoices, WhatsApp receipt sharing, Proforma estimates, Delivery challans, Smart stock reorder alerts, Near-expiry warnings, Multi-role helper staff log, Unified customer outstanding book, WhatsApp UPI reminders'
};

const LandingPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -40]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0.1]);

  const [heroConfig, setHeroConfig] = useState(DEFAULT_HERO_CONFIG);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [activeBillPreview, setActiveBillPreview] = useState('bill'); // 'bill' | 'estimate' | 'challan'

  const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  };

  const stagger = (i) => ({
    ...fadeUp,
    transition: { opacity: { duration: 0.5, delay: i * 0.08 }, y: { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] } }
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const hConfig = await api.getSiteConfig('hero', DEFAULT_HERO_CONFIG);
        const pConfig = await api.getSiteConfig('pricing', DEFAULT_PRICING_CONFIG);
        setHeroConfig(hConfig);
        setPricingConfig(pConfig);
      } catch (e) {
        console.error("CMS Load Error", e);
      }
    };
    loadData();
  }, []);

  return (
    <div ref={containerRef} style={{ backgroundColor: '#070a13', color: '#f1f5f9', overflowX: 'hidden', fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
      {/* Modern Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ══════════════════════════════════════════════
          STICKY NAVIGATION BAR
      ══════════════════════════════════════════════ */}
      <header style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 1000, backdropFilter: 'blur(16px)', background: 'rgba(7, 10, 19, 0.75)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '26px' }}>⚡</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #fff 40%, #fbbf24 70%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MyStore OS</span>
            <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '20px', fontWeight: 'bold' }}>NO-GST</span>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => navigate('/login')} style={{ background: 'transparent', color: '#94a3b8', border: 'none', padding: '10px 20px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#94a3b8'}>
              Sign In
            </button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#070a13', border: 'none', padding: '10px 22px', borderRadius: '12px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(251,191,36,0.2)' }}>
              Join Free
            </motion.button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════ */}
      <motion.section style={{ y: heroY, opacity: heroOpacity, minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Colorful Blurred Radial Orbs */}
        <div style={{ position: 'absolute', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', top: '-10%', left: '10%', borderRadius: '50%', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', bottom: '5%', right: '5%', borderRadius: '50%', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', borderRadius: '50%', filter: 'blur(60px)' }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: '900px', margin: '0 auto' }}>
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fbbf24', padding: '6px 18px', borderRadius: '30px', fontSize: '12px', fontWeight: 800, marginBottom: '24px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            <span>⚡ THE ULTA-FAST PAPERLESS REVOLUTION</span>
          </motion.div>

          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(36px, 6.5vw, 68px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 24px 0', background: 'linear-gradient(135deg, #ffffff 40%, #fcd34d 75%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'pre-line', letterSpacing: '-1px' }}>
            {heroConfig.headline}
          </h1>

          <p style={{ fontSize: 'clamp(15px, 2.2vw, 19px)', color: '#94a3b8', lineHeight: 1.6, margin: '0 auto 40px', maxWidth: '680px', fontWeight: 400, whiteSpace: 'pre-line' }}>
            {heroConfig.subtitle}
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '48px' }}>
            <motion.button whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(251,191,36,0.45)' }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#070a13', border: 'none', padding: '18px 36px', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 30px rgba(251,191,36,0.3)', letterSpacing: '0.2px' }}>
              {heroConfig.buttonText}
            </motion.button>
            <motion.button whileHover={{ scale: 1.04, background: 'rgba(255,255,255,0.08)' }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/login')} style={{ background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', padding: '18px 36px', borderRadius: '16px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}>
              Login to Shop →
            </motion.button>
          </div>

          {/* Quick Info Grid */}
          <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['📱 Fits on Mobile Screen', '⚡ Bill in 30 Seconds', '💬 Shared via WhatsApp', '🔋 Works Fully Offline'].map((t, i) => (
              <span key={i} style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#10b981' }}>✓</span> {t}
              </span>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════
          SECTION 2 — THE PRESET BILL PREVIEWS SHOWCASE
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '60px 24px', background: '#0b0f19', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>PAPERLESS PRESETS</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4.5vw, 40px)', fontWeight: 800, margin: '8px 0 12px', color: '#fff' }}>
              Clean, Branded Formats for Every Trade
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
              Instantly toggle between billing presets configured with gorgeous PDF formats shared straight to WhatsApp.
            </p>
          </motion.div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'center' }}>
            
            {/* Left Controls Column */}
            <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { id: 'bill', title: '🧾 Standard Tax Invoice', desc: 'Sleek invoice format designed to generate retail bills. Includes customized shop brand logo, UPI QR payments, discount code, and digital thank-you notes.', border: '#10b981' },
                { id: 'estimate', title: '📋 Proforma Estimate / Quote', desc: 'Professional price estimation to capture drafts, save quotes in the Estimates Drawer, and load into a live cart in one click when customers buy.', border: '#fbbf24' },
                { id: 'challan', title: '🚚 Delivery Challan', desc: 'Compliant delivery sheet for goods in transit. Pre-filled with product quantities and custom descriptions for smart delivery dispatch.', border: '#3b82f6' }
              ].map((item) => (
                <div key={item.id} onClick={() => setActiveBillPreview(item.id)} style={{
                  padding: '20px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.3s',
                  background: activeBillPreview === item.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: '1px solid ' + (activeBillPreview === item.id ? item.border : 'rgba(255,255,255,0.05)'),
                  boxShadow: activeBillPreview === item.id ? `0 8px 30px ${item.border}15` : 'none'
                }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 'bold', color: activeBillPreview === item.id ? '#fff' : '#cbd5e1' }}>{item.title}</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Right Invoice Preview Card (HTML Branded Simulator) */}
            <div style={{ flex: '1 1 450px', maxWidth: '480px', background: '#fff', color: '#0f172a', borderRadius: '24px', padding: '24px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: '12px' }}>
              
              {/* Header Colored Border */}
              <div style={{
                height: '8px', margin: '-24px -24px 20px -24px', borderRadius: '24px 24px 0 0',
                background: activeBillPreview === 'bill' ? '#10b981' : activeBillPreview === 'estimate' ? '#fbbf24' : '#3b82f6'
              }} />

              {/* Shop Logo Representation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800 }}>VIGNESH PROVISIONS</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '10px' }}>Ph: 9876543210 • UPI ID: vignesh@ybl</p>
                </div>
                <div style={{ background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🛒</div>
              </div>

              {/* Title Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{
                  fontWeight: 'bold', fontSize: '13px', padding: '2px 8px', borderRadius: '4px',
                  background: activeBillPreview === 'bill' ? '#d1fae5' : activeBillPreview === 'estimate' ? '#fef3c7' : '#dbeafe',
                  color: activeBillPreview === 'bill' ? '#065f46' : activeBillPreview === 'estimate' ? '#92400e' : '#1e40af'
                }}>
                  {activeBillPreview === 'bill' ? 'TAX INVOICE' : activeBillPreview === 'estimate' ? 'PROFORMA ESTIMATE' : 'DELIVERY CHALLAN'}
                </span>
                <span style={{ color: '#64748b' }}>Date: 20-May-2026</span>
              </div>

              {/* Customer Info */}
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '16px', borderLeft: '3px solid #cbd5e1' }}>
                <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>To: Ramesh Kumar (Customer)</p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '10px' }}>Ph: +91 9988776655</p>
              </div>

              {/* Table details */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px' }}>
                  <span style={{ flex: 2 }}>ITEM</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>QTY</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>PRICE</span>
                </div>
                {[
                  { name: 'Aashirvaad Atta 5kg', qty: '1', price: '260' },
                  { name: 'Gold Drop Sunflower Oil 1L', qty: '2', price: '280' },
                  { name: 'Tata Salt Lite 1kg', qty: '1', price: '28' }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#334155' }}>
                    <span style={{ flex: 2 }}>{item.name}</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>{item.qty}</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>₹{item.price}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', fontSize: '11px' }}>
                {activeBillPreview === 'bill' && <span style={{ color: '#ef4444' }}>Discount (FLAT100): -₹100</span>}
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                  GRAND TOTAL: {activeBillPreview === 'bill' ? '₹468' : '₹568'}
                </span>
              </div>

              {/* Footnotes */}
              <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '9px', color: '#94a3b8' }}>
                {activeBillPreview === 'bill' ? (
                  <p style={{ color: '#059669', fontWeight: 'bold', margin: 0 }}>✓ Bill Generated & Paid Instantly via UPI</p>
                ) : activeBillPreview === 'estimate' ? (
                  <p style={{ color: '#d97706', fontWeight: 'bold', margin: 0 }}>⚠️ Estimate Valid for 30 Days. Save to Drafts.</p>
                ) : (
                  <p style={{ color: '#2563eb', fontWeight: 'bold', margin: 0 }}>🚚 Goods in Transit. Checked & Dispatched.</p>
                )}
                <p style={{ margin: '4px 0 0 0' }}>Powered by paperless MyStore OS</p>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 3 — FEATURE SHOWCASE GRIDS (GLASSMORPHISM)
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '80px 24px', background: '#070a13' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>PRODUCTIVITY HUB</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 800, margin: '8px 0 12px', color: '#fff' }}>
              Built to Close Every Accounting Gap
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
              Enjoy direct, clean retail utilities. Simple workflows configured for shop owners, helpers, and distributors.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {[
              {
                icon: <Receipt size={32} color="#10b981" />,
                title: '🧾 Paperless Invoicing',
                desc: 'Generate gorgeous standard bills, proforma quotations, and delivery challans directly on mobile. Send via WhatsApp in seconds without expensive paper roll thermal printers.',
                glow: 'rgba(16,185,129,0.1)'
              },
              {
                icon: <Package size={32} color="#fbbf24" />,
                title: '📦 Advanced Inventory Center',
                desc: 'Stay protected from expired stock. Includes batch tracking, dynamic near-expiry warnings (alerts within 90 days), automatic low stock warnings, and multi-variant dropdown selections.',
                glow: 'rgba(251,191,36,0.1)'
              },
              {
                icon: <Book size={32} color="#a78bfa" />,
                title: '📖 Today\'s Retail Day Book',
                desc: 'No complicated double-entry accounting formulas. View a clean transaction ledger showing all of today\'s Cash In (sales + customer dues settled) vs Cash Out (purchases) with dynamic circular profit margin gauges.',
                glow: 'rgba(167,139,250,0.1)'
              },
              {
                icon: <Wallet size={32} color="#ef4444" />,
                title: '💸 Unified Credit Ledger',
                desc: 'Manage B2B supplier payables and B2C customer receivables side-by-side. Shoot polite reminders directly to customers via WhatsApp containing custom auto-filled UPI deep-payment links.',
                glow: 'rgba(239,68,68,0.1)'
              },
              {
                icon: <Smartphone size={32} color="#3b82f6" />,
                title: '🤝 Team & Staff Delegations',
                desc: 'Safely add your shop helper staff with a unique mobile 4-digit PIN. Staff can scan barcodes and bill walk-ins but are locked out of profit day books, wholesale buying, and profile settings.',
                glow: 'rgba(59,130,246,0.1)'
              },
              {
                icon: <RefreshCw size={32} color="#06b6d4" />,
                title: '🔄 FMCG Distributor Restocks',
                desc: 'Direct distributor connection. Reorder your inventory directly from FMCG catalog stocks. Place bulk orders on credit which automatically updates your supplier payable ledger on delivery.',
                glow: 'rgba(6,182,212,0.1)'
              }
            ].map((card, i) => (
              <motion.div key={i} {...stagger(i)} whileHover={{ y: -6, borderColor: 'rgba(255,255,255,0.15)', boxShadow: `0 12px 30px ${card.glow}` }} style={{
                background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px', padding: '32px 24px',
                transition: 'all 0.3s ease-in-out'
              }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                  {card.icon}
                </div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#fff' }}>{card.title}</h3>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#94a3b8', lineHeight: 1.6 }}>{card.desc}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 4 — COMPARATIVE MATRIX (VS VYAPAR)
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '80px 24px', background: '#0b0f19', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '50px' }}>
            <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>HEAD-TO-HEAD</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4.5vw, 40px)', fontWeight: 800, margin: '8px 0 12px', color: '#fff' }}>
              Why Retailers Choose Us <span style={{ color: '#fbbf24' }}>over Vyapar</span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
              Vyapar is great for heavy, complex GST accounting. But for fast, simple daily retail, MyStore OS wins.
            </p>
          </motion.div>

          {/* Table Container */}
          <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold', color: '#fff' }}>FEATURES</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold', color: '#94a3b8' }}>VYAPAR RETAIL</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold', color: '#fbbf24' }}>MYSTORE OS (US)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: '💼 Accounting Focus', vyapar: 'Heavy GST reports & tax double-entry', mystore: '100% No-GST simple paperless speed', status: 'mystore' },
                  { feature: '🧾 Multi-Format Billing', vyapar: 'Only Tax Invoice (hard setup)', mystore: 'Invoice, Estimate drawer & Challan toggles', status: 'mystore' },
                  { feature: '📦 Batch Expiry Warnings', vyapar: 'Locked under heavy Desktop plans', mystore: 'Dynamic Expiry Warnings built for everyone', status: 'mystore' },
                  { feature: '💬 Payment Auto Reminders', vyapar: 'Standard boring text message', mystore: 'Pre-filled WhatsApp UPI payment deep links', status: 'mystore' },
                  { feature: '📈 Daily Cash Ledger', vyapar: 'Complex Balance Sheet entries', mystore: 'Sleek Day Book list + Circular Margin Gauge', status: 'mystore' },
                  { feature: '🔌 Device Deployment', vyapar: 'Heavy Android / Windows software', mystore: 'Ultra-light PWA works inside any browser', status: 'mystore' }
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#fff' }}>{row.feature}</td>
                    <td style={{ padding: '16px 20px', color: '#64748b' }}>❌ {row.vyapar}</td>
                    <td style={{ padding: '16px 20px', color: '#a7f3d0', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.03)' }}>✓ {row.mystore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 5 — PRICING SECTION
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '80px 24px', background: '#070a13' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '65px' }}>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>NO RISK PRICING</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 800, margin: '8px 0 12px', color: '#fff' }}>
              One Pro Plan. Unlimited Power.
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px' }}>Start 100% free with basic billing. Upgrade only when you are ready.</p>
          </motion.div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'center', alignItems: 'stretch' }}>
            
            {/* Free Plan Card */}
            <motion.div {...fadeUp} style={{
              flex: '1 1 300px', maxWidth: '380px',
              background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '24px', padding: '40px 32px', display: 'flex', flexDirection: 'column'
            }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>STARTER SEED</span>
              <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: '#fff' }}>Free</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Forever free for small shops</p>
              
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '24px' }}>
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>Ideal for basic point of sale billing.</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', color: '#94a3b8' }}>
                {(pricingConfig.freeFeatures || '').split(',').map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> {f.trim()}
                  </li>
                ))}
                {['Estimates & Challans', 'Expiry Warning badging', 'UPI payments auto remind', 'Wholesale catalog ordering'].map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.35 }}>
                    <span>✕</span> {f}
                  </li>
                ))}
              </ul>

              <button onClick={() => navigate('/register')} style={{
                width: '100%', padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', transition: 'all 0.2s'
              }} onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                Get Started Free
              </button>
            </motion.div>

            {/* Pro Plan Card (Highly Featured Glassmorphism) */}
            <motion.div {...fadeUp} whileHover={{ y: -6 }} style={{
              flex: '1 1 340px', maxWidth: '420px',
              background: 'linear-gradient(135deg, rgba(251,191,36,0.04) 0%, rgba(16,185,129,0.02) 100%)',
              border: '2px solid rgba(251,191,36,0.25)', borderRadius: '24px', padding: '40px 32px',
              display: 'flex', flexDirection: 'column', position: 'relative',
              boxShadow: '0 20px 40px rgba(251,191,36,0.05)'
            }}>
              <div style={{ position: 'absolute', top: -14, right: 28, background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#070a13', fontSize: '10px', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>
                RECOMMENDED
              </div>

              <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>MYSTORE PRO NODE</span>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '42px', fontWeight: 900, color: '#fbbf24' }}>₹{pricingConfig.proPrice}</span>
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>/month</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Only ₹33 a day — less than a cup of tea! ☕</p>
              
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '24px' }}>
                <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 'bold' }}>Unlocks the full power of MyStore OS.</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', color: '#cbd5e1' }}>
                {(pricingConfig.proFeatures || '').split(',').map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold', marginTop: '2px' }}>✓</span>
                    <span>{f.trim()}</span>
                  </li>
                ))}
              </ul>

              <button onClick={() => navigate('/register')} style={{
                width: '100%', padding: '16px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '15px',
                background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#070a13', border: 'none',
                boxShadow: '0 6px 20px rgba(251,191,36,0.25)', transition: 'transform 0.2s'
              }}>
                Start 7-Day Free Trial
              </button>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 6 — FINAL CTA
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '100px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 60%)' }} />
        
        <motion.div {...fadeUp} style={{ maxWidth: '650px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(30px, 5.5vw, 48px)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 20px 0' }}>
            Ready to Take Your Retail Shop<br/>
            <span style={{ background: 'linear-gradient(135deg, #fbbf24, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>100% Paperless?</span>
          </h2>
          <p style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '8px' }}>Switch from legacy books to the smartest mobile operating system.</p>
          <p style={{ fontSize: '15px', color: '#fbbf24', fontWeight: 'bold', marginBottom: '36px' }}>మీ షాపును స్మార్ట్ డిజిటల్ దుకాణంగా మార్చండి 🚀</p>
          
          <motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(16,185,129,0.4)' }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '18px 44px', borderRadius: '16px', fontSize: '17px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 30px rgba(16, 185, 129, 0.3)' }}>
            Start Your Free Trial Now
          </motion.button>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer style={{ padding: '50px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', background: '#0b0f19' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', fontSize: '13.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, color: '#94a3b8', fontWeight: 'bold' }}>⚡ MyStore OS — India\'s Smartest Retail Operating System</p>
          <p style={{ margin: 0 }}>© 2026 MyStore OS. Made with ❤️ in Guntur, Andhra Pradesh</p>
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px' }}>
            <span onClick={() => navigate('/login')} style={{ cursor: 'pointer', color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>Login</span>
            <span onClick={() => navigate('/register')} style={{ cursor: 'pointer', color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>Register</span>
            <span onClick={() => window.open('https://wa.me/918885490495', '_blank')} style={{ cursor: 'pointer', color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>Contact Whatsapp Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
