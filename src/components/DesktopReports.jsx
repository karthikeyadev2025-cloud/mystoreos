import { useMemo, useState } from 'react';
import { Book, Download, TrendingUp, TrendingDown, BarChart2, FileSpreadsheet, Users } from 'lucide-react';
import { PlanGate, LockedFeature } from './PlanGate';
import { downloadGSTR1CSV } from '../lib/gstrExport';
import { generateZohoContactsCSV, generateZohoLeadsCSV, downloadZohoCSV } from '../lib/ZohoExporter';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CAT_RX = {
  Grains: /\b(rice|wheat|atta|flour|dal|pulses|oats|maize|ragi|bajra)\b/i,
  Oils: /\b(oil|ghee|vanaspati|butter)\b/i,
  Dairy: /\b(milk|curd|paneer|cheese|lassi|dahi)\b/i,
  Snacks: /\b(biscuit|chips|namkeen|wafer|popcorn|mixture)\b/i,
  Beverages: /\b(tea|coffee|juice|drink|water|soda|cola|beverage|chai)\b/i,
  Cleaning: /\b(detergent|surf|vim|phenyl|broom|cleaner|dishwash|harpic)\b/i,
  Spices: /\b(masala|chili|pepper|turmeric|haldi|jeera|cumin|coriander|salt|garam)\b/i,
};
const autoCat = n => { for (const [c, rx] of Object.entries(CAT_RX)) if (rx.test(n)) return c; return 'Other'; };

function last30Days() {
  const today = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - 29 + i);
    return d.toISOString().slice(0, 10);
  });
}

function buildDailyRevenue(orders) {
  const days = last30Days();
  return days.map(date => ({
    date: date.slice(5),
    revenue: orders
      .filter(o => o.status === 'Accepted' && o.date?.slice(0, 10) === date)
      .reduce((s, o) => s + Number(o.total || 0), 0),
  }));
}

function buildTop10(orders) {
  const map = {};
  orders.filter(o => o.status === 'Accepted').forEach(o =>
    (o.items || []).forEach(item => {
      const k = (item.name || 'Unknown').slice(0, 16);
      if (!map[k]) map[k] = { name: k, revenue: 0 };
      map[k].revenue += Number(item.price || 0) * Number(item.qty || 0);
    })
  );
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

function buildCashFlow(orders, stockOrders, customerCredits, credits) {
  const days = last30Days();
  return days.map(date => {
    const cashIn =
      orders.filter(o => o.status === 'Accepted' && !['estimate', 'challan'].some(t => (o.userId || '').startsWith(t)) && o.date?.slice(0, 10) === date)
        .reduce((s, o) => s + Number(o.total || 0), 0) +
      (customerCredits || []).filter(c => c.paid && c.date?.slice(0, 10) === date).reduce((s, c) => s + Number(c.amount || 0), 0);
    const cashOut =
      (stockOrders || []).filter(so => so.status === 'accepted' && so.date?.slice(0, 10) === date)
        .reduce((s, so) => s + Number(so.total || 0), 0) +
      (credits || []).filter(c => c.paid && c.date?.slice(0, 10) === date).reduce((s, c) => s + Number(c.amount || 0), 0);
    return { date: date.slice(5), cashIn, cashOut };
  });
}

function buildCatMargins(products) {
  const cats = {};
  (products || []).forEach(p => {
    if (p.costPrice > 0 && p.price > 0) {
      const c = autoCat(p.name);
      if (!cats[c]) cats[c] = { sum: 0, n: 0 };
      cats[c].sum += (p.price - p.costPrice) / p.price * 100;
      cats[c].n++;
    }
  });
  return Object.entries(cats)
    .map(([name, { sum, n }]) => ({ name, margin: Math.round(sum / n) }))
    .sort((a, b) => b.margin - a.margin);
}

const AXIS = { fill: '#64748b', fontSize: 10 };
const TT_STYLE = { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' };
const fmt = v => v > 999 ? `${(v / 1000).toFixed(0)}k` : v;

const DesktopReports = ({
  reportsData, orders, downloadTallyXML, user,
  credits = [], customerCredits = [], stockOrders = [], dailyTarget = 0, products = [],
}) => {
  const { cashIn, cashOut, netProfit, marginPercent, ledgerItems } = reportsData();

  const revenueData = useMemo(() => buildDailyRevenue(orders), [orders]);
  const top10 = useMemo(() => buildTop10(orders), [orders]);
  const cashFlowData = useMemo(() => buildCashFlow(orders, stockOrders, customerCredits, credits), [orders, stockOrders, customerCredits, credits]);
  const catMargins = useMemo(() => buildCatMargins(products), [products]);

  const total30 = revenueData.reduce((s, d) => s + d.revenue, 0);

  // CRM export dropdown
  const [crmMenuOpen, setCrmMenuOpen] = useState(false);

  // Customers derived from customerCredits entries (desc encoded as "purpose:name:phone:details")
  const zohoCustomers = useMemo(() => {
    const map = new Map();
    (customerCredits || []).forEach(c => {
      const parts = (c.desc || '').split(':');
      const name = parts[1] || 'Customer';
      const phone = parts[2] || '';
      const key = phone || name;
      const existing = map.get(key) || { name, phone, shopName: user?.name || '', orderCount: 0, totalSpent: 0 };
      existing.orderCount += 1;
      existing.totalSpent += Number(c.amount || 0);
      map.set(key, existing);
    });
    return Array.from(map.values());
  }, [customerCredits, user]);

  const handleZohoContacts = () => {
    const csv = generateZohoContactsCSV(zohoCustomers);
    downloadZohoCSV(csv, `zoho-contacts-${new Date().toISOString().slice(0, 10)}.csv`);
    setCrmMenuOpen(false);
  };

  const handleZohoLeads = () => {
    // For a single shopkeeper, the only "lead-shaped" record is themselves. Admins should use the admin export.
    const csv = generateZohoLeadsCSV(user ? [user] : []);
    downloadZohoCSV(csv, `zoho-leads-${new Date().toISOString().slice(0, 10)}.csv`);
    setCrmMenuOpen(false);
  };

  const thisWeekRev = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    return orders.filter(o => o.status === 'Accepted' && o.date && new Date(o.date) >= cutoff)
      .reduce((s, o) => s + Number(o.total || 0), 0);
  }, [orders]);

  const weeklyTarget = dailyTarget * 7;
  const weeklyPct = weeklyTarget > 0 ? Math.min(100, Math.round((thisWeekRev / weeklyTarget) * 100)) : 0;

  const totalReceivable = (customerCredits || []).filter(c => !c.paid).reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalPayable = (credits || []).filter(c => !c.paid).reduce((s, c) => s + Number(c.amount || 0), 0);
  const maxCredit = Math.max(totalReceivable, totalPayable, 1);

  const radius = 50, circumference = 2 * Math.PI * radius;
  const displayPercent = Math.min(100, Math.max(0, Math.abs(marginPercent)));
  const strokeOffset = circumference - (displayPercent / 100) * circumference;
  const isLoss = netProfit < 0;
  const strokeColor = isLoss ? '#ef4444' : '#10b981';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Row 1 — margin + exporters | day book */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Margin gauge */}
          <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={18} color="#fbbf24" /> Net Margin Analytics
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="65" cy="65" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                  <circle cx="65" cy="65" r={radius} fill="transparent" stroke={strokeColor} strokeWidth="10"
                    strokeDasharray={circumference} strokeDashoffset={strokeOffset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }} />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: strokeColor }}>{isLoss ? '-' : '+'}{displayPercent}%</h4>
                  <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>{isLoss ? 'Loss' : 'Net Margin'}</p>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '800', color: isLoss ? '#fca5a5' : '#a7f3d0' }}>
                  {isLoss ? '🔴 Loss' : '🟢 Profit Today'}
                  <span style={{ display: 'block', fontSize: '24px', color: 'white', fontWeight: '900', marginTop: '4px' }}>₹{Math.abs(netProfit)}</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={14} color="#10b981" /> Cash-In Today:</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>₹{cashIn}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingDown size={14} color="#ef4444" /> Cash-Out Today:</span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>₹{cashOut}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tally Exporter */}
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(135deg,rgba(16,185,129,0.06),rgba(5,150,105,0.02))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>📊 Tally ERP / Prime Exporter</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>Generate double-entry bookkeeping ledgers. Download compliant Sales XML.</p>
              </div>
              <PlanGate feature="tallyExport" fallback={<LockedFeature feature="tallyExport" compact />}>
                <button onClick={() => downloadTallyXML(
                    orders.filter(o => ['Accepted','accepted','Completed','completed'].includes(o.status)),
                    user.name,
                    { stockOrders, supplierCredits: credits, customerCredits, products }
                  )}
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <Download size={14} /> Export XML
                </button>
              </PlanGate>
            </div>
          </div>

          {/* GSTR-1 */}
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(135deg,rgba(139,92,246,0.06),rgba(79,70,229,0.02))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: '#8b5cf6' }}>🇮🇳 GSTR-1 CSV Exporter</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>GST-portal ready GSTR-1 CSV with CGST/SGST/IGST split for B2B and B2C.</p>
              </div>
              <PlanGate feature="gst" fallback={<LockedFeature feature="gst" compact />}>
                <button onClick={() => downloadGSTR1CSV(orders, user, new Date().toISOString().slice(0, 7))}
                  style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <FileSpreadsheet size={14} /> Export CSV
                </button>
              </PlanGate>
            </div>
          </div>

          {/* Zoho CRM Exporter */}
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(245,158,11,0.3)', background: 'linear-gradient(135deg,rgba(245,158,11,0.06),rgba(217,119,6,0.02))', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: '#f59e0b' }}>🔗 Export to CRM</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>Push your customers and leads into Zoho CRM in one click.</p>
              </div>
              <button onClick={() => setCrmMenuOpen(o => !o)}
                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                <Users size={14} /> Export ▾
              </button>
            </div>
            {crmMenuOpen && (
              <div style={{ position: 'absolute', top: '52px', right: '20px', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', minWidth: '220px', zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                <button onClick={handleZohoContacts}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #334155' }}>
                  📇 Zoho Contacts CSV
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{zohoCustomers.length} customer{zohoCustomers.length === 1 ? '' : 's'} from credit ledger</div>
                </button>
                <button onClick={handleZohoLeads}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '12px', cursor: 'pointer' }}>
                  🎯 Zoho Leads CSV
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Your shop as a Zoho lead</div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Day Book ledger */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Book size={20} color="#fbbf24" /> Today's Retail Day Book
          </h3>
          {ledgerItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              <Book size={36} style={{ opacity: 0.15, marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>No cash flows recorded today yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: '4px' }}>
              {ledgerItems.map((item, idx) => (
                <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', background: item.type === 'Cash In' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: item.type === 'Cash In' ? '#10b981' : '#ef4444', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.category}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.time}</span>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontWeight: '700', fontSize: '13px', color: 'white' }}>{item.desc}</p>
                  </div>
                  <span style={{ fontWeight: '800', color: item.type === 'Cash In' ? '#10b981' : '#ef4444', fontSize: '15px' }}>
                    {item.type === 'Cash In' ? '+' : '-'}₹{item.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — 30-day revenue AreaChart + top 10 products BarChart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="#3b82f6" /> 30-Day Revenue Trend
            </h3>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>30-day total</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: '900', color: '#3b82f6' }}>₹{total30.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} interval={6} />
              <YAxis tick={AXIS} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={TT_STYLE} formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} color="#f59e0b" /> Top 10 Products (revenue this month)
          </h3>
          {top10.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>
              <TrendingUp size={28} style={{ opacity: 0.2, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '12px' }}>No sales data yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={top10} margin={{ top: 4, right: 4, left: -20, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 9 }} tickLine={false} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={AXIS} tickLine={false} tickFormatter={fmt} />
                <Tooltip contentStyle={TT_STYLE} formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3 — Cash flow 30d | Credit gauge + Weekly target + Category margins */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingDown size={16} color="#ef4444" /> Cash In vs Out — 30 Days
          </h3>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={cashFlowData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} interval={6} />
              <YAxis tick={AXIS} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [`₹${Number(v).toLocaleString('en-IN')}`, n === 'cashIn' ? 'Cash In' : 'Cash Out']} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '6px' }} />
              <Area type="monotone" dataKey="cashIn" name="cashIn" stroke="#10b981" strokeWidth={2} fill="url(#inGrad)" dot={false} />
              <Area type="monotone" dataKey="cashOut" name="cashOut" stroke="#ef4444" strokeWidth={2} fill="url(#outGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Outstanding credit bars */}
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: '800', color: 'white' }}>Outstanding Credit</h4>
            {[['Receivable (customers owe you)', totalReceivable, '#10b981'], ['Payable (you owe suppliers)', totalPayable, '#ef4444']].map(([label, amount, color]) => (
              <div key={label} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                  <span style={{ color: '#94a3b8' }}>{label}</span>
                  <span style={{ color, fontWeight: '800' }}>₹{Number(amount).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                  <div style={{ height: '100%', width: `${Math.round((amount / maxCredit) * 100)}%`, background: color, borderRadius: '4px', transition: 'width 0.6s ease', minWidth: amount > 0 ? '4px' : '0' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Weekly revenue vs target */}
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '800', color: 'white' }}>Weekly Revenue vs Target</h4>
            {weeklyTarget === 0 ? (
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Set a daily target in Settings to track weekly progress.</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                  <span style={{ color: '#94a3b8' }}>₹{thisWeekRev.toLocaleString('en-IN')} / ₹{weeklyTarget.toLocaleString('en-IN')}</span>
                  <span style={{ color: weeklyPct >= 100 ? '#10b981' : '#fbbf24', fontWeight: '800' }}>{weeklyPct}%</span>
                </div>
                <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px' }}>
                  <div style={{ height: '100%', width: `${weeklyPct}%`, background: weeklyPct >= 100 ? '#10b981' : 'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius: '5px', transition: 'width 0.6s ease' }} />
                </div>
                {weeklyPct >= 100 && <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>🎉 Weekly target achieved!</p>}
              </>
            )}
          </div>

          {/* Profit margin by product category */}
          {catMargins.length > 0 && (
            <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '800', color: 'white' }}>Margin by Category</h4>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={catMargins} margin={{ top: 0, right: 4, left: -28, bottom: 32 }}>
                  <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 9 }} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ ...AXIS, fontSize: 9 }} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v}%`, 'Avg Margin']} />
                  <Bar dataKey="margin" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesktopReports;
