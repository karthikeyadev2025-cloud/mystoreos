import React from 'react';
import Barcode from 'react-barcode';
import { Package, Search, Plus, AlertCircle, Calendar, RefreshCw, Zap, Upload, Flame } from 'lucide-react';
import { PlanGate, LockedFeature } from './PlanGate';
import { UNIT_SUFFIX, defaultUnitForCategory } from '../lib/units';

const CSV_TEMPLATE = 'name,price,stock,reorderLevel,hsnCode,gstRate,batchNumber,expiryDate,variants\nRice 1kg,55,100,20,1006,5,BATCH01,2025-12-31,500g,1kg\nSugar 1kg,42,50,15,1701,5,,2026-06-30,';

const CATEGORY_PATTERNS = {
  Grains: /\b(rice|wheat|atta|flour|dal|pulses|lentil|poha|suji|semolina|oats|maize|corn|ragi|bajra)\b/i,
  Oils: /\b(oil|ghee|vanaspati|dalda|butter)\b/i,
  Dairy: /\b(milk|curd|paneer|cheese|lassi|cream|yogurt|dahi)\b/i,
  Snacks: /\b(biscuit|chips|namkeen|wafer|cracker|popcorn|mixture|murukku|kurkure)\b/i,
  Beverages: /\b(tea|coffee|juice|drink|water|soda|cola|energy|beverage|chai|horlicks|boost)\b/i,
  'Personal Care': /\b(soap|shampoo|toothpaste|toothbrush|lotion|cream|deo|deodorant|facewash|powder|hair|skin)\b/i,
  Cleaning: /\b(detergent|surf|ariel|vim|phenyl|broom|mop|cleaner|dishwash|floor|harpic|lizol)\b/i,
  Spices: /\b(masala|chili|pepper|turmeric|haldi|jeera|cumin|coriander|salt|sugar|garam|ajwain|mustard)\b/i,
};
const autoCategory = (name) => {
  for (const [cat, rx] of Object.entries(CATEGORY_PATTERNS)) {
    if (rx.test(name)) return cat;
  }
  return 'Other';
};

const DesktopInventory = ({
  products,
  setShowAddProductModal,
  checkExpiryStatus,
  handleOneClickRestock,
  handleOpenEditModal,
  handleDeleteProduct,
  handleBulkCsvImport,
  flashSales = {},
  handleSetFlashSale,
  handleClearFlashSale,
  handleStockAdjust,
  salesData = {},
  shopCategory = 'general',
}) => {
  const computeDaysLeft = (p) => {
    const sold = salesData[p.id] || 0;
    if (sold === 0 || (p.stock || 0) <= 0) return null;
    return Math.floor(p.stock / (sold / 30));
  };
  const [searchTerm, setSearchTerm] = React.useState('');
  const [alertFilter, setAlertFilter] = React.useState('all');
  const [catFilter, setCatFilter] = React.useState('All');
  const [saleTarget, setSaleTarget] = React.useState(null);
  const [salePct, setSalePct] = React.useState('20');
  const [saleDuration, setSaleDuration] = React.useState('6');
  const [adjustTarget, setAdjustTarget] = React.useState(null);
  const [adjustDelta, setAdjustDelta] = React.useState('');
  const [adjustReason, setAdjustReason] = React.useState('Correction');
  const csvInputRef = React.useRef(null);

  const parseCsv = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = line.split(',').map(v => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
    }).filter(row => row.name);
  };

  const onCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target.result);
      if (rows.length === 0) return;
      handleBulkCsvImport && handleBulkCsvImport(rows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'product_import_template.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const allCategories = React.useMemo(() => {
    const cats = new Set(products.map(p => autoCategory(p.name)));
    return ['All', ...Array.from(cats).sort()];
  }, [products]);

  const filteredProducts = products.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) ||
      (p.batchNumber && p.batchNumber.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    const matchCat = catFilter === 'All' || autoCategory(p.name) === catFilter;
    return matchSearch && matchCat;
  });

  // Build prioritised alerts list
  const alerts = React.useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(today.getDate() + 7);
    const in30 = new Date(today); in30.setDate(today.getDate() + 30);

    return products.reduce((acc, p) => {
      if (p.expiryDate) {
        const exp = new Date(p.expiryDate);
        if (exp < today) acc.push({ ...p, alertType: 'expired', priority: 0 });
        else if (exp <= in7) acc.push({ ...p, alertType: 'expiring7', priority: 1 });
        else if (exp <= in30) acc.push({ ...p, alertType: 'expiring30', priority: 2 });
      }
      if (p.stock < (p.reorderLevel || 10)) acc.push({ ...p, alertType: 'lowstock', priority: 3 });
      return acc;
    }, []).sort((a, b) => a.priority - b.priority);
  }, [products]);

  const alertCounts = React.useMemo(() => ({
    expired: alerts.filter(a => a.alertType === 'expired').length,
    expiring7: alerts.filter(a => a.alertType === 'expiring7').length,
    expiring30: alerts.filter(a => a.alertType === 'expiring30').length,
    lowstock: alerts.filter(a => a.alertType === 'lowstock').length,
  }), [alerts]);

  const visibleAlerts = alertFilter === 'all'
    ? alerts
    : alerts.filter(a => a.alertType === alertFilter);

  const alertConfig = {
    expired: { label: 'Expired', color: '#ef4444', bg: '#FEF2F2', border: '#FCA5A5' },
    expiring7: { label: 'Exp. in 7d', color: '#f97316', bg: '#FFF7ED', border: '#FFEDD5' },
    expiring30: { label: 'Exp. in 30d', color: '#f59e0b', bg: '#FEF3C7', border: '#FDE68A' },
    lowstock: { label: 'Low Stock', color: '#2563eb', bg: '#EFF6FF', border: '#BFDBFE' },
  };

  return (
    <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={22} color="#fbbf24" /> Shop Inventory & Catalog
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
            Manage your store shelf items, stock status, barcode labels, and bulk restock actions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#F8FAFC', borderRadius: '10px', padding: '2px 12px', border: '1px solid #E2E8F0', width: '260px' }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text" placeholder="Search catalog..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', margin: 0, width: '100%', padding: '10px 0', color: '#0F172A', outline: 'none', fontSize: '13px' }}
            />
          </div>
          <button onClick={downloadTemplate} title="Download CSV template" style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📋 Template
          </button>
          <button onClick={() => csvInputRef.current?.click()} style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '10px 14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={14} /> Import CSV
          </button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={onCsvFileChange} style={{ display: 'none' }} />
          <button onClick={() => setShowAddProductModal(true)} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            style={{ padding: '4px 12px', borderRadius: '20px', border: `1px solid ${catFilter === cat ? '#4F46E5' : '#E2E8F0'}`, background: catFilter === cat ? '#EEF2FF' : '#F8FAFC', color: catFilter === cat ? '#4F46E5' : '#64748B', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Quick Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: '#0F172A' }}>{products.length}</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Total Unique SKUs</p>
          </div>
        </div>
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: '#0F172A' }}>{products.filter(p => p.stock < (p.reorderLevel || 10)).length}</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Low Stock Warnings</p>
          </div>
        </div>
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: '#0F172A' }}>
              {products.filter(p => checkExpiryStatus(p.expiryDate).status !== 'ok').length}
            </h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Near Expiry Items</p>
          </div>
        </div>
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>%</div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: '#0F172A' }}>
              {(() => {
                const priced = products.filter(p => p.costPrice > 0 && p.price > 0);
                if (!priced.length) return '—';
                const avg = priced.reduce((s, p) => s + (p.price - p.costPrice) / p.price * 100, 0) / priced.length;
                return Math.round(avg) + '%';
              })()}
            </h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Avg Margin</p>
          </div>
        </div>
      </div>

      {/* ---- Smart Alerts Panel (Pro feature) ---- */}
      {alerts.length > 0 && (
        <PlanGate
          feature="batchExpiry"
          fallback={
            <div style={{ marginBottom: '24px' }}>
              <LockedFeature feature="batchExpiry" />
            </div>
          }
        >
          <div style={{ marginBottom: '24px', background: '#FFF5F5', border: '1px solid #FEE2E2', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="#f59e0b" /> Inventory Alert Center
                <span style={{ background: '#FEE2E2', color: '#ef4444', fontSize: '11px', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                  {alerts.length} action{alerts.length !== 1 ? 's' : ''}
                </span>
              </h3>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[['all', 'All', null], ['expired', `Expired (${alertCounts.expired})`, '#ef4444'], ['expiring7', `7d (${alertCounts.expiring7})`, '#f97316'], ['expiring30', `30d (${alertCounts.expiring30})`, '#f59e0b'], ['lowstock', `Stock (${alertCounts.lowstock})`, '#2563eb']].map(([val, label, color]) => (
                  <button
                    key={val}
                    onClick={() => setAlertFilter(val)}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${alertFilter === val ? (color || '#475569') : '#E2E8F0'}`, background: alertFilter === val ? `${color || '#475569'}22` : '#FFFFFF', color: alertFilter === val ? (color || '#475569') : '#64748b', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {visibleAlerts.map((p, idx) => {
                const cfg = alertConfig[p.alertType];
                return (
                  <div key={`${p.id}-${p.alertType}-${idx}`} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: cfg.color, fontWeight: 'bold' }}>
                        {p.alertType === 'expired' && `Expired: ${p.expiryDate}`}
                        {p.alertType === 'expiring7' && `Exp: ${p.expiryDate}`}
                        {p.alertType === 'expiring30' && `Exp: ${p.expiryDate}`}
                        {p.alertType === 'lowstock' && `Stock: ${p.stock} / Min: ${p.reorderLevel || 10}`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {p.alertType === 'lowstock' && (
                        <button onClick={() => handleOneClickRestock(p)} style={{ background: '#f59e0b', border: 'none', color: '#000', padding: '5px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                          <RefreshCw size={10} />
                        </button>
                      )}
                      <button onClick={() => handleOpenEditModal(p)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', padding: '5px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PlanGate>
      )}

      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Package size={48} style={{ opacity: 0.2, marginBottom: '16px', color: '#64748B' }} />
          <h3 style={{ color: '#0F172A', margin: '0 0 4px 0' }}>No Products Found</h3>
          <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Add products to get started or clear your search query.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredProducts.map(p => {
            const expStatus = checkExpiryStatus(p.expiryDate);
            const isLowStock = p.stock < (p.reorderLevel || 10);
            const daysLeft = computeDaysLeft(p);
            return (
              <div key={p.id} className="premium-glass" style={{ background: '#FFFFFF', border: `1px solid ${flashSales[p.id] ? '#FCA5A5' : '#E2E8F0'}`, borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s', boxShadow: '0 2px 10px rgba(0,0,0,0.01)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      {p.image && (
                        <img src={p.image} alt={p.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
                      )}
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0F172A' }}>{p.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '10px', background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', fontWeight: 'bold', letterSpacing: '0.3px' }}>
                            {autoCategory(p.name)}
                          </span>
                          {p.batchNumber && (
                            <span style={{ fontSize: '10px', color: '#64748B' }}>Batch: {p.batchNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                      ₹{p.price}
                      {(() => { const s = UNIT_SUFFIX[p.unit || defaultUnitForCategory(shopCategory)]; return s ? <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}> / {s}</span> : null; })()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '12px 0' }}>
                    <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: isLowStock ? '#FEF2F2' : '#ECFDF5', color: isLowStock ? '#ef4444' : '#10b981', border: '1px solid ' + (isLowStock ? '#FCA5A5' : '#A7F3D0'), fontWeight: 'bold' }}>
                      Stock: {p.stock || 0}
                    </span>
                    {p.reorderLevel !== undefined && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                        Min: {p.reorderLevel}
                      </span>
                    )}
                    {p.costPrice > 0 && p.price > 0 && (() => {
                      const margin = Math.round((p.price - p.costPrice) / p.price * 100);
                      const color = margin >= 20 ? '#10b981' : margin >= 10 ? '#f59e0b' : '#ef4444';
                      const bg = margin >= 20 ? '#ECFDF5' : margin >= 10 ? '#FEF3C7' : '#FEF2F2';
                      const border = margin >= 20 ? '#A7F3D0' : margin >= 10 ? '#FDE68A' : '#FCA5A5';
                      return (
                        <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: bg, color, border: `1px solid ${border}`, fontWeight: 'bold' }}>
                          Margin: {margin}%
                        </span>
                      );
                    })()}
                    {expStatus.status === 'expired' && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: '#FEF2F2', color: '#ef4444', border: '1px solid #FCA5A5', fontWeight: 'bold' }}>
                        Expired ({p.expiryDate})
                      </span>
                    )}
                    {expStatus.status === 'near' && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: '#FEF3C7', color: '#f59e0b', border: '1px solid #FDE68A', fontWeight: 'bold' }}>
                        Exp Soon ({p.expiryDate})
                      </span>
                    )}
                    {daysLeft !== null && daysLeft < 2 && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: '#FEF2F2', color: '#ef4444', border: '1px solid #FCA5A5', fontWeight: 'bold' }}>
                        🔴 Order TODAY
                      </span>
                    )}
                    {daysLeft !== null && daysLeft >= 2 && daysLeft < 7 && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: '#FEF3C7', color: '#f59e0b', border: '1px solid #FDE68A', fontWeight: 'bold' }}>
                        ⚠️ Reorder in {daysLeft}d
                      </span>
                    )}
                    {daysLeft !== null && daysLeft >= 7 && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: '#ECFDF5', color: '#10b981', border: '1px solid #A7F3D0' }}>
                        Stock ~{daysLeft}d
                      </span>
                    )}
                  </div>
                  {p.variants && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {p.variants.split(',').map((v, vidx) => (
                        <span key={vidx} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                          {v.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.barcode && (
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '8px', display: 'inline-block', marginTop: '4px', marginBottom: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
                      <Barcode value={p.barcode} height={20} width={1.1} fontSize={10} margin={0} displayValue={true} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleOneClickRestock(p)}
                    style={{ background: isLowStock ? '#F59E0B' : '#F8FAFC', border: isLowStock ? 'none' : '1px solid #E2E8F0', color: isLowStock ? '#FFFFFF' : '#475569', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={11} /> Restock
                  </button>
                  <PlanGate feature="flashSales" fallback={
                    <button title="Flash Sales require Pro Plan" style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#64748b', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Flame size={11} /> Sale 🔒
                    </button>
                  }>
                    {flashSales[p.id] ? (
                      <button onClick={() => handleClearFlashSale && handleClearFlashSale(p.id)} style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#ef4444', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🔥 End Sale
                      </button>
                    ) : (
                      <button onClick={() => setSaleTarget(saleTarget === p.id ? null : p.id)} style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#ef4444', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flame size={11} /> Sale
                      </button>
                    )}
                  </PlanGate>
                  <button onClick={() => { setAdjustTarget(adjustTarget === p.id ? null : p.id); setAdjustDelta(''); setAdjustReason('Correction'); }} style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Adjust
                  </button>
                  <button onClick={() => handleOpenEditModal(p)} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteProduct(p.id)} style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>

                {/* Inline stock adjustment form */}
                {adjustTarget === p.id && (
                  <div style={{ marginTop: '10px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: '#4F46E5', fontWeight: 'bold' }}>⚖️ Adjust Stock (current: {p.stock || 0})</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="number"
                        placeholder="±delta (e.g. -5 or +10)"
                        value={adjustDelta}
                        onChange={e => setAdjustDelta(e.target.value)}
                        style={{ flex: 1, padding: '5px 8px', background: '#FFFFFF', border: '1px solid #C7D2FE', borderRadius: '6px', color: '#0F172A', fontSize: '12px', outline: 'none' }}
                      />
                      <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: '#FFFFFF', border: '1px solid #C7D2FE', borderRadius: '6px', color: '#0F172A', fontSize: '12px', outline: 'none' }}>
                        {['Correction','Damaged','Expired','Sample','Theft','Incoming'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          const d = parseInt(adjustDelta);
                          if (!d || isNaN(d)) return;
                          handleStockAdjust && handleStockAdjust(p, d, adjustReason);
                          setAdjustTarget(null);
                        }}
                        style={{ flex: 1, background: '#4F46E5', color: 'white', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Apply
                      </button>
                      <button onClick={() => setAdjustTarget(null)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #C7D2FE', color: '#4F46E5', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline flash sale setter */}
                {saleTarget === p.id && (
                  <div style={{ marginTop: '10px', background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: '#EF4444', fontWeight: 'bold' }}>🔥 Set Flash Sale</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={salePct} onChange={e => setSalePct(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: '#FFFFFF', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#0F172A', fontSize: '12px', outline: 'none' }}>
                        {[5,10,15,20,25,30,40,50].map(d => <option key={d} value={d}>{d}% off</option>)}
                      </select>
                      <select value={saleDuration} onChange={e => setSaleDuration(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: '#FFFFFF', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#0F172A', fontSize: '12px', outline: 'none' }}>
                        {[[1,'1 hour'],[2,'2 hours'],[4,'4 hours'],[6,'6 hours'],[12,'12 hours'],[24,'24 hours'],[48,'2 days']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => { handleSetFlashSale && handleSetFlashSale(p.id, salePct, parseInt(saleDuration)); setSaleTarget(null); }} style={{ flex: 1, background: '#EF4444', color: 'white', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Launch Sale
                      </button>
                      <button onClick={() => setSaleTarget(null)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #FCA5A5', color: '#EF4444', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DesktopInventory;
