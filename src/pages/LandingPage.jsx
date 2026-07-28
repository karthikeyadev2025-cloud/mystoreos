import { useState, useEffect } from 'react';
import { priceOf } from '../lib/planCatalogue';
import { useNavigate } from 'react-router-dom';
import { useSiteConfig } from '../lib/siteConfig';
import { api } from '../lib/api';
import { T, LANDING_CSS } from '../components/landing/_tokens';
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
  headline: 'Your phone is your\nbilling counter now.',
  telugu: 'మీ వ్యాపారాన్ని డిజిటల్ చేయండి',
  subheadline: 'No machine to buy, no setup call, nothing to install on a computer. Bill a customer in seconds, keep every udhaar and every stock count straight, and get your own online storefront so more people find you and order — all from the same phone you already carry.',
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
  { q: 'Is there a free trial?', a: 'Fifteen days, every feature unlocked, no card. That includes bookings, staff scheduling and reminders — the things normally on paid tiers — so you can judge the whole thing before you decide.' },
  { q: 'I run a clinic, not a shop. Does this work for me?', a: 'Yes. Choose Services when you sign up and the dashboard rearranges itself: a service list, a booking diary, staff scheduling and reminders, instead of a product POS. Salons, spas, clinics, gyms, dental practices and workshops all run on this side — and pricing is separate from Retail, starting lower since you don\u2019t need GST or stock tracking.' },
  { q: 'Can customers book their own appointments?', a: 'Yes. You get a public page they can book from. Clashes are refused automatically, and they can move or cancel a booking through a private link without ringing you.' },
  { q: 'Do you send staff to a customer\u2019s home? Is that safe?', a: 'Home Service Booking is a standalone add-on for any Service plan. The customer can share their exact location at booking. Staff check in as \u2018on my way\u2019 and \u2018arrived\u2019, each capturing a real timestamped location. There\u2019s a one-tap emergency alert that goes straight to the shop owner and stays visible until acted on \u2014 and if a visit runs long with no check-in, the owner gets alerted automatically without anyone needing to notice.' },
  { q: 'Do reminders go out automatically?', a: 'WhatsApp and SMS, 24 hours and 1 hour before each appointment. Included from the Service Pro plan.' },
  { q: 'Does it work with a thermal printer?', a: 'Yes — 58mm and 80mm rolls, alongside standard A4. Set your paper size once and every receipt comes out right.' },
  { q: 'Will I know when an order or booking arrives?', a: 'Your phone or desktop is notified the moment it lands, even if the app is closed.' },
  { q: 'What happens when the internet goes down?', a: 'You keep billing. Everything queues locally and syncs the moment you reconnect. No lost sales.' },
  { q: 'Can I use it on my phone?', a: 'It installs from the browser on Android and iPhone — no app store needed.' },
  { q: 'Is GST filing supported?', a: 'GSTR-1 XML and CSV, Tally export, and a portal you can give your accountant direct access to. Included from the Retail Enterprise plan.' },
  { q: 'Can my staff have their own logins?', a: 'Yes, from the Pro plan on either track — with PIN locks and role-based permissions. Service businesses can also tie particular services to particular staff.' },
  { q: 'Can I run more than one outlet?', a: 'Yes, on Enterprise \u2014 Retail or Service. One login, several outlets, each keeping its own books, switched between instantly.' },
  { q: 'Which languages does it speak?', a: 'Hindi, Telugu, Tamil, Kannada, Marathi and Bengali, alongside English.' },
];
const DSP_FB = [
  // NOTE: there is deliberately NO 'free' tier here. One used to be
  // advertised on this page at ₹0 / "Free forever" — but no free plan
  // exists in PLAN_CAPS, in the pricing seed, or on the Pricing page.
  // A visitor would have signed up expecting free and landed on an
  // expiring trial instead. Retail starts at Starter ₹499, matching
  // the authoritative seed in api.js and the Pricing page exactly.
  { id: 'starter', name: 'Starter', price: priceOf('starter'), popular: false, features: ['Up to 500 products', 'Standard billing', 'Basic day book', 'WhatsApp sharing', 'Single device'] },
  { id: 'pro', name: 'PRO', price: priceOf('pro'), popular: true, features: ['Unlimited products', 'WhatsApp sharing', 'Staff accounts', 'Batch & expiry tracking', 'UPI payment links'] },
  { id: 'enterprise', name: 'Enterprise', price: priceOf('enterprise'), popular: false, features: ['Everything in PRO', 'GST compliance billing', 'CA Portal access', 'Tally ERP export', 'Multi-device sync'] },
];
// Service business track — separate pricing from Retail above (see
// PLAN_CAPS.service_starter/_pro/_enterprise in features.js). Static
// fallback structure, same pattern as DSP_FB — but the actual PRICE
// shown still comes live from pricing_v2.tiers.service_* via the same
// monthlyBase()/tierPrice() lookups LandingPricingPreview already does
// by plan.id, so an admin changing the price takes effect immediately
// without needing a database-driven plan table like retail/distributor
// have.
const SSP_FB = [
  { id: 'service_starter', name: 'Starter', price: priceOf('service_starter'), popular: false, features: ['Online booking (up to 10 services)', 'Double-booking blocked automatically', 'WhatsApp booking confirmation', 'Single device'] },
  { id: 'service_pro', name: 'PRO', price: priceOf('service_pro'), popular: true, features: ['Unlimited services', 'Multi-staff scheduling', 'Automated WhatsApp + SMS reminders', 'Self-service reschedule/cancel', 'Buffer time'] },
  { id: 'service_enterprise', name: 'Enterprise', price: priceOf('service_enterprise'), popular: false, features: ['Everything in PRO', 'Recurring / weekly-repeat bookings', 'Multi-branch', 'Multi-device sync', 'Priority support'] },
];
const DDP_FB = [
  // Same as the retail list above: no 'free' tier here, because none
  // exists in DIST_PLAN_CAPS or the pricing seed. Distribution starts
  // at Basic ₹999, matching the Pricing page exactly.
  { id: 'basic_dist', name: 'Basic', price: priceOf('basic_distributor'), popular: false, features: ['Up to 10 shops', 'Basic order mgmt', 'Credit ledger', 'Analytics'] },
  { id: 'pro_dist', name: 'PRO', price: priceOf('pro_distributor'), popular: true, features: ['Up to 50 shops', 'Field sales & route beats', 'Presale order booking', 'End-of-day settlement', 'Up to 3 vehicles', 'Tally export'] },
  { id: 'enterprise_dist', name: 'Enterprise', price: priceOf('enterprise_distributor'), popular: false, features: ['Unlimited shops', 'Van sales — offline billing', 'On-the-spot returns', 'Unlimited vehicles', 'Multi-branch', 'API access'] },
];

const GCSS = LANDING_CSS;

export default function LandingPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const [hero, setHero] = useState(DEFAULT_HERO);
  const [promo, setPromo] = useState(DEFAULT_PROMO);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [testimonials, setTestimonials] = useState(DEFAULT_TESTIMONIALS);
  const [faq, setFaq] = useState(DEFAULT_FAQ);
  const [plans, setPlans] = useState(DSP_FB);
  const [servicePlans] = useState(SSP_FB);
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
      // FOUND THE ACTUAL DUPLICATE-PLANS BUG: this used to guarantee a
      // free plan existed by prepending DSP_FB[0] whenever the fetched
      // data lacked one. After the free tier was removed from the
      // product entirely, `hasFree` can never be true again — so this
      // ran on every single load, unconditionally prepending the
      // fallback's first entry (Starter, now that Free is gone) onto
      // real API data that already starts with Starter. Two Starter
      // plans, every time, for every user. Just use the real data.
      if (d && d.length) setPlans(d);
    });
    safe(() => api.getDistributorSubscriptionPlans()).then(d => {
      if (d && d.length) setDistPlans(d);
    });
  }, []);

  useEffect(() => {
    document.title = `${config.siteName || 'MyStore OS'} — Billing & Appointment Booking for Indian Businesses`;
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', config.metaDescription || 'Billing, inventory, credit, and GST for shops — plus online appointment booking, staff scheduling, and automated reminders for salons, spas, clinics, and gyms. One platform, 15-day free trial.');
  }, [config]);

  return (
    <div style={{ background: T.void, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', minWidth: 320 }}>
      <style>{GCSS}</style>
      <LandingPromoBar promo={promo} navigate={navigate} />
      <LandingNav config={config} navigate={navigate} />

      {/* The argument, in order:
          1. Here's the thesis, as an object you can read.       (Hero)
          2. Here's the line we draw — stock or time.            (WhoFor)
          3. Here's what you get on each side of it.             (Features)
          4. Here's what a day actually looks like.              (DayInLife)
          5. Here's what it costs.                               (Pricing)
          6. Here's how you get started.                         (HowItWorks)
          7. Here's why you can trust us with the books.         (Trust)
          8. Here's what other people say.                       (Testimonials)
          9. Here's the scale.                                   (Stats)
         10. Here's what you might still be wondering.           (FAQ)
         11. Close.                                              (FinalCTA)

          Stats moved late — a claim about how many shops use it means
          nothing until the reader knows what it does. It was sitting
          third, before the reader had any reason to care. */}
      <LandingHero hero={hero} navigate={navigate} config={config} />
      <LandingWhoFor />
      <LandingFeatures />
      <LandingDayInLife />
      <LandingPricingPreview plans={plans} servicePlans={servicePlans} distPlans={distPlans} pricing={pricing} navigate={navigate} />
      <LandingHowItWorks navigate={navigate} />
      <LandingTrust />
      <LandingTestimonials testimonials={testimonials} />
      <LandingStats stats={stats} />
      <LandingFAQ faq={faq} />
      <LandingFinalCTA navigate={navigate} />
      <LandingFooter config={config} navigate={navigate} />
    </div>
  );
}
