import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  
  // Parallax calculations
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const cubeRotate = useTransform(scrollYProgress, [0, 1], [0, 360]);

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', overflowX: 'hidden' }}>
      
      {/* 3D Cinematic Hero Section */}
      <motion.div 
        style={{ 
          y: heroY, opacity: heroOpacity,
          minHeight: '100vh', 
          background: 'linear-gradient(to bottom, #0f0c29, #302b63, #24243e)', 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          textAlign: 'center', padding: '20px', position: 'relative',
          perspective: '1000px'
        }}
      >
        {/* Floating 3D Background Elements */}
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.1, 1] }} 
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ position: 'absolute', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 70%)', top: '-20%', left: '-20%', borderRadius: '50%' }}
        />
        <motion.div 
          animate={{ rotate: -360, scale: [1, 1.2, 1] }} 
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(251,191,36,0.1) 0%, transparent 70%)', bottom: '-10%', right: '-10%', borderRadius: '50%' }}
        />

        <motion.div 
          initial={{ opacity: 0, scale: 0.8, rotateX: 20 }} 
          animate={{ opacity: 1, scale: 1, rotateX: 0 }} 
          transition={{ duration: 1, type: 'spring', bounce: 0.4 }}
          style={{ zIndex: 10, transformStyle: 'preserve-3d' }}
        >
          <motion.div 
            animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fbbf24', padding: '8px 24px', borderRadius: '30px', fontSize: '14px', fontWeight: 'bold', marginBottom: '32px', letterSpacing: '2px' }}
          >
            🔥 THE FUTURE OF GUNTUR RETAIL
          </motion.div>
          
          <h1 style={{ fontSize: '7vw', fontWeight: 900, lineHeight: 1.1, marginBottom: '24px', background: 'linear-gradient(135deg, #fff, #fbbf24, #dc2626)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0px 10px 20px rgba(220,38,38,0.3))' }}>
            One Platform.<br/>Zero Paper.<br/>Infinite Growth.
          </h1>
          
          <p style={{ fontSize: '24px', color: 'rgba(255,255,255,0.8)', marginBottom: '12px', fontWeight: 300 }}>
            No Computer. No Printer. No Paper Roll.
          </p>
          <p style={{ fontSize: '20px', color: '#fbbf24', fontWeight: 'bold', marginBottom: '60px' }}>
            కంప్యూటర్ లేకుండా • ప్రింటర్ లేకుండా • కాగితం లేకుండా
          </p>

          <motion.button 
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(220,38,38,0.8)' }} 
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
            style={{ 
              background: 'linear-gradient(135deg, #dc2626, #f59e0b)', color: 'white', border: 'none', 
              padding: '20px 48px', borderRadius: '50px', fontSize: '20px', fontWeight: 900, cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(220,38,38,0.4)', textTransform: 'uppercase', letterSpacing: '1px'
            }}
          >
            🚀 Launch Free Trial
          </motion.button>
        </motion.div>
      </motion.div>

      {/* 3D Visual Storytelling Section */}
      <div style={{ padding: '120px 20px', background: '#0a0a0a', position: 'relative' }}>
        <motion.h2 
          initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
          style={{ textAlign: 'center', fontSize: '42px', fontWeight: 900, color: '#fff', marginBottom: '80px' }}
        >
          Your Journey to <span style={{ color: '#fbbf24' }}>Success</span>
        </motion.h2>
        
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '80px' }}>
          {[
            { step: '01', icon: '😫', title: 'The Problem', telugu: 'చేతితో బిల్లు రాస్తున్నారు. కాగితం పోతుంది.', text: 'You write bills by hand. Customer waits. Paper gets lost. You forget who owes money. Electricity bill is ₹2,000/month just for billing.', color: '#dc2626' },
            { step: '02', icon: '💡', title: 'The Discovery', telugu: 'మరో షాపు MyStore వాడుతోంది.', text: 'You see another shop using MyStore. No computer. No printer. Just a phone. Customer gets bill on WhatsApp.', color: '#f59e0b' },
            { step: '03', icon: '📱', title: 'The Transformation', telugu: 'బిల్లు ఆటోమేటిక్. WhatsApp లో పంపిస్తారు.', text: 'You switch to MyStore. Scan product with phone camera. Bill generates automatically. Send to customer WhatsApp. Customer pays via UPI.', color: '#3b82f6' },
            { step: '04', icon: '🚀', title: 'The Success', telugu: 'మీ షాపు ఆన్‌లైన్. ప్రతి రూపాయి ట్రాక్ చేస్తారు.', text: 'Your shop is online. Customers order from home. You track every rupee. Distributor credit is clear. No confusion. Happy family.', color: '#10b981' }
          ].map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: i % 2 === 0 ? -100 : 100, rotateY: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
              viewport={{ once: true, margin: "-150px" }}
              transition={{ duration: 0.8, type: 'spring', bounce: 0.3 }}
              whileHover={{ scale: 1.02, rotateY: i % 2 === 0 ? 5 : -5 }}
              style={{ 
                background: 'linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.8))', 
                border: `1px solid ${s.color}40`, 
                padding: '40px', borderRadius: '30px', display: 'flex', gap: '30px', alignItems: 'center', 
                position: 'relative', overflow: 'hidden', backdropFilter: 'blur(20px)',
                boxShadow: `0 20px 40px rgba(0,0,0,0.5)`
              }}
            >
              <div style={{ position: 'absolute', top: -20, right: 20, fontSize: '150px', fontWeight: 900, color: `${s.color}15`, zIndex: 0 }}>{s.step}</div>
              
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.5 }}
                style={{ fontSize: '50px', background: `linear-gradient(135deg, ${s.color}, #000)`, width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px', flexShrink: 0, zIndex: 1, boxShadow: `0 10px 30px ${s.color}40` }}
              >
                {s.icon}
              </motion.div>
              
              <div style={{ zIndex: 1 }}>
                <h3 style={{ fontSize: '28px', marginBottom: '8px', color: s.color, fontWeight: 800 }}>{s.title}</h3>
                <p style={{ color: '#fbbf24', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>{s.telugu}</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px', lineHeight: 1.6 }}>{s.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pricing Section with 3D Float */}
      <div style={{ padding: '120px 20px', background: 'linear-gradient(180deg, #0a0a0a, #1a1a2e)', textAlign: 'center', perspective: '1000px' }}>
        <motion.h2 initial={{ opacity:0 }} whileInView={{ opacity:1 }} style={{ fontSize: '42px', fontWeight: 900, marginBottom: '16px' }}>
          One Price. <span style={{ color: '#fbbf24' }}>Everything Included.</span>
        </motion.h2>

        <motion.div 
          initial={{ rotateX: 20, y: 50, opacity: 0 }}
          whileInView={{ rotateX: 0, y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          whileHover={{ y: -10, boxShadow: '0 30px 60px rgba(220,38,38,0.4)' }}
          style={{ maxWidth: '400px', margin: '60px auto 0', background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '2px solid #dc2626', borderRadius: '32px', padding: '50px 30px', position: 'relative' }}
        >
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #dc2626, #f59e0b)', padding: '10px 24px', borderRadius: '30px', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(220,38,38,0.5)' }}>🔥 MOST POPULAR</motion.div>
          <h3 style={{ fontSize: '28px', marginBottom: '16px' }}>MyStore Pro</h3>
          <div style={{ fontSize: '72px', fontWeight: 900, color: '#fbbf24', margin: '16px 0', lineHeight: 1 }}>₹999</div>
          <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '40px' }}>per month / నెలకు</div>
          
          <ul style={{ textAlign: 'left', listStyle: 'none', margin: '0 0 40px 0', padding: 0 }}>
            {['Unlimited Products', 'Unlimited Bills (WhatsApp)', 'Barcode Scanner (Camera)', 'Customer Database', 'Credit & Due Tracking', 'Online Shop (Share Link)'].map((feat, i) => (
              <motion.li initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + (i*0.1) }} key={i} style={{ padding: '12px 0', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px' }}>
                <CheckCircle size={20} color="#16a34a" /> {feat}
              </motion.li>
            ))}
          </ul>
          <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '20px', borderRadius: '16px', border: 'none', background: 'linear-gradient(135deg, #dc2626, #f59e0b)', color: 'white', fontWeight: 900, fontSize: '18px', cursor: 'pointer', textTransform: 'uppercase' }}>🚀 Start Free Trial</button>
        </motion.div>
      </div>

      {/* Footer */}
      <div style={{ padding: '80px 20px', background: '#000', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>🎯 Join The Revolution</h2>
        <p style={{ fontSize: '24px', color: '#fbbf24', fontWeight: 800, marginBottom: '40px' }}>కాగితం బిల్లులతో చివరిగా ఉండకండి</p>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/login')} style={{ background: '#fff', color: '#000', border: 'none', padding: '20px 50px', borderRadius: '50px', fontSize: '20px', fontWeight: 900, cursor: 'pointer' }}>
          Launch MyStore
        </motion.button>
      </div>
    </div>
  );
};

export default LandingPage;
