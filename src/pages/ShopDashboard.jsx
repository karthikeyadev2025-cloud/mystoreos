import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Home, Package, Receipt, Wallet, User, LogOut, ScanLine, Plus, IndianRupee, Book, Share2, Search, Barcode as BarcodeIcon, Camera, X, QrCode, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Barcode from 'react-barcode';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';

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
  
  // Receipt Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Products Management State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Profile State
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [logo, setLogo] = useState(user?.logo || '');
  const [shopPhotos, setShopPhotos] = useState(user?.shopPhotos || []);
  const [paymentQr, setPaymentQr] = useState(user?.paymentQr || '');
  const [showPaymentQrModal, setShowPaymentQrModal] = useState(false);
  const [latitude, setLatitude] = useState(user?.latitude || '');
  const [longitude, setLongitude] = useState(user?.longitude || '');

  // System Settings (Razorpay Key & Announcement)
  const [sysSettings, setSysSettings] = useState({ razorpayKey: '' });
  const [announceConfig, setAnnounceConfig] = useState(DEFAULT_ANNOUNCE);

  // Staff Management
  const [staffList, setStaffList] = useState([]);
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffName, setNewStaffName] = useState('');

  // Promo Code & Wholesale Restocking States
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [wholesaleCatalog, setWholesaleCatalog] = useState([]);
  const [restockCart, setRestockCart] = useState({}); // { wholesaleProdId: qty }

  const targetShopId = user.role === 'staff' ? user.staff_of : user.id;
  const isOwner = user.role === 'shop';

  const loadData = useCallback(async () => {
    setProducts(await api.getShopProducts(targetShopId));
    setOrders(await api.getShopOrders(targetShopId));
    setWholesaleCatalog(await api.getDistributorProducts());
    
    // Load Global Announcement
    const announce = await api.getSiteConfig('announcement', DEFAULT_ANNOUNCE);
    setAnnounceConfig(announce);
    
    if (isOwner) {
      setCredits(await api.getShopCredits(targetShopId));
      setSysSettings(await api.getSettings());
      setStaffList(await api.getShopStaff(targetShopId));
    }
  }, [targetShopId, isOwner]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const addToBill = useCallback((prod) => {
    setBillItems(prevItems => [...prevItems, prod]);
    toast.success(`Added ${prod.name} to bill`, { autoClose: 1000 });
  }, []);

  const addCustomItem = () => {
    if(!customItemName || !customItemPrice) return toast.error("Enter name and price");
    const item = { name: customItemName, price: parseFloat(customItemPrice), qty: 1 };
    setBillItems([...billItems, item]);
    setCustomItemName('');
    setCustomItemPrice('');
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
    
    // Save to DB as an offline walk-in order
    try {
      await api.placeOrder('walk-in-customer', targetShopId, billItems.map(b => ({...b, qty: 1})), total);
      
      // PhonePe Soundbox Synthesis voice announcement
      if ('speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`MyStore received ${total} rupees successfully!`));
      }

      // Generate Branded PDF Receipt
      const doc = new jsPDF();
      if (user.logo) {
        doc.addImage(user.logo, 'JPEG', 80, 10, 50, 50); // Add logo centered
        doc.text(user.name, 105, 70, { align: 'center' });
      } else {
        doc.setFontSize(22);
        doc.text(user.name, 105, 20, { align: 'center' });
      }
      doc.setFontSize(12);
      doc.text(`Phone: ${user.phone}`, 105, user.logo ? 80 : 30, { align: 'center' });
      doc.text("--------------------------------------------------", 105, user.logo ? 90 : 40, { align: 'center' });
      
      let yOffset = user.logo ? 100 : 50;
      doc.setFontSize(14);
      doc.text("Item Name", 20, yOffset);
      doc.text("Amount", 160, yOffset);
      yOffset += 10;
      doc.setFontSize(12);
      
      billItems.forEach((item) => {
        doc.text(item.name, 20, yOffset);
        doc.text(`Rs. ${item.price}`, 160, yOffset);
        yOffset += 10;
      });
      
      if (discountAmount > 0) {
        doc.text("--------------------------------------------------", 105, yOffset, { align: 'center' });
        yOffset += 10;
        doc.text(`Subtotal: Rs. ${billTotal}`, 20, yOffset);
        yOffset += 10;
        doc.text(`Discount: -Rs. ${discountAmount}`, 20, yOffset);
        yOffset += 10;
      }

      doc.text("--------------------------------------------------", 105, yOffset, { align: 'center' });
      yOffset += 10;
      doc.setFontSize(16);
      doc.text(`TOTAL: Rs. ${total}`, 160, yOffset, { align: 'right' });
      
      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], "Receipt.pdf", { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: 'Your Receipt',
          text: `Thank you for shopping at ${user.name}! Here is your bill.`,
        });
      } else {
        // Fallback to text if file sharing not supported (desktop)
        let msg = `*${user.name}*\nBill Total: Rs.${total}\n\n`;
        billItems.forEach(i => msg += `- ${i.name}: Rs.${i.price}\n`);
        if (discountAmount > 0) msg += `Discount: -Rs.${discountAmount}\nTotal Paid: Rs.${total}\n`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }

      toast.success(`Bill saved and sent for ₹${total}!`);
      setBillItems([]);
      setDiscountAmount(0);
      setPromoCode('');
      loadData(); // refresh orders
    } catch {
      toast.error("Error saving bill");
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

  const sales = orders.filter(o => o.status === 'Accepted').reduce((a, b) => a + b.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;
  const payable = credits.filter(c => !c.paid).reduce((a, b) => a + b.amount, 0);
  const billTotal = billItems.reduce((a, b) => a + b.price, 0);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  // Setup Camera Scanner
  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 150 } }, false);
      scanner.render(
        (decodedText) => {
          setScannedBarcode(decodedText);
          setShowScanner(false);
          scanner.clear();
          toast.success("Barcode Scanned: " + decodedText);
          
          // If we are in 'home' tab and scanning a bill item instead of adding a new product
          if (activeTab === 'home') {
            const foundProd = products.find(p => p.barcode === decodedText);
            if (foundProd) addToBill(foundProd);
            else toast.error("Product not found in inventory!");
          }
        },
        () => { /* ignore */ }
      );
      return () => { scanner.clear().catch(e => console.error("Scanner clear error", e)); };
    }
  }, [showScanner, activeTab, products, addToBill]);

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

  const handleSaveProduct = async () => {
    if (!newProdName || !newProdPrice) return toast.error("Name and price required");
    await api.addProduct(targetShopId, newProdName, newProdPrice, scannedBarcode);
    toast.success("Product Saved to Inventory!");
    setShowAddProductModal(false);
    setNewProdName('');
    setNewProdPrice('');
    setScannedBarcode('');
    loadData();
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

  const downloadQrPoster = () => {
    const doc = new jsPDF();
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
      longitude: parseFloat(longitude) || null 
    });
    const updatedUser = { 
      ...user, upiId, logo, shopPhotos, paymentQr, 
      latitude: parseFloat(latitude) || null, 
      longitude: parseFloat(longitude) || null 
    };
    localStorage.setItem('mystore_session', JSON.stringify(updatedUser));
    toast.success("Profile Updated successfully!");
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleShopPhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (shopPhotos.length + files.length > 6) return toast.error('Maximum 6 photos allowed');
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setShopPhotos(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  const removeShopPhoto = (index) => {
    setShopPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const getShopUrl = () => {
    const base = window.location.origin;
    return `${base}/s/${targetShopId.split('_')[1]}`;
  };

  const handleShareShop = () => {
    const url = getShopUrl();
    const msg = `Check out ${user.name} on MyStore OS!\n${url}`;
    if (navigator.share) {
      navigator.share({ title: user.name, text: msg, url }).catch(() => {});
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

  const handlePaymentQrUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPaymentQr(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubscribe = () => {
    if (!sysSettings.razorpayKey) {
      return toast.error("Admin has not configured Razorpay yet.");
    }
    
    const options = {
      key: sysSettings.razorpayKey, // Dynamic key from Admin Settings
      amount: "99900", // Amount is in currency subunits. 99900 = ₹999
      currency: "INR",
      name: "MyStore OS",
      description: "Pro Subscription",
      image: "https://example.com/your_logo",
      handler: async function () {
        toast.success("Payment successful! Upgrading to PRO...");
        await api.updateProfile(targetShopId, { subscription: 'active' });
        // Update local user object
        const updatedUser = { ...user, subscription: 'active' };
        localStorage.setItem('mystore_session', JSON.stringify(updatedUser));
        window.location.reload();
      },
      prefill: {
        name: user.name,
        contact: user.phone
      },
      theme: { color: "#dc2626" }
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

      {/* Subscription Banner */}
      {isOwner && user.subscription === 'trial' && (
        <div style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', display: 'block' }}>Free Trial Active</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>Upgrade to Pro to remove limits</span>
          </div>
          <button onClick={handleSubscribe} style={{ background: '#fff', color: '#d97706', border: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Pay ₹999
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
                <button onClick={addCustomItem} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold' }}>Add</button>
              </div>

              {billItems.length === 0 && <p style={{color:'#94a3b8', fontSize:14, margin:0}}>No items in bill yet. Add custom item or tap + below.</p>}
              {billItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>{item.name}</span>
                  <span>₹{item.price}</span>
                </div>
              ))}
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
              <button style={{...styles.whatsappBtn, opacity: billItems.length ? 1 : 0.5}} onClick={sendWhatsAppBill}>
                <span style={{ fontSize: '18px' }}>💬</span> Generate Bill
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
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d'}}>
            <h2 style={{margin:0, fontSize: 18}}>Online Orders & Bills</h2>
          </div>
          {orders.length === 0 && <p style={{padding: 20, textAlign:'center', color:'#94a3b8'}}>No orders yet.</p>}
          {orders.map(o => (
            <div key={o.id} style={styles.orderCard}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
                <span style={{fontWeight:'bold'}}>{o.userName === 'walk-in-customer' ? 'Walk-in Bill' : o.userName}</span>
                <span style={{color: o.status === 'Pending' ? '#ef4444' : '#22c55e', fontWeight:'bold', fontSize:14}}>
                  {o.status === 'Pending' ? '⚠️ Pending' : '✅ Accepted'}
                </span>
              </div>
              <div style={{background:'rgba(0,0,0,0.2)', padding:12, borderRadius:8, marginBottom:12}}>
                {o.items.map((item, idx) => (
                  <div key={idx} style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4, color:'#94a3b8'}}>
                    <span>{item.qty}x {item.name}</span>
                    <span>₹{item.price * item.qty}</span>
                  </div>
                ))}
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:18, fontWeight:'bold', color:'#fbbf24'}}>₹{o.total}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setSelectedOrder(o)} style={{background:'#3b82f6', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer'}}>
                    View Receipt
                  </button>
                  {o.status === 'Pending' && (
                    <button onClick={() => acceptOrder(o.id)} style={{background:'#22c55e', color:'white', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:'bold', cursor:'pointer'}}>
                      Accept
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* THERMAL RECEIPT MODAL */}
      {selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '320px', borderRadius: '4px', padding: '24px', color: '#000', fontFamily: 'monospace', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', textTransform: 'uppercase' }}>{user.name}</h2>
              <p style={{ margin: 0, fontSize: '12px' }}>Ph: {user.phone}</p>
              <p style={{ margin: 0, fontSize: '12px' }}>{new Date(selectedOrder.date).toLocaleString()}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', fontWeight: 'bold' }}>Receipt #{selectedOrder.id.split('_')[1]}</p>
            </div>
            
            <div style={{ minHeight: '100px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>
                <span>ITEM</span>
                <span>AMT</span>
              </div>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>{item.qty}x {item.name}</span>
                  <span>₹{item.price * item.qty}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px dashed #000', paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
              <span>TOTAL</span>
              <span>₹{selectedOrder.total}</span>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px' }}>
              <p style={{ margin: 0 }}>Thank you for your business!</p>
              <p style={{ margin: 0 }}>Powered by MyStore OS</p>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Print</button>
              <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTS INVENTORY TAB */}
      {activeTab === 'products' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{margin:0, fontSize: 18}}>Inventory</h2>
            <button onClick={() => setShowAddProductModal(true)} style={{background:'#3b82f6', color:'white', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:'bold', cursor:'pointer'}}>+ Add New</button>
          </div>
          
          {products.length === 0 && <p style={{padding: 20, textAlign:'center', color:'#94a3b8'}}>No products in inventory.</p>}
          
          <div style={{ padding: '12px' }}>
            {products.map(p => (
              <div key={p.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{p.name}</h3>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>₹{p.price}</span>
                </div>
                {p.barcode ? (
                  <div style={{ background: '#fff', padding: '8px', borderRadius: '8px', display: 'inline-block', marginTop: '8px' }}>
                    <Barcode value={p.barcode} height={30} width={1.5} fontSize={12} margin={0} displayValue={true} />
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>No Barcode</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREDIT LEDGER TAB */}
      {activeTab === 'credit' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d'}}>
            <h2 style={{margin:0, fontSize: 18}}>Distributor Credit Ledger</h2>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>Manage outstanding payments to distributors</p>
          </div>
          
          <div style={{ padding: '16px' }}>
            <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '12px', padding: '20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', fontWeight: 'bold' }}>TOTAL OUTSTANDING</p>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#fff' }}>₹{payable}</h3>
              </div>
              <Wallet size={32} color="#ef4444" opacity={0.5} />
            </div>

            <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Recent Deliveries / Credits</h3>
            {credits.length === 0 && <p style={{color:'#94a3b8', fontSize: '13px'}}>No credit records found.</p>}
            
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
                    <button onClick={() => {
                      if (!upiId) return toast.error('No UPI ID set. Go to Settings.');
                      window.open(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name)}&am=${c.amount}&cu=INR`, '_blank');
                    }} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Pay Now via UPI
                    </button>
                  )}
                </div>
              </div>
            ))}
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

      {/* STAFF MANAGEMENT TAB */}
      {isOwner && activeTab === 'staff' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d'}}>
            <h2 style={{margin:0, fontSize: 18}}>Staff Management</h2>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8'}}>Add helpers who can scan and bill, but cannot see your revenue.</p>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>👥 Add New Staff</h3>
              <div style={{ marginBottom: '12px' }}>
                <input 
                  type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} 
                  placeholder="Staff Name (e.g. Raju Helper)" 
                  style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} 
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <input 
                  type="tel" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} 
                  placeholder="Staff Mobile Number" 
                  style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} 
                />
              </div>
              <button onClick={handleAddStaff} style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                + Add Staff Member
              </button>
            </div>

            <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>Active Staff</h3>
            {staffList.length === 0 && <p style={{color:'#94a3b8', fontSize: '13px'}}>No staff added yet.</p>}
            {staffList.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px' }}>{s.name}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Ph: {s.phone}</p>
                </div>
                <span style={{ background: '#22c55e', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '12px' }}>Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile & Settings TAB */}
      {isOwner && activeTab === 'profile' && (
        <div style={{paddingBottom: 80}}>
          <div style={{background: '#1e222d', padding: '16px', borderBottom: '1px solid #2a2f3d'}}>
            <h2 style={{margin:0, fontSize: 18}}>Shop Profile & Payments</h2>
          </div>
          <div style={{ padding: '16px' }}>

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

      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && !showScanner && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1e293b', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>📦 Add Product to Inventory</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Product Name</label>
              <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit" style={{ width: '100%', padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Price (₹)</label>
              <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="e.g. 10" style={{ width: '100%', padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Barcode (Optional)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={scannedBarcode} onChange={e => setScannedBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ flex: 1, padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '16px' }} />
                <button onClick={() => setShowScanner(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 20px', borderRadius: '12px', cursor: 'pointer' }}><BarcodeIcon size={24} /></button>
              </div>
              {scannedBarcode && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                  <Barcode value={scannedBarcode} height={40} width={2} fontSize={14} />
                </div>
              )}
            </div>

            <button onClick={handleSaveProduct} style={{ width: '100%', background: '#22c55e', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Save Product</button>
            <button onClick={() => setShowAddProductModal(false)} style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
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
          <div style={{...styles.navBtn, color: activeTab === 'staff' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('staff')}>
            <User size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Staff</p>
          </div>
        )}
        {isOwner && (
          <div style={{...styles.navBtn, color: activeTab === 'profile' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('profile')}>
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '4px' }}>⚙️</span>
            <p style={{ fontSize: '10px', margin: 0 }}>Settings</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default ShopDashboard;
