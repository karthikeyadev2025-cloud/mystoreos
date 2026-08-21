import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { FileSpreadsheet, Download, Store, LogOut, ArrowLeft, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { downloadTallyXML } from '../lib/TallyExporter';
import { downloadGSTR1CSV, summarizeGST } from '../lib/gstrExport';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const safe = async (fn, def = null) => { try { return await fn(); } catch { return def; } };

const CADashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopOrders, setShopOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  useEffect(() => {
    if (!user?.id) return;
    safe(() => api.getMyClients(user.id), []).then(data => {
      if (data) setShops(data);
      else toast.error('Failed to load clients');
    });
  }, [user?.id]);

  const handleSelectShop = async (shop) => {
    setSelectedShop(shop);
    setLoading(true);
    const orders = await safe(() => api.getShopOrders(shop.id), []);
    if (orders) {
      setShopOrders(orders.filter(o => ['Completed', 'completed', 'Accepted', 'accepted'].includes(o.status)));
    } else {
      toast.error('Failed to load shop orders');
    }
    setLoading(false);
  };

  // Filter orders to the selected month/year
  const filteredOrders = useMemo(() => {
    return shopOrders.filter(o => {
      const d = new Date(o.date || o.createdAt);
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
    });
  }, [shopOrders, filterMonth, filterYear]);

  const gstSummary = useMemo(() => summarizeGST(filteredOrders, selectedShop), [filteredOrders, selectedShop]);
  const period = `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}`;

  const handleExportXML = () => {
    if (!filteredOrders.length) return toast.error('No orders in this period');
    downloadTallyXML(filteredOrders, selectedShop.name);
    toast.success('Tally XML exported!');
  };

  const handleExportGSTR1 = () => {
    if (!filteredOrders.length) return toast.error('No orders in this period');
    downloadGSTR1CSV(filteredOrders, selectedShop, period);
    toast.success('GSTR-1 CSV exported!');
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const statCard = (label, value, color = 'var(--c-success)') => (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '16px', flex: 1, minWidth: '130px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: 'var(--c-ink-2)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color }}>{value}</p>
    </div>
  );

  return (
    <div className="enterprise-wrapper" style={{ minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-ink)', padding: '20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <ToastContainer theme="light" position="top-center" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'var(--c-surface)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--c-line)', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileSpreadsheet size={28} color="var(--c-muted)" />
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--c-ink)' }}>CA Portal</h1>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-ink-2)' }}>Welcome, {user.name} · Chartered Accountant</p>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--c-danger)', color: 'var(--c-danger)', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      {!selectedShop ? (
        <div>
          <h2 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--c-ink)' }}>
            <Store size={18} color="var(--c-muted)" /> Select a Client Shop ({shops.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {shops.length === 0 && (
              <div style={{ gridColumn: '1 / -1', background: 'var(--c-surface)', border: '1px dashed var(--c-line-strong)', borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
                <p style={{ color: 'var(--c-ink)', fontWeight: 700, margin: '0 0 6px' }}>No clients yet</p>
                <p style={{ color: 'var(--c-muted)', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                  Shops add you as their accountant from their own Settings using your mobile number.
                  Once a shop assigns you, their books will appear here.
                </p>
              </div>
            )}
            {shops.map(shop => (
              <div
                key={shop.id}
                onClick={() => handleSelectShop(shop)}
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.2s', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-info)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-line)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {shop.logo ? (
                    <img src={shop.logo} alt="Logo" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--c-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--c-line)' }}>
                      <Store size={22} color="var(--c-muted)" />
                    </div>
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--c-ink)' }}>{shop.name}</h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-muted)' }}>{shop.phone}</p>
                  </div>
                </div>
                {shop.gstin && (
                  <div style={{ background: 'var(--c-bg)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', color: 'var(--c-ink-2)', border: '1px solid var(--c-line)' }}>
                    <span style={{ color: 'var(--c-success-strong)', fontWeight: 'bold' }}>GSTIN: </span>{shop.gstin}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedShop(null)} style={{ background: 'transparent', border: 'none', color: 'var(--c-ink-2)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '0 0 16px 0', fontSize: '13px', fontWeight: 'bold' }}>
            <ArrowLeft size={15} /> Back to Clients
          </button>

          {/* Shop Header + Month Filter + Export Buttons */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: 'var(--c-ink)' }}>{selectedShop.name}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', color: 'var(--c-ink-2)' }}>
                  <p style={{ margin: 0 }}><b>Phone:</b> {selectedShop.phone}</p>
                  {selectedShop.gstin && <p style={{ margin: 0 }}><b>GSTIN:</b> {selectedShop.gstin}</p>}
                  {selectedShop.businessAddress && <p style={{ margin: 0 }}><b>Address:</b> {selectedShop.businessAddress}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                {/* Month/Year selector */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={filterMonth}
                    onChange={e => setFilterMonth(Number(e.target.value))}
                    style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', color: 'var(--c-ink)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <select
                    value={filterYear}
                    onChange={e => setFilterYear(Number(e.target.value))}
                    style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', color: 'var(--c-ink)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleExportGSTR1} disabled={loading || filteredOrders.length === 0} style={{ background: 'var(--c-primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: filteredOrders.length === 0 ? 0.5 : 1 }}>
                    <FileSpreadsheet size={14} /> GSTR-1 CSV
                  </button>
                  <button onClick={handleExportXML} disabled={loading || filteredOrders.length === 0} style={{ background: 'var(--c-success)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: filteredOrders.length === 0 ? 0.5 : 1 }}>
                    <Download size={14} /> Tally XML
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* GST Summary Cards */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {statCard('Invoices', gstSummary.invoiceCount, 'var(--c-warning-strong)')}
            {statCard('Total Revenue', `₹${gstSummary.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'var(--c-success-strong)')}
            {statCard('Taxable Value', `₹${gstSummary.totalTaxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'var(--c-ink)')}
            {statCard('CGST', `₹${gstSummary.totalCGST.toFixed(0)}`, 'var(--c-accent-hover)')}
            {statCard('SGST', `₹${gstSummary.totalSGST.toFixed(0)}`, 'var(--c-accent-hover)')}
            {statCard('IGST', `₹${gstSummary.totalIGST.toFixed(0)}`, 'var(--c-danger-strong)')}
          </div>

          {/* Sales Table */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--c-ink)' }}>
              <Receipt size={16} color="var(--c-muted)" /> {MONTHS[filterMonth]} {filterYear} — {filteredOrders.length} Invoice{filteredOrders.length !== 1 ? 's' : ''}
            </h3>
            {loading ? (
              <p style={{ color: 'var(--c-muted)', fontSize: '13px' }}>Loading sales data...</p>
            ) : filteredOrders.length === 0 ? (
              <p style={{ color: 'var(--c-muted)', fontSize: '13px' }}>No completed sales in this period.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-bg)', color: 'var(--c-ink-2)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-line)' }}>Date</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-line)' }}>Invoice #</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-line)' }}>Customer / Party</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-line)' }}>GST</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-line)', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => {
                      let customerName = order.customerName || 'Cash Walk-in';
                      if (!order.customerName && order.userId) {
                        const parts = (order.userId || '').split(':');
                        if (parts.length >= 2 && parts[1] && parts[1] !== 'Guest') customerName = parts[1];
                      }
                      const total = Number(order.total || order.totalAmount || 0);
                      const gstRate = Number(order.gstRate ?? 0);
                      const gstAmt = gstRate > 0 ? total - total / (1 + gstRate / 100) : 0;
                      return (
                        <tr key={order.id} style={{ borderBottom: '1px solid var(--c-line-soft)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--c-ink)' }}>{new Date(order.date || order.createdAt).toLocaleDateString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--c-ink-2)', fontFamily: 'monospace', fontSize: '11px' }}>#{order.id.slice(0, 8).toUpperCase()}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--c-ink)' }}>
                            {customerName}
                            {order.customerGstin && <span style={{ display: 'block', fontSize: '10px', color: 'var(--c-success-strong)' }}>{order.customerGstin}</span>}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--c-warning-strong)', fontSize: '11px' }}>
                            {gstRate > 0 ? `${gstRate}% · ₹${gstAmt.toFixed(0)}` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--c-success-strong)', fontWeight: 'bold', textAlign: 'right' }}>₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--c-bg)' }}>
                      <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--c-ink)' }}>Period Total</td>
                      <td style={{ padding: '10px 12px', color: 'var(--c-success-strong)', fontWeight: '800', textAlign: 'right', fontSize: '14px' }}>
                        ₹{gstSummary.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CADashboard;
