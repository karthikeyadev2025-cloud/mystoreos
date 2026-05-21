import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { FileSpreadsheet, Download, Store, LogOut, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { downloadTallyXML } from '../lib/TallyExporter';

const CADashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopOrders, setShopOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const allShops = await api.getAllShops();
        // For MVP, CAs can see all shops. 
        // In reality, this would be filtered by assigned shops.
        setShops(allShops);
      } catch (err) {
        toast.error("Failed to load shops");
      }
    };
    fetchShops();
  }, []);

  const handleSelectShop = async (shop) => {
    setSelectedShop(shop);
    setLoading(true);
    try {
      const orders = await api.getShopOrders(shop.id);
      setShopOrders(orders.filter(o => o.status?.toLowerCase() === 'completed'));
    } catch (err) {
      toast.error("Failed to load shop orders");
    } finally {
      setLoading(false);
    }
  };

  const handleExportXML = () => {
    if (!shopOrders.length) return toast.error("No orders to export");
    downloadTallyXML(shopOrders, selectedShop.name);
    toast.success("Tally XML Exported successfully!");
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', padding: '20px' }}>
      <ToastContainer theme="dark" position="top-center" />
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileSpreadsheet size={32} color="#10b981" />
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>CA Portal</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Welcome, {user.name} (Chartered Accountant)</p>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      {!selectedShop ? (
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={20} color="#3b82f6" /> Select a Client Shop
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {shops.map(shop => (
              <div 
                key={shop.id} 
                onClick={() => handleSelectShop(shop)}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', gap: '12px' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {shop.logo ? (
                    <img src={shop.logo} alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Store size={24} color="#94a3b8" />
                    </div>
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{shop.name}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{shop.phone}</p>
                  </div>
                </div>
                {shop.gstin && (
                  <div style={{ background: '#0f172a', padding: '8px', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1', border: '1px solid #2a2f3d' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>GSTIN:</span> {shop.gstin}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedShop(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '0 0 16px 0', fontSize: '14px', fontWeight: 'bold' }}>
            <ArrowLeft size={16} /> Back to Clients
          </button>
          
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>{selectedShop.name}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#cbd5e1' }}>
                  <p style={{ margin: 0 }}><strong>Phone:</strong> {selectedShop.phone}</p>
                  {selectedShop.gstin && <p style={{ margin: 0 }}><strong>GSTIN:</strong> {selectedShop.gstin}</p>}
                  {selectedShop.businessAddress && <p style={{ margin: 0 }}><strong>Address:</strong> {selectedShop.businessAddress}</p>}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleExportXML} disabled={loading || shopOrders.length === 0} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: (loading || shopOrders.length === 0) ? 0.6 : 1 }}>
                  <Download size={18} /> Export Tally XML
                </button>
              </div>
            </div>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 Total Sales Entries ({shopOrders.length})
            </h3>
            
            {loading ? (
              <p style={{ color: '#94a3b8' }}>Loading sales data...</p>
            ) : shopOrders.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No completed sales found for this client.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '12px', borderBottom: '1px solid #334155' }}>Date</th>
                      <th style={{ padding: '12px', borderBottom: '1px solid #334155' }}>Voucher ID</th>
                      <th style={{ padding: '12px', borderBottom: '1px solid #334155' }}>Customer / Party</th>
                      <th style={{ padding: '12px', borderBottom: '1px solid #334155', textAlign: 'right' }}>Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopOrders.map(order => {
                      let customerName = 'Cash Walk-in';
                      if (order.userId) {
                        const parts = order.userId.split(':');
                        if (parts.length >= 3 && parts[1]) {
                          customerName = parts[1] === 'Guest' ? 'Cash' : parts[1];
                        }
                      }
                      if (order.customerGstin) {
                        customerName += ` (GSTIN: ${order.customerGstin})`;
                      }
                      
                      return (
                        <tr key={order.id} style={{ borderBottom: '1px solid #2a2f3d' }}>
                          <td style={{ padding: '12px', color: '#cbd5e1' }}>{new Date(order.date).toLocaleDateString()}</td>
                          <td style={{ padding: '12px', color: '#cbd5e1' }}>#{order.id.substring(0, 8)}</td>
                          <td style={{ padding: '12px', color: '#cbd5e1' }}>{customerName}</td>
                          <td style={{ padding: '12px', color: '#10b981', fontWeight: 'bold', textAlign: 'right' }}>₹{order.total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
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
