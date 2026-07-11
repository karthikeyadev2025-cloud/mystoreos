import { useState } from 'react';
import {
  IndianRupee, Truck, BookOpen, FileText, Package, BarChart2,
  CalendarCheck, Users, Bell, Repeat, Clock, Link2,
  Printer, Store, Bell as BellIcon, Gift, Zap, Building2,
} from 'lucide-react';

// Features are grouped by vertical so a kirana owner and a salon owner
// each see a coherent story instead of a mixed bag. The 'Shared' tab
// carries everything both audiences get — which is most of the
// platform, and is the actual pitch: one system, two business models.
//
// Every entry below maps to something genuinely shipped. If a feature
// is plan-gated, that's noted in the description rather than hidden —
// overpromising on a landing page is how you get churn in week two.

const RETAIL = [
  {
    icon: IndianRupee, color: '#4F46E5', bg: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.25)',
    title: 'GST-Ready Smart Invoicing',
    desc: 'GSTIN-compliant bills in seconds. Auto-share on WhatsApp. GSTR-1 & GSTR-3B export built in.',
  },
  {
    icon: Package, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)',
    title: 'Inventory, Batches & Expiry Alerts',
    desc: 'Stock levels, reorder points, batch numbers, and expiry warnings before you eat the loss.',
  },
  {
    icon: BookOpen, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)',
    title: 'Udhaar Ledger & Credit Tracking',
    desc: 'Track customer balances live. Automated WhatsApp reminders. Supplier credit book included.',
  },
  {
    icon: Truck, color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)',
    title: 'Distributor & Supply Chain',
    desc: 'Connect with FMCG distributors, place stock orders, and track deliveries — all in-app.',
  },
  {
    icon: Gift, color: '#EC4899', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.25)',
    title: 'Loyalty Points & Flash Sales',
    desc: 'Reward repeat customers automatically. Run time-boxed flash sales on your storefront.',
  },
  {
    icon: FileText, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)',
    title: 'CA Portal & Tally ERP Export',
    desc: 'Give your accountant direct access. One-click Tally export. Tax filing prep, automated.',
  },
];

const SERVICE = [
  {
    icon: CalendarCheck, color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)',
    title: 'Online Appointment Booking',
    desc: 'Customers book from your public page. Walk-ins logged in one tap. Double-booking blocked automatically.',
  },
  {
    icon: Users, color: '#4F46E5', bg: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.25)',
    title: 'Multi-Staff Scheduling',
    desc: 'Assign services to specific stylists, doctors, or trainers. Per-staff working hours and time-off.',
  },
  {
    icon: Bell, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)',
    title: 'Automated Booking Reminders',
    desc: 'WhatsApp and SMS reminders 24 hours and 1 hour before every appointment. Cuts no-shows sharply.',
  },
  {
    icon: Link2, color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.25)',
    title: 'Customer Self-Service',
    desc: 'Customers reschedule or cancel via a secure link — no phone calls, no back-and-forth.',
  },
  {
    icon: Repeat, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)',
    title: 'Recurring Bookings',
    desc: 'Reserve the same slot weekly or monthly for regulars. Conflicts skipped automatically.',
  },
  {
    icon: Clock, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)',
    title: 'Buffer Time Between Slots',
    desc: 'Reserve cleanup and prep time after each appointment so your day never runs over.',
  },
];

const SHARED = [
  {
    icon: Store, color: '#4F46E5', bg: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.25)',
    title: 'Your Own Online Storefront',
    desc: 'A public page customers can order or book from. Listed on the MyStore OS marketplace too.',
  },
  {
    icon: Printer, color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)',
    title: 'Thermal & A4 Printing',
    desc: 'Native 58mm and 80mm thermal receipt support alongside standard A4 invoices.',
  },
  {
    icon: BellIcon, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)',
    title: 'Instant Push Notifications',
    desc: 'New order or booking? Get alerted on your phone or desktop — even with the app closed.',
  },
  {
    icon: BarChart2, color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.25)',
    title: 'Real-Time Analytics',
    desc: 'Revenue trends, top products or services, and customer insights on one live dashboard.',
  },
  {
    icon: Building2, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)',
    title: 'Multi-Branch Support',
    desc: 'Run several outlets from one login. Switch branches instantly; each keeps its own books.',
  },
  {
    icon: Zap, color: '#EC4899', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.25)',
    title: 'Works Offline',
    desc: 'Bill without internet. Everything syncs the moment you reconnect. No lost sales.',
  },
];

const TABS = [
  { id: 'shared',  label: 'For Everyone',       items: SHARED,  blurb: 'Core platform — every business gets these, whatever you sell.' },
  { id: 'retail',  label: 'Shops & Retail',     items: RETAIL,  blurb: 'Kirana, medical, electronics, apparel, hardware, and more.' },
  { id: 'service', label: 'Salons & Services',  items: SERVICE, blurb: 'Salon, spa, clinic, gym, barber, dental — anything you book.' },
];

export default function LandingFeatures() {
  const [tab, setTab] = useState('shared');
  const active = TABS.find(t => t.id === tab) || TABS[0];

  return (
    <section id="features" style={{
      background: '#0F172A', padding: 'clamp(56px,7vw,88px) clamp(16px,5vw,40px)',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      <style>{`
        @keyframes fadeSlide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .feat-card{transition:all .2s ease;cursor:default;animation:fadeSlide .3s ease both}
        .feat-card:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,0,0,0.3)!important}
        .feat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
          gap: 16px;
        }
        @media(max-width:540px){
          .feat-grid { grid-template-columns: 1fr !important; }
          .feat-tabs { flex-direction: column !important; width: 100%; }
          .feat-tabs button { width: 100% !important; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ color: '#4F46E5', fontSize: 12, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase' }}>
            Platform Features
          </span>
          <h2 style={{ color: '#fff', fontSize: 'clamp(24px,4vw,34px)', fontWeight: 800, margin: '10px 0 12px', letterSpacing: '-.025em' }}>
            One Platform. Two Business Models.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 16, maxWidth: 560, margin: '0 auto', lineHeight: 1.68 }}>
            Whether you sell products across a counter or book appointments by the hour — it's the same login, the same dashboard.
          </p>
        </div>

        {/* Vertical switcher */}
        <div className="feat-tabs" style={{
          display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14, flexWrap: 'wrap',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700, width: 'auto',
                fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                background: tab === t.id ? '#4F46E5' : 'rgba(255,255,255,0.05)',
                color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${tab === t.id ? '#4F46E5' : 'rgba(255,255,255,0.1)'}`,
                transition: 'all .15s',
                boxShadow: tab === t.id ? '0 0 24px rgba(79,70,229,0.4)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p style={{
          textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13,
          margin: '0 0 36px', minHeight: 20,
        }}>
          {active.blurb}
        </p>

        <div className="feat-grid">
          {active.items.map(({ icon: Icon, color, bg, border, title, desc }) => (
            <div key={title} className="feat-card" style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: 'clamp(20px,3vw,28px)',
            }}>
              <div style={{
                width: 50, height: 50, background: bg, border: `1px solid ${border}`,
                borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
              }}>
                <Icon size={23} color={color} strokeWidth={1.8}/>
              </div>
              <h3 style={{ color: '#fff', fontSize: 15.5, fontWeight: 700, marginBottom: 8, lineHeight: 1.35 }}>{title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
