import { useMemo } from 'react';
import { Book, Download, TrendingUp, TrendingDown, BarChart2, FileSpreadsheet, Activity } from 'lucide-react';
import { PlanGate, LockedFeature } from './PlanGate';
import { downloadGSTR1CSV } from '../lib/gstrExport';

// ---- Sparkline helpers ----
function buildSparkline(orders) {
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 29 + i);
    return d.toISOString().slice(0, 10);
  });

  const dailyRev = days.map(date =>
    orders
      .filter(o => o.status === 'Accepted' && o.date?.slice(0, 10) === date)
      .reduce((s, o) => s + Number(o.total || 0), 0)
  );

  const peak = Math.max(...dailyRev, 1);
  const W = 280, H = 60;
  const pts = dailyRev.map((v, i) => {
    const x = (i / 29) * W;
    const y = H - (v / peak) * H * 0.85;
    return `${x},${y}`;
  }).join(' ');

  const area = `0,${H} ` + pts + ` ${W},${H}`;
  const total30 = dailyRev.reduce((a, b) => a + b, 0);
  const lastX = W, lastY = H - (dailyRev[29] / peak) * H * 0.85;

  return { pts, area, total30, dailyRev, days, lastX, lastY };
}

function buildTopProducts(orders) {
  const map = {};
  orders
    .filter(o => o.status === 'Accepted')
    .forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.name || 'Unknown';
        if (!map[key]) map[key] = { name: key, revenue: 0, qty: 0 };
        map[key].revenue += Number(item.price || 0) * Number(item.qty || 0);
        map[key].qty += Number(item.qty || 0);
      });
    });
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
}

const DesktopReports = ({
  reportsData,
  orders,
  downloadTallyXML,
  user
}) => {
  const { cashIn, cashOut, netProfit, marginPercent, ledgerItems } = reportsData();

  const { pts, area, total30, dailyRev, days, lastX, lastY } = useMemo(
    () => buildSparkline(orders), [orders]
  );
  const top5 = useMemo(() => buildTopProducts(orders), [orders]);

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const displayPercent = Math.min(100, Math.max(0, Math.abs(marginPercent)));
  const strokeOffset = circumference - (displayPercent / 100) * circumference;
  const isLoss = netProfit < 0;
  const strokeColor = isLoss ? '#ef4444' : '#10b981';

  const peak30 = Math.max(...dailyRev, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Row 1 — existing margin + exporters + day book */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Margin Circle Gauge */}
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
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: strokeColor }}>
                    {isLoss ? '-' : '+'}{displayPercent}%
                  </h4>
                  <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    {isLoss ? 'Loss Margin' : 'Net Margin'}
                  </p>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '800', color: isLoss ? '#fca5a5' : '#a7f3d0' }}>
                  {isLoss ? '🔴 Margin Loss' : '🟢 Profit Today'}
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
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.02))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>📊 Tally ERP / Prime Exporter</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  Generate double-entry bookkeeping ledgers. Download compliant Sales XML for auditing.
                </p>
              </div>
              <PlanGate feature="tallyExport" fallback={<LockedFeature feature="tallyExport" compact />}>
                <button
                  onClick={() => downloadTallyXML(orders.filter(o => ['Accepted', 'accepted', 'Completed', 'completed'].includes(o.status)), user.name)}
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  <Download size={14} /> Export XML
                </button>
              </PlanGate>
            </div>
          </div>

          {/* GSTR-1 CSV Exporter */}
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(79,70,229,0.02))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: '#8b5cf6' }}>🇮🇳 GSTR-1 CSV Exporter</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  Download GST-portal ready GSTR-1 CSV with CGST/SGST/IGST split for B2B and B2C invoices.
                </p>
              </div>
              <PlanGate feature="gst" fallback={<LockedFeature feature="gst" compact />}>
                <button
                  onClick={() => downloadGSTR1CSV(orders, user, new Date().toISOString().slice(0, 7))}
                  style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  <FileSpreadsheet size={14} /> Export CSV
                </button>
              </PlanGate>
            </div>
          </div>
        </div>

        {/* Right Column: Today's Day Book */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Book size={20} color="#fbbf24" /> Today's Retail Day Book
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Realtime ledger of active cash flows.</p>
            </div>
          </div>
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
                      <span style={{ fontSize: '9px', background: item.type === 'Cash In' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: item.type === 'Cash In' ? '#10b981' : '#ef4444', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {item.category}
                      </span>
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

      {/* Row 2 — 30-day revenue sparkline + top products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>

        {/* 30-Day Revenue Sparkline */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color="#3b82f6" /> 30-Day Revenue Trend
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                {days[0]?.slice(5)} — {days[29]?.slice(5)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>30-day total</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: '900', color: '#3b82f6' }}>₹{total30.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* SVG Sparkline */}
          <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
            <svg viewBox="0 0 280 60" style={{ width: '100%', height: '80px', display: 'block' }}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Area fill */}
              <polygon points={area} fill="url(#sparkGrad)" />
              {/* Line */}
              <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
              {/* Today's dot */}
              {dailyRev[29] > 0 && (
                <circle cx={lastX} cy={lastY} r="3" fill="#3b82f6" stroke="#0f172a" strokeWidth="1.5" />
              )}
            </svg>

            {/* X-axis labels: first, mid, today */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px 2px', fontSize: '9px', color: '#475569' }}>
              <span>{days[0]?.slice(5)}</span>
              <span>{days[14]?.slice(5)}</span>
              <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>Today</span>
            </div>
          </div>

          {/* Weekly summary bars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '16px' }}>
            {[3, 2, 1, 0].map(weeksAgo => {
              const startIdx = 29 - (weeksAgo + 1) * 7 + 1;
              const slice = dailyRev.slice(Math.max(0, startIdx), startIdx + 7);
              const weekTotal = slice.reduce((a, b) => a + b, 0);
              const label = weeksAgo === 0 ? 'This wk' : weeksAgo === 1 ? 'Last wk' : `${weeksAgo + 1}w ago`;
              const barH = peak30 > 0 ? Math.max(4, (weekTotal / (peak30 * 7)) * 40) : 4;
              return (
                <div key={weeksAgo} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', height: '40px', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${barH}px`, background: weeksAgo === 0 ? '#3b82f6' : 'rgba(59,130,246,0.35)', borderRadius: '3px', transition: 'height 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: '9px', color: weeksAgo === 0 ? '#3b82f6' : '#475569', fontWeight: weeksAgo === 0 ? 'bold' : 'normal' }}>{label}</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>₹{weekTotal > 0 ? (weekTotal / 1000).toFixed(1) + 'k' : '0'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Products by Revenue */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} color="#f59e0b" /> Top Products (30-day)
          </h3>
          {top5.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>
              <TrendingUp size={28} style={{ opacity: 0.2, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '12px' }}>No sales data yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {top5.map((p, i) => {
                const maxRev = top5[0].revenue;
                const barPct = maxRev > 0 ? (p.revenue / maxRev) * 100 : 0;
                const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];
                return (
                  <div key={p.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: colors[i], minWidth: '16px' }}>#{i + 1}</span>
                        <span style={{ fontSize: '12px', color: 'white', fontWeight: 'bold', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: '800', whiteSpace: 'nowrap' }}>₹{p.revenue.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: colors[i], borderRadius: '3px', transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '10px', color: '#475569', marginTop: '2px', display: 'block' }}>{p.qty} units sold</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesktopReports;
