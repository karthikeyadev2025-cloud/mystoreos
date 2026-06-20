/**
 * MobileDashboard — at-a-glance shop insights for the owner.
 *
 * What belongs here (NOT on the billing screen):
 *   - Today's revenue, bills count, average bill value
 *   - Daily target progress (the donut ring DesktopPOS had)
 *   - Low stock products list
 *   - Pending orders count
 *   - Quick actions (Scan, UPI QR, Share Shop, Add Product)
 *
 * Accessed via the chart-icon button in the POS search bar header.
 * One tap to open, one tap to return to billing.
 */
import { Sparkles, TrendingUp, Receipt, Package, AlertTriangle, IndianRupee, ScanLine, Share2, Plus, X, Wallet } from 'lucide-react';

export default function MobileDashboard({
  onClose,
  products = [],
  sales = 0,
  pendingOrders = 0,
  payable = 0,
  dailyTarget = 0,
  handleSetDailyTarget,
  todayBillsCount = 0,
  handleShowUpiQr,
  handleShareShop,
  setShowScanner,
  setActiveTab,
  setShowAddProductModal,
  shopName = 'Your Shop',
  isOwner,
}) {
  const lowStock = products.filter(p => p.stock < (p.reorderLevel || 10));
  const outOfStock = products.filter(p => (p.stock || 0) <= 0);
  const avgBill = todayBillsCount > 0 ? Math.round(sales / todayBillsCount) : 0;

  // Daily target ring math
  const targetPct = dailyTarget > 0 ? Math.min(1, sales / dailyTarget) : 0;
  const ringPct = Math.round(targetPct * 100);
  const ringColor = ringPct >= 100 ? '#10B981' : ringPct >= 60 ? '#F59E0B' : '#EF4444';
  const RING_R = 48;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C * (1 - targetPct);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F8FAFC', zIndex: 150, overflowY: 'auto', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #4338CA 100%)', color: '#fff', padding: '14px 16px 18px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Dashboard</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{shopName}</div>
          </div>
          <button onClick={onClose} aria-label="Close dashboard" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, width: 36, height: 36, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Today's revenue card with target ring */}
      <div style={{ margin: '-14px 12px 0', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15,23,42,0.08)', padding: 16, display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
        <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}>
          <svg width="112" height="112" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="56" cy="56" r={RING_R} fill="none" stroke="#F1F5F9" strokeWidth="9" />
            <circle cx="56" cy="56" r={RING_R} fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={ringOffset} style={{ transition: 'stroke-dashoffset 0.6s' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A' }}>{ringPct}%</div>
            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>of target</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Today's Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 2, letterSpacing: '-0.5px' }}>₹{sales.toLocaleString('en-IN')}</div>
          {dailyTarget > 0 ? (
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              Target ₹{Number(dailyTarget).toLocaleString('en-IN')}
              {ringPct >= 100 ? ' · 🎉 hit!' : ` · ₹${(dailyTarget - sales).toLocaleString('en-IN')} to go`}
            </div>
          ) : (
            <button onClick={() => {
              const v = prompt('Set today\'s revenue target (₹)');
              if (v && !isNaN(Number(v)) && Number(v) > 0) handleSetDailyTarget && handleSetDailyTarget(Number(v));
            }} style={{ marginTop: 6, background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              + Set daily target
            </button>
          )}
        </div>
      </div>

      {/* 4-up KPI cards */}
      <div style={{ margin: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <KpiCard
          icon={<Receipt size={16} color="#F59E0B" />}
          label="Today's Bills"
          value={todayBillsCount}
          accent="#F59E0B"
          onClick={() => { setActiveTab && setActiveTab('bills'); onClose && onClose(); }}
        />
        <KpiCard
          icon={<TrendingUp size={16} color="#10B981" />}
          label="Avg Bill"
          value={`₹${avgBill}`}
          accent="#10B981"
        />
        <KpiCard
          icon={<Package size={16} color="#4F46E5" />}
          label="Products"
          value={products.length}
          accent="#4F46E5"
          onClick={() => { setActiveTab && setActiveTab('products'); onClose && onClose(); }}
        />
        <KpiCard
          icon={<Wallet size={16} color="#EF4444" />}
          label="Credit Due"
          value={`₹${payable.toLocaleString('en-IN')}`}
          accent="#EF4444"
          onClick={() => { setActiveTab && setActiveTab('credit'); onClose && onClose(); }}
        />
      </div>

      {/* Pending orders alert */}
      {pendingOrders > 0 && (
        <button onClick={() => { setActiveTab && setActiveTab('bills'); onClose && onClose(); }}
          style={{ width: 'calc(100% - 24px)', margin: '0 12px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Receipt size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{pendingOrders} new {pendingOrders === 1 ? 'order' : 'orders'} waiting</div>
            <div style={{ fontSize: 11, color: '#B45309', marginTop: 1 }}>Tap to review and accept</div>
          </div>
          <span style={{ color: '#92400E', fontSize: 16, fontWeight: 800 }}>→</span>
        </button>
      )}

      {/* Low stock card */}
      {lowStock.length > 0 && (
        <div style={{ margin: '0 12px 10px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: outOfStock.length ? '#FEE2E2' : '#FEF3C7', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #E2E8F0' }}>
            <AlertTriangle size={15} color={outOfStock.length ? '#EF4444' : '#F59E0B'} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: outOfStock.length ? '#991B1B' : '#92400E' }}>
              {lowStock.length} {lowStock.length === 1 ? 'item' : 'items'} low on stock
            </div>
            {isOwner && (
              <button onClick={() => { setActiveTab && setActiveTab('restock'); onClose && onClose(); }} style={{ background: '#FFFFFF', border: `1px solid ${outOfStock.length ? '#FCA5A5' : '#FDE68A'}`, color: outOfStock.length ? '#991B1B' : '#92400E', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Restock
              </button>
            )}
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {lowStock.slice(0, 6).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: (p.stock || 0) <= 0 ? '#EF4444' : '#F59E0B', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: (p.stock || 0) <= 0 ? '#EF4444' : '#F59E0B', fontWeight: 700 }}>
                  {(p.stock || 0) <= 0 ? 'Out' : `${p.stock} left`}
                </div>
              </div>
            ))}
            {lowStock.length > 6 && (
              <div style={{ padding: '8px 14px', textAlign: 'center', fontSize: 11, color: '#64748B' }}>
                +{lowStock.length - 6} more items
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Insight (only if there's something to say) */}
      {lowStock.length > 0 && (
        <div style={{ margin: '0 12px 10px', background: 'linear-gradient(135deg, #F5F3FF, #EEF2FF)', border: '1px solid #C7D2FE', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={14} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4338CA', marginBottom: 2 }}>AI Insight</div>
            <div style={{ fontSize: 11.5, color: '#3730A3', lineHeight: 1.4 }}>
              Based on your stock levels, consider reordering <b>{lowStock.slice(0, 3).map(p => p.name).join(', ')}</b>
              {lowStock.length > 3 && ` and ${lowStock.length - 3} more`} soon to avoid running out.
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ margin: '0 12px 10px' }}>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <QuickAction icon={<ScanLine size={18} />} label="Scan" color="#4F46E5" onClick={() => { setShowScanner && setShowScanner(true); onClose && onClose(); }} />
          <QuickAction icon={<IndianRupee size={18} />} label="UPI QR" color="#F59E0B" onClick={() => { handleShowUpiQr && handleShowUpiQr(); onClose && onClose(); }} />
          {isOwner && <QuickAction icon={<Plus size={18} />} label="Add Item" color="#10B981" onClick={() => { setActiveTab && setActiveTab('products'); setShowAddProductModal && setShowAddProductModal(true); onClose && onClose(); }} />}
          <QuickAction icon={<Share2 size={18} />} label="Share" color="#EF4444" onClick={() => { handleShareShop && handleShareShop(); }} />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, accent, onClick }) {
  return (
    <div onClick={onClick} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)', cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</div>
      </div>
      <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.3px' }}>{value}</div>
    </div>
  );
}

function QuickAction({ icon, label, color, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, cursor: 'pointer' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{label}</span>
    </button>
  );
}
