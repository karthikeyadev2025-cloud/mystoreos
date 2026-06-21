import { isSupabaseConfigured, supabase } from './supabase';
import { enqueue } from './offlineQueue';
import { validateImageFile } from './fileValidation';

// ============================================================
// SUPABASE API — Real cloud database
// Falls back to localStorage mock if Supabase is not configured
// ============================================================

// Admin password loaded from env var (production) with a dev fallback so local logins still work.
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'Mystore@karthi@2025';

// HSN/SAC codes are strictly 4, 6, or 8 numeric digits per Indian GST law.
// The 4 Add/Edit Product forms and the bulk CSV importer all wrote this
// field as raw free text with zero validation — a typo, stray letter, or
// pasted garbage from a CSV would sit on a product forever, print on
// every bill, and (if the shop owner manually copies it into the GST
// portal, the realistic workflow for a small shop since this app doesn't
// auto-file) get rejected or mismatched at actual filing time.
// Returns a cleaned code on success, or null if the input doesn't look
// like a real HSN/SAC code — callers should silently drop invalid input
// rather than hard-fail a product save over it (HSN is optional).
function sanitizeHsnCode(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if ([4, 6, 8].includes(digits.length)) return digits;
  return null;
}

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
  merchantUpiId: row.merchant_upi_id || null, merchantCode: row.merchant_code || null,
  logo: row.logo, shopPhotos: row.shop_photos || [], paymentQr: row.payment_qr,
  avatar: row.avatar,
  staff_of: row.staff_of,
  latitude: row.latitude, longitude: row.longitude,
  gstin: row.gstin, stateCode: row.state_code, businessAddress: row.business_address,
  subscriptionTier: row.subscription_tier || 'starter',
  planExpiresAt: row.plan_expires_at || null,
  trialStartedAt: row.trial_started_at || null,
  createdAt: row.created_at || null,
  distributorPlanTier: row.distributor_plan_tier || 'basic_distributor',
  distributorPlanExpiresAt: row.distributor_plan_expires_at || null,
  distributorTrialStartedAt: row.distributor_trial_started_at || null,
  hideFromSearch: row.hide_from_search || false,
  shopCategory: row.shop_category || 'general',
  openingHour: row.opening_hour ?? 8,
  closingHour: row.closing_hour ?? 21,
  weeklyHolidays: row.weekly_holidays || [],
  shopBanner: row.shop_banner || null,
  caId: row.ca_id || null,
  publicCode: row.public_code || null,
  // Multi-branch fields. parentShopId is null for the owner's main shop,
  // and = main shop's id for every branch. branchDeletedAt is set when a
  // branch is soft-removed (historical orders still point to it, so we
  // can't hard-delete).
  parentShopId: row.parent_shop_id || null,
  branchDeletedAt: row.branch_deleted_at || null,
  // Default true so existing rows (where the column may not exist yet, e.g.
  // migration not run) don't get bounced back into onboarding. Fresh
  // shop/distributor registrations explicitly set this to false.
  onboardingCompleted: row.onboarding_completed !== false,
}) : null;

const toProduct = (row) => row ? ({
  id: row.id, shopId: row.shop_id, name: row.name, price: row.price,
  barcode: row.barcode, stock: row.stock,
  batchNumber: row.batch_number, expiryDate: row.expiry_date,
  variants: row.variants, reorderLevel: row.reorder_level || 10,
  variantPrices: row.variant_prices || null,
  hsnCode: row.hsn_code, gstRate: row.gst_rate || 0,
  costPrice: parseFloat(row.cost_price) || 0,
  images: (() => {
    const raw = row.images;
    let arr = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
    arr = (arr || []).filter(Boolean);
    if (arr.length === 0 && row.image_url) arr = [row.image_url];
    return arr;
  })(),
  image: row.image_url || null,
  unit: row.unit || null,
  isFeatured: !!row.is_featured,
  discountPct: parseInt(row.discount_pct) || 0,
  category: row.category || null,
  sku: row.sku || null,
  createdAt: row.created_at || null,
}) : null;

// True when a Supabase error is caused by the optional `unit` column not
// existing yet (schema not migrated). Lets us retry the write without it.
const isMissingUnitColumn = (error) =>
  !!error && typeof error.message === 'string' &&
  /column .*unit.* does not exist|'unit' column|could not find the 'unit'/i.test(error.message);

const toOrder = (row) => row ? ({
  id: row.id, userId: row.user_id, shopId: row.shop_id, items: row.items,
  total: row.total, status: row.status, date: row.created_at,
  customerGstin: row.customer_gstin, customerAddress: row.customer_address, customerStateCode: row.customer_state_code,
  paymentMethod: row.payment_method || 'Cash',
  shopMessage: row.shop_message || null,
  paymentVerified: row.payment_verified || false,
  acceptedAt: row.accepted_at || null,
  returnedAt: row.returned_at || null,
  refundAmount: row.refund_amount != null ? Number(row.refund_amount) : null,
  refundMode: row.refund_mode || null,
  returnedItems: row.returned_items || null,
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
  return daysSinceStart > 15;
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
      // The auth-login edge function can cold-start after inactivity (2-10s).
      // The direct-DB fallback no longer works for most roles (RLS only lets
      // anon read shop rows), so instead we give the function a generous first
      // try, then ONE fast retry (the function is warm by then), and surface a
      // clear message rather than hanging on "Signing in…".
      const callOnce = (ms) => {
        const invoke = supabase.functions.invoke('auth-login', { body: { phone, password: pass } });
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('edge_timeout')), ms));
        return Promise.race([invoke, timeout]);
      };

      let data, error, timedOut = false;
      try {
        ({ data, error } = await callOnce(9000));      // first try: allow for cold start
      } catch (_e) {
        timedOut = true;
      }

      // First attempt timed out → retry once (function is now warming/warm).
      if (timedOut) {
        try {
          ({ data, error } = await callOnce(8000));
        } catch (_e2) {
          throw new Error('The server is taking longer than usual to wake up. Please tap Sign In once more.');
        }
      }

      if (error || !data || data.error || !data.profile) {
        // Edge function responded but rejected — surface its reason.
        const msg = data?.error || error?.message || '';
        if (/pending/i.test(msg)) throw new Error('Account pending admin approval');
        if (/suspend/i.test(msg)) throw new Error('Account suspended. Contact adexosindia@gmail.com');
        if (/password|credential|wrong/i.test(msg)) throw new Error('Wrong password. Try again or use Forgot Password.');
        if (/not found|no user|register/i.test(msg)) throw new Error('Phone number not found. Please register first.');
        throw new Error(msg || 'Could not sign in. Please try again.');
      }

      if (data?.session) await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      return data.profile;
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not found. Please register first.");
    if (user.status === 'pending') throw new Error("Account pending admin approval. You'll be notified on WhatsApp once approved.");
    if (user.status === 'suspended') throw new Error("Your account has been suspended. Contact support: adexosindia@gmail.com");
    if (user.pass !== pass) throw new Error("Wrong password. Try again or use Forgot Password.");
    return user;
  },

  // Lightweight public peek — only fetches name/logo/role/staff_of, no auth required.
  // Used by Login page to show "signing in as..." card after phone is entered.
  async peekUserByPhone(phone) {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('users')
        .select('name, logo, role, staff_of, status')
        .eq('phone', phone)
        .maybeSingle();
      if (!data) return null;
      // For staff: also fetch their shop name
      if (data.role === 'staff' && data.staff_of) {
        const { data: shop } = await supabase
          .from('users')
          .select('name, logo')
          .eq('id', data.staff_of)
          .maybeSingle();
        return { ...data, shopName: shop?.name || null, shopLogo: shop?.logo || null };
      }
      return data;
    }
    const db = getDB();
    const u = db.users.find(u => u.phone === phone);
    if (!u) return null;
    if (u.role === 'staff' && u.staff_of) {
      const shop = db.users.find(s => s.id === u.staff_of);
      return { ...u, shopName: shop?.name || null, shopLogo: shop?.logo || null };
    }
    return u;
  },

  async loginByPhone(phone) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
      if (error || !data) throw new Error("Phone number not registered. Please register first.");
      if (data.status === 'suspended') throw new Error("Account suspended. Please raise a ticket at /support");
      return toUser(data);
    }
    const db = getDB();
    const user = db.users.find(u => u.phone === phone);
    if (!user) throw new Error("Phone number not registered. Please register first.");
    if (user.status === 'suspended') throw new Error("Account suspended. Please raise a ticket at /support");
    return user;
  },

  // ── Google OAuth (Supabase native) ──
  // Starts the Google sign-in redirect flow. On return, Supabase lands the
  // user back at /auth/callback with a session; AuthCallback.jsx links it to
  // a profile. redirectTo MUST be in Supabase Dashboard → Auth → URL Config.
  async signInWithGoogle() {
    if (!isSupabaseConfigured) throw new Error('Sign-in is not available right now.');
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw new Error(error.message);
    return data; // browser redirects to Google
  },

  // After the OAuth redirect returns, resolve the local profile for the
  // authenticated Google user. Called by AuthCallback.jsx.
  //   - existing email match  -> { profile, isNew:false }
  //   - no match              -> { isNew:true, email, name } so the callback
  //                              can send them to account-type selection.
  // We do NOT auto-create here; new Google users pick shop/distributor/customer
  // first (matching the normal onboarding/approval flow).
  async resolveOAuthProfile() {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('No active session after sign-in.');
    const authUser = session.user;
    const email = (authUser.email || '').toLowerCase();
    if (!email) throw new Error('Google account did not return an email.');

    const { data: profile } = await supabase.from('users')
      .select('*').ilike('email', email).maybeSingle();
    if (profile) {
      if (profile.status === 'suspended') throw new Error('Account suspended. Contact support.');
      return { profile: toUser(profile), isNew: false };
    }
    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0];
    return { isNew: true, email, name, authUid: authUser.id };
  },

  // Create the profile for a brand-new Google user AFTER they pick a role.
  // shop/distributor land in 'pending' (admin approval); customer is active.
  async createOAuthProfile({ email, name, role, authUid, phone }) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const cleanEmail = (email || '').toLowerCase();
    const needsApproval = role === 'shop' || role === 'distributor';
    // Phone is optional — present only when this OAuth registration came
    // through a claim link (/register?phone=X&claim=1 → Continue with
    // Google). Normalized to last-10 digits for consistent matching with
    // the orders.customer_phone column.
    const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : null;
    const insertObj = {
      id: authUid, email: cleanEmail, name, role,
      status: needsApproval ? 'pending' : 'active',
      auth_provider: 'google', email_verified: true,
      pass: 'oauth_no_password',
      subscription: role === 'shop' ? 'trial' : role === 'distributor' ? 'dist_trial' : 'active',
      subscription_tier: role === 'shop' ? 'starter' : role === 'distributor' ? 'dist_basic' : null,
      hide_from_search: role === 'shop' ? true : false,
      trial_started_at: new Date().toISOString(),
      onboarding_completed: !needsApproval,   // false for shop/distributor → must finish onboarding form
    };
    if (normalizedPhone && normalizedPhone.length === 10) insertObj.phone = normalizedPhone;
    // Self-heal: if either phone OR onboarding_completed column is missing
    // or rejects the value (unique constraint, schema cache lag), drop the
    // problem field and retry. The default value on the column kicks in.
    let attempt = { ...insertObj };
    let data = null, error = null;
    for (let tries = 0; tries < 3; tries++) {
      ({ data, error } = await supabase.from('users').insert(attempt).select().maybeSingle());
      if (!error) break;
      const msg = error.message || '';
      const miss = msg.match(/find the ['"]?(\w+)['"]? column/i)
        || msg.match(/column (?:[\w.]+\.)?["']?(\w+)["']? does not exist/i)
        || (normalizedPhone && /phone/i.test(msg) ? [null, 'phone'] : null);
      if (!miss || !(miss[1] in attempt)) break;
      delete attempt[miss[1]];
    }
    if (error) throw new Error(error.message);
    return toUser(data);
  },

  // ── Secure email password reset (Supabase native) ──
  // Only works for accounts that have a real email on file. Sends a reset
  // link to that inbox; the link lands on /auth/reset where the user sets a
  // new password. Replaces the old insecure phone-only reset.
  async requestPasswordReset(email) {
    if (!isSupabaseConfigured) throw new Error('Password reset is not available right now.');
    const clean = (email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Enter a valid email address.');
    // Look up whether a profile with this email exists (so we can tell phone-only
    // users to contact admin). We do NOT reveal existence to avoid enumeration —
    // always show the same success message regardless.
    const redirectTo = `${window.location.origin}/auth/reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo });
    // Intentionally ignore "user not found" style errors — same response either way.
    if (error && !/not found|no user/i.test(error.message)) throw new Error(error.message);
    return true;
  },

  // Called on /auth/reset after the user clicks the email link (session is
  // already established by the link). Sets the new password in Supabase Auth.
  async completePasswordReset(newPassword) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return true;
  },

  // Change password from inside the app (user is already logged in)
  async changePassword(newPassword) {
    if (!newPassword || newPassword.length < 4) throw new Error('Password must be at least 4 characters.');
    if (isSupabaseConfigured) {
      // Update Supabase Auth password (works for all roles)
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      // Also update pass_verify in public.users so auth-login edge fn stays in sync
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('users').update({ pass_verify: newPassword }).eq('id', user.id);
      }
      return true;
    }
    const db = getDB();
    const { data: { user: authUser } } = { data: { user: null } };
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
            // Fallback for the case where the edge function hasn't been
            // redeployed since we added onboarding_completed support: set
            // the flag client-side. Idempotent when the function already
            // set it. Targeted single-field update — not the role/status/
            // subscription block we used to do, which was both redundant
            // (the edge function sets all three correctly) and a code
            // smell because it relied on RLS letting the just-registered
            // user update their own row.
            const requiresOnboarding = role === 'shop' || role === 'distributor';
            if (requiresOnboarding && profile.onboardingCompleted !== false) {
              try {
                await supabase.from('users').update({ onboarding_completed: false }).eq('id', profile.id);
                profile.onboardingCompleted = false;
              } catch { /* column doesn't exist yet — migration pending; ignore */ }
            }
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
      const trialEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const newUser = {
        phone, pass, pass_verify: pass, role, name,
        status: requiresApproval ? 'pending' : 'active',
        subscription: role === 'shop' ? 'trial' : role === 'distributor' ? 'dist_trial' : 'active',
        subscription_tier: role === 'shop' ? 'starter' : role === 'distributor' ? 'dist_basic' : null,
        hide_from_search: role === 'shop' ? true : false,
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
    const trialEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
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
        const msg = encodeURIComponent(`Welcome to MyStore OS! 🎉\nYour account has been approved.\nLogin now: mystoreos.in/login\nPhone: ${user.phone}\n\nYour 15-day PRO trial starts now!`);
        window.open(`https://wa.me/91${user.phone}?text=${msg}`, '_blank');
      }
    }
  },

  async deleteUser(userId) {
    if (isSupabaseConfigured) {
      // Use the delete-user edge function so the Supabase Auth user is removed
      // too (not just the profile row). Otherwise the auth user {phone}@mystore
      // .internal lingers and the same phone can't re-register cleanly.
      try {
        const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
        if (!error && data?.success) return;
        // If the function returned an error payload, surface it.
        if (data?.error) throw new Error(data.error);
      } catch (_e) {
        // Fallback: if the edge function isn't deployed, at least delete the
        // profile row (legacy behaviour) so the admin action isn't a no-op.
        const { error: delErr } = await supabase.from('users').delete().eq('id', userId);
        if (delErr) throw new Error(delErr.message);
      }
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

  // ── Mutual shop↔distributor linking by public code ──
  // A distributor adds a shop by the shop's SHP- code; a shop adds a
  // distributor by the distributor's DST- code. Either creates the same link.
  async linkByPublicCode(myId, myRole, code) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const clean = (code || '').trim().toUpperCase();
    if (!clean) throw new Error('Enter a code.');
    const { data: target } = await supabase.from('users')
      .select('id, role, name, public_code').eq('public_code', clean).maybeSingle();
    if (!target) throw new Error('No shop or distributor found with that code.');

    let shop_id, distributor_id;
    if (myRole === 'distributor') {
      if (target.role !== 'shop') throw new Error('That code is not a shop code.');
      shop_id = target.id; distributor_id = myId;
    } else if (myRole === 'shop') {
      if (target.role !== 'distributor') throw new Error('That code is not a distributor code.');
      shop_id = myId; distributor_id = target.id;
    } else {
      throw new Error('Only shops and distributors can link.');
    }

    const { error } = await supabase.from('shop_distributor_links')
      .insert({ shop_id, distributor_id, created_by: myId });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error(`Already linked with ${target.name}.`);
      throw new Error(error.message);
    }
    return { name: target.name, code: target.public_code };
  },

  async getLinkedDistributors(shopId) {
    if (!isSupabaseConfigured) return [];
    const { data: links } = await supabase.from('shop_distributor_links')
      .select('distributor_id').eq('shop_id', shopId);
    const ids = [...new Set((links || []).map(l => l.distributor_id))];
    if (!ids.length) return [];
    const { data } = await supabase.from('users').select('*').in('id', ids);
    return (data || []).map(toUser);
  },

  async getLinkedShops(distributorId) {
    if (!isSupabaseConfigured) return [];
    const { data: links } = await supabase.from('shop_distributor_links')
      .select('shop_id').eq('distributor_id', distributorId);
    const ids = [...new Set((links || []).map(l => l.shop_id))];
    if (!ids.length) return [];
    const { data } = await supabase.from('users').select('*').in('id', ids);
    return (data || []).map(toUser);
  },

  async unlinkShopDistributor(shopId, distributorId) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const { error } = await supabase.from('shop_distributor_links')
      .delete().eq('shop_id', shopId).eq('distributor_id', distributorId);
    if (error) throw new Error(error.message);
    return true;
  },

  async setShopVisibility(shopId, hidden) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    // Admin RLS allows updating any user row; hide_from_search controls whether
    // the shop appears in customer search/storefront.
    const { error } = await supabase.from('users').update({ hide_from_search: !!hidden }).eq('id', shopId);
    if (error) throw new Error(error.message);
    return true;
  },

  async getAdminStats() {
    const DIST_PRICES = { basic_distributor: 999, pro_distributor: 2499, enterprise_distributor: 4999, dist_basic: 999, dist_pro: 2499, dist_enterprise: 4999 };
    const SHOP_PRICES = { starter: 499, pro: 999, enterprise: 2499 };
    // A shop counts as PAID only if subscription === 'active' (a real payment)
    // AND it has a future plan expiry. Trials carry subscription='trial' with a
    // future plan_expires_at (the trial end) and a default tier, so checking the
    // tier/expiry alone wrongly counted every trial as revenue.
    const isPaidShop = (u) => u.subscription === 'active'
      && !!u.subscription_tier && SHOP_PRICES[u.subscription_tier] != null
      && u.plan_expires_at && new Date(u.plan_expires_at) > new Date();
    // A distributor counts as PAID only if subscription === 'active' AND it has a
    // future distributor_plan_expires_at. (Every account carries a default
    // distributor_plan_tier of 'basic_distributor', so tier alone means nothing.)
    const isPaidDist = (u) => u.subscription === 'active'
      && !!u.distributor_plan_tier && DIST_PRICES[u.distributor_plan_tier] != null
      && u.distributor_plan_expires_at && new Date(u.distributor_plan_expires_at) > new Date();
    if (isSupabaseConfigured) {
      const { data: users } = await supabase.from('users').select('role, subscription, subscription_tier, plan_expires_at, distributor_plan_tier, distributor_plan_expires_at');
      const { data: orders } = await supabase.from('orders').select('total');
      const { data: credits } = await supabase.from('credits').select('amount, paid');
      const allUsers = users || [];
      const shops = allUsers.filter(u => u.role === 'shop');
      const paidShopRows = shops.filter(isPaidShop);
      const paidShops = paidShopRows.length;
      const shopMRR = paidShopRows.reduce((sum, s) => sum + (SHOP_PRICES[s.subscription_tier] || 0), 0);
      const distributors = allUsers.filter(u => u.role === 'distributor');
      const distMRR = distributors.reduce((sum, d) => sum + (isPaidDist(d) ? (DIST_PRICES[d.distributor_plan_tier] || 0) : 0), 0);
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
        const row = { id: tempId, shop_id: shopId, name, price: parseFloat(price), barcode, stock: parseInt(stock) || 0, batch_number: batchNumber || null, expiry_date: expiryDate || null, variants: variants || null, variant_prices: extraData?.variantPrices || null, reorder_level: parseInt(reorderLevel) || 10, hsn_code: sanitizeHsnCode(extraData?.hsnCode), gst_rate: parseInt(extraData?.gstRate) || 0, cost_price: parseFloat(extraData?.costPrice) || 0, image_url: extraData?.image || null };
        await enqueue({ table: 'products', action: 'insert', data: row });
        const db = getDB(); db.products = db.products || [];
        db.products.push({ id: tempId, shopId, name, price: parseFloat(price), barcode, stock: parseInt(stock) || 0, batchNumber: batchNumber || '', expiryDate: expiryDate || '', variants: variants || '', variantPrices: extraData?.variantPrices || null, reorderLevel: parseInt(reorderLevel) || 10, hsnCode: sanitizeHsnCode(extraData?.hsnCode) || '', gstRate: parseInt(extraData?.gstRate) || 0, costPrice: parseFloat(extraData?.costPrice) || 0, unit: extraData?.unit || null });
        saveDB(db); return toProduct(row);
      }
      const imgs = Array.isArray(extraData.images) ? extraData.images.filter(Boolean).slice(0, 4) : [];
      const cover = imgs[0] || extraData.image || null;
      const baseInsert = {
        shop_id: shopId,
        name,
        price: parseFloat(price),
        barcode,
        stock: parseInt(stock) || 0,
        batch_number: batchNumber || null,
        expiry_date: expiryDate || null,
        variants: variants || null,
        reorder_level: parseInt(reorderLevel) || 10,
        hsn_code: sanitizeHsnCode(extraData.hsnCode),
        gst_rate: parseInt(extraData.gstRate) || 0,
        cost_price: parseFloat(extraData.costPrice) || 0,
        image_url: cover,
        images: imgs,
        is_featured: !!extraData.isFeatured,
        discount_pct: Math.max(0, Math.min(99, parseInt(extraData.discountPct) || 0)),
      };
      if (extraData.unit) baseInsert.unit = extraData.unit;
      if (extraData.variantPrices) baseInsert.variant_prices = extraData.variantPrices;
      if (extraData.category) baseInsert.category = extraData.category;
      if (extraData.sku) baseInsert.sku = extraData.sku;
      // Self-healing insert: if an optional column (images / unit / image_url)
      // isn't in the DB yet, drop just that column and retry. Lets the gallery
      // work whether or not the migration has been applied.
      let attempt = { ...baseInsert };
      let prodRow = null, error = null;
      for (let tries = 0; tries < 6; tries++) {
        ({ data: prodRow, error } = await supabase.from('products').insert(attempt).select().maybeSingle());
        if (!error) break;
        const msg = error.message || '';
        // Supabase REST (PostgREST) form: Could not find the 'X' column of 'products' in the schema cache
        // Raw Postgres form: column "X" does not exist
        const miss = msg.match(/find the ['"]?(\w+)['"]? column/i)
          || msg.match(/column (?:[\w.]+\.)?["']?(\w+)["']? does not exist/i);
        if (!miss || !(miss[1] in attempt)) break;
        delete attempt[miss[1]];
      }
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
      variantPrices: extraData?.variantPrices || null,
      reorderLevel: parseInt(reorderLevel) || 10,
      hsnCode: extraData?.hsnCode || '',
      gstRate: parseInt(extraData?.gstRate) || 0,
      costPrice: parseFloat(extraData?.costPrice) || 0,
      image: extraData?.image || null,
      unit: extraData?.unit || null,
      discountPct: parseInt(extraData?.discountPct) || 0,
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
        if (data.variantPrices !== undefined) updateObj.variant_prices = data.variantPrices || null;
        if (data.category !== undefined) updateObj.category = data.category || null;
        if (data.sku !== undefined) updateObj.sku = data.sku || null;
        if (data.reorderLevel !== undefined) updateObj.reorder_level = parseInt(data.reorderLevel);
        if (data.hsnCode !== undefined) updateObj.hsn_code = sanitizeHsnCode(data.hsnCode);
        if (data.gstRate !== undefined) updateObj.gst_rate = parseInt(data.gstRate) || 0;
        if (data.costPrice !== undefined) updateObj.cost_price = parseFloat(data.costPrice) || 0;
        if (data.image !== undefined) updateObj.image_url = data.image || null;
        if (data.unit !== undefined) updateObj.unit = data.unit || null;
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
      if (data.variantPrices !== undefined) updateObj.variant_prices = data.variantPrices || null;
      if (data.category !== undefined) updateObj.category = data.category || null;
      if (data.sku !== undefined) updateObj.sku = data.sku || null;
      if (data.reorderLevel !== undefined) updateObj.reorder_level = parseInt(data.reorderLevel);
      if (data.hsnCode !== undefined) updateObj.hsn_code = sanitizeHsnCode(data.hsnCode);
      if (data.gstRate !== undefined) updateObj.gst_rate = parseInt(data.gstRate) || 0;
      if (data.costPrice !== undefined) updateObj.cost_price = parseFloat(data.costPrice) || 0;
      if (data.images !== undefined) {
        const imgs = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 4) : [];
        updateObj.images = imgs;
        updateObj.image_url = imgs[0] || null;   // keep cover in sync
      } else if (data.image !== undefined) {
        updateObj.image_url = data.image || null;
      }
      if (data.unit !== undefined) updateObj.unit = data.unit || null;
      if (data.isFeatured !== undefined) updateObj.is_featured = !!data.isFeatured;
      if (data.discountPct !== undefined) updateObj.discount_pct = Math.max(0, Math.min(99, parseInt(data.discountPct) || 0));

      // Self-healing update: drop any optional column the DB doesn't have yet.
      let attempt = { ...updateObj };
      let updated = null, error = null;
      for (let tries = 0; tries < 6; tries++) {
        ({ data: updated, error } = await supabase.from('products').update(attempt).eq('id', prodId).select().maybeSingle());
        if (!error) break;
        const msg = error.message || '';
        const miss = msg.match(/find the ['"]?(\w+)['"]? column/i)
          || msg.match(/column (?:[\w.]+\.)?["']?(\w+)["']? does not exist/i);
        if (!miss || !(miss[1] in attempt)) break;
        delete attempt[miss[1]];
      }
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
      if (data.variantPrices !== undefined) prod.variantPrices = data.variantPrices || null;
      if (data.category !== undefined) prod.category = data.category || null;
      if (data.sku !== undefined) prod.sku = data.sku || null;
      if (data.reorderLevel !== undefined) prod.reorderLevel = parseInt(data.reorderLevel);
      if (data.hsnCode !== undefined) prod.hsnCode = sanitizeHsnCode(data.hsnCode) || '';
      if (data.gstRate !== undefined) prod.gstRate = parseInt(data.gstRate) || 0;
      if (data.image !== undefined) prod.image = data.image;
      if (data.unit !== undefined) prod.unit = data.unit || null;
      if (data.discountPct !== undefined) prod.discountPct = Math.max(0, Math.min(99, parseInt(data.discountPct) || 0));
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
      // Direct insert is blocked by RLS (403). Use the add-staff edge function
      // which runs with the service-role key and also creates the auth.users entry
      // so the staff member can actually log in.
      const { data, error } = await supabase.functions.invoke('add-staff', {
        body: { shopId, phone, name, pin: pass || '1234' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
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

  async getUserOrders(userId, userPhone = null) {
    // Customer's purchase history = orders where user_id is theirs OR
    // customer_phone matches their normalized phone. The second path is
    // the phone-based reconciliation: when a shop bills a guest with
    // phone 9063878382 and that person later creates an account with
    // the same phone, those past bills show up immediately in their
    // "My Bills" view without any manual claim flow.
    if (isSupabaseConfigured) {
      const normalizedPhone = userPhone ? String(userPhone).replace(/\D/g, '').slice(-10) : null;
      let ordersById = [];
      let ordersByPhone = [];

      const { data: byId } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      ordersById = byId || [];

      if (normalizedPhone && normalizedPhone.length === 10) {
        // Fetch additional orders matched by phone — exclude the user's
        // own user_id so we don't double-count. If the customer_phone
        // column doesn't exist yet (migration not run), this throws —
        // we silently fall through to phone-less behavior.
        try {
          const { data: byPhone, error: phoneErr } = await supabase.from('orders')
            .select('*')
            .eq('customer_phone', normalizedPhone)
            .neq('user_id', userId)
            .order('created_at', { ascending: false });
          if (!phoneErr) ordersByPhone = byPhone || [];
        } catch { /* column missing — ignore, just use ordersById */ }

        // BELT-AND-BRACES: the customer_phone column may not exist yet
        // (migration not run) OR a particular row may have been saved
        // BEFORE the migration ran (column existed but row was inserted
        // via offline-sync queue with the field stripped, etc.). The
        // ORIGINAL source of truth is the synthetic user_id string —
        // 'walk-in:Name:9876543210:staff:...' — which has been written
        // since day one. We can find those rows via LIKE-match on the
        // raw user_id and merge them in. Safe to dedupe later because
        // we union into the same Set.
        try {
          const { data: byEmbed, error: embedErr } = await supabase.from('orders')
            .select('*')
            .or(`user_id.like.walk-in:%:${normalizedPhone}:%,user_id.like.walk-in:%:${normalizedPhone},user_id.like.estimate:%:${normalizedPhone}:%,user_id.like.estimate:%:${normalizedPhone},user_id.like.challan:%:${normalizedPhone}:%,user_id.like.challan:%:${normalizedPhone}`)
            .neq('user_id', userId)
            .order('created_at', { ascending: false });
          if (!embedErr && byEmbed) ordersByPhone = [...ordersByPhone, ...byEmbed];
        } catch { /* ignore — best-effort fallback */ }
      }

      // Merge and de-dup (same order shouldn't appear twice if it ever
      // both matches userId and customer_phone).
      const merged = [...ordersById];
      const seen = new Set(ordersById.map(o => o.id));
      for (const o of ordersByPhone) {
        if (!seen.has(o.id)) { merged.push(o); seen.add(o.id); }
      }
      merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const { data: users } = await supabase.from('users').select('id, name').eq('role', 'shop');
      const shopMap = {};
      (users || []).forEach(u => { shopMap[u.id] = u.name; });
      return merged.map(o => ({ ...toOrder(o), shopName: shopMap[o.shop_id] || 'Unknown Shop' }));
    }
    const db = getDB();
    const normalizedPhone = userPhone ? String(userPhone).replace(/\D/g, '').slice(-10) : null;
    return db.orders.filter(o =>
      o.userId === userId
      || (normalizedPhone && o.customerPhone && String(o.customerPhone).replace(/\D/g, '').slice(-10) === normalizedPhone)
    ).map(o => {
      const shop = db.users.find(u => u.id === o.shopId);
      return { ...o, shopName: shop ? shop.name : 'Unknown Shop' };
    }).reverse();
  },

  async placeOrder(userId, shopId, items, total, customerData = {}, status = 'Pending', paymentMethod = 'Cash') {
    // Normalize the customer phone to a canonical last-10-digits form.
    // This is what we store on the row and what we match against when
    // the customer later creates an account and looks up "My Bills".
    // Without normalization, a bill saved as '+91 90638 78382' wouldn't
    // match a user who registered as '9063878382', and the phone-based
    // bill reconciliation feature would silently fail.
    const rawPhone = customerData.phone || '';
    const normalizedPhone = String(rawPhone).replace(/\D/g, '').slice(-10) || null;
    if (isSupabaseConfigured) {
      if (!navigator.onLine) {
        const tempId = crypto.randomUUID();
        const row = { id: tempId, user_id: userId, shop_id: shopId, items, total, status, customer_gstin: customerData.gstin || null, customer_address: customerData.address || null, customer_state_code: customerData.stateCode || null, customer_phone: normalizedPhone, payment_method: paymentMethod || 'Cash' };
        await enqueue({ table: 'orders', action: 'insert', data: row });
        const db = getDB(); db.orders = db.orders || [];
        db.orders.push({ id: tempId, userId, shopId, items, total, status, date: new Date().toISOString(), customerGstin: customerData.gstin || '', customerAddress: customerData.address || '', customerStateCode: customerData.stateCode || '', customerPhone: normalizedPhone || '' });
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

      const insertObj = {
        user_id: userId,
        shop_id: resolvedId,
        items,
        total,
        status,
        customer_gstin: customerData.gstin || null,
        customer_address: customerData.address || null,
        customer_state_code: customerData.stateCode || null,
        customer_phone: normalizedPhone,
        payment_method: paymentMethod || 'Cash'
      };
      // Self-heal around the customer_phone column not existing yet
      // (migration not run): retry without it instead of failing the bill.
      let attempt = { ...insertObj };
      let data = null, error = null;
      for (let tries = 0; tries < 4; tries++) {
        ({ data, error } = await supabase.from('orders').insert(attempt).select().maybeSingle());
        if (!error) break;
        const msg = error.message || '';
        const miss = msg.match(/find the ['"]?(\w+)['"]? column/i)
          || msg.match(/column (?:[\w.]+\.)?["']?(\w+)["']? does not exist/i);
        if (!miss || !(miss[1] in attempt)) break;
        delete attempt[miss[1]];
      }
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
      status, 
      paymentMethod: paymentMethod || 'Cash',
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
        await enqueue({ table: 'orders', action: 'update', data: { status: 'Accepted', accepted_at: new Date().toISOString() }, match: { id: orderId } });
        const db = getDB(); const o = db.orders.find(x => x.id === orderId); if (o) { o.status = 'Accepted'; saveDB(db); } return;
      }
      await supabase.from('orders').update({ status: 'Accepted', accepted_at: new Date().toISOString() }).eq('id', orderId);
      return;
    }
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (order) order.status = 'Accepted';
    saveDB(db);
  },

  async verifyOrderPayment(orderId, message = '') {
    if (isSupabaseConfigured) {
      await supabase.from('orders').update({
        status: 'Completed',
        payment_verified: true,
        shop_message: message || 'Payment verified by shopkeeper. Thank you!'
      }).eq('id', orderId);
      return;
    }
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (order) { order.status = 'Completed'; order.paymentVerified = true; order.shopMessage = message; saveDB(db); }
  },

  // Cancel a Pending order — for orders the shop hasn't accepted/processed
  // yet (no money or goods have changed hands). Once an order is Accepted
  // or Completed, use processReturn() instead since that path is what
  // restores stock and tracks a refund.
  async cancelOrder(orderId, reason = '') {
    const message = reason ? `Order cancelled: ${reason}` : 'Order cancelled by shop.';
    if (isSupabaseConfigured) {
      await supabase.from('orders').update({
        status: 'Cancelled',
        shop_message: message,
      }).eq('id', orderId);
      return;
    }
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (order) { order.status = 'Cancelled'; order.shopMessage = message; }
    saveDB(db);
  },

  async processReturn(orderId, returnItems, refundMode = 'cash') {
    // Compute refund total and whether this is a full or partial return
    const refundAmount = (returnItems || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.returnQty || 0)), 0);

    if (isSupabaseConfigured) {
      // Fetch the order to know its original items/total — needed to tell
      // a full return (all qty of all items) from a partial one.
      const { data: orderRow } = await supabase.from('orders').select('items, total, refund_amount').eq('id', orderId).maybeSingle();

      const originalQtyTotal = (orderRow?.items || []).reduce((s, it) => s + (Number(it.qty) || 1), 0);
      const returnedQtyTotal = (returnItems || []).reduce((s, it) => s + (Number(it.returnQty) || 0), 0);
      const priorRefund = Number(orderRow?.refund_amount) || 0;
      const isFullReturn = returnedQtyTotal >= originalQtyTotal;

      await supabase.from('orders').update({
        status: isFullReturn ? 'Returned' : 'Accepted', // partial return keeps the bill active, just flags the refund
        returned_at: new Date().toISOString(),
        refund_amount: priorRefund + refundAmount,
        refund_mode: refundMode,
        returned_items: returnItems,
      }).eq('id', orderId);

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
      return { refundAmount, isFullReturn };
    }

    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
      const originalQtyTotal = (order.items || []).reduce((s, it) => s + (Number(it.qty) || 1), 0);
      const returnedQtyTotal = (returnItems || []).reduce((s, it) => s + (Number(it.returnQty) || 0), 0);
      const isFullReturn = returnedQtyTotal >= originalQtyTotal;
      order.status = isFullReturn ? 'Returned' : 'Accepted';
      order.returnedAt = new Date().toISOString();
      order.refundAmount = (Number(order.refundAmount) || 0) + refundAmount;
      order.refundMode = refundMode;
      order.returnedItems = returnItems;
    }

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
    return { refundAmount, isFullReturn: order ? (order.status === 'Returned') : true };
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
  // ───── BRANCH MANAGEMENT (multi-shop / multi-location) ────────────────
  //
  // Lifecycle: an owner registers as a regular shop (their row has
  // parent_shop_id = NULL — this is the "main" shop). They can then
  // create branches via createBranch — each branch is a new users row
  // with role='shop' and parent_shop_id = the main shop's id. Switching
  // between branches in the dashboard just changes which shop's id all
  // existing queries (getShopProducts, getShopOrders, getShopStaff,
  // etc.) are scoped to. No other API changes needed downstream.

  async getOwnedBranches(ownerId) {
    // Returns the owner's main shop + all their active (non-deleted)
    // branches, sorted with the main shop first. Used to populate the
    // branch-switcher dropdown.
    if (!ownerId) return [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('users')
          .select('*')
          .or(`id.eq.${ownerId},parent_shop_id.eq.${ownerId}`)
          .eq('role', 'shop')
          .order('parent_shop_id', { ascending: true, nullsFirst: true })  // main shop (NULL parent) first
          .order('created_at', { ascending: true });
        if (error) {
          // Column doesn't exist yet (migration not run) — fall back to
          // just returning the main shop so the rest of the dashboard
          // works as before.
          if (/parent_shop_id|branch_deleted_at/i.test(error.message || '')) {
            const { data: own } = await supabase.from('users').select('*').eq('id', ownerId).maybeSingle();
            return own ? [toUser(own)] : [];
          }
          throw new Error(error.message);
        }
        // Filter out soft-deleted branches client-side (.or() makes it
        // awkward to AND in branch_deleted_at IS NULL).
        return (data || [])
          .filter(r => !r.branch_deleted_at)
          .map(toUser);
      } catch (err) {
        console.error('getOwnedBranches failed:', err);
        return [];
      }
    }
    const db = getDB();
    return db.users
      .filter(u => u.role === 'shop' && (u.id === ownerId || u.parentShopId === ownerId) && !u.branchDeletedAt)
      .sort((a, b) => (a.parentShopId ? 1 : 0) - (b.parentShopId ? 1 : 0));
  },

  async createBranch({ ownerId, name, phone, address = '', gstin = '', stateCode = '' }) {
    if (!ownerId) throw new Error('Owner ID required');
    if (!name || !name.trim()) throw new Error('Branch name is required');
    if (!phone || !/^\d{10}$/.test(String(phone).replace(/\D/g, '').slice(-10))) {
      throw new Error('Enter a valid 10-digit branch phone');
    }
    const normalizedPhone = String(phone).replace(/\D/g, '').slice(-10);

    if (isSupabaseConfigured) {
      // Verify the parent exists and is a shop. Prevents creating
      // branches under random non-shop user ids (defense in depth — RLS
      // should also enforce this server-side).
      const { data: parent, error: parentErr } = await supabase.from('users')
        .select('id, role, subscription_tier, gstin, state_code').eq('id', ownerId).maybeSingle();
      if (parentErr) throw new Error(parentErr.message);
      if (!parent || parent.role !== 'shop') throw new Error('Only shop owners can create branches.');

      const insertObj = {
        name: name.trim(),
        phone: normalizedPhone,
        role: 'shop',
        status: 'active',                            // inherits parent's approved status
        subscription: 'trial',
        subscription_tier: parent.subscription_tier || 'starter',
        hide_from_search: false,                     // visible in marketplace by default; owner can toggle
        parent_shop_id: ownerId,
        business_address: address || null,
        gstin: gstin || parent.gstin || null,        // default to parent's GSTIN if same legal entity
        state_code: stateCode || parent.state_code || null,
        onboarding_completed: true,                  // branches skip the onboarding flow
        pass: 'branch_no_password',                  // branches don't have independent login in v1
      };
      // Self-heal around branch_deleted_at / parent_shop_id columns not
      // existing yet (migration not run).
      let attempt = { ...insertObj };
      let data = null, error = null;
      for (let tries = 0; tries < 3; tries++) {
        ({ data, error } = await supabase.from('users').insert(attempt).select().maybeSingle());
        if (!error) break;
        const msg = error.message || '';
        const miss = msg.match(/find the ['"]?(\w+)['"]? column/i)
          || msg.match(/column (?:[\w.]+\.)?["']?(\w+)["']? does not exist/i);
        if (!miss || !(miss[1] in attempt)) break;
        delete attempt[miss[1]];
      }
      if (error) throw new Error(error.message);
      return toUser(data);
    }
    // Local (mockDB) fallback
    const db = getDB();
    const branchId = (crypto?.randomUUID?.() || `branch-${Date.now()}`);
    const branch = {
      id: branchId,
      role: 'shop',
      name: name.trim(),
      phone: normalizedPhone,
      parentShopId: ownerId,
      status: 'active',
      subscription: 'trial',
      hideFromSearch: false,
      businessAddress: address,
      gstin, stateCode,
      onboardingCompleted: true,
    };
    db.users.push(branch);
    saveDB(db);
    return branch;
  },

  async updateBranch(branchId, ownerId, updates) {
    if (!branchId || !ownerId) throw new Error('IDs required');
    if (isSupabaseConfigured) {
      // Verify ownership before allowing the update. Either it's the
      // owner's own row (their main shop) or a branch they own.
      const { data: target } = await supabase.from('users').select('id, parent_shop_id').eq('id', branchId).maybeSingle();
      if (!target) throw new Error('Branch not found');
      if (target.id !== ownerId && target.parent_shop_id !== ownerId) {
        throw new Error("You don't own this branch");
      }
      // Map allowed updates from camelCase
      const obj = {};
      if (updates.name !== undefined) obj.name = updates.name;
      if (updates.phone !== undefined) obj.phone = String(updates.phone).replace(/\D/g, '').slice(-10);
      if (updates.businessAddress !== undefined) obj.business_address = updates.businessAddress;
      if (updates.gstin !== undefined) obj.gstin = updates.gstin;
      if (updates.stateCode !== undefined) obj.state_code = updates.stateCode;
      if (updates.hideFromSearch !== undefined) obj.hide_from_search = !!updates.hideFromSearch;
      const { data, error } = await supabase.from('users').update(obj).eq('id', branchId).select().maybeSingle();
      if (error) throw new Error(error.message);
      return toUser(data);
    }
    const db = getDB();
    const idx = db.users.findIndex(u => u.id === branchId);
    if (idx === -1) throw new Error('Branch not found');
    if (db.users[idx].id !== ownerId && db.users[idx].parentShopId !== ownerId) throw new Error("You don't own this branch");
    db.users[idx] = { ...db.users[idx], ...updates };
    saveDB(db);
    return db.users[idx];
  },

  async deleteBranch(branchId, ownerId) {
    if (!branchId || !ownerId) throw new Error('IDs required');
    if (branchId === ownerId) throw new Error('Cannot delete the main shop — only its branches.');
    if (isSupabaseConfigured) {
      // Verify the row is a branch of this owner before soft-deleting.
      const { data: target } = await supabase.from('users').select('id, parent_shop_id').eq('id', branchId).maybeSingle();
      if (!target) throw new Error('Branch not found');
      if (target.parent_shop_id !== ownerId) throw new Error("You don't own this branch");
      // Soft delete — historical orders/products keep their shop_id
      // pointer working, so we never hard-delete. Branch disappears from
      // the switcher but its bills are still readable for reports.
      const { error } = await supabase.from('users')
        .update({ branch_deleted_at: new Date().toISOString(), hide_from_search: true })
        .eq('id', branchId);
      if (error) throw new Error(error.message);
      return true;
    }
    const db = getDB();
    const idx = db.users.findIndex(u => u.id === branchId);
    if (idx === -1) throw new Error('Branch not found');
    if (db.users[idx].parentShopId !== ownerId) throw new Error("You don't own this branch");
    db.users[idx].branchDeletedAt = new Date().toISOString();
    db.users[idx].hideFromSearch = true;
    saveDB(db);
    return true;
  },

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
      const { data } = await supabase.from('users').select('*').in('role', ['shop', 'distributor']);
      return (data || []).map(toUser);
    }
    const db = getDB();
    return db.users.filter(u => u.role === 'shop' || u.role === 'distributor');
  },

  // Admin: get order count + total revenue per shop in one query
  async adminGetShopStats(shopId) {
    if (!isSupabaseConfigured) return { orderCount: 0, revenue: 0, lastOrderAt: null };
    const { data } = await supabase
      .from('orders')
      .select('total, created_at')
      .eq('shop_id', shopId)
      .eq('status', 'Accepted');
    if (!data || !data.length) return { orderCount: 0, revenue: 0, lastOrderAt: null };
    const revenue = data.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const lastOrderAt = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at || null;
    return { orderCount: data.length, revenue: Math.round(revenue), lastOrderAt };
  },

  // ── Shop assigns / views / removes their CA (by CA phone) ──
  async assignCAByPhone(shopId, caPhone) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const clean = (caPhone || '').trim();
    if (!/^\d{10}$/.test(clean)) throw new Error('Enter a valid 10-digit CA mobile number.');
    const { data: ca } = await supabase.from('users').select('id, role, name').eq('phone', clean).maybeSingle();
    if (!ca) throw new Error('No account found with that number. Ask your CA to register first.');
    if (ca.role !== 'ca') throw new Error('That number is not registered as a Chartered Accountant.');
    const { error } = await supabase.from('users').update({ ca_id: ca.id }).eq('id', shopId);
    if (error) throw new Error(error.message);
    return { id: ca.id, name: ca.name };
  },

  async getMyCA(shopId) {
    if (!isSupabaseConfigured) return null;
    const { data: shop } = await supabase.from('users').select('ca_id').eq('id', shopId).maybeSingle();
    if (!shop?.ca_id) return null;
    const { data: ca } = await supabase.from('users').select('id, name, phone').eq('id', shop.ca_id).maybeSingle();
    return ca || null;
  },

  async removeCA(shopId) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const { error } = await supabase.from('users').update({ ca_id: null }).eq('id', shopId);
    if (error) throw new Error(error.message);
    return true;
  },

  // ── CA: only shops that assigned this CA ──
  async getMyClients(caId) {
    if (!isSupabaseConfigured) return [];
    const { data } = await supabase.from('users').select('*').eq('role', 'shop').eq('ca_id', caId);
    return (data || []).map(toUser);
  },

  // ── Distributor: shops with a wholesale order OR an explicit code link ──
  async getMyRetailShops(distributorId) {
    if (!isSupabaseConfigured) return [];
    const { data: orders } = await supabase
      .from('stock_orders').select('shop_id').eq('distributor_id', distributorId);
    const { data: links } = await supabase
      .from('shop_distributor_links').select('shop_id').eq('distributor_id', distributorId);
    const shopIds = [...new Set([
      ...(orders || []).map(o => o.shop_id),
      ...(links || []).map(l => l.shop_id),
    ].filter(Boolean))];
    if (shopIds.length === 0) return [];
    const { data: shops } = await supabase.from('users').select('*').in('id', shopIds);
    return (shops || []).map(toUser);
  },

  // ---- FILE UPLOADS TO SUPABASE STORAGE ----
  async uploadAsset(file, userId, folder = 'logos') {
    // Final shared guard — every caller of uploadAsset is an image upload
    // (logos, product photos, avatars, shop photos, payment QR codes), and
    // not every caller does its own client-side resize/validation first
    // (the payment QR upload, for one, goes straight here with no local
    // canvas step at all). Catches anything the per-component guards
    // might miss, and protects this function if it's ever called from a
    // future code path that forgets to validate first.
    const check = validateImageFile(file);
    if (!check.ok) throw new Error(check.reason);

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
      if (data.merchantUpiId !== undefined) updateObj.merchant_upi_id = data.merchantUpiId || null;
      if (data.merchantCode !== undefined) updateObj.merchant_code = data.merchantCode || null;
      if (data.logo !== undefined) updateObj.logo = data.logo;
      if (data.shopPhotos !== undefined) updateObj.shop_photos = data.shopPhotos;
      if (data.paymentQr !== undefined) updateObj.payment_qr = data.paymentQr;
      if (data.subscription !== undefined) updateObj.subscription = data.subscription;
      if (data.subscriptionTier !== undefined) updateObj.subscription_tier = data.subscriptionTier;
      if (data.name !== undefined) updateObj.name = data.name;
      if (data.phone !== undefined) updateObj.phone = data.phone;
      if (data.passVerify !== undefined) updateObj.pass_verify = data.passVerify;
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
      if (data.onboardingCompleted !== undefined) updateObj.onboarding_completed = data.onboardingCompleted;
      if (data.openingHour !== undefined) updateObj.opening_hour = data.openingHour;
      if (data.closingHour !== undefined) updateObj.closing_hour = data.closingHour;
      if (data.weeklyHolidays !== undefined) updateObj.weekly_holidays = data.weeklyHolidays;
      if (data.shopBanner !== undefined) updateObj.shop_banner = data.shopBanner;
      // If any optional column does not yet exist in the DB, drop it and retry.
      // Makes the feature work whether or not the latest ALTER TABLE has been applied.
      let __attempt = { ...updateObj };
      for (let __tries = 0; __tries < 10; __tries++) {
        const { error: __upErr } = await supabase.from('users').update(__attempt).eq('id', userId);
        if (!__upErr) break;
        const __miss = (__upErr.message || '').match(/column (?:users\.)?["']?(\w+)["']? does not exist/i);
        if (!__miss) { console.warn('[updateProfile]', __upErr.message); break; }
        delete __attempt[__miss[1]];
        if (Object.keys(__attempt).length === 0) break;
      }
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
      return {
        razorpayKey:  data?.razorpay_key   || '',
        playStoreUrl: data?.play_store_url  || '',
        appStoreUrl:  data?.app_store_url   || '',
        instagramUrl: data?.instagram_url   || '',
        facebookUrl:  data?.facebook_url    || '',
        twitterUrl:   data?.twitter_url     || '',
        youtubeUrl:   data?.youtube_url     || '',
        linkedinUrl:  data?.linkedin_url    || '',
        whatsappUrl:  data?.whatsapp_url    || '',
      };
    }
    const db = getDB();
    return db.settings || { razorpayKey: '' };
  },

  async saveSettings(newSettings) {
    if (isSupabaseConfigured) {
      const updateObj = {};
      if (newSettings.razorpayKey     !== undefined) updateObj.razorpay_key    = newSettings.razorpayKey;
      if (newSettings.playStoreUrl   !== undefined) updateObj.play_store_url  = newSettings.playStoreUrl;
      if (newSettings.appStoreUrl    !== undefined) updateObj.app_store_url   = newSettings.appStoreUrl;
      if (newSettings.instagramUrl   !== undefined) updateObj.instagram_url   = newSettings.instagramUrl;
      if (newSettings.facebookUrl    !== undefined) updateObj.facebook_url    = newSettings.facebookUrl;
      if (newSettings.twitterUrl     !== undefined) updateObj.twitter_url     = newSettings.twitterUrl;
      if (newSettings.youtubeUrl     !== undefined) updateObj.youtube_url     = newSettings.youtubeUrl;
      if (newSettings.linkedinUrl    !== undefined) updateObj.linkedin_url    = newSettings.linkedinUrl;
      if (newSettings.whatsappUrl    !== undefined) updateObj.whatsapp_url    = newSettings.whatsappUrl;
      await supabase.from('settings').update(updateObj).eq('id', 1);
      return newSettings;
    }
    const db = getDB();
    db.settings = { ...db.settings, ...newSettings };
    saveDB(db);
    return db.settings;
  },

  // ---- CMS (Site Config) ----
  // ── Yearly plans & launch offer (admin-managed) ──
  // Stored in site_config under 'yearly_plans':
  // { enabled, offerPercent, offerCap, offerRemaining, prices: {starter, pro, enterprise} }
  async getYearlyConfig() {
    const d = await this.getSiteConfig('yearly_plans', null);
    return d || { enabled: false, offerPercent: 50, offerCap: 1000, offerRemaining: 1000, prices: {} };
  },

  async saveYearlyConfig(cfg) {
    await this.saveSiteConfig('yearly_plans', cfg);
    return cfg;
  },

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

  // ── Unified pricing (single source of truth) ──
  // site_config 'pricing_v2':
  // { tiers: { starter:{monthly,quarterly,yearly}, pro:{...}, enterprise:{...} },
  //   discounts: { quarterly: %, yearly: % },   // promo discount per cycle
  //   offer: { enabled, percent, cap, remaining }, // launch offer (first N)
  //   enabledCycles: { monthly:true, quarterly:true, yearly:true } }
  // The discounted price for a cycle = base[cycle] * (1 - discounts[cycle]/100),
  // with an extra offer.percent off while offer.remaining > 0.
  async getPricing() {
    const def = {
      tiers: {
        starter:    { monthly: 499,  quarterly: 1347, yearly: 4790 },
        pro:        { monthly: 999,  quarterly: 2697, yearly: 9590 },
        enterprise: { monthly: 2499, quarterly: 6747, yearly: 23990 },
        basic_distributor:      { monthly: 999,  quarterly: 2697,  yearly: 9590 },
        pro_distributor:        { monthly: 2499, quarterly: 6747,  yearly: 23990 },
        enterprise_distributor: { monthly: 4999, quarterly: 13497, yearly: 47990 },
      },
      discounts: { quarterly: 10, yearly: 20 },
      offer: { enabled: false, percent: 50, cap: 1000, remaining: 1000 },
      enabledCycles: { monthly: true, quarterly: true, yearly: true },
    };
    const stored = await this.getSiteConfig('pricing_v2', null);
    if (!stored) return def;
    // shallow-merge so new keys always exist
    return {
      tiers: { ...def.tiers, ...(stored.tiers || {}) },
      discounts: { ...def.discounts, ...(stored.discounts || {}) },
      offer: { ...def.offer, ...(stored.offer || {}) },
      enabledCycles: { ...def.enabledCycles, ...(stored.enabledCycles || {}) },
    };
  },

  async savePricing(cfg) {
    await this.saveSiteConfig('pricing_v2', cfg);
    return cfg;
  },

  // Compute the final price for a tier+cycle given pricing config.
  // Returns { base, afterCycleDiscount, final, offerOn }.
  computePrice(pricing, tier, cycle) {
    const base = Number(pricing?.tiers?.[tier]?.[cycle]) || 0;
    if (!base) return null;
    const cycleDisc = cycle === 'monthly' ? 0 : (Number(pricing?.discounts?.[cycle]) || 0);
    const afterCycle = Math.round(base * (1 - cycleDisc / 100));
    const offerOn = !!pricing?.offer?.enabled && Number(pricing?.offer?.remaining) > 0 && Number(pricing?.offer?.percent) > 0;
    const final = offerOn ? Math.round(afterCycle * (1 - Number(pricing.offer.percent) / 100)) : afterCycle;
    return { base, afterCycleDiscount: afterCycle, final, offerOn, cycleDisc, offerPercent: Number(pricing?.offer?.percent) || 0 };
  },

  // ── Support tickets ──
  async createTicket(userId, { name, role, subject, category, body }) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const { data: ticket, error } = await supabase.from('support_tickets')
      .insert({ user_id: userId, name, role, subject, category: category || 'general' })
      .select().maybeSingle();
    if (error) throw new Error(error.message);
    if (body) {
      await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender: 'user', body });
    }
    return ticket;
  },

  async getMyTickets(userId) {
    if (!isSupabaseConfigured) return [];
    const { data } = await supabase.from('support_tickets')
      .select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    return data || [];
  },

  async getAllTickets(statusFilter) {
    if (!isSupabaseConfigured) return [];
    let q = supabase.from('support_tickets').select('*').order('updated_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    return data || [];
  },

  async getTicketMessages(ticketId) {
    if (!isSupabaseConfigured) return [];
    const { data } = await supabase.from('support_messages')
      .select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    return data || [];
  },

  async postTicketMessage(ticketId, sender, body) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const { error } = await supabase.from('support_messages')
      .insert({ ticket_id: ticketId, sender, body });
    if (error) throw new Error(error.message);
    await supabase.from('support_tickets')
      .update({ updated_at: new Date().toISOString(), status: sender === 'admin' ? 'pending' : 'open' })
      .eq('id', ticketId);
    return true;
  },

  async setTicketStatus(ticketId, status) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const { error } = await supabase.from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId);
    if (error) throw new Error(error.message);
    return true;
  },

  // Gemini support chatbot — calls an edge function that holds GEMINI_API_KEY.
  async askSupportBot(messages) {
    if (!isSupabaseConfigured) throw new Error('Not available');
    const { data, error } = await supabase.functions.invoke('support-chat', { body: { messages } });
    if (error) throw new Error(error.message || 'Chat failed');
    return data?.reply || "Sorry, I couldn't process that. Please raise a ticket and our team will help.";
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

  // ── Reset Test Data ──────────────────────────────────────────────────────
  // Wipes all bills/orders, credit ledger entries, stock orders, and resets
  // the invoice counter back to 0 for a shop. Used when a shop has been
  // testing the system and wants to go live with a clean slate.
  // Does NOT touch: products, customers, settings, logo, QR, staff accounts.
  async resetShopTestData(shopId) {
    if (!shopId) throw new Error('Shop ID required');

    if (isSupabaseConfigured) {
      const results = { orders: 0, credits: 0, stockOrders: 0 };

      const { data: deletedOrders, error: ordersErr } = await supabase
        .from('orders').delete().eq('shop_id', shopId).select('id');
      if (ordersErr) throw new Error('Failed to delete orders: ' + ordersErr.message);
      results.orders = deletedOrders?.length || 0;

      const { data: deletedCredits, error: creditsErr } = await supabase
        .from('credits').delete().eq('to_shop_id', shopId).select('id');
      if (!creditsErr) results.credits = deletedCredits?.length || 0;

      const { data: deletedStock, error: stockErr } = await supabase
        .from('stock_orders').delete().eq('shop_id', shopId).select('id');
      if (!stockErr) results.stockOrders = deletedStock?.length || 0;

      // Reset invoice counter back to 0 so the next bill starts at -0001 again
      await this.saveSiteConfig(`invCounter_${shopId}`, 0);

      // Clear loyalty point balances tied to this shop (key pattern: loyalty_{shopId}_{phone})
      const { data: loyaltyRows } = await supabase
        .from('site_config').select('key').like('key', `loyalty_${shopId}_%`);
      if (loyaltyRows?.length) {
        await supabase.from('site_config').delete().in('key', loyaltyRows.map(r => r.key));
        results.loyaltyKeys = loyaltyRows.length;
      }

      return results;
    }

    // Local/offline fallback
    const db = getDB();
    const before = db.orders.length;
    db.orders = db.orders.filter(o => o.shopId !== shopId);
    const removedOrders = before - db.orders.length;
    const beforeCredits = db.credits.length;
    db.credits = db.credits.filter(c => c.toShopId !== shopId);
    const removedCredits = beforeCredits - db.credits.length;
    if (db.stockOrders) {
      const beforeStock = db.stockOrders.length;
      db.stockOrders = db.stockOrders.filter(o => o.shopId !== shopId);
      var removedStock = beforeStock - db.stockOrders.length;
    }
    if (db.siteConfig) {
      db.siteConfig[`invCounter_${shopId}`] = 0;
      Object.keys(db.siteConfig).forEach(k => {
        if (k.startsWith(`loyalty_${shopId}_`)) delete db.siteConfig[k];
      });
    }
    saveDB(db);
    return { orders: removedOrders, credits: removedCredits, stockOrders: removedStock || 0 };
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
    const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
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

  // ─── Referral / Affiliate system ─────────────────────────────────────────

  _genCode(name) {
    const base = (name || 'REF').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) || 'REF';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${base}${rand}`;
  },

  async getOrCreateReferralCode(userId, userName) {
    if (!isSupabaseConfigured) return { code: 'DEMO01', id: 'demo', commissionPct: 20 };
    // Check if code already exists
    const { data: existing } = await supabase
      .from('referral_codes').select('*').eq('owner_id', userId).maybeSingle();
    if (existing) return { id: existing.id, code: existing.code, commissionPct: existing.commission_pct };
    // Create new code
    const code = this._genCode(userName);
    const { data: created, error } = await supabase
      .from('referral_codes')
      .insert({ code, owner_id: userId, is_active: true, commission_pct: 20 })
      .select().maybeSingle();
    if (error) throw new Error(error.message);
    return { id: created.id, code: created.code, commissionPct: created.commission_pct };
  },

  async getReferralStats(userId) {
    if (!isSupabaseConfigured) return { totalReferred: 0, pendingAmount: 0, approvedAmount: 0, referrals: [] };
    const { data: refs } = await supabase
      .from('referral_attributions').select('*, referred:referred_id(name,phone,subscription_tier,created_at)')
      .eq('referrer_id', userId).order('created_at', { ascending: false });
    const list = refs || [];
    return {
      totalReferred: list.length,
      pendingAmount: list.filter(r => r.status === 'pending').reduce((s, r) => s + (r.commission_amount || 0), 0),
      approvedAmount: list.filter(r => r.status === 'approved' || r.status === 'paid').reduce((s, r) => s + (r.commission_amount || 0), 0),
      referrals: list.map(r => ({ id: r.id, code: r.code, name: r.referred?.name || 'Unknown', phone: r.referred?.phone, tier: r.referred?.subscription_tier, amount: r.commission_amount || 0, status: r.status, date: r.created_at })),
    };
  },

  async attributeReferral(code, referredUserId) {
    if (!isSupabaseConfigured || !code || !referredUserId) return null;
    const { data: codeRow } = await supabase
      .from('referral_codes').select('*').eq('code', code.toUpperCase()).eq('is_active', true).maybeSingle();
    if (!codeRow) return null;
    // Don't self-attribute
    if (codeRow.owner_id === referredUserId) return null;
    const { data: inserted } = await supabase.from('referral_attributions').insert({
      code_id: codeRow.id, code: code.toUpperCase(),
      referrer_id: codeRow.owner_id, referred_id: referredUserId,
      commission_amount: 0, status: 'pending',
    }).select().maybeSingle();
    return inserted;
  },

  async getAllReferralCodes() {
    if (!isSupabaseConfigured) return [];
    const { data } = await supabase
      .from('referral_codes').select('*, owner:owner_id(name,phone,role)')
      .order('created_at', { ascending: false });
    return (data || []).map(r => ({ id: r.id, code: r.code, ownerName: r.owner?.name, ownerPhone: r.owner?.phone, ownerRole: r.owner?.role, commissionPct: r.commission_pct, isActive: r.is_active, createdAt: r.created_at }));
  },

  async getAllReferralAttributions() {
    if (!isSupabaseConfigured) return [];
    const { data } = await supabase
      .from('referral_attributions')
      .select('*, referrer:referrer_id(name,phone), referred:referred_id(name,phone,subscription_tier,created_at)')
      .order('created_at', { ascending: false });
    return (data || []).map(r => ({ id: r.id, code: r.code, referrerName: r.referrer?.name, referrerPhone: r.referrer?.phone, referredName: r.referred?.name, referredPhone: r.referred?.phone, tier: r.referred?.subscription_tier, amount: r.commission_amount || 0, status: r.status, date: r.created_at }));
  },

  async approveReferralCommission(attributionId, amount) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('referral_attributions')
      .update({ status: 'approved', commission_amount: amount }).eq('id', attributionId);
    if (error) throw new Error(error.message);
    return true;
  },

  async createAffiliateUser(phone, name) {
    if (!isSupabaseConfigured) return null;
    // pass is NOT NULL in the schema. Affiliates are created by an admin and
    // are told to set their own password via "Forgot Password" (or admin
    // resets it from User Directory), so seed a default placeholder here.
    const { data, error } = await supabase.from('users').insert({
      phone, name, role: 'affiliate', status: 'active', pass: 'changeme',
      subscription: 'active', subscription_tier: 'enterprise',
      trial_started_at: new Date().toISOString(),
    }).select().maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async toggleReferralCode(codeId, isActive) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('referral_codes').update({ is_active: isActive }).eq('id', codeId);
    if (error) throw new Error(error.message);
    return true;
  },
};
