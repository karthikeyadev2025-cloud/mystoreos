import { useEffect } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Store, IndianRupee, Zap } from 'lucide-react';
import LandingNav from '../components/landing/LandingNav';
import LandingFooter from '../components/landing/LandingFooter';
import { T, F, LANDING_CSS } from '../components/landing/_tokens';
import { POSTS } from './_blogPosts';

const setMeta = (name, content) => {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) { tag = document.createElement('meta'); tag.setAttribute('name', name); document.head.appendChild(tag); }
  tag.setAttribute('content', content);
};

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = POSTS[slug];

  useEffect(() => {
    if (!post) return;
    const prev = document.title;
    document.title = `${post.title} | MyStore OS Blog`;
    setMeta('description', post.description);
    return () => { document.title = prev; };
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  const meta = [
    [MapPin, post.location],
    [Store, post.shopType],
    [Zap, `Set up in ${post.timeToSetup}`],
  ];

  return (
    <div style={{ background: T.void, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{LANDING_CSS}</style>
      <LandingNav navigate={navigate} />

      {/* Header */}
      <header style={{
        background: T.voidLift, borderBottom: `1px solid ${T.edge}`,
        padding: 'clamp(48px,6vw,72px) clamp(20px,5vw,48px) clamp(36px,4vw,48px)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link to="/blog" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: F.body, fontSize: 13, color: T.textFaint,
            textDecoration: 'none', marginBottom: 26,
          }}>
            <ArrowLeft size={14} /> All stories
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: post.accent, boxShadow: `0 0 12px ${post.accent}` }} />
            <span style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.textFaint }}>
              {post.shopType}
            </span>
          </div>

          <h1 className="lx-title" style={{ fontSize: 'clamp(26px,4vw,40px)', margin: '0 0 16px', maxWidth: '20ch' }}>
            {post.title}
          </h1>
          <p style={{ fontFamily: F.body, fontSize: 15.5, color: T.textSoft, lineHeight: 1.7, margin: '0 0 24px', maxWidth: 560 }}>
            {post.description}
          </p>

          {/* Meta row — ledger-figure amount for savings */}
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
            {meta.map(([Icon, text]) => (
              <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: F.body, fontSize: 12.5, color: T.textFaint }}>
                <Icon size={13} /> {text}
              </span>
            ))}
            <span className="lx-fig" style={{ fontSize: 13, fontWeight: 700, color: post.accent, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IndianRupee size={12} /> {post.savingsHighlight}
            </span>
          </div>
        </div>
      </header>

      <main style={{ padding: 'clamp(40px,5vw,56px) clamp(20px,5vw,48px) clamp(64px,8vw,96px)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Pull quote — the ledger's marginalia treatment */}
          <blockquote style={{
            margin: '0 0 44px', padding: '22px 26px',
            background: `linear-gradient(180deg, ${post.accent}14, ${post.accent}05)`,
            borderLeft: `3px solid ${post.accent}`, borderRadius: '4px 12px 12px 4px',
          }}>
            <p style={{ fontFamily: F.display, fontSize: 17, fontStyle: 'italic', fontWeight: 500, color: T.text, lineHeight: 1.6, margin: '0 0 10px' }}>
              &ldquo;{post.quote.text}&rdquo;
            </p>
            <p style={{ fontFamily: F.mono, fontSize: 11.5, color: T.textFaint, margin: 0, letterSpacing: '0.02em' }}>
              — {post.quote.author}, {post.quote.shop}
            </p>
          </blockquote>

          {/* Article — numbered ruled sections, same as legal docs */}
          <div style={{ borderTop: `2px solid ${T.text}` }}>
            {post.content.map((section, i) => (
              <section
                key={section.heading}
                className="lx-post"
                style={{
                  padding: '26px 0', borderBottom: `1px solid ${T.edge}`,
                  animationDelay: `${Math.min(i, 6) * 50}ms`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
                  <span className="lx-fig" style={{ fontSize: 12.5, color: T.textGhost, minWidth: 20 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 style={{ fontFamily: F.display, fontSize: 17.5, fontWeight: 700, color: T.text, letterSpacing: '-0.015em', margin: 0 }}>
                    {section.heading}
                  </h2>
                </div>
                <p style={{ paddingLeft: 34, fontFamily: F.body, fontSize: 14.5, color: T.textSoft, lineHeight: 1.8, margin: 0 }}>
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          {/* CTA */}
          <div className="lx-surface" style={{
            marginTop: 44, padding: 'clamp(28px,4vw,40px)', textAlign: 'center',
            background: `linear-gradient(180deg, ${T.brandGlow}, transparent)`,
          }}>
            <h3 style={{ fontFamily: F.display, fontSize: 19, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>
              Ready for numbers like these?
            </h3>
            <p style={{ fontFamily: F.body, fontSize: 13.5, color: T.textSoft, margin: '0 0 24px' }}>
              Fifteen days free. No card. Every feature unlocked.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="lx-btn lx-btn-primary" onClick={() => navigate('/register')}>
                Start free
              </button>
              <Link to="/blog" className="lx-btn lx-btn-ghost">
                More stories
              </Link>
            </div>
          </div>
        </div>
      </main>

      <LandingFooter navigate={navigate} />
    </div>
  );
}
