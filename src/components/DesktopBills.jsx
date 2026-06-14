import { useState } from 'react';
import { Search, Receipt, ArrowRight, Printer, CornerUpLeft, Check } from 'lucide-react';

const DesktopBills = ({
  orders,
  billsSubTab,
  setBillsSubTab,
  handleConvertEstimateToBill,
  acceptOrder,
  handleOpenReturnModal,
  decodeOrderUserId,
  user
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);

  const filteredOrders = orders.filter(o => {
    const uid = o.userId || '';
    const isDraft = uid.startsWith('estimate') || uid.startsWith('challan');
    const matchesSubTab = billsSubTab === 'sales' ? !isDraft : isDraft;

    const { name, phone } = decodeOrderUserId(uid);
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm) ||
      (o.id || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSubTab && matchesSearch;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: Search & Invoices List */}
      <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={20} color="#64748B" /> Invoices Ledger
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748B' }}>
            Filter, search, or convert estimates/quotes and track returns.
          </p>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', background: '#F1F5F9', padding: '4px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <button 
            onClick={() => { setBillsSubTab('sales'); setSelectedBill(null); }}
            style={{
              flex: 1, padding: '10px 6px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
              background: billsSubTab === 'sales' ? '#ECFDF5' : 'transparent',
              color: billsSubTab === 'sales' ? '#10B981' : '#64748B',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} /> Sales Invoices</span>
          </button>
          <button 
            onClick={() => { setBillsSubTab('drafts'); setSelectedBill(null); }}
            style={{
              flex: 1, padding: '10px 6px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
              background: billsSubTab === 'drafts' ? '#FFF7ED' : 'transparent',
              color: billsSubTab === 'drafts' ? '#EA580C' : '#64748B',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} /> Proforma Drafts</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#F8FAFC', borderRadius: '10px', padding: '0 12px', border: '1px solid #E2E8F0' }}>
          <Search size={16} color="#94A3B8" />
          <input 
            type="text" 
            placeholder="Search customer, phone, or bill ID..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', margin: 0, width: '100%', padding: '10px 0', color: '#0F172A', outline: 'none', fontSize: '13px' }} 
          />
        </div>

        {/* Orders list container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredOrders.length === 0 ? (
            <p style={{ color: '#64748B', fontSize: '12px', textAlign: 'center', padding: '32px 0' }}>
              No {billsSubTab === 'sales' ? 'sales invoices' : 'proforma drafts'} found.
            </p>
          ) : (
            filteredOrders.map(o => {
              const { type, name } = decodeOrderUserId(o.userId);
              const isSelected = selectedBill && selectedBill.id === o.id;
              
              let cardBorder = isSelected ? '1px solid #D97706' : '1px solid #E2E8F0';
              let cardBg = isSelected ? '#FFFBEB' : '#FFFFFF';
              let badgeColor = billsSubTab === 'drafts' ? (type === 'estimate' ? '#F59E0B' : '#3B82F6') : '#10B981';
              
              return (
                <div 
                  key={o.id} 
                  onClick={() => setSelectedBill(o)}
                  style={{ 
                    padding: '12px 14px', 
                    borderRadius: '12px', 
                    border: cardBorder, 
                    background: cardBg, 
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: '0 1px 2px rgba(15,23,42,0.06)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A' }}>{name}</span>
                      <p style={{ margin: 0, fontSize: '10px', color: '#64748B' }}>ID: #{o.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                    <span style={{ fontSize: '10px', background: badgeColor + '15', color: badgeColor, padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {billsSubTab === 'drafts' ? (type === 'estimate' ? 'Estimate' : 'Challan') : o.status}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>₹{o.total}</span>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>{new Date(o.date).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Right Column: High Fidelity Receipt Preview */}
      <div style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {selectedBill ? (() => {
          const { type, name, phone } = decodeOrderUserId(selectedBill.userId);
          let receiptTitle = 'TAX INVOICE';
          if (type === 'estimate') receiptTitle = 'ESTIMATE / QUOTE';
          else if (type === 'challan') receiptTitle = 'DELIVERY CHALLAN';

          return (
            <div className="premium-glass" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              
              {/* Receipt Canvas */}
              <div id="receipt-print-area" style={{ background: '#fff', borderRadius: '8px', padding: '28px', color: '#000', fontFamily: 'monospace', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', margin: '0 auto', maxWidth: '360px', position: 'relative', border: '1px solid #E2E8F0' }}>
                
                {/* Decorative Jagged Edges */}
                <div style={{ position: 'absolute', top: -6, left: 0, right: 0, height: 6, background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #fff 4px, #fff 8px)', filter: 'drop-shadow(0 -2px 2px rgba(0,0,0,0.05))' }}></div>
                
                <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '14px', marginBottom: '14px' }}>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px' }}>{user.name}</h2>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: '500' }}>Ph: {user.phone}</p>
                  {user.gstin && <p style={{ margin: '2px 0 0 0', fontSize: '10px' }}>GSTIN: {user.gstin}</p>}
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>{new Date(selectedBill.date).toLocaleString()}</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', fontWeight: 'bold', border: '1px solid #000', display: 'inline-block', padding: '2px 8px' }}>
                    {receiptTitle} #{selectedBill.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                
                {(name || phone || selectedBill.customerGstin) && (
                  <div style={{ borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px', fontSize: '11px', lineHeight: '1.4' }}>
                    <p style={{ margin: '0 0 2px 0' }}><b>Customer:</b> {name || 'Walk-in Customer'}</p>
                    {phone && <p style={{ margin: '0 0 2px 0' }}><b>Mobile:</b> {phone}</p>}
                    {selectedBill.customerGstin && <p style={{ margin: '0 0 2px 0' }}><b>Cust GSTIN:</b> {selectedBill.customerGstin}</p>}
                    {selectedBill.customerAddress && <p style={{ margin: 0 }}><b>Address:</b> {selectedBill.customerAddress}</p>}
                  </div>
                )}
                
                <div style={{ minHeight: '120px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '10px' }}>
                    <span style={{ flex: 2 }}>ITEM</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>QTY</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>AMT</span>
                  </div>
                  {(selectedBill.items || []).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px', lineHeight: '1.3' }}>
                      <span style={{ flex: 2 }}>{item.name} {item.selectedVariant ? `(${item.selectedVariant})` : ''}</span>
                      <span style={{ flex: 1, textAlign: 'center' }}>{item.qty || 0}</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>₹{((item.price || 0) * (item.qty || 0)).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' }}>
                  <span>TOTAL DUE</span>
                  <span>₹{selectedBill.total}</span>
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '9px', borderTop: '1px solid #E2E8F0', paddingTop: '10px', color: '#64748B' }}>
                  {type === 'estimate' ? (
                    <p style={{ margin: 0, fontWeight: 'bold' }}>* PROFORMA ESTIMATE ONLY *</p>
                  ) : type === 'challan' ? (
                    <p style={{ margin: 0, fontWeight: 'bold' }}>* DELIVERY CHALLAN ONLY *</p>
                  ) : (
                    <p style={{ margin: 0, fontWeight: 'bold' }}>Thank you for your visit!</p>
                  )}
                  <p style={{ margin: '2px 0 0 0' }}>Powered by MyStore OS</p>
                </div>
                
                {/* Decorative Bottom Edge */}
                <div style={{ position: 'absolute', bottom: -6, left: 0, right: 0, height: 6, background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #fff 4px, #fff 8px)', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.05))' }}></div>
              </div>

              {/* Action Buttons for selected receipt */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
                <button 
                  onClick={() => window.print()} 
                  style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Printer size={16} /> Print Slip
                </button>

                {billsSubTab === 'drafts' && type === 'estimate' && (
                  <button 
                    onClick={() => handleConvertEstimateToBill(selectedBill)} 
                    style={{ background: '#D97706', color: '#FFFFFF', border: 'none', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <ArrowRight size={16} /> Convert to Active Bill
                  </button>
                )}

                {selectedBill.status === 'Pending' && (
                  <button 
                    onClick={() => { acceptOrder(selectedBill.id); setSelectedBill(null); }} 
                    style={{ background: '#10B981', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Check size={16} /> Accept Order
                  </button>
                )}
                
                {selectedBill.status === 'Accepted' && (
                  <button 
                    onClick={() => handleOpenReturnModal(selectedBill)} 
                    style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <CornerUpLeft size={16} /> Process Return
                  </button>
                )}
              </div>

            </div>
          );
        })() : (
          <div className="premium-glass" style={{ padding: '48px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '380px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
            <Receipt size={48} style={{ opacity: 0.15, marginBottom: '16px', color: '#FBBF24' }} />
            <h3 style={{ color: '#0F172A', margin: '0 0 6px 0' }}>No Invoice Selected</h3>
            <p style={{ color: '#64748B', fontSize: '13px', margin: 0, maxWidth: '280px', lineHeight: '1.4' }}>
              Click on any sales invoice or proforma draft on the left to see its high-fidelity thermal receipt preview and complete actions.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default DesktopBills;
