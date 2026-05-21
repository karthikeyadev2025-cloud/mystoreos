import { Book, Download, TrendingUp, TrendingDown, BarChart2, FileSpreadsheet } from 'lucide-react';
import { PlanGate, LockedFeature } from './PlanGate';
import { downloadGSTR1CSV } from '../lib/gstrExport';

const DesktopReports = ({
  reportsData,
  orders,
  downloadTallyXML,
  user
}) => {
  const { cashIn, cashOut, netProfit, marginPercent, ledgerItems } = reportsData();

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const displayPercent = Math.min(100, Math.max(0, Math.abs(marginPercent)));
  const strokeOffset = circumference - (displayPercent / 100) * circumference;
  const isLoss = netProfit < 0;
  const strokeColor = isLoss ? '#ef4444' : '#10b981';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: Gauge, Profit Margin & Tally Export */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Margin Circle Gauge */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={18} color="#fbbf24" /> Net Margin Analytics
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flexWrap: 'wrap' }}>
            {/* Circular Gauge */}
            <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Track */}
                <circle 
                  cx="65" cy="65" r={radius} 
                  fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="10" 
                />
                {/* Animated Filled Track */}
                <circle 
                  cx="65" cy="65" r={radius} 
                  fill="transparent" stroke={strokeColor} strokeWidth="10" 
                  strokeDasharray={circumference} strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                />
              </svg>
              
              {/* Text Center */}
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: strokeColor }}>
                  {isLoss ? '-' : '+'}{displayPercent}%
                </h4>
                <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                  {isLoss ? 'Loss Margin' : 'Net Margin'}
                </p>
              </div>
            </div>

            {/* Profits details */}
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

        {/* Tally Exporter Card */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.02))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>📊 Tally ERP / Prime Exporter</h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
                Generate double-entry bookkeeping ledgers. Download compliant Sales XML format directly for auditing.
              </p>
            </div>
            <PlanGate
              feature="tallyExport"
              fallback={<LockedFeature feature="tallyExport" compact />}
            >
              <button
                onClick={() => downloadTallyXML(orders.filter(o => o.status === 'completed'), user.name)}
                style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
              >
                <Download size={14} /> Export XML
              </button>
            </PlanGate>
          </div>
        </div>

        {/* GSTR-1 CSV Exporter Card */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(79,70,229,0.02))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: '#8b5cf6' }}>🇮🇳 GSTR-1 CSV Exporter</h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
                Download GST-portal ready GSTR-1 CSV with CGST/SGST/IGST split for B2B and B2C invoices.
              </p>
            </div>
            <PlanGate
              feature="gst"
              fallback={<LockedFeature feature="gst" compact />}
            >
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

      {/* Right Column: Today's Ledger */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: '4px' }}>
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
  );
};

export default DesktopReports;
