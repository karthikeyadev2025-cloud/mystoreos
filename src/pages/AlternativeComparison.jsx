import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, Star, Flame, Landmark } from 'lucide-react';
import MLogo from '../components/MLogo';
import LandingFooter from '../components/landing/LandingFooter';
import { T, LANDING_CSS } from '../components/landing/_tokens';

const COMPARISON_DATA = {
  tally: {
    name: 'Tally Prime',
    headline: 'Ditch Costly Windows PCs & Heavy Accounting Courses.',
    sub: 'Tally was built in 1986 for desktops. MyStore OS is built for mobile, native WhatsApp invoicing, and instant retail billing.',
    tco: '₹18,000+ per year',
    device: 'High-end Windows Desktop Only',
    learning: '3-Month Professional Accounting Course Required',
    whatsapp: '❌ Requires third-party paid API integration',
    upi: '❌ No direct mobile QR generation',
    offlineLedger: '❌ Restrictive sync required',
    pros: [
      'Zero learning curve — starts billing instantly in 30 seconds',
      'Runs smoothly on any basic ₹8,000 Android smartphone',
      '100% free paperless WhatsApp invoice delivery built-in',
      'Multi-language support (Hindi, Tamil, Telugu, Kannada, Marathi, Bengali) for shops across India'
    ]
  },
  vyapar: {
    name: 'Vyapar App',
    headline: 'Stop Paying Expensive Yearly Subscription Tolls.',
    sub: 'Why pay thousands yearly for basic desktop billing? MyStore OS gives you full POS capabilities, batch tracking, and direct supplier credit ledgers at zero cost for starting businesses.',
    tco: '₹3,000+ per year subscription',
    device: 'Desktop/Android (Paid per device)',
    learning: 'Moderate (Accounting terminologies used)',
    whatsapp: '⚠️ Limited (Includes Vyapar branding unless premium)',
    upi: '⚠️ Standard dynamic QR only',
    offlineLedger: '⚠️ Local backup needs manual trigger',
    pros: [
      'Truly free trial tier to get your business started with zero risk',
      'Advanced batch tracking with 90-day automated near-expiry alerts',
      'Automatic sync between shopkeepers and wholesale distributors',
      'Polite automatic payment reminders with instant UPI checkout'
    ]
  },
  dukaan: {
    name: 'Dukaan',
    headline: 'Designed for Real Retail Stores, Not Just Online Catalogs.',
    sub: 'Dukaan forces you to build online e-commerce websites. MyStore OS helps you run your physical retail storefront, barcodes, wholesale stocking, and local ledger credits.',
    tco: '₹7,000+ per year subscription',
    device: 'Web & Mobile App',
    learning: 'Easy (Online focus)',
    whatsapp: '⚠️ Limited (E-commerce links only)',
    upi: '⚠️ Requires payment gateway fees (MDR)',
    offlineLedger: '❌ Does not work offline inside physical shops',
    pros: [
      'Fully functional offline database — continue billing when internet goes down',
      'High-speed physical barcode scanning using mobile camera',
      'Day Book Cash-In / Cash-Out register to track shop profits',
      'Unified B2B distributor portal with direct supply credit ledger'
    ]
  },
  mybillbook: {
    name: 'myBillBook',
    headline: 'Choose Premium Unlimited Billing Without Device Lockouts.',
    sub: 'Avoid annoying desktop licenses and limited invoice limits. MyStore OS offers unlimited paperless WhatsApp invoicing, multiple helper staff logins, and localized business features.',
    tco: '₹4,000+ per year subscription',
    device: 'Windows Desktop & Mobile',
    learning: 'Easy (Basic billing)',
    whatsapp: '⚠️ Limited limits on standard tiers',
    upi: '⚠️ Dynamic QR with device lock',
    offlineLedger: '⚠️ Sync errors on poor connectivity',
    pros: [
      'Multi-staff logins with individual secure 4-digit PIN locks',
      'Automatic dual-ledger balance updates for FMCG distributors',
      'Optimized lightweight design that consumes 60% less battery',
      'Bilingual Telugu/English dashboard configurations'
    ]
  }
};

const DEFAULT_COMPETITOR = {
  name: 'Traditional Billing Systems',
  headline: 'Step Into the Future of Retail Management.',
  sub: 'Stop using heavy legacy billing software that ties you to a desktop. Get MyStore OS and manage invoices, UPI, inventory, and credit ledgers on the go.',
  tco: 'Expensive Licenses',
  device: 'Heavy Windows PC / Laptop',
  learning: 'Requires Training & Complex Setups',
  whatsapp: '❌ Manual or Paid Third-party APIs',
  upi: '❌ Hardware dependency',
  offlineLedger: '❌ No automatic local sync',
  pros: [
    'Run your entire business from the palm of your hand',
    'Free to start, no expensive credit cards or contracts required',
    'Zero paper costs with elegant modern WhatsApp invoice sharing',
    'Specifically localized for wholesale markets and retail kiranas'
  ]
};

export default function AlternativeComparison() {
  const { competitor } = useParams();
  const navigate = useNavigate();
  
  const compKey = competitor?.toLowerCase() || '';
  const data = COMPARISON_DATA[compKey] || DEFAULT_COMPETITOR;

  useEffect(() => {
    // Dynamic SEO, AEO, and AGO title/meta insertion
    const pageTitle = `MyStore OS vs ${data.name} — The Ultimate Free ${data.name} Alternative for Retailers`;
    document.title = pageTitle;

    const desc = `Compare MyStore OS and ${data.name}. See why shopkeepers across India are choosing MyStore OS for paperless WhatsApp invoicing, instant UPI payments, offline day book ledger, and zero yearly subscription fees.`;
    
    // Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', desc);
    } else {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      metaDesc.content = desc;
      document.head.appendChild(metaDesc);
    }

    // Update Meta Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    const keywordsStr = `${compKey} alternative, compare ${compKey} and mystore os, best billing app, free billing software, paperless pos india, whatsapp invoice app, kirana store app, myshopos`;
    if (metaKeywords) {
      metaKeywords.setAttribute('content', keywordsStr);
    } else {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      metaKeywords.content = keywordsStr;
      document.head.appendChild(metaKeywords);
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [data, compKey]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: T.void,
      color: T.text,
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '24px 16px 0',
      backgroundImage: `radial-gradient(circle at top right, ${T.brandGlow}, transparent 45%),
                        radial-gradient(circle at bottom left, ${T.goldGlow}, transparent 45%)`,
      backgroundAttachment: 'fixed'
    }}>
      <style>{LANDING_CSS}</style>
      {/* Top sticky-ish back bar */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '10px 16px',
            borderRadius: '12px',
            color: 'var(--c-faint)',
            fontSize: '14px',
            width: 'auto',
            transition: 'all 0.2s'
          }}
          className="hover-opacity"
        >
          <ArrowLeft size={16} />
          Back to Home
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(79,70,229,0.1))',
          border: '1px solid rgba(251,191,36,0.2)',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#fbbf24'
        }}>
          <Star size={12} fill="#fbbf24" />
          <span>#1 Tally & Vyapar Competitor</span>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <MLogo size={42} radius={10} />
          <span style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '1px', background: 'linear-gradient(to right, var(--c-surface), var(--c-faint))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MYSTORE <span style={{ color: '#fbbf24' }}>OS</span>
          </span>
        </div>

        {/* Dynamic Title */}
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 42px)',
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: '16px',
          background: 'linear-gradient(135deg, var(--c-bg) 40%, var(--c-primary-light) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          MyStore OS vs {data.name}
        </h1>
        <p style={{
          fontSize: 'clamp(18px, 3.5vw, 22px)',
          color: '#fbbf24',
          fontWeight: 500,
          marginBottom: '12px',
          maxWidth: '680px',
          margin: '0 auto 16px'
        }}>
          {data.headline}
        </p>
        <p style={{
          fontSize: '15px',
          color: 'var(--c-faint)',
          lineHeight: 1.6,
          maxWidth: '620px',
          margin: '0 auto 40px'
        }}>
          {data.sub}
        </p>

        {/* Feature Comparison Table */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.4)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '40px',
          textAlign: 'left'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={20} color="#fbbf24" /> Side-by-Side Comparison
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--c-muted)', fontWeight: 600, textAlign: 'left' }}>Feature Matrix</th>
                  <th style={{ padding: '12px 8px', color: '#f43f5e', fontWeight: 600, textAlign: 'center' }}>{data.name}</th>
                  <th style={{ padding: '12px 8px', color: 'var(--c-success)', fontWeight: 600, textAlign: 'center', background: 'rgba(16,185,129,0.04)', borderRadius: '12px 12px 0 0' }}>MyStore OS</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 500, color: 'var(--c-line)' }}>Device Portability</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-faint)', textAlign: 'center' }}>{data.device}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-surface)', textAlign: 'center', fontWeight: 600, background: 'rgba(16,185,129,0.04)' }}>📱 Any Mobile or Tablet</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 500, color: 'var(--c-line)' }}>Yearly Cost (Subscription)</td>
                  <td style={{ padding: '14px 8px', color: '#f43f5e', textAlign: 'center', fontWeight: 500 }}>{data.tco}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-success)', textAlign: 'center', fontWeight: 700, background: 'rgba(16,185,129,0.04)' }}>🎉 Free Tier Available</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 500, color: 'var(--c-line)' }}>Training & Learning Curve</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-faint)', textAlign: 'center' }}>{data.learning}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-surface)', textAlign: 'center', fontWeight: 600, background: 'rgba(16,185,129,0.04)' }}>⚡ 30 seconds (Zero training)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 500, color: 'var(--c-line)' }}>WhatsApp Invoicing</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-faint)', textAlign: 'center' }}>{data.whatsapp}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-surface)', textAlign: 'center', fontWeight: 600, background: 'rgba(16,185,129,0.04)' }}>✅ 1-Click WhatsApp sharing</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 500, color: 'var(--c-line)' }}>UPI Code Integration</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-faint)', textAlign: 'center' }}>{data.upi}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-surface)', textAlign: 'center', fontWeight: 600, background: 'rgba(16,185,129,0.04)' }}>✅ Dynamic QR on mobile screen</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 500, color: 'var(--c-line)' }}>Offline Database Ledger</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-faint)', textAlign: 'center' }}>{data.offlineLedger}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--c-surface)', textAlign: 'center', fontWeight: 600, background: 'rgba(16,185,129,0.04)', borderRadius: '0 0 12px 12px' }}>✅ Fully functional offline storage</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Why MyStore OS is the Undisputed Winner */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '40px' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(79,70,229,0.05) 100%)',
            border: '1.5px dashed rgba(16,185,129,0.3)',
            borderRadius: '20px',
            padding: '24px',
            textAlign: 'left'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-success)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={18} fill="#10b981" /> Why Retailers Love MyStore OS over {data.name}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.pros.map((pro, index) => (
                <li key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'var(--c-line)', lineHeight: 1.4 }}>
                  <Check size={16} color="var(--c-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Wholesale & FMCG Localization Card */}
        <div style={{
          background: 'rgba(251,191,36,0.05)',
          border: '1px solid rgba(251,191,36,0.15)',
          borderRadius: '20px',
          padding: '24px',
          textAlign: 'left',
          marginBottom: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Landmark size={18} /> FMCG Wholesale & Distributor Integration
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--c-line-strong)', lineHeight: 1.5, margin: 0 }}>
            Unlike generic software like {data.name}, MyStore OS has built-in features optimised for wholesale markets and FMCG distributors across India.
            Manage bulk dispatch notes, track supplier credit ledger balances, and print receipt PDFs in 6 regional languages.
          </p>
          <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600 }}>
            💡 Indian shopkeepers save up to ₹1,500 every month switching from thermal printers to WhatsApp billing.
          </span>
        </div>

        {/* AI Answer Engine / Meta SEO FAQs (PAA Optimization) */}
        <div style={{ textAlign: 'left', marginBottom: '48px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: 'var(--c-surface)', textAlign: 'center' }}>
            ❓ Frequently Asked Questions
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '14px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-bg)', marginBottom: '6px' }}>
                Is MyStore OS really free compared to {data.name}?
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--c-faint)', lineHeight: 1.5, margin: 0 }}>
                Yes! While {data.name} locks you down into expensive yearly subscriptions, MyStore OS features a completely free standard level package that covers full digital invoice generations, basic day book journals, and catalog creation. No strings attached!
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '14px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-bg)', marginBottom: '6px' }}>
                Can I migrate my items and inventory lists from {data.name} to MyStore OS?
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--c-faint)', lineHeight: 1.5, margin: 0 }}>
                Absolutely. You can import your entire products catalogue list seamlessly using a standard Excel or CSV sheet, or scan barcodes straight from your items to build a catalog instantly on your smartphone screen under a minute!
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '14px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-bg)', marginBottom: '6px' }}>
                How does offline ledger storage work inside MyStore OS?
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--c-faint)', lineHeight: 1.5, margin: 0 }}>
                MyStore OS uses a state-of-the-art secure local database. If you lose your internet connection inside a basement shop or Chilli Yard depot, your bills are saved immediately on your local device. The moment your phone connects to the internet again, it safely pushes and backs up your transactions to Supabase clouds.
              </p>
            </div>
          </div>
        </div>

        {/* Global CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(129,140,248,0.15) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-surface)', margin: 0 }}>
            Ditch {data.name} Today!
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--c-line-strong)', maxWidth: '400px', margin: 0 }}>
            Join thousands of smart micro-retailers who have transitioned their shops into streamlined pocket powerhouses.
          </p>
          <button
            onClick={() => navigate('/register')}
            style={{
              background: 'linear-gradient(135deg, var(--c-primary-light), var(--c-primary))',
              color: 'white',
              border: 'none',
              padding: '14px 28px',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '15px',
              width: 'auto',
              boxShadow: '0 0 32px -6px rgba(99,102,241,0.5)',
              cursor: 'pointer'
            }}
          >
            Start free for 15 days
          </button>
        </div>
      </div>

      <div style={{ marginTop: 56, marginLeft: -16, marginRight: -16 }}>
        <LandingFooter navigate={navigate} />
      </div>
    </div>
  );
}
