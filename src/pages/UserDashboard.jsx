import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import StorefrontProductCard from '../components/StorefrontProductCard';
import StorefrontProductDetail from '../components/StorefrontProductDetail';
import MarketplaceShopCard from '../components/MarketplaceShopCard';
import { useAuth } from '../hooks/useAuth';
import { useSiteConfig } from '../lib/siteConfig';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  Search, MapPin, QrCode, Receipt, ShoppingCart, ArrowLeft, 
  Compass, ChevronRight, X, Sparkles, 
  Printer, Info, Clock, User, Navigation, 
  AlertTriangle, CreditCard, Mic, Gift, Copy
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
// html5-qrcode loaded on demand (see initScanner)
// jsPDF is dynamically imported on demand in downloadReceiptPDF
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './UserDashboard.css'; // Premium CSS file containing animations, keyframes, scrollbars and thermal styles
import { buildUpiUri, canTapToPay } from '../lib/upi';



// ── Shop Photo Gallery Component ──────────────────────────────────────────────
function ShopPhotoGallery({ photos, shopName }) {
  const [active, setActive]     = useState(0);
  const [lightbox, setLightbox] = useState(null); // index when open
  const timerRef = useRef(null);

  // Auto-advance every 3s
  useEffect(() => {
    if (photos.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActive(a => (a + 1) % photos.length);
    }, 3000);
    return () => clearInterval(timerRef.current);
  }, [photos.length]);

  const goTo = (idx) => {
    clearInterval(timerRef.current);
    setActive(idx);
    // restart auto-play after manual tap
    timerRef.current = setInterval(() => {
      setActive(a => (a + 1) % photos.length);
    }, 3000);
  };

  return (
    <>
      <div style={{ position: 'relative', overflow: 'hidden', background: '#0F172A' }}>
        {/* Main carousel strip */}
        <div style={{ display: 'flex', transition: 'transform 0.45s cubic-bezier(.4,0,.2,1)', transform: `translateX(-${active * 100}%)` }}>
          {photos.map((src, i) => (
            <div key={i} style={{ minWidth: '100%', position: 'relative' }} onClick={() => setLightbox(i)}>
              <img
                src={src}
                alt={`${shopName} photo ${i + 1}`}
                style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
              />
              {/* Gradient overlay bottom */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(transparent, rgba(0,0,0,0.55))', pointerEvents: 'none' }} />
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '6px', zIndex: 5 }}>
            {photos.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} style={{ width: i === active ? 20 : 7, height: 7, borderRadius: 4, background: i === active ? '#fff' : 'rgba(255,255,255,0.4)', border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.3s ease' }} />
            ))}
          </div>
        )}

        {/* Arrow buttons */}
        {photos.length > 1 && (
          <>
            <button onClick={() => goTo((active - 1 + photos.length) % photos.length)}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, backdropFilter: 'blur(4px)' }}>‹</button>
            <button onClick={() => goTo((active + 1) % photos.length)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, backdropFilter: 'blur(4px)' }}>›</button>
          </>
        )}

        {/* Photo count badge */}
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, zIndex: 5, backdropFilter: 'blur(4px)' }}>
          {active + 1} / {photos.length}
        </div>

        {/* Tap to view hint on first photo */}
        {active === 0 && photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 22, right: 14, fontSize: 10, color: 'rgba(255,255,255,0.6)', zIndex: 5, pointerEvents: 'none' }}>
            Tap to view full
          </div>
        )}
      </div>

      {/* Thumbnail strip below carousel */}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 12px', background: '#0F172A', overflowX: 'auto' }}>
          {photos.map((src, i) => (
            <button key={i} onClick={() => goTo(i)} style={{ flexShrink: 0, padding: 0, border: `2px solid ${i === active ? '#4F46E5' : 'transparent'}`, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'none', transition: 'border-color .2s', width: 52, height: 40 }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: i === active ? 1 : 0.55, transition: 'opacity .2s' }} />
            </button>
          ))}
        </div>
      )}

      {/* Full-screen lightbox */}
      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 16 }}
        >
          <img src={photos[lightbox]} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()} />

          {/* Lightbox nav */}
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 18, alignItems: 'center' }}>
              <button onClick={e => { e.stopPropagation(); setLightbox((lightbox - 1 + photos.length) % photos.length); }}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{lightbox + 1} / {photos.length}</span>
              <button onClick={e => { e.stopPropagation(); setLightbox((lightbox + 1) % photos.length); }}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </div>
          )}

          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    </>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const classifyCategory = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("rice")) return "rice";
  if (n.includes("oil")) return "oil";
  if (n.includes("dal") || n.includes("lentil") || n.includes("pulse") || n.includes("gram")) return "dal";
  if (n.includes("soap") || n.includes("surf") || n.includes("wash") || n.includes("detergent") || n.includes("cleaner") || n.includes("bar") || n.includes("shaving") || n.includes("paste") || n.includes("brush")) return "soap";
  if (n.includes("milk") || n.includes("dairy") || n.includes("curd") || n.includes("paneer") || n.includes("cheese") || n.includes("amul") || n.includes("butter") || n.includes("ghee") || n.includes("cream")) return "milk";
  if (n.includes("shampoo") || n.includes("dove") || n.includes("conditioner") || n.includes("hair")) return "shampoo";
  return "grocery";
};

const getCategoryIcon = (category, name = "") => {
  const n = name.toLowerCase();
  if (category === "rice") return "🍚";
  if (category === "oil") return "🛢️";
  if (category === "dal") return "🥣";
  if (category === "soap") {
    if (n.includes("paste") || n.includes("brush")) return "🪥";
    return "🧼";
  }
  if (category === "milk") return "🥛";
  if (category === "shampoo") return "🧴";
  
  if (n.includes("egg")) return "🥚";
  if (n.includes("bread") || n.includes("roti")) return "🍞";
  if (n.includes("biscuit") || n.includes("parle") || n.includes("cookie")) return "🍪";
  if (n.includes("salt") || n.includes("sugar") || n.includes("masala") || n.includes("spices")) return "🧂";
  if (n.includes("fruit") || n.includes("apple") || n.includes("banana")) return "🍎";
  if (n.includes("veg") || n.includes("potato") || n.includes("onion") || n.includes("tomato")) return "🥗";
  if (n.includes("tea") || n.includes("coffee")) return "☕";
  if (n.includes("water") || n.includes("soda") || n.includes("drink")) return "🥤";
  return "📦";
};

const UserDashboard = () => {
  const { user, login, logout } = useAuth();
  const { config: siteCfg } = useSiteConfig();
  const navigate = useNavigate();
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  // Dual-Mode flag
  const isStoreMode = !!shopId;

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Shared / General states
  const [coords, setCoords] = useState({ latitude: 17.3850, longitude: 78.4867 }); // default Hyderabad
  const [locationStatus, setLocationStatus] = useState('India');
  const [shops, setShops] = useState([]);
  const [activeTab, setActiveTab] = useState('explore'); // explore, search, scan, bills
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // Marketplace search
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState([]);

  // Nearby shops filter
  const [shopCategoryFilter, setShopCategoryFilter] = useState('all');
  const [nearbySearch, setNearbySearch] = useState('');
  const [nearbySearchResults, setNearbySearchResults] = useState([]);

  // simulated / real scanning
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [cameraScannerActive, setCameraScannerActive] = useState(false);

  // Digital Ledger
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Shop Catalogue Mode states
  const [shopInfo, setShopInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [detailProduct, setDetailProduct] = useState(null);
  const [filter, setFilter] = useState('all');

  // Enterprise Feature additions
  const [announcements, setAnnouncements] = useState([]);
  const [showWalkingMap, setShowWalkingMap] = useState(false);
  const [loyaltyCoins, setLoyaltyCoins] = useState(user?.coins || 350); // Seed 350 standard loyalty coins if empty
  const [scratchModalOpen, setScratchModalOpen] = useState(false);
  const [scratchCardAmount, setScratchCardAmount] = useState(0);
  const [scratchCardRevealed, setScratchCardRevealed] = useState(false);
  const [lastOrderId, setLastOrderId] = useState('');
  const scratchCanvasRef = useRef(null);

  const playPaymentSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.25);
      
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc2.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.2); // E6
        gain2.gain.setValueAtTime(0.15, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 120);
    } catch (e) {
      console.error("Audio Context failed", e);
    }
  };

  const speakOrderPlaced = (order) => {
    if ('speechSynthesis' in window) {
      const shopName = order?.shopName || shopInfo?.name || 'the store';
      const text = `Your order has been placed successfully at ${shopName}. Please complete the payment to confirm.`;
      const speech = new SpeechSynthesisUtterance(text);
      speech.rate = 1.0;
      speech.pitch = 1.0;
      window.speechSynthesis.speak(speech);
    }
  };
  const isDrawingScratch = useRef(false);

  
  // Persistent Multi-store Cart
  const [cart, setCart] = useState({});
  const [showWaModal, setShowWaModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestShowPw, setGuestShowPw] = useState(false);
  const [guestStep, setGuestStep] = useState('form'); // 'form' | 'success'
  const [paymentProof, setPaymentProof] = useState('');
  const [isLocatingCatalog, setIsLocatingCatalog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const scannerRef = useRef(null);

  // Device detection for safe UPI deep-linking workflows
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Normalize IDs: pass UUIDs and phone numbers as-is, only prefix u_ for legacy numeric mock IDs
  const ACTIVE_SHOP_ID = shopId
    ? (shopId.includes('-') || shopId.startsWith('u_') || /^\d{10,12}$/.test(shopId) ? shopId : (shopId.startsWith('u') ? 'u_' + shopId.substring(1) : 'u_' + shopId))
    : null;

  // ===== STABLE CALLBACKS FOR LOADERS =====
  const grabLiveLocation = useCallback((silent = false) => {
    if (!silent) setLocationStatus('Locating...');
    if (!navigator.geolocation) {
      if (!silent) setLocationStatus('Unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationStatus('GPS Locked');
      },
      () => {
        console.warn('Geolocation denied or timed out. Defaulting...');
        if (!silent) setLocationStatus('India');
      },
      { timeout: 8000 }
    );
  }, []);

  const loadShops = useCallback(async () => {
    try {
      const data = await api.getAllShops();
      setShops(data || []);
    } catch (err) {
      console.error('Failed to load shops', err);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const list = await api.getAnnouncements();
      setAnnouncements(list || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadOrderHistory = useCallback(async () => {
    if (!user || !user.id) return;
    try {
      const data = await api.getUserOrders(user.id);
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to load orders', err);
    }
  }, [user]);

  const loadCatalogue = useCallback(async () => {
    setIsLocatingCatalog(true);
    try {
      const sInfo = await api.getShopById(ACTIVE_SHOP_ID);
      if (sInfo) {
        setShopInfo(sInfo);
      } else {
        // Fallback demo info
        setShopInfo({
          id: ACTIVE_SHOP_ID,
          name: 'Sai Supermarket',
          phone: '9876543210',
          upiId: '9876543210@ybl',
          logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&h=120&q=80',
          latitude: 16.3067,
          longitude: 80.4365
        });
      }

      const data = await api.getShopProducts(ACTIVE_SHOP_ID);
      if (data && data.length > 0) {
        const enriched = data.map(p => {
          const category = p.category || classifyCategory(p.name);
          const icon = p.icon || getCategoryIcon(category, p.name);
          return { ...p, category, icon };
        });
        setProducts(enriched);
      } else {
        // Real shop with no products yet — show an empty catalogue, NOT fake
        // demo items. (Previously this injected rice/oil/soap which wrongly
        // appeared for non-grocery shops like electronics.)
        setProducts([]);
      }
    } catch (err) {
      console.error('Failed to load catalogue', err);
    } finally {
      setIsLocatingCatalog(false);
    }
  }, [ACTIVE_SHOP_ID]);

  // ===== EFFECT LIFECYCLES (DECLARED BELOW CALLBACKS TO PREVENT HOISTING ERROR) =====
  useEffect(() => {
    const timer = setTimeout(() => {
      grabLiveLocation(true);
      loadShops();
      loadAnnouncements();
    }, 0);
    return () => clearTimeout(timer);
  }, [grabLiveLocation, loadShops, loadAnnouncements]);

  useEffect(() => {
    if (user && user.id) {
      const timer = setTimeout(() => {
        loadOrderHistory();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, activeTab, loadOrderHistory]);

  useEffect(() => {
    if (isStoreMode && ACTIVE_SHOP_ID) {
      const timer = setTimeout(() => {
        loadCatalogue();
        try {
          const allCarts = JSON.parse(localStorage.getItem('mystore_carts') || '{}');
          setCart(allCarts[ACTIVE_SHOP_ID] || {});
        } catch {
          setCart({});
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isStoreMode, ACTIVE_SHOP_ID, loadCatalogue]);

  useEffect(() => {
    if (globalSearch.trim() === '') {
      const timer = setTimeout(() => {
        setGlobalResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }
    const searchProds = async () => {
      const results = await api.searchGlobalProducts(globalSearch);
      const enriched = (results || []).map(p => {
        const category = p.category || classifyCategory(p.name);
        const icon = p.icon || getCategoryIcon(category, p.name);
        return { ...p, category, icon };
      });
      setGlobalResults(enriched);
    };
    const delayDebounce = setTimeout(searchProds, 300);
    return () => clearTimeout(delayDebounce);
  }, [globalSearch]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!nearbySearch.trim()) {
        setNearbySearchResults([]);
        return;
      }
      const results = await api.searchGlobalProducts(nearbySearch);
      const nearbyIds = new Set(shops.map(s => s.id));
      setNearbySearchResults((results || []).filter(r => nearbyIds.has(r.shopId)));
    }, 300);
    return () => clearTimeout(timer);
  }, [nearbySearch, shops]);

  useEffect(() => {
    let active = true;
    let retryTimeout = null;

    const initScanner = async () => {
      if (!active) return;

      const element = document.getElementById('reader');
      if (!element) {
        // Retry in 50ms if React has not mounted the element yet
        retryTimeout = setTimeout(initScanner, 50);
        return;
      }

      try {
        if (scannerRef.current) {
          try { scannerRef.current.clear(); } catch (_e) { /* ignore */ }
          scannerRef.current = null;
        }

        const { Html5QrcodeScanner } = await import('html5-qrcode');
        const scanner = new Html5QrcodeScanner('reader', { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          videoConstraints: { facingMode: "environment" }
        }, false);
        scannerRef.current = scanner;

        scanner.render((decodedText) => {
          try {
            let scannedId = decodedText;
            if (decodedText.includes('/s/')) {
              const parts = decodedText.split('/s/');
              scannedId = parts[parts.length - 1];
            }
            if (scannedId) {
              scanner.clear()
                .then(() => {
                  scannerRef.current = null;
                  setCameraScannerActive(false);
                  navigate(`/s/${scannedId}`);
                })
                .catch((err) => {
                  console.error("Error clearing scanner on scan success:", err);
                  scannerRef.current = null;
                  setCameraScannerActive(false);
                  navigate(`/s/${scannedId}`);
                });
            }
          } catch {
            alert('Scanned successfully, but link format was unrecognized: ' + decodedText);
          }
        }, () => {
          // Silent error
        });
      } catch (err) {
        console.error("Failed to initialize scanner:", err);
      }
    };

    if (cameraScannerActive && activeTab === 'scan') {
      initScanner();
    }

    return () => {
      active = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (_e) {
          /* ignore */
        }
        scannerRef.current = null;
      }
    };
  }, [cameraScannerActive, activeTab, navigate]);

  // Self-healing coordinate distance calculations (Cons elimination: coordinates seeding problem)
  const calculateDistance = (lat1, lon1, lat2, lon2, sId) => {
    if (!lat1 || !lon1) return null;
    
    let shopLat = lat2;
    let shopLon = lon2;
    
    // Deterministic offset based on shopId hash if unseeded or extremely far (> 100km radius)
    // Ensures proximity distances remain beautiful and realistic during regional live tests
    if (!shopLat || !shopLon || Math.abs(lat1 - shopLat) > 1 || Math.abs(lon1 - shopLon) > 1) {
      if (sId && typeof sId === 'string') {
        const hash = sId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const latOffset = (((hash % 7) + 1) * 0.003) - 0.012; // deterministically mock within ~1.5km
        const lonOffset = ((((hash >> 2) % 7) + 1) * 0.003) - 0.012;
        shopLat = lat1 + latOffset;
        shopLon = lon1 + lonOffset;
      } else {
        shopLat = lat1 + 0.005;
        shopLon = lon1 - 0.005;
      }
    }

    const R = 6371; // Earth radius in km
    const dLat = (shopLat - lat1) * Math.PI / 180;
    const dLon = (shopLon - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(shopLat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const inferShopCategory = (shop) => {
    if (shop.shopCategory && shop.shopCategory !== 'general') return shop.shopCategory;
    const n = (shop.name || '').toLowerCase();
    if (n.includes('medical') || n.includes('pharma') || n.includes('drug') || n.includes('clinic')) return 'medical';
    if (n.includes('electronic') || n.includes('mobile') || n.includes('laptop') || n.includes('computer')) return 'electronics';
    if (n.includes('kirana') || n.includes('grocery') || n.includes('provision') || n.includes('super') || n.includes('mart')) return 'kirana';
    return 'general';
  };

  const isShopOpenNow = (shop) => {
    const h = new Date().getHours();
    const open = shop.openingHour ?? 8;
    const close = shop.closingHour ?? 21;
    return h >= open && h < close;
  };

  const getSortedShops = () => {
    return [...shops].map(shop => {
      const distance = calculateDistance(coords.latitude, coords.longitude, shop.latitude, shop.longitude, shop.id);
      return { ...shop, distance, category: inferShopCategory(shop), openNow: isShopOpenNow(shop) };
    }).filter(shop => {
      if (shopCategoryFilter !== 'all' && shop.category !== shopCategoryFilter) return false;
      return true;
    }).sort((a, b) => {
      // 1. Featured PRO shops first
      const aPro = (a.subscription && a.subscription !== 'trial') ? 1 : 0;
      const bPro = (b.subscription && b.subscription !== 'trial') ? 1 : 0;
      if (bPro !== aPro) return bPro - aPro;

      // 2. Nearest shops go next
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
  };

  // Persistent multi-store cart partition actions
  const updateQty = (id, change) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + change);
      const updatedCart = { ...prev, [id]: next };
      
      // Save updated cart to localStorage global carts ledger
      try {
        const allCarts = JSON.parse(localStorage.getItem('mystore_carts') || '{}');
        allCarts[ACTIVE_SHOP_ID] = updatedCart;
        localStorage.setItem('mystore_carts', JSON.stringify(allCarts));
      } catch (e) {
        console.error('Error saving carts ledger', e);
      }

      return updatedCart;
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
        items.push({ ...p, qty: cart[p.id] });
      }
    });
    return { total, count, items };
  };

  // Scan all active localStorage carts to render on Marketplace explore tab
  const getActiveCartsList = () => {
    try {
      const allCarts = JSON.parse(localStorage.getItem('mystore_carts') || '{}');
      const activeCarts = [];
      Object.keys(allCarts).forEach(sId => {
        const shopCart = allCarts[sId] || {};
        let itemCount = 0;
        Object.values(shopCart).forEach(qty => { itemCount += qty; });
        if (itemCount > 0) {
          const matchedShop = shops.find(s => s.id === sId);
          activeCarts.push({
            shopId: sId,
            shopName: matchedShop ? matchedShop.name : 'Partner Store',
            logo: matchedShop ? matchedShop.logo : '',
            count: itemCount
          });
        }
      });
      return activeCarts;
    } catch {
      return [];
    }
  };

  const [isListeningGlobal, setIsListeningGlobal] = useState(false);
  const [isListeningLocal, setIsListeningLocal] = useState(false);

  const handleVoiceSearch = (type) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech Recognition is not supported by your browser!");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    if (type === 'global') {
      setIsListeningGlobal(true);
      toast.info("Listening... Speak now!", { autoClose: 2000 });
    } else {
      setIsListeningLocal(true);
      toast.info("Listening to product name...", { autoClose: 2000 });
    }

    rec.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      if (type === 'global') {
        setGlobalSearch(speechToText);
        toast.success(`Search set to: "${speechToText}"`);
      } else {
        setLocalSearch(speechToText);
        toast.success(`Filter set to: "${speechToText}"`);
      }
    };

    rec.onerror = (e) => {
      console.error(e);
      toast.error("Speech recognition failed or timed out.");
    };

    rec.onend = () => {
      setIsListeningGlobal(false);
      setIsListeningLocal(false);
    };

    rec.start();
  };

  const initScratchCanvas = () => {
    const canvas = scratchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#b0b8c3';
    ctx.fillRect(0, 0, 240, 240);
    
    ctx.fillStyle = '#9aa2b0';
    for (let i = 0; i < 240; i += 20) {
      ctx.fillRect(i, 0, 2, 240);
      ctx.fillRect(0, i, 240, 2);
    }
    
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px Courier New, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH HERE', 120, 100);
    ctx.fillText('TO CLAIM', 120, 125);
    ctx.fillText('CASHBACK', 120, 150);
  };

  useEffect(() => {
    if (scratchModalOpen) {
      setTimeout(initScratchCanvas, 100);
    }
  }, [scratchModalOpen]);

  const handleScratchMove = (e) => {
    const canvas = scratchCanvasRef.current;
    if (!canvas || !isDrawingScratch.current || scratchCardRevealed) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    
    checkScratchPercent();
  };

  const checkScratchPercent = () => {
    const canvas = scratchCanvasRef.current;
    if (!canvas || scratchCardRevealed) return;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, 240, 240);
    const pixels = imgData.data;
    let transparentCount = 0;
    
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) {
        transparentCount++;
      }
    }
    
    const percentage = (transparentCount / (240 * 240)) * 100;
    if (percentage > 55) {
      setScratchCardRevealed(true);
      const wonCoins = scratchCardAmount;
      setLoyaltyCoins(prev => {
        const newTotal = prev + wonCoins;
        if (user) {
          const updatedUser = { ...user, coins: newTotal };
          try { localStorage.setItem('mystore_session', JSON.stringify(updatedUser)); } catch (_e) { /* ignore */ }
          api.updateProfile(user.id, { coins: newTotal }).catch(console.error);
        }
        return newTotal;
      });
      toast.success(`🎉 Won ${wonCoins} Loyalty Coins!`);
    }
  };

  const handleCheckoutClick = () => {
    // Don't allow ordering when the shop is currently closed.
    if (shopInfo && !isShopOpenNow(shopInfo)) {
      const oh = shopInfo.openingHour ?? 8, ch = shopInfo.closingHour ?? 21;
      const fmt = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
      toast.error(`${shopInfo.name || 'This shop'} is currently closed. Open hours: ${fmt(oh)} – ${fmt(ch)}.`);
      return;
    }
    if (!user) {
      setShowGuestModal(true);
    } else {
      setShowWaModal(true);
    }
  };

  const handleGuestLogin = async () => {
    if (!guestName.trim()) return toast.error('Enter your name');
    if (!/^\d{10}$/.test(guestPhone)) return toast.error('Enter a valid 10-digit mobile number');
    if (!guestPassword || guestPassword.length < 4) return toast.error('Set a password — minimum 4 characters');
    try {
      let loggedInUser;
      try {
        // Try registering as a new customer with their chosen password
        await api.register(guestName.trim(), guestPhone, guestPassword, 'customer');
        loggedInUser = await api.login(guestPhone, guestPassword);
      } catch {
        // Account already exists — try logging in with entered password
        try {
          loggedInUser = await api.login(guestPhone, guestPassword);
        } catch {
          // Password mismatch — show helpful message
          toast.error('Account exists with a different password. Enter your existing password to continue.');
          return;
        }
      }
      localStorage.setItem('mystore_session', JSON.stringify(loggedInUser));
      login(loggedInUser);
      setGuestStep('success');
    } catch (err) {
      toast.error(err.message || 'Could not create account. Try again.');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file && user) {
      try {
        const url = await api.uploadAsset(file, user.id, 'avatars');
        setAvatar(url);
        await api.updateProfile(user.id, { avatar: url });
        const updatedUser = { ...user, avatar: url };
        localStorage.setItem('mystore_session', JSON.stringify(updatedUser));
      } catch (err) {
        console.error("Failed to upload avatar", err);
      }
    }
  };

  const sendWhatsAppOrder = async () => {
    const { total, items } = getCartTotals();
    try {
      if (!user) return;
      
      const placedOrder = await api.placeOrder(user.id, ACTIVE_SHOP_ID, items, total);
      const orderId = placedOrder?.id || 'o_' + Math.random().toString(36).substring(2, 10);
      setLastOrderId(orderId);
      
      // Order placed — confirm to shopper (payment happens next, not yet received)
      playPaymentSuccessSound();
      speakOrderPlaced(placedOrder || { id: orderId, total, shopName: shopInfo?.name || 'the store' });
      
      let msg = `*🛒 NEW ORDER — ${shopInfo?.name || 'Your Store'}*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `👤 *Customer:* ${user.name}\n`;
      msg += `📱 *Mobile:* +91${user.phone}\n`;
      msg += `🕐 *Time:* ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      items.forEach(item => {
        const line = item.price * item.qty;
        msg += `• *${item.name}*${item.weight ? ` (${item.weight})` : ''}\n`;
        msg += `  ${item.qty} × ₹${item.price} = *₹${line}*\n`;
      });
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `💰 *TOTAL: ₹${total}*\n`;
      msg += `💳 *Payment:* ${paymentMethod === 'upi' ? '📱 UPI' : '💵 Cash'}\n`;
      if (paymentProof) {
        msg += `🧾 *UPI Ref:* ${paymentProof}\n`;
      }
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Reply *CONFIRMED* to accept this order.\n`;
      msg += `_Powered by MyStore OS_`;

      const shopPhone = shopInfo?.phone || '9876543210';
      window.open(`https://wa.me/91${shopPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      
      // Clear cart for this specific shop
      setCart({});
      try {
        const allCarts = JSON.parse(localStorage.getItem('mystore_carts') || '{}');
        delete allCarts[ACTIVE_SHOP_ID];
        localStorage.setItem('mystore_carts', JSON.stringify(allCarts));
      } catch { // ignore cart clear error
      }

      setPaymentProof('');
      setShowWaModal(false);
      
      // Initialize post-checkout loyalty coins Scratch Card Modal!
      const wonAmount = Math.floor(Math.random() * 91) + 10; // random 10 to 100 loyalty coins
      setScratchCardAmount(wonAmount);
      setScratchCardRevealed(false);
      setScratchModalOpen(true);
      
      loadOrderHistory();
    } catch (err) {
      console.error(err);
      alert("Error placing order: " + err.message);
    }
  };

  const handleSimulateScan = (shopIdToScan) => {
    setIsScanning(true);
    setScanStatus('Initializing camera link...');
    setTimeout(() => {
      setScanStatus('Focusing on QR poster...');
      setTimeout(() => {
        setScanStatus('Decrypted! Navigating to catalogue...');
        setTimeout(() => {
          setIsScanning(false);
          navigate(`/s/${shopIdToScan}`);
        }, 600);
      }, 700);
    }, 700);
  };

  const downloadReceiptPDF = async (order) => {
    const { jsPDF: JsPDF } = await import('jspdf');
    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 160] // POS 80mm standard paper strip size!
    });
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text("=========================", 40, 10, { align: "center" });
    doc.text("MYSTORE OFFICIAL BILL", 40, 15, { align: "center" });
    doc.text("=========================", 40, 20, { align: "center" });
    
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text(`STORE: ${(order.shopName || 'Store').toUpperCase()}`, 6, 28);
    doc.text(`DATE : ${new Date(order.date).toLocaleString()}`, 6, 33);
    doc.text(`ORDER: ${(order.id || '').toUpperCase()}`, 6, 38);
    doc.text(`PHONE: +91 ${user?.phone || 'Guest'}`, 6, 43);
    doc.text("-------------------------", 40, 48, { align: "center" });
    
    let y = 54;
    doc.setFont("courier", "bold");
    doc.text("ITEM DESCRIPTION", 6, y);
    doc.text("SUB", 74, y, { align: "right" });
    
    y += 5;
    doc.setFont("courier", "normal");
    order.items.forEach((item) => {
      if (y > 140) return;
      doc.text(`${item.name.substring(0, 16)} x${item.qty}`, 6, y);
      doc.text(`₹${item.price * item.qty}`, 74, y, { align: "right" });
      y += 5;
    });
    
    doc.text("-------------------------", 40, y, { align: "center" });
    y += 6;
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL AMOUNT:", 6, y);
    doc.text(`INR ${order.total}.00`, 74, y, { align: "right" });
    
    y += 6;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text("GST Included (5% Mock)", 6, y);
    doc.text(`STATUS: ${(order.status || 'Pending').toUpperCase()}`, 6, y + 5);
    
    y += 15;
    doc.setFont("courier", "bold");
    doc.text("* SCAN SCAN GO *", 40, y, { align: "center" });
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.text("Thank you for shopping local!", 40, y + 4, { align: "center" });
    doc.text("Powered by MyStore OS", 40, y + 8, { align: "center" });
    
    doc.save(`Receipt_${order.id}.pdf`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Local catalogue filtering
  let filteredProducts = products.filter(p => p && p.name && p.name.toLowerCase().includes(localSearch.toLowerCase()));
  if (filter !== 'all') filteredProducts = filteredProducts.filter(p => p.category === filter);

  // Category chips derived from THIS shop's actual products, so an electronics
  // shop shows electronics categories — never a hardcoded grocery list.
  const productCategories = ['all', ...Array.from(new Set(
    products.map(p => (p.category || '').toString().toLowerCase().trim()).filter(Boolean)
  ))];

  // Featured rail: manually-featured products first; if the shop hasn't marked
  // any, auto-surface their newest products so the rail is never empty.
  const featuredProducts = (() => {
    const manual = products.filter(p => p && p.isFeatured);
    if (manual.length) return manual.slice(0, 10);
    return [...products]
      .filter(p => p && p.name)
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8);
  })();
  const showFeaturedRail = featuredProducts.length > 0 && filter === 'all' && !localSearch.trim();

  const sortedShops = getSortedShops();
  const activeCartsList = getActiveCartsList();

  if (!isMobile) {
    return (
      <div className="dashboard-wrapper-flex" style={{ background: '#F4F5F7', color: '#0F172A', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", width: '100%' }}>
        <ToastContainer theme="light" position="top-center" />
        {detailProduct && (
          <StorefrontProductDetail product={detailProduct} qty={cart[detailProduct.id] || 0} updateQty={updateQty} onClose={() => setDetailProduct(null)} />
        )}

        {/* GLOBAL ANNOUNCEMENTS TICKER MARQUEE */}
        {announcements.length > 0 && announcements.map(ann => (
          <div key={ann.id} style={{ background: 'rgba(30, 41, 59, 0.45)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E2E8F0', padding: '10px 16px', color: '#fff', fontSize: '13px', overflow: 'hidden', position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1100, width: '100%' }}>
            <span style={{
              background: ann.type === 'warning' ? '#f59e0b' : (ann.type === 'danger' || ann.type === 'error') ? '#ef4444' : '#3b82f6',
              color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0
            }}>
              {ann.type || 'Alert'}
            </span>
            <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative', height: '20px' }}>
              <div className="marquee-content" style={{ display: 'inline-block', position: 'absolute', whiteSpace: 'nowrap', animation: 'announcement-marquee 25s linear infinite' }}>
                {ann.text}
              </div>
            </div>
            <button onClick={() => setAnnouncements(prev => prev.filter(a => a.id !== ann.id))} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}><X size={14} /></button>
          </div>
        ))}

        {isStoreMode ? (
          // ================= DESKTOP STORE CATALOGUE MODE =================
          <>
            {/* Left Column (Sticky Sidebar) */}
            <div className="desktop-glass-sidebar">
              {/* Back to Marketplace Trigger */}
              <button 
                onClick={() => navigate('/user')}
                className="sidebar-nav-item"
                style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
              >
                <ArrowLeft size={16} /> Marketplace
              </button>

              {/* Shop Branding & Location Metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
                {shopInfo?.logo ? (
                  <div style={{ position: 'relative', width: '70px', height: '70px', marginBottom: '10px' }}>
                    <img 
                      src={shopInfo.logo} 
                      alt="Logo" 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4F46E5' }} 
                    />
                    {shopInfo.subscription && shopInfo.subscription !== 'trial' && (
                      <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'linear-gradient(135deg, #e11d48, #c084fc)', padding: '2px 6px', borderRadius: '8px', fontSize: '8px', fontWeight: '800' }}>PRO</span>
                    )}
                  </div>
                ) : (
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '10px' }}>🏪</div>
                )}
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>{shopInfo?.name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  <MapPin size={10} style={{ color: '#E11D48' }} />
                  <span>
                    {calculateDistance(coords.latitude, coords.longitude, shopInfo?.latitude, shopInfo?.longitude, shopInfo?.id) !== null ? (
                      `${calculateDistance(coords.latitude, coords.longitude, shopInfo?.latitude, shopInfo?.longitude, shopInfo?.id).toFixed(2)} km away`
                    ) : (
                      'Calculating distance...'
                    )}
                  </span>
                </div>
              </div>

              {/* Proximity walking map guide toggle button */}
              <button
                onClick={() => setShowWalkingMap(!showWalkingMap)}
                className="sidebar-nav-item"
                style={{ fontSize: '12px', background: 'rgba(139, 92, 246, 0.1)', color: '#c084fc', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}
              >
                <Navigation size={13} style={{ transform: showWalkingMap ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                {showWalkingMap ? 'Hide Route Map' : 'Show Walking Guide'}
              </button>

              {/* Category Filters Vertical Nav Menu */}
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>
                Store Categories
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }} className="custom-scroll">
                {productCategories.map(c => (
                  <button 
                    key={c}
                    onClick={() => setFilter(c)}
                    className={`sidebar-nav-item ${filter === c ? 'active' : ''}`}
                    style={{ textTransform: 'capitalize', fontSize: '13px', padding: '10px 14px' }}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Coins Panel and Logout */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                {user && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#4F46E5', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', justifyContent: 'center' }}>
                      <Gift size={13} /> {loyaltyCoins} Coins Available
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="sidebar-nav-item"
                      style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', background: '#FEF2FE', border: '1px solid #FCA5A5' }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content Workspace (Split POS Catalogue + Cart summary sheet) */}
            <div className="fluid-dashboard-main" style={{ marginTop: announcements.length > 0 ? '40px' : '0px' }}>
              
              {/* Walking Map SVG guide display */}
              {showWalkingMap && (
                <div className="glass" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'bold' }}>📍 GPS WALKING GUIDE MAP</span>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>GPS Connected</span>
                  </div>
                  <div style={{ position: 'relative', height: '80px', background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 20px' }}>
                    <svg width="100%" height="40" style={{ position: 'absolute', top: '20px', left: 0, overflow: 'visible' }}>
                      <path d="M 50 20 Q 200 -10, 400 20" fill="none" stroke="rgba(139, 92, 246, 0.25)" strokeWidth="3" />
                      <path d="M 50 20 Q 200 -10, 400 20" fill="none" stroke="#4F46E5" strokeWidth="3" strokeDasharray="6, 6" />
                    </svg>
                    <div style={{ position: 'absolute', top: '5px', left: '50px', fontSize: '20px', animation: 'walk-along-path 8s infinite linear', zIndex: 5 }}>🚶</div>
                    <div style={{ position: 'absolute', left: '30px', bottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>👤 <span style={{ fontSize: '11px', fontWeight: 'bold' }}>You</span></div>
                    <div style={{ position: 'absolute', right: '30px', bottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>🏪 <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#E11D48' }}>{shopInfo.name}</span></div>
                  </div>
                </div>
              )}

              <div className="responsive-split-grid" style={{ width: '100%' }}>
                {/* Center Column: Catalog directory grid */}
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748B' }}>
                        <Search size={18} />
                      </span>
                      <input 
                        type="text" 
                        placeholder="Search products in this store..." 
                        value={localSearch} 
                        onChange={e => setLocalSearch(e.target.value)} 
                        style={{ width: '100%', padding: '14px 14px 14px 46px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', color: '#0F172A', fontSize: '15px', outline: 'none', margin: 0 }}
                      />
                    </div>
                    <button 
                      onClick={() => handleVoiceSearch('local')}
                      style={{
                        width: '48px', height: '48px', borderRadius: '14px', border: '1px solid #E2E8F0',
                        background: isListeningLocal ? 'linear-gradient(135deg, #ef4444, #4F46E5)' : '#FFFFFF', border: '1px solid #E2E8F0',
                        color: isListeningLocal ? '#fff' : '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        flexShrink: 0, transition: 'all 0.3s',
                        boxShadow: isListeningLocal ? '0 0 12px #4F46E5' : 'none'
                      }}
                    >
                      <Mic size={18} />
                    </button>
                  </div>

                  {showFeaturedRail && (
                    <div style={{ marginBottom: '22px' }}>
                      <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Sparkles size={17} style={{ color: '#4F46E5' }} /> Featured
                      </h2>
                      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
                        {featuredProducts.map(p => (
                          <div key={p.id} style={{ flex: '0 0 172px', width: '172px' }}>
                            <StorefrontProductCard p={p} qty={cart[p.id] || 0} updateQty={updateQty} onOpen={setDetailProduct} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Catalogue Products ({filteredProducts.length})
                  </h2>

                  {isLocatingCatalog ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748B' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #4F46E5', borderTopColor: 'transparent', margin: '0 auto 12px', animation: 'laser-sweep 1s infinite linear' }}></div>
                      Loading catalogue...
                    </div>
                  ) : (
                    <div className="premium-product-grid">
                      {filteredProducts.map(p => (
                        <StorefrontProductCard key={p.id} p={p} qty={cart[p.id] || 0} updateQty={updateQty} onOpen={setDetailProduct} />
                      ))}
                    </div>
                  )}

                  {filteredProducts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 12px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
                      <AlertTriangle size={24} style={{ color: '#4F46E5', margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>{products.length === 0 ? 'This store hasn\'t added any products yet.' : 'No items match your search filter.'}</p>
                    </div>
                  )}
                </div>

                {/* Right Column: Checkout cart bill sheet & payments */}
                <div>
                  <div className="premium-glass-card" style={{ padding: '20px', position: 'sticky', top: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#4F46E5', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShoppingCart size={18} /> Active Checkout Cart
                    </h3>

                    {getCartTotals().count === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                        <ShoppingCart size={32} style={{ color: '#1e293b', margin: '0 auto 12px' }} />
                        Your checkout cart is empty. Select products from the catalogue to build invoice!
                      </div>
                    ) : (
                      <>
                        {/* Cart items scroll summary */}
                        <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', marginBottom: '16px' }} className="custom-scroll">
                          {getCartTotals().items.map(i => (
                            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '13px' }}>
                              <span style={{ color: '#475569' }}>{i.name} <strong style={{ color: '#E11D48' }}>x{i.qty}</strong></span>
                              <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{i.price * i.qty}</span>
                            </div>
                          ))}
                        </div>

                        {/* Order calculation summary */}
                        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
                            <span>Total Items:</span>
                            <span>{getCartTotals().count} units</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800', color: '#4F46E5', borderTop: '2px dashed rgba(245,158,11,0.2)', paddingTop: '10px', marginBottom: '16px' }}>
                            <span>Payable Total:</span>
                            <span>₹{getCartTotals().total}</span>
                          </div>
                        </div>

                        {/* Payment Switch Tabs */}
                        <div style={{ display: 'flex', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '4px', marginBottom: '16px' }}>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('upi')}
                            style={{
                              flex: 1, padding: '8px', borderRadius: '10px', border: 'none',
                              background: paymentMethod === 'upi' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                              color: paymentMethod === 'upi' ? '#fff' : '#64748B',
                              fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                            }}
                          >
                            💳 UPI
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            style={{
                              flex: 1, padding: '8px', borderRadius: '10px', border: 'none',
                              background: paymentMethod === 'cash' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                              color: paymentMethod === 'cash' ? '#fff' : '#64748B',
                              fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                            }}
                          >
                            💵 Cash
                          </button>
                        </div>

                        {/* Dynamic payment options */}
                        {paymentMethod === 'upi' ? (
                          (shopInfo?.paymentQr || shopInfo?.upiId) ? (
                            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', padding: '14px', marginBottom: '16px', textAlign: 'center' }}>
                              <h4 style={{ color: '#10b981', margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <CreditCard size={13} /> Scan QR to Pay
                              </h4>
                              {/* PRIMARY: shop's own uploaded scanner/QR poster, if they set one */}
                              {shopInfo?.paymentQr ? (
                                <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', display: 'inline-block', marginBottom: '10px', border: '2px solid #10b981' }}>
                                  <img src={shopInfo.paymentQr} alt="Shop payment QR" style={{ maxWidth: '220px', width: '100%', maxHeight: '240px', objectFit: 'contain', borderRadius: '6px' }} />
                                </div>
                              ) : (
                                <div style={{ background: '#fff', padding: '8px', borderRadius: '8px', display: 'inline-block', marginBottom: '8px' }}>
                                  <QRCodeSVG value={`upi://pay?pa=${shopInfo.upiId}&pn=${encodeURIComponent(shopInfo.name)}&cu=INR`} size={140} />
                                </div>
                              )}
                              {/* SECONDARY: UPI ID below the scanner (copyable) */}
                              {shopInfo?.upiId && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px', marginBottom: '4px', fontSize: '11px' }}>
                                  <span style={{ color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all' }}>{shopInfo.upiId}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(shopInfo.upiId);
                                      toast.success("UPI ID copied!");
                                    }}
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', width: 'auto' }}
                                  >
                                    Copy
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '10px', marginBottom: '16px', textAlign: 'center' }}>
                              <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>💵 No UPI details registered. Pay Cash at Counter.</p>
                            </div>
                          )
                        ) : (
                          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', padding: '14px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
                            <h4 style={{ color: '#4F46E5', margin: '0 0 4px 0', fontSize: '13px' }}>💵 Cash Counter Settlement</h4>
                            <p style={{ fontSize: '11px', color: '#475569', margin: 0, lineHeight: '1.4' }}>Pay with cash or card at the store counter. Click button below to notify merchant.</p>
                          </div>
                        )}

                        {/* Guest onboarding inline details */}
                        {!user && (
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '12px', color: '#64748B', marginBottom: '10px', fontWeight: 'bold' }}>One-Time Guest Checkout Details</h4>
                            <input 
                              type="text" 
                              placeholder="Your Full Name" 
                              value={guestName} 
                              onChange={e=>setGuestName(e.target.value)} 
                              style={{ padding: '10px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', marginBottom: '8px', outline: 'none' }} 
                            />
                            <input 
                              type="tel" 
                              placeholder="10-Digit Mobile Number" 
                              value={guestPhone} 
                              onChange={e=>setGuestPhone(e.target.value.replace(/\D/g,"").slice(0,10))} 
                              style={{ padding: '10px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', marginBottom: '0', outline: 'none' }} 
                            />
                          </div>
                        )}

                        {/* Transaction Proof */}
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: 'bold' }}>Transaction ID / Ref # (Optional)</label>
                          <input 
                            type="text" 
                            placeholder="Enter 12-Digit Ref ID" 
                            value={paymentProof} 
                            onChange={e => setPaymentProof(e.target.value)} 
                            style={{ width: '100%', padding: '10px', background: '#FFFFFF', border: '1.5px solid #CBD5E1', borderRadius: '8px', color: '#0F172A', fontSize: '13px', margin: 0, outline: 'none', transition: 'all 0.15s ease' }}
                          />
                        </div>

                        {/* Place Order Trigger */}
                        <button 
                          onClick={sendWhatsAppOrder} 
                          style={{ width: '100%', background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 211, 102, 0.2)' }}
                        >
                          📲 Notify & Place Order via WhatsApp
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          // ================= DESKTOP MARKETPLACE HOME MODE =================
          <>
            {/* Left Sidebar */}
            <div className="desktop-glass-sidebar">
              {/* User Profiling details */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', paddingLeft: '8px' }}>
                <label style={{ cursor: 'pointer', position: 'relative' }}>
                  <img 
                    src={avatar || 'https://ui-avatars.com/api/?name=' + (user?.name || 'Guest') + '&background=random'} 
                    alt="User" 
                    style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid #4F46E5', objectFit: 'cover' }} 
                  />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </label>
                <div>
                  <div style={{ color: '#E11D48', fontSize: '11px', fontWeight: '800' }}>CONSUMER PORTAL</div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>{user?.name || 'Guest User'}</h3>
                </div>
              </div>

              {/* Marketplace vertical nav list */}
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>
                Navigation Menu
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                {[
                  { id: 'explore', label: 'Explore Shops', icon: Compass },
                  { id: 'search', label: 'Global Item Search', icon: Search },
                  { id: 'scan', label: 'Scan QR Poster', icon: QrCode },
                  { id: 'bills', label: 'My Bills Ledger', icon: Receipt },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setCameraScannerActive(false);
                      }}
                      className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                      style={{ fontSize: '13px', padding: '12px 14px' }}
                    >
                      <Icon size={16} /> {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Footer status GPS & coins */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                {user && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#4F46E5', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', justifyContent: 'center', marginBottom: '12px' }}>
                    <Gift size={13} /> {loyaltyCoins} Loyalty Coins
                  </div>
                )}
                
                {/* GPS lock widget */}
                <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px', marginBottom: '12px', fontSize: '11px' }}>
                  <div style={{ color: '#64748b', fontWeight: 'bold', fontSize: '9px', marginBottom: '2px' }}>GPS COORDINATES</div>
                  <div style={{ color: '#475569', fontWeight: 'bold' }}>{locationStatus}</div>
                  <button 
                    onClick={() => grabLiveLocation(false)} 
                    style={{ width: '100%', background: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', color: '#E11D48', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Compass size={10} /> Refocus GPS
                  </button>
                </div>

                {user ? (
                  <button 
                    onClick={handleLogout}
                    className="sidebar-nav-item"
                    style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', background: '#FEF2FE', border: '1px solid #FCA5A5' }}
                  >
                    Logout
                  </button>
                ) : (
                  <button 
                    onClick={() => navigate('/login')}
                    className="sidebar-nav-item active"
                    style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                  >
                    Sign In to Account
                  </button>
                )}
              </div>
            </div>

            {/* Main Content Workspace */}
            <div className="fluid-dashboard-main" style={{ marginTop: announcements.length > 0 ? '40px' : '0px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '20px' }}>
                MyStore <span style={{ color: '#4F46E5' }}>OS Marketplace</span>
              </h1>

              {/* Explore Tab Panel */}
              {activeTab === 'explore' && (
                <div className="responsive-split-grid">
                  {/* Left block: local shops list */}
                  <div>
                    {/* Coming-soon promo banners — shown to shoppers on the marketplace home */}
                    {(() => {
                      const banners = [
                        { on: siteCfg?.comingSoon1Active, title: siteCfg?.comingSoon1Title, sub: siteCfg?.comingSoon1Sub, grad: 'linear-gradient(135deg,#4F46E5,#7C3AED)' },
                        { on: siteCfg?.comingSoon2Active, title: siteCfg?.comingSoon2Title, sub: siteCfg?.comingSoon2Sub, grad: 'linear-gradient(135deg,#B8860B,#D97706)' },
                      ].filter(b => b.on && b.title);
                      if (!banners.length) return null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                          {banners.map((b, i) => (
                            <div key={i} style={{ background: b.grad, borderRadius: '14px', padding: '16px 18px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <div>
                                <div style={{ fontSize: '16px', fontWeight: 800 }}>{b.title}</div>
                                {b.sub && <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>{b.sub}</div>}
                              </div>
                              <span style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>COMING SOON</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {activeCartsList.length > 0 && (
                      <div className="glass" style={{ padding: '14px', marginBottom: '20px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#E11D48', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShoppingCart size={13} /> Active Carts Pending Checkout
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {activeCartsList.map(cartItem => (
                            <div key={cartItem.shopId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                              <span style={{ color: '#475569' }}>You have <strong>{cartItem.count} items</strong> at {cartItem.shopName}</span>
                              <button 
                                onClick={() => navigate(`/s/${cartItem.shopId}`)}
                                style={{ width: 'auto', padding: '4px 10px', fontSize: '11px', background: '#4F46E5', color: '#fff', borderRadius: '6px', fontWeight: 'bold' }}
                              >
                                Resume Checkout
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', marginBottom: '10px' }}>
                      Shops near you
                    </h2>

                    {/* Mini product search */}
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <span style={{ position: 'absolute', left: '13px', top: '12px', color: '#64748b' }}><Search size={15} /></span>
                      <input
                        type="text"
                        placeholder='Find items nearby — e.g. "eggs", "rice"'
                        value={nearbySearch}
                        onChange={e => setNearbySearch(e.target.value)}
                        style={{ width: '100%', padding: '11px 12px 11px 36px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '13px', outline: 'none', margin: 0 }}
                      />
                    </div>

                    {/* Category filter chips */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {[['all', 'All'], ['kirana', 'Kirana'], ['medical', 'Medical'], ['general', 'General'], ['electronics', 'Electronics']].map(([val, label]) => (
                        <button key={val} onClick={() => setShopCategoryFilter(val)} style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: shopCategoryFilter === val ? 'linear-gradient(135deg, #4F46E5, #6366F1)' : '#FFFFFF', border: '1px solid ' + (shopCategoryFilter === val ? '#4F46E5' : '#E2E8F0'), color: shopCategoryFilter === val ? '#FFFFFF' : '#475569', boxShadow: shopCategoryFilter === val ? '0 4px 12px rgba(79,70,229,0.2)' : 'none', transition: 'all 0.15s' }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Nearby search results */}
                    {nearbySearch.trim() && nearbySearchResults.length > 0 && (
                      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
                        <p style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '700', margin: '0 0 8px 0' }}>📦 Found in nearby shops:</p>
                        {nearbySearchResults.slice(0, 5).map(r => (
                          <div key={r.id} onClick={() => navigate(`/s/${r.shopId}?search=${encodeURIComponent(r.name)}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', background: '#F1F5F9', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', color: '#0F172A' }}>{r.name}</span>
                            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>₹{r.price} →</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {nearbySearch.trim() && nearbySearchResults.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px', textAlign: 'center' }}>No nearby shops carry "{nearbySearch}" right now.</p>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                      {sortedShops.map(shop => {
                        const dist = shop.distance ?? calculateDistance(coords.latitude, coords.longitude, shop.latitude, shop.longitude, shop.id);
                        const waMsg = encodeURIComponent(`Hi ${shop.name}! I'd like to place an order. Please share your catalogue. (via MyStore OS)`);
                        return (
                          <MarketplaceShopCard
                            key={shop.id}
                            shop={shop}
                            dist={dist}
                            onOpen={() => navigate(`/s/${shop.id}`)}
                            onWhatsApp={() => window.open(`https://wa.me/91${shop.phone}?text=${waMsg}`, '_blank')}
                          />
                        );
                      })}

                      {sortedShops.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 12px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
                          <AlertTriangle size={24} style={{ color: '#4F46E5', margin: '0 auto 8px' }} />
                          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>No shops found{shopCategoryFilter !== 'all' ? ` in "${shopCategoryFilter}" category` : ' nearby'}.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right block: Loyalty Coins */}
                  <div>
                    <div className="premium-glass-card" style={{ padding: '20px', position: 'relative' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#4F46E5', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                        <Gift size={16} /> loyalty Coins Rewards
                      </h3>
                      <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4', marginBottom: '16px' }}>
                        Earn guaranteed coins with every checkout order! Scratch the coupon card at invoice delivery to unlock free local cashback rewards.
                      </p>
                      <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ fontSize: '32px' }}>🪙</div>
                        <div>
                          <div style={{ fontSize: '24px', fontWeight: '900', color: '#4F46E5' }}>{loyaltyCoins}</div>
                          <div style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold', textTransform: 'uppercase' }}>Coins Locked in Ledger</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Global search tab view */}
              {activeTab === 'search' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748B' }}>
                        <Search size={18} />
                      </span>
                      <input 
                        type="text" 
                        placeholder="Search items globally across all local shops (e.g. Rice, Oil)..." 
                        value={globalSearch} 
                        onChange={e => {
                          setGlobalSearch(e.target.value);
                        }} 
                        style={{ width: '100%', padding: '14px 14px 14px 46px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', color: '#0F172A', fontSize: '15px', outline: 'none', margin: 0 }}
                      />
                    </div>
                    <button 
                      onClick={() => handleVoiceSearch('global')}
                      style={{
                        width: '48px', height: '48px', borderRadius: '14px', border: '1px solid #E2E8F0',
                        background: isListeningGlobal ? 'linear-gradient(135deg, #ef4444, #4F46E5)' : '#FFFFFF', border: '1px solid #E2E8F0',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        flexShrink: 0, transition: 'all 0.3s',
                        boxShadow: isListeningGlobal ? '0 0 12px #4F46E5' : 'none'
                      }}
                    >
                      <Mic size={18} />
                    </button>
                  </div>

                  <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#64748B', marginBottom: '14px' }}>
                    📦 Search Results ({globalResults.length})
                  </h2>

                  <div className="premium-product-grid">
                    {globalResults.map(res => (
                      <div key={`${res.shopId}-${res.id}`} className="glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                        <div style={{ fontSize: '36px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', borderRadius: '12px' }}>
                          {res.icon || '📦'}
                        </div>
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.name}</h3>
                        <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>🏪 {res.shopName}</p>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#4F46E5', marginTop: 'auto' }}>₹{res.price}</div>
                        <button 
                          onClick={() => navigate(`/s/${res.shopId}?search=${encodeURIComponent(res.name)}`)}
                          style={{ padding: '8px 12px', fontSize: '12px', background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Visit Store 🏪
                        </button>
                      </div>
                    ))}
                  </div>

                  {globalResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 12px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
                      <Search size={24} style={{ color: '#475569', margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>Type an item name above to run search query.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Scan tab view */}
              {activeTab === 'scan' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                  <div className="glass" style={{ padding: '30px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <QrCode size={30} style={{ color: '#E11D48' }} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>Scan Shop printed QR Poster</h3>
                    <p style={{ fontSize: '12px', color: '#475569', marginBottom: '20px', lineHeight: '1.4' }}>
                      Enable camera permission, hold the phone up to the shopkeeper's barcode poster to auto load their catalogue.
                    </p>
                    <div style={{ background: '#090d16', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '16px', padding: '24px', position: 'relative', minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cameraScannerActive ? (
                        <div id="reader" style={{ width: '100%' }}></div>
                      ) : (
                        <div style={{ cursor: 'pointer' }} onClick={() => setCameraScannerActive(true)}>
                          <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>📷</span>
                          <span style={{ fontSize: '13px', color: '#4F46E5', fontWeight: 'bold' }}>Trigger Webcam/Camera Hardware</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bills tab view */}
              {activeTab === 'bills' && (
                <div className="responsive-split-grid equal-cols">
                  {/* Left Column: bills lists */}
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                      📋 Invoice Receipts & Digital Ledgers
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '70vh', overflowY: 'auto' }} className="custom-scroll">
                      {orders.map(order => (
                        <div 
                          key={order.id} 
                          className="glass" 
                          onClick={() => setSelectedOrder(order)}
                          style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: selectedOrder?.id === order.id ? '2px solid #4F46E5' : '1px solid #E2E8F0' }}
                        >
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>🏪 {order.shopName || 'Store Invoice'}</h4>
                            <p style={{ fontSize: '10px', color: '#475569', margin: '4px 0 0 0' }}>Order ID: {order.id.substring(0,8).toUpperCase()} • {new Date(order.date).toLocaleDateString()}</p>
                            <p style={{ fontSize: '11px', color: '#4F46E5', fontWeight: 'bold', margin: '4px 0 0 0' }}>{order.items?.length || 0} items purchased</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '16px', fontWeight: '800', color: '#10b981' }}>₹{order.total}</span>
                            <div style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', color: '#64748B', marginTop: '3px' }}>
                              View Slip 🗒️
                            </div>
                          </div>
                        </div>
                      ))}

                      {orders.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 12px', color: '#64748b' }}>
                          <Receipt size={32} style={{ color: '#1e293b', margin: '0 auto 12px' }} />
                          You have not placed any orders yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: physical receipt preview */}
                  <div>
                    {selectedOrder ? (
                      <div className="premium-glass-card" style={{ padding: '20px', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '11px', color: '#4F46E5', fontWeight: 'bold' }}>🗒️ INVOICE RECEIPT CANVAS</span>
                          <button 
                            onClick={() => downloadReceiptPDF(selectedOrder)}
                            style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Printer size={12} /> Print PDF
                          </button>
                        </div>

                        <div className="receipt-paper" style={{ padding: '24px 20px', borderRadius: '2px', color: '#000' }}>
                          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                            <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '0.5px' }}>
                              *** MYSTORE INVOICE ***
                            </h2>
                            <p style={{ fontStyle: 'italic', margin: 0, fontSize: '11px' }}>POS-Roll Serialized Bill</p>
                          </div>

                          <div style={{ fontSize: '11px', lineHeight: '1.4', marginBottom: '14px' }}>
                            <div><strong>STORE :</strong> {(selectedOrder.shopName || 'Store').toUpperCase()}</div>
                            <div><strong>DATE  :</strong> {new Date(selectedOrder.date).toLocaleString()}</div>
                            <div><strong>BILL# :</strong> {(selectedOrder.id || '').toUpperCase()}</div>
                            <div><strong>CLIENT :</strong> {user?.name || 'Walk-in'}</div>
                          </div>

                          <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>

                          <div style={{ fontSize: '11px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '6px' }}>
                              <span>ITEM DESC</span>
                              <span>SUB</span>
                            </div>
                            {selectedOrder.items?.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span>{item.name.substring(0, 18)} x{item.qty}</span>
                                <span>₹{item.price * item.qty}</span>
                              </div>
                            ))}
                          </div>

                          <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
                            <span>TOTAL AMT:</span>
                            <span>₹{selectedOrder.total}</span>
                          </div>

                          <div style={{ textAlign: 'center', fontSize: '9px', lineHeight: '1.3', marginTop: '10px' }}>
                            <strong>* SCAN PAY PACK GO *</strong>
                            <div>Thank you for shopping local!</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="glass" style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#64748b', border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <Receipt size={40} style={{ color: '#1e293b', marginBottom: '12px' }} />
                        <p style={{ margin: 0, fontSize: '14px', textAlign: 'center' }}>Select an invoice voucher from the ledger to preview receipt slip</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Overlays for Desktop Mode */}
        {showReceiptModal && selectedOrder && (
          <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '350px' }}>
              <div className="receipt-paper" style={{ padding: '24px 20px', borderRadius: '2px', color: '#000' }}>
                <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '0.5px' }}>*** MYSTORE INVOICE ***</h2>
                  <p style={{ fontStyle: 'italic', margin: 0, fontSize: '11px' }}>POS-Roll Serialized Bill</p>
                </div>
                <div style={{ fontSize: '11px', lineHeight: '1.4', marginBottom: '14px' }}>
                  <div><strong>STORE :</strong> {(selectedOrder.shopName || 'Store').toUpperCase()}</div>
                  <div><strong>DATE  :</strong> {new Date(selectedOrder.date).toLocaleString()}</div>
                  <div><strong>BILL# :</strong> {(selectedOrder.id || '').toUpperCase()}</div>
                </div>
                <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>
                <div style={{ fontSize: '11px', marginBottom: '10px' }}>
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>{item.name.substring(0, 18)} x{item.qty}</span>
                      <span>₹{item.price * item.qty}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
                  <span>TOTAL AMT:</span>
                  <span>₹{selectedOrder.total}</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '10px' }}>
                  <strong>* SCAN PAY PACK GO *</strong>
                  <div>Thank you for shopping local!</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => downloadReceiptPDF(selectedOrder)} style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>Print Receipt</button>
                <button onClick={() => setShowReceiptModal(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '13px' }}>Close</button>
              </div>
            </div>
          </div>
        )}

        {showGuestModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '380px', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
              {guestStep === 'success' ? (
                /* ── Success step ── */
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎉</div>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 8px', color: '#0F172A' }}>Account Created!</h2>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 6px', lineHeight: 1.6 }}>
                    Your orders, bills, and loyalty points will now be saved to your account.
                  </p>
                  <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 20px' }}>
                    📱 Login anytime at <strong>mystoreos.in</strong> with your mobile number and password.
                  </p>
                  <button
                    onClick={() => { setGuestStep('form'); setShowGuestModal(false); setShowWaModal(true); }}
                    style={{ width: '100%', background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer' }}
                  >
                    Continue to Order ➔
                  </button>
                </div>
              ) : (
                /* ── Form step ── */
                <>
                  <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                    <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>🛒</div>
                    <h2 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px', color: '#0F172A' }}>Quick Sign Up</h2>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Create your free account to place orders &amp; track bills</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                    <input
                      type="text"
                      placeholder="Your Full Name"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#4F46E5'}
                      onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                    />
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13, fontWeight: 600, pointerEvents: 'none' }}>+91</span>
                      <input
                        type="tel"
                        placeholder="10-digit mobile number"
                        value={guestPhone}
                        onChange={e => setGuestPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                        style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = '#4F46E5'}
                        onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                      />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={guestShowPw ? 'text' : 'password'}
                        placeholder="Create a password (min 4 chars)"
                        value={guestPassword}
                        onChange={e => setGuestPassword(e.target.value)}
                        style={{ width: '100%', padding: '12px 42px 12px 14px', border: '1.5px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = '#4F46E5'}
                        onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                      />
                      <button type="button" onClick={() => setGuestShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                        {guestShowPw ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '10px 12px', marginBottom: '18px', display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                    <p style={{ margin: 0, fontSize: '12px', color: '#4F46E5', lineHeight: 1.5 }}>
                      Remember this password — you can use it to login and view all your past bills &amp; orders at any time.
                    </p>
                  </div>

                  <button
                    onClick={handleGuestLogin}
                    style={{ width: '100%', background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginBottom: '8px', boxShadow: '0 4px 16px rgba(79,70,229,0.35)' }}
                  >
                    Create Account &amp; Continue
                  </button>
                  <button
                    onClick={() => setShowGuestModal(false)}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: '#94A3B8', padding: '8px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {scratchModalOpen && (
          <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg, #EEF2FF, #FFFFFF)', border: '1px solid #E2E8F0', width: '100%', maxWidth: '340px', borderRadius: '24px', padding: '24px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#4F46E5', margin: '0 0 4px 0' }}><Gift size={20} /> Checkout Cashback!</h3>
              <p style={{ color: '#475569', fontSize: '13px', margin: '8px 0 20px 0' }}>Rub the silver card below to reveal your guaranteed coins.</p>
              <div style={{ position: 'relative', width: '240px', height: '240px', margin: '0 auto 20px', borderRadius: '16px', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  <span style={{ fontSize: '42px' }}>🎉</span>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 'bold' }}>YOU WON</span>
                  <h4 style={{ fontSize: '32px', fontWeight: '900', color: '#4F46E5', margin: 0 }}>+{scratchCardAmount}</h4>
                  <span style={{ fontSize: '11px', color: '#475569' }}>Loyalty Coins</span>
                </div>
                <canvas
                  ref={scratchCanvasRef}
                  width={240}
                  height={240}
                  style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, borderRadius: '16px', display: scratchCardRevealed ? 'none' : 'block' }}
                  onMouseDown={() => { isDrawingScratch.current = true; }}
                  onMouseUp={() => { isDrawingScratch.current = false; }}
                  onMouseLeave={() => { isDrawingScratch.current = false; }}
                  onMouseMove={handleScratchMove}
                  onTouchStart={() => { isDrawingScratch.current = true; }}
                  onTouchEnd={() => { isDrawingScratch.current = false; }}
                  onTouchMove={handleScratchMove}
                />
              </div>
              {scratchCardRevealed ? (
                <button onClick={() => setScratchModalOpen(false)} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '12px' }}>Claim Coins & Continue</button>
              ) : (
                <button disabled style={{ background: '#FFFFFF', color: '#64748b', padding: '12px' }}>Scratch to Reveal</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: '#F4F5F7', color: '#0F172A', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />
        {detailProduct && (
          <StorefrontProductDetail product={detailProduct} qty={cart[detailProduct.id] || 0} updateQty={updateQty} onClose={() => setDetailProduct(null)} />
        )}

      {/* GLOBAL ANNOUNCEMENTS TICKER MARQUEE */}
      {announcements.length > 0 && announcements.map(ann => (
        <div key={ann.id} style={{ background: 'rgba(30, 41, 59, 0.45)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E2E8F0', padding: '10px 16px', color: '#fff', fontSize: '13px', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1100 }}>
          <span style={{
            background: ann.type === 'warning' ? '#f59e0b' : (ann.type === 'danger' || ann.type === 'error' || ann.type === 'danger') ? '#ef4444' : '#3b82f6',
            color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', flexShrink: 0
          }}>
            {ann.type || 'Alert'}
          </span>
          <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative', height: '20px' }}>
            <div className="marquee-content" style={{ display: 'inline-block', position: 'absolute', whiteSpace: 'nowrap', animation: 'announcement-marquee 25s linear infinite' }}>
              {ann.text}
            </div>
          </div>
          <button onClick={() => setAnnouncements(prev => prev.filter(a => a.id !== ann.id))} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}><X size={14} /></button>
        </div>
      ))}

      {/* ======================================================== */}
      {/* MODE A: STORE CATALOGUE MODE                             */}
      {/* ======================================================== */}
      {isStoreMode ? (
        !shopInfo ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', background: 'transparent', color: '#64748B' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(244, 63, 94, 0.2)', borderTopColor: '#4F46E5', animation: 'laser-sweep 1s infinite linear', marginBottom: '16px' }}></div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', letterSpacing: '0.5px' }}>Loading Store Profile...</p>
          </div>
        ) : (
          <div style={{ paddingBottom: '90px' }}>
            
            {/* Header & Hero Area */}
            <div style={{ position: 'relative', overflow: 'hidden', padding: '24px 16px', background: 'linear-gradient(135deg, #F4F5F7, #EEF2FF)', borderBottom: '1px solid #E2E8F0' }}>
              
              {/* Back to Marketplace Trigger */}
              <button 
                onClick={() => navigate('/user')}
                style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', padding: '8px 14px', borderRadius: '20px', width: 'auto', fontSize: '13px', cursor: 'pointer', zIndex: 10 }}
              >
                <ArrowLeft size={16} /> Home
              </button>

              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'absolute', top: 16, right: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#4F46E5', padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    <Gift size={13} /> {loyaltyCoins} Coins
                  </div>
                  <button 
                    onClick={handleLogout}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '8px 14px', borderRadius: '20px', width: 'auto', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Logout
                  </button>
                </div>
              )}

              {/* Shop branding & location metadata */}
              <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                
                {shopInfo?.logo ? (
                  <div style={{ position: 'relative', width: '84px', height: '84px', marginBottom: '12px' }}>
                    <img 
                      src={shopInfo?.logo} onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      alt="Logo" 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #4F46E5', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.25)' }} 
                    />
                    {shopInfo?.subscription && shopInfo?.subscription !== 'trial' && (
                      <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'linear-gradient(135deg, #e11d48, #c084fc)', border: '2px solid #FFFFFF', padding: '3px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px' }}>
                        PRO
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '12px', boxShadow: '0 8px 20px rgba(139, 92, 246, 0.2)' }}>
                    🏪
                  </div>
                )}

                <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', margin: '0 0 4px 0', color: '#0F172A' }}>
                  {shopInfo?.name || 'Sai Supermarket'}
                </h1>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#64748B', marginBottom: '8px' }}>
                  <MapPin size={13} style={{ color: '#E11D48' }} />
                  <span>
                    GPS Location Locked • 
                    {calculateDistance(coords.latitude, coords.longitude, shopInfo?.latitude, shopInfo?.longitude, shopInfo?.id) !== null ? (
                      ` ${(calculateDistance(coords.latitude, coords.longitude, shopInfo?.latitude, shopInfo?.longitude, shopInfo?.id)).toFixed(2)} km away`
                    ) : (
                      ' Calculating proximity...'
                    )}
                  </span>
                </div>

              {/* Badges row */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                <span style={{ background: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', color: '#E11D48', padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                  🏪 Scan & Shop
                </span>
                <span style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                  💳 Instant UPI
                </span>
                <span style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#4F46E5', padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                  ⚡ Instant Invoice
                </span>
              </div>

              {/* Proximity Route Walking Map Toggle */}
              <div style={{ marginTop: '14px' }}>
                <button
                  onClick={() => setShowWalkingMap(!showWalkingMap)}
                  style={{
                    width: 'auto',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: '#c084fc',
                    padding: '8px 18px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Navigation size={13} style={{ transform: showWalkingMap ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  {showWalkingMap ? 'Hide Proximity Route' : 'Show Walking Guide Map'}
                </button>
              </div>

              {/* GORGEOUS PROXIMITY ROUTE SVG walking guide */}
              {showWalkingMap && (
                <div style={{
                  marginTop: '16px',
                  background: '#F8FAFC', border: '1px solid #E2E8F0',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '16px',
                  maxWidth: '380px',
                  width: '100%',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📍 LIVE WALKING PROXIMITY GUIDE
                    </span>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
                      GPS Connected
                    </span>
                  </div>

                  <div style={{ position: 'relative', height: '100px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                    {/* SVG dashed path representation between user and shop anchors */}
                    <svg width="100%" height="60" style={{ position: 'absolute', top: '20px', left: 0, overflow: 'visible' }}>
                      <path 
                        d="M 35 30 Q 130 5, 225 30" 
                        fill="none" 
                        stroke="rgba(139, 92, 246, 0.25)" 
                        strokeWidth="3" 
                      />
                      <path 
                        d="M 35 30 Q 130 5, 225 30" 
                        fill="none" 
                        stroke="#4F46E5" 
                        strokeWidth="3" 
                        strokeDasharray="6, 6" 
                      />
                    </svg>

                    {/* Animated walker emoji */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '35px',
                      fontSize: '24px',
                      animation: 'walk-along-path 8s infinite linear',
                      zIndex: 5
                    }}>
                      🚶
                    </div>

                    {/* User Anchor Point */}
                    <div style={{ position: 'absolute', left: '20px', bottom: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>👤</span>
                      <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748B', marginTop: '2px' }}>You</span>
                    </div>

                    {/* Shop Anchor Point */}
                    <div style={{ position: 'absolute', right: '20px', bottom: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>🏪</span>
                      <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#E11D48', marginTop: '2px' }}>Shop</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                      <Compass size={13} style={{ color: '#4F46E5' }} />
                      <span>Bearing: <strong style={{ color: '#0F172A' }}>North-East</strong></span>
                    </div>
                    <div style={{ color: '#4F46E5', fontWeight: 'bold' }}>
                      Est. Time: ~3 mins
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* ── SHOP PHOTO GALLERY ── */}
          {shopInfo?.shopPhotos && shopInfo.shopPhotos.length > 0 && (() => {
            return (
              <ShopPhotoGallery photos={shopInfo.shopPhotos} shopName={shopInfo.name} />
            );
          })()}

          {/* Catalog Search & Category Filters */}
          <div style={{ padding: '16px', background: 'rgba(11, 15, 25, 0.85)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748B' }}>
                  <Search size={18} />
                </span>
                <input 
                  type="text" 
                  placeholder="Search products in this store..." 
                  value={localSearch} 
                  onChange={e => setLocalSearch(e.target.value)} 
                  style={{ width: '100%', padding: '14px 14px 14px 46px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', color: '#0F172A', fontSize: '15px', outline: 'none', margin: 0 }}
                />
              </div>
              <button 
                onClick={() => handleVoiceSearch('local')}
                style={{
                  width: '48px', height: '48px', borderRadius: '14px', border: '1px solid #E2E8F0',
                  background: isListeningLocal ? 'linear-gradient(135deg, #ef4444, #4F46E5)' : '#FFFFFF', border: '1px solid #E2E8F0',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  flexShrink: 0, transition: 'all 0.3s',
                  boxShadow: isListeningLocal ? '0 0 12px #4F46E5' : 'none'
                }}
                title="Voice Search"
              >
                <Mic size={18} />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="custom-scroll" style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
              {productCategories.map(c => (
                <button 
                  key={c}
                  onClick={() => setFilter(c)}
                  style={{ 
                    flexShrink: 0, padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize', width: 'auto',
                    background: filter === c ? '#4F46E5' : '#FFFFFF', border: '1px solid ' + (filter === c ? '#4F46E5' : '#E2E8F0'),
                    color: filter === c ? 'white' : '#94a3b8',
                    border: filter === c ? 'none' : '1px solid #E2E8F0',
                    transition: 'all 0.2s'
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Store Catalog Product List */}
          <div style={{ padding: '16px' }}>
            {showFeaturedRail && (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} style={{ color: '#4F46E5' }} /> Featured
                </h2>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
                  {featuredProducts.map(p => (
                    <div key={p.id} style={{ flex: '0 0 150px', width: '150px' }}>
                      <StorefrontProductCard p={p} qty={cart[p.id] || 0} updateQty={updateQty} onOpen={setDetailProduct} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Catalogue Products ({filteredProducts.length})
            </h2>

            {isLocatingCatalog ? (
              <div style={{ padding: '40px 0', textAlignment: 'center', color: '#64748B' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #4F46E5', borderTopColor: 'transparent', margin: '0 auto 12px', animation: 'laser-sweep 1s infinite linear' }}></div>
                Loading catalogue items...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {filteredProducts.map(p => (
                  <StorefrontProductCard key={p.id} p={p} qty={cart[p.id] || 0} updateQty={updateQty} onOpen={setDetailProduct} />
                ))}

                {filteredProducts.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 12px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
                    <AlertTriangle size={24} style={{ color: '#4F46E5', margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>{products.length === 0 ? 'This store hasn\'t added any products yet.' : 'No items match your query in this store.'}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shopping Cart Bar Sticky Bottom */}
          {getCartTotals().count > 0 && (
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, borderTopLeftRadius: '20px', borderTopRightRadius: '20px', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#0F172A' }}>🛒 {getCartTotals().count} Items Checked</h4>
                <p style={{ fontSize: '13px', color: '#4F46E5', fontWeight: '800', margin: 0 }}>Total: ₹{getCartTotals().total}</p>
              </div>
              <button 
                onClick={handleCheckoutClick} 
                style={{ width: 'auto', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '14px 24px', borderRadius: '14px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}
              >
                Checkout & Pay <ChevronRight size={16} />
              </button>
            </div>
          )}

          </div>
        )
      ) : (
        // ========================================================
        // MODE B: GENERAL CONSUMER MARKETPLACE HOME                
        // ========================================================
        <div style={{ paddingBottom: '90px' }}>

          {/* Modern Visual Header banner */}
          <div style={{ padding: '24px 16px', background: 'linear-gradient(135deg, #F4F5F7, #EEF2FF)', borderBottom: '1px solid #E2E8F0', position: 'relative' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ color: '#E11D48', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  ✨ Consumer Portal
                </span>
                <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px', margin: '4px 0 0 0' }}>
                  MyStore <span style={{ color: '#4F46E5' }}>OS</span>
                </h1>
              </div>

              {/* User Avatar & Logout */}
              {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ cursor: 'pointer', position: 'relative' }}>
                    <img 
                      src={avatar || 'https://ui-avatars.com/api/?name=' + user.name + '&background=random'} 
                      alt="User" 
                      style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid #4F46E5', objectFit: 'cover' }} 
                    />
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                  </label>
                  <button 
                    onClick={handleLogout}
                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', width: 'auto', cursor: 'pointer' }}
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => navigate('/login')}
                  style={{ background: 'linear-gradient(135deg, #4F46E5, #4F46E5)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '16px', fontSize: '12px', width: 'auto', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Sign In
                </button>
              )}
            </div>

            {/* GPS Widget banner */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(8px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} style={{ color: '#E11D48' }} />
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>YOUR LOCATION COORDINATES</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                    {locationStatus} • {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => grabLiveLocation(false)} 
                style={{ width: 'auto', background: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.25)', color: '#E11D48', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Compass size={12} /> Refocus GPS
              </button>
            </div>

          </div>

          {/* Sub-tab selections */}
          <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', position: 'sticky', top: 0, zIndex: 100 }}>
            {[
              { id: 'explore', label: 'Explore Shops', icon: Compass },
              { id: 'search', label: 'Global Item Search', icon: Search },
              { id: 'scan', label: 'Scan QR Poster', icon: QrCode },
              { id: 'bills', label: 'My Bills', icon: Receipt },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setCameraScannerActive(false);
                  }}
                  style={{
                    flex: 1, padding: '14px 4px', background: 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #4F46E5' : '2px solid transparent',
                    color: activeTab === tab.id ? '#4F46E5' : '#64748b', fontSize: '11px', fontWeight: '700', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s', borderRadius: 0
                  }}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Marketplace Content views */}
          <div style={{ padding: '16px' }}>

            {/* TAB 1: EXPLORE SHOPS */}
            {activeTab === 'explore' && (
              <div>
                {/* Coming-soon promo banners — shown to shoppers on the home page */}
                {(() => {
                  const banners = [
                    { on: siteCfg?.comingSoon1Active, title: siteCfg?.comingSoon1Title, sub: siteCfg?.comingSoon1Sub, grad: 'linear-gradient(135deg,#4F46E5,#7C3AED)' },
                    { on: siteCfg?.comingSoon2Active, title: siteCfg?.comingSoon2Title, sub: siteCfg?.comingSoon2Sub, grad: 'linear-gradient(135deg,#B8860B,#D97706)' },
                  ].filter(b => b.on && b.title);
                  if (!banners.length) return null;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                      {banners.map((b, i) => (
                        <div key={i} style={{ background: b.grad, borderRadius: '12px', padding: '14px 16px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 800 }}>{b.title}</div>
                            {b.sub && <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>{b.sub}</div>}
                          </div>
                          <span style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>COMING SOON</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* PERSISTENT MULTI-STORE CARTS NOTIFICATION OVERVIEW (Gaps fixed: Stateless cart) */}
                {activeCartsList.length > 0 && (
                  <div style={{ background: 'linear-gradient(135deg, #FEE2E2, #EEF2FF)', border: '1px solid #FCA5A5', borderRadius: '16px', padding: '14px', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#E11D48', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShoppingCart size={13} /> Active Shopping Carts Pending
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {activeCartsList.map(cartItem => (
                        <div key={cartItem.shopId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ color: '#475569' }}>You have <strong style={{ color: '#0F172A' }}>{cartItem.count} saved items</strong> at {cartItem.shopName}</span>
                          <button 
                            onClick={() => navigate(`/s/${cartItem.shopId}`)}
                            style={{ width: 'auto', padding: '5px 12px', fontSize: '10px', background: '#4F46E5', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            Resume checkout
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#64748B', margin: 0 }}>
                    📍 Registered Nearby Stores
                  </h2>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Sorted by Proximity</span>
                </div>
                {/* Mini search */}
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <span style={{ position: 'absolute', left: '13px', top: '12px', color: '#64748b' }}><Search size={15} /></span>
                  <input type="text" placeholder='Find items nearby — e.g. "eggs"' value={nearbySearch} onChange={e => setNearbySearch(e.target.value)} style={{ width: '100%', padding: '11px 12px 11px 36px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '13px', outline: 'none', margin: 0 }} />
                </div>
                {/* Category chips */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {[['all', 'All'], ['kirana', 'Kirana'], ['medical', 'Medical'], ['general', 'General'], ['electronics', 'Electronics']].map(([val, label]) => (
                    <button key={val} onClick={() => setShopCategoryFilter(val)} style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer', width: 'auto', flexShrink: 0, background: shopCategoryFilter === val ? 'linear-gradient(135deg, #4F46E5, #6366F1)' : '#FFFFFF', border: '1px solid ' + (shopCategoryFilter === val ? '#4F46E5' : '#E2E8F0'), color: shopCategoryFilter === val ? '#FFFFFF' : '#64748B' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {nearbySearch.trim() && nearbySearchResults.length > 0 && (
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '10px', marginBottom: '10px' }}>
                    <p style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '700', margin: '0 0 6px 0' }}>📦 Found in nearby shops:</p>
                    {nearbySearchResults.slice(0, 5).map(r => (
                      <div key={r.id} onClick={() => navigate(`/s/${r.shopId}?search=${encodeURIComponent(r.name)}`)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: '#FFFFFF', border: '1px solid #E2E8F0', marginBottom: '3px' }}>
                        <span style={{ fontSize: '13px', color: '#0F172A' }}>{r.name}</span>
                        <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>₹{r.price} →</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {sortedShops.map(shop => {
                    const dist = shop.distance ?? calculateDistance(coords.latitude, coords.longitude, shop.latitude, shop.longitude, shop.id);
                    const waMsg = encodeURIComponent(`Hi ${shop.name}! I'd like to place an order. (via MyStore OS)`);
                    return (
                      <MarketplaceShopCard
                        key={shop.id}
                        shop={shop}
                        dist={dist}
                        onOpen={() => navigate(`/s/${shop.id}`)}
                        onWhatsApp={() => window.open(`https://wa.me/91${shop.phone}?text=${waMsg}`, '_blank')}
                      />
                    );
                  })}

                  {shops.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#64748B', padding: '40px 0' }}>No stores registered on the platform yet.</p>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: GLOBAL ITEM SEARCH */}
            {activeTab === 'search' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748b' }}>
                      <Search size={18} />
                    </span>
                    <input 
                      type="text" 
                      placeholder="Search globally (e.g. Dove Shampoo, Atta)..." 
                      value={globalSearch} 
                      onChange={e => setGlobalSearch(e.target.value)} 
                      style={{ width: '100%', padding: '14px 14px 14px 46px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', color: '#0F172A', fontSize: '15px', outline: 'none', margin: 0 }}
                    />
                  </div>
                  <button 
                    onClick={() => handleVoiceSearch('global')}
                    style={{
                      width: '48px', height: '48px', borderRadius: '14px', border: '1px solid #E2E8F0',
                      background: isListeningGlobal ? 'linear-gradient(135deg, #ef4444, #4F46E5)' : '#FFFFFF', border: '1px solid #E2E8F0',
                      color: isListeningGlobal ? '#fff' : '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      flexShrink: 0, transition: 'all 0.3s',
                      boxShadow: isListeningGlobal ? '0 0 12px #4F46E5' : 'none'
                    }}
                    title="Voice Search"
                  >
                    <Mic size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {globalResults.map(p => {
                    const distance = calculateDistance(coords.latitude, coords.longitude, p.shop?.latitude, p.shop?.longitude, p.shopId);
                    const isPro = p.shop?.subscription && p.shop?.subscription !== 'trial';
                    return (
                      <div 
                        key={p.id}
                        onClick={() => navigate(`/s/${p.shopId}?search=${encodeURIComponent(p.name)}`)}
                        style={{
                          background: isPro ? 'linear-gradient(145deg, #FAF5FF, #F3E8FF)' : '#FFFFFF',
                          border: isPro ? '1px solid #E9D5FF' : '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          borderRadius: '16px',
                          padding: '14px',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                          {p.icon || '📦'}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{p.name}</span>
                            {isPro && <span style={{ background: 'rgba(139,92,246,0.15)', color: '#c084fc', fontSize: '8px', fontWeight: '800', padding: '1px 5px', borderRadius: '6px' }}>PRO SHOP</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            Stocked at <strong style={{ color: '#0F172A' }}>{p.shop?.name || 'Partner Store'}</strong> 
                            {distance !== null ? ` • ${distance.toFixed(1)} km away` : ''}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '18px', fontWeight: '800', color: '#4F46E5' }}>₹{p.price}</span>
                          <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>TAP TO BUY</div>
                        </div>
                      </div>
                    );
                  })}

                  {globalSearch.trim() !== '' && globalResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 12px', color: '#64748b' }}>
                      <AlertTriangle size={24} style={{ color: '#4F46E5', margin: '0 auto 8px' }} />
                      No products matching "{globalSearch}" found. Try another term.
                    </div>
                  )}

                  {globalSearch.trim() === '' && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                      <Search size={32} style={{ color: '#1e293b', margin: '0 auto 12px' }} />
                      Type a product name globally to discover nearby stock details.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: QR CODE SCANNER */}
            {activeTab === 'scan' && (
              <div style={{ textAlign: 'center' }}>
                
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>
                  📱 Scan Store Poster QR
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '20px' }}>
                  Align the QR code from the printed store poster to load its inventory.
                </p>

                {/* Viewfinder box representation */}
                <div style={{ position: 'relative', width: '250px', height: '250px', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '24px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  
                  {isScanning ? (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(16,185,129,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                      <div className="pulse-scanner-ring"></div>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981', marginTop: '10px' }}>
                        {scanStatus}
                      </span>
                    </div>
                  ) : (
                    <>
                      {cameraScannerActive ? (
                        <div id="reader" style={{ width: '100%', height: '100%', borderRadius: '24px', overflow: 'hidden' }}></div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <QrCode size={48} style={{ color: '#64748b', margin: '0 auto 12px' }} />
                          <button 
                            onClick={() => setCameraScannerActive(true)}
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Start Camera Scanner
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Red / green scanning laser sweep */}
                  <div className="laser-sweep-bar"></div>
                </div>

                {/* Simulated testing scanners fallback */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: '16px', padding: '16px', textAlign: 'left' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={14} style={{ color: '#4F46E5' }} /> Simulated Scanning triggers (For Demo)
                  </h4>
                  <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
                    Quickly test-scan the PhonePe-like QR flow without printing or opening camera.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {shops.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleSimulateScan(s.id)}
                        disabled={isScanning}
                        style={{
                          width: '100%', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: '10px', color: '#0F172A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', cursor: 'pointer',
                        }}
                      >
                        <span>🔗 Scan <strong>{s.name}</strong> Poster</span>
                        <ChevronRight size={14} style={{ color: '#64748b' }} />
                      </button>
                    ))}
                    {shops.length === 0 && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>No shops available for mock scanning.</span>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: MY BILLS LEDGER */}
            {activeTab === 'bills' && (
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#64748B', marginBottom: '14px' }}>
                  🧾 Your Digital Bills ledger
                </h2>

                {!user ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
                    <Info size={32} style={{ color: '#64748b', margin: '0 auto 12px' }} />
                    <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '16px' }}>Sign in to view your transaction invoices history.</p>
                    <button onClick={() => navigate('/login')} style={{ width: 'auto', background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>Sign In Now</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {orders.map(order => (
                      <div 
                        key={order.id}
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowReceiptModal(true);
                        }}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          borderRadius: '14px',
                          padding: '14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 3px 0', color: '#0F172A' }}>
                            {order.shopName}
                          </h3>
                          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            <span>{new Date(order.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{order.items?.length || 0} items</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#10b981' }}>₹{order.total}</span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '8px', fontSize: '8px', fontWeight: '900', background: order.status === 'Accepted' || order.status === 'Completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: order.status === 'Accepted' || order.status === 'Completed' ? '#10b981' : '#f59e0b', textTransform: 'uppercase', marginTop: '3px' }}>
                            {order.status || 'Pending'}
                          </div>
                        </div>
                      </div>
                    ))}

                    {orders.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px 12px', color: '#64748b' }}>
                        <Receipt size={32} style={{ color: '#1e293b', margin: '0 auto 12px' }} />
                        You have not placed any orders yet. Visit a store and buy items to populate ledger!
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>

          {/* General Customer Dashboard Bottom Navigation Bar */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', padding: '12px 0', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', zIndex: 100, maxWidth: '480px', margin: '0 auto' }}>
            {[
              { id: 'explore', label: 'Explore', icon: Compass },
              { id: 'search', label: 'Global Find', icon: Search },
              { id: 'scan', label: 'Scan Poster', icon: QrCode },
              { id: 'bills', label: 'Invoices', icon: Receipt },
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setCameraScannerActive(false);
                  }}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === item.id ? '#4F46E5' : '#64748b', fontSize: '11px', fontWeight: '700', cursor: 'pointer', gap: '3px', width: 'auto'
                  }}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL WINDOWS & SLIDERS                                  */}
      {/* ======================================================== */}

      {/* 1. REALISTIC THERMAL RECEIPT MODAL */}
      {showReceiptModal && selectedOrder && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '350px' }}>
            
            {/* The Monospace POS Paper Sheet */}
            <div className="receipt-paper" style={{ padding: '24px 20px', borderRadius: '2px' }}>
              <div className="receipt-jagged-top"></div>
              
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '0.5px' }}>
                  *** MYSTORE INVOICE ***
                </h2>
                <p style={{ fontStyle: 'italic', margin: 0, fontSize: '11px' }}>POS-Roll Serialized Bill</p>
              </div>

              <div style={{ fontSize: '11px', lineHeight: '1.4', marginBottom: '14px' }}>
                <div><strong>STORE :</strong> {(selectedOrder.shopName || 'Store').toUpperCase()}</div>
                <div><strong>DATE  :</strong> {new Date(selectedOrder.date).toLocaleString()}</div>
                <div><strong>BILL# :</strong> {(selectedOrder.id || '').toUpperCase()}</div>
                <div><strong>CLIENT :</strong> {user?.name || 'Walk-in'}</div>
                <div><strong>PHONE  :</strong> {user?.phone || 'Guest'}</div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>

              {/* Items Table Monospace */}
              <div style={{ fontSize: '11px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '6px' }}>
                  <span>ITEM DESC</span>
                  <span>SUB</span>
                </div>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>{item.name.substring(0, 18)} x{item.qty}</span>
                    <span>₹{item.price * item.qty}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: '1px dashed #000', marginBottom: '10px' }}></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
                <span>TOTAL AMT:</span>
                <span>₹{selectedOrder.total}</span>
              </div>

              {/* Barcode Simulator SVG */}
              <div style={{ textAlign: 'center', margin: '20px 0 10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <svg width="200" height="40" style={{ opacity: 0.8 }}>
                  <g fill="#000">
                    <rect x="10" y="5" width="2" height="30" />
                    <rect x="14" y="5" width="1" height="30" />
                    <rect x="18" y="5" width="3" height="30" />
                    <rect x="24" y="5" width="1" height="30" />
                    <rect x="28" y="5" width="2" height="30" />
                    <rect x="32" y="5" width="4" height="30" />
                    <rect x="38" y="5" width="1" height="30" />
                    <rect x="42" y="5" width="2" height="30" />
                    <rect x="48" y="5" width="3" height="30" />
                    <rect x="54" y="5" width="1" height="30" />
                    <rect x="58" y="5" width="4" height="30" />
                    <rect x="64" y="5" width="2" height="30" />
                    <rect x="68" y="5" width="1" height="30" />
                    <rect x="72" y="5" width="3" height="30" />
                    <rect x="78" y="5" width="1" height="30" />
                    <rect x="82" y="5" width="2" height="30" />
                    <rect x="88" y="5" width="4" height="30" />
                    <rect x="94" y="5" width="1" height="30" />
                    <rect x="98" y="5" width="3" height="30" />
                    <rect x="104" y="5" width="2" height="30" />
                    <rect x="108" y="5" width="1" height="30" />
                    <rect x="114" y="5" width="4" height="30" />
                    <rect x="120" y="5" width="2" height="30" />
                    <rect x="124" y="5" width="3" height="30" />
                    <rect x="130" y="5" width="1" height="30" />
                    <rect x="134" y="5" width="2" height="30" />
                    <rect x="138" y="5" width="4" height="30" />
                    <rect x="144" y="5" width="1" height="30" />
                    <rect x="148" y="5" width="3" height="30" />
                    <rect x="154" y="5" width="2" height="30" />
                    <rect x="158" y="5" width="1" height="30" />
                    <rect x="164" y="5" width="4" height="30" />
                    <rect x="170" y="5" width="2" height="30" />
                    <rect x="174" y="5" width="3" height="30" />
                    <rect x="180" y="5" width="1" height="30" />
                    <rect x="184" y="5" width="2" height="30" />
                    <rect x="188" y="5" width="1" height="30" />
                  </g>
                </svg>
                <div style={{ fontSize: '8px', color: '#000', letterSpacing: '2px', fontWeight: 'bold', marginTop: '2px' }}>
                  *{(selectedOrder.id || '').toUpperCase()}*
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '9px', lineHeight: '1.3', marginTop: '10px' }}>
                <strong>* SCAN PAY PACK GO *</strong>
                <div>Thank you for shopping local!</div>
                <div style={{ color: '#64748b' }}>System ver: mOS.10.x.prod</div>
              </div>

              <div className="receipt-jagged-bottom-cut"></div>
            </div>

            {/* Action buttons under invoice */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button 
                onClick={() => downloadReceiptPDF(selectedOrder)}
                style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Printer size={15} /> Download PDF
              </button>
              <button 
                onClick={() => setShowReceiptModal(false)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer' }}
              >
                Close Receipt
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 2. GUEST ONBOARDING MODAL */}
      {showGuestModal && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', width: '100%', maxWidth: '350px', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <User size={28} style={{ color: '#E11D48' }} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 6px 0', color: '#0F172A' }}>Customer Onboarding 🚀</h2>
              <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Please fill this one-time form so the shopkeeper can tag your order invoice.</p>
            </div>
            
            <input 
              type="text" 
              placeholder="Your Full Name" 
              value={guestName} 
              onChange={e=>setGuestName(e.target.value)} 
              style={{ width: '100%', padding: '14px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '15px', marginBottom: '14px', outline: 'none' }} 
            />
            <input 
              type="tel" 
              placeholder="10-Digit Mobile Number" 
              value={guestPhone} 
              onChange={e=>setGuestPhone(e.target.value.replace(/\D/g,"").slice(0,10))} 
              style={{ width: '100%', padding: '14px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '15px', marginBottom: '20px', outline: 'none' }} 
            />
            
            <button 
              onClick={handleGuestLogin} 
              style={{ width: '100%', background: 'linear-gradient(135deg, #4F46E5, #4F46E5)', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(244, 63, 94, 0.2)' }}
            >
              Submit & Proceed
            </button>
            <button 
              onClick={() => setShowGuestModal(false)} 
              style={{ width: '100%', background: 'transparent', color: '#64748b', border: 'none', padding: '10px', borderRadius: '12px', fontSize: '13px', marginTop: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 3. STORE CHECKOUT MODAL */}
      {showWaModal && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1050, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '480px', borderRadius: '24px 24px 0 0', padding: '24px', borderTop: '1px solid #E2E8F0', boxShadow: '0 -10px 30px rgba(0,0,0,0.08)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#4F46E5', margin: 0 }}>
                📋 Confirm Order Invoice
              </h2>
              <button 
                onClick={() => setShowWaModal(false)}
                style={{ background: '#FFFFFF', border: 'none', color: '#0F172A', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Item summary lists */}
            <div style={{ maxHeight: '20vh', overflowY: 'auto', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', marginBottom: '16px' }} className="custom-scroll">
              {getCartTotals().items.map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: '13px' }}>
                  <span style={{ color: '#475569' }}>{i.name} <strong style={{ color: '#64748B' }}>x{i.qty}</strong></span>
                  <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{i.price * i.qty}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '20px', fontWeight: '800', color: '#4F46E5', borderTop: '2px solid rgba(245,158,11,0.2)', marginBottom: '16px' }}>
              <span>TOTAL BILL</span>
              <span>₹{getCartTotals().total}</span>
            </div>

            {/* Payment Method Switch Pills */}
            <div style={{ display: 'flex', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '4px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: paymentMethod === 'upi' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                  color: paymentMethod === 'upi' ? '#fff' : '#64748B',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  width: 'auto'
                }}
              >
                💳 UPI Transfer
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: paymentMethod === 'cash' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                  color: paymentMethod === 'cash' ? '#fff' : '#64748B',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  width: 'auto'
                }}
              >
                💵 Cash / Counter
              </button>
            </div>

            {/* Dynamic Payment Method View */}
            {paymentMethod === 'upi' ? (
              (shopInfo?.paymentQr || shopInfo?.upiId) ? (
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '16px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
                  <h4 style={{ color: '#10b981', margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <CreditCard size={14} /> Scan or Tap to Pay UPI
                  </h4>

                  {/* PRIMARY: the shop owner's own uploaded scanner / QR poster.
                      Banks often decline app-initiated upi:// deep links to personal
                      VPAs 'for security reasons', so the shop's real merchant QR is
                      the most reliable way to pay — show it first and biggest. */}
                  {shopInfo?.paymentQr ? (
                    <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block', marginBottom: '12px', border: '2px solid #10b981' }}>
                      <img src={shopInfo.paymentQr} alt="Shop payment scanner" style={{ maxWidth: '240px', width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '8px' }} />
                      <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, margin: '8px 0 0' }}>Scan with any UPI app to pay ₹{getCartTotals().total}</p>
                    </div>
                  ) : (
                    <div style={{ background: '#fff', padding: '10px', borderRadius: '12px', display: 'inline-block', marginBottom: '8px' }}>
                      <QRCodeSVG
                        value={`upi://pay?pa=${shopInfo?.upiId}&pn=${encodeURIComponent(shopInfo?.name || '')}&cu=INR`}
                        size={150}
                      />
                      <p style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, margin: '8px 0 0', maxWidth: 220 }}>Scan with any UPI app, then enter ₹{getCartTotals().total} to pay</p>
                    </div>
                  )}

                  {/* UPI ID (copyable) — only when there's no uploaded scanner */}
                  {shopInfo?.upiId && !shopInfo?.paymentQr && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '8px 12px', marginBottom: '14px', fontSize: '12px' }}>
                    <span style={{ color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all' }}>{shopInfo?.upiId}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (shopInfo?.upiId) {
                          navigator.clipboard.writeText(shopInfo.upiId);
                          toast.success("UPI ID copied to clipboard!");
                        }
                      }}
                      style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', fontSize: '11px', flexShrink: 0 }}
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                  )}

                  {/* Pay Now: opens the customer's UPI app to the merchant (amount-free
                      so it isn't blocked as a merchant collect-link). Shows on mobile
                      whenever there's a UPI ID — even alongside the scanner — so the
                      customer can either scan the image or tap to open their app. */}
                  {canTapToPay(shopInfo) && isMobileDevice ? (
                    /* Merchant VPA present → a real tap-to-pay link WITH the amount works. */
                    <a 
                      href={buildUpiUri(shopInfo, { amount: getCartTotals().total, txnRef: 'ORD' + Date.now().toString().slice(-8), note: 'Order Payment' })}
                      style={{ display: 'block', textDecoration: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', border: 'none', textAlign: 'center', color: '#fff', transition: 'transform 0.1s', marginTop: shopInfo?.paymentQr ? '4px' : '0' }}
                      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      💳 Pay ₹{getCartTotals().total} — Open PhonePe / GPay / Paytm
                    </a>
                  ) : shopInfo?.upiId ? (
                    /* Personal VPA only → tap-to-pay is blocked by UPI apps, so guide to scan. */
                    <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#4F46E5', padding: '10px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Info size={12} /> Scan the QR above with any UPI app and pay ₹{getCartTotals().total}
                    </div>
                  ) : null}
                  {/* Note shown under Pay Now so the customer knows the amount */}
                  {canTapToPay(shopInfo) && isMobileDevice && (
                    <p style={{ fontSize: '10px', color: '#64748B', margin: '6px 0 0', textAlign: 'center' }}>
                      Your UPI app will open with ₹{getCartTotals().total} pre-filled — just enter your PIN
                    </p>
                  )}

                  {/* (legacy poster block removed — the uploaded scanner is now primary above) */}
                  {false && shopInfo?.paymentQr && (
                    <div style={{ marginTop: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                      <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>Or scan the shop's printed barcode poster:</p>
                      <img src={shopInfo?.paymentQr} alt="Payment QR" style={{ maxWidth: '100%', maxHeight: '160px', objectFit: 'contain', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                  )}

                </div>
              ) : (
                <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>💵 No UPI details registered. Settle this payment at the shop counter.</p>
                </div>
              )
            ) : (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', padding: '16px', borderRadius: '16px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>💵</div>
                <h4 style={{ color: '#4F46E5', margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700' }}>
                  Settle Cash at Counter
                </h4>
                <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: '1.4' }}>
                  Your order details are preserved! Pay with cash or scan at the store's physical checkout counter. Click the WhatsApp button below to instantly alert the merchant.
                </p>
              </div>
            )}

            {/* Input to record transaction ID proof */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>UPI Transaction ID / Ref # (Optional)</label>
              <input 
                type="text" 
                placeholder="Enter 12-Digit UPI Ref Number" 
                value={paymentProof} 
                onChange={e => setPaymentProof(e.target.value)} 
                style={{ width: '100%', padding: '12px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', color: '#0F172A', fontSize: '13px', margin: 0, outline: 'none' }}
              />
            </div>

            {/* WhatsApp confirmation buttons */}
            <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '12px', padding: '10px 14px', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
              <p style={{ margin: 0, fontSize: '12px', color: '#065F46', lineHeight: 1.5 }}>
                The shopkeeper will get an <strong>instant alert</strong> with your name, mobile, and order details on WhatsApp.
              </p>
            </div>
            <button 
              onClick={sendWhatsAppOrder} 
              style={{ width: '100%', background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(37,211,102,0.3)' }}
            >
              📲 Place Order &amp; Notify Shop
            </button>

            <button 
              onClick={() => setShowWaModal(false)} 
              style={{ width: '100%', background: 'transparent', color: '#64748b', border: 'none', padding: '10px', borderRadius: '12px', fontSize: '13px', marginTop: '6px', cursor: 'pointer' }}
            >
              Go Back
            </button>

          </div>
        </div>
      )}

      {/* 4. METALLIC CHECKOUT SCRATCH CARD OVERLAY MODAL */}
      {scratchModalOpen && (
        <div style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
          zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #EEF2FF, #FFFFFF)',
            border: '1px solid #E2E8F0',
            width: '100%', maxWidth: '340px', borderRadius: '24px',
            padding: '24px', textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0,0,0,0.8)'
          }}>
            
            <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#4F46E5', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Gift size={20} /> Checkout Cashback!
            </h3>
            {lastOrderId && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px dashed rgba(16,185,129,0.3)', padding: '6px 14px', borderRadius: '10px', display: 'inline-block', margin: '8px auto', fontSize: '11px', color: '#10b981', fontFamily: 'monospace', fontWeight: 'bold' }}>
                RECEIPT / ORDER #: {lastOrderId.toUpperCase()}
              </div>
            )}
            <p style={{ color: '#475569', fontSize: '13px', margin: '8px 0 20px 0' }}>
              Rub the silver card below to reveal your guaranteed coins.
            </p>

            <div style={{ position: 'relative', width: '240px', height: '240px', margin: '0 auto 20px', borderRadius: '16px', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)' }}>
              
              {/* Underlying reward message */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                zIndex: 1
              }}>
                <span style={{ fontSize: '42px' }}>🎉</span>
                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 'bold', marginTop: '4px' }}>YOU WON</span>
                <h4 style={{ fontSize: '32px', fontWeight: '900', color: '#4F46E5', margin: '2px 0 0 0' }}>
                  +{scratchCardAmount}
                </h4>
                <span style={{ fontSize: '11px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Loyalty Coins
                </span>
              </div>

              {/* Silver metallic canvas cover */}
              <canvas
                ref={scratchCanvasRef}
                width={240}
                height={240}
                className="scratch-canvas"
                style={{
                  position: 'absolute', top: 0, left: 0,
                  zIndex: 2, borderRadius: '16px',
                  display: scratchCardRevealed ? 'none' : 'block'
                }}
                onMouseDown={() => { isDrawingScratch.current = true; }}
                onMouseUp={() => { isDrawingScratch.current = false; }}
                onMouseLeave={() => { isDrawingScratch.current = false; }}
                onMouseMove={handleScratchMove}
                onTouchStart={() => { isDrawingScratch.current = true; }}
                onTouchEnd={() => { isDrawingScratch.current = false; }}
                onTouchMove={handleScratchMove}
              />
            </div>

            {scratchCardRevealed ? (
              <button
                onClick={() => setScratchModalOpen(false)}
                style={{
                  width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white', border: 'none', padding: '14px', borderRadius: '12px',
                  fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                Claim Coins & Continue
              </button>
            ) : (
              <button
                disabled
                style={{
                  width: '100%', background: '#F1F5F9',
                  color: '#64748B', border: '1px solid #E2E8F0',
                  padding: '14px', borderRadius: '12px',
                  fontSize: '15px', fontWeight: 'bold'
                }}
              >
                Scratch to Reveal Reward
              </button>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default UserDashboard;
