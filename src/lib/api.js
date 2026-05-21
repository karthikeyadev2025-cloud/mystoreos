import { isSupabaseConfigured, supabase } from './supabase';
import bcrypt from 'bcryptjs';

// ============================================================
// SUPABASE API — Real cloud database
// Falls back to localStorage mock if Supabase is not configured
// ============================================================

// ---- localStorage Mock (fallback for offline/dev) ----
const mockDB = {
  users: [
    { id: 'admin', phone: '8885490495', pass: 'Mystore@karthi@2025', role: 'admin', name: 'Super Admin', status: 'active' },
    { id: 'u_1', phone: '9876543210', pass: '1234', role: 'shop', name: 'Sai Supermarket', status: 'active', subscription: 'trial', upiId: '9876543210@ybl', latitude: 16.3067, longitude: 80.4365, logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&h=120&q=80' },
    { id: 'u_4', phone: '9000000000', pass: '1234', role: 'shop', name: 'Balaji Kirana Store', status: 'active', subscription: 'active', upiId: '9000000000@ybl', latitude: 16.3120, longitude: 80.4450, logo: 'https://images.unsplash.com/photo-1601599561263-8a39304edeec?auto=format&fit=crop&w=120&h=120&q=80' },
    { id: 'u_2', phone: '9999999999', pass: '1234', role: 'customer', name: 'Raju', status: 'active' },
    { id: 'u_3', phone: '8888888888', pass: '1234', role: 'distributor', name: 'Guntur FMCG Supply', status: 'active' },
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

const localDBStr = localStorage.getItem('mystore_db');
if (!localDBStr) {
  localStorage.setItem('mystore_db', JSON.stringify(mockDB));
} else {
  try {
    const db = JSON.parse(localDBStr);
    let modified = false;
    
    // Migrate old mock DB to support advanced inventory fields
    if (db && db.products && db.products.length > 0 && !Object.prototype.hasOwnProperty.call(db.products[0], 'batchNumber')) {
      db.products = mockDB.products;
      modified = true;
    }
    
    if (db && db.users) {
      const hasAdmin = db.users.some(u => u.phone === '8885490495');
      if (!hasAdmin) {
        db.users.push({ id: 'admin', phone: '8885490495', pass: 'Mystore@karthi@2025', role: 'admin', name: 'Super Admin', status: 'active' });
        modified = true;
      }
      const hasCA = db.users.some(u => u.role === 'ca');
      if (!hasCA) {
        db.users.push({ id: 'u_ca1', phone: '1111111111', pass: '1234', role: 'ca', name: 'Srinivas & Co (CA)', status: 'active' });
        modified = true;
      }
    }
    if (db && !db.distributorProducts) {
      db.distributorProducts = mockDB.distributorProducts;
      modified = true;
    }
    if (db && !db.stockOrders) {
      db.stockOrders = [];
      modified = true;
    }
    if (db && !db.announcements) {
      db.announcements = mockDB.announcements;
      modified = true;
    }
    if (modified) {
      localStorage.setItem('mystore_db', JSON.stringify(db));
    }
  } catch (e) {
    console.error("Failed to migrate mockDB", e);
  }
}
const getDB = () => JSON.parse(localStorage.getItem('mystore_db'));
const saveDB = (db) => localStorage.setItem('mystore_db', JSON.stringify(db));
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
}) : null;

const toProduct = (row) => row ? ({
  id: row.id, shopId: row.shop_id, name: row.name, price: row.price,
  barcode: row.barcode, stock: row.stock,
  batchNumber: row.batch_number, expiryDate: row.expiry_date,
  variants: row.variants, reorderLevel: row.reorder_level || 10,
  hsnCode: row.hsn_code, gstRate: row.gst_rate || 0
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

// ============================================================
export const api = {

  // ---- AUTH ----
  async login(phone, pass) {
    if (isSupabaseConfigured) {
      // Find user by phone first, then verify password in JS
      // This avoids Supabase query issues with special characters in passwords
      const { data, error } = await supabase.from('users').select('*').eq('phone', phone).single();
      if (error || !data) throw new Error("Phone number not found. Please register first.");
      const supaPassMatch = data.pass.startsWith('$2b$') ? await bcrypt.compare(pass, data.pass) : data.pass === pass;
      if (!supaPassMatch) throw new Error("Wrong password. Try again or use Forgot Password.");
      if (!data.pass.startsWith('$2b$')) {
        await supabase.from('users').update({ pass: await bcrypt.hash(pass, 10) }).eq('id', data.id);
      }
      if (data.status === 'pending') throw new Error("Account pending admin approval");
      return toUser(data);
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not found. Please register first.");
    const localPassMatch = user.pass.startsWith('$2b$') ? await bcrypt.compare(pass, user.pass) : user.pass === pass;
    if (!localPassMatch) throw new Error("Wrong password. Try again or use Forgot Password.");
    if (!user.pass.startsWith('$2b$')) { user.pass = await bcrypt.hash(pass, 10); saveDB(db); }
    if (user.status === 'pending') throw new Error("Account pending admin approval");
    return user;
  },

  async loginByPhone(phone) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('users').select('*').eq('phone', phone).single();
      if (error || !data) throw new Error("Phone number not registered. Please register first.");
      if (data.status === 'pending') throw new Error("Account pending admin approval");
      return toUser(data);
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not registered. Please register first.");
    if (user.status === 'pending') throw new Error("Account pending admin approval");
    return user;
  },

  async resetPassword(phone, newPass) {
    if (isSupabaseConfigured) {
      const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).single();
      if (!existing) throw new Error("Phone number not found. Please register first.");
      await supabase.from('users').update({ pass: await bcrypt.hash(newPass, 10) }).eq('id', existing.id);
      return true;
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not found. Please register first.");
    user.pass = await bcrypt.hash(newPass, 10);
    saveDB(db);
    return true;
  },

  async adminResetPassword(userId, newPass) {
    if (isSupabaseConfigured) {
      await supabase.from('users').update({ pass: await bcrypt.hash(newPass, 10) }).eq('id', userId);
      return;
    }
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if (user) { user.pass = await bcrypt.hash(newPass, 10); saveDB(db); }
  },

  async register(name, phone, pass, role) {
    if (isSupabaseConfigured) {
      // Check if phone already exists
      const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).single();
      if (existing) throw new Error("Phone already registered");
      const status = 'active'; // Bypass pending review, activate immediately!
      const subscription = role === 'shop' ? 'trial' : 'active';
      const subscription_tier = role === 'shop' ? 'starter' : null;
      const trial_started_at = role === 'shop' ? new Date().toISOString() : null;
      const { data, error } = await supabase.from('users').insert({
        phone, pass: await bcrypt.hash(pass, 10), role, name, status, subscription, subscription_tier, trial_started_at
      }).select().single();
      if (error) throw new Error(error.message);
      return toUser(data);
    }
    const db = getDB();
    if (db.users.find(u => u.phone === phone)) throw new Error("Phone already registered");
    const status = 'active'; // Bypass pending review, activate immediately!
    const subscription = role === 'shop' ? 'trial' : 'active';
    const newUser = { id: 'u_' + generateId(), phone, pass: await bcrypt.hash(pass, 10), role, name, status, subscription };
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
    if (user) user.status = 'active';
    saveDB(db);
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

  async getAdminStats() {
    if (isSupabaseConfigured) {
      const { data: users } = await supabase.from('users').select('role, subscription');
      const { data: orders } = await supabase.from('orders').select('total');
      const { data: credits } = await supabase.from('credits').select('amount, paid');
      const allUsers = users || [];
      const shops = allUsers.filter(u => u.role === 'shop');
      const paidShops = shops.filter(s => s.subscription === 'active').length;
      const activeCredit = (credits || []).filter(c => !c.paid).reduce((a, b) => a + Number(b.amount), 0);
      return {
        totalUsers: allUsers.filter(u => u.role === 'customer').length,
        totalShops: shops.length,
        totalDistributors: allUsers.filter(u => u.role === 'distributor').length,
        totalOrders: (orders || []).length,
        activeCredit,
        paidShops,
        revenue: `₹${paidShops * 999}`
      };
    }
    const db = getDB();
    const shops = db.users.filter(u => u.role === 'shop');
    const paidShops = shops.filter(s => s.subscription === 'active').length;
    const activeCredit = db.credits.filter(c => !c.paid).reduce((a, b) => a + b.amount, 0);
    return {
      totalUsers: db.users.filter(u => u.role === 'customer').length,
      totalShops: shops.length,
      totalDistributors: db.users.filter(u => u.role === 'distributor').length,
      totalOrders: db.orders.length,
      activeCredit,
      paidShops,
      revenue: `₹${paidShops * 999}`
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

  async addProduct(shopId, name, price, barcode, stock = 100, batchNumber = '', expiryDate = '', variants = '', reorderLevel = 10, data = {}) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('products').insert({ 
        shop_id: shopId, 
        name, 
        price: parseFloat(price), 
        barcode, 
        stock: parseInt(stock) || 0,
        batch_number: batchNumber || null,
        expiry_date: expiryDate || null,
        variants: variants || null,
        reorder_level: parseInt(reorderLevel) || 10,
        hsn_code: data.hsnCode || null,
        gst_rate: parseInt(data.gstRate) || 0
      }).select().single();
      if (error) throw new Error(error.message);
      return toProduct(data);
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
      hsnCode: data?.hsnCode || '',
      gstRate: parseInt(data?.gstRate) || 0
    };
    db.products.push(newProd);
    saveDB(db);
    return newProd;
  },

  async editProduct(prodId, data) {
    if (isSupabaseConfigured) {
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
      
      const { data: updated, error } = await supabase.from('products').update(updateObj).eq('id', prodId).select().single();
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
      saveDB(db);
    }
    return prod;
  },

  async deleteProduct(prodId) {
    if (isSupabaseConfigured) {
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
      const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).single();
      if (existing) throw new Error("Phone already exists");
      const { data, error } = await supabase.from('users').insert({ phone, pass, role: 'staff', name, status: 'active', staff_of: shopId }).select().single();
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
      const { data } = await supabase.from('users').select('pass').eq('id', shopId).single();
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
      }).select().single();
      if (error) throw new Error(error.message);
      
      // Decrement product inventory stock levels in Supabase
      if (items && Array.isArray(items)) {
        for (const item of items) {
          try {
            const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.id).single();
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
          const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.id).single();
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
      await supabase.from('credits').insert({ from_id: fromId, to_shop_id: toShopId, description: desc, amount: parseFloat(amount) });
      return;
    }
    const db = getDB();
    db.credits.push({ id: 'c_' + generateId(), fromId, toShopId, desc, amount: parseFloat(amount), paid: false, date: new Date().toISOString() });
    saveDB(db);
  },

  async markCreditPaid(creditId) {
    if (isSupabaseConfigured) {
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
          const { data } = await supabase.from('users').select('*').eq('id', shopId).eq('role', 'shop').single();
          if (data) return toUser(data);
        } catch (err) {
          console.error("Supabase getShopById UUID lookup failed:", err);
        }
      }
      
      // Fallback: try matching by phone or search mockDB
      try {
        const { data } = await supabase.from('users').select('*').eq('phone', shopId).eq('role', 'shop').single();
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
      return (data || []).map(toUser);
    }
    const db = getDB();
    return db.users.filter(u => u.role === 'shop');
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
      if (data.name !== undefined) updateObj.name = data.name;
      if (data.latitude !== undefined) updateObj.latitude = data.latitude;
      if (data.longitude !== undefined) updateObj.longitude = data.longitude;
      if (data.avatar !== undefined) updateObj.avatar = data.avatar;
      if (data.gstin !== undefined) updateObj.gstin = data.gstin;
      if (data.stateCode !== undefined) updateObj.state_code = data.stateCode;
      if (data.businessAddress !== undefined) updateObj.business_address = data.businessAddress;
      await supabase.from('users').update(updateObj).eq('id', userId);
      const { data: updated } = await supabase.from('users').select('*').eq('id', userId).single();
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
      const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
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
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('site_config').select('value').eq('key', key).single();
      return data?.value || defaultData;
    }
    const db = getDB();
    return db.siteConfig?.[key] || defaultData;
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

  async placeStockOrder(shopId, shopName, items, total) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('stock_orders').insert({
        shop_id: shopId, shop_name: shopName, items, total, status: 'pending'
      }).select().single();
      if (error) throw new Error(error.message);
      return { id: data.id, shopId: data.shop_id, shopName: data.shop_name, items: data.items, total: data.total, status: data.status, date: data.created_at };
    }
    const db = getDB();
    if (!db.stockOrders) db.stockOrders = [];
    const newOrder = {
      id: 'so_' + generateId(),
      shopId, shopName, items, total,
      status: 'pending',
      date: new Date().toISOString()
    };
    db.stockOrders.push(newOrder);
    saveDB(db);
    return newOrder;
  },

  async getDistributorOrders() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('stock_orders').select('*').order('created_at', { ascending: false });
      return (data || []).map(row => ({
        id: row.id, shopId: row.shop_id, shopName: row.shop_name,
        items: row.items, total: row.total, status: row.status, date: row.created_at
      }));
    }
    const db = getDB();
    if (!db.stockOrders) db.stockOrders = [];
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
        const { data: order } = await supabase.from('stock_orders').select('*').eq('id', orderId).single();
        if (order) {
          await supabase.from('credits').insert({
            from_id: distributorId || order.shop_id,
            to_shop_id: order.shop_id,
            description: `Inventory: ${order.items.map(i => `${i.name} (x${i.qty})`).join(', ')}`,
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
  }
};
