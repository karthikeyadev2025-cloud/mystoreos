import { useNavigate } from 'react-router-dom';
import { Zap, Star } from 'lucide-react';

export default function LandingFinalCTA() {
  const navigate = useNavigate();
  return (
    <section style={{
      background: '#0D1117',
      padding: 'clamp(48px,7vw,80px) clamp(16px,5vw,40px)',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      <div style={{
        maxWidth: 860, margin: '0 auto',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 20, padding: 'clamp(36px,6vw,64px) clamp(20px,5vw,48px)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 600, height: 400,
          background: 'radial-gradient(ellipse,rgba(79,70,229,0.1),transparent 65%)',
          pointerEvents: 'none',
        }}/>
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-flex', gap: 6, alignItems: 'center',
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 20, padding: '5px 16px', marginBottom: 20,
          }}>
            <Star size={12} color="#F59E0B" fill="#F59E0B"/>
            <span style={{ color: '#FCD34D', fontSize: 12, fontWeight: 600 }}>
              Trusted by 12,847+ Merchant Outlets
            </span>
          </div>
          <h2 style={{
            color: '#fff', fontSize: 'clamp(22px,4vw,34px)', fontWeight: 800, margin: '0 0 14px',
            letterSpacing: '-.025em', lineHeight: 1.18,
          }}>
            Ready to Modernise Your Business?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 'clamp(14px,2vw,16px)', marginBottom: 36, lineHeight: 1.65 }}>
            Join thousands of Indian retailers scaling confidently with MyStore OS.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/register')} style={{
              background: '#4F46E5', color: '#fff', border: 'none',
              padding: 'clamp(11px,2vw,13px) clamp(20px,4vw,32px)',
              borderRadius: 10, fontSize: 'clamp(13px,2vw,15px)', fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 0 36px rgba(79,70,229,0.5)', transition: 'filter .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.filter='brightness(1.12)'}
              onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}
            >
              <Zap size={16} strokeWidth={2.5}/>Start Free 7-Day Trial
            </button>
            <button onClick={() => navigate('/contact')} style={{
              background: 'transparent', color: 'rgba(255,255,255,0.65)',
              border: '1.5px solid rgba(255,255,255,0.18)',
              padding: 'clamp(11px,2vw,13px) clamp(20px,4vw,32px)',
              borderRadius: 10, fontSize: 'clamp(13px,2vw,15px)', fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
              transition: 'all .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='rgba(255,255,255,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.65)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.18)'; }}
            >Talk to Sales</button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 20 }}>
            No credit card required · Cancel anytime · GST invoice provided
          </p>
        </div>
      </div>
    </section>
  );
}
