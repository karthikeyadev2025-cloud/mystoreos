import { isSupabaseConfigured, supabase } from './supabase';

// ============================================================
// SUPABASE API — Real cloud database
// Falls back to localStorage mock if Supabase is not configured
// ============================================================

// ---- localStorage Mock (fallback for offline/dev) ----
const mockDB = {
  users: [
    { id: 'admin', phone: '8885490495', pass: 'Mystore@karthi@2025', role: 'admin', name: 'Super Admin', status: 'active' },
    { id: 'u_1', phone: '9876543210', pass: '1234', role: 'shop', name: 'Sai Supermarket', status: 'active', subscription: 'trial', upiId: '9876543210@ybl' },
    { id: 'u_2', phone: '9999999999', pass: '1234', role: 'customer', name: 'Raju', status: 'active' },
    { id: 'u_3', phone: '8888888888', pass: '1234', role: 'distributor', name: 'Guntur FMCG Supply', status: 'active' },
    { id: 'u_staff1', phone: '7777777777', pass: '1234', role: 'staff', name: 'Ravi (Helper)', status: 'active', staff_of: 'u_1' }
  ],
  products: [
    { id: 'p_1', shopId: 'u_1', name: 'Parle-G 10Rs', price: 10, barcode: '8901719102029', stock: 45 },
    { id: 'p_2', shopId: 'u_1', name: 'Aashirvaad Atta 1kg', price: 65, barcode: '8901725112028', stock: 8 }
  ],
  orders: [],
  credits: [],
  settings: { razorpayKey: '' }
};

if (!localStorage.getItem('mystore_db')) {
  localStorage.setItem('mystore_db', JSON.stringify(mockDB));
}
const getDB = () => JSON.parse(localStorage.getItem('mystore_db'));
const saveDB = (db) => localStorage.setItem('mystore_db', JSON.stringify(db));
const generateId = () => Math.random().toString(36).substr(2, 9);

// ---- Helper: Convert Supabase snake_case row to camelCase ----
const toUser = (row) => row ? ({
  id: row.id, phone: row.phone, pass: row.pass, role: row.role, name: row.name,
  status: row.status, subscription: row.subscription, upiId: row.upi_id,
  logo: row.logo, shopPhotos: row.shop_photos || [], paymentQr: row.payment_qr,
  staff_of: row.staff_of
}) : null;

const toProduct = (row) => row ? ({
  id: row.id, shopId: row.shop_id, name: row.name, price: row.price,
  barcode: row.barcode, stock: row.stock
}) : null;

const toOrder = (row) => row ? ({
  id: row.id, userId: row.user_id, shopId: row.shop_id, items: row.items,
  total: row.total, status: row.status, date: row.created_at
}) : null;

const toCredit = (row) => row ? ({
  id: row.id, fromId: row.from_id, toShopId: row.to_shop_id, desc: row.description,
  amount: row.amount, paid: row.paid, date: row.created_at
}) : null;

// ============================================================
export const api = {

  // ---- AUTH ----
  async login(phone, pass) {
    if (isSupabaseConfigured) {
      // Find user by phone first, then verify password in JS
      // This avoids Supabase query issues with special characters in passwords
      const { data, error } = await supabase.from('users').select('*').eq('phone', phone).single();
      if (error || !data) throw new Error("Phone number not found. Please register first.");
      if (data.pass !== pass) throw new Error("Wrong password. Try again or use Forgot Password.");
      if (data.status === 'pending') throw new Error("Account pending admin approval");
      return toUser(data);
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not found. Please register first.");
    if (user.pass !== pass) throw new Error("Wrong password. Try again or use Forgot Password.");
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
      await supabase.from('users').update({ pass: newPass }).eq('id', existing.id);
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
      await supabase.from('users').update({ pass: newPass }).eq('id', userId);
      return;
    }
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if (user) { user.pass = newPass; saveDB(db); }
  },

  async register(name, phone, pass, role) {
    if (isSupabaseConfigured) {
      // Check if phone already exists
      const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).single();
      if (existing) throw new Error("Phone already registered");
      const status = (role === 'shop' || role === 'distributor') ? 'pending' : 'active';
      const subscription = role === 'shop' ? 'trial' : 'active';
      const { data, error } = await supabase.from('users').insert({ phone, pass, role, name, status, subscription }).select().single();
      if (error) throw new Error(error.message);
      return toUser(data);
    }
    const db = getDB();
    if (db.users.find(u => u.phone === phone)) throw new Error("Phone already registered");
    const status = (role === 'shop' || role === 'distributor') ? 'pending' : 'active';
    const subscription = role === 'shop' ? 'trial' : 'active';
    const newUser = { id: 'u_' + generateId(), phone, pass, role, name, status, subscription };
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
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('products').select('*').eq('shop_id', shopId);
      return (data || []).map(toProduct);
    }
    const db = getDB();
    return db.products.filter(p => p.shopId === shopId);
  },

  async addProduct(shopId, name, price, barcode) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('products').insert({ shop_id: shopId, name, price: parseFloat(price), barcode, stock: 100 }).select().single();
      if (error) throw new Error(error.message);
      return toProduct(data);
    }
    const db = getDB();
    const newProd = { id: 'p_' + generateId(), shopId, name, price: parseFloat(price), barcode, stock: 100 };
    db.products.push(newProd);
    saveDB(db);
    return newProd;
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

  // ---- ORDERS ----
  async getShopOrders(shopId) {
    if (isSupabaseConfigured) {
      const { data: orders } = await supabase.from('orders').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
      const { data: users } = await supabase.from('users').select('id, name');
      const userMap = {};
      (users || []).forEach(u => { userMap[u.id] = u.name; });
      return (orders || []).map(o => ({ ...toOrder(o), userName: userMap[o.user_id] || (o.user_id === 'walk-in-customer' ? 'Walk-in Bill' : 'Unknown') }));
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

  async placeOrder(userId, shopId, items, total) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('orders').insert({ user_id: userId, shop_id: shopId, items, total }).select().single();
      if (error) throw new Error(error.message);
      return toOrder(data);
    }
    const db = getDB();
    const order = { id: 'o_' + generateId(), userId, shopId, items, total, status: 'Pending', date: new Date().toISOString() };
    db.orders.push(order);
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
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*').eq('id', shopId).eq('role', 'shop').single();
      return toUser(data);
    }
    const db = getDB();
    return db.users.find(u => u.id === shopId && u.role === 'shop');
  },

  async getAllShops() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('*').eq('role', 'shop');
      return (data || []).map(toUser);
    }
    const db = getDB();
    return db.users.filter(u => u.role === 'shop');
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
  }
};
