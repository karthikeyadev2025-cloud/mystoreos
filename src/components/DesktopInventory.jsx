import React from 'react';
import Barcode from 'react-barcode';
import { Package, Search, Plus, AlertCircle, Calendar, RefreshCw } from 'lucide-react';

const DesktopInventory = ({
  products,
  setShowAddProductModal,
  checkExpiryStatus,
  handleOneClickRestock,
  handleOpenEditModal,
  handleDeleteProduct
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.batchNumber && p.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={22} color="#fbbf24" /> Shop Inventory & Catalog
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Manage your store shelf items, stock status, barcode labels, and bulk restock actions.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#0f172a', borderRadius: '10px', padding: '2px 12px', border: '1px solid #334155', width: '260px' }}>
            <Search size={16} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search catalog..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', margin: 0, width: '100%', padding: '10px 0', color: 'white', outline: 'none', fontSize: '13px' }} 
            />
          </div>

          <button onClick={() => setShowAddProductModal(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: 'white' }}>{products.length}</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Total Unique SKUs</p>
          </div>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: 'white' }}>{products.filter(p => p.stock < (p.reorderLevel || 10)).length}</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Low Stock Warnings</p>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: 'white' }}>
              {products.filter(p => checkExpiryStatus(p.expiryDate).status !== 'ok').length}
            </h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Near Expiry Items</p>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Package size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <h3 style={{ color: '#fff', margin: '0 0 4px 0' }}>No Products Found</h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Add products to get started or clear your search query.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredProducts.map(p => {
            const expStatus = checkExpiryStatus(p.expiryDate);
            const isLowStock = p.stock < (p.reorderLevel || 10);
            
            return (
              <div key={p.id} className="premium-glass" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'white' }}>{p.name}</h3>
                      {p.batchNumber && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Batch: {p.batchNumber}</p>
                      )}
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#fbbf24' }}>₹{p.price}</span>
                  </div>

                  {/* Stock chips & warnings */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '12px 0' }}>
                    <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: isLowStock ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: isLowStock ? '#ef4444' : '#10b981', border: '1px solid ' + (isLowStock ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'), fontWeight: 'bold' }}>
                      Stock: {p.stock || 0}
                    </span>
                    {p.reorderLevel !== undefined && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.04)' }}>
                        Min: {p.reorderLevel}
                      </span>
                    )}
                    {expStatus.status === 'expired' && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 'bold' }}>
                        Expired ({p.expiryDate})
                      </span>
                    )}
                    {expStatus.status === 'near' && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 'bold' }}>
                        Exp Soon ({p.expiryDate})
                      </span>
                    )}
                  </div>

                  {/* Variants */}
                  {p.variants && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {p.variants.split(',').map((v, vidx) => (
                        <span key={vidx} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.02)' }}>
                          {v.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Barcode representation */}
                  {p.barcode && (
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '8px', display: 'inline-block', marginTop: '4px', marginBottom: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
                      <Barcode value={p.barcode} height={20} width={1.1} fontSize={10} margin={0} displayValue={true} />
                    </div>
                  )}
                </div>

                {/* Action panel */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '12px' }}>
                  <button 
                    onClick={() => handleOneClickRestock(p)} 
                    style={{ 
                      background: isLowStock ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.03)', 
                      border: isLowStock ? 'none' : '1px solid rgba(255,255,255,0.1)', 
                      color: isLowStock ? '#000' : '#fff', 
                      padding: '6px 10px', 
                      borderRadius: '6px', 
                      fontSize: '11px', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: isLowStock ? '0 4px 12px rgba(245,158,11,0.2)' : 'none'
                    }}
                  >
                    <RefreshCw size={11} /> {isLowStock ? 'Restock' : 'Restock'}
                  </button>
                  <button 
                    onClick={() => handleOpenEditModal(p)} 
                    style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(p.id)} 
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DesktopInventory;
