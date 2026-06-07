import { IndianRupee, Truck, BookOpen, FileText, Package, BarChart2 } from 'lucide-react';

const FEATS = [
  {
    icon: IndianRupee, color: '#4F46E5', bg: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.25)',
    title: 'GST-Ready Smart Invoicing',
    desc: 'Generate GSTIN-compliant bills in 2 seconds. Auto-send via WhatsApp. GSTR-1 & GSTR-3B export built in.',
  },
  {
    icon: Truck, color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)',
    title: 'Distributor & Route Management',
    desc: 'Manage B2B networks, automate purchase orders, and track delivery routes across your supply chain.',
  },
  {
    icon: BookOpen, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)',
    title: 'Udhaar Ledger & Credit Tracking',
    desc: 'Track customer balances in real-time. Automated WhatsApp reminders. Full P&L with drill-down.',
  },
  {
    icon: FileText, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)',
    title: 'CA Portal & Tally ERP Export',
    desc: 'Dedicated accountant access. One-click Tally ERP export. Automated tax return preparation.',
  },
  {
    icon: Package, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)',
    title: 'Smart Inventory & Expiry Alerts',
    desc: 'Track stock levels, set reorder points, and get expiry alerts before you face losses.',
  },
  {
    icon: BarChart2, color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.25)',
    title: 'Real-Time Analytics & Reports',
    desc: 'Revenue trends, product performance, and customer insights — all in one live dashboard.',
  },
];

export default function LandingFeatures() {
  return (
    <section style={{
      background: '#0D1117', padding: '80px 40px',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      <style>{`
        @keyframes fadeSlide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .feat-card{transition:all .2s ease;cursor:default}
        .feat-card:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,0,0,0.3)!important}
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ color: '#4F46E5', fontSize: 12, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase' }}>
            Platform Features
          </span>
          <h2 style={{ color: '#fff', fontSize: 34, fontWeight: 800, margin: '10px 0 12px', letterSpacing: '-.025em' }}>
            Everything You Need to Run Your Business
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 16, maxWidth: 500, margin: '0 auto', lineHeight: 1.68 }}>
            One unified platform built for Indian retail — from single kirana to enterprise chains.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
          {FEATS.map(({ icon: Icon, color, bg, border, title, desc }) => (
            <div key={title} className="feat-card" style={{
              background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 14, padding: 28,
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
