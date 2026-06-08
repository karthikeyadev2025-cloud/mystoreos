import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const POSTS = [
  {
    slug: 'ravi-kirana-store-savings',
    title: "How Ravi's Kirana Store Saved ₹8,000/month with MyStore OS",
    summary: "From scribbled credit registers to a clean digital ledger — Ravi's switch to MyStore OS cut paper, errors, and missed collections in one go.",
    accent: '#10b981',
  },
  {
    slug: 'paper-ledger-to-digital',
    title: 'From Paper Ledger to Digital: A Wholesale Distributor\'s Story',
    summary: 'How a South Indian FMCG distributor moved 200+ shops onto a single dashboard — and recovered ₹3 lakh in stuck dues in the first month.',
    accent: '#3b82f6',
  },
  {
    slug: 'gst-filing-10-minutes',
    title: 'GST Filing in 10 Minutes — How MyStore OS Helped 50 Shops',
    summary: 'GSTR-1 export, HSN auto-fill, CA portal access — see how small retailers cut their monthly GST routine from a day to under an hour.',
    accent: '#4F46E5',
  },
];

const setMeta = (name, content) => {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) { tag = document.createElement('meta'); tag.setAttribute('name', name); document.head.appendChild(tag); }
  tag.setAttribute('content', content);
};

const BlogIndex = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = 'MyStore OS Blog — Kirana, Billing & GST Case Studies';
    setMeta('description', 'Real stories from kirana shops, distributors, and small retailers using MyStore OS for billing, inventory, GST, and credit management.');
    return () => { document.title = prev; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
      <section style={{ padding: '72px 24px 32px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#94a3b8', letterSpacing: '2px', textTransform: 'uppercase' }}>The Blog</p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, margin: '0 0 16px' }}>Stories from real shopkeepers</h1>
          <p style={{ fontSize: '15px', color: '#94a3b8', margin: 0 }}>Case studies and playbooks from kirana stores, wholesale distributors, and provision shops across India.</p>
        </div>
      </section>

      <section style={{ padding: '48px 24px 72px', maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {POSTS.map(p => (
            <article key={p.slug} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: '40px', height: '4px', background: p.accent, borderRadius: '2px', marginBottom: '20px' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.3 }}>{p.title}</h2>
              <p style={{ fontSize: '13px', color: '#cbd5e1', margin: '0 0 24px', lineHeight: 1.6, flex: 1 }}>{p.summary}</p>
              <Link to={`/blog/${p.slug}`} style={{ color: p.accent, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>Read more →</Link>
            </article>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <Link to="/" style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none' }}>← Back to MyStore OS</Link>
        </div>
      </section>
    </div>
  );
};

export default BlogIndex;
