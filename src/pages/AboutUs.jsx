import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MLogo from '../components/MLogo';

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

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const fn = () => setY(window.scrollY);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return y;
}

function useInView(ref, threshold = 0.2) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return visible;
}

function AnimatedSection({ children, delay = 0, direction = 'up' }) {
  const ref = useRef(null);
  const visible = useInView(ref);
  const transforms = { up: 'translateY(40px)', left: 'translateX(-40px)', right: 'translateX(40px)' };
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : transforms[direction],
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

export default function AboutUs() {
  const navigate = useNavigate();
  const scrollY = useScrollY();
  const navSolid = scrollY > 60;

  const heroOpacity = Math.max(0, 1 - scrollY / 500);
  const heroScale = Math.max(0.95, 1 - scrollY / 5000);
  const parallax = scrollY * 0.3;

  return (
    <div style={{ background: '#03060f', minHeight: '100vh', fontFamily: "'Outfit', sans-serif", color: '#f1f5f9', overflowX: 'hidden' }}>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
        @keyframes orb1 { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.1) translate(20px,-20px)} }
        @keyframes orb2 { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.08) translate(-20px,20px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes scrollDot { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(20px);opacity:0} }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        .val-card:hover { background: rgba(244,63,94,0.06) !important; border-color: rgba(244,63,94,0.2) !important; transform: translateY(-4px); }
        .cta-btn:hover { transform: scale(1.04); box-shadow: 0 0 60px rgba(244,63,94,0.4) !important; }
        .back-btn:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 5%',
        background: navSolid ? 'rgba(3,6,15,0.95)' : 'transparent',
        backdropFilter: navSolid ? 'blur(20px)' : 'none',
        borderBottom: navSolid ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MLogo size={34} radius={9} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>MyStore OS</span>
        </button>
        <button className="cta-btn" onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', borderRadius: 10, padding: '9px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' }}>
          Start Free Trial →
        </button>
      </nav>

      {/* HERO */}
      <section style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', top: '-15%', left: '-15%', background: 'radial-gradient(circle,rgba(244,63,94,0.13) 0%,transparent 70%)', animation: 'orb1 9s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', bottom: '-10%', right: '-8%', background: 'radial-gradient(circle,rgba(139,92,246,0.13) 0%,transparent 70%)', animation: 'orb2 11s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', top: '40%', right: '25%', background: 'radial-gradient(circle,rgba(251,191,36,0.07) 0%,transparent 70%)', animation: 'orb1 14s ease-in-out infinite reverse', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)', backgroundSize: '80px 80px', transform: `translateY(${parallax}px)`, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 5%', maxWidth: 920, opacity: heroOpacity, transform: `scale(${heroScale})` }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 100, padding: '5px 18px', marginBottom: 32, animation: 'fadeIn 0.8s ease 0.1s both' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e', display: 'block', animation: 'blink 2s infinite' }} />
            <span style={{ color: '#f43f5e', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>K² ADEXOS GLOBAL TECHNOLOGIES</span>
          </div>

          <div style={{ overflow: 'hidden', marginBottom: 4 }}>
            <h1 style={{ fontSize: 'clamp(2.8rem,9vw,7rem)', fontWeight: 900, lineHeight: 0.95, margin: 0, letterSpacing: '-0.04em', color: '#fff', animation: 'fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
              WE BUILD FOR
            </h1>
          </div>
          <div style={{ overflow: 'hidden', marginBottom: 32 }}>
            <h1 style={{ fontSize: 'clamp(2.8rem,9vw,7rem)', fontWeight: 900, lineHeight: 0.95, margin: 0, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#f43f5e 0%,#8b5cf6 50%,#fbbf24 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both' }}>
              INDIA&apos;S FUTURE
            </h1>
          </div>

          <p style={{ fontSize: 'clamp(1rem,2vw,1.2rem)', color: '#94a3b8', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7, animation: 'fadeUp 0.8s ease 0.5s both' }}>
            A technology company born from a simple belief — every Indian business deserves world-class software.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp 0.8s ease 0.65s both' }}>
            <button className="cta-btn" onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', borderRadius: 12, padding: '13px 28px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 40px rgba(244,63,94,0.25)', transition: 'all 0.3s ease' }}>
              Start Free Trial 🚀
            </button>
            <button className="back-btn" onClick={() => document.getElementById('story')?.scrollIntoView({ behavior: 'smooth' })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '13px 28px', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' }}>
              Our Story ↓
            </button>
          </div>

          <div style={{ position: 'absolute', bottom: -80, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'fadeIn 1s ease 1.2s both' }}>
            <span style={{ color: '#334155', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>scroll</span>
            <div style={{ width: 20, height: 32, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
              <div style={{ width: 3, height: 8, background: '#f43f5e', borderRadius: 2, animation: 'scrollDot 1.5s ease infinite' }} />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '64px 5%' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 32, textAlign: 'center' }}>
          {STATS.map((s, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <div style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 900, background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.number}</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* STORY */}
      <section id="story" style={{ padding: '110px 5%' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <AnimatedSection>
            <div style={{ textAlign: 'center', marginBottom: 72 }}>
              <span style={{ color: '#f43f5e', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Our Story</span>
              <h2 style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, color: '#fff', margin: '14px 0 0', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                From a Notebook<br />
                <span style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>to a Movement</span>
              </h2>
            </div>
          </AnimatedSection>

          {STORY.map((beat, i) => (
            <AnimatedSection key={i} delay={0.1} direction="left">
              <div style={{ display: 'flex', gap: 28, marginBottom: 64 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 52 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, animation: `float ${6 + i}s ease-in-out infinite` }}>{beat.icon}</div>
                  {i < STORY.length - 1 && <div style={{ width: 1, flex: 1, marginTop: 12, background: 'linear-gradient(to bottom,rgba(244,63,94,0.3),transparent)' }} />}
                </div>
                <div style={{ flex: 1, paddingTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{beat.year}</span>
                  <h3 style={{ fontSize: 'clamp(1.2rem,2.5vw,1.55rem)', fontWeight: 800, color: '#fff', margin: '6px 0 10px', letterSpacing: '-0.02em' }}>{beat.title}</h3>
                  <p style={{ color: '#94a3b8', fontSize: 'clamp(0.9rem,1.5vw,1rem)', lineHeight: 1.85, margin: 0 }}>{beat.body}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* VALUES */}
      <section style={{ padding: '80px 5%', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <AnimatedSection>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <span style={{ color: '#8b5cf6', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>What Drives Us</span>
              <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: '#fff', margin: '14px 0 0', letterSpacing: '-0.02em' }}>Our Values</h2>
            </div>
          </AnimatedSection>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 20 }}>
            {VALUES.map((v, i) => (
              <AnimatedSection key={i} delay={i * 0.12}>
                <div className="val-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '26px 22px', transition: 'all 0.3s ease', cursor: 'default' }}>
                  <div style={{ fontSize: 30, marginBottom: 14 }}>{v.icon}</div>
                  <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{v.title}</h3>
                  <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{v.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* COMPANY */}
      <section style={{ padding: '90px 5%' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <AnimatedSection>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>The Company</span>
              <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2.2rem)', fontWeight: 900, color: '#fff', margin: '14px 0 0', letterSpacing: '-0.02em' }}>K² ADEXOS GLOBAL TECHNOLOGIES</h2>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.15}>
            <div style={{ background: 'linear-gradient(135deg,rgba(244,63,94,0.05),rgba(139,92,246,0.05))', border: '1px solid rgba(244,63,94,0.12)', borderRadius: 24, padding: '44px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(244,63,94,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 36, position: 'relative' }}>
                <div>
                  <h3 style={{ color: '#f43f5e', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>Who We Are</h3>
                  <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.8, margin: 0 }}>A technology company rooted in India, building digital infrastructure for the next generation of Indian businesses — from a single kirana shop to a pan-India wholesale network.</p>
                </div>
                <div>
                  <h3 style={{ color: '#8b5cf6', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>Contact Us</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      ['✉️', 'rgba(251,191,36,0.1)', 'mailto:adexosindia@gmail.com', 'adexosindia@gmail.com'],
                      ['💬', 'rgba(16,185,129,0.1)', '/support', 'In-App Support'],
                    ].map(([icon, bg, href, label]) => (
                      <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, transition: 'color 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>
                        <span style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</span>
                        {label}
                      </a>
                    ))}
                    <span style={{ color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📍</span>
                      Andhra Pradesh, India
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '110px 5%', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,rgba(244,63,94,0.07) 0%,transparent 65%)', pointerEvents: 'none' }} />
        <AnimatedSection>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem,5vw,3.5rem)', fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
              Ready to join<br />
              <span style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>the revolution?</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.7, margin: '0 0 36px' }}>500+ businesses already use MyStore OS every day.</p>
            <button className="cta-btn" onClick={() => navigate('/register')} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', borderRadius: 14, padding: '15px 40px', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 40px rgba(244,63,94,0.25)', transition: 'all 0.3s ease' }}>
              Start Free 7-Day Trial 🚀
            </button>
          </div>
        </AnimatedSection>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '28px 5%', textAlign: 'center' }}>
        <p style={{ color: '#334155', fontSize: 12, margin: 0 }}>
          © 2025 MyStore OS — K² ADEXOS GLOBAL TECHNOLOGIES &nbsp;·&nbsp;
          <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Privacy</button> &nbsp;·&nbsp;
          <button onClick={() => navigate('/terms')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Terms</button> &nbsp;·&nbsp;
          <button onClick={() => navigate('/contact')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>Contact</button>
        </p>
      </footer>

    </div>
  );
}
