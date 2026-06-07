import { useNavigate } from 'react-router-dom';

export default function LandingNav({ config = {} }) {
  const navigate = useNavigate();
  const links = ['Features', 'Pricing', 'For Distributors', 'About'];

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(13,17,23,0.92)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      height: 60,
      display: 'flex', alignItems: 'center',
      padding: '0 40px', justifyContent: 'space-between',
      fontFamily: "'Inter',system-ui,sans-serif",
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, background: '#2563EB', borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(37,99,235,0.45)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </div>
        <div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: '-.02em' }}>
            {config.brandName || 'MyStore OS'}
          </span>
          <span style={{
            marginLeft: 7, background: 'rgba(37,99,235,0.22)',
            color: '#93C5FD', fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 20,
            border: '1px solid rgba(37,99,235,0.35)', letterSpacing: '.07em',
          }}>ENTERPRISE</span>
        </div>
      </div>

      {/* Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {links.map(l => (
          <button key={l} style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
            fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 7,
            cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif",
            transition: 'color .15s, background .15s',
          }}
            onMouseEnter={e => { e.target.style.color='#fff'; e.target.style.background='rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { e.target.style.color='rgba(255,255,255,0.55)'; e.target.style.background='transparent'; }}
          >{l}</button>
        ))}
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => navigate('/login')} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600,
          padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
          fontFamily: "'Inter',system-ui,sans-serif", transition: 'all .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.4)'; e.currentTarget.style.color='#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.18)'; e.currentTarget.style.color='rgba(255,255,255,0.75)'; }}
        >Login</button>
        <button onClick={() => navigate('/register')} style={{
          background: '#2563EB', border: 'none', color: '#fff',
          fontSize: 13, fontWeight: 700, padding: '9px 20px', borderRadius: 8,
          cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif",
          boxShadow: '0 0 22px rgba(37,99,235,0.5)', transition: 'filter .15s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
          onMouseEnter={e => e.currentTarget.style.filter='brightness(1.1)'}
          onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Start Free Trial
        </button>
      </div>
    </nav>
  );
}
