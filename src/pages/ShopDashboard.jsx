import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { defaultUnitForCategory, unitOptionsForCategory, resolveUnit, formatQty, UNIT_SUFFIX } from '../lib/units';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useRealtimeTable } from '../hooks/useRealtimeTable';
import { useSubscription } from '../hooks/useSubscription';
import { useSessionGuard } from '../hooks/useSessionGuard';
import { TrialExpiredOverlay } from '../components/PlanGate';
import { Home, Package, Receipt, Wallet, LogOut, ScanLine, Plus, IndianRupee, Book, Share2, Search, Barcode as BarcodeIcon, Camera, X, QrCode, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// html5-qrcode and jsPDF are loaded on-demand, not on initial page load
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { downloadTallyXML, generateGSTR1CSV, generateMonthlySummaryCSV, downloadCSV } from '../lib/TallyExporter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { sendWhatsApp, sendCreditReminder, sendBillNotification, sendPaymentConfirmation, sendTrialReminder, hasWhatsAppAPI } from '../lib/notify';
import { generateVoucherPDF, generateCreditNotePDF } from '../lib/pdfGenerator';

import DesktopTopBar from '../components/DesktopTopBar';
import DesktopPOS from '../components/DesktopPOS';
import DesktopInventory from '../components/DesktopInventory';
import DesktopBills from '../components/DesktopBills';
import DesktopCredit from '../components/DesktopCredit';
import DesktopRestock from '../components/DesktopRestock';
import DesktopReports from '../components/DesktopReports';
import DesktopSettings from '../components/DesktopSettings';
import DesktopCustomers from '../components/DesktopCustomers';
import DesktopExpenses from '../components/DesktopExpenses';

const DEFAULT_ANNOUNCE = { active: false, text: '', type: 'info' };

const safe = async (fn) => { try { return await fn(); } catch { return null; } };

// ── Refer & Earn card — inline sub-component ──────────────────────────────
function ReferAndEarnCard({ userId, userName }) {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId) return;
    api.getOrCreateReferralCode(userId, userName)
      .then(c => { setCode(c); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId, userName]);
  const link = code ? `https://mystoreos.in/register?ref=${code.code}` : '';
  const copy = (text) => { navigator.clipboard.writeText(text); };
  const shareWA = () => {
    if (!link) return;
    const msg = `Join MyStore OS — India's #1 billing app! 🛒\nUse my code to sign up free:\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  return (
    <div style={{ margin: '16px', background: 'linear-gradient(135deg,rgba(139,92,246,0.12),rgba(109,40,217,0.08))', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>🔗</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#4F46E5' }}>Refer & Earn</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Share your code — earn 20% commission when referrals subscribe</div>
        </div>
      </div>
      {loading ? <div style={{ color: '#64748b', fontSize: 12 }}>Generating your code...</div> : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#0f172a', border: '2px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 18px', fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: '#a78bfa', letterSpacing: 3, flexShrink: 0 }}>
            {code?.code || '—'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => copy(code?.code)} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>📋 Copy Code</button>
            <button onClick={() => copy(link)} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>🔗 Copy Link</button>
            <button onClick={shareWA} style={{ background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>📲 Share on WhatsApp</button>
          </div>
        </div>
      )}
    </div>
  );
}

const ShopDashboard = () => {
  const { user, setUser, logout } = useAuth();
  const { locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [credits, setCredits] = useState([]);
  const [search, setSearch] = useState('');
  
  // Quick Bill State
  const [billItems, setBillItems] = useState([]);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [billingMode, setBillingMode] = useState('bill'); // 'bill' | 'estimate' | 'challan'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerStateCode, setCustomerStateCode] = useState('');
  const [billsSubTab, setBillsSubTab] = useState('sales'); // 'sales' | 'drafts'
  
  // Receipt Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [tallyMenuOpen, setTallyMenuOpen] = useState(false);

  // Products Management State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('100');
  const [newProdReorder, setNewProdReorder] = useState('10');
  const [newProdBatch, setNewProdBatch] = useState('');
  const [newProdExpiry, setNewProdExpiry] = useState('');
  const [newProdVariants, setNewProdVariants] = useState('');
  const [newProdHsnCode, setNewProdHsnCode] = useState('');
  const [newProdGstRate, setNewProdGstRate] = useState('0');
  const [newProdCostPrice, setNewProdCostPrice] = useState('0');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Edit Product Modal State
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProdId, setEditingProdId] = useState(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdStock, setEditProdStock] = useState('');
  const [editProdReorder, setEditProdReorder] = useState('');
  const [editProdBatch, setEditProdBatch] = useState('');
  const [editProdExpiry, setEditProdExpiry] = useState('');
  const [editProdVariants, setEditProdVariants] = useState('');
  const [editProdHsnCode, setEditProdHsnCode] = useState('');
  const [editProdGstRate, setEditProdGstRate] = useState('0');
  const [editProdCostPrice, setEditProdCostPrice] = useState('0');
  const [editProdBarcode, setEditProdBarcode] = useState('');
  const [editProdUnit, setEditProdUnit] = useState('');

  // Unit system — driven by the shop's business category
  const shopCategory = user?.shopCategory || 'general';
  const shopDefaultUnit = defaultUnitForCategory(shopCategory);
  const unitOptions = unitOptionsForCategory(shopCategory);

  // Credit Ledger Toggle & Form States
  const [creditTabSub, setCreditTabSub] = useState('payable'); // 'payable' | 'receivable'
  const [custCreditName, setCustCreditName] = useState('');
  const [custCreditPhone, setCustCreditPhone] = useState('');
  const [custCreditDesc, setCustCreditDesc] = useState('');
  const [custCreditAmount, setCustCreditAmount] = useState('');
  const [customerCredits, setCustomerCredits] = useState([]);
  const [stockOrders, setStockOrders] = useState([]);

  // Profile State
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [logo, setLogo] = useState(user?.logo || '');
  const [shopPhotos, setShopPhotos] = useState(user?.shopPhotos || []);
  const [paymentQr, setPaymentQr] = useState(user?.paymentQr || '');
  const [showPaymentQrModal, setShowPaymentQrModal] = useState(false);
  const [latitude, setLatitude] = useState(user?.latitude || '');
  const [longitude, setLongitude] = useState(user?.longitude || '');
  const [gstin, setGstin] = useState(user?.gstin || '');
  const [stateCode, setStateCode] = useState(user?.stateCode || '');
  const [businessAddress, setBusinessAddress] = useState(user?.businessAddress || '');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [dailyTarget, setDailyTarget] = useState(0);
  const [flashSales, setFlashSales] = useState({});
  const [hideFromSearch, setHideFromSearch] = useState(user?.hideFromSearch || false);
  const [openingHour, setOpeningHour] = useState(user?.openingHour ?? 8);
  const [closingHour, setClosingHour] = useState(user?.closingHour ?? 21);
  const [weeklyHolidays, setWeeklyHolidays] = useState(user?.weeklyHolidays || []);
  const [shopBanner, setShopBanner] = useState(user?.shopBanner || { title: '', subtitle: '', discountPercent: 0, active: false });

  // System Settings (Razorpay Key & Announcement)
  const [sysSettings, setSysSettings] = useState({ razorpayKey: '' });
  const [announceConfig, setAnnounceConfig] = useState(DEFAULT_ANNOUNCE);

  // Staff Management
  const [staffList, setStaffList] = useState([]);
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);

  // Loyalty Points States
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);

  // Promo Code & Wholesale Restocking States
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [manualDiscountPct, setManualDiscountPct] = useState(0); // manual % discount entered in POS
  const [wholesaleCatalog, setWholesaleCatalog] = useState([]);
  const [restockCart, setRestockCart] = useState({}); // { wholesaleProdId: qty }

  // Sales Returns
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrder, setReturnOrder] = useState(null);
  const [returnItemsState, setReturnItemsState] = useState({}); // { itemId: returnQty }

  // Admin PIN / Maker-Checker Workflows
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // SaaS Subscription States
  const [plans, setPlans] = useState([]);
  const [showPlanSelectorModal, setShowPlanSelectorModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(
    () => !!sessionStorage.getItem(`mystore_trial_banner_dismissed_${user.id}`)
  );

  const targetShopId = user.role === 'staff' ? user.staff_of : user.id;
  const isOwner = user.role === 'shop' || user.role === 'admin';

  const { isOnline, pendingCount } = useOfflineSync();
  const { isExpired, hasFeature, capabilities, planLabel } = useSubscription();
  const loyaltyEnabled = hasFeature('loyaltyPoints');
  const _now = new Date();
  const trialDaysLeft = user.createdAt ? Math.max(0, 7 - Math.floor((_now - new Date(user.createdAt)) / 86400000)) : 7;
  const planExpiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const paidDaysLeft = planExpiresAt ? Math.max(0, Math.ceil((planExpiresAt - _now) / 86400000)) : null;
  const isOnTrial = user.subscription === 'trial';
  const { deviceLimitExceeded, activeSessions, forceRevokeOthers } = useSessionGuard();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAdminPinSubmit = async () => {
    try {
      await safe(() => api.verifyAdminPin(targetShopId, adminPinInput));
      setShowAdminPinModal(false);
      setAdminPinInput('');
      if (pendingAction) {
        await pendingAction();
        setPendingAction(null);
      }
    } catch (e) {
      toast.error(e.message || "Invalid PIN");
    }
  };

  const loadData = useCallback(async () => {
    setProducts((await safe(() => api.getShopProducts(targetShopId))) || []);
    const rawOrders = (await safe(() => api.getShopOrders(targetShopId))) || [];
    // Normalize status capitalization for Tally/GST export filters
    const normalizedOrders = rawOrders.map(o => ({
      ...o,
      status: o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1).toLowerCase() : o.status
    }));
    setOrders(normalizedOrders);
    setWholesaleCatalog((await safe(() => api.getDistributorProducts())) || []);

    // Load Global Announcement
    const announce = await safe(() => api.getSiteConfig('announcement', DEFAULT_ANNOUNCE));
    setAnnounceConfig(announce || DEFAULT_ANNOUNCE);

    if (isOwner) {
      setCredits((await safe(() => api.getShopCredits(targetShopId))) || []);
      setCustomerCredits((await safe(() => api.getDistCredits(targetShopId))) || []);
      setStockOrders((await safe(() => api.getShopStockOrders(targetShopId))) || []);
      setSysSettings(await safe(() => api.getSettings()));
      setStaffList(await safe(() => api.getShopStaff(targetShopId)));
      setPlans(await safe(() => api.getSubscriptionPlans()));
      setPaymentHistory(await safe(() => api.getPaymentHistory(targetShopId)));
      setInvoiceFooter(await safe(() => api.getSiteConfig('invoiceFooter_' + targetShopId, '')));
      setInvoicePrefix(await safe(() => api.getSiteConfig('invPrefix_' + targetShopId, 'INV')));
      setDailyTarget(parseInt(await safe(() => api.getSiteConfig('dailyTarget_' + targetShopId, 0))) || 0);
      setFlashSales(await safe(() => api.getFlashSales(targetShopId)));
    }
  }, [targetShopId, isOwner]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  useRealtimeTable({ table: 'orders', filter: `shop_id=eq.${targetShopId}`, onRefresh: loadData });
  useRealtimeTable({ table: 'products', filter: `shop_id=eq.${targetShopId}`, onRefresh: loadData });

  // Trial expiry reminder: day 5 and day 7 (once per day, tracked in localStorage)
  useEffect(() => {
    if (user.subscription !== 'trial' || !user.phone || !user.createdAt) return;
    const daysSince = Math.floor((Date.now() - new Date(user.createdAt)) / 86400000);
    if (daysSince !== 5 && daysSince !== 7) return;
    const flagKey = `mystore_trial_notified_${user.id}_d${daysSince}`;
    if (localStorage.getItem(flagKey)) return;
    const daysLeft = Math.max(0, 7 - daysSince);
    sendTrialReminder(user.phone, user.name, daysLeft);
    localStorage.setItem(flagKey, '1');
  }, [user.id, user.phone, user.subscription, user.createdAt, user.name]);

  useEffect(() => {
    let cancelled = false;
    const pts = loyaltyEnabled && customerPhone
      ? api.getLoyaltyPoints(targetShopId, customerPhone)
      : Promise.resolve(0);
    pts.then(p => {
      if (!cancelled) {
        setCustomerLoyaltyPoints(p);
        setLoyaltyRedeem(0);
      }
    });
    return () => { cancelled = true; };
  }, [customerPhone, targetShopId, loyaltyEnabled]);

  const decodeOrderUserId = (userId) => {
    if (!userId) return { type: 'bill', name: 'Walk-in Customer', phone: '' };
    const parts = userId.split(':');
    if (parts.length >= 2) {
      const type = parts[0]; // 'estimate', 'challan', 'walk-in'
      const name = parts[1] || 'Guest';
      const phone = parts[2] || '';
      return { type, name, phone };
    }
    return { type: 'bill', name: userId === 'walk-in-customer' ? 'Walk-in Customer' : userId, phone: '' };
  };

  const checkExpiryStatus = (expiryDateStr) => {
    if (!expiryDateStr) return { status: 'ok', text: '' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);
    if (expiry <= today) {
      return { status: 'expired', text: 'Expired 🚨' };
    }
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    if (expiry <= ninetyDaysFromNow) {
      return { status: 'near', text: 'Expires Soon ⚠️' };
    }
    return { status: 'ok', text: '' };
  };

  const handleConvertEstimateToBill = (o) => {
    const { name, phone } = decodeOrderUserId(o.userId);
    setCustomerName(name);
    setCustomerPhone(phone);
    setCustomerGstin(o.customerGstin || '');
    setCustomerAddress(o.customerAddress || '');
    setCustomerStateCode(o.customerStateCode || '');
    
    setBillItems(o.items.map(item => ({
      ...item,
      variants: products.find(p => p.id === item.id)?.variants || ''
    })));
    
    setBillingMode('bill');
    setActiveTab('home');
    toast.success(`Converted Estimate to Active Bill for ${name}!`);
  };

  const handleOpenEditModal = (p) => {
    setEditingProdId(p.id);
    setEditProdName(p.name);
    setEditProdPrice(p.price);
    setEditProdStock(p.stock || 0);
    setEditProdReorder(p.reorderLevel || 10);
    setEditProdBatch(p.batchNumber || '');
    setEditProdExpiry(p.expiryDate || '');
    setEditProdVariants(p.variants || '');
    setEditProdHsnCode(p.hsnCode || '');
    setEditProdGstRate(p.gstRate || '0');
    setEditProdCostPrice(p.costPrice !== undefined ? String(p.costPrice) : '0');
    setEditProdBarcode(p.barcode || '');
    setEditProdUnit(p.unit || shopDefaultUnit);
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!editProdName || !editProdPrice) return toast.error("Name and price required");
    try {
      await safe(() => api.editProduct(editingProdId, {
        name: editProdName,
        price: parseFloat(editProdPrice),
        stock: parseInt(editProdStock) || 0,
        reorderLevel: parseInt(editProdReorder) || 10,
        batchNumber: editProdBatch,
        expiryDate: editProdExpiry,
        variants: editProdVariants,
        hsnCode: editProdHsnCode,
        gstRate: editProdGstRate,
        costPrice: parseFloat(editProdCostPrice) || 0,
        barcode: editProdBarcode,
        unit: editProdUnit || shopDefaultUnit
      }));
      toast.success("Product updated successfully!");
      setShowEditProductModal(false);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update product");
    }
  };

  const handleDeleteProduct = async (prodId) => {
    if (!isOwner) {
      setPendingAction(() => () => executeDeleteProduct(prodId));
      setShowAdminPinModal(true);
      return;
    }
    executeDeleteProduct(prodId);
  };

  const executeDeleteProduct = async (prodId) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        await safe(() => api.deleteProduct(prodId));
        toast.success("Product deleted successfully!");
        loadData();
      } catch (e) {
        console.error(e);
        toast.error("Failed to delete product");
      }
    }
  };

  const handleAddCustomerCredit = async () => {
    if (!custCreditName || !custCreditAmount) return toast.error("Name and amount required");
    try {
      const descStr = `customer:${custCreditName}:${custCreditPhone || ''}:${custCreditDesc || 'Credit Purchase'}`;
      await safe(() => api.addCredit(targetShopId, targetShopId, descStr, custCreditAmount));
      toast.success("Customer credit logged successfully!");
      setCustCreditName('');
      setCustCreditPhone('');
      setCustCreditDesc('');
      setCustCreditAmount('');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save credit");
    }
  };

  const sendCustomerCreditReminder = (c) => {
    const parts = c.desc.split(':');
    const custName = parts[1] || 'Valued Customer';
    const custPhone = parts[2] || '';
    const upiIdForStore = upiId || user.upiId || '';
    // Use notify.js: WhatsApp Cloud API → wa.me fallback → SMS
    sendCreditReminder(custPhone, custName, c.amount, user.name, upiIdForStore);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const addToBill = useCallback((prod) => {
    setBillItems(prevItems => {
      const existing = prevItems.find(item => item.id === prod.id);
      if (existing) {
        toast.success(`Increased quantity of ${prod.name}`, { autoClose: 1000 });
        return prevItems.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item);
      }
      const sale = flashSales[prod.id];
      const activeSale = sale && new Date(sale.expiresAt) > new Date();
      const salePrice = activeSale ? Math.round(prod.price * (1 - sale.discount / 100)) : prod.price;
      const firstVariant = prod.variants ? prod.variants.split(',')[0].trim() : '';
      const label = activeSale ? `🔥 ${prod.name} added (${sale.discount}% off!)` : `Added ${prod.name} to bill`;
      toast.success(label, { autoClose: 1000 });
      return [...prevItems, { ...prod, price: salePrice, originalPrice: activeSale ? prod.price : undefined, qty: 1, selectedVariant: firstVariant }];
    });
  }, [flashSales]);

  const addCustomItem = () => {
    if(!customItemName || !customItemPrice) return toast.error("Enter name and price");
    const item = { id: 'custom_' + Date.now(), name: customItemName, price: parseFloat(customItemPrice), qty: 1, selectedVariant: '' };
    setBillItems([...billItems, item]);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const updateBillItemQty = (prodId, delta) => {
    setBillItems(prev => {
      return prev.map(item => {
        if (item.id === prodId) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const updateBillItemVariant = (prodId, variant) => {
    setBillItems(prev => {
      return prev.map(item => item.id === prodId ? { ...item, selectedVariant: variant } : item);
    });
  };

  const removeBillItem = (prodId) => {
    setBillItems(prev => prev.filter(item => item.id !== prodId));
  };

  const applyPromoCode = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'FLAT100') {
      if (billTotal < 100) return toast.error("Total must be at least ₹100 for FLAT100");
      setDiscountAmount(100);
      toast.success("₹100 discount applied!");
    } else if (code === 'WELCOME10') {
      setDiscountAmount(Math.round(billTotal * 0.10));
      toast.success("10% discount applied!");
    } else {
      toast.error("Invalid promo code!");
    }
  };

  const sendWhatsAppBill = async () => {
    if (billItems.length === 0) return toast.error("Bill is empty");
    const loyaltyDiscountRupees = Math.floor(loyaltyRedeem / 10);
    const total = Math.max(0, billTotal - discountAmount - manualDiscountAmt - loyaltyDiscountRupees);

    if (!isOwner && total > 5000) {
      setPendingAction(() => () => executeSendWhatsAppBill());
      setShowAdminPinModal(true);
      return;
    }
    
    executeSendWhatsAppBill();
  };

  const executeSendWhatsAppBill = async () => {
    const loyaltyDiscountRupees = Math.floor(loyaltyRedeem / 10); // 10 pts = ₹1
    const total = Math.max(0, billTotal - discountAmount - manualDiscountAmt - loyaltyDiscountRupees);
    
    try {
      let finalUserId = 'walk-in-customer';
      if (billingMode === 'estimate') {
        finalUserId = `estimate:${customerName || 'Guest'}:${customerPhone || ''}`;
      } else if (billingMode === 'challan') {
        finalUserId = `challan:${customerName || 'Guest'}:${customerPhone || ''}`;
      } else {
        finalUserId = `walk-in:${customerName || 'Guest'}:${customerPhone || ''}`;
      }

      await safe(() => api.placeOrder(finalUserId, targetShopId, billItems.map(b => ({
        id: b.id,
        name: b.name,
        price: b.price,
        qty: b.qty || 1,
        selectedVariant: b.selectedVariant || ''
      })), total, { gstin: customerGstin, address: customerAddress, stateCode: customerStateCode },
      billingMode === 'bill' ? 'Accepted' : 'Pending'));

      let loyaltyResult = null;
      if (loyaltyEnabled && customerPhone && billingMode === 'bill') {
        if (loyaltyRedeem > 0) await safe(() => api.redeemLoyaltyPoints(targetShopId, customerPhone, loyaltyRedeem));
        loyaltyResult = await safe(() => api.awardLoyaltyPoints(targetShopId, customerPhone, total));
      }

      const invoiceNo = billingMode === 'bill' ? await safe(() => api.getNextInvoiceNumber(targetShopId)) : null;

      // Sound synthesis announcement for completed bill (not for estimate/challan)
      if (billingMode === 'bill' && 'speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`MyStore received ${total} rupees successfully!`));
      }

      // Generate Premium Custom Themed PDF
      const { jsPDF: JsPDF } = await import('jspdf');
      const doc = new JsPDF();
      
      let themeColor = '#10b981'; // emerald green for bill
      let modeTitle = 'TAX INVOICE';
      if (billingMode === 'estimate') {
        themeColor = '#4F46E5'; // amber orange for estimate
        modeTitle = 'PROFORMA ESTIMATE / QUOTATION';
      } else if (billingMode === 'challan') {
        themeColor = '#3b82f6'; // blue for challan
        modeTitle = 'DELIVERY CHALLAN (GOODS IN TRANSIT)';
      }
      
      // Top colored header stripe
      doc.setFillColor(
        parseInt(themeColor.substring(1, 3), 16),
        parseInt(themeColor.substring(3, 5), 16),
        parseInt(themeColor.substring(5, 7), 16)
      );
      doc.rect(0, 0, 210, 8, 'F');
      
      // Brand / Shop Info
      if (user.logo && user.logo.startsWith('data:image')) {
        try {
          doc.addImage(user.logo, 'JPEG', 15, 12, 25, 25);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(20);
          doc.text(user.name, 45, 20);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(`Phone: ${user.phone}`, 45, 26);
          if (user.upiId) doc.text(`UPI ID: ${user.upiId}`, 45, 31);
        } catch (e) {
          console.error("PDF logo error", e);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(22);
          doc.text(user.name, 15, 22);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(`Phone: ${user.phone}`, 15, 28);
          if (user.upiId) doc.text(`UPI: ${user.upiId}`, 15, 33);
        }
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text(user.name, 15, 22);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Phone: ${user.phone}`, 15, 28);
        if (user.upiId) doc.text(`UPI ID: ${user.upiId}`, 15, 33);
      }
      
      // Horizontal Rule
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, 42, 195, 42);
      
      // Title Block
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(
        parseInt(themeColor.substring(1, 3), 16),
        parseInt(themeColor.substring(3, 5), 16),
        parseInt(themeColor.substring(5, 7), 16)
      );
      doc.text(modeTitle, 15, 50);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date: ${new Date().toLocaleString()}`, 135, 50);
      if (invoiceNo) {
        doc.setFontSize(9);
        doc.text(`Invoice # ${invoiceNo}`, 135, 56);
      }

      // Top section: Add shop GSTIN and State Code
      if (gstin) {
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`GSTIN: ${gstin} | State Code: ${stateCode}`, 15, 41);
        if (businessAddress) doc.text(businessAddress, 15, 45);
      }
      
      let custY = gstin ? 58 : 58;
      if (customerName || customerPhone || customerGstin) {
        doc.setFont("helvetica", "bold");
        doc.text("CUSTOMER DETAILS:", 15, custY);
        doc.setFont("helvetica", "normal");
        doc.text(`Name: ${customerName || 'Guest'}`, 15, custY + 5);
        if (customerPhone) doc.text(`Phone: ${customerPhone}`, 15, custY + 10);
        let custOffset = 15;
        if (customerGstin) {
          doc.text(`GSTIN: ${customerGstin} | State Code: ${customerStateCode}`, 15, custY + custOffset);
          custOffset += 5;
        }
        if (customerAddress) {
          doc.text(`Address: ${customerAddress}`, 15, custY + custOffset);
          custOffset += 5;
        }
        custY += custOffset + 3;
      } else {
        custY += 2;
      }

      // GST Calculation logic
      let isInterState = false;
      if (gstin && customerGstin && stateCode && customerStateCode && stateCode !== customerStateCode) {
        isInterState = true;
      }
      const showGstColumns = !!gstin && billingMode === 'bill';
      
      // Table Headers
      doc.setFillColor(248, 250, 252);
      doc.rect(15, custY, 180, 8, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      
      if (showGstColumns) {
        doc.text("Item Details (HSN)", 18, custY + 5.5);
        doc.text("Qty", 85, custY + 5.5);
        doc.text("Taxable", 98, custY + 5.5);
        if (isInterState) {
          doc.text("IGST", 125, custY + 5.5);
        } else {
          doc.text("CGST", 120, custY + 5.5);
          doc.text("SGST", 145, custY + 5.5);
        }
        doc.text("Total", 175, custY + 5.5);
      } else {
        doc.text("Item Details", 18, custY + 5.5);
        doc.text("Qty", 120, custY + 5.5);
        doc.text("Unit Price", 145, custY + 5.5);
        doc.text("Total", 175, custY + 5.5);
      }
      
      doc.line(15, custY + 8, 195, custY + 8);
      
      let yOffset = custY + 13;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      
      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      billItems.forEach((item) => {
        const qty = item.qty || 1;
        const amount = item.price * qty;
        const unitSuffix = UNIT_SUFFIX[resolveUnit(item, shopCategory)] || '';
        const qtyText = unitSuffix ? `${qty} ${unitSuffix}` : `${qty}`;
        
        if (showGstColumns) {
          const rate = parseInt(item.gstRate) || 0;
          const taxableVal = amount / (1 + (rate / 100));
          const taxAmt = amount - taxableVal;
          totalTaxable += taxableVal;
          
          let hsnText = item.hsnCode ? ` [${item.hsnCode}]` : '';
          const itemFullName = item.name + (item.selectedVariant ? ` (${item.selectedVariant})` : '') + hsnText;
          
          doc.text(itemFullName, 18, yOffset);
          doc.text(`${qtyText}`, 85, yOffset);
          doc.text(`${taxableVal.toFixed(2)}`, 98, yOffset);
          
          if (isInterState) {
            totalIgst += taxAmt;
            doc.text(`${taxAmt.toFixed(2)} (${rate}%)`, 125, yOffset);
          } else {
            const halfTax = taxAmt / 2;
            const halfRate = rate / 2;
            totalCgst += halfTax;
            totalSgst += halfTax;
            doc.text(`${halfTax.toFixed(2)} (${halfRate}%)`, 120, yOffset);
            doc.text(`${halfTax.toFixed(2)} (${halfRate}%)`, 145, yOffset);
          }
          doc.text(`${amount.toFixed(2)}`, 175, yOffset);
        } else {
          const itemFullName = item.name + (item.selectedVariant ? ` (${item.selectedVariant})` : '');
          doc.text(itemFullName, 18, yOffset);
          doc.text(`${qtyText}`, 120, yOffset);
          doc.text(`${item.price.toFixed(2)}`, 145, yOffset);
          doc.text(`${amount.toFixed(2)}`, 175, yOffset);
        }
        yOffset += 8;
      });
      
      doc.line(15, yOffset - 2, 195, yOffset - 2);
      yOffset += 4;
      
      // Totals
      if (showGstColumns) {
         doc.setFontSize(9);
         doc.text(`Total Taxable Value: Rs. ${totalTaxable.toFixed(2)}`, 135, yOffset);
         yOffset += 5;
         if (isInterState) {
           doc.text(`Total IGST: Rs. ${totalIgst.toFixed(2)}`, 135, yOffset);
           yOffset += 5;
         } else {
           doc.text(`Total CGST: Rs. ${totalCgst.toFixed(2)}`, 135, yOffset);
           yOffset += 5;
           doc.text(`Total SGST: Rs. ${totalSgst.toFixed(2)}`, 135, yOffset);
           yOffset += 5;
         }
      }

      if (discountAmount > 0 || manualDiscountAmt > 0) {
        doc.setFontSize(10);
        doc.text(`Subtotal: Rs. ${billTotal.toFixed(2)}`, 135, yOffset);
        yOffset += 5;
        doc.text(`Discount: -Rs. ${discountAmount.toFixed(2)}`, 135, yOffset);
        yOffset += 5;
      }
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(`GRAND TOTAL: Rs. ${total.toFixed(2)}`, 135, yOffset);
      yOffset += 12;
      
      // Footer text/Note
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      
      if (billingMode === 'estimate') {
        doc.setTextColor(217, 119, 6);
        doc.text("* Note: This is a proforma estimate/quotation and not a tax invoice. Valid for 30 days.", 15, yOffset);
      } else if (billingMode === 'challan') {
        doc.setTextColor(37, 99, 235);
        doc.text("* Note: Goods received in good condition. Not for sale. Value listed is for transit declaration.", 15, yOffset);
      } else {
        doc.text(invoiceFooter || "Thank you for your business! Visit again.", 15, yOffset);
      }

      if (loyaltyResult && billingMode === 'bill') {
        yOffset += 6;
        doc.setFontSize(8);
        doc.setTextColor(139, 92, 246);
        doc.text(`⭐ Loyalty Points: Earned +${loyaltyResult.earned} pts | Balance: ${loyaltyResult.balance} pts (10 pts = ₹1 off your next bill)`, 15, yOffset);
      }

      yOffset += 6;
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Generated via MyStore OS — mystoreos.in | Paperless Retail Revolution", 15, yOffset);
    yOffset += 4;
    doc.setFontSize(7);
    doc.setTextColor(200, 210, 220);
    doc.text("Powered by MyStore OS © " + new Date().getFullYear(), 15, yOffset);

      // Watermark on trial bills
      const isTrialBill = !user.subscriptionTier || user.subscriptionTier === 'trial' || user.subscription === 'trial' || user.subscription === 'expired';
      if (isTrialBill) {
        doc.setGState(new doc.GState({ opacity: 0.08 }));
        doc.setTextColor(220, 38, 38);
        doc.setFontSize(52);
        doc.text('TRIAL', 105, 130, { angle: 45, align: 'center' });
        doc.setGState(new doc.GState({ opacity: 0.06 }));
        doc.setFontSize(28);
        doc.text('mystoreos.in', 105, 168, { angle: 45, align: 'center' });
        doc.setGState(new doc.GState({ opacity: 1 }));
        const wY = doc.internal.pageSize.height - 10;
        doc.setFontSize(7);
        doc.setTextColor(200, 50, 50);
        doc.text('Trial Bill — Upgrade at mystoreos.in for professional invoices', 105, wY, { align: 'center' });
      }

      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], `${billingMode === 'estimate' ? 'Estimate' : (billingMode === 'challan' ? 'Challan' : 'Receipt')}.pdf`, { type: "application/pdf" });

      if (hasFeature('whatsappShare') && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: billingMode === 'estimate' ? 'Estimate / Quotation' : (billingMode === 'challan' ? 'Delivery Challan' : 'Your Receipt'),
          text: billingMode === 'estimate' ? `Here is your estimate from ${user.name}` : (billingMode === 'challan' ? `Here is your delivery challan from ${user.name}` : `Thank you for shopping at ${user.name}! Here is your bill.`),
        });
      } else if (hasFeature('whatsappShare')) {
        let msg = `*${user.name}*\n`;
        if (billingMode === 'estimate') msg += `*PROFORMA ESTIMATE / QUOTATION*\n`;
        else if (billingMode === 'challan') msg += `*DELIVERY CHALLAN*\n`;
        else msg += `*TAX INVOICE / RECEIPT*\n`;
        if (customerName) msg += `Customer: ${customerName}\n`;
        msg += `Total: Rs.${total}\n\n`;
        billItems.forEach(i => { const u = UNIT_SUFFIX[resolveUnit(i, shopCategory)]; const qd = u ? `${i.qty || 1} ${u}` : `x${i.qty || 1}`; msg += `- ${i.name} ${i.selectedVariant ? '('+i.selectedVariant+')' : ''} ${qd}: Rs.${i.price * (i.qty || 1)}\n`; });
        if (discountAmount > 0 || manualDiscountAmt > 0) msg += `Discount: -Rs.${discountAmount + manualDiscountAmt}\nTotal: Rs.${total}\n`;
        if (billingMode === 'bill' && upiId) {
          const ref = encodeURIComponent(invoiceNo ? `Ref-${invoiceNo}` : 'ORD');
          msg += `\nPay instantly via UPI: upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&am=${total}&tn=${ref}&cu=INR\n`;
        }
        await sendWhatsApp(customerPhone, msg);
      } else {
        // Starter plan: save PDF locally instead of WhatsApp share
        doc.save(`${user.name}_bill.pdf`);
        toast.info('Bill saved as PDF. Upgrade to Pro to share via WhatsApp.');
      }

      toast.success(`${billingMode === 'estimate' ? 'Estimate' : (billingMode === 'challan' ? 'Challan' : 'Bill')} generated and sent successfully!`);
      // Auto-send via WhatsApp Cloud API if configured (silent — no browser tab opened)
      if (billingMode === 'bill' && customerPhone && hasWhatsAppAPI()) {
        sendBillNotification(customerPhone, customerName || 'Customer', total, user.name, invoiceNo);
      }
      setBillItems([]);
      setDiscountAmount(0);
      setManualDiscountPct(0);
      setPromoCode('');
      setLoyaltyRedeem(0);
      setCustomerLoyaltyPoints(0);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerAddress('');
      setCustomerStateCode('');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Error saving receipt");
    }
  };

  const acceptOrder = async (orderId) => {
    const o = orders.find(ord => ord.id === orderId);
    await safe(() => api.acceptOrder(orderId));
    toast.success("Order Accepted!");
    
    // Vocal synthesis soundbox trigger
    if (o && 'speechSynthesis' in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(`MyStore received ${o.total} rupees successfully!`));
    }
    loadData();
  };

  const sales = orders.filter(o => o.status === 'Accepted' && !(o.userId || '').startsWith('estimate') && !(o.userId || '').startsWith('challan')).reduce((a, b) => a + b.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'Pending' && !(o.userId || '').startsWith('estimate') && !(o.userId || '').startsWith('challan')).length;
  const payable = credits.filter(c => !c.paid).reduce((a, b) => a + b.amount, 0);
  const billTotal = billItems.reduce((a, b) => a + (b.price * (b.qty || 1)), 0);
  const manualDiscountAmt = Math.round(billTotal * (manualDiscountPct / 100));
  const filteredProducts = products.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));

  // Predictive reorder: units sold per product in last 30 days
  const isOpenNow = useMemo(() => {
    const now = new Date();
    const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
    if (weeklyHolidays.includes(day)) return false;
    const h = now.getHours();
    return h >= openingHour && h < closingHour;
  }, [openingHour, closingHour, weeklyHolidays]);

  const salesData = useMemo(() => {    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const map = {};
    orders
      .filter(o => o.status === 'Accepted' && o.date && new Date(o.date) >= cutoff)
      .forEach(o => (o.items || []).forEach(item => { map[item.id] = (map[item.id] || 0) + (item.qty || 1); }));
    return map;
  }, [orders]);

  // Setup Camera Scanner — html5-qrcode loaded on demand
  useEffect(() => {
    if (!showScanner) return;
    let scanner = null;
    const init = async () => {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      scanner = new Html5QrcodeScanner('reader', {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        videoConstraints: { facingMode: 'environment' },
      }, false);
      scanner.render(
        (decodedText) => {
          setScannedBarcode(decodedText);
          if (showEditProductModal) setEditProdBarcode(decodedText);
          setShowScanner(false);
          scanner.clear();
          toast.success('Barcode Scanned: ' + decodedText);
          if (activeTab === 'home') {
            const foundProd = products.find(p => p.barcode === decodedText);
            if (foundProd) addToBill(foundProd);
            else toast.error('Product not found in inventory!');
          }
        },
        () => { /* ignore decode errors */ },
      );
    };
    init();
    return () => { scanner?.clear().catch(() => {}); };
  }, [showScanner, activeTab, products, addToBill, showEditProductModal]);

  const reportsData = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    
    // Cash In: accepted sales orders today + customer credits settled today
    const todaySalesOrders = orders.filter(o => 
      o.status === 'Accepted' && 
      !(o.userId || '').startsWith('estimate') && 
      !(o.userId || '').startsWith('challan') &&
      o.date && o.date.startsWith(todayStr)
    );
    const todaySalesTotal = todaySalesOrders.reduce((sum, o) => sum + o.total, 0);
    
    const todayCustSettled = customerCredits.filter(c => 
      c.paid && 
      c.date && c.date.startsWith(todayStr)
    );
    const todayCustSettledTotal = todayCustSettled.reduce((sum, c) => sum + c.amount, 0);
    
    const cashIn = todaySalesTotal + todayCustSettledTotal;
    
    // Cash Out: accepted restock orders today + distributor credits settled today
    const todayStockOrders = stockOrders.filter(so => 
      so.status === 'accepted' && 
      so.date && so.date.startsWith(todayStr)
    );
    const todayStockTotal = todayStockOrders.reduce((sum, so) => sum + so.total, 0);
    
    const todayDistSettled = credits.filter(c => 
      c.paid && 
      c.date && c.date.startsWith(todayStr)
    );
    const todayDistSettledTotal = todayDistSettled.reduce((sum, c) => sum + c.amount, 0);
    
    const cashOut = todayStockTotal + todayDistSettledTotal;
    
    // True profit = revenue minus cost of goods sold (COGS).
    // cashIn/cashOut still drive the ledger view, but "Profit Today" must
    // compare what we earned today vs what those exact items cost us.
    const productCost = Object.fromEntries((products || []).map(p => [p.id, parseFloat(p.costPrice) || 0]));
    const revenue = todaySalesTotal;
    const cogs = todaySalesOrders.reduce((sum, o) =>
      sum + (o.items || []).reduce((s, it) =>
        s + (productCost[it.id] || 0) * (it.qty || 1), 0), 0);
    const netProfit = revenue - cogs;
    const marginPercent = revenue > 0 ? Math.round(((revenue - cogs) / revenue) * 100) : 0;
    
    // Gather all ledger items for Today's Day Book
    const ledgerItems = [];
    
    todaySalesOrders.forEach(o => {
      const { name } = decodeOrderUserId(o.userId);
      ledgerItems.push({
        id: o.id,
        type: 'Cash In',
        category: 'Retail Sale',
        desc: `Sale: ${name}`,
        amount: o.total,
        time: new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });
    
    todayCustSettled.forEach(c => {
      const parts = c.desc.split(':');
      const name = parts[1] || 'Customer';
      ledgerItems.push({
        id: c.id,
        type: 'Cash In',
        category: 'Credit Settle',
        desc: `Received from ${name}`,
        amount: c.amount,
        time: new Date(c.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });
    
    todayStockOrders.forEach(so => {
      ledgerItems.push({
        id: so.id,
        type: 'Cash Out',
        category: 'Wholesale Restock',
        desc: `Bulk Purchase: ${so.items.map(i => i.name).join(', ')}`,
        amount: so.total,
        time: new Date(so.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });
    
    todayDistSettled.forEach(c => {
      ledgerItems.push({
        id: c.id,
        type: 'Cash Out',
        category: 'Supplier Paid',
        desc: `Paid Distributor: ${c.distName || 'Distributor'}`,
        amount: c.amount,
        time: new Date(c.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });
    
    // Sort ledger items by time
    ledgerItems.sort((a, b) => a.time.localeCompare(b.time));
    
    return { cashIn, cashOut, netProfit, marginPercent, ledgerItems };
  };

  const handleRestockQtyChange = (prodId, delta) => {
    setRestockCart(prev => {
      const current = prev[prodId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      }
      return { ...prev, [prodId]: next };
    });
  };

  const handlePlaceRestockOrder = async () => {
    const cartEntries = Object.entries(restockCart);
    const items = cartEntries.map(([prodId, qty]) => {
      const prod = wholesaleCatalog.find(p => p.id === prodId);
      return {
        id: prod.id,
        name: prod.name,
        price: prod.price,
        qty
      };
    });

    if (items.length === 0) return toast.error("Restock basket is empty");

    const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const firstProd = wholesaleCatalog.find(p => p.id === cartEntries[0]?.[0]);
    const distributorId = firstProd?.distributorId || null;

    try {
      await safe(() => api.placeStockOrder(targetShopId, user.name, items, total, distributorId));
      toast.success("Restock order submitted to distributor!");
      setRestockCart({});
      loadData();
    } catch {
      toast.error("Failed to place restock order");
    }
  };

  const handleOneClickRestock = async (product) => {
    if (!wholesaleCatalog || wholesaleCatalog.length === 0) {
      return toast.error("Wholesale distributor catalog is empty or offline. Please add distributor items first!");
    }
    
    // 1. Try to find a matching wholesale product by comparing names (case-insensitive substring check)
    const normalizedShopName = product.name.toLowerCase();
    
    const match = wholesaleCatalog.find(wp => 
      wp.name.toLowerCase().includes(normalizedShopName) ||
      normalizedShopName.includes(wp.name.toLowerCase())
    );
    
    if (!match) {
      // Find matching items by first word
      const firstWord = normalizedShopName.split(' ')[0];
      const partialMatch = wholesaleCatalog.find(wp => 
        wp.name.toLowerCase().includes(firstWord)
      );
      
      if (partialMatch) {
        await submitOneClickOrder(partialMatch, product.name);
      } else {
        // Fallback: order the first item in the catalog
        const fallbackMatch = wholesaleCatalog[0];
        await submitOneClickOrder(fallbackMatch, product.name);
      }
    } else {
      await submitOneClickOrder(match, product.name);
    }
  };

  const submitOneClickOrder = async (wholesaleProd) => {
    const qty = 1;
    const items = [{
      id: wholesaleProd.id,
      name: wholesaleProd.name,
      price: wholesaleProd.price,
      qty,
    }];
    const total = wholesaleProd.price * qty;

    try {
      await safe(() => api.placeStockOrder(targetShopId, user.name, items, total, wholesaleProd.distributorId || null));
      toast.success(`⚡ 1-Click Restock: Sent bulk order of "${wholesaleProd.name}" to Distributor!`);
      loadData();
    } catch {
      toast.error("Failed to place 1-click restock order");
    }
  };

  const handleSaveProduct = async () => {
    if (!newProdName || !newProdPrice) return toast.error("Name and price required");
    if (capabilities.maxProducts !== -1 && products.length >= capabilities.maxProducts) {
      return toast.error(`Starter plan limit: ${capabilities.maxProducts} products. Upgrade to Pro for unlimited.`);
    }
    try {
      await safe(() => api.addProduct(
        targetShopId,
        newProdName,
        newProdPrice,
        scannedBarcode,
        parseInt(newProdStock) || 0,
        newProdBatch,
        newProdExpiry,
        newProdVariants,
        parseInt(newProdReorder) || 10,
        { hsnCode: newProdHsnCode, gstRate: newProdGstRate, costPrice: parseFloat(newProdCostPrice) || 0, image: newProdImage, unit: newProdUnit || shopDefaultUnit }
      ));
      toast.success("Product Saved to Inventory!");
      setShowAddProductModal(false);
      setNewProdName('');
      setNewProdPrice('');
      setScannedBarcode('');
      setNewProdStock('100');
      setNewProdReorder('10');
      setNewProdBatch('');
      setNewProdExpiry('');
      setNewProdVariants('');
      setNewProdHsnCode('');
      setNewProdGstRate('0');
      setNewProdCostPrice('0');
      setNewProdImage('');
      setNewProdUnit('');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add product");
    }
  };

  const handleSettleCustomerCredit = async (creditId) => {
    if (window.confirm("Mark this customer debt as fully settled?")) {
      try {
        await safe(() => api.markCreditPaid(creditId));
        toast.success("Debt marked as settled!");
        
        const creditData = customerCredits.find(c => c.id === creditId);
        if (creditData) {
          const parts = creditData.desc.split(':');
          const doc = await generateVoucherPDF({
            id: creditId,
            partyName: parts[1] || 'Customer',
            partyPhone: parts[2] || '',
            partyDesc: parts[3] || 'Pending Balance Settlement',
            amount: creditData.amount
          }, user, true);
          doc.save(`Receipt_Voucher_${creditId}.pdf`);
        }
        
        loadData();
      } catch (e) {
        console.error(e);
        toast.error("Failed to settle debt");
      }
    }
  };

  const handleOpenReturnModal = (order) => {
    setReturnOrder(order);
    const initialItems = {};
    order.items.forEach(item => { initialItems[item.id] = 0; });
    setReturnItemsState(initialItems);
    setShowReturnModal(true);
  };

  const handleProcessReturn = async () => {
    if (!isOwner) {
      setPendingAction(() => () => executeProcessReturn());
      setShowReturnModal(false); // Hide return modal temporarily
      setShowAdminPinModal(true);
      return;
    }
    executeProcessReturn();
  };

  const executeProcessReturn = async () => {
    const itemsToReturn = returnOrder.items.filter(item => returnItemsState[item.id] > 0).map(item => ({
      ...item,
      returnQty: returnItemsState[item.id]
    }));
    
    if (itemsToReturn.length === 0) {
      setShowReturnModal(true);
      return toast.error("Select at least one item to return");
    }
    
    const refundAmount = itemsToReturn.reduce((sum, item) => sum + (item.price * item.returnQty), 0);
    
    try {
      await safe(() => api.processReturn(returnOrder.id, itemsToReturn, 'cash'));
      toast.success("Return processed successfully!");
      
      const doc = await generateCreditNotePDF(returnOrder, itemsToReturn, user, refundAmount);
      doc.save(`Credit_Note_${returnOrder.id}.pdf`);
      
      setShowReturnModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to process return");
      setShowReturnModal(true);
    }
  };

  const handleSettleSupplierCredit = async (creditId) => {
    if (window.confirm("Mark this supplier invoice as fully paid?")) {
      try {
        await safe(() => api.markCreditPaid(creditId));
        toast.success("Payment marked as settled!");
        
        const creditData = credits.find(c => c.id === creditId);
        if (creditData) {
          const doc = await generateVoucherPDF({
            id: creditId,
            partyName: creditData.distName || 'Distributor',
            partyPhone: '',
            partyDesc: 'Invoice Settlement',
            amount: creditData.amount
          }, user, false);
          doc.save(`Payment_Voucher_${creditId}.pdf`);
        }
        
        loadData();
      } catch (e) {
        console.error(e);
        toast.error("Failed to settle supplier payment");
      }
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffPhone || !newStaffName) return toast.error("Phone and Name required");
    try {
      await safe(() => api.addStaff(targetShopId, newStaffPhone, '1234', newStaffName));
      toast.success("Staff member added! PIN is 1234.");
      setNewStaffName('');
      setNewStaffPhone('');
      loadData();
    } catch(err) {
      toast.error(err.message);
    }
  };

  const handleGrabLocation = () => {
    if (!navigator.geolocation) {
      return toast.error("Geolocation is not supported by your browser");
    }
    toast.info("Connecting to Satellites...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        toast.success("GPS Location successfully captured & locked!");
      },
      () => {
        toast.warn("GPS request rejected. Using default location.");
        setLatitude(16.3067);
        setLongitude(80.4365);
      }
    );
  };

  const downloadQrPoster = async () => {
    const { jsPDF: JsPDF } = await import('jspdf');
    const doc = new JsPDF();
    doc.setFillColor(15, 23, 42); // slate-900 background
    doc.rect(0, 0, 210, 297, 'F');
    
    // Gradient outline border representation (Amber / Orange)
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(3);
    doc.rect(10, 10, 190, 277);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text(user.name.toUpperCase(), 105, 40, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("OFFICIAL MYSTORE PAPERLESS NODE", 105, 55, { align: 'center' });
    
    doc.setFillColor(255, 255, 255);
    doc.rect(45, 80, 120, 120, 'F');
    
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("SCAN THIS QR TO BROWSE & PAY INSTANTLY", 105, 220, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(245, 158, 11);
    doc.text("GPay • PhonePe • Paytm • WhatsApp Order", 105, 235, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Generated by MyStore OS — mystoreos.in", 105, 240, { align: 'center' });
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(10);
    doc.text("Powered by MyStore OS - The Paperless Retail Revolution", 105, 270, { align: 'center' });
    
    const svgElement = document.querySelector('.qr-code-holder svg');
    if (svgElement) {
      const xml = new XMLSerializer().serializeToString(svgElement);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const b64Start = 'data:image/svg+xml;base64,';
      const image64 = b64Start + svg64;
      const img = new Image();
      img.src = image64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svgElement.clientWidth || 200;
        canvas.height = svgElement.clientHeight || 200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        doc.addImage(pngUrl, 'PNG', 55, 90, 100, 100);
        doc.save(`${user.name}_Store_Poster.pdf`);
        toast.success("Printable PDF downloaded successfully!");
      };
    } else {
      doc.save(`${user.name}_Store_Poster.pdf`);
      toast.success("Printable PDF downloaded successfully!");
    }
  };

  const downloadQrPng = () => {
    const svgElement = document.querySelector('.qr-code-holder svg');
    if (!svgElement) return toast.error('QR code not visible');
    const xml = new XMLSerializer().serializeToString(svgElement);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + svg64;
    img.onload = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${user.name}_QR.png`;
      a.click();
      toast.success('QR downloaded as PNG');
    };
  };

  const handleSaveProfile = async () => {
    await safe(() => api.updateProfile(user.id, {
      upiId, logo, shopPhotos, paymentQr,
      latitude: parseFloat(latitude) || null,
      longitude: parseFloat(longitude) || null,
      gstin, stateCode, businessAddress
    }));
    const updatedUser = { 
      ...user, upiId, logo, shopPhotos, paymentQr, 
      latitude: parseFloat(latitude) || null, 
      longitude: parseFloat(longitude) || null,
      gstin, stateCode, businessAddress
    };
    try { localStorage.setItem('mystore_session', JSON.stringify(updatedUser)); } catch (_e) { /* ignore */ }
    toast.success("Profile Updated successfully!");
  };

  const handleSaveShopHours = async () => {
    await safe(() => api.updateProfile(user.id, { openingHour, closingHour, weeklyHolidays }));
    toast.success('Shop hours saved!');
  };

  const handleSaveShopBanner = async () => {
    await safe(() => api.updateProfile(user.id, { shopBanner }));
    toast.success(shopBanner?.active ? '🏷️ Banner is live!' : 'Banner saved (inactive)');
  };

  const handleSetDailyTarget = async (targetAmount) => {    const val = parseInt(targetAmount) || 0;
    setDailyTarget(val);
    await safe(() => api.saveSiteConfig('dailyTarget_' + targetShopId, val));
  };

  const handleSetFlashSale = async (productId, discountPct, durationHours) => {
    try {
      await safe(() => api.setFlashSale(targetShopId, productId, discountPct, durationHours));
      const updated = await safe(() => api.getFlashSales(targetShopId));
      setFlashSales(updated);
      toast.success(`🔥 Flash sale set — ${discountPct}% off for ${durationHours}h!`);
    } catch (_e) {
      toast.error('Failed to set flash sale');
    }
  };

  const handleClearFlashSale = async (productId) => {
    try {
      await safe(() => api.clearFlashSale(targetShopId, productId));
      setFlashSales(prev => { const n = { ...prev }; delete n[productId]; return n; });
      toast.success('Flash sale cleared');
    } catch (_e) {
      toast.error('Failed to clear flash sale');
    }
  };

  const handleBulkCsvImport = async (rows) => {
    let success = 0, failed = 0;
    for (const row of rows) {
      try {
        await safe(() => api.addProduct(targetShopId, {
          name: row.name,
          price: parseFloat(row.price) || 0,
          stock: parseInt(row.stock) || 0,
          reorderLevel: parseInt(row.reorderLevel) || 10,
          hsnCode: row.hsnCode || '',
          gstRate: row.gstRate || '0',
          batchNumber: row.batchNumber || '',
          expiryDate: row.expiryDate || '',
          variants: row.variants || '',
        }));
        success++;
      } catch (_e) {
        failed++;
      }
    }
    toast.success(`Imported ${success} product${success !== 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}!`);
    loadData();
  };

  const handleStockAdjust = async (product, delta, reason) => {
    const newStock = Math.max(0, (product.stock || 0) + delta);
    try {
      await safe(() => api.editProduct(product.id, { stock: newStock }));
      toast.success(`${product.name}: stock ${delta > 0 ? '+' + delta : delta} → ${newStock} (${reason})`);
      loadData();
    } catch (_e) {
      toast.error('Failed to adjust stock');
    }
  };

  const handleSaveInvoiceSettings = async () => {
    try {
      await safe(() => api.saveSiteConfig('invoiceFooter_' + targetShopId, invoiceFooter));
      await safe(() => api.saveSiteConfig('invPrefix_' + targetShopId, invoicePrefix));
      toast.success("Invoice settings saved!");
    } catch (_e) {
      toast.error("Failed to save invoice settings");
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await safe(() => api.uploadAsset(file, user.id, 'logos'));
        setLogo(url);
        toast.success("Logo uploaded successfully!");
      } catch {
        toast.error("Failed to upload logo");
      }
    }
  };

  const handleLogoChange = async (base64) => {
    setLogo(base64);
    await safe(() => api.updateProfile(user.id, { logo: base64 }));
    toast.success('Logo updated!');
  };

  const handleLogoRemove = async () => {
    setLogo('');
    await safe(() => api.updateProfile(user.id, { logo: '' }));
    toast.success('Logo removed');
  };

  const handleNewProdImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
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

  const handleShopPhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (shopPhotos.length + files.length > 6) return toast.error('Maximum 6 photos allowed');
    
    for (const file of files) {
      try {
        const url = await safe(() => api.uploadAsset(file, user.id, 'shop_photos'));
        setShopPhotos(prev => [...prev, url]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    toast.success("Photos uploaded successfully!");
  };

  const removeShopPhoto = (index) => {
    setShopPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const getShopUrl = () => {
    return `https://mystoreos.in/s/${targetShopId}`;
  };

  const handleShareShop = async () => {
    const url = getShopUrl();
    const msg = `Check out ${user.name} on MyStore OS!\n${url}`;
    
    // Attempt clipboard copying first for seamless UX
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Shop link copied to clipboard! 📋");
      }
    } catch (err) {
      console.warn("Failed to copy link to clipboard automatically:", err);
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: user.name, text: msg, url });
      } catch (shareErr) {
        // Safe fallback to WhatsApp if the user aborts or browser sharing fails
        if (shareErr && shareErr.name !== 'AbortError') {
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        }
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const handleToggleHideFromSearch = async (val) => {
    setHideFromSearch(val);
    try {
      await api.updateProfile(user.id, { hideFromSearch: val });
      toast.success(val ? '🔒 Store hidden — customers cannot find you in search' : '✅ Store is now visible to nearby customers');
    // Force refresh so customer app picks it up immediately
    setHideFromSearch(val);
    } catch { toast.error('Failed to save visibility setting'); }
  };

  const handleShowUpiQr = () => {
    if (paymentQr || upiId) {
      setShowPaymentQrModal(true);
      return;
    }
    toast.error('Upload your Payment QR or set UPI ID in Settings!');
  };

  const handlePaymentQrUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await safe(() => api.uploadAsset(file, user.id, 'payment_qrs'));
        setPaymentQr(url);
        toast.success("Payment QR uploaded successfully!");
      } catch {
        toast.error("Failed to upload Payment QR");
      }
    }
  };

  const handleUpdateRazorpay = async (key) => {
    const updated = { ...sysSettings, razorpayKey: key };
    await safe(() => api.saveSettings(updated));
    setSysSettings(updated);
    toast.success('Razorpay key saved.');
  };

  const handleSubscribe = async (plan) => {
    if (!plan) return;
    if (!sysSettings.razorpayKey) {
      return toast.error("Admin has not configured Razorpay yet.");
    }

    // Create server-side Razorpay order for signature verification
    let orderId = null;
    try {
      const orderData = await safe(() => api.createRazorpayOrder(plan.id, plan.price));
      orderId = orderData?.orderId;
    } catch (_e) {
      // Edge function not deployed yet — fall back to client-only flow
    }

    const options = {
      key: sysSettings.razorpayKey,
      amount: (plan.price * 100).toString(),
      currency: "INR",
      name: "MyStore OS",
      description: `${plan.name} Subscription`,
      ...(orderId ? { order_id: orderId } : {}),
      image: logo || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=128&q=80",
      handler: async function (response) {
        try {
          await safe(() => api.verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId: plan.id,
            userId: targetShopId,
          }));
          toast.success(`Payment successful! Upgrading to ${plan.name}...`);
          const updatedUser = await safe(() => api.updateProfile(targetShopId, {
            subscription: 'active',
            subscriptionTier: plan.id
          }));
          setUser(updatedUser);
          localStorage.setItem('mystore_session', JSON.stringify(updatedUser));
          setShowPlanSelectorModal(false);
          if (user.phone) sendPaymentConfirmation(user.phone, user.name, plan.name, plan.price);
        } catch (_e) {
          toast.error(`Upgrade failed. Contact support with ID: ${response.razorpay_payment_id}`);
        }
      },
      prefill: { name: user.name, contact: user.phone },
      theme: { color: "#4F46E5" }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const getAnnounceColor = () => {
    switch(announceConfig.type) {
      case 'warning': return '#4F46E5';
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  const styles = {
    bg: { backgroundColor: '#F4F5F7', minHeight: '100vh', color: '#0F172A', paddingBottom: '80px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
    header: { background: '#0F172A', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    statRow: { display: 'flex', gap: '8px', padding: '12px', overflowX: 'auto' },
    statBox: { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', flex: 1, minWidth: '80px', padding: '12px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    statNum: { fontSize: '22px', fontWeight: '800', color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", margin: 0 },
    statLabel: { fontSize: '11px', color: '#64748B', fontWeight: '600', margin: 0 },
    searchBar: { margin: '12px', display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', borderRadius: '8px', padding: '0 12px' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '0 12px' },
    gridBtn: { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
    gridIcon: { color: '#4F46E5' },
    gridTitle: { fontSize: '12px', fontWeight: '700', color: '#0F172A', margin: 0 },
    gridSub: { fontSize: '10px', color: '#64748B', margin: 0 },
    section: { margin: '16px 12px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    sectionHeader: { backgroundColor: '#F8FAFC', padding: '12px', fontSize: '14px', fontWeight: 'bold', color: '#0F172A', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '8px' },
    whatsappBtn: { backgroundColor: '#22c55e', color: 'white', width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer' },
    upiBtn: { backgroundColor: '#4F46E5', color: 'white', width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer' },
    prodItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E5E7EB' },
    orderCard: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px', margin: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    navBtn: { textAlign: 'center', cursor: 'pointer' }
  };

  if (!isMobile) {
    return (
      <div className="enterprise-wrapper" style={{ backgroundColor: '#F4F5F7', color: '#0F172A', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <ToastContainer theme="dark" position="top-center" />
        {isExpired && isOwner && (
          <TrialExpiredOverlay planLabel={planLabel} onUpgrade={() => setShowPlanSelectorModal(true)} />
        )}
        {deviceLimitExceeded && isOwner && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ maxWidth: '440px', width: '100%', background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '20px', padding: '36px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>📱</div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '800', color: 'white' }}>Device Limit Reached</h2>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
                Your <b style={{ color: 'white' }}>{planLabel}</b> allows up to <b style={{ color: '#fbbf24' }}>{capabilities?.maxDevices ?? 1} active device{(capabilities?.maxDevices ?? 1) > 1 ? 's' : ''}</b>.
                You have {activeSessions.length} device{activeSessions.length !== 1 ? 's' : ''} logged in.
              </p>
              <p style={{ margin: '0 0 24px 0', fontSize: '12px', color: '#64748b' }}>
                Sign out from your other devices, or force this device in by revoking all other sessions.
              </p>
              <button onClick={forceRevokeOthers} style={{ width: '100%', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none', padding: '13px', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', marginBottom: '10px' }}>
                Use This Device (Revoke Others)
              </button>
              <button onClick={() => setShowPlanSelectorModal(true)} style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #818CF8)', color: 'white', border: 'none', padding: '13px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                Upgrade for More Devices →
              </button>
            </div>
          </div>
        )}

        {/* GLOBAL ANNOUNCEMENT BANNER */}
        {announceConfig.active && announceConfig.text && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: getAnnounceColor(), color: '#fff', padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 60 }}>
            <div style={{ flex: 1 }}>{announceConfig.text}</div>
            <button onClick={() => setAnnounceConfig({...announceConfig, active: false})} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center' }}><X size={16} /></button>
          </div>
        )}

        <DesktopTopBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOwner={isOwner}
          pendingOrders={pendingOrders}
          handleLogout={handleLogout}
          userName={user.name}
          syncStatus={{ isOnline, pendingCount }}
        />

        <div className="enterprise-main" style={{ marginTop: announceConfig.active && announceConfig.text ? '40px' : '0px' }}>
          {activeTab === 'home' && (
            <DesktopPOS 
              products={products}
              filteredProducts={filteredProducts}
              billItems={billItems}
              customItemName={customItemName}
              setCustomItemName={setCustomItemName}
              customItemPrice={customItemPrice}
              setCustomItemPrice={setCustomItemPrice}
              billingMode={billingMode}
              setBillingMode={setBillingMode}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerGstin={customerGstin}
              setCustomerGstin={setCustomerGstin}
              customerAddress={customerAddress}
              setCustomerAddress={setCustomerAddress}
              customerStateCode={customerStateCode}
              setCustomerStateCode={setCustomerStateCode}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              discountAmount={discountAmount}
              manualDiscountPct={manualDiscountPct}
              setManualDiscountPct={setManualDiscountPct}
              manualDiscountAmt={manualDiscountAmt}
              billTotal={billTotal}
              search={search}
              setSearch={setSearch}
              pendingOrders={pendingOrders}
              sales={sales}
              payable={payable}
              isOwner={isOwner}
              setShowScanner={setShowScanner}
              handleShowUpiQr={handleShowUpiQr}
              addCustomItem={addCustomItem}
              updateBillItemQty={updateBillItemQty}
              updateBillItemVariant={updateBillItemVariant}
              removeBillItem={removeBillItem}
              applyPromoCode={applyPromoCode}
              sendWhatsAppBill={sendWhatsAppBill}
              addToBill={addToBill}
              setActiveTab={setActiveTab}
              setShowAddProductModal={setShowAddProductModal}
              loyaltyEnabled={loyaltyEnabled}
              customerLoyaltyPoints={customerLoyaltyPoints}
              loyaltyRedeem={loyaltyRedeem}
              setLoyaltyRedeem={setLoyaltyRedeem}
              dailyTarget={dailyTarget}
              handleSetDailyTarget={handleSetDailyTarget}
              flashSales={flashSales}
              shopCategory={shopCategory}
            />
          )}

          {/* Refer & Earn — shown at bottom of home tab */}
          {activeTab === 'home' && isOwner && (
            <ReferAndEarnCard userId={user?.id} userName={user?.name} />
          )}

          {activeTab === 'products' && isOwner && (
            <DesktopInventory
              products={products}
              setShowAddProductModal={setShowAddProductModal}
              checkExpiryStatus={checkExpiryStatus}
              handleOneClickRestock={handleOneClickRestock}
              handleOpenEditModal={handleOpenEditModal}
              handleDeleteProduct={handleDeleteProduct}
              handleBulkCsvImport={handleBulkCsvImport}
              flashSales={flashSales}
              handleSetFlashSale={handleSetFlashSale}
              handleClearFlashSale={handleClearFlashSale}
              handleStockAdjust={handleStockAdjust}
              salesData={salesData}
              shopCategory={shopCategory}
            />
          )}

          {activeTab === 'customers' && isOwner && (
            <DesktopCustomers
              orders={orders}
              targetShopId={targetShopId}
            />
          )}

          {activeTab === 'expenses' && isOwner && (
            <DesktopExpenses
              targetShopId={targetShopId}
              orders={orders}
            />
          )}

          {activeTab === 'bills' && (
            <DesktopBills 
              orders={orders}
              billsSubTab={billsSubTab}
              setBillsSubTab={setBillsSubTab}
              handleConvertEstimateToBill={handleConvertEstimateToBill}
              acceptOrder={acceptOrder}
              handleOpenReturnModal={handleOpenReturnModal}
              decodeOrderUserId={decodeOrderUserId}
              user={user}
              products={products}
            />
          )}

          {activeTab === 'credit' && isOwner && (
            <DesktopCredit 
              creditTabSub={creditTabSub}
              setCreditTabSub={setCreditTabSub}
              custCreditName={custCreditName}
              setCustCreditName={setCustCreditName}
              custCreditPhone={custCreditPhone}
              setCustCreditPhone={setCustCreditPhone}
              custCreditDesc={custCreditDesc}
              setCustCreditDesc={setCustCreditDesc}
              custCreditAmount={custCreditAmount}
              setCustCreditAmount={setCustCreditAmount}
              credits={credits}
              customerCredits={customerCredits}
              payable={payable}
              upiId={upiId || user?.upiId}
              user={user}
              handleAddCustomerCredit={handleAddCustomerCredit}
              handleSettleSupplierCredit={handleSettleSupplierCredit}
              handleSettleCustomerCredit={handleSettleCustomerCredit}
              sendCustomerCreditReminder={sendCustomerCreditReminder}
            />
          )}

          {activeTab === 'restock' && isOwner && (
            <DesktopRestock 
              wholesaleCatalog={wholesaleCatalog}
              restockCart={restockCart}
              stockOrders={stockOrders}
              handleRestockQtyChange={handleRestockQtyChange}
              handlePlaceRestockOrder={handlePlaceRestockOrder}
              user={user}
            />
          )}

          {activeTab === 'reports' && isOwner && (
            <DesktopReports
              reportsData={reportsData}
              orders={orders}
              downloadTallyXML={downloadTallyXML}
              user={user}
              credits={credits}
              customerCredits={customerCredits}
              stockOrders={stockOrders}
              dailyTarget={dailyTarget}
              products={products}
            />
          )}

          {activeTab === 'profile' && isOwner && (
            <DesktopSettings 
              user={user}
              gstin={gstin}
              setGstin={setGstin}
              stateCode={stateCode}
              setStateCode={setStateCode}
              businessAddress={businessAddress}
              setBusinessAddress={setBusinessAddress}
              upiId={upiId}
              setUpiId={setUpiId}
              logo={logo}
              handleLogoUpload={handleLogoUpload}
              onLogoChange={handleLogoChange}
              onLogoRemove={handleLogoRemove}
              shopPhotos={shopPhotos}
              handleShopPhotoUpload={handleShopPhotoUpload}
              removeShopPhoto={removeShopPhoto}
              latitude={latitude}
              setLatitude={setLatitude}
              longitude={longitude}
              setLongitude={setLongitude}
              handleGrabLocation={handleGrabLocation}
              handleSaveProfile={handleSaveProfile}
              getShopUrl={getShopUrl}
              downloadQrPoster={downloadQrPoster}
              downloadQrPng={downloadQrPng}
              handleShareShop={handleShareShop}
              staffList={staffList}
              newStaffName={newStaffName}
              setNewStaffName={setNewStaffName}
              newStaffPhone={newStaffPhone}
              setNewStaffPhone={setNewStaffPhone}
              handleAddStaff={handleAddStaff}
              sysSettings={sysSettings}
              setSysSettings={setSysSettings}
              handleUpdateRazorpay={handleUpdateRazorpay}
              plans={plans}
              setShowPlanSelectorModal={setShowPlanSelectorModal}
              paymentHistory={paymentHistory}
              invoiceFooter={invoiceFooter}
              setInvoiceFooter={setInvoiceFooter}
              invoicePrefix={invoicePrefix}
              setInvoicePrefix={setInvoicePrefix}
              handleSaveInvoiceSettings={handleSaveInvoiceSettings}
              hideFromSearch={hideFromSearch}
              onToggleHideFromSearch={handleToggleHideFromSearch}
              openingHour={openingHour}
              setOpeningHour={setOpeningHour}
              closingHour={closingHour}
              setClosingHour={setClosingHour}
              weeklyHolidays={weeklyHolidays}
              setWeeklyHolidays={setWeeklyHolidays}
              shopBanner={shopBanner}
              setShopBanner={setShopBanner}
              handleSaveShopHours={handleSaveShopHours}
              handleSaveShopBanner={handleSaveShopBanner}
            />
          )}
        </div>

        {/* Global Modals for Desktop */}
        {showPaymentQrModal && (paymentQr || upiId) && (
          <div onClick={() => setShowPaymentQrModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '24px', padding: '32px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px', fontWeight: 800 }}>{user.name}</h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Scan to Pay • ₹{billTotal > 0 ? billTotal : '0'}</p>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block' }}>
                {paymentQr ? (
                  <img src={paymentQr} alt="Payment QR" style={{ width: '240px', height: '240px', objectFit: 'contain' }} />
                ) : (
                  <QRCodeSVG
                    value={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name || '')}&am=${billTotal || 0}&tn=Bill&cu=INR`}
                    size={240}
                  />
                )}
              </div>
              <p style={{ color: '#22c55e', fontSize: '12px', marginTop: '16px', fontWeight: 'bold' }}>GPay • PhonePe • Paytm • Any UPI App</p>
              <div style={{ textAlign: 'center', marginTop: '8px', padding: '4px 10px', background: 'rgba(79,70,229,0.08)', borderRadius: '8px', display: 'inline-block' }}>
                <span style={{ fontSize: '10px', color: '#4F46E5', fontWeight: '700' }}>MyStore OS</span>
                <span style={{ fontSize: '9px', color: '#64748b' }}> • mystoreos.in</span>
              </div>
              <button onClick={() => setShowPaymentQrModal(false)} style={{ marginTop: '24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '12px 32px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
                Close
              </button>
            </div>
          </div>
        )}

        {showScanner && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
              <div id="reader" style={{ width: '100%' }}></div>
              <button onClick={() => setShowScanner(false)} style={{ width: '100%', padding: '16px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>Cancel Scan</button>
            </div>
          </div>
        )}

        {showReturnModal && returnOrder && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
            <div style={{ background: '#1e293b', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '24px', border: '1px solid #ef4444' }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                Process Sales Return
                <span onClick={() => setShowReturnModal(false)} style={{ cursor: 'pointer', color: '#94a3b8' }}>✕</span>
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>Select the quantity to return for each item in Order #{returnOrder.id.substring(0,8)}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '40vh', overflowY: 'auto', paddingRight: '4px' }}>
                {returnOrder.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#fbbf24' }}>₹{item.price} x {item.qty}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => setReturnItemsState(prev => ({...prev, [item.id]: Math.max(0, prev[item.id] - 1)}))} style={{ background: '#334155', color: '#fff', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer' }}>-</button>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{returnItemsState[item.id] || 0}</span>
                      <button onClick={() => setReturnItemsState(prev => ({...prev, [item.id]: Math.min(item.qty, (prev[item.id] || 0) + 1)}))} style={{ background: '#334155', color: '#fff', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', color: '#ef4444' }}>
                  <span>Total Refund:</span>
                  <span>₹{returnOrder.items.reduce((sum, item) => sum + (item.price * (returnItemsState[item.id] || 0)), 0).toFixed(2)}</span>
                </div>
                <button onClick={handleProcessReturn} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                  Confirm Return & Generate Credit Note
                </button>
              </div>
            </div>
          </div>
        )}

        {showAdminPinModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#1e293b', width: '100%', maxWidth: '350px', borderRadius: '16px', padding: '30px', border: '2px solid #ef4444', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#ef4444' }}>Admin Authorization Required</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>This action is restricted. Please ask the shop owner to enter their Admin PIN to proceed.</p>
              
              <input 
                type="password" 
                placeholder="Enter Admin PIN" 
                value={adminPinInput} 
                onChange={e => setAdminPinInput(e.target.value)} 
                style={{ padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '20px', width: '100%', textAlign: 'center', letterSpacing: '8px', marginBottom: '16px' }} 
              />
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setShowAdminPinModal(false); setAdminPinInput(''); setPendingAction(null); }} style={{ flex: 1, background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAdminPinSubmit} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Authorize</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD PRODUCT MODAL — desktop */}
        {showAddProductModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: '#1e293b', width: '100%', maxWidth: '560px', borderRadius: '20px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>📦 Add Product to Inventory</h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
                <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
                  <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Cost Price (₹)</label>
                  <input type="number" value={newProdCostPrice} onChange={e => setNewProdCostPrice(e.target.value)} placeholder="e.g. 8" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Stock Qty</label>
                  <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Min Stock Alert</label>
                  <input type="number" value={newProdReorder} onChange={e => setNewProdReorder(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Batch Number</label>
                  <input type="text" value={newProdBatch} onChange={e => setNewProdBatch(e.target.value)} placeholder="e.g. B-901" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Expiry Date</label>
                  <input type="date" value={newProdExpiry} onChange={e => setNewProdExpiry(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Variants (comma-separated)</label>
                <input type="text" value={newProdVariants} onChange={e => setNewProdVariants(e.target.value)} placeholder="e.g. Red, Blue or Small, Medium" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Selling Unit</label>
                <select value={newProdUnit || shopDefaultUnit} onChange={e => setNewProdUnit(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }}>
                  {unitOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>Default for your shop type: <b style={{ color: '#94a3b8' }}>{shopDefaultUnit}</b></p>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                  <input type="text" value={newProdHsnCode} onChange={e => setNewProdHsnCode(e.target.value)} placeholder="e.g. 1905" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate (%)</label>
                  <select value={newProdGstRate} onChange={e => setNewProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }}>
                    <option value="0">0% (Exempt)</option>
                    <option value="3">3%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Barcode (Optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={scannedBarcode} onChange={e => setScannedBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ flex: 1, padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                {scannedBarcode && (
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                    <Barcode value={scannedBarcode} height={40} width={2} fontSize={14} />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Product Photo (Optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="file" accept="image/*" id="new-prod-img-desktop" style={{ display: 'none' }} onChange={handleNewProdImage} />
                  <label htmlFor="new-prod-img-desktop" style={{ cursor: 'pointer' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: '#0f172a', border: '2px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {newProdImage ? <img src={newProdImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} /> : <span style={{ fontSize: '28px' }}>📸</span>}
                    </div>
                  </label>
                  {newProdImage && (
                    <button onClick={() => setNewProdImage('')} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Remove</button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleSaveProduct} style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Product</button>
                <button onClick={() => { setShowAddProductModal(false); setNewProdImage(''); }} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid #334155', padding: '14px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      {showPlanSelectorModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '900px',
            padding: isMobile ? '20px' : '32px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
            position: 'relative',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowPlanSelectorModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '18px'
              }}
            >
              ×
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <span style={{
                background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
                color: 'white',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                padding: '4px 12px',
                borderRadius: '20px',
                letterSpacing: '1px',
                display: 'inline-block',
                marginBottom: '10px'
              }}>
                MyStore OS SaaS pricing
              </span>
              <h2 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', margin: '0 0 8px 0', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Select Your Business Growth Plan
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Unlock high-fidelity retail tools: barcode compliance, direct GST invoicing, CA Ledger access, and multi-staff lock-outs.
              </p>
            </div>

            {/* Plans Container */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: '20px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {plans.map(plan => {
                const isCurrent = user.subscriptionTier === plan.id && user.subscription === 'active';
                const isPopular = plan.id === 'pro' || plan.name.toLowerCase().includes('pro');
                return (
                  <div 
                    key={plan.id}
                    style={{
                      background: isPopular ? 'linear-gradient(180deg, rgba(79, 70, 229, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)' : 'rgba(30, 41, 59, 0.25)',
                      border: isPopular ? '2px solid #4F46E5' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '20px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      position: 'relative',
                      boxShadow: isPopular ? '0 12px 32px rgba(79, 70, 229, 0.15)' : 'none'
                    }}
                  >
                    {isPopular && (
                      <span style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        padding: '4px 10px',
                        borderRadius: '10px',
                        letterSpacing: '0.5px'
                      }}>
                        Most Popular Choice
                      </span>
                    )}

                    <div>
                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{plan.name}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#cbd5e1', minHeight: '32px' }}>{plan.description}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: '800', color: '#fff' }}>₹{plan.price}</span>
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>/ month</span>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: 0 }} />

                    {/* Features checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
                      {plan.features?.map((feat, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{feat}</span>
                        </div>
                      ))}
                    </div>

                    {isCurrent ? (
                      <button 
                        disabled
                        style={{
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#94a3b8',
                          padding: '12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'not-allowed'
                        }}
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleSubscribe(plan)}
                        style={{
                          width: '100%',
                          background: isPopular ? 'linear-gradient(90deg, #4F46E5, #818CF8)' : 'white',
                          color: isPopular ? 'white' : '#0f172a',
                          border: 'none',
                          padding: '12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        Subscribe
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
              🔒 Secure, encrypted transactions powered by Razorpay PG. Cancel or downgrade anytime instantly.
            </div>
          </div>
        </div>
      )}

      </div>
    );
  }

  return (
    <div style={styles.bg}>
      <ToastContainer theme="dark" position="top-center" />
      
      {/* GLOBAL ANNOUNCEMENT BANNER */}
      {announceConfig.active && announceConfig.text && (
        <div style={{ background: getAnnounceColor(), color: '#fff', padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>{announceConfig.text}</div>
          <button onClick={() => setAnnounceConfig({...announceConfig, active: false})} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center' }}><X size={16} /></button>
        </div>
      )}
      
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 12, height: 12, background: 'white', borderRadius: '50%' }}></div>
            MyStore Pro
          </h2>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>{user.name}</p>
          <span style={{ display: 'inline-block', marginTop: '4px', background: isOpenNow ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: isOpenNow ? '#4ade80' : '#f87171', border: `1px solid ${isOpenNow ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>
            {isOpenNow ? '● Open Now' : `● Closed`}
          </span>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', width: 'auto', flexShrink: 0 }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      {isOwner && isOnTrial && !trialBannerDismissed && (
        <div style={{ background: trialDaysLeft >= 5 ? 'linear-gradient(90deg,#16a34a,#15803d)' : trialDaysLeft >= 3 ? 'linear-gradient(90deg,#d97706,#b45309)' : 'linear-gradient(90deg,#dc2626,#b91c1c)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
            ⏰ {trialDaysLeft === 0 ? 'Trial ends today!' : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your free trial`}
            {trialDaysLeft <= 3 && <span style={{ marginLeft: '8px', opacity: 0.9, fontWeight: 400, fontSize: '12px' }}>— Upgrade to keep your data & features</span>}
          </span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => setShowPlanSelectorModal(true)} style={{ background: '#fff', color: trialDaysLeft >= 5 ? '#16a34a' : trialDaysLeft >= 3 ? '#d97706' : '#dc2626', border: 'none', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Upgrade →
            </button>
            <button onClick={() => { sessionStorage.setItem(`mystore_trial_banner_dismissed_${user.id}`, '1'); setTrialBannerDismissed(true); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontFamily: 'Outfit,sans-serif' }}>×</button>
          </div>
        </div>
      )}

      {activeTab === 'home' && (
        <>
          {/* Offer Banner */}
          {shopBanner?.active && shopBanner?.title && (
            <div style={{ margin: '0 12px 12px', background: 'linear-gradient(135deg,#4F46E5,#4F46E5)', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#fff' }}>🏷️ {shopBanner.title}</div>
                {shopBanner.subtitle && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginTop: '3px' }}>{shopBanner.subtitle}</div>}
              </div>
              {shopBanner.discountPercent > 0 && (
                <div style={{ flexShrink: 0, background: '#fff', color: '#4F46E5', borderRadius: '10px', padding: '6px 14px', fontWeight: 900, fontSize: '18px' }}>{shopBanner.discountPercent}% OFF</div>
              )}
            </div>
          )}

          {/* AI Insights Card */}
          {products.filter(p => p.stock < 10).length > 0 && (
            <div style={{ margin: '12px', background: 'linear-gradient(145deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))', border: '1px solid #ef4444', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#fca5a5' }}>AI Inventory Warning</h4>
                <p style={{ margin: 0, fontSize: '11px', color: '#f87171' }}>
                  You are running low on <b>{products.filter(p => p.stock < 10).map(p => p.name).join(', ')}</b>. Based on your weekend sales trend, you will run out by Sunday.
                </p>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div style={styles.statRow}>
            <div style={styles.statBox} onClick={() => setActiveTab('bills')}><p style={{...styles.statNum, color: pendingOrders > 0 ? '#ef4444' : '#4F46E5'}}>{pendingOrders}</p><p style={styles.statLabel}>New Orders</p></div>
            {isOwner && <div style={styles.statBox}><p style={styles.statNum}>₹{sales}</p><p style={styles.statLabel}>Revenue</p></div>}
            <div style={styles.statBox} onClick={() => setActiveTab('products')}><p style={styles.statNum}>{products.length}</p><p style={styles.statLabel}>Products</p></div>
            {isOwner && <div style={styles.statBox}><p style={styles.statNum}>₹{payable}</p><p style={styles.statLabel}>Credit Due</p></div>}
          </div>

          {/* Search */}
          <div style={styles.searchBar}>
            <Search size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search products to bill..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', margin: 0, boxShadow: 'none', width: '100%', padding: '12px', color:'white', outline:'none' }} 
            />
          </div>

          {/* Action Grid */}
          <div style={styles.grid}>
            <div style={styles.gridBtn} onClick={() => setShowScanner(true)}>
              <ScanLine size={24} color="#94a3b8" />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Scan Bill</p><p style={styles.gridSub}>స్కాన్ బిల్</p></div>
            </div>
            {isOwner && (
              <div style={styles.gridBtn} onClick={() => { setActiveTab('products'); setShowAddProductModal(true); }}>
                <Plus size={24} color="#4F46E5" />
                <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Add Product</p><p style={styles.gridSub}>కొత్త వస్తువు</p></div>
              </div>
            )}
            <div style={styles.gridBtn} onClick={handleShowUpiQr}>
              <IndianRupee size={24} color="#f59e0b" />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Receive Pay</p><p style={styles.gridSub}>UPI QR</p></div>
            </div>
            {isOwner && (
              <div style={styles.gridBtn} onClick={() => setActiveTab('credit')}>
                <Book size={24} color="#f59e0b" />
                <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Credit Book</p><p style={styles.gridSub}>బకాయిలు</p></div>
              </div>
            )}
            <div style={styles.gridBtn} onClick={() => setActiveTab('bills')}>
              <Receipt size={24} color={pendingOrders > 0 ? "#ef4444" : "#94a3b8"} />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>All Bills</p><p style={styles.gridSub}>అన్ని బిల్లులు</p></div>
            </div>
            <div style={styles.gridBtn} onClick={handleShareShop}>
              <Share2 size={24} color="#ef4444" />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Share Shop</p><p style={styles.gridSub}>Share Link</p></div>
            </div>
          </div>

          {/* Quick Bill */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <Receipt size={16} /> Quick Bill
            </div>
            <div style={{ padding: '16px' }}>
              
              {/* Billing Mode Selector */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button 
                  onClick={() => setBillingMode('bill')} 
                  style={{ 
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto',
                    border: '1px solid ' + (billingMode === 'bill' ? '#10b981' : '#2a2f3d'),
                    background: billingMode === 'bill' ? 'rgba(16,185,129,0.15)' : '#1e222d',
                    color: billingMode === 'bill' ? '#10b981' : '#cbd5e1'
                  }}
                >
                  🟢 Standard Bill
                </button>
                <button 
                  onClick={() => setBillingMode('estimate')} 
                  style={{ 
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto',
                    border: '1px solid ' + (billingMode === 'estimate' ? '#4F46E5' : '#2a2f3d'),
                    background: billingMode === 'estimate' ? 'rgba(245,158,17,0.15)' : '#1e222d',
                    color: billingMode === 'estimate' ? '#4F46E5' : '#cbd5e1'
                  }}
                >
                  🟡 Estimate / Quote
                </button>
                <button 
                  onClick={() => setBillingMode('challan')} 
                  style={{ 
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto',
                    border: '1px solid ' + (billingMode === 'challan' ? '#3b82f6' : '#2a2f3d'),
                    background: billingMode === 'challan' ? 'rgba(59,130,246,0.15)' : '#1e222d',
                    color: billingMode === 'challan' ? '#3b82f6' : '#cbd5e1'
                  }}
                >
                  🔵 Delivery Challan
                </button>
              </div>

              {/* Customer details row */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid #2a2f3d', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8' }}>
                    👤 Customer Details { (billingMode === 'estimate' || billingMode === 'challan') && <span style={{ color: '#4F46E5' }}>(Recommended)</span> }
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Customer Name" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                  <input 
                    type="tel" 
                    placeholder="Mobile Number" 
                    value={customerPhone} 
                    onChange={e => setCustomerPhone(e.target.value)}
                    style={{ width: '130px', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="GSTIN (Optional)" 
                    value={customerGstin} 
                    onChange={e => setCustomerGstin(e.target.value.toUpperCase())}
                    style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                  <input 
                    type="text" 
                    placeholder="State Code" 
                    value={customerStateCode} 
                    onChange={e => setCustomerStateCode(e.target.value)}
                    style={{ width: '90px', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                <div style={{ marginTop: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Billing Address (Optional)" 
                    value={customerAddress} 
                    onChange={e => setCustomerAddress(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Universal Custom Billing Input */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                <input 
                  type="text" placeholder="Item Name (e.g. Haircut)" value={customItemName} onChange={e=>setCustomItemName(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '14px' }} 
                />
                <input 
                  type="number" placeholder="₹" value={customItemPrice} onChange={e=>setCustomItemPrice(e.target.value)}
                  style={{ width: '60px', background: 'transparent', border: 'none', color: '#4F46E5', outline: 'none', fontSize: '14px', fontWeight: 'bold' }} 
                />
                <button onClick={addCustomItem} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: 'auto', flexShrink: 0 }}>Add</button>
              </div>

              {/* Cart List */}
              {billItems.length === 0 ? (
                <p style={{color:'#94a3b8', fontSize:13, margin: '12px 0 20px 0', textAlign: 'center'}}>No items in bill yet. Add custom item or tap + below.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0 20px 0' }}>
                  {billItems.map((item, idx) => {
                    const variantList = item.variants ? item.variants.split(',').map(v => v.trim()) : [];
                    return (
                      <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2a2f3d' }}>
                        <div style={{ flex: 1, marginRight: '8px' }}>
                          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{item.name}</p>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold' }}>₹{item.price}</span>
                            {variantList.length > 0 && (
                              <select 
                                value={item.selectedVariant || ''} 
                                onChange={(e) => updateBillItemVariant(item.id, e.target.value)}
                                style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px', fontSize: '11px', padding: '2px 4px', outline: 'none' }}
                              >
                                {variantList.map((v, vidx) => (
                                  <option key={vidx} value={v}>{v}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => updateBillItemQty(item.id, -1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 22, height: 22, minWidth: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>-</button>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '16px', textAlign: 'center' }}>{item.qty || 1}</span>
                          <button onClick={() => updateBillItemQty(item.id, 1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 22, height: 22, minWidth: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>+</button>
                          
                          <span style={{ fontWeight: 'bold', color: '#22c55e', minWidth: '55px', textAlign: 'right', fontSize: '13px' }}>₹{item.price * (item.qty || 1)}</span>
                          
                          <button onClick={() => removeBillItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', width: 'auto', flexShrink: 0 }}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Promo Discount Code Drawer */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', background: '#0f172a', padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Promo Code (WELCOME10 / FLAT100)" 
                  value={promoCode} 
                  onChange={e=>setPromoCode(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '13px' }} 
                />
                <button onClick={applyPromoCode} style={{ background: '#4F46E5', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', width: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>Apply</button>
              </div>

              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#22c55e', marginTop: '8px', padding: '0 4px' }}>
                  <span>Discount Applied:</span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #2a2f3d', paddingTop: '16px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#4F46E5' }}>TOTAL</span>
                <div>
                  {discountAmount > 0 && <span style={{ fontSize: '14px', color: '#94a3b8', textDecoration: 'line-through', marginRight: '8px' }}>₹{billTotal}</span>}
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4F46E5' }}>₹{Math.max(0, billTotal - discountAmount)}</span>
                </div>
              </div>
              <button style={{...styles.whatsappBtn, background: billingMode === 'estimate' ? '#fbbf24' : (billingMode === 'challan' ? '#2563eb' : '#22c55e'), color: billingMode === 'estimate' ? '#000' : '#fff', opacity: billItems.length ? 1 : 0.5}} onClick={sendWhatsAppBill}>
                <span style={{ fontSize: '18px' }}>💬</span> {billingMode === 'estimate' ? 'Generate Estimate' : (billingMode === 'challan' ? 'Generate Challan' : 'Generate Bill')}
              </button>
              <button style={styles.upiBtn} onClick={handleShowUpiQr}>
                <QrCode size={16} /> Show UPI QR for Payment
              </button>
            </div>
          </div>

          {/* Quick Add Products */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <Package size={16} /> Quick Add Products
            </div>
            <div>
              {filteredProducts.map(p => (
                <div key={p.id} style={styles.prodItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 32, height: 32, background: '#334155', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={16} color="#94a3b8" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>{p.name}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>₹{p.price}</p>
                    </div>
                  </div>
                  <button style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto', flexShrink: 0 }} onClick={() => addToBill(p)}>+ Add</button>
                </div>
              ))}
              {filteredProducts.length === 0 && <p style={{padding:16, color:'#94a3b8', fontSize:14, margin:0}}>No products found.</p>}
            </div>
          </div>
        </>
      )}

      {/* ORDERS / BILLS TAB */}
      {activeTab === 'bills' && (
        <div style={{paddingBottom: 40}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d', display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <h2 style={{margin:0, fontSize: 18}}>Online Orders & Bills</h2>
            
            {/* Glassmorphic Sub-tab toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => setBillsSubTab('sales')}
                style={{
                  flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                  background: billsSubTab === 'sales' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: billsSubTab === 'sales' ? '#22c55e' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
              >
                🟢 Sales Invoices
              </button>
              <button 
                onClick={() => setBillsSubTab('drafts')}
                style={{
                  flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                  background: billsSubTab === 'drafts' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: billsSubTab === 'drafts' ? '#fbbf24' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
              >
                🟡 Drafts (Estimates / Challans)
              </button>
            </div>
          </div>

          {(() => {
            const filteredOrders = orders.filter(o => {
              const isDraft = o.userId.startsWith('estimate') || o.userId.startsWith('challan');
              return billsSubTab === 'sales' ? !isDraft : isDraft;
            });

            if (filteredOrders.length === 0) {
              return <p style={{padding: 40, textAlign:'center', color:'#94a3b8'}}>No {billsSubTab === 'sales' ? 'sales invoices' : 'drafts'} found.</p>;
            }

            return filteredOrders.map(o => {
              const { type, name, phone } = decodeOrderUserId(o.userId);
              
              // Custom borders/accents for draft cards
              let cardBorder = '1px solid #334155';
              let cardBg = 'linear-gradient(145deg, #1e293b, #0f172a)';
              let badgeText = '';
              let badgeColor = '';
              
              if (billsSubTab === 'drafts') {
                if (type === 'estimate') {
                  cardBorder = '1px solid rgba(245,158,11,0.4)';
                  cardBg = 'linear-gradient(145deg, #241d13, #0f172a)';
                  badgeText = 'Draft Estimate';
                  badgeColor = '#4F46E5';
                } else if (type === 'challan') {
                  cardBorder = '1px solid rgba(59,130,246,0.4)';
                  cardBg = 'linear-gradient(145deg, #131c2d, #0f172a)';
                  badgeText = 'Delivery Challan';
                  badgeColor = '#3b82f6';
                }
              }

              return (
                <div key={o.id} style={{ ...styles.orderCard, border: cardBorder, background: cardBg }}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:12, alignItems: 'center'}}>
                    <div>
                      <span style={{fontWeight:'bold', fontSize: '15px'}}>{name}</span>
                      {phone && <p style={{margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8'}}>Ph: {phone}</p>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {badgeText && (
                        <span style={{ fontSize: '10px', background: badgeColor + '20', color: badgeColor, padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                          {badgeText}
                        </span>
                      )}
                      <span style={{color: o.status === 'Pending' ? '#ef4444' : '#22c55e', fontWeight:'bold', fontSize: 13}}>
                        {o.status === 'Pending' ? '⚠️ Pending' : '✅ Accepted'}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{background:'rgba(0,0,0,0.2)', padding:12, borderRadius:8, marginBottom:12}}>
                    {o.items.map((item, idx) => (
                      <div key={idx} style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4, color:'#94a3b8'}}>
                        <span>{item.qty}x {item.name} {item.selectedVariant ? `(${item.selectedVariant})` : ''}</span>
                        <span>₹{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontSize:18, fontWeight:'bold', color:'#fbbf24'}}>₹{o.total}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setSelectedOrder(o)} style={{background:'#3b82f6', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', width: 'auto', flexShrink: 0}}>
                        View Receipt
                      </button>
                      
                      {billsSubTab === 'drafts' && type === 'estimate' && (
                        <button onClick={() => handleConvertEstimateToBill(o)} style={{background:'linear-gradient(135deg, #fbbf24, #d97706)', color:'#000', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', flexShrink: 0}}>
                          ⚡ Convert to Bill
                        </button>
                      )}

                      {o.status === 'Pending' && (
                        <button onClick={() => acceptOrder(o.id)} style={{background:'#22c55e', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', width: 'auto', flexShrink: 0}}>
                          Accept
                        </button>
                      )}
                      
                      {o.status === 'Accepted' && (
                        <button onClick={() => handleOpenReturnModal(o)} style={{background:'#ef4444', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', flexShrink: 0}}>
                          ↩️ Return
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* THERMAL RECEIPT MODAL */}
      {selectedOrder && (() => {
        const { type, name, phone } = decodeOrderUserId(selectedOrder.userId);
        let receiptTitle = 'TAX INVOICE';
        if (type === 'estimate') receiptTitle = 'ESTIMATE / QUOTE';
        else if (type === 'challan') receiptTitle = 'DELIVERY CHALLAN';

        return (
          <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', width: '100%', maxWidth: '320px', borderRadius: '4px', padding: '24px', color: '#000', fontFamily: 'monospace', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflowY: 'auto', maxHeight: '90vh' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', textTransform: 'uppercase' }}>{user.name}</h2>
                <p style={{ margin: 0, fontSize: '12px' }}>Ph: {user.phone}</p>
                <p style={{ margin: 0, fontSize: '12px' }}>{new Date(selectedOrder.date).toLocaleString()}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', fontWeight: 'bold' }}>{receiptTitle} #{selectedOrder.id.split('_')[1]}</p>
              </div>
              
              {(name || phone) && (
                <div style={{ borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px', fontSize: '11px' }}>
                  <p style={{ margin: '0 0 2px 0' }}><b>Customer:</b> {name || 'Walk-in'}</p>
                  {phone && <p style={{ margin: 0 }}><b>Phone:</b> {phone}</p>}
                </div>
              )}
              
              <div style={{ minHeight: '80px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>
                  <span>ITEM</span>
                  <span>AMT</span>
                </div>
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>{item.qty}x {item.name} {item.selectedVariant ? `(${item.selectedVariant})` : ''}</span>
                    <span>₹{item.price * item.qty}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                <span>TOTAL</span>
                <span>₹{selectedOrder.total}</span>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px' }}>
                {type === 'estimate' ? (
                  <p style={{ margin: 0 }}>* Proforma Estimate Only *</p>
                ) : type === 'challan' ? (
                  <p style={{ margin: 0 }}>* Delivery Challan Only *</p>
                ) : (
                  <p style={{ margin: 0 }}>Thank you for your business!</p>
                )}
                <p style={{ margin: '4px 0 0 0' }}>Powered by MyStore OS</p>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                <button onClick={() => { document.getElementById('print-area') && window.print(); }} style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Print</button>
                <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRODUCTS INVENTORY TAB */}
      {activeTab === 'products' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{margin:0, fontSize: 18}}>Inventory</h2>
            <button onClick={() => setShowAddProductModal(true)} style={{background:'#3b82f6', color:'white', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:'bold', cursor:'pointer'}}>+ Add New</button>
          </div>
          
          {products.length === 0 && <p style={{padding: 20, textAlign:'center', color:'#94a3b8'}}>No products in inventory.</p>}
          
          <div style={{ padding: '12px' }}>
            {products.map(p => {
              const expStatus = checkExpiryStatus(p.expiryDate);
              const isLowStock = p.stock < (p.reorderLevel || 10);
              
              return (
                <div key={p.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{p.name}</h3>
                      {p.batchNumber && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Batch: {p.batchNumber}</p>
                      )}
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#4F46E5' }}>₹{p.price}</span>
                  </div>

                  {/* Stock & Reorder Info */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
                    <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: isLowStock ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: isLowStock ? '#ef4444' : '#10b981', border: '1px solid ' + (isLowStock ? '#ef4444' : '#10b981'), fontWeight: 'bold' }}>
                      Stock: {p.stock || 0} {isLowStock && ' (Low Stock)'}
                    </span>
                    {p.reorderLevel !== undefined && (
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                        Min Stock Alert: {p.reorderLevel}
                      </span>
                    )}
                    {expStatus.status === 'expired' && (
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444', fontWeight: 'bold' }}>
                        {expStatus.text} ({p.expiryDate})
                      </span>
                    )}
                    {expStatus.status === 'near' && (
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.2)', color: '#4F46E5', border: '1px solid #f59e0b', fontWeight: 'bold' }}>
                        {expStatus.text} ({p.expiryDate})
                      </span>
                    )}
                    {p.variants && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {p.variants.split(',').map((v, vidx) => (
                          <span key={vidx} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: '#334155', color: '#cbd5e1' }}>
                            {v.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {p.barcode && (
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '8px', display: 'inline-block', marginTop: '4px', marginBottom: '8px' }}>
                      <Barcode value={p.barcode} height={20} width={1.2} fontSize={10} margin={0} displayValue={true} />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #2a2f3d', paddingTop: '12px', marginTop: '12px' }}>
                    <button 
                      onClick={() => handleOneClickRestock(p)} 
                      style={{ 
                        background: isLowStock ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.05)', 
                        border: isLowStock ? 'none' : '1px solid rgba(255,255,255,0.15)', 
                        color: isLowStock ? '#000' : '#fff', 
                        padding: '6px 12px', 
                        borderRadius: '6px', 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        cursor: 'pointer',
                        boxShadow: isLowStock ? '0 4px 10px rgba(245,158,11,0.2)' : 'none'
                      }}
                    >
                      ⚡ {isLowStock ? '1-Click Restock' : 'Restock'}
                    </button>
                    <button 
                      onClick={() => handleOpenEditModal(p)} 
                      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(p.id)} 
                      style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREDIT LEDGER TAB */}
      {activeTab === 'credit' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d', display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <h2 style={{margin:0, fontSize: 18}}>Credit Book (బకాయిలు)</h2>
            
            {/* Toggle Payable vs Receivable */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => setCreditTabSub('payable')}
                style={{
                  flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                  background: creditTabSub === 'payable' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: creditTabSub === 'payable' ? '#ef4444' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
              >
                💸 Supplier Payables (₹{payable})
              </button>
              <button 
                onClick={() => setCreditTabSub('receivable')}
                style={{
                  flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                  background: creditTabSub === 'receivable' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: creditTabSub === 'receivable' ? '#10b981' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
              >
                🟢 Customer Receivables (₹{customerCredits.filter(c => !c.paid).reduce((sum, c) => sum + c.amount, 0)})
              </button>
            </div>
          </div>
          
          <div style={{ padding: '16px' }}>
            {creditTabSub === 'payable' ? (
              <>
                <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '12px', padding: '20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', fontWeight: 'bold' }}>TOTAL SUPPLIER OUTSTANDING</p>
                    <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#fff' }}>₹{payable}</h3>
                  </div>
                  <Wallet size={32} color="#ef4444" opacity={0.5} />
                </div>

                <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Recent Deliveries / Credits</h3>
                {credits.length === 0 && <p style={{color:'#94a3b8', fontSize: '13px'}}>No distributor credit records found.</p>}
                
                {credits.map(c => (
                  <div key={c.id} style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{c.distName || 'Distributor'}</span>
                      <span style={{ fontWeight: 'bold', color: c.paid ? '#22c55e' : '#ef4444' }}>
                        {c.paid ? '✅ Settled' : '⏳ Unpaid'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
                      <span>{new Date(c.date).toLocaleDateString()}</span>
                      <span>Invoice: #{c.id.split('_')[1]}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '12px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbf24' }}>₹{c.amount}</span>
                      {!c.paid && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => {
                            if (!upiId) return toast.error('No UPI ID set. Go to Settings.');
                            window.open(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&am=${c.amount}&tn=${encodeURIComponent('Credit-' + (c.id||'').slice(0,8))}&cu=INR`, '_blank');
                          }} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                            Pay UPI
                          </button>
                          <button onClick={() => handleSettleSupplierCredit(c.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                            ✅ Settle & Generate Note
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ background: '#1e293b', border: '1px solid #10b981', borderRadius: '12px', padding: '20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>TOTAL CUSTOMER OUTSTANDING</p>
                    <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#fff' }}>₹{customerCredits.filter(c => !c.paid).reduce((sum, c) => sum + c.amount, 0)}</h3>
                  </div>
                  <Wallet size={32} color="#10b981" opacity={0.5} />
                </div>

                {/* Add New Customer Credit Form */}
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Log New Customer Credit / Debt</h3>
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" value={custCreditName} onChange={e => setCustCreditName(e.target.value)} 
                        placeholder="Customer Name" 
                        style={{ flex: 1, padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                      />
                      <input 
                        type="tel" value={custCreditPhone} onChange={e => setCustCreditPhone(e.target.value)} 
                        placeholder="Mobile (Optional)" 
                        style={{ width: '130px', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                      />
                    </div>
                    <input 
                      type="text" value={custCreditDesc} onChange={e => setCustCreditDesc(e.target.value)} 
                      placeholder="Reason (e.g. Milk & Eggs)" 
                      style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                    />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="number" value={custCreditAmount} onChange={e => setCustCreditAmount(e.target.value)} 
                        placeholder="Outstanding Amount (₹)" 
                        style={{ flex: 1, padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                      />
                      <button onClick={handleAddCustomerCredit} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                        + Add Debt
                      </button>
                    </div>
                  </div>
                </div>

                <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Customer Outstanding Book</h3>
                {customerCredits.length === 0 && <p style={{color:'#94a3b8', fontSize: '13px'}}>No customer debt records logged yet.</p>}
                
                {customerCredits.map(c => {
                  const parts = c.desc.split(':');
                  const custName = parts[1] || 'Customer';
                  const custPhone = parts[2] || '';
                  const custDesc = parts[3] || 'Credit Purchase';
                  
                  return (
                    <div key={c.id} style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{custName}</span>
                          {custPhone && <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Ph: {custPhone}</p>}
                        </div>
                        <span style={{ fontWeight: 'bold', color: c.paid ? '#22c55e' : '#4F46E5' }}>
                          {c.paid ? '✅ Settled' : '⏳ Pending'}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '12px', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '6px' }}>
                        <b>Remarks:</b> {custDesc}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
                        <span>Logged: {new Date(c.date).toLocaleDateString()}</span>
                        <span>Reference: #{c.id.split('_')[1]}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '12px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbf24' }}>₹{c.amount}</span>
                        {!c.paid && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => sendCustomerCreditReminder(c)} style={{ background: '#25D366', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              💬 Remind
                            </button>
                            <button onClick={() => handleSettleCustomerCredit(c.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                              ✅ Settle
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* RESTOCKING SUPPLY TAB */}
      {isOwner && activeTab === 'restock' && (
        <div style={{ paddingBottom: 80 }}>
          <div style={{ background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d' }}>
            <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={20} color="#3b82f6" /> Supply & Wholesale Restock
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Order wholesale goods on credit directly from FMCG Distributors.</p>
          </div>
          
          <div style={{ padding: '16px' }}>
            {/* AI low stock indicator list */}
            {products.filter(p => p.stock < 10).length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#ef4444', fontWeight: 'bold' }}>⚠️ CRITICAL LOW STOCK</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {products.filter(p => p.stock < 10).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#cbd5e1' }}>{p.name}</span>
                      <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Only {p.stock} left!</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Restock Basket Panel */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>🛒 Restock Basket</h3>
              {Object.keys(restockCart).length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Your basket is empty. Add bulk products from the catalog below.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {Object.entries(restockCart).map(([prodId, qty]) => {
                      const prod = wholesaleCatalog.find(p => p.id === prodId);
                      if (!prod) return null;
                      return (
                        <div key={prodId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#cbd5e1' }}>
                          <span>{prod.name} (x{qty})</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: '#22c55e', marginRight: '8px' }}>₹{prod.price * qty}</span>
                            <button onClick={() => handleRestockQtyChange(prodId, -1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                            <button onClick={() => handleRestockQtyChange(prodId, 1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '12px', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Basket Total</span>
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#fbbf24' }}>
                      ₹{Object.entries(restockCart).reduce((sum, [prodId, qty]) => {
                        const prod = wholesaleCatalog.find(p => p.id === prodId);
                        return sum + (prod ? prod.price * qty : 0);
                      }, 0)}
                    </span>
                  </div>
                  <button onClick={handlePlaceRestockOrder} style={{ width: '100%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                    📦 Order Supplies on Credit
                  </button>
                </>
              )}
            </div>

            {/* Wholesale Catalog List */}
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '12px' }}>📦 FMCG Wholesale Catalog</h3>
            {wholesaleCatalog.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No wholesale suppliers found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {wholesaleCatalog.map(p => (
                  <div key={p.id} style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '9px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>{p.category}</span>
                      <h4 style={{ margin: '6px 0 2px 0', fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>{p.name}</h4>
                      <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Wholesale Price: <span style={{ color: '#22c55e', fontWeight: 'bold' }}>₹{p.price}</span></p>
                    </div>
                    <button onClick={() => handleRestockQtyChange(p.id, 1)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      + Add Bulk
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORTS & ANALYTICS TAB */}
      {isOwner && activeTab === 'reports' && (() => {
        const { cashIn, cashOut, netProfit, marginPercent, ledgerItems } = reportsData();
        
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        const displayPercent = Math.min(100, Math.max(0, Math.abs(marginPercent)));
        const strokeOffset = circumference - (displayPercent / 100) * circumference;
        const isLoss = netProfit < 0;
        const strokeColor = isLoss ? '#ef4444' : '#10b981';

        return (
          <div style={{paddingBottom: 80}}>
            <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d'}}>
              <h2 style={{margin:0, fontSize: 18}}>Retail Day Book & Reports</h2>
              <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>Today's profitability, Cash-In vs Cash-Out ledger.</p>
            </div>
            
            <div style={{ padding: '16px' }}>
              
              {/* Profit & Loss Margin Gauge */}
              <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '16px', padding: '24px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
                
                {/* Circular Gauge */}
                <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Background Track */}
                    <circle 
                      cx="65" cy="65" r={radius} 
                      fill="transparent" stroke="#1e222d" strokeWidth="10" 
                    />
                    {/* Animated Filled Track */}
                    <circle 
                      cx="65" cy="65" r={radius} 
                      fill="transparent" stroke={strokeColor} strokeWidth="10" 
                      strokeDasharray={circumference} strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                    />
                  </svg>
                  
                  {/* Text Center */}
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: strokeColor }}>
                      {isLoss ? '-' : '+'}{displayPercent}%
                    </h4>
                    <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {isLoss ? 'Loss Margin' : 'Net Margin'}
                    </p>
                  </div>
                </div>

                {/* Margins Data Summary */}
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: isLoss ? '#fca5a5' : '#a7f3d0' }}>
                    {isLoss ? '🔴 Loss Today: ' : '🟢 Profit Today: '} ₹{Math.abs(netProfit)}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#cbd5e1' }}>Total Cash In Today:</span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>₹{cashIn}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#cbd5e1' }}>Total Cash Out Today:</span>
                      <span style={{ color: '#ef4444', fontWeight: 'bold' }}>₹{cashOut}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* MONTHLY CASH FLOW CHART */}
              {(() => {
                const now = new Date();
                const monthLabels = Array.from({ length: 6 }, (_, i) => {
                  const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
                  return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('default', { month: 'short' }) };
                });
                const cashFlowMonths = monthLabels.map(({ key, label }) => {
                  const income = orders.filter(o => ['completed','Completed','Accepted','accepted'].includes(o.status) && (o.date || o.createdAt || '').startsWith(key))
                    .reduce((s, o) => s + Number(o.total || o.totalAmount || 0), 0);
                  const expenses = stockOrders.filter(so => ['accepted','Accepted'].includes(so.status) && (so.date || so.createdAt || '').startsWith(key))
                    .reduce((s, so) => s + Number(so.total || 0), 0);
                  return { label, income, expenses, profit: income - expenses };
                });
                const thisMonth = cashFlowMonths[cashFlowMonths.length - 1];
                const totalIncome = cashFlowMonths.reduce((s, m) => s + m.income, 0);
                const totalExpenses = cashFlowMonths.reduce((s, m) => s + m.expenses, 0);
                const totalProfit = totalIncome - totalExpenses;
                const margin = totalIncome > 0 ? Math.round((totalProfit / totalIncome) * 100) : 0;
                return (
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>📊 6-Month Cash Flow</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' }}>
                      {[
                        { label: 'This Month Income', value: `₹${thisMonth.income.toLocaleString('en-IN')}`, color: '#10b981' },
                        { label: 'This Month Expenses', value: `₹${thisMonth.expenses.toLocaleString('en-IN')}`, color: '#ef4444' },
                        { label: 'Net Profit (6m)', value: `₹${totalProfit.toLocaleString('en-IN')}`, color: totalProfit >= 0 ? '#10b981' : '#ef4444' },
                        { label: 'Profit Margin (6m)', value: `${margin}%`, color: margin >= 20 ? '#10b981' : margin >= 0 ? '#4F46E5' : '#ef4444' },
                      ].map(c => (
                        <div key={c.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px' }}>
                          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{c.label}</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: c.color }}>{c.value}</div>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={cashFlowMonths} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v > 999 ? `${(v/1000).toFixed(0)}k` : v} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }} formatter={(v, n) => [`₹${Number(v).toLocaleString('en-IN')}`, n === 'income' ? 'Income' : 'Expenses']} />
                        <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* TALLY EXPORT PANEL */}
              <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #10b981', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>📊 Tally ERP / Prime Export</h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Export Tally XML, GSTR-1 CSV, or Monthly Summary for your CA.</p>
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setTallyMenuOpen(v => !v)}
                    style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📥 Export ▾
                  </button>
                  {tallyMenuOpen && (
                    <div style={{ position: 'absolute', right: 0, top: '44px', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', zIndex: 200, minWidth: '200px', overflow: 'hidden' }}
                      onMouseLeave={() => setTallyMenuOpen(false)}>
                      {[
                        { label: '📥 Tally XML', action: () => { downloadTallyXML(orders.filter(o => o.status === 'completed'), user.name); setTallyMenuOpen(false); } },
                        { label: '📋 GSTR-1 CSV', action: () => { downloadCSV(generateGSTR1CSV(orders.filter(o => o.status === 'completed'), user.gstNumber), `GSTR1_${new Date().toISOString().slice(0,10)}.csv`); setTallyMenuOpen(false); } },
                        { label: '📊 Monthly Summary', action: () => { downloadCSV(generateMonthlySummaryCSV(orders.filter(o => o.status === 'completed')), `Summary_${new Date().toISOString().slice(0,10)}.csv`); setTallyMenuOpen(false); } },
                      ].map(item => (
                        <button key={item.label} onClick={item.action} style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: '#f8fafc', padding: '12px 16px', textAlign: 'left', fontSize: '13px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Day Book Transactions List */}
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📖 Today's Retail Day Book Ledger
                </h3>
                
                {ledgerItems.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px 0', margin: 0 }}>No transactions logged today yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {ledgerItems.map((item, idx) => (
                      <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #2a2f3d' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', background: item.type === 'Cash In' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: item.type === 'Cash In' ? '#10b981' : '#ef4444', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                              {item.category}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.time}</span>
                          </div>
                          <p style={{ margin: '6px 0 0 0', fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{item.desc}</p>
                        </div>
                        <span style={{ fontWeight: 'bold', color: item.type === 'Cash In' ? '#10b981' : '#ef4444', fontSize: '15px' }}>
                          {item.type === 'Cash In' ? '+' : '-'}₹{item.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* Profile & Settings TAB */}
      {isOwner && activeTab === 'profile' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d'}}>
            <h2 style={{margin:0, fontSize: 18}}>Shop Profile & Payments</h2>
          </div>
          <div style={{ padding: '16px' }}>

            {/* SaaS Subscription Info Card */}
            <div style={{ background: 'linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.9))', border: `1px solid ${isOnTrial ? 'rgba(245,158,11,0.4)' : 'rgba(139,92,246,0.3)'}`, borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: `0 8px 32px ${isOnTrial ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.1)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>⚡ Subscription</h3>
                <span style={{ background: isOnTrial ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)', color: isOnTrial ? '#fbbf24' : '#10b981', fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700 }}>
                  {isOnTrial ? `Trial — ${trialDaysLeft}d left` : 'Active'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>PLAN</div>
                  <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 700 }}>{planLabel}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>{isOnTrial ? 'DAYS LEFT' : 'RENEWS IN'}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: isOnTrial && trialDaysLeft <= 2 ? '#ef4444' : isOnTrial && trialDaysLeft <= 4 ? '#4F46E5' : '#10b981' }}>
                    {isOnTrial ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}` : paidDaysLeft !== null ? `${paidDaysLeft}d` : '—'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>PRODUCTS</div>
                  <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 700 }}>
                    {products.length}{(capabilities?.maxProducts ?? 200) === -1 ? ' / ∞' : ` / ${capabilities?.maxProducts ?? 200}`}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>PRICE</div>
                  <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 700 }}>
                    {plans?.find(p => p.id === (user.subscriptionTier || user.subscription))
                      ? `₹${plans.find(p => p.id === (user.subscriptionTier || user.subscription)).price}/mo`
                      : isOnTrial ? 'Free' : '—'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowPlanSelectorModal(true)}
                style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #818CF8)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'Outfit,sans-serif' }}
              >
                {isOnTrial ? '⚡ Upgrade Plan Now' : '🔄 Change Plan'}
              </button>
            </div>

            {/* Logo Upload Section */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🖼️ Shop Logo</h3>
              {logo ? (
                <img src={logo} alt="Shop Logo" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6', marginBottom: '12px' }} />
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#0f172a', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No Logo</div>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'block', margin: '0 auto', fontSize: '12px', color: '#94a3b8' }} />
            </div>

            {/* GST & Tax Compliance Section */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🏛️ GST & Compliance Setup</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>Configure these details to generate formal B2B and B2C GST invoices for your customers.</p>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Shop GSTIN</label>
                  <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="e.g. 29ABCDE1234F2Z5" style={{ width: '100%', padding: '12px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>State Code</label>
                  <input type="text" value={stateCode} onChange={e => setStateCode(e.target.value)} placeholder="e.g. 29" style={{ width: '100%', padding: '12px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Business Address (printed on invoice)</label>
                <textarea value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="Enter full shop address..." rows={3} style={{ width: '100%', padding: '12px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px', resize: 'vertical' }}></textarea>
              </div>

              <button onClick={handleSaveProfile} style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Save Business Info
              </button>
            </div>

            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>💳 Setup UPI Payments</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                Enter your shop's UPI ID (PhonePe, GPay, Paytm) below. When customers order online, their payment app will automatically open with your UPI ID and the exact bill amount.
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>Your UPI ID</label>
                <input 
                  type="text" value={upiId} onChange={e => setUpiId(e.target.value)} 
                  placeholder="e.g. 9876543210@ybl" 
                  style={{ width: '100%', padding: '14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} 
                />
              </div>
              <button onClick={handleSaveProfile} style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Save Payment Settings
              </button>
            </div>

            {/* Payment QR Scanner Upload */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff' }}>📱 Payment QR Scanner</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                Upload your GPay / PhonePe / Paytm QR code image. Customers will see this QR to pay you instantly. You can take a photo of your existing QR or upload from gallery.
              </p>
              {paymentQr ? (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <img src={paymentQr} alt="Payment QR" style={{ width: '200px', height: '200px', objectFit: 'contain', borderRadius: '12px', border: '2px solid #22c55e', background: '#fff', padding: '8px' }} />
                  <p style={{ fontSize: '11px', color: '#22c55e', marginTop: '8px', fontWeight: 'bold' }}>✅ Payment QR Active</p>
                  <button onClick={() => setPaymentQr('')} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}>
                    Remove QR
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '150px', height: '150px', borderRadius: '12px', background: '#0f172a', margin: '0 auto 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: '2px dashed #334155' }}>
                    <Camera size={32} style={{ marginBottom: '8px' }} />
                    <span style={{ fontSize: '12px' }}>No QR uploaded</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <label style={{ flex: 1, background: '#3b82f6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
                  📁 Upload from Gallery
                  <input type="file" accept="image/*" onChange={handlePaymentQrUpload} style={{ display: 'none' }} />
                </label>
                <label style={{ flex: 1, background: '#4F46E5', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
                  📷 Take Photo
                  <input type="file" accept="image/*" capture="environment" onChange={handlePaymentQrUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* Shop Photos Section */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>📸 Shop Photos (Max 6)</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>Upload photos of your shop, products, and services. These will show on your public shop profile.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                {shopPhotos.map((photo, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img src={photo} alt={`Shop ${idx+1}`} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #334155' }} />
                    <button onClick={() => removeShopPhoto(idx)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', lineHeight: '20px', padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
              {shopPhotos.length < 6 && (
                <input type="file" accept="image/*" multiple onChange={handleShopPhotoUpload} style={{ display: 'block', fontSize: '12px', color: '#94a3b8' }} />
              )}
            </div>

            {/* Shop GPS Location Capture */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>📍 Shop Geolocation</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                Lock your store GPS coordinates so nearby customers can discover your store and order online directly!
              </p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Latitude</label>
                  <input type="text" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 16.3067" style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Longitude</label>
                  <input type="text" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 80.4365" style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                </div>
              </div>
              
              <button onClick={handleGrabLocation} style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #6d28d9)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>
                🛰️ Auto-Grab Live Shop Coordinates
              </button>
              
              <button onClick={handleSaveProfile} style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Commit Coordinates to System
              </button>
            </div>

            {/* Shop Link & QR */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🔗 Your Printable Shop QR Poster</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                Generate and download a high-contrast printable poster. Stick it on your shop wall so customers can scan, order, and pay instantly!
              </p>
              <div className="qr-code-holder" style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
                <QRCodeSVG value={getShopUrl()} size={140} />
              </div>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 'bold', color: '#3b82f6', wordBreak: 'break-all' }}>{getShopUrl()}</p>
              
              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <button onClick={downloadQrPng} style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🖼️ Download QR Code (PNG)
                </button>
                <button onClick={downloadQrPoster} style={{ width: '100%', background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#000', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🖨️ Download Printable QR Poster (PDF)
                </button>
                <button onClick={handleShareShop} style={{ width: '100%', background: '#25D366', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  📤 Share Shop Link via WhatsApp
                </button>
              </div>
            </div>

            {/* LANGUAGE SELECTOR CARD */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff' }}>🌐 Language / భాష / भाषा</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { code: 'en', label: 'English', native: 'English' },
                  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
                  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
                  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
                  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
                  { code: 'mr', label: 'Marathi', native: 'मराठी' },
                  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
                ].map(({ code, label, native }) => (
                  <button
                    key={code}
                    onClick={() => setLocale(code)}
                    style={{
                      padding: '10px 8px', borderRadius: '8px', border: `1px solid ${locale === code ? '#3b82f6' : '#334155'}`,
                      background: locale === code ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: locale === code ? '#60a5fa' : '#94a3b8',
                      fontSize: '12px', fontWeight: locale === code ? 700 : 400, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{native}</span>
                    <span style={{ fontSize: '10px', opacity: 0.7 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* STAFF MANAGEMENT CARD inside Settings */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>👥 Staff Management (సహాయకులు)</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>Add helpers who can scan and bill, but cannot see your analytics/reports.</p>
              
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#fff' }}>Add New Staff</h4>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <input 
                    type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} 
                    placeholder="Staff Name (e.g. Raju Helper)" 
                    style={{ width: '100%', padding: '10px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                  />
                  <input 
                    type="tel" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} 
                    placeholder="Staff Mobile Number" 
                    style={{ width: '100%', padding: '10px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                  />
                  <button onClick={handleAddStaff} style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                    + Add Staff Member
                  </button>
                </div>
              </div>

              <h4 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Active Staff Members</h4>
              {staffList.length === 0 && <p style={{color:'#94a3b8', fontSize: '13px', margin: 0}}>No staff added yet.</p>}
              {staffList.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '13px', color: '#fff' }}>{s.name}</h5>
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Ph: {s.phone}</p>
                  </div>
                  <span style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', border: '1px solid #22c55e', fontWeight: 'bold' }}>Active PIN: 1234</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT QR DISPLAY MODAL */}
      {showPaymentQrModal && (paymentQr || upiId) && (
        <div onClick={() => setShowPaymentQrModal(false)} style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px', fontWeight: 800 }}>{user.name}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Scan to Pay • ₹{billTotal > 0 ? billTotal : '0'}</p>
          <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {paymentQr ? (
              <img src={paymentQr} alt="Payment QR" style={{ width: '260px', height: '260px', objectFit: 'contain' }} />
            ) : (
              <QRCodeSVG 
                value={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name || '')}&am=${billTotal || 0}&tn=Bill&cu=INR`}
                size={260}
              />
            )}
          </div>
          <p style={{ color: '#22c55e', fontSize: '12px', marginTop: '16px', fontWeight: 'bold' }}>GPay • PhonePe • Paytm • Any UPI App</p>
              <div style={{ textAlign: 'center', marginTop: '8px', padding: '4px 10px', background: 'rgba(79,70,229,0.08)', borderRadius: '8px', display: 'inline-block' }}>
                <span style={{ fontSize: '10px', color: '#4F46E5', fontWeight: '700' }}>MyStore OS</span>
                <span style={{ fontSize: '9px', color: '#64748b' }}> • mystoreos.in</span>
              </div>
          <button onClick={() => setShowPaymentQrModal(false)} style={{ marginTop: '24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '12px 32px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      )}

      {/* SCANNER MODAL */}
      {showScanner && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
            <div id="reader" style={{ width: '100%' }}></div>
            <button onClick={() => setShowScanner(false)} style={{ width: '100%', padding: '16px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>Cancel Scan</button>
          </div>
        </div>
      )}

      {/* STAFF MODAL */}
      {showStaffModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', display: 'flex', justifyContent: 'space-between' }}>
              Add Staff Member
              <span onClick={() => setShowStaffModal(false)} style={{ cursor: 'pointer', color: '#94a3b8' }}>✕</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Staff Name" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} style={{ padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
              <input type="tel" placeholder="Staff Phone (Login ID)" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} style={{ padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>* Default PIN will be 1234. Staff can change it later.</p>
              <button onClick={handleAddStaff} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Add Staff</button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {showReturnModal && returnOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#0f172a', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              Process Sales Return
              <span onClick={() => setShowReturnModal(false)} style={{ cursor: 'pointer', color: '#64748b' }}>✕</span>
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Select the quantity to return for each item in Order #{returnOrder.id.substring(0,8)}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '40vh', overflowY: 'auto', paddingRight: '4px' }}>
              {returnOrder.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{item.name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#d97706', fontWeight: 'bold' }}>₹{item.price} x {item.qty}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setReturnItemsState(prev => ({...prev, [item.id]: Math.max(0, prev[item.id] - 1)}))} style={{ background: '#e2e8f0', color: '#0f172a', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', width: '20px', textAlign: 'center', color: '#0f172a' }}>{returnItemsState[item.id]}</span>
                    <button onClick={() => setReturnItemsState(prev => ({...prev, [item.id]: Math.min(item.qty, prev[item.id] + 1)}))} style={{ background: '#e2e8f0', color: '#0f172a', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', color: '#ef4444' }}>
                <span>Total Refund:</span>
                <span>₹{returnOrder.items.reduce((sum, item) => sum + (item.price * returnItemsState[item.id]), 0).toFixed(2)}</span>
              </div>
              <button onClick={handleProcessReturn} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                Confirm Return & Generate Credit Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PIN MODAL */}
      {showAdminPinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '350px', borderRadius: '16px', padding: '30px', border: '1px solid #e5e7eb', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#ef4444', fontWeight: 'bold' }}>Admin Authorization Required</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>This action is restricted. Please ask the shop owner to enter their Admin PIN to proceed.</p>
            
            <input 
              type="password" 
              placeholder="PIN" 
              value={adminPinInput} 
              onChange={e => setAdminPinInput(e.target.value)} 
              style={{ padding: '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '20px', width: '100%', textAlign: 'center', letterSpacing: '8px', marginBottom: '16px', outline: 'none' }} 
            />
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowAdminPinModal(false); setAdminPinInput(''); setPendingAction(null); }} style={{ flex: 1, background: '#ffffff', color: '#475569', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdminPinSubmit} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Authorize</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && !showScanner && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#ffffff', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '90vh', overflowY: 'auto', borderTop: '1px solid #e5e7eb', boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>📦 Add Product to Inventory</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
              <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
                <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Cost Price (₹)</label>
                <input type="number" value={newProdCostPrice} onChange={e => setNewProdCostPrice(e.target.value)} placeholder="e.g. 8" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Stock Qty</label>
                <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Min Stock Alert</label>
                <input type="number" value={newProdReorder} onChange={e => setNewProdReorder(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Batch Number</label>
                <input type="text" value={newProdBatch} onChange={e => setNewProdBatch(e.target.value)} placeholder="e.g. B-901" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Expiry Date</label>
                <input type="date" value={newProdExpiry} onChange={e => setNewProdExpiry(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Variants (comma-separated)</label>
              <input type="text" value={newProdVariants} onChange={e => setNewProdVariants(e.target.value)} placeholder="e.g. Red, Blue, Green or Small, Medium" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                <input type="text" value={newProdHsnCode} onChange={e => setNewProdHsnCode(e.target.value)} placeholder="e.g. 1905" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate (%)</label>
                <select value={newProdGstRate} onChange={e => setNewProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }}>
                  <option value="0">0% (Exempt)</option>
                  <option value="3">3%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Barcode (Optional)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={scannedBarcode} onChange={e => setScannedBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ flex: 1, padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
                <button onClick={() => setShowScanner(true)} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '0 20px', borderRadius: '10px', cursor: 'pointer' }}><BarcodeIcon size={24} /></button>
              </div>
              {scannedBarcode && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                  <Barcode value={scannedBarcode} height={40} width={2} fontSize={14} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Photo (Optional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="file" accept="image/*" id="new-prod-img" style={{ display: 'none' }} onChange={handleNewProdImage} />
                <label htmlFor="new-prod-img" style={{ cursor: 'pointer' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: '#f8fafc', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {newProdImage
                      ? <img src={newProdImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                      : <span style={{ fontSize: '28px' }}>📸</span>
                    }
                  </div>
                </label>
                {newProdImage && (
                  <button onClick={() => setNewProdImage('')} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Remove</button>
                )}
              </div>
            </div>

            <button onClick={handleSaveProduct} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Product</button>
            <button onClick={() => { setShowAddProductModal(false); setNewProdImage(''); }} style={{ width: '100%', background: 'transparent', color: '#64748b', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditProductModal && !showScanner && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#ffffff', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '90vh', overflowY: 'auto', borderTop: '1px solid #e5e7eb', boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>✏️ Edit Product Details</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
              <input type="text" value={editProdName} onChange={e => setEditProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
                <input type="number" value={editProdPrice} onChange={e => setEditProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Cost Price (₹)</label>
                <input type="number" value={editProdCostPrice} onChange={e => setEditProdCostPrice(e.target.value)} placeholder="e.g. 8" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Stock Qty</label>
                <input type="number" value={editProdStock} onChange={e => setEditProdStock(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Min Stock Alert</label>
                <input type="number" value={editProdReorder} onChange={e => setEditProdReorder(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Batch Number</label>
                <input type="text" value={editProdBatch} onChange={e => setEditProdBatch(e.target.value)} placeholder="e.g. B-901" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Expiry Date</label>
                <input type="date" value={editProdExpiry} onChange={e => setEditProdExpiry(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Variants (comma-separated)</label>
              <input type="text" value={editProdVariants} onChange={e => setEditProdVariants(e.target.value)} placeholder="e.g. Red, Blue, Green or Small, Medium" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Selling Unit</label>
              <select value={editProdUnit || shopDefaultUnit} onChange={e => setEditProdUnit(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }}>
                {unitOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                <input type="text" value={editProdHsnCode} onChange={e => setEditProdHsnCode(e.target.value)} placeholder="e.g. 1905" style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate (%)</label>
                <select value={editProdGstRate} onChange={e => setEditProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }}>
                  <option value="0">0% (Exempt)</option>
                  <option value="3">3%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Barcode (Optional)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={editProdBarcode} onChange={e => setEditProdBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ flex: 1, padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '15px' }} />
                <button onClick={() => setShowScanner(true)} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '0 20px', borderRadius: '10px', cursor: 'pointer' }}><BarcodeIcon size={24} /></button>
              </div>
              {editProdBarcode && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                  <Barcode value={editProdBarcode} height={40} width={2} fontSize={14} />
                </div>
              )}
            </div>

            <button onClick={handleUpdateProduct} style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #4338ca)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Update Product</button>
            <button onClick={() => setShowEditProductModal(false)} style={{ width: '100%', background: 'transparent', color: '#64748b', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', display: 'flex', justifyContent: 'space-around', background: '#ffffff', padding: '12px 0', borderTop: '1px solid #e5e7eb', zIndex: 100, boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)' }}>
        <div style={{...styles.navBtn, color: activeTab === 'home' ? '#4F46E5' : '#64748b' }} onClick={() => setActiveTab('home')}>
          <Home size={20} style={{ margin: '0 auto 4px auto' }} />
          <p style={{ fontSize: '10px', margin: 0 }}>Home</p>
        </div>
        
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'products' ? '#4F46E5' : '#64748b' }} onClick={() => setActiveTab('products')}>
            <Package size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Products</p>
          </div>
        )}
        
        <div style={{...styles.navBtn, color: activeTab === 'bills' ? '#4F46E5' : '#64748b', position: 'relative' }} onClick={() => setActiveTab('bills')}>
          <Receipt size={20} style={{ margin: '0 auto 4px auto' }} />
          <p style={{ fontSize: '10px', margin: 0 }}>Bills</p>
          {pendingOrders > 0 && <span style={{position:'absolute', top:-4, right:'20%', background:'#ef4444', width:10, height:10, borderRadius:'50%'}}></span>}
        </div>

        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'credit' ? '#4F46E5' : '#64748b' }} onClick={() => setActiveTab('credit')}>
            <Wallet size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Credit</p>
          </div>
        )}

        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'restock' ? '#4F46E5' : '#64748b' }} onClick={() => setActiveTab('restock')}>
            <Truck size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Restock</p>
          </div>
        )}
        
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'reports' ? '#4F46E5' : '#64748b' }} onClick={() => setActiveTab('reports')}>
            <Book size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Reports</p>
          </div>
        )}
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'profile' ? '#4F46E5' : '#64748b' }} onClick={() => setActiveTab('profile')}>
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '4px' }}>⚙️</span>
            <p style={{ fontSize: '10px', margin: 0 }}>Settings</p>
          </div>
        )}
      </div>

      {/* Dynamic Plan Selector Modal */}
      {showPlanSelectorModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '900px',
            padding: isMobile ? '20px' : '32px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
            position: 'relative',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowPlanSelectorModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '18px'
              }}
            >
              ×
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <span style={{
                background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
                color: 'white',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                padding: '4px 12px',
                borderRadius: '20px',
                letterSpacing: '1px',
                display: 'inline-block',
                marginBottom: '10px'
              }}>
                MyStore OS SaaS pricing
              </span>
              <h2 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', margin: '0 0 8px 0', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Select Your Business Growth Plan
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Unlock high-fidelity retail tools: barcode compliance, direct GST invoicing, CA Ledger access, and multi-staff lock-outs.
              </p>
            </div>

            {/* Plans Container */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: '20px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {plans.map(plan => {
                const isCurrent = user.subscriptionTier === plan.id && user.subscription === 'active';
                const isPopular = plan.id === 'pro' || plan.name.toLowerCase().includes('pro');
                return (
                  <div 
                    key={plan.id}
                    style={{
                      background: isPopular ? 'linear-gradient(180deg, rgba(79, 70, 229, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)' : 'rgba(30, 41, 59, 0.25)',
                      border: isPopular ? '2px solid #4F46E5' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '20px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      position: 'relative',
                      boxShadow: isPopular ? '0 12px 32px rgba(79, 70, 229, 0.15)' : 'none'
                    }}
                  >
                    {isPopular && (
                      <span style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        padding: '4px 10px',
                        borderRadius: '10px',
                        letterSpacing: '0.5px'
                      }}>
                        Most Popular Choice
                      </span>
                    )}

                    <div>
                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{plan.name}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#cbd5e1', minHeight: '32px' }}>{plan.description}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: '800', color: '#fff' }}>₹{plan.price}</span>
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>/ month</span>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: 0 }} />

                    {/* Features checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
                      {plan.features?.map((feat, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{feat}</span>
                        </div>
                      ))}
                    </div>

                    {isCurrent ? (
                      <button 
                        disabled
                        style={{
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#94a3b8',
                          padding: '12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'not-allowed'
                        }}
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleSubscribe(plan)}
                        style={{
                          width: '100%',
                          background: isPopular ? 'linear-gradient(90deg, #4F46E5, #818CF8)' : 'white',
                          color: isPopular ? 'white' : '#0f172a',
                          border: 'none',
                          padding: '12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        Subscribe
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
              🔒 Secure, encrypted transactions powered by Razorpay PG. Cancel or downgrade anytime instantly.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ShopDashboard;
