import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { validateImageFile } from '../lib/fileValidation';
import { ALL_UNITS, UNIT_SUFFIX } from '../lib/units';
import { agingBuckets, dormantShops, revenueTrend } from '../lib/distributorInsights';
import { printInvoice } from '../lib/invoicePrint';
import { safe, mustSucceed } from '../lib/asyncHelpers';
import NotificationCenter from '../components/NotificationCenter';
import BarcodeManager from '../components/BarcodeManager';
import PushToggle from '../components/PushToggle';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useRealtimeTable } from '../hooks/useRealtimeTable';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getDistCaps, hasDistCap } from '../lib/features';
import {
  BarChart3,
  Building2,
  ShoppingBag,
  Layers,
  History,
  Bell,
  LogOut,
  Plus,
  Lock,
  Key,
  TrendingUp,
  Map,
  Settings,
  MoreHorizontal,
  Users,
  Copy,
  Share2
} from 'lucide-react';


// Mobile stock order card — its own component (rather than inline in a
// .map()) specifically so each card gets its own independent
// "expected dispatch date" input. Multiple pending orders can be on
// screen at once; a single shared date field would leak one order's
// chosen date into every other card.
// Was completely missing — a distributor supplying real stock to a
// real shop had no way to generate a proper invoice for that
// transaction at all, despite the shop side already having a full,
// working invoice system for its own customer sales. Reuses that
// exact same printInvoice() engine rather than building a second,
// separate invoicing system — same templates, same PDF/print
// behavior, just mapped the other way: the distributor is the
// issuer here, the shop is the "customer" receiving the goods.
// Standalone (not a component method) so both the mobile card and
// the desktop detail panel call the exact same logic.
// distributorCatalog is the distributor's own wholesaleProducts list
// (already loaded in the dashboard) — used to look up each ordered
// item's pack_size (jars-per-box), since stock_orders itself only
// ever stored a flat qty with no box/jar breakdown. Matches the
// client's real invoice format exactly: Jars (per box, a product
// spec) × Boxes (what was ordered) = Qty (total individual units
// actually billed), rate charged per individual unit.
function downloadStockOrderInvoice(o, distributor, distributorCatalog = []) {
  const catalogById = {};
  distributorCatalog.forEach(p => { catalogById[p.id] = p; });

  printInvoice('wholesale', {
    shopName: distributor?.name || 'Distributor',
    shopPhone: distributor?.phone || '',
    shopAddress: distributor?.businessAddress || '',
    shopGSTIN: distributor?.gstin || '',
    // Custom branding — only included if the distributor's plan
    // actually grants it AND they've set one; hasCap-equivalent check
    // happens at the UI layer (the logo upload section itself is
    // gated), so any logo value reaching here is already legitimate.
    logoUrl: distributor?.logo || '',
    billNo: `STK-${o.id?.toString().slice(-6) || Date.now().toString().slice(-6)}`,
    dateStr: new Date(o.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    modeTitle: 'Stock Supply Invoice',
    customerName: o.shopName || '',
    customerPhone: '',
    customerAddress: '',
    items: (o.items || []).map(item => {
      const product = catalogById[item.id];
      const packSize = product?.packSize || null;
      // When a product has a pack size set, the order's stored qty is
      // treated as "boxes ordered" (matching how a shop actually
      // orders this kind of product), and the real total quantity
      // billed is jars-per-box × boxes — exactly the client's
      // existing paper invoice math.
      const boxes = packSize ? (item.qty || 1) : null;
      const totalQty = packSize ? (packSize * (item.qty || 1)) : (item.qty || 1);
      return {
        // Real product code, HSN, and GST rate — was hardcoded blank/
        // zero regardless of the actual product, meaning invoices
        // never showed the distributor's own product codes and were
        // never GST-compliant for any item, ever.
        code: product?.sku || item.id || '',
        name: item.name,
        hsn: product?.hsnCode || '',
        jars: packSize,
        boxes,
        qty: totalQty,
        unit: item.unit ? (UNIT_SUFFIX[item.unit] || item.unit) : '',
        rate: item.price,
        gstPct: product?.gstRate || 0,
      };
    }),
    subtotal: o.total,
    discountAmount: 0,
    roundOff: 0,
    total: o.total,
    paymentMode: 'Credit (on account)',
    footerNote: 'Thank you for your business.',
    termsNote: 'Goods once supplied are governed by standard trade terms.',
  }, 'a4');
}

// Vyapar-style Party Ledger Statement generator — builds a chronological
// ledger statement of all invoices, payments, stock orders, and credit notes
// for a retail shop/party, and prints a formal A4 statement.
function downloadPartyStatement(shop, credits = [], stockOrders = [], distributor) {
  const shopCredits = credits.filter(c => c.toShopId === shop.id || c.shopId === shop.id);
  const shopOrders = stockOrders.filter(o => o.shopId === shop.id && o.status !== 'rejected');

  const txs = [];

  shopCredits.forEach(c => {
    const isCreditNote = Number(c.amount) < 0 || (c.desc || '').toLowerCase().includes('return') || (c.desc || '').toLowerCase().includes('credit note');
    if (isCreditNote) {
      txs.push({
        date: new Date(c.date || Date.now()).toLocaleDateString('en-IN'),
        rawDate: new Date(c.date || Date.now()).getTime(),
        refNo: `CN-${c.id?.toString().slice(-6) || 'RET'}`,
        type: 'Credit Note',
        description: c.desc || 'Sales Return / Credit Adjustment',
        debit: 0,
        credit: Math.abs(Number(c.amount)),
      });
    } else {
      txs.push({
        date: new Date(c.date || Date.now()).toLocaleDateString('en-IN'),
        rawDate: new Date(c.date || Date.now()).getTime(),
        refNo: `CRD-${c.id?.toString().slice(-6) || 'CR'}`,
        type: 'Invoice',
        description: c.desc || 'Wholesale Stock Credit Supply',
        debit: Number(c.amount),
        credit: 0,
      });
    }

    if (c.paidSoFar > 0) {
      txs.push({
        date: new Date(c.date || Date.now()).toLocaleDateString('en-IN'),
        rawDate: new Date(c.date || Date.now()).getTime() + 1,
        refNo: `PAY-${c.id?.toString().slice(-6) || 'PMT'}`,
        type: 'Payment',
        description: 'Payment Received / Credit Cleared',
        debit: 0,
        credit: Number(c.paidSoFar),
      });
    }
  });

  shopOrders.forEach(o => {
    txs.push({
      date: new Date(o.date || Date.now()).toLocaleDateString('en-IN'),
      rawDate: new Date(o.date || Date.now()).getTime(),
      refNo: `STK-${o.id?.toString().slice(-6) || 'ORD'}`,
      type: 'Stock Order',
      description: `Wholesale Order (${o.items?.length || 0} items)`,
      debit: Number(o.total || 0),
      credit: 0,
    });
  });

  let runningBalance = 0;
  let totalBilled = 0;
  let totalPaid = 0;

  const sortedTxs = txs.sort((a, b) => a.rawDate - b.rawDate).map(t => {
    runningBalance += (t.debit - t.credit);
    totalBilled += t.debit;
    totalPaid += t.credit;
    return { ...t, balance: runningBalance };
  });

  printInvoice('party_statement', {
    distributorName: distributor?.name || 'Distributor',
    distributorPhone: distributor?.phone || '',
    distributorAddress: distributor?.businessAddress || '',
    distributorGSTIN: distributor?.gstin || '',
    logoUrl: distributor?.logo || '',
    partyName: shop.name || 'Retailer',
    partyPhone: shop.phone || '',
    partyAddress: shop.address || '',
    statementDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    transactions: sortedTxs,
    totalBilled,
    totalPaid,
    closingBalance: runningBalance,
  }, 'a4');
}


// Real straight-line distance between two lat/long points (Haversine
// formula) — the Route Planner's own locked-tier description promises
// sorting "based on outstanding credit and shop distance," but until
// now there was no actual distance calculation anywhere, only credit/
// visit-recency priority. Returns null if either point is missing,
// so callers can gracefully fall back to priority-only sorting for
// shops that haven't set a location yet.
function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function StockOrderCard({ order: o, badge, selected, onToggleSelect, onAccept, onReject, onDispatch, distributor, shopPhone, distributorCatalog, onPostCredit }) {
  const [dateInput, setDateInput] = useState('');

  return (
    <div style={{ background: '#FFFFFF', border: selected ? '1px solid #4F46E5' : '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {o.status === 'accepted' && (
          <input type="checkbox" checked={selected} onChange={onToggleSelect} style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#0F172A' }}>{o.shopName}</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>{new Date(o.date).toLocaleDateString()} {new Date(o.date).toLocaleTimeString()}</p>
              {o.status === 'accepted' && o.expectedDispatchDate && (
                <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 700, marginTop: 3 }}>
                  🕓 Expected: {new Date(o.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </div>
              )}
              {o.status === 'dispatched' && o.dispatchedAt && (
                <div style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 700, marginTop: 3 }}>
                  📦 Dispatched {new Date(o.dispatchedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: '10px', background: badge.bg, color: badge.color,
                padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'capitalize'
              }}>{badge.label}</span>
              <h4 style={{ fontSize: '16px', margin: '4px 0 0 0', color: '#2563EB' }}>₹{o.total}</h4>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '8px 0', margin: '8px 0' }}>
            {o.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', margin: '4px 0' }}>
                <span>{item.name}</span>
                <span>x{item.qty} (₹{item.price * item.qty})</span>
              </div>
            ))}
          </div>

          {o.status === 'pending' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Expected dispatch date (optional)</label>
              <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => onAccept(dateInput)} style={{ flex: 1, background: '#16A34A', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                  Accept & Credit
                </button>
                <button onClick={onReject} style={{ flex: 1, background: '#DC2626', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                  Reject
                </button>
              </div>
            </div>
          )}

          {o.status === 'accepted' && (
            <button onClick={onDispatch} style={{ width: '100%', marginTop: 10, background: '#4F46E5', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
              📦 Mark as Dispatched
            </button>
          )}

          {/* Invoice — any order the distributor has actually committed
              to (accepted, dispatched, or delivered) can get a real
              invoice now; pending orders can't since they might still
              be rejected. */}
          {o.status !== 'pending' && (
            <button onClick={() => downloadStockOrderInvoice(o, distributor, distributorCatalog)} style={{ width: '100%', marginTop: 8, background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
              🧾 Download Invoice
            </button>
          )}

          {/* Van and counter sales post to the credit ledger
              automatically; stock orders did not, so a distributor had
              to re-type the amount by hand — easy to mistype, easy to
              forget entirely. Not automatic because stock_orders has no
              payment_mode, so we genuinely can't tell cash-on-delivery
              from credit; one tap with the right figure is the honest
              middle. */}
          {o.status === 'delivered' && o.shopId && (
            o.creditPostedId ? (
              <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#059669' }}>
                ✅ On credit ledger
              </div>
            ) : (
              <button onClick={() => onPostCredit && onPostCredit(o)}
                style={{ width: '100%', marginTop: 8, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                ₹ Add ₹{o.total} to credit ledger
              </button>
            )
          )}

          {/* WhatsApp order sharing — explicitly promised on the Basic
              tier pricing page as its own line item, distinct from
              Route Planner's "visiting for collection" message (which
              only ever covered a different scenario). Genuinely
              missing until now — shares a real summary of THIS
              specific order's items, total, and current status. */}
          {shopPhone && (
            <a href={`https://wa.me/91${shopPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
              `Hi ${o.shopName}, here's your order summary:\n\n` +
              o.items.map(i => `• ${i.name} x${i.qty} — ₹${i.price * i.qty}`).join('\n') +
              `\n\nTotal: ₹${o.total}\nStatus: ${badge.label}` +
              (o.expectedDispatchDate ? `\nExpected dispatch: ${new Date(o.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : '')
            )}`} target="_blank" rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: 8, background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', textDecoration: 'none', boxSizing: 'border-box' }}>
              💬 Share via WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const DistributorDashboard = () => {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const { isOnline, pendingCount } = useOfflineSync();
  const [activeTab, setActiveTab] = useState('dashboard');
  // Mobile bottom nav only had 5 of desktop's 8 tabs — Route Planner,
  // Advanced Analytics, and critically Settings had no way to be
  // reached on mobile at all (confirmed: zero other buttons anywhere
  // in the file reference these three tab ids). Same gap, same fix
  // already applied to the shop dashboard's mobile nav earlier
  // tonight — a "More" overflow sheet.
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [credits, setCredits] = useState([]);
  const [shops, setShops] = useState([]);
  const [distStaff, setDistStaff] = useState([]);
  const [apiKeyInfo, setApiKeyInfo] = useState(null);
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [shopCodeInput, setShopCodeInput] = useState('');
  const [shopLinkBusy, setShopLinkBusy] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [distCycle, setDistCycle] = useState('monthly');
  
  const [stockOrders, setStockOrders] = useState([]);
  const [wholesaleProducts, setWholesaleProducts] = useState([]);
  const [showBarcodeManager, setShowBarcodeManager] = useState(false);
  const [showBulkCustModal, setShowBulkCustModal] = useState(false);
  const [bulkCustText, setBulkCustText] = useState('');
  const [bulkCustBusy, setBulkCustBusy] = useState(false);

  const handleBulkCustomerCSV = async () => {
    if (!bulkCustText.trim()) return toast.error('Please paste CSV text or select a file');
    setBulkCustBusy(true);
    try {
      const lines = bulkCustText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) throw new Error('CSV is empty');

      let startIdx = 0;
      const headerLine = lines[0].toLowerCase();
      if (headerLine.includes('name') || headerLine.includes('phone') || headerLine.includes('shop')) {
        startIdx = 1;
      }

      const customers = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (!parts[0]) continue;
        customers.push({
          name: parts[0],
          phone: parts[1] || '',
          gstin: parts[2] || '',
          address: parts[3] || '',
          creditLimit: parseFloat(parts[4]) || 0,
        });
      }

      if (customers.length === 0) throw new Error('No valid customer records found in CSV');

      const count = await api.bulkAddDistributorCustomers(user.id, customers);
      toast.success(`Successfully imported ${count} customers/shops!`);
      setShowBulkCustModal(false);
      setBulkCustText('');
      loadData();
    } catch (e) {
      toast.error(e.message || 'CSV Import failed');
    } finally {
      setBulkCustBusy(false);
    }
  };

  const handleAssignDistributorBarcode = async (productId, barcode, format) => {
    try {
      await api.assignDistributorBarcode(productId, barcode, format);
      toast.success('Barcode assigned to product');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Failed to assign barcode');
    }
  };

  // Distributor business profile / GST settings
  const [profileForm, setProfileForm] = useState({ name: '', gstin: '', stateCode: '', businessAddress: '', upiId: '', latitude: null, longitude: null });
  // Custom branded reports/invoices — explicitly promised on the
  // Enterprise plan ("Custom branded reports") but had zero
  // implementation: no upload UI, and logoUrl was documented in the
  // invoice template's own comment but never actually rendered by any
  // template. Reuses the exact same proven mechanism already working
  // for shop logos — client-side resize/compress to a base64 data URL,
  // no storage bucket needed — rather than building new upload
  // infrastructure from scratch.
  const [logo, setLogo] = useState('');
  const [distBranches, setDistBranches] = useState([]);
  const [activeDeviceCount, setActiveDeviceCount] = useState(0);
  const [branchName, setBranchName] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchPassword, setBranchPassword] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  useEffect(() => {
    if (user) setProfileForm({
      name: user.name || '',
      gstin: user.gstin || '',
      stateCode: user.stateCode || '',
      businessAddress: user.businessAddress || '',
      upiId: user.upiId || '',
      latitude: user.latitude || null,
      longitude: user.longitude || null,
    });
    if (user) setLogo(user.logo || '');
  }, [user]);
  const handleDistLogoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) { toast.error(check.reason); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(400 / img.width, 400 / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        handleDistLogoChange(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  const handleDistLogoChange = async (base64) => {
    setLogo(base64);
    await mustSucceed(() => api.updateProfile(user.id, { logo: base64 }), 'Update logo');
    toast.success('Logo updated!');
  };
  const handleDistLogoRemove = async () => {
    setLogo('');
    await mustSucceed(() => api.updateProfile(user.id, { logo: '' }), 'Remove logo');
    toast.success('Logo removed');
  };

  const handleGrabDistributorLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation is not supported by your browser');
    toast.info('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setProfileForm(p => ({ ...p, latitude: position.coords.latitude, longitude: position.coords.longitude }));
        toast.success('Location captured — save your profile to keep it.');
      },
      () => toast.error('Could not get your location. Check location permissions.')
    );
  };
  const saveDistributorProfile = async () => {
    setProfileSaving(true);
    try {
      await api.updateProfile(user.id, {
        name: profileForm.name,
        gstin: profileForm.gstin,
        stateCode: profileForm.stateCode,
        businessAddress: profileForm.businessAddress,
        upiId: profileForm.upiId,
        latitude: profileForm.latitude,
        longitude: profileForm.longitude,
      });
      toast.success('Business profile saved');
    } catch (e) {
      toast.error('Could not save: ' + (e?.message || 'unknown error'));
    } finally {
      setProfileSaving(false);
    }
  };
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('');
  const [newProdPackSize, setNewProdPackSize] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdHsnCode, setNewProdHsnCode] = useState('');
  const [newProdGstRate, setNewProdGstRate] = useState('0');
  const [newProdImage, setNewProdImage] = useState('');
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // New Credit Form
  const [selectedShop, setSelectedShop] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Distributor subscription plan state
  const [distPlans, setDistPlans] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [shopSearch, setShopSearch] = useState('');
  const [shopSearchBusy, setShopSearchBusy] = useState(false);
  const [shopsTotal, setShopsTotal] = useState(0);
  const [showUpgradePlanModal, setShowUpgradePlanModal] = useState(false);
  const [sysSettings, setSysSettings] = useState({ razorpayKey: '' });

  // Responsive state & Widescreen helpers
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [selectedOrder, setSelectedOrder] = useState(null);
  // Dispatch scheduling — accept an order without implying same-day
  // shipment, then batch multiple accepted orders into one dispatch
  // once a delivery route is actually worth sending a vehicle for.
  const [dispatchDateInput, setDispatchDateInput] = useState('');
  const [selectedForDispatch, setSelectedForDispatch] = useState(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [visitedShops, setVisitedShops] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dist_visited') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (stockOrders && stockOrders.length > 0 && !selectedOrder) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOrder(stockOrders[0]);
    }
  }, [stockOrders, selectedOrder]);

  const getNotifications = () => {
    const list = [];
    
    // 1. New Wholesale Orders from Shopkeepers
    (stockOrders || []).forEach(so => {
      if (so.status === 'pending') {
        list.push({
          id: `wholesale_ord_${so.id}`,
          title: "New Wholesale Order",
          text: `Shop "${so.shopName}" requested restock supplies of ₹${so.total}`,
          type: 'wholesale',
          date: so.date,
          emoji: '⚡'
        });
      }
    });
    
    // 2. Credits Settled by Shopkeepers
    (credits || []).forEach(c => {
      if (c.paid) {
        list.push({
          id: `credit_clear_${c.id}`,
          title: "Credit Payment Cleared",
          text: `Shop "${c.shopName || 'Retailer'}" paid/settled ₹${c.amount} of credit balance!`,
          type: 'credit',
          date: c.date,
          emoji: '🤝'
        });
      } else {
        list.push({
          id: `credit_issued_${c.id}`,
          title: "Credit Outstanding",
          text: `Issued ₹${c.amount} credit ledger to "${c.shopName || 'Retailer'}"`,
          type: 'credit',
          date: c.date,
          emoji: '💸'
        });
      }
    });
    
    // Sort by date descending
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const loadData = useCallback(async () => {
    // Was eleven sequential awaits — each waiting for the previous to
    // finish, so eleven full round-trips in series before the dashboard
    // showed anything. On a mobile connection that's the difference
    // between a slow load and a load that feels broken. None of these
    // depend on each other, so they all run together now.
    //
    // getDistributorProducts(user.id) — the id was MISSING before.
    // Without it the query has no distributor_id filter, and the RLS
    // policy on distributor_products is `USING (true)` (deliberately,
    // so shops can browse catalogs). So this loaded EVERY product from
    // EVERY distributor on the platform into this distributor's own
    // catalog tab — competitors' products, prices and stock levels,
    // with no client-side ownership filter anywhere to hide them.
    const [
      creditsRes, shopsRes, ordersRes, productsRes, plansRes, pricingRes,
      staffRes, branchesRes, apiKeyRes, deviceRes, settingsRes, profileRes,
    ] = await Promise.all([
      safe(() => api.getDistCredits(user.id)),
      safe(() => api.getMyRetailShops(user.id)),
      safe(() => api.getDistributorOrders(user.id)),
      safe(() => api.getDistributorProducts(user.id)),
      safe(() => api.getDistributorSubscriptionPlans()),
      safe(() => api.getPricing()),
      safe(() => api.getShopStaff(user.id)),
      safe(() => api.getOwnedDistributorBranches(user.id)),
      safe(() => api.getDistributorApiKeyInfo(user.id)),
      safe(() => api.getActiveDeviceCount(user.id)),
      safe(() => api.getSettings()),
      safe(() => api.getProfile(user.id)),
    ]);

    if (profileRes && login && (profileRes.distributorPlanTier !== user.distributorPlanTier || profileRes.subscription !== user.subscription)) {
      login({ ...user, ...profileRes });
    }

    setCredits(creditsRes);
    setShops(shopsRes);
    setStockOrders(ordersRes);
    setWholesaleProducts(productsRes);
    setDistPlans(plansRes);
    setPricing(pricingRes);
    setDistStaff(staffRes);
    setDistBranches(branchesRes);
    setApiKeyInfo(apiKeyRes);
    setActiveDeviceCount(deviceRes || 0);
    setSysSettings(settingsRes);

    // safe() returns null on failure by design (it's for reads, and a
    // failed read shouldn't crash the dashboard). But that means a
    // network hiccup rendered "0 shops · ₹0 outstanding · no orders" —
    // visually identical to a genuinely empty account. A distributor
    // seeing that reasonably concludes their data is gone.
    //
    // These three are the core business data; if the essential ones
    // came back null the load genuinely failed, so say so and offer a
    // retry rather than quietly showing zeros.
    setLoadFailed(creditsRes === null && shopsRes === null && ordersRes === null);
    setDataLoaded(true);
  }, [user.id]);

  // Multi-device tracking — registers this browser/device as active
  // whenever the dashboard loads. deviceId is a random id generated
  // once and persisted in localStorage — identifies "this browser
  // profile," not the physical hardware, which is deliberately fuzzy
  // (see migration comment for why a hard limit isn't used here).
  useEffect(() => {
    if (!user?.id) return;
    let deviceId = localStorage.getItem('mystore_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('mystore_device_id', deviceId);
    }
    api.registerDeviceSession(user.id, deviceId);
  }, [user?.id]);

  const handleLinkShop = async () => {
    // Was completely unenforced — distCaps.maxShops only ever showed a
    // nag banner AFTER the limit was exceeded, never actually blocked
    // linking a new shop. A Basic-tier (₹999) distributor could link
    // unlimited shops for free, same as Enterprise (₹4999) — the
    // tiered pricing model was entirely undermined by this gap. Same
    // bug class as the Starter-tier bookings leak found earlier
    // tonight on the shop side.
    if (distCaps.maxShops !== -1 && shops.length >= distCaps.maxShops) {
      toast.error(`Your plan allows ${distCaps.maxShops} shops — you're already at that limit. Upgrade to link more.`);
      setShowUpgradePlanModal(true);
      return;
    }

    setShopLinkBusy(true);
    try {
      const res = await api.linkByPublicCode(user.id, 'distributor', shopCodeInput);
      setShopCodeInput('');
      setShops(await safe(() => api.getMyRetailShops(user.id)));
      toast.success(`Linked with shop ${res.name}`);
    } catch (ex) {
      toast.error(ex.message || 'Could not link.');
    } finally {
      setShopLinkBusy(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Debounced so typing doesn't fire a query per keystroke — at
  // thousands of linked shops the un-searched load is capped, so this
  // is the actual way a distributor finds one specific shop rather
  // than scrolling. Skips the very first mount: loadData() already
  // fetches the default list, so without this guard every page load
  // would fire a second, redundant fetch 350ms later.
  const shopSearchMounted = useRef(false);
  useEffect(() => {
    if (!shopSearchMounted.current) { shopSearchMounted.current = true; return; }
    const t = setTimeout(async () => {
      setShopSearchBusy(true);
      try {
        setShops(await safe(() => api.getMyRetailShops(user.id, { search: shopSearch })));
      } finally {
        setShopSearchBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [shopSearch, user.id]);

  useEffect(() => {
    (async () => setShopsTotal(await safe(() => api.getMyRetailShopsCount(user.id)) || 0))();
  }, [user.id, shops.length]);

  // Was completely unfiltered — every distributor's dashboard refetched
  // on ANY distributor's order changing anywhere on the platform, not
  // just their own. Not a data leak (loadData already correctly scopes
  // its own fetch to this distributor via getDistributorOrders), but
  // genuinely not "one to one": wasteful refetches and UI flicker for
  // events that have nothing to do with this session.
  useRealtimeTable({ table: 'stock_orders', filter: `distributor_id=eq.${user.id}`, onRefresh: loadData });
  useRealtimeTable({ table: 'credits', filter: `from_id=eq.${user.id}`, onRefresh: loadData });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGiveCredit = async () => {
    if(!selectedShop || !amount) return toast.error("Select shop and amount");
    await mustSucceed(() => api.addCredit(user.id, selectedShop, desc || 'FMCG Stock Supply', amount), 'Add credit');
    toast.success("Credit added to shop successfully!");
    setShowModal(false);
    setSelectedShop('');
    setDesc('');
    setAmount('');
    loadData();
  };

  const markPaid = async (creditId) => {
    await mustSucceed(() => api.markCreditPaid(creditId), 'Mark credit paid');
    toast.success("Payment Received & Cleared!");
    loadData();
  };

  // Real partial payment recording — was completely missing before
  // tonight. markPaid() above only ever supported "fully cleared, all
  // at once" — no way to record a shop paying down their balance in
  // installments, which is how this actually works in real
  // distributor/shop business.
  const [paymentInputs, setPaymentInputs] = useState({});
  const [recordingPayment, setRecordingPayment] = useState(null);
  const handleRecordPayment = async (creditId) => {
    const amount = paymentInputs[creditId];
    if (!amount || parseFloat(amount) <= 0) return toast.error('Enter a valid amount');
    // Was completely unvalidated against the actual outstanding
    // balance — a typo (an extra zero, for instance) would silently
    // record an overpayment with no warning, and that excess amount
    // has nowhere to go afterward (credits only track the original
    // amount, not a running balance that could reflect a credit).
    // Not a hard block — there can be legitimate reasons to round up
    // slightly — just a confirmation so an obvious mistake gets caught
    // before it's committed.
    const credit = pendingCredits.find(c => c.id === creditId);
    const outstanding = credit ? credit.amount - (credit.paidSoFar || 0) : null;
    if (outstanding != null && parseFloat(amount) > outstanding) {
      const proceed = window.confirm(`This is ₹${amount}, more than the ₹${outstanding} actually outstanding. Record it anyway?`);
      if (!proceed) return;
    }
    setRecordingPayment(creditId);
    try {
      await api.recordCreditPayment(creditId, amount);
      toast.success(`₹${amount} payment recorded`);
      setPaymentInputs(prev => ({ ...prev, [creditId]: '' }));
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not record payment');
    } finally {
      setRecordingPayment(null);
    }
  };

  // Was add-only — a distributor had no way to correct a price/stock
  // mistake or update it as prices actually change, ever, after first
  // publishing a product. editingProductId is null when adding a new
  // product, or the product's id when the same modal is reused to
  // edit an existing one.
  const [editingProductId, setEditingProductId] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState('billing');
  const [addingStaff, setAddingStaff] = useState(false);
  const handleAddDistStaff = async () => {
    if (!staffName.trim() || !/^\d{10}$/.test(staffPhone)) return toast.error('Enter a name and valid 10-digit phone number');
    setAddingStaff(true);
    try {
      const roleLabel = staffRole === 'billing' ? 'Billing Cashier' : staffRole === 'van_driver' ? 'Van Driver / Rep' : staffRole === 'inventory' ? 'Warehouse Manager' : staffRole === 'accountant' ? 'Accountant' : 'Branch Supervisor';
      await api.addStaff(user.id, staffPhone, '1234', `${staffName.trim()} [${roleLabel}]`);
      toast.success(`${staffName} added as ${roleLabel} — log in with PIN 1234`);
      setStaffName(''); setStaffPhone('');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not add staff');
    } finally {
      setAddingStaff(false);
    }
  };
  const handleRemoveDistStaff = async (staffId, name) => {
    if (!window.confirm(`Remove ${name} from your team? They will no longer be able to log in.`)) return;
    try {
      await api.deleteStaff(staffId);
      toast.success(`${name} removed`);
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not remove staff');
    }
  };

  // Multi-branch — Enterprise plan promise, genuinely missing until now.
  const handleCreateBranch = async () => {
    if (!branchName.trim() || !branchPhone || !branchPassword) return toast.error('Fill in branch name, phone, and password');
    setCreatingBranch(true);
    try {
      await api.createDistributorBranch({ ownerId: user.id, name: branchName, phone: branchPhone, password: branchPassword, address: branchAddress });
      toast.success(`Branch "${branchName}" created — they can log in with the phone and password you set.`);
      setBranchName(''); setBranchPhone(''); setBranchPassword(''); setBranchAddress('');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not create branch');
    } finally {
      setCreatingBranch(false);
    }
  };
  const handleDeleteBranch = async (branchId, name) => {
    if (!window.confirm(`Remove branch "${name}"? Its past orders and records stay intact, but it will no longer be able to log in.`)) return;
    try {
      await api.deleteDistributorBranch(branchId, user.id);
      toast.success(`Branch "${name}" removed`);
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not remove branch');
    }
  };
  const handleResetBranchPassword = async (branchId, name) => {
    const newPassword = window.prompt(`New password for "${name}" (min 4 characters):`);
    if (!newPassword) return;
    try {
      await api.setDistributorBranchPassword(branchId, user.id, newPassword);
      toast.success(`Password updated for ${name}`);
    } catch (e) {
      toast.error(e.message || 'Could not update password');
    }
  };

  const handleProdImageFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) { toast.error(check.reason); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(300 / img.width, 300 / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setNewProdImage(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const openEditProduct = (p) => {
    setEditingProductId(p.id);
    setNewProdName(p.name);
    setNewProdPrice(String(p.price));
    setNewProdStock(String(p.stock));
    setNewProdCategory(p.category || '');
    setNewProdUnit(p.unit || '');
    setNewProdPackSize(p.packSize ? String(p.packSize) : '');
    setNewProdSku(p.sku || '');
    setNewProdHsnCode(p.hsnCode || '');
    setNewProdGstRate(p.gstRate != null ? String(p.gstRate) : '0');
    setNewProdImage(p.image || '');
    setShowCatalogModal(true);
  };

  const handleAddWholesaleProduct = async () => {
    if (!newProdName || !newProdPrice || !newProdStock) return toast.error("Enter product name, price and stock");
    if (editingProductId) {
      await mustSucceed(() => api.updateDistributorProduct(editingProductId, {
        name: newProdName, price: newProdPrice, stock: newProdStock, category: newProdCategory, unit: newProdUnit, packSize: newProdPackSize,
        sku: newProdSku, hsnCode: newProdHsnCode, gstRate: newProdGstRate, image: newProdImage
      }), 'Update product');
      toast.success("Product updated!");
    } else {
      await mustSucceed(() => api.addDistributorProduct({
        distributorId: user.id,
        name: newProdName,
        price: newProdPrice,
        stock: newProdStock,
        category: newProdCategory,
        unit: newProdUnit,
        packSize: newProdPackSize,
        sku: newProdSku,
        hsnCode: newProdHsnCode,
        gstRate: newProdGstRate,
        image: newProdImage
      }), 'Publish product');
      toast.success("Product published to wholesale catalog!");
    }
    setNewProdName('');
    setNewProdPrice('');
    setNewProdStock('');
    setNewProdCategory('');
    setNewProdUnit('');
    setNewProdPackSize('');
    setNewProdSku('');
    setNewProdHsnCode('');
    setNewProdGstRate('0');
    setNewProdImage('');
    setEditingProductId(null);
    setShowCatalogModal(false);
    loadData();
  };

  const openAddProduct = () => {
    setEditingProductId(null);
    setNewProdName(''); setNewProdPrice(''); setNewProdStock(''); setNewProdCategory(''); setNewProdUnit(''); setNewProdPackSize('');
    setNewProdSku(''); setNewProdHsnCode(''); setNewProdGstRate('0'); setNewProdImage('');
    setShowCatalogModal(true);
  };
  const closeCatalogModal = () => {
    setShowCatalogModal(false);
    setEditingProductId(null);
    setNewProdImage('');
  };
  const handleGenerateApiKey = async () => {
    if (apiKeyInfo && !window.confirm('This replaces your current key — anything using the old one will stop working immediately. Continue?')) return;
    setGeneratingKey(true);
    try {
      const result = await api.generateDistributorApiKey();
      setNewlyGeneratedKey(result.apiKey);
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not generate API key');
    } finally {
      setGeneratingKey(false);
    }
  };
  const handleRevokeApiKey = async () => {
    if (!window.confirm('Revoke your API key? Anything using it will stop working immediately.')) return;
    try {
      await api.revokeDistributorApiKey(user.id);
      toast.success('API key revoked');
      setNewlyGeneratedKey(null);
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not revoke API key');
    }
  };

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportRows, setBulkImportRows] = useState([]);
  const [bulkImporting, setBulkImporting] = useState(false);

  // Smart CSV parser with automatic header recognition for Vyapar, Tally,
  // Marg ERP, Busy, Zoho Books, and Excel export files.
  const parseCsvText = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parseLine = (line) => {
      const fields = [];
      let cur = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { fields.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      fields.push(cur.trim());
      return fields;
    };

    let allRows = lines.map(parseLine);
    if (allRows.length === 0) return { rows: [], skippedCount: 0 };

    let nameIdx = -1, priceIdx = -1, stockIdx = -1, catIdx = -1;
    let unitIdx = -1, packIdx = -1, skuIdx = -1, hsnIdx = -1, gstIdx = -1;

    const firstRow = allRows[0];
    const isHeader = firstRow.some(cell => /name|item|product|price|rate|stock|qty|sku|code|hsn|gst/i.test(cell));

    if (isHeader) {
      firstRow.forEach((col, idx) => {
        const c = col.toLowerCase().trim();
        if (/name|item|product|description/i.test(c) && nameIdx === -1) nameIdx = idx;
        else if (/price|rate|wholesale|selling|mrp|cost/i.test(c) && priceIdx === -1) priceIdx = idx;
        else if (/stock|qty|quantity|count|available/i.test(c) && stockIdx === -1) stockIdx = idx;
        else if (/category|group|type/i.test(c) && catIdx === -1) catIdx = idx;
        else if (/pack size|packsize|box qty|jars/i.test(c) && packIdx === -1) packIdx = idx;
        else if (/unit|uom/i.test(c) && unitIdx === -1) unitIdx = idx;
        else if (/sku|code|item code|barcode/i.test(c) && skuIdx === -1) skuIdx = idx;
        else if (/hsn|hsncode|hsn_code|sac/i.test(c) && hsnIdx === -1) hsnIdx = idx;
        else if (/gst|tax|gst_rate|vat/i.test(c) && gstIdx === -1) gstIdx = idx;
      });
      allRows = allRows.slice(1);
    }

    if (nameIdx === -1) nameIdx = 0;
    if (priceIdx === -1) priceIdx = 1;
    if (stockIdx === -1) stockIdx = 2;
    if (catIdx === -1) catIdx = 3;
    if (unitIdx === -1) unitIdx = 4;
    if (packIdx === -1) packIdx = 5;
    if (skuIdx === -1) skuIdx = 6;
    if (hsnIdx === -1) hsnIdx = 7;
    if (gstIdx === -1) gstIdx = 8;

    const isValidPrice = (v) => v != null && v !== '' && !isNaN(parseFloat(v)) && parseFloat(v) >= 0;
    
    let skippedCount = 0;
    const parsedRows = [];

    allRows.forEach(r => {
      const name = r[nameIdx]?.trim();
      const price = r[priceIdx]?.trim();
      if (!name || !isValidPrice(price)) {
        skippedCount++;
        return;
      }

      parsedRows.push({
        name,
        price: parseFloat(price) || 0,
        stock: r[stockIdx] ? parseInt(r[stockIdx]) || 0 : 0,
        category: r[catIdx] || '',
        unit: r[unitIdx] || '',
        packSize: r[packIdx] ? parseInt(r[packIdx]) || null : null,
        sku: r[skuIdx] || '',
        hsnCode: r[hsnIdx] || '',
        gstRate: r[gstIdx] ? parseFloat(r[gstIdx]) || 0 : 0,
      });
    });

    return { rows: parsedRows, skippedCount };
  };

  const downloadSampleCsv = (type = 'standard') => {
    let content = '';
    let filename = 'mystoreos_catalog_import.csv';
    if (type === 'vyapar') {
      filename = 'vyapar_import_sample.csv';
      content = 'Item Name,Selling Price,Stock Qty,Category,Item Code,HSN,Tax Rate\n' +
        'Parle-G Biscuit 100g,120,50,Biscuits,SKU-101,1905,18\n' +
        'Frooti Mango Drink 120ml,150,30,Beverages,SKU-102,2202,12\n';
    } else if (type === 'tally') {
      filename = 'tally_import_sample.csv';
      content = 'Product Name,Wholesale Price,Available Stock,Group,SKU,HSN Code,GST %\n' +
        'Good Day Butter 50g,90,100,Biscuits,GD-50,1905,18\n' +
        'Thums Up Can 300ml,350,40,Soft Drinks,TU-300,2202,28\n';
    } else {
      filename = 'standard_catalog_template.csv';
      content = 'Name,Price,Stock,Category,Unit,PackSize,SKU,HSNCode,GSTRate\n' +
        'Parle-G Jar (24 Pkts),240,50,Biscuits,jar,24,269,1905,18\n' +
        'Maaza 1.2L Bottle,480,20,Beverages,case,6,270,2202,12\n';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const { rows, skippedCount } = parseCsvText(String(evt.target.result));
      if (rows.length === 0) return toast.error('No valid rows found. Expected columns: name, price, stock, category — price must be a positive number.');
      setBulkImportRows(rows);
      if (skippedCount > 0) toast.warn(`${skippedCount} row${skippedCount === 1 ? '' : 's'} skipped — missing or invalid price.`);
    };
    reader.readAsText(file);
  };

  const handleConfirmBulkImport = async () => {
    setBulkImporting(true);
    try {
      const count = await api.bulkAddDistributorProducts(user.id, bulkImportRows);
      toast.success(`${count} products imported to your catalog!`);
      setShowBulkImport(false);
      setBulkImportRows([]);
      loadData();
    } catch (e) {
      toast.error(e.message || 'Bulk import failed');
    } finally {
      setBulkImporting(false);
    }
  };

  const handleDeleteWholesaleProduct = async (productId) => {
    if (!window.confirm('Remove this product from your wholesale catalog? Shops will no longer be able to order it.')) return;
    await mustSucceed(() => api.deleteDistributorProduct(productId), 'Delete product');
    toast.success('Product removed from catalog');
    loadData();
  };

  // Auto-generated shareable product catalog — reuses the same
  // printInvoice mechanism as invoices, just with the 'catalog'
  // template registered in invoiceTemplates.js. Opens in a new tab
  // where the distributor can view, print, or save as PDF.
  const handleGenerateCatalog = () => {
    if (wholesaleProducts.length === 0) return toast.error('Add some products to your catalog first');
    printInvoice('catalog', {
      distributorName: user?.name || 'Distributor',
      distributorPhone: user?.phone || '',
      distributorAddress: user?.businessAddress || '',
      logoUrl: user?.logo || '',
      generatedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      products: wholesaleProducts,
    }, 'a4');
  };

  // Was `DST-${user.id.substring(0,6)}` — a string computed locally
  // that never matched the real public_code column in the database at
  // all. Two consequences, both real: (1) a shop trying to manually
  // enter this "code" into the existing, working linkByPublicCode flow
  // would always get "No shop or distributor found with that code",
  // since it matched nothing; (2) the shared link's destination
  // (fixed below) had no way to look this distributor up correctly
  // either way. user.publicCode is the actual value generated at
  // signup by gen_public_code('DST') and is what linkByPublicCode
  // already looks up against.
  const distCode = user?.publicCode || 'DST-OFFICIAL';
  // Was /shop?distributor=CODE — that page requires a shop/staff login
  // and has no code anywhere reading a distributor query param, so it
  // could never render anything for the ~10,000 shops this link is
  // actually meant to reach. Now points at the public catalog page,
  // reachable with no account at all.
  const publicCatalogUrl = `https://mystoreos.in/catalog/${distCode}`;

  const handleCopyPublicCatalogLink = () => {
    navigator.clipboard.writeText(publicCatalogUrl);
    toast.success(`Public Catalog Link copied! Share this link with retail shops: ${publicCatalogUrl}`);
  };

  const handleShareCatalogWhatsApp = async () => {
    if (wholesaleProducts.length === 0) return toast.error('Add some products to your catalog first');

    // BUG FOUND DURING AUDIT: this used to send a WhatsApp text message
    // promising "Browse Photos & Order Online" with a link to
    // /shop?distributor=CODE. That page does not exist for this purpose —
    // /shop is gated to role shop/staff (an anonymous WhatsApp recipient
    // is bounced to login), and even a logged-in shop opening it would
    // just see THEIR OWN dashboard: ShopDashboard has no code anywhere
    // that reads a `distributor` query param. The message advertised a
    // photo catalog that no click could ever reach.
    //
    // FIX: build the actual catalog PDF — the 'catalog' template already
    // includes product images — and share that FILE using the same
    // native file-share pattern already proven for shop invoices
    // (ShopDashboard, handleDownloadReceipt). This is a real document
    // reaching a real chat, not a broken promise of a webpage.
    try {
      const { buildInvoicePdfBlob } = await import('../lib/invoicePrint');
      const pdfBlob = await buildInvoicePdfBlob('catalog', {
        distributorName: user?.name || 'Distributor',
        distributorPhone: user?.phone || '',
        distributorAddress: user?.businessAddress || '',
        logoUrl: user?.logo || '',
        generatedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        products: wholesaleProducts,
      }, 'a4');
      const fileName = `${(user?.name || 'Catalog').replace(/[^a-zA-Z0-9]/g, '_')}_Catalog.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({ files: [pdfFile], title: fileName });
          return;
        } catch (shareErr) {
          if (shareErr?.name === 'AbortError') return; // user cancelled, not an error
        }
      }

      // Desktop / no file-share support: open the same PDF so it can be
      // saved and shared manually, rather than silently doing nothing.
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }, 60000);
      toast.info('Catalog opened — download and share it from there.');
    } catch (e) {
      toast.error(e.message || 'Could not generate the catalog');
    }
  };

  // One tap instead of re-typing the amount into the credit tab.
  const handlePostStockOrderCredit = async (o) => {
    try {
      await mustSucceed(() => api.postStockOrderToCredit(o.id, user.id), 'Add to credit ledger');
      toast.success(`₹${o.total} added to ${o.shopName}'s ledger`);
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not add to credit ledger');
    }
  };

  const handleUpdateStockOrder = async (orderId, status, expectedDate) => {
    await mustSucceed(() => api.updateStockOrderStatus(orderId, status, user.id, expectedDate || null), 'Update order status');
    toast.success(
      status === 'accepted' && expectedDate
        ? `Accepted — expected dispatch ${new Date(expectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
        : `Restock order marked as ${status}!`
    );
    setDispatchDateInput('');
    loadData();
  };

  // Bulk-dispatch every accepted order the distributor has ticked — the
  // real "route is full, send it all" action. One tap covers the whole
  // batch instead of clicking Dispatch per order. Also usable for a
  // single order (pass its id directly) from the detail panel's
  // 'Mark as Dispatched' button, so there's one code path for both.
  const handleDispatchSelected = async (singleOrderId) => {
    const ids = singleOrderId ? [singleOrderId] : [...selectedForDispatch];
    if (ids.length === 0) return;
    setDispatching(true);
    try {
      if (singleOrderId) {
        await api.updateStockOrderStatus(singleOrderId, 'dispatched', user.id);
      }
      const res = await api.dispatchStockOrders(ids);
      const n = res?.dispatched || ids.length;
      toast.success(`${n} stock order${n === 1 ? '' : 's'} marked as Dispatched!`);
      setSelectedForDispatch(new Set());
      loadData();
    } catch (e) {
      toast.error(e.message || 'Failed to dispatch selected orders');
    }
    setDispatching(false);
  };

  const toggleDispatchSelect = (orderId) => {
    setSelectedForDispatch(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  // Was a 3-way ternary (pending/accepted/else-red) that silently
  // treated a 'dispatched' order the same as 'rejected' — wrong colour,
  // wrong label. Proper lookup covering all four real states now.
  const STOCK_ORDER_BADGE = {
    pending:    { bg: '#FEF3C7', color: '#B45309', label: 'Pending' },
    accepted:   { bg: '#DCFCE7', color: '#15803D', label: 'Accepted' },
    dispatched: { bg: '#DBEAFE', color: '#1D4ED8', label: '📦 Dispatched' },
    delivered:  { bg: '#D1FAE5', color: '#047857', label: '✅ Delivered' },
    rejected:   { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
  };

  const handleDistSubscribe = async (plan) => {
    if (!plan) return;
    if (!sysSettings.razorpayKey) return toast.error("Payment gateway not configured yet.");
    const cycle = distCycle;
    const pr = pricing ? api.computePrice(pricing, plan.id, cycle) : null;
    const payPlanId = cycle === 'monthly' ? plan.id : `${plan.id}_${cycle}`;
    const payPrice = pr?.final || plan.price;
    let orderId = null;
    try {
      const orderData = await api.createRazorpayOrder(payPlanId, payPrice);
      orderId = orderData?.orderId;
    } catch (_e) { orderId = null; }
    if (!orderId) {
      return toast.error('Payment could not be started securely right now. Please try again shortly.');
    }
    const options = {
      key: sysSettings.razorpayKey,
      amount: (payPrice * 100).toString(),
      currency: "INR",
      name: "MyStore OS — Distributor",
      description: `${plan.name} ${cycle !== 'monthly' ? cycle : ''}`,
      order_id: orderId,
      handler: async (response) => {
        try {
          // Was safe()-wrapped — swallowed any signature-verification
          // failure, so the handler fell straight through to a success
          // toast regardless of whether the payment actually verified.
          await mustSucceed(() => api.verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId: payPlanId,
            userId: user.id,
          }), 'Verify payment');
          // Was calling api.updateProfile(user.id, { distributor_plan_tier,
          // subscription }) here — but distributor_plan_tier is a
          // protected billing column (see
          // 20260609_protect_subscription_columns.sql): a DB trigger
          // RAISES on any client attempt to change it directly, exactly
          // to prevent a distributor granting themselves a plan without
          // paying. That meant this line could NEVER succeed for a real
          // distributor — every real payment hit 'Not allowed to change
          // distributor plan' and fell into the catch below as "Upgrade
          // failed. Contact support," even though the money was already
          // charged and razorpay-verify-payment had already granted the
          // tier correctly server-side (with service-role, which the
          // trigger doesn't block). Fix: re-fetch the authoritative
          // profile the same way ShopDashboard's upgrade flow already
          // does, instead of trying to set the tier from the client.
          const updated = await safe(() => api.getUserById(user.id));
          if (updated) login(updated);
          toast.success(`Upgraded to ${plan.name}!`);
          setShowUpgradePlanModal(false);
          loadData();
        } catch (_e) {
          toast.error(`Upgrade failed. Contact support.`);
        }
      },
      prefill: { name: user.name, contact: user.phone || '' },
      theme: { color: "#4F46E5" }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const distCaps = getDistCaps(user);
  // Was treating any unpaid credit as fully outstanding, even after
  // partial payments — a shop that's paid ₹7,000 of a ₹10,000 credit
  // showed the full ₹10,000 still owed. Now correctly subtracts
  // whatever's already been paid (paidSoFar, from the new
  // credit_payments ledger) from each entry before summing.
  // Enterprise intelligence — computed from data already loaded, so
  // no extra queries and it works offline like the rest of the panel.
  const aging = agingBuckets(credits);
  const atRiskShops = dormantShops(shops, stockOrders);
  const trend = revenueTrend(stockOrders);

  const totalOutstanding = credits.filter(c => !c.paid).reduce((a, b) => a + (b.amount - (b.paidSoFar || 0)), 0);
  const totalReceived = credits.reduce((a, b) => a + (b.paidSoFar || (b.paid ? b.amount : 0)), 0);
  const pendingCredits = credits.filter(c => !c.paid);

  if (!isMobile) {
    const notifications = getNotifications();
    
    return (
      <div className="dashboard-wrapper-flex" style={{ background: '#F8FAFC', color: '#0F172A', minHeight: '100vh', width: '100%' }}>
        <ToastContainer theme="light" position="top-center" />

        {/* Desktop Sticky Left Sidebar */}
        <div className="desktop-glass-sidebar dark-sidebar" style={{ background: '#0F172A', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Logo & Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingLeft: '8px' }}>
            <div style={{ background: '#4F46E5', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#fff' }}>M</div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px', color: '#FFFFFF' }}>FMCG Supply</h2>
              <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 'bold' }}>DISTRIBUTOR CONSOLE</span>
            </div>
          </div>

          {/* User Profile */}
          <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Welcome back,</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFFFFF' }}>{user.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: isOnline ? '#16a34a' : '#d97706', marginTop: '4px', fontWeight: 'bold' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#16a34a' : '#d97706', display: 'inline-block' }}></span>
              {isOnline ? (pendingCount > 0 ? `${pendingCount} pending sync` : 'Online') : 'Offline mode'}
            </div>
          </div>

          {/* Sidebar Tabs Nav Menu */}
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>Menu Navigation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'shops', label: 'Retail Shops', icon: Building2 },
              { id: 'orders', label: 'Incoming Orders', icon: ShoppingBag, badge: stockOrders.filter(o => o.status === 'pending').length },
              { id: 'catalog', label: 'Wholesale Catalog', icon: Layers },
              { id: 'routeplanner', label: 'Route Planner', icon: Map, locked: !hasDistCap(user, 'routePlanner') },
              { id: 'analytics', label: 'Advanced Analytics', icon: TrendingUp, locked: !hasDistCap(user, 'advancedAnalytics') },
              { id: 'history', label: 'Collection History', icon: History },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  style={{ fontSize: '13px', padding: '12px 14px', position: 'relative', opacity: tab.locked ? 0.6 : 1 }}
                >
                  <Icon size={16} />
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {tab.locked && <Lock size={11} style={{ color: '#d97706' }} />}
                  {!tab.locked && tab.badge > 0 && (
                    <span style={{ background: '#EF4444', color: '#fff', borderRadius: '10px', padding: '2px 6px', fontSize: '9px', fontWeight: 'bold' }}>{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sidebar Notifications Quick View */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="sidebar-nav-item"
              style={{ fontSize: '13px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px', color: '#E2E8F0' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Bell size={16} style={{ color: '#d97706' }} /> Alerts Log
              </span>
              {notifications.length > 0 && (
                <span style={{ background: '#4F46E5', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>{notifications.length}</span>
              )}
            </button>

            <button
              onClick={() => setShowUpgradePlanModal(true)}
              className="sidebar-nav-item"
              style={{ color: '#B45309', display: 'flex', alignItems: 'center', gap: '12px', background: '#FEF3C7', border: '1px solid #FDE68A', marginBottom: '8px' }}
            >
              <TrendingUp size={16} /> Upgrade Plan
              <span style={{ marginLeft: 'auto', fontSize: '9px', background: 'rgba(217,119,6,0.2)', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>{(user.distributorPlanTier || 'basic_distributor').replace('_distributor', '').toUpperCase()}</span>
            </button>
            <button
              onClick={handleLogout}
              className="sidebar-nav-item"
              style={{ color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '12px', background: '#FEE2E2', border: '1px solid #FCA5A5' }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Main Content Pane */}
        <div className="fluid-dashboard-main">
          {/* Prominent Distributor Code Banner */}
          <div style={{ background: 'linear-gradient(135deg, #1E1B4B, #312E81)', color: '#FFFFFF', borderRadius: '14px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', boxShadow: '0 4px 15px rgba(49,46,129,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={22} style={{ color: '#818CF8' }} />
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#C7D2FE', fontWeight: 700 }}>Your Unique Distributor Code</div>
                <div style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '1.5px', color: '#FDE047' }}>
                  {user?.publicCode || user?.gstin || (user?.phone ? ('DIST-' + user.phone) : ('DIST-' + (user?.id || '').slice(0, 8).toUpperCase()))}
                </div>
                <div style={{ fontSize: '11px', color: '#A5B4FC' }}>Share this code with shopkeepers to link accounts or search your catalog</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const code = user?.publicCode || user?.gstin || (user?.phone ? ('DIST-' + user.phone) : ('DIST-' + (user?.id || '').slice(0, 8).toUpperCase()));
                  navigator.clipboard?.writeText(code);
                  toast.success('Distributor Code copied!');
                }}
                style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Copy size={15} /> Copy Code
              </button>
              <button
                onClick={handleCopyPublicCatalogLink}
                style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '9px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Share2 size={15} /> Share Web Catalog Link
              </button>
            </div>
          </div>
          
          {/* Notifications Banner Overlay inside Desktop view */}
          {showNotifications && (
            <div className="premium-glass" style={{ padding: '16px', marginBottom: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#0F172A' }}><Bell size={15} style={{ color: '#d97706' }} /> Notifications & Activity Stream</h3>
                <button onClick={() => setShowNotifications(false)} style={{ background: '#F1F5F9', border: 'none', color: '#475569', fontSize: '11px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', width: 'auto', flexShrink: 0 }}>Dismiss</button>
              </div>
              {notifications.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', margin: 0 }}>No recent business events.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                  {notifications.map(n => (
                    <div key={n.id} style={{ display: 'flex', gap: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{n.emoji}</span>
                      <div>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#0F172A', fontWeight: 'bold' }}>{n.title}</h4>
                        <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.3 }}>{n.text}</p>
                        <span style={{ fontSize: '9px', color: '#64748B', display: 'block', marginTop: '4px' }}>{new Date(n.date).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shop limit upgrade banner */}
          {distCaps.maxShops !== -1 && shops.length > distCaps.maxShops && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#B45309', fontWeight: '500' }}>
                ⚠️ You have {shops.length} shops but your plan allows {distCaps.maxShops}. Upgrade to continue serving all shops.
              </p>
              <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#D97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Upgrade Now
              </button>
            </div>
          )}

          {/* Multi-device warning — "Multi-device" (1/3/10 depending on
              tier) has been defined pricing metadata since the
              beginning but never actually tracked. This is a soft
              warning, deliberately not a hard block — see the
              migration file's comment for why: session/device counting
              is inherently fuzzy (cache clears, multiple tabs, shared
              computers), and blocking access outright risks locking
              out a legitimate paying distributor over a technical
              quirk rather than an actual plan violation. */}
          {distCaps.multiDevice && activeDeviceCount > distCaps.multiDevice && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#1D4ED8', fontWeight: '500' }}>
                📱 You've been active on {activeDeviceCount} devices in the last 30 days — your plan includes {distCaps.multiDevice}. Consider upgrading for more.
              </p>
              <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Upgrade Now
              </button>
            </div>
          )}

          {/* A failed load previously rendered as zeros everywhere, which
              a distributor reasonably reads as "my data is gone". Saying
              so plainly, with a retry, is far less alarming than silence. */}
          {loadFailed && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#991B1B' }}>Couldn&apos;t load your data</div>
                <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>Your records are safe — this is a connection problem, not data loss.</div>
              </div>
              <button onClick={() => { setLoadFailed(false); loadData(); }}
                style={{ background: '#DC2626', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Retry
              </button>
            </div>
          )}

          {/* The most-used action in a real distribution business: taking
              an order at the counter or on the phone. Sits above the
              dashboard rather than buried in a tab because it's what a
              distributor opens the app to DO. */}
          {activeTab === 'dashboard' && (
            <>
            <button onClick={() => navigate('/distributor/new-sale')}
              style={{ width: '100%', background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 18px', marginBottom: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>🛒 New Sale</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Counter or phone order — invoice &amp; dispatch</div>
              </div>
              <span style={{ fontSize: 20 }}>→</span>
            </button>
            <button onClick={() => navigate('/distributor/purchases')}
              style={{ width: '100%', background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: 12, padding: '13px 18px', marginBottom: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>📥 Purchases</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Record supplier bills — stock in, see what you owe</div>
              </div>
              <span style={{ fontSize: 18, color: '#94A3B8' }}>→</span>
            </button>
            <button onClick={() => navigate('/distributor/reports')}
              style={{ width: '100%', background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: 12, padding: '13px 18px', marginBottom: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>📊 Reports</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Profit &amp; loss, GST liability, stock value</div>
              </div>
              <span style={{ fontSize: 18, color: '#94A3B8' }}>→</span>
            </button>

              {/* ── ENTERPRISE INTELLIGENCE ──────────────────────────
                  Outstanding/collected/retailer-count are scoreboard
                  numbers — true, but they don't tell a distributor what
                  to DO. These two answer the questions the business
                  actually runs on: which money is going bad, and which
                  customers am I quietly losing. */}
              {/* Shown ONLY on a genuinely empty account. Everything
                  else on this dashboard hides itself when there's no
                  data — correct individually, but together it left a
                  new distributor staring at three buttons and zeroes,
                  which reads as broken rather than new. This makes the
                  empty state intentional and doubles as a tour of what
                  the product actually does. Renders nothing the moment
                  real data exists, so it can never clutter a live
                  account. */}
              {dataLoaded && shops.length === 0 && wholesaleProducts.length === 0 && stockOrders.length === 0 && (
                <div style={{ background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', border: '1px solid #C7D2FE', borderRadius: 14, padding: 20, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#3730A3', margin: '0 0 4px' }}>Welcome — let&apos;s get you set up</h3>
                  <p style={{ fontSize: 12, color: '#4338CA', margin: '0 0 16px' }}>
                    Four steps to a working distribution business. Most take under a minute.
                  </p>
                  {[
                    { n: 1, t: 'Add your products', d: 'Build your wholesale catalogue with prices, units and GST', to: null, tab: 'catalog' },
                    { n: 2, t: 'Record a purchase', d: 'Enter a supplier bill — stock goes up and cost is captured', to: '/distributor/purchases' },
                    { n: 3, t: 'Link your shops', d: 'Share your distributor code so retailers can order from you', to: null, tab: 'shops' },
                    { n: 4, t: 'Make your first sale', d: 'Counter or phone order, with a proper GST invoice', to: '/distributor/new-sale' },
                  ].map(s => (
                    <button key={s.n}
                      onClick={() => (s.to ? navigate(s.to) : setActiveTab(s.tab))}
                      style={{ width: '100%', textAlign: 'left', background: '#fff', border: '1px solid #E0E7FF', borderRadius: 10, padding: '11px 14px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s.n}
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{s.t}</span>
                        <span style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 1 }}>{s.d}</span>
                      </span>
                      <span style={{ color: '#94A3B8', fontSize: 16 }}>→</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Lifetime "revenue collected" only ever rises, so it can
                  never show a business shrinking. Last 30 days vs the 30
                  before it can. */}
              {(trend.current > 0 || trend.previous > 0) && (
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Last 30 days</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>₹{Math.round(trend.current).toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: trend.changePct >= 0 ? '#059669' : '#DC2626' }}>
                      {trend.changePct >= 0 ? '▲' : '▼'} {Math.abs(trend.changePct)}%
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      vs ₹{Math.round(trend.previous).toLocaleString('en-IN')} prior 30
                    </div>
                  </div>
                </div>
              )}

              {aging.total > 0 && (
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Receivables Aging</h3>
                    {aging.atRisk > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: aging.atRiskPct >= 30 ? '#DC2626' : '#CA8A04' }}>
                        ₹{Math.round(aging.atRisk).toLocaleString('en-IN')} past 60 days · {aging.atRiskPct}% of book
                      </span>
                    )}
                  </div>
                  {/* Proportional bar — the shape of the book is the
                      insight; a total alone can't show it. */}
                  <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 12, background: '#F1F5F9' }}>
                    {aging.buckets.map(b => b.amount > 0 && (
                      <div key={b.label} title={`${b.label}: ₹${Math.round(b.amount).toLocaleString('en-IN')}`}
                        style={{ width: `${(b.amount / aging.total) * 100}%`, background: b.tone }} />
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                    {aging.buckets.map(b => (
                      <div key={b.label} style={{ borderLeft: `3px solid ${b.tone}`, paddingLeft: 10 }}>
                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>{b.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: b.amount > 0 ? b.tone : '#CBD5E1' }}>
                          ₹{Math.round(b.amount).toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{b.count} account{b.count === 1 ? '' : 's'}</div>
                      </div>
                    ))}
                  </div>
                  {aging.atRiskPct >= 30 && (
                    <div style={{ marginTop: 12, padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#991B1B' }}>
                      Over a third of your book is past 60 days. Debt this old is often unrecoverable — worth chasing before it ages further.
                    </div>
                  )}
                </div>
              )}

              {atRiskShops.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>
                    Accounts Going Quiet ({atRiskShops.length})
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px' }}>
                    Ranked by revenue at stake — a shop rarely says it's leaving, it just stops ordering.
                  </p>
                  {atRiskShops.slice(0, 5).map(sh => (
                    <div key={sh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F1F5F9', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{sh.name}</div>
                        <div style={{ fontSize: 11, color: sh.neverOrdered ? '#B45309' : '#64748B' }}>
                          {sh.neverOrdered ? 'Linked but never ordered' : `No order in ${sh.daysQuiet} days`}
                          {sh.lifetimeValue > 0 && ` · ₹${Math.round(sh.lifetimeValue).toLocaleString('en-IN')} lifetime`}
                        </div>
                      </div>
                      {sh.phone && (
                        <a href={`tel:${sh.phone}`} style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          Call
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ================= DASHBOARD TAB ================= */}
          {activeTab === 'dashboard' && (
            <div className="responsive-split-grid" style={{ width: '100%' }}>
              {/* Left Column: Stats overview + Circular Collection Guage */}
              <div>
                <div className="premium-glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Active Market Outstanding</span>
                  <h2 style={{ fontSize: '48px', fontWeight: '900', color: '#DC2626', margin: '10px 0 20px 0', letterSpacing: '-1px' }}>₹{totalOutstanding}</h2>
                  
                  {/* Gauge */}
                  <div style={{ position: 'relative', width: '160px', height: '160px', marginBottom: '24px' }}>
                    <svg width="160" height="160" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="60" cy="60" r="50" fill="transparent" stroke="#F1F5F9" strokeWidth="6" />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="transparent"
                        stroke="#10B981"
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 50}
                        strokeDashoffset={2 * Math.PI * 50 * (1 - (totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) : 0))}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <span style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A' }}>
                        {Math.round(totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) * 100 : 0)}%
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase' }}>Collected</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', borderTop: '1px solid #E2E8F0', paddingTop: '20px', gap: '16px' }}>
                    <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: '16px' }}>
                      <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', fontWeight: 'bold' }}>Revenue Collected</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>₹{totalReceived}</div>
                    </div>
                    <div style={{ paddingLeft: '16px' }}>
                      <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', fontWeight: 'bold' }}>Linked Retailers</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>{shops.length} shops</div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowModal(true)} 
                  style={{ width: '100%', background: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.2)' }}
                >
                  <Plus size={18} /> + Supply Wholesale Stock (Extend Credit)
                </button>
              </div>

              {/* Right Column: Pending Collection Ledgers */}
              <div>
                <div className="premium-glass" style={{ padding: '20px', minHeight: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: '#0F172A' }}>
                    Outstanding Credit Balances ({pendingCredits.length})
                  </h3>
                  
                  {pendingCredits.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748B' }}>
                      
                      <p style={{ margin: '12px 0 0 0', fontSize: '13px' }}>All store credits have been fully cleared!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }} className="custom-scroll">
                      {pendingCredits.map(c => {
                        const outstanding = c.amount - (c.paidSoFar || 0);
                        return (
                        <div key={c.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div>
                              <h4 style={{ fontSize: '14px', margin: 0, color: '#0F172A', fontWeight: 'bold' }}>{c.shopName}</h4>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>{new Date(c.date).toLocaleDateString()} • {c.desc}</span>
                              {c.paidSoFar > 0 && (
                                <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, marginTop: 2 }}>
                                  ✓ ₹{c.paidSoFar} paid so far
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '16px', fontWeight: '800', color: '#DC2626' }}>₹{outstanding}</span>
                              {c.paidSoFar > 0 && <div style={{ fontSize: 10, color: '#94A3B8' }}>of ₹{c.amount}</div>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <input type="number" placeholder="Partial amount" value={paymentInputs[c.id] || ''}
                              onChange={e => setPaymentInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                              style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }} />
                            <button onClick={() => handleRecordPayment(c.id)} disabled={recordingPayment === c.id}
                              style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                              {recordingPayment === c.id ? '...' : 'Record'}
                            </button>
                          </div>
                          <button 
                            onClick={() => markPaid(c.id)}
                            style={{ background: '#DCFCE7', border: '1px solid #A5D6A7', color: '#15803D', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            Mark Fully Received
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= SHOPS TAB ================= */}
          {activeTab === 'shops' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A' }}>Your Retail Shops &amp; Customers ({shopsTotal})</h2>
                <button 
                  onClick={() => setShowBulkCustModal(true)}
                  style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📥 Bulk Import CSV
                </button>
              </div>
              {/* At thousands of linked shops, listing every full row on
                  every load was the real risk, and there was no way to
                  find one specific shop except scrolling. Search hits
                  the server directly rather than filtering the capped
                  client-side list, so it finds a shop even when it
                  isn't in the first 300 shown by default. */}
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <input type="text" value={shopSearch} onChange={e => setShopSearch(e.target.value)}
                  placeholder="Search shops by name…"
                  style={{ width: '100%', padding: '10px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                {shopSearchBusy && <span style={{ position: 'absolute', right: 12, top: 10, fontSize: 11, color: '#94A3B8' }}>Searching…</span>}
              </div>
              {!shopSearch && shopsTotal > shops.length && (
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '-10px 0 14px' }}>
                  Showing {shops.length} of {shopsTotal} — search above to find a specific shop.
                </p>
              )}

              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                {user?.publicCode && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: '11px' }}>Your distributor code (share with shops)</div>
                      <div style={{ color: '#0F172A', fontSize: '16px', fontWeight: 800, letterSpacing: '1px', fontFamily: 'monospace' }}>{user.publicCode}</div>
                    </div>
                    <button onClick={() => { navigator.clipboard?.writeText(user.publicCode); toast.success('Code copied!'); }}
                      style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                      Copy
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={shopCodeInput} onChange={e => setShopCodeInput(e.target.value.toUpperCase())}
                    placeholder="Add a shop by code (SHP-XXXXXX)"
                    style={{ flex: 1, minWidth: 0, padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                  <button onClick={handleLinkShop} disabled={shopLinkBusy}
                    style={{ background: '#16a34a', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                    {shopLinkBusy ? '...' : 'Add'}
                  </button>
                </div>
              </div>
              {shops.length === 0 ? (
                <p style={{ color: '#64748B', textAlign: 'center', lineHeight: 1.6, padding: '20px' }}>
                  No shops yet. Shops appear here once they place a wholesale order from your catalog.
                  Publish products in your Wholesale Catalog so nearby shops can find and order from you.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {shops.map(shop => {
                    const shopCredits = credits.filter(c => c.toShopId === shop.id && !c.paid);
                    const owed = shopCredits.reduce((a, b) => a + b.amount, 0);
                    return (
                      <div key={shop.id} className="premium-glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'transform 0.2s', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#FFFFFF' }}>🏪</div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: 'bold' }}>{shop.name}</h4>
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>{shop.phone}</p>
                          </div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '12px', color: '#475569' }}>Total Outstanding Credit:</span>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: owed > 0 ? '#DC2626' : '#15803D' }}>₹{owed}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button
                            onClick={() => downloadPartyStatement(shop, credits, stockOrders, user)}
                            style={{ flex: 1, background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            🧾 Statement
                          </button>
                          {shop.phone && owed > 0 && (
                            <a
                              href={`https://wa.me/91${shop.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                `Hi ${shop.name}, your total outstanding balance with ${user?.name || 'us'} is ₹${owed}.\n\n` +
                                (user?.upiId ? `Pay directly via UPI:\nupi://pay?pa=${user.upiId}&pn=${encodeURIComponent(user.name || 'Distributor')}&am=${owed}&cu=INR\n\n` : '') +
                                `Please settle at your convenience. Thank you!`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}
                            >
                              💬 WA Reminder
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= ORDERS TAB ================= */}
          {activeTab === 'orders' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A' }}>📥 Incoming Restock Orders ({stockOrders.length})</h2>
                {/* Bulk Order CSV Export — explicitly promised on the
                    pricing page's Pro tier as its own distinct line
                    item ("Bulk order CSV export"), separate from the
                    catalog CSV import already built — confirmed
                    genuinely missing, not just overlooked. */}
                {stockOrders.length > 0 && (
                  hasDistCap(user, 'bulkOrderCSV') ? (
                    <button onClick={() => {
                      const rows = [['Date', 'Shop', 'Items', 'Total', 'Status'], ...stockOrders.map(o => [
                        new Date(o.date).toLocaleDateString('en-IN'),
                        o.shopName || '',
                        (o.items || []).map(i => `${i.name} x${i.qty}`).join('; '),
                        o.total,
                        o.status,
                      ])];
                      const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
                      const a = document.createElement('a');
                      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                      a.download = `stock_orders_${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                    }} style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                      Export Orders CSV
                    </button>
                  ) : (
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#B45309', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Lock size={11} /> Export Orders (Pro+)
                    </button>
                  )
                )}
              </div>
              
              {stockOrders.length === 0 ? (
                <div className="premium-glass" style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <ShoppingBag size={48} style={{ color: '#E2E8F0', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ margin: 0 }}>No wholesale stock orders received yet from retailers.</p>
                </div>
              ) : (
                <div className="responsive-split-grid" style={{ width: '100%' }}>
                  {/* Left Column: Orders list */}
                  <div>
                    {/* Bulk dispatch bar — appears once at least one
                        accepted order is ticked. This is the actual
                        "route is full, send it all" action. */}
                    {selectedForDispatch.size > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#4338CA' }}>{selectedForDispatch.size} order{selectedForDispatch.size === 1 ? '' : 's'} selected</span>
                        <button onClick={() => handleDispatchSelected()} disabled={dispatching}
                          style={{ background: dispatching ? '#94A3B8' : '#4F46E5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer', width: 'auto' }}>
                          {dispatching ? 'Dispatching…' : `📦 Dispatch Selected (${selectedForDispatch.size})`}
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '550px', overflowY: 'auto' }} className="custom-scroll">
                      {stockOrders.map(o => {
                        const badge = STOCK_ORDER_BADGE[o.status] || STOCK_ORDER_BADGE.pending;
                        return (
                        <div 
                          key={o.id} 
                          onClick={() => setSelectedOrder(o)}
                          className="premium-glass" 
                          style={{ 
                            padding: '16px', 
                            cursor: 'pointer', 
                            border: selectedOrder?.id === o.id ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                            background: selectedOrder?.id === o.id ? '#EEF2FF' : '#FFFFFF',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                          }}
                        >
                          {o.status === 'accepted' && (
                            <input type="checkbox" checked={selectedForDispatch.has(o.id)}
                              onClick={e => e.stopPropagation()}
                              onChange={() => toggleDispatchSelect(o.id)}
                              style={{ marginTop: 3, width: 15, height: 15, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '14px', color: '#0F172A', fontWeight: 'bold' }}>{o.shopName}</h4>
                                <span style={{ fontSize: '11px', color: '#475569' }}>{new Date(o.date).toLocaleDateString()}</span>
                                {o.status === 'accepted' && o.expectedDispatchDate && (
                                  <div style={{ fontSize: 10, color: '#4F46E5', fontWeight: 700, marginTop: 2 }}>
                                    🕓 Expected: {new Date(o.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{
                                  fontSize: '9px',
                                  background: badge.bg,
                                  color: badge.color,
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase'
                                }}>{badge.label}</span>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#2563EB', marginTop: '4px' }}>₹{o.total}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Order Details Split panel */}
                  <div>
                    {selectedOrder ? (
                      <div className="premium-glass" style={{ padding: '20px', position: 'sticky', top: '24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px', marginBottom: '16px' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: '#2563EB', fontWeight: 'bold', textTransform: 'uppercase' }}>Selected Voucher</span>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '2px 0 0 0', color: '#0F172A' }}>{selectedOrder.shopName}</h3>
                            <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>Order ID: #{selectedOrder.id.substring(0, 8)}</p>
                          </div>
                          <span style={{
                            fontSize: '10px',
                            background: selectedOrder.status === 'pending' ? '#FEF3C7' : selectedOrder.status === 'accepted' ? '#DCFCE7' : '#FEE2E2',
                            color: selectedOrder.status === 'pending' ? '#B45309' : selectedOrder.status === 'accepted' ? '#15803D' : '#B91C1C',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>{selectedOrder.status}</span>
                        </div>

                        {/* Items list */}
                        <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Itemized Ledger</span>
                          <div style={{ maxHeight: '180px', overflowY: 'auto' }} className="custom-scroll">
                            {selectedOrder.items.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '13px' }}>
                                <span style={{ color: '#0F172A' }}>{item.name} <strong style={{ color: '#2563EB' }}>x{item.qty}</strong></span>
                                <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{item.price * item.qty}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', color: '#0F172A', borderTop: '2px dashed #E2E8F0', paddingTop: '14px', marginBottom: '20px' }}>
                          <span>Order Total Value:</span>
                          <span>₹{selectedOrder.total}</span>
                        </div>

                        {selectedOrder.status === 'pending' && (
                          <div>
                            {/* Optional expected dispatch date — accepting
                                doesn't have to mean shipping today. Lets a
                                distributor commit to fulfilling an order
                                while being honest about when their route
                                to that area will actually go out. */}
                            <div style={{ marginBottom: 12 }}>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Expected dispatch date (optional)</label>
                              <input type="date" value={dispatchDateInput} onChange={e => setDispatchDateInput(e.target.value)}
                                min={new Date().toISOString().slice(0, 10)}
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button 
                                onClick={() => handleUpdateStockOrder(selectedOrder.id, 'accepted', dispatchDateInput)}
                                style={{ flex: 1, background: '#10B981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' }}
                              >
                                Accept & Ship Credit
                              </button>
                              <button 
                                onClick={() => handleUpdateStockOrder(selectedOrder.id, 'rejected')}
                                style={{ flex: 1, background: '#EF4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                              >
                                Reject Order
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedOrder.status === 'accepted' && (
                          <div>
                            {selectedOrder.expectedDispatchDate && (
                              <p style={{ fontSize: 12, color: '#4F46E5', fontWeight: 700, marginBottom: 10 }}>
                                🕓 Expected dispatch: {new Date(selectedOrder.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                            <button
                              onClick={() => handleDispatchSelected(selectedOrder.id)}
                              style={{ width: '100%', background: '#4F46E5', color: 'white', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(79,70,229,0.25)' }}
                            >
                              📦 Mark as Dispatched
                            </button>
                            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, textAlign: 'center' }}>
                              Tip: tick multiple accepted orders in the list on the left to dispatch a whole route together.
                            </p>
                          </div>
                        )}

                        {selectedOrder.status === 'dispatched' && selectedOrder.dispatchedAt && (
                          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>
                              📦 Dispatched {new Date(selectedOrder.dispatchedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        {/* Invoice — any order the distributor has
                            actually committed to (accepted, dispatched,
                            or delivered) can get a real invoice; a
                            still-pending order can't since it might yet
                            be rejected. */}
                        {selectedOrder.status !== 'pending' && (
                          <button
                            onClick={() => downloadStockOrderInvoice(selectedOrder, user, wholesaleProducts)}
                            style={{ width: '100%', marginTop: 12, background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            🧾 Download Invoice
                          </button>
                        )}
                        {/* Same one-tap credit posting as the mobile
                            card — both trees, so a desktop user isn't
                            left re-typing amounts by hand. */}
                        {selectedOrder.status === 'delivered' && selectedOrder.shopId && (
                          selectedOrder.creditPostedId ? (
                            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#059669' }}>
                              ✅ On credit ledger
                            </div>
                          ) : (
                            <button
                              onClick={() => handlePostStockOrderCredit(selectedOrder)}
                              style={{ width: '100%', marginTop: 12, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              ₹ Add ₹{selectedOrder.total} to credit ledger
                            </button>
                          )
                        )}
                        {(() => {
                          const selShopPhone = shops.find(s => s.id === selectedOrder.shopId)?.phone;
                          if (!selShopPhone) return null;
                          const selBadge = STOCK_ORDER_BADGE[selectedOrder.status] || STOCK_ORDER_BADGE.pending;
                          return (
                            <a href={`https://wa.me/91${selShopPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Hi ${selectedOrder.shopName}, here's your order summary:\n\n` +
                              selectedOrder.items.map(i => `• ${i.name} x${i.qty} — ₹${i.price * i.qty}`).join('\n') +
                              `\n\nTotal: ₹${selectedOrder.total}\nStatus: ${selBadge.label}`
                            )}`} target="_blank" rel="noreferrer"
                              style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: 10, background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', boxSizing: 'border-box' }}>
                              💬 Share via WhatsApp
                            </a>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="premium-glass" style={{ padding: '30px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        Select an order from the ledger to manage its fulfillment.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= CATALOG TAB ================= */}
          {activeTab === 'catalog' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A' }}>Distributor Wholesale Catalog ({wholesaleProducts.length})</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {hasDistCap(user, 'bulkOrderCSV') ? (
                    <button onClick={() => setShowBulkImport(true)}
                      style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Bulk Import CSV
                    </button>
                  ) : (
                    <button onClick={() => setShowUpgradePlanModal(true)}
                      style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#B45309', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Lock size={12} /> Bulk Import (Pro+)
                    </button>
                  )}
                  {wholesaleProducts.length > 0 && (
                    <>
                      <button onClick={() => setShowBarcodeManager(true)}
                        style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FFEDD5', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                        🏷️ Barcodes &amp; Labels
                      </button>
                      <button onClick={handleGenerateCatalog}
                        style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📄 Generate Catalog
                      </button>
                      <button onClick={handleCopyPublicCatalogLink}
                        style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                        🔗 Copy Web Catalog Link
                      </button>
                      <button onClick={handleShareCatalogWhatsApp}
                        style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                        💬 Share via WhatsApp
                      </button>
                    </>
                  )}
                  <button 
                    onClick={openAddProduct}
                    style={{ background: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', width: 'auto', border: 'none', cursor: 'pointer' }}
                  >
                    <Plus size={16} /> Publish Wholesale Product
                  </button>
                </div>
              </div>

              {showBulkImport && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                  <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 620, width: '100%', maxHeight: '88vh', overflowY: 'auto', border: '1px solid #E2E8F0', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0F172A' }}>Bulk Import Products from Other Software</h3>
                      <button onClick={() => { setShowBulkImport(false); setBulkImportRows([]); }} style={{ background: '#F1F5F9', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                    
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
                      Directly import CSV files exported from <strong>Vyapar, Tally, Marg ERP, Busy, Zoho Books, or Excel</strong>. Automatic header matching supported!
                    </p>

                    {/* Download Sample CSV Templates */}
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>📥 Download Sample CSV Format Templates:</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => downloadSampleCsv('standard')}
                          style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#4F46E5', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                          📄 Standard Template
                        </button>
                        <button type="button" onClick={() => downloadSampleCsv('vyapar')}
                          style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#059669', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                          📄 Vyapar Export Sample
                        </button>
                        <button type="button" onClick={() => downloadSampleCsv('tally')}
                          style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0284C7', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                          📄 Tally Export Sample
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>Upload CSV File</label>
                      <input type="file" accept=".csv,text/csv" onChange={handleCsvFileSelect}
                        style={{ width: '100%', padding: 10, border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 13, background: '#FFFFFF', boxSizing: 'border-box' }} />
                    </div>

                    {bulkImportRows.length > 0 && (
                      <>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
                          Preview — {bulkImportRows.length} product{bulkImportRows.length === 1 ? '' : 's'} ready to import:
                        </p>
                        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #CBD5E1', borderRadius: 12, marginBottom: 16, background: '#FFFFFF' }}>
                          {bulkImportRows.slice(0, 50).map((r, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', fontSize: 12, borderBottom: '1px solid #F1F5F9' }}>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0F172A' }}>{r.name}</div>
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                  {r.category && <span>Category: {r.category} · </span>}
                                  {r.sku && <span>SKU: {r.sku} · </span>}
                                  {r.hsnCode && <span>HSN: {r.hsnCode} · </span>}
                                  {r.gstRate > 0 && <span>GST: {r.gstRate}%</span>}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', fontWeight: 900, color: '#4F46E5' }}>
                                ₹{r.price} <span style={{ color: '#64748B', fontSize: 11, fontWeight: 'normal' }}>({r.stock} in stock)</span>
                              </div>
                            </div>
                          ))}
                          {bulkImportRows.length > 50 && <div style={{ padding: 10, fontSize: 11, color: '#64748B', textAlign: 'center', fontWeight: 'bold' }}>+ {bulkImportRows.length - 50} more products…</div>}
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handleConfirmBulkImport} disabled={bulkImportRows.length === 0 || bulkImporting}
                        style={{ flex: 1, background: bulkImportRows.length === 0 ? '#CBD5E1' : 'linear-gradient(135deg, #4F46E5, #4338CA)', color: '#fff', border: 'none', padding: 14, borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: bulkImportRows.length === 0 ? 'default' : 'pointer', boxShadow: bulkImportRows.length === 0 ? 'none' : '0 4px 14px rgba(79,70,229,0.3)' }}>
                        {bulkImporting ? 'Importing Products…' : `Import ${bulkImportRows.length || ''} Products to Catalog`}
                      </button>
                      <button onClick={() => { setShowBulkImport(false); setBulkImportRows([]); }}
                        style={{ flex: 1, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: 14, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Search — was completely missing. Fine with 5 products,
                  genuinely unusable once a distributor's catalog grows
                  to the 50-200+ SKUs a real FMCG wholesale business
                  actually carries. */}
              {wholesaleProducts.length > 0 && (
                <input type="text" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="Search your catalog by product name or category…"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' }} />
              )}

              {wholesaleProducts.length === 0 ? (
                <div className="premium-glass" style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <Layers size={48} style={{ color: '#E2E8F0', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ margin: 0 }}>No products published in the distributor catalog.</p>
                </div>
              ) : (() => {
                const q = catalogSearch.trim().toLowerCase();
                const filtered = q ? wholesaleProducts.filter(p => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)) : wholesaleProducts;
                if (filtered.length === 0) {
                  return <p style={{ color: '#64748B', textAlign: 'center', padding: '24px' }}>No products match "{catalogSearch}".</p>;
                }
                return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                  {filtered.map(p => (
                    <div key={p.id} className="premium-glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '170px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                      <div>
                        {p.image && (
                          <img src={p.image} alt={p.name} style={{ width: '100%', height: '110px', borderRadius: '8px', objectFit: 'cover', marginBottom: '8px', border: '1px solid #E2E8F0' }} />
                        )}
                        {p.category && <span style={{ fontSize: '9px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold', border: '1px solid #BFDBFE' }}>{p.category}</span>}
                        <h4 style={{ margin: '8px 0 4px 0', fontSize: '14px', color: '#0F172A', fontWeight: 'bold' }}>{p.name}</h4>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '10px', marginBottom: '10px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>₹{p.price}{p.unit && <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}> / {UNIT_SUFFIX[p.unit] || p.unit}</span>}</span>
                          <span style={{ fontSize: '11px', color: '#475569', fontWeight: '500' }}>Stock: {p.stock} cases</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditProduct(p)} style={{ flex: 1, background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => handleDeleteWholesaleProduct(p.id)} style={{ flex: 1, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()}
            </div>
          )}

          {/* ================= ROUTE PLANNER TAB ================= */}
          {activeTab === 'routeplanner' && (
            <div>
              {!hasDistCap(user, 'routePlanner') ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '20px' }}>
                  <Lock size={40} style={{ color: '#D97706', marginBottom: '16px' }} />
                  <h3 style={{ color: '#B45309', margin: '0 0 8px 0', fontWeight: '800' }}>Route Planner — Pro Distributor Feature</h3>
                  <p style={{ color: '#B45309', fontSize: '13px', margin: '0 0 24px 0' }}>Optimise your daily delivery route based on outstanding credit and shop distance.</p>
                  <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#F59E0B', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                    Upgrade to Pro Distributor
                  </button>
                </div>
              ) : (
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: '#0F172A' }}>🗺️ Route Planner</h2>
                  {(() => {
                    const today = new Date();
                    const sevenAgo = new Date(today); sevenAgo.setDate(today.getDate() - 7);
                    const routeShops = [...shops].sort((a, b) => {
                      const aOwed = credits.filter(c => c.toShopId === a.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const bOwed = credits.filter(c => c.toShopId === b.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const aPending = stockOrders.filter(o => o.shopId === a.id && o.status === 'pending').length;
                      const bPending = stockOrders.filter(o => o.shopId === b.id && o.status === 'pending').length;
                      const aLastVisit = visitedShops[a.id] ? new Date(visitedShops[a.id]) : null;
                      const bLastVisit = visitedShops[b.id] ? new Date(visitedShops[b.id]) : null;
                      const aNotVisited = !aLastVisit || aLastVisit < sevenAgo ? 1 : 0;
                      const bNotVisited = !bLastVisit || bLastVisit < sevenAgo ? 1 : 0;
                      const aDist = distanceKm(user.latitude, user.longitude, a.latitude, a.longitude);
                      const bDist = distanceKm(user.latitude, user.longitude, b.latitude, b.longitude);
                      const aDistScore = aDist != null ? -aDist * 10 : 0;
                      const bDistScore = bDist != null ? -bDist * 10 : 0;
                      return (bOwed + bPending * 100 + bNotVisited * 50 + bDistScore) - (aOwed + aPending * 100 + aNotVisited * 50 + aDistScore);
                    });
                    const totalToCollect = routeShops.reduce((s, sh) => s + credits.filter(c => c.toShopId === sh.id && !c.paid).reduce((a, c) => a + c.amount, 0), 0);
                    const markVisited = (shopId) => {
                      const updated = { ...visitedShops, [shopId]: new Date().toISOString() };
                      setVisitedShops(updated);
                      try { localStorage.setItem('dist_visited', JSON.stringify(updated)); } catch (_e) { /* ignore */ }
                    };
                    return (
                      <>
                        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ color: '#4F46E5', fontSize: '14px', fontWeight: '700' }}>Today's Route: {routeShops.length} shops</span>
                          <span style={{ color: '#B91C1C', fontSize: '14px', fontWeight: '700' }}>₹{totalToCollect.toLocaleString('en-IN')} to collect</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {routeShops.map((shop, idx) => {
                            const owed = credits.filter(c => c.toShopId === shop.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                            const pendingOrders = stockOrders.filter(o => o.shopId === shop.id && o.status === 'pending').length;
                            const lastVisit = visitedShops[shop.id] ? new Date(visitedShops[shop.id]) : null;
                            const notVisited7 = !lastVisit || lastVisit < sevenAgo;
                            const shopDist = distanceKm(user.latitude, user.longitude, shop.latitude, shop.longitude);
                            return (
                              <div key={shop.id} className="premium-glass" style={{ padding: '14px 18px', borderLeft: `4px solid ${owed > 5000 ? '#EF4444' : owed > 0 ? '#F59E0B' : '#10B981'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                                <div style={{ flex: 1, minWidth: '140px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', color: '#475569' }}>Stop #{idx + 1}</span>
                                    {shopDist != null && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#F0FDF4', color: '#15803D', fontWeight: 'bold' }}>📍 {shopDist < 1 ? `${Math.round(shopDist * 1000)}m` : `${shopDist.toFixed(1)}km`}</span>}
                                    {notVisited7 && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#FEF3C7', color: '#B45309', fontWeight: 'bold' }}>Not visited 7d+</span>}
                                    {pendingOrders > 0 && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 'bold' }}>{pendingOrders} pending</span>}
                                  </div>
                                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{shop.name}</div>
                                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                                    {shop.phone || 'No phone'} · Last: {lastVisit ? lastVisit.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '16px', fontWeight: '800', color: owed > 0 ? '#DC2626' : '#15803D' }}>₹{owed.toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: '10px', color: '#64748B' }}>outstanding</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {shop.phone && <a href={`tel:${shop.phone}`} style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>📞 Call</a>}
                                    {shop.phone && <a href={`https://wa.me/91${shop.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I am visiting your shop today for collections. Outstanding: ₹${owed}`)}`} target="_blank" rel="noreferrer" style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>💬 WA</a>}
                                    <button onClick={() => markVisited(shop.id)} style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #A5D6A7', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>✓ Visited</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ================= ANALYTICS TAB ================= */}
          {activeTab === 'analytics' && (
            <div>
              {/* Basic Sales Reports — explicitly promised on the
                  Basic tier, but this whole tab used to be entirely
                  locked behind advancedAnalytics, meaning Basic-tier
                  distributors saw nothing here at all despite paying
                  for reporting. These 4 totals are now shown to every
                  tier; only the ranking/breakdown sections below stay
                  Pro+. */}
              <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', color: '#0F172A' }}>📊 Sales Reports</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Total Shops Served', value: shops.length, color: '#2563EB' },
                  { label: 'Total GMV Issued', value: `₹${credits.reduce((s, c) => s + c.amount, 0)}`, color: '#059669' },
                  { label: 'Outstanding Balance', value: `₹${totalOutstanding}`, color: '#DC2626' },
                  { label: 'Collection Rate', value: `${credits.length > 0 ? Math.round((credits.filter(c => c.paid).length / credits.length) * 100) : 0}%`, color: '#D97706' },
                ].map((stat, i) => (
                  <div key={i} className="premium-glass" style={{ padding: '20px', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {!hasDistCap(user, 'advancedAnalytics') ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '20px' }}>
                  <TrendingUp size={40} style={{ color: '#4F46E5', marginBottom: '16px' }} />
                  <h3 style={{ color: '#3730A3', margin: '0 0 8px 0', fontWeight: '800' }}>Advanced Analytics — Pro Distributor Feature</h3>
                  <p style={{ color: '#3730A3', fontSize: '13px', margin: '0 0 24px 0' }}>Top shops, top products, and detailed breakdowns.</p>
                  <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                    Upgrade to Pro Distributor
                  </button>
                </div>
              ) : (
                <div>
                  <h3 style={{ color: '#0F172A', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Top Shops by Outstanding Credit</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {shops.sort((a, b) => {
                      const aO = credits.filter(c => c.toShopId === a.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const bO = credits.filter(c => c.toShopId === b.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      return bO - aO;
                    }).slice(0, 5).map(shop => {
                      const owed = credits.filter(c => c.toShopId === shop.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const total = credits.filter(c => c.toShopId === shop.id).reduce((s, c) => s + c.amount, 0);
                      const pct = total > 0 ? Math.round((owed / total) * 100) : 0;
                      return (
                        <div key={shop.id} className="premium-glass" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                          <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: '500' }}>{shop.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '80px', height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: owed > 5000 ? '#EF4444' : '#F59E0B', borderRadius: '3px' }} />
                            </div>
                            <span style={{ color: owed > 0 ? '#DC2626' : '#15803D', fontSize: '13px', fontWeight: 'bold' }}>₹{owed}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Top Products — explicitly promised in this tab's
                      own locked-tier description ("Top shops, top
                      products, GMV trends") but was genuinely missing.
                      Computed from stock order line items already
                      loaded — no new data fetching needed. */}
                  <h3 style={{ color: '#0F172A', fontSize: '14px', fontWeight: 'bold', margin: '24px 0 12px' }}>Top Products by Order Volume</h3>
                  {(() => {
                    const productTotals = {};
                    stockOrders.forEach(o => {
                      (o.items || []).forEach(item => {
                        const key = item.name;
                        if (!productTotals[key]) productTotals[key] = { qty: 0, revenue: 0 };
                        productTotals[key].qty += item.qty || 0;
                        productTotals[key].revenue += (item.price || 0) * (item.qty || 0);
                      });
                    });
                    const topProducts = Object.entries(productTotals)
                      .sort((a, b) => b[1].qty - a[1].qty)
                      .slice(0, 5);
                    if (topProducts.length === 0) {
                      return <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No orders yet to analyze.</p>;
                    }
                    const maxQty = topProducts[0][1].qty;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {topProducts.map(([name, stats]) => (
                          <div key={name} className="premium-glass" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: '500' }}>{name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '80px', height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
                                <div style={{ width: `${(stats.qty / maxQty) * 100}%`, height: '100%', background: '#4F46E5', borderRadius: '3px' }} />
                              </div>
                              <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: 'bold' }}>{stats.qty} units</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ================= HISTORY TAB ================= */}
          {activeTab === 'history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A' }}>Collection History & Settled Invoices</h2>
                {hasDistCap(user, 'tallyExport') ? (
                  <button
                    onClick={() => {
                      const rows = [['Date','Shop','Description','Amount','Status'], ...credits.map(c => [new Date(c.date).toLocaleDateString(), c.shopName || '', c.desc || '', c.amount, c.paid ? 'Paid' : 'Unpaid'])];
                      const csv = rows.map(r => r.join(',')).join('\n');
                      const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'distributor_tally.csv'; a.click();
                    }}
                    style={{ background: '#DCFCE7', border: '1px solid #A5D6A7', color: '#15803D', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Tally Export CSV
                  </button>
                ) : (
                  <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#B45309', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={11} /> Tally Export (Pro+)
                  </button>
                )}
              </div>
              
              {credits.filter(c => c.paid).length === 0 ? (
                <div className="premium-glass" style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <History size={48} style={{ color: '#E2E8F0', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ margin: 0 }}>No history of paid collections recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                  {credits.filter(c => c.paid).map(c => (
                    <div key={c.id} className="premium-glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #10B981', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: 'bold' }}>{c.shopName}</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#475569' }}>{c.desc} • {new Date(c.date).toLocaleDateString()}</p>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: '#059669' }}>+ ₹{c.amount}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ maxWidth: '720px' }}>
              {/* Field Operations & Van Sales Command Hub */}
              <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)', borderRadius: '16px', padding: '20px', marginBottom: '24px', color: '#FFFFFF', boxShadow: '0 8px 24px rgba(15,23,42,0.15)' }}>
                <div style={{ marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🚚 Field Distribution &amp; Van Sales Operations
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                    Manage delivery vans, beat routes, presale orders, and end-of-day cash settlement.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button onClick={() => navigate('/field/setup')}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '14px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ background: '#4F46E5', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🚚</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>Depots &amp; Delivery Vans</div>
                      <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>Setup warehouses &amp; vehicle series</div>
                    </div>
                  </button>

                  <button onClick={() => navigate('/field/routes')}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '14px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ background: '#0284C7', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🗺️</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>Beat Routes &amp; Reps</div>
                      <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>Assign routes &amp; field staff</div>
                    </div>
                  </button>

                  <button onClick={() => navigate('/field/orders')}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '14px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ background: '#D97706', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📋</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>Presale &amp; Van Orders</div>
                      <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>Dispatch orders to delivery vans</div>
                    </div>
                  </button>

                  <button onClick={() => navigate('/field/settlement')}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '14px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ background: '#059669', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💰</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>Day-End Settlement</div>
                      <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>Reconcile driver cash &amp; returns</div>
                    </div>
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={20} color="#64748B" /> Business Profile & GST
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>Used on your wholesale invoices and credit records. Keep your GSTIN and address accurate for compliant billing.</p>
              </div>

              {/* Real background push — the distributor dashboard had
                  ZERO push infrastructure at all before this: no client
                  import, no toggle, nothing. A distributor could miss a
                  new stock order entirely unless they happened to have
                  the tab open and looked at it. */}
              <div style={{ marginBottom: '16px' }}>
                <PushToggle userId={user.id} />
              </div>

              <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Business Name</label>
                  <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. FMCG Supply Co."
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>GSTIN</label>
                    <input value={profileForm.gstin} onChange={e => setProfileForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} placeholder="e.g. 29ABCDE1234F2Z5" maxLength={15}
                      style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.5px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>State Code</label>
                    <input value={profileForm.stateCode} onChange={e => setProfileForm(p => ({ ...p, stateCode: e.target.value }))} placeholder="e.g. 29"
                      style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Business Address (printed on invoices)</label>
                  <textarea value={profileForm.businessAddress} onChange={e => setProfileForm(p => ({ ...p, businessAddress: e.target.value }))} placeholder="Warehouse / office address" rows={3}
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Warehouse Location</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" onClick={handleGrabDistributorLocation}
                      style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                      📍 {profileForm.latitude ? 'Update Location' : 'Set My Location'}
                    </button>
                    {profileForm.latitude && <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>✓ Location set</span>}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>Used by Route Planner to sort stops by actual distance from your warehouse — save your profile after setting this.</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>UPI ID for Collections</label>
                  <input value={profileForm.upiId} onChange={e => setProfileForm(p => ({ ...p, upiId: e.target.value }))} placeholder="e.g. yourname@okhdfcbank"
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>Shops paying down their credit can send to this UPI.</p>
                </div>

                <button onClick={saveDistributorProfile} disabled={profileSaving}
                  style={{ background: profileSaving ? '#A5B4FC' : '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: profileSaving ? 'default' : 'pointer', marginTop: '4px' }}>
                  {profileSaving ? 'Saving…' : 'Save Business Profile'}
                </button>
              </div>

              {/* Staff Accounts — explicitly promised on the Enterprise
                  plan ("Staff accounts") but had zero implementation at
                  all: no UI, and the add-staff/remove-staff
                  authorization was hardcoded to shops only, so even a
                  paying Enterprise distributor could never actually add
                  a staff member. Gated on the same staffAccounts
                  capability flag that was already defined in
                  DIST_PLAN_CAPS but never actually referenced anywhere. */}
              <div style={{ marginTop: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} color="#64748B" /> Staff Accounts
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B' }}>Let your team log in and help manage orders, catalog, and collections.</p>

                {!hasDistCap(user, 'staffAccounts') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                    <Lock size={28} style={{ color: '#B45309', marginBottom: '8px' }} />
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#92400E', fontWeight: 600 }}>Staff accounts are an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                      <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Staff name"
                        style={{ flex: 1, minWidth: 140, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                      <input value={staffPhone} onChange={e => setStaffPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit phone" inputMode="numeric"
                        style={{ width: 140, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                      <select value={staffRole} onChange={e => setStaffRole(e.target.value)}
                        style={{ width: 170, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', background: '#FFFFFF', boxSizing: 'border-box' }}>
                        <option value="billing">💳 Billing Cashier</option>
                        <option value="van_driver">🚚 Van Driver / Rep</option>
                        <option value="inventory">📦 Warehouse Mgr</option>
                        <option value="accountant">💰 Accountant</option>
                        <option value="supervisor">👑 Supervisor</option>
                      </select>
                      <button onClick={handleAddDistStaff} disabled={addingStaff}
                        style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
                        {addingStaff ? 'Adding…' : '+ Add Staff'}
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 16px' }}>New staff log in with their phone number and default PIN <strong>1234</strong> — they should change it after their first login.</p>

                    {distStaff.length === 0 ? (
                      <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No staff added yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {distStaff.map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{s.name}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{s.phone}</div>
                            </div>
                            <button onClick={() => handleRemoveDistStaff(s.id, s.name)}
                              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* API Access — explicitly promised on the Enterprise
                  plan ("API access") but had zero implementation until
                  now. Key shown in full exactly once, right after
                  generation — stored server-side only as a SHA-256
                  hash, never in plaintext, same principle as a
                  password. */}
              <div style={{ marginTop: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={20} color="#64748B" /> API Access
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B' }}>Connect your own systems — pull orders, catalog, and credits programmatically.</p>

                {!hasDistCap(user, 'apiAccess') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                    <Lock size={28} style={{ color: '#B45309', marginBottom: '8px' }} />
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#92400E', fontWeight: 600 }}>API access is an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                    {newlyGeneratedKey && (
                      <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400E' }}>⚠️ Copy this now — it won't be shown again:</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <code style={{ flex: 1, background: '#fff', border: '1px solid #FDE68A', borderRadius: 6, padding: '8px 10px', fontSize: 12, wordBreak: 'break-all' }}>{newlyGeneratedKey}</code>
                          <button onClick={() => { navigator.clipboard?.writeText(newlyGeneratedKey); toast.success('Copied!'); }}
                            style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Copy</button>
                        </div>
                      </div>
                    )}

                    {apiKeyInfo ? (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: '#0F172A', marginBottom: 4 }}>Active key: <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{apiKeyInfo.keyPrefix}</code></div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          Created {new Date(apiKeyInfo.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {apiKeyInfo.lastUsedAt && ` · Last used ${new Date(apiKeyInfo.lastUsedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                          {!apiKeyInfo.lastUsedAt && ' · Never used yet'}
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>No active API key.</p>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                      <button onClick={handleGenerateApiKey} disabled={generatingKey}
                        style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {generatingKey ? 'Generating…' : apiKeyInfo ? 'Regenerate Key' : 'Generate API Key'}
                      </button>
                      {apiKeyInfo && (
                        <button onClick={handleRevokeApiKey} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                          Revoke
                        </button>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase' }}>Quick reference</p>
                      <code style={{ display: 'block', background: '#0F172A', color: '#E2E8F0', padding: '10px 12px', borderRadius: 8, fontSize: 11, marginBottom: 6, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                        curl -H "X-API-Key: YOUR_KEY" "https://zdertmpzervgjicuwsfz.supabase.co/functions/v1/distributor-api?resource=orders"
                      </code>
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>Available resources: <code>orders</code>, <code>catalog</code>, <code>credits</code></p>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Branded Reports (Logo) — explicitly promised
                  on the Enterprise plan ("Custom branded reports") but
                  had zero implementation: no upload UI anywhere, and
                  logoUrl was documented in the invoice template's own
                  code comment but never actually rendered by any
                  template. Reuses the exact same proven mechanism
                  already working for shop logos. */}
              <div style={{ marginTop: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🖼️ Custom Branded Reports
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B' }}>Add your logo to invoices and reports sent to shops.</p>

                {!hasDistCap(user, 'customBranding') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                    <Lock size={28} style={{ color: '#B45309', marginBottom: '8px' }} />
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#92400E', fontWeight: 600 }}>Custom branding is an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', textAlign: 'center' }}>
                    {logo ? (
                      <img src={logo} alt="Distributor Logo" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '2px solid #4F46E5', marginBottom: 12 }} />
                    ) : (
                      <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#F1F5F9', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12 }}>No Logo</div>
                    )}
                    <div>
                      <input type="file" accept="image/*" onChange={handleDistLogoFile} style={{ display: 'block', margin: '0 auto', fontSize: 12 }} />
                      {logo && (
                        <button onClick={handleDistLogoRemove} style={{ marginTop: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                          Remove Logo
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 12 }}>Appears on every invoice generated from Orders.</p>
                  </div>
                )}
              </div>

              {/* Multi-branch — explicitly promised on the Enterprise
                  plan ("Multi-branch support"). Adapted directly from
                  the shop side's proven branch system (separate
                  users row, own login, own scoped data via
                  distributor_id) rather than building something new
                  and untested — see the api.js functions' own
                  comments for the full safety analysis. */}
              <div style={{ marginTop: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏢 Multi-Branch
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B' }}>Run multiple warehouses/locations under one distributor account.</p>

                {!hasDistCap(user, 'multiBranch') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                    <Lock size={28} style={{ color: '#B45309', marginBottom: '8px' }} />
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#92400E', fontWeight: 600 }}>Multi-branch is an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 10px', textTransform: 'uppercase' }}>Add a Branch</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="Branch name (e.g. North Warehouse)"
                        style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                      <input value={branchPhone} onChange={e => setBranchPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit login phone" inputMode="numeric"
                        style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                      <input value={branchPassword} onChange={e => setBranchPassword(e.target.value)} placeholder="Login password" type="text"
                        style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                      <input value={branchAddress} onChange={e => setBranchAddress(e.target.value)} placeholder="Address (optional)"
                        style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <button onClick={handleCreateBranch} disabled={creatingBranch}
                      style={{ width: '100%', background: '#4F46E5', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
                      {creatingBranch ? 'Creating…' : '+ Add Branch'}
                    </button>

                    <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 10px', textTransform: 'uppercase' }}>Your Branches ({distBranches.filter(b => b.id !== user.id).length})</p>
                    {distBranches.filter(b => b.id !== user.id).length === 0 ? (
                      <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No branches yet — add one above.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {distBranches.filter(b => b.id !== user.id).map(b => (
                          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{b.name}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{b.phone}{b.businessAddress ? ` · ${b.businessAddress}` : ''}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleResetBranchPassword(b.id, b.name)} style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Reset Password</button>
                              <button onClick={() => handleDeleteBranch(b.id, b.name)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 14 }}>Each branch logs in independently with its own phone/password and manages its own catalog, orders, and credits.</p>
                  </div>
                )}
              </div>

              {/* Priority Support — explicitly promised on the
                  Enterprise plan ("Priority 24/7 support"). This is
                  fundamentally a staffing commitment, not a software
                  feature — being honest about that rather than
                  claiming a fully automated support system. What's
                  real here: a distinct, visible contact path for
                  Enterprise distributors using the same genuine
                  support channel already used elsewhere in the app. */}
              <div style={{ marginTop: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A' }}>⭐ Priority Support</h2>
                {!hasDistCap(user, 'staffAccounts') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                    <Lock size={28} style={{ color: '#B45309', marginBottom: '8px' }} />
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#92400E', fontWeight: 600 }}>Priority support is an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>As an Enterprise distributor, reach us directly for priority handling:</p>
                    <a href="mailto:adexosindia@gmail.com?subject=Priority%20Support%20Request" style={{ display: 'inline-block', background: '#4F46E5', color: '#fff', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                      ✉️ adexosindia@gmail.com
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Upgrade Plan Modal */}
        {showUpgradePlanModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="premium-glass" style={{ width: '100%', maxWidth: '760px', padding: '32px', background: '#FFFFFF', border: '1px solid #E2E8F0', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0F172A' }}>Distributor Subscription Plans</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>15-day free trial on Pro Distributor plan</p>
                </div>
                <button onClick={() => setShowUpgradePlanModal(false)} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Close</button>
              </div>
              {pricing && (() => {
                const cycles = ['monthly', 'quarterly', 'yearly'].filter(c => pricing.enabledCycles?.[c]);
                if (cycles.length <= 1) return null;
                const lbl = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
                const offerOn = !!pricing.offer?.enabled && Number(pricing.offer?.remaining) > 0 && Number(pricing.offer?.percent) > 0;
                return (
                  <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <div style={{ display: 'inline-flex', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 10, padding: 4, gap: 4 }}>
                      {cycles.map(c => {
                        const d = c !== 'monthly' ? Number(pricing.discounts?.[c]) || 0 : 0;
                        return (
                          <button key={c} onClick={() => setDistCycle(c)} style={{ background: distCycle === c ? '#4F46E5' : 'transparent', border: 'none', color: distCycle === c ? '#fff' : '#64748B', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            {lbl[c]}{d > 0 && <span style={{ marginLeft: 5, fontSize: 10, color: distCycle === c ? '#fff' : '#16a34a', fontWeight: 800 }}>-{d}%</span>}
                          </button>
                        );
                      })}
                    </div>
                    {offerOn && distCycle !== 'monthly' && (
                      <div style={{ marginTop: 10, color: '#16a34a', fontSize: 12, fontWeight: 700 }}>🎉 Launch offer: extra {pricing.offer.percent}% OFF — {pricing.offer.remaining} slots left!</div>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                {distPlans.map(plan => {
                  const isCurrent = (user.distributorPlanTier || 'basic_distributor') === plan.id;
                  const isPro = plan.id === 'pro_distributor';
                  return (
                    <div key={plan.id} style={{ background: isPro ? '#EEF2FF' : '#FFFFFF', border: `1px solid ${isPro ? '#C7D2FE' : '#E2E8F0'}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      {isPro && <div style={{ position: 'absolute', top: -12, right: 20, background: '#4F46E5', color: '#fff', fontSize: '10px', padding: '3px 10px', borderRadius: '20px', fontWeight: 800 }}>RECOMMENDED</div>}
                      <div style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>{plan.name}</div>
                      {(() => {
                        const cs = { monthly: '/mo', quarterly: '/3mo', yearly: '/yr' };
                        const pr = pricing ? api.computePrice(pricing, plan.id, distCycle) : null;
                        if (pr && pr.final && distCycle !== 'monthly' && pr.final < pr.base) {
                          return (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 18, color: '#94A3B8', textDecoration: 'line-through', fontWeight: 700 }}>₹{pr.base}</span>
                                <span style={{ fontSize: '32px', fontWeight: 900, color: '#0F172A' }}>₹{pr.final}</span>
                                <span style={{ fontSize: '13px', color: '#64748B' }}>{cs[distCycle]}</span>
                              </div>
                            </div>
                          );
                        }
                        return <div style={{ fontSize: '32px', fontWeight: 900, color: '#0F172A' }}>₹{pr?.final || plan.price}<span style={{ fontSize: '13px', color: '#64748B' }}>{cs[distCycle]}</span></div>;
                      })()}
                      <p style={{ fontSize: '12px', color: '#475569', margin: '8px 0 16px 0' }}>{plan.description}</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(plan.features || []).map((f, i) => (
                          <li key={i} style={{ fontSize: '12px', color: '#0F172A', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                            <span style={{ color: '#10B981', marginTop: '1px' }}>✓</span>{f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <div style={{ background: '#DCFCE7', border: '1px solid #A5D6A7', color: '#15803D', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>Current Plan</div>
                      ) : (
                        <button onClick={() => handleDistSubscribe(plan)} style={{ background: isPro ? '#4F46E5' : '#F1F5F9', color: isPro ? '#FFFFFF' : '#475569', border: isPro ? 'none' : '1px solid #E2E8F0', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                          {plan.id === 'pro_distributor' ? 'Start Free Trial' : 'Upgrade'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= MODALS ================= */}
        {/* Supply Stock / Add Credit Modal */}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="premium-glass" style={{ width: '100%', maxWidth: '460px', padding: '24px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 20px 0' }}>Supply Stock on Credit</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px', fontWeight: 'bold' }}>Select Shop</label>
                <select value={selectedShop} onChange={e => setSelectedShop(e.target.value)} style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }}>
                  <option value="">-- Choose Shop --</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px', fontWeight: 'bold' }}>Bill Amount (₹)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px', fontWeight: 'bold' }}>Description / Items Supply</label>
                <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. FMCG Stock / Atta packets" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleGiveCredit} style={{ flex: 1, background: '#4F46E5', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', border: 'none', cursor: 'pointer' }}>Save Entry</button>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Wholesale Product Modal (Desktop) */}
        {showCatalogModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
            <div className="premium-glass" style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', padding: '24px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', boxShadow: '0 20px 45px -10px rgba(0,0,0,0.2)', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>{editingProductId ? 'Edit Product' : 'Publish Wholesale Product'}</h2>
                <button onClick={closeCatalogModal} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
                <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Rice Bag (25kg)" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Wholesale Price (₹)</label>
                  <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="850" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Available Stock</label>
                  <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="50" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Category</label>
                <input type="text" value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} placeholder="e.g. Biscuits, Atta, Soaps — whatever fits your catalog" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Sold Per (unit)</label>
                <select value={newProdUnit} onChange={e => setNewProdUnit(e.target.value)} style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }}>
                  <option value="">Not specified</option>
                  {ALL_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>The price above is per this unit — e.g. ₹150 per jar, ₹1,200 per case.</p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Jars/Units per Box (optional)</label>
                <input type="number" min="1" value={newProdPackSize} onChange={e => setNewProdPackSize(e.target.value)} placeholder="e.g. 8"
                  style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>If shops order this by the box, set how many {newProdUnit ? (ALL_UNITS.find(u => u.value === newProdUnit)?.label.split(' ')[0].toLowerCase() + 's') : 'units'} come in one box. Your invoice will show Jars × Boxes = total Qty, matching your printed billbook format.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Code (optional)</label>
                  <input type="text" value={newProdSku} onChange={e => setNewProdSku(e.target.value)} placeholder="e.g. 269"
                    style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>HSN Code (optional)</label>
                  <input type="text" inputMode="numeric" value={newProdHsnCode} onChange={e => setNewProdHsnCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="e.g. 1905" maxLength={8}
                    style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate</label>
                <select value={newProdGstRate} onChange={e => setNewProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }}>
                  <option value="0">0% (Exempt)</option>
                  <option value="3">3%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Image (optional)</label>
                {newProdImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <img src={newProdImage} alt="" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #CBD5E1' }} />
                    <button type="button" onClick={() => setNewProdImage('')} style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <input type="file" accept="image/*" onChange={handleProdImageFile} style={{ width: '100%', fontSize: '12px' }} />
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleAddWholesaleProduct} style={{ flex: 1, background: '#4F46E5', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', border: 'none', cursor: 'pointer' }}>{editingProductId ? 'Update Product' : 'Publish Product'}</button>
                <button onClick={closeCatalogModal} style={{ flex: 1, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ================= MOBILE RETAIL CLIENT INTERFACE =================
  return (
    <div style={{ backgroundColor: '#F8FAFC', color: '#0F172A', minHeight: '100vh', paddingBottom: '80px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />
      
      {/* Mobile Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)', padding: '18px 16px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 20px rgba(15,23,42,0.15)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px', boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }}>M</div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.3px' }}>FMCG Distributor</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#93C5FD', marginTop: '3px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#10B981' : '#F59E0B', display: 'inline-block', boxShadow: isOnline ? '0 0 8px #10B981' : 'none' }}></span>
            <span>{user.name} • {isOnline ? 'Online Sync Ready' : 'Offline Mode'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8 }}>
            <NotificationCenter
              userId={user?.id}
              onToast={(row) => toast.info(row.title, { autoClose: 5000 })}
            />
          </div>
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            style={{ 
              background: 'rgba(255,255,255,0.08)', 
              border: '1px solid rgba(255,255,255,0.15)', 
              color: 'white', 
              padding: '8px 12px', 
              borderRadius: '8px', 
              fontSize: '14px', 
              fontWeight: 'bold',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            🔔
            {getNotifications().length > 0 && (
              <span style={{ 
                position: 'absolute', 
                top: '-6px', 
                right: '-6px', 
                background: '#EF4444', 
                color: '#fff', 
                borderRadius: '50%', 
                padding: '2px 6px', 
                fontSize: '10px', 
                fontWeight: 'bold',
                boxShadow: '0 2px 6px rgba(239,68,68,0.5)'
              }}>
                {getNotifications().length}
              </span>
            )}
          </button>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto' }}>Logout</button>
        </div>
      </div>

      {/* Notifications Drawer Overlay */}
      {showNotifications && (
        <div style={{ position: 'fixed', top: '70px', right: '16px', width: '320px', maxHeight: '450px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', zIndex: 1000, padding: '16px', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0F172A' }}>🔔 Live Notifications</h3>
            <button onClick={() => setShowNotifications(false)} style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: '13px', cursor: 'pointer', width: 'auto' }}>Close</button>
          </div>
          {getNotifications().length === 0 ? (
            <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '20px 0' }}>No recent notifications.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {getNotifications().map(n => (
                <div key={n.id} style={{ display: 'flex', gap: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{n.emoji}</span>
                  <div style={{ textAlign: 'left' }}>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#0F172A', fontWeight: 'bold' }}>{n.title}</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.3 }}>{n.text}</p>
                    {n.date && (
                      <span style={{ fontSize: '9px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                        {new Date(n.date).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <>
          <div style={{ padding: '16px' }}>
            {loadFailed && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '13px 15px', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#991B1B' }}>Couldn&apos;t load your data</div>
                <div style={{ fontSize: 11, color: '#B91C1C', margin: '2px 0 9px' }}>Your records are safe — this is a connection problem, not data loss.</div>
                <button onClick={() => { setLoadFailed(false); loadData(); }}
                  style={{ background: '#DC2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Retry
                </button>
              </div>
            )}
            
            {/* MOBILE KPI METRICS SUMMARY GRID — Polished 3D elevation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderTop: '3px solid #EF4444', borderRadius: '14px', padding: '14px 16px', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: totalOutstanding > 0 ? '#DC2626' : '#059669', marginTop: '4px' }}>₹{totalOutstanding}</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderTop: '3px solid #10B981', borderRadius: '14px', padding: '14px 16px', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Linked Shops</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', marginTop: '4px' }}>{shops.length}</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderTop: '3px solid #6366F1', borderRadius: '14px', padding: '14px 16px', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Catalog SKUs</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', marginTop: '4px' }}>{wholesaleProducts.length}</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderTop: '3px solid #F59E0B', borderRadius: '14px', padding: '14px 16px', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Orders</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: stockOrders.filter(o => o.status === 'pending').length > 0 ? '#EA580C' : '#0F172A', marginTop: '4px' }}>{stockOrders.filter(o => o.status === 'pending').length}</div>
              </div>
            </div>

            {/* MOBILE Action Buttons — Elevated Gradients */}
            <button onClick={() => navigate('/distributor/new-sale')}
              style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #4338CA 100%)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 20px', marginBottom: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.35)' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.2px' }}>🛒 New Sale</div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>Counter or phone order — invoice &amp; dispatch</div>
              </div>
              <span style={{ fontSize: 20, fontWeight: 900 }}>→</span>
            </button>

            <button onClick={() => navigate('/distributor/purchases')}
              style={{ width: '100%', background: '#FFFFFF', color: '#0F172A', border: '1px solid #E2E8F0', borderLeft: '4px solid #0EA5E9', borderRadius: 14, padding: '15px 18px', marginBottom: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>📥 Purchases</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Record supplier bills — stock in, see what you owe</div>
              </div>
              <span style={{ fontSize: 18, color: '#0EA5E9', fontWeight: 900 }}>→</span>
            </button>

            <button onClick={() => navigate('/distributor/reports')}
              style={{ width: '100%', background: '#FFFFFF', color: '#0F172A', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6', borderRadius: 14, padding: '15px 18px', marginBottom: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>📊 Reports</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Profit &amp; loss, GST liability, stock value</div>
              </div>
              <span style={{ fontSize: 18, color: '#8B5CF6', fontWeight: 900 }}>→</span>
            </button>

              {/* Polished Setup Wizard for New Accounts */}
              {dataLoaded && shops.length === 0 && wholesaleProducts.length === 0 && stockOrders.length === 0 && (
                <div style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)', border: '1px solid #C7D2FE', borderRadius: 16, padding: 22, marginBottom: 16, boxShadow: '0 6px 20px -4px rgba(99,102,241,0.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '18px' }}>🚀</span>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#3730A3', margin: 0 }}>Welcome — let&apos;s get you set up</h3>
                  </div>
                  <p style={{ fontSize: 12, color: '#4338CA', margin: '0 0 16px', lineHeight: 1.4 }}>
                    Four quick steps to activate your wholesale distribution business:
                  </p>
                  {[
                    { n: 1, t: 'Add your products', d: 'Build your wholesale catalogue with prices, units and GST', to: null, tab: 'catalog' },
                    { n: 2, t: 'Record a purchase', d: 'Enter a supplier bill — stock goes up and cost is captured', to: '/distributor/purchases' },
                    { n: 3, t: 'Link your shops', d: 'Share your distributor code so retailers can order from you', to: null, tab: 'shops' },
                    { n: 4, t: 'Make your first sale', d: 'Counter or phone order, with a proper GST invoice', to: '/distributor/new-sale' },
                  ].map(s => (
                    <button key={s.n}
                      onClick={() => (s.to ? navigate(s.to) : setActiveTab(s.tab))}
                      style={{ width: '100%', textAlign: 'left', background: '#FFFFFF', border: '1px solid #E0E7FF', borderRadius: 12, padding: '12px 14px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(79,70,229,0.3)' }}>
                        {s.n}
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{s.t}</span>
                        <span style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 1 }}>{s.d}</span>
                      </span>
                      <span style={{ color: '#4F46E5', fontSize: 16, fontWeight: 900 }}>→</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Lifetime "revenue collected" only ever rises, so it can
                  never show a business shrinking. Last 30 days vs the 30
                  before it can. */}
              {(trend.current > 0 || trend.previous > 0) && (
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Last 30 days</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A' }}>₹{Math.round(trend.current).toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: trend.changePct >= 0 ? '#059669' : '#DC2626' }}>
                      {trend.changePct >= 0 ? '▲' : '▼'} {Math.abs(trend.changePct)}%
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      vs ₹{Math.round(trend.previous).toLocaleString('en-IN')} prior 30
                    </div>
                  </div>
                </div>
              )}

              {aging.total > 0 && (
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Receivables Aging</h3>
                    {aging.atRisk > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: aging.atRiskPct >= 30 ? '#DC2626' : '#CA8A04' }}>
                        ₹{Math.round(aging.atRisk).toLocaleString('en-IN')} past 60 days · {aging.atRiskPct}% of book
                      </span>
                    )}
                  </div>
                  {/* Proportional bar — the shape of the book is the
                      insight; a total alone can't show it. */}
                  <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 12, background: '#F1F5F9' }}>
                    {aging.buckets.map(b => b.amount > 0 && (
                      <div key={b.label} title={`${b.label}: ₹${Math.round(b.amount).toLocaleString('en-IN')}`}
                        style={{ width: `${(b.amount / aging.total) * 100}%`, background: b.tone }} />
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                    {aging.buckets.map(b => (
                      <div key={b.label} style={{ borderLeft: `3px solid ${b.tone}`, paddingLeft: 10 }}>
                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>{b.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: b.amount > 0 ? b.tone : '#CBD5E1' }}>
                          ₹{Math.round(b.amount).toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{b.count} account{b.count === 1 ? '' : 's'}</div>
                      </div>
                    ))}
                  </div>
                  {aging.atRiskPct >= 30 && (
                    <div style={{ marginTop: 12, padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#991B1B' }}>
                      Over a third of your book is past 60 days. Debt this old is often unrecoverable — worth chasing before it ages further.
                    </div>
                  )}
                </div>
              )}

              {atRiskShops.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>
                    Accounts Going Quiet ({atRiskShops.length})
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px' }}>
                    Ranked by revenue at stake — a shop rarely says it's leaving, it just stops ordering.
                  </p>
                  {atRiskShops.slice(0, 5).map(sh => (
                    <div key={sh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F1F5F9', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{sh.name}</div>
                        <div style={{ fontSize: 11, color: sh.neverOrdered ? '#B45309' : '#64748B' }}>
                          {sh.neverOrdered ? 'Linked but never ordered' : `No order in ${sh.daysQuiet} days`}
                          {sh.lifetimeValue > 0 && ` · ₹${Math.round(sh.lifetimeValue).toLocaleString('en-IN')} lifetime`}
                        </div>
                      </div>
                      {sh.phone && (
                        <a href={`tel:${sh.phone}`} style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          Call
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>Total Market Outstanding</p>
              <h2 style={{ fontSize: '42px', fontWeight: 900, color: '#DC2626', margin: '8px 0' }}>₹{totalOutstanding}</h2>
              
              {/* Circular SVG Collection progress gauge */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '16px 0' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="50" fill="transparent" stroke="#F1F5F9" strokeWidth="8" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="transparent"
                      stroke="#10B981"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - (totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) : 0))}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0F172A' }}>
                      {Math.round(totalOutstanding + totalReceived > 0 ? (totalReceived / (totalOutstanding + totalReceived)) * 100 : 0)}%
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>Collected</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>Total Received</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803D', margin: 0 }}>₹{totalReceived}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>Active Shops</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563EB', margin: 0 }}>{shops.length}</p>
                </div>
              </div>
            </div>

            <button onClick={() => setShowModal(true)} style={{ width: '100%', background: '#4F46E5', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', marginBottom: '24px', boxShadow: '0 4px 15px rgba(79,70,229,0.2)' }}>
              + Supply Stock (Give Credit)
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0F172A' }}>Pending Market Collection</h3>
            {pendingCredits.length === 0 && <p style={{ color: '#64748B', textAlign: 'center' }}>No outstanding balances!</p>}
            
            {pendingCredits.map(c => {
              const outstanding = c.amount - (c.paidSoFar || 0);
              return (
              <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', margin: 0, color: '#0F172A' }}>{c.shopName}</h4>
                    <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0 0' }}>{new Date(c.date).toLocaleDateString()} • {c.desc}</p>
                    {c.paidSoFar > 0 && <p style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, margin: '2px 0 0 0' }}>✓ ₹{c.paidSoFar} paid so far</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h4 style={{ fontSize: '18px', margin: 0, color: '#DC2626' }}>₹{outstanding}</h4>
                    {c.paidSoFar > 0 ? <span style={{ fontSize: 10, color: '#94A3B8' }}>of ₹{c.amount}</span> :
                      <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Unpaid</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input type="number" placeholder="Partial amount" value={paymentInputs[c.id] || ''}
                    onChange={e => setPaymentInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                    style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  <button onClick={() => handleRecordPayment(c.id)} disabled={recordingPayment === c.id}
                    style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    {recordingPayment === c.id ? '...' : 'Record'}
                  </button>
                </div>
                <button onClick={() => markPaid(c.id)} style={{ width: '100%', background: '#DCFCE7', border: '1px solid #A5D6A7', color: '#15803D', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  ✅ Mark Fully Received
                </button>
              </div>
              );
            })}
          </div>
        </>
      )}

      {/* Shops Tab */}
      {activeTab === 'shops' && (
        <div style={{padding: 20}}>
          <h2 style={{fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', color: '#0F172A'}}>My Shops ({shopsTotal})</h2>
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <input type="text" value={shopSearch} onChange={e => setShopSearch(e.target.value)}
              placeholder="Search shops by name…"
              style={{ width: '100%', padding: '10px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            {shopSearchBusy && <span style={{ position: 'absolute', right: 12, top: 10, fontSize: 11, color: '#94A3B8' }}>Searching…</span>}
          </div>
          {!shopSearch && shopsTotal > shops.length && (
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '-8px 0 12px' }}>
              Showing {shops.length} of {shopsTotal} — search above to find a specific shop.
            </p>
          )}
          {shops.length === 0 ? (
            <p style={{color: '#64748B', textAlign: 'center'}}>No shops available.</p>
          ) : (
            shops.map(shop => {
              const shopCredits = credits.filter(c => c.toShopId === shop.id && !c.paid);
              const owed = shopCredits.reduce((a, b) => a + b.amount, 0);
              return (
                <div key={shop.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#0F172A' }}>{shop.name}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>{shop.phone}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Total Owed</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: owed > 0 ? '#DC2626' : '#15803D' }}>₹{owed}</div>
                  </div>
                  {/* Existed only in the desktop tree — mobile users
                      (the majority of this audience) had no way to
                      generate a party statement at all. */}
                  <button
                    onClick={() => downloadPartyStatement(shop, credits, stockOrders, user)}
                    style={{ marginTop: '8px', width: '100%', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🧾 Statement
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Stock Orders Tab */}
      {activeTab === 'orders' && (
        <div style={{ padding: 20 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0F172A' }}>📥 Incoming Restock Orders</h2>
          {selectedForDispatch.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4338CA' }}>{selectedForDispatch.size} selected</span>
              <button onClick={() => handleDispatchSelected()} disabled={dispatching}
                style={{ background: dispatching ? '#94A3B8' : '#4F46E5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer', width: 'auto' }}>
                {dispatching ? 'Dispatching…' : `📦 Dispatch (${selectedForDispatch.size})`}
              </button>
            </div>
          )}
          {stockOrders.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center' }}>No stock orders received.</p>
          ) : (
            stockOrders.map(o => (
              <StockOrderCard
                key={o.id}
                order={o}
                badge={STOCK_ORDER_BADGE[o.status] || STOCK_ORDER_BADGE.pending}
                selected={selectedForDispatch.has(o.id)}
                onToggleSelect={() => toggleDispatchSelect(o.id)}
                onAccept={(date) => handleUpdateStockOrder(o.id, 'accepted', date)}
                onReject={() => handleUpdateStockOrder(o.id, 'rejected')}
                onDispatch={() => handleDispatchSelected(o.id)}
                distributor={user}
                shopPhone={shops.find(s => s.id === o.shopId)?.phone}
                distributorCatalog={wholesaleProducts}
                onPostCredit={handlePostStockOrderCredit}
              />
            ))
          )}
        </div>
      )}

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0F172A' }}>Wholesale Catalog ({wholesaleProducts.length})</h2>
            <button onClick={openAddProduct} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              + Add Product
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {hasDistCap(user, 'bulkOrderCSV') && (
              <button onClick={() => setShowBulkImport(true)} style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                📥 Bulk CSV
              </button>
            )}
            {wholesaleProducts.length > 0 && (
              <>
                <button onClick={() => setShowBarcodeManager(true)} style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FFEDD5', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🏷️ Barcodes
                </button>
                <button onClick={handleGenerateCatalog} style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  📄 PDF Catalog
                </button>
                <button onClick={handleCopyPublicCatalogLink} style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🔗 Web Link
                </button>
                <button onClick={handleShareCatalogWhatsApp} style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  💬 WhatsApp
                </button>
              </>
            )}
          </div>

          {/* Bulk CSV import is a desktop workflow (uploading a file
              and reviewing a large preview table doesn't fit a phone
              screen well) — pointing there rather than cramming a
              lesser version of the same UI in here. */}
          {hasDistCap(user, 'bulkOrderCSV') && (
            <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16, textAlign: 'center' }}>
              Have a product list to import? Bulk CSV import is available on the desktop dashboard.
            </p>
          )}

          {wholesaleProducts.length > 0 && (
            <input type="text" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
              placeholder="Search your catalog…"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' }} />
          )}

          {wholesaleProducts.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center' }}>No wholesale products published yet.</p>
          ) : (() => {
            const q = catalogSearch.trim().toLowerCase();
            const filtered = q ? wholesaleProducts.filter(p => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)) : wholesaleProducts;
            if (filtered.length === 0) {
              return <p style={{ color: '#64748B', textAlign: 'center' }}>No products match "{catalogSearch}".</p>;
            }
            return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {filtered.map(p => (
                <div key={p.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                  <div>
                    {p.category && <span style={{ fontSize: '9px', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold', border: '1px solid #BFDBFE' }}>{p.category}</span>}
                    <h4 style={{ margin: '8px 0 4px 0', fontSize: '14px', color: '#0F172A', fontWeight: 'bold' }}>{p.name}</h4>
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#15803D' }}>₹{p.price}{p.unit && <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B' }}> / {UNIT_SUFFIX[p.unit] || p.unit}</span>}</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Stock: {p.stock}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => openEditProduct(p)} style={{ flex: 1, background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '6px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDeleteWholesaleProduct(p.id)} style={{ flex: 1, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            );
          })()}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={{padding: 20}}>
          <h2 style={{fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0F172A'}}>✅ Collection History</h2>
          {credits.filter(c => c.paid).length === 0 ? (
            <p style={{color: '#64748B', textAlign: 'center'}}>No history of paid collections.</p>
          ) : (
            credits.filter(c => c.paid).map(c => (
              <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #16A34A', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#0F172A' }}>{c.shopName}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#15803D' }}>{c.desc} • {new Date(c.date).toLocaleDateString()}</p>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#15803D' }}>+ ₹{c.amount}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Credit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#FFFFFF', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 20px 0' }}>Supply Stock on Credit</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px' }}>Select Shop</label>
              <select value={selectedShop} onChange={e => setSelectedShop(e.target.value)} style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '16px' }}>
                <option value="">-- Choose Shop --</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px' }}>Bill Amount (₹)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '16px' }} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '8px' }}>Description (Optional)</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. 2 Cartons ITC Cigarettes" style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '16px' }} />
            </div>

            <button onClick={handleGiveCredit} style={{ width: '100%', background: '#4F46E5', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Credit Entry</button>
            <button onClick={() => setShowModal(false)} style={{ width: '100%', background: 'transparent', color: '#64748B', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Wholesale Product Modal (Mobile) */}
      {showCatalogModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0', boxSizing: 'border-box' }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', borderRadius: '24px 24px 0 0', padding: '20px 20px 32px 20px', border: '1px solid #E2E8F0', boxSizing: 'border-box', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 10, paddingBottom: 8, borderBottom: '1px solid #F1F5F9' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', margin: 0 }}>{editingProductId ? 'Edit Product' : 'Publish Wholesale Product'}</h2>
              <button onClick={closeCatalogModal} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
              <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Carton (100 packets)" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
                <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="850" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Bulk Stock Qty</label>
                <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="50" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Category</label>
              <input type="text" value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} placeholder="e.g. Biscuits, Atta, Soaps" style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Sold Per (unit)</label>
              <select value={newProdUnit} onChange={e => setNewProdUnit(e.target.value)} style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }}>
                <option value="">Not specified</option>
                {ALL_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Jars/Units per Box (optional)</label>
              <input type="number" min="1" value={newProdPackSize} onChange={e => setNewProdPackSize(e.target.value)} placeholder="e.g. 8"
                style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Code</label>
                <input type="text" value={newProdSku} onChange={e => setNewProdSku(e.target.value)} placeholder="e.g. 269"
                  style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>HSN Code</label>
                <input type="text" inputMode="numeric" value={newProdHsnCode} onChange={e => setNewProdHsnCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="e.g. 1905" maxLength={8}
                  style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate</label>
              <select value={newProdGstRate} onChange={e => setNewProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }}>
                <option value="0">0% (Exempt)</option>
                <option value="3">3%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Image (optional)</label>
              {newProdImage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <img src={newProdImage} alt="" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #CBD5E1' }} />
                  <button type="button" onClick={() => setNewProdImage('')} style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Remove Image
                  </button>
                </div>
              ) : (
                <input type="file" accept="image/*" onChange={handleProdImageFile} style={{ width: '100%', fontSize: '12px' }} />
              )}
            </div>

            <button onClick={handleAddWholesaleProduct} style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #4338CA)', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>
              {editingProductId ? 'Update Product' : 'Publish Product'}
            </button>
            <button onClick={closeCatalogModal} style={{ width: '100%', background: 'transparent', color: '#64748B', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', marginTop: '6px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Route Planner, Advanced Analytics, and Settings tab
          content — was completely missing from mobile (navigation
          was just fixed above, but tapping any of these three would
          have shown a blank screen with nothing rendered at all).
          Reusing the exact same content desktop already shows —
          these blocks are self-contained, not tied to any
          desktop-only layout wrapper. */}
          {activeTab === 'routeplanner' && (
            <div>
              {!hasDistCap(user, 'routePlanner') ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '20px' }}>
                  <Lock size={40} style={{ color: '#D97706', marginBottom: '16px' }} />
                  <h3 style={{ color: '#B45309', margin: '0 0 8px 0', fontWeight: '800' }}>Route Planner — Pro Distributor Feature</h3>
                  <p style={{ color: '#B45309', fontSize: '13px', margin: '0 0 24px 0' }}>Optimise your daily delivery route based on outstanding credit and shop distance.</p>
                  <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#F59E0B', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                    Upgrade to Pro Distributor
                  </button>
                </div>
              ) : (
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: '#0F172A' }}>🗺️ Route Planner</h2>
                  {(() => {
                    const today = new Date();
                    const sevenAgo = new Date(today); sevenAgo.setDate(today.getDate() - 7);
                    const routeShops = [...shops].sort((a, b) => {
                      const aOwed = credits.filter(c => c.toShopId === a.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const bOwed = credits.filter(c => c.toShopId === b.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const aPending = stockOrders.filter(o => o.shopId === a.id && o.status === 'pending').length;
                      const bPending = stockOrders.filter(o => o.shopId === b.id && o.status === 'pending').length;
                      const aLastVisit = visitedShops[a.id] ? new Date(visitedShops[a.id]) : null;
                      const bLastVisit = visitedShops[b.id] ? new Date(visitedShops[b.id]) : null;
                      const aNotVisited = !aLastVisit || aLastVisit < sevenAgo ? 1 : 0;
                      const bNotVisited = !bLastVisit || bLastVisit < sevenAgo ? 1 : 0;
                      const aDist = distanceKm(user.latitude, user.longitude, a.latitude, a.longitude);
                      const bDist = distanceKm(user.latitude, user.longitude, b.latitude, b.longitude);
                      const aDistScore = aDist != null ? -aDist * 10 : 0;
                      const bDistScore = bDist != null ? -bDist * 10 : 0;
                      return (bOwed + bPending * 100 + bNotVisited * 50 + bDistScore) - (aOwed + aPending * 100 + aNotVisited * 50 + aDistScore);
                    });
                    const totalToCollect = routeShops.reduce((s, sh) => s + credits.filter(c => c.toShopId === sh.id && !c.paid).reduce((a, c) => a + c.amount, 0), 0);
                    const markVisited = (shopId) => {
                      const updated = { ...visitedShops, [shopId]: new Date().toISOString() };
                      setVisitedShops(updated);
                      try { localStorage.setItem('dist_visited', JSON.stringify(updated)); } catch (_e) { /* ignore */ }
                    };
                    return (
                      <>
                        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ color: '#4F46E5', fontSize: '14px', fontWeight: '700' }}>Today's Route: {routeShops.length} shops</span>
                          <span style={{ color: '#B91C1C', fontSize: '14px', fontWeight: '700' }}>₹{totalToCollect.toLocaleString('en-IN')} to collect</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {routeShops.map((shop, idx) => {
                            const owed = credits.filter(c => c.toShopId === shop.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                            const pendingOrders = stockOrders.filter(o => o.shopId === shop.id && o.status === 'pending').length;
                            const lastVisit = visitedShops[shop.id] ? new Date(visitedShops[shop.id]) : null;
                            const notVisited7 = !lastVisit || lastVisit < sevenAgo;
                            const shopDist = distanceKm(user.latitude, user.longitude, shop.latitude, shop.longitude);
                            return (
                              <div key={shop.id} className="premium-glass" style={{ padding: '14px 18px', borderLeft: `4px solid ${owed > 5000 ? '#EF4444' : owed > 0 ? '#F59E0B' : '#10B981'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                                <div style={{ flex: 1, minWidth: '140px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '10px', color: '#475569' }}>Stop #{idx + 1}</span>
                                    {shopDist != null && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#F0FDF4', color: '#15803D', fontWeight: 'bold' }}>📍 {shopDist < 1 ? `${Math.round(shopDist * 1000)}m` : `${shopDist.toFixed(1)}km`}</span>}
                                    {notVisited7 && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#FEF3C7', color: '#B45309', fontWeight: 'bold' }}>Not visited 7d+</span>}
                                    {pendingOrders > 0 && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 'bold' }}>{pendingOrders} pending</span>}
                                  </div>
                                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{shop.name}</div>
                                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                                    {shop.phone || 'No phone'} · Last: {lastVisit ? lastVisit.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '16px', fontWeight: '800', color: owed > 0 ? '#DC2626' : '#15803D' }}>₹{owed.toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: '10px', color: '#64748B' }}>outstanding</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {shop.phone && <a href={`tel:${shop.phone}`} style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>📞 Call</a>}
                                    {shop.phone && <a href={`https://wa.me/91${shop.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I am visiting your shop today for collections. Outstanding: ₹${owed}`)}`} target="_blank" rel="noreferrer" style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>💬 WA</a>}
                                    <button onClick={() => markVisited(shop.id)} style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #A5D6A7', padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>✓ Visited</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ================= ANALYTICS TAB ================= */}
          {activeTab === 'analytics' && (
            <div>
              {/* Basic Sales Reports — same restructure as desktop:
                  shown to every tier now, only rankings below stay Pro+. */}
              <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', color: '#0F172A' }}>📊 Sales Reports</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Total Shops Served', value: shops.length, color: '#2563EB' },
                  { label: 'Total GMV Issued', value: `₹${credits.reduce((s, c) => s + c.amount, 0)}`, color: '#059669' },
                  { label: 'Outstanding Balance', value: `₹${totalOutstanding}`, color: '#DC2626' },
                  { label: 'Collection Rate', value: `${credits.length > 0 ? Math.round((credits.filter(c => c.paid).length / credits.length) * 100) : 0}%`, color: '#D97706' },
                ].map((stat, i) => (
                  <div key={i} className="premium-glass" style={{ padding: '20px', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {!hasDistCap(user, 'advancedAnalytics') ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '20px' }}>
                  <TrendingUp size={40} style={{ color: '#4F46E5', marginBottom: '16px' }} />
                  <h3 style={{ color: '#3730A3', margin: '0 0 8px 0', fontWeight: '800' }}>Advanced Analytics — Pro Distributor Feature</h3>
                  <p style={{ color: '#3730A3', fontSize: '13px', margin: '0 0 24px 0' }}>Top shops, top products, and detailed breakdowns.</p>
                  <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                    Upgrade to Pro Distributor
                  </button>
                </div>
              ) : (
                <div>
                  <h3 style={{ color: '#0F172A', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Top Shops by Outstanding Credit</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {shops.sort((a, b) => {
                      const aO = credits.filter(c => c.toShopId === a.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const bO = credits.filter(c => c.toShopId === b.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      return bO - aO;
                    }).slice(0, 5).map(shop => {
                      const owed = credits.filter(c => c.toShopId === shop.id && !c.paid).reduce((s, c) => s + c.amount, 0);
                      const total = credits.filter(c => c.toShopId === shop.id).reduce((s, c) => s + c.amount, 0);
                      const pct = total > 0 ? Math.round((owed / total) * 100) : 0;
                      return (
                        <div key={shop.id} className="premium-glass" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                          <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: '500' }}>{shop.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '80px', height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: owed > 5000 ? '#EF4444' : '#F59E0B', borderRadius: '3px' }} />
                            </div>
                            <span style={{ color: owed > 0 ? '#DC2626' : '#15803D', fontSize: '13px', fontWeight: 'bold' }}>₹{owed}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <h3 style={{ color: '#0F172A', fontSize: '14px', fontWeight: 'bold', margin: '24px 0 12px' }}>Top Products by Order Volume</h3>
                  {(() => {
                    const productTotals = {};
                    stockOrders.forEach(o => {
                      (o.items || []).forEach(item => {
                        const key = item.name;
                        if (!productTotals[key]) productTotals[key] = { qty: 0 };
                        productTotals[key].qty += item.qty || 0;
                      });
                    });
                    const topProducts = Object.entries(productTotals).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
                    if (topProducts.length === 0) return <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No orders yet to analyze.</p>;
                    const maxQty = topProducts[0][1].qty;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {topProducts.map(([name, stats]) => (
                          <div key={name} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                            <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: '500' }}>{name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '60px', height: '6px', background: '#F1F5F9', borderRadius: '3px' }}>
                                <div style={{ width: `${(stats.qty / maxQty) * 100}%`, height: '100%', background: '#4F46E5', borderRadius: '3px' }} />
                              </div>
                              <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: 'bold' }}>{stats.qty}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ================= HISTORY TAB ================= */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '720px' }}>
              {/* Field Operations & Van Sales Command Hub (Mobile) */}
              <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)', borderRadius: '16px', padding: '16px', marginBottom: '20px', color: '#FFFFFF', boxShadow: '0 6px 20px rgba(15,23,42,0.15)' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🚚 Field Distribution &amp; Van Sales
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#94A3B8' }}>
                    Manage delivery vans, beat routes, presale orders, and settlement.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => navigate('/field/setup')}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ background: '#4F46E5', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>🚚</div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>Depots &amp; Vans</div>
                      <div style={{ fontSize: '10px', color: '#CBD5E1' }}>Setup vehicles</div>
                    </div>
                  </button>

                  <button onClick={() => navigate('/field/routes')}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ background: '#0284C7', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>🗺️</div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>Beat Routes</div>
                      <div style={{ fontSize: '10px', color: '#CBD5E1' }}>Assign routes</div>
                    </div>
                  </button>

                  <button onClick={() => navigate('/field/orders')}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ background: '#D97706', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>📋</div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>Van Orders</div>
                      <div style={{ fontSize: '10px', color: '#CBD5E1' }}>Dispatch stock</div>
                    </div>
                  </button>

                  <button onClick={() => navigate('/field/settlement')}
                    style={{ textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ background: '#059669', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>💰</div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>Settlement</div>
                      <div style={{ fontSize: '10px', color: '#CBD5E1' }}>Reconcile cash</div>
                    </div>
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={20} color="#64748B" /> Business Profile & GST
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>Used on your wholesale invoices and credit records. Keep your GSTIN and address accurate for compliant billing.</p>
              </div>

              {/* Real background push — the distributor dashboard had
                  ZERO push infrastructure at all before this: no client
                  import, no toggle, nothing. A distributor could miss a
                  new stock order entirely unless they happened to have
                  the tab open and looked at it. */}
              <div style={{ marginBottom: '16px' }}>
                <PushToggle userId={user.id} />
              </div>

              <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Business Name</label>
                  <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. FMCG Supply Co."
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>GSTIN</label>
                    <input value={profileForm.gstin} onChange={e => setProfileForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} placeholder="e.g. 29ABCDE1234F2Z5" maxLength={15}
                      style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.5px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>State Code</label>
                    <input value={profileForm.stateCode} onChange={e => setProfileForm(p => ({ ...p, stateCode: e.target.value }))} placeholder="e.g. 29"
                      style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Business Address (printed on invoices)</label>
                  <textarea value={profileForm.businessAddress} onChange={e => setProfileForm(p => ({ ...p, businessAddress: e.target.value }))} placeholder="Warehouse / office address" rows={3}
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Warehouse Location</label>
                  <button type="button" onClick={handleGrabDistributorLocation}
                    style={{ width: '100%', background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: 6 }}>
                    📍 {profileForm.latitude ? 'Update Location' : 'Set My Location'} {profileForm.latitude && '✓'}
                  </button>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>Used by Route Planner to sort stops by real distance — save your profile after setting this.</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>UPI ID for Collections</label>
                  <input value={profileForm.upiId} onChange={e => setProfileForm(p => ({ ...p, upiId: e.target.value }))} placeholder="e.g. yourname@okhdfcbank"
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', background: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box' }} />
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>Shops paying down their credit can send to this UPI.</p>
                </div>

                <button onClick={saveDistributorProfile} disabled={profileSaving}
                  style={{ background: profileSaving ? '#A5B4FC' : '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: profileSaving ? 'default' : 'pointer', marginTop: '4px' }}>
                  {profileSaving ? 'Saving…' : 'Save Business Profile'}
                </button>
              </div>

              {/* Staff Accounts — same feature as desktop, mobile
                  layout. See desktop version's comment for full
                  context on why this was completely missing. */}
              <div style={{ marginTop: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A' }}>👥 Staff Accounts</h2>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748B' }}>Let your team log in and help manage orders, catalog, and collections.</p>

                {!hasDistCap(user, 'staffAccounts') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                    <Lock size={24} style={{ color: '#B45309', marginBottom: '6px' }} />
                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#92400E', fontWeight: 600 }}>Staff accounts are an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                    <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Staff name"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', marginBottom: 8 }} />
                    <input value={staffPhone} onChange={e => setStaffPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit phone" inputMode="numeric"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', marginBottom: 8 }} />
                    <button onClick={handleAddDistStaff} disabled={addingStaff}
                      style={{ width: '100%', background: '#4F46E5', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginBottom: 12 }}>
                      {addingStaff ? 'Adding…' : '+ Add Staff'}
                    </button>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 12px' }}>New staff log in with their phone number and default PIN <strong>1234</strong>.</p>

                    {distStaff.length === 0 ? (
                      <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>No staff added yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {distStaff.map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{s.name}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{s.phone}</div>
                            </div>
                            <button onClick={() => handleRemoveDistStaff(s.id, s.name)}
                              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* API Access — same feature as desktop, mobile layout. */}
              <div style={{ marginTop: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A' }}>🔑 API Access</h2>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748B' }}>Connect your own systems — pull orders, catalog, and credits programmatically.</p>

                {!hasDistCap(user, 'apiAccess') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                    <Lock size={24} style={{ color: '#B45309', marginBottom: '6px' }} />
                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#92400E', fontWeight: 600 }}>API access is an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                    {newlyGeneratedKey && (
                      <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#92400E' }}>⚠️ Copy this now — it won't be shown again:</p>
                        <code style={{ display: 'block', background: '#fff', border: '1px solid #FDE68A', borderRadius: 6, padding: '8px 10px', fontSize: 11, wordBreak: 'break-all', marginBottom: 8 }}>{newlyGeneratedKey}</code>
                        <button onClick={() => { navigator.clipboard?.writeText(newlyGeneratedKey); toast.success('Copied!'); }}
                          style={{ width: '100%', background: '#B45309', color: '#fff', border: 'none', padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Copy Key</button>
                      </div>
                    )}

                    {apiKeyInfo ? (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: '#0F172A', marginBottom: 4 }}>Active: <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{apiKeyInfo.keyPrefix}</code></div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>
                          Created {new Date(apiKeyInfo.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {apiKeyInfo.lastUsedAt ? ` · Used ${new Date(apiKeyInfo.lastUsedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ' · Never used'}
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>No active API key.</p>
                    )}

                    <button onClick={handleGenerateApiKey} disabled={generatingKey}
                      style={{ width: '100%', background: '#4F46E5', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: apiKeyInfo ? 8 : 0 }}>
                      {generatingKey ? 'Generating…' : apiKeyInfo ? 'Regenerate Key' : 'Generate API Key'}
                    </button>
                    {apiKeyInfo && (
                      <button onClick={handleRevokeApiKey} style={{ width: '100%', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Revoke Key
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Custom Branded Reports (Logo) — same feature as desktop, mobile layout. */}
              <div style={{ marginTop: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A' }}>🖼️ Custom Branded Reports</h2>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748B' }}>Add your logo to invoices and reports sent to shops.</p>

                {!hasDistCap(user, 'customBranding') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                    <Lock size={24} style={{ color: '#B45309', marginBottom: '6px' }} />
                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#92400E', fontWeight: 600 }}>Custom branding is an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    {logo ? (
                      <img src={logo} alt="Distributor Logo" style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '2px solid #4F46E5', marginBottom: 10 }} />
                    ) : (
                      <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#F1F5F9', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 11 }}>No Logo</div>
                    )}
                    <input type="file" accept="image/*" onChange={handleDistLogoFile} style={{ display: 'block', margin: '0 auto', fontSize: 11 }} />
                    {logo && (
                      <button onClick={handleDistLogoRemove} style={{ marginTop: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                        Remove Logo
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Multi-Branch — full management (add/remove branches,
                  reset passwords) is a desktop workflow, same reasoning
                  as Bulk CSV Import: a form-heavy administrative task
                  done once in a while, not a daily mobile action.
                  Pointing there rather than cramming a lesser version
                  of the same UI onto a phone screen. */}
              {hasDistCap(user, 'multiBranch') && (
                <div style={{ marginTop: '20px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 6px 0', color: '#0F172A' }}>🏢 Multi-Branch</h2>
                  <p style={{ margin: 0, fontSize: '12px', color: '#4338CA' }}>Manage your branches (add new ones, reset passwords) from the desktop dashboard. You have {distBranches.filter(b => b.id !== user.id).length} branch{distBranches.filter(b => b.id !== user.id).length === 1 ? '' : 'es'} currently.</p>
                </div>
              )}

              {/* Priority Support — explicitly promised on the
                  Enterprise plan ("Priority 24/7 support"). This is
                  fundamentally a staffing commitment, not a software
                  feature — being honest about that rather than
                  claiming a fully automated support system. What's
                  real here: a distinct, visible contact path for
                  Enterprise distributors using the same genuine
                  support channel already used elsewhere in the app. */}
              <div style={{ marginTop: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0', color: '#0F172A' }}>⭐ Priority Support</h2>
                {!hasDistCap(user, 'staffAccounts') ? (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                    <Lock size={24} style={{ color: '#B45309', marginBottom: '6px' }} />
                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#92400E', fontWeight: 600 }}>Priority support is an Enterprise plan feature.</p>
                    <button onClick={() => setShowUpgradePlanModal(true)} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Upgrade to Enterprise</button>
                  </div>
                ) : (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748B' }}>As an Enterprise distributor, reach us directly for priority handling:</p>
                    <a href="mailto:adexosindia@gmail.com?subject=Priority%20Support%20Request" style={{ display: 'block', textAlign: 'center', background: '#4F46E5', color: '#fff', padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                      ✉️ adexosindia@gmail.com
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

      {/* Bottom Nav — divs converted to real <button> elements (same
          fix already applied to the shop dashboard's mobile nav
          tonight — clickable divs are a known cause of unreliable
          touch handling on mobile browsers). */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-around', padding: '12px 0', zIndex: 100, boxShadow: '0 -4px 16px rgba(0,0,0,0.04)' }}>
        <button type="button" style={{ background: 'none', border: 'none', font: 'inherit', textAlign: 'center', color: activeTab === 'dashboard' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <div style={{ fontSize: '20px' }}>📊</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Dashboard</span>
        </button>
        <button type="button" style={{ background: 'none', border: 'none', font: 'inherit', textAlign: 'center', color: activeTab === 'shops' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('shops')}>
          <div style={{ fontSize: '20px' }}>🏪</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Shops</span>
        </button>
        <button type="button" style={{ background: 'none', border: 'none', font: 'inherit', textAlign: 'center', color: activeTab === 'orders' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('orders')}>
          <div style={{ fontSize: '20px' }}>📥</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Orders</span>
        </button>
        <button type="button" style={{ background: 'none', border: 'none', font: 'inherit', textAlign: 'center', color: activeTab === 'catalog' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('catalog')}>
          <div style={{ fontSize: '20px' }}>📦</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Catalog</span>
        </button>
        <button type="button" style={{ background: 'none', border: 'none', font: 'inherit', textAlign: 'center', color: activeTab === 'history' ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setActiveTab('history')}>
          <div style={{ fontSize: '20px' }}>✅</div>
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>History</span>
        </button>
        <button type="button" style={{ background: 'none', border: 'none', font: 'inherit', textAlign: 'center', color: ['routeplanner', 'analytics', 'settings'].includes(activeTab) ? '#4F46E5' : '#64748B', cursor: 'pointer' }} onClick={() => setShowMoreMenu(true)}>
          <MoreHorizontal size={20} style={{ margin: '0 auto' }} />
          <span style={{ fontSize: '10px', fontWeight: 'bold', display: 'block' }}>More</span>
        </button>
      </div>

      {/* "More" overflow sheet — Route Planner, Advanced Analytics, and
          Settings had no way to be reached on mobile at all before
          this (confirmed: zero other buttons anywhere in this file
          reference these three tab ids). Settings specifically means
          a distributor on mobile had no way to reach subscription
          management or any other account setting. */}
      {showMoreMenu && (
        <div onClick={() => setShowMoreMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', borderRadius: '16px 16px 0 0', padding: '8px 0 calc(8px + env(safe-area-inset-bottom, 0px)) 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 36, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '4px auto 12px auto' }} />
            {[
              { id: 'routeplanner', Icon: Map, label: 'Route Planner', locked: !hasDistCap(user, 'routePlanner') },
              { id: 'analytics', Icon: TrendingUp, label: 'Advanced Analytics', locked: !hasDistCap(user, 'advancedAnalytics') },
              { id: 'settings', Icon: Settings, label: 'Settings', locked: false },
            ].map(({ id, Icon, label, locked }) => (
              <button key={id} type="button" onClick={() => { setActiveTab(id); setShowMoreMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', textAlign: 'left', fontSize: 15, fontWeight: 600, color: activeTab === id ? '#4F46E5' : '#1E293B', cursor: 'pointer', opacity: locked ? 0.6 : 1 }}>
                <Icon size={20} />
                {label}
                {locked && <Lock size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {showBarcodeManager && (
        <BarcodeManager
          products={wholesaleProducts}
          shopName={user?.name || 'Distributor Catalog'}
          shopId={user?.id}
          onClose={() => setShowBarcodeManager(false)}
          onAssignBarcode={(productId, barcode, format) => handleAssignDistributorBarcode(productId, barcode, format)}
        />
      )}

      {/* 📥 1-Click Bulk Customer CSV Import Modal */}
      {showBulkCustModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>📥 Bulk Import Customers (CSV)</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                  Upload or paste your retail shop client list from Vyapar, Tally, or Excel.
                </p>
              </div>
              <button onClick={() => setShowBulkCustModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', marginBottom: '14px', fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>
              <strong>Format:</strong> <code>Shop Name, Phone, GSTIN, Address, Credit Limit</code><br />
              <strong>Sample Row:</strong> <code>Sri Lakshmi Stores, 9876543210, 37AAAAA0000A1Z5, Main Road Sompeta, 50000</code>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
                Paste CSV Data or Drag &amp; Drop:
              </label>
              <textarea
                rows={6}
                value={bulkCustText}
                onChange={e => setBulkCustText(e.target.value)}
                placeholder="Sri Venkateswara Supermarket, 9876543210, 37AAAAA0000A1Z5, Main Bazaar, 50000&#10;Ganesh Traders, 9123456789, 37BBBBB1111B2Z6, MG Road, 25000"
                style={{ width: '100%', padding: '12px', border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button"
                onClick={() => {
                  const sample = "Shop Name, Phone, GSTIN, Address, Credit Limit\nSri Lakshmi Stores, 9876543210, 37AAAAA0000A1Z5, Main Road Sompeta, 50000\nGanesh Traders, 9123456789, 37BBBBB1111B2Z6, MG Road, 25000";
                  setBulkCustText(sample);
                  toast.info('Sample CSV loaded!');
                }}
                style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                📄 Load Sample Format
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowBulkCustModal(false)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleBulkCustomerCSV} disabled={bulkCustBusy} style={{ background: '#4F46E5', border: 'none', color: '#FFFFFF', padding: '10px 20px', borderRadius: '8px', fontWeight: '900', fontSize: '13px', cursor: 'pointer' }}>
                  {bulkCustBusy ? 'Importing…' : '🚀 Import Customers'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DistributorDashboard;
