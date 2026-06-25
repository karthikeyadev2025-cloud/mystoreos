/**
 * NativeWelcome — Android welcome screen
 * Shows briefly on app open, then routes to /login.
 * All text uses explicit hex colors with !important to prevent Android
 * dark mode / WebView overrides from making text invisible.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NativeWelcome() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 50);
    const auto = setTimeout(() => navigate('/login', { replace: true }), 2200);
    return () => { clearTimeout(t); clearTimeout(auto); };
  }, [navigate]);
  
  const goLogin = () => navigate('/login', { replace: true });
  
  return (
    <div 
      onClick={goLogin}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: '#0F172A',
        backgroundImage: 'radial-gradient(circle at 50% 30%, #312E81 0%, #1E1B4B 40%, #0F172A 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        cursor: 'pointer',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.6s ease-out',
        zIndex: 9999,
        WebkitFontSmoothing: 'antialiased',
        colorScheme: 'dark',
      }}
    >
      {/* Real app icon - using img tag so it's always the actual M icon */}
      <img 
        src="/icon-192x192.png" 
        alt="MyStore OS"
        style={{
          width: 110,
          height: 110,
          borderRadius: 26,
          marginBottom: 32,
          boxShadow: '0 24px 60px rgba(79, 70, 229, 0.5), 0 0 0 1px rgba(255,255,255,0.1)',
          transform: show ? 'scale(1)' : 'scale(0.7)',
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          objectFit: 'cover',
        }}
        onError={(e) => {
          // Fallback if PNG missing - show CSS M
          e.target.style.display = 'none';
          e.target.parentNode.querySelector('.fallback-logo').style.display = 'flex';
        }}
      />
      
      {/* Fallback M logo - hidden by default, shown only if PNG fails */}
      <div className="fallback-logo" style={{
        display: 'none',
        width: 110,
        height: 110,
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        boxShadow: '0 24px 60px rgba(79, 70, 229, 0.5)',
        position: 'absolute',
      }}>
        <span style={{
          fontSize: 64,
          fontWeight: 900,
          color: '#FFFFFF',
          lineHeight: 1,
        }}>M</span>
      </div>
      
      {/* Welcome heading - EXPLICIT WHITE COLOR */}
      <h1 style={{
        fontSize: 30,
        fontWeight: 800,
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.2,
        marginBottom: 10,
        color: '#FFFFFF',
        letterSpacing: '-0.5px',
      }}>
        Welcome to <span style={{ color: '#A5B4FC' }}>MyStore OS</span>
      </h1>
      
      {/* Subtitle - EXPLICIT LIGHT GRAY */}
      <p style={{
        fontSize: 15,
        margin: 0,
        textAlign: 'center',
        marginBottom: 44,
        maxWidth: 300,
        lineHeight: 1.5,
        color: '#CBD5E1',
      }}>
        Bill faster. Track smarter.<br/>
        India's #1 retail operating system.
      </p>
      
      {/* CTA button */}
      <div style={{
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        borderRadius: 14,
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 15,
        fontWeight: 700,
        color: '#FFFFFF',
        boxShadow: '0 10px 30px rgba(79, 70, 229, 0.4)',
      }}>
        <span style={{ color: '#FFFFFF' }}>Tap to Sign In</span>
        <span style={{ color: '#FFFFFF', fontSize: 18 }}>→</span>
      </div>
      
      {/* Loading dots */}
      <div style={{
        marginTop: 32,
        display: 'flex',
        gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#6366F1', animation: 'pulse 1.4s ease-in-out infinite' }} />
        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#6366F1', animation: 'pulse 1.4s ease-in-out 0.2s infinite' }} />
        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#6366F1', animation: 'pulse 1.4s ease-in-out 0.4s infinite' }} />
      </div>
      
      {/* Bottom branding - EXPLICIT */}
      <div style={{
        position: 'absolute',
        bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 11,
        color: '#94A3B8',
        letterSpacing: '0.5px',
      }}>
        by K2 Adexos Global Technologies
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
