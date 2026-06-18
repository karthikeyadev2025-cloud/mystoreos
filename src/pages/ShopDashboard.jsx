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
import BarcodeManager from '../components/BarcodeManager';
import { buildUpiUri } from '../lib/upi';
import { QRCodeSVG } from 'qrcode.react';
import { downloadTallyXML, generateGSTR1CSV, generateMonthlySummaryCSV, downloadCSV } from '../lib/TallyExporter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { sendWhatsApp, sendCreditReminder, sendBillNotification, sendPaymentConfirmation, sendTrialReminder, hasWhatsAppAPI } from '../lib/notify';
import { generateVoucherPDF, generateCreditNotePDF } from '../lib/pdfGenerator';

import DesktopTopBar from '../components/DesktopTopBar';
import DesktopSidebar from '../components/DesktopSidebar';
import DesktopPOS from '../components/DesktopPOS';
import DesktopInventory from '../components/DesktopInventory';
import ProductImageUploader from '../components/ProductImageUploader';
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
          <div style={{ fontSize: 11, color: '#64748B' }}>Share your code — earn 20% commission when referrals subscribe</div>
        </div>
      </div>
      {loading ? <div style={{ color: '#64748B', fontSize: 12 }}>Generating your code...</div> : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#0F172A', border: '2px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 18px', fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: '#A78BFA', letterSpacing: 3, flexShrink: 0 }}>
            {code?.code || '—'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => copy(code?.code)} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>📋 Copy Code</button>
            <button onClick={() => copy(link)} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>🔗 Copy Link</button>
            <button onClick={shareWA} style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>📲 Share on WhatsApp</button>
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
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [scanPopupProduct, setScanPopupProduct] = useState(null);
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
  const [showBarcodeManager, setShowBarcodeManager] = useState(false);
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
  const [newProdImages, setNewProdImages] = useState([]);
  const [newProdFeatured, setNewProdFeatured] = useState(false);
  const [newProdUnit, setNewProdUnit] = useState('');
  const [newProdDiscountPct, setNewProdDiscountPct] = useState('0');
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
  const [editProdImages, setEditProdImages] = useState([]);
  const [editProdFeatured, setEditProdFeatured] = useState(false);
  const [editProdDiscountPct, setEditProdDiscountPct] = useState('0');

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
  // Profile editing state
  const [editName,        setEditName]        = useState(user?.name    || '');
  const [editPhone,       setEditPhone]       = useState(user?.phone   || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving,   setProfileSaving]   = useState(false);
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [merchantUpiId, setMerchantUpiId] = useState(user?.merchantUpiId || '');
  const [merchantCode, setMerchantCode] = useState(user?.merchantCode || '');
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
  // Print Settings
  const [printFormat,   setPrintFormat]   = useState('a4');       // 'a4' | 'thermal80' | 'thermal58'
  const [printFontSize, setPrintFontSize] = useState('normal');   // 'normal' | 'large'
  const [printShowLogo, setPrintShowLogo] = useState(true);
  const [printCopies,   setPrintCopies]   = useState(1);
  const [dailyTarget, setDailyTarget] = useState(0);
  const [flashSales, setFlashSales] = useState({});
  const [hideFromSearch, setHideFromSearch] = useState(user?.hideFromSearch || false);
  const [openingHour, setOpeningHour] = useState(user?.openingHour ?? 8);
  const [closingHour, setClosingHour] = useState(user?.closingHour ?? 21);
  const [weeklyHolidays, setWeeklyHolidays] = useState(user?.weeklyHolidays || []);
  const [shopBanner, setShopBanner] = useState(user?.shopBanner || { title: '', subtitle: '', discountPercent: 0, active: false });
  const [myCA, setMyCA] = useState(null);
  const [caPhoneInput, setCaPhoneInput] = useState('');
  const [caBusy, setCaBusy] = useState(false);
  const [myDistributors, setMyDistributors] = useState([]);
  const [distCodeInput, setDistCodeInput] = useState('');
  const [distLinkBusy, setDistLinkBusy] = useState(false);

  // System Settings (Razorpay Key & Announcement)
  const [sysSettings, setSysSettings] = useState({ razorpayKey: '' });
  const [announceConfig, setAnnounceConfig] = useState(DEFAULT_ANNOUNCE);

  // Staff Management
  const [staffList, setStaffList] = useState([]);
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
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
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [pricing, setPricing] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(
    () => !!sessionStorage.getItem(`mystore_trial_banner_dismissed_${user.id}`)
  );

  const targetShopId = user.role === 'staff' ? user.staff_of : user.id;
  const isOwner = user.role === 'shop' || user.role === 'admin';

  const { isOnline, pendingCount } = useOfflineSync();
  const { isExpired, hasFeature, capabilities, planLabel } = useSubscription();
  const loyaltyEnabled = hasFeature('loyaltyPoints');
  const openBarcodeManager = () => {
    if (!hasFeature('barcodeManager')) {
      toast.error('Barcode Manager requires the PRO plan. Please upgrade.');
      setShowPlanSelectorModal(true);
      return;
    }
    setShowBarcodeManager(true);
  };
  const _now = new Date();
  // Trial countdown is based on trialStartedAt (set at registration). createdAt was
  // never mapped from the DB, so the old code always fell back to a static 15 and
  // never decreased. Fall back to createdAt only if present.
  const _trialStart = user.trialStartedAt || user.createdAt;
  const trialDaysLeft = _trialStart ? Math.max(0, 15 - Math.floor((_now - new Date(_trialStart)) / 86400000)) : 15;
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

  // ── Order alert sound + browser notification ──────────────────────────────
  const playOrderAlert = (count = 1) => {
    // Play a cash-register style alert sound
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, start, dur, gain = 0.4) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        g.gain.setValueAtTime(gain, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      };
      // Three-tone chime: ding-ding-ding
      playTone(880, 0,    0.18, 0.45);
      playTone(1100, 0.2, 0.18, 0.45);
      playTone(1320, 0.4, 0.25, 0.45);
      if (count > 1) {
        playTone(880,  0.7, 0.18, 0.4);
        playTone(1100, 0.9, 0.18, 0.4);
        playTone(1320, 1.1, 0.25, 0.4);
      }
    } catch {}

    // Browser notification (works even when tab is in background)
    if ('Notification' in window) {
      const show = () => {
        try {
          new Notification(`🛒 New Order — ${user.name}`, {
            body: `You have ${count} new order${count > 1 ? 's' : ''} waiting! Open MyStore OS to accept.`,
            icon: '/logo.png',
            badge: '/logo.png',
            tag: 'new-order',
            renotify: true,
          });
        } catch {}
      };
      if (Notification.permission === 'granted') {
        show();
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => { if (p === 'granted') show(); });
      }
    }
  };

  // Request notification permission on mount (so it's ready when orders come in)
  useEffect(() => {
    if (isOwner && 'Notification' in window && Notification.permission === 'default') {
      // Delay request slightly so it doesn't fire immediately on load
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [isOwner]);

  const loadData = useCallback(async () => {
    // Always re-fetch the shop owner's profile so logo/QR/name stay in sync
    // across devices (mobile upload reflects on desktop and vice versa)
    const ownerId = user.role === 'staff' ? user.staff_of : user.id;
    const freshOwner = await safe(() => api.getUserById(ownerId));
    if (freshOwner) {
      // Update local state for display
      if (freshOwner.logo      !== undefined) setLogo(freshOwner.logo || '');
      if (freshOwner.paymentQr !== undefined) setPaymentQr(freshOwner.paymentQr || '');
      if (freshOwner.upiId     !== undefined) setUpiId(freshOwner.upiId || '');
      // Merge into auth session so next render uses fresh data (non-destructive)
      if (user.role !== 'staff') {
        const cached = JSON.parse(localStorage.getItem('mystore_session') || '{}');
        const merged = { ...cached };
        for (const k of Object.keys(freshOwner)) {
          const v = freshOwner[k];
          if (v !== null && v !== undefined && v !== '') merged[k] = v;
        }
        try { localStorage.setItem('mystore_session', JSON.stringify(merged)); } catch {}
      }
    }

    setProducts((await safe(() => api.getShopProducts(targetShopId))) || []);
    const rawOrders = (await safe(() => api.getShopOrders(targetShopId))) || [];
    // Normalize status capitalization for Tally/GST export filters
    const normalizedOrders = rawOrders.map(o => ({
      ...o,
      status: o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1).toLowerCase() : o.status
    }));
    setOrders(prev => {
      // Detect NEW pending orders → play alert sound + browser notification
      const prevPendingCount = prev.filter(o =>
        o.status === 'Pending' &&
        !o.userId?.startsWith('estimate') &&
        !o.userId?.startsWith('challan')
      ).length;
      const newPendingCount = normalizedOrders.filter(o =>
        o.status === 'Pending' &&
        !o.userId?.startsWith('estimate') &&
        !o.userId?.startsWith('challan')
      ).length;
      if (newPendingCount > prevPendingCount) {
        playOrderAlert(newPendingCount - prevPendingCount);
      }
      return normalizedOrders;
    });
    setWholesaleCatalog((await safe(() => api.getDistributorProducts())) || []);

    // Load Global Announcement
    const announce = await safe(() => api.getSiteConfig('announcement', DEFAULT_ANNOUNCE));
    setAnnounceConfig(announce || DEFAULT_ANNOUNCE);

    if (user.role === 'staff') {
      // Staff: load their own billing history for the shop
      // (rawOrders already loaded above — filtered by shop_id which covers staff bills)
    }

    if (isOwner) {
      setCredits((await safe(() => api.getShopCredits(targetShopId))) || []);
      setCustomerCredits((await safe(() => api.getDistCredits(targetShopId))) || []);
      setStockOrders((await safe(() => api.getShopStockOrders(targetShopId))) || []);
      setSysSettings(await safe(() => api.getSettings()));
      setStaffList(await safe(() => api.getShopStaff(targetShopId)));
      setPlans(await safe(() => api.getSubscriptionPlans()));
      setPricing(await safe(() => api.getPricing()));
      setPaymentHistory(await safe(() => api.getPaymentHistory(targetShopId)));
      setInvoiceFooter(await safe(() => api.getSiteConfig('invoiceFooter_' + targetShopId, '')));
      const ps = await safe(() => api.getSiteConfig('printSettings_' + targetShopId, null));
      if (ps) {
        if (ps.format)    setPrintFormat(ps.format);
        if (ps.fontSize)  setPrintFontSize(ps.fontSize);
        if (ps.showLogo !== undefined) setPrintShowLogo(ps.showLogo);
        if (ps.copies)    setPrintCopies(ps.copies);
      }
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
    if (!userId) return { type: 'bill', name: 'Walk-in Customer', phone: '', staffId: null, staffName: null };
    const parts = userId.split(':');
    if (parts.length >= 2) {
      const type = parts[0];
      const name = parts[1] || 'Guest';
      const phone = parts[2] || '';
      // Staff encoding: walk-in:CustomerName:Phone:staff:staffId:staffName
      const staffIdx = parts.indexOf('staff');
      const staffId   = staffIdx !== -1 ? (parts[staffIdx + 1] || null) : null;
      const staffName = staffIdx !== -1 ? (parts[staffIdx + 2] || null) : null;
      return { type, name, phone, staffId, staffName };
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    return { type: 'bill', name: (userId === 'walk-in-customer' || isUuid) ? 'Walk-in Customer' : userId, phone: '', staffId: null, staffName: null };
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
    setEditProdImages(Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []));
    setEditProdFeatured(!!p.isFeatured);
    setEditProdDiscountPct(String(p.discountPct || 0));
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
        unit: editProdUnit || shopDefaultUnit,
        images: editProdImages,
        isFeatured: editProdFeatured,
        discountPct: parseInt(editProdDiscountPct) || 0
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

  const updateBillItemDiscount = (prodId, discPct) => {
    setBillItems(prev => prev.map(item => item.id === prodId ? { ...item, itemDiscount: discPct } : item));
  };

  const clearCart = () => {
    setBillItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerGstin('');
    setCustomerAddress('');
    setCustomerStateCode('');
    setManualDiscountPct(0);
    setLoyaltyRedeem(0);
    setPaymentMethod('Cash');
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
      // Encode staff biller so bills can be filtered by staff in reports
      const staffSuffix = (user.role === 'staff' && user.id) ? `:staff:${user.id}:${user.name || ''}` : '';
      if (billingMode === 'estimate') {
        finalUserId = `estimate:${customerName || 'Guest'}:${customerPhone || ''}${staffSuffix}`;
      } else if (billingMode === 'challan') {
        finalUserId = `challan:${customerName || 'Guest'}:${customerPhone || ''}${staffSuffix}`;
      } else {
        finalUserId = `walk-in:${customerName || 'Guest'}:${customerPhone || ''}${staffSuffix}`;
      }

      await safe(() => api.placeOrder(finalUserId, targetShopId, billItems.map(b => ({
        id: b.id,
        name: b.name,
        price: b.price,
        qty: b.qty || 1,
        selectedVariant: b.selectedVariant || '',
        itemDiscount: b.itemDiscount || 0
      })), total, { gstin: customerGstin, address: customerAddress, stateCode: customerStateCode },
      billingMode === 'bill' ? 'Accepted' : 'Pending',
      paymentMethod || 'Cash'));

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

      // ── PDF GENERATION ────────────────────────────────────────────────────────
      const { jsPDF: JsPDF } = await import('jspdf');

      // ── Print format config ──────────────────────────────────────────────────
      // printFormat: 'a4' | 'thermal80' | 'thermal58'
      const isThermal   = printFormat === 'thermal80' || printFormat === 'thermal58';
      const pageW       = printFormat === 'thermal58' ? 58 : printFormat === 'thermal80' ? 80 : 210;
      const pageH       = isThermal ? 297 : 297; // auto-height for thermal
      const marginL     = isThermal ? 3 : 15;
      const contentW    = pageW - marginL * 2;
      const baseFontSz  = printFontSize === 'large' ? (isThermal ? 11 : 12) : (isThermal ? 8 : 10);
      const titleFontSz = printFontSize === 'large' ? (isThermal ? 13 : 15) : (isThermal ? 10 : 13);

      const doc = isThermal
        ? new JsPDF({ unit: 'mm', format: [pageW, pageH], orientation: 'portrait' })
        : new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      // Theme colours per document type
      let themeColor = '#10B981';
      let modeTitle  = 'TAX INVOICE';
      let modeShort  = 'INV';
      if (billingMode === 'estimate') {
        themeColor = '#4F46E5'; modeTitle = 'PROFORMA ESTIMATE / QUOTATION'; modeShort = 'EST';
      } else if (billingMode === 'challan') {
        themeColor = '#3B82F6'; modeTitle = 'DELIVERY CHALLAN'; modeShort = 'DC';
      }

      // Helper: parse hex colour to [r, g, b]
      const hex2rgb = (h) => [
        parseInt(h.slice(1,3),16),
        parseInt(h.slice(3,5),16),
        parseInt(h.slice(5,7),16),
      ];
      const [tR,tG,tB] = hex2rgb(themeColor);

      // ── HEADER STRIPE ─────────────────────────────────────────────────────────
      doc.setFillColor(tR,tG,tB);
      doc.rect(0, 0, pageW, isThermal ? 7 : 10, 'F');

      // ── SHOP BRANDING ────────────────────────────────────────────────────────
      let hy = isThermal ? 13 : 20;

      const hasLogo = printShowLogo && user.logo && user.logo.startsWith('data:image');
      const logoW = isThermal ? 14 : 22, logoH = isThermal ? 14 : 22, logoX = marginL;
      if (hasLogo) {
        try { doc.addImage(user.logo, 'JPEG', logoX, hy - 6, logoW, logoH); } catch(e) {}
      }
      const textX = hasLogo ? (marginL + logoW + 3) : marginL;

      // Shop name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(isThermal ? 11 : 18);
      doc.setTextColor(15, 23, 42);
      doc.text(user.name, isThermal ? pageW / 2 : textX, hy, isThermal ? { align: 'center' } : {});
      hy += isThermal ? 6 : 7;

      // Contact line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(isThermal ? 7 : 9);
      doc.setTextColor(100, 116, 139);
      let contactLine = `Ph: ${user.phone}`;
      if (!isThermal && user.upiId) contactLine += `   |   UPI: ${user.upiId}`;
      doc.text(contactLine, isThermal ? pageW / 2 : textX, hy, isThermal ? { align: 'center' } : {});
      hy += 5;
      if (isThermal && user.upiId) {
        doc.text(`UPI: ${user.upiId}`, pageW / 2, hy, { align: 'center' });
        hy += 5;
      }

      // GSTIN
      if (gstin) {
        doc.setFontSize(isThermal ? 7 : 9);
        const gstinLine = isThermal ? `GSTIN: ${gstin}` : `GSTIN: ${gstin}   |   State Code: ${stateCode}`;
        doc.text(gstinLine, isThermal ? pageW / 2 : textX, hy, isThermal ? { align: 'center' } : {});
        hy += 5;
        if (isThermal && stateCode) { doc.text(`State: ${stateCode}`, pageW / 2, hy, { align: 'center' }); hy += 5; }
      }
      if (businessAddress) {
        doc.setFontSize(isThermal ? 7 : 8.5);
        doc.text(businessAddress, isThermal ? pageW / 2 : textX, hy, isThermal ? { align: 'center', maxWidth: contentW } : {});
        doc.setFontSize(isThermal ? 7 : 9);
        hy += 5;
      }

      if (!isThermal) {
        // A4: document type badge top-right
        doc.setFillColor(tR,tG,tB);
        doc.roundedRect(140, 12, 55, 14, 3, 3, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(255,255,255);
        doc.text(modeTitle.length > 14 ? modeShort + ' DOCUMENT' : modeTitle, 167.5, 20.5, { align: 'center' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const dateStr = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
        doc.text(`Date: ${dateStr}`, 195, 30, { align: 'right' });
        if (invoiceNo) {
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(tR,tG,tB);
          doc.text(`${modeShort}-${invoiceNo}`, 195, 36, { align: 'right' });
        }
      }

      // ── DIVIDER ────────────────────────────────────────────────────────────────
      hy = !isThermal ? Math.max(hy, hasLogo ? 36 : 34) + 4 : hy + 2;
      doc.setDrawColor(isThermal ? 0 : 226, isThermal ? 0 : 232, isThermal ? 0 : 240);
      doc.setLineWidth(isThermal ? 0.2 : 0.4);
      doc.line(marginL, hy, pageW - marginL, hy);
      hy += 5;

      // ── DOCUMENT TITLE ────────────────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(isThermal ? 9 : 11);
      doc.setTextColor(tR,tG,tB);
      if (isThermal) {
        doc.text(modeTitle, pageW / 2, hy, { align: 'center' });
        hy += 5;
        const dateStrT = new Date().toLocaleDateString('en-IN');
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(71,85,105);
        doc.text(`Date: ${dateStrT}`, pageW / 2, hy, { align: 'center' });
        if (invoiceNo) { hy += 4; doc.setFont("helvetica","bold"); doc.setTextColor(tR,tG,tB); doc.text(`${modeShort}-${invoiceNo}`, pageW/2, hy, { align:'center' }); }
        hy += 6;
      } else {
        doc.text(modeTitle, marginL, hy);
        hy += 8;
      }

      // ── CUSTOMER DETAILS ───────────────────────────────────────────────────────
      let custY = hy;
      if (customerName || customerPhone || customerGstin) {
        if (!isThermal) {
          doc.setFillColor(248, 250, 252);
          const custBlockH = 6 + (customerPhone ? 5 : 0) + (customerGstin ? 5 : 0) + (customerAddress ? 5 : 0) + 4;
          doc.rect(marginL, custY - 4, 120, custBlockH, 'F');
        }
        doc.setFont("helvetica", "bold"); doc.setFontSize(isThermal ? 7 : 8.5); doc.setTextColor(100, 116, 139);
        doc.text(isThermal ? '--- BILL TO ---' : 'BILL TO:', isThermal ? pageW/2 : marginL+3, custY, isThermal ? {align:'center'} : {});
        custY += 5;
        doc.setFont("helvetica", "bold"); doc.setFontSize(isThermal ? 8 : 10); doc.setTextColor(15, 23, 42);
        doc.text(customerName || 'Walk-in', isThermal ? pageW/2 : marginL+3, custY, isThermal ? {align:'center'} : {});
        custY += 5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(isThermal ? 7 : 9); doc.setTextColor(71, 85, 105);
        if (customerPhone) { doc.text(`Ph: ${customerPhone}`, isThermal ? pageW/2 : marginL+3, custY, isThermal ? {align:'center'} : {}); custY += 5; }
        if (customerGstin) { doc.text(`GSTIN: ${customerGstin}`, isThermal ? pageW/2 : marginL+3, custY, isThermal ? {align:'center'} : {}); custY += 5; }
        if (customerAddress) { doc.text(`Addr: ${customerAddress}`, isThermal ? pageW/2 : marginL+3, custY, isThermal ? {align:'center', maxWidth:contentW} : {}); custY += 5; }
        custY += 3;
        doc.setLineWidth(isThermal ? 0.2 : 0.3);
        doc.setDrawColor(isThermal ? 0 : 200, isThermal ? 0 : 210, isThermal ? 0 : 220);
        doc.line(marginL, custY, pageW - marginL, custY);
        custY += 4;
      }

      // GST Calculation logic
      let isInterState = false;
      if (gstin && customerGstin && stateCode && customerStateCode && stateCode !== customerStateCode) {
        isInterState = true;
      }
      const showGstColumns = !!gstin && billingMode === 'bill';
      
      // ── Column layout: A4 vs Thermal ────────────────────────────────────────
      // For A4: item=18, qty=120, price=145, total=175
      // For Thermal: item=marginL+1, qty=colQ, total=pageW-marginL-1 (right-align)
      const colItem  = marginL + 1;
      const colQty   = isThermal ? marginL + Math.round(contentW * 0.55) : (showGstColumns ? 85 : 120);
      const colPrice = isThermal ? 0 : (showGstColumns ? 98 : 145);
      const colTotal = isThermal ? (pageW - marginL - 1) : 175;
      const colTotalAlign = isThermal ? 'right' : 'left';

      // Table Headers
      if (!isThermal) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginL, custY, contentW, 8, 'F');
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(isThermal ? 7 : 8);
      doc.setTextColor(71, 85, 105);
      
      if (isThermal) {
        doc.text("Item", colItem, custY + 5);
        doc.text("Qty", colQty, custY + 5);
        doc.text("Amt", colTotal, custY + 5, { align: 'right' });
      } else if (showGstColumns) {
        doc.text("Item Details (HSN)", colItem, custY + 5.5);
        doc.text("Qty", colQty, custY + 5.5);
        doc.text("Taxable", colPrice, custY + 5.5);
        if (isInterState) {
          doc.text("IGST", 125, custY + 5.5);
        } else {
          doc.text("CGST", 120, custY + 5.5);
          doc.text("SGST", 145, custY + 5.5);
        }
        doc.text("Total", colTotal, custY + 5.5);
      } else {
        doc.text("Item Details", colItem, custY + 5.5);
        doc.text("Qty", colQty, custY + 5.5);
        doc.text("Unit Price", colPrice, custY + 5.5);
        doc.text("Total", colTotal, custY + 5.5);
      }
      
      doc.setLineWidth(isThermal ? 0.2 : 0.3);
      doc.setDrawColor(isThermal ? 0 : 200, isThermal ? 0 : 210, isThermal ? 0 : 220);
      doc.line(marginL, custY + 8, pageW - marginL, custY + 8);
      
      let yOffset = custY + 13;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      
      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      billItems.forEach((item) => {
        const qty = item.qty || 1;
        const mrpLineAmt = item.price * qty;
        const iDisc = item.itemDiscount || 0;
        const iDiscAmt = iDisc > 0 ? Math.round(mrpLineAmt * iDisc / 100) : 0;
        const discountedLineAmt = mrpLineAmt - iDiscAmt;
        const unitSuffix = UNIT_SUFFIX[resolveUnit(item, shopCategory)] || '';
        const qtyText = unitSuffix ? `${qty} ${unitSuffix}` : `${qty}`;
        
        if (showGstColumns) {
          const rate = parseInt(item.gstRate) || 0;
          const taxableVal = discountedLineAmt / (1 + (rate / 100));
          const taxAmt = discountedLineAmt - taxableVal;
          totalTaxable += taxableVal;
          
          let hsnText = item.hsnCode ? ` [${item.hsnCode}]` : '';
          let itemFullName = item.name + (item.selectedVariant ? ` (${item.selectedVariant})` : '') + hsnText;
          if (iDisc > 0) itemFullName += ` [-${iDisc}%]`;
          
          doc.setFont("helvetica", "normal");
          doc.text(itemFullName, colItem, yOffset);
          doc.text(`${qtyText}`, isThermal ? colQty : 85, yOffset);
          if (!isThermal) doc.text(`${taxableVal.toFixed(2)}`, 98, yOffset);
          
          if (isInterState) {
            totalIgst += taxAmt;
            if (!isThermal) doc.text(`${taxAmt.toFixed(2)} (${rate}%)`, 125, yOffset);
          } else {
            const halfTax = taxAmt / 2;
            const halfRate = rate / 2;
            totalCgst += halfTax;
            totalSgst += halfTax;
            if (!isThermal) { doc.text(`${halfTax.toFixed(2)} (${halfRate}%)`, 120, yOffset); doc.text(`${halfTax.toFixed(2)} (${halfRate}%)`, 145, yOffset); }
          }
          doc.text(`${discountedLineAmt.toFixed(2)}`, isThermal ? colTotal : 175, yOffset, isThermal ? {align:'right'} : {});
          yOffset += 7;
          // Show MRP strikethrough note if item has discount
          if (iDisc > 0) {
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            if (!isThermal) doc.text(`MRP: Rs.${item.price.toFixed(2)} x${qty} = Rs.${mrpLineAmt.toFixed(2)}  →  Saved Rs.${iDiscAmt.toFixed(2)}`, colItem + 4, yOffset);
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            yOffset += 5;
          }
        } else {
          const itemFullName = item.name + (item.selectedVariant ? ` (${item.selectedVariant})` : '');
          doc.setFont("helvetica", "normal");
          doc.text(itemFullName, colItem, yOffset);
          doc.text(`${qtyText}`, colQty, yOffset);
          if (isThermal) {
            // Thermal: just show total right-aligned, with discount flag if any
            const dispAmt = iDisc > 0 ? `${discountedLineAmt.toFixed(0)}(-${iDisc}%)` : discountedLineAmt.toFixed(0);
            doc.setFont("helvetica", iDisc > 0 ? "bold" : "normal");
            doc.text(dispAmt, colTotal, yOffset, { align: 'right' });
            doc.setFont("helvetica", "normal");
          } else if (iDisc > 0) {
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`${item.price.toFixed(2)}`, colPrice, yOffset);
            doc.setFontSize(8);
            doc.setTextColor(239, 68, 68);
            doc.text(`-${iDisc}%`, colPrice + 13, yOffset);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(22, 163, 74);
            doc.text(`${discountedLineAmt.toFixed(2)}`, colTotal, yOffset);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(51, 65, 85);
          } else {
            doc.text(`${item.price.toFixed(2)}`, colPrice, yOffset);
            doc.text(`${discountedLineAmt.toFixed(2)}`, colTotal, yOffset);
          }
          yOffset += 7;
          // Show per-item saving note
          if (iDisc > 0) {
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            if (!isThermal) doc.text(`MRP Rs.${item.price.toFixed(2)} x${qty} = Rs.${mrpLineAmt.toFixed(2)} | You save Rs.${iDiscAmt.toFixed(2)} (${iDisc}% off)`, colItem + 4, yOffset);
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            yOffset += 5;
          }
        }
        yOffset += 1;
      });
      
      doc.line(marginL, yOffset - 2, pageW - marginL, yOffset - 2);
      yOffset += 4;
      
      // Totals section
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);

      if (showGstColumns) {
         doc.text(`Total Taxable Value: Rs. ${totalTaxable.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
         yOffset += 5;
         if (isInterState) {
           doc.text(`Total IGST: Rs. ${totalIgst.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
           yOffset += 5;
         } else {
           doc.text(`Total CGST: Rs. ${totalCgst.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
           yOffset += 5;
           doc.text(`Total SGST: Rs. ${totalSgst.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
           yOffset += 5;
         }
      }

      // Item-level savings row
      if (itemLevelSavings > 0) {
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`Subtotal (MRP): Rs. ${billItemsOriginalTotal.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
        yOffset += 5;
        doc.setTextColor(22, 163, 74);
        doc.text(`Item Discounts: -Rs. ${itemLevelSavings.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
        yOffset += 5;
        doc.setTextColor(71, 85, 105);
        doc.text(`Subtotal (After item disc.): Rs. ${billTotal.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
        yOffset += 5;
      }

      if (discountAmount > 0 || manualDiscountAmt > 0) {
        if (itemLevelSavings === 0) {
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.text(`Subtotal: Rs. ${billTotal.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
          yOffset += 5;
        }
        doc.setTextColor(22, 163, 74);
        doc.text(`Bill Discount: -Rs. ${(discountAmount + manualDiscountAmt).toFixed(2)}`, isThermal ? marginL : 130, yOffset);
        yOffset += 5;
        doc.setTextColor(71, 85, 105);
      }
      
      if (loyaltyDiscountRupees > 0) {
        doc.setTextColor(139, 92, 246);
        doc.text(`Loyalty Points Redeemed: -Rs. ${loyaltyDiscountRupees.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
        yOffset += 5;
        doc.setTextColor(71, 85, 105);
      }

      // Grand total
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(`GRAND TOTAL: Rs. ${total.toFixed(2)}`, isThermal ? marginL : 130, yOffset);
      yOffset += 9;

      // Payment method badge
      if (billingMode === 'bill') {
        const pmIcons = { Cash: '💵', UPI: '📱', Card: '💳', Credit: '📒' };
        const pmColors = { Cash: [16,185,129], UPI: [79,70,229], Card: [59,130,246], Credit: [239,68,68] };
        const pm = paymentMethod || 'Cash';
        const [pmR,pmG,pmB] = pmColors[pm] || pmColors['Cash'];
        doc.setFillColor(pmR,pmG,pmB);
        doc.roundedRect(isThermal ? marginL : 130, yOffset, isThermal ? contentW : 32, 8, 2, 2, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255,255,255);
        doc.text(`${pm === 'Cash' ? 'CASH' : pm === 'UPI' ? 'UPI' : pm === 'Card' ? 'CARD' : 'CREDIT'} PAID`, isThermal ? (pageW/2) : 146, yOffset + 5.2, { align: 'center' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71,85,105);
        if (!isThermal) doc.text('Payment Mode', 167, yOffset + 5.2);
        yOffset += 12;
      }

      // "You Saved" highlight box
      const totalSaved = itemLevelSavings + discountAmount + manualDiscountAmt + loyaltyDiscountRupees;
      if (totalSaved > 0) {
        const tcR = parseInt(themeColor.substring(1,3),16);
        const tcG = parseInt(themeColor.substring(3,5),16);
        const tcB = parseInt(themeColor.substring(5,7),16);
        doc.setFillColor(tcR, tcG, tcB);
        doc.setDrawColor(tcR, tcG, tcB);
        doc.roundedRect(isThermal ? marginL : 130, yOffset, isThermal ? contentW : 65, 10, 2, 2, 'FD');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`YOU SAVED Rs. ${totalSaved.toFixed(2)}!`, isThermal ? pageW/2 : 163, yOffset + 6.5, { align: 'center' });
        doc.setTextColor(15, 23, 42);
        yOffset += 14;
      } else {
        yOffset += 3;
      }
      
      // Footer text/Note
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      
      if (billingMode === 'estimate') {
        doc.setTextColor(217, 119, 6);
        doc.text("* Proforma estimate only. Valid 30 days.", isThermal ? pageW/2 : marginL, yOffset, isThermal ? {align:'center', maxWidth:contentW} : {});
      } else if (billingMode === 'challan') {
        doc.setTextColor(37, 99, 235);
        doc.text("* Delivery Challan. Not for sale.", isThermal ? pageW/2 : marginL, yOffset, isThermal ? {align:'center', maxWidth:contentW} : {});
      } else {
        doc.text(invoiceFooter || "Thank you for your business! Visit again.", isThermal ? pageW/2 : marginL, yOffset, isThermal ? {align:'center', maxWidth: contentW} : {});
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
    doc.text("Powered by MyStore OS — mystoreos.in", isThermal ? pageW/2 : marginL, yOffset, isThermal ? {align:'center'} : {});
    yOffset += 4;
    doc.setFontSize(7);
    doc.setTextColor(200, 210, 220);
    if (!isThermal) doc.text("MyStore OS © " + new Date().getFullYear(), marginL, yOffset);

      // Watermark on trial bills
      const isTrialBill = !user.subscriptionTier && (user.subscription === 'trial' || user.subscription === 'expired');
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

      const safeName = (user.name || 'Bill').replace(/[^a-zA-Z0-9]/g, '_');
      const pdfFileName = invoiceNo
        ? `${safeName}_${modeShort}-${invoiceNo}.pdf`
        : `${safeName}_${billingMode === 'estimate' ? 'Estimate' : billingMode === 'challan' ? 'Challan' : 'Invoice'}.pdf`;

      // If copies > 1, duplicate the page
      if (printCopies > 1) {
        const singlePageData = doc.output('arraybuffer');
        for (let c = 1; c < printCopies; c++) {
          doc.addPage(isThermal ? [pageW, pageH] : 'a4');
          // Re-add content via a new doc and copy pages isn't natively supported in jsPDF
          // So we mark the copy with a "COPY" watermark on extra pages
          doc.setFont("helvetica", "bold");
          doc.setFontSize(isThermal ? 9 : 14);
          doc.setTextColor(tR, tG, tB);
          doc.text(`COPY ${c} — ${safeName}`, isThermal ? pageW/2 : 105, isThermal ? 10 : 20, { align: 'center' });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(isThermal ? 7 : 9);
          doc.setTextColor(100, 116, 139);
          doc.text(`${modeTitle}  |  Total: Rs. ${total.toFixed(2)}  |  ${new Date().toLocaleDateString('en-IN')}`, isThermal ? pageW/2 : 105, isThermal ? 17 : 30, { align: 'center' });
          if (invoiceNo) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(isThermal ? 8 : 11); doc.setTextColor(tR,tG,tB);
            doc.text(`${modeShort}-${invoiceNo}`, isThermal ? pageW/2 : 105, isThermal ? 24 : 40, { align: 'center' });
          }
          // Diagonal COPY stamp
          doc.setFont("helvetica", "bold");
          doc.setFontSize(isThermal ? 20 : 40);
          doc.setTextColor(tR, tG, tB);
          doc.text('COPY', isThermal ? pageW/2 : 105, isThermal ? pageH/2 : 148, { align: 'center', angle: 315 });
        }
      }

      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], pdfFileName, { type: "application/pdf" });

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
        msg += `\n`;
        billItems.forEach(i => {
          const u = UNIT_SUFFIX[resolveUnit(i, shopCategory)];
          const qd = u ? `${i.qty || 1} ${u}` : `x${i.qty || 1}`;
          const lineBase = i.price * (i.qty || 1);
          const iDisc = i.itemDiscount || 0;
          const iDiscAmt = iDisc > 0 ? Math.round(lineBase * iDisc / 100) : 0;
          const lineTotal = lineBase - iDiscAmt;
          const variantStr = i.selectedVariant ? ` (${i.selectedVariant})` : '';
          if (iDisc > 0) {
            msg += `- ${i.name}${variantStr} ${qd}: ~~Rs.${lineBase}~~ *Rs.${lineTotal}* (-${iDisc}%)\n`;
          } else {
            msg += `- ${i.name}${variantStr} ${qd}: Rs.${lineTotal}\n`;
          }
        });
        msg += `\n`;
        if (itemLevelSavings > 0) {
          msg += `Item Discounts: -Rs.${itemLevelSavings}\n`;
          msg += `Subtotal: Rs.${billTotal}\n`;
        }
        if (discountAmount > 0 || manualDiscountAmt > 0) msg += `Bill Discount: -Rs.${discountAmount + manualDiscountAmt}\n`;
        if (loyaltyDiscountRupees > 0) msg += `Loyalty Redeemed: -Rs.${loyaltyDiscountRupees}\n`;
        msg += `*TOTAL: Rs.${total}*\n`;
        const pmLabel = { Cash: '💵 Cash', UPI: '📱 UPI', Card: '💳 Card', Credit: '📒 Credit' };
        msg += `Payment: ${pmLabel[paymentMethod] || '💵 Cash'}\n`;
        const totalSavedWA = itemLevelSavings + discountAmount + manualDiscountAmt + loyaltyDiscountRupees;
        if (totalSavedWA > 0) msg += `🎉 *You saved Rs.${totalSavedWA} on this ${billingMode === 'estimate' ? 'estimate' : billingMode === 'challan' ? 'challan' : 'bill'}!*\n`;
        if (billingMode === 'bill' && upiId) {
          const ref = encodeURIComponent(invoiceNo ? `Ref-${invoiceNo}` : 'ORD');
          msg += `\nPay instantly via UPI: upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&tn=${ref}&cu=INR (enter Rs.${total})\n`;
        }
        await sendWhatsApp(customerPhone, msg);
        // Also offer to open directly to customer's number on devices that support it
        if (customerPhone) {
          const cleanedPhone = customerPhone.replace(/\D/g, '');
          const phoneWithCountry = cleanedPhone.startsWith('91') ? cleanedPhone : `91${cleanedPhone}`;
          toast.info(`Bill sent! Opening WhatsApp for ${customerPhone}...`, { autoClose: 2000 });
        }
      } else {
        // Starter plan: save PDF locally instead of WhatsApp share
        doc.save(pdfFileName);
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
    
    // Vocal synthesis: order accepted (payment is confirmed separately)
    if (o && 'speechSynthesis' in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(`New order received for ${o.total} rupees. Order accepted.`));
    }
    loadData();
  };

  const sales = orders.filter(o => o.status === 'Accepted' && !(o.userId || '').startsWith('estimate') && !(o.userId || '').startsWith('challan')).reduce((a, b) => a + b.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'Pending' && !(o.userId || '').startsWith('estimate') && !(o.userId || '').startsWith('challan')).length;
  const payable = credits.filter(c => !c.paid).reduce((a, b) => a + b.amount, 0);
  // billTotal includes per-item discounts
  const billTotal = billItems.reduce((a, b) => {
    const lineBase = b.price * (b.qty || 1);
    const lineDisc = b.itemDiscount > 0 ? Math.round(lineBase * b.itemDiscount / 100) : 0;
    return a + lineBase - lineDisc;
  }, 0);
  const billItemsOriginalTotal = billItems.reduce((a, b) => a + (b.price * (b.qty || 1)), 0);
  const itemLevelSavings = billItemsOriginalTotal - billTotal;
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
          const foundProd = products.find(p => p.barcode === decodedText);
          if (activeTab === 'home') {
            if (foundProd) setScanPopupProduct(foundProd);
            else toast.error('Product not found in inventory!');
          } else if (showEditProductModal) {
            // already handled above (setEditProdBarcode)
          } else if (foundProd) {
            addToBill(foundProd);
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
        { hsnCode: newProdHsnCode, gstRate: newProdGstRate, costPrice: parseFloat(newProdCostPrice) || 0, image: newProdImages[0] || newProdImage, images: newProdImages, unit: newProdUnit || shopDefaultUnit, isFeatured: newProdFeatured, discountPct: parseInt(newProdDiscountPct) || 0 }
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
      setNewProdImages([]);
      setNewProdFeatured(false);
      setNewProdUnit('');
      setNewProdDiscountPct('0');
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
    if (!hasFeature('staffAccounts')) return toast.error("Staff accounts require the PRO plan. Please upgrade.");
    if (!newStaffPhone || !newStaffName) return toast.error("Phone and Name are required");
    const pin = newStaffPin.trim();
    if (!pin || !/^\d{4}$/.test(pin)) return toast.error("Set a 4-digit PIN for this staff member");
    try {
      await safe(() => api.addStaff(targetShopId, newStaffPhone, pin, newStaffName));
      toast.success(`✅ ${newStaffName} added! Their login PIN is ${pin}`);
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffPin('');
      setShowStaffModal(false);
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
      upiId, merchantUpiId, merchantCode, logo, shopPhotos, paymentQr,
      latitude: parseFloat(latitude) || null,
      longitude: parseFloat(longitude) || null,
      gstin, stateCode, businessAddress
    }));
    const updatedUser = { 
      ...user, upiId, merchantUpiId, merchantCode, logo, shopPhotos, paymentQr, 
      latitude: parseFloat(latitude) || null, 
      longitude: parseFloat(longitude) || null,
      gstin, stateCode, businessAddress
    };
    try { localStorage.setItem('mystore_session', JSON.stringify(updatedUser)); } catch (_e) { /* ignore */ }
    toast.success("Profile Updated successfully!");
  };

  // Save name (and phone if changed)
  const handleSaveAccountDetails = async () => {
    setProfileSaving(true);
    try {
      const updates = {};
      if (editName.trim() && editName.trim() !== user.name) updates.name = editName.trim();
      if (editPhone.trim() && editPhone.trim() !== user.phone) {
        // Phone is the login ID — update in public.users; auth email mirrors it
        const cleanPhone = editPhone.replace(/\D/g,'').slice(0,10);
        if (!/^\d{10}$/.test(cleanPhone)) { toast.error('Enter a valid 10-digit mobile number'); return; }
        updates.phone = cleanPhone;
      }
      if (Object.keys(updates).length === 0) { toast('Nothing changed'); return; }
      const updated = await safe(() => api.updateProfile(user.id, updates));
      // Refresh session
      const refreshed = { ...user, ...updates };
      try { localStorage.setItem('mystore_session', JSON.stringify(refreshed)); } catch {}
      toast.success('✅ Account details updated!');
    } catch(e) { toast.error(e.message || 'Could not update'); }
    finally { setProfileSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword) return toast.error('Enter a new password');
    if (newPassword.length < 4) return toast.error('Password must be at least 4 characters');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    setProfileSaving(true);
    try {
      await api.changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      toast.success('✅ Password / PIN updated!');
    } catch(e) { toast.error(e.message || 'Could not update password'); }
    finally { setProfileSaving(false); }
  };

  const handleSaveShopHours = async () => {
    await safe(() => api.updateProfile(user.id, { openingHour, closingHour, weeklyHolidays }));
    toast.success('Shop hours saved!');
  };

  const handleSaveShopBanner = async () => {
    await safe(() => api.updateProfile(user.id, { shopBanner }));
    toast.success(shopBanner?.active ? '🏷️ Banner is live!' : 'Banner saved (inactive)');
  };

  // Load the shop's currently-assigned CA on mount
  useEffect(() => {
    if (!user?.id) return;
    api.getMyCA(user.id).then(ca => setMyCA(ca)).catch(() => {});
    api.getLinkedDistributors(user.id).then(d => setMyDistributors(d || [])).catch(() => {});
  }, [user?.id]);

  const handleLinkDistributor = async () => {
    setDistLinkBusy(true);
    try {
      const res = await api.linkByPublicCode(user.id, 'shop', distCodeInput);
      setDistCodeInput('');
      setMyDistributors(await api.getLinkedDistributors(user.id));
      toast.success(`Linked with distributor ${res.name}`);
    } catch (ex) {
      toast.error(ex.message || 'Could not link.');
    } finally {
      setDistLinkBusy(false);
    }
  };

  const handleUnlinkDistributor = async (distId) => {
    try {
      await api.unlinkShopDistributor(user.id, distId);
      setMyDistributors(await api.getLinkedDistributors(user.id));
      toast.success('Distributor unlinked');
    } catch (ex) {
      toast.error(ex.message || 'Could not unlink.');
    }
  };

  const handleAssignCA = async () => {
    setCaBusy(true);
    try {
      const ca = await api.assignCAByPhone(user.id, caPhoneInput);
      setMyCA({ id: ca.id, name: ca.name, phone: caPhoneInput.trim() });
      setCaPhoneInput('');
      toast.success(`${ca.name} is now your accountant. They can see your books.`);
    } catch (ex) {
      toast.error(ex.message || 'Could not assign CA.');
    } finally {
      setCaBusy(false);
    }
  };

  const handleRemoveCA = async () => {
    setCaBusy(true);
    try {
      await api.removeCA(user.id);
      setMyCA(null);
      toast.success('Accountant removed. They can no longer see your books.');
    } catch (ex) {
      toast.error(ex.message || 'Could not remove CA.');
    } finally {
      setCaBusy(false);
    }
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

  const handleSavePrintSettings = async () => {
    try {
      await safe(() => api.saveSiteConfig('printSettings_' + targetShopId, {
        format: printFormat, fontSize: printFontSize, showLogo: printShowLogo, copies: printCopies
      }));
      toast.success('Print settings saved!');
    } catch { toast.error('Failed to save print settings'); }
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

    const added = [];
    for (const file of files) {
      try {
        const url = await safe(() => api.uploadAsset(file, user.id, 'shop_photos'));
        if (url) added.push(url);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (added.length) {
      const next = [...shopPhotos, ...added];
      setShopPhotos(next);
      await safe(() => api.updateProfile(user.id, { shopPhotos: next }));
      try {
        const sess = JSON.parse(localStorage.getItem('mystore_session') || '{}');
        localStorage.setItem('mystore_session', JSON.stringify({ ...sess, shopPhotos: next }));
      } catch (_e) { /* ignore */ }
      toast.success("Photos saved!");
    }
  };

  const removeShopPhoto = async (index) => {
    const next = shopPhotos.filter((_, i) => i !== index);
    setShopPhotos(next);
    await safe(() => api.updateProfile(user.id, { shopPhotos: next }));
    try {
      const sess = JSON.parse(localStorage.getItem('mystore_session') || '{}');
      localStorage.setItem('mystore_session', JSON.stringify({ ...sess, shopPhotos: next }));
    } catch (_e) { /* ignore */ }
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
        // Persist immediately so it survives re-login without a separate Save tap.
        await safe(() => api.updateProfile(user.id, { paymentQr: url }));
        try {
          const sess = JSON.parse(localStorage.getItem('mystore_session') || '{}');
          localStorage.setItem('mystore_session', JSON.stringify({ ...sess, paymentQr: url }));
        } catch (_e) { /* ignore */ }
        toast.success("Payment QR saved!");
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

  // Yearly price helper: base price from admin config, discounted while the
  // launch offer has remaining slots. Server recomputes this in the edge
  // function, so a tampered client price can't change what's charged.
  const priceFor = (planId, cycle = billingCycle) => {
    if (!pricing) return null;
    return api.computePrice(pricing, planId, cycle);
  };

  const handleSubscribe = async (plan) => {
    if (!plan) return;
    if (!sysSettings.razorpayKey) {
      return toast.error("Admin has not configured Razorpay yet.");
    }

    const cycle = billingCycle;
    const pr = priceFor(plan.id, cycle);
    if (!pr || !pr.final) return toast.error('Pricing is not available for this plan yet.');
    const payPlanId = cycle === 'monthly' ? plan.id : `${plan.id}_${cycle}`;
    const payPrice = pr.final;

    // Create server-side Razorpay order. This is REQUIRED — without a server
    // order_id the payment can't be signature-verified, so we must NOT fall
    // back to a client-only charge (that path can take money without granting
    // the plan, or be tampered). Hard-fail with a clear message instead.
    let orderId = null;
    try {
      const orderData = await api.createRazorpayOrder(payPlanId, payPrice);
      orderId = orderData?.orderId;
    } catch (e) {
      orderId = null;
    }
    if (!orderId) {
      toast.error('Payment could not be started securely right now. Please try again in a moment or contact support.');
      return;
    }

    const options = {
      key: sysSettings.razorpayKey,
      amount: (payPrice * 100).toString(),
      currency: "INR",
      name: "MyStore OS",
      description: `${plan.name} ${cycle !== 'monthly' ? cycle : ''} Subscription`,
      order_id: orderId,
      image: logo || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=128&q=80",
      handler: async function (response) {
        try {
          await safe(() => api.verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId: payPlanId,
            userId: targetShopId,
          }));
          toast.success(`Payment successful! Upgrading to ${plan.name}...`);
          // The verify-payment edge function grants the tier server-side after
          // verifying the signature. Re-fetch the authoritative profile rather
          // than setting the tier on the client (clients can't change billing
          // columns — that's enforced by the DB trigger).
          const updatedUser = await safe(() => api.getUserById(targetShopId));
          if (updatedUser) {
            setUser(updatedUser);
            localStorage.setItem('mystore_session', JSON.stringify(updatedUser));
          }
          setShowPlanSelectorModal(false);
          if (user.phone) sendPaymentConfirmation(user.phone, user.name, plan.name, payPrice);
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
      case 'success': return '#22C55E';
      case 'error': return '#EF4444';
      default: return '#3B82F6';
    }
  };

  const renderBillingToggle = () => {
    if (!pricing) return null;
    const cycles = ['monthly', 'quarterly', 'yearly'].filter(c => pricing.enabledCycles?.[c]);
    if (cycles.length <= 1) return null;
    const offerOn = !!pricing.offer?.enabled && Number(pricing.offer?.remaining) > 0 && Number(pricing.offer?.percent) > 0;
    const cycleLabel = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
    return (
      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '4px', flexWrap: 'wrap' }}>
          {cycles.map(c => {
            const disc = c !== 'monthly' ? Number(pricing.discounts?.[c]) || 0 : 0;
            return (
              <button key={c} onClick={() => setBillingCycle(c)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                  background: billingCycle === c ? '#4F46E5' : 'transparent', color: billingCycle === c ? '#fff' : '#94A3B8', position: 'relative' }}>
                {cycleLabel[c]}
                {disc > 0 && <span style={{ marginLeft: 5, fontSize: '10px', color: billingCycle === c ? '#fff' : '#10B981', fontWeight: 800 }}>-{disc}%</span>}
              </button>
            );
          })}
        </div>
        {offerOn && billingCycle !== 'monthly' && (
          <div style={{ marginTop: '10px', color: '#10B981', fontSize: '12px', fontWeight: 700 }}>
            🎉 Launch offer: extra {pricing.offer.percent}% OFF — only {pricing.offer.remaining} slots left!
          </div>
        )}
      </div>
    );
  };

  const renderPlanPrice = (plan) => {
    const cycleSuffix = { monthly: '/ mo', quarterly: '/ 3 mo', yearly: '/ yr' };
    const pr = priceFor(plan.id, billingCycle);
    if (!pr || !pr.final) {
      return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '32px', fontWeight: '800', color: '#fff' }}>₹{plan.price}</span>
          <span style={{ fontSize: '12px', color: '#CBD5E1' }}>/ month</span>
        </div>
      );
    }
    const showStrike = pr.final < pr.base;
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
          {showStrike && <span style={{ fontSize: '16px', color: '#94A3B8', textDecoration: 'line-through' }}>₹{pr.base}</span>}
          <span style={{ fontSize: '32px', fontWeight: '800', color: '#fff' }}>₹{pr.final}</span>
          <span style={{ fontSize: '12px', color: '#CBD5E1' }}>{cycleSuffix[billingCycle]}</span>
        </div>
        {billingCycle !== 'monthly' && (
          <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>
            {pr.offerOn ? `Save ${pr.cycleDisc + pr.offerPercent}% total — launch offer` : pr.cycleDisc > 0 ? `Save ${pr.cycleDisc}% vs monthly` : ''}
          </span>
        )}
      </div>
    );
  };

  const styles = {
    bg: { backgroundColor: '#F4F5F7', minHeight: '100vh', color: '#0F172A', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
    header: { background: '#0F172A', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    statRow: { display: 'flex', gap: '8px', padding: '12px', overflowX: 'auto' },
    statBox: { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', flex: 1, minWidth: '80px', padding: '12px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' },
    statNum: { fontSize: '22px', fontWeight: '800', color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", margin: 0 },
    statLabel: { fontSize: '11px', color: '#64748B', fontWeight: '600', margin: 0 },
    searchBar: { margin: '12px', display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF', border: '1.5px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', borderRadius: '8px', padding: '0 12px' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '0 12px' },
    gridBtn: { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' },
    gridIcon: { color: '#4F46E5' },
    gridTitle: { fontSize: '12px', fontWeight: '700', color: '#0F172A', margin: 0 },
    gridSub: { fontSize: '10px', color: '#64748B', margin: 0 },
    section: { margin: '16px 12px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' },
    sectionHeader: { backgroundColor: '#F8FAFC', padding: '12px', fontSize: '14px', fontWeight: 'bold', color: '#0F172A', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' },
    whatsappBtn: { backgroundColor: '#22C55E', color: 'white', width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer' },
    upiBtn: { backgroundColor: '#4F46E5', color: 'white', width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer' },
    prodItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E2E8F0' },
    orderCard: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', margin: '12px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' },
    navBtn: { textAlign: 'center', cursor: 'pointer' }
  };

  if (!isMobile) {
    return (
      <div className="enterprise-wrapper" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', paddingLeft: '240px', backgroundColor: '#F8FAFC', color: '#0F172A', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <ToastContainer theme="dark" position="top-center" />
        {isExpired && isOwner && (
          <TrialExpiredOverlay planLabel={planLabel} onUpgrade={() => setShowPlanSelectorModal(true)} />
        )}
        {deviceLimitExceeded && isOwner && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ maxWidth: '440px', width: '100%', background: 'linear-gradient(135deg, #1E293B, #0F172A)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '20px', padding: '36px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '14px' }}>📱</div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '800', color: 'white' }}>Device Limit Reached</h2>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
                Your <b style={{ color: 'white' }}>{planLabel}</b> allows up to <b style={{ color: '#FBBF24' }}>{capabilities?.maxDevices ?? 1} active device{(capabilities?.maxDevices ?? 1) > 1 ? 's' : ''}</b>.
                You have {activeSessions.length} device{activeSessions.length !== 1 ? 's' : ''} logged in.
              </p>
              <p style={{ margin: '0 0 24px 0', fontSize: '12px', color: '#64748B' }}>
                Sign out from your other devices, or force this device in by revoking all other sessions.
              </p>
              <button onClick={forceRevokeOthers} style={{ width: '100%', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', color: 'white', border: 'none', padding: '13px', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', marginBottom: '10px' }}>
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

        <DesktopSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOwner={isOwner}
          pendingOrders={pendingOrders}
          handleLogout={handleLogout}
          userName={user.name}
          publicCode={user.publicCode}
          syncStatus={{ isOnline, pendingCount }}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="enterprise-main" style={{ marginTop: announceConfig.active && announceConfig.text ? '40px' : '0px' }}>
          {activeTab === 'home' && (
            <DesktopPOS 
              footerSlot={isOwner ? <ReferAndEarnCard userId={user?.id} userName={user?.name} /> : null}
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
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              onClearCart={clearCart}
              updateBillItemDiscount={updateBillItemDiscount}
              scanPopupProduct={scanPopupProduct}
              onScanPopupAdd={(prod) => { addToBill(prod); setScanPopupProduct(null); }}
              onScanPopupClose={() => setScanPopupProduct(null)}
            />
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
              onShowBarcodeManager={openBarcodeManager}
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
              merchantUpiId={merchantUpiId}
              setMerchantUpiId={setMerchantUpiId}
              merchantCode={merchantCode}
              setMerchantCode={setMerchantCode}
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
              editName={editName}
              setEditName={setEditName}
              editPhone={editPhone}
              setEditPhone={setEditPhone}
              currentPassword={currentPassword}
              setCurrentPassword={setCurrentPassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              profileSaving={profileSaving}
              handleSaveAccountDetails={handleSaveAccountDetails}
              handleChangePassword={handleChangePassword}
              getShopUrl={getShopUrl}
              downloadQrPoster={downloadQrPoster}
              downloadQrPng={downloadQrPng}
              handleShareShop={handleShareShop}
              staffList={staffList}
              newStaffName={newStaffName}
              setNewStaffName={setNewStaffName}
              newStaffPhone={newStaffPhone}
              setNewStaffPhone={setNewStaffPhone}
              newStaffPin={newStaffPin}
              setNewStaffPin={setNewStaffPin}
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
              printFormat={printFormat}
              setPrintFormat={setPrintFormat}
              printFontSize={printFontSize}
              setPrintFontSize={setPrintFontSize}
              printShowLogo={printShowLogo}
              setPrintShowLogo={setPrintShowLogo}
              printCopies={printCopies}
              setPrintCopies={setPrintCopies}
              handleSavePrintSettings={handleSavePrintSettings}
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
              myDistributors={myDistributors}
              distCodeInput={distCodeInput}
              setDistCodeInput={setDistCodeInput}
              handleLinkDistributor={handleLinkDistributor}
              handleUnlinkDistributor={handleUnlinkDistributor}
            />
          )}
        </div>
        </div>

        {/* Global Modals for Desktop */}
        {showPaymentQrModal && (paymentQr || upiId) && (
          <div onClick={() => setShowPaymentQrModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '24px', padding: '32px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px', fontWeight: 800 }}>{user.name}</h2>
              <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '20px' }}>Scan to Pay • ₹{billTotal > 0 ? billTotal : '0'}</p>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block' }}>
                {paymentQr ? (
                  <img src={paymentQr} alt="Payment QR" style={{ width: '240px', height: '240px', objectFit: 'contain' }} />
                ) : (
                  <QRCodeSVG
                    value={buildUpiUri({ upiId, merchantUpiId: user.merchantUpiId, merchantCode: user.merchantCode, name: user.name }, { amount: billTotal || 0, txnRef: 'BILL' + Date.now().toString().slice(-8), note: 'Bill Payment' })}
                    size={240}
                  />
                )}
              </div>
              <p style={{ color: '#22C55E', fontSize: '12px', marginTop: '16px', fontWeight: 'bold' }}>GPay • PhonePe • Paytm • Any UPI App</p>
              <div style={{ textAlign: 'center', marginTop: '8px', padding: '4px 10px', background: 'rgba(79,70,229,0.08)', borderRadius: '8px', display: 'inline-block' }}>
                <span style={{ fontSize: '10px', color: '#4F46E5', fontWeight: '700' }}>MyStore OS</span>
                <span style={{ fontSize: '9px', color: '#64748B' }}> • mystoreos.in</span>
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
              <button onClick={() => setShowScanner(false)} style={{ width: '100%', padding: '16px', background: '#EF4444', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>Cancel Scan</button>
            </div>
          </div>
        )}

        {showReturnModal && returnOrder && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
            <div style={{ background: '#1E293B', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '24px', border: '1px solid #EF4444' }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                Process Sales Return
                <span onClick={() => setShowReturnModal(false)} style={{ cursor: 'pointer', color: '#94A3B8' }}>✕</span>
              </h2>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '16px' }}>Select the quantity to return for each item in Order #{returnOrder.id.substring(0,8)}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '40vh', overflowY: 'auto', paddingRight: '4px' }}>
                {returnOrder.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0F172A', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#FBBF24' }}>₹{item.price} x {item.qty}</p>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', color: '#EF4444' }}>
                  <span>Total Refund:</span>
                  <span>₹{returnOrder.items.reduce((sum, item) => sum + (item.price * (returnItemsState[item.id] || 0)), 0).toFixed(2)}</span>
                </div>
                <button onClick={handleProcessReturn} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                  Confirm Return & Generate Credit Note
                </button>
              </div>
            </div>
          </div>
        )}

        {showAdminPinModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#1E293B', width: '100%', maxWidth: '350px', borderRadius: '16px', padding: '30px', border: '2px solid #EF4444', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#EF4444' }}>Admin Authorization Required</h2>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '24px' }}>This action is restricted. Please ask the shop owner to enter their Admin PIN to proceed.</p>
              
              <input 
                type="password" 
                placeholder="Enter Admin PIN" 
                value={adminPinInput} 
                onChange={e => setAdminPinInput(e.target.value)} 
                style={{ padding: '16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '20px', width: '100%', textAlign: 'center', letterSpacing: '8px', marginBottom: '16px' }} 
              />
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setShowAdminPinModal(false); setAdminPinInput(''); setPendingAction(null); }} style={{ flex: 1, background: 'transparent', color: '#94A3B8', border: '1px solid #334155', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAdminPinSubmit} style={{ flex: 1, background: '#EF4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Authorize</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD PRODUCT MODAL — desktop */}
        {showBarcodeManager && (
          <BarcodeManager
            products={products}
            shopName={user.name}
            onClose={() => setShowBarcodeManager(false)}
            onAssignBarcode={async (prodId, value) => {
              await api.editProduct(prodId, { barcode: value });
              setProducts(prev => prev.map(p => p.id === prodId ? { ...p, barcode: value } : p));
            }}
            onScanToAdd={(code) => { setScannedBarcode(code); setShowAddProductModal(true); }}
          />
        )}

        {showAddProductModal && (
          <div onClick={() => setShowAddProductModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#1E293B', width: '100%', maxWidth: '560px', borderRadius: '20px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>📦 Add Product to Inventory</h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
                <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
                  <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Cost Price (₹)</label>
                  <input type="number" value={newProdCostPrice} onChange={e => setNewProdCostPrice(e.target.value)} placeholder="e.g. 8" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
              </div>

              {/* Label Discount % — for barcode price label printing */}
              <div style={{ marginBottom: '16px', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#818CF8', marginBottom: '8px', fontWeight: '700' }}>🏷️ Label Discount % <span style={{ fontWeight: 400, color: '#64748B', fontSize: '11px' }}>(shown on barcode price label)</span></label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {[0, 5, 10, 15, 20, 25, 50].map(d => (
                    <button key={d} type="button" onClick={() => setNewProdDiscountPct(String(d))}
                      style={{ flex: 1, padding: '6px 2px', background: parseInt(newProdDiscountPct) === d ? '#4F46E5' : 'rgba(79,70,229,0.1)', color: parseInt(newProdDiscountPct) === d ? '#fff' : '#818CF8', border: '1px solid rgba(79,70,229,0.3)', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                      {d === 0 ? 'None' : `${d}%`}
                    </button>
                  ))}
                  <input type="number" min="0" max="99" value={newProdDiscountPct} onChange={e => setNewProdDiscountPct(e.target.value)}
                    style={{ width: '52px', padding: '6px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '700', outline: 'none', textAlign: 'center' }} />
                  <span style={{ fontSize: '11px', color: '#64748B' }}>%</span>
                </div>
                {parseInt(newProdDiscountPct) > 0 && newProdPrice && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ textDecoration: 'line-through', color: '#64748B' }}>₹{newProdPrice}</span>
                    <span style={{ fontWeight: '800' }}>→ ₹{Math.round(Number(newProdPrice) * (1 - parseInt(newProdDiscountPct) / 100))}</span>
                    <span style={{ background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>{newProdDiscountPct}% OFF</span>
                    <span style={{ color: '#64748B', fontSize: '11px' }}>will print on label</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Stock Qty</label>
                  <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Min Stock Alert</label>
                  <input type="number" value={newProdReorder} onChange={e => setNewProdReorder(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Batch Number</label>
                  <input type="text" value={newProdBatch} onChange={e => setNewProdBatch(e.target.value)} placeholder="e.g. B-901" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Expiry Date</label>
                  <input type="date" value={newProdExpiry} onChange={e => setNewProdExpiry(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Variants (comma-separated)</label>
                <input type="text" value={newProdVariants} onChange={e => setNewProdVariants(e.target.value)} placeholder="e.g. Red, Blue or Small, Medium" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Selling Unit</label>
                <select value={newProdUnit || shopDefaultUnit} onChange={e => setNewProdUnit(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }}>
                  {unitOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748B' }}>Default for your shop type: <b style={{ color: '#94A3B8' }}>{shopDefaultUnit}</b></p>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                  <input type="text" value={newProdHsnCode} onChange={e => setNewProdHsnCode(e.target.value)} placeholder="e.g. 1905" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate (%)</label>
                  <select value={newProdGstRate} onChange={e => setNewProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }}>
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
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Barcode (Optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={scannedBarcode} onChange={e => setScannedBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ flex: 1, padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                </div>
                {scannedBarcode && (
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                    <Barcode value={scannedBarcode} height={40} width={2} fontSize={14} />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <ProductImageUploader images={newProdImages} onChange={setNewProdImages} userId={user.id} dark />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '11px 13px' }}>
                <input type="checkbox" checked={newProdFeatured} onChange={(e) => setNewProdFeatured(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: '#4F46E5' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#E2E8F0' }}>⭐ Feature on storefront</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>Show this product in the Featured row at the top of your store.</div>
                </div>
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleSaveProduct} style={{ flex: 1, background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Product</button>
                <button onClick={() => { setShowAddProductModal(false); setNewProdImage(''); }} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: '#94A3B8', border: '1px solid #334155', padding: '14px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
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
            background: 'linear-gradient(135deg, #1E293B, #0F172A)',
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
                color: '#CBD5E1',
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
              <h2 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', margin: '0 0 8px 0', background: 'linear-gradient(to right, #FFFFFF, #94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', color: '#fff' }}>
                Select Your Business Growth Plan
              </h2>
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Unlock high-fidelity retail tools: barcode compliance, direct GST invoicing, CA Ledger access, and multi-staff lock-outs.
              </p>
            </div>

            {renderBillingToggle()}
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
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#CBD5E1', minHeight: '32px' }}>{plan.description}</p>
                    </div>

                    {renderPlanPrice(plan)}

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: 0 }} />

                    {/* Features checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
                      {plan.features?.map((feat, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: '#10B981', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                          <span style={{ fontSize: '12px', color: '#CBD5E1' }}>{feat}</span>
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
                          color: '#94A3B8',
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
                          color: isPopular ? 'white' : '#0F172A',
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
            
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748B' }}>
              🔒 Secure, encrypted transactions powered by Razorpay PG. Cancel or downgrade anytime instantly.
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL — Desktop */}
      {showEditProductModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '600px', borderRadius: '20px', padding: '32px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#0F172A' }}>✏️ Edit Product Details</h2>
              <span onClick={() => setShowEditProductModal(false)} style={{ cursor: 'pointer', color: '#64748B', fontSize: '22px', lineHeight: 1 }}>✕</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
              <input type="text" value={editProdName} onChange={e => setEditProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
                <input type="number" value={editProdPrice} onChange={e => setEditProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Cost Price (₹)</label>
                <input type="number" value={editProdCostPrice} onChange={e => setEditProdCostPrice(e.target.value)} placeholder="e.g. 8" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Stock Qty</label>
                <input type="number" value={editProdStock} onChange={e => setEditProdStock(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Min Stock Alert</label>
                <input type="number" value={editProdReorder} onChange={e => setEditProdReorder(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>


            {/* Label Discount % */}
            <div style={{ marginBottom: '16px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '12px 14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#4F46E5', marginBottom: '8px', fontWeight: '700' }}>🏷️ Label Discount % <span style={{ fontWeight: 400, color: '#64748B', fontSize: '11px' }}>(for barcode price label)</span></label>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[0, 5, 10, 15, 20, 25, 50].map(d => (
                  <button key={d} type="button" onClick={() => setEditProdDiscountPct(String(d))}
                    style={{ padding: '6px 8px', background: parseInt(editProdDiscountPct) === d ? '#4F46E5' : '#fff', color: parseInt(editProdDiscountPct) === d ? '#fff' : '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    {d === 0 ? 'None' : `${d}%`}
                  </button>
                ))}
                <input type="number" min="0" max="99" value={editProdDiscountPct} onChange={e => setEditProdDiscountPct(e.target.value)}
                  style={{ width: '52px', padding: '6px 8px', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '12px', fontWeight: '700', outline: 'none', textAlign: 'center' }} />
                <span style={{ fontSize: '11px', color: '#64748B' }}>%</span>
              </div>
              {parseInt(editProdDiscountPct) > 0 && editProdPrice && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94A3B8' }}>₹{editProdPrice}</span>
                  <span style={{ fontWeight: '800' }}>→ ₹{Math.round(Number(editProdPrice) * (1 - parseInt(editProdDiscountPct) / 100))}</span>
                  <span style={{ background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>{editProdDiscountPct}% OFF</span>
                  <span style={{ color: '#94A3B8', fontSize: '11px' }}>will print on label</span>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Batch Number</label>
                <input type="text" value={editProdBatch} onChange={e => setEditProdBatch(e.target.value)} placeholder="e.g. B-901" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Expiry Date</label>
                <input type="date" value={editProdExpiry} onChange={e => setEditProdExpiry(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Variants (comma-separated)</label>
              <input type="text" value={editProdVariants} onChange={e => setEditProdVariants(e.target.value)} placeholder="e.g. Red, Blue, Green or Small, Medium" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Selling Unit</label>
              <select value={editProdUnit || shopDefaultUnit} onChange={e => setEditProdUnit(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }}>
                {unitOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                <input type="text" value={editProdHsnCode} onChange={e => setEditProdHsnCode(e.target.value)} placeholder="e.g. 1905" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate (%)</label>
                <select value={editProdGstRate} onChange={e => setEditProdGstRate(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }}>
                  <option value="0">0% (Exempt)</option>
                  <option value="3">3%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Barcode (Optional)</label>
              <input type="text" value={editProdBarcode} onChange={e => setEditProdBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
              {editProdBarcode && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', marginTop: '10px', display: 'flex', justifyContent: 'center', border: '1px solid #E2E8F0' }}>
                  <Barcode value={editProdBarcode} height={40} width={2} fontSize={14} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <ProductImageUploader images={editProdImages} onChange={setEditProdImages} userId={user.id} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', cursor: 'pointer', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '11px 13px' }}>
              <input type="checkbox" checked={editProdFeatured} onChange={(e) => setEditProdFeatured(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: '#4F46E5' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>⭐ Feature on storefront</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Show this product in the Featured row at the top of your store.</div>
              </div>
            </label>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleUpdateProduct} style={{ flex: 1, background: 'linear-gradient(135deg, #4F46E5, #4338CA)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Update Product</button>
              <button onClick={() => setShowEditProductModal(false)} style={{ flex: 1, background: 'transparent', color: '#64748B', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
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
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <div style={{ width: 12, height: 12, background: 'white', borderRadius: '50%' }}></div>
            MyStore Pro
          </h2>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.9, color: '#CBD5E1' }}>
            {user.name}
            {user?.publicCode && <span style={{ marginLeft: '8px', fontFamily: 'monospace', fontSize: '11px', color: '#818CF8', fontWeight: 700 }}>· {user.publicCode}</span>}
          </p>
          <span style={{ display: 'inline-block', marginTop: '4px', background: isOpenNow ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: isOpenNow ? '#4ADE80' : '#F87171', border: `1px solid ${isOpenNow ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>
            {isOpenNow ? '● Open Now' : `● Closed`}
          </span>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', width: 'auto', flexShrink: 0 }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      {isOwner && isOnTrial && !trialBannerDismissed && (
        <div style={{ background: trialDaysLeft >= 5 ? 'linear-gradient(90deg,#16A34A,#15803D)' : trialDaysLeft >= 3 ? 'linear-gradient(90deg,#D97706,#B45309)' : 'linear-gradient(90deg,#DC2626,#B91C1C)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
            ⏰ {trialDaysLeft === 0 ? 'Trial ends today!' : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your free trial`}
            {trialDaysLeft <= 3 && <span style={{ marginLeft: '8px', opacity: 0.9, fontWeight: 400, fontSize: '12px' }}>— Upgrade to keep your data & features</span>}
          </span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => setShowPlanSelectorModal(true)} style={{ background: '#fff', color: trialDaysLeft >= 5 ? '#16A34A' : trialDaysLeft >= 3 ? '#D97706' : '#DC2626', border: 'none', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Upgrade →
            </button>
            <button onClick={() => { sessionStorage.setItem(`mystore_trial_banner_dismissed_${user.id}`, '1'); setTrialBannerDismissed(true); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>×</button>
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
            <div style={{ margin: '12px', background: 'linear-gradient(145deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))', border: '1px solid #EF4444', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#FCA5A5' }}>AI Inventory Warning</h4>
                <p style={{ margin: 0, fontSize: '11px', color: '#F87171' }}>
                  You are running low on <b>{products.filter(p => p.stock < 10).map(p => p.name).join(', ')}</b>. Based on your weekend sales trend, you will run out by Sunday.
                </p>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div style={styles.statRow}>
            <div style={styles.statBox} onClick={() => setActiveTab('bills')}><p style={{...styles.statNum, color: pendingOrders > 0 ? '#EF4444' : '#4F46E5'}}>{pendingOrders}</p><p style={styles.statLabel}>New Orders</p></div>
            {isOwner && <div style={styles.statBox}><p style={styles.statNum}>₹{sales}</p><p style={styles.statLabel}>Revenue</p></div>}
            <div style={styles.statBox} onClick={() => setActiveTab('products')}><p style={styles.statNum}>{products.length}</p><p style={styles.statLabel}>Products</p></div>
            {isOwner && <div style={styles.statBox}><p style={styles.statNum}>₹{payable}</p><p style={styles.statLabel}>Credit Due</p></div>}
          </div>

          {/* Search */}
          <div style={styles.searchBar}>
            <Search size={18} color="#94A3B8" />
            <input 
              type="text" 
              placeholder="Search products to bill..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', margin: 0, boxShadow: 'none', width: '100%', minWidth: 0, padding: '12px', color:'#0F172A', outline:'none' }} 
            />
          </div>

          {/* Action Grid */}
          <div style={styles.grid}>
            <div style={styles.gridBtn} onClick={() => setShowScanner(true)}>
              <ScanLine size={24} color="#94A3B8" />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Scan Bill</p><p style={styles.gridSub}>స్కాన్ బిల్</p></div>
            </div>
            {isOwner && (
              <div style={styles.gridBtn} onClick={() => { setActiveTab('products'); setShowAddProductModal(true); }}>
                <Plus size={24} color="#4F46E5" />
                <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Add Product</p><p style={styles.gridSub}>కొత్త వస్తువు</p></div>
              </div>
            )}
            <div style={styles.gridBtn} onClick={openBarcodeManager}>
              <BarcodeIcon size={24} color="#4F46E5" />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Barcodes</p><p style={styles.gridSub}>బార్‌కోడ్</p></div>
            </div>
            <div style={styles.gridBtn} onClick={handleShowUpiQr}>
              <IndianRupee size={24} color="#F59E0B" />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Receive Pay</p><p style={styles.gridSub}>UPI QR</p></div>
            </div>
            {isOwner && (
              <div style={styles.gridBtn} onClick={() => setActiveTab('credit')}>
                <Book size={24} color="#F59E0B" />
                <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Credit Book</p><p style={styles.gridSub}>బకాయిలు</p></div>
              </div>
            )}
            <div style={styles.gridBtn} onClick={() => setActiveTab('bills')}>
              <Receipt size={24} color={pendingOrders > 0 ? "#EF4444" : "#94A3B8"} />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>All Bills</p><p style={styles.gridSub}>అన్ని బిల్లులు</p></div>
            </div>
            <div style={styles.gridBtn} onClick={handleShareShop}>
              <Share2 size={24} color="#EF4444" />
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
                    border: '1px solid ' + (billingMode === 'bill' ? '#10B981' : '#2A2F3D'),
                    background: billingMode === 'bill' ? 'rgba(16,185,129,0.15)' : '#1E222D',
                    color: billingMode === 'bill' ? '#10B981' : '#CBD5E1'
                  }}
                >
                  🟢 Standard Bill
                </button>
                <button 
                  onClick={() => setBillingMode('estimate')} 
                  style={{ 
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto',
                    border: '1px solid ' + (billingMode === 'estimate' ? '#4F46E5' : '#2A2F3D'),
                    background: billingMode === 'estimate' ? 'rgba(245,158,17,0.15)' : '#1E222D',
                    color: billingMode === 'estimate' ? '#4F46E5' : '#CBD5E1'
                  }}
                >
                  🟡 Estimate / Quote
                </button>
                <button 
                  onClick={() => setBillingMode('challan')} 
                  style={{ 
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto',
                    border: '1px solid ' + (billingMode === 'challan' ? '#3B82F6' : '#2A2F3D'),
                    background: billingMode === 'challan' ? 'rgba(59,130,246,0.15)' : '#1E222D',
                    color: billingMode === 'challan' ? '#3B82F6' : '#CBD5E1'
                  }}
                >
                  🔵 Delivery Challan
                </button>
              </div>

              {/* Customer details row */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid #2A2F3D', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94A3B8' }}>
                    👤 Customer Details { (billingMode === 'estimate' || billingMode === 'challan') && <span style={{ color: '#4F46E5' }}>(Recommended)</span> }
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Customer Name" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '8px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <input 
                    type="tel" 
                    placeholder="Mobile Number" 
                    value={customerPhone} 
                    onChange={e => setCustomerPhone(e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '8px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="GSTIN (Optional)" 
                    value={customerGstin} 
                    onChange={e => setCustomerGstin(e.target.value.toUpperCase())}
                    style={{ flex: 1, minWidth: 0, padding: '8px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <input 
                    type="text" 
                    placeholder="State Code" 
                    value={customerStateCode} 
                    onChange={e => setCustomerStateCode(e.target.value)}
                    style={{ width: '90px', flexShrink: 0, padding: '8px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginTop: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Billing Address (Optional)" 
                    value={customerAddress} 
                    onChange={e => setCustomerAddress(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Universal Custom Billing Input */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#0F172A', padding: '12px', borderRadius: '8px', border: '1px solid #334155', boxSizing: 'border-box' }}>
                <input 
                  type="text" placeholder="Item Name (e.g. Haircut)" value={customItemName} onChange={e=>setCustomItemName(e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '14px' }} 
                />
                <input 
                  type="number" placeholder="₹" value={customItemPrice} onChange={e=>setCustomItemPrice(e.target.value)}
                  style={{ width: '54px', flexShrink: 0, background: 'transparent', border: 'none', color: '#4F46E5', outline: 'none', fontSize: '14px', fontWeight: 'bold' }} 
                />
                <button onClick={addCustomItem} style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', width: 'auto', flexShrink: 0 }}>Add</button>
              </div>

              {/* Cart List */}
              {billItems.length === 0 ? (
                <p style={{color:'#94A3B8', fontSize:13, margin: '12px 0 20px 0', textAlign: 'center'}}>No items in bill yet. Add custom item or tap + below.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0 20px 0' }}>
                  {billItems.map((item, idx) => {
                    const variantList = item.variants ? item.variants.split(',').map(v => v.trim()) : [];
                    return (
                      <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0F172A', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2A2F3D' }}>
                        <div style={{ flex: 1, marginRight: '8px' }}>
                          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{item.name}</p>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ fontSize: '12px', color: '#FBBF24', fontWeight: 'bold' }}>₹{item.price}</span>
                            {variantList.length > 0 && (
                              <select 
                                value={item.selectedVariant || ''} 
                                onChange={(e) => updateBillItemVariant(item.id, e.target.value)}
                                style={{ background: '#1E293B', color: '#fff', border: '1px solid #334155', borderRadius: '4px', fontSize: '11px', padding: '2px 4px', outline: 'none' }}
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
                          
                          <span style={{ fontWeight: 'bold', color: '#22C55E', minWidth: '55px', textAlign: 'right', fontSize: '13px' }}>₹{item.price * (item.qty || 1)}</span>
                          
                          <button onClick={() => removeBillItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', width: 'auto', flexShrink: 0 }}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Promo code removed */}

              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#22C55E', marginTop: '8px', padding: '0 4px' }}>
                  <span>Discount Applied:</span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #2A2F3D', paddingTop: '16px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#4F46E5' }}>TOTAL</span>
                <div>
                  {discountAmount > 0 && <span style={{ fontSize: '14px', color: '#94A3B8', textDecoration: 'line-through', marginRight: '8px' }}>₹{billTotal}</span>}
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4F46E5' }}>₹{Math.max(0, billTotal - discountAmount)}</span>
                </div>
              </div>
              <button style={{...styles.whatsappBtn, background: billingMode === 'estimate' ? '#FBBF24' : (billingMode === 'challan' ? '#2563EB' : '#22C55E'), color: billingMode === 'estimate' ? '#000' : '#fff', opacity: billItems.length ? 1 : 0.5}} onClick={sendWhatsAppBill}>
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
                      <Package size={16} color="#94A3B8" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#0F172A' }}>{p.name}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#94A3B8' }}>₹{p.price}</p>
                    </div>
                  </div>
                  <button style={{ background: '#EF4444', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: 'auto', flexShrink: 0 }} onClick={() => addToBill(p)}>+ Add</button>
                </div>
              ))}
              {filteredProducts.length === 0 && <p style={{padding:16, color:'#94A3B8', fontSize:14, margin:0}}>No products found.</p>}
            </div>
          </div>
        </>
      )}

      {/* ORDERS / BILLS TAB */}
      {activeTab === 'bills' && (
        <div style={{paddingBottom: 40}}>
          <div style={{background: '#1E222D', padding: '16px', borderBottom: '1px solid #2A2F3D', display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <h2 style={{margin:0, fontSize: 18, color: '#fff'}}>Online Orders & Bills</h2>
            
            {/* Glassmorphic Sub-tab toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => setBillsSubTab('sales')}
                style={{
                  flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                  background: billsSubTab === 'sales' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: billsSubTab === 'sales' ? '#22C55E' : '#94A3B8',
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
                  color: billsSubTab === 'drafts' ? '#FBBF24' : '#94A3B8',
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
              return <p style={{padding: 40, textAlign:'center', color:'#94A3B8'}}>No {billsSubTab === 'sales' ? 'sales invoices' : 'drafts'} found.</p>;
            }

            return filteredOrders.map(o => {
              const { type, name, phone, staffName } = decodeOrderUserId(o.userId);
              
              // Custom borders/accents for draft cards
              let cardBorder = '1px solid #334155';
              let cardBg = 'linear-gradient(145deg, #1E293B, #0F172A)';
              let badgeText = '';
              let badgeColor = '';
              
              if (billsSubTab === 'drafts') {
                if (type === 'estimate') {
                  cardBorder = '1px solid rgba(245,158,11,0.4)';
                  cardBg = 'linear-gradient(145deg, #241D13, #0F172A)';
                  badgeText = 'Draft Estimate';
                  badgeColor = '#4F46E5';
                } else if (type === 'challan') {
                  cardBorder = '1px solid rgba(59,130,246,0.4)';
                  cardBg = 'linear-gradient(145deg, #131C2D, #0F172A)';
                  badgeText = 'Delivery Challan';
                  badgeColor = '#3B82F6';
                }
              }

              return (
                <div key={o.id} style={{ ...styles.orderCard, border: cardBorder, background: cardBg }}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:12, alignItems: 'center'}}>
                    <div>
                      <span style={{fontWeight:'bold', fontSize: '15px', color: '#fff'}}>{name}</span>
                      {phone && <p style={{margin: '2px 0 0 0', fontSize: '11px', color: '#94A3B8'}}>Ph: {phone}</p>}
                      {staffName && <p style={{margin: '2px 0 0 0', fontSize: '10px', color: '#818CF8'}}>👤 Billed by: {staffName}</p>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {badgeText && (
                        <span style={{ fontSize: '10px', background: badgeColor + '20', color: badgeColor, padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                          {badgeText}
                        </span>
                      )}
                      <span style={{color: o.status === 'Pending' ? '#EF4444' : '#22C55E', fontWeight:'bold', fontSize: 13}}>
                        {o.status === 'Pending' ? '⚠️ Pending' : '✅ Accepted'}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{background:'rgba(0,0,0,0.2)', padding:12, borderRadius:8, marginBottom:12}}>
                    {o.items.map((item, idx) => (
                      <div key={idx} style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4, color:'#94A3B8'}}>
                        <span>{item.qty}x {item.name} {item.selectedVariant ? `(${item.selectedVariant})` : ''}</span>
                        <span>₹{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontSize:18, fontWeight:'bold', color:'#FBBF24'}}>₹{o.total}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setSelectedOrder(o)} style={{background:'#3B82F6', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', width: 'auto', flexShrink: 0}}>
                        View Receipt
                      </button>
                      
                      {billsSubTab === 'drafts' && type === 'estimate' && (
                        <button onClick={() => handleConvertEstimateToBill(o)} style={{background:'linear-gradient(135deg, #FBBF24, #D97706)', color:'#000', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', flexShrink: 0}}>
                          ⚡ Convert to Bill
                        </button>
                      )}

                      {o.status === 'Pending' && (
                        <button onClick={() => acceptOrder(o.id)} style={{background:'#22C55E', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', width: 'auto', flexShrink: 0}}>
                          Accept
                        </button>
                      )}
                      
                      {o.status === 'Accepted' && (
                        <button onClick={() => handleOpenReturnModal(o)} style={{background:'#EF4444', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', flexShrink: 0}}>
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

              {/* Payment method */}
              {selectedOrder.paymentMethod && (
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#555' }}>Payment</span>
                  <span style={{ fontWeight: 'bold', color: selectedOrder.paymentMethod === 'Cash' ? '#10B981' : selectedOrder.paymentMethod === 'UPI' ? '#4F46E5' : selectedOrder.paymentMethod === 'Card' ? '#3B82F6' : '#EF4444' }}>
                    {{ Cash: '💵 Cash', UPI: '📱 UPI', Card: '💳 Card', Credit: '📒 Credit' }[selectedOrder.paymentMethod] || selectedOrder.paymentMethod}
                  </span>
                </div>
              )}
              
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
                <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, background: '#EF4444', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRODUCTS INVENTORY TAB */}
      {activeTab === 'products' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1E222D', padding: '16px', borderBottom: '1px solid #2A2F3D', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{margin:0, fontSize: 18, color: '#fff'}}>Inventory</h2>
            <button onClick={() => setShowAddProductModal(true)} style={{background:'#3B82F6', color:'white', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:'bold', cursor:'pointer'}}>+ Add New</button>
          </div>
          
          {products.length === 0 && <p style={{padding: 20, textAlign:'center', color:'#94A3B8'}}>No products in inventory.</p>}
          
          <div style={{ padding: '12px' }}>
            {products.map(p => {
              const expStatus = checkExpiryStatus(p.expiryDate);
              const isLowStock = p.stock < (p.reorderLevel || 10);
              
              return (
                <div key={p.id} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{p.name}</h3>
                      {p.batchNumber && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94A3B8' }}>Batch: {p.batchNumber}</p>
                      )}
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#4F46E5' }}>₹{p.price}</span>
                  </div>

                  {/* Stock & Reorder Info */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
                    <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: isLowStock ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: isLowStock ? '#EF4444' : '#10B981', border: '1px solid ' + (isLowStock ? '#EF4444' : '#10B981'), fontWeight: 'bold' }}>
                      Stock: {p.stock || 0} {isLowStock && ' (Low Stock)'}
                    </span>
                    {p.reorderLevel !== undefined && (
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}>
                        Min Stock Alert: {p.reorderLevel}
                      </span>
                    )}
                    {expStatus.status === 'expired' && (
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.2)', color: '#EF4444', border: '1px solid #EF4444', fontWeight: 'bold' }}>
                        {expStatus.text} ({p.expiryDate})
                      </span>
                    )}
                    {expStatus.status === 'near' && (
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.2)', color: '#4F46E5', border: '1px solid #F59E0B', fontWeight: 'bold' }}>
                        {expStatus.text} ({p.expiryDate})
                      </span>
                    )}
                    {p.variants && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {p.variants.split(',').map((v, vidx) => (
                          <span key={vidx} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: '#334155', color: '#CBD5E1' }}>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #2A2F3D', paddingTop: '12px', marginTop: '12px' }}>
                    <button 
                      onClick={() => handleOneClickRestock(p)} 
                      style={{ 
                        background: isLowStock ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255,255,255,0.05)', 
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
                      style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(p.id)} 
                      style={{ background: '#EF4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
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
          <div style={{background: '#1E222D', padding: '16px', borderBottom: '1px solid #2A2F3D', display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <h2 style={{margin:0, fontSize: 18, color: '#fff'}}>Credit Book (బకాయిలు)</h2>
            
            {/* Toggle Payable vs Receivable */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => setCreditTabSub('payable')}
                style={{
                  flex: 1, minWidth: 0, padding: '10px 8px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                  background: creditTabSub === 'payable' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: creditTabSub === 'payable' ? '#EF4444' : '#94A3B8',
                  transition: 'all 0.2s', lineHeight: 1.3, whiteSpace: 'normal', textAlign: 'center'
                }}
              >
                💸 Supplier Payables (₹{payable})
              </button>
              <button 
                onClick={() => setCreditTabSub('receivable')}
                style={{
                  flex: 1, minWidth: 0, padding: '10px 8px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                  background: creditTabSub === 'receivable' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: creditTabSub === 'receivable' ? '#10B981' : '#94A3B8',
                  transition: 'all 0.2s', lineHeight: 1.3, whiteSpace: 'normal', textAlign: 'center'
                }}
              >
                🟢 Customer Receivables (₹{customerCredits.filter(c => !c.paid).reduce((sum, c) => sum + c.amount, 0)})
              </button>
            </div>
          </div>
          
          <div style={{ padding: '16px' }}>
            {creditTabSub === 'payable' ? (
              <>
                <div style={{ background: '#1E293B', border: '1px solid #EF4444', borderRadius: '12px', padding: '20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#EF4444', fontWeight: 'bold' }}>TOTAL SUPPLIER OUTSTANDING</p>
                    <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#fff' }}>₹{payable}</h3>
                  </div>
                  <Wallet size={32} color="#EF4444" opacity={0.5} />
                </div>

                <h3 style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '12px' }}>Recent Deliveries / Credits</h3>
                {credits.length === 0 && <p style={{color:'#94A3B8', fontSize: '13px'}}>No distributor credit records found.</p>}
                
                {credits.map(c => (
                  <div key={c.id} style={{ background: 'linear-gradient(145deg, #1E293B, #0F172A)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff' }}>{c.distName || 'Distributor'}</span>
                      <span style={{ fontWeight: 'bold', color: c.paid ? '#22C55E' : '#EF4444' }}>
                        {c.paid ? '✅ Settled' : '⏳ Unpaid'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '12px' }}>
                      <span>{new Date(c.date).toLocaleDateString()}</span>
                      <span>Invoice: #{c.id.split('_')[1]}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '12px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#FBBF24' }}>₹{c.amount}</span>
                      {!c.paid && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => {
                            if (!upiId) return toast.error('No UPI ID set. Go to Settings.');
                            window.open(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&tn=${encodeURIComponent('Credit-' + (c.id||'').slice(0,8))}&cu=INR`, '_blank');
                          }} style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                            Pay UPI
                          </button>
                          <button onClick={() => handleSettleSupplierCredit(c.id)} style={{ background: '#10B981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
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
                <div style={{ background: '#1E293B', border: '1px solid #10B981', borderRadius: '12px', padding: '20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#10B981', fontWeight: 'bold' }}>TOTAL CUSTOMER OUTSTANDING</p>
                    <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#fff' }}>₹{customerCredits.filter(c => !c.paid).reduce((sum, c) => sum + c.amount, 0)}</h3>
                  </div>
                  <Wallet size={32} color="#10B981" opacity={0.5} />
                </div>

                {/* Add New Customer Credit Form */}
                <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Log New Customer Credit / Debt</h3>
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" value={custCreditName} onChange={e => setCustCreditName(e.target.value)} 
                        placeholder="Customer Name" 
                        style={{ flex: 1, padding: '10px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                      />
                      <input 
                        type="tel" value={custCreditPhone} onChange={e => setCustCreditPhone(e.target.value)} 
                        placeholder="Mobile (Optional)" 
                        style={{ width: '130px', padding: '10px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                      />
                    </div>
                    <input 
                      type="text" value={custCreditDesc} onChange={e => setCustCreditDesc(e.target.value)} 
                      placeholder="Reason (e.g. Milk & Eggs)" 
                      style={{ padding: '10px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                    />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="number" value={custCreditAmount} onChange={e => setCustCreditAmount(e.target.value)} 
                        placeholder="Outstanding Amount (₹)" 
                        style={{ flex: 1, padding: '10px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                      />
                      <button onClick={handleAddCustomerCredit} style={{ background: '#10B981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                        + Add Debt
                      </button>
                    </div>
                  </div>
                </div>

                <h3 style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '12px' }}>Customer Outstanding Book</h3>
                {customerCredits.length === 0 && <p style={{color:'#94A3B8', fontSize: '13px'}}>No customer debt records logged yet.</p>}
                
                {customerCredits.map(c => {
                  const parts = c.desc.split(':');
                  const custName = parts[1] || 'Customer';
                  const custPhone = parts[2] || '';
                  const custDesc = parts[3] || 'Credit Purchase';
                  
                  return (
                    <div key={c.id} style={{ background: 'linear-gradient(145deg, #1E293B, #0F172A)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff' }}>{custName}</span>
                          {custPhone && <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94A3B8' }}>Ph: {custPhone}</p>}
                        </div>
                        <span style={{ fontWeight: 'bold', color: c.paid ? '#22C55E' : '#4F46E5' }}>
                          {c.paid ? '✅ Settled' : '⏳ Pending'}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '12px', color: '#CBD5E1', marginBottom: '12px', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '6px' }}>
                        <b>Remarks:</b> {custDesc}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginBottom: '12px' }}>
                        <span>Logged: {new Date(c.date).toLocaleDateString()}</span>
                        <span>Reference: #{c.id.split('_')[1]}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '12px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#FBBF24' }}>₹{c.amount}</span>
                        {!c.paid && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => sendCustomerCreditReminder(c)} style={{ background: '#25D366', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              💬 Remind
                            </button>
                            <button onClick={() => handleSettleCustomerCredit(c.id)} style={{ background: '#10B981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
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
          <div style={{ background: '#1E222D', padding: '16px', borderBottom: '1px solid #2A2F3D' }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={20} color="#3B82F6" /> Supply & Wholesale Restock
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Order wholesale goods on credit directly from FMCG Distributors.</p>
          </div>
          
          <div style={{ padding: '16px' }}>
            {/* AI low stock indicator list */}
            {products.filter(p => p.stock < 10).length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#EF4444', fontWeight: 'bold' }}>⚠️ CRITICAL LOW STOCK</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {products.filter(p => p.stock < 10).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#CBD5E1' }}>{p.name}</span>
                      <span style={{ color: '#EF4444', fontWeight: 'bold' }}>Only {p.stock} left!</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Restock Basket Panel */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>🛒 Restock Basket</h3>
              {Object.keys(restockCart).length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0 }}>Your basket is empty. Add bulk products from the catalog below.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {Object.entries(restockCart).map(([prodId, qty]) => {
                      const prod = wholesaleCatalog.find(p => p.id === prodId);
                      if (!prod) return null;
                      return (
                        <div key={prodId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#CBD5E1' }}>
                          <span>{prod.name} (x{qty})</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: '#22C55E', marginRight: '8px' }}>₹{prod.price * qty}</span>
                            <button onClick={() => handleRestockQtyChange(prodId, -1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                            <button onClick={() => handleRestockQtyChange(prodId, 1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '12px', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Basket Total</span>
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#FBBF24' }}>
                      ₹{Object.entries(restockCart).reduce((sum, [prodId, qty]) => {
                        const prod = wholesaleCatalog.find(p => p.id === prodId);
                        return sum + (prod ? prod.price * qty : 0);
                      }, 0)}
                    </span>
                  </div>
                  <button onClick={handlePlaceRestockOrder} style={{ width: '100%', background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                    📦 Order Supplies on Credit
                  </button>
                </>
              )}
            </div>

            {/* Wholesale Catalog List */}
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#94A3B8', marginBottom: '12px' }}>📦 FMCG Wholesale Catalog</h3>
            {wholesaleCatalog.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: '13px' }}>No wholesale suppliers found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {wholesaleCatalog.map(p => (
                  <div key={p.id} style={{ background: 'linear-gradient(145deg, #1E293B, #0F172A)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '9px', background: 'rgba(59,130,246,0.15)', color: '#3B82F6', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 'bold' }}>{p.category}</span>
                      <h4 style={{ margin: '6px 0 2px 0', fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>{p.name}</h4>
                      <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>Wholesale Price: <span style={{ color: '#22C55E', fontWeight: 'bold' }}>₹{p.price}</span></p>
                    </div>
                    <button onClick={() => handleRestockQtyChange(p.id, 1)} style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
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
        const strokeColor = isLoss ? '#EF4444' : '#10B981';

        return (
          <div style={{paddingBottom: 80}}>
            <div style={{background: '#1E222D', padding: '16px', borderBottom: '1px solid #2A2F3D'}}>
              <h2 style={{margin:0, fontSize: 18, color: '#fff'}}>Retail Day Book & Reports</h2>
              <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8'}}>Today's profitability, Cash-In vs Cash-Out ledger.</p>
            </div>
            
            <div style={{ padding: '16px' }}>
              
              {/* Profit & Loss Margin Gauge */}
              <div style={{ background: 'linear-gradient(145deg, #1E293B, #0F172A)', border: '1px solid #334155', borderRadius: '16px', padding: '24px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
                
                {/* Circular Gauge */}
                <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Background Track */}
                    <circle 
                      cx="65" cy="65" r={radius} 
                      fill="transparent" stroke="#1E222D" strokeWidth="10" 
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
                    <p style={{ margin: 0, fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {isLoss ? 'Loss Margin' : 'Net Margin'}
                    </p>
                  </div>
                </div>

                {/* Margins Data Summary */}
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: isLoss ? '#FCA5A5' : '#A7F3D0' }}>
                    {isLoss ? '🔴 Loss Today: ' : '🟢 Profit Today: '} ₹{Math.abs(netProfit)}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#CBD5E1' }}>Total Cash In Today:</span>
                      <span style={{ color: '#10B981', fontWeight: 'bold' }}>₹{cashIn}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: '#CBD5E1' }}>Total Cash Out Today:</span>
                      <span style={{ color: '#EF4444', fontWeight: 'bold' }}>₹{cashOut}</span>
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
                  <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>📊 6-Month Cash Flow</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' }}>
                      {[
                        { label: 'This Month Income', value: `₹${thisMonth.income.toLocaleString('en-IN')}`, color: '#10B981' },
                        { label: 'This Month Expenses', value: `₹${thisMonth.expenses.toLocaleString('en-IN')}`, color: '#EF4444' },
                        { label: 'Net Profit (6m)', value: `₹${totalProfit.toLocaleString('en-IN')}`, color: totalProfit >= 0 ? '#10B981' : '#EF4444' },
                        { label: 'Profit Margin (6m)', value: `${margin}%`, color: margin >= 20 ? '#10B981' : margin >= 0 ? '#4F46E5' : '#EF4444' },
                      ].map(c => (
                        <div key={c.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px' }}>
                          <div style={{ fontSize: '10px', color: '#64748B', marginBottom: '2px' }}>{c.label}</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: c.color }}>{c.value}</div>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={cashFlowMonths} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v > 999 ? `${(v/1000).toFixed(0)}k` : v} />
                        <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }} formatter={(v, n) => [`₹${Number(v).toLocaleString('en-IN')}`, n === 'income' ? 'Income' : 'Expenses']} />
                        <Bar dataKey="income" fill="#10B981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="expenses" fill="#EF4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* TALLY EXPORT PANEL */}
              <div style={{ background: 'linear-gradient(145deg, #1E293B, #0F172A)', border: '1px solid #10B981', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 'bold', color: '#10B981' }}>📊 Tally ERP / Prime Export</h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>Export Tally XML, GSTR-1 CSV, or Monthly Summary for your CA.</p>
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setTallyMenuOpen(v => !v)}
                    style={{ background: '#10B981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📥 Export ▾
                  </button>
                  {tallyMenuOpen && (
                    <div style={{ position: 'absolute', right: 0, top: '44px', background: '#1E293B', border: '1px solid #334155', borderRadius: '10px', zIndex: 200, minWidth: '200px', overflow: 'hidden' }}
                      onMouseLeave={() => setTallyMenuOpen(false)}>
                      {[
                        { label: '📥 Tally XML', action: () => { downloadTallyXML(orders.filter(o => o.status === 'completed'), user.name); setTallyMenuOpen(false); } },
                        { label: '📋 GSTR-1 CSV', action: () => { downloadCSV(generateGSTR1CSV(orders.filter(o => o.status === 'completed'), user.gstNumber), `GSTR1_${new Date().toISOString().slice(0,10)}.csv`); setTallyMenuOpen(false); } },
                        { label: '📊 Monthly Summary', action: () => { downloadCSV(generateMonthlySummaryCSV(orders.filter(o => o.status === 'completed')), `Summary_${new Date().toISOString().slice(0,10)}.csv`); setTallyMenuOpen(false); } },
                      ].map(item => (
                        <button key={item.label} onClick={item.action} style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: '#F8FAFC', padding: '12px 16px', textAlign: 'left', fontSize: '13px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
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
              <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📖 Today's Retail Day Book Ledger
                </h3>
                
                {ledgerItems.length === 0 ? (
                  <p style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px 0', margin: 0 }}>No transactions logged today yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {ledgerItems.map((item, idx) => (
                      <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0F172A', padding: '12px', borderRadius: '10px', border: '1px solid #2A2F3D' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', background: item.type === 'Cash In' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: item.type === 'Cash In' ? '#10B981' : '#EF4444', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                              {item.category}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>{item.time}</span>
                          </div>
                          <p style={{ margin: '6px 0 0 0', fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{item.desc}</p>
                        </div>
                        <span style={{ fontWeight: 'bold', color: item.type === 'Cash In' ? '#10B981' : '#EF4444', fontSize: '15px' }}>
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
          <div style={{background: '#1E222D', padding: '16px', borderBottom: '1px solid #2A2F3D'}}>
            <h2 style={{margin:0, fontSize: 18, color: '#fff'}}>Shop Profile & Payments</h2>
          </div>
          <div style={{ padding: '16px' }}>

            {/* SaaS Subscription Info Card */}
            <div style={{ background: 'linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.9))', border: `1px solid ${isOnTrial ? 'rgba(245,158,11,0.4)' : 'rgba(139,92,246,0.3)'}`, borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: `0 8px 32px ${isOnTrial ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.1)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>⚡ Subscription</h3>
                <span style={{ background: isOnTrial ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)', color: isOnTrial ? '#FBBF24' : '#10B981', fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700 }}>
                  {isOnTrial ? `Trial — ${trialDaysLeft}d left` : 'Active'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px', fontWeight: 600 }}>PLAN</div>
                  <div style={{ fontSize: '14px', color: '#F8FAFC', fontWeight: 700 }}>{planLabel}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px', fontWeight: 600 }}>{isOnTrial ? 'DAYS LEFT' : 'RENEWS IN'}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: isOnTrial && trialDaysLeft <= 2 ? '#EF4444' : isOnTrial && trialDaysLeft <= 4 ? '#4F46E5' : '#10B981' }}>
                    {isOnTrial ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}` : paidDaysLeft !== null ? `${paidDaysLeft}d` : '—'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px', fontWeight: 600 }}>PRODUCTS</div>
                  <div style={{ fontSize: '14px', color: '#F8FAFC', fontWeight: 700 }}>
                    {products.length}{(capabilities?.maxProducts ?? 200) === -1 ? ' / ∞' : ` / ${capabilities?.maxProducts ?? 200}`}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px', fontWeight: 600 }}>PRICE</div>
                  <div style={{ fontSize: '14px', color: '#F8FAFC', fontWeight: 700 }}>
                    {plans?.find(p => p.id === (user.subscriptionTier || user.subscription))
                      ? `₹${plans.find(p => p.id === (user.subscriptionTier || user.subscription)).price}/mo`
                      : isOnTrial ? 'Free' : '—'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowPlanSelectorModal(true)}
                style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #818CF8)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                {isOnTrial ? '⚡ Upgrade Plan Now' : '🔄 Change Plan'}
              </button>
            </div>

            {/* Logo Upload Section */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🖼️ Shop Logo</h3>
              {logo ? (
                <img src={logo} alt="Shop Logo" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3B82F6', marginBottom: '12px' }} />
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#0F172A', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>No Logo</div>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'block', margin: '0 auto', fontSize: '12px', color: '#94A3B8' }} />
            </div>

            {/* ── ACCOUNT DETAILS ── */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Account Details</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>Update your shop name or mobile number</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '5px', fontWeight: '700' }}>
                    {user.role === 'distributor' ? 'COMPANY NAME' : 'SHOP / YOUR NAME'}
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder={user.name}
                    style={{ width: '100%', padding: '11px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '9px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <p style={{ fontSize: '11px', color: '#475569', margin: '3px 0 0' }}>Current: {user.name}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '5px', fontWeight: '700' }}>MOBILE NUMBER (LOGIN ID)</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                    placeholder={user.phone}
                    maxLength={10}
                    style={{ width: '100%', padding: '11px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '9px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <p style={{ fontSize: '11px', color: '#475569', margin: '3px 0 0' }}>Current: {user.phone}</p>
                </div>
              </div>
              <button
                onClick={handleSaveAccountDetails}
                disabled={profileSaving}
                style={{ width: '100%', background: '#4F46E5', color: '#fff', border: 'none', padding: '12px', borderRadius: '9px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
              >
                {profileSaving ? '⏳ Saving…' : '✅ Save Account Details'}
              </button>
            </div>

            {/* ── CHANGE PASSWORD / PIN ── */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔐 {user.role === 'staff' ? 'Change PIN' : 'Change Password'}
              </h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                {user.role === 'staff' ? 'Update your 4-digit login PIN' : 'Set a new secure password'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '5px', fontWeight: '700' }}>
                    NEW {user.role === 'staff' ? 'PIN' : 'PASSWORD'}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={user.role === 'staff' ? '4-digit PIN' : 'Min 4 characters'}
                    maxLength={user.role === 'staff' ? 4 : undefined}
                    inputMode={user.role === 'staff' ? 'numeric' : 'text'}
                    style={{ width: '100%', padding: '11px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '9px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.15em' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '5px', fontWeight: '700' }}>
                    CONFIRM {user.role === 'staff' ? 'PIN' : 'PASSWORD'}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={`Re-enter ${user.role === 'staff' ? 'PIN' : 'password'}`}
                    maxLength={user.role === 'staff' ? 4 : undefined}
                    inputMode={user.role === 'staff' ? 'numeric' : 'text'}
                    style={{ width: '100%', padding: '11px 14px', background: '#0F172A', border: `1px solid ${confirmPassword && newPassword && confirmPassword !== newPassword ? '#EF4444' : confirmPassword && newPassword && confirmPassword === newPassword ? '#22C55E' : '#334155'}`, borderRadius: '9px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.15em' }}
                  />
                  {confirmPassword && newPassword && (
                    <p style={{ fontSize: '11px', marginTop: '4px', color: confirmPassword === newPassword ? '#22C55E' : '#EF4444', fontWeight: '600' }}>
                      {confirmPassword === newPassword ? '✓ Match' : '✗ Do not match'}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={profileSaving || !newPassword || newPassword !== confirmPassword}
                style={{ width: '100%', background: (newPassword && newPassword === confirmPassword) ? '#10B981' : '#334155', color: '#fff', border: 'none', padding: '12px', borderRadius: '9px', fontWeight: '700', fontSize: '14px', cursor: (newPassword && newPassword === confirmPassword) ? 'pointer' : 'not-allowed' }}
              >
                {profileSaving ? '⏳ Updating…' : `🔐 Update ${user.role === 'staff' ? 'PIN' : 'Password'}`}
              </button>
            </div>

            {/* GST & Tax Compliance Section */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🏛️ GST & Compliance Setup</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>Configure these details to generate formal B2B and B2C GST invoices for your customers.</p>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Shop GSTIN</label>
                  <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="e.g. 29ABCDE1234F2Z5" style={{ width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>State Code</label>
                  <input type="text" value={stateCode} onChange={e => setStateCode(e.target.value)} placeholder="e.g. 29" style={{ width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Business Address (printed on invoice)</label>
                <textarea value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="Enter full shop address..." rows={3} style={{ width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px', resize: 'vertical' }}></textarea>
              </div>

              <button onClick={handleSaveProfile} style={{ width: '100%', background: '#16A34A', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Save Business Info
              </button>
            </div>

            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>💳 Setup UPI Payments</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                Enter your shop's UPI ID (PhonePe, GPay, Paytm) below. When customers order online, their payment app will automatically open with your UPI ID and the exact bill amount.
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', fontWeight: 'bold' }}>Your UPI ID</label>
                <input 
                  type="text" value={upiId} onChange={e => setUpiId(e.target.value)} 
                  placeholder="e.g. 9876543210@ybl" 
                  style={{ width: '100%', padding: '14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} 
                />
              </div>
              <button onClick={handleSaveProfile} style={{ width: '100%', background: '#16A34A', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Save Payment Settings
              </button>
            </div>

            {/* Payment QR Scanner Upload */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff' }}>📱 Payment QR Scanner</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                Upload your GPay / PhonePe / Paytm QR code image. Customers will see this QR to pay you instantly. You can take a photo of your existing QR or upload from gallery.
              </p>
              {paymentQr ? (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <img src={paymentQr} alt="Payment QR" style={{ width: '200px', height: '200px', objectFit: 'contain', borderRadius: '12px', border: '2px solid #22C55E', background: '#fff', padding: '8px' }} />
                  <p style={{ fontSize: '11px', color: '#22C55E', marginTop: '8px', fontWeight: 'bold' }}>✅ Payment QR Active</p>
                  <button onClick={() => setPaymentQr('')} style={{ background: 'transparent', border: '1px solid #EF4444', color: '#EF4444', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}>
                    Remove QR
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '150px', height: '150px', borderRadius: '12px', background: '#0F172A', margin: '0 auto 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', border: '2px dashed #334155' }}>
                    <Camera size={32} style={{ marginBottom: '8px' }} />
                    <span style={{ fontSize: '12px' }}>No QR uploaded</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <label style={{ flex: 1, background: '#3B82F6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
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
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📸 Shop Photos <span style={{ fontSize: '13px', color: '#64748B' }}>{shopPhotos.length}/6</span>
                </h3>
                <a href={getShopUrl()} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: '#818CF8', fontWeight: '700', textDecoration: 'none', background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.3)', padding: '4px 10px', borderRadius: '8px' }}>
                  👁 View Storefront
                </a>
              </div>
              <div style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#818CF8', lineHeight: '1.5' }}>
                  📸 These photos show as a <strong>scrolling carousel</strong> on your public store page. Customers see them when they open your shop link. First photo is the cover.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                {shopPhotos.map((photo, idx) => (
                  <div key={idx} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                    <img src={photo} alt={`Shop ${idx+1}`} style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '2px 6px' }}>
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>{idx === 0 ? '🌟 Cover' : `#${idx+1}`}</span>
                    </div>
                    <button onClick={() => removeShopPhoto(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', lineHeight: '20px', padding: 0 }}>×</button>
                  </div>
                ))}
                {shopPhotos.length < 6 && (
                  <label style={{ height: '80px', border: '2px dashed #334155', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '4px' }}>
                    <span style={{ fontSize: '20px' }}>➕</span>
                    <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>Add</span>
                    <input type="file" accept="image/*" multiple onChange={handleShopPhotoUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              {shopPhotos.length === 0 && (
                <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', margin: 0 }}>No photos yet — add up to 6 photos</p>
              )}
            </div>

            {/* Shop GPS Location Capture */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>📍 Shop Geolocation</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                Lock your store GPS coordinates so nearby customers can discover your store and order online directly!
              </p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Latitude</label>
                  <input type="text" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 16.3067" style={{ width: '100%', padding: '10px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Longitude</label>
                  <input type="text" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 80.4365" style={{ width: '100%', padding: '10px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                </div>
              </div>
              
              <button onClick={handleGrabLocation} style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #6D28D9)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>
                🛰️ Auto-Grab Live Shop Coordinates
              </button>
              
              <button onClick={handleSaveProfile} style={{ width: '100%', background: '#16A34A', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Commit Coordinates to System
              </button>
            </div>

            {/* Shop Visibility — admin-controlled premium feature (coming soon) */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>👁️ Shop Visibility</h3>
                <span style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', letterSpacing: '0.5px' }}>COMING SOON</span>
              </div>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '14px', lineHeight: 1.5 }}>
                Get your shop featured in the public customer search and storefront so nearby shoppers can discover you. This is a premium visibility add-on launching soon.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', opacity: 0.5, pointerEvents: 'none' }}>
                <span style={{ color: '#E2E8F0', fontSize: '14px', fontWeight: 600 }}>Featured in customer search</span>
                <div style={{ position: 'relative', width: '52px', height: '30px', borderRadius: '15px', background: '#475569', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: '3px', left: '3px', width: '24px', height: '24px', borderRadius: '50%', background: '#fff' }} />
                </div>
              </div>
            </div>

            {/* Shop Timings */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fff' }}>🕒 Shop Timings</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                Set opening and closing times. An "Open Now" badge shows on your dashboard based on these.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Opens at</label>
                  <select value={openingHour} onChange={e => setOpeningHour(Number(e.target.value))}
                    style={{ width: '100%', padding: '12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Closes at</label>
                  <select value={closingHour} onChange={e => setClosingHour(Number(e.target.value))}
                    style={{ width: '100%', padding: '12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleSaveShopHours} style={{ width: '100%', background: '#16A34A', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Save Shop Timings
              </button>
            </div>

            {/* Promotional Banner */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fff' }}>🎉 Promotional Offer Banner</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                Show a promotional banner on your storefront. Turn it on and set your offer text.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                <span style={{ color: '#E2E8F0', fontSize: '14px', fontWeight: 600 }}>
                  {shopBanner?.active ? 'Banner is showing' : 'Banner is off'}
                </span>
                <button
                  onClick={() => setShopBanner({ ...(shopBanner || {}), active: !(shopBanner?.active) })}
                  style={{ position: 'relative', width: '52px', height: '30px', borderRadius: '15px', border: 'none',
                    cursor: 'pointer', background: shopBanner?.active ? '#16A34A' : '#475569', transition: 'background .2s', flexShrink: 0 }}
                  aria-label="Toggle promotional banner">
                  <span style={{ position: 'absolute', top: '3px', left: shopBanner?.active ? '25px' : '3px',
                    width: '24px', height: '24px', borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </button>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Banner Title</label>
                <input type="text" value={shopBanner?.title || ''} onChange={e => setShopBanner({ ...(shopBanner || {}), title: e.target.value })}
                  placeholder="e.g. Diwali Sale!" style={{ width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Subtitle</label>
                <input type="text" value={shopBanner?.subtitle || ''} onChange={e => setShopBanner({ ...(shopBanner || {}), subtitle: e.target.value })}
                  placeholder="e.g. Up to 20% off on all items" style={{ width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Discount %</label>
                <input type="number" min="0" max="100" value={shopBanner?.discountPercent || 0} onChange={e => setShopBanner({ ...(shopBanner || {}), discountPercent: Number(e.target.value) })}
                  placeholder="0" style={{ width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
              </div>
              <button onClick={handleSaveShopBanner} style={{ width: '100%', background: '#16A34A', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                💾 Save Promotional Banner
              </button>
            </div>

            {/* My Accountant (CA) */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fff' }}>🧾 My Accountant (CA)</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                Assign your Chartered Accountant by their mobile number. Only the CA you assign can view your sales books and file your GST returns.
              </p>
              {myCA ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', padding: '14px' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{myCA.name}</div>
                    <div style={{ color: '#94A3B8', fontSize: '12px' }}>{myCA.phone}</div>
                  </div>
                  <button onClick={handleRemoveCA} disabled={caBusy}
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.4)', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                    Remove
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="tel" inputMode="numeric" maxLength={10} value={caPhoneInput} onChange={e => setCaPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="CA's 10-digit mobile number"
                    style={{ flex: 1, minWidth: 0, padding: '12px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }} />
                  <button onClick={handleAssignCA} disabled={caBusy}
                    style={{ background: '#16A34A', color: 'white', border: 'none', padding: '12px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                    {caBusy ? '...' : 'Assign'}
                  </button>
                </div>
              )}
            </div>

            {/* My Distributors (mutual code linking) */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fff' }}>🚚 My Distributors</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '14px' }}>
                Link with your distributors so they can supply you. Share your shop code, or add a distributor using their code.
              </p>

              {/* Own shop code */}
              {user?.publicCode && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>Your shop code</div>
                    <div style={{ color: '#fff', fontSize: '16px', fontWeight: 800, letterSpacing: '1px', fontFamily: 'monospace' }}>{user.publicCode}</div>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(user.publicCode); toast.success('Code copied!'); }}
                    style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                    Copy
                  </button>
                </div>
              )}

              {/* Add distributor by code */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input type="text" value={distCodeInput} onChange={e => setDistCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter distributor code (DST-XXXXXX)"
                  style={{ flex: 1, minWidth: 0, padding: '12px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                <button onClick={handleLinkDistributor} disabled={distLinkBusy}
                  style={{ background: '#16A34A', color: 'white', border: 'none', padding: '12px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                  {distLinkBusy ? '...' : 'Add'}
                </button>
              </div>

              {/* Linked distributors list */}
              {myDistributors.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {myDistributors.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', padding: '12px' }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{d.name}</div>
                        <div style={{ color: '#94A3B8', fontSize: '12px', fontFamily: 'monospace' }}>{d.publicCode}</div>
                      </div>
                      <button onClick={() => handleUnlinkDistributor(d.id)}
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.4)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748B', fontSize: '12px', textAlign: 'center', margin: '4px 0' }}>No distributors linked yet.</p>
              )}
            </div>

            {/* Shop Link & QR */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🔗 Your Printable Shop QR Poster</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                Generate and download a high-contrast printable poster. Stick it on your shop wall so customers can scan, order, and pay instantly!
              </p>
              <div className="qr-code-holder" style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
                <QRCodeSVG value={getShopUrl()} size={140} />
              </div>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 'bold', color: '#3B82F6', wordBreak: 'break-all' }}>{getShopUrl()}</p>
              
              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <button onClick={downloadQrPng} style={{ width: '100%', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🖼️ Download QR Code (PNG)
                </button>
                <button onClick={downloadQrPoster} style={{ width: '100%', background: 'linear-gradient(135deg, #FBBF24, #D97706)', color: '#000', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🖨️ Download Printable QR Poster (PDF)
                </button>
                <button onClick={handleShareShop} style={{ width: '100%', background: '#25D366', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  📤 Share Shop Link via WhatsApp
                </button>
              </div>
            </div>

            {/* LANGUAGE SELECTOR CARD */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
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
                      padding: '10px 8px', borderRadius: '8px', border: `1px solid ${locale === code ? '#3B82F6' : '#334155'}`,
                      background: locale === code ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: locale === code ? '#60A5FA' : '#94A3B8',
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

            {/* PRINT SETTINGS CARD */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>🖨️ Print Settings</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px', lineHeight: '1.5' }}>Set your printer type once — all PDFs will use the right size automatically.</p>

              {/* Paper type */}
              <label style={{ display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '8px', fontWeight: '700' }}>PAPER / PRINTER TYPE</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '14px' }}>
                {[
                  { key: 'a4',        icon: '📄', label: 'A4',        sub: '210mm' },
                  { key: 'thermal80', icon: '🖨️', label: '80mm',      sub: 'POS roll' },
                  { key: 'thermal58', icon: '🧾', label: '58mm',      sub: 'Mini roll' },
                ].map(o => (
                  <button key={o.key} onClick={() => setPrintFormat(o.key)}
                    style={{ padding: '10px 4px', border: printFormat === o.key ? '2px solid #4F46E5' : '1px solid #334155', background: printFormat === o.key ? 'rgba(79,70,229,0.2)' : '#0F172A', borderRadius: '10px', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{o.icon}</div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: printFormat === o.key ? '#818CF8' : '#fff' }}>{o.label}</div>
                    <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>{o.sub}</div>
                  </button>
                ))}
              </div>

              {/* Font size */}
              <label style={{ display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '8px', fontWeight: '700' }}>FONT SIZE</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {[{ key: 'normal', label: 'Normal' }, { key: 'large', label: 'Large' }].map(o => (
                  <button key={o.key} onClick={() => setPrintFontSize(o.key)}
                    style={{ flex: 1, padding: '10px', border: printFontSize === o.key ? '2px solid #4F46E5' : '1px solid #334155', background: printFontSize === o.key ? 'rgba(79,70,229,0.2)' : '#0F172A', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: printFontSize === o.key ? '#818CF8' : '#fff' }}>
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Logo + Copies */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '8px', fontWeight: '700' }}>LOGO ON BILL</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[{ key: true, label: 'Show' }, { key: false, label: 'Hide' }].map(o => (
                      <button key={String(o.key)} onClick={() => setPrintShowLogo(o.key)}
                        style={{ flex: 1, padding: '8px 4px', border: printShowLogo === o.key ? '2px solid #4F46E5' : '1px solid #334155', background: printShowLogo === o.key ? 'rgba(79,70,229,0.2)' : '#0F172A', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: printShowLogo === o.key ? '#818CF8' : '#94A3B8' }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '8px', fontWeight: '700' }}>COPIES</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3].map(n => (
                      <button key={n} onClick={() => setPrintCopies(n)}
                        style={{ flex: 1, padding: '8px 4px', border: printCopies === n ? '2px solid #4F46E5' : '1px solid #334155', background: printCopies === n ? 'rgba(79,70,229,0.2)' : '#0F172A', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '800', color: printCopies === n ? '#818CF8' : '#94A3B8' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#818CF8', fontWeight: '600' }}>
                  {printFormat === 'a4' ? '📄 A4' : printFormat === 'thermal80' ? '🖨️ 80mm Thermal' : '🧾 58mm Thermal'}
                  {' · '}{printFontSize === 'large' ? 'Large' : 'Normal'} font
                  {' · '}{printShowLogo ? 'With logo' : 'No logo'}
                  {' · '}{printCopies} cop{printCopies === 1 ? 'y' : 'ies'}
                </p>
              </div>

              <button onClick={handleSavePrintSettings}
                style={{ width: '100%', background: '#4F46E5', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                🖨️ Save Print Settings
              </button>
            </div>

            {/* STAFF MANAGEMENT CARD inside Settings */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>👥 Staff Management (సహాయకులు)</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>Add helpers who can scan and bill, but cannot see your analytics/reports.</p>
              
              {hasFeature('staffAccounts') ? (
              <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#fff' }}>➕ Add New Staff Member</h4>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <input
                    type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                    placeholder="Staff Name (e.g. Raju Helper)"
                    style={{ width: '100%', padding: '10px 14px', background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                  />
                  <input
                    type="tel" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)}
                    placeholder="Staff Mobile Number (login ID)"
                    style={{ width: '100%', padding: '10px 14px', background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                  />
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontWeight: '700' }}>🔐 Set 4-digit PIN (you choose, share with staff)</label>
                    <input
                      type="password" value={newStaffPin} onChange={e => setNewStaffPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                      placeholder="e.g. 5678" inputMode="numeric" maxLength={4}
                      style={{ width: '100%', padding: '10px 14px', background: '#1E293B', border: `1px solid ${newStaffPin.length === 4 ? '#22C55E' : '#334155'}`, borderRadius: '8px', color: '#fff', fontSize: '18px', letterSpacing: '0.4em', outline: 'none' }}
                    />
                    {newStaffPin.length === 4 && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#22C55E' }}>✓ PIN set — share this with the staff member</p>}
                  </div>
                  <button onClick={handleAddStaff} style={{ width: '100%', background: '#3B82F6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                    + Add Staff Member
                  </button>
                </div>
              </div>
              ) : (
              <div style={{ background: '#0F172A', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#FBBF24', fontWeight: 700, marginBottom: '6px' }}>🔒 Staff accounts are a PRO feature</div>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 12px' }}>Upgrade to PRO to add staff helpers who can scan and bill for you.</p>
                <button onClick={() => setShowPlanSelectorModal(true)} style={{ background: 'linear-gradient(135deg,#4F46E5,#818CF8)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                  Upgrade to PRO →
                </button>
              </div>
              )}

              <h4 style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '12px' }}>Active Staff Members</h4>
              {staffList.length === 0 && <p style={{color:'#94A3B8', fontSize: '13px', margin: 0}}>No staff added yet.</p>}
              {staffList.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '13px', color: '#fff' }}>{s.name}</h5>
                    <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>Ph: {s.phone}</p>
                  </div>
                  <span style={{ background: 'rgba(34,197,94,0.2)', color: '#22C55E', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', border: '1px solid #22C55E', fontWeight: 'bold' }}>● Active</span>
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
          <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '20px' }}>Scan to Pay • ₹{billTotal > 0 ? billTotal : '0'}</p>
          <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {paymentQr ? (
              <img src={paymentQr} alt="Payment QR" style={{ width: '260px', height: '260px', objectFit: 'contain' }} />
            ) : (
              <QRCodeSVG 
                value={buildUpiUri({ upiId, merchantUpiId: user.merchantUpiId, merchantCode: user.merchantCode, name: user.name }, { amount: billTotal || 0, txnRef: 'BILL' + Date.now().toString().slice(-8), note: 'Bill Payment' })}
                size={260}
              />
            )}
          </div>
          <p style={{ color: '#22C55E', fontSize: '12px', marginTop: '16px', fontWeight: 'bold' }}>GPay • PhonePe • Paytm • Any UPI App</p>
              <div style={{ textAlign: 'center', marginTop: '8px', padding: '4px 10px', background: 'rgba(79,70,229,0.08)', borderRadius: '8px', display: 'inline-block' }}>
                <span style={{ fontSize: '10px', color: '#4F46E5', fontWeight: '700' }}>MyStore OS</span>
                <span style={{ fontSize: '9px', color: '#64748B' }}> • mystoreos.in</span>
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
            <button onClick={() => setShowScanner(false)} style={{ width: '100%', padding: '16px', background: '#EF4444', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>Cancel Scan</button>
          </div>
        </div>
      )}

      {/* STAFF MODAL */}
      {showStaffModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ background: '#1E293B', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
              Add Staff Member
              <span onClick={() => setShowStaffModal(false)} style={{ cursor: 'pointer', color: '#94A3B8' }}>✕</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Staff Name" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} style={{ padding: '12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
              <input type="tel" placeholder="Staff Phone (Login ID)" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} style={{ padding: '12px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>* Default PIN will be 1234. Staff can change it later.</p>
              <button onClick={handleAddStaff} style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Add Staff</button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {showReturnModal && returnOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '24px', border: '1px solid #E5E7EB', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#0F172A', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              Process Sales Return
              <span onClick={() => setShowReturnModal(false)} style={{ cursor: 'pointer', color: '#64748B' }}>✕</span>
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>Select the quantity to return for each item in Order #{returnOrder.id.substring(0,8)}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '40vh', overflowY: 'auto', paddingRight: '4px' }}>
              {returnOrder.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', color: '#0F172A' }}>{item.name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#D97706', fontWeight: 'bold' }}>₹{item.price} x {item.qty}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setReturnItemsState(prev => ({...prev, [item.id]: Math.max(0, prev[item.id] - 1)}))} style={{ background: '#E2E8F0', color: '#0F172A', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', width: '20px', textAlign: 'center', color: '#0F172A' }}>{returnItemsState[item.id]}</span>
                    <button onClick={() => setReturnItemsState(prev => ({...prev, [item.id]: Math.min(item.qty, prev[item.id] + 1)}))} style={{ background: '#E2E8F0', color: '#0F172A', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', color: '#EF4444' }}>
                <span>Total Refund:</span>
                <span>₹{returnOrder.items.reduce((sum, item) => sum + (item.price * returnItemsState[item.id]), 0).toFixed(2)}</span>
              </div>
              <button onClick={handleProcessReturn} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                Confirm Return & Generate Credit Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PIN MODAL */}
      {showAdminPinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '350px', borderRadius: '16px', padding: '30px', border: '1px solid #E5E7EB', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#EF4444', fontWeight: 'bold' }}>Admin Authorization Required</h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px', lineHeight: '1.5' }}>This action is restricted. Please ask the shop owner to enter their Admin PIN to proceed.</p>
            
            <input 
              type="password" 
              placeholder="PIN" 
              value={adminPinInput} 
              onChange={e => setAdminPinInput(e.target.value)} 
              style={{ padding: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '20px', width: '100%', textAlign: 'center', letterSpacing: '8px', marginBottom: '16px', outline: 'none' }} 
            />
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowAdminPinModal(false); setAdminPinInput(''); setPendingAction(null); }} style={{ flex: 1, background: '#FFFFFF', color: '#475569', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdminPinSubmit} style={{ flex: 1, background: '#EF4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Authorize</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && !showScanner && (
        <div onClick={() => setShowAddProductModal(false)} style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(2px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '90vh', overflowY: 'auto', borderTop: '1px solid #E5E7EB', boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold', color: '#0F172A' }}>📦 Add Product to Inventory</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
              <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
                <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Cost Price (₹)</label>
                <input type="number" value={newProdCostPrice} onChange={e => setNewProdCostPrice(e.target.value)} placeholder="e.g. 8" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
            </div>


            {/* Label Discount % */}
            <div style={{ marginBottom: '16px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '12px 14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#4F46E5', marginBottom: '8px', fontWeight: '700' }}>🏷️ Label Discount % <span style={{ fontWeight: 400, color: '#64748B', fontSize: '11px' }}>(for barcode price label)</span></label>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[0, 5, 10, 15, 20, 25, 50].map(d => (
                  <button key={d} type="button" onClick={() => setNewProdDiscountPct(String(d))}
                    style={{ padding: '6px 8px', background: parseInt(newProdDiscountPct) === d ? '#4F46E5' : '#fff', color: parseInt(newProdDiscountPct) === d ? '#fff' : '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    {d === 0 ? 'None' : `${d}%`}
                  </button>
                ))}
                <input type="number" min="0" max="99" value={newProdDiscountPct} onChange={e => setNewProdDiscountPct(e.target.value)}
                  style={{ width: '52px', padding: '6px 8px', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '12px', fontWeight: '700', outline: 'none', textAlign: 'center' }} />
                <span style={{ fontSize: '11px', color: '#64748B' }}>%</span>
              </div>
              {parseInt(newProdDiscountPct) > 0 && newProdPrice && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94A3B8' }}>₹{newProdPrice}</span>
                  <span style={{ fontWeight: '800' }}>→ ₹{Math.round(Number(newProdPrice) * (1 - parseInt(newProdDiscountPct) / 100))}</span>
                  <span style={{ background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>{newProdDiscountPct}% OFF</span>
                  <span style={{ color: '#94A3B8', fontSize: '11px' }}>will print on label</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Stock Qty</label>
                <input type="number" value={newProdStock} onChange={e => setNewProdStock(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Min Stock Alert</label>
                <input type="number" value={newProdReorder} onChange={e => setNewProdReorder(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Batch Number</label>
                <input type="text" value={newProdBatch} onChange={e => setNewProdBatch(e.target.value)} placeholder="e.g. B-901" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Expiry Date</label>
                <input type="date" value={newProdExpiry} onChange={e => setNewProdExpiry(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Variants (comma-separated)</label>
              <input type="text" value={newProdVariants} onChange={e => setNewProdVariants(e.target.value)} placeholder="e.g. Red, Blue, Green or Small, Medium" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                <input type="text" value={newProdHsnCode} onChange={e => setNewProdHsnCode(e.target.value)} placeholder="e.g. 1905" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate (%)</label>
                <select value={newProdGstRate} onChange={e => setNewProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }}>
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
                <input type="text" value={scannedBarcode} onChange={e => setScannedBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ flex: 1, padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
                <button onClick={() => setShowScanner(true)} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '0 20px', borderRadius: '10px', cursor: 'pointer' }}><BarcodeIcon size={24} /></button>
              </div>
              {scannedBarcode && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center', border: '1px solid #E2E8F0' }}>
                  <Barcode value={scannedBarcode} height={40} width={2} fontSize={14} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <ProductImageUploader images={newProdImages} onChange={setNewProdImages} userId={user.id} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', cursor: 'pointer', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '11px 13px' }}>
              <input type="checkbox" checked={newProdFeatured} onChange={(e) => setNewProdFeatured(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: '#4F46E5' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>⭐ Feature on storefront</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Show this product in the Featured row at the top of your store.</div>
              </div>
            </label>

            <button onClick={handleSaveProduct} style={{ width: '100%', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Product</button>
            <button onClick={() => { setShowAddProductModal(false); setNewProdImage(''); }} style={{ width: '100%', background: 'transparent', color: '#64748B', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditProductModal && !showScanner && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#FFFFFF', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '90vh', overflowY: 'auto', borderTop: '1px solid #E5E7EB', boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold', color: '#0F172A' }}>✏️ Edit Product Details</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
              <input type="text" value={editProdName} onChange={e => setEditProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
                <input type="number" value={editProdPrice} onChange={e => setEditProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Cost Price (₹)</label>
                <input type="number" value={editProdCostPrice} onChange={e => setEditProdCostPrice(e.target.value)} placeholder="e.g. 8" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Stock Qty</label>
                <input type="number" value={editProdStock} onChange={e => setEditProdStock(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Min Stock Alert</label>
                <input type="number" value={editProdReorder} onChange={e => setEditProdReorder(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
            </div>


            {/* Label Discount % */}
            <div style={{ marginBottom: '16px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '12px 14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#4F46E5', marginBottom: '8px', fontWeight: '700' }}>🏷️ Label Discount % <span style={{ fontWeight: 400, color: '#64748B', fontSize: '11px' }}>(for barcode price label)</span></label>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[0, 5, 10, 15, 20, 25, 50].map(d => (
                  <button key={d} type="button" onClick={() => setEditProdDiscountPct(String(d))}
                    style={{ padding: '6px 8px', background: parseInt(editProdDiscountPct) === d ? '#4F46E5' : '#fff', color: parseInt(editProdDiscountPct) === d ? '#fff' : '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    {d === 0 ? 'None' : `${d}%`}
                  </button>
                ))}
                <input type="number" min="0" max="99" value={editProdDiscountPct} onChange={e => setEditProdDiscountPct(e.target.value)}
                  style={{ width: '52px', padding: '6px 8px', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '12px', fontWeight: '700', outline: 'none', textAlign: 'center' }} />
                <span style={{ fontSize: '11px', color: '#64748B' }}>%</span>
              </div>
              {parseInt(editProdDiscountPct) > 0 && editProdPrice && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94A3B8' }}>₹{editProdPrice}</span>
                  <span style={{ fontWeight: '800' }}>→ ₹{Math.round(Number(editProdPrice) * (1 - parseInt(editProdDiscountPct) / 100))}</span>
                  <span style={{ background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>{editProdDiscountPct}% OFF</span>
                  <span style={{ color: '#94A3B8', fontSize: '11px' }}>will print on label</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Batch Number</label>
                <input type="text" value={editProdBatch} onChange={e => setEditProdBatch(e.target.value)} placeholder="e.g. B-901" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Expiry Date</label>
                <input type="date" value={editProdExpiry} onChange={e => setEditProdExpiry(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Variants (comma-separated)</label>
              <input type="text" value={editProdVariants} onChange={e => setEditProdVariants(e.target.value)} placeholder="e.g. Red, Blue, Green or Small, Medium" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Selling Unit</label>
              <select value={editProdUnit || shopDefaultUnit} onChange={e => setEditProdUnit(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }}>
                {unitOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                <input type="text" value={editProdHsnCode} onChange={e => setEditProdHsnCode(e.target.value)} placeholder="e.g. 1905" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate (%)</label>
                <select value={editProdGstRate} onChange={e => setEditProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }}>
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
                <input type="text" value={editProdBarcode} onChange={e => setEditProdBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ flex: 1, padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
                <button onClick={() => setShowScanner(true)} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '0 20px', borderRadius: '10px', cursor: 'pointer' }}><BarcodeIcon size={24} /></button>
              </div>
              {editProdBarcode && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center', border: '1px solid #E2E8F0' }}>
                  <Barcode value={editProdBarcode} height={40} width={2} fontSize={14} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <ProductImageUploader images={editProdImages} onChange={setEditProdImages} userId={user.id} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', cursor: 'pointer', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '11px 13px' }}>
              <input type="checkbox" checked={editProdFeatured} onChange={(e) => setEditProdFeatured(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: '#4F46E5' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>⭐ Feature on storefront</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Show this product in the Featured row at the top of your store.</div>
              </div>
            </label>

            <button onClick={handleUpdateProduct} style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #4338CA)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Update Product</button>
            <button onClick={() => setShowEditProductModal(false)} style={{ width: '100%', background: 'transparent', color: '#64748B', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', display: 'flex', justifyContent: 'space-around', background: '#FFFFFF', padding: '12px 0 calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid #E2E8F0', zIndex: 100, boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)' }}>
        <div style={{...styles.navBtn, color: activeTab === 'home' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('home')}>
          <Home size={20} style={{ margin: '0 auto 4px auto' }} />
          <p style={{ fontSize: '10px', margin: 0 }}>Home</p>
        </div>
        
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'products' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('products')}>
            <Package size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Products</p>
          </div>
        )}
        
        <div style={{...styles.navBtn, color: activeTab === 'bills' ? '#4F46E5' : '#64748B', position: 'relative' }} onClick={() => setActiveTab('bills')}>
          <Receipt size={20} style={{ margin: '0 auto 4px auto' }} />
          <p style={{ fontSize: '10px', margin: 0 }}>Bills</p>
          {pendingOrders > 0 && <span style={{position:'absolute', top:-4, right:'20%', background:'#EF4444', width:10, height:10, borderRadius:'50%'}}></span>}
        </div>

        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'credit' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('credit')}>
            <Wallet size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Credit</p>
          </div>
        )}

        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'restock' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('restock')}>
            <Truck size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Restock</p>
          </div>
        )}
        
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'reports' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('reports')}>
            <Book size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Reports</p>
          </div>
        )}
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'profile' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('profile')}>
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
            background: 'linear-gradient(135deg, #1E293B, #0F172A)',
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
                color: '#CBD5E1',
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
              <h2 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', margin: '0 0 8px 0', background: 'linear-gradient(to right, #FFFFFF, #94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', color: '#fff' }}>
                Select Your Business Growth Plan
              </h2>
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                Unlock high-fidelity retail tools: barcode compliance, direct GST invoicing, CA Ledger access, and multi-staff lock-outs.
              </p>
            </div>

            {renderBillingToggle()}
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
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#CBD5E1', minHeight: '32px' }}>{plan.description}</p>
                    </div>

                    {renderPlanPrice(plan)}

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: 0 }} />

                    {/* Features checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
                      {plan.features?.map((feat, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: '#10B981', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                          <span style={{ fontSize: '12px', color: '#CBD5E1' }}>{feat}</span>
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
                          color: '#94A3B8',
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
                          color: isPopular ? 'white' : '#0F172A',
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
            
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748B' }}>
              🔒 Secure, encrypted transactions powered by Razorpay PG. Cancel or downgrade anytime instantly.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ShopDashboard;
