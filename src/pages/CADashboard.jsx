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
    safe(() => api.getAllShops(), []).then(data => {
      if (data) setShops(data);
      else toast.error('Failed to load shops');
    });
  }, []);

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

  const statCard = (label, value, color = '#10b981') => (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '16px', flex: 1, minWidth: '130px' }}>
      <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color }}>{value}</p>
    </div>
  );

  return (
    <div className="enterprise-wrapper" style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', padding: '20px', fontFamily: 'Outfit, sans-serif' }}>
      <ToastContainer theme="dark" position="top-center" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: '#1e293b', padding: '16px 20px', borderRadius: '14px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileSpreadsheet size={28} color="#10b981" />
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>CA Portal</h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Welcome, {user.name} · Chartered Accountant</p>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      {!selectedShop ? (
        <div>
          <h2 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1' }}>
            <Store size={18} color="#3b82f6" /> Select a Client Shop ({shops.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {shops.map(shop => (
              <div
                key={shop.id}
                onClick={() => handleSelectShop(shop)}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {shop.logo ? (
                    <img src={shop.logo} alt="Logo" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Store size={22} color="#94a3b8" />
                    </div>
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>{shop.name}</h3>
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{shop.phone}</p>
                  </div>
                </div>
                {shop.gstin && (
                  <div style={{ background: '#0f172a', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>GSTIN: </span>{shop.gstin}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedShop(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '0 0 16px 0', fontSize: '13px', fontWeight: 'bold' }}>
            <ArrowLeft size={15} /> Back to Clients
          </button>

          {/* Shop Header + Month Filter + Export Buttons */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800' }}>{selectedShop.name}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', color: '#cbd5e1' }}>
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
                    style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <select
                    value={filterYear}
                    onChange={e => setFilterYear(Number(e.target.value))}
                    style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleExportGSTR1} disabled={loading || filteredOrders.length === 0} style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: filteredOrders.length === 0 ? 0.5 : 1 }}>
                    <FileSpreadsheet size={14} /> GSTR-1 CSV
                  </button>
                  <button onClick={handleExportXML} disabled={loading || filteredOrders.length === 0} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: filteredOrders.length === 0 ? 0.5 : 1 }}>
                    <Download size={14} /> Tally XML
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* GST Summary Cards */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {statCard('Invoices', gstSummary.invoiceCount, '#fbbf24')}
            {statCard('Total Revenue', `₹${gstSummary.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, '#10b981')}
            {statCard('Taxable Value', `₹${gstSummary.totalTaxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, '#cbd5e1')}
            {statCard('CGST', `₹${gstSummary.totalCGST.toFixed(0)}`, '#f59e0b')}
            {statCard('SGST', `₹${gstSummary.totalSGST.toFixed(0)}`, '#f59e0b')}
            {statCard('IGST', `₹${gstSummary.totalIGST.toFixed(0)}`, '#ef4444')}
          </div>

          {/* Sales Table */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={16} color="#3b82f6" /> {MONTHS[filterMonth]} {filterYear} — {filteredOrders.length} Invoice{filteredOrders.length !== 1 ? 's' : ''}
            </h3>
            {loading ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>Loading sales data...</p>
            ) : filteredOrders.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No completed sales in this period.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #334155' }}>Date</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #334155' }}>Invoice #</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #334155' }}>Customer / Party</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #334155' }}>GST</th>
                      <th style={{ padding: '10px 12px', borderBottom: '1px solid #334155', textAlign: 'right' }}>Total</th>
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
                        <tr key={order.id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{new Date(order.date || order.createdAt).toLocaleDateString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>#{order.id.slice(0, 8).toUpperCase()}</td>
                          <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                            {customerName}
                            {order.customerGstin && <span style={{ display: 'block', fontSize: '10px', color: '#10b981' }}>{order.customerGstin}</span>}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#f59e0b', fontSize: '11px' }}>
                            {gstRate > 0 ? `${gstRate}% · ₹${gstAmt.toFixed(0)}` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 'bold', textAlign: 'right' }}>₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#0f172a' }}>
                      <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 'bold', color: '#cbd5e1' }}>Period Total</td>
                      <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: '800', textAlign: 'right', fontSize: '14px' }}>
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
