import { isSupabaseConfigured, supabase } from './supabase';

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
  credits: []
};

// Initialize mock DB
if (!localStorage.getItem('mystore_db')) {
  localStorage.setItem('mystore_db', JSON.stringify(mockDB));
}

const getDB = () => JSON.parse(localStorage.getItem('mystore_db'));
const saveDB = (db) => localStorage.setItem('mystore_db', JSON.stringify(db));
const generateId = () => Math.random().toString(36).substr(2, 9);

export const api = {
  async login(phone, pass) {
    if (isSupabaseConfigured) {
       // Placeholder for actual supabase auth
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone && u.pass === pass);
    if (!user) throw new Error("Invalid credentials");
    if (user.status === 'pending') throw new Error("Account pending admin approval");
    return user;
  },

  async loginByPhone(phone) {
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not registered. Please register first.");
    if (user.status === 'pending') throw new Error("Account pending admin approval");
    return user;
  },
  
  async register(name, phone, pass, role) {
    const db = getDB();
    if (db.users.find(u => u.phone === phone)) throw new Error("Phone already registered");
    
    // Self-onboarded shops and distributors start as 'pending'
    const status = (role === 'shop' || role === 'distributor') ? 'pending' : 'active';
    const subscription = role === 'shop' ? 'trial' : 'active';
    
    const newUser = { id: 'u_' + generateId(), phone, pass, role, name, status, subscription };
    db.users.push(newUser);
    saveDB(db);
    return newUser;
  },

  async approveUser(userId) {
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if(user) user.status = 'active';
    saveDB(db);
  },

  async getShopProducts(shopId) {
    const db = getDB();
    return db.products.filter(p => p.shopId === shopId);
  },

  async addProduct(shopId, name, price, barcode) {
    const db = getDB();
    const newProd = { id: 'p_' + generateId(), shopId, name, price: parseFloat(price), barcode, stock: 100 };
    db.products.push(newProd);
    saveDB(db);
    return newProd;
  },

  async addStaff(shopId, phone, pass, name) {
    const db = getDB();
    if(db.users.find(u => u.phone === phone)) throw new Error("Phone already exists");
    const newStaff = { id: 'u_' + generateId(), phone, pass, role: 'staff', name, status: 'active', staff_of: shopId };
    db.users.push(newStaff);
    saveDB(db);
    return newStaff;
  },

  async getShopStaff(shopId) {
    const db = getDB();
    return db.users.filter(u => u.role === 'staff' && u.staff_of === shopId);
  },

  async getShopOrders(shopId) {
    const db = getDB();
    const orders = db.orders.filter(o => o.shopId === shopId);
    // Join with user details
    return orders.map(o => {
      const user = db.users.find(u => u.id === o.userId);
      return { ...o, userName: user ? user.name : 'Unknown' };
    }).reverse();
  },
  
  async getUserOrders(userId) {
    const db = getDB();
    const orders = db.orders.filter(o => o.userId === userId);
    return orders.map(o => {
      const shop = db.users.find(u => u.id === o.shopId);
      return { ...o, shopName: shop ? shop.name : 'Unknown Shop' };
    }).reverse();
  },

  async placeOrder(userId, shopId, items, total) {
    const db = getDB();
    const order = {
        id: 'o_' + generateId(),
        userId,
        shopId,
        items,
        total,
        status: 'Pending',
        date: new Date().toISOString()
    };
    db.orders.push(order);
    saveDB(db);
    return order;
  },

  async acceptOrder(orderId) {
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if(order) order.status = 'Accepted';
    saveDB(db);
  },

  async getShopCredits(shopId) {
    const db = getDB();
    const credits = db.credits.filter(c => c.toShopId === shopId);
    return credits.map(c => {
      const dist = db.users.find(u => u.id === c.fromId);
      return { ...c, distName: dist ? dist.name : 'Unknown' };
    });
  },

  async getDistCredits(distId) {
    const db = getDB();
    const credits = db.credits.filter(c => c.fromId === distId);
    return credits.map(c => {
      const shop = db.users.find(u => u.id === c.toShopId);
      return { ...c, shopName: shop ? shop.name : 'Unknown Shop' };
    }).reverse();
  },

  async addCredit(fromId, toShopId, desc, amount) {
    const db = getDB();
    const credit = {
        id: 'c_' + generateId(),
        fromId,
        toShopId,
        desc,
        amount: parseFloat(amount),
        paid: false,
        date: new Date().toISOString()
    };
    db.credits.push(credit);
    saveDB(db);
  },

  async markCreditPaid(creditId) {
    const db = getDB();
    const credit = db.credits.find(c => c.id === creditId);
    if(credit) credit.paid = true;
    saveDB(db);
  },
  
  async getShopById(shopId) {
    const db = getDB();
    return db.users.find(u => u.id === shopId && u.role === 'shop');
  },
  
  async getAllShops() {
    const db = getDB();
    return db.users.filter(u => u.role === 'shop');
  },

  async getAdminStats() {
    const db = getDB();
    const totalUsers = db.users.filter(u => u.role === 'customer').length;
    const shops = db.users.filter(u => u.role === 'shop');
    const totalShops = shops.length;
    const totalDistributors = db.users.filter(u => u.role === 'distributor').length;
    const totalOrders = db.orders.length;
    const activeCredit = db.credits.filter(c => !c.paid).reduce((a, b) => a + b.amount, 0);
    const paidShops = shops.filter(s => s.subscription === 'active').length;

    return {
      totalUsers, totalShops, totalDistributors, totalOrders, activeCredit, paidShops, revenue: `₹${paidShops * 999}`
    };
  },

  async getAllUsersByRole(role) {
    const db = getDB();
    if (!role) return db.users;
    return db.users.filter(u => u.role === role);
  },

  async getPendingApprovals() {
    const db = getDB();
    return db.users.filter(u => u.status === 'pending');
  },

  async updateProfile(userId, data) {
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if(user) {
      Object.assign(user, data);
      saveDB(db);
    }
    return user;
  },

  async deleteUser(userId) {
    const db = getDB();
    db.users = db.users.filter(u => u.id !== userId);
    saveDB(db);
  },

  async getSettings() {
    const db = getDB();
    return db.settings || { razorpayKey: '' };
  },

  async saveSettings(newSettings) {
    const db = getDB();
    db.settings = { ...db.settings, ...newSettings };
    saveDB(db);
    return db.settings;
  }
};
