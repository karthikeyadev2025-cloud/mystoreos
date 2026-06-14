import React from 'react';
import { Search, Plus, Send, CheckCircle, ArrowDownLeft, ArrowUpRight, MessageSquare, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { PlanGate } from './PlanGate';

const DesktopCredit = ({
  credits,
  customerCredits,
  payable,
  creditTabSub,
  setCreditTabSub,
  custCreditName,
  setCustCreditName,
  custCreditPhone,
  setCustCreditPhone,
  custCreditDesc,
  setCustCreditDesc,
  custCreditAmount,
  setCustCreditAmount,
  handleAddCustomerCredit,
  handleSettleSupplierCredit,
  handleSettleCustomerCredit,
  sendCustomerCreditReminder,
  upiId,
  user
}) => {
  const [supplierSearch, setSupplierSearch] = React.useState('');
  const [customerSearch, setCustomerSearch] = React.useState('');

  const activeCustomerOutstanding = customerCredits.filter(c => !c.paid).reduce((sum, c) => sum + c.amount, 0);

  const filteredCredits = credits.filter(c => 
    (c.distName || 'Distributor').toLowerCase().includes(supplierSearch.toLowerCase()) ||
    c.id.includes(supplierSearch)
  );

  const filteredCustomerCredits = customerCredits.filter(c => {
    const parts = (c.desc || '').split(':');
    const custName = parts[1] || 'Customer';
    const custPhone = parts[2] || '';
    const custDesc = parts[3] || '';
    
    const searchString = (custName + custPhone + custDesc).toLowerCase();
    return searchString.includes(customerSearch.toLowerCase());
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: Totals & Sub-tab selectors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Payable Summary Box */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #FCA5A5', background: '#FEF2F2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#EF4444', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Supplier Payables</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '28px', color: '#991B1B', fontWeight: '800' }}>₹{payable}</h3>
            </div>
            <div style={{ background: '#FEE2E2', color: '#EF4444', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={22} />
            </div>
          </div>
          <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            Amount you owe to FMCG Distributors and wholesale suppliers.
          </p>
        </div>

        {/* Receivable Summary Box */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #A7F3D0', background: '#ECFDF5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#10B981', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Customer Receivables</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '28px', color: '#065F46', fontWeight: '800' }}>₹{activeCustomerOutstanding}</h3>
            </div>
            <div style={{ background: '#D1FAE5', color: '#10B981', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownLeft size={22} />
            </div>
          </div>
          <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            Outstanding ledger balance you need to collect from shoppers.
          </p>
        </div>

        {/* Dynamic Segment Toggle */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748B', fontWeight: 'bold' }}>Choose Active Ledger</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => setCreditTabSub('payable')}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 'bold',
                background: creditTabSub === 'payable' ? '#FEF2F2' : 'transparent',
                color: creditTabSub === 'payable' ? '#EF4444' : '#64748B',
                border: creditTabSub === 'payable' ? '1px solid #FCA5A5' : '1px solid transparent',
              }}
            >
              💸 View Supplier Payables
            </button>
            <button 
              onClick={() => setCreditTabSub('receivable')}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 'bold',
                background: creditTabSub === 'receivable' ? '#ECFDF5' : 'transparent',
                color: creditTabSub === 'receivable' ? '#10B981' : '#64748B',
                border: creditTabSub === 'receivable' ? '1px solid #A7F3D0' : '1px solid transparent',
              }}
            >
              🟢 View Customer Receivables
            </button>
          </div>
        </div>

      </div>

      {/* Right Column: Ledger Listing & Action Forms */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {creditTabSub === 'payable' ? (
          <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Supplier Accounts Ledger</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748B' }}>List of credit logs from FMCG Distributors.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#F8FAFC', borderRadius: '8px', padding: '0 10px', border: '1px solid #E2E8F0' }}>
                <Search size={14} color="#94A3B8" />
                <input 
                  type="text" 
                  placeholder="Filter supplier..." 
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  style={{ background: 'transparent', border: 'none', padding: '8px 0', color: '#0F172A', outline: 'none', fontSize: '12px', width: '120px' }} 
                />
              </div>
            </div>

            {filteredCredits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                <AlertCircle size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>No supplier credit balances active.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredCredits.map(c => (
                  <div key={c.id} className="premium-glass" style={{ padding: '16px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#0F172A' }}>{c.distName || 'Distributor'}</span>
                      <span style={{ fontSize: '11px', background: c.paid ? '#ECFDF5' : '#FEF2F2', color: c.paid ? '#10B981' : '#EF4444', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', border: `1px solid ${c.paid ? '#A7F3D0' : '#FCA5A5'}` }}>
                        {c.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginBottom: '14px' }}>
                      <span>Invoice Ref: #{c.id.substring(0, 8).toUpperCase()}</span>
                      <span>Logged: {new Date(c.date).toLocaleDateString()}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>₹{c.amount}</span>
                      {!c.paid && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => {
                              if (!upiId) return toast.error('No UPI ID set. Go to Settings.');
                              window.open(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&am=${c.amount}&cu=INR`, '_blank');
                            }} 
                            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Pay UPI
                          </button>
                          <button 
                            onClick={() => handleSettleSupplierCredit(c.id)} 
                            style={{ background: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Mark Settled
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Add New Customer Credit Form */}
            <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0F172A', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="#10B981" /> Log Customer Purchase on Credit / Debt
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input 
                  type="text" value={custCreditName} onChange={e => setCustCreditName(e.target.value)} 
                  placeholder="Customer Name" 
                  style={{ padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} 
                />
                <input 
                  type="tel" value={custCreditPhone} onChange={e => setCustCreditPhone(e.target.value)} 
                  placeholder="Mobile Number (Optional)" 
                  style={{ padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} 
                />
              </div>

              <input 
                type="text" value={custCreditDesc} onChange={e => setCustCreditDesc(e.target.value)} 
                placeholder="Reason / Purchase details (e.g. Milk packet, groceries)" 
                style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', marginBottom: '12px' }} 
              />

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="number" value={custCreditAmount} onChange={e => setCustCreditAmount(e.target.value)} 
                  placeholder="Debit Amount (₹)" 
                  style={{ flex: 1, padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} 
                />
                <button onClick={handleAddCustomerCredit} style={{ background: '#10B981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={14} /> Log Debt
                </button>
              </div>
            </div>

            {/* Shopper Ledger */}
            <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Shopper Credit Ledger</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748B' }}>Log of pending shopper collections.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#F8FAFC', borderRadius: '8px', padding: '0 10px', border: '1px solid #E2E8F0' }}>
                  <Search size={14} color="#94A3B8" />
                  <input 
                    type="text" 
                    placeholder="Search shopper..." 
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', padding: '8px 0', color: '#0F172A', outline: 'none', fontSize: '12px', width: '120px' }} 
                  />
                </div>
              </div>

              {filteredCustomerCredits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                  <CheckCircle size={36} style={{ opacity: 0.2, marginBottom: '12px', color: '#10B981' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Clear ledger. No shopper debt outstanding.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredCustomerCredits.map(c => {
                    const parts = (c.desc || '').split(':');
                    const custName = parts[1] || 'Shopper';
                    const custPhone = parts[2] || '';
                    const custDesc = parts[3] || 'Credit Purchase';
                    
                    return (
                      <div key={c.id} className="premium-glass" style={{ padding: '16px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#0F172A' }}>{custName}</span>
                            {custPhone && <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748B' }}>Ph: {custPhone}</p>}
                          </div>
                          <span style={{ fontSize: '11px', background: c.paid ? '#ECFDF5' : '#FFF7ED', color: c.paid ? '#10B981' : '#F59E0B', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', border: `1px solid ${c.paid ? '#A7F3D0' : '#FFEDD5'}` }}>
                            {c.paid ? 'Settled' : 'Outstanding'}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '12px', color: '#0F172A', marginBottom: '12px', background: '#FFFFFF', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          <b>Details:</b> {custDesc}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
                          <span>Logged: {new Date(c.date).toLocaleDateString()}</span>
                          <span>Ref: #{c.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>₹{c.amount}</span>
                          {!c.paid && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <PlanGate feature="whatsappShare" fallback={
                                <button 
                                  title="WhatsApp reminder requires Pro Plan"
                                  disabled
                                  style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <MessageSquare size={13} /> Remind 🔒
                                </button>
                              }>
                                <button 
                                  onClick={() => sendCustomerCreditReminder(c)} 
                                  style={{ background: '#25D366', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <MessageSquare size={13} /> WhatsApp Remind
                                </button>
                              </PlanGate>
                              <button 
                                onClick={() => handleSettleCustomerCredit(c.id)} 
                                style={{ background: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Settle Debt
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default DesktopCredit;
