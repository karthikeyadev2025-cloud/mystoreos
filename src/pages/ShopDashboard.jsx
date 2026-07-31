import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { isServiceCategory } from '../lib/businessKind';
import { safe, mustSucceed } from '../lib/asyncHelpers';
import { printPdfWithFormat } from '../lib/printPdf';
import NotificationCenter from '../components/NotificationCenter';
import PushToggle from '../components/PushToggle';
import { INVOICE_TEMPLATES } from '../lib/invoiceTemplates';
import { defaultUnitForCategory, unitOptionsForCategory, resolveUnit, UNIT_SUFFIX, categorySuggestionsFor } from '../lib/units';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useRealtimeTable } from '../hooks/useRealtimeTable';
import { useSubscription } from '../hooks/useSubscription';
import { useSessionGuard } from '../hooks/useSessionGuard';
import { TrialExpiredOverlay } from '../components/PlanGate';
import { hasCap } from '../lib/features';
import { Home, Package, Receipt, Wallet, LogOut, IndianRupee, Book, Search, Barcode as BarcodeIcon, Camera, X, Truck, Building2, Scissors, MoreHorizontal, Users, Star, CreditCard, Mic } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { sharePdfNative, isNativeApp } from '../lib/capacitorInit';
// html5-qrcode and jsPDF are loaded on-demand, not on initial page load
import Barcode from 'react-barcode';
import BarcodeManager from '../components/BarcodeManager';
import VoiceOrderInput from '../components/VoiceOrderInput';
import VoiceOrderRecorderModal from '../components/VoiceOrderRecorderModal';
import { buildUpiUri, canTapToPay } from '../lib/upi';
import { localDateStr } from '../lib/dateUtils';
import { validateImageFile } from '../lib/fileValidation';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { downloadTallyXML, generateGSTR1CSV, generateMonthlySummaryCSV, downloadCSV } from '../lib/TallyExporter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { sendCreditReminder, sendBillNotification, sendPaymentConfirmation, sendTrialReminder, hasWhatsAppAPI } from '../lib/notify';
import { generateVoucherPDF, generateCreditNotePDF } from '../lib/pdfGenerator';

import DesktopSidebar from '../components/DesktopSidebar';
import DesktopPOS from '../components/DesktopPOS';
import MobilePOS from '../components/MobilePOS';
import MobileDashboard from '../components/MobileDashboard';
import DesktopInventory from '../components/DesktopInventory';
import ProductImageUploader from '../components/ProductImageUploader';
import DesktopBills from '../components/DesktopBills';
import DesktopCredit from '../components/DesktopCredit';
import DesktopRestock from '../components/DesktopRestock';
import DesktopReports from '../components/DesktopReports';
import DesktopBookings from '../components/DesktopBookings';
import ServiceBusinessHome from '../components/ServiceBusinessHome';
import DesktopMembership from '../components/DesktopMembership';
import DesktopFeedback from '../components/DesktopFeedback';
import DesktopSettings from '../components/DesktopSettings';
import BranchesManager from '../components/BranchesManager';
import DesktopCustomers from '../components/DesktopCustomers';
import DesktopExpenses from '../components/DesktopExpenses';

const DEFAULT_ANNOUNCE = { active: false, text: '', type: 'info' };



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
  // Bookings-first landing when business_kind='service'. This is the
  // hard/authoritative field set at signup (Register.jsx) — much more
  // reliable than the old "check if shop_category name matches a list"
  // approach, which broke as soon as we allowed free-text categories.
  // Legacy accounts (registered before business_kind existed) fall back
  // to the old category-name check for backwards compatibility.
  const isServiceBusiness = user && (
    user.businessKind === 'service' ||
    (!user.businessKind && isServiceCategory(user.shopCategory))
  );
  const [activeTab, setActiveTab] = useState(isServiceBusiness ? 'dashboard' : 'home');
  const [products, setProducts] = useState([]);
  const [dataLoadFailed, setDataLoadFailed] = useState(false);
  const [orders, setOrders] = useState([]);
  const [credits, setCredits] = useState([]);
  const [search, setSearch] = useState('');
  const posSearchRef = useRef(null);
  // Dedicated, always-mounted hidden QR canvas used ONLY by downloadQrPoster.
  // The previous version scraped document.querySelector('.qr-code-holder svg')
  // — an SVG that only exists on the mobile Settings screen — so clicking
  // "Download Poster" from desktop (or any screen without that exact widget
  // mounted) silently produced a poster with a blank box where the QR
  // should be. This ref is rendered unconditionally below, in this same
  // component, so it's always available regardless of which tab is active.
  const posterQrRef = useRef(null);
  
  // Quick Bill State
  const [billItems, setBillItems] = useState([]);
  // Expose whether there's an unsaved cart in progress so the service-worker
  // auto-update reload (see main.jsx) can wait until the cart is empty/saved
  // instead of silently wiping a bill the owner is mid-way through ringing up.
  useEffect(() => {
    window.__mystoreCartActive = billItems.length > 0;
    return () => { window.__mystoreCartActive = false; };
  }, [billItems]);
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
  // Per-variant pricing — e.g. Rice Bag sold as 5kg/20kg, each a different
  // price. Array of {name, price}. Empty array = no per-variant pricing,
  // falls back to the single shared `price` field (today's behavior).
  const [newProdVariantPrices, setNewProdVariantPrices] = useState([]);
  const [newProdHsnCode, setNewProdHsnCode] = useState('');
  const [newProdGstRate, setNewProdGstRate] = useState('0');
  const [newProdCostPrice, setNewProdCostPrice] = useState('0');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdImages, setNewProdImages] = useState([]);
  const [newProdFeatured, setNewProdFeatured] = useState(false);
  const [newProdUnit, setNewProdUnit] = useState('');
  const [newProdDiscountPct, setNewProdDiscountPct] = useState('0');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showMobileDashboard, setShowMobileDashboard] = useState(false);
  // Persistent "send PDF too" banner queue after wa.me text bills go out.
  // QUEUE — not single value — so a second bill generated before the first
  // banner is dismissed doesn't silently overwrite it. Each Bill A/B/C
  // entry is preserved; the active banner is queue[0], and only the ×
  // dismiss button advances to the next. Send PDF leaves the banner
  // active (cashier may want to re-send if they picked the wrong contact).
  // Without the queue, the cashier could lose Bill A's PDF entirely if
  // they tap Generate Bill on B while A's banner is still showing.
  const [pdfShareQueue, setPdfShareQueue] = useState([]);
  const pdfShareBanner = pdfShareQueue[0] || null;

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
  const [editProdVariantPrices, setEditProdVariantPrices] = useState([]);
  const [editProdHsnCode, setEditProdHsnCode] = useState('');
  const [editProdGstRate, setEditProdGstRate] = useState('0');
  const [editProdCostPrice, setEditProdCostPrice] = useState('0');
  const [editProdBarcode, setEditProdBarcode] = useState('');
  const [editProdUnit, setEditProdUnit] = useState('');
  const [editProdImages, setEditProdImages] = useState([]);
  const [editProdFeatured, setEditProdFeatured] = useState(false);
  const [editProdDiscountPct, setEditProdDiscountPct] = useState('0');
  const [editProdCategory, setEditProdCategory] = useState('');
  const [editProdSku, setEditProdSku] = useState('');

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
  // The shop OWNER's profile. For owners this is just `user`; for staff
  // it's the fetched owner record (user.staff_of). Used everywhere a bill,
  // PDF, WhatsApp message, notification, or receipt needs to show the
  // SHOP's name / GST / address / logo / UPI — not the logged-in staff
  // person's. Without this, a staff-generated bill showed the staff's
  // own name as the seller, which is wrong (the customer needs to see
  // the shop name they're paying).
  const [shopProfile, setShopProfile] = useState(user?.role === 'staff' ? null : user);
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
  const [exchangePolicy, setExchangePolicy] = useState('');   // e.g. "Exchange within 2 days with bill"
  const [termsConditions, setTermsConditions] = useState(''); // custom T&C
  // Print Settings
  const [printFormat,   setPrintFormat]   = useState('a4');       // 'a4' | 'thermal80' | 'thermal58'
  const [printTemplate, setPrintTemplate] = useState('classic');  // 'classic' | 'wholesale' | 'gst_tax' | 'minimal' | 'modern'
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

  // Wholesale Restocking States
  const [discountAmount, setDiscountAmount] = useState(0);
  const [manualDiscountPct, setManualDiscountPct] = useState(0); // manual % discount entered in POS
  const [roundOff, setRoundOff] = useState(0); // manual round-off amount, cashier types this in (+/- rupees)
  const [wholesaleCatalog, setWholesaleCatalog] = useState([]);
  const [restockCart, setRestockCart] = useState({}); // { wholesaleProdId: qty }
  const [restockNotes, setRestockNotes] = useState(''); // Special order notes for distributor

  // Sales Returns
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrder, setReturnOrder] = useState(null);
  const [returnItemsState, setReturnItemsState] = useState({}); // { itemId: returnQty }
  const [returnRefundMode, setReturnRefundMode] = useState('cash'); // 'cash' | 'upi' | 'card' | 'store_credit'

  // Admin PIN / Maker-Checker Workflows
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // SaaS Subscription States
  const [plans, setPlans] = useState([]);
  const [showPlanSelectorModal, setShowPlanSelectorModal] = useState(false);
  const [showVoiceRecorderModal, setShowVoiceRecorderModal] = useState(false);
  const [wholesaleSearchQuery, setWholesaleSearchQuery] = useState('');

  const handleConfirmVoiceOrder = async (analyzedItems) => {
    if (!analyzedItems || analyzedItems.length === 0) return;
    const orderItems = analyzedItems.map(i => ({
      id: i.productId,
      name: i.name,
      price: i.price,
      qty: i.qty,
    }));
    const total = analyzedItems.reduce((sum, i) => sum + (i.qty * i.price), 0);
    const firstProd = wholesaleCatalog.find(p => p.id === analyzedItems[0].productId);

    try {
      await mustSucceed(() => api.placeStockOrder(targetShopId, shop.name, orderItems, total, firstProd?.distributorId || null), 'AI Voice Stock Order');
      toast.success(`🚀 AI Voice Order Sent to Distributor! Total: ₹${total.toLocaleString('en-IN')}`);
      setShowVoiceRecorderModal(false);
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not send AI voice order');
    }
  };
  // Mobile bottom nav has no room for every tab desktop's sidebar shows.
  // Customers, Expenses, Membership, and Feedback had NO way to be
  // reached on mobile at all — not in the bottom nav, not via any
  // other button anywhere in this file (confirmed by direct search).
  // Four entire features were completely invisible to every mobile
  // user. This "More" sheet is the fix — same standard pattern most
  // mobile apps use once there are more destinations than fit in a
  // bottom bar.
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [pricing, setPricing] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(
    () => !!sessionStorage.getItem(`mystore_trial_banner_dismissed_${user.id}`)
  );

  // Active branch — owner with multiple shops can switch which one they're
  // viewing. Persisted to localStorage per logged-in user so refresh stays
  // on the same branch. For staff (who don't own branches) this stays null
  // and targetShopId falls through to their staff_of shop.
  const [branches, setBranches] = useState([]);          // owner's main + non-deleted branches
  // URL-based branch context:
  //   /shop              → main shop (branchId param = undefined → activeBranchId = null)
  //   /shop/branch/:id   → specific branch (activeBranchId = id)
  //
  // Each URL change causes a full component re-mount via React Router,
  // which means zero stale state bleeding between contexts. The old
  // setState approach kept the component alive and caused visible
  // flashes of wrong-shop data for 300-800ms during the re-fetch.
  const { branchId: urlBranchId } = useParams();
  const activeBranchId = urlBranchId || null;

  const setActiveBranchId = (id) => {
    if (id) {
      navigate(`/shop/branch/${id}`, { replace: false });
    } else {
      navigate('/shop', { replace: false });
    }
  };

  // Combined-reports scope toggle. 'branch' = report on currently-selected
  // branch only (the default — preserves single-branch behavior). 'all' =
  // union sales across every branch the owner runs. Owners use this when
  // they want a god's-eye view of the whole business across all locations
  // (e.g. RK Mens & Jeans: how did Main + Hitech City do combined today?).
  const [reportsScope] = useState('branch');
  const [allBranchOrders, setAllBranchOrders] = useState([]);
  const [, setAllBranchOrdersLoading] = useState(false);

  // For staff: still scoped to their staff_of shop. For owner: defaults to
  // their main shop (user.id), but if they've picked a branch, all queries
  // re-target to that branch's id. Single chokepoint that the rest of the
  // dashboard reads from — every existing api.getShopProducts/Orders/Staff
  // call already passes targetShopId, so they all become branch-aware for
  // free.
  const targetShopId = user.role === 'staff'
    ? user.staff_of
    : (activeBranchId && branches.some(b => b.id === activeBranchId) ? activeBranchId : user.id);
  // Tracks which shop's editable settings (print settings, invoice footer,
  // T&C, prefix, daily target) have been hydrated into form state — lets
  // loadData skip re-hydrating them on background polls so user edits and
  // fresh saves are never clobbered by stale in-flight reads. Keyed by
  // targetShopId so switching main ↔ branch re-hydrates correctly (the id
  // can also flip after mount when the branches list arrives).
  const settingsHydratedRef = useRef(null);
  // `shop` is the record to read SHOP-level fields from (name, GST, logo,
  // address, UPI, etc.). For owners this is just `user`. For staff, before
  // shopProfile loads, fall back to `user` so the page doesn't crash —
  // but once loadData runs (first thing on mount), shopProfile holds the
  // real owner record and every bill/PDF/notification picks it up.
  const shop = (user.role === 'staff' && shopProfile) ? shopProfile : user;
  // Real plan-tier check, not just "is this a service business" —
  // reused for both the desktop sidebar and the mobile bottom nav so
  // both platforms enforce the same Starter-tier bookings gate
  // consistently (see the sidebar prop below and the mobile Bookings
  // button further down, both of which used to only check
  // isServiceBusiness and never the actual plan tier at all).
  const canBookings = hasCap(shop, 'bookings');
  const isOwner = user.role === 'shop' || user.role === 'admin';

  // Two separate async-arrival races can leave a service business stuck on
  // the wrong landing tab, both fixed the same way — correct the tab once
  // the real businessKind is known, but only if the person hasn't already
  // navigated away from the default landing tabs in the meantime:
  //
  // 1. STAFF LOGINS: business_kind only ever lives on the OWNER's row, not
  //    the staff member's own row. `shop` (which holds the owner's data for
  //    staff sessions) starts as `user` until shopProfile finishes loading
  //    asynchronously, so the initial isServiceBusiness check can't see it.
  //
  // 2. SHOP OWNERS THEMSELVES: useAuth.jsx restores the cached session from
  //    localStorage synchronously on mount, then fetches the fresh DB row
  //    and merges it in via a SEPARATE async useEffect. If the cached
  //    session predates business_kind being set (e.g. right after
  //    registration redirects, or after completing onboarding, or simply
  //    an old cached session from before this feature existed),
  //    `user.businessKind` is briefly wrong/missing on the very first
  //    render — but `useState(isServiceBusiness ? 'bookings' : 'home')`
  //    only evaluates ONCE, at that first render. By the time the async
  //    merge corrects `user.businessKind` moments later, activeTab has
  //    already locked onto the wrong default and never revisits it. This
  //    is exactly what caused a freshly-registered Service (spa) account
  //    to land on Sales/POS instead of Bookings.
  const didAutoCorrectTab = useRef(false);
  useEffect(() => {
    if (didAutoCorrectTab.current) return;

    if (user.role === 'staff') {
      if (!shopProfile) return; // wait for the owner's data to load
      const ownerIsService = shopProfile.businessKind === 'service' ||
        (!shopProfile.businessKind && isServiceCategory(shopProfile.shopCategory));
      if (ownerIsService && (activeTab === 'home' || activeTab === 'dashboard')) {
        setActiveTab('dashboard');
      }
      didAutoCorrectTab.current = true;
    } else if (isOwner) {
      // For shop owners, `user` itself becomes authoritative once
      // useAuth's background merge (getUserById → toUser) completes. We
      // can't easily tell "has the merge happened yet" from inside this
      // component, so this check simply re-evaluates on every change to
      // user.businessKind — if it flips to 'service' after mount while
      // the person is still sitting on the default landing tabs, correct
      // it once. Guards against ever double-firing via the ref.
      const ownerIsService = user.businessKind === 'service' ||
        (!user.businessKind && isServiceCategory(user.shopCategory));
      if (ownerIsService && (activeTab === 'home' || activeTab === 'dashboard')) {
        setActiveTab('dashboard');
        didAutoCorrectTab.current = true;
      }
    }
  }, [shopProfile, user.role, user.businessKind, user.shopCategory, activeTab, isOwner]);


  const isMainOwner = user.role === 'shop' && !user.parentShopId;
  // True when the dashboard is showing the main shop's data/settings.
  // False in two cases:
  //   1. Main owner switched the dropdown to a branch
  //   2. User is logged in directly as a branch account (parentShopId set)
  const isViewingMain = targetShopId === user.id && !user.parentShopId;
  // True when the owner picked 'All Branches' from the switcher.
  // Only available to main owners (not branch staff or branch logins).
  // True when the owner is on the dedicated 'Branches' tab. Triggers
  // multi-branch data aggregation (orders from every branch tagged with
  // _branchName). Main owners only — branches and staff don't have this tab.
  const isCombinedScope = activeTab === 'branches' && !user.parentShopId && user.role !== 'staff';

  // ── Clear stale shop-scoped state on branch switch ───────────────────
  // Without this, switching from main → branch (or back) shows the OLD
  // shop's products/orders/credits/customers for 2–5 seconds (DB round-trip
  // time) before loadData fetches the new shop's data. Looks like a bug,
  // confuses owners. Clearing immediately = correct empty state for a brief
  // moment, then real data fills in. No mismatched flash.
  // Skipped in combined scope because BranchesDashboard expects orders
  // populated from all branches and clearing would cause a flicker.
  const prevTargetRef = useRef(targetShopId);
  useEffect(() => {
    if (prevTargetRef.current !== targetShopId && !isCombinedScope) {
      setProducts([]);
      setOrders([]);
      setCredits([]);
      setCustomerCredits([]);
      setStockOrders([]);
      setFlashSales({});
      setStaffList([]);
      setMyDistributors([]);
      setWholesaleCatalog([]);
    }
    prevTargetRef.current = targetShopId;
  }, [targetShopId, isCombinedScope]);

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
  // Every shop gets subscriptionTier='starter' by default at registration
  // (even while on trial), so subscriptionTier alone can't distinguish
  // "still on trial" from "admin upgraded". The `subscription` column is
  // the single source of truth: 'trial' until either Razorpay self-upgrade
  // or admin manual upgrade flips it to 'active' (both paths now do this
  // correctly — see api.updateUserSubscription).
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
    } catch { /* audio playback unavailable — non-critical */ }

    // Browser notification (works even when tab is in background)
    if ('Notification' in window) {
      const show = () => {
        try {
          new Notification(`🛒 New Order — ${shop.name}`, {
            body: `You have ${count} new order${count > 1 ? 's' : ''} waiting! Open MyStore OS to accept.`,
            icon: '/logo.png',
            badge: '/logo.png',
            tag: 'new-order',
            renotify: true,
          });
        } catch { /* Notification API unavailable — non-critical */ }
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
    // Owner-only: pull the list of branches (main shop + non-deleted
    // sub-shops). Used to populate the branch switcher in the header.
    // Staff never see/manage branches — they're locked to staff_of.
    if (user.role !== 'staff') {
      const list = await safe(() => api.getOwnedBranches(ownerId));
      if (Array.isArray(list)) setBranches(list);
    }
    if (freshOwner) {
      // Save the entire owner record so staff billing paths can pull
      // shop name, GST, address, logo, UPI etc. from the SHOP, not the
      // logged-in staff member. For owners, this is just their own
      // refreshed record (kept in sync the same way).
      setShopProfile(freshOwner);
      // Update local state for display
      if (freshOwner.logo      !== undefined) setLogo(freshOwner.logo || '');
      if (freshOwner.paymentQr !== undefined) setPaymentQr(freshOwner.paymentQr || '');
      if (freshOwner.upiId     !== undefined) setUpiId(freshOwner.upiId || '');
      // GST + address come from the SHOP owner's profile. A staff person
      // doesn't have their own GST or shop address — these must reflect
      // the shop they work at, or every bill they generate will be
      // missing GST/address info that customers and the tax office need.
      if (freshOwner.gstin           !== undefined) setGstin(freshOwner.gstin || '');
      if (freshOwner.stateCode       !== undefined) setStateCode(freshOwner.stateCode || '');
      if (freshOwner.businessAddress !== undefined) setBusinessAddress(freshOwner.businessAddress || '');
      // Merge into auth session so next render uses fresh data (non-destructive)
      if (user.role !== 'staff') {
        const cached = JSON.parse(localStorage.getItem('mystore_session') || '{}');
        const merged = { ...cached };
        for (const k of Object.keys(freshOwner)) {
          const v = freshOwner[k];
          if (v !== null && v !== undefined && v !== '') merged[k] = v;
        }
        // logo/paymentQr/upiId must sync EXACTLY (including being cleared to
        // empty on removal) — the generic skip-empty-values rule above is
        // right for fields like name/phone (never overwrite with blank by
        // accident), but it was the reason a removed/changed logo kept
        // showing the old cached value: an empty string from the DB was
        // never allowed to overwrite the stale cached base64 string.
        merged.logo = freshOwner.logo || '';
        merged.paymentQr = freshOwner.paymentQr || '';
        merged.upiId = freshOwner.upiId || '';
        try { localStorage.setItem('mystore_session', JSON.stringify(merged)); } catch { /* localStorage unavailable — non-critical */ }
      }
    }

    // safe() returns null on a failed read by design. Rendering that as
    // an empty catalogue is indistinguishable from a shop that genuinely
    // has no products — so a network hiccup looked like the entire
    // inventory had vanished. Tracked so the UI can say which it is.
    const prodRes = await safe(() => api.getShopProducts(targetShopId));
    setProducts(prodRes || []);
    setDataLoadFailed(prodRes === null);
    // In Combined ("All Branches") scope: load and merge orders from every
    // branch the owner runs, tagging each with branch info so the UI can
    // show a Branch column. The main shop's own orders are included since
    // it's also in `branches` (with parent_shop_id = null).
    let rawOrders;
    if (isCombinedScope && branches.length) {
      const allLists = await Promise.all(
        branches.map(b =>
          safe(() => api.getShopOrders(b.id)).then(list => (list || []).map(o => ({
            ...o,
            _branchId: b.id,
            _branchName: b.name + (!b.parentShopId ? ' (Main)' : ''),
          })))
        )
      );
      rawOrders = allLists.flat().sort((a, b) =>
        new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      );
    } else {
      rawOrders = (await safe(() => api.getShopOrders(targetShopId))) || [];
    }
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
    setWholesaleCatalog((await safe(() => api.getLinkedDistributorProducts(targetShopId))) || []);

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
      setPlans(await safe(() => api.getSubscriptionPlans(isServiceBusiness ? 'service' : 'retail')));
      setPricing(await safe(() => api.getPricing()));
      setPaymentHistory(await safe(() => api.getPaymentHistory(targetShopId)));
      // ── Editable settings: hydrate ONCE per shop, not on every poll ──────
      // loadData runs on a background interval. These fields are bound to
      // form inputs in the Settings tab — re-setting them every cycle
      // clobbered in-progress edits (Terms & Conditions wiped mid-typing)
      // and raced just-saved print settings back to stale DB values (an
      // in-flight poll started before Save resolved after it, flipping
      // 80mm Thermal back to A4). Hydrate on first load for a given
      // targetShopId only; explicit saves already keep state = DB.
      if (settingsHydratedRef.current !== targetShopId) {
        settingsHydratedRef.current = targetShopId;
        setInvoiceFooter(await safe(() => api.getSiteConfig('invoiceFooter_' + targetShopId, '')));
        setExchangePolicy(await safe(() => api.getSiteConfig('exchangePolicy_' + targetShopId, '')));
        setTermsConditions(await safe(() => api.getSiteConfig('termsConditions_' + targetShopId, '')));
        const ps = await safe(() => api.getSiteConfig('printSettings_' + targetShopId, null));
        if (ps) {
          if (ps.format)    setPrintFormat(ps.format);
          if (ps.template)  setPrintTemplate(ps.template);
          if (ps.fontSize)  setPrintFontSize(ps.fontSize);
          if (ps.showLogo !== undefined) setPrintShowLogo(ps.showLogo);
          if (ps.copies)    setPrintCopies(ps.copies);
        }
        setInvoicePrefix(await safe(() => api.getSiteConfig('invPrefix_' + targetShopId, 'INV')));
        setDailyTarget(parseInt(await safe(() => api.getSiteConfig('dailyTarget_' + targetShopId, 0))) || 0);
      }
      setFlashSales(await safe(() => api.getFlashSales(targetShopId)));
    }
  }, [targetShopId, isOwner, isCombinedScope, branches]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  useRealtimeTable({ table: 'orders', filter: `shop_id=eq.${targetShopId}`, onRefresh: loadData });
  useRealtimeTable({ table: 'products', filter: `shop_id=eq.${targetShopId}`, onRefresh: loadData });
  // Was missing entirely: a customer's credit/khata payment being marked
  // paid (or a new credit entry landing from a stock-order acceptance)
  // never triggered a live dashboard refresh — the shop only saw it after
  // manually navigating away and back. Same instant-update treatment as
  // orders/products now applies to the money side of the dashboard too.
  useRealtimeTable({ table: 'credits', filter: `to_shop_id=eq.${targetShopId}`, onRefresh: loadData });
  // Was missing: a distributor accepting/rejecting a shop's stock order
  // never triggered a live refresh of the shop's own Stock Orders list —
  // same instant-update treatment orders/appointments/credits already
  // have. The notification trigger fires regardless, but without this
  // the shop's list itself stays stale until a manual refresh or
  // navigating away and back.
  useRealtimeTable({ table: 'stock_orders', filter: `shop_id=eq.${targetShopId}`, onRefresh: loadData });
  // Live sync shop profile (logo, QR, UPI, name, phone) across all devices —
  // e.g. logo uploaded on mobile reflects instantly on desktop and vice versa.
  useRealtimeTable({ table: 'users', filter: `id=eq.${user.role === 'staff' ? user.staff_of : user.id}`, onRefresh: loadData, pollInterval: 15_000 });

  // Load orders across ALL branches when the owner switches Reports to
  // "All branches combined". Only fires when scope is 'all', user owns
  // 2+ branches, and we're on the reports tab — keeps this off the hot
  // path for everyone else. Re-runs when the branch list changes (new
  // branch added means refetch so its data is included) or when the
  // owner explicitly switches to combined mode.
  useEffect(() => {
    if (reportsScope !== 'all' || user.role === 'staff' || branches.length < 2) {
      setAllBranchOrders([]);
      return;
    }
    let cancelled = false;
    setAllBranchOrdersLoading(true);
    (async () => {
      try {
        const results = await Promise.all(
          branches.map(b => safe(() => api.getShopOrders(b.id)).then(r => r || []))
        );
        if (cancelled) return;
        // Flatten + dedupe by order id (defensive — shouldn't have dupes
        // since shop_id is unique per row, but cheap insurance).
        const seen = new Set();
        const merged = [];
        for (const arr of results) {
          for (const o of arr) {
            if (!seen.has(o.id)) { seen.add(o.id); merged.push(o); }
          }
        }
        merged.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAllBranchOrders(merged);
      } catch (err) {
        console.error('Failed to load all-branch orders:', err);
      } finally {
        if (!cancelled) setAllBranchOrdersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportsScope, branches, user.role]);

  // The orders array Reports tab actually reads — branch-scoped or all-
  // branches-combined based on the toggle. reportsData() reads this
  // from closure, so no prop drilling needed.
  // When in 'All Branches' combined scope, `orders` already contains data
  // aggregated from every branch (loaded in loadData with _branchName tags).
  // The legacy reportsScope toggle still works for the case where the owner
  // is on a single branch but wants a quick cross-branch view in Reports.
  const displayOrders = isCombinedScope ? orders : (reportsScope === 'all' ? allBranchOrders : orders);

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
    setEditProdVariantPrices(Array.isArray(p.variantPrices) && p.variantPrices.length ? p.variantPrices.map(v => ({ name: v.name, price: String(v.price) })) : []);
    setEditProdHsnCode(p.hsnCode || '');
    setEditProdGstRate(p.gstRate || '0');
    setEditProdCostPrice(p.costPrice !== undefined ? String(p.costPrice) : '0');
    setEditProdBarcode(p.barcode || '');
    setEditProdUnit(p.unit || shopDefaultUnit);
    setEditProdImages(Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []));
    setEditProdFeatured(!!p.isFeatured);
    setEditProdDiscountPct(String(p.discountPct || 0));
    setEditProdCategory(p.category || '');
    setEditProdSku(p.sku || '');
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
        variantPrices: editProdVariantPrices.filter(v => v.name.trim() && v.price !== '').map(v => ({ name: v.name.trim(), price: parseFloat(v.price) || 0 })).length
          ? editProdVariantPrices.filter(v => v.name.trim() && v.price !== '').map(v => ({ name: v.name.trim(), price: parseFloat(v.price) || 0 }))
          : null,
        hsnCode: editProdHsnCode,
        gstRate: editProdGstRate,
        costPrice: parseFloat(editProdCostPrice) || 0,
        barcode: editProdBarcode,
        unit: editProdUnit || shopDefaultUnit,
        images: editProdImages,
        isFeatured: editProdFeatured,
        discountPct: parseInt(editProdDiscountPct) || 0,
        category: editProdCategory.trim() || null,
        sku: editProdSku.trim() || null,
      }));
      toast.success("Product updated successfully!");
      setShowEditProductModal(false);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to update product");
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
        await mustSucceed(() => api.deleteProduct(prodId), 'Delete product');
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
      await mustSucceed(() => api.addCredit(targetShopId, targetShopId, descStr, custCreditAmount), 'Log customer credit');
      toast.success("Customer credit logged successfully!");
      setCustCreditName('');
      setCustCreditPhone('');
      setCustCreditDesc('');
      setCustCreditAmount('');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save credit");
    }
  };

  const sendCustomerCreditReminder = (c) => {
    const parts = c.desc.split(':');
    const custName = parts[1] || 'Valued Customer';
    const custPhone = parts[2] || '';
    const upiIdForStore = upiId || user.upiId || '';
    // Use notify.js: WhatsApp Cloud API → wa.me fallback → SMS
    sendCreditReminder(custPhone, custName, c.amount, shop.name, upiIdForStore);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Keyboard shortcut: '/' focuses POS search
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName) && activeTab === 'home') {
        e.preventDefault();
        posSearchRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === posSearchRef.current) {
        setSearch('');
        posSearchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab]);

  const addToBill = useCallback((prod) => {
    setBillItems(prevItems => {
      const existing = prevItems.find(item => item.id === prod.id);
      if (existing) {
        toast.success(`Increased quantity of ${prod.name}`, { autoClose: 1000 });
        return prevItems.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item);
      }
      const sale = flashSales[prod.id];
      const activeSale = sale && new Date(sale.expiresAt) > new Date();
      const hasVariantPricing = Array.isArray(prod.variantPrices) && prod.variantPrices.length > 0;
      // Default to the first variant's own price (not the shared base
      // price) when this product has structured per-variant pricing —
      // e.g. adding "Rice Bag" should bill at the 5kg price immediately,
      // not silently default to whatever the base `price` field happens
      // to be set to.
      const effectiveBasePrice = hasVariantPricing ? (Number(prod.variantPrices[0].price) || prod.price) : prod.price;
      // Standing label discount (set in Add/Edit Product, shown on the
      // storefront and barcode labels) — was never read here at all, so a
      // product with e.g. discountPct=20 billed at full price in the POS
      // with zero visible discount, even though the storefront/label
      // printer both correctly showed it. Flash sale (time-limited
      // promotional push) takes priority over the standing discount when
      // both happen to be set on the same product.
      const standingDiscPct = Math.min(99, Number(prod.discountPct) || 0);
      const salePrice = activeSale
        ? Math.max(0, Math.round(effectiveBasePrice * (1 - sale.discount / 100)))
        : standingDiscPct > 0
          ? Math.max(0, Math.round(effectiveBasePrice * (1 - standingDiscPct / 100)))
          : effectiveBasePrice;
      const firstVariant = hasVariantPricing
        ? prod.variantPrices[0].name
        : (prod.variants ? prod.variants.split(',')[0].trim() : '');
      const label = activeSale
        ? `🔥 ${prod.name} added (${sale.discount}% off!)`
        : standingDiscPct > 0
          ? `🏷️ ${prod.name} added (${standingDiscPct}% off)`
          : `Added ${prod.name} to bill`;
      toast.success(label, { autoClose: 1000 });
      return [...prevItems, { ...prod, price: salePrice, originalPrice: (activeSale || standingDiscPct > 0) ? effectiveBasePrice : undefined, basePrice: effectiveBasePrice, qty: 1, selectedVariant: firstVariant }];
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
      return prev.map(item => {
        if (item.id !== prodId) return item;
        // If this product has structured per-variant pricing, switching the
        // variant must actually change the billed price (was: only updated
        // the display label, every variant billed identically). It must
        // ALSO reapply the product's standing discountPct on top of the new
        // variant's base price — this was a second bug found alongside the
        // first: switching variants on a discounted item silently stripped
        // the discount entirely (price was overwritten with the variant's
        // raw price, discount never reapplied).
        if (Array.isArray(item.variantPrices) && item.variantPrices.length) {
          const match = item.variantPrices.find(v => v.name === variant);
          if (match) {
            const newBasePrice = Number(match.price) || item.price;
            const standingDiscPct = Math.min(99, Number(item.discountPct) || 0);
            const newPrice = standingDiscPct > 0
              ? Math.max(0, Math.round(newBasePrice * (1 - standingDiscPct / 100)))
              : newBasePrice;
            return {
              ...item,
              selectedVariant: variant,
              price: newPrice,
              basePrice: newBasePrice,
              originalPrice: standingDiscPct > 0 ? newBasePrice : undefined,
            };
          }
        }
        return { ...item, selectedVariant: variant };
      });
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
    setRoundOff(0);
  };

  // ── Print current bill without saving/sending ─────────────────────────────
  // Renders the current cart to PDF and opens it in a new browser tab so
  // the browser's native print dialog appears. Does NOT place an order
  // or send WhatsApp — purely for thermal/A4 printer output at the counter.
  const printCurrentBill = async () => {
    if (billItems.length === 0) return toast.error('Bill is empty');
    try {
      const loyaltyDiscountRupees = Math.floor(loyaltyRedeem / 10);
      const preRoundTotal = Math.max(0, billTotal - discountAmount - manualDiscountAmt - loyaltyDiscountRupees);
      // Manual round-off wins; otherwise auto-snap the fractional
      // remainder so the receipt balances (see effectiveRoundOff near
      // billTotal). Computed locally here because this function is
      // defined above billTotal in the file.
      const autoRem = Math.round((Math.round(preRoundTotal) - preRoundTotal) * 100) / 100;
      const roundOffAmt = (Number(roundOff) || 0) !== 0 ? (Number(roundOff) || 0) : autoRem;
      const total = Math.max(0, Math.round(preRoundTotal + roundOffAmt));

      // ── Create the actual order first ───────────────────────────────────
      // BUG FIX: this function used to ONLY render a preview PDF and open
      // the print dialog — it never called placeOrder, so clicking "Print
      // Bill" in the POS never actually saved the transaction. A cashier
      // printing a receipt expects that to mean "this sale happened," not
      // "here's a preview." Confirmed with the shop owner: Print should
      // behave exactly like Confirm & Generate Bill (save the order) AND
      // then open the print dialog, in one click — same order-creation
      // logic as executeSendWhatsAppBill, just skipping the WhatsApp/PDF
      // download path in favour of the print dialog.
      let finalUserId = 'walk-in-customer';
      const staffSuffix = (user.role === 'staff' && user.id) ? `:staff:${user.id}:${user.name || ''}` : '';
      if (billingMode === 'estimate') {
        finalUserId = `estimate:${customerName || 'Guest'}:${customerPhone || ''}${staffSuffix}`;
      } else if (billingMode === 'challan') {
        finalUserId = `challan:${customerName || 'Guest'}:${customerPhone || ''}${staffSuffix}`;
      } else {
        finalUserId = `walk-in:${customerName || 'Guest'}:${customerPhone || ''}${staffSuffix}`;
      }

      const invoiceNo = billingMode === 'bill' ? await safe(() => api.getNextInvoiceNumber(targetShopId)) : null;

      await mustSucceed(() => api.placeOrder(finalUserId, targetShopId, billItems.map(b => ({
        id: b.id,
        name: b.name,
        price: b.price,
        qty: b.qty || 1,
        selectedVariant: b.selectedVariant || '',
        itemDiscount: b.itemDiscount || 0
      })), total, { gstin: customerGstin, address: customerAddress, stateCode: customerStateCode, phone: customerPhone },
      billingMode === 'bill' ? 'Accepted' : 'Pending',
      paymentMethod || 'Cash',
      invoiceNo?.int || null), 'Place order');

      if (loyaltyEnabled && customerPhone && billingMode === 'bill') {
        if (loyaltyRedeem > 0) await safe(() => api.redeemLoyaltyPoints(targetShopId, customerPhone, loyaltyRedeem));
        await safe(() => api.awardLoyaltyPoints(targetShopId, customerPhone, total));
      }

      // ── TEMPLATE ENGINE PATH ─────────────────────────────────────────
      // When the shop has picked anything other than the built-in
      // 'classic' layout (wholesale/GST/minimal/modern), route through
      // the new HTML-based template renderer instead of the hand-drawn
      // jsPDF/thermal paths below. Handles A4 and both thermal widths
      // itself via the same @page technique already proven for
      // thermal receipts, so paper size still comes from printFormat.
      if (printTemplate && printTemplate !== 'classic') {
        const { printInvoice } = await import('../lib/invoicePrint');
        let modeTitleTpl = 'TAX INVOICE';
        if (billingMode === 'estimate') modeTitleTpl = 'PROFORMA ESTIMATE';
        if (billingMode === 'challan')  modeTitleTpl = 'DELIVERY CHALLAN';
        printInvoice(printTemplate, {
          shopName: shop.name || 'Shop',
          shopPhone: shop.phone || '',
          shopAddress: businessAddress || shop.address || '',
          shopGSTIN: gstin || '',
          // eslint-disable-next-line react-hooks/purity -- runs inside printCurrentBill, a click handler, never during render
          billNo: invoiceNo?.formatted || `${Date.now().toString().slice(-6)}`,
          dateStr: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          modeTitle: modeTitleTpl,
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          customerAddress: customerAddress || '',
          items: billItems.map(i => ({
            code: i.sku || '',
            name: i.name + (i.selectedVariant ? ` (${i.selectedVariant})` : ''),
            hsn: i.hsn || '',
            qty: i.qty || 1,
            rate: i.price,
            gstPct: i.gstPct || 0,
          })),
          subtotal: billTotal,
          discountAmount: discountAmount + manualDiscountAmt,
          roundOff: roundOffAmt,
          total,
          paymentMode: paymentMethod || '',
          footerNote: invoiceFooter || 'Thank you! Visit again.',
          termsNote: termsConditions || '',
        }, printFormat || 'a4');

        // Clear the cart — the order was already placed above.
        setBillItems([]);
        setDiscountAmount(0);
        setManualDiscountPct(0);
        setLoyaltyRedeem(0);
        setRoundOff(0);
        setCustomerLoyaltyPoints(0);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerGstin('');
        setCustomerAddress('');
        setCustomerStateCode('');
        toast.success('Bill saved — opening print…');
        return;
      }

      const { jsPDF: JsPDF } = await import('jspdf');

      // Use the shop's actual chosen print format (A4 / thermal80 / thermal58)
      const fmt = printFormat || 'a4';
      const isThermal  = fmt === 'thermal80' || fmt === 'thermal58';

      // ── THERMAL PATH: render as native HTML, not jsPDF ──────────────────
      // jsPDF thermal blobs don't print reliably — the browser's PDF
      // plugin ignores the wrapper @page size and lands the receipt on
      // A4. Native HTML print honours `@page { size: 80mm auto }`
      // exactly, so thermal receipts actually come out at roll width.
      // A4 keeps the richer jsPDF layout below.
      if (isThermal) {
        const widthMm = fmt === 'thermal58' ? 58 : 80;
        const itemSavingsT = billItems.reduce((s, i) => {
          const d = i.itemDiscount || 0;
          return d > 0 ? s + Math.round(i.price * (i.qty || 1) * d / 100) : s;
        }, 0);
        let modeTitleT = 'TAX INVOICE';
        if (billingMode === 'estimate') modeTitleT = 'PROFORMA ESTIMATE';
        if (billingMode === 'challan')  modeTitleT = 'DELIVERY CHALLAN';

        const receiptData = {
          shopName: shop.name || 'Shop',
          shopPhone: shop.phone || '',
          shopAddress: businessAddress || shop.address || '',
          gstin: customerGstin ? (gstin || '') : (gstin || ''),
          modeTitle: modeTitleT,
          // eslint-disable-next-line react-hooks/purity -- runs inside printCurrentBill, a click handler, never during render
          billNo: `${Date.now().toString().slice(-6)}`,
          dateStr: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          items: billItems.map(i => ({ name: i.name, qty: i.qty || 1, price: i.price, discountPct: i.itemDiscount || 0 })),
          subtotal: billTotal,
          itemSavings: itemSavingsT,
          billDiscount: (discountAmount + manualDiscountAmt),
          loyaltyRedeemed: loyaltyDiscountRupees,
          roundOff: roundOffAmt,
          total,
          paymentMode: paymentMethod || '',
          footerNote: invoiceFooter || 'Thank you! Visit again.',
        };

        const { printThermalReceipt } = await import('../lib/thermalReceipt');
        const { fallback } = printThermalReceipt(receiptData, widthMm);
        if (fallback === 'popup') {
          toast.info('Allow pop-ups for this site to print receipts.');
        }

        // Clear the cart — the order was already placed above.
        setBillItems([]);
        setDiscountAmount(0);
        setManualDiscountPct(0);
        setLoyaltyRedeem(0);
        setRoundOff(0);
        setCustomerLoyaltyPoints(0);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerGstin('');
        setCustomerAddress('');
        setBillingMode('invoice');
        return;
      }

      const mmW        = fmt === 'thermal58' ? 58 : fmt === 'thermal80' ? 80 : 210;
      const marginL    = isThermal ? 3 : 15;
      const contentW   = mmW - marginL * 2;

      const doc = new JsPDF({
        unit: 'mm',
        format: isThermal ? [mmW, 400] : 'a4', // 400mm tall for thermal scroll
        orientation: 'portrait',
      });

      // Thermal printers render mid-gray tones as faint/washed-out — force
      // near-black on thermal, leave A4 grays untouched. Same fix as
      // printReceiptPDF (the re-print function) — see comment there.
      const setTextColor = (r, g, b) => {
        if (isThermal) {
          const isGrayish = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
          if (isGrayish && r > 40) { doc.setTextColor(20, 20, 20); return; }
        }
        doc.setTextColor(r, g, b);
      };

      // Shared header colour
      let themeColor = '#10B981';
      let modeTitle  = 'TAX INVOICE';
      let modeShort  = 'INV';
      if (billingMode === 'estimate') { themeColor = '#4F46E5'; modeTitle = 'PROFORMA ESTIMATE'; modeShort = 'EST'; }
      if (billingMode === 'challan')  { themeColor = '#3B82F6'; modeTitle = 'DELIVERY CHALLAN';  modeShort = 'DC';  }
      const hex2rgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
      const [tR,tG,tB] = hex2rgb(themeColor);

      // ── Header stripe ────────────────────────────────────────────────────────
      doc.setFillColor(tR,tG,tB);
      doc.rect(0, 0, mmW, isThermal ? 7 : 10, 'F');

      let hy = isThermal ? 13 : 20;

      const hasLogo = printShowLogo && shop.logo && shop.logo.startsWith('data:image');
      const logoW = 20, logoH = 20;
      if (hasLogo && !isThermal) {
        try { doc.addImage(shop.logo, 'JPEG', marginL, hy - 6, logoW, logoH); } catch (_e) { /* corrupt/unsupported logo image — skip */ }
      }

      const textX = hasLogo && !isThermal ? marginL + logoW + 4 : marginL;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isThermal ? 11 : 16);
      setTextColor(15, 23, 42);
      doc.text(shop.name || 'Invoice', isThermal ? mmW/2 : textX, hy, isThermal ? {align:'center'} : {});
      hy += isThermal ? 5 : 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isThermal ? 7 : 9);
      setTextColor(100, 116, 139);
      let contactLine = `Ph: ${shop.phone || ''}`;
      if (!isThermal && upiId) contactLine += `   |   UPI: ${upiId}`;
      doc.text(contactLine, isThermal ? mmW/2 : textX, hy, isThermal ? {align:'center'} : {});
      hy += 5;
      if (isThermal && upiId) { doc.text(`UPI: ${upiId}`, mmW/2, hy, {align:'center'}); hy += 5; }
      if (gstin) {
        const gLine = `GSTIN: ${gstin}${stateCode && !isThermal ? `   |   State: ${stateCode}` : ''}`;
        doc.text(gLine, isThermal ? mmW/2 : textX, hy, isThermal ? {align:'center'} : {}); hy += 5;
      }

      // Doc type badge (A4 only)
      if (!isThermal) {
        doc.setFillColor(tR,tG,tB);
        doc.roundedRect(140, 12, 55, 14, 3, 3, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setTextColor(255,255,255);
        doc.text(modeTitle.length > 14 ? modeShort + ' DOC' : modeTitle, 167.5, 20.5, {align:'center'});
        doc.setFont('helvetica','normal'); doc.setFontSize(9); setTextColor(71,85,105);
        const dateStr = new Date().toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
        doc.text(`Date: ${dateStr}`, 195, 30, {align:'right'});
      }

      // ── Items divider ────────────────────────────────────────────────────────
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(isThermal ? 0.2 : 0.4);
      doc.line(marginL, hy, mmW - marginL, hy); hy += isThermal ? 5 : 8;

      if (isThermal) {
        doc.setFont('helvetica','bold'); doc.setFontSize(9); setTextColor(tR,tG,tB);
        doc.text(modeTitle, mmW/2, hy, {align:'center'}); hy += 5;
        const dateStrT = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
        doc.setFont('helvetica','normal'); doc.setFontSize(7); setTextColor(71,85,105);
        doc.text(`Date: ${dateStrT}`, mmW/2, hy, {align:'center'}); hy += 5;
      }

      // Customer block
      if (customerName) {
        doc.setFont('helvetica','bold'); doc.setFontSize(isThermal ? 7 : 8.5); setTextColor(100,116,139);
        doc.text(isThermal ? '--- BILL TO ---' : 'BILL TO:', isThermal ? mmW/2 : marginL+3, hy, isThermal ? {align:'center'} : {}); hy += 5;
        doc.setFont('helvetica','bold'); doc.setFontSize(isThermal ? 8 : 10); setTextColor(15,23,42);
        doc.text(customerName, isThermal ? mmW/2 : marginL+3, hy, isThermal ? {align:'center'} : {}); hy += 5;
        doc.setFont('helvetica','normal'); doc.setFontSize(isThermal ? 7 : 9); setTextColor(71,85,105);
        if (customerPhone) { doc.text(`Ph: ${customerPhone}`, isThermal ? mmW/2 : marginL+3, hy, isThermal ? {align:'center'} : {}); hy += 5; }
        doc.line(marginL, hy, mmW - marginL, hy); hy += 4;
      }

      // ── Table header ─────────────────────────────────────────────────────────
      const colNo   = marginL;
      const colItem = marginL + (isThermal ? 1 : 6);
      const colQty  = isThermal ? marginL + Math.round(contentW * 0.55) : marginL + 100;
      const colPr   = marginL + 126;
      const colAmt  = mmW - marginL - 2;

      if (!isThermal) {
        doc.setFillColor(tR,tG,tB);
        doc.rect(marginL, hy, contentW, 8, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8); setTextColor(255,255,255);
        doc.text('#',        colNo,  hy + 5.5);
        doc.text('Item',     colItem,hy + 5.5);
        doc.text('Qty',      colQty, hy + 5.5);
        doc.text('Price',    colPr,  hy + 5.5);
        doc.text('Amount',   colAmt, hy + 5.5, {align:'right'});
        hy += 10;
      } else {
        doc.setFont('helvetica','bold'); doc.setFontSize(7); setTextColor(71,85,105);
        doc.text('Item', colItem, hy); doc.text('Qty', colQty, hy); doc.text('Amt', colAmt, hy, {align:'right'});
        hy += 5;
      }

      // ── Items ────────────────────────────────────────────────────────────────
      let rowN = 0;
      billItems.forEach(item => {
        rowN++;
        const qty = item.qty || 1;
        const iDisc = item.itemDiscount || 0;
        const lineAmt = item.price * qty;
        const discAmt = iDisc > 0 ? Math.round(lineAmt * iDisc / 100) : 0;
        const finalAmt = lineAmt - discAmt;
        const unitSuffix = UNIT_SUFFIX[resolveUnit(item, shopCategory)] || '';
        const qtyTxt = unitSuffix ? `${qty} ${unitSuffix}` : `${qty}`;
        const maxW = colQty - colItem - 3;

        if (!isThermal && rowN % 2 === 0) {
          doc.setFillColor(249,250,251); doc.rect(marginL, hy-5, contentW, 9, 'F');
        }

        doc.setFont('helvetica','normal'); doc.setFontSize(isThermal ? 7 : 8.5); setTextColor(51,65,85);
        if (!isThermal) doc.text(String(rowN), colNo, hy);
        doc.text(item.name + (item.selectedVariant ? ` (${item.selectedVariant})` : ''), colItem, hy, {maxWidth: maxW});
        doc.text(qtyTxt, colQty, hy);
        if (!isThermal) {
          setTextColor(iDisc > 0 ? 148 : 51, iDisc > 0 ? 163 : 65, iDisc > 0 ? 184 : 85);
          doc.text(item.price.toFixed(2), colPr, hy);
          setTextColor(51,65,85);
        }
        doc.setFont('helvetica','bold');
        const amtTxt = isThermal ? (iDisc > 0 ? `${finalAmt.toFixed(0)}(-${iDisc}%)` : finalAmt.toFixed(0)) : finalAmt.toFixed(2);
        doc.text(amtTxt, colAmt, hy, {align:'right'});
        doc.setFont('helvetica','normal'); setTextColor(51,65,85);
        hy += 8;
      });

      // ── Totals ───────────────────────────────────────────────────────────────
      doc.setDrawColor(226,232,240); doc.setLineWidth(0.5); doc.line(marginL, hy-2, mmW-marginL, hy-2); hy += 4;

      const tLabelX = isThermal ? marginL : marginL + 95;

      const addRow = (lbl, val, opts = {}) => {
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
        doc.setFontSize(opts.large ? 11 : 9);
        setTextColor(...(opts.color || [71,85,105]));
        doc.text(lbl, tLabelX, hy);
        doc.text(val, colAmt, hy, {align:'right'});
        doc.setFont('helvetica','normal'); setTextColor(71,85,105);
        hy += opts.large ? 7 : 5;
      };

      const itemSavings = billItems.reduce((s,i) => {
        const d = i.itemDiscount||0;
        return d > 0 ? s + Math.round(i.price*(i.qty||1)*d/100) : s;
      }, 0);

      if (itemSavings > 0) {
        addRow('Item Discounts', `-Rs. ${itemSavings.toFixed(2)}`, {color:[22,163,74]});
      }
      if (discountAmount > 0 || manualDiscountAmt > 0) {
        addRow('Bill Discount', `-Rs. ${(discountAmount+manualDiscountAmt).toFixed(2)}`, {color:[22,163,74]});
      }
      if (loyaltyDiscountRupees > 0) {
        addRow('Loyalty Redeemed', `-Rs. ${loyaltyDiscountRupees.toFixed(2)}`, {color:[139,92,246]});
      }
      if (roundOffAmt !== 0) {
        addRow('Round Off', `${roundOffAmt > 0 ? '+' : ''}Rs. ${roundOffAmt.toFixed(2)}`, {color: roundOffAmt > 0 ? [22,163,74] : [220,38,38]});
      }

      hy += 2;
      doc.setFillColor(tR,tG,tB);
      doc.roundedRect(isThermal ? marginL : marginL+93, hy-5, isThermal ? contentW : contentW-93, 12, 3, 3, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(12); setTextColor(255,255,255);
      doc.text(isThermal ? 'TOTAL' : 'GRAND TOTAL', isThermal ? marginL+2 : marginL+97, hy+3.5);
      doc.text(`Rs. ${total.toFixed(2)}`, colAmt, hy+3.5, {align:'right'});
      doc.setFont('helvetica','normal'); setTextColor(71,85,105);
      hy += 16;

      // Footer
      doc.setFont('helvetica','normal'); doc.setFontSize(8); setTextColor(148,163,184);
      doc.text(invoiceFooter || 'Thank you for your business!', isThermal ? mmW/2 : marginL, hy, isThermal ? {align:'center'} : {});
      hy += 5;
      doc.text('Powered by MyStore OS — mystoreos.in', isThermal ? mmW/2 : marginL, hy, isThermal ? {align:'center'} : {});

      // ── Print via browser dialog, respecting the shop's paper size ─────
      const pdfBlob = doc.output('blob');
      const safeName = (shop.name || 'Bill').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeName}_Print.pdf`;

      if (isNativeApp()) {
        // On mobile native: use share sheet → user can pick a print/save app
        await sharePdfNative(pdfBlob, fileName, `Print — ${shop.name}`);
      } else {
        // Desktop/web: hand off to the shared thermal-safe helper. It:
        //   1) calls doc.autoPrint() so the embedded PDF viewer fires
        //      its print dialog with the PDF's true page size
        //   2) opens the PDF inside a tiny HTML shell that declares an
        //      @page rule matching the shop's chosen format (58mm /
        //      80mm / A4), so the print dialog defaults to that paper
        //      size instead of Chrome's default A4 — which was the
        //      root cause of thermal bills coming out squeezed or blown
        //      up onto A4 paper.
        const { fallback } = await printPdfWithFormat(doc, { fileName, format: printFormat || 'a4' });
        if (fallback === 'download') {
          toast.info('Pop-up blocked — PDF downloaded. Open it and print from there.');
        }
      }

      // Reset the cart the same way executeSendWhatsAppBill does after a
      // successful bill — the order is now genuinely saved, so the POS
      // screen should clear for the next customer just like it would
      // after "Confirm & Generate Bill."
      setBillItems([]);
      setDiscountAmount(0);
      setManualDiscountPct(0);
      setLoyaltyRedeem(0);
      setRoundOff(0);
      setCustomerLoyaltyPoints(0);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerAddress('');
      setCustomerStateCode('');
      loadData();
    } catch (err) {
      console.error('Print failed:', err);
      toast.error('Could not generate print PDF. Please try again.');
    }
  };

  const sendWhatsAppBill = async () => {
    if (billItems.length === 0) return toast.error("Bill is empty");
    const loyaltyDiscountRupees = Math.floor(loyaltyRedeem / 10);
    const preRound = Math.max(0, billTotal - discountAmount - manualDiscountAmt - loyaltyDiscountRupees);
    const autoRem = Math.round((Math.round(preRound) - preRound) * 100) / 100;
    const roAmt = (Number(roundOff) || 0) !== 0 ? (Number(roundOff) || 0) : autoRem;
    const total = Math.max(0, Math.round(preRound + roAmt));

    if (!isOwner && total > 5000) {
      setPendingAction(() => () => executeSendWhatsAppBill());
      setShowAdminPinModal(true);
      return;
    }
    
    executeSendWhatsAppBill();
  };

  const executeSendWhatsAppBill = async () => {
    const loyaltyDiscountRupees = Math.floor(loyaltyRedeem / 10); // 10 pts = ₹1
    const preRoundTotal = Math.max(0, billTotal - discountAmount - manualDiscountAmt - loyaltyDiscountRupees);
    // roundOff is entered MANUALLY by the cashier in the POS (e.g. rounding
    // ₹297 down to ₹295, or ₹298 up to ₹300) — not auto-calculated. This
    // matches how Indian shopkeepers actually handle cash change in
    // practice: they decide the round figure themselves per bill.
    // BUT: when the cashier hasn't entered one and the natural total has
    // paise (fractional prices / percentage discounts), we auto-snap to
    // the nearest rupee so line-items + round-off == total on the receipt.
    const autoRem = Math.round((Math.round(preRoundTotal) - preRoundTotal) * 100) / 100;
    const roundOffAmt = (Number(roundOff) || 0) !== 0 ? (Number(roundOff) || 0) : autoRem;
    const total = Math.max(0, Math.round(preRoundTotal + roundOffAmt));
    
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

      // Allocate the invoice number BEFORE placeOrder so the DB row and
      // the PDF both get the same number. The old order burned two counters
      // per bill: placeOrder called next_invoice_no internally (burned #N),
      // then getNextInvoiceNumber burned #N+1 — PDF showed #N+1, DB had #N.
      // Known tradeoff: if placeOrder fails after this, the number is burned.
      // Future fix: rollback RPC or allocate after PDF render succeeds.
      const invoiceNo = billingMode === 'bill' ? await safe(() => api.getNextInvoiceNumber(targetShopId)) : null;

      await mustSucceed(() => api.placeOrder(finalUserId, targetShopId, billItems.map(b => ({
        id: b.id,
        name: b.name,
        price: b.price,
        qty: b.qty || 1,
        selectedVariant: b.selectedVariant || '',
        itemDiscount: b.itemDiscount || 0
      })), total, { gstin: customerGstin, address: customerAddress, stateCode: customerStateCode, phone: customerPhone },
      billingMode === 'bill' ? 'Accepted' : 'Pending',
      paymentMethod || 'Cash',
      // Pass the int allocated above — same number stamped on the PDF.
      // Storing it on the order row keeps the printed bill and the
      // queryable DB in lockstep, which is what GST audits require.
      invoiceNo?.int || null));

      let loyaltyResult = null;
      if (loyaltyEnabled && customerPhone && billingMode === 'bill') {
        if (loyaltyRedeem > 0) await safe(() => api.redeemLoyaltyPoints(targetShopId, customerPhone, loyaltyRedeem));
        loyaltyResult = await safe(() => api.awardLoyaltyPoints(targetShopId, customerPhone, total));
      }

      // Sound synthesis announcement for completed bill (not for estimate/challan)
      if (billingMode === 'bill' && 'speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`MyStore received ${total} rupees successfully!`));
      }

      // ── PDF GENERATION ────────────────────────────────────────────────────────
      const { jsPDF: JsPDF } = await import('jspdf');

      // ── Print format config ──────────────────────────────────────────────────
      // This PDF goes straight to the CUSTOMER (WhatsApp share / download), so it
      // must always render as a normal, readable A4 document — regardless of what
      // physical printer (A4 / 80mm thermal / 58mm thermal) the shop has selected
      // in Settings for in-store till printing. Thermal-shaped PDFs look broken
      // when previewed on a customer's phone in WhatsApp.
      // The shop's printFormat IS still respected by the dedicated "Print / Share"
      // re-print button (printReceiptPDF) used for the till printer.
      const isThermal   = false;
      const pageW       = 210;
      const pageH       = 297;
      const marginL     = 15;
      const contentW    = pageW - marginL * 2;

      const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

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

      const hasLogo = printShowLogo && shop.logo && shop.logo.startsWith('data:image');
      const logoW = isThermal ? 14 : 22, logoH = isThermal ? 14 : 22, logoX = marginL;
      if (hasLogo) {
        try { doc.addImage(shop.logo, 'JPEG', logoX, hy - 6, logoW, logoH); } catch (_e) { /* corrupt/unsupported logo image — skip */ }
      }
      const textX = hasLogo ? (marginL + logoW + 3) : marginL;

      // Shop name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(isThermal ? 11 : 18);
      doc.setTextColor(15, 23, 42);
      doc.text(shop.name, isThermal ? pageW / 2 : textX, hy, isThermal ? { align: 'center' } : {});
      hy += isThermal ? 6 : 7;

      // Contact line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(isThermal ? 7 : 9);
      doc.setTextColor(100, 116, 139);
      let contactLine = `Ph: ${shop.phone}`;
      if (!isThermal && upiId) contactLine += `   |   UPI: ${upiId}`;
      doc.text(contactLine, isThermal ? pageW / 2 : textX, hy, isThermal ? { align: 'center' } : {});
      hy += 5;
      if (isThermal && upiId) {
        doc.text(`UPI: ${upiId}`, pageW / 2, hy, { align: 'center' });
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
      // A4 (contentW = 180mm usable):
      //   Non-GST bill: #(5) | Item(85) | Qty(15) | Price(30) | Amount(45)
      //   GST bill:     #(5) | Item(60) | Qty(12) | Taxable(20) | GST(53) | Amount(30)
      //     - GST subcol widths: CGST~16, SGST~16 (or IGST~24 for inter-state)
      //     - Right-align every numeric column so long values never collide
      const colNo    = marginL;
      const colItem  = marginL + (isThermal ? 1 : 6);

      // GST bill needs THREE numeric sub-columns before Amount; non-GST only ONE.
      // Positions are LEFT edges except colTotal which is RIGHT edge.
      const colQty   = isThermal ? marginL + Math.round(contentW * 0.55) : (showGstColumns ? marginL + 68  : marginL + 100);
      const colPrice = isThermal ? 0 : (showGstColumns ? marginL + 88  : marginL + 130);
      // GST sub-columns (only used when showGstColumns): each ~15-18mm wide,
      // all right-aligned. Amount stays at the far right, right-aligned.
      const colCgst  = marginL + 108;   // CGST amount right-edge
      const colSgst  = marginL + 128;   // SGST amount right-edge
      const colIgst  = marginL + 128;   // IGST amount right-edge (same slot as SGST)
      const colTotal = isThermal ? (pageW - marginL - 1) : (pageW - marginL - 2);

      // Table Headers
      if (!isThermal) {
        doc.setFillColor(tR, tG, tB);
        doc.rect(marginL, custY, contentW, 8, 'F');
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(isThermal ? 7 : 8);
      doc.setTextColor(isThermal ? 71 : 255, isThermal ? 85 : 255, isThermal ? 105 : 255);
      
      if (isThermal) {
        doc.text("Item", colItem, custY + 5);
        doc.text("Qty", colQty, custY + 5);
        doc.text("Amt", colTotal, custY + 5, { align: 'right' });
      } else if (showGstColumns) {
        doc.text("#", colNo, custY + 5.5);
        doc.text("Item (HSN)", colItem, custY + 5.5);
        doc.text("Qty", colQty, custY + 5.5, { align: 'right' });
        doc.text("Taxable", colPrice, custY + 5.5, { align: 'right' });
        if (isInterState) {
          doc.text("IGST", colIgst, custY + 5.5, { align: 'right' });
        } else {
          doc.text("CGST", colCgst, custY + 5.5, { align: 'right' });
          doc.text("SGST", colSgst, custY + 5.5, { align: 'right' });
        }
        doc.text("Amount", colTotal, custY + 5.5, { align: 'right' });
      } else {
        doc.text("#", colNo, custY + 5.5);
        doc.text("Item Details", colItem, custY + 5.5);
        doc.text("Qty", colQty, custY + 5.5, { align: 'right' });
        doc.text("Unit Price", colPrice, custY + 5.5, { align: 'right' });
        doc.text("Amount", colTotal, custY + 5.5, { align: 'right' });
      }
      doc.setTextColor(71, 85, 105);
      
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
      let rowNum = 0;

      billItems.forEach((item) => {
        rowNum++;
        const qty = item.qty || 1;
        const mrpLineAmt = item.price * qty;
        const iDisc = item.itemDiscount || 0;
        const iDiscAmt = iDisc > 0 ? Math.round(mrpLineAmt * iDisc / 100) : 0;
        const discountedLineAmt = mrpLineAmt - iDiscAmt;
        const unitSuffix = UNIT_SUFFIX[resolveUnit(item, shopCategory)] || '';
        const qtyText = unitSuffix ? `${qty} ${unitSuffix}` : `${qty}`;

        // Alternating row background on A4 (fixed 9mm height matches row step)
        if (!isThermal && rowNum % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(marginL, yOffset - 5, contentW, 9, 'F');
        }

        // Helper: HARD-truncate a string to fit within maxWidthMm at the
        // current font size, appending an ellipsis. jsPDF's maxWidth wraps
        // to multiple lines, which breaks alternating-row shading and
        // causes rows to overlap — we don't want wrapping in an invoice.
        const fitText = (s, maxWidthMm) => {
          if (!s) return '';
          const w = doc.getTextWidth(s);
          if (w <= maxWidthMm) return s;
          let lo = 0, hi = s.length, best = 0;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const candidate = s.slice(0, mid) + '…';
            if (doc.getTextWidth(candidate) <= maxWidthMm) { best = mid; lo = mid + 1; }
            else hi = mid - 1;
          }
          return s.slice(0, best) + '…';
        };
        
        if (showGstColumns) {
          const rate = parseInt(item.gstRate) || 0;
          const taxableVal = discountedLineAmt / (1 + (rate / 100));
          const taxAmt = discountedLineAmt - taxableVal;
          totalTaxable += taxableVal;
          
          let itemBaseName = item.name + (item.selectedVariant ? ` (${item.selectedVariant})` : '');
          if (item.hsnCode) itemBaseName += ` [${item.hsnCode}]`;
          if (iDisc > 0)   itemBaseName += ` -${iDisc}%`;
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(isThermal ? 7 : 8.5);
          doc.setTextColor(51, 65, 85);

          // Item column width in the GST case: from colItem to colQty minus a small gap
          const maxItemW = (colQty - colItem) - 8;   // 8mm gap to Qty column
          const truncatedItem = isThermal ? itemBaseName : fitText(itemBaseName, maxItemW);
          
          if (!isThermal) doc.text(String(rowNum), colNo, yOffset, {});
          doc.text(truncatedItem, colItem, yOffset);
          doc.text(qtyText, colQty, yOffset, { align: 'right' });
          if (!isThermal) {
            doc.text(taxableVal.toFixed(2), colPrice, yOffset, { align: 'right' });
            if (isInterState) {
              totalIgst += taxAmt;
              doc.text(taxAmt.toFixed(2), colIgst, yOffset, { align: 'right' });
            } else {
              const halfTax = taxAmt / 2;
              totalCgst += halfTax;
              totalSgst += halfTax;
              doc.text(halfTax.toFixed(2), colCgst, yOffset, { align: 'right' });
              doc.text(halfTax.toFixed(2), colSgst, yOffset, { align: 'right' });
            }
          }
          doc.setFont("helvetica", "bold");
          doc.text(discountedLineAmt.toFixed(2), colTotal, yOffset, { align: 'right' });
          doc.setFont("helvetica", "normal");
          yOffset += 8;   // matches 9mm row background exactly
        } else {
          const itemFullName = item.name + (item.selectedVariant ? ` (${item.selectedVariant})` : '');
          doc.setFont("helvetica", "normal");
          doc.setFontSize(isThermal ? 7 : 8.5);
          doc.setTextColor(51, 65, 85);

          const maxItemW = (colQty - colItem) - 8;
          const truncatedItem = isThermal ? itemFullName : fitText(itemFullName, maxItemW);

          if (!isThermal) doc.text(String(rowNum), colNo, yOffset, {});
          doc.text(truncatedItem, colItem, yOffset);
          doc.text(qtyText, colQty, yOffset, { align: 'right' });
          if (isThermal) {
            const dispAmt = iDisc > 0 ? `${discountedLineAmt.toFixed(0)}(-${iDisc}%)` : discountedLineAmt.toFixed(0);
            doc.setFont("helvetica", iDisc > 0 ? "bold" : "normal");
            doc.text(dispAmt, colTotal, yOffset, { align: 'right' });
            doc.setFont("helvetica", "normal");
          } else if (iDisc > 0) {
            // MRP struck-through style with discount badge
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(item.price.toFixed(2), colPrice, yOffset, { align: 'right' });
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(22, 163, 74);
            doc.text(discountedLineAmt.toFixed(2), colTotal, yOffset, { align: 'right' });
            doc.setFont("helvetica", "normal");
            doc.setTextColor(51, 65, 85);
          } else {
            doc.text(item.price.toFixed(2), colPrice, yOffset, { align: 'right' });
            doc.setFont("helvetica", "bold");
            doc.text(discountedLineAmt.toFixed(2), colTotal, yOffset, { align: 'right' });
            doc.setFont("helvetica", "normal");
          }
          yOffset += 8;   // matches 9mm row background exactly
          // Per-item saving note (indented, doesn't overlap other columns)
          if (iDisc > 0 && !isThermal) {
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            const note = `MRP ₹${item.price.toFixed(2)} × ${qty} = ₹${mrpLineAmt.toFixed(2)}  →  You save ₹${iDiscAmt.toFixed(2)} (${iDisc}% off)`;
            doc.text(fitText(note, contentW - 10), colItem + 4, yOffset);
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            yOffset += 5;
          }
        }
        yOffset += 1;
      });
      
      // ── Totals separator line ─────────────────────────────────────────────
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(marginL, yOffset - 2, pageW - marginL, yOffset - 2);
      yOffset += 5;

      // Helper: render a totals row (label left, amount right-aligned)
      const totalsLabelX  = isThermal ? marginL : marginL + 95;
      const totalsAmtX    = pageW - marginL - 2;

      const addTotalsRow = (label, value, opts = {}) => {
        doc.setFont("helvetica", opts.bold ? "bold" : "normal");
        doc.setFontSize(opts.large ? 11 : 9);
        doc.setTextColor(...(opts.color || [71, 85, 105]));
        doc.text(label, totalsLabelX, yOffset);
        doc.text(value, totalsAmtX, yOffset, { align: 'right' });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        yOffset += opts.large ? 7 : 5;
      };

      // Totals section
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);

      if (showGstColumns) {
         addTotalsRow(`Total Taxable Value`, `Rs. ${totalTaxable.toFixed(2)}`);
         if (isInterState) {
           addTotalsRow(`Total IGST`, `Rs. ${totalIgst.toFixed(2)}`);
         } else {
           addTotalsRow(`Total CGST`, `Rs. ${totalCgst.toFixed(2)}`);
           addTotalsRow(`Total SGST`, `Rs. ${totalSgst.toFixed(2)}`);
         }
      }

      // Item-level savings row
      if (itemLevelSavings > 0) {
        addTotalsRow(`Subtotal (MRP)`, `Rs. ${billItemsOriginalTotal.toFixed(2)}`);
        addTotalsRow(`Item Discounts`, `-Rs. ${itemLevelSavings.toFixed(2)}`, { color: [22, 163, 74] });
        addTotalsRow(`Subtotal (After item disc.)`, `Rs. ${billTotal.toFixed(2)}`);
      }

      if (discountAmount > 0 || manualDiscountAmt > 0) {
        if (itemLevelSavings === 0) {
          addTotalsRow(`Subtotal`, `Rs. ${billTotal.toFixed(2)}`);
        }
        addTotalsRow(`Bill Discount`, `-Rs. ${(discountAmount + manualDiscountAmt).toFixed(2)}`, { color: [22, 163, 74] });
      }
      
      if (loyaltyDiscountRupees > 0) {
        addTotalsRow(`Loyalty Points Redeemed`, `-Rs. ${loyaltyDiscountRupees.toFixed(2)}`, { color: [139, 92, 246] });
      }

      if (roundOffAmt !== 0) {
        addTotalsRow(`Round Off`, `${roundOffAmt > 0 ? '+' : ''}Rs. ${roundOffAmt.toFixed(2)}`, { color: roundOffAmt > 0 ? [22, 163, 74] : [220, 38, 38] });
      }

      // Grand total box
      yOffset += 2;
      doc.setFillColor(tR, tG, tB);
      doc.roundedRect(isThermal ? marginL : marginL + 93, yOffset - 5, isThermal ? contentW : contentW - 93, 12, 3, 3, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      const gtLabel = isThermal ? 'TOTAL' : 'GRAND TOTAL';
      const gtLabelX = isThermal ? marginL + 2 : marginL + 97;
      doc.text(gtLabel, gtLabelX, yOffset + 3.5);
      doc.text(`Rs. ${total.toFixed(2)}`, totalsAmtX, yOffset + 3.5, { align: 'right' });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      yOffset += 16;

      // Payment method badge
      if (billingMode === 'bill') {
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
      if (exchangePolicy) {
        yOffset += 5;
        doc.setFontSize(isThermal ? 7 : 8);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text("Exchange/Return Policy:", isThermal ? pageW/2 : marginL, yOffset, isThermal ? {align:'center'} : {});
        doc.setFont("helvetica", "normal");
        yOffset += 4;
        doc.text(exchangePolicy, isThermal ? pageW/2 : marginL, yOffset, isThermal ? {align:'center', maxWidth: contentW} : { maxWidth: 180 });
      }
      if (termsConditions) {
        yOffset += 6;
        doc.setFontSize(isThermal ? 7 : 8);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text("Terms & Conditions:", isThermal ? pageW/2 : marginL, yOffset, isThermal ? {align:'center'} : {});
        doc.setFont("helvetica", "normal");
        yOffset += 4;
        doc.text(termsConditions, isThermal ? pageW/2 : marginL, yOffset, isThermal ? {align:'center', maxWidth: contentW} : { maxWidth: 180 });
      }
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

      // Watermark on trial bills — was `!user.subscriptionTier && (...)`,
      // but subscriptionTier is ALWAYS populated at signup (starter,
      // service_starter, or basic_distributor — auth-register sets it
      // unconditionally), so this condition could never actually be
      // true for any real shop. The "Upgrade at mystoreos.in for
      // professional invoices" watermark — clearly meant as a
      // conversion nudge — has never once actually appeared on any
      // trial shop's printed bill. Fixed to check subscription status
      // directly, the same correct pattern already used elsewhere.
      const isTrialBill = user.subscription === 'trial' || user.subscription === 'expired';
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

      const safeName = (shop.name || 'Bill').replace(/[^a-zA-Z0-9]/g, '_');
      const pdfFileName = invoiceNo
        ? `${safeName}_${modeShort}-${invoiceNo}.pdf`
        : `${safeName}_${billingMode === 'estimate' ? 'Estimate' : billingMode === 'challan' ? 'Challan' : 'Invoice'}.pdf`;

      // If copies > 1, duplicate the page
      if (printCopies > 1) {
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

      // ── TEMPLATE ENGINE OVERRIDE ─────────────────────────────────────
      // The jsPDF document above is still built (cheap, and needed as a
      // safe fallback) — but when the shop has picked a non-'classic'
      // invoice template, replace its blob with one rendered by the new
      // HTML template engine before it's shared. Always A4-width for
      // this WhatsApp-share path regardless of the shop's till printer
      // setting, matching the existing rule just above for the classic
      // path (thermal-shaped PDFs look broken on a customer's phone).
      let finalPdfBlob = pdfBlob;
      let finalPdfFile = pdfFile;
      if (printTemplate && printTemplate !== 'classic') {
        try {
          const { buildInvoicePdfBlob } = await import('../lib/invoicePrint');
          const templateBlob = await buildInvoicePdfBlob(printTemplate, {
            shopName: shop.name || 'Shop',
            shopPhone: shop.phone || '',
            shopAddress: businessAddress || shop.address || '',
            shopGSTIN: gstin || '',
            billNo: invoiceNo ? `${modeShort}-${invoiceNo}` : '',
            dateStr: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            modeTitle,
            customerName: customerName || '',
            customerPhone: customerPhone || '',
            customerAddress: customerAddress || '',
            items: billItems.map(i => ({
              code: i.sku || '',
              name: i.name + (i.selectedVariant ? ` (${i.selectedVariant})` : ''),
              hsn: i.hsn || '',
              qty: i.qty || 1,
              rate: i.price,
              gstPct: i.gstPct || 0,
            })),
            subtotal: billTotal,
            discountAmount: discountAmount + manualDiscountAmt,
            roundOff: roundOffAmt,
            total,
            paymentMode: paymentMethod || '',
            footerNote: invoiceFooter || 'Thank you! Visit again.',
            termsNote: termsConditions || '',
          }, 'a4');
          finalPdfBlob = templateBlob;
          finalPdfFile = new File([templateBlob], pdfFileName, { type: 'application/pdf' });
        } catch (e) {
          // Template render failed for any reason — fall back to the
          // jsPDF document already built above rather than losing the
          // share entirely.
          console.error('Template PDF render failed, using classic fallback:', e);
        }
      }

      // ── WhatsApp delivery — heart feature, must work every single time ──
      // Hard, confirmed platform fact: WhatsApp's wa.me deep link can only
      // carry TEXT, never a file attachment. And navigator.share()'s file
      // sheet lets the OWNER pick WhatsApp from a system list, but WhatsApp
      // itself — not this website — controls which contact the file goes
      // to; no web API can pre-select a specific chat inside WhatsApp once
      // a file is involved. These are real, documented platform
      // constraints (confirmed via MDN/W3C Web Share spec), not a gap in
      // this code — there is no version of "auto-open WhatsApp to contact
      // X with file Y already attached" achievable from a website today.
      //
      // Given the actual PDF reaching the customer matters more than
      // auto-targeting, the file-share sheet is now the PRIMARY action —
      // the real receipt document, not just text. The customer's number is
      // copied to the clipboard right before the share sheet opens, so
      // after picking WhatsApp the owner can paste it straight into
      // WhatsApp's own contact search in two taps instead of typing it.
      // The rich-text-direct-to-number message remains available as a
      // one-tap fallback for when the file sheet isn't supported or is
      // cancelled.
      if (hasFeature('whatsappShare')) {
        let msg = `*${shop.name}*\n`;
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
        if (roundOffAmt !== 0) msg += `Round Off: ${roundOffAmt > 0 ? '+' : ''}Rs.${roundOffAmt.toFixed(2)}\n`;
        msg += `*TOTAL: Rs.${total}*\n`;
        const pmLabel = { Cash: '💵 Cash', UPI: '📱 UPI', Card: '💳 Card', Credit: '📒 Credit' };
        msg += `Payment: ${pmLabel[paymentMethod] || '💵 Cash'}\n`;
        const totalSavedWA = itemLevelSavings + discountAmount + manualDiscountAmt + loyaltyDiscountRupees;
        if (totalSavedWA > 0) msg += `🎉 *You saved Rs.${totalSavedWA} on this ${billingMode === 'estimate' ? 'estimate' : billingMode === 'challan' ? 'challan' : 'bill'}!*\n`;
        let upiUri = null;
        if (billingMode === 'bill' && upiId) {
          // eslint-disable-next-line react-hooks/purity -- runs inside executeSendWhatsAppBill, a click handler, never during render
          const ref = invoiceNo ? `Ref-${invoiceNo}` : ('ORD' + Date.now().toString().slice(-8));
          const shopForUpi = { upiId, merchantUpiId: shop.merchantUpiId, merchantCode: shop.merchantCode, name: shop.name };
          upiUri = buildUpiUri(shopForUpi, { amount: total, txnRef: ref, note: invoiceNo ? `Bill ${invoiceNo}` : 'Bill Payment' });
          if (upiUri) {
            // ── Pay Now block ────────────────────────────────────────────
            // Structure survives WhatsApp's link-rendering quirks (some
            // Android versions hide the upi:// preview; some show the naked
            // URI as monospace). Customer always gets: headline, tap link,
            // manual fallback (UPI ID + amount to type).
            const displayUpi = (canTapToPay(shopForUpi) && shop.merchantUpiId) ? shop.merchantUpiId : upiId;

            msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `💰 *PAY ₹${total} NOW*\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            if (canTapToPay(shopForUpi)) {
              // Merchant VPA — amount prefills, customer just approves.
              msg += `👉 *Tap to Pay:*\n${upiUri}\n\n`;
              msg += `_Opens your UPI app (GPay/PhonePe/Paytm).\n₹${total} is pre-filled — just tap Pay._\n\n`;
            } else {
              // Personal VPA — NPCI blocks amount-prefill on tap; customer
              // must enter the amount manually in their UPI app. The
              // attached PDF also carries a UPI QR they can scan.
              msg += `👉 *Tap to Pay:*\n${upiUri}\n\n`;
              msg += `_Opens your UPI app. Enter *₹${total}* when prompted.\nOr scan the UPI QR in the attached bill PDF._\n\n`;
            }

            msg += `Or send to UPI ID: *${displayUpi}*\nAmount: *₹${total}*\n`;
          }
        }

        // Soft, single-line attribution. No signup pressure, no "claim
        // your bills" CTA, no register link. Shopkeepers told us forcing
        // their customers to sign up to MyStore was driving the shopkeepers
        // away — they don't want to feel like they're handing their
        // customer list to a platform. Keep it tiny like an email signature.
        msg += `\n_via MyStore OS · mystoreos.in_\n`;

        const sendDirectText = () => {
          if (customerPhone) {
            // Normalize the phone for wa.me — covers every common way an
            // Indian shopkeeper might type it: with/without +91, with/
            // without spaces, with a leading 0 (domestic trunk prefix), or
            // with 00 (international). Without this, "0 98765 43210" was
            // becoming wa.me/9109876543210 (13 digits) and WhatsApp couldn't
            // open the chat — the "number not auto-selecting" symptom you
            // reported lived partly here.
            let digits = customerPhone.replace(/\D/g, '');
            if (digits.startsWith('0091')) digits = digits.slice(4);     // 00-91-xxx → xxx
            else if (digits.startsWith('91') && digits.length === 12) { /* already +91-format, keep */ }
            else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1); // 0-xxx → xxx
            if (digits.length === 10) digits = '91' + digits;             // bare 10-digit → prepend 91
            window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
            // Brief confirmation that WhatsApp opened…
            toast.success(`📄 WhatsApp opened for ${customerPhone}`, { autoClose: 3000 });
            // …and surface the formal PDF as an unmissable persistent banner
            // pinned to the bottom of the screen. Stays put until the cashier
            // either sends the PDF or explicitly dismisses it. Previously this
            // was an 8-second toast that quietly disappeared and cashiers
            // missed it — especially in busy shop sessions with multiple
            // bills back-to-back.
            const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [finalPdfFile] }));
            if (canShareFile) {
              setPdfShareQueue(prev => [...prev, {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                pdfFile: finalPdfFile,
                customerPhone,
                mode: billingMode,
              }]);
            }
          } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            toast.info('No customer number on this bill — pick a contact in WhatsApp.', { autoClose: 4000 });
          }
        };

        // ─── DELIVERY DECISION ──────────────────────────────────────────
        //
        // The hard platform fact: navigator.share() with a file lets the user
        // pick WhatsApp, but then WhatsApp takes over and shows a contact
        // picker — the customer phone we have CANNOT be passed through file
        // shares. wa.me/{phone}?text= DOES auto-open at that contact, but
        // can only carry text, not files.
        //
        // For shop bills the most-used path by far is "customer phone on the
        // bill → bill in their WhatsApp chat, immediately." The rich text we
        // build above (itemized lines, savings, UPI tap-to-pay link) is the
        // bill content the customer actually reads on their phone. The PDF
        // matters mostly for the shop's own GST/accounting records, which
        // are saved locally either way.
        //
        // So: when a phone is set, wa.me is PRIMARY (auto-targets the
        // customer — the heart feature). When no phone is set, fall through
        // to the file-share sheet so the cashier can manually pick a contact
        // and at least send the PDF.

        if (customerPhone) {
          // Primary path — auto-targets the customer's WhatsApp chat via wa.me.
          // Also share the PDF natively (Capacitor Share on Android, Web Share
          // on browser). On Android, navigator.canShare({files}) returns false
          // for blobs — sharePdfNative uses @capacitor/share plugin instead.
          sendDirectText();
          // Show PDF share after WhatsApp text opens (slight delay so share
          // sheet doesn't fight with the WhatsApp deep link)
          setTimeout(async () => {
            await sharePdfNative(finalPdfBlob, pdfFileName, `Bill from ${shop.name}`);
          }, 800);
        } else {
          // No customer phone — share PDF directly so cashier can pick a contact
          const shared = await sharePdfNative(
            finalPdfBlob,
            pdfFileName,
            billingMode === 'estimate' ? 'Estimate / Quotation'
              : billingMode === 'challan' ? 'Delivery Challan'
              : `Bill from ${shop.name}`
          );
          if (!shared) {
            // User cancelled share sheet or web fallback — send WhatsApp text
            sendDirectText();
          }
        }
      } else {
        // Starter plan: save PDF locally only, no WhatsApp
        await sharePdfNative(finalPdfBlob, pdfFileName, `Bill from ${shop.name}`);
        toast.info('Bill saved as PDF. Upgrade to Pro to share via WhatsApp.');
      }

      // (Specific success/info toasts already shown above based on the
      // actual delivery method used — avoids a misleading generic
      // "sent successfully" when, for example, no customer number was on
      // the bill and WhatsApp couldn't be pre-filled.)
      // Auto-send via WhatsApp Cloud API if configured (silent — no browser tab opened)
      if (billingMode === 'bill' && customerPhone && hasWhatsAppAPI()) {
        sendBillNotification(customerPhone, customerName || 'Customer', total, shop.name, invoiceNo);
      }
      setBillItems([]);
      setDiscountAmount(0);
      setManualDiscountPct(0);
      setLoyaltyRedeem(0);
      setRoundOff(0);
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
    try {
      await mustSucceed(() => api.acceptOrder(orderId), 'Accept order');
    } catch (e) {
      toast.error(e.message || 'Failed to accept order');
      return;
    }
    toast.success("✅ Order Accepted!");
    
    // Notify customer via WhatsApp
    if (o) {
      const decoded = decodeOrderUserId(o.userId);
      const customerPhone = decoded.phone;
      const shopName = shop.name;
      const total = o.total;
      if (customerPhone) {
        const msg = `✅ *Order Accepted — ${shopName}*\n\nHi ${decoded.name || 'Customer'}! Your order of *₹${total}* has been accepted.\n\nPlease complete payment to confirm.\n\n_Powered by MyStore OS_`;
        // Open WhatsApp to customer's number with acceptance message
        const cleanPhone = customerPhone.replace(/\D/g,'');
        const withCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
        window.open(`https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`, '_blank');
      }
    }
    
    loadData();
  };

  const verifyOrderPayment = async (orderId) => {
    const o = orders.find(ord => ord.id === orderId);
    try {
      await mustSucceed(() => api.verifyOrderPayment(orderId, `Payment verified by ${user.name}. Thank you for your order!`), 'Verify payment');
    } catch (e) {
      toast.error(e.message || 'Failed to verify payment');
      return;
    }
    toast.success("💰 Payment verified!");
    
    // Notify customer via WhatsApp
    if (o) {
      const decoded = decodeOrderUserId(o.userId);
      const customerPhone = decoded.phone;
      if (customerPhone) {
        const msg = `💰 *Payment Confirmed — ${shop.name}*\n\nHi ${decoded.name || 'Customer'}! Your payment of *₹${o.total}* has been verified.\n\n✅ Order is complete. Thank you for shopping!\n\n_via MyStore OS · mystoreos.in_`;
        const cleanPhone = customerPhone.replace(/\D/g,'');
        const withCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
        window.open(`https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`, '_blank');
      }
    }
    
    loadData();
  };

  // ── Cancel Order — only for Pending orders (nothing accepted/paid yet) ──
  // Once an order is Accepted or Completed, use the Return flow instead —
  // that's the one that restocks items and tracks a refund.
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const openCancelModal = (order) => {
    setCancelTargetOrder(order);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmCancelOrder = async () => {
    if (!cancelTargetOrder) return;
    const o = cancelTargetOrder;
    try {
      await mustSucceed(() => api.cancelOrder(o.id, cancelReason.trim()), 'Cancel order');
      toast.success("Order cancelled.");

      // Notify customer via WhatsApp
      const decoded = decodeOrderUserId(o.userId);
      if (decoded.phone) {
        const reasonLine = cancelReason.trim() ? `\nReason: ${cancelReason.trim()}` : '';
        const msg = `❌ *Order Cancelled — ${shop.name}*\n\nHi ${decoded.name || 'Customer'}, your order of *₹${o.total}* has been cancelled.${reasonLine}\n\nNo payment was taken for this order. Sorry for the inconvenience!\n\n_Powered by MyStore OS_`;
        const cleanPhone = decoded.phone.replace(/\D/g, '');
        const withCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
        window.open(`https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`, '_blank');
      }

      setShowCancelModal(false);
      setCancelTargetOrder(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel order");
    }
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

  // Stable UPI transaction reference for the in-app QR modal — computed
  // once via lazy useState init (not on every render, or the QR image
  // would re-encode constantly and ESLint react-hooks/purity flags
  // Date.now() called in render).
  const [upiTxnRef] = useState(() => 'BILL' + Date.now().toString().slice(-8));

  // Extracted from filteredProducts below so voice-add-to-bill can call
  // it directly and get a synchronous decision — going through
  // setSearch() + waiting for filteredProducts to recompute on the next
  // render would mean the voice handler can't know the result until
  // after it's already returned. Same exact scoring, single source of
  // truth — filteredProducts now just calls this.
  const scoreProductMatches = useCallback((query) => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return products;
    const terms = q.split(/\s+/);
    return products
      .map(p => {
        const name   = (p.name    || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        const cat    = (p.category|| '').toLowerCase();
        const sku    = (p.sku     || '').toLowerCase();
        let score = 0;
        if (name.startsWith(q))      score += 100;
        else if (barcode === q || sku === q) score += 90;
        else if (sku && sku.includes(q)) score += 70;
        else if (name.includes(q))   score += 60;
        const allMatch = terms.every(t => name.includes(t) || barcode.includes(t) || sku.includes(t));
        const anyMatch = terms.some( t => name.includes(t) || barcode.includes(t) || sku.includes(t) || cat.includes(t));
        if (allMatch && score === 0)  score += 40;
        else if (anyMatch && score === 0) score += 10;
        return { ...p, _score: score };
      })
      .filter(p => p._score > 0)
      .sort((a, b) => b._score - a._score);
  }, [products]);

  const filteredProducts = useMemo(() => scoreProductMatches(search), [scoreProductMatches, search]);

  // ── VOICE-TO-BILL ──────────────────────────────────────────────────
  // The shopkeeper's own version of the customer-facing voice search
  // already working elsewhere in the app (UserDashboard) — same Web
  // Speech API, same browser-support/permission handling, same 8s
  // safety timeout. Different job: instead of searching a storefront,
  // this parses a spoken quantity + product name and adds it straight
  // to the current bill, e.g. "two parle g" or "add 3 amul milk".
  //
  // Placed here (not near addToBill above) specifically because it
  // needs scoreProductMatches, which — per the comment on filteredProducts
  // — was deliberately kept this far down the file after an earlier TDZ
  // crash from a similar dependency being hoisted too early. Same
  // caution applies here: don't move this above scoreProductMatches.
  const [isListeningPOS, setIsListeningPOS] = useState(false);

  // "two", "three", "2", "couple of" -> a number. Kept small and
  // India-English-shaped (packets/pieces/units are common filler words
  // a shopkeeper would actually say) rather than a generic NLP library.
  const parseSpokenQuantity = (text) => {
    const WORDS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, a:1, an:1, couple:2, dozen:12 };
    const words = text.trim().toLowerCase().split(/\s+/);
    if (words.length === 0) return { qty: 1, rest: text };
    const first = words[0].replace(/[^a-z0-9]/g, '');
    if (/^\d+$/.test(first)) {
      const n = parseInt(first, 10);
      if (n > 0 && n <= 99) return { qty: n, rest: words.slice(1).join(' ') };
    }
    if (WORDS[first]) return { qty: WORDS[first], rest: words.slice(1).join(' ') };
    return { qty: 1, rest: text };
  };

  const handleVoiceAddToBill = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('🎤 Voice billing needs Chrome or Safari. Try typing instead.');
      return;
    }
    if (isListeningPOS) { setIsListeningPOS(false); return; }

    let rec;
    try { rec = new SpeechRecognition(); }
    catch { toast.error('Could not start voice recognition. Check microphone permission.'); return; }

    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.continuous = false;

    setIsListeningPOS(true);
    toast.info('🎤 Listening… say a quantity and product, e.g. "two parle g"', { autoClose: 3000, toastId: 'voice-pos' });

    const safetyTimer = setTimeout(() => {
      try { rec.stop(); } catch { /* already stopped */ }
      setIsListeningPOS(false);
    }, 8000);

    rec.onresult = (event) => {
      clearTimeout(safetyTimer);
      setIsListeningPOS(false);
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (!transcript.trim()) { toast.error('Didn\u2019t catch that — try again.'); return; }

      // Strip common lead-in filler ("add", "please add") before
      // parsing the quantity, so "add two parle g" and "two parle g"
      // both parse the same way.
      const cleaned = transcript.replace(/^(add|please add|billing|bill)\s+/i, '');
      const { qty, rest } = parseSpokenQuantity(cleaned);
      // Also strip trailing unit filler words a shopkeeper might say
      // naturally ("two packets parle g", "three pieces of soap").
      const productGuess = rest.replace(/^(packets?|pieces?|pcs|units?|bottles?|bags?)\s+(of\s+)?/i, '').trim();
      if (!productGuess) { toast.error(`Heard "${transcript}" — couldn't tell what product. Try again.`); return; }

      const matches = scoreProductMatches(productGuess);
      const top = matches[0];
      // Threshold of 40 matches the same bar filteredProducts already
      // uses for "all search terms matched" — below that, the guess is
      // too weak to add silently; better to ask the shopkeeper to
      // confirm by typing instead of risking the wrong item on a bill.
      if (!top || top._score < 40) {
        toast.error(`No confident match for "${productGuess}" — try typing it instead.`);
        return;
      }

      for (let i = 0; i < qty; i++) addToBill(top);
      toast.success(`🎤 Added ${qty}× ${top.name}`, { autoClose: 2000 });
    };

    rec.onerror = () => {
      clearTimeout(safetyTimer);
      setIsListeningPOS(false);
      toast.error('Voice recognition error — check microphone permission.');
    };
    rec.onend = () => {
      clearTimeout(safetyTimer);
      setIsListeningPOS(false);
    };

    try { rec.start(); } catch {
      clearTimeout(safetyTimer);
      setIsListeningPOS(false);
      toast.error('Could not start listening.');
    }
  };


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
    // Compare LOCAL calendar days on both sides — was comparing a UTC date
    // string (todayStr) against raw UTC created_at timestamps via
    // .startsWith(), which silently misattributed roughly 5.5 hours of
    // every night's real sales to "yesterday" for any shop in India
    // (UTC+5:30): a sale at 1:00 AM IST is still "yesterday" in UTC until
    // 5:30 AM IST. isToday() now converts each timestamp to the browser's
    // actual local calendar day before comparing, so "today" means the
    // shop owner's today, not UTC's today.
    const todayStr = localDateStr();
    const isToday = (isoString) => isoString && localDateStr(new Date(isoString)) === todayStr;

    // Which orders feed this report — branch-scoped or all-branches-
    // combined depending on the toggle at the top of the Reports tab.
    // In 'all' mode, credits/stockOrders are NOT combined across
    // branches (those are tracked per-branch); only the top-line sales
    // metrics + a per-branch revenue breakdown are cross-branch.
    const isAllScope = reportsScope === 'all';
    const sourceOrders = isAllScope ? allBranchOrders : orders;

    // Cash In: accepted sales orders today + customer credits settled today
    // Net of any partial refunds (o.total - o.refundAmount) so a return
    // doesn't leave inflated revenue/profit numbers behind.
    const todaySalesOrders = sourceOrders.filter(o => 
      o.status === 'Accepted' && 
      !(o.userId || '').startsWith('estimate') && 
      !(o.userId || '').startsWith('challan') &&
      isToday(o.date)
    );
    const netOrderTotal = (o) => Number(o.total || 0) - Number(o.refundAmount || 0);
    const todaySalesTotal = todaySalesOrders.reduce((sum, o) => sum + netOrderTotal(o), 0);
    
    const todayCustSettled = isAllScope ? [] : customerCredits.filter(c => 
      c.paid && 
      isToday(c.date)
    );
    const todayCustSettledTotal = todayCustSettled.reduce((sum, c) => sum + c.amount, 0);
    
    const cashIn = todaySalesTotal + todayCustSettledTotal;
    
    // Cash Out: accepted restock orders today + distributor credits settled today
    const todayStockOrders = isAllScope ? [] : stockOrders.filter(so => 
      so.status === 'accepted' && 
      isToday(so.date)
    );
    const todayStockTotal = todayStockOrders.reduce((sum, so) => sum + so.total, 0);
    
    const todayDistSettled = isAllScope ? [] : credits.filter(c => 
      c.paid && 
      isToday(c.date)
    );
    const todayDistSettledTotal = todayDistSettled.reduce((sum, c) => sum + c.amount, 0);
    
    const cashOut = todayStockTotal + todayDistSettledTotal;
    
    // True profit = revenue minus cost of goods sold (COGS).
    // cashIn/cashOut still drive the ledger view, but "Profit Today" must
    // compare what we earned today vs what those exact items cost us.
    // Revenue/COGS both already use the post-refund net total above.
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
        desc: o.refundAmount > 0 ? `Sale: ${name} (net of ₹${Number(o.refundAmount).toFixed(2)} return)` : `Sale: ${name}`,
        amount: netOrderTotal(o),
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

    // Per-branch breakdown — only meaningful when the owner has 2+
    // branches AND we're looking at combined data. Each entry shows
    // how much that branch contributed today + total revenue & bills
    // for the current month so the owner can spot which location is
    // pulling its weight at a glance.
    let branchBreakdown = [];
    if (isAllScope && branches.length >= 2) {
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const isThisMonth = (iso) => iso && new Date(iso) >= monthStart;
      branchBreakdown = branches.map(b => {
        const branchOrders = sourceOrders.filter(o =>
          o.shopId === b.id &&
          o.status === 'Accepted' &&
          !(o.userId || '').startsWith('estimate') &&
          !(o.userId || '').startsWith('challan')
        );
        const todayList = branchOrders.filter(o => isToday(o.date));
        const monthList = branchOrders.filter(o => isThisMonth(o.date));
        return {
          branchId: b.id,
          branchName: b.name,
          isMain: !b.parentShopId,
          todayBills: todayList.length,
          todayRevenue: todayList.reduce((s, o) => s + netOrderTotal(o), 0),
          monthBills: monthList.length,
          monthRevenue: monthList.reduce((s, o) => s + netOrderTotal(o), 0),
        };
      }).sort((a, b) => b.monthRevenue - a.monthRevenue);   // best performer first
    }

    return { cashIn, cashOut, netProfit, marginPercent, ledgerItems, branchBreakdown, isAllScope };
  };

  const handleImportFromMain = async (options = { copyStock: false }) => {
    // Bulk-copy the main shop's products into the currently-viewed branch.
    // Source = the branch's parent_shop_id (we're standing on the branch).
    // Target = targetShopId. Existing-products dedupe by barcode + name
    // is handled in the API — running this twice after adding new items
    // to main only imports the new ones.
    const currentBranch = visibleBranches.find(b => b.id === targetShopId);
    const sourceShopId = currentBranch?.parentShopId;
    if (!sourceShopId) {
      toast.error('You can only import into a branch — there is no main shop to copy from.');
      return null;
    }
    try {
      const result = await api.importProductsFromShop(sourceShopId, targetShopId, options);
      if (result.imported === 0 && result.skipped === 0) {
        toast.info('Main shop has no products to import yet.');
      } else if (result.imported === 0) {
        toast.info(`No new products to import — all ${result.skipped} already exist in this branch.`);
      } else {
        toast.success(`Imported ${result.imported} product${result.imported === 1 ? '' : 's'} from main${result.skipped ? ` (${result.skipped} skipped, already in branch)` : ''}.`);
      }
      // Refresh the products list so the imports show up immediately.
      setProducts((await safe(() => api.getShopProducts(targetShopId))) || []);
      return result;
    } catch (err) {
      toast.error(err?.message || 'Could not import products');
      return null;
    }
  };

  // Copy a single product from the current (main) shop into a chosen branch.
  // Called from DesktopInventory's per-product "Copy to branch" button.
  // Shows a branch-picker if owner has more than one branch to choose from.
  const [copyToBranchModal, setCopyToBranchModal] = useState(null); // { productId, productName }
  const [copyToBranchTarget, setCopyToBranchTarget] = useState('');
  const [copyToBranchLoading, setCopyToBranchLoading] = useState(false);

  const handleCopyProductToBranch = (product) => {
    const otherBranches = visibleBranches.filter(b => b.id !== targetShopId);
    if (otherBranches.length === 0) {
      toast.error('No other branches to copy to. Add a branch first in Settings.');
      return;
    }
    // Auto-select if only one branch exists
    setCopyToBranchTarget(otherBranches.length === 1 ? otherBranches[0].id : '');
    setCopyToBranchModal({ productId: product.id, productName: product.name });
  };

  const executeCopyToBranch = async () => {
    if (!copyToBranchModal || !copyToBranchTarget) return;
    setCopyToBranchLoading(true);
    // Resolve to the root owner: if user is logged in as a branch,
    // use parentShopId; otherwise use user.id (main shop).
    const rootOwnerId = user.parentShopId || user.id;
    try {
      const result = await api.copySingleProductToBranch(
        copyToBranchModal.productId,
        copyToBranchTarget,
        rootOwnerId
      );
      const branchName = visibleBranches.find(b => b.id === copyToBranchTarget)?.name || 'branch';
      if (result.skipped) {
        toast.info(`"${copyToBranchModal.productName}" already exists in ${branchName}.`);
      } else {
        toast.success(`"${copyToBranchModal.productName}" copied to ${branchName} (stock set to 0).`);
      }
      setCopyToBranchModal(null);
    } catch (err) {
      toast.error(err?.message || 'Copy failed');
    } finally {
      setCopyToBranchLoading(false);
    }
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
        id: prod?.id || prodId,
        name: prod?.name || 'Wholesale Product',
        price: prod?.price || 0,
        qty,
        unit: prod?.unit || null,
      };
    });

    if (items.length === 0) return toast.error("Restock basket is empty");

    const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const firstProd = wholesaleCatalog.find(p => p.id === cartEntries[0]?.[0]);
    const distributorId = firstProd?.distributor_id || firstProd?.distributorId || firstProd?.distId || null;

    try {
      await mustSucceed(() => api.placeStockOrder(targetShopId, shop.name || 'Retail Shop', items, total, distributorId, restockNotes), 'Submit restock order');
      toast.success("Restock order submitted to distributor!");
      setRestockCart({});
      setRestockNotes('');
      loadData();
    } catch (e) {
      toast.error(e?.message || "Failed to place restock order");
    }
  };

  // The closing confirmation on the shop's side of the stock-order
  // loop — confirms goods actually arrived, notifies the distributor.
  const handleMarkStockOrderDelivered = async (orderId) => {
    try {
      await mustSucceed(() => api.markStockOrderDelivered(orderId), 'Confirm delivery');
      toast.success('Delivery confirmed!');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Failed to confirm delivery');
    }
  };

  // Adds the delivered goods into this shop's own inventory. Matches
  // the shop's existing products by name and only creates what's
  // genuinely new, so a repeat order tops up the same product rather
  // than creating a duplicate.
  const handleReceiveStockOrder = async (orderId) => {
    try {
      const r = await mustSucceed(() => api.receiveStockOrder(orderId, targetShopId), 'Add to stock');
      const parts = [];
      if (r?.updated) parts.push(`${r.updated} product${r.updated === 1 ? '' : 's'} topped up`);
      if (r?.created) parts.push(`${r.created} new product${r.created === 1 ? '' : 's'} added`);
      toast.success(parts.length ? parts.join(' · ') : 'Stock added to inventory');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Could not add to stock');
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
      await mustSucceed(() => api.placeStockOrder(targetShopId, shop.name, items, total, wholesaleProd.distributorId || null), '1-Click Restock');
      toast.success(`⚡ 1-Click Restock: Sent bulk order of "${wholesaleProd.name}" to Distributor!`);
      loadData();
    } catch {
      toast.error("Failed to place 1-click restock order");
    }
  };

  const handleShopVoiceRestockOrder = (text) => {
    if (!text || !wholesaleCatalog || wholesaleCatalog.length === 0) {
      return toast.warning('Wholesale catalog is empty or offline');
    }
    const lower = text.toLowerCase();
    
    const numMatch = lower.match(/\d+/);
    let qty = numMatch ? parseInt(numMatch[0]) : 1;
    const isBox = lower.includes('box') || lower.includes('case') || lower.includes('pack');

    const match = wholesaleCatalog.find(p => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower));

    if (match) {
      const packSize = match.packSize || 1;
      const finalQty = isBox ? (qty * packSize) : qty;
      
      setRestockCart(prev => ({
        ...prev,
        [match.id]: (prev[match.id] || 0) + finalQty
      }));
      toast.success(`🎤 Voice Added: ${match.name} (${finalQty} units) to Restock Basket!`);
    } else {
      const words = lower.split(' ').filter(w => w.length > 2);
      let partialMatch = null;
      for (const w of words) {
        partialMatch = wholesaleCatalog.find(p => p.name.toLowerCase().includes(w));
        if (partialMatch) break;
      }
      if (partialMatch) {
        const packSize = partialMatch.packSize || 1;
        const finalQty = isBox ? (qty * packSize) : qty;
        setRestockCart(prev => ({
          ...prev,
          [partialMatch.id]: (prev[partialMatch.id] || 0) + finalQty
        }));
        toast.success(`🎤 Voice Added: ${partialMatch.name} (${finalQty} units) to Restock Basket!`);
      } else {
        toast.warning(`Could not find "${text}" in wholesale catalog`);
      }
    }
  };

  const handleSaveProduct = async () => {
    if (!newProdName || !newProdPrice) return toast.error("Name and price required");
    if (capabilities.maxProducts !== -1 && products.length >= capabilities.maxProducts) {
      return toast.error(`Starter plan limit: ${capabilities.maxProducts} products. Upgrade to Pro for unlimited.`);
    }
    try {
      await mustSucceed(() => api.addProduct(
        targetShopId,
        newProdName,
        newProdPrice,
        scannedBarcode,
        parseInt(newProdStock) || 0,
        newProdBatch,
        newProdExpiry,
        newProdVariants,
        parseInt(newProdReorder) || 10,
        { hsnCode: newProdHsnCode, gstRate: newProdGstRate, costPrice: parseFloat(newProdCostPrice) || 0, image: newProdImages[0] || newProdImage, images: newProdImages, unit: newProdUnit || shopDefaultUnit, isFeatured: newProdFeatured, discountPct: parseInt(newProdDiscountPct) || 0,
          category: newProdCategory.trim() || null,
          sku: newProdSku.trim() || null,
          variantPrices: newProdVariantPrices.filter(v => v.name.trim() && v.price !== '').map(v => ({ name: v.name.trim(), price: parseFloat(v.price) || 0 })).length
            ? newProdVariantPrices.filter(v => v.name.trim() && v.price !== '').map(v => ({ name: v.name.trim(), price: parseFloat(v.price) || 0 }))
            : null }
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
      setNewProdVariantPrices([]);
      setNewProdHsnCode('');
      setNewProdGstRate('0');
      setNewProdCostPrice('0');
      setNewProdImage('');
      setNewProdImages([]);
      setNewProdFeatured(false);
      setNewProdUnit('');
      setNewProdDiscountPct('0');
      setNewProdCategory('');
      setNewProdSku('');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to add product");
    }
  };

  const handleSettleCustomerCredit = async (creditId) => {
    if (window.confirm("Mark this customer debt as fully settled?")) {
      try {
        await mustSucceed(() => api.markCreditPaid(creditId), 'Mark debt settled');
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
          }, { ...user, printShowLogo, exchangePolicy, termsConditions }, true);
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
    setReturnRefundMode('cash');
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
      // Use the real api call (not safe()) so a genuine failure — e.g. an
      // RLS policy blocking the stock-restore UPDATE for a staff/branch
      // login — surfaces as an error toast instead of silently showing
      // "Return processed!" while stock was never actually restored.
      const result = await api.processReturn(returnOrder.id, itemsToReturn, returnRefundMode);
      const isFullReturn = result?.isFullReturn !== false;
      toast.success(isFullReturn ? "Return processed — bill fully returned!" : `Partial return processed — ₹${refundAmount} refunded`);

      const returnedAtNow = new Date().toISOString();
      const doc = await generateCreditNotePDF(
        returnOrder,
        itemsToReturn,
        { ...user, printShowLogo, exchangePolicy, termsConditions },
        refundAmount,
        { refundMode: returnRefundMode, isFullReturn, returnedAt: returnedAtNow }
      );
      doc.save(`Credit_Note_${returnOrder.id}.pdf`);

      // Notify customer via WhatsApp — same pattern as Accept/Verify Payment
      const decoded = decodeOrderUserId(returnOrder.userId);
      if (decoded.phone) {
        const refundModeLabel = { cash: '💵 Cash', upi: '📱 UPI', card: '💳 Card', store_credit: '🎟️ Store Credit' }[returnRefundMode] || returnRefundMode;
        const itemLines = itemsToReturn.map(i => `• ${i.name} x${i.returnQty} — ₹${(i.price * i.returnQty).toFixed(2)}`).join('\n');
        const msg = `↩️ *Return Processed — ${shop.name}*\n\nHi ${decoded.name || 'Customer'}, your return has been processed:\n\n${itemLines}\n\n💰 *Refund Amount: ₹${refundAmount.toFixed(2)}*\nRefund Mode: ${refundModeLabel}\n\n${isFullReturn ? 'This bill has been fully returned.' : 'This was a partial return — your bill remains valid for the rest of the items.'}\n\n_Powered by MyStore OS_`;
        const cleanPhone = decoded.phone.replace(/\D/g, '');
        const withCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
        window.open(`https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`, '_blank');
      }

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
        await mustSucceed(() => api.markCreditPaid(creditId), 'Mark payment settled');
        toast.success("Payment marked as settled!");
        
        const creditData = credits.find(c => c.id === creditId);
        if (creditData) {
          const doc = await generateVoucherPDF({
            id: creditId,
            partyName: creditData.distName || 'Distributor',
            partyPhone: '',
            partyDesc: 'Invoice Settlement',
            amount: creditData.amount
          }, { ...user, printShowLogo, exchangePolicy, termsConditions }, false);
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
    // Was only checking the field was non-empty — a typo'd or malformed
    // number (e.g. "123" or letters) would silently create a staff
    // account with a broken login credential. Every other registration
    // path in the app (Register.jsx, guest checkout) already enforces
    // this same 10-digit format; staff add was the one gap.
    const cleanStaffPhone = newStaffPhone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(cleanStaffPhone)) return toast.error("Enter a valid 10-digit mobile number for staff login");
    const pin = newStaffPin.trim();
    if (!pin || !/^\d{4}$/.test(pin)) return toast.error("Set a 4-digit PIN for this staff member");
    try {
      await mustSucceed(() => api.addStaff(targetShopId, cleanStaffPhone, pin, newStaffName), 'Add staff member');
      toast.success(`✅ ${newStaffName} added! Their login PIN is ${pin}`);
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffPin('');
      setShowStaffModal(false);
      // Refresh staff list directly — faster and avoids full loadData stale closure issue
      const updatedStaff = await safe(() => api.getShopStaff(targetShopId));
      if (updatedStaff) setStaffList(updatedStaff);
    } catch(err) {
      toast.error(err.message);
    }
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (!window.confirm(`Remove ${staffName} from staff? They will no longer be able to log in.`)) return;
    try {
      await api.deleteStaff(staffId);
      toast.success(`${staffName} removed from staff`);
      const updatedStaff = await safe(() => api.getShopStaff(targetShopId));
      if (updatedStaff) setStaffList(updatedStaff);
    } catch(err) {
      toast.error(err.message || 'Failed to remove staff');
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
    // Real QR pulled from a dedicated, always-mounted canvas ref (see
    // posterQrRef above) instead of scraping a DOM element that may not
    // exist on the current screen — the actual root cause of the blank
    // QR box in the previously downloaded poster.
    const qrCanvas = posterQrRef.current;
    if (!qrCanvas) {
      toast.error('QR code not ready yet — please try again in a moment.');
      return;
    }
    const qrDataUrl = qrCanvas.toDataURL('image/png');

    const { jsPDF: JsPDF } = await import('jspdf');
    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const W = 210, H = 297;
    const accent = [79, 70, 229];   // indigo — primary brand colour
    const accentDeep = [67, 56, 202];
    const sub = [100, 116, 139];
    const faint = [148, 163, 184];

    // Emoji glyphs (📞, 🖨️, etc.) are NOT supported by jsPDF's built-in
    // Helvetica font — they render as garbled multi-byte bytes (the
    // "Ø=ÜÞ" seen in the reported PDF). Using plain Unicode-safe symbols
    // and text labels instead, everywhere on this poster.

    // ── Background ───────────────────────────────────────────────────
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');

    // ── Corporate header band — deep gradient-style block, PhonePe/GPay
    //    merchant-card style ──────────────────────────────────────────
    doc.setFillColor(...accent);
    doc.rect(0, 0, W, 38, 'F');
    doc.setFillColor(...accentDeep);
    doc.rect(0, 34, W, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('DIGITAL STOREFRONT', W / 2, 12, { align: 'center' });

    doc.setFontSize(22);
    doc.text((shop.name || 'Your Store').toUpperCase(), W / 2, 24, { align: 'center', maxWidth: W - 30 });

    // ── White card body with soft shadow effect (concentric rounded
    //    rects at decreasing opacity) ─────────────────────────────────
    let y = 52;

    const hasLogo = shop.logo && shop.logo.startsWith('data:image');
    if (hasLogo) {
      try {
        // Circular-look logo frame
        doc.setDrawColor(...accent);
        doc.setLineWidth(0.8);
        doc.roundedRect(W / 2 - 19, y - 2, 38, 38, 6, 6, 'S');
        doc.addImage(shop.logo, 'JPEG', W / 2 - 17, y, 34, 34, undefined, 'FAST');
        y += 46;
      } catch { y += 6; }
    } else {
      y += 4;
    }

    // Contact line — plain text label instead of an emoji icon
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...sub);
    const contactBits = [shop.phone ? `Tel: ${shop.phone}` : null, shop.businessAddress || null].filter(Boolean);
    if (contactBits.length) {
      doc.text(contactBits.join('   |   '), W / 2, y, { align: 'center', maxWidth: W - 36 });
      y += 12;
    } else {
      y += 6;
    }

    // ── "Scan to Pay" call-to-action pill ──────────────────────────────
    doc.setFillColor(...accent);
    doc.roundedRect(W / 2 - 48, y, 96, 12, 6, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('SCAN TO SHOP & PAY', W / 2, y + 8, { align: 'center' });
    y += 22;

    // ── QR code — clean white card with corner-marker accents, like a
    //    real merchant payment QR (PhonePe/GPay style) ─────────────────
    const qrSize = 92;
    const qrX = W / 2 - qrSize / 2;
    const cardPad = 8;

    // Outer card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.roundedRect(qrX - cardPad, y - cardPad, qrSize + cardPad * 2, qrSize + cardPad * 2, 6, 6, 'FD');

    // Corner accent marks — the small bracket flourish merchant QR
    // cards use, in the brand accent colour
    doc.setDrawColor(...accent);
    doc.setLineWidth(1.4);
    const cl = 7; // corner mark length
    const cx0 = qrX - cardPad + 3, cy0 = y - cardPad + 3;
    const cx1 = qrX + qrSize + cardPad - 3, cy1 = y + qrSize + cardPad - 3;
    // top-left
    doc.line(cx0, cy0, cx0 + cl, cy0); doc.line(cx0, cy0, cx0, cy0 + cl);
    // top-right
    doc.line(cx1, cy0, cx1 - cl, cy0); doc.line(cx1, cy0, cx1, cy0 + cl);
    // bottom-left
    doc.line(cx0, cy1, cx0 + cl, cy1); doc.line(cx0, cy1, cx0, cy1 - cl);
    // bottom-right
    doc.line(cx1, cy1, cx1 - cl, cy1); doc.line(cx1, cy1, cx1, cy1 - cl);

    doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
    y += qrSize + cardPad + 12;

    // Storefront link
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...accent);
    doc.text(getShopUrl().replace(/^https?:\/\//, ''), W / 2, y, { align: 'center', maxWidth: W - 40 });
    y += 13;

    // ── Accepted payment apps row — clean text badges instead of emoji
    //    icons that don't render in jsPDF's font ──────────────────────
    const apps = ['GPay', 'PhonePe', 'Paytm', 'Any UPI App'];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const badgeGap = 4;
    const badgeH = 8;
    const widths = apps.map(a => doc.getTextWidth(a) + 10);
    const totalW = widths.reduce((s, w) => s + w, 0) + badgeGap * (apps.length - 1);
    let bx = W / 2 - totalW / 2;
    apps.forEach((a, i) => {
      doc.setFillColor(244, 244, 253);
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, y, widths[i], badgeH, 4, 4, 'FD');
      doc.setTextColor(...accentDeep);
      doc.text(a, bx + widths[i] / 2, y + 5.5, { align: 'center' });
      bx += widths[i] + badgeGap;
    });
    y += badgeH + 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...faint);
    doc.text('Browse the menu, place your order, and pay — all from your phone.', W / 2, y, { align: 'center', maxWidth: W - 50 });

    // ── Footer brand strip ─────────────────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.rect(0, H - 24, W, 24, 'F');
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    doc.line(0, H - 24, W, H - 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...accent);
    doc.text('MyStore OS', W / 2, H - 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...faint);
    doc.text('Paperless billing for Indian shops   |   mystoreos.in', W / 2, H - 10, { align: 'center' });

    doc.save(`${(shop.name || 'Shop').replace(/[^a-zA-Z0-9]/g, '_')}_QR_Poster.pdf`);
    toast.success('Premium QR poster downloaded!');
  };

  const downloadQrPng = () => {
    // Same fix as downloadQrPoster — was scraping .qr-code-holder svg,
    // an element that only exists on the mobile Settings screen, so this
    // silently failed (or downloaded a blank/stale image) from any other
    // screen. posterQrRef is always mounted in this component.
    const qrCanvas = posterQrRef.current;
    if (!qrCanvas) return toast.error('QR code not ready yet — please try again in a moment.');
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(qrCanvas, 0, 0, size, size);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${shop.name}_QR.png`;
    a.click();
    toast.success('QR downloaded as PNG');
  };

  const handleSaveProfile = async () => {
    await mustSucceed(() => api.updateProfile(user.id, {
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
      await mustSucceed(() => api.updateProfile(user.id, updates), 'Update account details');
      // Refresh session
      const refreshed = { ...user, ...updates };
      try { localStorage.setItem('mystore_session', JSON.stringify(refreshed)); } catch { /* localStorage unavailable — non-critical */ }
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
    await mustSucceed(() => api.updateProfile(user.id, { openingHour, closingHour, weeklyHolidays }), 'Save shop hours');
    toast.success('Shop hours saved!');
  };

  const handleSaveShopBanner = async () => {
    await mustSucceed(() => api.updateProfile(user.id, { shopBanner }), 'Save banner');
    toast.success(shopBanner?.active ? '🏷️ Banner is live!' : 'Banner saved (inactive)');
  };

  // Load the shop's currently-assigned CA on mount
  useEffect(() => {
    if (!user?.id) return;
    api.getMyCA(user.id).then(ca => setMyCA(ca)).catch(() => {});
    // Was user.id — for a staff session that's their own account, never
    // the shop's, so linked distributors would always show empty. Same
    // fix already applied everywhere else this session.
    api.getLinkedDistributors(targetShopId).then(d => setMyDistributors(d || [])).catch(() => {});
  }, [user?.id, targetShopId]);

  const handleLinkDistributor = async () => {
    setDistLinkBusy(true);
    try {
      const res = await api.linkByPublicCode(targetShopId, 'shop', distCodeInput);
      setDistCodeInput('');
      setMyDistributors(await api.getLinkedDistributors(targetShopId));
      toast.success(`Linked with distributor ${res.name}`);
    } catch (ex) {
      toast.error(ex.message || 'Could not link.');
    } finally {
      setDistLinkBusy(false);
    }
  };

  const handleUnlinkDistributor = async (distId) => {
    try {
      await api.unlinkShopDistributor(targetShopId, distId);
      setMyDistributors(await api.getLinkedDistributors(targetShopId));
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
    await mustSucceed(() => api.saveSiteConfig('dailyTarget_' + targetShopId, val), 'Save daily target');
  };

  const handleSetFlashSale = async (productId, discountPct, durationHours) => {
    try {
      await mustSucceed(() => api.setFlashSale(targetShopId, productId, discountPct, durationHours), 'Set flash sale');
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
        await mustSucceed(() => api.addProduct(targetShopId, {
          name: row.name,
          price: parseFloat(row.price) || 0,
          stock: parseInt(row.stock) || 0,
          reorderLevel: parseInt(row.reorderLevel) || 10,
          hsnCode: row.hsnCode || '',
          gstRate: row.gstRate || '0',
          batchNumber: row.batchNumber || '',
          expiryDate: row.expiryDate || '',
          variants: row.variants || '',
        }), 'Import row');
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
    // Snapshot values at click time — belt-and-braces against any state
    // mutation while the awaits below are in flight.
    const payload = { format: printFormat, template: printTemplate, fontSize: printFontSize, showLogo: printShowLogo, copies: printCopies };
    try {
      // Don't use safe() here — it swallows the RLS failure that caused
      // print settings to silently never save. If this throws, the user
      // needs to see it, not a false "saved!" toast.
      await api.saveSiteConfig('printSettings_' + targetShopId, payload);
      // Verify the write actually landed by reading it back — Supabase
      // upsert() doesn't throw on an RLS-blocked 0-row write, it just
      // silently affects nothing. This confirms the save is real.
      const confirmSaved = await api.getSiteConfig('printSettings_' + targetShopId, null);
      if (!confirmSaved || confirmSaved.format !== payload.format) {
        throw new Error('Save did not persist — please try again or contact support.');
      }
      toast.success('Print settings saved!');
    } catch (e) {
      toast.error(e.message || 'Failed to save print settings');
    }
  };

  // ── Reset Test Data (Danger Zone) ───────────────────────────────────────
  const [showResetTestDataModal, setShowResetTestDataModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetInProgress, setResetInProgress] = useState(false);

  const handleResetTestData = () => {
    setResetConfirmInput('');
    setShowResetTestDataModal(true);
  };

  const confirmResetTestData = async () => {
    if (resetConfirmInput.trim() !== user.name.trim()) {
      toast.error('Shop name does not match. Type it exactly to confirm.');
      return;
    }
    setResetInProgress(true);
    try {
      const result = await api.resetShopTestData(targetShopId);
      toast.success(`✅ Reset complete — deleted ${result.orders} bill${result.orders === 1 ? '' : 's'}. Invoice numbers restart at #0001.`, { autoClose: 6000 });
      setShowResetTestDataModal(false);
      setResetConfirmInput('');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to reset test data. Please try again.');
    } finally {
      setResetInProgress(false);
    }
  };

  // ── Print/Re-print a past order's receipt (works on mobile + desktop) ──────
  // Unlike executeSendWhatsAppBill, this does NOT place a new order — it only
  // renders an already-saved order to PDF, honouring the shop's Print Settings
  // (A4 / 80mm thermal / 58mm thermal, font size, logo, copies).
  // opts.testMode = true renders a clearly-marked TEST PRINT (used by the
  // "Print Test Receipt" button in Print Settings) so shops can verify their
  // physical printer + paper size live, without creating a real bill.
  const printReceiptPDF = async (order, opts = {}) => {
    if (!order) return;
    try {
      // ── TEMPLATE ENGINE PATH ─────────────────────────────────────────
      // Same branch as printCurrentBill: anything other than 'classic'
      // routes through the HTML template renderer instead of the old
      // jsPDF/thermal drawing code below. Without this, the "Print Test
      // Receipt" button and re-printing a past order would silently
      // ignore the shop's chosen template and always show Classic —
      // which would make the picker in Settings misleading.
      if (printTemplate && printTemplate !== 'classic') {
        const { printInvoice } = await import('../lib/invoicePrint');
        const { type: tType, name: tName, phone: tPhone } = decodeOrderUserId(order.userId);
        let modeTitleTpl = opts.testMode ? 'TEST PRINT'
          : tType === 'estimate' ? 'PROFORMA ESTIMATE'
          : tType === 'challan'  ? 'DELIVERY CHALLAN' : 'TAX INVOICE';
        printInvoice(printTemplate, {
          shopName: shop.name || 'Shop',
          shopPhone: shop.phone || '',
          shopAddress: businessAddress || shop.address || '',
          shopGSTIN: gstin || '',
          billNo: (order.id || '').slice(0, 8).toUpperCase(),
          dateStr: order.date ? new Date(order.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
          modeTitle: modeTitleTpl,
          customerName: tName || '',
          customerPhone: tPhone || '',
          items: (order.items || []).map(it => ({
            code: it.sku || '',
            name: it.name + (it.selectedVariant ? ` (${it.selectedVariant})` : ''),
            hsn: it.hsn || '',
            qty: it.qty || 1,
            rate: it.price,
            discountPct: it.itemDiscount || it.discount || 0,
            gstPct: it.gstPct || 0,
          })),
          subtotal: order.subtotal != null ? order.subtotal : (order.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 1), 0),
          roundOff: order.roundOff || 0,
          total: order.total,
          paymentMode: order.paymentMethod || '',
          footerNote: invoiceFooter || 'Thank you! Visit again.',
          termsNote: termsConditions || '',
        }, printFormat || 'a4');
        return;
      }

      const { jsPDF: JsPDF } = await import('jspdf');
      const { type, name: custName, phone: custPhone } = decodeOrderUserId(order.userId);

      const isThermal  = printFormat === 'thermal80' || printFormat === 'thermal58';
      const pageW       = printFormat === 'thermal58' ? 58 : printFormat === 'thermal80' ? 80 : 210;

      // ── THERMAL PATH: native HTML print (see printCurrentBill for why
      //    jsPDF thermal blobs don't print at roll width). Re-print +
      //    Test Print both funnel through here. ─────────────────────────
      if (isThermal) {
        const widthMm = printFormat === 'thermal58' ? 58 : 80;
        const { type: rType, name: rName, phone: rPhone } = decodeOrderUserId(order.userId);
        const rModeTitle = opts.testMode ? 'TEST PRINT'
          : rType === 'estimate' ? 'PROFORMA ESTIMATE'
          : rType === 'challan'  ? 'DELIVERY CHALLAN' : 'TAX INVOICE';
        const receiptData = {
          shopName: shop.name || 'Shop',
          shopPhone: shop.phone || '',
          shopAddress: businessAddress || shop.address || '',
          gstin: gstin || '',
          modeTitle: rModeTitle,
          billNo: (order.id || '').slice(0, 8).toUpperCase(),
          dateStr: order.date ? new Date(order.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
          customerName: rName || '',
          customerPhone: rPhone || '',
          items: (order.items || []).map(it => ({
            name: it.name, qty: it.qty || 1, price: it.price, discountPct: it.itemDiscount || it.discount || 0,
          })),
          subtotal: order.subtotal != null ? order.subtotal : (order.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 1), 0),
          itemSavings: 0,
          billDiscount: order.discount || 0,
          loyaltyRedeemed: order.loyaltyRedeemed || 0,
          roundOff: order.roundOff || 0,
          total: order.total,
          paymentMode: order.paymentMethod || '',
          footerNote: invoiceFooter || 'Thank you! Visit again.',
        };
        const { printThermalReceipt } = await import('../lib/thermalReceipt');
        const { fallback } = printThermalReceipt(receiptData, widthMm);
        if (fallback === 'popup') toast.info('Allow pop-ups for this site to print receipts.');
        return;
      }

      const marginL     = isThermal ? 3 : 15;
      const contentW    = pageW - marginL * 2;

      const themeColor = opts.testMode ? '#4F46E5' : type === 'estimate' ? '#4F46E5' : type === 'challan' ? '#3B82F6' : '#10B981';
      const modeTitle  = opts.testMode ? 'TEST PRINT' : type === 'estimate' ? 'PROFORMA ESTIMATE' : type === 'challan' ? 'DELIVERY CHALLAN' : 'TAX INVOICE';
      const hex2rgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
      const [tR,tG,tB] = hex2rgb(themeColor);

      const doc = isThermal
        ? new JsPDF({ unit: 'mm', format: [pageW, 297], orientation: 'portrait' })
        : new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      // Thermal printers render mid-gray tones (slate-500/600, used for
      // secondary text on-screen) as faint, washed-out, or "dull" — thermal
      // print heads are calibrated for near-black, not grayscale. On A4
      // (regular inkjet/laser), grays print fine and preserve visual
      // hierarchy. So: darken every gray to near-black ONLY on thermal;
      // leave A4 colours untouched.
      const setTextColor = (r, g, b) => {
        if (isThermal) {
          // Anything lighter than ~mid-gray gets forced to near-black.
          // Pure brand colours (used for headers/accents) stay as-is —
          // only true grays get the ink-safe treatment.
          const isGrayish = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
          if (isGrayish && r > 40) { doc.setTextColor(20, 20, 20); return; }
        }
        doc.setTextColor(r, g, b);
      };

      doc.setFillColor(tR,tG,tB);
      doc.rect(0, 0, pageW, isThermal ? 7 : 10, 'F');

      let hy = isThermal ? 13 : 20;
      const hasLogo = printShowLogo && shop.logo && shop.logo.startsWith('data:image');
      if (hasLogo) {
        try { doc.addImage(shop.logo, 'JPEG', marginL, hy - 6, isThermal ? 14 : 22, isThermal ? 14 : 22); } catch { /* corrupt/unsupported logo image — skip */ }
      }
      const textX = hasLogo ? marginL + (isThermal ? 17 : 25) : marginL;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(printFontSize === 'large' ? (isThermal ? 13 : 20) : (isThermal ? 11 : 18));
      setTextColor(15,23,42);
      doc.text(shop.name, isThermal ? pageW/2 : textX, hy, isThermal ? { align: 'center' } : {});
      hy += isThermal ? 6 : 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(isThermal ? 7 : 9);
      setTextColor(100,116,139);
      doc.text(`Ph: ${shop.phone}`, isThermal ? pageW/2 : textX, hy, isThermal ? { align: 'center' } : {});
      hy += 5;

      hy += isThermal ? 2 : 4;
      doc.setDrawColor(226,232,240);
      doc.setLineWidth(0.3);
      doc.line(marginL, hy, pageW - marginL, hy);
      hy += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(isThermal ? 9 : 12);
      setTextColor(tR,tG,tB);
      doc.text(`${modeTitle}  #${(order.id||'').slice(0,8).toUpperCase()}`, isThermal ? pageW/2 : marginL, hy, isThermal ? { align: 'center' } : {});
      hy += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(isThermal ? 7 : 9);
      setTextColor(100,116,139);
      doc.text(new Date(order.date).toLocaleString('en-IN'), isThermal ? pageW/2 : marginL, hy, isThermal ? { align: 'center' } : {});
      hy += 7;

      if (custName || custPhone) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(isThermal ? 7 : 9);
        setTextColor(15,23,42);
        doc.text(`Customer: ${custName || 'Walk-in'}`, isThermal ? pageW/2 : marginL, hy, isThermal ? { align: 'center' } : {});
        hy += 4.5;
        if (custPhone) {
          doc.setFont("helvetica", "normal");
          setTextColor(100,116,139);
          doc.text(`Phone: ${custPhone}`, isThermal ? pageW/2 : marginL, hy, isThermal ? { align: 'center' } : {});
          hy += 4.5;
        }
        hy += 2;
      }

      doc.setDrawColor(226,232,240);
      doc.line(marginL, hy, pageW - marginL, hy);
      hy += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(isThermal ? 7 : 8);
      setTextColor(71,85,105);
      doc.text("ITEM", marginL, hy);
      doc.text("AMT", pageW - marginL, hy, { align: 'right' });
      hy += 4;
      doc.setLineWidth(0.2);
      doc.line(marginL, hy, pageW - marginL, hy);
      hy += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(printFontSize === 'large' ? (isThermal ? 8 : 10) : (isThermal ? 7 : 9));
      setTextColor(15,23,42);
      (order.items || []).forEach(item => {
        const qty = item.qty || 1;
        const lineAmt = (item.price||0) * qty;
        const iDisc = item.itemDiscount || 0;
        const finalAmt = iDisc > 0 ? Math.round(lineAmt * (1 - iDisc/100)) : lineAmt;
        const label = `${qty}x ${item.name}${item.selectedVariant ? ` (${item.selectedVariant})` : ''}`;
        doc.text(label, marginL, hy, isThermal ? { maxWidth: contentW - 14 } : { maxWidth: 130 });
        doc.text(`Rs.${finalAmt}`, pageW - marginL, hy, { align: 'right' });
        hy += isThermal ? 5 : 6;
      });

      hy += 2;
      doc.setLineWidth(0.3);
      doc.line(marginL, hy, pageW - marginL, hy);
      hy += 7;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(isThermal ? 11 : 14);
      setTextColor(15,23,42);
      doc.text("TOTAL", marginL, hy);
      doc.text(`Rs.${order.total}`, pageW - marginL, hy, { align: 'right' });
      hy += 8;

      if (order.paymentMethod) {
        const pmColors = { Cash: [16,185,129], UPI: [79,70,229], Card: [59,130,246], Credit: [239,68,68] };
        const [pR,pG,pB] = pmColors[order.paymentMethod] || pmColors.Cash;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(isThermal ? 8 : 9);
        setTextColor(pR,pG,pB);
        doc.text(`Payment: ${order.paymentMethod}`, isThermal ? pageW/2 : marginL, hy, isThermal ? { align: 'center' } : {});
        hy += 6;
      }

      if (exchangePolicy) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(isThermal ? 6.5 : 7.5);
        setTextColor(100,116,139);
        doc.text(`Exchange: ${exchangePolicy}`, isThermal ? pageW/2 : marginL, hy, isThermal ? { align: 'center', maxWidth: contentW } : { maxWidth: 180 });
        hy += isThermal ? 8 : 6;
      }

      if (opts.testMode) {
        // Loud, unmissable banner so a test slip can never be handed to a
        // customer as a real bill by mistake.
        doc.setFillColor(79,70,229);
        doc.rect(marginL, hy - 4, contentW, isThermal ? 7 : 9, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(isThermal ? 8 : 11);
        doc.setTextColor(255,255,255);
        doc.text("*** TEST PRINT — NOT A BILL ***", pageW/2, hy + (isThermal ? 1 : 2), { align: 'center' });
        hy += isThermal ? 8 : 11;

        // Settings summary — lets the shop confirm on paper exactly which
        // configuration produced this slip.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(isThermal ? 6.5 : 8);
        setTextColor(100,116,139);
        const fmtLabel = printFormat === 'a4' ? 'A4 (210mm)' : printFormat === 'thermal80' ? '80mm Thermal' : '58mm Thermal';
        doc.text(`Paper: ${fmtLabel} | Font: ${printFontSize} | Logo: ${printShowLogo ? 'On' : 'Off'} | Copies: ${printCopies || 1}`, pageW/2, hy, { align: 'center', maxWidth: contentW });
        hy += 4.5;
        doc.text(`Printed: ${new Date().toLocaleString('en-IN')}`, pageW/2, hy, { align: 'center' });
        hy += 5;

        // Edge-alignment ruler: full-width line with end ticks. If either
        // tick is cut off on the physical slip, the paper size selected in
        // Print Settings doesn't match the roll loaded in the printer.
        doc.setDrawColor(79,70,229);
        doc.setLineWidth(0.4);
        doc.line(marginL, hy, pageW - marginL, hy);
        doc.line(marginL, hy - 2, marginL, hy + 2);
        doc.line(pageW - marginL, hy - 2, pageW - marginL, hy + 2);
        doc.setFontSize(isThermal ? 5.5 : 7);
        doc.text(`|<-- printable width ${Math.round(contentW)}mm -->|  (both end marks should be visible)`, pageW/2, hy + 4.5, { align: 'center', maxWidth: contentW });
        hy += 9;
      }

      doc.setFont("helvetica", "italic");
      doc.setFontSize(isThermal ? 7 : 8);
      setTextColor(148,163,184);
      doc.text("Thank you for your business!", isThermal ? pageW/2 : marginL, hy, isThermal ? { align: 'center' } : {});
      hy += 4;
      doc.text("Powered by MyStore OS", isThermal ? pageW/2 : marginL, hy, isThermal ? { align: 'center' } : {});

      // Extra copies — append additional pages
      const copies = Math.max(1, printCopies || 1);
      for (let c = 1; c < copies; c++) {
        doc.addPage(isThermal ? [pageW, 297] : 'a4');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(isThermal ? 9 : 14);
        setTextColor(tR,tG,tB);
        doc.text(`COPY ${c+1} — ${shop.name}`, isThermal ? pageW/2 : 105, isThermal ? 10 : 20, { align: 'center' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(isThermal ? 7 : 9);
        setTextColor(100,116,139);
        doc.text(`${modeTitle} | Total: Rs.${order.total}`, isThermal ? pageW/2 : 105, isThermal ? 17 : 30, { align: 'center' });
      }

      const safeName = (shop.name || 'Bill').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeName}_Receipt_${(order.id||'').slice(0,8)}.pdf`;
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Mobile: use native share sheet (lets user pick a print app, or save/share)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({ files: [pdfFile], title: fileName });
          return;
        } catch (shareErr) {
          if (shareErr?.name === 'AbortError') return; // user cancelled — not an error
        }
      }

      // Desktop / fallback: use the thermal-safe print helper so the
      // browser's print dialog defaults to the shop's chosen paper size
      // (58mm / 80mm / A4) instead of always A4 — see printPdf.js.
      const { fallback } = await printPdfWithFormat(doc, { fileName, format: printFormat || 'a4' });
      if (fallback === 'download') {
        toast.info('Pop-up blocked — PDF downloaded instead. Open it to print.');
      }
    } catch (err) {
      console.error('Print receipt failed:', err);
      toast.error('Could not generate the receipt PDF. Please try again.');
    }
  };

  // ── Print Test Receipt (live printer check) ────────────────────────────────
  // Renders a sample TEST PRINT slip through the exact same pipeline real
  // bills use (printReceiptPDF), honouring whatever paper size / font /
  // logo / copies are CURRENTLY selected in Print Settings — even if not
  // saved yet — so a shop can try 80mm vs 58mm live and only save what fits.
  const handleTestPrint = () => {
    const sampleItems = [
      { name: 'Sample Item A',            price: 120, qty: 2, sku: 'SKU-101' },
      { name: 'Sample Item B',            price: 250, qty: 1, itemDiscount: 10, sku: 'SKU-102' },
      { name: 'Sample Item C (variant)',  price: 55,  qty: 3, selectedVariant: 'Large', sku: 'SKU-103' },
    ];
    const total = sampleItems.reduce((s, it) => {
      const line = it.price * (it.qty || 1);
      return s + (it.itemDiscount ? Math.round(line * (1 - it.itemDiscount / 100)) : line);
    }, 0);
    const fmtLabel = printFormat === 'a4' ? 'A4' : printFormat === 'thermal80' ? '80mm thermal' : '58mm thermal';
    const tplLabel = printTemplate && printTemplate !== 'classic' ? ` — ${printTemplate.replace('_', ' ')} template` : '';
    toast.info(`🖨️ Generating test receipt — ${fmtLabel}${tplLabel}, ${printFontSize} font, ${printCopies || 1} cop${(printCopies || 1) === 1 ? 'y' : 'ies'}`);
    printReceiptPDF({
      id: 'TESTPRNT',
      date: new Date().toISOString(),
      userId: 'walk-in:Test Customer:9876543210',
      paymentMethod: 'Cash',
      items: sampleItems,
      total,
    }, { testMode: true });
  };

  const handleSaveInvoiceSettings = async () => {
    try {
      await mustSucceed(() => api.saveSiteConfig('invoiceFooter_' + targetShopId, invoiceFooter), 'Save invoice footer');
      await mustSucceed(() => api.saveSiteConfig('invPrefix_' + targetShopId, invoicePrefix), 'Save invoice prefix');
      await mustSucceed(() => api.saveSiteConfig('exchangePolicy_' + targetShopId, exchangePolicy), 'Save exchange policy');
      await mustSucceed(() => api.saveSiteConfig('termsConditions_' + targetShopId, termsConditions), 'Save terms & conditions');
      toast.success("Invoice settings saved!");
    } catch (e) {
      toast.error(e?.message || "Failed to save invoice settings");
    }
  };

  // Resize to max 400px + JPEG-compress, then persist — same logic used by
  // DesktopSettings' logo uploader (handleLogoFile -> onLogoChange), so both
  // surfaces save the logo identically and reliably reach the database.
  // Previously the mobile input called a separate handler that only ever
  // set local React state and never persisted to Supabase — the logo
  // looked uploaded for that one session, then silently vanished and
  // never reached any other device.
  const handleMobileLogoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Validate BEFORE FileReader ever touches the file — the canvas resize
    // below only runs after the full original file is already read into
    // memory and decoded, so a 30-50MB phone photo would hang the tab for
    // several seconds before getting anywhere near being shrunk down.
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
        handleLogoChange(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoChange = async (base64) => {
    setLogo(base64);
    // Always write to the SHOP's row (targetShopId), not the calling
    // user's own row — for a staff session, user.id is the staff
    // member's own account, which nobody else reads from. Writing there
    // silently saved the logo to an irrelevant row and made it look like
    // the upload "did nothing" / kept showing the old logo to everyone
    // else (owner, storefront, bills) who only ever reads the owner's row.
    await mustSucceed(() => api.updateProfile(targetShopId, { logo: base64 }), 'Update logo');
    toast.success('Logo updated!');
  };

  const handleLogoRemove = async () => {
    setLogo('');
    await mustSucceed(() => api.updateProfile(targetShopId, { logo: '' }), 'Remove logo');
    toast.success('Logo removed');
  };

  const handleShopPhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (shopPhotos.length + files.length > 6) return toast.error('Maximum 6 photos allowed');

    // No client-side resize on this path — files go straight to
    // uploadAsset(), which falls back to a base64 string in localStorage
    // if the Storage upload fails. localStorage has a hard ~5-10MB total
    // size limit per origin; one oversized photo there could blow out the
    // whole session, not just fail to save. Reject early instead.
    const badFiles = files.filter(f => !validateImageFile(f).ok);
    if (badFiles.length) {
      toast.error(`${badFiles.length} photo${badFiles.length > 1 ? 's' : ''} skipped — must be an image under ${8}MB each`);
    }
    const okFiles = files.filter(f => validateImageFile(f).ok);
    if (!okFiles.length) return;

    const added = [];
    for (const file of okFiles) {
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
      await mustSucceed(() => api.updateProfile(user.id, { shopPhotos: next }), 'Save shop photos');
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
    await mustSucceed(() => api.updateProfile(user.id, { shopPhotos: next }), 'Remove shop photo');
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
    const msg = `Check out ${shop.name} on MyStore OS!\n${url}`;
    
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
        await navigator.share({ title: shop.name, text: msg, url });
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
        const url = await api.uploadAsset(file, user.id, 'payment_qrs');
        setPaymentQr(url);
        // Persist immediately so it survives re-login without a separate
        // Save tap.
        //
        // BUG FIX: this used to be wrapped in safe(), which — same as the
        // print settings bug — silently swallows any RLS/network failure
        // and shows "Payment QR saved!" regardless. The upload to storage
        // succeeds, React state updates so the QR LOOKS saved in the
        // current session, but if the users-table write fails, it's gone
        // on next login. That's exactly "already added but not showing."
        await api.updateProfile(user.id, { paymentQr: url });
        try {
          const sess = JSON.parse(localStorage.getItem('mystore_session') || '{}');
          localStorage.setItem('mystore_session', JSON.stringify({ ...sess, paymentQr: url }));
        } catch (_e) { /* ignore — localStorage cache is a convenience, not source of truth */ }
        toast.success("Payment QR saved!");
      } catch (err) {
        toast.error(err?.message || "Failed to upload Payment QR");
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
    let orderId;
    try {
      const orderData = await api.createRazorpayOrder(payPlanId, payPrice);
      orderId = orderData?.orderId;
    } catch (_e) {
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
          await mustSucceed(() => api.verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId: payPlanId,
            userId: targetShopId,
          }), 'Verify payment');
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
    bg: { backgroundColor: '#F4F5F7', minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', color: '#0F172A', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", boxSizing: 'border-box' },
    header: { background: '#0F172A', padding: 'calc(10px + env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 12px)) 10px max(12px, env(safe-area-inset-left, 12px))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box', overflow: 'hidden', gap: '8px' },
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
    navBtn: { textAlign: 'center', cursor: 'pointer', minWidth: '44px', maxWidth: '60px', flex: '1 1 0', flexShrink: 0, padding: '2px 2px' }
  };

  // Branch switcher — only shown when the owner has 2+ branches. Dropdown
  // lets them switch which branch's products/orders/staff/reports they're
  // viewing. activeBranchId is null = main shop selected.
  const visibleBranches = branches.filter(b => !b.branchDeletedAt);
  // hasMultipleBranches is the gate for all multi-branch UI (switcher, reports
  // scope toggle, per-product copy-to-branch button). Branch logins never
  // own other branches — they only manage themselves — so force false even
  // if visibleBranches happens to contain siblings (it does, because
  // getOwnedBranches returns the full family for shared data lookups).
  const hasMultipleBranches = visibleBranches.length >= 2 && !user.parentShopId;
  const currentBranch = visibleBranches.find(b => b.id === targetShopId) || visibleBranches.find(b => !b.parentShopId) || null;
  // Branch switcher dropdown removed. The dedicated 'Branches' tab
  // (Building2 icon in nav) shows a unified overview, and each branch
  // card on that tab is clickable to switch context. Cleaner mental
  // model than a dropdown duplicated next to the shop name.
  const branchSwitcherEl = null;
  const _disabledBranchSwitcher = (hasMultipleBranches && user.role !== 'staff') ? (
    <select
      value={targetShopId}
      onChange={(e) => {
        const picked = e.target.value;
        // Main shop is identified by parentShopId === null. Setting
        // activeBranchId back to null when the owner picks the main
        // shop keeps the localStorage key clean.
        const isMain = !visibleBranches.find(b => b.id === picked)?.parentShopId;
        setActiveBranchId(isMain ? null : picked);
      }}
      title="Switch branch"
      style={{
        padding: '6px 28px 6px 10px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.25)',
        background: 'rgba(255,255,255,0.15)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        maxWidth: 180,
        appearance: 'none',
        WebkitAppearance: 'none',
        backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg width=\"10\" height=\"6\" viewBox=\"0 0 10 6\" xmlns=\"http://www.w3.org/2000/svg\"><path fill=\"%23ffffff\" d=\"M0 0l5 6 5-6z\"/></svg>')",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {visibleBranches.map(b => (
        <option key={b.id} value={b.id} style={{ color: '#0F172A' }}>
          {b.name}{!b.parentShopId ? ' (Main)' : ''}
        </option>
      ))}
    </select>
  ) : null;

  // "Import from Main Shop" card — shown on the Products tab when the
  // owner (or branch user) is standing on a branch (not the main shop).
  // Lets them bulk-seed the branch's catalogue from the main shop
  // instead of re-entering every product by hand. Idempotent (the API
  // de-dupes by barcode + name) — they can tap it again after adding
  // new items to main and only the new ones get copied.
  // ── Branch catalogue management card ──────────────────────────────────
  // Two modes depending on which shop is active:
  //
  // Mode A — ON BRANCH: "Import from Main" — pull main shop's catalogue
  //   into this branch. Shown when targetShopId has a parentShopId.
  //
  // Mode B — ON MAIN SHOP: "Push to Branch" — select a branch and push
  //   the entire catalogue to it in one click. Shown when on main shop
  //   and at least one branch exists. This is what the owner sees when
  //   they just created a branch and want to seed it immediately.
  //
  // Both modes call the same importProductsFromShop API with dedupe.
  const currentBranchForImport = visibleBranches.find(b => b.id === targetShopId);
  const isOnBranch = !!currentBranchForImport?.parentShopId;
  const isOnMainShop = !isOnBranch;
  // Branches that can receive a push FROM the current main shop
  const branchesForPush = visibleBranches.filter(b => b.parentShopId === targetShopId);

  const canImportFromMain = isOnBranch && user.role !== 'staff';
  const canPushToABranch = isOnMainShop && branchesForPush.length > 0 && user.role !== 'staff';

  const importFromMainEl = (canImportFromMain || canPushToABranch) ? (
    canImportFromMain ? (
    <div style={{ background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', border: '1px solid #C7D2FE', borderRadius: 12, padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, flexShrink: 0 }}>📦</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Copy all products from Main Shop</div>
        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, lineHeight: 1.45 }}>
          Copies every product from the main shop into this branch. Products already here are skipped — safe to run again after adding new items to main.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => handleImportFromMain({ copyStock: false })}
          title="Copy all products; set stock to 0 on this branch"
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#FFFFFF', color: '#4F46E5', border: '1px solid #C7D2FE', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Copy products (stock = 0)
        </button>
        <button
          onClick={() => handleImportFromMain({ copyStock: true })}
          title="Copy all products AND copy current stock counts from main"
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Copy + bring stock
        </button>
      </div>
    </div>
    ) : (
    // Mode B: on main shop, push to a branch
    <PushToBranchCard
      branches={branchesForPush}
      onPush={async (targetBranchId, copyStock) => {
        try {
          const result = await api.importProductsFromShop(targetShopId, targetBranchId, { copyStock });
          const branchName = branchesForPush.find(b => b.id === targetBranchId)?.name || 'branch';
          if (result.imported === 0 && result.skipped === 0) {
            toast.info('Main shop has no products yet.');
          } else if (result.imported === 0) {
            toast.info(`No new products — all ${result.skipped} already exist in ${branchName}.`);
          } else {
            toast.success(`Copied ${result.imported} product${result.imported === 1 ? '' : 's'} to ${branchName}${result.skipped ? ` (${result.skipped} already existed)` : ''}.`);
          }
        } catch (err) {
          toast.error(err?.message || 'Copy failed');
        }
      }}
    />
    )
  ) : null;

  // Reports scope toggle + per-branch breakdown card. Only rendered when
  // the owner has 2+ branches; otherwise the existing single-branch
  // reports are unchanged. Goes above the existing Desktop/Mobile reports
  // UI so the rest of those components don't need to know about scope.
  // Legacy reportsScopeUI removed. The "All Branches (Combined)" option
  // in the global branch switcher (sidebar bottom) is now the single
  // source of truth for cross-branch viewing. No per-tab toggle needed.
  const reportsScopeUI = null;

  // Per-branch performance card. Shown only when the owner has 2+
  // branches AND is in 'all' scope — gives a glance comparison of how
  // each location did today + this month, sorted by best performer.
  const reportsBreakdownEl = (() => {
    const data = reportsData();
    if (!data.isAllScope || !data.branchBreakdown?.length) return null;
    const totalMonth = data.branchBreakdown.reduce((s, b) => s + b.monthRevenue, 0) || 1;
    return (
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>📊 Per-Branch Performance</h3>
        <p style={{ margin: '0 0 12px', fontSize: 11.5, color: '#64748B' }}>
          Today's bills · today's revenue · this month total · share of monthly revenue
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.branchBreakdown.map((b, idx) => {
            const sharePct = Math.round((b.monthRevenue / totalMonth) * 100);
            return (
              <div key={b.branchId} style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, background: idx === 0 ? '#F0FDF4' : '#FFFFFF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{b.branchName}</span>
                  {b.isMain && <span style={{ fontSize: 9.5, background: '#4F46E5', color: '#fff', padding: '2px 7px', borderRadius: 999, fontWeight: 800, letterSpacing: 0.3 }}>MAIN</span>}
                  {idx === 0 && data.branchBreakdown.length > 1 && (
                    <span style={{ fontSize: 9.5, background: '#16A34A', color: '#fff', padding: '2px 7px', borderRadius: 999, fontWeight: 800, letterSpacing: 0.3 }}>🏆 TOP</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 11.5 }}>
                  <div>
                    <div style={{ color: '#64748B', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3 }}>TODAY</div>
                    <div style={{ color: '#0F172A', fontWeight: 700 }}>{b.todayBills} bills · ₹{Math.round(b.todayRevenue).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3 }}>THIS MONTH</div>
                    <div style={{ color: '#0F172A', fontWeight: 700 }}>{b.monthBills} bills · ₹{Math.round(b.monthRevenue).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748B', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3 }}>SHARE</div>
                    <div style={{ color: '#0F172A', fontWeight: 700 }}>{sharePct}%</div>
                    <div style={{ marginTop: 4, background: '#E2E8F0', height: 4, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ background: '#4F46E5', height: '100%', width: `${sharePct}%`, transition: 'width .35s' }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  })();

  // Persistent "Send PDF receipt too" banner — rendered in both desktop and
  // mobile returns. Pins to the bottom of the screen and stays visible until
  // the cashier acts on it. Replaces the auto-dismissing 8s toast that
  // cashiers were missing during busy back-to-back billing sessions.
  // When a second bill is generated while a banner is still up, it's queued
  // (not overwritten) — Bill A's banner stays, Bill B waits until A is
  // dismissed. A small pill shows how many are waiting.
  const queuedAfterCurrent = Math.max(0, pdfShareQueue.length - 1);
  const pdfShareBannerEl = pdfShareBanner ? (
    <div style={{
      position: 'fixed',
      left: 0, right: 0,
      bottom: isMobile ? 70 : 0,        // sit above the mobile bottom nav (~64px)
      zIndex: 1100,
      padding: '0 12px',
      pointerEvents: 'none',             // wrapper transparent; inner card clickable
    }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto 10px',
        background: '#FFFFFF',
        border: '1px solid #BBF7D0',
        borderLeft: '4px solid #10B981',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 10px 28px rgba(15,23,42,0.18)',
        pointerEvents: 'auto',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            📎 Send PDF receipt too?
            {queuedAfterCurrent > 0 && (
              <span style={{ fontSize: 10.5, background: '#FEF3C7', color: '#92400E', padding: '1px 7px', borderRadius: 999, fontWeight: 800, letterSpacing: 0.3 }}>
                +{queuedAfterCurrent} more {queuedAfterCurrent === 1 ? 'bill' : 'bills'} waiting
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
            Text bill went to {pdfShareBanner.customerPhone} · the customer's chat is at the top of your WhatsApp recents
          </div>
        </div>
        <button
          onClick={async () => {
            try {
              await navigator.share({
                files: [pdfShareBanner.pdfFile],
                title: pdfShareBanner.mode === 'estimate' ? 'Estimate / Quotation' : (pdfShareBanner.mode === 'challan' ? 'Delivery Challan' : 'Your Receipt'),
                text: `Receipt PDF from ${shop.name}`,
              });
            } catch (_e) { /* cashier dismissed share sheet — fine */ }
            // Banner stays open after a share attempt so the cashier can also
            // re-send if needed (e.g. they accidentally picked the wrong
            // contact). Explicit × button does the actual close + advances
            // the queue to the next bill, if any.
          }}
          style={{
            flexShrink: 0,
            background: 'linear-gradient(135deg,#10B981,#059669)',
            color: '#fff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          Send PDF
        </button>
        <button
          onClick={() => setPdfShareQueue(prev => prev.slice(1))}
          aria-label={queuedAfterCurrent > 0 ? `Skip · ${queuedAfterCurrent} more waiting` : 'Dismiss'}
          title={queuedAfterCurrent > 0 ? `Skip · ${queuedAfterCurrent} more waiting` : 'Dismiss'}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            padding: 6,
            fontSize: 18,
            lineHeight: 1,
          }}
        >×</button>
      </div>
    </div>
  ) : null;

  if (!isMobile) {
    return (
      <div className="enterprise-wrapper" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', paddingLeft: '240px', backgroundColor: '#F8FAFC', color: '#0F172A', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <ToastContainer theme="dark" position="top-center" />
        {pdfShareBannerEl}
        {/* Hidden, always-mounted QR canvas used by downloadQrPoster /
            downloadQrPng (passed down into DesktopSettings' "Your Store QR
            Code" card). This is the DESKTOP render branch — ShopDashboard
            has two separate top-level `return` statements gated by
            isMobile, and DesktopSettings only ever renders from this one.
            The earlier fix for this exact bug only added the canvas to the
            MOBILE branch's return (further down in this file), so on
            desktop posterQrRef.current was always null — the canvas that
            would populate it was never being rendered at all, hence
            "QR code not ready yet" firing every time on desktop. */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
          <QRCodeCanvas ref={posterQrRef} value={getShopUrl()} size={1024} level="H" includeMargin={false} fgColor="#0F172A" bgColor="#FFFFFF" />
        </div>
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
          userName={currentBranch?.name || shop.name}
          publicCode={shop.publicCode}
          branchSwitcherEl={branchSwitcherEl}
          hasMultipleBranches={hasMultipleBranches}
          shopCategory={shop.shopCategory}
          businessKind={shop.businessKind}
          syncStatus={{ isOnline, pendingCount }}
          // Was missing entirely — the sidebar only checked
          // businessKind (is this a service business) to decide
          // whether to show Bookings/Services/Staff, never whether
          // the account's actual plan tier grants bookings access at
          // all. A Starter-tier service account (bookings: false in
          // PLAN_CAPS.starter) could see and open the full Bookings
          // surface anyway — exactly the "spec change silently opens
          // a Pro feature to Starter tier" revenue leak the test suite
          // was specifically written to catch, and had been failing
          // on since before tonight's changes.
          canBookings={canBookings}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="enterprise-main" style={{ marginTop: announceConfig.active && announceConfig.text ? '40px' : '0px', position: 'relative' }}>

          {/* Floating notification bell — top-right corner of main content.
              userId is targetShopId (not user?.id): notifications are
              always addressed to shop_id on the order, which for staff
              logins is user.staff_of and for a branch view is the
              branch id — neither equals the logged-in individual's own
              user.id. Using user?.id here meant staff and branch views
              never received their notifications at all. */}
          <div style={{ position: 'absolute', top: 12, right: 20, zIndex: 900 }}>
            <NotificationCenter
              userId={targetShopId}
              onToast={(row) => toast.info(row.title, { autoClose: 5000, position: 'top-right' })}
            />
          </div>
          {activeTab === 'dashboard' && (
            <ServiceBusinessHome
              shopId={targetShopId}
              shopName={shop.name}
              orders={orders}
              setActiveTab={setActiveTab}
              onOrderCreated={loadData}
            />
          )}

          {activeTab === 'home' && (
            <DesktopPOS 
              footerSlot={isOwner && isViewingMain ? <ReferAndEarnCard userId={user?.id} userName={user?.name} /> : null}
              businessKind={isServiceBusiness ? 'service' : (user?.businessKind || null)}
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
              roundOff={roundOff}
              setRoundOff={setRoundOff}
              billTotal={billTotal}
              search={search}
              setSearch={setSearch}
              onVoiceAddToBill={handleVoiceAddToBill}
              isListeningPOS={isListeningPOS}
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
              onPrint={printCurrentBill}
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
            <>
              {importFromMainEl}
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
              onCopyToBranch={hasMultipleBranches ? handleCopyProductToBranch : null}
            />
            </>
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
              orders={user.role === 'staff'
                ? orders.filter(o => decodeOrderUserId(o.userId).staffId === user.id)
                : orders}
              billsSubTab={billsSubTab}
              setBillsSubTab={setBillsSubTab}
              handleConvertEstimateToBill={handleConvertEstimateToBill}
              acceptOrder={acceptOrder}
              printReceiptPDF={printReceiptPDF}
              verifyOrderPayment={verifyOrderPayment}
              handleOpenReturnModal={handleOpenReturnModal}
              openCancelModal={openCancelModal}
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

          {activeTab === 'restock' && (
            <DesktopRestock 
              wholesaleCatalog={wholesaleCatalog}
              restockCart={restockCart}
              stockOrders={stockOrders}
              handleRestockQtyChange={handleRestockQtyChange}
              handlePlaceRestockOrder={handlePlaceRestockOrder}
              onMarkDelivered={handleMarkStockOrderDelivered}
              onOpenVoiceRecorder={() => setShowVoiceRecorderModal(true)}
              onShopVoiceRestockOrder={handleShopVoiceRestockOrder}
              user={user}
            />
          )}

          {/* BRANCHES — unified multi-branch dashboard. Triggers combined
              data load via isCombinedScope (see loadData useEffect deps).
              Main owner only, only when 2+ branches exist. */}
          {activeTab === 'branches' && isOwner && hasMultipleBranches && (
            <BranchesDashboard
              orders={orders}
              branches={visibleBranches}
              setActiveBranchId={setActiveBranchId}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'reports' && isOwner && (
            <>
              {reportsScopeUI}
              {isCombinedScope && (
                <CompareBranchesPanel orders={orders} branches={visibleBranches} />
              )}
              {reportsBreakdownEl}
              <DesktopReports
                reportsData={reportsData}
                orders={displayOrders}
                downloadTallyXML={downloadTallyXML}
                user={user}
                credits={credits}
                customerCredits={customerCredits}
                stockOrders={stockOrders}
                dailyTarget={dailyTarget}
                products={products}
              />
            </>
          )}

          {activeTab === 'bookings' && (
            <DesktopBookings shopId={targetShopId} shopName={shop.name} initialTab="appointments" sysSettings={sysSettings} onAddonPurchased={loadData} />
          )}

          {activeTab === 'services' && isOwner && (
            <DesktopBookings shopId={targetShopId} shopName={shop.name} initialTab="services" sysSettings={sysSettings} onAddonPurchased={loadData} />
          )}

          {activeTab === 'staff' && isOwner && (
            <DesktopBookings shopId={targetShopId} shopName={shop.name} initialTab="staff" sysSettings={sysSettings} onAddonPurchased={loadData} />
          )}

          {activeTab === 'membership' && isOwner && (
            <DesktopMembership shopId={targetShopId} />
          )}

          {activeTab === 'feedback' && isOwner && (
            <DesktopFeedback shopId={targetShopId} />
          )}

          {activeTab === 'profile' && isOwner && (
            <>
              {isMainOwner && isViewingMain && (
                <BranchesManager
                  ownerId={user.id}
                  onChange={async () => {
                    // Reload the parent's branches state so the switcher
                    // dropdown reflects the change immediately.
                    const fresh = await safe(() => api.getOwnedBranches(user.id));
                    if (Array.isArray(fresh)) setBranches(fresh);
                  }}
                />
              )}
              <DesktopSettings 
                user={user}
                targetShopId={targetShopId}
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
              paymentQr={paymentQr}
              setPaymentQr={setPaymentQr}
              handlePaymentQrUpload={handlePaymentQrUpload}
              logo={logo}
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
              handleDeleteStaff={handleDeleteStaff}
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
              exchangePolicy={exchangePolicy}
              setExchangePolicy={setExchangePolicy}
              termsConditions={termsConditions}
              setTermsConditions={setTermsConditions}
              printFormat={printFormat}
              setPrintFormat={setPrintFormat}
              printTemplate={printTemplate}
              setPrintTemplate={setPrintTemplate}
              printFontSize={printFontSize}
              setPrintFontSize={setPrintFontSize}
              printShowLogo={printShowLogo}
              setPrintShowLogo={setPrintShowLogo}
              printCopies={printCopies}
              setPrintCopies={setPrintCopies}
              handleSavePrintSettings={handleSavePrintSettings}
              handleTestPrint={handleTestPrint}
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
              handleResetTestData={isMainOwner && isViewingMain ? handleResetTestData : undefined}
              isViewingMain={isViewingMain}
            />
            </>
          )}
        </div>
        </div>

        {/* Global Modals for Desktop */}
        {showPaymentQrModal && (paymentQr || upiId) && (
          <div onClick={() => setShowPaymentQrModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '24px', padding: '32px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px', fontWeight: 800 }}>{shop.name}</h2>
              <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '20px' }}>Scan to Pay • ₹{billTotal > 0 ? billTotal : '0'}</p>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block' }}>
                {paymentQr ? (
                  <img src={paymentQr} alt="Payment QR" style={{ width: '240px', height: '240px', objectFit: 'contain' }} />
                ) : (
                  <QRCodeSVG
                    value={buildUpiUri({ upiId, merchantUpiId: shop.merchantUpiId, merchantCode: shop.merchantCode, name: shop.name }, { amount: billTotal || 0, txnRef: upiTxnRef, note: 'Bill Payment' })}
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
              
              <div style={{ marginTop: '16px' }}>
                <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px', fontWeight: 'bold' }}>Refund Mode</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                  {[['cash','💵','Cash'],['upi','📱','UPI'],['card','💳','Card'],['store_credit','🎟️','Credit']].map(([key, icon, label]) => (
                    <button key={key} onClick={() => setReturnRefundMode(key)}
                      style={{ padding: '8px 4px', borderRadius: '8px', border: returnRefundMode === key ? '2px solid #EF4444' : '1px solid #334155', background: returnRefundMode === key ? 'rgba(239,68,68,0.15)' : '#0F172A', color: returnRefundMode === key ? '#EF4444' : '#94A3B8', fontSize: '10px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' }}>
                      {icon}<br />{label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', color: '#EF4444' }}>
                  <span>Total Refund:</span>
                  <span>₹{returnOrder.items.reduce((sum, item) => sum + (item.price * (returnItemsState[item.id] || 0)), 0).toFixed(2)}</span>
                </div>
                <button onClick={handleProcessReturn} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                  Confirm Return &amp; Notify Customer
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
            shopName={shop.name}
            shopId={targetShopId}
            getSiteConfig={api.getSiteConfig}
            saveSiteConfig={api.saveSiteConfig}
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
                  <input type="number" min="0" max="99" value={newProdDiscountPct} onChange={e => setNewProdDiscountPct(e.target.value === '' ? '' : String(Math.max(0, Math.min(99, parseInt(e.target.value) || 0))))}
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
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748B' }}>Just labels, all variants share the price above — e.g. T-shirt colours.</p>
              </div>
              <div style={{ marginBottom: '16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: newProdVariantPrices.length ? '12px' : 0 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>💰 Different price per variant?</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748B' }}>e.g. Rice Bag — 5kg ₹350, 20kg ₹1300</p>
                  </div>
                  {newProdVariantPrices.length === 0 && (
                    <button type="button" onClick={() => setNewProdVariantPrices([{ name: '', price: '' }])}
                      style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      + Add Pricing
                    </button>
                  )}
                </div>
                {newProdVariantPrices.map((v, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input type="text" value={v.name} placeholder="e.g. 20kg"
                      onChange={e => setNewProdVariantPrices(prev => prev.map((row, i) => i === idx ? { ...row, name: e.target.value } : row))}
                      style={{ flex: 2, padding: '9px 12px', background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                    <div style={{ flex: 1, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: 13 }}>₹</span>
                      <input type="number" value={v.price} placeholder="Price"
                        onChange={e => setNewProdVariantPrices(prev => prev.map((row, i) => i === idx ? { ...row, price: e.target.value } : row))}
                        style={{ width: '100%', padding: '9px 12px 9px 22px', background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                    <button type="button" onClick={() => setNewProdVariantPrices(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', color: '#FCA5A5', width: 32, height: 32, borderRadius: '8px', cursor: 'pointer', flexShrink: 0, fontSize: 14 }}>✕</button>
                  </div>
                ))}
                {newProdVariantPrices.length > 0 && (
                  <button type="button" onClick={() => setNewProdVariantPrices(prev => [...prev, { name: '', price: '' }])}
                    style={{ background: 'transparent', border: '1px dashed #475569', color: '#94A3B8', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
                    + Add another variant price
                  </button>
                )}
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
                  <input type="text" inputMode="numeric" value={newProdHsnCode} onChange={e => setNewProdHsnCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="e.g. 1905" maxLength={8} style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748B' }}>4, 6 or 8 digits only (optional)</p>
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
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>Category <span style={{ fontWeight: 400, color: '#64748B' }}>(for storefront filters)</span></label>
                  <input list="new-prod-cat-list" type="text" value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} placeholder="e.g. Snacks" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }} />
                  <datalist id="new-prod-cat-list">
                    {categorySuggestionsFor(shopCategory).map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: 'bold' }}>SKU / Internal Code <span style={{ fontWeight: 400, color: '#64748B' }}>(optional)</span></label>
                  <input type="text" value={newProdSku} onChange={e => setNewProdSku(e.target.value)} placeholder="e.g. RICE-5KG-01" style={{ width: '100%', padding: '12px 16px', background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }} />
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
                {isServiceBusiness
                  ? 'Unlock staff scheduling, automated reminders, and recurring bookings as your service business grows.'
                  : 'Unlock high-fidelity retail tools: barcode compliance, direct GST invoicing, CA Ledger access, and multi-staff lock-outs.'}
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
                const isPopular = plan.id === 'pro' || plan.id === 'service_pro' || plan.name.toLowerCase().includes('pro');
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

      {showVoiceRecorderModal && (
        <VoiceOrderRecorderModal
          wholesaleCatalog={wholesaleCatalog}
          onConfirmOrder={handleConfirmVoiceOrder}
          onClose={() => setShowVoiceRecorderModal(false)}
        />
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
                <input type="number" min="0" max="99" value={editProdDiscountPct} onChange={e => setEditProdDiscountPct(e.target.value === '' ? '' : String(Math.max(0, Math.min(99, parseInt(e.target.value) || 0))))}
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
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>Just labels, all variants share the price above — e.g. T-shirt colours.</p>
            </div>

            <div style={{ marginBottom: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editProdVariantPrices.length ? '12px' : 0 }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#0F172A', fontWeight: 'bold' }}>💰 Different price per variant?</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>e.g. Rice Bag — 5kg ₹350, 20kg ₹1300</p>
                </div>
                {editProdVariantPrices.length === 0 && (
                  <button type="button" onClick={() => setEditProdVariantPrices([{ name: '', price: '' }])}
                    style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    + Add Pricing
                  </button>
                )}
              </div>
              {editProdVariantPrices.map((v, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input type="text" value={v.name} placeholder="e.g. 20kg"
                    onChange={e => setEditProdVariantPrices(prev => prev.map((row, i) => i === idx ? { ...row, name: e.target.value } : row))}
                    style={{ flex: 2, padding: '9px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px' }} />
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>₹</span>
                    <input type="number" value={v.price} placeholder="Price"
                      onChange={e => setEditProdVariantPrices(prev => prev.map((row, i) => i === idx ? { ...row, price: e.target.value } : row))}
                      style={{ width: '100%', padding: '9px 12px 9px 22px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => setEditProdVariantPrices(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', width: 32, height: 32, borderRadius: '8px', cursor: 'pointer', flexShrink: 0, fontSize: 14 }}>✕</button>
                </div>
              ))}
              {editProdVariantPrices.length > 0 && (
                <button type="button" onClick={() => setEditProdVariantPrices(prev => [...prev, { name: '', price: '' }])}
                  style={{ background: 'transparent', border: '1px dashed #CBD5E1', color: '#64748B', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
                  + Add another variant price
                </button>
              )}
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
                <input type="text" inputMode="numeric" value={editProdHsnCode} onChange={e => setEditProdHsnCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="e.g. 1905" maxLength={8} style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>4, 6 or 8 digits only (optional)</p>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Category <span style={{ fontWeight: 400, color: '#94A3B8' }}>(storefront filters)</span></label>
                <input list="edit-prod-cat-list" type="text" value={editProdCategory} onChange={e => setEditProdCategory(e.target.value)} placeholder="e.g. Snacks" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                <datalist id="edit-prod-cat-list">
                  {categorySuggestionsFor(shopCategory).map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>SKU / Internal Code <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
                <input type="text" value={editProdSku} onChange={e => setEditProdSku(e.target.value)} placeholder="e.g. RICE-5KG-01" style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
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
      {pdfShareBannerEl}

      {/* Hidden, always-mounted QR canvas used by downloadQrPoster /
          downloadQrPng — rendering it here (unconditionally, regardless
          of active tab) guarantees it's available no matter which screen
          the owner clicks "Download Poster" from. The previous approach
          scraped a DOM element that only existed on one specific mobile
          settings screen, producing a poster with a blank QR box when
          clicked from anywhere else. */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
        <QRCodeCanvas ref={posterQrRef} value={getShopUrl()} size={1024} level="H" includeMargin={false} fgColor="#0F172A" bgColor="#FFFFFF" />
      </div>
      
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
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.9, color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentBranch?.name || shop.name}
            {shop?.publicCode && <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#818CF8', fontWeight: 700 }}>· {shop.publicCode}</span>}
            {branchSwitcherEl}
          </p>
          <span style={{ display: 'inline-block', marginTop: '4px', background: isOpenNow ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: isOpenNow ? '#4ADE80' : '#F87171', border: `1px solid ${isOpenNow ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>
            {isOpenNow ? '● Open Now' : `● Closed`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Notification bell — was ENTIRELY missing on mobile before
              this fix (only ever mounted in the desktop-only render
              branch above). Given most shop owners use this app on
              their phone, that meant the majority of shops never saw
              an in-app alert for a new order or booking at all — the
              exact bug being reported. userId is targetShopId (not
              user?.id) so it resolves correctly for staff logins
              (targetShopId = their staff_of shop) and when viewing a
              branch (targetShopId = the branch id) — notifications are
              always addressed to shop_id on the order, which is
              targetShopId in every one of those cases, not the
              logged-in individual's own id. */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }}>
            <NotificationCenter
              userId={targetShopId}
              onToast={(row) => toast.info(row.title, { autoClose: 5000, position: 'top-center' })}
            />
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', width: 'auto', flexShrink: 0 }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {isOwner && isViewingMain && isOnTrial && !trialBannerDismissed && (
        <div style={{ background: trialDaysLeft >= 5 ? 'linear-gradient(90deg,#16A34A,#15803D)' : trialDaysLeft >= 3 ? 'linear-gradient(90deg,#D97706,#B45309)' : 'linear-gradient(90deg,#DC2626,#B91C1C)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
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

      {activeTab === 'dashboard' && (
        <div style={{ paddingBottom: 80, background: '#F8FAFC', minHeight: '100vh' }}>
          <ServiceBusinessHome
            shopId={targetShopId}
            shopName={shop.name}
            orders={orders}
            setActiveTab={setActiveTab}
            onOrderCreated={loadData}
          />
        </div>
      )}

      {activeTab === 'home' && (
        <>
          {/* Compact alert chips — show ONLY if there's something actionable.
              No banner, no stats grid, no quick-actions block. Cashier should
              open the app and see the billing tool, not a dashboard. Stats /
              insights live in the Reports tab on the bottom nav. Same chips
              also act as one-tap shortcuts to fix the issue. */}
          {(pendingOrders > 0 || products.filter(p => p.stock < (p.reorderLevel || 10)).length > 0) && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px 12px 0', overflowX: 'auto', flexWrap: 'nowrap' }}>
              {pendingOrders > 0 && (
                <button onClick={() => setActiveTab('bills')} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  <Receipt size={13} /> {pendingOrders} new {pendingOrders === 1 ? 'order' : 'orders'} →
                </button>
              )}
              {(() => {
                const low = products.filter(p => p.stock < (p.reorderLevel || 10));
                if (!low.length) return null;
                return (
                  <button onClick={() => setActiveTab('products')} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    ⚠ {low.length} low stock →
                  </button>
                );
              })()}
            </div>
          )}

          <MobilePOS
            products={products}
            filteredProducts={filteredProducts}
            billItems={billItems}
            search={search}
            setSearch={setSearch}
            onVoiceAddToBill={handleVoiceAddToBill}
            isListeningPOS={isListeningPOS}
            addToBill={addToBill}
            updateBillItemQty={updateBillItemQty}
            removeBillItem={removeBillItem}
            setShowScanner={setShowScanner}
            setShowAddProductModal={setShowAddProductModal}
            setActiveTab={setActiveTab}
            isOwner={isOwner}
            flashSales={flashSales}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            manualDiscountPct={manualDiscountPct}
            setManualDiscountPct={setManualDiscountPct}
            discountAmount={discountAmount}
            manualDiscountAmt={manualDiscountAmt}
            roundOff={roundOff}
            setRoundOff={setRoundOff}
            billTotal={billTotal}
            onCheckout={sendWhatsAppBill}
            onPrint={printCurrentBill}
            onClearCart={clearCart}
            onOpenDashboard={() => setShowMobileDashboard(true)}
            onShowUpiQr={handleShowUpiQr}
            updateBillItemDiscount={updateBillItemDiscount}
          />
          {showMobileDashboard && (
            <MobileDashboard
              onClose={() => setShowMobileDashboard(false)}
              products={products}
              sales={sales}
              pendingOrders={pendingOrders}
              payable={payable}
              dailyTarget={dailyTarget}
              handleSetDailyTarget={handleSetDailyTarget}
              todayBillsCount={Array.isArray(orders) ? orders.filter(b => {
                if (!b?.created_at && !b?.createdAt) return false;
                const d = new Date(b.created_at || b.createdAt);
                const now = new Date();
                return d.toDateString() === now.toDateString();
              }).length : 0}
              handleShowUpiQr={handleShowUpiQr}
              handleShareShop={handleShareShop}
              setShowScanner={setShowScanner}
              setActiveTab={setActiveTab}
              setShowAddProductModal={setShowAddProductModal}
              shopName={shop?.name || 'Your Shop'}
              isOwner={isOwner}
            />
          )}
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
              if (billsSubTab === 'sales' ? isDraft : !isDraft) return false;
              // Staff only sees their own bills. Owner sees everything.
              // Staff ID was encoded into o.userId at bill-creation time
              // as `walk-in:Name:Phone:staff:<staffId>:<staffName>` (see
              // staffSuffix at line ~872). Bills from BEFORE staff
              // accounts existed, or bills generated by the owner, won't
              // carry a staffId — those are hidden from staff (only the
              // owner should see them).
              if (user.role === 'staff') {
                const { staffId } = decodeOrderUserId(o.userId);
                if (staffId !== user.id) return false;
              }
              return true;
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
                      {o._branchName && <p style={{margin: '4px 0 0 0', fontSize: '10px', color: '#fff', background: '#4F46E5', display: 'inline-block', padding: '2px 7px', borderRadius: 5, fontWeight: 700}}>🏪 {o._branchName}</p>}
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
                  
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px'}}>
                    <span style={{fontSize:18, fontWeight:'bold', color:'#FBBF24'}}>₹{o.total}</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button onClick={() => setSelectedOrder(o)} style={{background:'#3B82F6', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', width: 'auto', flexShrink: 0}}>
                        View Receipt
                      </button>
                      
                      {billsSubTab === 'drafts' && type === 'estimate' && (
                        <button onClick={() => handleConvertEstimateToBill(o)} style={{background:'linear-gradient(135deg, #FBBF24, #D97706)', color:'#000', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', flexShrink: 0}}>
                          ⚡ Convert to Bill
                        </button>
                      )}

                      {o.status === 'Pending' && (
                        <>
                          <button onClick={() => acceptOrder(o.id)} style={{background:'linear-gradient(135deg,#22C55E,#16A34A)', color:'white', border:'none', padding:'8px 14px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4}}>
                            ✅ Accept &amp; Notify
                          </button>
                          <button onClick={() => openCancelModal(o)} style={{background:'#FEF2F2', color:'#EF4444', border:'1px solid #FCA5A5', padding:'8px 12px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4}}>
                            ✕ Cancel
                          </button>
                        </>
                      )}
                      
                      {o.status === 'Accepted' && !o.paymentVerified && (
                        <button onClick={() => verifyOrderPayment(o.id)} style={{background:'linear-gradient(135deg,#4F46E5,#4338CA)', color:'white', border:'none', padding:'8px 14px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4}}>
                          💰 Verify Payment
                        </button>
                      )}

                      {o.status === 'Accepted' && (
                        <button onClick={() => handleOpenReturnModal(o)} style={{background:'#EF4444', color:'white', border:'none', padding:'8px 14px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', flexShrink: 0}}>
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
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', width: '100%', maxWidth: '320px', borderRadius: '4px', padding: '24px', color: '#000', fontFamily: 'monospace', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflowY: 'auto', maxHeight: '90vh' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', textTransform: 'uppercase' }}>{shop.name}</h2>
                <p style={{ margin: 0, fontSize: '12px' }}>Ph: {shop.phone}</p>
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
                {(() => {
                  // Total of all per-line discounts so we can show a "You saved ₹X"
                  // line at the bottom, which is what shoppers love to see on a receipt.
                  let totalItemSavings = 0;
                  return (
                    <>
                      {selectedOrder.items.map((item, idx) => {
                        const lineBase = item.price * item.qty;
                        const iDisc = item.itemDiscount || 0;
                        const iDiscAmt = iDisc > 0 ? Math.round(lineBase * iDisc / 100) : 0;
                        const lineTotal = lineBase - iDiscAmt;
                        if (iDiscAmt > 0) totalItemSavings += iDiscAmt;
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              {item.qty}x {item.name}{item.selectedVariant ? ` (${item.selectedVariant})` : ''}
                              {iDisc > 0 && (
                                <span style={{ display: 'block', fontSize: 10, color: '#16A34A', fontWeight: 'bold', marginTop: 1 }}>
                                  ↓ {iDisc}% off — saved ₹{iDiscAmt}
                                </span>
                              )}
                            </span>
                            <span style={{ flexShrink: 0, textAlign: 'right' }}>
                              {iDiscAmt > 0 && (
                                <span style={{ display: 'block', fontSize: 10, color: '#888', textDecoration: 'line-through' }}>₹{lineBase}</span>
                              )}
                              <span style={{ fontWeight: iDiscAmt > 0 ? 'bold' : 'normal', color: iDiscAmt > 0 ? '#16A34A' : '#000' }}>₹{lineTotal}</span>
                            </span>
                          </div>
                        );
                      })}
                      {/* Bill-level discount line (separate from item-level) */}
                      {selectedOrder.discountAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, color: '#16A34A', fontWeight: 'bold' }}>
                          <span>Bill Discount</span>
                          <span>−₹{selectedOrder.discountAmount}</span>
                        </div>
                      )}
                      {/* Total customer savings — banner */}
                      {(totalItemSavings + (selectedOrder.discountAmount || 0)) > 0 && (
                        <div style={{ marginTop: 8, background: '#DCFCE7', border: '1px dashed #16A34A', padding: '6px 10px', borderRadius: 4, textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#15803D' }}>
                          🎉 YOU SAVED ₹{totalItemSavings + (selectedOrder.discountAmount || 0)} ON THIS BILL
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '12px', marginTop: '12px' }}>
                {selectedOrder.refundAmount > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#888' }}>
                      <span>Original Total</span>
                      <span style={{ textDecoration: 'line-through' }}>₹{selectedOrder.total}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '4px' }}>
                      <span>NET PAYABLE</span>
                      <span>₹{(Number(selectedOrder.total) - Number(selectedOrder.refundAmount)).toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                    <span>TOTAL</span>
                    <span>₹{selectedOrder.total}</span>
                  </div>
                )}
              </div>

              {/* Return info — shown when this bill has any returned items */}
              {(selectedOrder.returnedAt || selectedOrder.refundAmount > 0) && (
                <div style={{ marginTop: '10px', padding: '10px', background: '#F5F3FF', border: '1px dashed #7C3AED', borderRadius: '6px', fontSize: '11px' }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 'bold', color: '#7C3AED' }}>
                    ↩️ {selectedOrder.status === 'Returned' ? 'Fully Returned' : 'Partial Return'}
                  </p>
                  {selectedOrder.returnedAt && (
                    <p style={{ margin: '0 0 2px', color: '#6D28D9' }}>
                      On {new Date(selectedOrder.returnedAt).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  )}
                  {selectedOrder.returnedItems?.length > 0 && (
                    <p style={{ margin: '0 0 2px', color: '#6D28D9' }}>
                      Items: {selectedOrder.returnedItems.map(it => `${it.name} x${it.returnQty}`).join(', ')}
                    </p>
                  )}
                  <p style={{ margin: 0, color: '#6D28D9' }}>
                    Refunded ₹{Number(selectedOrder.refundAmount||0).toFixed(2)} via {selectedOrder.refundMode || 'cash'}
                  </p>
                </div>
              )}

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
                <button onClick={() => printReceiptPDF(selectedOrder)} style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>🖨️ Print / Share</button>
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
          
          {products.length === 0 && (
            <p style={{ padding: 20, textAlign: 'center', color: dataLoadFailed ? '#B91C1C' : '#94A3B8' }}>
              {dataLoadFailed
                ? "Couldn't load your inventory — this is a connection problem, not lost data. Refresh to retry."
                : 'No products in inventory.'}
            </p>
          )}
          
          <div style={{ padding: '12px' }}>
            {importFromMainEl}
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
                    {p.category && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(79,70,229,0.15)', color: '#818CF8', fontWeight: '700' }}>
                        🏷️ {p.category}
                      </span>
                    )}
                    {p.sku && (
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(148,163,184,0.15)', color: '#94A3B8', fontWeight: '600', fontFamily: 'monospace' }}>
                        SKU: {p.sku}
                      </span>
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
                            const ref = encodeURIComponent('Credit-' + (c.id || '').slice(0, 8));
                            const note = encodeURIComponent(`Payment to ${c.distName || 'Distributor'}`);
                            window.open(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(c.distName || shop.name)}&am=${c.amount}&tn=${note}&tr=${ref}&cu=INR`, '_blank');
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

      {/* BOOKINGS TAB */}
      {activeTab === 'bookings' && (
        <div style={{ paddingBottom: 80, background: '#F8FAFC', minHeight: '100vh' }}>
          <DesktopBookings shopId={targetShopId} shopName={shop.name} sysSettings={sysSettings} onAddonPurchased={loadData} />
        </div>
      )}

      {/* MEMBERSHIP TAB */}
      {isOwner && activeTab === 'membership' && (
        <div style={{ paddingBottom: 80, background: '#F8FAFC', minHeight: '100vh' }}>
          <DesktopMembership shopId={targetShopId} />
        </div>
      )}

      {/* FEEDBACK TAB */}
      {isOwner && activeTab === 'feedback' && (
        <div style={{ paddingBottom: 80, background: '#F8FAFC', minHeight: '100vh' }}>
          <DesktopFeedback shopId={targetShopId} />
        </div>
      )}

      {/* CUSTOMERS TAB — was reachable from nowhere on mobile at all
          (no bottom nav icon, no other button anywhere) until the new
          More menu; had no mobile content block either, so even
          reaching it would have shown a blank screen. Reuses the same
          shared component desktop uses — despite the name, these
          "Desktop*" components are already responsive and reused on
          mobile elsewhere in this same file (Membership, Feedback,
          Bookings all do the same). */}
      {isOwner && activeTab === 'customers' && (
        <div style={{ paddingBottom: 80, background: '#F8FAFC', minHeight: '100vh' }}>
          <DesktopCustomers orders={orders} targetShopId={targetShopId} />
        </div>
      )}

      {/* EXPENSES TAB — same gap as Customers above, same fix. */}
      {isOwner && activeTab === 'expenses' && (
        <div style={{ paddingBottom: 80, background: '#F8FAFC', minHeight: '100vh' }}>
          <DesktopExpenses targetShopId={targetShopId} orders={orders} />
        </div>
      )}

      {/* RESTOCKING SUPPLY TAB */}
      {activeTab === 'restock' && (
        <div style={{ paddingBottom: 80 }}>
          <div style={{ background: '#1E222D', padding: '16px', borderBottom: '1px solid #2A2F3D' }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={20} color="#3B82F6" /> Supply & Wholesale Restock
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Order wholesale goods on credit directly from FMCG Distributors.</p>
          </div>
          
          <div style={{ padding: '16px' }}>
            {/* AI Voice Order Recorder Header Banner */}
            <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E1B4B)', border: '2px solid #6366F1', borderRadius: '16px', padding: '20px', marginBottom: '20px', color: '#FFFFFF', boxShadow: '0 8px 25px rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ background: 'rgba(99,102,241,0.2)', border: '2px solid #818CF8', borderRadius: '50%', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', boxShadow: '0 0 20px rgba(129,140,248,0.4)', flexShrink: 0 }}>
                  <Mic size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🎙️ AI Voice Stock Order Assistant
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#C7D2FE' }}>
                    Speak your full order continuously (e.g. <i>"Chikki 2 jars, Biscuit 10 cases, Red Label Tea 5 boxes"</i>). AI parses products, quantities &amp; pack sizes for re-verification!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowVoiceRecorderModal(true)}
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', whiteSpace: 'nowrap' }}
              >
                🎙️ Tap to Speak Whole Order
              </button>
            </div>
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
            <div style={{ background: 'linear-gradient(145deg, #1E293B, #0F172A)', border: '2px solid #334155', borderRadius: '16px', padding: '18px', marginBottom: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              
              {/* Cart Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🛒 Restock Basket ({Object.keys(restockCart).length} SKUs)
                  </h3>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Order FMCG supplies directly from your distributor</span>
                </div>

                <button
                  onClick={() => setShowVoiceRecorderModal(true)}
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}
                >
                  🎙️ AI Voice Order
                </button>
              </div>

              {Object.keys(restockCart).length === 0 ? (
                <div style={{ background: '#0F172A', border: '2px dashed #334155', borderRadius: '12px', padding: '24px 16px', textAlign: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: '13px', margin: '0 0 14px' }}>Your restock basket is empty. Record full voice order below or add bulk products from the catalog.</p>
                  <button
                    onClick={() => setShowVoiceRecorderModal(true)}
                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', width: '100%' }}
                  >
                    🎙️ Tap to Speak &amp; Order Supplies by Voice
                  </button>
                </div>
              ) : (
                <>
                  {/* Cart Item Cards (Editable) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {Object.entries(restockCart).map(([prodId, qty]) => {
                      const prod = wholesaleCatalog.find(p => p.id === prodId);
                      if (!prod) return null;
                      const lineTotal = prod.price * qty;

                      return (
                        <div key={prodId} style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#FFF' }}>{prod.name}</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                              ₹{prod.price} / unit {prod.packSize ? `· (${prod.packSize}/box)` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Quantity Stepper */}
                            <div style={{ display: 'flex', alignItems: 'center', background: '#1E293B', border: '1px solid #475569', borderRadius: '8px', overflow: 'hidden' }}>
                              <button
                                onClick={() => handleRestockQtyChange(prodId, -1)}
                                style={{ background: '#334155', border: 'none', color: '#FFF', width: 32, height: 32, fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={qty}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  const diff = val - qty;
                                  if (diff !== 0) handleRestockQtyChange(prodId, diff);
                                }}
                                style={{ width: 44, textAlign: 'center', background: 'transparent', border: 'none', color: '#FFF', fontWeight: 800, fontSize: 13, outline: 'none' }}
                              />
                              <button
                                onClick={() => handleRestockQtyChange(prodId, 1)}
                                style={{ background: '#334155', border: 'none', color: '#FFF', width: 32, height: 32, fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                +
                              </button>
                            </div>

                            <div style={{ fontSize: '15px', fontWeight: '900', color: '#22C55E', minWidth: 60, textAlign: 'right' }}>
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </div>

                            <button
                              onClick={() => handleRestockQtyChange(prodId, -qty)}
                              style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#EF4444', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                              title="Remove item"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Special Order Notes input */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#CBD5E1', display: 'block', marginBottom: 4 }}>
                      📝 Special Order Notes / Delivery Instructions for Distributor:
                    </label>
                    <input
                      type="text"
                      value={restockNotes}
                      onChange={e => setRestockNotes(e.target.value)}
                      placeholder="e.g. Urgent delivery before 4 PM, call on arrival..."
                      style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', color: '#FFF', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Cart Summary & Order Action */}
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Total Basket Amount</div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#FBBF24' }}>
                          ₹{Object.entries(restockCart).reduce((sum, [prodId, qty]) => {
                            const prod = wholesaleCatalog.find(p => p.id === prodId);
                            return sum + (prod ? prod.price * qty : 0);
                          }, 0).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button
                        onClick={() => setShowVoiceRecorderModal(true)}
                        style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10B981', color: '#10B981', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        🎙️ Record More Items
                      </button>
                    </div>

                    <button
                      onClick={handlePlaceRestockOrder}
                      style={{ width: '100%', background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '15px', boxShadow: '0 6px 20px rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      🚀 Submit Stock Order to Distributor
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Wholesale Catalog List & Search Bar with Voice Order */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#94A3B8', margin: 0 }}>📦 FMCG Wholesale Catalog ({wholesaleCatalog.length})</h3>
              
              {wholesaleCatalog.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? 0 : 220 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#818CF8' }} />
                    <input
                      type="text"
                      value={wholesaleSearchQuery}
                      onChange={e => setWholesaleSearchQuery(e.target.value)}
                      placeholder="Fast search catalog name, SKU..."
                      style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: '#FFF', padding: '6px 28px 6px 30px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {wholesaleSearchQuery && (
                      <button onClick={() => setWholesaleSearchQuery('')} style={{ position: 'absolute', right: 8, top: 7, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <VoiceOrderInput onTranscript={(text) => {
                    setWholesaleSearchQuery(text);
                    handleShopVoiceRestockOrder(text);
                  }} placeholder="Voice search..." />
                </div>
              )}
            </div>

            {wholesaleCatalog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                <p style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: '0 0 6px' }}>No linked distributors yet</p>
                <p style={{ color: '#94A3B8', fontSize: '12.5px', margin: 0, lineHeight: 1.5 }}>
                  You'll only see products from distributors you've connected with — go to Settings and enter a distributor's code (starts with "DST-") to start ordering.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {wholesaleCatalog.filter(p => {
                  if (!wholesaleSearchQuery.trim()) return true;
                  const q = wholesaleSearchQuery.toLowerCase().trim();
                  return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
                }).map(p => (
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

            {/* My Stock Orders — same gap as desktop had: stockOrders was
                loaded but never shown anywhere on mobile either. A shop
                placing an order here had no way to check its status,
                see a dispatch date, or confirm they'd received it. */}
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#94A3B8', margin: '24px 0 12px' }}>📋 My Stock Orders</h3>
            {stockOrders.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: '13px' }}>No stock orders placed yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stockOrders.map(o => {
                  const MOBILE_BADGE = {
                    pending:    { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'Pending' },
                    accepted:   { bg: 'rgba(34,197,94,0.15)',  color: '#22C55E', label: 'Accepted' },
                    dispatched: { bg: 'rgba(59,130,246,0.15)', color: '#3B82F6', label: '📦 Dispatched' },
                    delivered:  { bg: 'rgba(16,185,129,0.15)', color: '#10B981', label: '✅ Delivered' },
                    rejected:   { bg: 'rgba(239,68,68,0.15)',  color: '#EF4444', label: 'Rejected' },
                  };
                  const badge = MOBILE_BADGE[o.status] || MOBILE_BADGE.pending;
                  return (
                    <div key={o.id} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>#{(o.id || '').slice(0, 8).toUpperCase()}</span>
                            <span style={{ fontSize: 10, background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{badge.label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                            {new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · ₹{o.total}
                          </div>
                          {o.status === 'accepted' && o.expectedDispatchDate && (
                            <div style={{ fontSize: 11, color: '#818CF8', fontWeight: 700, marginTop: 3 }}>
                              🕓 Expected: {new Date(o.expectedDispatchDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </div>
                          )}
                        </div>
                        {o.status === 'dispatched' && (
                          <button onClick={() => handleMarkStockOrderDelivered(o.id)}
                            style={{ background: '#10B981', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: 'auto', flexShrink: 0 }}>
                            ✅ Confirm
                          </button>
                        )}
                        {/* Delivered stock does NOT auto-add to inventory —
                            distributor and shop catalogs are separate, so
                            this is an explicit step the shop takes when the
                            goods physically arrive. Without this button the
                            shop had to hand-edit every product after every
                            delivery. */}
                        {o.status === 'delivered' && !o.receivedAt && (
                          <button onClick={() => handleReceiveStockOrder(o.id)}
                            style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: 'auto', flexShrink: 0 }}>
                            📦 Add to Stock
                          </button>
                        )}
                        {o.status === 'delivered' && o.receivedAt && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', flexShrink: 0 }}>
                            ✅ In stock
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORTS & ANALYTICS TAB */}
      {/* Mobile: unified branches dashboard */}
      {isOwner && hasMultipleBranches && activeTab === 'branches' && (
        <BranchesDashboard
          orders={orders}
          branches={visibleBranches}
          setActiveBranchId={setActiveBranchId}
          setActiveTab={setActiveTab}
        />
      )}

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
              {reportsScopeUI}
              {reportsBreakdownEl}
              
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
                        { label: '📥 Tally XML', action: () => { downloadTallyXML(orders.filter(o => o.status === 'completed'), shop.name); setTallyMenuOpen(false); } },
                        { label: '📋 GSTR-1 CSV', action: () => { downloadCSV(generateGSTR1CSV(orders.filter(o => o.status === 'completed'), shop.gstNumber || shop.gstin), `GSTR1_${new Date().toISOString().slice(0,10)}.csv`); setTallyMenuOpen(false); } },
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

            {/* Real background push — works even when the app/tab is
                closed, unlike the plain Notification API fallback this
                file already had (requestNotificationPermission earlier
                in this component only fires while the tab is open).
                Was built weeks ago but never actually rendered anywhere
                in the whole app — nobody had a way to turn it on. */}
            <div style={{ marginBottom: '16px' }}>
              <PushToggle userId={targetShopId} />
            </div>

            {/* Branches manager — first card so it's easy to find.
                Only main owners see this; branches logged in directly
                don't manage sub-branches. */}
            {isMainOwner && isViewingMain && (
              <BranchesManager
                ownerId={user.id}
                onChange={async () => {
                  const fresh = await safe(() => api.getOwnedBranches(user.id));
                  if (Array.isArray(fresh)) setBranches(fresh);
                }}
              />
            )}
            {/* SaaS Subscription Info Card — main shop only */}
            {isViewingMain && <div style={{ background: 'linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.9))', border: `1px solid ${isOnTrial ? 'rgba(245,158,11,0.4)' : 'rgba(139,92,246,0.3)'}`, borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: `0 8px 32px ${isOnTrial ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.1)'}` }}>
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
            </div>}

            {/* Logo Upload Section */}
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🖼️ Shop Logo</h3>
              {logo ? (
                <img src={logo} alt="Shop Logo" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3B82F6', marginBottom: '12px' }} />
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#0F172A', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>No Logo</div>
              )}
              <input type="file" accept="image/*" onChange={handleMobileLogoFile} style={{ display: 'block', margin: '0 auto', fontSize: '12px', color: '#94A3B8' }} />
              {logo && (
                <button onClick={handleLogoRemove} style={{ marginTop: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', color: '#FCA5A5', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Remove Logo
                </button>
              )}
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
              <button onClick={() => navigate('/shop/van-purchases')}
                style={{ background: '#0F172A', border: '1px solid #334155', color: '#93C5FD', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginBottom: '14px' }}>
                🧾 View purchases &amp; returns from distributor vans
              </button>

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

              {/* Invoice Template — same picker as desktop Settings,
                  restyled for the mobile card's dark theme. Was
                  missing here entirely: desktop got the picker but
                  mobile shop owners (likely the majority of users)
                  had no way to select anything but the default. */}
              <label style={{ display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '8px', fontWeight: '700' }}>INVOICE TEMPLATE</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px', marginBottom: '14px' }}>
                {INVOICE_TEMPLATES.map(t => {
                  const ICONS = { classic: '🧾', wholesale: '📋', gst_tax: '📑', minimal: '⚡', modern: '✨' };
                  const active = printTemplate === t.id;
                  return (
                    <button key={t.id} onClick={() => setPrintTemplate(t.id)}
                      style={{ padding: '10px 8px', border: active ? '2px solid #4F46E5' : '1px solid #334155', background: active ? 'rgba(79,70,229,0.2)' : '#0F172A', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: '16px', marginBottom: '3px' }}>{ICONS[t.id] || '🧾'}</div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: active ? '#818CF8' : '#fff' }}>{t.name}</div>
                    </button>
                  );
                })}
              </div>
              {printTemplate === 'wholesale' && (
                <p style={{ fontSize: '10.5px', color: '#64748B', margin: '-8px 0 14px', lineHeight: 1.5 }}>
                  Shows each item's internal code from the product's SKU field.
                </p>
              )}

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
                  {' · '}{(INVOICE_TEMPLATES.find(t => t.id === printTemplate)?.name) || 'Classic'}
                  {' · '}{printFontSize === 'large' ? 'Large' : 'Normal'} font
                  {' · '}{printShowLogo ? 'With logo' : 'No logo'}
                  {' · '}{printCopies} cop{printCopies === 1 ? 'y' : 'ies'}
                </p>
              </div>

              <button onClick={handleTestPrint}
                style={{ width: '100%', background: 'transparent', color: '#818CF8', border: '2px solid #4F46E5', padding: '11px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', marginBottom: '8px' }}>
                🧪 Print Test Receipt
              </button>
              <button onClick={handleSavePrintSettings}
                style={{ width: '100%', background: '#4F46E5', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                🖨️ Save Print Settings
              </button>
              <p style={{ fontSize: '10px', color: '#64748B', margin: '8px 0 0 0', textAlign: 'center' }}>
                Test print uses the options above (even unsaved) — if either edge mark is cut off, pick a different paper size.
              </p>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: s.status === 'disabled' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)', color: s.status === 'disabled' ? '#EF4444' : '#22C55E', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', border: `1px solid ${s.status === 'disabled' ? '#EF4444' : '#22C55E'}`, fontWeight: 'bold' }}>
                      {s.status === 'disabled' ? '● Disabled' : '● Active'}
                    </span>
                    {s.status !== 'disabled' && (
                      <button onClick={() => handleDeleteStaff(s.id, s.name)} style={{ background: 'none', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DANGER ZONE — Reset Test Data (mobile) — main shop only */}
          {isOwner && isViewingMain && (
            <div style={{ background: '#1E0E0E', border: '1.5px solid #7F1D1D', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ Danger Zone</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>Irreversible actions — use with care.</p>
              <div style={{ background: '#0F172A', border: '1px solid #7F1D1D', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>Reset Test Data</div>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 6px', lineHeight: '1.5' }}>
                  Deletes all bills, estimates, challans, credit ledger, and stock orders. Invoice numbers restart at #0001.
                </p>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 14px' }}>
                  ✅ Kept: products, customers, staff, logo, QR &amp; settings.
                </p>
                <button onClick={handleResetTestData}
                  style={{ width: '100%', background: '#7F1D1D', border: 'none', color: '#fff', padding: '12px', borderRadius: '9px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                  🗑️ Reset Now
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAYMENT QR DISPLAY MODAL */}
      {showPaymentQrModal && (paymentQr || upiId) && (
        <div onClick={() => setShowPaymentQrModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%', bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px', fontWeight: 800 }}>{user.name}</h2>
          <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '20px' }}>Scan to Pay • ₹{billTotal > 0 ? billTotal : '0'}</p>
          <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {paymentQr ? (
              <img src={paymentQr} alt="Payment QR" style={{ width: '260px', height: '260px', objectFit: 'contain' }} />
            ) : (
              <QRCodeSVG 
                value={buildUpiUri({ upiId, merchantUpiId: user.merchantUpiId, merchantCode: user.merchantCode, name: user.name }, { amount: billTotal || 0, txnRef: upiTxnRef, note: 'Bill Payment' })}
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
            
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', fontWeight: 'bold' }}>Refund Mode</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                {[['cash','💵','Cash'],['upi','📱','UPI'],['card','💳','Card'],['store_credit','🎟️','Credit']].map(([key, icon, label]) => (
                  <button key={key} onClick={() => setReturnRefundMode(key)}
                    style={{ padding: '8px 4px', borderRadius: '8px', border: returnRefundMode === key ? '2px solid #EF4444' : '1px solid #E2E8F0', background: returnRefundMode === key ? '#FEF2F2' : '#F8FAFC', color: returnRefundMode === key ? '#EF4444' : '#64748B', fontSize: '10px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' }}>
                    {icon}<br />{label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', color: '#EF4444' }}>
                <span>Total Refund:</span>
                <span>₹{returnOrder.items.reduce((sum, item) => sum + (item.price * returnItemsState[item.id]), 0).toFixed(2)}</span>
              </div>
              <button onClick={handleProcessReturn} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                Confirm Return &amp; Notify Customer
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
        <div onClick={() => setShowAddProductModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%', bottom: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(2px)' }}>
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
                <input type="number" min="0" max="99" value={newProdDiscountPct} onChange={e => setNewProdDiscountPct(e.target.value === '' ? '' : String(Math.max(0, Math.min(99, parseInt(e.target.value) || 0))))}
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
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>Just labels, all variants share the price above — e.g. T-shirt colours.</p>
            </div>

            <div style={{ marginBottom: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: newProdVariantPrices.length ? '12px' : 0 }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#0F172A', fontWeight: 'bold' }}>💰 Different price per variant?</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>e.g. Rice Bag — 5kg ₹350, 20kg ₹1300</p>
                </div>
                {newProdVariantPrices.length === 0 && (
                  <button type="button" onClick={() => setNewProdVariantPrices([{ name: '', price: '' }])}
                    style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    + Add
                  </button>
                )}
              </div>
              {newProdVariantPrices.map((v, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input type="text" value={v.name} placeholder="e.g. 20kg"
                    onChange={e => setNewProdVariantPrices(prev => prev.map((row, i) => i === idx ? { ...row, name: e.target.value } : row))}
                    style={{ flex: 2, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px' }} />
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>₹</span>
                    <input type="number" value={v.price} placeholder="Price"
                      onChange={e => setNewProdVariantPrices(prev => prev.map((row, i) => i === idx ? { ...row, price: e.target.value } : row))}
                      style={{ width: '100%', padding: '10px 12px 10px 22px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => setNewProdVariantPrices(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', width: 36, height: 36, borderRadius: '8px', cursor: 'pointer', flexShrink: 0, fontSize: 15 }}>✕</button>
                </div>
              ))}
              {newProdVariantPrices.length > 0 && (
                <button type="button" onClick={() => setNewProdVariantPrices(prev => [...prev, { name: '', price: '' }])}
                  style={{ background: 'transparent', border: '1px dashed #CBD5E1', color: '#64748B', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
                  + Add another variant price
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                <input type="text" inputMode="numeric" value={newProdHsnCode} onChange={e => setNewProdHsnCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="e.g. 1905" maxLength={8} style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>4, 6 or 8 digits only (optional)</p>
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

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Category <span style={{ fontWeight: 400, color: '#94A3B8' }}>(filters)</span></label>
                <input list="m-new-prod-cat-list" type="text" value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} placeholder="e.g. Snacks" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px', boxSizing: 'border-box' }} />
                <datalist id="m-new-prod-cat-list">
                  {categorySuggestionsFor(shopCategory).map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>SKU <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
                <input type="text" value={newProdSku} onChange={e => setNewProdSku(e.target.value)} placeholder="e.g. RICE-5KG-01" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px', boxSizing: 'border-box' }} />
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%', bottom: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(2px)' }}>
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
                <input type="number" min="0" max="99" value={editProdDiscountPct} onChange={e => setEditProdDiscountPct(e.target.value === '' ? '' : String(Math.max(0, Math.min(99, parseInt(e.target.value) || 0))))}
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
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>Just labels, all variants share the price above — e.g. T-shirt colours.</p>
            </div>

            <div style={{ marginBottom: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editProdVariantPrices.length ? '12px' : 0 }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#0F172A', fontWeight: 'bold' }}>💰 Different price per variant?</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>e.g. Rice Bag — 5kg ₹350, 20kg ₹1300</p>
                </div>
                {editProdVariantPrices.length === 0 && (
                  <button type="button" onClick={() => setEditProdVariantPrices([{ name: '', price: '' }])}
                    style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    + Add
                  </button>
                )}
              </div>
              {editProdVariantPrices.map((v, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input type="text" value={v.name} placeholder="e.g. 20kg"
                    onChange={e => setEditProdVariantPrices(prev => prev.map((row, i) => i === idx ? { ...row, name: e.target.value } : row))}
                    style={{ flex: 2, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px' }} />
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>₹</span>
                    <input type="number" value={v.price} placeholder="Price"
                      onChange={e => setEditProdVariantPrices(prev => prev.map((row, i) => i === idx ? { ...row, price: e.target.value } : row))}
                      style={{ width: '100%', padding: '10px 12px 10px 22px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={() => setEditProdVariantPrices(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', width: 36, height: 36, borderRadius: '8px', cursor: 'pointer', flexShrink: 0, fontSize: 15 }}>✕</button>
                </div>
              ))}
              {editProdVariantPrices.length > 0 && (
                <button type="button" onClick={() => setEditProdVariantPrices(prev => [...prev, { name: '', price: '' }])}
                  style={{ background: 'transparent', border: '1px dashed #CBD5E1', color: '#64748B', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
                  + Add another variant price
                </button>
              )}
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
                <input type="text" inputMode="numeric" value={editProdHsnCode} onChange={e => setEditProdHsnCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="e.g. 1905" maxLength={8} style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px' }} />
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94A3B8' }}>4, 6 or 8 digits only (optional)</p>
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

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Category <span style={{ fontWeight: 400, color: '#94A3B8' }}>(filters)</span></label>
                <input list="m-edit-prod-cat-list" type="text" value={editProdCategory} onChange={e => setEditProdCategory(e.target.value)} placeholder="e.g. Snacks" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px', boxSizing: 'border-box' }} />
                <datalist id="m-edit-prod-cat-list">
                  {categorySuggestionsFor(shopCategory).map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>SKU <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
                <input type="text" value={editProdSku} onChange={e => setEditProdSku(e.target.value)} placeholder="e.g. RICE-5KG-01" style={{ width: '100%', padding: '12px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '15px', boxSizing: 'border-box' }} />
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
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', background: '#FFFFFF', padding: '6px 8px calc(6px + env(safe-area-inset-bottom, 0px)) 8px', borderTop: '1px solid #E2E8F0', zIndex: 100, boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)', boxSizing: 'border-box', overflow: 'hidden' }}>
        <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: (activeTab === 'home' || activeTab === 'dashboard') ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab(isServiceBusiness ? 'dashboard' : 'home')}>
          <Home size={18} style={{ margin: '0 auto 2px auto' }} />
          <p style={{ fontSize: '9px', margin: 0 }}>{isServiceBusiness ? 'Dashboard' : 'Home'}</p>
        </button>

        {isServiceBusiness && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'home' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('home')}>
            <IndianRupee size={18} style={{ margin: '0 auto 2px auto' }} />
            <p style={{ fontSize: '9px', margin: 0 }}>Sales</p>
          </button>
        )}

        {hasMultipleBranches && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'branches' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('branches')}>
            <Building2 size={18} style={{ margin: '0 auto 2px auto' }} />
            <p style={{ fontSize: '9px', margin: 0 }}>Branches</p>
          </button>
        )}
        
        {/* Products/Credit/Restock are retail concepts — a service
            business (salon, spa, clinic) has no product catalogue to
            manage stock-wise, no supplier credit book, and nothing to
            restock from a distributor. Desktop's sidebar already
            correctly hides these three for service businesses
            (retailOnly: true in DesktopSidebar.jsx's TABS config) —
            this mobile nav had no businessKind check on any of the
            three at all, so a service business on mobile saw all
            three regardless. Matching desktop's exact gating here. */}
        {isOwner && !isServiceBusiness && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'products' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('products')}>
            <Package size={18} style={{ margin: '0 auto 2px auto' }} />
            <p style={{ fontSize: '9px', margin: 0 }}>Products</p>
          </button>
        )}
        
        <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'bills' ? '#4F46E5' : '#64748B', position: 'relative' }} onClick={() => setActiveTab('bills')}>
          <Receipt size={18} style={{ margin: '0 auto 2px auto' }} />
          <p style={{ fontSize: '9px', margin: 0 }}>Bills</p>
          {pendingOrders > 0 && <span style={{position:'absolute', top:-4, right:'20%', background:'#EF4444', width:10, height:10, borderRadius:'50%'}}></span>}
        </button>

        {isOwner && !isServiceBusiness && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'credit' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('credit')}>
            <Wallet size={18} style={{ margin: '0 auto 2px auto' }} />
            <p style={{ fontSize: '9px', margin: 0 }}>Credit</p>
          </button>
        )}

        {isServiceBusiness && canBookings && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'bookings' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('bookings')}>
            <Scissors size={18} style={{ margin: '0 auto 2px auto' }} />
            <p style={{ fontSize: '9px', margin: 0 }}>Bookings</p>
          </button>
        )}

        {isOwner && !isServiceBusiness && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'restock' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('restock')}>
            <Truck size={18} style={{ margin: '0 auto 2px auto' }} />
            <p style={{ fontSize: '9px', margin: 0 }}>Restock</p>
          </button>
        )}
        
        {isOwner && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'reports' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('reports')}>
            <Book size={18} style={{ margin: '0 auto 2px auto' }} />
            <p style={{ fontSize: '9px', margin: 0 }}>Reports</p>
          </button>
        )}
        {isOwner && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: activeTab === 'profile' ? '#4F46E5' : '#64748B' }} onClick={() => setActiveTab('profile')}>
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '4px' }}>⚙️</span>
            <p style={{ fontSize: '9px', margin: 0 }}>Settings</p>
          </button>
        )}
        {isOwner && (
          <button type="button" style={{...styles.navBtn, background: 'none', border: 'none', font: 'inherit', color: ['customers', 'expenses', 'membership', 'feedback'].includes(activeTab) ? '#4F46E5' : '#64748B' }} onClick={() => setShowMoreMenu(true)}>
            <MoreHorizontal size={18} style={{ margin: '0 auto 2px auto' }} />
            <p style={{ fontSize: '9px', margin: 0 }}>More</p>
          </button>
        )}
      </div>

      {/* "More" overflow sheet — Customers, Expenses, Membership,
          Feedback had no way to be reached on mobile at all before
          this. Kept intentionally simple (a plain list, not a full
          redesign of the nav) since the goal is making these features
          reachable, not restyling the whole bottom nav tonight. */}
      {showMoreMenu && (
        <div onClick={() => setShowMoreMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', borderRadius: '16px 16px 0 0', padding: '8px 0 calc(8px + env(safe-area-inset-bottom, 0px)) 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 36, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '4px auto 12px auto' }} />
            {[
              { id: 'customers', Icon: Users, label: 'Customers' },
              { id: 'expenses', Icon: Wallet, label: 'Expenses' },
              { id: 'membership', Icon: CreditCard, label: 'Membership' },
              { id: 'feedback', Icon: Star, label: 'Feedback' },
            ].map(({ id, Icon, label }) => (
              <button key={id} type="button" onClick={() => { setActiveTab(id); setShowMoreMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', textAlign: 'left', fontSize: 15, fontWeight: 600, color: activeTab === id ? '#4F46E5' : '#1E293B', cursor: 'pointer' }}>
                <Icon size={20} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
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
                {isServiceBusiness
                  ? 'Unlock staff scheduling, automated reminders, and recurring bookings as your service business grows.'
                  : 'Unlock high-fidelity retail tools: barcode compliance, direct GST invoicing, CA Ledger access, and multi-staff lock-outs.'}
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
                const isPopular = plan.id === 'pro' || plan.id === 'service_pro' || plan.name.toLowerCase().includes('pro');
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

      {showVoiceRecorderModal && (
        <VoiceOrderRecorderModal
          wholesaleCatalog={wholesaleCatalog}
          onConfirmOrder={handleConfirmVoiceOrder}
          onClose={() => setShowVoiceRecorderModal(false)}
        />
      )}

      {/* CANCEL ORDER MODAL — only for Pending orders */}
      {showCancelModal && cancelTargetOrder && (() => {
        const decoded = decodeOrderUserId(cancelTargetOrder.userId);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '420px', borderRadius: '18px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1.5px solid #FECACA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '20px' }}>❌</span>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>Cancel This Order?</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                    {decoded.name || 'Walk-in'} · ₹{cancelTargetOrder.total} · #{cancelTargetOrder.id.slice(0,8).toUpperCase()}
                  </p>
                </div>
              </div>

              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#92400E' }}>
                This order hasn't been accepted yet — no payment has been taken and no stock has moved. The customer will be notified that their order was cancelled.
              </div>

              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: '600' }}>
                Reason (optional, shown to customer)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Item out of stock, shop closing early…"
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E2E8F0', borderRadius: '9px', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setShowCancelModal(false); setCancelTargetOrder(null); }}
                  style={{ flex: 1, padding: '12px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Keep Order
                </button>
                <button
                  onClick={confirmCancelOrder}
                  style={{ flex: 1.4, padding: '12px', background: 'linear-gradient(135deg,#EF4444,#DC2626)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                >
                  ❌ Yes, Cancel &amp; Notify
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RESET TEST DATA MODAL — Danger Zone confirmation */}
      {showResetTestDataModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '440px', borderRadius: '18px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1.5px solid #FECACA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '22px' }}>⚠️</span>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Reset Test Data?</h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>This cannot be undone.</p>
              </div>
            </div>

            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#7F1D1D', fontWeight: '700' }}>This will permanently delete:</p>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#991B1B', lineHeight: '1.7' }}>
                <li>All {orders.length} bill{orders.length === 1 ? '' : 's'}, estimates &amp; challans</li>
                <li>Credit ledger entries for this shop</li>
                <li>Pending/past stock orders</li>
                <li>Invoice numbering — restarts at #0001</li>
              </ul>
            </div>

            <p style={{ fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
              Type your shop name <strong style={{ color: '#0F172A' }}>{user.name}</strong> to confirm:
            </p>
            <input
              type="text"
              value={resetConfirmInput}
              onChange={e => setResetConfirmInput(e.target.value)}
              placeholder={user.name}
              autoFocus
              style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${resetConfirmInput && resetConfirmInput.trim() !== user.name.trim() ? '#FCA5A5' : '#E2E8F0'}`, borderRadius: '9px', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', marginBottom: '18px' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setShowResetTestDataModal(false); setResetConfirmInput(''); }}
                disabled={resetInProgress}
                style={{ flex: 1, padding: '12px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmResetTestData}
                disabled={resetInProgress || resetConfirmInput.trim() !== user.name.trim()}
                style={{
                  flex: 1.4, padding: '12px',
                  background: (resetInProgress || resetConfirmInput.trim() !== user.name.trim()) ? '#FCA5A5' : 'linear-gradient(135deg,#DC2626,#B91C1C)',
                  border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '13px',
                  cursor: (resetInProgress || resetConfirmInput.trim() !== user.name.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                {resetInProgress ? '⏳ Resetting…' : '🗑️ Yes, Delete All Test Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Copy Product to Branch modal ──────────────────────────────── */}
      {copyToBranchModal && (() => {
        const otherBranches = visibleBranches.filter(b => b.id !== targetShopId);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 22, maxWidth: 420, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                📋 Copy to Branch
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748B', lineHeight: 1.5 }}>
                Copying <b>"{copyToBranchModal.productName}"</b> to another branch. Stock will be set to 0 — set the opening stock in the branch after copying.
              </p>

              {otherBranches.length === 1 ? (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#0F172A', fontWeight: 700 }}>
                  → {otherBranches[0].name}
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, letterSpacing: 0.3 }}>SELECT BRANCH</label>
                  <select
                    value={copyToBranchTarget}
                    onChange={e => setCopyToBranchTarget(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, color: '#0F172A', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  >
                    <option value="">— Pick a branch —</option>
                    {otherBranches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}{!b.parentShopId ? ' (Main)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setCopyToBranchModal(null)}
                  disabled={copyToBranchLoading}
                  style={{ flex: 1, background: '#F1F5F9', color: '#475569', border: 'none', padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeCopyToBranch}
                  disabled={!copyToBranchTarget || copyToBranchLoading}
                  style={{ flex: 2, background: (!copyToBranchTarget || copyToBranchLoading) ? '#94A3B8' : 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', border: 'none', padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: (!copyToBranchTarget || copyToBranchLoading) ? 'not-allowed' : 'pointer' }}
                >
                  {copyToBranchLoading ? 'Copying…' : 'Copy to branch →'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

// ── PushToBranchCard ─────────────────────────────────────────────────────
// Shown on the Products tab when the main shop owner has at least one branch.
// Lets them push the entire product catalogue to a selected branch in one click.
// Displayed at the top of the products list — same position as importFromMainEl
// on the branch side.
// Side-by-side comparison of branches: revenue, orders, top items per branch.
// Only shown when "All Branches (Combined)" is selected. Shows the owner a
// god's-eye view of which branch is performing best, which is the whole
// point of running multi-branch.
// BranchesDashboard — the unified multi-branch overview tab.
// Shows everything the owner needs at a glance: combined KPIs, per-branch
// comparison, recent activity across all branches, and quick branch
// switcher. No edit operations here — to act on data, owner picks a
// branch from the dropdown and goes to that branch's normal tabs.
function BranchesDashboard({ orders, branches }) {
  const navigate = useNavigate();
  const [range, setRange] = useState('today');
  const [metric, setMetric] = useState('revenue');

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#EF4444', '#84CC16'];
  const branchColor = (i) => COLORS[i % COLORS.length];

  const now = new Date();
  const start = new Date(now);
  if (range === 'today') start.setHours(0,0,0,0);
  else if (range === 'week') { start.setDate(now.getDate() - 6); start.setHours(0,0,0,0); }
  else if (range === 'month') { start.setDate(now.getDate() - 29); start.setHours(0,0,0,0); }
  else start.setFullYear(2000);

  const isBill = o => !o.userId?.startsWith('estimate') && !o.userId?.startsWith('challan')
    && o.status !== 'Cancelled';
  const scopedOrders = orders.filter(o => {
    if (!isBill(o)) return false;
    return new Date(o.timestamp || o.date || o.created_at || 0) >= start;
  });

  const perBranch = branches.map((b, idx) => {
    const bOrders = scopedOrders.filter(o => o._branchId === b.id);
    const revenue = bOrders.reduce((s, o) => s + (Number(o.total) || 0) - (Number(o.refundAmount) || 0), 0);
    const itemsSold = bOrders.reduce((s, o) =>
      s + (o.items || []).reduce((ss, it) => ss + (Number(it.qty) || 0), 0), 0);
    const avgBill = bOrders.length ? Math.round(revenue / bOrders.length) : 0;
    return {
      id: b.id, parentShopId: b.parentShopId,
      name: b.name + (!b.parentShopId ? ' (Main)' : ''),
      shortName: b.name.length > 18 ? b.name.slice(0, 16) + '…' : b.name,
      color: branchColor(idx),
      revenue, itemsSold, avgBill, count: bOrders.length,
    };
  });

  const totalRevenue = perBranch.reduce((s, p) => s + p.revenue, 0);
  const totalCount = perBranch.reduce((s, p) => s + p.count, 0);
  const totalItems = perBranch.reduce((s, p) => s + p.itemsSold, 0);
  const avgBillAll = totalCount ? Math.round(totalRevenue / totalCount) : 0;

  // Recent bills across all branches (top 10)
  const recentBills = scopedOrders.slice(0, 10);

  const winner = [...perBranch].sort((a, b) => {
    const av = metric === 'revenue' ? a.revenue : metric === 'bills' ? a.count : a.itemsSold;
    const bv = metric === 'revenue' ? b.revenue : metric === 'bills' ? b.count : b.itemsSold;
    return bv - av;
  })[0];

  const fmtINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const pillBtn = (active) => ({
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: '1px solid ' + (active ? '#4F46E5' : '#E2E8F0'),
    background: active ? '#4F46E5' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#475569',
    transition: 'all 0.15s',
  });

  const goToBranch = (branchId, parentShopId) => {
    // parentShopId null = this IS the main shop
    if (parentShopId) {
      navigate(`/shop/branch/${branchId}`);
    } else {
      navigate('/shop');
    }
  };

  const maxRevenue = Math.max(1, ...perBranch.map(p => p.revenue));

  return (
    <div style={{ padding: 20, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Hero header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#0F172A' }}>🏪 All Branches Overview</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
            Live combined view across {branches.length} branches. Pick any branch below to manage it.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['today','Today'],['week','7d'],['month','30d'],['all','All']].map(([k, label]) => (
            <button key={k} onClick={() => setRange(k)} style={pillBtn(range === k)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Headline KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', padding: 18, borderRadius: 12, border: '1px solid #C7D2FE' }}>
          <div style={{ fontSize: 11, color: '#4338CA', fontWeight: 700, marginBottom: 4 }}>TOTAL REVENUE</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#312E81' }}>{fmtINR(totalRevenue)}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', padding: 18, borderRadius: 12, border: '1px solid #6EE7B7' }}>
          <div style={{ fontSize: 11, color: '#047857', fontWeight: 700, marginBottom: 4 }}>BILLS</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#064E3B' }}>{totalCount}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', padding: 18, borderRadius: 12, border: '1px solid #FBBF24' }}>
          <div style={{ fontSize: 11, color: '#92400E', fontWeight: 700, marginBottom: 4 }}>AVG BILL</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#78350F' }}>{fmtINR(avgBillAll)}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', padding: 18, borderRadius: 12, border: '1px solid #F9A8D4' }}>
          <div style={{ fontSize: 11, color: '#9D174D', fontWeight: 700, marginBottom: 4 }}>ITEMS SOLD</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#831843' }}>{totalItems}</div>
        </div>
      </div>

      {/* Winner banner */}
      {winner && winner.count > 0 && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: '#F0FDF4', border: '1px solid #86EFAC', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏆</span>
          <span style={{ fontSize: 14, color: '#166534' }}>
            <b style={{ fontWeight: 800 }}>{winner.name}</b> leads with{' '}
            {metric === 'revenue' ? <b>{fmtINR(winner.revenue)}</b>
              : metric === 'bills' ? <b>{winner.count} bills</b>
              : <b>{winner.itemsSold} items sold</b>}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {[['revenue','Revenue'],['bills','Bills'],['items','Items']].map(([k, label]) => (
              <button key={k} onClick={() => setMetric(k)} style={pillBtn(metric === k)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Per-branch cards — clickable to drill into that branch */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '8px 0 12px' }}>Branches</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        {perBranch.map(p => {
          const sharePct = totalRevenue ? Math.round((p.revenue / totalRevenue) * 100) : 0;
          const barPct = (p.revenue / maxRevenue) * 100;
          return (
            <div key={p.id} style={{
              background: '#FFFFFF', border: `2px solid ${p.color}33`, borderRadius: 12, padding: 16,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.color + '33'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              onClick={() => goToBranch(p.id, p.parentShopId)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                {sharePct > 0 && (
                  <span style={{ background: p.color + '22', color: p.color, fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6 }}>
                    {sharePct}%
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>REVENUE</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>{fmtINR(p.revenue)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>BILLS</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>{p.count}</div>
                </div>
              </div>
              <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: `${barPct}%`, height: '100%', background: p.color, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 700, textAlign: 'right' }}>
                Open branch →
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent activity — last 10 bills across all branches */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '20px 0 12px' }}>Recent Activity</h2>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {recentBills.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            No bills in this period across any branch.
          </div>
        ) : recentBills.map((o, idx) => {
          const branchObj = perBranch.find(p => p.id === o._branchId);
          const total = (Number(o.total) || 0) - (Number(o.refundAmount) || 0);
          const t = new Date(o.timestamp || o.date || o.created_at || 0);
          const timeStr = t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
          const dateStr = t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          return (
            <div key={o.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: idx === recentBills.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: branchObj?.color || '#94A3B8', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o._branchName || 'Unknown branch'}
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {timeStr} · {dateStr} · {(o.items || []).length} items
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{fmtINR(total)}</div>
            </div>
          );
        })}
      </div>

      {/* Help footer */}
      <div style={{ marginTop: 16, padding: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12, color: '#475569' }}>
        💡 Click any branch card above to switch to that branch and start billing, manage products, or view detailed reports.
      </div>
    </div>
  );
}

function CompareBranchesPanel() {
  // Legacy component kept for the Reports tab. The Branches tab uses
  // BranchesDashboard which is the canonical multi-branch view.
  return null;
}

function PushToBranchCard({ branches, onPush }) {
  const [selectedBranchId, setSelectedBranchId] = useState(
    branches.length === 1 ? branches[0].id : ''
  );
  const [pushing, setPushing] = useState(false);

  const handlePush = async (copyStock) => {
    if (!selectedBranchId) return;
    setPushing(true);
    try {
      await onPush(selectedBranchId, copyStock);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1px solid #86EFAC', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, flexShrink: 0 }}>🏪</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Copy catalogue to a branch</div>
          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, lineHeight: 1.45 }}>
            Copies all products from this main shop to the selected branch. Products already in the branch are skipped — safe to run again after adding new items here.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {branches.length > 1 ? (
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            disabled={pushing}
            style={{ flex: 1, minWidth: 160, padding: '8px 12px', border: '1.5px solid #86EFAC', borderRadius: 8, fontSize: 13, color: '#0F172A', outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}
          >
            <option value="">— Select branch —</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : (
          <div style={{ flex: 1, padding: '8px 12px', background: '#fff', border: '1px solid #86EFAC', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
            → {branches[0]?.name}
          </div>
        )}
        <button
          onClick={() => handlePush(false)}
          disabled={!selectedBranchId || pushing}
          title="Copy all products; set stock to 0 on branch"
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: selectedBranchId && !pushing ? '#fff' : '#E2E8F0', color: selectedBranchId && !pushing ? '#16A34A' : '#94A3B8', border: '1.5px solid #86EFAC', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: selectedBranchId && !pushing ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
        >
          Copy products (stock = 0)
        </button>
        <button
          onClick={() => handlePush(true)}
          disabled={!selectedBranchId || pushing}
          title="Copy all products AND copy current stock counts"
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: selectedBranchId && !pushing ? 'linear-gradient(135deg,#16A34A,#15803D)' : '#E2E8F0', color: selectedBranchId && !pushing ? '#fff' : '#94A3B8', border: 'none', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: selectedBranchId && !pushing ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
        >
          {pushing ? 'Copying…' : 'Copy + bring stock'}
        </button>
      </div>
    </div>
  );
}

export default ShopDashboard;
