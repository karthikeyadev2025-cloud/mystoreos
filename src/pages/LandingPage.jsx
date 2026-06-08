import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteConfig } from '../lib/siteConfig';
import { api } from '../lib/api';
import LandingNav from '../components/landing/LandingNav';
import LandingHero from '../components/landing/LandingHero';
import LandingWhoFor from '../components/landing/LandingWhoFor';
import LandingStats from '../components/landing/LandingStats';
import LandingFeatures from '../components/landing/LandingFeatures';
import LandingDayInLife from '../components/landing/LandingDayInLife';
import LandingPricingPreview from '../components/landing/LandingPricingPreview';
import LandingTrust from '../components/landing/LandingTrust';
import LandingTestimonials from '../components/landing/LandingTestimonials';
import LandingHowItWorks from '../components/landing/LandingHowItWorks';
import LandingFAQ from '../components/landing/LandingFAQ';
import LandingFinalCTA from '../components/landing/LandingFinalCTA';
import LandingFooter from '../components/landing/LandingFooter';

const safe = async (fn, def = null) => { try { return await fn(); } catch { return def; } };

const DEFAULT_HERO = {
  headline: 'The Operating System\nfor Modern Business',
  telugu: 'మీ వ్యాపారాన్ని డిజిటల్ చేయండి',
  subheadline: 'Complete billing, inventory, credit, and analytics — built for Indian shopkeepers and FMCG distributors.',
};
const DEFAULT_STATS = { shops: 500, orders: 50000, cities: 200, uptime: 99.9 };
const DEFAULT_TESTIMONIALS = [
  { name: 'Ravi Kumar', city: 'Vijayawada', stars: 5, quote: 'రోజువారీ లెక్కలు ఇప్పుడు చాలా సులభం! Best app ever.' },
  { name: 'Suresh Babu', city: 'Vijayawada', stars: 5, quote: 'Credit customers ki WhatsApp reminder super useful!' },
  { name: 'Priya Lakshmi', city: 'Hyderabad', stars: 5, quote: 'Expiry tracking saved me ₹8,000 this month alone.' },
  { name: 'Mohammed Ali', city: 'Tirupati', stars: 5, quote: 'Staff management feature is excellent. Very secure.' },
  { name: 'Venkat Rao', city: 'Warangal', stars: 5, quote: 'GST reports and Tally export in one click. Excellent!' },
  { name: 'Lakshmi Devi', city: 'Nellore', stars: 5, quote: 'Best app for small shop owners. Very easy to use.' },
  { name: 'Arun Prasad', city: 'Visakhapatnam', stars: 5, quote: '7 day free trial lo convinced aipoya! Worth every rupee.' },
  { name: 'Srinivas', city: 'Karimnagar', stars: 5, quote: 'Offline mode works perfectly even without internet.' },
  { name: 'Deepa Reddy', city: 'Kurnool', stars: 5, quote: 'Reports ki WhatsApp share cheyyadam super convenient!' },
  { name: 'Ramesh Naidu', city: 'Ongole', stars: 5, quote: 'Billing time 30 seconds — customers are very happy.' },
  { name: 'Kavitha', city: 'Kakinada', stars: 5, quote: 'Batch number tracking saved me from expired goods issue.' },
  { name: 'Pavan Kumar', city: 'Rajahmundry', stars: 5, quote: 'Multi-outlet sync is the best feature. Great app!' },
];
const DEFAULT_FAQ = [
  { q: 'Is there a free trial?', a: 'Yes! Every new account gets a 7-day free PRO trial — no credit card required.' },
  { q: 'Does it work offline?', a: 'Fully offline capable. All data syncs automatically when your internet is restored.' },
  { q: 'Can I use it on my phone?', a: "It's a mobile-first PWA. Install on Android/iPhone from your browser. No app store needed." },
  { q: 'How does WhatsApp billing work?', a: 'After creating a bill, tap "Share on WhatsApp". The customer receives a formatted receipt instantly.' },
  { q: 'Is GST filing supported?', a: 'Yes. Generate GSTR-1 XML/CSV, push to Tally, or let your CA access the portal directly.' },
  { q: 'Can multiple staff use it?', a: 'Yes. PRO and Enterprise plans support staff accounts with PIN locks and role-based permissions.' },
  { q: 'What languages are supported?', a: 'Hindi, Telugu, Tamil, Kannada, Marathi, and Bengali — in addition to English.' },
];
const DSP_FB = [
  { id: 'free', name: 'Free', price: 0, popular: false, features: ['Up to 50 products', 'Basic billing', '100 bills/month', 'Single device', 'Free forever'] },
  { id: 'starter', name: 'Starter', price: 499, popular: false, features: ['Up to 500 products', 'Standard billing', 'Basic day book', 'WhatsApp sharing', 'Single device'] },
  { id: 'pro', name: 'PRO', price: 999, popular: true, features: ['Unlimited products', 'WhatsApp sharing', 'Staff accounts', 'Batch & expiry tracking', 'UPI payment links'] },
  { id: 'enterprise', name: 'Enterprise', price: 2499, popular: false, features: ['Everything in PRO', 'GST compliance billing', 'CA Portal access', 'Tally ERP export', 'Multi-device sync'] },
];
const DDP_FB = [
  { id: 'free_dist', name: 'Free', price: 0, popular: false, features: ['Up to 3 shops', 'Basic order mgmt', 'Credit ledger', 'Free forever'] },
  { id: 'basic_dist', name: 'Basic', price: 999, popular: false, features: ['Up to 10 shops', 'Basic order mgmt', 'Credit ledger', 'Analytics'] },
  { id: 'pro_dist', name: 'PRO', price: 2499, popular: true, features: ['Up to 50 shops', 'Route planner', 'Bulk order CSV', 'Tally export', 'Analytics'] },
  { id: 'enterprise_dist', name: 'Enterprise', price: 4999, popular: false, features: ['Unlimited shops', 'Multi-branch', 'API access', 'Staff accounts'] },
];

const GCSS = `
html{scroll-behavior:smooth}*,*::before,*::after{box-sizing:border-box}
@keyframes ml{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes mr{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}
`;

export default function LandingPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const [hero, setHero] = useState(DEFAULT_HERO);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [testimonials, setTestimonials] = useState(DEFAULT_TESTIMONIALS);
  const [faq, setFaq] = useState(DEFAULT_FAQ);
  const [plans, setPlans] = useState(DSP_FB);
  const [distPlans, setDistPlans] = useState(DDP_FB);

  useEffect(() => {
    safe(() => api.getSiteConfig('landingHero', DEFAULT_HERO)).then(d => d && setHero(d));
    safe(() => api.getSiteConfig('landingStats', DEFAULT_STATS)).then(d => d && setStats(d));
    safe(() => api.getSiteConfig('landingTestimonials', DEFAULT_TESTIMONIALS)).then(d => d && setTestimonials(d));
    safe(() => api.getSiteConfig('landingFAQ', DEFAULT_FAQ)).then(d => d && setFaq(d));
    safe(() => api.seedSubscriptionPlans());
    safe(() => api.getSubscriptionPlans()).then(d => {
      if (d && d.length) {
        // Always ensure Free plan is first
        const hasFree = d.some(p => p.price === 0 || p.id === 'free');
        const basePlans = hasFree ? d : [DSP_FB[0], ...d];
        setPlans(basePlans);
      }
    });
    safe(() => api.getDistributorSubscriptionPlans()).then(d => {
      if (d && d.length) {
        const hasFree = d.some(p => p.price === 0 || p.id === 'free_dist');
        const basePlans = hasFree ? d : [DDP_FB[0], ...d];
        setDistPlans(basePlans);
      }
    });
  }, []);

  useEffect(() => {
    document.title = `${config.siteName || 'MyStore OS'} — Billing & ERP for Indian Businesses`;
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', config.metaDescription || 'Complete billing, inventory, credit, GST for Indian kirana shops and FMCG distributors.');
  }, [config]);

  return (
    <div style={{ background: '#030712', color: '#f8fafc', fontFamily: 'Outfit, sans-serif', overflowX: 'hidden', minWidth: 375 }}>
      <style>{GCSS}</style>
      <LandingNav config={config} navigate={navigate} />
      <LandingHero hero={hero} navigate={navigate} config={config} />
      <LandingWhoFor />
      <LandingStats stats={stats} />
      <LandingFeatures />
      <LandingDayInLife />
      <LandingPricingPreview plans={plans} distPlans={distPlans} navigate={navigate} />
      <LandingTrust />
      <LandingTestimonials testimonials={testimonials} />
      <LandingHowItWorks navigate={navigate} />
      <LandingFAQ faq={faq} />
      <LandingFinalCTA navigate={navigate} />
      <LandingFooter config={config} navigate={navigate} />
    </div>
  );
}
