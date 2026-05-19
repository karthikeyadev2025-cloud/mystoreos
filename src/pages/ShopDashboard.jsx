import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Home, Package, Receipt, Wallet, User, LogOut, ScanLine, Plus, IndianRupee, Book, Share2, Search, QrCode, Barcode as BarcodeIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Barcode from 'react-barcode';
import { jsPDF } from 'jspdf';

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

  // System Settings (Razorpay Key)
  const [sysSettings, setSysSettings] = useState({ razorpayKey: '' });

  // Staff Management
  const [staffList, setStaffList] = useState([]);
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffName, setNewStaffName] = useState('');

  const targetShopId = user.role === 'staff' ? user.staff_of : user.id;
  const isOwner = user.role === 'shop';

  const loadData = async () => {
    setProducts(await api.getShopProducts(targetShopId));
    setOrders(await api.getShopOrders(targetShopId));
    
    if (isOwner) {
      setCredits(await api.getShopCredits(targetShopId));
      setSysSettings(await api.getSettings());
      setStaffList(await api.getShopStaff(targetShopId));
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const addToBill = (prod) => {
    setBillItems([...billItems, prod]);
    toast.success(`Added ${prod.name} to bill`, { autoClose: 1000 });
  };

  const addCustomItem = () => {
    if(!customItemName || !customItemPrice) return toast.error("Enter name and price");
    const item = { name: customItemName, price: parseFloat(customItemPrice), qty: 1 };
    setBillItems([...billItems, item]);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const sendWhatsAppBill = async () => {
    if (billItems.length === 0) return toast.error("Bill is empty");
    const total = billItems.reduce((a, b) => a + b.price, 0);
    
    // Save to DB as an offline walk-in order
    try {
      await api.placeOrder('walk-in-customer', targetShopId, billItems.map(b => ({...b, qty: 1})), total);
      
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
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }

      toast.success(`Bill saved and sent for ₹${total}!`);
      setBillItems([]);
      loadData(); // refresh orders
    } catch(e) {
      toast.error("Error saving bill");
    }
  };

  const acceptOrder = async (orderId) => {
    await api.acceptOrder(orderId);
    toast.success("Order Accepted!");
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
        (error) => { /* ignore */ }
      );
      return () => { scanner.clear().catch(e => console.error("Scanner clear error", e)); };
    }
  }, [showScanner, activeTab, products]);

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

  const handleSaveProfile = async () => {
    await api.updateProfile(user.id, { upiId, logo });
    const updatedUser = { ...user, upiId, logo };
    localStorage.setItem('mystore_user', JSON.stringify(updatedUser));
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
      handler: async function (response) {
        toast.success("Payment successful! Upgrading to PRO...");
        await api.updateProfile(targetShopId, { subscription: 'active' });
        // Update local user object
        const updatedUser = { ...user, subscription: 'active' };
        localStorage.setItem('mystore_user', JSON.stringify(updatedUser));
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
            <div style={styles.gridBtn}>
              <IndianRupee size={24} color="#f59e0b" />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Receive Pay</p><p style={styles.gridSub}>డబ్బు తీసుకోండి</p></div>
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
            <div style={styles.gridBtn} onClick={() => window.open(`http://localhost:5173/s/${targetShopId.split('_')[1]}`, '_blank')}>
              <Share2 size={24} color="#ef4444" />
              <div style={{textAlign: 'center'}}><p style={styles.gridTitle}>Share Shop</p><p style={styles.gridSub}>లింక్ పంపు</p></div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #2a2f3d', paddingTop: '16px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>TOTAL</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>₹{billTotal}</span>
              </div>
              <button style={{...styles.whatsappBtn, opacity: billItems.length ? 1 : 0.5}} onClick={sendWhatsAppBill}>
                <span style={{ fontSize: '18px' }}>💬</span> Generate Bill
              </button>
              <button style={styles.upiBtn}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
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
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{c.distributorName}</span>
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
                    <button style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Pay Now via UPI
                    </button>
                  )}
                </div>
              </div>
            ))}
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

            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginTop: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>🔗 Your Shop Link & QR</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                Print this QR code or share your link so customers can order directly from their phone.
              </p>
              <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
                <QrCode size={120} color="#000" />
              </div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#3b82f6' }}>mystore.in/s/{user.id.split('_')[1]}</p>
            </div>
          </div>
        </div>
      )}

      {/* SCANNER MODAL */}
      {showScanner && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
            <div id="reader" style={{ width: '100%' }}></div>
            <button onClick={() => setShowScanner(false)} style={{ width: '100%', padding: '16px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>Cancel Scan</button>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && !showScanner && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
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
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', background: '#11151c', padding: '12px 0', borderTop: '1px solid #2a2f3d', zIndex: 100 }}>
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
          <div style={{...styles.navBtn, color: activeTab === 'staff' ? '#f59e0b' : '#94a3b8' }} onClick={() => setActiveTab('staff')}>
            <User size={20} style={{ margin: '0 auto 4px auto' }} />
            <p style={{ fontSize: '10px', margin: 0 }}>Staff</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default ShopDashboard;
