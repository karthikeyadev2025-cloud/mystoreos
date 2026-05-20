import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Receipt, Package, Book, Wallet, Smartphone, RefreshCw, Zap, Check, AlertCircle, ArrowRight, Lock, Bell, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';

const DEFAULT_HERO_CONFIG = {
  headline: 'The Next-Gen Pocket OS\nfor Smarter Retail.',
  subtitle: 'Completely paperless. Ultra-fast. WhatsApp-native.\nRun your entire retail shop, track expiry dates, send payment links, and see real profits directly from your phone.',
  buttonText: '🚀 Start Billing Free'
};

const DEFAULT_PRICING_CONFIG = {
  proPrice: '999',
  freeFeatures: 'Standard billing, 50 products catalog, Basic day book ledger',
  proFeatures: 'Unlimited digital invoices, WhatsApp receipt sharing, Proforma estimates, Delivery challans, Smart stock reorder alerts, Near-expiry warnings (90-day alert), Helper staff login locks, Unified customer outstanding book, Direct UPI WhatsApp payment reminders'
};

const DEFAULT_FEATURES_CONFIG = [
  {
    icon: 'Receipt',
    title: '🧾 Paperless Mobile Invoices',
    desc: 'Instantly generate crisp standard bills, estimate quotes, and challan presets straight from your phone. Share high-contrast receipts on WhatsApp with one click, saving thermal printer paper costs.',
    glow: 'rgba(16,185,129,0.1)'
  },
  {
    icon: 'Package',
    title: '📦 Smart Expiry & Batch Track',
    desc: 'Safeguard your profits from rotting inventory. Track batch numbers, configure automated low-stock warnings, and receive highly visible 90-day expiry notifications (amber/red alerts).',
    glow: 'rgba(251,191,36,0.1)'
  },
  {
    icon: 'Book',
    title: '📖 Today\'s Simple Day Book',
    desc: 'Forget complicated ledger sheets. View a unified daily cash register showing total cash-inflows (sales & settled credit) versus cash-outflows (supplier purchases) with clean net balance profit gauges.',
    glow: 'rgba(139,92,246,0.1)'
  },
  {
    icon: 'Wallet',
    title: '💸 Unified Credit Ledger',
    desc: 'Unify customer debts and distributor payables. Share gentle outstanding reminders directly to customer WhatsApp chats, pre-filled with automated upi:// payment deep-links.',
    glow: 'rgba(239,68,68,0.1)'
  },
  {
    icon: 'Lock',
    title: '🤝 Staff PIN-Lock Security',
    desc: 'Safely delegate walk-in billing to your store helpers. Give staff members secure 4-digit PIN access to scan barcodes and add cart items, while locking administration ledger files.',
    glow: 'rgba(59,130,246,0.1)'
  },
  {
    icon: 'RefreshCw',
    title: '🔄 Distributor Reordering',
    desc: 'Keep shelves filled. Connect directly with FMCG suppliers and restock low catalog items on credit. Orders automatically update supplier credit ledgers upon arrival.',
    glow: 'rgba(6,182,212,0.1)'
  }
];

const DEFAULT_INTERACTIVE3D_CONFIG = [
  {
    tag: '⚡ EXPRESS BILL',
    icon: 'Receipt',
    title: '30s Paperless Billing',
    desc: 'Select products and check out instantly on mobile. Automatically generates professional digital invoices and estimate documents shareable directly on WhatsApp.',
    glowColor: '#10b981'
  },
  {
    tag: '🛡️ STOCK HEALTH',
    icon: 'Package',
    title: 'Automated Expiry Badging',
    desc: 'Stay informed of inventory health. Automatically flags expired batches in red and near-expiry items within 90 days in amber. Never sell spoiled stock.',
    glowColor: '#fbbf24'
  },
  {
    tag: '📊 EASY LEDGER',
    icon: 'Book',
    title: 'Simplified Day Book',
    desc: 'View direct retail margins daily. Tracks sales income versus restock costs, presenting real-time net margins on a gorgeous circular profit gauge.',
    glowColor: '#8b5cf6'
  },
  {
    tag: '💸 SECURE UPI',
    icon: 'Wallet',
    title: 'Polite WhatsApp Reminders',
    desc: 'Access unified credit ledgers. Tap once to send WhatsApp outstanding reminders pre-filled with secure UPI payment links, letting debtors pay you instantly.',
    glowColor: '#06b6d4'
  }
];

const DEFAULT_PREVIEWS_CONFIG = [
  { id: 'bill', title: '🧾 Premium Digital Invoice', desc: 'Modern high-contrast billing format with dynamic store brand logos, direct UPI payment links, discount badges, and elegant digital footnotes.', border: '#10b981' },
  { id: 'estimate', title: '📋 Proforma Quote / Estimate', desc: 'Capture customer drafts and price estimations. Save them directly inside the Estimates Drawer, and load them into active shopping carts with one click.', border: '#fbbf24' },
  { id: 'challan', title: '🚚 Smart Delivery Challan', desc: 'Professional transport delivery sheet. Generates clear descriptions, items, and quantities for logistics and transit checks.', border: '#06b6d4' }
];

const DEFAULT_QUOTE_CONFIG = {
  teluguText: 'మీ షాపును స్మార్ట్ డిజిటల్ దుకాణంగా మార్చండి.',
  englishText: 'Elevate your retail business into a streamlined pocket-sized digital powerhouse.'
};

const DEFAULT_SECTION_HEADINGS = {
  playgroundTitle: 'Experience the 3D Motion Flow.',
  playgroundSubtitle: 'Tap below to watch how simple, interactive, and completely fluid MyStore OS makes your daily retail operations.',
  previewsTitle: 'Gorgeous Digital Formats.',
  previewsSubtitle: 'Create premium, styled invoices, quotations, and challans on mobile. Send them beautifully as high-resolution PDFs directly to customer WhatsApp chats.',
  featuresTitle: 'Engineered for Maximum Speed.',
  featuresSubtitle: 'Enjoy streamlined administrative utilities. Simple, high-value workflows tailored perfectly for small retail shopkeepers.',
  tactileTitle1: 'Responsive 3D Layout.',
  tactileTitle2: 'Feel the Tactile Control.',
  tactileSubtitle: 'Hover or slide your cursor over these feature cards to experience premium responsive 3D-motion. Zero lag, lightning-fast animations.'
};

const IconMap = {
  Receipt,
  Package,
  Book,
  Wallet,
  Smartphone,
  RefreshCw,
  Zap,
  Check,
  AlertCircle,
  ArrowRight,
  Lock,
  Bell,
  ChevronRight
};

const renderIcon = (name, size = 30, color = "#fff") => {
  const IconComponent = IconMap[name] || Receipt;
  return <IconComponent size={size} color={color} />;
};


// Spotlight 3D Card component
const Interactive3DCard = ({ icon, title, desc, tag, glowColor }) => {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // 3D Tilt calculation
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    const rX = -(mouseY / height) * 15; // Max 15 degrees tilt
    const rY = (mouseX / width) * 15; // Max 15 degrees tilt
    setRotate({ x: rX, y: rY });

    // 2D Spotlight gradient position
    const spotlightX = e.clientX - rect.left;
    const spotlightY = e.clientY - rect.top;
    setSpotlightPos({ x: spotlightX, y: spotlightY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      animate={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(${isHovered ? 1.03 : 1})`,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 25 }}
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isHovered ? `1px solid ${glowColor}60` : '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '24px',
        padding: '32px 28px',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: isHovered 
          ? `0 20px 45px rgba(0, 0, 0, 0.4), 0 0 25px ${glowColor}15, inset 0 0 15px rgba(255,255,255,0.02)` 
          : '0 10px 30px rgba(0, 0, 0, 0.15), inset 0 0 10px rgba(255,255,255,0.01)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'hidden',
        textAlign: 'left'
      }}
    >
      {/* 3D Spotlight radial glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `radial-gradient(circle 120px at ${spotlightPos.x}px ${spotlightPos.y}px, ${glowColor}15, transparent 80%)`,
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {tag && (
          <span style={{
            fontSize: '9px',
            fontWeight: 800,
            color: glowColor,
            background: `${glowColor}10`,
            border: `1px solid ${glowColor}30`,
            padding: '4px 10px',
            borderRadius: '20px',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            display: 'inline-block',
            marginBottom: '16px'
          }}>
            {tag}
          </span>
        )}
        <div style={{ 
          width: '52px', 
          height: '52px', 
          borderRadius: '14px', 
          background: 'rgba(255, 255, 255, 0.03)', 
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '8px',
          boxShadow: isHovered ? `0 8px 20px ${glowColor}20` : 'none',
          transition: 'box-shadow 0.3s'
        }}>
          {icon}
        </div>
        <h3 style={{ 
          fontFamily: "'Outfit', sans-serif", 
          fontSize: '18px', 
          fontWeight: 800, 
          color: '#fff', 
          margin: '12px 0 8px 0',
          letterSpacing: '-0.3px'
        }}>
          {title}
        </h3>
        <p style={{ 
          margin: 0, 
          fontSize: '13.5px', 
          color: '#94a3b8', 
          lineHeight: 1.6,
          fontWeight: 400
        }}>
          {desc}
        </p>
      </div>
    </motion.div>
  );
};

// 3D Phone Simulator
const ThreeDPhoneSimulator = ({ activeTab, setActiveTab }) => {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    const rX = -(mouseY / height) * 12; // Max 12 deg tilt
    const rY = (mouseX / width) * 12; // Max 12 deg tilt
    setRotate({ x: rX, y: rY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
      {/* Background glow beneath the phone */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '20%',
        width: '60%',
        height: '60%',
        background: `radial-gradient(circle, ${
          activeTab === 'billing' ? '#10b981' :
          activeTab === 'inventory' ? '#fbbf24' :
          activeTab === 'reports' ? '#8b5cf6' :
          '#06b6d4'
        }40 0%, transparent 70%)`,
        filter: 'blur(50px)',
        transition: 'background 0.5s ease',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* 3D phone canvas wrapper */}
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        animate={{
          transform: `perspective(1200px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(${isHovered ? 1.02 : 1})`,
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        style={{
          width: '320px',
          height: '600px',
          borderRadius: '44px',
          border: '12px solid #1e293b',
          background: '#070a13',
          boxShadow: isHovered 
            ? '0 35px 70px rgba(0,0,0,0.6), 0 0 40px rgba(255,255,255,0.05)' 
            : '0 25px 50px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'grab',
          transition: 'box-shadow 0.3s',
          zIndex: 1
        }}
      >
        {/* Dynamic Reflective shine overlay */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 40%)',
          transform: `translateX(${rotate.y * 5}px) translateY(${rotate.x * 5}px)`,
          transition: 'transform 0.1s ease-out',
          pointerEvents: 'none',
          zIndex: 10
        }} />

        {/* Phone Notch / Dynamic Island */}
        <div style={{
          width: '110px',
          height: '28px',
          background: '#1e293b',
          borderRadius: '20px',
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px'
        }}>
          <div style={{ width: '8px', height: '8px', background: '#090d16', borderRadius: '50%' }} />
          <div style={{ width: '36px', height: '3px', background: '#334155', borderRadius: '2px' }} />
          <div style={{ width: '8px', height: '8px', background: '#0f172a', borderRadius: '50%' }} />
        </div>

        {/* Status Bar */}
        <div style={{
          height: '48px',
          padding: '16px 28px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748b',
          fontWeight: 600,
          zIndex: 15,
          position: 'relative'
        }}>
          <span>9:41 AM</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span>⚡ LTE</span>
            <div style={{ width: '18px', height: '10px', border: '1px solid #64748b', borderRadius: '2px', padding: '1px', display: 'flex' }}>
              <div style={{ width: '100%', height: '100%', background: '#64748b', borderRadius: '1px' }} />
            </div>
          </div>
        </div>

        {/* Screen Content Wrapper */}
        <div style={{ flex: 1, padding: '16px 20px', position: 'relative', zIndex: 5, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          
          {/* App Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', fontWeight: 'bold' }}>MyStore OS</span>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>Provision Store</h4>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
              🏪
            </div>
          </div>

          {/* Render Active Screen Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'billing' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                
                {/* Billing Presets Mode Selectors */}
                <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Digital Bill', 'Estimate'].map((mode, i) => (
                    <div key={i} style={{
                      flex: 1, padding: '6px 0', textAlign: 'center', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold',
                      background: i === 0 ? 'rgba(16,185,129,0.12)' : 'transparent',
                      color: i === 0 ? '#10b981' : '#64748b',
                      border: i === 0 ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent'
                    }}>
                      {mode}
                    </div>
                  ))}
                </div>

                {/* Simulated Customer Info */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Customer Contact</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#f1f5f9' }}>Venkatesh Rao</span>
                    <span style={{ fontSize: '10px', color: '#10b981' }}>+91 94*** **824</span>
                  </div>
                </div>

                {/* Items Added */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                  <span style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Shopping Cart (2 Items)</span>
                  
                  {[
                    { name: 'Pure Premium Ghee 1L', price: '₹620', qty: '1', color: '#10b981' },
                    { name: 'Organic Toor Dal 2kg', price: '₹290', qty: '1', color: '#3b82f6' }
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <div style={{ width: '4px', height: '14px', background: item.color, borderRadius: '2px' }} />
                        <span style={{ fontSize: '10.5px', color: '#cbd5e1', fontWeight: 500 }}>{item.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#64748b' }}>x{item.qty}</span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>{item.price}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total & Discount Card */}
                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                    <span>Special Discount</span>
                    <span style={{ color: '#ef4444' }}>-₹50</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#cbd5e1' }}>Total Invoice Bill</span>
                    <span style={{ fontSize: '15px', fontWeight: 900, color: '#10b981' }}>₹860</span>
                  </div>
                </div>

                {/* CTA Action button */}
                <div style={{
                  width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none',
                  padding: '10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
                }}>
                  <span>💬 Share WhatsApp Invoice</span>
                </div>

              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                
                {/* Search Bar mockup */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span>🔍 Search products catalog...</span>
                </div>

                {/* Inventory warning cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                  <span style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Smart Expiry & Stock Center</span>

                  {/* Low Stock Item */}
                  <div style={{ background: 'rgba(245,158,11,0.02)', border: '1px solid rgba(245,158,11,0.15)', padding: '10px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#fcd34d' }}>Basmati Rice 5kg</h5>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>Stock level: 2 bags left</span>
                    </div>
                    <span style={{ fontSize: '8px', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Low Stock</span>
                  </div>

                  {/* Expiring Soon Item */}
                  <div style={{ background: 'rgba(251,191,36,0.02)', border: '1px solid rgba(251,191,36,0.15)', padding: '10px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#fcd34d' }}>Whole Wheat Bread</h5>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>Expires in: 4 days</span>
                    </div>
                    <span style={{ fontSize: '8px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Expiring 90D</span>
                  </div>

                  {/* Expired Item */}
                  <div style={{ background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.15)', padding: '10px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#fca5a5' }}>Canned Sweet Corn</h5>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>Batch: #CN44 (Expired)</span>
                    </div>
                    <span style={{ fontSize: '8px', background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Expired</span>
                  </div>
                </div>

                {/* Restock action */}
                <div style={{
                  width: '100%', background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#070a13', border: 'none',
                  padding: '10px', borderRadius: '10px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(251,191,36,0.2)'
                }}>
                  <span>🔄 Auto Reorder Low Stocks</span>
                </div>

              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                
                {/* Cash Flow Summary */}
                <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, background: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.1)', padding: '8px 10px', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '8px', color: '#64748b', display: 'block' }}>Cash Inflow</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981' }}>₹14,200</span>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.1)', padding: '8px 10px', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '8px', color: '#64748b', display: 'block' }}>Cash Outflow</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444' }}>₹9,100</span>
                  </div>
                </div>

                {/* Circular Profit Gauge simulation */}
                <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0' }}>
                  <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                    <motion.circle cx="50" cy="50" r="40" fill="none" stroke="#8b5cf6" strokeWidth="6" 
                      strokeDasharray="251.2" 
                      initial={{ strokeDashoffset: 251.2 }}
                      animate={{ strokeDashoffset: 251.2 - (251.2 * 0.359) }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', fontFamily: "'Outfit', sans-serif" }}>35.9%</span>
                    <span style={{ fontSize: '8px', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Profit</span>
                  </div>
                </div>

                {/* Daily Till Balance */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '10px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#cbd5e1' }}>Day Balance Profit</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#8b5cf6' }}>+₹5,100</span>
                </div>

              </motion.div>
            )}

            {activeTab === 'credit' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                
                {/* Credit ledger cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Customer Outstanding</span>
                  
                  {/* Ledger Row */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#fff' }}>Devendra Prasad</h5>
                      <span style={{ fontSize: '9px', color: '#ef4444' }}>Dues: ₹1,500</span>
                    </div>
                    
                    <button style={{
                      background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', color: '#06b6d4',
                      fontSize: '9px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer'
                    }}>
                      💬 Send Pay Link
                    </button>
                  </div>

                  {/* Payment reminder bubble mockup */}
                  <div style={{ background: 'rgba(6,182,212,0.03)', border: '1px dashed rgba(6,182,212,0.2)', padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '7.5px', color: '#06b6d4', fontWeight: 'bold', textTransform: 'uppercase' }}>Auto WhatsApp Request</span>
                    <p style={{ margin: 0, fontSize: '9.5px', color: '#cbd5e1', lineHeight: 1.4, fontFamily: 'sans-serif' }}>
                      "Dear Devendra, your outstanding balance is ₹1,500. Click here to settle instantly via UPI: <strong style={{ color: '#06b6d4' }}>upi://pay?pa=store@ybl&am=1500</strong>"
                    </p>
                  </div>
                </div>

                {/* QR Settle representation */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '8px', borderRadius: '10px' }}>
                  <div style={{ background: '#fff', width: '32px', height: '32px', padding: '2px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: '100%', border: '2px solid #000', display: 'flex', flexWrap: 'wrap', padding: '1px' }}>
                      <div style={{ width: '8px', height: '8px', background: '#000' }} />
                      <div style={{ width: '8px', height: '8px', background: 'transparent' }} />
                      <div style={{ width: '8px', height: '8px', background: '#000' }} />
                      <div style={{ width: '8px', height: '8px', background: '#000' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '9px', color: '#fff', fontWeight: 'bold' }}>Universal UPI Settlement</span>
                    <span style={{ fontSize: '8px', color: '#64748b' }}>Supports GPay, PhonePe, Paytm QR</span>
                  </div>
                </div>

              </motion.div>
            )}
          </div>

          {/* Bottom Bar indicator */}
          <div style={{ height: '16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <div style={{ width: '80px', height: '4px', background: '#334155', borderRadius: '2px' }} />
          </div>

        </div>
      </motion.div>

      {/* Selector Tabs underneath the phone */}
      <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)', padding: '5px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { id: 'billing', label: '🧾 Billing', color: '#10b981' },
          { id: 'inventory', label: '📦 Stock', color: '#fbbf24' },
          { id: 'reports', label: '📊 Ledger', color: '#8b5cf6' },
          { id: 'credit', label: '💸 Dues', color: '#06b6d4' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: 'bold',
              background: activeTab === tab.id ? `${tab.color}15` : 'transparent',
              color: activeTab === tab.id ? tab.color : '#94a3b8',
              border: activeTab === tab.id ? `1px solid ${tab.color}25` : '1px solid transparent',
              transition: 'all 0.3s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// 3D Motion Flow Visualizer
const FlowVisualizer = () => {
  const [activeFlow, setActiveFlow] = useState('billing'); // 'billing' | 'stock' | 'whatsapp'

  return (
    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '32px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1000px', margin: '0 auto', backdropFilter: 'blur(10px)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
        {[
          { id: 'billing', label: '🧾 30-Sec Invoicing Flow', color: '#10b981' },
          { id: 'stock', label: '📦 Stock & Expiry Alert', color: '#fbbf24' },
          { id: 'whatsapp', label: '💬 WhatsApp Dues Settle', color: '#06b6d4' }
        ].map((flow) => (
          <button
            key={flow.id}
            onClick={() => setActiveFlow(flow.id)}
            style={{
              padding: '12px 24px',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              background: activeFlow === flow.id ? `${flow.color}15` : 'rgba(255,255,255,0.02)',
              color: activeFlow === flow.id ? flow.color : '#94a3b8',
              border: activeFlow === flow.id ? `1px solid ${flow.color}30` : '1px solid rgba(255,255,255,0.06)',
              boxShadow: activeFlow === flow.id ? `0 8px 24px ${flow.color}10` : 'none',
              transition: 'all 0.3s'
            }}
          >
            {flow.label}
          </button>
        ))}
      </div>

      {/* Visual Canvas */}
      <div style={{ 
        height: '280px', 
        background: '#070a13', 
        borderRadius: '24px', 
        border: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Grid */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

        <AnimatePresence mode="wait">
          {activeFlow === 'billing' && (
            <motion.div
              key="billing-flow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap', justifyContent: 'center', padding: '20px', zIndex: 2 }}
            >
              {/* Product cart */}
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', width: '180px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>SHOPPING CART</span>
                <div style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>⚡ Pure Ghee 1L</div>
                <div style={{ background: 'rgba(59,130,246,0.08)', color: '#3b82f6', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>⚡ Toor Dal 2kg</div>
              </motion.div>

              {/* Arrow */}
              <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ color: '#10b981' }}>
                <ArrowRight size={28} />
              </motion.div>

              {/* Simulated Invoice Sheet */}
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }} style={{ background: '#fff', color: '#000', borderRadius: '16px', padding: '20px', width: '200px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', fontFamily: 'monospace', fontSize: '10px' }}>
                <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '8px', textAlign: 'center', fontWeight: 'bold' }}>RECEIPT</div>
                <div>Ghee 1L: ₹620</div>
                <div>Dal 2kg: ₹290</div>
                <div style={{ fontWeight: 'bold', borderTop: '1px dashed #aaa', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>TOTAL:</span>
                  <span>₹910</span>
                </div>
                <div style={{ background: '#d1fae5', color: '#065f46', fontSize: '8px', padding: '4px', borderRadius: '4px', marginTop: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                  💬 SHARED ON WHATSAPP
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeFlow === 'stock' && (
            <motion.div
              key="stock-flow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap', justifyContent: 'center', padding: '20px', zIndex: 2 }}
            >
              {/* Product Status Cards */}
              <div style={{ display: 'flex', gap: '16px' }}>
                {[
                  { name: 'Basmati Rice', label: 'Low Stock', stock: '2 left', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
                  { name: 'Sweet Corn', label: 'Expired!', stock: 'Expired', color: '#ef4444', border: 'rgba(239,68,68,0.3)' }
                ].map((p, idx) => (
                  <motion.div key={idx} animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, delay: idx * 0.3, repeat: Infinity, ease: 'easeInOut' }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', width: '130px', borderLeft: `4px solid ${p.color}` }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>{p.name}</span>
                    <span style={{ fontSize: '9px', color: '#64748b' }}>{p.stock}</span>
                    <span style={{ fontSize: '8px', background: p.border, color: p.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block', width: 'fit-content' }}>{p.label}</span>
                  </motion.div>
                ))}
              </div>

              {/* Arrow */}
              <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ color: '#fbbf24' }}>
                <ArrowRight size={28} />
              </motion.div>

              {/* Auto Restock Sheet */}
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '20px', width: '180px', textAlign: 'center' }}>
                <span style={{ fontSize: '18px', display: 'block', marginBottom: '8px' }}>🔄</span>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', display: 'block', marginBottom: '4px' }}>Wholesale Restock</span>
                <span style={{ fontSize: '9px', color: '#64748b', display: 'block', marginBottom: '12px' }}>Items auto-added to catalog restock cart</span>
                <span style={{ fontSize: '9px', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}>RESTOCKED!</span>
              </motion.div>
            </motion.div>
          )}

          {activeFlow === 'whatsapp' && (
            <motion.div
              key="whatsapp-flow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap', justifyContent: 'center', padding: '20px', zIndex: 2 }}
            >
              {/* Outstanding debt */}
              <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '16px', width: '150px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>CUSTOMER BALANCE</span>
                <h4 style={{ margin: '8px 0', color: '#f87171', fontSize: '20px', fontWeight: 900 }}>₹1,500</h4>
                <span style={{ fontSize: '8px', color: '#64748b' }}>Devendra Prasad</span>
              </motion.div>

              {/* Arrow */}
              <div style={{ color: '#06b6d4' }}>
                <ArrowRight size={28} />
              </div>

              {/* WhatsApp message bubble */}
              <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} style={{ background: '#055c47', color: '#fff', borderRadius: '16px 16px 0 16px', padding: '16px', width: '220px', fontSize: '9.5px', lineHeight: 1.4, position: 'relative', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontWeight: 'bold', color: '#10b981', display: 'block', marginBottom: '4px' }}>💬 WhatsApp Reminder</span>
                "Please settle your dues of ₹1,500. Click here to pay directly via GPay/PhonePe: upi://pay?pa=store@ybl..."
                <div style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '6px', marginTop: '8px', textAlign: 'center', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <span>🔒 UPI Secure Link</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -30]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0.15]);

  const [heroConfig, setHeroConfig] = useState(DEFAULT_HERO_CONFIG);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [featuresConfig, setFeaturesConfig] = useState(DEFAULT_FEATURES_CONFIG);
  const [interactive3dConfig, setInteractive3dConfig] = useState(DEFAULT_INTERACTIVE3D_CONFIG);
  const [previewsConfig, setPreviewsConfig] = useState(DEFAULT_PREVIEWS_CONFIG);
  const [quoteConfig, setQuoteConfig] = useState(DEFAULT_QUOTE_CONFIG);
  const [sectionHeadings, setSectionHeadings] = useState(DEFAULT_SECTION_HEADINGS);
  const [activeBillPreview, setActiveBillPreview] = useState('bill'); // 'bill' | 'estimate' | 'challan'
  const [activeSimulatorTab, setActiveSimulatorTab] = useState('billing');

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
        const fConfig = await api.getSiteConfig('features', DEFAULT_FEATURES_CONFIG);
        const i3dConfig = await api.getSiteConfig('interactive3d', DEFAULT_INTERACTIVE3D_CONFIG);
        const prevConfig = await api.getSiteConfig('previews', DEFAULT_PREVIEWS_CONFIG);
        const qConfig = await api.getSiteConfig('quoteCallout', DEFAULT_QUOTE_CONFIG);
        const sHeadings = await api.getSiteConfig('sectionHeadings', DEFAULT_SECTION_HEADINGS);

        setHeroConfig(hConfig);
        setPricingConfig(pConfig);
        setFeaturesConfig(fConfig);
        setInteractive3dConfig(i3dConfig);
        setPreviewsConfig(prevConfig);
        setQuoteConfig(qConfig);
        setSectionHeadings(sHeadings);
      } catch (e) {
        console.error("CMS Configuration Load Error", e);
      }
    };
    loadData();
  }, []);

  return (
    <div ref={containerRef} style={{ backgroundColor: '#030712', color: '#f1f5f9', overflowX: 'hidden', fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif", position: 'relative' }}>
      
      {/* Injecting Premium Google Fonts & Keyframe animations */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .nebula-grid {
          background-size: 50px 50px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.012) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }
        @keyframes floatOrb {
          0% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-15px) scale(1.05); }
          100% { transform: translateY(0px) scale(1); }
        }
        .animated-orb {
          animation: floatOrb 8s ease-in-out infinite;
        }
        .glow-button::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          opacity: 0;
          box-shadow: 0 0 30px #fbbf24;
          transition: opacity 0.3s;
        }
        .glow-button:hover::after {
          opacity: 0.4;
        }
      `}</style>

      {/* ══════════════════════════════════════════════
          STICKY PREMIUM NAVIGATION BAR
      ══════════════════════════════════════════════ */}
      <header style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 1000, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', background: 'rgba(3, 7, 18, 0.75)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>⚡</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '23px', fontWeight: 800, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #fff 40%, #fbbf24 70%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MyStore OS</span>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button onClick={() => navigate('/login')} style={{ background: 'transparent', color: '#94a3b8', border: 'none', padding: '10px 20px', fontSize: '14.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#94a3b8'}>
              Sign In
            </button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#030712', border: 'none', padding: '11px 24px', borderRadius: '14px', fontSize: '14.5px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Join Free</span>
              <ChevronRight size={16} strokeWidth={3} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          CINEMATIC HERO SECTION
      ══════════════════════════════════════════════ */}
      <motion.section style={{ y: heroY, opacity: heroOpacity, minHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
        
        {/* Aesthetic Background Nebula Elements */}
        <div className="nebula-grid" />
        
        {/* Floating Light Orbs */}
        <div className="animated-orb" style={{ position: 'absolute', width: '550px', height: '550px', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', top: '-15%', left: '5%', borderRadius: '50%', filter: 'blur(70px)', pointerEvents: 'none' }} />
        <div className="animated-orb" style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', bottom: '-10%', right: '5%', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', animationDelay: '-4s' }} />
        <div className="animated-orb" style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', top: '35%', left: '45%', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none', animationDelay: '-2s' }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '64px', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          
          {/* Left Text Pitch */}
          <div style={{ flex: '1 1 500px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#fbbf24', padding: '6px 18px', borderRadius: '30px', fontSize: '11px', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', width: 'fit-content' }}>
              <span>⚡ India's Smartest Paperless Revolution</span>
            </motion.div>

            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(38px, 5.5vw, 64px)', fontWeight: 900, lineHeight: 1.1, margin: 0, background: 'linear-gradient(135deg, #ffffff 30%, #fcd34d 75%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'pre-line', letterSpacing: '-1.5px' }}>
              {heroConfig.headline}
            </h1>

            <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#94a3b8', lineHeight: 1.6, margin: 0, maxWidth: '600px', fontWeight: 400, whiteSpace: 'pre-line' }}>
              {heroConfig.subtitle}
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
              <motion.button className="glow-button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#030712', border: 'none', padding: '18px 38px', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 30px rgba(251,191,36,0.35)', position: 'relative' }}>
                {heroConfig.buttonText}
              </motion.button>
              <motion.button whileHover={{ scale: 1.04, background: 'rgba(255,255,255,0.08)' }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/login')} style={{ background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', padding: '18px 36px', borderRadius: '16px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
                Access Store Dashboard →
              </motion.button>
            </div>

            {/* Quick trust metrics */}
            <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
              {['📱 Built for Mobile Screens', '⚡ Bill in 30 Seconds', '💬 Sent directly on WhatsApp'].map((text, i) => (
                <span key={i} style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span> {text}
                </span>
              ))}
            </div>

          </div>

          {/* Right 3D Interactive Simulator */}
          <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ThreeDPhoneSimulator activeTab={activeSimulatorTab} setActiveTab={setActiveSimulatorTab} />
          </div>

        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════
          CINEMATIC INTERACTIVE DEMO EXPLORER
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '80px 24px', background: '#050814', position: 'relative', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '50px' }}>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', background: 'rgba(16, 185, 129, 0.08)', padding: '5px 16px', borderRadius: '30px', border: '1px solid rgba(16, 185, 129, 0.15)', display: 'inline-block' }}>INTERACTIVE PLAYGROUND</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(30px, 4.5vw, 44px)', fontWeight: 900, margin: '20px 0 16px', color: '#fff', letterSpacing: '-1px' }}>
              {sectionHeadings.playgroundTitle}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15.5px', maxWidth: '620px', margin: '0 auto', lineHeight: 1.6 }}>
              {sectionHeadings.playgroundSubtitle}
            </p>
          </motion.div>

          <FlowVisualizer />

        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 2 — THE PRESET BILL PREVIEWS SHOWCASE
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '80px 24px', background: '#030712' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '50px' }}>
            <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>PAPERLESS PRESETS</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4.5vw, 40px)', fontWeight: 800, margin: '8px 0 12px', color: '#fff' }}>
              {sectionHeadings.previewsTitle}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
              {sectionHeadings.previewsSubtitle}
            </p>
          </motion.div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center', justifyContent: 'center', marginTop: '20px' }}>
            
            {/* Left Controls Column */}
            <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {previewsConfig.map((item) => (
                <div key={item.id} onClick={() => setActiveBillPreview(item.id)} style={{
                  padding: '24px', borderRadius: '20px', cursor: 'pointer', transition: 'all 0.3s',
                  background: activeBillPreview === item.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: '1px solid ' + (activeBillPreview === item.id ? item.border : 'rgba(255,255,255,0.05)'),
                  boxShadow: activeBillPreview === item.id ? `0 10px 30px ${item.border}10` : 'none'
                }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16.5px', fontWeight: 'bold', color: activeBillPreview === item.id ? '#fff' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeBillPreview === item.id ? item.border : 'transparent', display: 'inline-block' }} />
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Right Invoice Preview Card (HTML Branded Simulator) */}
            <div style={{ flex: '1 1 420px', maxWidth: '460px', background: '#fff', color: '#0f172a', borderRadius: '28px', padding: '28px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: '12px', position: 'relative' }}>
              
              {/* Header Colored Border */}
              <div style={{
                height: '8px', margin: '-28px -28px 24px -28px', borderRadius: '28px 28px 0 0',
                background: activeBillPreview === 'bill' ? '#10b981' : activeBillPreview === 'estimate' ? '#fbbf24' : '#06b6d4'
              }} />

              {/* Shop Logo Representation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '2px solid #e2e8f0', paddingBottom: '18px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800 }}>VIGNESH PROVISIONS</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '10px' }}>Ph: 9876543210 • UPI ID: store@ybl</p>
                </div>
                <div style={{ background: '#f1f5f9', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🛒</div>
              </div>

              {/* Title Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
                <span style={{
                  fontWeight: 'bold', fontSize: '11px', padding: '3px 10px', borderRadius: '6px',
                  background: activeBillPreview === 'bill' ? '#d1fae5' : activeBillPreview === 'estimate' ? '#fef3c7' : '#cffafe',
                  color: activeBillPreview === 'bill' ? '#065f46' : activeBillPreview === 'estimate' ? '#92400e' : '#0891b2'
                }}>
                  {activeBillPreview === 'bill' ? 'TAX INVOICE' : activeBillPreview === 'estimate' ? 'PROFORMA ESTIMATE' : 'DELIVERY CHALLAN'}
                </span>
                <span style={{ color: '#64748b' }}>Date: 20-May-2026</span>
              </div>

              {/* Customer Info */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '18px', borderLeft: '3px solid #cbd5e1' }}>
                <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>To: Devendra Prasad (Customer)</p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '10px' }}>Ph: +91 9488776655</p>
              </div>

              {/* Table details */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px' }}>
                  <span style={{ flex: 2 }}>ITEM</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>QTY</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>PRICE</span>
                </div>
                {[
                  { name: 'Pure Premium Ghee 1L', qty: '1', price: '620' },
                  { name: 'Organic Toor Dal 2kg', qty: '1', price: '290' }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#334155' }}>
                    <span style={{ flex: 2 }}>{item.name}</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>{item.qty}</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>₹{item.price}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', fontSize: '11px' }}>
                {activeBillPreview === 'bill' && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Special Discount: -₹50</span>}
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                  GRAND TOTAL: {activeBillPreview === 'bill' ? '₹860' : '₹910'}
                </span>
              </div>

              {/* Footnotes */}
              <div style={{ textAlign: 'center', marginTop: '22px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '9px', color: '#94a3b8' }}>
                {activeBillPreview === 'bill' ? (
                  <p style={{ color: '#059669', fontWeight: 'bold', margin: 0 }}>✓ Shared via WhatsApp • Paid Instantly via UPI</p>
                ) : activeBillPreview === 'estimate' ? (
                  <p style={{ color: '#d97706', fontWeight: 'bold', margin: 0 }}>⚠️ Estimate Draft. Save to active dashboard drawer.</p>
                ) : (
                  <p style={{ color: '#0891b2', fontWeight: 'bold', margin: 0 }}>🚚 Transit Document. Quantity verified.</p>
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
      <section style={{ padding: '80px 24px', background: '#050814' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>PRODUCTIVITY HUB</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 800, margin: '8px 0 12px', color: '#fff' }}>
              {sectionHeadings.featuresTitle}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
              {sectionHeadings.featuresSubtitle}
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            {featuresConfig.map((card, i) => {
              const iconColor = card.glow.includes('16,185,129') ? '#10b981' :
                                card.glow.includes('251,191,36') ? '#fbbf24' :
                                card.glow.includes('139,92,246') ? '#8b5cf6' :
                                card.glow.includes('239,68,68') ? '#ef4444' :
                                card.glow.includes('59,130,246') ? '#3b82f6' :
                                card.glow.includes('6,182,212') ? '#06b6d4' : '#fbbf24';
              return (
                <motion.div key={i} {...stagger(i)} whileHover={{ y: -6, borderColor: 'rgba(255,255,255,0.15)', boxShadow: `0 15px 30px ${card.glow}` }} style={{
                  background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '24px', padding: '32px',
                  transition: 'all 0.3s ease-in-out'
                }}>
                  <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    {renderIcon(card.icon, 30, iconColor)}
                  </div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18.5px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#fff' }}>{card.title}</h3>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#94a3b8', lineHeight: 1.6 }}>{card.desc}</p>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 4 — CINEMATIC 3D MOTION INTERACTIVE EXPERIENCE
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '100px 24px', background: '#030712', position: 'relative', overflow: 'hidden' }}>
        
        {/* Floating cinematic particles */}
        <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', top: '20%', right: '10%', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(251,191,36,0.03) 0%, transparent 70%)', bottom: '10%', left: '5%', borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', background: 'rgba(251, 191, 36, 0.08)', padding: '6px 16px', borderRadius: '30px', border: '1px solid rgba(251, 191, 36, 0.15)', display: 'inline-block' }}>TACTILE 3D INTERACTIONS</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: 900, margin: '20px 0 16px', color: '#fff', letterSpacing: '-1px', lineHeight: 1.15 }}>
              {sectionHeadings.tactileTitle1}<br/>
              <span style={{ background: 'linear-gradient(135deg, #fff 40%, #fbbf24 70%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{sectionHeadings.tactileTitle2}</span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '16px', maxWidth: '620px', margin: '0 auto', lineHeight: 1.6 }}>
              {sectionHeadings.tactileSubtitle}
            </p>
          </motion.div>

          {/* Interactive 3D Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '28px' }}>
            {interactive3dConfig.map((card, i) => (
              <Interactive3DCard 
                key={i}
                tag={card.tag}
                icon={renderIcon(card.icon, 26, card.glowColor)}
                title={card.title}
                desc={card.desc}
                glowColor={card.glowColor}
              />
            ))}
          </div>

          {/* Cinematic Quote Callout */}
          <motion.div {...fadeUp} style={{ marginTop: '80px', padding: '40px', borderRadius: '32px', background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '16px' }}>🚀</span>
            <p style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', fontFamily: "'Outfit', sans-serif", fontWeight: 500, color: '#f1f5f9', margin: '0 auto', maxWidth: '800px', lineHeight: 1.5 }}>
              "{quoteConfig.teluguText}"
            </p>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '10px 0 0 0', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {quoteConfig.englishText}
            </p>
          </motion.div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 5 — PRICING SECTION
      ══════════════════════════════════════════════ */}
      <section style={{ padding: '80px 24px', background: '#050814' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>SIMPLE PRICING</span>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 800, margin: '8px 0 12px', color: '#fff' }}>
              One Plan. Complete Access.
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px' }}>Start completely free with basic billing. Upgrade only when you grow.</p>
          </motion.div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'center', alignItems: 'stretch' }}>
            
            {/* Free Plan Card */}
            <motion.div {...fadeUp} style={{
              flex: '1 1 300px', maxWidth: '380px',
              background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '24px', padding: '40px 32px', display: 'flex', flexDirection: 'column'
            }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>STARTER CATALOG</span>
              <h3 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: '#fff' }}>Free</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Forever free for smaller merchants</p>
              
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '24px' }}>
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>Perfect for basic point of sale billing.</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', color: '#94a3b8' }}>
                {(pricingConfig.freeFeatures || '').split(',').map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> {f.trim()}
                  </li>
                ))}
                {['Estimates & Challans', 'Expiry alert badges', 'UPI auto remind pay links', 'Distributor reordering ledgers'].map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.3 }}>
                    <span>✕</span> {f}
                  </li>
                ))}
              </ul>

              <button onClick={() => navigate('/register')} style={{
                width: '100%', padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', transition: 'all 0.2s'
              }} onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>
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
              <div style={{ position: 'absolute', top: -14, right: 28, background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#030712', fontSize: '10px', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>
                MOST POPULAR
              </div>

              <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>MYSTORE PRO NODE</span>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '42px', fontWeight: 900, color: '#fbbf24' }}>₹{pricingConfig.proPrice}</span>
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>/month</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Less than ₹33 a day — simple, pocket-friendly. ☕</p>
              
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '24px' }}>
                <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 'bold' }}>Unlock the full suite of retail utilities.</span>
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
                background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#030712', border: 'none',
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
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 60%)' }} />
        
        <motion.div {...fadeUp} style={{ maxWidth: '650px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(30px, 5.5vw, 48px)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 20px 0' }}>
            Elevate Your Retail Shop<br/>
            <span style={{ background: 'linear-gradient(135deg, #fbbf24, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>100% Paperless today.</span>
          </h2>
          <p style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '8px' }}>Ditch physical records for the smartest pocket-sized retail operating system.</p>
          <p style={{ fontSize: '15px', color: '#fbbf24', fontWeight: 'bold', marginBottom: '36px' }}>మీ షాపును స్మార్ట్ డిజిటల్ దుకాణంగా మార్చండి 🚀</p>
          
          <motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(16,185,129,0.35)' }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '18px 44px', borderRadius: '16px', fontSize: '17px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 30px rgba(16, 185, 129, 0.3)' }}>
            Start Your Free Journey
          </motion.button>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer style={{ padding: '60px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', background: '#050814' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', fontSize: '13.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, color: '#94a3b8', fontWeight: 'bold' }}>⚡ MyStore OS — India's Smartest Pocket Retail Operating System</p>
          <p style={{ margin: 0 }}>© 2026 MyStore OS. Crafted with ❤️ in Guntur, Andhra Pradesh</p>
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px' }}>
            <span onClick={() => navigate('/login')} style={{ cursor: 'pointer', color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>Login</span>
            <span onClick={() => navigate('/register')} style={{ cursor: 'pointer', color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>Register</span>
            <span onClick={() => window.open('https://wa.me/918885490495', '_blank')} style={{ cursor: 'pointer', color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>WhatsApp Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
