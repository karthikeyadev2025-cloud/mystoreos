import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { CheckCircle, X, Zap, Shield, Smartphone, TrendingUp } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  const fadeUp = { initial: { opacity: 0, y: 60 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } };
  const stagger = (i) => ({ ...fadeUp, transition: { ...fadeUp.transition, delay: i * 0.1 } });

  return (
    <div ref={containerRef} style={{ backgroundColor: '#030712', color: '#e2e8f0', overflowX: 'hidden', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ══════════════════════════════════════════════
          SECTION 1 — HERO 
      ══════════════════════════════════════════════ */}
      <motion.section style={{ y: heroY, opacity: heroOpacity, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Animated gradient orbs */}
        <motion.div animate={{ scale: [1, 1.3, 1], rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} style={{ position: 'absolute', width: '70vw', height: '70vw', maxWidth: 900, maxHeight: 900, background: 'radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%)', top: '-15%', left: '-20%', borderRadius: '50%' }} />
        <motion.div animate={{ scale: [1, 1.2, 1], rotate: -360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} style={{ position: 'absolute', width: '50vw', height: '50vw', maxWidth: 700, maxHeight: 700, background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)', bottom: '-10%', right: '-15%', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} style={{ zIndex: 10, maxWidth: 800 }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ display: 'inline-block', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fbbf24', padding: '8px 20px', borderRadius: '30px', fontSize: '13px', fontWeight: 700, marginBottom: '28px', letterSpacing: '1.5px' }}>
            🔥 INDIA'S SMARTEST RETAIL OS
          </motion.div>

          <h1 style={{ fontSize: 'clamp(36px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.05, margin: '0 0 24px 0', background: 'linear-gradient(135deg, #ffffff 30%, #fbbf24 60%, #ef4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Your Phone is<br/>Your Billing<br/>Machine.
          </h1>

          <p style={{ fontSize: 'clamp(16px, 2.5vw, 22px)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 auto 16px', maxWidth: 550, fontWeight: 300 }}>
            No computer. No printer. No paper rolls.<br/>Just your phone and 30 seconds to send a branded bill on WhatsApp.
          </p>
          <p style={{ fontSize: 'clamp(14px, 2vw, 18px)', color: '#fbbf24', fontWeight: 700, marginBottom: '48px' }}>
            కంప్యూటర్ లేకుండా • ప్రింటర్ లేకుండా • కాగితం లేకుండా
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.button whileHover={{ scale: 1.04, boxShadow: '0 0 50px rgba(220,38,38,0.5)' }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #dc2626, #ea580c)', color: 'white', border: 'none', padding: '18px 40px', borderRadius: '16px', fontSize: '17px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 30px rgba(220,38,38,0.35)', letterSpacing: '0.5px' }}>
              🚀 Start Free — No Card Needed
            </motion.button>
            <motion.button whileHover={{ scale: 1.04, background: 'rgba(255,255,255,0.1)' }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/login')} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '18px 40px', borderRadius: '16px', fontSize: '17px', fontWeight: 600, cursor: 'pointer' }}>
              Login →
            </motion.button>
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '48px', flexWrap: 'wrap' }}>
            {['🏪 50+ Shops Live', '📱 Works Offline', '🇮🇳 Made for India'].map((t, i) => (
              <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 + i * 0.2 }} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{t}</motion.span>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* ══════════════════════════════════════════════
          SECTION 2 — THE PAIN (Storytelling) 
      ══════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(60px, 10vw, 120px) 24px', background: '#030712', position: 'relative' }}>
        <motion.div {...fadeUp} style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 64px' }}>
          <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>THE REALITY TODAY</span>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, margin: '12px 0 16px', lineHeight: 1.15 }}>
            Every Shopkeeper in India<br/>Faces <span style={{ color: '#ef4444' }}>This Problem</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', lineHeight: 1.7 }}>Your shop does ₹50,000/day business. But you still write bills by hand, forget who owes money, and lose customers to the shop next door that went digital.</p>
        </motion.div>

        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {[
            { icon: '📝', title: 'Hand-written bills', desc: 'Takes 5 minutes per customer. Ink smudges. Paper gets lost. No record after one week.', color: '#ef4444' },
            { icon: '💸', title: '₹15,000/year on billing', desc: 'Computer ₹25,000 + Printer ₹8,000 + Paper rolls ₹200/month + Electricity ₹2,000/month', color: '#f59e0b' },
            { icon: '😤', title: 'Customer walks away', desc: '"Bhaiya jaldi karo" — long billing queue means lost sales. The digital shop next door is faster.', color: '#ef4444' },
            { icon: '📒', title: 'Udhar confusion', desc: 'Who owes ₹500? When did they promise to pay? That notebook page is torn. ₹2 lakh stuck in credit.', color: '#f59e0b' },
            { icon: '🏪', title: 'No online presence', desc: 'Your competitor shares WhatsApp catalog. Gets orders while sleeping. You still wait for walk-ins only.', color: '#ef4444' },
            { icon: '📊', title: 'Zero visibility', desc: 'What sold most today? Which product is dead stock? What is my real profit? No idea. Just guessing.', color: '#f59e0b' }
          ].map((p, i) => (
            <motion.div key={i} {...stagger(i)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px 24px' }}>
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '16px' }}>{p.icon}</span>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: p.color, margin: '0 0 8px' }}>{p.title}</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0 }}>{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 3 — THE SOLUTION (Your Journey) 
      ══════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(60px, 10vw, 120px) 24px', background: 'linear-gradient(180deg, #030712, #0c1222)', position: 'relative' }}>
        <motion.div {...fadeUp} style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 64px' }}>
          <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>YOUR TRANSFORMATION</span>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, margin: '12px 0', lineHeight: 1.15 }}>
            From Struggling to<br/><span style={{ color: '#22c55e' }}>Smart in 4 Steps</span>
          </h2>
        </motion.div>

        <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: 28, top: 0, bottom: 0, width: '2px', background: 'linear-gradient(180deg, #ef4444, #f59e0b, #3b82f6, #22c55e)', opacity: 0.3 }} />

          {[
            { step: '01', icon: '😫', title: 'The Struggle', text: 'You spend 5 hours daily on billing, credit tracking, and inventory. Your notebook is your only system. One page tears — ₹50,000 in credit records gone forever.', color: '#ef4444' },
            { step: '02', icon: '💡', title: 'The Discovery', text: 'You see the shopkeeper across the street scan a product, auto-generate a bill, and send it to WhatsApp — all in 10 seconds. No computer. Just his phone.', color: '#f59e0b' },
            { step: '03', icon: '📱', title: 'Day 1 with MyStore', text: 'You add your 200 products. Set your UPI QR. Upload your shop logo. Your first customer gets a branded PDF receipt on WhatsApp. Their face lights up. "Bahut professional hai bhaiya!"', color: '#3b82f6' },
            { step: '04', icon: '🚀', title: '30 Days Later', text: 'You have 150 customers in your database. Online orders come at 11pm. Distributor credit is tracked to the last rupee. Your shop runs itself while you sleep.', color: '#22c55e' }
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, delay: i * 0.15 }} style={{ display: 'flex', gap: '24px', marginBottom: '48px', position: 'relative' }}>
              <div style={{ width: 56, height: 56, borderRadius: '16px', background: `linear-gradient(135deg, ${s.color}20, ${s.color}05)`, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0, zIndex: 2 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: s.color, letterSpacing: '2px', marginBottom: '4px' }}>STEP {s.step}</div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>{s.title}</h3>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0 }}>{s.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 4 — FEATURES GRID 
      ══════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(60px, 10vw, 120px) 24px', background: '#030712' }}>
        <motion.div {...fadeUp} style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 64px' }}>
          <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>EVERYTHING YOU NEED</span>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, margin: '12px 0', lineHeight: 1.15 }}>
            One App. <span style={{ color: '#818cf8' }}>Every Feature.</span>
          </h2>
        </motion.div>

        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {[
            { icon: '📸', title: 'Camera Barcode Scanner', desc: 'Scan any product barcode with your phone camera. No external scanner needed.', tag: 'BILLING' },
            { icon: '📄', title: 'Branded PDF Receipts', desc: 'Auto-generated receipts with your shop logo. Send via WhatsApp in one tap.', tag: 'BILLING' },
            { icon: '💳', title: 'UPI QR Payment', desc: 'Upload your GPay/PhonePe/Paytm QR. Customers scan and pay instantly.', tag: 'PAYMENTS' },
            { icon: '📦', title: 'Smart Inventory', desc: 'Track stock levels. Get AI alerts when products run low. Add products in seconds.', tag: 'INVENTORY' },
            { icon: '📒', title: 'Credit Ledger', desc: 'Track every rupee of distributor credit. Mark paid with one tap. No more confusion.', tag: 'FINANCE' },
            { icon: '🌐', title: 'Online Shop Link', desc: 'Share your shop link on WhatsApp. Customers browse and order from home.', tag: 'ONLINE' },
            { icon: '📸', title: 'Shop Photos & Profile', desc: 'Upload shop photos, logo, and QR. Build your brand identity online.', tag: 'BRANDING' },
            { icon: '👥', title: 'Staff Management', desc: 'Add staff with limited access. They can bill but cannot see revenue or settings.', tag: 'TEAM' },
            { icon: '📊', title: 'Revenue Dashboard', desc: 'See daily revenue, top products, total orders, and credit dues at a glance.', tag: 'ANALYTICS' }
          ].map((f, i) => (
            <motion.div key={i} {...stagger(i)} whileHover={{ y: -4, borderColor: 'rgba(255,255,255,0.12)' }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '28px 24px', transition: 'all 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span style={{ fontSize: '32px' }}>{f.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', background: 'rgba(129,140,248,0.1)', padding: '4px 10px', borderRadius: '20px', letterSpacing: '1px' }}>{f.tag}</span>
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>{f.title}</h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 5 — WHO IS IT FOR 
      ══════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(60px, 10vw, 100px) 24px', background: 'linear-gradient(180deg, #030712, #0a0f1e)' }}>
        <motion.div {...fadeUp} style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 48px' }}>
          <span style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>BUILT FOR EVERY BUSINESS</span>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, margin: '12px 0', lineHeight: 1.15 }}>
            Who Uses <span style={{ color: '#fbbf24' }}>MyStore OS?</span>
          </h2>
        </motion.div>

        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { icon: '🛒', title: 'Kirana / Supermarket', desc: 'Daily essentials, groceries, FMCG' },
            { icon: '💊', title: 'Medical Store', desc: 'Medicines, prescriptions, health' },
            { icon: '📱', title: 'Mobile Shop', desc: 'Phones, accessories, repairs' },
            { icon: '👗', title: 'Clothing Store', desc: 'Garments, fashion, textiles' },
            { icon: '🔧', title: 'Hardware Shop', desc: 'Tools, electrical, plumbing' },
            { icon: '🍛', title: 'Restaurant / Tiffin', desc: 'Food orders, delivery, dine-in' },
            { icon: '📚', title: 'Book / Stationery', desc: 'Books, supplies, xerox' },
            { icon: '💈', title: 'Salon / Parlour', desc: 'Appointments, services, billing' }
          ].map((b, i) => (
            <motion.div key={i} {...stagger(i)} style={{ background: 'rgba(251,191,36,0.03)', border: '1px solid rgba(251,191,36,0.08)', borderRadius: '16px', padding: '24px 20px', textAlign: 'center' }}>
              <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>{b.icon}</span>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>{b.title}</h3>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 6 — PRICING 
      ══════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(60px, 10vw, 120px) 24px', background: '#030712' }}>
        <motion.div {...fadeUp} style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 56px' }}>
          <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>SIMPLE PRICING</span>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, margin: '12px 0', lineHeight: 1.15 }}>
            Start Free. <span style={{ color: '#22c55e' }}>Upgrade When Ready.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>No hidden charges. No card required. Cancel anytime.</p>
        </motion.div>

        <div style={{ maxWidth: 850, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
          {/* FREE Plan */}
          <motion.div {...fadeUp} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '36px 28px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', marginBottom: '8px' }}>STARTER</div>
            <div style={{ fontSize: '48px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>Free</div>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '28px' }}>forever / ఎప్పటికీ ఉచితం</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', flex: 1 }}>
              {['Up to 50 products', 'WhatsApp billing', 'Barcode scanner', 'Customer orders', 'Basic dashboard'].map((f, i) => (
                <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                  <CheckCircle size={16} color="#22c55e" /> {f}
                </li>
              ))}
              {['Credit ledger', 'Staff management', 'Online shop link', 'Shop photos & QR'].map((f, i) => (
                <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'rgba(255,255,255,0.25)' }}>
                  <X size={16} color="#475569" /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
              Get Started Free
            </button>
          </motion.div>

          {/* PRO Plan */}
          <motion.div {...fadeUp} whileHover={{ y: -6 }} style={{ background: 'linear-gradient(145deg, rgba(220,38,38,0.08), rgba(251,191,36,0.04))', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '24px', padding: '36px 28px', position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(220,38,38,0.1)' }}>
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity }} style={{ position: 'absolute', top: -14, right: 20, background: 'linear-gradient(135deg, #dc2626, #ea580c)', padding: '6px 16px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, color: '#fff', boxShadow: '0 4px 12px rgba(220,38,38,0.4)' }}>⚡ MOST POPULAR</motion.div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24', letterSpacing: '1px', marginBottom: '8px' }}>PRO</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '48px', fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>₹999</span>
              <span style={{ fontSize: '14px', color: '#94a3b8' }}>/month</span>
            </div>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '28px' }}>₹33/day — less than a cup of tea ☕</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', flex: 1 }}>
              {['Unlimited products', 'Branded PDF receipts', 'Barcode scanner', 'UPI QR payments', 'Credit ledger', 'Staff management', 'Online shop link', 'Shop photos & QR', 'Revenue dashboard'].map((f, i) => (
                <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                  <CheckCircle size={16} color="#22c55e" /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #dc2626, #ea580c)', color: '#fff', fontWeight: 800, fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(220,38,38,0.3)' }}>
              🚀 Start 7-Day Free Trial
            </button>
          </motion.div>

          {/* ENTERPRISE Plan */}
          <motion.div {...fadeUp} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '36px 28px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', letterSpacing: '1px', marginBottom: '8px' }}>ENTERPRISE</div>
            <div style={{ fontSize: '48px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>Custom</div>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '28px' }}>for chains & multi-branch</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', flex: 1 }}>
              {['Everything in Pro', 'Multi-branch support', 'Centralized dashboard', 'Dedicated support', 'Custom integrations', 'White-label branding', 'Priority features', 'API access', 'SLA guarantee'].map((f, i) => (
                <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                  <CheckCircle size={16} color="#a78bfa" /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => window.open('https://wa.me/918885490495?text=Hi%20I%20want%20MyStore%20Enterprise%20plan', '_blank')} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid rgba(167,139,250,0.3)', background: 'transparent', color: '#a78bfa', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
              Contact Sales →
            </button>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 7 — TRUST / STATS 
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '80px 24px', background: 'linear-gradient(180deg, #0a0f1e, #030712)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center' }}>
          {[
            { num: '50+', label: 'Active Shops', color: '#fbbf24' },
            { num: '10K+', label: 'Bills Generated', color: '#22c55e' },
            { num: '99.9%', label: 'Uptime', color: '#3b82f6' },
            { num: '4.8★', label: 'Rating', color: '#f59e0b' }
          ].map((s, i) => (
            <motion.div key={i} {...stagger(i)}>
              <div style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, color: s.color }}>{s.num}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 8 — FINAL CTA 
      ══════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(80px, 12vw, 140px) 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(220,38,38,0.08) 0%, transparent 60%)' }} />
        <motion.div {...fadeUp} style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <h2 style={{ fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 16px' }}>
            Your Shop Deserves<br/><span style={{ background: 'linear-gradient(135deg, #fbbf24, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Better Than Paper.</span>
          </h2>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Join 50+ smart shopkeepers who switched to MyStore OS.</p>
          <p style={{ fontSize: '16px', color: '#fbbf24', fontWeight: 700, marginBottom: '40px' }}>మీ షాపు డిజిటల్ అవ్వాల్సిన సమయం వచ్చింది 🚀</p>
          <motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 60px rgba(220,38,38,0.5)' }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #dc2626, #ea580c)', color: 'white', border: 'none', padding: '20px 48px', borderRadius: '18px', fontSize: '18px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 40px rgba(220,38,38,0.35)' }}>
            🚀 Start Your Free Trial Now
          </motion.button>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER 
      ══════════════════════════════════════════════ */}
      <footer style={{ padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.25)', lineHeight: 2 }}>
          <p style={{ margin: 0 }}>MyStore OS — India's Smartest Retail Operating System</p>
          <p style={{ margin: 0 }}>© 2025 MyStore OS. Made with ❤️ in Guntur, Andhra Pradesh</p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <span onClick={() => navigate('/login')} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>Login</span>
            <span onClick={() => navigate('/register')} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>Register</span>
            <span onClick={() => window.open('https://wa.me/918885490495', '_blank')} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
