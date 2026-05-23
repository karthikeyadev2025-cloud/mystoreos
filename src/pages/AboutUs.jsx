import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STORY = [
  { year: '2023', icon: '💡', title: 'The Problem', body: 'Every evening, thousands of shop owners across India sat hunched over paper ledgers — manually tallying sales, losing track of credit, missing expired stock. A single missed entry could wipe out a week\'s profit. There had to be a better way.' },
  { year: '2024', icon: '🔥', title: 'The Obsession', body: 'We watched. We listened. We sat inside kirana stores at 11 PM watching owners struggle with calculators and notebooks. What if one app could replace every piece of paper — bills, inventory, credit book, staff records, daily reports — and fit in a ₹5,000 Android phone?' },
  { year: '2024', icon: '⚡', title: 'The Build', body: 'Months of sleepless nights. Thousands of lines of code. Version after version, tested in real shops across Andhra Pradesh. When the internet dropped, the app kept working. When the power cut, the data survived. We refused to ship until it was bulletproof.' },
  { year: '2025', icon: '🚀', title: 'The Launch', body: 'MyStore OS went live. Not just another billing app — a complete operating system for Indian businesses. Retail, wholesale, distribution, services. One app. Zero paperwork. The dream that started in a notebook was now running in hundreds of shops across India.' },
  { year: 'Today', icon: '🌏', title: 'The Mission', body: 'We are K² ADEXOS GLOBAL TECHNOLOGIES — a technology company born in India, building for India. Our mission: make world-class business software accessible to every shop owner, distributor, and entrepreneur in this country, regardless of their size or budget.' },
];

const VALUES = [
  { icon: '🎯', title: 'Relentless Simplicity', desc: 'If a shop owner cannot use it in 30 seconds, we rebuild it until they can.' },
  { icon: '🛡️', title: 'Offline-First Always', desc: 'Indian networks are unpredictable. Our software works whether or not the internet does.' },
  { icon: '❤️', title: 'Built for Bharat', desc: 'Every feature is designed for Indian business realities — UPI, WhatsApp, GST, and all.' },
  { icon: '🔒', title: 'Your Data, Your Trust', desc: 'Bank-grade encryption. Data never sold. Privacy is not a feature — it is a foundation.' },
];

const STATS = [
  { number: '500+', label: 'Businesses Powered' },
  { number: '₹2Cr+', label: 'GMV Processed' },
  { number: '12', label: 'Cities Covered' },
  { number: '99.9%', label: 'Uptime' },
];

export default function AboutUs() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState({});

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setVisible(prev => ({ ...prev, [e.target.id]: true }));
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('[data-animate]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const heroOpacity = Math.max(0, 1 - scrollY / 400);

  return (
    <div style={{ background: '#03060f', minHeight: '100vh', fontFamily: "'Outfit', sans-serif", color: '#f1f5f9', overflowX: 'hidden' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 5%',
        background: scrollY > 60 ? 'rgba(3,6,15,0.95)' : 'transparent',
        backdropFilter: scrollY > 60 ? 'blur(20px)' : 'none',
        borderBottom: scrollY > 60 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 14 }}>M</div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>MyStore OS</span>
        </button>
        <button onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', borderRadius: 10, padding: '9px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Start Free Trial →
        </button>
      </nav>

      {/* HERO */}
      <section style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background orbs */}
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', top: '-10%', left: '-15%', background: 'radial-gradient(circle, rgba(244,63,94,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', bottom: '-10%', right: '-10%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 5%', maxWidth: 900, opacity: heroOpacity, transition: 'opacity 0.1s linear' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 100, padding: '5px 16px', marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e', display: 'block', animation: 'blink 2s infinite' }} />
            <span style={{ color: '#f43f5e', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>K² ADEXOS GLOBAL TECHNOLOGIES</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem,8vw,6.5rem)', fontWeight: 900, lineHeight: 0.95, margin: '0 0 8px', letterSpacing: '-0.04em', color: '#fff' }}>
            WE BUILD FOR
          </h1>
          <h1 style={{
            fontSize: 'clamp(2.5rem,8vw,6.5rem)', fontWeight: 900, lineHeight: 0.95, margin: '0 0 28px', letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #f43f5e 0%, #8b5cf6 50%, #fbbf24 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            INDIA'S FUTURE
          </h1>

          <p style={{ fontSize: 'clamp(1rem,2vw,1.2rem)', color: '#94a3b8', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
            A technology company born from a simple belief — every Indian business deserves world-class software.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', borderRadius: 12, padding: '13px 28px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Start Free Trial 🚀
            </button>
            <button onClick={() => { document.getElementById('story')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '13px 28px', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              Our Story ↓
            </button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '60px 5%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 32, textAlign: 'center' }}>
          {STATS.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 900, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>{s.number}</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* STORY */}
      <section id="story" style={{ padding: '100px 5%' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <span style={{ color: '#f43f5e', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Our Story</span>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, color: '#fff', margin: '12px 0 0', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              From a Notebook<br />
              <span style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>to a Movement</span>
            </h2>
          </div>

          {STORY.map((beat, i) => (
            <div
              key={i}
              id={`beat-${i}`}
              data-animate="true"
              style={{
                display: 'flex', gap: 28, marginBottom: 64,
                opacity: visible[`beat-${i}`] ? 1 : 0,
                transform: visible[`beat-${i}`] ? 'translateX(0)' : 'translateX(-32px)',
                transition: 'opacity 0.7s ease, transform 0.7s ease',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 52 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{beat.icon}</div>
                {i < STORY.length - 1 && <div style={{ width: 1, flex: 1, marginTop: 10, background: 'linear-gradient(to bottom, rgba(244,63,94,0.3), transparent)' }} />}
              </div>
              <div style={{ flex: 1, paddingTop: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{beat.year}</span>
                <h3 style={{ fontSize: 'clamp(1.2rem,2.5vw,1.5rem)', fontWeight: 800, color: '#fff', margin: '6px 0 10px', letterSpacing: '-0.02em' }}>{beat.title}</h3>
                <p style={{ color: '#94a3b8', fontSize: 'clamp(0.9rem,1.5vw,1rem)', lineHeight: 1.8, margin: 0 }}>{beat.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* VALUES */}
      <section style={{ padding: '80px 5%', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <span style={{ color: '#8b5cf6', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>What Drives Us</span>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: '#fff', margin: '12px 0 0', letterSpacing: '-0.02em' }}>Our Values</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 20 }}>
            {VALUES.map((v, i) => (
              <div
                key={i}
                id={`val-${i}`}
                data-animate="true"
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 18, padding: '26px 22px',
                  opacity: visible[`val-${i}`] ? 1 : 0,
                  transform: visible[`val-${i}`] ? 'translateY(0)' : 'translateY(24px)',
                  transition: `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s`,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 14 }}>{v.icon}</div>
                <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{v.title}</h3>
                <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPANY */}
      <section style={{ padding: '80px 5%' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>The Company</span>
            <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 900, color: '#fff', margin: '12px 0 0', letterSpacing: '-0.02em' }}>K² ADEXOS GLOBAL TECHNOLOGIES</h2>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.05), rgba(139,92,246,0.05))', border: '1px solid rgba(244,63,94,0.12)', borderRadius: 22, padding: '40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 36 }}>
              <div>
                <h3 style={{ color: '#f43f5e', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>Who We Are</h3>
                <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.8, margin: 0 }}>A technology company rooted in India, building the digital infrastructure for the next generation of Indian businesses — from a single kirana shop to a pan-India wholesale network.</p>
              </div>
              <div>
                <h3 style={{ color: '#8b5cf6', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>Contact Us</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <a href="mailto:adexosindia@gmail.com" style={{ color: '#94a3b8', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(251,191,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✉️</span>
                    adexosindia@gmail.com
                  </a>
                  <a href="https://wa.me/918885490495" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💬</span>
                    WhatsApp Support
                  </a>
                  <span style={{ color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📍</span>
                    Andhra Pradesh, India
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '100px 5%', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,5vw,3.5rem)', fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            Ready to join<br />
            <span style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>the revolution?</span>
          </h2>
          <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.7, margin: '0 0 36px' }}>500+ businesses already use MyStore OS every day.</p>
          <button onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', borderRadius: 14, padding: '15px 36px', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 40px rgba(244,63,94,0.25)' }}>
            Start Free 7-Day Trial 🚀
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '28px 5%', textAlign: 'center' }}>
        <p style={{ color: '#334155', fontSize: 12, margin: 0 }}>
          © 2025 MyStore OS — K² ADEXOS GLOBAL TECHNOLOGIES
          &nbsp;·&nbsp;
          <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Privacy</button>
          &nbsp;·&nbsp;
          <button onClick={() => navigate('/terms')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Terms</button>
          &nbsp;·&nbsp;
          <button onClick={() => navigate('/contact')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Contact</button>
        </p>
      </footer>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
