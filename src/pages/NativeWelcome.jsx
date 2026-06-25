/**
 * NativeWelcome — Android/iOS welcome screen
 * 
 * Shown ONLY when the app is opened inside the Capacitor native app (not web).
 * Replaces the marketing landing page with a clean "Welcome to MyStore OS"
 * screen that auto-routes to /login after a brief delay (or on tap).
 * 
 * Web users (desktop/mobile browser) still see the full LandingPage — this
 * component is only routed to when isNativeApp() === true.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function NativeWelcome() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    // Fade-in animation
    const t = setTimeout(() => setShow(true), 50);
    // Auto-route to /login after 2.5 seconds (or user taps)
    const auto = setTimeout(() => navigate('/login', { replace: true }), 2500);
    return () => { clearTimeout(t); clearTimeout(auto); };
  }, [navigate]);
  
  const goLogin = () => navigate('/login', { replace: true });
  
  return (
    <div 
      onClick={goLogin}
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'linear-gradient(180deg, #0F172A 0%, #1E1B4B 100%)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        cursor: 'pointer',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.6s ease-out',
      }}
    >
      {/* Logo M */}
      <div style={{
        width: 96,
        height: 96,
        background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
        borderRadius: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 20px 60px rgba(79, 70, 229, 0.4)',
        marginBottom: 28,
        transform: show ? 'scale(1)' : 'scale(0.8)',
        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <span style={{
          fontSize: 54,
          fontWeight: 900,
          color: '#FFFFFF',
          letterSpacing: '-2px',
          lineHeight: 1,
        }}>M</span>
      </div>
      
      {/* Welcome heading */}
      <h1 style={{
        fontSize: 28,
        fontWeight: 800,
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.2,
        marginBottom: 8,
      }}>
        Welcome to MyStore OS
      </h1>
      
      {/* Subtitle */}
      <p style={{
        fontSize: 15,
        color: 'rgba(255,255,255,0.7)',
        margin: 0,
        textAlign: 'center',
        marginBottom: 40,
        maxWidth: 280,
        lineHeight: 1.5,
      }}>
        India's most powerful retail operating system. Bill faster, track smarter.
      </p>
      
      {/* Tap to continue button */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 14,
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        fontWeight: 600,
        color: 'white',
      }}>
        <ShieldCheck size={18} color="#4ade80" />
        Tap to continue to Sign In
        <ArrowRight size={16} />
      </div>
      
      {/* Bottom branding */}
      <div style={{
        position: 'absolute',
        bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
      }}>
        by K2 Adexos Global Technologies
      </div>
    </div>
  );
}
