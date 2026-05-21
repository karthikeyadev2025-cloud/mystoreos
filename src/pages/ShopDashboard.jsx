import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
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
import { downloadTallyXML } from '../lib/TallyExporter';
import { generateVoucherPDF, generateCreditNotePDF } from '../lib/pdfGenerator';

import DesktopSidebar from '../components/DesktopSidebar';
import DesktopPOS from '../components/DesktopPOS';
import DesktopInventory from '../components/DesktopInventory';
import DesktopBills from '../components/DesktopBills';
import DesktopCredit from '../components/DesktopCredit';
import DesktopRestock from '../components/DesktopRestock';
import DesktopReports from '../components/DesktopReports';
import DesktopSettings from '../components/DesktopSettings';

const DEFAULT_ANNOUNCE = { active: false, text: '', type: 'info' };

const ShopDashboard = () => {
  const { user, logout } = useAuth();
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
  const [editProdBarcode, setEditProdBarcode] = useState('');

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

  // System Settings (Razorpay Key & Announcement)
  const [sysSettings, setSysSettings] = useState({ razorpayKey: '' });
  const [announceConfig, setAnnounceConfig] = useState(DEFAULT_ANNOUNCE);

  // Staff Management
  const [staffList, setStaffList] = useState([]);
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);

  // Promo Code & Wholesale Restocking States
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
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

  const targetShopId = user.role === 'staff' ? user.staff_of : user.id;
  const isOwner = user.role === 'shop';

  const { isOnline, pendingCount } = useOfflineSync();
  const { isExpired, hasFeature, capabilities, planLabel } = useSubscription();
  const { deviceLimitExceeded, activeSessions, forceRevokeOthers } = useSessionGuard();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAdminPinSubmit = async () => {
    try {
      await api.verifyAdminPin(targetShopId, adminPinInput);
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
    setProducts(await api.getShopProducts(targetShopId));
    setOrders(await api.getShopOrders(targetShopId));
    setWholesaleCatalog(await api.getDistributorProducts());
    
    // Load Global Announcement
    const announce = await api.getSiteConfig('announcement', DEFAULT_ANNOUNCE);
    setAnnounceConfig(announce);
    
    if (isOwner) {
      setCredits(await api.getShopCredits(targetShopId));
      setCustomerCredits(await api.getDistCredits(targetShopId));
      setStockOrders(await api.getShopStockOrders(targetShopId));
      setSysSettings(await api.getSettings());
      setStaffList(await api.getShopStaff(targetShopId));
      setPlans(await api.getSubscriptionPlans());
      setPaymentHistory(await api.getPaymentHistory(targetShopId));
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
    setEditProdBarcode(p.barcode || '');
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!editProdName || !editProdPrice) return toast.error("Name and price required");
    try {
      await api.editProduct(editingProdId, {
        name: editProdName,
        price: parseFloat(editProdPrice),
        stock: parseInt(editProdStock) || 0,
        reorderLevel: parseInt(editProdReorder) || 10,
        batchNumber: editProdBatch,
        expiryDate: editProdExpiry,
        variants: editProdVariants,
        hsnCode: editProdHsnCode,
        gstRate: editProdGstRate,
        barcode: editProdBarcode
      });
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
        await api.deleteProduct(prodId);
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
      await api.addCredit(targetShopId, targetShopId, descStr, custCreditAmount);
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
    const custDesc = parts[3] || 'Pending Balance';
    
    const storeName = user.name;
    const upiIdForStore = upiId || user.upiId || '';
    
    if (!upiIdForStore) {
      return toast.error("Configure your UPI ID in Settings to generate payment links.");
    }
    
    const upiLink = `upi://pay?pa=${upiIdForStore}&pn=${encodeURIComponent(storeName)}&am=${c.amount}&cu=INR`;
    const message = `Hello *${custName}*,\nThis is a friendly reminder from *${storeName}* regarding your pending outstanding balance of *₹${c.amount}* for *${custDesc}*.\n\nYou can pay instantly via any UPI App by clicking this link:\n${upiLink}\n\nThank you!`;
    
    window.open(`https://wa.me/${custPhone ? custPhone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(message)}`, '_blank');
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
      const firstVariant = prod.variants ? prod.variants.split(',')[0].trim() : '';
      toast.success(`Added ${prod.name} to bill`, { autoClose: 1000 });
      return [...prevItems, { ...prod, qty: 1, selectedVariant: firstVariant }];
    });
  }, []);

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
    const total = Math.max(0, billTotal - discountAmount);
    
    if (!isOwner && total > 5000) {
      setPendingAction(() => () => executeSendWhatsAppBill());
      setShowAdminPinModal(true);
      return;
    }
    
    executeSendWhatsAppBill();
  };

  const executeSendWhatsAppBill = async () => {
    const total = Math.max(0, billTotal - discountAmount);
    
    try {
      let finalUserId = 'walk-in-customer';
      if (billingMode === 'estimate') {
        finalUserId = `estimate:${customerName || 'Guest'}:${customerPhone || ''}`;
      } else if (billingMode === 'challan') {
        finalUserId = `challan:${customerName || 'Guest'}:${customerPhone || ''}`;
      } else {
        finalUserId = `walk-in:${customerName || 'Guest'}:${customerPhone || ''}`;
      }

      await api.placeOrder(finalUserId, targetShopId, billItems.map(b => ({
        id: b.id,
        name: b.name,
        price: b.price,
        qty: b.qty || 1,
        selectedVariant: b.selectedVariant || ''
      })), total, { gstin: customerGstin, address: customerAddress, stateCode: customerStateCode });
      
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
        themeColor = '#f59e0b'; // amber orange for estimate
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
        
        if (showGstColumns) {
          const rate = parseInt(item.gstRate) || 0;
          const taxableVal = amount / (1 + (rate / 100));
          const taxAmt = amount - taxableVal;
          totalTaxable += taxableVal;
          
          let hsnText = item.hsnCode ? ` [${item.hsnCode}]` : '';
          const itemFullName = item.name + (item.selectedVariant ? ` (${item.selectedVariant})` : '') + hsnText;
          
          doc.text(itemFullName, 18, yOffset);
          doc.text(`${qty}`, 85, yOffset);
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
          doc.text(`${qty}`, 120, yOffset);
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

      if (discountAmount > 0) {
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
        doc.text("Thank you for your business! Visit again.", 15, yOffset);
      }
      
      yOffset += 6;
      doc.setTextColor(148, 163, 184);
      doc.text("Generated via MyStore OS - The Paperless Retail Revolution", 15, yOffset);
      
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
        billItems.forEach(i => msg += `- ${i.name} ${i.selectedVariant ? '('+i.selectedVariant+')' : ''} x${i.qty || 1}: Rs.${i.price * (i.qty || 1)}\n`);
        if (discountAmount > 0) msg += `Discount: -Rs.${discountAmount}\nTotal: Rs.${total}\n`;
        if (billingMode === 'bill' && upiId) {
          msg += `\nPay instantly via UPI: upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&am=${total}&cu=INR\n`;
        }
        window.open(`https://wa.me/${customerPhone ? customerPhone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(msg)}`, '_blank');
      } else {
        // Starter plan: save PDF locally instead of WhatsApp share
        doc.save(`${user.name}_bill.pdf`);
        toast.info('Bill saved as PDF. Upgrade to Pro to share via WhatsApp.');
      }

      toast.success(`${billingMode === 'estimate' ? 'Estimate' : (billingMode === 'challan' ? 'Challan' : 'Bill')} generated and sent successfully!`);
      setBillItems([]);
      setDiscountAmount(0);
      setPromoCode('');
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
    await api.acceptOrder(orderId);
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

  const filteredProducts = products.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));

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
    
    const netProfit = cashIn - cashOut;
    const marginPercent = cashIn > 0 ? Math.round((netProfit / cashIn) * 100) : 0;
    
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
    const items = Object.entries(restockCart).map(([prodId, qty]) => {
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
    
    try {
      await api.placeStockOrder(targetShopId, user.name, items, total);
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
    const qty = 1; // 1 bulk pack/carton
    const items = [{
      id: wholesaleProd.id,
      name: wholesaleProd.name,
      price: wholesaleProd.price,
      qty: qty
    }];
    const total = wholesaleProd.price * qty;
    
    try {
      await api.placeStockOrder(targetShopId, user.name, items, total);
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
      await api.addProduct(
        targetShopId,
        newProdName,
        newProdPrice,
        scannedBarcode,
        parseInt(newProdStock) || 0,
        newProdBatch,
        newProdExpiry,
        newProdVariants,
        parseInt(newProdReorder) || 10,
        { hsnCode: newProdHsnCode, gstRate: newProdGstRate }
      );
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
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add product");
    }
  };

  const handleSettleCustomerCredit = async (creditId) => {
    if (window.confirm("Mark this customer debt as fully settled?")) {
      try {
        await api.markCreditPaid(creditId);
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
      await api.processReturn(returnOrder.id, itemsToReturn, 'cash');
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
        await api.markCreditPaid(creditId);
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
      await api.addStaff(targetShopId, newStaffPhone, '1234', newStaffName);
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
        toast.warn("GPS request rejected. Defaulting to standard Guntur region coords.");
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

  const handleSaveProfile = async () => {
    await api.updateProfile(user.id, { 
      upiId, logo, shopPhotos, paymentQr, 
      latitude: parseFloat(latitude) || null, 
      longitude: parseFloat(longitude) || null,
      gstin, stateCode, businessAddress
    });
    const updatedUser = { 
      ...user, upiId, logo, shopPhotos, paymentQr, 
      latitude: parseFloat(latitude) || null, 
      longitude: parseFloat(longitude) || null,
      gstin, stateCode, businessAddress
    };
    localStorage.setItem('mystore_session', JSON.stringify(updatedUser));
    toast.success("Profile Updated successfully!");
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await api.uploadAsset(file, user.id, 'logos');
        setLogo(url);
        toast.success("Logo uploaded successfully!");
      } catch {
        toast.error("Failed to upload logo");
      }
    }
  };

  const handleShopPhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (shopPhotos.length + files.length > 6) return toast.error('Maximum 6 photos allowed');
    
    for (const file of files) {
      try {
        const url = await api.uploadAsset(file, user.id, 'shop_photos');
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
    const base = window.location.origin;
    return `${base}/s/${targetShopId}`;
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

  const handleShowUpiQr = () => {
    if (paymentQr) {
      setShowPaymentQrModal(true);
      return;
    }
    if (!upiId) return toast.error('Upload your Payment QR or set UPI ID in Settings!');
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&am=${billTotal}&cu=INR`;
    window.open(upiUrl, '_blank');
    toast.success('Opening UPI payment...');
  };

  const handlePaymentQrUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await api.uploadAsset(file, user.id, 'payment_qrs');
        setPaymentQr(url);
        toast.success("Payment QR uploaded successfully!");
      } catch {
        toast.error("Failed to upload Payment QR");
      }
    }
  };

  const handleUpdateRazorpay = async (key) => {
    const updated = { ...sysSettings, razorpayKey: key };
    await api.saveSettings(updated);
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
      const orderData = await api.createRazorpayOrder(plan.id, plan.price);
      orderId = orderData.orderId;
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
          await api.verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId: plan.id,
            userId: targetShopId,
          });
          toast.success(`Payment successful! Upgrading to ${plan.name}...`);
          const updatedUser = { ...user, subscription: 'active', subscriptionTier: plan.id };
          localStorage.setItem('mystore_session', JSON.stringify(updatedUser));
          setShowPlanSelectorModal(false);
          window.location.reload();
        } catch (_e) {
          toast.error(`Upgrade failed. Contact support with ID: ${response.razorpay_payment_id}`);
        }
      },
      prefill: { name: user.name, contact: user.phone },
      theme: { color: "#7c3aed" }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const getAnnounceColor = () => {
    switch(announceConfig.type) {
      case 'warning': return '#f59e0b';
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  const styles = {
    bg: { backgroundColor: '#11151c', minHeight: '100vh', color: 'white', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' },
    header: { background: 'linear-gradient(to right, #e53935, #b71c1c)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    statRow: { display: 'flex', gap: '8px', padding: '12px', overflowX: 'auto' },
    statBox: { backgroundColor: '#1e222d', flex: 1, minWidth: '80px', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #2a2f3d' },
    statNum: { fontSize: '20px', fontWeight: 'bold', color: '#f59e0b', margin: 0 },
    statLabel: { fontSize: '11px', color: '#94a3b8', margin: 0 },
    searchBar: { margin: '12px', display: 'flex', alignItems: 'center', backgroundColor: '#1e222d', borderRadius: '8px', padding: '0 12px', border: '1px solid #2a2f3d' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '0 12px' },
    gridBtn: { backgroundColor: '#1e222d', border: '1px solid #2a2f3d', borderRadius: '8px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' },
    gridIcon: { color: '#8b5cf6' },
    gridTitle: { fontSize: '12px', fontWeight: 'bold', color: 'white', margin: 0 },
    gridSub: { fontSize: '10px', color: '#94a3b8', margin: 0 },
    section: { margin: '16px 12px', backgroundColor: '#1e222d', borderRadius: '8px', border: '1px solid #2a2f3d', overflow: 'hidden' },
    sectionHeader: { backgroundColor: '#1e222d', padding: '12px', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #2a2f3d', display: 'flex', alignItems: 'center', gap: '8px' },
    whatsappBtn: { backgroundColor: '#22c55e', color: 'white', width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer' },
    upiBtn: { backgroundColor: '#334155', color: 'white', width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer' },
    prodItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #2a2f3d' },
    orderCard: { background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', margin: '12px' },
    navBtn: { textAlign: 'center', cursor: 'pointer' }
  };

  if (!isMobile) {
    return (
      <div className="dashboard-wrapper-flex" style={{ backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', fontFamily: 'Outfit, sans-serif' }}>
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
              <button onClick={() => setShowPlanSelectorModal(true)} style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', border: 'none', padding: '13px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                Upgrade for More Devices →
              </button>
            </div>
          </div>
        )}

        {/* GLOBAL ANNOUNCEMENT BANNER */}
        {announceConfig.active && announceConfig.text && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: getAnnounceColor(), color: '#fff', padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2000 }}>
            <div style={{ flex: 1 }}>{announceConfig.text}</div>
            <button onClick={() => setAnnounceConfig({...announceConfig, active: false})} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
          </div>
        )}

        <DesktopSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOwner={isOwner}
          pendingOrders={pendingOrders}
          handleLogout={handleLogout}
          userName={user.name}
          syncStatus={{ isOnline, pendingCount }}
        />

        <div className="fluid-dashboard-main" style={{ marginTop: announceConfig.active && announceConfig.text ? '40px' : '0px' }}>
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
              upiId={user?.upiId}
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
            />
          )}
        </div>

        {/* Global Modals for Desktop */}
        {showPaymentQrModal && paymentQr && (
          <div onClick={() => setShowPaymentQrModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '24px', padding: '32px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px', fontWeight: 800 }}>{user.name}</h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Scan to Pay • ₹{billTotal > 0 ? billTotal : ''}</p>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block' }}>
                <img src={paymentQr} alt="Payment QR" style={{ width: '240px', height: '240px', objectFit: 'contain' }} />
              </div>
              <p style={{ color: '#22c55e', fontSize: '12px', marginTop: '16px', fontWeight: 'bold' }}>GPay • PhonePe • Paytm • Any UPI App</p>
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
          <button onClick={() => setAnnounceConfig({...announceConfig, active: false})} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
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
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      {isOwner && (user.subscription === 'trial' || !user.subscription) && (
        <div style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', display: 'block' }}>Free Trial Active</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>Upgrade to Pro to remove limits</span>
          </div>
          <button onClick={() => setShowPlanSelectorModal(true)} style={{ background: '#fff', color: '#d97706', border: 'none', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            Upgrade Plan
          </button>
        </div>
      )}

      {activeTab === 'home' && (
        <>
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
            <div style={styles.statBox} onClick={() => setActiveTab('bills')}><p style={{...styles.statNum, color: pendingOrders > 0 ? '#ef4444' : '#f59e0b'}}>{pendingOrders}</p><p style={styles.statLabel}>New Orders</p></div>
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
                <Plus size={24} color="#8b5cf6" />
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
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
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
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                    border: '1px solid ' + (billingMode === 'estimate' ? '#f59e0b' : '#2a2f3d'),
                    background: billingMode === 'estimate' ? 'rgba(245,158,17,0.15)' : '#1e222d',
                    color: billingMode === 'estimate' ? '#f59e0b' : '#cbd5e1'
                  }}
                >
                  🟡 Estimate / Quote
                </button>
                <button 
                  onClick={() => setBillingMode('challan')} 
                  style={{ 
                    flex: 1, padding: '10px 6px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
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
                    👤 Customer Details { (billingMode === 'estimate' || billingMode === 'challan') && <span style={{ color: '#f59e0b' }}>(Recommended)</span> }
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
                  style={{ width: '60px', background: 'transparent', border: 'none', color: '#f59e0b', outline: 'none', fontSize: '14px', fontWeight: 'bold' }} 
                />
                <button onClick={addCustomItem} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Add</button>
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
                          <button onClick={() => updateBillItemQty(item.id, -1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>-</button>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '16px', textAlign: 'center' }}>{item.qty || 1}</span>
                          <button onClick={() => updateBillItemQty(item.id, 1)} style={{ background: '#334155', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>+</button>
                          
                          <span style={{ fontWeight: 'bold', color: '#22c55e', minWidth: '55px', textAlign: 'right', fontSize: '13px' }}>₹{item.price * (item.qty || 1)}</span>
                          
                          <button onClick={() => removeBillItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
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
                <button onClick={applyPromoCode} style={{ background: '#f59e0b', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Apply</button>
              </div>

              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#22c55e', marginTop: '8px', padding: '0 4px' }}>
                  <span>Discount Applied:</span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #2a2f3d', paddingTop: '16px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>TOTAL</span>
                <div>
                  {discountAmount > 0 && <span style={{ fontSize: '14px', color: '#94a3b8', textDecoration: 'line-through', marginRight: '8px' }}>₹{billTotal}</span>}
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>₹{Math.max(0, billTotal - discountAmount)}</span>
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
                  <button style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => addToBill(p)}>+ Add</button>
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
                  badgeColor = '#f59e0b';
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
                      <button onClick={() => setSelectedOrder(o)} style={{background:'#3b82f6', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px'}}>
                        View Receipt
                      </button>
                      
                      {billsSubTab === 'drafts' && type === 'estimate' && (
                        <button onClick={() => handleConvertEstimateToBill(o)} style={{background:'linear-gradient(135deg, #fbbf24, #d97706)', color:'#000', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                          ⚡ Convert to Bill
                        </button>
                      )}

                      {o.status === 'Pending' && (
                        <button onClick={() => acceptOrder(o.id)} style={{background:'#22c55e', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px'}}>
                          Accept
                        </button>
                      )}
                      
                      {o.status === 'Accepted' && (
                        <button onClick={() => handleOpenReturnModal(o)} style={{background:'#ef4444', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'}}>
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
          <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
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
                <button onClick={() => window.print()} style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Print</button>
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
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>₹{p.price}</span>
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
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid #f59e0b', fontWeight: 'bold' }}>
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
                            window.open(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&am=${c.amount}&cu=INR`, '_blank');
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
                        <span style={{ fontWeight: 'bold', color: c.paid ? '#22c55e' : '#f59e0b' }}>
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

              {/* TALLY EXPORT PANEL */}
              <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #10b981', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>📊 Tally ERP / Prime Export</h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Download Sales Vouchers as Tally-compatible XML for your CA.</p>
                </div>
                <button 
                  onClick={() => downloadTallyXML(orders.filter(o => o.status === 'completed'), user.name)} 
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  📥 Export XML
                </button>
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
            <div style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 8px 32px rgba(139,92,246,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚡ SaaS Subscription
                </h3>
                {user.subscription && user.subscription !== 'trial' ? (
                  <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Active Paid Plan</span>
                ) : (
                  <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>Free Trial Mode</span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '0 0 16px 0' }}>
                Your current active plan is: <b>{plans?.find(p => p.id === user.subscription)?.name || (user.subscription === 'active' ? 'Premium PRO' : 'Free Trial')}</b>. 
                {plans?.find(p => p.id === user.subscription) && ` This plan charges ₹${plans.find(p => p.id === user.subscription)?.price}/mo and gives you full access.`}
              </p>
              <button 
                onClick={() => setShowPlanSelectorModal(true)} 
                style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                Change or Upgrade Plan
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
                <label style={{ flex: 1, background: '#8b5cf6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
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
              
              <button onClick={handleGrabLocation} style={{ width: '100%', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>
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
                <button onClick={downloadQrPoster} style={{ width: '100%', background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#000', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🖨️ Download Printable QR Poster (PDF)
                </button>
                <button onClick={handleShareShop} style={{ width: '100%', background: '#25D366', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                  📤 Share Shop Link via WhatsApp
                </button>
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
      {showPaymentQrModal && paymentQr && (
        <div onClick={() => setShowPaymentQrModal(false)} style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px', fontWeight: 800 }}>{user.name}</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Scan to Pay • ₹{billTotal > 0 ? billTotal : ''}</p>
          <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <img src={paymentQr} alt="Payment QR" style={{ width: '260px', height: '260px', objectFit: 'contain' }} />
          </div>
          <p style={{ color: '#22c55e', fontSize: '12px', marginTop: '16px', fontWeight: 'bold' }}>GPay • PhonePe • Paytm • Any UPI App</p>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
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
                    <span style={{ fontSize: '14px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{returnItemsState[item.id]}</span>
                    <button onClick={() => setReturnItemsState(prev => ({...prev, [item.id]: Math.min(item.qty, prev[item.id] + 1)}))} style={{ background: '#334155', color: '#fff', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer' }}>+</button>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
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

      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && !showScanner && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1e293b', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>📦 Add Product to Inventory</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
              <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
              <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
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
              <input type="text" value={newProdVariants} onChange={e => setNewProdVariants(e.target.value)} placeholder="e.g. Red, Blue, Green or Small, Medium" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
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
                <button onClick={() => setShowScanner(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 20px', borderRadius: '10px', cursor: 'pointer' }}><BarcodeIcon size={24} /></button>
              </div>
              {scannedBarcode && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                  <Barcode value={scannedBarcode} height={40} width={2} fontSize={14} />
                </div>
              )}
            </div>

            <button onClick={handleSaveProduct} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Product</button>
            <button onClick={() => setShowAddProductModal(false)} style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditProductModal && !showScanner && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1e293b', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>✏️ Edit Product Details</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Product Name</label>
              <input type="text" value={editProdName} onChange={e => setEditProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Price (₹)</label>
              <input type="number" value={editProdPrice} onChange={e => setEditProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Stock Qty</label>
                <input type="number" value={editProdStock} onChange={e => setEditProdStock(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Min Stock Alert</label>
                <input type="number" value={editProdReorder} onChange={e => setEditProdReorder(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Batch Number</label>
                <input type="text" value={editProdBatch} onChange={e => setEditProdBatch(e.target.value)} placeholder="e.g. B-901" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Expiry Date</label>
                <input type="date" value={editProdExpiry} onChange={e => setEditProdExpiry(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>Variants (comma-separated)</label>
              <input type="text" value={editProdVariants} onChange={e => setEditProdVariants(e.target.value)} placeholder="e.g. Red, Blue, Green or Small, Medium" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>HSN / SAC Code</label>
                <input type="text" value={editProdHsnCode} onChange={e => setEditProdHsnCode(e.target.value)} placeholder="e.g. 1905" style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>GST Rate (%)</label>
                <select value={editProdGstRate} onChange={e => setEditProdGstRate(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }}>
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
                <input type="text" value={editProdBarcode} onChange={e => setEditProdBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ flex: 1, padding: '12px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '15px' }} />
                <button onClick={() => setShowScanner(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 20px', borderRadius: '10px', cursor: 'pointer' }}><BarcodeIcon size={24} /></button>
              </div>
              {editProdBarcode && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                  <Barcode value={editProdBarcode} height={40} width={2} fontSize={14} />
                </div>
              )}
            </div>

            <button onClick={handleUpdateProduct} style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Update Product</button>
            <button onClick={() => setShowEditProductModal(false)} style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', display: 'flex', justifyContent: 'space-around', background: '#11151c', padding: '12px 0', borderTop: '1px solid #2a2f3d', zIndex: 100 }}>
        <div style={{...styles.navBtn, color: activeTab === 'home' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('home')}>
          <Home size={20} style={{ margin: '0 auto 4px auto' }} />
          <p style={{ fontSize: '10px', margin: 0 }}>Home</p>
        </div>
        
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'products' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('products')}>
            <Package size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Products</p>
          </div>
        )}
        
        <div style={{...styles.navBtn, color: activeTab === 'bills' ? '#f59e0b' : '#94a3b8', position: 'relative' }} onClick={() => setActiveTab('bills')}>
          <Receipt size={20} style={{ margin: '0 auto 4px auto' }} />
          <p style={{ fontSize: '10px', margin: 0 }}>Bills</p>
          {pendingOrders > 0 && <span style={{position:'absolute', top:-4, right:'20%', background:'#ef4444', width:10, height:10, borderRadius:'50%'}}></span>}
        </div>

        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'credit' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('credit')}>
            <Wallet size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Credit</p>
          </div>
        )}

        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'restock' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('restock')}>
            <Truck size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Restock</p>
          </div>
        )}
        
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'reports' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('reports')}>
            <Book size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Reports</p>
          </div>
        )}
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'profile' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('profile')}>
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
                background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
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
                const isCurrent = user.subscription === plan.id;
                const isPopular = plan.id === 'pro' || plan.name.toLowerCase().includes('pro');
                return (
                  <div 
                    key={plan.id}
                    style={{
                      background: isPopular ? 'linear-gradient(180deg, rgba(124, 58, 237, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)' : 'rgba(30, 41, 59, 0.25)',
                      border: isPopular ? '2px solid #7c3aed' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '20px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      position: 'relative',
                      boxShadow: isPopular ? '0 12px 32px rgba(124, 58, 237, 0.15)' : 'none'
                    }}
                  >
                    {isPopular && (
                      <span style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(90deg, #7c3aed, #4f46e5)',
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
                          background: isPopular ? 'linear-gradient(90deg, #7c3aed, #4f46e5)' : 'white',
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
              🔒 Secure, encrypted transactions powered by **Razorpay PG**. Cancel or downgrade anytime instantly.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ShopDashboard;
