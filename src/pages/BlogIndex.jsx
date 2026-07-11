import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import LandingNav from '../components/landing/LandingNav';
import LandingFooter from '../components/landing/LandingFooter';
import { T, F, LANDING_CSS } from '../components/landing/_tokens';
import { POSTS } from './_blogPosts';

const setMeta = (name, content) => {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) { tag = document.createElement('meta'); tag.setAttribute('name', name); document.head.appendChild(tag); }
  tag.setAttribute('content', content);
};

export default function BlogIndex() {
  const navigate = useNavigate();
  const posts = Object.entries(POSTS);

  useEffect(() => {
    const prev = document.title;
    document.title = 'MyStore OS Blog — Real Numbers From Real Businesses';
    setMeta('description', 'Case studies from shops, distributors, and service businesses using MyStore OS for billing, bookings, GST, and credit management.');
    return () => { document.title = prev; };
  }, []);

  return (
    <div style={{ background: T.void, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{LANDING_CSS}</style>
      <LandingNav navigate={navigate} />

      <header style={{
        background: T.voidLift, borderBottom: `1px solid ${T.edge}`,
        padding: 'clamp(56px,7vw,88px) clamp(20px,5vw,48px) clamp(44px,5vw,60px)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <span className="lx-eyebrow">The blog</span>
          <h1 className="lx-title" style={{ fontSize: 'clamp(30px,4.6vw,48px)', margin: '14px 0 12px', maxWidth: '14ch' }}>
            What actually changed for them.
          </h1>
          <p className="lx-lede" style={{ maxWidth: 520 }}>
            Case studies from shops, distributors, and service businesses — with the real numbers, not the marketing version.
          </p>
        </div>
      </header>

      <main style={{ padding: 'clamp(48px,6vw,72px) clamp(20px,5vw,48px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="lx-blog-grid">
            {posts.map(([slug, p], i) => (
              <Link
                key={slug}
                to={`/blog/${slug}`}
                className="lx-post lx-surface lx-surface-hover"
                style={{
                  padding: 24, textDecoration: 'none', display: 'flex',
                  flexDirection: 'column', animationDelay: `${i * 70}ms`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.accent, boxShadow: `0 0 12px ${p.accent}` }} />
                  <span style={{
                    fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: T.textFaint,
                  }}>{p.shopType}</span>
                </div>
                <h2 style={{
                  fontFamily: F.display, fontSize: 17, fontWeight: 700,
                  color: T.text, lineHeight: 1.35, margin: '0 0 10px', letterSpacing: '-0.01em',
                }}>{p.title}</h2>
                <p style={{
                  fontFamily: F.body, fontSize: 13.5, color: T.textSoft,
                  lineHeight: 1.65, margin: '0 0 20px', flex: 1,
                }}>{p.description}</p>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 14, borderTop: `1px solid ${T.edge}`,
                }}>
                  <span className="lx-fig" style={{ fontSize: 12.5, fontWeight: 700, color: p.accent }}>{p.savingsHighlight}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: F.body, fontSize: 12.5, fontWeight: 600, color: T.textFaint,
                  }}>
                    Read <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <LandingFooter navigate={navigate} />

      <style>{`
        .lx-blog-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 18px;
        }
      `}</style>
    </div>
  );
}
