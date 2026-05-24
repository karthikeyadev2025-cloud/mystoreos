import { isSupabaseConfigured, supabase } from './supabase';
import { enqueue } from './offlineQueue';

// ============================================================
// SUPABASE API — Real cloud database
// Falls back to localStorage mock if Supabase is not configured
// ============================================================

// Admin password loaded from env var (production) with a dev fallback so local logins still work.
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'Mystore@karthi@2025';

// ---- localStorage Mock (fallback for offline/dev) ----
const mockDB = {
  users: [
    { id: 'admin', phone: '8885490495', pass: ADMIN_PASS, role: 'admin', name: 'Super Admin', status: 'active' },
    { id: 'u_1', phone: '9876543210', pass: '1234', role: 'shop', name: 'Sai Supermarket', status: 'active', subscription: 'trial', upiId: '9876543210@ybl', latitude: 16.3067, longitude: 80.4365, logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&h=120&q=80' },
    { id: 'u_4', phone: '9000000000', pass: '1234', role: 'shop', name: 'Balaji Kirana Store', status: 'active', subscription: 'active', upiId: '9000000000@ybl', latitude: 16.3120, longitude: 80.4450, logo: 'https://images.unsplash.com/photo-1601599561263-8a39304edeec?auto=format&fit=crop&w=120&h=120&q=80' },
    { id: 'u_2', phone: '9999999999', pass: '1234', role: 'customer', name: 'Raju', status: 'active' },
    { id: 'u_3', phone: '8888888888', pass: '1234', role: 'distributor', name: 'Wholesale FMCG Supply', status: 'active' },
    { id: 'u_staff1', phone: '7777777777', pass: '1234', role: 'staff', name: 'Ravi (Helper)', status: 'active', staff_of: 'u_1' },
    { id: 'u_ca1', phone: '1111111111', pass: '1234', role: 'ca', name: 'Srinivas & Co (CA)', status: 'active' }
  ],
  products: [
    { id: 'p_1', shopId: 'u_1', name: 'Parle-G 10Rs', price: 10, barcode: '8901719102029', stock: 45, batchNumber: 'B-PAR01', expiryDate: '2026-12-31', variants: 'Regular, Family Pack', reorderLevel: 10 },
    { id: 'p_2', shopId: 'u_1', name: 'Aashirvaad Atta 1kg', price: 65, barcode: '8901725112028', stock: 8, batchNumber: 'B-ASH22', expiryDate: '2026-06-15', variants: '1kg, 5kg', reorderLevel: 15 },
    { id: 'p_3', shopId: 'u_4', name: 'Parle-G 10Rs', price: 10, barcode: '8901719102029', stock: 100, batchNumber: 'B-PAR01', expiryDate: '2027-01-01', variants: 'Regular', reorderLevel: 10 },
    { id: 'p_4', shopId: 'u_4', name: 'Dove Cream Shampoo 180ml', price: 165, barcode: '8901030752834', stock: 30, batchNumber: 'B-DOV99', expiryDate: '2026-05-10', variants: '180ml, 360ml', reorderLevel: 10 }
  ],
  orders: [],
  credits: [],
  settings: { razorpayKey: '' },
  distributorProducts: [
    { id: 'dp_1', distributorId: 'u_3', name: 'Parle-G Carton (100 packets)', price: 850, stock: 50, category: 'biscuits' },
    { id: 'dp_2', distributorId: 'u_3', name: 'Aashirvaad Atta Bulk case (10 x 5kg)', price: 1950, stock: 20, category: 'flour' },
    { id: 'dp_3', distributorId: 'u_3', name: 'Dove Shampoo Case (48 bottles)', price: 6500, stock: 15, category: 'soaps' },
    { id: 'dp_4', distributorId: 'u_3', name: 'Fortune Sunflower Oil Carton (4 x 5L)', price: 2300, stock: 30, category: 'oil' }
  ],
  stockOrders: [],
  announcements: [
    { id: 'ann_1', text: 'Welcome to MyStore OS Enterprise version! Enjoy our premium speech controls and automated logistics integrations.', type: 'info', active: true, date: new Date().toISOString() }
  ]
};

let _memDB = null; // in-memory fallback when localStorage is unavailable (Safari private mode)

try {
  const localDBStr = localStorage.getItem('mystore_db');
  if (!localDBStr) {
    localStorage.setItem('mystore_db', JSON.stringify(mockDB));
  } else {
    try {
      const db = JSON.parse(localDBStr);
      let modified = false;

      if (db && db.products && db.products.length > 0 && !Object.prototype.hasOwnProperty.call(db.products[0], 'batchNumber')) {
        db.products = mockDB.products;
        modified = true;
      }

      if (db && db.users) {
        const hasAdmin = db.users.some(u => u.phone === '8885490495');
        if (!hasAdmin) {
          db.users.push({ id: 'admin', phone: '8885490495', pass: ADMIN_PASS, role: 'admin', name: 'Super Admin', status: 'active' });
          modified = true;
        }
        const hasCA = db.users.some(u => u.role === 'ca');
        if (!hasCA) {
          db.users.push({ id: 'u_ca1', phone: '1111111111', pass: '1234', role: 'ca', name: 'Srinivas & Co (CA)', status: 'active' });
          modified = true;
        }
      }
      if (db && !db.distributorProducts) { db.distributorProducts = mockDB.distributorProducts; modified = true; }
      if (db && !db.stockOrders) { db.stockOrders = []; modified = true; }
      if (db && !db.announcements) { db.announcements = mockDB.announcements; modified = true; }
      if (modified) localStorage.setItem('mystore_db', JSON.stringify(db));
    } catch (e) {
      console.error("Failed to migrate mockDB", e);
    }
  }
} catch (_e) {
  // localStorage unavailable (Safari private mode, etc.) — use in-memory store
  _memDB = JSON.parse(JSON.stringify(mockDB));
}

const getDB = () => {
  if (_memDB) return JSON.parse(JSON.stringify(_memDB));
  try { return JSON.parse(localStorage.getItem('mystore_db')); } catch { return JSON.parse(JSON.stringify(mockDB)); }
};
const saveDB = (db) => {
  if (_memDB) { _memDB = db; return; }
  try { localStorage.setItem('mystore_db', JSON.stringify(db)); } catch { _memDB = db; }
};
const generateId = () => Math.random().toString(36).substr(2, 9);

// ---- Helper: Convert Supabase snake_case row to camelCase ----
const toUser = (row) => row ? ({
  id: row.id, phone: row.phone, pass: row.pass, role: row.role, name: row.name,
  status: row.status, subscription: row.subscription, upiId: row.upi_id,
  logo: row.logo, shopPhotos: row.shop_photos || [], paymentQr: row.payment_qr,
  avatar: row.avatar,
  staff_of: row.staff_of,
  latitude: row.latitude, longitude: row.longitude,
  gstin: row.gstin, stateCode: row.state_code, businessAddress: row.business_address,
  subscriptionTier: row.subscription_tier || 'starter',
  planExpiresAt: row.plan_expires_at || null,
  trialStartedAt: row.trial_started_at || null,
  distributorPlanTier: row.distributor_plan_tier || 'basic_distributor',
  distributorPlanExpiresAt: row.distributor_plan_expires_at || null,
  distributorTrialStartedAt: row.distributor_trial_started_at || null,
  hideFromSearch: row.hide_from_search || false,
  shopCategory: row.shop_category || 'general',
  openingHour: row.opening_hour ?? 8,
  closingHour: row.closing_hour ?? 21,
}) : null;

const toProduct = (row) => row ? ({
  id: row.id, shopId: row.shop_id, name: row.name, price: row.price,
  barcode: row.barcode, stock: row.stock,
  batchNumber: row.batch_number, expiryDate: row.expiry_date,
  variants: row.variants, reorderLevel: row.reorder_level || 10,
  hsnCode: row.hsn_code, gstRate: row.gst_rate || 0,
  costPrice: parseFloat(row.cost_price) || 0,
  image: row.image_url || null,
}) : null;

const toOrder = (row) => row ? ({
  id: row.id, userId: row.user_id, shopId: row.shop_id, items: row.items,
  total: row.total, status: row.status, date: row.created_at,
  customerGstin: row.customer_gstin, customerAddress: row.customer_address, customerStateCode: row.customer_state_code
}) : null;

const toCredit = (row) => row ? ({
  id: row.id, fromId: row.from_id, toShopId: row.to_shop_id, desc: row.description,
  amount: row.amount, paid: row.paid, date: row.created_at
}) : null;

// Client-side trial expiry check (bridges gap between daily edge-function runs)
export const isTrialExpired = (user) => {
  if (!user || user.subscription !== 'trial') return false;
  if (!user.trialStartedAt) return false;
  const daysSinceStart = (Date.now() - new Date(user.trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceStart > 7;
};
// Helper to intercept and format technical database/edge-function errors into friendly user messages
const formatApiError = (err, fallback = 'Operation failed') => {
  if (!err) return new Error(fallback);
  let message = '';
  if (typeof err === 'string') {
    message = err;
  } else if (err instanceof Error) {
    message = err.message || '';
  } else if (typeof err === 'object') {
    message = err.message || err.error || '';
  }
  
  if (message.includes('Edge Function') || message.includes('non-2xx') || message.includes('Failed to fetch') || message.includes('TypeError')) {
    return new Error("Oops! We couldn't connect to our services. Please check your internet connection and try again shortly!");
  }
  return new Error(message || fallback);
};

// ---- WhatsApp deeplink helper (opens wa.me in a new tab) ----
// Domain-richer Cloud-API + SMS path lives in src/lib/notify.js — this helper
// is the simple browser-deeplink variant used by the bill/credit/trial helpers.
const sendWhatsApp = (phone, message) => {
  const cleaned = (phone || '').replace(/\D/g, '').slice(-10);
  if (!cleaned) return;
  const url = `https://wa.me/91${cleaned}?text=${encodeURIComponent(message)}`;
  if (typeof window !== 'undefined') window.open(url, '_blank');
};

// ============================================================
export const api = {

  // ---- WhatsApp templated messages (bill, credit reminder, trial reminder) ----
  async sendBillWhatsApp(order, shop) {
    const items = (order.items || []).map(i => `• ${i.name} x${i.qty} = ₹${i.price * i.qty}`).join('\n');
    const date = new Date(order.createdAt || order.date || Date.now()).toLocaleDateString('en-IN');
    const ref = (order.id || '').slice(0, 8) || 'N/A';
    const gstLine = order.gstAmount ? `GST: ₹${order.gstAmount}\n` : '';
    const msg = `🧾 *Bill from ${shop.name}*\n\nBill No: ${ref}\nDate: ${date}\n\nItems:\n${items}\n\n*Total: ₹${order.total}*\n${gstLine}\nPay via UPI: ${shop.upiId || 'Contact shop'}\n\nThank you! 🙏`;
    sendWhatsApp(order.customerPhone || '', msg);
  },

  async sendCreditReminder(credit, shop) {
    const days = Math.floor((Date.now() - new Date(credit.date).getTime()) / 86400000);
    const msg = `🔔 *Payment Reminder from ${shop.name}*\n\nDear customer,\nYou have an outstanding balance of *₹${credit.amount}*\nDue since: ${days} days ago\n\nPlease pay via UPI:\n${shop.upiId || 'Contact shop'}\n\nFor queries: ${shop.phone}\n\nThank you 🙏`;
    sendWhatsApp(credit.customerPhone || '', msg);
  },

  async sendTrialReminder(shop, daysLeft) {
    const msg = `⏰ *MyStore OS Trial Ending*\n\nHi ${shop.name},\nYour free trial ends in *${daysLeft} day${daysLeft > 1 ? 's' : ''}*.\n\nUpgrade now to keep:\n✅ Unlimited billing\n✅ WhatsApp invoices\n✅ Inventory tracking\n\nUpgrade: mystoreos.in/login\n\nSupport: adexosindia@gmail.com`;
    sendWhatsApp(shop.phone, msg);
  },

  // ---- AUTH ----
  async login(phone, pass) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.functions.invoke('auth-login', {
          body: { phone, password: pass },
        });
        if (!error && data && !data.error && data.profile) {
          if (data?.session) await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
          return data.profile;
        }
      } catch (_e) { /* fall through to direct DB query */ }
      const { data: row } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
      if (!row) throw new Error('Phone number not found. Please register first.');
      if (row.status === 'suspended') throw new Error('Account suspended. Contact adexosindia@gmail.com');
      if (row.status === 'pending') throw new Error('Account pending admin approval');
      if (row.pass_verify !== pass && row.pass !== pass) throw new Error('Wrong password. Try again or use Forgot Password.');
      return toUser(row);
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not found. Please register first.");
    if (user.status === 'pending') throw new Error("Account pending admin approval. You'll be notified on WhatsApp once approved.");
    if (user.status === 'suspended') throw new Error("Your account has been suspended. Contact support: adexosindia@gmail.com");
    if (user.pass !== pass) throw new Error("Wrong password. Try again or use Forgot Password.");
    return user;
  },

  async loginByPhone(phone) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
      if (error || !data) throw new Error("Phone number not registered. Please register first.");
      if (data.status === 'suspended') throw new Error("Account suspended. Contact support at +91-8885490495");
      return toUser(data);
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not registered. Please register first.");
    if (user.status === 'suspended') throw new Error("Account suspended. Contact support at +91-8885490495");
    return user;
  },

  async resetPassword(phone, newPass) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('users').update({ pass: newPass, pass_verify: newPass }).eq('phone', phone);
      if (error) throw new Error(error.message);
      return true;
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not found. Please register first.");
    user.pass = newPass;
    saveDB(db);
    return true;
  },

  async adminResetPassword(userId, newPass) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('users').update({ pass: newPass, pass_verify: newPass }).eq('id', userId);
      if (error) throw new Error(error.message || 'Admin reset failed');
      return;
    }
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if (user) { user.pass = newPass; saveDB(db); }
  },

  async register(name, phone, pass, role) {
    if (isSupabaseConfigured) {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ name, phone, password: pass, role }),
          }
        );
        if (res.ok) {
          const efData = await res.json();
          if (efData?.error) throw new Error(efData.error);
          if (efData?.session) {
            await supabase.auth.setSession({
              access_token: efData.session.access_token,
              refresh_token: efData.session.refresh_token,
            });
          }
          const profile = efData.profile || efData.user;
          if (profile?.id) {
            const isNonCustomer = role !== 'customer';
            const correctStatus = isNonCustomer ? 'pending' : 'active';
            const correctSubscription = role === 'shop' ? 'trial' : role === 'distributor' ? 'dist_trial' : 'active';
            await supabase.from('users').update({
              role, status: correctStatus, subscription: correctSubscription,
            }).eq('id', profile.id);
            profile.role = role;
            profile.status = correctStatus;
            profile.subscription = correctSubscription;
          }
          if (profile) return profile;
        }
      } catch (efErr) {
        console.warn('Edge Function register failed, using direct insert:', efErr.message);
      }
      // Direct Supabase fallback — no bcrypt, stores plain text in pass + pass_verify
      const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
      if (existing) throw new Error('Phone already registered. Please login.');
      const requiresApproval = role === 'shop' || role === 'distributor';
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const newUser = {
        phone, pass, pass_verify: pass, role, name,
        status: requiresApproval ? 'pending' : 'active',
        subscription: role === 'shop' ? 'trial' : role === 'distributor' ? 'dist_trial' : 'active',
        subscription_tier: role === 'shop' ? 'starter' : role === 'distributor' ? 'dist_basic' : null,
        trial_started_at: requiresApproval ? new Date().toISOString() : null,
        plan_expires_at: requiresApproval ? trialEnd : null,
      };
      const { data, error } = await supabase.from('users').insert(newUser).select().maybeSingle();
      if (error) throw new Error('Registration failed: ' + error.message);
      return toUser(data || newUser);
    }
    const db = getDB();
    if (db.users.find(u => u.phone === phone)) throw new Error("Phone already registered");
    const requiresApproval = (role === 'shop' || role === 'distributor');
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const newUser = {
      id: 'u_' + generateId(), phone, pass, role, name,
      status: requiresApproval ? 'pending' : 'active',
      subscription: role === 'shop' ? 'trial' : role === 'distributor' ? 'dist_trial' : 'active',
      subscriptionTier: role === 'shop' ? 'starter' : role === 'distributor' ? 'dist_basic' : null,
      trialStartedAt: requiresApproval ? new Date().toISOString() : null,
      planExpiresAt: requiresApproval ? trialEnd : null,
    };
    db.users.push(newUser);
    saveDB(db);
    return newUser;
  },

  // ---- ADMIN ----
  async approveUser(userId) {
    if (isSupabaseConfigured) {
      await supabase.from('users').update({ status: 'active' }).eq('id', userId);
      return;
    }
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.status = 'active';
      saveDB(db);
      if (user.phone && typeof window !== 'undefined') {
        const msg = encodeURIComponent(`Welcome to MyStore OS! 🎉\nYour account has been approved.\nLogin now: mystoreos.in/login\nPhone: ${user.phone}\n\nYour 7-day PRO trial starts now!`);
        window.open(`https://wa.me/91${user.phone}?text=${msg}`, '_blank');
      }
    }
  },

  async deleteUser(userId) {
    if (isSupabaseConfigured) {
      await supabase.from('users').delete().eq('id', userId);
      return;
    }
    const db = getDB();
    db.users = db.users.filter(u => u.id !== userId);
    saveDB(db);
  },

  async getPendingApprovals() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*').eq('status', 'pending');
      return (data || []).map(toUser);
    }
    const db = getDB();
    return db.users.filter(u => u.status === 'pending');
  },

  async getUserById(userId) {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      return data ? toUser(data) : null;
    }
    const db = getDB();
    return db.users.find(u => u.id === userId) || null;
  },

  async getAdminStats() {
    const DIST_PRICES = { basic_distributor: 999, pro_distributor: 2499, enterprise_distributor: 4999 };
    if (isSupabaseConfigured) {
      const { data: users } = await supabase.from('users').select('role, subscription, distributor_plan_tier');
      const { data: orders } = await supabase.from('orders').select('total');
      const { data: credits } = await supabase.from('credits').select('amount, paid');
      const allUsers = users || [];
      const shops = allUsers.filter(u => u.role === 'shop');
      const paidShops = shops.filter(s => s.subscription === 'active').length;
      const shopMRR = paidShops * 999;
      const distributors = allUsers.filter(u => u.role === 'distributor');
      const distMRR = distributors.reduce((sum, d) => sum + (DIST_PRICES[d.distributor_plan_tier] || 0), 0);
      const activeCredit = (credits || []).filter(c => !c.paid).reduce((a, b) => a + Number(b.amount), 0);
      return {
        totalUsers: allUsers.filter(u => u.role === 'customer').length,
        totalShops: shops.length,
        totalDistributors: distributors.length,
        totalOrders: (orders || []).length,
        activeCredit,
        paidShops,
        shopMRR,
        distMRR,
        revenue: `₹${shopMRR + distMRR}`
      };
    }
    const db = getDB();
    const shops = db.users.filter(u => u.role === 'shop');
    const paidShops = shops.filter(s => s.subscription === 'active').length;
    const shopMRR = paidShops * 999;
    const distributors = db.users.filter(u => u.role === 'distributor');
    const distMRR = distributors.reduce((sum, d) => sum + (DIST_PRICES[d.distributorPlanTier] || 0), 0);
    const activeCredit = db.credits.filter(c => !c.paid).reduce((a, b) => a + b.amount, 0);
    return {
      totalUsers: db.users.filter(u => u.role === 'customer').length,
      totalShops: shops.length,
      totalDistributors: distributors.length,
      totalOrders: db.orders.length,
      activeCredit,
      paidShops,
      shopMRR,
      distMRR,
      revenue: `₹${shopMRR + distMRR}`
    };
  },

  async getAllUsersByRole(role) {
    if (isSupabaseConfigured) {
      let query = supabase.from('users').select('*');
      if (role) query = query.eq('role', role);
      const { data } = await query;
      return (data || []).map(toUser);
    }
    const db = getDB();
    if (!role) return db.users;
    return db.users.filter(u => u.role === role);
  },

  // ---- PRODUCTS ----
  async getShopProducts(shopId) {
    if (!shopId || typeof shopId !== 'string') return [];
    if (isSupabaseConfigured) {
      let resolvedId = shopId;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shopId);
      if (!isUUID) {
        try {
          const shop = await api.getShopById(shopId);
          if (shop && shop.id) {
            resolvedId = shop.id;
          }
        } catch (e) {
          console.error("Failed resolving shopId for products lookup", e);
        }
      }

      const isResolvedUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedId);
      if (isResolvedUUID) {
        try {
          const { data } = await supabase.from('products').select('*').eq('shop_id', resolvedId);
          if (data && data.length > 0) {
            return data.map(toProduct);
          }
        } catch (err) {
          console.error("Supabase getShopProducts query failed:", err);
        }
      }
      
      // Fallback: check if this is a mockDB shop id (like 'u_1')
      const db = getDB();
      const mockProds = db.products.filter(p => p.shopId === resolvedId || p.shopId === shopId);
      if (mockProds && mockProds.length > 0) return mockProds;
      
      return [];
    }
    const db = getDB();
    return db.products.filter(p => p.shopId === shopId);
  },

  async addProduct(shopId, name, price, barcode, stock = 100, batchNumber = '', expiryDate = '', variants = '', reorderLevel = 10, extraData = {}) {
    if (isSupabaseConfigured) {
      if (!navigator.onLine) {
        const tempId = crypto.randomUUID();
        const row = { id: tempId, shop_id: shopId, name, price: parseFloat(price), barcode, stock: parseInt(stock) || 0, batch_number: batchNumber || null, expiry_date: expiryDate || null, variants: variants || null, reorder_level: parseInt(reorderLevel) || 10, hsn_code: extraData?.hsnCode || null, gst_rate: parseInt(extraData?.gstRate) || 0, cost_price: parseFloat(extraData?.costPrice) || 0 };
        await enqueue({ table: 'products', action: 'insert', data: row });
        const db = getDB(); db.products = db.products || [];
        db.products.push({ id: tempId, shopId, name, price: parseFloat(price), barcode, stock: parseInt(stock) || 0, batchNumber: batchNumber || '', expiryDate: expiryDate || '', variants: variants || '', reorderLevel: parseInt(reorderLevel) || 10, hsnCode: extraData?.hsnCode || '', gstRate: parseInt(extraData?.gstRate) || 0, costPrice: parseFloat(extraData?.costPrice) || 0 });
        saveDB(db); return toProduct(row);
      }
      const { data: prodRow, error } = await supabase.from('products').insert({
        shop_id: shopId,
        name,
        price: parseFloat(price),
        barcode,
        stock: parseInt(stock) || 0,
        batch_number: batchNumber || null,
        expiry_date: expiryDate || null,
        variants: variants || null,
        reorder_level: parseInt(reorderLevel) || 10,
        hsn_code: extraData.hsnCode || null,
        gst_rate: parseInt(extraData.gstRate) || 0,
        cost_price: parseFloat(extraData.costPrice) || 0,
      }).select().maybeSingle();
      if (error) throw new Error(error.message);
      return toProduct(prodRow);
    }
    const db = getDB();
    const newProd = { 
      id: 'p_' + generateId(), 
      shopId, 
      name, 
      price: parseFloat(price), 
      barcode, 
      stock: parseInt(stock) || 0,
      batchNumber: batchNumber || '',
      expiryDate: expiryDate || '',
      variants: variants || '',
      reorderLevel: parseInt(reorderLevel) || 10,
      hsnCode: extraData?.hsnCode || '',
      gstRate: parseInt(extraData?.gstRate) || 0,
      costPrice: parseFloat(extraData?.costPrice) || 0,
      image: extraData?.image || null,
    };
    db.products.push(newProd);
    saveDB(db);
    return newProd;
  },

  async editProduct(prodId, data) {
    if (isSupabaseConfigured) {
      if (!navigator.onLine) {
        const updateObj = {};
        if (data.name !== undefined) updateObj.name = data.name;
        if (data.price !== undefined) updateObj.price = parseFloat(data.price);
        if (data.barcode !== undefined) updateObj.barcode = data.barcode;
        if (data.stock !== undefined) updateObj.stock = parseInt(data.stock);
        if (data.batchNumber !== undefined) updateObj.batch_number = data.batchNumber || null;
        if (data.expiryDate !== undefined) updateObj.expiry_date = data.expiryDate || null;
        if (data.variants !== undefined) updateObj.variants = data.variants || null;
        if (data.reorderLevel !== undefined) updateObj.reorder_level = parseInt(data.reorderLevel);
        if (data.hsnCode !== undefined) updateObj.hsn_code = data.hsnCode || null;
        if (data.gstRate !== undefined) updateObj.gst_rate = parseInt(data.gstRate) || 0;
        if (data.costPrice !== undefined) updateObj.cost_price = parseFloat(data.costPrice) || 0;
        await enqueue({ table: 'products', action: 'update', data: updateObj, match: { id: prodId } });
        const db = getDB(); const prod = db.products.find(p => p.id === prodId);
        if (prod) { Object.assign(prod, data); saveDB(db); } return prod;
      }
      const updateObj = {};
      if (data.name !== undefined) updateObj.name = data.name;
      if (data.price !== undefined) updateObj.price = parseFloat(data.price);
      if (data.barcode !== undefined) updateObj.barcode = data.barcode;
      if (data.stock !== undefined) updateObj.stock = parseInt(data.stock);
      if (data.batchNumber !== undefined) updateObj.batch_number = data.batchNumber || null;
      if (data.expiryDate !== undefined) updateObj.expiry_date = data.expiryDate || null;
      if (data.variants !== undefined) updateObj.variants = data.variants || null;
      if (data.reorderLevel !== undefined) updateObj.reorder_level = parseInt(data.reorderLevel);
      if (data.hsnCode !== undefined) updateObj.hsn_code = data.hsnCode || null;
      if (data.gstRate !== undefined) updateObj.gst_rate = parseInt(data.gstRate) || 0;
      if (data.costPrice !== undefined) updateObj.cost_price = parseFloat(data.costPrice) || 0;

      const { data: updated, error } = await supabase.from('products').update(updateObj).eq('id', prodId).select().maybeSingle();
      if (error) throw new Error(error.message);
      return toProduct(updated);
    }
    const db = getDB();
    const prod = db.products.find(p => p.id === prodId);
    if (prod) {
      if (data.name !== undefined) prod.name = data.name;
      if (data.price !== undefined) prod.price = parseFloat(data.price);
      if (data.barcode !== undefined) prod.barcode = data.barcode;
      if (data.stock !== undefined) prod.stock = parseInt(data.stock);
      if (data.batchNumber !== undefined) prod.batchNumber = data.batchNumber || '';
      if (data.expiryDate !== undefined) prod.expiryDate = data.expiryDate || '';
      if (data.variants !== undefined) prod.variants = data.variants || '';
      if (data.reorderLevel !== undefined) prod.reorderLevel = parseInt(data.reorderLevel);
      if (data.hsnCode !== undefined) prod.hsnCode = data.hsnCode || '';
      if (data.gstRate !== undefined) prod.gstRate = parseInt(data.gstRate) || 0;
      if (data.image !== undefined) prod.image = data.image;
      saveDB(db);
    }
    return prod;
  },

  async deleteProduct(prodId) {
    if (isSupabaseConfigured) {
      if (!navigator.onLine) {
        await enqueue({ table: 'products', action: 'delete', data: {}, match: { id: prodId } });
        const db = getDB(); db.products = db.products.filter(p => p.id !== prodId); saveDB(db); return true;
      }
      const { error } = await supabase.from('products').delete().eq('id', prodId);
      if (error) throw new Error(error.message);
      return true;
    }
    const db = getDB();
    db.products = db.products.filter(p => p.id !== prodId);
    saveDB(db);
    return true;
  },

  // ---- STAFF ----
  async addStaff(shopId, phone, pass, name) {
    if (isSupabaseConfigured) {
      const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
      if (existing) throw new Error("Phone already exists");
      const { data, error } = await supabase.from('users').insert({ phone, pass, role: 'staff', name, status: 'active', staff_of: shopId }).select().maybeSingle();
      if (error) throw new Error(error.message);
      return toUser(data);
    }
    const db = getDB();
    if (db.users.find(u => u.phone === phone)) throw new Error("Phone already exists");
    const newStaff = { id: 'u_' + generateId(), phone, pass, role: 'staff', name, status: 'active', staff_of: shopId };
    db.users.push(newStaff);
    saveDB(db);
    return newStaff;
  },

  async getShopStaff(shopId) {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*').eq('role', 'staff').eq('staff_of', shopId);
      return (data || []).map(toUser);
    }
    const db = getDB();
    return db.users.filter(u => u.role === 'staff' && u.staff_of === shopId);
  },

  async verifyAdminPin(shopId, pin) {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('pass').eq('id', shopId).maybeSingle();
      if (!data || data.pass !== pin) throw new Error("Invalid Admin PIN");
      return true;
    }
    const db = getDB();
    const admin = db.users.find(u => u.id === shopId);
    if (!admin || admin.pass !== pin) throw new Error("Invalid Admin PIN");
    return true;
  },

  // ---- ORDERS ----
  async getShopOrders(shopId) {
    if (!shopId || typeof shopId !== 'string') return [];
    if (isSupabaseConfigured) {
      let resolvedId = shopId;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shopId);
      if (!isUUID) {
        try {
          const shop = await api.getShopById(shopId);
          if (shop && shop.id) {
            resolvedId = shop.id;
          }
        } catch (e) {
          console.error("Failed resolving shopId for orders lookup", e);
        }
      }

      const isResolvedUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedId);
      if (isResolvedUUID) {
        try {
          const { data: orders } = await supabase.from('orders').select('*').eq('shop_id', resolvedId).order('created_at', { ascending: false });
          const { data: users } = await supabase.from('users').select('id, name');
          const userMap = {};
          (users || []).forEach(u => { userMap[u.id] = u.name; });
          return (orders || []).map(o => ({ ...toOrder(o), userName: userMap[o.user_id] || (o.user_id === 'walk-in-customer' ? 'Walk-in Bill' : 'Unknown') }));
        } catch (err) {
          console.error("Supabase getShopOrders query failed:", err);
        }
      }
      
      // Fallback: check mockDB
      const db = getDB();
      return db.orders.filter(o => o.shopId === resolvedId || o.shopId === shopId).map(o => {
        const user = db.users.find(u => u.id === o.userId);
        return { ...o, userName: user ? user.name : 'Unknown' };
      }).reverse();
    }
    const db = getDB();
    return db.orders.filter(o => o.shopId === shopId).map(o => {
      const user = db.users.find(u => u.id === o.userId);
      return { ...o, userName: user ? user.name : 'Unknown' };
    }).reverse();
  },

  async getUserOrders(userId) {
    if (isSupabaseConfigured) {
      const { data: orders } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      const { data: users } = await supabase.from('users').select('id, name').eq('role', 'shop');
      const shopMap = {};
      (users || []).forEach(u => { shopMap[u.id] = u.name; });
      return (orders || []).map(o => ({ ...toOrder(o), shopName: shopMap[o.shop_id] || 'Unknown Shop' }));
    }
    const db = getDB();
    return db.orders.filter(o => o.userId === userId).map(o => {
      const shop = db.users.find(u => u.id === o.shopId);
      return { ...o, shopName: shop ? shop.name : 'Unknown Shop' };
    }).reverse();
  },

  async placeOrder(userId, shopId, items, total, customerData = {}) {
    if (isSupabaseConfigured) {
      if (!navigator.onLine) {
        const tempId = crypto.randomUUID();
        const row = { id: tempId, user_id: userId, shop_id: shopId, items, total, status: 'Pending', customer_gstin: customerData.gstin || null, customer_address: customerData.address || null, customer_state_code: customerData.stateCode || null };
        await enqueue({ table: 'orders', action: 'insert', data: row });
        const db = getDB(); db.orders = db.orders || [];
        db.orders.push({ id: tempId, userId, shopId, items, total, status: 'Pending', date: new Date().toISOString(), customerGstin: customerData.gstin || '', customerAddress: customerData.address || '', customerStateCode: customerData.stateCode || '' });
        saveDB(db); return toOrder({ ...row, created_at: new Date().toISOString() });
      }
      let resolvedId = shopId;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shopId);
      if (!isUUID) {
        try {
          const shop = await api.getShopById(shopId);
          if (shop && shop.id) {
            resolvedId = shop.id;
          }
        } catch (e) {
          console.error("Failed resolving shopId for order placement", e);
        }
      }

      const { data, error } = await supabase.from('orders').insert({
        user_id: userId,
        shop_id: resolvedId,
        items,
        total,
        customer_gstin: customerData.gstin || null,
        customer_address: customerData.address || null,
        customer_state_code: customerData.stateCode || null
      }).select().maybeSingle();
      if (error) throw new Error(error.message);
      
      // Decrement product inventory stock levels in Supabase
      if (items && Array.isArray(items)) {
        for (const item of items) {
          try {
            const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.id).maybeSingle();
            if (prodData) {
              const currentStock = parseInt(prodData.stock) || 0;
              const newStock = Math.max(0, currentStock - (parseInt(item.qty) || 1));
              await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
            }
          } catch (err) {
            console.error("Failed to update stock in Supabase for item:", item.id, err);
          }
        }
      }
      
      return toOrder(data);
    }
    const db = getDB();
    const order = { 
      id: 'o_' + generateId(), 
      userId, 
      shopId, 
      items, 
      total, 
      status: 'Pending', 
      date: new Date().toISOString(),
      customerGstin: customerData.gstin || '',
      customerAddress: customerData.address || '',
      customerStateCode: customerData.stateCode || ''
    };
    db.orders.push(order);
    
    // Decrement product inventory stock levels in localStorage offline mode
    if (items && Array.isArray(items)) {
      items.forEach(item => {
        const prod = db.products.find(p => p.id === item.id);
        if (prod) {
          const currentStock = parseInt(prod.stock) || 0;
          prod.stock = Math.max(0, currentStock - (parseInt(item.qty) || 1));
        }
      });
    }
    
    saveDB(db);
    return order;
  },

  async acceptOrder(orderId) {
    if (isSupabaseConfigured) {
      if (!navigator.onLine) {
        await enqueue({ table: 'orders', action: 'update', data: { status: 'Accepted' }, match: { id: orderId } });
        const db = getDB(); const o = db.orders.find(x => x.id === orderId); if (o) { o.status = 'Accepted'; saveDB(db); } return;
      }
      await supabase.from('orders').update({ status: 'Accepted' }).eq('id', orderId);
      return;
    }
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (order) order.status = 'Accepted';
    saveDB(db);
  },

  async processReturn(orderId, returnItems, _refundMode) {
    if (isSupabaseConfigured) {
      // In Supabase, we would:
      // 1. Mark order as 'Returned' or partially returned
      // 2. Increment stock for returned items
      // For MVP, we will update the stock and set status to 'Returned'
      await supabase.from('orders').update({ status: 'Returned' }).eq('id', orderId);
      
      for (const item of returnItems) {
        try {
          const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.id).maybeSingle();
          if (prodData) {
            const currentStock = parseInt(prodData.stock) || 0;
            const newStock = currentStock + (parseInt(item.returnQty) || 1);
            await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
          }
        } catch (err) {
          console.error("Failed to restore stock in Supabase", err);
        }
      }
      return true;
    }
    
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (order) order.status = 'Returned';
    
    // Increment inventory stock
    if (returnItems && Array.isArray(returnItems)) {
      returnItems.forEach(item => {
        const prod = db.products.find(p => p.id === item.id);
        if (prod) {
          const currentStock = parseInt(prod.stock) || 0;
          prod.stock = currentStock + (parseInt(item.returnQty) || 1);
        }
      });
    }
    
    saveDB(db);
    return true;
  },

  // ---- CREDITS ----
  async getShopCredits(shopId) {
    if (isSupabaseConfigured) {
      const { data: credits } = await supabase.from('credits').select('*').eq('to_shop_id', shopId);
      const { data: users } = await supabase.from('users').select('id, name').eq('role', 'distributor');
      const distMap = {};
      (users || []).forEach(u => { distMap[u.id] = u.name; });
      return (credits || []).map(c => ({ ...toCredit(c), distName: distMap[c.from_id] || 'Unknown' }));
    }
    const db = getDB();
    return db.credits.filter(c => c.toShopId === shopId).map(c => {
      const dist = db.users.find(u => u.id === c.fromId);
      return { ...c, distName: dist ? dist.name : 'Unknown' };
    });
  },

  async getDistCredits(distId) {
    if (isSupabaseConfigured) {
      const { data: credits } = await supabase.from('credits').select('*').eq('from_id', distId).order('created_at', { ascending: false });
      const { data: users } = await supabase.from('users').select('id, name').eq('role', 'shop');
      const shopMap = {};
      (users || []).forEach(u => { shopMap[u.id] = u.name; });
      return (credits || []).map(c => ({ ...toCredit(c), shopName: shopMap[c.to_shop_id] || 'Unknown Shop' }));
    }
    const db = getDB();
    return db.credits.filter(c => c.fromId === distId).map(c => {
      const shop = db.users.find(u => u.id === c.toShopId);
      return { ...c, shopName: shop ? shop.name : 'Unknown Shop' };
    }).reverse();
  },

  async addCredit(fromId, toShopId, desc, amount) {
    if (isSupabaseConfigured) {
      if (!navigator.onLine) {
        const tempId = crypto.randomUUID();
        const row = { id: tempId, from_id: fromId, to_shop_id: toShopId, description: desc, amount: parseFloat(amount), paid: false };
        await enqueue({ table: 'credits', action: 'insert', data: row });
        const db = getDB(); db.credits = db.credits || [];
        db.credits.push({ id: tempId, fromId, toShopId, desc, amount: parseFloat(amount), paid: false, date: new Date().toISOString() });
        saveDB(db); return;
      }
      await supabase.from('credits').insert({ from_id: fromId, to_shop_id: toShopId, description: desc, amount: parseFloat(amount) });
      return;
    }
    const db = getDB();
    db.credits.push({ id: 'c_' + generateId(), fromId, toShopId, desc, amount: parseFloat(amount), paid: false, date: new Date().toISOString() });
    saveDB(db);
  },

  async markCreditPaid(creditId) {
    if (isSupabaseConfigured) {
      if (!navigator.onLine) {
        await enqueue({ table: 'credits', action: 'update', data: { paid: true }, match: { id: creditId } });
        const db = getDB(); const c = db.credits.find(x => x.id === creditId); if (c) { c.paid = true; saveDB(db); } return;
      }
      await supabase.from('credits').update({ paid: true }).eq('id', creditId);
      return;
    }
    const db = getDB();
    const credit = db.credits.find(c => c.id === creditId);
    if (credit) credit.paid = true;
    saveDB(db);
  },

  // ---- SHOPS ----
  async getShopById(shopId) {
    if (!shopId || typeof shopId !== 'string') return null;
    if (isSupabaseConfigured) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shopId);
      if (isUUID) {
        try {
          const { data } = await supabase.from('users').select('*').eq('id', shopId).eq('role', 'shop').maybeSingle();
          if (data) return toUser(data);
        } catch (err) {
          console.error("Supabase getShopById UUID lookup failed:", err);
        }
      }
      
      // Fallback: try matching by phone or search mockDB
      try {
        const { data } = await supabase.from('users').select('*').eq('phone', shopId).eq('role', 'shop').maybeSingle();
        if (data) return toUser(data);
      } catch (_err) {
        // Silent
      }

      // Check mockDB as a fail-safe
      const db = getDB();
      const cleanId = shopId.startsWith('u_') ? shopId : (shopId.startsWith('u') ? 'u_' + shopId.substring(1) : 'u_' + shopId);
      const mockShop = db.users.find(u => (u.id === shopId || u.id === cleanId || u.phone === shopId) && u.role === 'shop');
      if (mockShop) return mockShop;

      return null;
    }
    const db = getDB();
    // Normalize IDs so u_1, u1, and 1 all work for localStorage mock
    const isUUID = shopId.includes('-');
    if (isUUID) {
      return db.users.find(u => u.id === shopId && u.role === 'shop');
    }
    const cleanId = shopId.startsWith('u_') ? shopId : (shopId.startsWith('u') ? 'u_' + shopId.substring(1) : 'u_' + shopId);
    return db.users.find(u => (u.id === shopId || u.id === cleanId || u.phone === shopId) && u.role === 'shop');
  },

  async getAllShops() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*').eq('role', 'shop');
      return (data || []).map(toUser).filter(u => !u.hideFromSearch);
    }
    const db = getDB();
    return db.users.filter(u => u.role === 'shop' && !u.hideFromSearch);
  },

  // ---- FILE UPLOADS TO SUPABASE STORAGE ----
  async uploadAsset(file, userId, folder = 'logos') {
    if (isSupabaseConfigured) {
      try {
        const fileExt = file.name.split('.').pop();
        const randomString = Math.random().toString(36).substring(2, 10);
        const fileName = `${userId}/${folder}/${randomString}.${fileExt}`;

        const { error } = await supabase.storage
          .from('mystore-assets')
          .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from('mystore-assets')
          .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
      } catch (err) {
        console.error("Supabase upload failed, falling back to Base64:", err);
      }
    }

    // Offline / local / fail-safe fallback: Convert to Base64 string
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  },

  // ---- PROFILE ----
  async updateProfile(userId, data) {
    if (isSupabaseConfigured) {
      const updateObj = {};
      if (data.upiId !== undefined) updateObj.upi_id = data.upiId;
      if (data.logo !== undefined) updateObj.logo = data.logo;
      if (data.shopPhotos !== undefined) updateObj.shop_photos = data.shopPhotos;
      if (data.paymentQr !== undefined) updateObj.payment_qr = data.paymentQr;
      if (data.subscription !== undefined) updateObj.subscription = data.subscription;
      if (data.subscriptionTier !== undefined) updateObj.subscription_tier = data.subscriptionTier;
      if (data.name !== undefined) updateObj.name = data.name;
      if (data.latitude !== undefined) updateObj.latitude = data.latitude;
      if (data.longitude !== undefined) updateObj.longitude = data.longitude;
      if (data.avatar !== undefined) updateObj.avatar = data.avatar;
      if (data.gstin !== undefined) updateObj.gstin = data.gstin;
      if (data.stateCode !== undefined) updateObj.state_code = data.stateCode;
      if (data.businessAddress !== undefined) updateObj.business_address = data.businessAddress;
      if (data.distributorPlanTier !== undefined) updateObj.distributor_plan_tier = data.distributorPlanTier;
      if (data.distributorPlanExpiresAt !== undefined) updateObj.distributor_plan_expires_at = data.distributorPlanExpiresAt;
      if (data.hideFromSearch !== undefined) updateObj.hide_from_search = data.hideFromSearch;
      if (data.shopCategory !== undefined) updateObj.shop_category = data.shopCategory;
      await supabase.from('users').update(updateObj).eq('id', userId);
      const { data: updated } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      return toUser(updated);
    }
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if (user) { Object.assign(user, data); saveDB(db); }
    return user;
  },

  // ---- SETTINGS ----
  async getSettings() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
      return { razorpayKey: data?.razorpay_key || '' };
    }
    const db = getDB();
    return db.settings || { razorpayKey: '' };
  },

  async saveSettings(newSettings) {
    if (isSupabaseConfigured) {
      const updateObj = {};
      if (newSettings.razorpayKey !== undefined) updateObj.razorpay_key = newSettings.razorpayKey;
      await supabase.from('settings').update(updateObj).eq('id', 1);
      return newSettings;
    }
    const db = getDB();
    db.settings = { ...db.settings, ...newSettings };
    saveDB(db);
    return db.settings;
  },

  // ---- CMS (Site Config) ----
  async getSiteConfig(key, defaultData) {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('site_config').select('value').eq('key', key).maybeSingle();
        if (error) return defaultData;
        return data?.value ?? defaultData;
      }
      const db = getDB();
      return db.siteConfig?.[key] ?? defaultData;
    } catch { return defaultData; }
  },

  async saveSiteConfig(key, value) {
    if (isSupabaseConfigured) {
      await supabase.from('site_config').upsert({ key, value, updated_at: new Date().toISOString() });
      return;
    }
    const db = getDB();
    if (!db.siteConfig) db.siteConfig = {};
    db.siteConfig[key] = value;
    saveDB(db);
  },

  async getSubscriptionPlans() {
    const defaultPlans = [
      {
        id: 'starter',
        name: 'Starter Plan',
        price: 499,
        description: 'Perfect for small neighborhood kirana shops looking to go paperless.',
        features: [
          'Standard digital billing & invoicing',
          'Up to 200 inventory products',
          'Basic Day Book profit/loss gauge',
          'Single-device active session',
          'Standard billing templates'
        ],
        capabilities: {
          maxProducts: 200,
          maxDevices: 1,
          whatsappShare: false,
          batchExpiry: false,
          gst: false,
          staffAccounts: false,
          caPortal: false,
          tallyExport: false,
          multiDevice: false,
          customInvoiceFooter: false,
        }
      },
      {
        id: 'pro',
        name: 'Premium PRO Plan',
        price: 999,
        description: 'Complete ERP suite with intelligent stock management and payment tracking.',
        features: [
          'Unlimited invoicing & estimates',
          'WhatsApp invoice receipt sharing',
          'Maker-checker staff helper logs & PIN locks',
          'Batch number & 90-day expiry notifications',
          'UPI payment links & automatic WhatsApp reminders',
          'Low stock auto-reordering alert catalog'
        ],
        capabilities: {
          maxProducts: -1,
          maxDevices: 1,
          whatsappShare: true,
          batchExpiry: true,
          gst: false,
          staffAccounts: true,
          caPortal: false,
          tallyExport: false,
          multiDevice: false,
          customInvoiceFooter: false,
          loyaltyPoints: true,
          flashSales: true,
        }
      },
      {
        id: 'enterprise',
        name: 'Enterprise Ultra Plan',
        price: 2499,
        description: 'Robust multisite compliance system for modern retail chains and corporations.',
        features: [
          'GST compliance billing (Intra/Inter-state CGST/SGST/IGST)',
          'Direct CA Portal & Tally ERP XML exports',
          'Advanced Credits & returns registries',
          'Multi-device real-time cloud sync',
          'Custom store brand invoice footers',
          'Priority 24/7 client account manager support'
        ],
        capabilities: {
          maxProducts: -1,
          maxDevices: 5,
          whatsappShare: true,
          batchExpiry: true,
          gst: true,
          staffAccounts: true,
          caPortal: true,
          tallyExport: true,
          multiDevice: true,
          customInvoiceFooter: true,
          loyaltyPoints: true,
          flashSales: true,
        }
      }
    ];
    return await this.getSiteConfig('subscription_plans', defaultPlans);
  },

  async saveSubscriptionPlans(plans) {
    await this.saveSiteConfig('subscription_plans', plans);
  },

  // Seeds default plan capabilities into site_config if not already present.
  // Call once after first Supabase connection (e.g. from AdminDashboard on mount).
  async seedSubscriptionPlans() {
    if (!isSupabaseConfigured) return;
    const existing = await this.getSiteConfig('subscription_plans', null);
    if (existing) return;
    const plans = await this.getSubscriptionPlans();
    await this.saveSiteConfig('subscription_plans', plans);
  },

  async getDistributorSubscriptionPlans() {
    const defaults = [
      {
        id: 'basic_distributor',
        name: 'Basic Distributor',
        price: 999,
        description: 'For small wholesale suppliers serving 1–10 kirana shops.',
        features: [
          'Up to 10 assigned retail shops',
          'Stock order management',
          'Credit ledger (payables + receivables)',
          'WhatsApp order sharing',
          'Basic sales reports',
        ],
        capabilities: { maxShops: 10, routePlanner: false, bulkOrderCSV: false, tallyExport: false, multiDevice: 1, advancedAnalytics: false },
      },
      {
        id: 'pro_distributor',
        name: 'Pro Distributor',
        price: 2499,
        description: 'Mid-size FMCG distributors serving 11–50 shops.',
        features: [
          'Up to 50 assigned retail shops',
          'Route planner (shops by credit + distance)',
          'Bulk order CSV export',
          'Tally ERP export',
          'Multi-device support (3 devices)',
          'Advanced analytics (top shops, GMV trends)',
          'Automated payment reminders to shops',
        ],
        capabilities: { maxShops: 50, routePlanner: true, bulkOrderCSV: true, tallyExport: true, multiDevice: 3, advancedAnalytics: true },
      },
      {
        id: 'enterprise_distributor',
        name: 'Enterprise Distributor',
        price: 4999,
        description: 'Large distributors managing 50+ shops with multi-branch operations.',
        features: [
          'Unlimited assigned shops',
          'Everything in Pro Distributor',
          'Multi-branch support',
          'API access',
          'Custom branded reports',
          'Priority 24/7 support',
          'Staff accounts for delivery agents',
        ],
        capabilities: { maxShops: -1, routePlanner: true, bulkOrderCSV: true, tallyExport: true, multiDevice: 10, advancedAnalytics: true, multiBranch: true, apiAccess: true, staffAccounts: true },
      },
    ];
    return await this.getSiteConfig('distributor_subscription_plans', defaults);
  },

  async saveDistributorSubscriptionPlans(plans) {
    await this.saveSiteConfig('distributor_subscription_plans', plans);
  },

  async seedDistributorSubscriptionPlans() {
    if (!isSupabaseConfigured) return;
    const existing = await this.getSiteConfig('distributor_subscription_plans', null);
    if (existing) return;
    const plans = await this.getDistributorSubscriptionPlans();
    await this.saveSiteConfig('distributor_subscription_plans', plans);
  },

  // ---- GLOBAL SEARCH ----
  async searchGlobalProducts(query) {
    if (isSupabaseConfigured) {
      const { data: prods } = await supabase.from('products').select('*').ilike('name', `%${query}%`);
      if (!prods || prods.length === 0) return [];
      const shopIds = [...new Set(prods.map(p => p.shop_id))];
      const { data: shops } = await supabase.from('users').select('*').in('id', shopIds);
      const shopMap = {};
      (shops || []).forEach(s => { shopMap[s.id] = toUser(s); });
      return prods.map(p => ({
        ...toProduct(p),
        shop: shopMap[p.shop_id] || { name: 'Unknown Shop' }
      }));
    }
    const db = getDB();
    const matchingProds = db.products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    return matchingProds.map(p => {
      const shop = db.users.find(u => u.id === p.shopId && u.role === 'shop');
      return {
        ...p,
        shop: shop || { name: 'Unknown Shop' }
      };
    });
  },

  // ---- DISTRIBUTOR WHOLESALE CATALOG & ORDERS ----
  async getDistributorProducts(distributorId) {
    if (isSupabaseConfigured) {
      let query = supabase.from('distributor_products').select('*');
      if (distributorId) query = query.eq('distributor_id', distributorId);
      const { data } = await query;
      return (data || []).map(row => ({
        id: row.id, distributorId: row.distributor_id, name: row.name,
        price: row.price, stock: row.stock, category: row.category
      }));
    }
    const db = getDB();
    if (!db.distributorProducts) db.distributorProducts = [];
    if (distributorId) return db.distributorProducts.filter(p => p.distributorId === distributorId);
    return db.distributorProducts;
  },

  async addDistributorProduct(productData) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('distributor_products').insert({
        distributor_id: productData.distributorId,
        name: productData.name,
        price: parseFloat(productData.price) || 0,
        stock: parseInt(productData.stock) || 0,
        category: productData.category || 'general'
      }).select().single();
      if (error) throw new Error(error.message);
      return { id: data.id, distributorId: data.distributor_id, name: data.name, price: data.price, stock: data.stock, category: data.category };
    }
    const db = getDB();
    if (!db.distributorProducts) db.distributorProducts = [];
    const newProd = {
      id: 'dp_' + generateId(),
      distributorId: productData.distributorId || 'u_3',
      name: productData.name,
      price: parseFloat(productData.price) || 0,
      stock: parseInt(productData.stock) || 0,
      category: productData.category || 'general'
    };
    db.distributorProducts.push(newProd);
    saveDB(db);
    return newProd;
  },

  async placeStockOrder(shopId, shopName, items, total, distributorId = null) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('stock_orders').insert({
        shop_id: shopId, shop_name: shopName, items, total, status: 'pending',
        distributor_id: distributorId || null,
      }).select().maybeSingle();
      if (error) throw new Error(error.message);
      return { id: data.id, shopId: data.shop_id, shopName: data.shop_name, items: data.items, total: data.total, status: data.status, date: data.created_at, distributorId: data.distributor_id };
    }
    const db = getDB();
    if (!db.stockOrders) db.stockOrders = [];
    const newOrder = {
      id: 'so_' + generateId(),
      shopId, shopName, items, total,
      status: 'pending',
      date: new Date().toISOString(),
      distributorId: distributorId || null
    };
    db.stockOrders.push(newOrder);
    saveDB(db);
    return newOrder;
  },

  async getDistributorOrders(distributorId) {
    if (isSupabaseConfigured) {
      let query = supabase.from('stock_orders').select('*').order('created_at', { ascending: false });
      if (distributorId) query = query.eq('distributor_id', distributorId);
      const { data } = await query;
      return (data || []).map(row => ({
        id: row.id, shopId: row.shop_id, shopName: row.shop_name,
        items: row.items, total: row.total, status: row.status, date: row.created_at,
        distributorId: row.distributor_id
      }));
    }
    const db = getDB();
    if (!db.stockOrders) db.stockOrders = [];
    if (distributorId) return db.stockOrders.filter(o => o.distributorId === distributorId);
    return db.stockOrders;
  },

  async getShopStockOrders(shopId) {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('stock_orders').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
      return (data || []).map(row => ({
        id: row.id, shopId: row.shop_id, shopName: row.shop_name,
        items: row.items, total: row.total, status: row.status, date: row.created_at
      }));
    }
    const db = getDB();
    if (!db.stockOrders) db.stockOrders = [];
    return db.stockOrders.filter(o => o.shopId === shopId);
  },

  async updateStockOrderStatus(orderId, status, distributorId) {
    if (isSupabaseConfigured) {
      await supabase.from('stock_orders').update({ status }).eq('id', orderId);
      // If accepted, also create a credit entry
      if (status === 'accepted') {
        const { data: order } = await supabase.from('stock_orders').select('*').eq('id', orderId).maybeSingle();
        if (order) {
          await supabase.from('credits').insert({
            from_id: distributorId || order.shop_id,
            to_shop_id: order.shop_id,
            description: `Inventory: ${(order.items || []).map(i => `${i.name} (x${i.qty})`).join(', ')}`,
            amount: parseFloat(order.total)
          });
        }
      }
      return { id: orderId, status };
    }
    const db = getDB();
    if (!db.stockOrders) db.stockOrders = [];
    const order = db.stockOrders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      if (status === 'accepted') {
        if (!db.credits) db.credits = [];
        db.credits.push({
          id: 'cr_' + generateId(),
          fromId: distributorId || 'u_3',
          toShopId: order.shopId,
          shopName: order.shopName,
          desc: `Inventory Supplies: ${order.items.map(i => `${i.name} (x${i.qty})`).join(', ')}`,
          amount: parseFloat(order.total),
          paid: false,
          date: new Date().toISOString()
        });
      }
      saveDB(db);
    }
    return order;
  },

  // ---- LIVE PLATFORM BROADCASTS ANNOUNCEMENTS ----
  async getAnnouncements() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('announcements').select('*').eq('active', true);
      return (data || []).map(row => ({
        id: row.id, text: row.text, type: row.type, active: row.active, date: row.created_at
      }));
    }
    const db = getDB();
    if (!db.announcements) db.announcements = [];
    return db.announcements.filter(a => a.active);
  },

  async saveAnnouncement(announcementData) {
    if (isSupabaseConfigured) {
      // Deactivate all previous
      await supabase.from('announcements').update({ active: false }).eq('active', true);
      const { data, error } = await supabase.from('announcements').insert({
        text: announcementData.text,
        type: announcementData.type || 'info',
        active: true
      }).select().single();
      if (error) throw new Error(error.message);
      return { id: data.id, text: data.text, type: data.type, active: data.active, date: data.created_at };
    }
    const db = getDB();
    if (!db.announcements) db.announcements = [];
    db.announcements.forEach(a => { a.active = false; });
    const newAnn = {
      id: 'ann_' + generateId(),
      text: announcementData.text,
      type: announcementData.type || 'info',
      active: true,
      date: new Date().toISOString()
    };
    db.announcements.push(newAnn);
    saveDB(db);
    return newAnn;
  },

  async clearAnnouncements() {
    if (isSupabaseConfigured) {
      await supabase.from('announcements').update({ active: false }).eq('active', true);
      return;
    }
    const db = getDB();
    db.announcements = [];
    saveDB(db);
  },

  async getGlobalCredits() {
    if (isSupabaseConfigured) {
      const { data: credits } = await supabase.from('credits').select('*').order('created_at', { ascending: false });
      const { data: users } = await supabase.from('users').select('id, name, role');
      const userMap = {};
      (users || []).forEach(u => { userMap[u.id] = u.name; });
      return (credits || []).map(c => ({
        ...toCredit(c),
        fromName: userMap[c.from_id] || 'Unknown Distributor',
        toName: userMap[c.to_shop_id] || 'Unknown Shop'
      }));
    }
    const db = getDB();
    if (!db.credits) db.credits = [];
    return db.credits.map(c => {
      const dist = db.users.find(u => u.id === c.fromId);
      const shop = db.users.find(u => u.id === c.toShopId);
      return {
        ...c,
        fromName: dist ? dist.name : 'Unknown Distributor',
        toName: shop ? shop.name : 'Unknown Shop'
      };
    }).reverse();
  },

  // One-time migration: pushes real (non-demo) localStorage users and their products to Supabase.
  // Safe to call multiple times — checks by phone before inserting.
  // Returns { usersMigrated, productsMigrated, skipped }.
  async migrateLocalToSupabase() {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const db = getDB();
    const DEMO_PHONES = new Set(['8885490495', '9876543210', '9000000000', '9999999999', '8888888888', '7777777777', '1111111111']);
    const DEMO_IDS = new Set(['u_1', 'u_4', 'u_2', 'u_3', 'u_staff1', 'u_ca1', 'admin']);
    const realUsers = db.users.filter(u => !DEMO_IDS.has(u.id) && !DEMO_PHONES.has(u.phone));
    let usersMigrated = 0, productsMigrated = 0, skipped = 0;
    for (const user of realUsers) {
      const { data: exists } = await supabase.from('users').select('id').eq('phone', user.phone).maybeSingle();
      if (exists) { skipped++; continue; }
      const hashedPass = user.pass || 'changeme';
      const { data: newUser, error } = await supabase.from('users').insert({
        phone: user.phone, pass: hashedPass, role: user.role, name: user.name,
        status: user.status || 'active', subscription: user.subscription || 'trial',
        subscription_tier: user.subscriptionTier || 'starter',
        trial_started_at: user.trialStartedAt || new Date().toISOString(),
        upi_id: user.upiId || null, logo: user.logo || null,
        latitude: user.latitude || null, longitude: user.longitude || null,
      }).select('id').single();
      if (error) continue;
      usersMigrated++;
      const userProducts = db.products?.filter(p => p.shopId === user.id) || [];
      for (const prod of userProducts) {
        const { error: pe } = await supabase.from('products').insert({
          shop_id: newUser.id, name: prod.name, price: prod.price,
          barcode: prod.barcode || null, stock: prod.stock ?? 100,
          batch_number: prod.batchNumber || null, expiry_date: prod.expiryDate || null,
          variants: prod.variants || null, reorder_level: prod.reorderLevel || 10,
          hsn_code: prod.hsnCode || null, gst_rate: prod.gstRate || 0,
        });
        if (!pe) productsMigrated++;
      }
    }
    return { usersMigrated, productsMigrated, skipped };
  },

  // ---- ACTIVE SESSIONS (multi-device enforcement) ----
  async _getAuthUid() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  },

  async registerSession(userId, deviceFingerprint) {
    if (!isSupabaseConfigured) return;
    try {
      const authUid = await this._getAuthUid() || userId;
      await supabase.from('active_sessions').insert({
        user_id: authUid,
        session_token: crypto.randomUUID(),
        device_fingerprint: deviceFingerprint,
        last_seen_at: new Date().toISOString(),
      });
    } catch { /* non-critical — ignore RLS failures for legacy accounts */ }
  },

  async getActiveSessions(userId) {
    if (!isSupabaseConfigured) return [];
    try {
      const authUid = await this._getAuthUid() || userId;
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('active_sessions').delete().eq('user_id', authUid).lt('last_seen_at', cutoff);
      const { data } = await supabase.from('active_sessions').select('*').eq('user_id', authUid);
      return (data || []).map(s => ({
        id: s.id,
        deviceFingerprint: s.device_fingerprint,
        lastSeenAt: s.last_seen_at,
        createdAt: s.created_at,
      }));
    } catch { return []; }
  },

  async updateSessionLastSeen(sessionId) {
    if (!isSupabaseConfigured) return;
    try {
      await supabase.from('active_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch { /* non-critical */ }
  },

  async revokeOtherSessions(userId, keepFingerprint) {
    if (!isSupabaseConfigured) return;
    try {
      const authUid = await this._getAuthUid() || userId;
      await supabase.from('active_sessions')
        .delete().eq('user_id', authUid).neq('device_fingerprint', keepFingerprint);
    } catch { /* non-critical */ }
  },

  // ---- RAZORPAY PAYMENT ----
  async createRazorpayOrder(planId, amount) {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const userId = await this._getAuthUid();
    const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
      body: { planId, amount, currency: 'INR', userId },
    });
    if (error) throw formatApiError(error, 'Failed to create order');
    return data; // { orderId, amount, currency }
  },

  async verifyRazorpayPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, userId }) {
    if (!isSupabaseConfigured) return { success: true };
    const { data, error } = await supabase.functions.invoke('razorpay-verify-payment', {
      body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, userId },
    });
    if (error) throw formatApiError(error, 'Failed to verify payment');
    return data;
  },

  async getPaymentHistory(userId) {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('payment_history')
        .select('id, plan_id, amount, currency, status, processed_at, razorpay_payment_id')
        .eq('user_id', userId)
        .order('processed_at', { ascending: false })
        .limit(20);
      return (data || []).map(row => ({
        id: row.id,
        planId: row.plan_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        date: row.processed_at,
        paymentId: row.razorpay_payment_id,
      }));
    }
    return [];
  },

  async getNextInvoiceNumber(userId) {
    const counterKey = `invCounter_${userId}`;
    const prefixKey = `invPrefix_${userId}`;
    const prefix = await this.getSiteConfig(prefixKey, 'INV');
    const current = parseInt(await this.getSiteConfig(counterKey, 0)) || 0;
    const next = current + 1;
    await this.saveSiteConfig(counterKey, next);
    return `${prefix}-${String(next).padStart(4, '0')}`;
  },

  async getLoyaltyPoints(shopId, phone) {
    if (!phone) return 0;
    const key = `loyalty_${shopId}_${phone.replace(/\D/g, '')}`;
    return parseInt(await this.getSiteConfig(key, 0)) || 0;
  },

  async awardLoyaltyPoints(shopId, phone, orderTotal) {
    if (!phone) return 0;
    const key = `loyalty_${shopId}_${phone.replace(/\D/g, '')}`;
    const current = parseInt(await this.getSiteConfig(key, 0)) || 0;
    const earned = Math.floor(orderTotal / 10);
    const next = current + earned;
    if (earned > 0) await this.saveSiteConfig(key, next);
    return { earned, balance: next };
  },

  async redeemLoyaltyPoints(shopId, phone, pointsToRedeem) {
    if (!phone || pointsToRedeem <= 0) return 0;
    const key = `loyalty_${shopId}_${phone.replace(/\D/g, '')}`;
    const current = parseInt(await this.getSiteConfig(key, 0)) || 0;
    const redeemed = Math.min(pointsToRedeem, current);
    const remaining = current - redeemed;
    await this.saveSiteConfig(key, remaining);
    return remaining;
  },

  async getFlashSales(shopId) {
    const raw = await this.getSiteConfig(`flashSales_${shopId}`, {});
    const map = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    const now = Date.now();
    const active = {};
    Object.entries(map).forEach(([id, sale]) => {
      if (new Date(sale.expiresAt).getTime() > now) active[id] = sale;
    });
    return active;
  },

  async setFlashSale(shopId, productId, discountPct, durationHours) {
    const key = `flashSales_${shopId}`;
    const raw = await this.getSiteConfig(key, {});
    const map = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    map[productId] = {
      discount: parseInt(discountPct),
      expiresAt: new Date(Date.now() + durationHours * 3600 * 1000).toISOString(),
    };
    await this.saveSiteConfig(key, JSON.stringify(map));
  },

  async clearFlashSale(shopId, productId) {
    const key = `flashSales_${shopId}`;
    const raw = await this.getSiteConfig(key, {});
    const map = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    delete map[productId];
    await this.saveSiteConfig(key, JSON.stringify(map));
  },

  async getExpenses(shopId, yearMonth) {
    const key = `expenses_${shopId}_${yearMonth}`;
    const raw = await this.getSiteConfig(key, []);
    if (typeof raw === 'string') {
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    }
    return Array.isArray(raw) ? raw : [];
  },

  async addExpense(shopId, entry) {
    const ym = entry.date.slice(0, 7);
    const key = `expenses_${shopId}_${ym}`;
    const list = await this.getExpenses(shopId, ym);
    list.push({ ...entry, id: Date.now().toString() });
    await this.saveSiteConfig(key, JSON.stringify(list));
  },

  async deleteExpense(shopId, expenseId, yearMonth) {
    const key = `expenses_${shopId}_${yearMonth}`;
    const list = await this.getExpenses(shopId, yearMonth);
    await this.saveSiteConfig(key, JSON.stringify(list.filter(e => e.id !== expenseId)));
  },

  async getGlobalOrders() {
    if (isSupabaseConfigured) {
      const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      const { data: users } = await supabase.from('users').select('id, name, role');
      const userMap = {};
      (users || []).forEach(u => { userMap[u.id] = u.name; });
      return (orders || []).map(o => ({
        ...toOrder(o),
        userName: userMap[o.user_id] || (o.user_id === 'walk-in-customer' ? 'Walk-in Bill' : 'Unknown'),
        shopName: userMap[o.shop_id] || 'Unknown Shop'
      }));
    }
    const db = getDB();
    if (!db.orders) db.orders = [];
    return db.orders.map(o => {
      const user = db.users.find(u => u.id === o.userId);
      const shop = db.users.find(u => u.id === o.shopId);
      return {
        ...o,
        userName: user ? user.name : (o.userId === 'walk-in-customer' ? 'Walk-in Bill' : 'Unknown'),
        shopName: shop ? shop.name : 'Unknown Shop'
      };
    }).reverse();
  },

  // ---- ADMIN: USER MANAGEMENT ----
  async getAllUsers() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      return (data || []).map(toUser);
    }
    const db = getDB();
    return [...db.users].reverse();
  },

  async searchUsers(query) {
    const q = (query || '').toLowerCase();
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(50);
      return (data || []).map(toUser);
    }
    const db = getDB();
    return db.users.filter(u => u.name?.toLowerCase().includes(q) || u.phone?.includes(q));
  },

  async updateUserSubscription(userId, tier, expiresAt) {
    const updateObj = { subscription_tier: tier, plan_expires_at: expiresAt || null };
    if (isSupabaseConfigured) {
      await supabase.from('users').update(updateObj).eq('id', userId);
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.subscriptionTier = tier; u.planExpiresAt = expiresAt || null; saveDB(db); }
  },

  async updateDistributorSubscription(userId, tier, expiresAt) {
    const updateObj = { distributor_plan_tier: tier, distributor_plan_expires_at: expiresAt || null };
    if (isSupabaseConfigured) {
      await supabase.from('users').update(updateObj).eq('id', userId);
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.distributorPlanTier = tier; u.distributorPlanExpiresAt = expiresAt || null; saveDB(db); }
  },

  async updateUserRole(userId, role) {
    if (isSupabaseConfigured) {
      await supabase.from('users').update({ role }).eq('id', userId);
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.role = role; saveDB(db); }
  },

  async suspendUser(userId) {
    if (isSupabaseConfigured) {
      await supabase.from('users').update({ status: 'pending' }).eq('id', userId);
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.status = 'pending'; saveDB(db); }
  },

  async unsuspendUser(userId) {
    if (isSupabaseConfigured) {
      await supabase.from('users').update({ status: 'active' }).eq('id', userId);
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.status = 'active'; saveDB(db); }
  },

  async bulkUpdateSubscription(userIds, tier) {
    if (isSupabaseConfigured) {
      await supabase.from('users').update({ subscription_tier: tier }).in('id', userIds);
      return;
    }
    const db = getDB();
    userIds.forEach(id => {
      const u = db.users.find(x => x.id === id);
      if (u) u.subscriptionTier = tier;
    });
    saveDB(db);
  },

  // ---- ADMIN: ANALYTICS ----
  async getRevenueByMonth(months = 6) {
    const PLAN_PRICES = { starter: 499, pro: 999, enterprise: 2499 };
    const DIST_PRICES = { basic_distributor: 999, pro_distributor: 2499, enterprise_distributor: 4999 };
    if (isSupabaseConfigured) {
      const { data: users } = await supabase.from('users').select('role, subscription_tier, distributor_plan_tier, created_at, plan_expires_at');
      const result = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const activeShops = (users || []).filter(u => u.role === 'shop' && u.subscription_tier && u.subscription_tier !== 'trial');
        const shopRev = activeShops.reduce((s, u) => s + (PLAN_PRICES[u.subscription_tier] || 0), 0);
        const activeDists = (users || []).filter(u => u.role === 'distributor');
        const distRev = activeDists.reduce((s, u) => s + (DIST_PRICES[u.distributor_plan_tier] || 0), 0);
        result.push({ month: label, shops: shopRev, distributors: distRev, total: shopRev + distRev });
      }
      return result;
    }
    const db = getDB();
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const shopRev = db.users.filter(u => u.role === 'shop' && u.subscription === 'active').length * 999;
      result.push({ month: label, shops: shopRev, distributors: 0, total: shopRev });
    }
    return result;
  },

  async getUserGrowthByMonth(months = 6) {
    if (isSupabaseConfigured) {
      const { data: users } = await supabase.from('users').select('role, created_at');
      const result = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
        const next = new Date(d); next.setMonth(next.getMonth() + 1);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const inMonth = (users || []).filter(u => {
          const c = new Date(u.created_at);
          return c >= d && c < next;
        });
        result.push({ month: label, shops: inMonth.filter(u => u.role === 'shop').length, customers: inMonth.filter(u => u.role === 'customer').length, distributors: inMonth.filter(u => u.role === 'distributor').length });
      }
      return result;
    }
    const months6 = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      months6.push({ month: d.toLocaleString('default', { month: 'short', year: '2-digit' }), shops: 0, customers: 0, distributors: 0 });
    }
    return months6;
  },

  async getExpiredTrials() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*')
        .eq('role', 'shop').eq('subscription', 'trial').lt('trial_started_at', cutoff);
      return (data || []).map(toUser);
    }
    const db = getDB();
    return db.users.filter(u => u.role === 'shop' && u.subscription === 'trial' && u.trialStartedAt && new Date(u.trialStartedAt) < new Date(cutoff));
  },

  async getTopShopsByRevenue(limit = 10) {
    if (isSupabaseConfigured) {
      const { data: orders } = await supabase.from('orders').select('shop_id, total').eq('status', 'Completed');
      const { data: users } = await supabase.from('users').select('id, name, subscription_tier');
      const rev = {};
      (orders || []).forEach(o => { rev[o.shop_id] = (rev[o.shop_id] || 0) + Number(o.total); });
      return Object.entries(rev)
        .sort((a, b) => b[1] - a[1]).slice(0, limit)
        .map(([id, total]) => {
          const u = (users || []).find(x => x.id === id);
          return { id, name: u?.name || 'Unknown', total, tier: u?.subscription_tier || 'starter' };
        });
    }
    const db = getDB();
    const rev = {};
    (db.orders || []).filter(o => o.status === 'Completed').forEach(o => { rev[o.shopId] = (rev[o.shopId] || 0) + Number(o.total); });
    return Object.entries(rev).sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([id, total]) => ({ id, name: db.users.find(u => u.id === id)?.name || 'Unknown', total }));
  },

  async getTopDistributorsByCredit(limit = 10) {
    if (isSupabaseConfigured) {
      const { data: credits } = await supabase.from('credits').select('from_id, amount');
      const { data: users } = await supabase.from('users').select('id, name');
      const totals = {};
      (credits || []).forEach(c => { totals[c.from_id] = (totals[c.from_id] || 0) + Number(c.amount); });
      return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit)
        .map(([id, total]) => ({ id, name: (users || []).find(u => u.id === id)?.name || 'Unknown', total }));
    }
    const db = getDB();
    const totals = {};
    (db.credits || []).forEach(c => { totals[c.fromId] = (totals[c.fromId] || 0) + Number(c.amount); });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([id, total]) => ({ id, name: db.users.find(u => u.id === id)?.name || 'Unknown', total }));
  },

  async getOrdersByDateRange(startDate, endDate) {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('orders').select('*')
        .gte('created_at', startDate).lte('created_at', endDate).order('created_at', { ascending: false });
      return (data || []).map(toOrder);
    }
    const db = getDB();
    const s = new Date(startDate), e = new Date(endDate);
    return (db.orders || []).filter(o => { const d = new Date(o.date || o.created_at); return d >= s && d <= e; }).reverse();
  },

  // ---- ADMIN: AUDIT LOG ----
  async logAdminAction(action, targetId, oldVal, newVal) {
    const entry = { action, targetId, oldVal, newVal, ts: new Date().toISOString() };
    const key = 'admin_audit_log';
    try {
      if (isSupabaseConfigured) {
        const existing = await this.getSiteConfig(key, []);
        const log = Array.isArray(existing) ? existing : [];
        log.unshift(entry);
        await this.saveSiteConfig(key, log.slice(0, 500));
      } else {
        const db = getDB();
        if (!db.siteConfig) db.siteConfig = {};
        const log = Array.isArray(db.siteConfig[key]) ? db.siteConfig[key] : [];
        log.unshift(entry);
        db.siteConfig[key] = log.slice(0, 500);
        saveDB(db);
      }
    } catch (_e) { /* audit failures are non-fatal */ }
  },

  async getAdminAuditLog() {
    const raw = await this.getSiteConfig('admin_audit_log', []);
    return Array.isArray(raw) ? raw : [];
  },

  // ---- ADMIN: MAINTENANCE & SITE SETTINGS ----
  async getMaintenanceMode() {
    const val = await this.getSiteConfig('maintenanceMode', false);
    return val === true || val === 'true';
  },

  async setMaintenanceMode(enabled) {
    await this.saveSiteConfig('maintenanceMode', enabled);
    window.dispatchEvent(new CustomEvent('site-config-updated', { detail: { maintenanceMode: enabled } }));
  },

  async getSiteTheme() {
    return await this.getSiteConfig('site_theme', {});
  },

  async saveSiteTheme(themeObj) {
    await this.saveSiteConfig('site_theme', themeObj);
    window.dispatchEvent(new CustomEvent('site-config-updated', { detail: themeObj }));
  },

  // ---- ADMIN: CSV EXPORTS ----
  buildCSV(headers, rows) {
    const BOM = '﻿';
    const escape = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
    return BOM + lines.join('\n');
  },

  async exportUsersCSV() {
    const users = await this.getAllUsers();
    const headers = ['ID', 'Name', 'Phone', 'Role', 'Status', 'Subscription', 'Tier', 'Created'];
    const rows = users.map(u => [u.id, u.name, u.phone, u.role, u.status, u.subscription || '', u.subscriptionTier || u.distributorPlanTier || '', u.createdAt || '']);
    return this.buildCSV(headers, rows);
  },

  async exportOrdersCSV(startDate, endDate) {
    const orders = startDate ? await this.getOrdersByDateRange(startDate, endDate) : await this.getGlobalOrders();
    const headers = ['ID', 'Shop', 'Customer', 'Total', 'Status', 'Date'];
    const rows = orders.map(o => [o.id, o.shopName || o.shopId, o.userName || o.userId, o.total, o.status, o.date || o.created_at || '']);
    return this.buildCSV(headers, rows);
  },

  async exportCreditsCSV() {
    const credits = await this.getGlobalCredits();
    const headers = ['ID', 'From', 'To Shop', 'Description', 'Amount', 'Paid', 'Date'];
    const rows = credits.map(c => [c.id, c.fromName || c.fromId, c.toName || c.toShopId, c.desc || '', c.amount, c.paid ? 'Yes' : 'No', c.date || '']);
    return this.buildCSV(headers, rows);
  },
};
