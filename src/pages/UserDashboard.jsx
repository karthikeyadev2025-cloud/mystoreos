import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useParams } from 'react-router-dom';

const UserDashboard = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { shopId } = useParams();
  
  const [shopInfo, setShopInfo] = useState({ name: 'Sai Supermarket' });
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [cart, setCart] = useState({});
  const [showWaModal, setShowWaModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // Use URL shopId or fallback to demo shop
  const ACTIVE_SHOP_ID = shopId || 'u1';

  useEffect(() => {
    const load = async () => {
      const sInfo = await api.getShopById(ACTIVE_SHOP_ID);
      if(sInfo) setShopInfo(sInfo);

      const data = await api.getShopProducts(ACTIVE_SHOP_ID);
      if(data.length === 0) {
        // Fallback demo data if DB is empty
        setProducts([
          { id: 1, name: 'Sona Masoori Rice', category: 'rice', weight: '25kg bag', price: 1250, mrp: 1400, icon: '🍚' },
          { id: 2, name: 'Fortune Sunflower Oil', category: 'oil', weight: '5L tin', price: 650, mrp: 720, icon: '🛢️' },
          { id: 3, name: 'Surf Excel Matic', category: 'soap', weight: '2kg pack', price: 320, mrp: 360, icon: '🧼' },
          { id: 4, name: 'Amul Taaza Milk', category: 'milk', weight: '1L pouch', price: 68, mrp: 70, icon: '🥛' },
        ]);
      } else {
        setProducts(data);
      }
    };
    load();
  }, []);

  const updateQty = (id, change) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + change);
      return { ...prev, [id]: next };
    });
  };

  const getCartTotals = () => {
    let total = 0;
    let count = 0;
    const items = [];
    products.forEach(p => {
      if (cart[p.id]) {
        total += p.price * cart[p.id];
        count += cart[p.id];
        items.push({...p, qty: cart[p.id]});
      }
    });
    return { total, count, items };
  };

  const handleCheckoutClick = () => {
    if (!user) {
      setShowGuestModal(true);
    } else {
      setShowWaModal(true);
    }
  };

  const handleGuestLogin = async () => {
    if(!guestName || guestPhone.length < 10) return alert('Enter valid Name and 10-digit Phone');
    try {
      // Create profile & login
      try { await api.register(guestName, guestPhone, '0000', 'customer'); } catch(e) { /* ignore if exists */ }
      const loggedInUser = await api.login(guestPhone, '0000');
      // Set auth context (mocked simple way)
      localStorage.setItem('mystore_user', JSON.stringify(loggedInUser));
      login(loggedInUser); // use useAuth login function instead of reload
      setShowGuestModal(false);
      setShowWaModal(true);
    } catch(err) {
      alert("Error creating profile");
    }
  };

  const sendWhatsApp = async () => {
    try {
      if(!user) return; // Prevent if somehow still not logged in
      await api.placeOrder(user.id, ACTIVE_SHOP_ID, items, total);
      
      // 2. Generate WhatsApp message
      let msg = 'Hi Sai Supermarket, I want to order:%0A%0A';
      items.forEach(i => {
        msg += `- ${i.name} ${i.weight || ''} x${i.qty} = ₹${i.price * i.qty}%0A`;
      });
      msg += `%0ATotal: ₹${total}%0A%0ADeliver to: ${user.name}%0A%0AThank you!`;
      
      // 3. Open WhatsApp and close modal
      window.open(`https://wa.me/919800012345?text=${msg}`, '_blank');
      setCart({}); // Clear cart
      setShowWaModal(false);
      alert("Order placed successfully! The shopkeeper has been notified.");
    } catch(err) {
      console.error(err);
      alert("Error placing order.");
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Avatar = reader.result;
        setAvatar(base64Avatar);
        await api.updateProfile(user.id, { avatar: base64Avatar });
        const updatedUser = { ...user, avatar: base64Avatar };
        localStorage.setItem('mystore_user', JSON.stringify(updatedUser));
      };
      reader.readAsDataURL(file);
    }
  };

  let filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  if (filter !== 'all') filtered = filtered.filter(p => p.category === filter);

  return (
    <div style={{ background: 'linear-gradient(180deg, #0f0c29, #1a1a2e, #0f0c29)', color: '#fff', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b, #7c2d12)', padding: '24px 16px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {user && <button onClick={() => { localStorage.removeItem('mystore_user'); window.location.reload(); }} style={{position:'absolute', top:16, right:16, background:'rgba(0,0,0,0.3)', color:'white', border:'none', padding:'6px 12px', borderRadius: '4px', zIndex: 10, cursor:'pointer'}}>Logout</button>}
        
        {/* Shop Logo & Name */}
        {shopInfo.logo ? (
          <img src={shopInfo.logo} alt="Shop Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', margin: '0 auto 8px', display: 'block', position: 'relative', zIndex: 1 }} />
        ) : (
          <h1 style={{ fontSize: '26px', fontWeight: 800, position: 'relative', zIndex: 1, margin:0 }}>🛒</h1>
        )}
        <h1 style={{ fontSize: '22px', fontWeight: 800, position: 'relative', zIndex: 1, margin:0 }}>{shopInfo.name}</h1>
        
        {/* User Avatar & Welcome */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {user ? (
            <>
              <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                <img src={avatar || 'https://ui-avatars.com/api/?name=' + user.name + '&background=random'} alt="User" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', marginBottom: '4px' }} />
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </label>
              <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>Welcome back, {user.name}</p>
            </>
          ) : (
            <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>Arundelpet, Guntur • ⭐ 4.8</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>🚚 Free Delivery ₹500+</span>
          <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>📱 WhatsApp Order</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '16px', background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <input 
          type="text" 
          placeholder="Search products... వెతకండి..." 
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '15px', color: '#fff' }} 
        />
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', overflowX: 'auto' }}>
        {['all', 'rice', 'oil', 'dal', 'soap', 'milk'].map(c => (
          <button 
            key={c}
            onClick={() => setFilter(c)}
            style={{ 
              flexShrink: 0, padding: '10px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              background: filter === c ? 'linear-gradient(135deg, #dc2626, #f59e0b)' : 'rgba(255,255,255,0.05)',
              color: filter === c ? 'white' : 'rgba(255,255,255,0.7)',
              border: filter === c ? 'none' : '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Products */}
      <div style={{ padding: '12px', paddingBottom: '100px' }}>
        {filtered.map(p => (
          <div key={p.id} style={{ background: 'linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.6))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px', marginBottom: '10px', display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ width: '70px', height: '70px', background: 'linear-gradient(135deg, rgba(220,38,38,0.2), rgba(251,191,36,0.2))', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', flexShrink: 0 }}>
              {p.icon || '📦'}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{p.name}</h3>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>{p.weight || '1 unit'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#fbbf24' }}>₹{p.price}</span>
                {p.mrp && <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>₹{p.mrp}</span>}
                {p.mrp && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Save ₹{p.mrp - p.price}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => updateQty(p.id, -1)} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fbbf24', fontSize: '18px', fontWeight: 700, cursor: 'pointer' }}>−</button>
              <span style={{ fontSize: '16px', fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>{cart[p.id] || 0}</span>
              <button onClick={() => updateQty(p.id, 1)} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fbbf24', fontSize: '18px', fontWeight: 700, cursor: 'pointer' }}>+</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p style={{textAlign:'center', padding:40, color:'rgba(255,255,255,0.5)'}}>No products found.</p>}
      </div>

      {/* Cart Bar */}
      {count > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: 'linear-gradient(180deg, rgba(15,23,42,0.98), #000)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, backdropFilter: 'blur(20px)' }}>
          <div>
            <h4 style={{ fontSize: '14px', margin: 0 }}>🛒 {count} items</h4>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>Total: ₹{total}</p>
          </div>
          <button onClick={handleCheckoutClick} style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white', border: 'none', padding: '14px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            📲 Order on WhatsApp
          </button>
        </div>
      )}

      {/* Guest Onboarding Modal */}
      {showGuestModal && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: '350px', borderRadius: '24px', padding: '24px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 8px 0', color: '#fff' }}>Almost there! 🚀</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>Please enter your details so the shopkeeper knows who is ordering.</p>
            
            <input type="text" placeholder="Your Name (e.g. Raju)" value={guestName} onChange={e=>setGuestName(e.target.value)} style={{ width: '100%', padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '16px', marginBottom: '16px' }} />
            <input type="tel" placeholder="Mobile Number" value={guestPhone} onChange={e=>setGuestPhone(e.target.value)} style={{ width: '100%', padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '16px', marginBottom: '24px' }} />
            
            <button onClick={handleGuestLogin} style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Continue to Order</button>
            <button onClick={() => setShowGuestModal(false)} style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showWaModal && (
        <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'linear-gradient(180deg, #1e293b, #0f172a)', width: '100%', borderRadius: '24px 24px 0 0', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fbbf24', margin: '0 0 16px 0' }}>📋 Order Summary</h2>
            <div style={{ maxHeight: '30vh', overflowY: 'auto' }}>
              {items.map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <span>{i.name} x{i.qty}</span>
                  <span>₹{i.price * i.qty}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', fontSize: '22px', fontWeight: 800, color: '#fbbf24', borderTop: '2px solid rgba(251,191,36,0.3)', marginTop: '8px' }}>
              <span>TOTAL</span>
              <span>₹{total}</span>
            </div>
            {shopInfo.upiId ? (
              <a 
                href={`upi://pay?pa=${shopInfo.upiId}&pn=${encodeURIComponent(shopInfo.name)}&am=${total}&cu=INR`}
                style={{ display:'block', textDecoration:'none', background: 'linear-gradient(145deg, rgba(22,163,74,0.1), rgba(22,163,74,0.05))', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '12px', padding: '16px', margin: '12px 0', textAlign: 'center' }}
              >
                <h4 style={{ color: '#16a34a', margin: '0 0 8px 0' }}>💳 Tap to Pay via UPI</h4>
                <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #16a34a, #22c55e)', borderRadius: '16px', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>📱</div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{shopInfo.upiId}</p>
              </a>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', margin: '12px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Cash on Delivery / Pay at Shop</p>
              </div>
            )}
            <button onClick={sendWhatsApp} style={{ width: '100%', background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: 700, marginTop: '12px', cursor: 'pointer' }}>
              📲 Send Order on WhatsApp
            </button>
            <button onClick={() => setShowWaModal(false)} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserDashboard;
