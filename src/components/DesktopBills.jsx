import { useState, useMemo } from 'react';
import { Search, Receipt, ArrowRight, Printer, CornerUpLeft, Check, BadgeCheck, X, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react';

const PM_COLOR = { Cash: 'var(--c-success)', UPI: 'var(--c-primary)', Card: 'var(--c-info)', Credit: 'var(--c-danger)' };
const PM_ICON  = { Cash: '💵', UPI: '📱', Card: '💳', Credit: '📒' };

const StatusBadge = ({ order }) => {
  if (order.status === 'Cancelled') {
    return <span style={{ fontSize: 10, background: 'var(--c-line-soft)', color: 'var(--c-muted)', padding: '3px 8px', borderRadius: 6, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}><X size={10}/> Cancelled</span>;
  }
  if (order.status === 'Returned') {
    return <span style={{ fontSize: 10, background: '#F5F3FF', color: '#7C3AED', padding: '3px 8px', borderRadius: 6, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>↩️ Returned</span>;
  }
  if (order.refundAmount > 0) {
    return <span style={{ fontSize: 10, background: '#FFF7ED', color: 'var(--c-accent-hover)', padding: '3px 8px', borderRadius: 6, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>↩️ Partial Return</span>;
  }
  if (order.paymentVerified || order.status === 'Completed') {
    return <span style={{ fontSize: 10, background: 'var(--c-success-soft)', color: 'var(--c-success-strong)', padding: '3px 8px', borderRadius: 6, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle2 size={10}/> Paid</span>;
  }
  if (order.status === 'Accepted') {
    return <span style={{ fontSize: 10, background: 'var(--c-primary-soft)', color: 'var(--c-primary)', padding: '3px 8px', borderRadius: 6, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={10}/> Accepted</span>;
  }
  if (order.status === 'Pending') {
    return <span style={{ fontSize: 10, background: 'var(--c-warning-soft)', color: 'var(--c-accent-hover)', padding: '3px 8px', borderRadius: 6, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10}/> Pending</span>;
  }
  return <span style={{ fontSize: 10, background: 'var(--c-line-soft)', color: 'var(--c-muted)', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>{order.status}</span>;
};

const DesktopBills = ({
  orders,
  billsSubTab,
  setBillsSubTab,
  handleConvertEstimateToBill,
  acceptOrder,
  verifyOrderPayment,
  printReceiptPDF,
  handleOpenReturnModal,
  openCancelModal,
  decodeOrderUserId,
  user
}) => {
  const [searchTerm, setSearchTerm]       = useState('');
  const [selectedBill, setSelectedBill]   = useState(null);
  const [sortBy, setSortBy]               = useState('date_desc'); // date_desc | date_asc | amount_desc | status

  const allOrders = useMemo(() => {
    return orders.filter(o => {
      const uid = o.userId || '';
      const isDraft = uid.startsWith('estimate') || uid.startsWith('challan');
      const matchesSubTab = billsSubTab === 'sales' ? !isDraft : isDraft;
      if (!matchesSubTab) return false;

      if (!searchTerm) return true;
      const { name, phone } = decodeOrderUserId(uid);
      const q = searchTerm.toLowerCase();
      return (
        name.toLowerCase().includes(q) ||
        phone.includes(q) ||
        (o.id || '').toLowerCase().includes(q) ||
        String(o.total).includes(q) ||
        (o.paymentMethod || '').toLowerCase().includes(q)
      );
    });
  }, [orders, billsSubTab, searchTerm, decodeOrderUserId]);

  const sortedOrders = useMemo(() => {
    const arr = [...allOrders];
    if (sortBy === 'date_desc')   return arr.sort((a,b) => new Date(b.date) - new Date(a.date));
    if (sortBy === 'date_asc')    return arr.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (sortBy === 'amount_desc') return arr.sort((a,b) => b.total - a.total);
    if (sortBy === 'status')      return arr.sort((a,b) => (a.status||'').localeCompare(b.status||''));
    return arr;
  }, [allOrders, sortBy]);

  const totalRevenue = allOrders
    .filter(o => !['estimate','challan'].some(t => (o.userId||'').startsWith(t)))
    .filter(o => o.status === 'Accepted' || o.status === 'Completed') // exclude Pending (not yet sold) and Cancelled
    .reduce((s,o) => s + (Number(o.total||0) - Number(o.refundAmount||0)), 0);
  const pendingCount = allOrders.filter(o => o.status === 'Pending').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '24px', alignItems: 'start' }}>

      {/* ── Left: Order List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--c-line-soft)', padding: '4px', borderRadius: '12px', border: '1px solid var(--c-line)' }}>
          {[['sales','💰 Sales Bills'],['drafts','📋 Estimates & Challans']].map(([k,label]) => (
            <button key={k} onClick={() => { setBillsSubTab(k); setSelectedBill(null); }}
              style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: 'none', background: billsSubTab === k ? 'var(--c-surface)' : 'transparent', color: billsSubTab === k ? 'var(--c-ink)' : 'var(--c-muted)', boxShadow: billsSubTab === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Stats row */}
        {billsSubTab === 'sales' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Total Bills', value: allOrders.length, color: 'var(--c-primary)' },
              { label: 'Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: 'var(--c-success)' },
              { label: 'Pending', value: pendingCount, color: pendingCount > 0 ? 'var(--c-danger)' : 'var(--c-muted)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }}>
                <div style={{ fontSize: 11, color: 'var(--c-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search + Sort */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-bg)', border: '1.5px solid var(--c-line)', borderRadius: '10px', padding: '4px 12px' }}>
            <Search size={15} color="var(--c-faint)" style={{ flexShrink: 0 }} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by customer, phone, amount, payment…"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-ink)', width: '100%', padding: '8px 0' }} />
            {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-faint)', padding: 0, flexShrink: 0 }}>✕</button>}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid var(--c-line)', borderRadius: '10px', fontSize: 12, fontWeight: 600, color: 'var(--c-ink-2)', background: 'var(--c-surface)', outline: 'none', cursor: 'pointer' }}>
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="status">By Status</option>
          </select>
        </div>

        {/* Order list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sortedOrders.length === 0 ? (
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '48px', textAlign: 'center', color: 'var(--c-faint)' }}>
              <Receipt size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
              <p style={{ fontWeight: 600, margin: '0 0 4px', color: 'var(--c-muted)' }}>{searchTerm ? 'No results found' : 'No bills yet'}</p>
              <p style={{ fontSize: 12, margin: 0 }}>{searchTerm ? `Try a different search` : `Bills appear here after you create them`}</p>
            </div>
          ) : sortedOrders.map(o => {
            const { name, phone, staffName } = decodeOrderUserId(o.userId);
            const isSelected = selectedBill?.id === o.id;
            return (
              <div key={o.id}
                onClick={() => setSelectedBill(o)}
                style={{ padding: '14px 16px', borderRadius: '12px', border: `1.5px solid ${isSelected ? 'var(--c-primary)' : 'var(--c-line)'}`, background: isSelected ? '#F5F3FF' : 'var(--c-surface)', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--c-primary),var(--c-primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-surface)', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                      {(name||'?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'Walk-in'}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                        {phone && <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>📱 {phone}</span>}
                        {staffName && <span style={{ fontSize: 10, color: 'var(--c-primary-light)' }}>👤 {staffName}</span>}
                        {o._branchName && <span style={{ fontSize: 10, color: 'var(--c-surface)', background: 'var(--c-primary)', padding: '2px 7px', borderRadius: 5, fontWeight: 700 }}>🏪 {o._branchName}</span>}
                        <span style={{ fontSize: 10, color: 'var(--c-faint)' }}>#{o.id.slice(0,8).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {o.refundAmount > 0 ? (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--c-faint)', textDecoration: 'line-through' }}>₹{o.total}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--c-ink)' }}>₹{(Number(o.total) - Number(o.refundAmount)).toFixed(2)}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--c-ink)' }}>₹{o.total}</div>
                    )}
                    <StatusBadge order={o} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, background: PM_COLOR[o.paymentMethod||'Cash']+'15', color: PM_COLOR[o.paymentMethod||'Cash'], padding: '2px 7px', borderRadius: 5, fontWeight: 700 }}>
                      {PM_ICON[o.paymentMethod||'Cash']} {o.paymentMethod||'Cash'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--c-faint)' }}>{(o.items||[]).length} item{(o.items||[]).length !== 1 ? 's' : ''}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>
                    {new Date(o.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Receipt Preview ── */}
      <div style={{ position: 'sticky', top: '24px' }}>
        {selectedBill ? (() => {
          const { type, name, phone } = decodeOrderUserId(selectedBill.userId);
          let receiptTitle = 'TAX INVOICE';
          if (type === 'estimate') receiptTitle = 'ESTIMATE / QUOTE';
          else if (type === 'challan') receiptTitle = 'DELIVERY CHALLAN';

          const pm = selectedBill.paymentMethod || 'Cash';
          const isPaid = selectedBill.paymentVerified || selectedBill.status === 'Completed';

          return (
            <div style={{ background: 'var(--c-surface)', borderRadius: '16px', border: '1px solid var(--c-line)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15,23,42,0.08)' }}>
              {/* Header bar */}
              <div style={{ background: selectedBill.status === 'Returned' ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : isPaid ? 'linear-gradient(135deg,var(--c-success),var(--c-success-strong))' : selectedBill.status === 'Accepted' ? 'linear-gradient(135deg,var(--c-primary),var(--c-primary-hover))' : 'linear-gradient(135deg,var(--c-warning),var(--c-accent-hover))', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-surface)' }}>{selectedBill.status === 'Returned' ? '↩️ RETURNED BILL' : receiptTitle}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>#{selectedBill.id.slice(0,8).toUpperCase()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-surface)' }}>₹{selectedBill.refundAmount > 0 ? (Number(selectedBill.total) - Number(selectedBill.refundAmount)).toFixed(2) : selectedBill.total}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                    {new Date(selectedBill.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px' }}>
                {/* Shop + Customer info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div style={{ background: 'var(--c-bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--c-line)' }}>
                    <div style={{ fontSize: 9, color: 'var(--c-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>From</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-ink)' }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>📱 {user.phone}</div>
                    {user.gstin && <div style={{ fontSize: 10, color: 'var(--c-muted)', marginTop: 1 }}>GSTIN: {user.gstin}</div>}
                  </div>
                  <div style={{ background: 'var(--c-bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--c-line)' }}>
                    <div style={{ fontSize: 9, color: 'var(--c-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>To</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--c-ink)' }}>{name || 'Walk-in'}</div>
                    {phone && <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>📱 {phone}</div>}
                    {selectedBill.customerGstin && <div style={{ fontSize: 10, color: 'var(--c-muted)', marginTop: 1 }}>GSTIN: {selectedBill.customerGstin}</div>}
                  </div>
                </div>

                {/* Items */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--c-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px', marginBottom: 6 }}>
                    <span style={{ flex: 2 }}>Item</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>Qty</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>Amt</span>
                  </div>
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--c-line)' }}>
                    {(selectedBill.items || []).map((item, idx) => {
                      const lineBase = (item.price||0) * (item.qty||1);
                      const iDisc = item.itemDiscount || 0;
                      const lineTotal = iDisc > 0 ? Math.round(lineBase * (1 - iDisc/100)) : lineBase;
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '9px 12px', background: idx % 2 === 0 ? 'var(--c-surface)' : 'var(--c-bg)', borderBottom: idx < (selectedBill.items||[]).length - 1 ? '1px solid var(--c-line-soft)' : 'none' }}>
                          <div style={{ flex: 2, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--c-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.name}{item.selectedVariant ? ` (${item.selectedVariant})` : ''}
                            </div>
                            {iDisc > 0 && (
                              <div style={{ fontSize: 10, color: 'var(--c-danger)', fontWeight: 600 }}>-{iDisc}% off ₹{item.price}</div>
                            )}
                          </div>
                          <span style={{ flex: 1, textAlign: 'center', color: 'var(--c-muted)', fontWeight: 600 }}>{item.qty||1}</span>
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            {iDisc > 0 ? (
                              <>
                                <span style={{ fontSize: 10, color: 'var(--c-faint)', textDecoration: 'line-through', display: 'block' }}>₹{lineBase}</span>
                                <span style={{ fontWeight: 700, color: 'var(--c-success)' }}>₹{lineTotal}</span>
                              </>
                            ) : (
                              <span style={{ fontWeight: 700, color: 'var(--c-ink)' }}>₹{lineTotal}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Return Info Panel — shown when this bill has any returned items */}
                {(selectedBill.returnedAt || selectedBill.refundAmount > 0) && (
                  <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>↩️</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#7C3AED' }}>
                        {selectedBill.status === 'Returned' ? 'This bill was fully returned' : 'Partial return on this bill'}
                      </span>
                    </div>
                    {selectedBill.returnedAt && (
                      <div style={{ fontSize: 11, color: '#6D28D9', marginBottom: 4 }}>
                        Returned on {new Date(selectedBill.returnedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {selectedBill.returnedItems?.length > 0 && (
                      <div style={{ fontSize: 11, color: '#6D28D9', marginBottom: 4 }}>
                        Items: {selectedBill.returnedItems.map(it => `${it.name} x${it.returnQty}`).join(', ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 700 }}>
                        Refunded ({selectedBill.refundMode || 'cash'})
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#7C3AED' }}>-₹{Number(selectedBill.refundAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div style={{ background: 'var(--c-bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--c-line)', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>Payment</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PM_COLOR[pm]||'var(--c-success)' }}>
                      {PM_ICON[pm]||'💵'} {pm}
                    </span>
                  </div>
                  {selectedBill.shopMessage && (
                    <div style={{ fontSize: 11, color: 'var(--c-success-strong)', background: 'var(--c-success-soft)', borderRadius: 6, padding: '6px 8px', marginBottom: 8 }}>
                      💬 {selectedBill.shopMessage}
                    </div>
                  )}
                  {selectedBill.refundAmount > 0 ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--c-faint)' }}>Original Total</span>
                        <span style={{ fontSize: 13, color: 'var(--c-faint)', textDecoration: 'line-through' }}>₹{selectedBill.total}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-ink)' }}>Net Payable</span>
                        <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--c-ink)' }}>₹{(Number(selectedBill.total) - Number(selectedBill.refundAmount)).toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-ink)' }}>Grand Total</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--c-ink)' }}>₹{selectedBill.total}</span>
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <StatusBadge order={selectedBill} />
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedBill.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { acceptOrder(selectedBill.id); setSelectedBill(s => s ? {...s, status:'Accepted'} : s); }}
                        style={{ flex: 2, background: 'linear-gradient(135deg,var(--c-success),var(--c-success-strong))', color: 'var(--c-surface)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <Check size={16} /> Accept &amp; Notify
                      </button>
                      {openCancelModal && (
                        <button
                          onClick={() => openCancelModal(selectedBill)}
                          style={{ flex: 1, background: 'var(--c-danger-soft)', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          <X size={14} /> Cancel
                        </button>
                      )}
                    </div>
                  )}

                  {selectedBill.status === 'Accepted' && !isPaid && (
                    <button
                      onClick={() => { verifyOrderPayment && verifyOrderPayment(selectedBill.id); setSelectedBill(s => s ? {...s, status:'Completed', paymentVerified:true} : s); }}
                      style={{ width: '100%', background: 'linear-gradient(135deg,var(--c-primary),var(--c-primary-hover))', color: 'var(--c-surface)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <BadgeCheck size={16} /> Verify Payment &amp; Complete
                    </button>
                  )}

                  {billsSubTab === 'drafts' && type === 'estimate' && (
                    <button
                      onClick={() => handleConvertEstimateToBill(selectedBill)}
                      style={{ width: '100%', background: 'var(--c-accent-hover)', color: 'var(--c-surface)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <ArrowRight size={15} /> Convert to Active Bill
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => printReceiptPDF && printReceiptPDF(selectedBill)}
                      style={{ flex: 1, background: 'var(--c-surface)', border: '1px solid var(--c-line)', color: 'var(--c-ink-2)', padding: '10px', borderRadius: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Printer size={14} /> Print
                    </button>

                    {selectedBill.status === 'Accepted' && (
                      <button
                        onClick={() => handleOpenReturnModal(selectedBill)}
                        style={{ flex: 1, background: 'var(--c-danger-soft)', border: '1px solid #FECACA', color: 'var(--c-danger-strong)', padding: '10px', borderRadius: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <CornerUpLeft size={14} /> Return
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedBill(null)}
                      style={{ width: 40, background: 'var(--c-line-soft)', border: '1px solid var(--c-line)', color: 'var(--c-muted)', padding: '10px', borderRadius: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })() : (
          <div style={{ background: 'var(--c-surface)', borderRadius: '16px', border: '1px solid var(--c-line)', padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <ShoppingBag size={48} style={{ opacity: 0.1, marginBottom: '16px', color: 'var(--c-primary)' }} />
            <h3 style={{ color: 'var(--c-ink)', margin: '0 0 8px', fontWeight: 700 }}>Select a Bill</h3>
            <p style={{ color: 'var(--c-faint)', fontSize: 13, margin: 0, maxWidth: 240, lineHeight: 1.5 }}>
              Click any bill on the left to see the full receipt, accept orders, and verify payments.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopBills;
