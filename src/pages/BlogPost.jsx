import { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';

const POSTS = {
  'ravi-kirana-store-savings': {
    title: "How Ravi's Kirana Store Saved ₹8,000/month with MyStore OS",
    description: "From scribbled credit registers to a clean digital ledger — Ravi's switch to MyStore OS cut paper, errors, and missed collections in one go.",
    accent: '#10b981',
    location: 'Nagpur, Maharashtra',
    shopType: 'Kirana / Provision Store',
    savingsHighlight: '₹8,000/month',
    timeToSetup: '2 hours',
    content: [
      {
        heading: 'The problem: notebooks, missed dues, and end-of-day chaos',
        body: "Ravi Sharma has run a mid-sized kirana store in Nagpur's Dharampeth area for eleven years. His challenge wasn't sales — it was the paper trail. Two notebooks tracked credit customers, a third tracked stock. Every evening, reconciling cash with the notebooks took 45 minutes. Missed dues averaged ₹6,000–9,000 every month because Ravi couldn't always chase customers while managing the counter."
      },
      {
        heading: 'Going digital in one afternoon',
        body: "A neighbour running a medical shop mentioned MyStore OS. Ravi signed up on a Tuesday afternoon. He entered his top 80 items in an hour using the bulk-add feature, imported 40 credit customers from his notebook, and ran his first GST bill before closing time. \"I thought it would take a week to learn. It didn't,\" he said."
      },
      {
        heading: 'WhatsApp bills changed collections overnight',
        body: "The single biggest change: sending bills over WhatsApp. Customers started paying faster because they had a digital record. Ravi set up automated credit reminders for outstanding balances of more than 7 days. In the first month, collections improved by ₹5,200. Disputes dropped to near zero because every transaction had a timestamped bill the customer had already seen."
      },
      {
        heading: 'Inventory alerts prevented two stock-outs',
        body: "Ravi set low-stock alerts for his top 30 fast-moving SKUs. In the first month the app flagged a shortfall in refined oil and toor dal three days before Diwali — items he might otherwise have missed ordering. He estimates avoiding two stock-outs saved at least ₹4,000 in lost sales."
      },
      {
        heading: 'The numbers after 60 days',
        body: "Reduced missed collections: ₹5,200. Fewer over-ordering errors: ₹1,800. Time saved (billing + stock + end-of-day): 1.5 hours/day. Ravi's monthly saving lands comfortably above ₹8,000 when he factors in the hours he gets back. He now recommends MyStore OS to every kirana owner he knows in the locality."
      },
    ],
    quote: { text: "पहले हर रात 45 मिनट हिसाब लगाता था। अब 5 मिनट में हो जाता है।", author: 'Ravi Sharma', shop: 'Provision Store, Nagpur' },
  },
  'paper-ledger-to-digital': {
    title: 'From Paper Ledger to Digital: A Wholesale Distributor\'s Story',
    description: 'How a South Indian FMCG distributor moved 200+ shops onto a single dashboard — and recovered ₹3 lakh in stuck dues in the first month.',
    accent: '#3b82f6',
    location: 'Coimbatore, Tamil Nadu',
    shopType: 'FMCG Wholesale Distribution',
    savingsHighlight: '₹3 lakh recovered (month 1)',
    timeToSetup: '3 days',
    content: [
      {
        heading: 'Scale changes everything',
        body: "Suresh Annamalai distributes FMCG goods to 230 retail shops across Coimbatore district. At that scale, paper stops working. His team of four salespeople each maintained their own ledger books. Outstanding dues were tracked in an Excel sheet that was always two weeks behind. Monthly reconciliation took four days and still had errors."
      },
      {
        heading: 'The tipping point',
        body: "In October 2024 Suresh discovered that two salespeople had given the same large retailer an extra 30-day credit extension without informing each other. Combined outstanding: ₹1.1 lakh from a single shop with no purchase history for 45 days. That was the day he decided to move everything digital."
      },
      {
        heading: 'Migration: 230 shops in 3 days',
        body: "MyStore OS support helped Suresh import his shop roster via CSV. Each retailer got a unique profile with their credit limit, payment terms, and order history. Salespeople accessed the same dashboard from their phones. Duplicate credit extensions became impossible — the app enforces per-shop credit limits in real time."
      },
      {
        heading: 'Collections: ₹3 lakh in 30 days',
        body: "With every outstanding balance visible on a single screen, Suresh's team ran a structured recovery campaign. Automated WhatsApp reminders went to shops with dues over 15 days. Route-wise collection lists let each salesperson see exactly who to visit. In the first 30 days, ₹3.04 lakh in stuck dues came in — some of it more than 90 days old."
      },
      {
        heading: 'Route planning cut fuel costs',
        body: "The route planner feature grouped visits by area, reducing unnecessary criss-crossing. Suresh estimates his four salespeople collectively save 45 minutes of driving per day. Across a six-day week that's 18 hours reclaimed every month — time now spent on new shop onboarding rather than travel."
      },
      {
        heading: 'What the distributor dashboard gave them',
        body: "Suresh now sees a real-time view of every shop's outstanding balance, last order date, and credit utilisation. Monthly GST exports go directly to his CA, cutting that routine from two days to two hours. \"I can now see my entire business on my phone at 7 AM,\" he said. \"I couldn't do that with ten notebooks.\""
      },
    ],
    quote: { text: 'முதல் மாதத்திலேயே ₹3 லட்சம் திரும்ப வந்தது. இது மென்பொருள் மட்டும் இல்லை — இது என் வியாபாரத்தை மீட்டது.', author: 'Suresh Annamalai', shop: 'FMCG Distributor, Coimbatore' },
  },
  'gst-filing-10-minutes': {
    title: 'GST Filing in 10 Minutes — How MyStore OS Helped 50 Shops',
    description: 'GSTR-1 export, HSN auto-fill, CA portal access — see how small retailers cut their monthly GST routine from a day to under an hour.',
    accent: '#4F46E5',
    location: 'Across India',
    shopType: 'Retail — Grocery, Pharmacy, Stationery',
    savingsHighlight: 'Full day → 10 minutes',
    timeToSetup: '< 1 hour per shop',
    content: [
      {
        heading: 'GST filing: the monthly dread',
        body: "For most small shopkeepers, the 10th of every month triggers the same anxiety: collecting bills, finding HSN codes, totalling taxable sales by slab, and hoping the numbers match the bank. For shops doing ₹5–20 lakh in monthly turnover, this takes four to eight hours — most of it manual data entry a CA has to re-check anyway."
      },
      {
        heading: 'How MyStore OS fixes the plumbing',
        body: "Every bill created in MyStore OS records the item's HSN code, GST rate, CGST, SGST, and IGST amounts at the point of sale. There is nothing to aggregate later — the data is already structured. The GSTR-1 export button produces a JSON file ready to upload to the GST portal, or a formatted Excel for CAs who prefer their own software."
      },
      {
        heading: 'CA portal access: the game changer',
        body: "Many shopkeepers in our survey said the biggest time drain was emailing PDFs back and forth with their CA. MyStore OS now offers CA portal access: the shopkeeper adds their CA's email, the CA logs in with read-only access, pulls the GSTR-1 export, reconciles it with the ledger, and files — without a single phone call or WhatsApp forward. Fifty shops in our beta group averaged a 94% reduction in filing time."
      },
      {
        heading: 'HSN auto-fill: removing the lookup step',
        body: "Most shopkeepers lose 20–30 minutes each filing cycle looking up HSN codes for new items they stocked that month. MyStore OS maintains a curated database of 12,000+ common retail items with their HSN codes pre-filled. When you add a new product, the app suggests the HSN. You confirm once, and every bill for that item is correctly tagged from that point forward."
      },
      {
        heading: 'Real numbers from the beta group',
        body: "Across 50 shops (mix of grocery, pharmacy, stationery) in our December 2024 beta: average monthly GST filing time before MyStore OS: 5.2 hours. After: 18 minutes. Shops with CAs reported an additional 40-minute saving in back-and-forth. Three shops caught discrepancies in their previous manual filings that MyStore OS flagged automatically."
      },
      {
        heading: 'Getting started today',
        body: "GST-ready billing works on the free plan — you don't need a paid tier to file correctly. Sign up, add your GSTIN in settings, and your first bill is compliant out of the box. The GSTR-1 export and CA portal access are available on the Pro plan."
      },
    ],
    quote: { text: 'ഞാൻ മുമ്പ് GST filing-ന് ഒരു ദിവസം മുഴുവൻ ചെലവഴിച്ചിരുന്നു. ഇപ്പോൾ 10 മിനിറ്റ് മതി.', author: 'Pradeep Nair', shop: 'Stationery Shop, Kozhikode' },
  },
};

const setMeta = (name, content) => {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) { tag = document.createElement('meta'); tag.setAttribute('name', name); document.head.appendChild(tag); }
  tag.setAttribute('content', content);
};

const BlogPost = () => {
  const { slug } = useParams();
  const post = POSTS[slug];

  useEffect(() => {
    if (!post) return;
    const prev = document.title;
    document.title = `${post.title} | MyStore OS Blog`;
    setMeta('description', post.description);
    return () => { document.title = prev; };
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '72px 24px 48px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <Link to="/blog" style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none', display: 'inline-block', marginBottom: '28px' }}>← All stories</Link>
          <div style={{ width: '40px', height: '4px', background: post.accent, borderRadius: '2px', marginBottom: '24px' }} />
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.2 }}>{post.title}</h1>
          <p style={{ fontSize: '16px', color: '#cbd5e1', margin: '0 0 28px', lineHeight: 1.6 }}>{post.description}</p>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', color: '#64748b' }}>
            <span>📍 {post.location}</span>
            <span>🏪 {post.shopType}</span>
            <span style={{ color: post.accent, fontWeight: 700 }}>💰 {post.savingsHighlight}</span>
            <span>⚡ Set up in {post.timeToSetup}</span>
          </div>
        </div>
      </section>

      {/* Quote pull */}
      <section style={{ padding: '48px 24px 0', maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ background: `linear-gradient(135deg,${post.accent}18,${post.accent}08)`, border: `1px solid ${post.accent}30`, borderLeft: `4px solid ${post.accent}`, borderRadius: '12px', padding: '24px 28px' }}>
          <p style={{ fontSize: '17px', fontStyle: 'italic', lineHeight: 1.65, margin: '0 0 12px', color: '#f8fafc' }}>"{post.quote.text}"</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>— {post.quote.author}, {post.quote.shop}</p>
        </div>
      </section>

      {/* Article body */}
      <article style={{ padding: '48px 24px 80px', maxWidth: '760px', margin: '0 auto' }}>
        {post.content.map((section, i) => (
          <section key={i} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 12px', color: '#f1f5f9' }}>{section.heading}</h2>
            <p style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: 1.75, margin: 0 }}>{section.body}</p>
          </section>
        ))}

        {/* CTA */}
        <div style={{ marginTop: '56px', padding: '36px', background: 'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(129,140,248,0.08))', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '16px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>Ready to see similar results?</h3>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 24px' }}>Start your free 7-day trial — no credit card required.</p>
          <Link to="/register" style={{ background: '#4F46E5', color: 'white', padding: '12px 28px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', display: 'inline-block', marginRight: '12px' }}>
            Start Free Trial
          </Link>
          <Link to="/blog" style={{ color: '#94a3b8', fontSize: '14px', textDecoration: 'none' }}>← More stories</Link>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;
