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
  onCopyToBranch,
  flashSales = {},
  handleSetFlashSale,
  handleClearFlashSale,
  handleStockAdjust,
  salesData = {},
  shopCategory = 'general',
  onShowBarcodeManager,
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
    expired: { label: 'Expired', color: 'var(--c-danger)', bg: 'var(--c-danger-soft)', border: 'var(--c-danger-border)' },
    expiring7: { label: 'Exp. in 7d', color: 'var(--c-orange)', bg: 'var(--c-orange-soft)', border: 'var(--c-orange-soft)' },
    expiring30: { label: 'Exp. in 30d', color: 'var(--c-warning)', bg: 'var(--c-warning-soft)', border: 'var(--c-accent-border)' },
    lowstock: { label: 'Low Stock', color: 'var(--c-primary)', bg: 'var(--c-primary-soft)', border: 'var(--c-primary-border)' },
  };

  return (
    <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--c-line)', background: 'var(--c-surface)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--c-ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={22} color="var(--c-muted)" /> Shop Inventory & Catalog
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--c-muted)' }}>
            Manage your store shelf items, stock status, barcode labels, and bulk restock actions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--c-bg)', borderRadius: '10px', padding: '2px 12px', border: '1px solid var(--c-line)', width: '260px' }}>
            <Search size={16} color="var(--c-faint)" />
            <input
              type="text" placeholder="Search catalog..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', margin: 0, width: '100%', padding: '10px 0', color: 'var(--c-ink)', outline: 'none', fontSize: '13px' }}
            />
          </div>
          <button onClick={downloadTemplate} title="Download CSV template" style={{ background: 'var(--c-bg)', color: 'var(--c-ink-2)', border: '1px solid var(--c-line)', padding: '10px 14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Template
          </button>
          <button onClick={() => csvInputRef.current?.click()} style={{ background: 'var(--c-success-soft)', color: 'var(--c-success-strong)', border: '1px solid var(--c-success-soft)', padding: '10px 14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={14} /> Import CSV
          </button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={onCsvFileChange} style={{ display: 'none' }} />
          <button onClick={() => onShowBarcodeManager && onShowBarcodeManager()} style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-border)', padding: '10px 14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Barcodes <span style={{ background: 'var(--c-warning)', color: 'var(--c-warning-strong)', fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '6px', marginLeft: '2px' }}>PRO</span>
          </button>
          <button onClick={() => setShowAddProductModal(true)} style={{ background: 'var(--c-primary)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            style={{ padding: '4px 12px', borderRadius: '20px', border: `1px solid ${catFilter === cat ? 'var(--c-primary)' : 'var(--c-line)'}`, background: catFilter === cat ? 'var(--c-primary-soft)' : 'var(--c-bg)', color: catFilter === cat ? 'var(--c-primary)' : 'var(--c-muted)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Quick Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', color: 'var(--c-primary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--c-ink)' }}>{products.length}</h4>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-muted)' }}>Total Unique SKUs</p>
          </div>
        </div>
        <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--c-danger)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--c-ink)' }}>{products.filter(p => p.stock < (p.reorderLevel || 10)).length}</h4>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-muted)' }}>Low Stock Warnings</p>
          </div>
        </div>
        <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--c-warning)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--c-ink)' }}>
              {products.filter(p => checkExpiryStatus(p.expiryDate).status !== 'ok').length}
            </h4>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-muted)' }}>Near Expiry Items</p>
          </div>
        </div>
        <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--c-success)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>%</div>
          <div>
            <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--c-ink)' }}>
              {(() => {
                const priced = products.filter(p => p.costPrice > 0 && p.price > 0);
                if (!priced.length) return '—';
                const avg = priced.reduce((s, p) => s + (p.price - p.costPrice) / p.price * 100, 0) / priced.length;
                return Math.round(avg) + '%';
              })()}
            </h4>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-muted)' }}>Avg Margin</p>
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
          <div style={{ marginBottom: '24px', background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-soft)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--c-ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="var(--c-muted)" /> Inventory Alert Center
                <span style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger)', fontSize: '11px', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                  {alerts.length} action{alerts.length !== 1 ? 's' : ''}
                </span>
              </h3>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[['all', 'All', null], ['expired', `Expired (${alertCounts.expired})`, 'var(--c-danger)'], ['expiring7', `7d (${alertCounts.expiring7})`, 'var(--c-orange)'], ['expiring30', `30d (${alertCounts.expiring30})`, 'var(--c-warning)'], ['lowstock', `Stock (${alertCounts.lowstock})`, 'var(--c-primary)']].map(([val, label, color]) => (
                  <button
                    key={val}
                    onClick={() => setAlertFilter(val)}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${alertFilter === val ? (color || 'var(--c-ink-2)') : 'var(--c-line)'}`, background: alertFilter === val ? `${color || 'var(--c-ink-2)'}22` : 'var(--c-surface)', color: alertFilter === val ? (color || 'var(--c-ink-2)') : 'var(--c-muted)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
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
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: 'var(--c-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: cfg.color, fontWeight: 'bold' }}>
                        {p.alertType === 'expired' && `Expired: ${p.expiryDate}`}
                        {p.alertType === 'expiring7' && `Exp: ${p.expiryDate}`}
                        {p.alertType === 'expiring30' && `Exp: ${p.expiryDate}`}
                        {p.alertType === 'lowstock' && `Stock: ${p.stock} / Min: ${p.reorderLevel || 10}`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {p.alertType === 'lowstock' && (
                        <button onClick={() => handleOneClickRestock(p)} style={{ background: 'var(--c-warning)', border: 'none', color: '#000', padding: '5px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                          <RefreshCw size={10} />
                        </button>
                      )}
                      <button onClick={() => handleOpenEditModal(p)} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', color: 'var(--c-ink-2)', padding: '5px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
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
          <Package size={48} style={{ opacity: 0.2, marginBottom: '16px', color: 'var(--c-muted)' }} />
          <h3 style={{ color: 'var(--c-ink)', margin: '0 0 4px 0' }}>No Products Found</h3>
          <p style={{ color: 'var(--c-muted)', fontSize: '13px', margin: 0 }}>Add products to get started or clear your search query.</p>
        </div>
      ) : (
        /* Rectangular full-width product rows — denser scanning, all actions
           visible without horizontal cropping (Restock / Edit / Delete buttons
           previously wrapped to a second line on narrower cards). One card per
           row on desktop and mobile, just stacks naturally on small screens. */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
          {filteredProducts.map(p => {
            const expStatus = checkExpiryStatus(p.expiryDate);
            const isLowStock = p.stock < (p.reorderLevel || 10);
            const daysLeft = computeDaysLeft(p);
            return (
              <div key={p.id} className="premium-glass" style={{ background: 'var(--c-surface)', border: `1px solid ${flashSales[p.id] ? 'var(--c-danger-border)' : 'var(--c-line)'}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      {p.image && (
                        <img src={p.image} alt={p.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--c-line)' }} />
                      )}
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'var(--c-ink)' }}>{p.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '10px', background: 'var(--c-primary-soft)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-border)', fontWeight: 'bold', letterSpacing: '0.3px' }}>
                            {autoCategory(p.name)}
                          </span>
                          {p.batchNumber && (
                            <span style={{ fontSize: '10px', color: 'var(--c-muted)' }}>Batch: {p.batchNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--c-ink)' }}>
                      ₹{p.price}
                      {(() => { const s = UNIT_SUFFIX[p.unit || defaultUnitForCategory(shopCategory)]; return s ? <span style={{ fontSize: '10px', color: 'var(--c-muted)', fontWeight: '600' }}> / {s}</span> : null; })()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '12px 0' }}>
                    <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: isLowStock ? 'var(--c-danger-soft)' : 'var(--c-success-soft)', color: isLowStock ? 'var(--c-danger)' : 'var(--c-success)', border: '1px solid ' + (isLowStock ? 'var(--c-danger-border)' : 'var(--c-success-soft)'), fontWeight: 'bold' }}>
                      Stock: {p.stock || 0}
                    </span>
                    {p.reorderLevel !== undefined && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'var(--c-bg)', color: 'var(--c-muted)', border: '1px solid var(--c-line)' }}>
                        Min: {p.reorderLevel}
                      </span>
                    )}
                    {p.costPrice > 0 && p.price > 0 && (() => {
                      const margin = Math.round((p.price - p.costPrice) / p.price * 100);
                      const color = margin >= 20 ? 'var(--c-success)' : margin >= 10 ? 'var(--c-warning)' : 'var(--c-danger)';
                      const bg = margin >= 20 ? 'var(--c-success-soft)' : margin >= 10 ? 'var(--c-warning-soft)' : 'var(--c-danger-soft)';
                      const border = margin >= 20 ? 'var(--c-success-soft)' : margin >= 10 ? 'var(--c-accent-border)' : 'var(--c-danger-border)';
                      return (
                        <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: bg, color, border: `1px solid ${border}`, fontWeight: 'bold' }}>
                          Margin: {margin}%
                        </span>
                      );
                    })()}
                    {expStatus.status === 'expired' && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'var(--c-danger-soft)', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', fontWeight: 'bold' }}>
                        Expired ({p.expiryDate})
                      </span>
                    )}
                    {expStatus.status === 'near' && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'var(--c-warning-soft)', color: 'var(--c-warning)', border: '1px solid var(--c-accent-border)', fontWeight: 'bold' }}>
                        Exp Soon ({p.expiryDate})
                      </span>
                    )}
                    {daysLeft !== null && daysLeft < 2 && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'var(--c-danger-soft)', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', fontWeight: 'bold' }}>
                        Order TODAY
                      </span>
                    )}
                    {daysLeft !== null && daysLeft >= 2 && daysLeft < 7 && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'var(--c-warning-soft)', color: 'var(--c-warning)', border: '1px solid var(--c-accent-border)', fontWeight: 'bold' }}>
                        Reorder in {daysLeft}d
                      </span>
                    )}
                    {daysLeft !== null && daysLeft >= 7 && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'var(--c-success-soft)', color: 'var(--c-success)', border: '1px solid var(--c-success-soft)' }}>
                        Stock ~{daysLeft}d
                      </span>
                    )}
                  </div>
                  {p.variants && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {p.variants.split(',').map((v, vidx) => (
                        <span key={vidx} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'var(--c-line-soft)', color: 'var(--c-ink-2)', border: '1px solid var(--c-line)' }}>
                          {v.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.barcode && (
                    <div style={{ background: 'var(--c-surface)', padding: '6px', borderRadius: '8px', display: 'inline-block', marginTop: '4px', marginBottom: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
                      <Barcode value={p.barcode} height={20} width={1.1} fontSize={10} margin={0} displayValue={true} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid var(--c-line)', paddingTop: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleOneClickRestock(p)}
                    style={{ background: isLowStock ? 'var(--c-warning)' : 'var(--c-bg)', border: isLowStock ? 'none' : '1px solid var(--c-line)', color: isLowStock ? 'var(--c-surface)' : 'var(--c-ink-2)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={11} /> Restock
                  </button>
                  <PlanGate feature="flashSales" fallback={
                    <button title="Flash Sales require Pro Plan" style={{ background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-soft)', color: 'var(--c-muted)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Flame size={11} /> Sale 🔒
                    </button>
                  }>
                    {flashSales[p.id] ? (
                      <button onClick={() => handleClearFlashSale && handleClearFlashSale(p.id)} style={{ background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-border)', color: 'var(--c-danger)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        End Sale
                      </button>
                    ) : (
                      <button onClick={() => setSaleTarget(saleTarget === p.id ? null : p.id)} style={{ background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-soft)', color: 'var(--c-danger)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flame size={11} /> Sale
                      </button>
                    )}
                  </PlanGate>
                  <button onClick={() => { setAdjustTarget(adjustTarget === p.id ? null : p.id); setAdjustDelta(''); setAdjustReason('Correction'); }} style={{ background: 'var(--c-primary-soft)', border: '1px solid var(--c-primary-border)', color: 'var(--c-primary)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Adjust
                  </button>
                  {onCopyToBranch && (
                    <button
                      onClick={() => onCopyToBranch(p)}
                      title="Copy this product to another branch (stock = 0)"
                      style={{ background: 'var(--c-success-soft)', border: '1px solid var(--c-success-soft)', color: 'var(--c-success-strong)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      📋 Copy to branch
                    </button>
                  )}
                  <button onClick={() => handleOpenEditModal(p)} style={{ background: 'var(--c-primary-soft)', border: '1px solid var(--c-primary-border)', color: 'var(--c-primary)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteProduct(p.id)} style={{ background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-border)', color: 'var(--c-danger-strong)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>

                {/* Inline stock adjustment form */}
                {adjustTarget === p.id && (
                  <div style={{ marginTop: '10px', background: 'var(--c-primary-soft)', border: '1px solid var(--c-primary-border)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-primary)', fontWeight: 'bold' }}>Adjust Stock (current: {p.stock || 0})</p>
                    <div style={{ display: 'flex', gap: '8px', minWidth: 0 }}>
                      <input
                        type="number"
                        placeholder="±delta (e.g. -5 or +10)"
                        value={adjustDelta}
                        onChange={e => setAdjustDelta(e.target.value)}
                        style={{ flex: 1, minWidth: 0, padding: '5px 8px', background: 'var(--c-surface)', border: '1px solid var(--c-primary-border)', borderRadius: '6px', color: 'var(--c-ink)', fontSize: '12px', outline: 'none' }}
                      />
                      <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '5px 8px', background: 'var(--c-surface)', border: '1px solid var(--c-primary-border)', borderRadius: '6px', color: 'var(--c-ink)', fontSize: '12px', outline: 'none' }}>
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
                        style={{ flex: 1, background: 'var(--c-primary)', color: 'white', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Apply
                      </button>
                      <button onClick={() => setAdjustTarget(null)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--c-primary-border)', color: 'var(--c-primary)', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline flash sale setter */}
                {saleTarget === p.id && (
                  <div style={{ marginTop: '10px', background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-border)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-danger)', fontWeight: 'bold' }}>Set Flash Sale</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={salePct} onChange={e => setSalePct(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: 'var(--c-surface)', border: '1px solid var(--c-danger-border)', borderRadius: '6px', color: 'var(--c-ink)', fontSize: '12px', outline: 'none' }}>
                        {[5,10,15,20,25,30,40,50].map(d => <option key={d} value={d}>{d}% off</option>)}
                      </select>
                      <select value={saleDuration} onChange={e => setSaleDuration(e.target.value)} style={{ flex: 1, padding: '5px 8px', background: 'var(--c-surface)', border: '1px solid var(--c-danger-border)', borderRadius: '6px', color: 'var(--c-ink)', fontSize: '12px', outline: 'none' }}>
                        {[[1,'1 hour'],[2,'2 hours'],[4,'4 hours'],[6,'6 hours'],[12,'12 hours'],[24,'24 hours'],[48,'2 days']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => { handleSetFlashSale && handleSetFlashSale(p.id, salePct, parseInt(saleDuration)); setSaleTarget(null); }} style={{ flex: 1, background: 'var(--c-danger)', color: 'white', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Launch Sale
                      </button>
                      <button onClick={() => setSaleTarget(null)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--c-danger-border)', color: 'var(--c-danger)', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
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
