import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteConfig } from '../lib/siteConfig';
import { api } from '../lib/api';
import LandingNav from '../components/landing/LandingNav';
import LandingPromoBar, { DEFAULT_PROMO } from '../components/landing/LandingPromoBar';
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
  headline: 'Billing and Bookings.\nOne Platform.',
  telugu: 'మీ వ్యాపారాన్ని డిజిటల్ చేయండి',
  subheadline: 'Sell products across a counter or book appointments by the hour — MyStore OS runs both. Billing, inventory, credit, scheduling, and analytics in one login.',
};
const DEFAULT_STATS = { shops: 500, orders: 50000, cities: 200, uptime: 99.9 };
// Mix of retail AND service voices — a salon owner scrolling past twelve
// kirana testimonials concludes the product isn't for them.
const DEFAULT_TESTIMONIALS = [
  { name: 'Ravi Kumar', city: 'Vijayawada', stars: 5, quote: 'రోజువారీ లెక్కలు ఇప్పుడు చాలా సులభం! Best app ever.' },
  { name: 'Sneha Reddy', city: 'Hyderabad', stars: 5, quote: 'Salon booking online vachchindi — no-shows almost zero now with auto reminders.' },
  { name: 'Suresh Babu', city: 'Vijayawada', stars: 5, quote: 'Credit customers ki WhatsApp reminder super useful!' },
  { name: 'Dr. Anitha', city: 'Guntur', stars: 5, quote: 'Patients book their own slots now. My front desk finally has time to breathe.' },
  { name: 'Priya Lakshmi', city: 'Hyderabad', stars: 5, quote: 'Expiry tracking saved me ₹8,000 this month alone.' },
  { name: 'Karthik Menon', city: 'Visakhapatnam', stars: 5, quote: 'Gym lo trainer sessions recurring booking — set once, runs every week.' },
  { name: 'Venkat Rao', city: 'Warangal', stars: 5, quote: 'GST reports and Tally export in one click. Excellent!' },
  { name: 'Fatima Begum', city: 'Hyderabad', stars: 5, quote: 'Assigning each stylist their own services — exactly what my parlour needed.' },
  { name: 'Lakshmi Devi', city: 'Nellore', stars: 5, quote: 'Best app for small shop owners. Very easy to use.' },
  { name: 'Arun Prasad', city: 'Visakhapatnam', stars: 5, quote: '15 day free trial lo convinced aipoya! Worth every rupee.' },
  { name: 'Srinivas', city: 'Karimnagar', stars: 5, quote: 'Offline mode works perfectly even without internet.' },
  { name: 'Manoj Varma', city: 'Tirupati', stars: 5, quote: 'Spa lo buffer time between clients — cleanup time finally accounted for.' },
  { name: 'Ramesh Naidu', city: 'Ongole', stars: 5, quote: 'Billing time 30 seconds — customers are very happy.' },
  { name: 'Kavitha', city: 'Kakinada', stars: 5, quote: 'Batch number tracking saved me from expired goods issue.' },
  { name: 'Pavan Kumar', city: 'Rajahmundry', stars: 5, quote: 'Multi-outlet sync is the best feature. Great app!' },
];
const DEFAULT_FAQ = [
  { q: 'Is there a free trial?', a: 'Yes — every new account gets a 15-day free PRO trial with every feature unlocked, including bookings and staff scheduling. No credit card required.' },
  { q: 'I run a salon, not a shop. Does this work for me?', a: 'Yes. Pick "Service" when you sign up and your dashboard becomes a booking system: service catalogue, online appointments, staff scheduling, and automated reminders — instead of a product POS.' },
  { q: 'Can customers book appointments online themselves?', a: 'Yes. You get a public booking page customers can use directly. Double-booking is blocked automatically, and they can reschedule or cancel via a secure link without calling you.' },
  { q: 'Do you send appointment reminders?', a: 'Automatically — WhatsApp and SMS reminders go out 24 hours and 1 hour before each appointment. Available on Pro and Enterprise plans.' },
  { q: 'Does it work with thermal printers?', a: 'Yes. Native support for 58mm and 80mm thermal receipt printers, plus standard A4 invoices. Pick your paper size once in Settings.' },
  { q: 'Will I know when a new order or booking comes in?', a: 'Yes. You get an instant push notification on your phone or desktop — even when the app is closed or minimised.' },
  { q: 'Does it work offline?', a: 'Fully offline capable. Keep billing without internet; everything syncs automatically the moment you reconnect.' },
  { q: 'Can I use it on my phone?', a: "It's a mobile-first PWA. Install on Android or iPhone straight from your browser — no app store needed." },
  { q: 'Is GST filing supported?', a: 'Yes. Generate GSTR-1 XML/CSV, push to Tally, or give your CA direct portal access. Available on the Enterprise plan.' },
  { q: 'Can multiple staff use it?', a: 'Yes. Pro and Enterprise plans support staff accounts with PIN locks and role-based permissions. Service businesses can also assign specific staff to specific services.' },
  { q: 'Can I run more than one outlet?', a: 'Yes. Multi-branch support lets you run several outlets from one login and switch between them instantly — each keeps its own books.' },
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
  const [promo, setPromo] = useState(DEFAULT_PROMO);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [testimonials, setTestimonials] = useState(DEFAULT_TESTIMONIALS);
  const [faq, setFaq] = useState(DEFAULT_FAQ);
  const [plans, setPlans] = useState(DSP_FB);
  const [distPlans, setDistPlans] = useState(DDP_FB);
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    safe(() => api.getSiteConfig('landingHero', DEFAULT_HERO)).then(d => d && setHero(d));
    safe(() => api.getSiteConfig('landingPromo', DEFAULT_PROMO)).then(d => d && setPromo(d));
    safe(() => api.getSiteConfig('landingStats', DEFAULT_STATS)).then(d => d && setStats(d));
    safe(() => api.getSiteConfig('landingTestimonials', DEFAULT_TESTIMONIALS)).then(d => d && setTestimonials(d));
    safe(() => api.getSiteConfig('landingFAQ', DEFAULT_FAQ)).then(d => d && setFaq(d));
    safe(() => api.seedSubscriptionPlans());
    safe(() => api.getPricing()).then(d => d && setPricing(d));
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
    document.title = `${config.siteName || 'MyStore OS'} — Billing & Appointment Booking for Indian Businesses`;
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', config.metaDescription || 'Billing, inventory, credit, and GST for shops — plus online appointment booking, staff scheduling, and automated reminders for salons, spas, clinics, and gyms. One platform, 15-day free trial.');
  }, [config]);

  return (
    <div style={{ background: '#030712', color: '#f8fafc', fontFamily: 'Plus Jakarta Sans, sans-serif', overflowX: 'hidden', minWidth: 375 }}>
      <style>{GCSS}</style>
      <LandingPromoBar promo={promo} navigate={navigate} />
      <LandingNav config={config} navigate={navigate} />
      <LandingHero hero={hero} navigate={navigate} config={config} />
      <LandingWhoFor />
      <LandingStats stats={stats} />
      <LandingFeatures />
      <LandingDayInLife />
      <LandingPricingPreview plans={plans} distPlans={distPlans} pricing={pricing} navigate={navigate} />
      <LandingTrust />
      <LandingTestimonials testimonials={testimonials} />
      <LandingHowItWorks navigate={navigate} />
      <LandingFAQ faq={faq} />
      <LandingFinalCTA navigate={navigate} />
      <LandingFooter config={config} navigate={navigate} />
    </div>
  );
}
