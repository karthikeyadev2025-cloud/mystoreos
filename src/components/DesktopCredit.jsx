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
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.03))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#ef4444', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Supplier Payables</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '28px', color: 'white', fontWeight: '800' }}>₹{payable}</h3>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={22} />
            </div>
          </div>
          <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Amount you owe to FMCG Distributors and wholesale suppliers.
          </p>
        </div>

        {/* Receivable Summary Box */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.25)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.03))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#10b981', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Customer Receivables</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '28px', color: 'white', fontWeight: '800' }}>₹{activeCustomerOutstanding}</h3>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownLeft size={22} />
            </div>
          </div>
          <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Outstanding ledger balance you need to collect from shoppers.
          </p>
        </div>

        {/* Dynamic Segment Toggle */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>Choose Active Ledger</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => setCreditTabSub('payable')}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 'bold',
                background: creditTabSub === 'payable' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: creditTabSub === 'payable' ? '#ef4444' : '#94a3b8',
                border: creditTabSub === 'payable' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
              }}
            >
              💸 View Supplier Payables
            </button>
            <button 
              onClick={() => setCreditTabSub('receivable')}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 'bold',
                background: creditTabSub === 'receivable' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: creditTabSub === 'receivable' ? '#10b981' : '#94a3b8',
                border: creditTabSub === 'receivable' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
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
          <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white' }}>Supplier Accounts Ledger</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>List of credit logs from FMCG Distributors.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#0f172a', borderRadius: '8px', padding: '0 10px', border: '1px solid #334155' }}>
                <Search size={14} color="#94a3b8" />
                <input 
                  type="text" 
                  placeholder="Filter supplier..." 
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  style={{ background: 'transparent', border: 'none', padding: '8px 0', color: 'white', outline: 'none', fontSize: '12px', width: '120px' }} 
                />
              </div>
            </div>

            {filteredCredits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <AlertCircle size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>No supplier credit balances active.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredCredits.map(c => (
                  <div key={c.id} className="premium-glass" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>{c.distName || 'Distributor'}</span>
                      <span style={{ fontSize: '11px', background: c.paid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: c.paid ? '#10b981' : '#ef4444', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                        {c.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '14px' }}>
                      <span>Invoice Ref: #{c.id.substring(0, 8).toUpperCase()}</span>
                      <span>Logged: {new Date(c.date).toLocaleDateString()}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#fbbf24' }}>₹{c.amount}</span>
                      {!c.paid && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => {
                              if (!upiId) return toast.error('No UPI ID set. Go to Settings.');
                              window.open(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&am=${c.amount}&cu=INR`, '_blank');
                            }} 
                            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Pay UPI
                          </button>
                          <button 
                            onClick={() => handleSettleSupplierCredit(c.id)} 
                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
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
            <div className="premium-glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="#10b981" /> Log Customer Purchase on Credit / Debt
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input 
                  type="text" value={custCreditName} onChange={e => setCustCreditName(e.target.value)} 
                  placeholder="Customer Name" 
                  style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} 
                />
                <input 
                  type="tel" value={custCreditPhone} onChange={e => setCustCreditPhone(e.target.value)} 
                  placeholder="Mobile Number (Optional)" 
                  style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} 
                />
              </div>

              <input 
                type="text" value={custCreditDesc} onChange={e => setCustCreditDesc(e.target.value)} 
                placeholder="Reason / Purchase details (e.g. Milk packet, groceries)" 
                style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', marginBottom: '12px' }} 
              />

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="number" value={custCreditAmount} onChange={e => setCustCreditAmount(e.target.value)} 
                  placeholder="Debit Amount (₹)" 
                  style={{ flex: 1, padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} 
                />
                <button onClick={handleAddCustomerCredit} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={14} /> Log Debt
                </button>
              </div>
            </div>

            {/* Shopper Ledger */}
            <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white' }}>Shopper Credit Ledger</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Log of pending shopper collections.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#0f172a', borderRadius: '8px', padding: '0 10px', border: '1px solid #334155' }}>
                  <Search size={14} color="#94a3b8" />
                  <input 
                    type="text" 
                    placeholder="Search shopper..." 
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', padding: '8px 0', color: 'white', outline: 'none', fontSize: '12px', width: '120px' }} 
                  />
                </div>
              </div>

              {filteredCustomerCredits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <CheckCircle size={36} style={{ opacity: 0.2, marginBottom: '12px', color: '#10b981' }} />
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
                      <div key={c.id} className="premium-glass" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>{custName}</span>
                            {custPhone && <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Ph: {custPhone}</p>}
                          </div>
                          <span style={{ fontSize: '11px', background: c.paid ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: c.paid ? '#10b981' : '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                            {c.paid ? 'Settled' : 'Outstanding'}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '12px', background: '#0f172a', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                          <b>Details:</b> {custDesc}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
                          <span>Logged: {new Date(c.date).toLocaleDateString()}</span>
                          <span>Ref: #{c.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '800', color: '#fbbf24' }}>₹{c.amount}</span>
                          {!c.paid && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <PlanGate feature="whatsappShare" fallback={
                                <button 
                                  title="WhatsApp reminder requires Pro Plan"
                                  disabled
                                  style={{ background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'not-allowed', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
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
                                style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
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
