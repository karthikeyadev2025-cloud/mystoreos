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
  homeServiceAddonExpiresAt: row.home_service_addon_expires_at || null,
  hideFromSearch: row.hide_from_search || false,
  shopCategory: row.shop_category || 'general',
  businessKind: row.business_kind || null,   // 'retail' | 'service' — routes shop to POS-first or Bookings-first dashboard
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
  customerPhone: row.customer_phone || null,
  // Sequential per-shop invoice number, stamped at insert time via the
  // next_invoice_no() Postgres function. Null for orders placed before
  // the migration ran (we fall back to the UUID slice for those).
  invoiceNo: row.invoice_no || null,
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
      // Use direct fetch instead of supabase.functions.invoke
      // Reason: supabase.functions.invoke sends the anon key as Bearer token
      // which Supabase now rejects with UNAUTHORIZED_LEGACY_JWT on Edge Functions.
      // Direct fetch with just apikey header works correctly.
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const callOnce = async (ms) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': ANON_KEY,
              'Authorization': `Bearer ${ANON_KEY}`,
            },
            body: JSON.stringify({ phone, password: pass }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const data = await res.json();
          return { data, error: null };
        } catch (e) {
          clearTimeout(timeoutId);
          if (e.name === 'AbortError') throw new Error('edge_timeout');
          throw e;
        }
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

      if (data?.session) {
        await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        // CRITICAL: verify the session is actually persisted (Android WebView quirk)
        // Without this verify-loop, queries fire before localStorage commits the JWT
        // -> auth.uid() returns null -> RLS blocks all data -> "no data" on Android
        let verifyAttempts = 0;
        while (verifyAttempts < 5) {
          const { data: { session: live } } = await supabase.auth.getSession();
          if (live?.access_token) break;
          await new Promise(r => setTimeout(r, 100));
          verifyAttempts++;
        }
      }
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

  // Change password from inside the app (user is already logged in).
  //
  // BUG FIX: auth-login verifies against the bcrypt `pass` column in
  // public.users — but the old version of this function only updated
  // Supabase Auth's password (supabase.auth.updateUser) and the unused
  // `pass_verify` column. The bcrypt `pass` column was never touched, so
  // after "changing" password, the next login via auth-login still
  // required the OLD password. Now routes through the auth-reset-password
  // edge function which correctly updates both the bcrypt `pass` column
  // AND the Supabase Auth password in one atomic call.
  async changePassword(newPassword) {
    if (!newPassword || newPassword.length < 4) throw new Error('Password must be at least 4 characters.');
    if (isSupabaseConfigured) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not logged in. Please sign in again.');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ userId: authUser.id, newPassword }),
        }
      );
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || 'Could not update password.');

      // NOTE: the edge function above already updates Supabase Auth's
      // password server-side via admin.auth.admin.updateUserById() using
      // the service role key — that's the reliable path with full admin
      // privileges. An earlier version of this function ALSO called
      // supabase.auth.updateUser() client-side as a redundant "just in
      // case" — but that uses the CURRENT session's own (sometimes
      // weaker-privileged or already-stale) auth context, which could
      // 403 depending on account type/session state. It was wrapped in
      // .catch(() => {}) so it never broke anything functionally, but
      // failed network requests still show up in the browser console
      // regardless of try/catch — alarming-looking noise for something
      // that was already redundant. Removed; the edge function is
      // sufficient and is the actual source of truth here.
      return true;
    }
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
      // Was fire-and-forget with no error check. This is the admin
      // 'Approve' button for a brand-new shop/distributor signup — if
      // the update silently failed (RLS, network), the admin's UI would
      // still remove the row from Pending Approvals (see AdminDashboard
      // approvePending/approveAll) as if it succeeded, while the account
      // stayed status='pending' in the database and could never log in.
      // No way for the admin to know without manually re-checking.
      const { data, error } = await supabase.from('users').update({ status: 'active' }).eq('id', userId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('User not found or could not be approved.');
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
      const { data: users } = await supabase.from('users').select('role, subscription, subscription_tier, plan_expires_at, distributor_plan_tier, distributor_plan_expires_at, created_at, status');
      const { data: orders } = await supabase.from('orders').select('total, created_at');
      const { data: credits } = await supabase.from('credits').select('amount, paid');
      const allUsers = users || [];
      const shops = allUsers.filter(u => u.role === 'shop');
      const paidShopRows = shops.filter(isPaidShop);
      const paidShops = paidShopRows.length;
      const shopMRR = paidShopRows.reduce((sum, s) => sum + (SHOP_PRICES[s.subscription_tier] || 0), 0);
      const distributors = allUsers.filter(u => u.role === 'distributor');
      const distMRR = distributors.reduce((sum, d) => sum + (isPaidDist(d) ? (DIST_PRICES[d.distributor_plan_tier] || 0) : 0), 0);
      const activeCredit = (credits || []).filter(c => !c.paid).reduce((a, b) => a + Number(b.amount), 0);

      // Deltas — compare last 30 days vs the 30 days before that. Enterprise
      // dashboards live on trend signals, not just current totals. Feeds
      // the % chips on each KPI card and the "System Health" widget.
      const now = Date.now();
      const D30 = now - 30 * 24 * 3600 * 1000;
      const D60 = now - 60 * 24 * 3600 * 1000;
      const shopsLast30    = shops.filter(u => u.created_at && new Date(u.created_at).getTime() >= D30).length;
      const shopsPrev30    = shops.filter(u => u.created_at && new Date(u.created_at).getTime() < D30 && new Date(u.created_at).getTime() >= D60).length;
      const custLast30     = allUsers.filter(u => u.role === 'customer' && u.created_at && new Date(u.created_at).getTime() >= D30).length;
      const custPrev30     = allUsers.filter(u => u.role === 'customer' && u.created_at && new Date(u.created_at).getTime() < D30 && new Date(u.created_at).getTime() >= D60).length;
      const ordersLast30   = (orders || []).filter(o => o.created_at && new Date(o.created_at).getTime() >= D30).length;
      const ordersPrev30   = (orders || []).filter(o => o.created_at && new Date(o.created_at).getTime() < D30 && new Date(o.created_at).getTime() >= D60).length;
      const gmvLast30      = (orders || []).filter(o => o.created_at && new Date(o.created_at).getTime() >= D30).reduce((a, b) => a + Number(b.total || 0), 0);
      const gmvPrev30      = (orders || []).filter(o => o.created_at && new Date(o.created_at).getTime() < D30 && new Date(o.created_at).getTime() >= D60).reduce((a, b) => a + Number(b.total || 0), 0);
      // Percentage change helper: prev=0 becomes "new" (Infinity) so UI
      // can render "NEW" instead of NaN. Guarded so no runtime errors.
      const pct = (curr, prev) => prev === 0 ? (curr > 0 ? Infinity : 0) : Math.round(((curr - prev) / prev) * 100);
      const pendingApprovals = allUsers.filter(u => u.status === 'pending' && (u.role === 'shop' || u.role === 'distributor')).length;

      return {
        totalUsers: allUsers.filter(u => u.role === 'customer').length,
        totalShops: shops.length,
        totalDistributors: distributors.length,
        totalOrders: (orders || []).length,
        activeCredit,
        paidShops,
        shopMRR,
        distMRR,
        revenue: `₹${shopMRR + distMRR}`,
        // trend signals
        shopsLast30, shopsPrev30, shopsDeltaPct: pct(shopsLast30, shopsPrev30),
        custLast30, custPrev30, custDeltaPct: pct(custLast30, custPrev30),
        ordersLast30, ordersPrev30, ordersDeltaPct: pct(ordersLast30, ordersPrev30),
        gmvLast30, gmvPrev30, gmvDeltaPct: pct(gmvLast30, gmvPrev30),
        pendingApprovals,
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
      // Must pass the user's JWT so the edge function can verify who's calling.
      // supabase.functions.invoke sends anon key by default; we override with
      // the current session token so the edge function can call auth.getUser().
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token;
      const { data, error } = await supabase.functions.invoke('add-staff', {
        body: { shopId, phone, name, pin: pass || '1234' },
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
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

  async deleteStaff(staffId) {
    if (isSupabaseConfigured) {
      // Use the remove-staff edge function which runs with service role key
      // to bypass RLS (shop owners don't have DELETE policy on users table).
      // The function verifies the caller owns the staff member before deleting.
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token;
      const { data, error } = await supabase.functions.invoke('remove-staff', {
        body: { staffId },
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return true;
    }
    const db = getDB();
    db.users = db.users.filter(u => u.id !== staffId);
    saveDB(db);
    return true;
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

  async placeOrder(userId, shopId, items, total, customerData = {}, status = 'Pending', paymentMethod = 'Cash', invoiceNoInt = null) {
    // Hard guard at the API boundary. Lets us throw a clear human error
    // instead of letting a stale frontend reach Postgres and get back the
    // cryptic 'null value in column "user_id" of relation "orders"
    // violates not-null constraint'. Empty-string check catches the
    // case where a JSON-stringified-undefined snuck through somewhere.
    if (!userId || (typeof userId === 'string' && userId.trim() === '')) {
      throw new Error('Could not identify the buyer. Please sign in or sign up before placing this order.');
    }
    if (!shopId || (typeof shopId === 'string' && shopId.trim() === '')) {
      throw new Error('Could not identify the shop. Please refresh the page and try again.');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Your cart is empty. Add at least one item before placing the order.');
    }
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

      // Use the invoice number the caller already allocated (shop side
      // calls api.getNextInvoiceNumber before rendering the PDF, then
      // passes the int here so the persisted order matches the printed
      // PDF). For customer-side checkouts, no pre-allocation — we call
      // the RPC here. RPC missing → leave null (legacy behavior).
      let invoiceNo = invoiceNoInt;
      if (!invoiceNo) {
        try {
          const { data: invData, error: invErr } = await supabase.rpc('next_invoice_no', { p_shop_id: resolvedId });
          if (!invErr && typeof invData === 'number') invoiceNo = invData;
        } catch (_e) { /* function not available — leave null */ }
      }

      // Look up whether this phone belongs to a real customer account —
      // if so, tag the order with their UUID. Purely additive: user_id
      // keeps its existing 'walk-in:Name:Phone' format unchanged (every
      // WhatsApp message and decodeOrderUserId() call built on that
      // format keeps working exactly as before). customer_id is what
      // makes the order actually reach that customer's portal live via
      // realtime, and readable at all via RLS — see
      // 20260713_orders_customer_id.sql for why the phone-only fallback
      // never actually worked without this.
      let matchedCustomerId = null;
      if (normalizedPhone) {
        try {
          const { data: custRow } = await supabase.from('users')
            .select('id').eq('phone', normalizedPhone).eq('role', 'customer').maybeSingle();
          if (custRow?.id) matchedCustomerId = custRow.id;
        } catch (_e) { /* best-effort — a bill should never fail over this lookup */ }
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
        customer_id: matchedCustomerId,
        payment_method: paymentMethod || 'Cash',
        invoice_no: invoiceNo,
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
      // Was previously a fire-and-forget update with no error check and
      // no verification a row actually changed — RLS silently blocking
      // the write (e.g. the owns_shop() staff regression) meant the
      // caller's success toast fired regardless of whether anything
      // actually happened. .select() + explicit checks make a blocked
      // write throw instead of lying.
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'Accepted', accepted_at: new Date().toISOString() })
        .eq('id', orderId)
        .select('id')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Order not found or you do not have permission to accept it.');
      return;
    }
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (order) order.status = 'Accepted';
    saveDB(db);
  },

  async verifyOrderPayment(orderId, message = '') {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('orders').update({
        status: 'Completed',
        payment_verified: true,
        shop_message: message || 'Payment verified by shopkeeper. Thank you!'
      }).eq('id', orderId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Order not found or you do not have permission to update it.');
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
      const { data, error } = await supabase.from('orders').update({
        status: 'Cancelled',
        shop_message: message,
      }).eq('id', orderId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Order not found or you do not have permission to cancel it.');
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

      // Was fire-and-forget with no error check on the core return/refund
      // write. The caller (ShopDashboard) already has a real try/catch
      // specifically to surface a genuine failure as an error toast
      // instead of a false 'Return processed!' — but nothing here ever
      // threw, so that catch block could never actually fire.
      const { data: updatedOrder, error: retErr } = await supabase.from('orders').update({
        status: isFullReturn ? 'Returned' : 'Accepted', // partial return keeps the bill active, just flags the refund
        returned_at: new Date().toISOString(),
        refund_amount: priorRefund + refundAmount,
        refund_mode: refundMode,
        returned_items: returnItems,
      }).eq('id', orderId).select('id').maybeSingle();
      if (retErr) throw new Error(retErr.message);
      if (!updatedOrder) throw new Error('Order not found or you do not have permission to process this return.');

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
      // Was fire-and-forget with no error check. Both callers (shop
      // logging a customer's khata debt, distributor logging a shop's
      // stock-supply credit) already correctly wrap this in mustSucceed()
      // expecting a throw on failure — this is the core daily-use credit
      // feature for every retail shop, worth getting right.
      const { data, error } = await supabase.from('credits').insert({ from_id: fromId, to_shop_id: toShopId, description: desc, amount: parseFloat(amount) }).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to save credit entry.');
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
      // Was fire-and-forget with no error check. All three callers of
      // this (shop settling a customer's khata debt, shop settling their
      // own supplier credit, distributor marking a shop's payment
      // received) already correctly wrap this in mustSucceed() expecting
      // a throw on failure — but nothing here ever threw, so a blocked
      // update (RLS, wrong id) would silently no-op while the UI showed
      // 'Payment settled!'. Real money-tracking data, needs to be honest.
      const { data, error } = await supabase.from('credits').update({ paid: true }).eq('id', creditId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Credit entry not found or you do not have permission to update it.');
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
    //
    // Works for both main-shop login (user.id = main shop UUID) AND
    // branch login (user.id = branch UUID, user.parentShopId = main UUID).
    // For a branch login, we resolve the root first so we can return the
    // full family (main + all siblings), not just the branch itself.
    if (!ownerId) return [];
    if (isSupabaseConfigured) {
      try {
        // Resolve the root owner: if ownerId is itself a branch, look up
        // its parent_shop_id and use that as the root. The self-lookup may
        // fail with 400 if RLS blocks it (e.g. customer session) — that's
        // fine, fall through to using ownerId directly as the root.
        let rootId = ownerId;
        try {
          const { data: self, error: selfErr } = await supabase.from('users')
            .select('id, parent_shop_id').eq('id', ownerId).maybeSingle();
          if (!selfErr && self?.parent_shop_id) rootId = self.parent_shop_id;
        } catch { /* RLS blocked — use ownerId as root */ }

        const { data, error } = await supabase.from('users')
          .select('*')
          .or(`id.eq.${rootId},parent_shop_id.eq.${rootId}`)
          .eq('role', 'shop')
          .order('parent_shop_id', { ascending: true, nullsFirst: true })  // main shop (NULL parent) first
          .order('created_at', { ascending: true });
        if (error) {
          // 400 = RLS blocked (e.g. customer session, no rights to read users table).
          // Just return the single shop record via getShopById which uses a
          // more permissive public read path.
          if (error.code === 'PGRST301' || error.message?.includes('400') || /permission|policy|rls/i.test(error.message || '')) {
            const { data: own } = await supabase.from('users').select('*').eq('id', rootId).maybeSingle();
            return own ? [toUser(own)] : [];
          }
          // Column doesn't exist yet (migration not run)
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

  async createBranch({ ownerId, name, phone, password, address = '', gstin = '', stateCode = '' }) {
    if (!ownerId) throw new Error('Owner ID required');
    if (!name || !name.trim()) throw new Error('Branch name is required');
    if (!phone || !/^\d{10}$/.test(String(phone).replace(/\D/g, '').slice(-10))) {
      throw new Error('Enter a valid 10-digit branch phone');
    }
    if (!password || password.length < 4) {
      throw new Error('Set a branch password (min 4 characters) — your branch staff will use it to log in');
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

      // Check that this phone isn't already taken (branches use phone +
      // password to log in via auth-login, just like the main shop).
      const { data: existing } = await supabase.from('users').select('id').eq('phone', normalizedPhone).maybeSingle();
      if (existing) throw new Error('This phone is already in use. Pick a different number for the branch.');

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
        // Password stored as plaintext here — auth-login will bcrypt-
        // upgrade it on first login (same pattern as adminResetPassword).
        // pass_verify keeps the plaintext so the owner can see/share the
        // branch credentials with their branch staff later.
        pass: password,
        pass_verify: password,
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
      pass: password,
    };
    db.users.push(branch);
    saveDB(db);
    return branch;
  },

  async setBranchPassword(branchId, ownerId, newPassword) {
    // Owner can reset the password on any of their branches at any time —
    // useful when a branch employee leaves, or when the owner wants to
    // rotate credentials. auth-login will bcrypt-upgrade on the branch's
    // next sign-in, same self-heal pattern as adminResetPassword.
    if (!branchId || !ownerId) throw new Error('IDs required');
    if (!newPassword || newPassword.length < 4) throw new Error('Password must be at least 4 characters');
    if (branchId === ownerId) throw new Error('Use your normal account settings to change your own password.');
    if (isSupabaseConfigured) {
      // Verify the row is a branch of this owner before resetting.
      const { data: target } = await supabase.from('users')
        .select('id, parent_shop_id').eq('id', branchId).maybeSingle();
      if (!target) throw new Error('Branch not found');
      if (target.parent_shop_id !== ownerId) throw new Error("You don't own this branch");
      const { error } = await supabase.from('users')
        .update({ pass: newPassword, pass_verify: newPassword })
        .eq('id', branchId);
      if (error) throw new Error(error.message);
      // Also clear the cached Supabase Auth password so the next
      // auth-login call picks up the new password (auth-login's
      // updateUserById path handles the resync). No client-side work
      // needed beyond returning success.
      return true;
    }
    const db = getDB();
    const idx = db.users.findIndex(u => u.id === branchId);
    if (idx === -1) throw new Error('Branch not found');
    if (db.users[idx].parentShopId !== ownerId) throw new Error("You don't own this branch");
    db.users[idx].pass = newPassword;
    saveDB(db);
    return true;
  },

  async importProductsFromShop(sourceShopId, targetShopId, options = {}) {
    // Copy every product from sourceShopId into targetShopId. Used to
    // bulk-seed a new branch with the main shop's catalogue so the owner
    // doesn't re-enter 100+ products by hand. Each copied product gets:
    //   • A fresh id (new UUID) — independent row, no shared row with main
    //   • shop_id = targetShopId so all the existing shop-scoped queries
    //     (sales, inventory, restock) pick it up correctly
    //   • All product attributes copied verbatim (name, price, barcode,
    //     batch, expiry, variants, GST/HSN, cost price, images, category)
    //   • Stock — either set to a default (usually 0; branch counts
    //     opening inventory at their own pace) or copied from source if
    //     options.copyStock is true
    //
    // Verification: the caller must own (or be) BOTH shops. Branches and
    // main share a parent_shop_id chain — that's the legitimate family.
    // Without this check, anyone with a shop id could clone any other
    // shop's catalogue. Defense in depth — RLS should also enforce.
    if (!sourceShopId || !targetShopId) throw new Error('Source and target shop IDs required');
    if (sourceShopId === targetShopId) throw new Error('Cannot import a shop into itself');

    if (isSupabaseConfigured) {
      // Family check: the two shops must share a parent or be parent/child.
      const { data: shops } = await supabase.from('users')
        .select('id, parent_shop_id').in('id', [sourceShopId, targetShopId]);
      if (!shops || shops.length !== 2) throw new Error('Could not verify shop ownership');
      const src = shops.find(s => s.id === sourceShopId);
      const tgt = shops.find(s => s.id === targetShopId);
      const srcRoot = src.parent_shop_id || src.id;
      const tgtRoot = tgt.parent_shop_id || tgt.id;
      if (srcRoot !== tgtRoot) throw new Error('Both shops must belong to the same brand');

      // Fetch all source products
      const { data: sourceProducts, error: fetchErr } = await supabase.from('products')
        .select('*').eq('shop_id', sourceShopId);
      if (fetchErr) throw new Error(fetchErr.message);
      if (!sourceProducts || sourceProducts.length === 0) {
        return { imported: 0, skipped: 0, products: [] };
      }

      // Optional: skip products already in target (matched by barcode if
      // present, else by name). Avoids duplicates when the owner imports
      // a second time after adding new products to main.
      const { data: existingTarget } = await supabase.from('products')
        .select('name, barcode').eq('shop_id', targetShopId);
      const existingBarcodes = new Set((existingTarget || []).map(p => p.barcode).filter(Boolean));
      const existingNames = new Set((existingTarget || []).map(p => (p.name || '').toLowerCase()));

      const rowsToInsert = [];
      let skipped = 0;
      for (const p of sourceProducts) {
        if (p.barcode && existingBarcodes.has(p.barcode)) { skipped++; continue; }
        if (!p.barcode && existingNames.has((p.name || '').toLowerCase())) { skipped++; continue; }
        // Copy all attributes except id (new) and shop_id (re-targeted).
        // created_at/updated_at let Supabase auto-set. Stock either 0
        // (default) or source's stock (copyStock option).
        const newRow = { ...p };
        delete newRow.id;
        delete newRow.created_at;
        delete newRow.updated_at;
        newRow.shop_id = targetShopId;
        newRow.stock = options.copyStock ? (p.stock || 0) : 0;
        rowsToInsert.push(newRow);
      }

      if (rowsToInsert.length === 0) {
        return { imported: 0, skipped, products: [] };
      }

      // Insert in batches of 100 so we don't trip request-size limits.
      // Self-heal around any optional column that may not exist in the
      // products table yet (images, is_featured, discount_pct, etc.) —
      // drop and retry, same pattern as addProduct.
      const inserted = [];
      const BATCH_SIZE = 100;
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        let batch = rowsToInsert.slice(i, i + BATCH_SIZE);
        for (let tries = 0; tries < 6; tries++) {
          const { data, error } = await supabase.from('products').insert(batch).select();
          if (!error) {
            inserted.push(...(data || []).map(toProduct));
            break;
          }
          const msg = error.message || '';
          const miss = msg.match(/find the ['"]?(\w+)['"]? column/i)
            || msg.match(/column (?:[\w.]+\.)?["']?(\w+)["']? does not exist/i);
          if (!miss) throw new Error(error.message);
          // Strip the missing column from EVERY row in the batch and retry.
          batch = batch.map(r => { const c = { ...r }; delete c[miss[1]]; return c; });
        }
      }
      return { imported: inserted.length, skipped, products: inserted };
    }
    // Local (mockDB) fallback
    const db = getDB();
    db.products = db.products || [];
    const sources = db.products.filter(p => p.shopId === sourceShopId);
    const existingTarget = db.products.filter(p => p.shopId === targetShopId);
    const existingBarcodes = new Set(existingTarget.map(p => p.barcode).filter(Boolean));
    const existingNames = new Set(existingTarget.map(p => (p.name || '').toLowerCase()));
    let imported = 0, skipped = 0;
    const newProducts = [];
    for (const p of sources) {
      if (p.barcode && existingBarcodes.has(p.barcode)) { skipped++; continue; }
      if (!p.barcode && existingNames.has((p.name || '').toLowerCase())) { skipped++; continue; }
      const copy = { ...p, id: crypto.randomUUID(), shopId: targetShopId, stock: options.copyStock ? p.stock : 0 };
      db.products.push(copy);
      newProducts.push(copy);
      imported++;
    }
    saveDB(db);
    return { imported, skipped, products: newProducts };
  },

  async copySingleProductToBranch(productId, targetShopId, ownerId) {
    // Copy one specific product from wherever it lives (main or any branch)
    // into targetShopId. Ownership-checked: both the product's source shop
    // and the target must belong to the same brand (same parent root) as
    // the caller. Stock is reset to 0 on the copy — the branch sets its
    // own opening stock. If the product already exists in targetShopId
    // (matched by barcode if present, else name), returns { skipped: true }
    // instead of creating a duplicate.
    if (!productId || !targetShopId || !ownerId) throw new Error('IDs required');
    if (isSupabaseConfigured) {
      // Fetch the product and its source shop
      const { data: product, error: pErr } = await supabase.from('products')
        .select('*').eq('id', productId).maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!product) throw new Error('Product not found');

      const sourceShopId = product.shop_id;
      if (sourceShopId === targetShopId) throw new Error('Product is already in this branch');

      // Ownership check: both shops must share a brand root
      const { data: shops } = await supabase.from('users')
        .select('id, parent_shop_id').in('id', [sourceShopId, targetShopId]);
      if (!shops || shops.length !== 2) throw new Error('Could not verify shop ownership');
      const src = shops.find(s => s.id === sourceShopId);
      const tgt = shops.find(s => s.id === targetShopId);
      const srcRoot = src.parent_shop_id || src.id;
      const tgtRoot = tgt.parent_shop_id || tgt.id;
      if (srcRoot !== tgtRoot) throw new Error('Both shops must belong to the same brand');
      if (srcRoot !== ownerId && sourceShopId !== ownerId && targetShopId !== ownerId) {
        throw new Error("You don't own these branches");
      }

      // Dedupe check — same logic as importProductsFromShop
      const { data: existing } = await supabase.from('products')
        .select('id, name, barcode').eq('shop_id', targetShopId);
      const existingBarcodes = new Set((existing || []).map(p => p.barcode).filter(Boolean));
      const existingNames = new Set((existing || []).map(p => (p.name || '').toLowerCase()));
      if (product.barcode && existingBarcodes.has(product.barcode)) return { skipped: true, reason: 'barcode' };
      if (!product.barcode && existingNames.has((product.name || '').toLowerCase())) return { skipped: true, reason: 'name' };

      const newRow = { ...product };
      delete newRow.id;
      delete newRow.created_at;
      delete newRow.updated_at;
      newRow.shop_id = targetShopId;
      newRow.stock = 0; // branch sets its own opening stock

      let attempt = { ...newRow };
      let data = null, error = null;
      for (let tries = 0; tries < 6; tries++) {
        ({ data, error } = await supabase.from('products').insert(attempt).select().maybeSingle());
        if (!error) break;
        const msg = error.message || '';
        const miss = msg.match(/find the ['"]?(\w+)['"]? column/i)
          || msg.match(/column (?:[\w.]+\.)?["']?(\w+)["']? does not exist/i);
        if (!miss || !(miss[1] in attempt)) break;
        const c = { ...attempt }; delete c[miss[1]]; attempt = c;
      }
      if (error) throw new Error(error.message);
      return { skipped: false, product: toProduct(data) };
    }
    // Local fallback
    const db = getDB();
    db.products = db.products || [];
    const product = db.products.find(p => p.id === productId);
    if (!product) throw new Error('Product not found');
    if (product.shopId === targetShopId) throw new Error('Product is already in this branch');
    const existingNames = new Set(db.products.filter(p => p.shopId === targetShopId).map(p => (p.name||'').toLowerCase()));
    if (existingNames.has((product.name||'').toLowerCase())) return { skipped: true, reason: 'name' };
    const copy = { ...product, id: crypto.randomUUID(), shopId: targetShopId, stock: 0 };
    db.products.push(copy);
    saveDB(db);
    return { skipped: false, product: copy };
  },

  async createStockTransfer({ fromShopId, toShopId, items, ownerId, note = '' }) {
    // Move inventory between two branches of the same brand. Books the
    // movement in stock_transfers (audit trail for tax/audit) AND
    // updates the actual stock counts on both sides. Atomicity caveat:
    // Supabase JS doesn't expose transactions, so we do best-effort
    // sequential updates and record any partial failures on the
    // transfer row's status. For low-frequency manual transfers this
    // is acceptable; high-frequency systems would push this into a
    // Postgres function.
    //
    // Items shape: [{ productId, qty, productName? }, ...]
    //   productId = source's product row id
    //   qty = positive integer
    //   productName = optional, used for denormalized display only
    //
    // Behavior per item:
    //   1. Decrement source.stock by qty (fail if would go negative)
    //   2. Try to find matching product on target by barcode (preferred)
    //      else by case-insensitive name match. If found → increment
    //      its stock by qty. If not found → create new product on
    //      target copying source's attributes, with stock = qty.
    if (!fromShopId || !toShopId) throw new Error('Source and destination branch required');
    if (fromShopId === toShopId) throw new Error('Source and destination must be different branches');
    if (!Array.isArray(items) || items.length === 0) throw new Error('Pick at least one product to transfer');
    if (!ownerId) throw new Error('Owner ID required');

    if (isSupabaseConfigured) {
      // ── Atomic path via Postgres function ─────────────────────────────
      // transfer_stock() runs entirely inside one transaction: all stock
      // moves and the voucher insert either all succeed or all roll back.
      // Falls back to the sequential JS path only if the migration hasn't
      // been deployed yet (function-not-found error).
      try {
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('transfer_stock', {
          p_from_shop_id: fromShopId,
          p_to_shop_id: toShopId,
          p_owner_id: ownerId,
          p_note: note || null,
          p_items: items.map(it => ({
            productId: it.productId,
            qty: it.qty,
            productName: it.productName || null,
          })),
        });
        if (rpcErr) {
          // If the function doesn't exist yet, fall through to the JS path
          if (/function .* does not exist/i.test(rpcErr.message || '')) {
            console.warn('transfer_stock RPC not found — falling back to sequential JS transfer');
          } else {
            throw new Error(rpcErr.message);
          }
        } else {
          return {
            id: rpcResult.id,
            status: rpcResult.status,
            failures: rpcResult.failures || [],
          };
        }
      } catch (rpcCallErr) {
        if (!/function .* does not exist/i.test(rpcCallErr?.message || '')) throw rpcCallErr;
        console.warn('transfer_stock RPC not found — falling back to sequential JS transfer');
      }

      // ── Sequential JS fallback (pre-migration environments) ───────────
      // Family ownership check — both shops must share a brand root
      // (one is parent of the other, or they're siblings) AND the
      // caller must own that brand. Stops anyone from moving stock
      // between random shops.
      const { data: shops } = await supabase.from('users')
        .select('id, parent_shop_id, role').in('id', [fromShopId, toShopId]);
      if (!shops || shops.length !== 2) throw new Error('Could not verify shop ownership');
      const src = shops.find(s => s.id === fromShopId);
      const tgt = shops.find(s => s.id === toShopId);
      const srcRoot = src.parent_shop_id || src.id;
      const tgtRoot = tgt.parent_shop_id || tgt.id;
      if (srcRoot !== tgtRoot) throw new Error('Both branches must belong to the same brand');
      if (srcRoot !== ownerId && fromShopId !== ownerId && toShopId !== ownerId) {
        throw new Error("You don't own these branches");
      }

      // Load source products for the requested item IDs — validates
      // existence and gives us the current stock + all attributes for
      // copy-to-target if needed.
      const ids = items.map(i => i.productId);
      const { data: srcProducts, error: srcErr } = await supabase.from('products')
        .select('*').eq('shop_id', fromShopId).in('id', ids);
      if (srcErr) throw new Error(srcErr.message);
      if (!srcProducts || srcProducts.length !== ids.length) {
        throw new Error('Some products no longer exist on the source branch');
      }

      // Pre-flight stock validation — refuse to start if ANY item is
      // short. Better to fail loudly upfront than half-complete the
      // transfer.
      for (const it of items) {
        const sp = srcProducts.find(p => p.id === it.productId);
        const have = Number(sp?.stock || 0);
        const need = Math.max(1, parseInt(it.qty, 10) || 0);
        if (need <= 0) throw new Error(`Quantity must be > 0 for ${sp?.name || 'an item'}`);
        if (have < need) {
          throw new Error(`Not enough stock for ${sp?.name || 'item'} — source has ${have}, asking for ${need}`);
        }
      }

      // Pull target's existing products once for matching.
      const { data: tgtProducts } = await supabase.from('products')
        .select('id, name, barcode, stock').eq('shop_id', toShopId);
      const tgtByBarcode = new Map((tgtProducts || []).filter(p => p.barcode).map(p => [p.barcode, p]));
      const tgtByName = new Map((tgtProducts || []).map(p => [(p.name || '').toLowerCase(), p]));

      // Insert the transfer voucher first (status='in_progress') so
      // even partial failures leave an audit row. We'll update status
      // at the end.
      const denormItems = items.map(it => {
        const sp = srcProducts.find(p => p.id === it.productId);
        return {
          productId: it.productId,
          productName: sp?.name || it.productName || 'Unnamed product',
          barcode: sp?.barcode || null,
          qty: Math.max(1, parseInt(it.qty, 10) || 0),
        };
      });
      const { data: transferRow, error: insErr } = await supabase.from('stock_transfers').insert({
        from_shop_id: fromShopId,
        to_shop_id: toShopId,
        items: denormItems,
        created_by: ownerId,
        note: note || null,
        status: 'in_progress',
      }).select().maybeSingle();
      if (insErr) throw new Error(insErr.message);

      // Execute the per-item moves. Any failure → mark the transfer
      // 'partial' but don't roll back already-applied items (we don't
      // have transactions). The owner can read the failed items on
      // the voucher and reconcile.
      const failures = [];
      for (const it of denormItems) {
        const sp = srcProducts.find(p => p.id === it.productId);
        try {
          // 1. Decrement source
          const newSrcStock = Number(sp.stock || 0) - it.qty;
          const { error: decErr } = await supabase.from('products')
            .update({ stock: newSrcStock }).eq('id', sp.id);
          if (decErr) throw new Error(`source decrement failed: ${decErr.message}`);

          // 2. Find matching target product
          let match = (sp.barcode && tgtByBarcode.get(sp.barcode)) || tgtByName.get((sp.name || '').toLowerCase());
          if (match) {
            const newTgtStock = Number(match.stock || 0) + it.qty;
            const { error: incErr } = await supabase.from('products')
              .update({ stock: newTgtStock }).eq('id', match.id);
            if (incErr) throw new Error(`target increment failed: ${incErr.message}`);
          } else {
            // No match → create the product on the target by cloning
            // source's row with stock = qty. Same self-heal pattern
            // as importProductsFromShop for any optional columns.
            const newRow = { ...sp };
            delete newRow.id;
            delete newRow.created_at;
            delete newRow.updated_at;
            newRow.shop_id = toShopId;
            newRow.stock = it.qty;
            let attempt = { ...newRow };
            for (let tries = 0; tries < 6; tries++) {
              const { error: createErr } = await supabase.from('products').insert(attempt);
              if (!createErr) break;
              const msg = createErr.message || '';
              const miss = msg.match(/find the ['"]?(\w+)['"]? column/i)
                || msg.match(/column (?:[\w.]+\.)?["']?(\w+)["']? does not exist/i);
              if (!miss) throw new Error(`target create failed: ${createErr.message}`);
              const c = { ...attempt }; delete c[miss[1]]; attempt = c;
            }
          }
        } catch (err) {
          failures.push({ productId: it.productId, productName: it.productName, error: String(err?.message || err) });
        }
      }

      // Finalize transfer status based on outcome
      const finalStatus = failures.length === 0 ? 'completed' : (failures.length === denormItems.length ? 'failed' : 'partial');
      await supabase.from('stock_transfers')
        .update({ status: finalStatus, items: denormItems.map(it => ({ ...it, failed: failures.find(f => f.productId === it.productId)?.error || null })) })
        .eq('id', transferRow.id);

      return { id: transferRow.id, status: finalStatus, failures };
    }
    // Local (mockDB) fallback
    const db = getDB();
    db.stockTransfers = db.stockTransfers || [];
    db.products = db.products || [];
    for (const it of items) {
      const sp = db.products.find(p => p.id === it.productId && p.shopId === fromShopId);
      if (!sp || sp.stock < it.qty) throw new Error(`Not enough stock for ${sp?.name || 'item'}`);
      sp.stock -= it.qty;
      let match = db.products.find(p =>
        p.shopId === toShopId && ((sp.barcode && p.barcode === sp.barcode) || p.name?.toLowerCase() === sp.name?.toLowerCase())
      );
      if (match) match.stock += it.qty;
      else db.products.push({ ...sp, id: crypto.randomUUID(), shopId: toShopId, stock: it.qty });
    }
    const t = { id: crypto.randomUUID(), fromShopId, toShopId, items, createdBy: ownerId, note, status: 'completed', createdAt: new Date().toISOString() };
    db.stockTransfers.push(t);
    saveDB(db);
    return { id: t.id, status: 'completed', failures: [] };
  },

  async getStockTransfers(shopId, options = {}) {
    // Returns transfers involving this shop (either direction), most
    // recent first. Used by the "Recent transfers" list in the
    // BranchesManager so the owner has the audit trail at hand.
    const limit = Math.min(50, Math.max(1, options.limit || 20));
    if (!shopId) return [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('stock_transfers')
          .select('*')
          .or(`from_shop_id.eq.${shopId},to_shop_id.eq.${shopId}`)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) {
          // Table doesn't exist yet (migration not run)
          if (/relation .* does not exist/i.test(error.message || '')) return [];
          throw new Error(error.message);
        }
        // Resolve shop names so the voucher renders cleanly without an
        // extra round-trip per row in the UI.
        const ids = Array.from(new Set([...(data || []).map(r => r.from_shop_id), ...(data || []).map(r => r.to_shop_id)]));
        const { data: shops } = await supabase.from('users').select('id, name').in('id', ids);
        const nameById = new Map((shops || []).map(s => [s.id, s.name]));
        return (data || []).map(r => ({
          id: r.id,
          fromShopId: r.from_shop_id,
          toShopId: r.to_shop_id,
          fromShopName: nameById.get(r.from_shop_id) || 'Unknown',
          toShopName: nameById.get(r.to_shop_id) || 'Unknown',
          items: r.items || [],
          createdBy: r.created_by,
          note: r.note,
          status: r.status,
          createdAt: r.created_at,
        }));
      } catch (err) {
        console.error('getStockTransfers failed:', err);
        return [];
      }
    }
    const db = getDB();
    return (db.stockTransfers || [])
      .filter(t => t.fromShopId === shopId || t.toShopId === shopId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
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

  async getRelatedBranches(shopId) {
    // Customer-facing helper. Given any shop id (main OR branch), returns
    // all OTHER active shops in the same brand family — used by the
    // storefront to render an "Also visit our other locations" card.
    // Excludes the shop being viewed and any soft-deleted branches.
    //
    // Uses a direct DB query instead of getOwnedBranches to avoid the
    // double users-table read that triggers RLS 400s in customer sessions.
    if (!shopId) return [];
    if (isSupabaseConfigured) {
      try {
        // Step 1: get this shop's row to find its root
        const { data: self } = await supabase.from('users')
          .select('id, parent_shop_id, branch_deleted_at')
          .eq('id', shopId).maybeSingle();
        if (!self) return [];
        const rootId = self.parent_shop_id || self.id;

        // Step 2: get all shops in this family
        const { data, error } = await supabase.from('users')
          .select('id, name, phone, business_address, logo, parent_shop_id, branch_deleted_at, hide_from_search, latitude, longitude')
          .or(`id.eq.${rootId},parent_shop_id.eq.${rootId}`)
          .eq('role', 'shop');
        if (error) return []; // RLS blocked — no related branches to show
        return (data || [])
          .filter(r => r.id !== shopId && !r.branch_deleted_at)
          .map(toUser);
      } catch { return []; }
    }
    const db = getDB();
    const shop = db.users.find(u => u.id === shopId);
    if (!shop) return [];
    const rootId = shop.parentShopId || shop.id;
    return db.users
      .filter(u => u.role === 'shop' && u.id !== shopId && !u.branchDeletedAt &&
        (u.id === rootId || u.parentShopId === rootId))
      .map(u => ({ ...u }));
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

  // Customer marketplace listing — DEDUPES multi-branch brands so a brand
  // with 5 locations shows up as ONE card with a "5 locations" pill,
  // instead of five separate cards. Tapping the card lands on the main
  // shop's storefront which already has the "Also visit our other
  // locations" cross-link card (storefront cross-linking, Phase 4).
  //
  // Distributors are kept un-grouped (different model). Soft-deleted
  // branches are excluded server-side via the partial index check.
  async getMarketplaceShops() {
    if (isSupabaseConfigured) {
      // Filter defensively:
      //   hide_from_search=false  → owner has opted the shop into discovery
      //   status='active'         → NOT pending-approval or suspended;
      //     without this filter, if a shop ever ended up hide_from_search=false
      //     while status='pending' (e.g. re-import, admin edit, migration),
      //     customers could see a shop that isn't allowed to transact yet
      const { data } = await supabase.from('users')
        .select('*')
        .in('role', ['shop', 'distributor'])
        .eq('hide_from_search', false)
        .eq('status', 'active');
      const all = (data || []).filter(r => !r.branch_deleted_at).map(toUser);
      // Build branch counts per brand root. Each shop with a
      // parentShopId contributes to its parent's count; standalone main
      // shops just have their own count.
      const branchCountByRoot = new Map();
      for (const s of all) {
        if (s.parentShopId) {
          branchCountByRoot.set(s.parentShopId, (branchCountByRoot.get(s.parentShopId) || 0) + 1);
        }
      }
      // Surface only the main shops (no parentShopId) + every distributor.
      // Each main carries an extra branchCount field. Standalones (no
      // children) get branchCount: 0 — UI can decide whether to render
      // the "N locations" pill.
      return all
        .filter(s => s.role === 'distributor' || !s.parentShopId)
        .map(s => ({ ...s, branchCount: branchCountByRoot.get(s.id) || 0 }));
    }
    const db = getDB();
    const all = db.users.filter(u =>
      (u.role === 'shop' || u.role === 'distributor') && !u.hideFromSearch && !u.branchDeletedAt
    );
    const counts = new Map();
    for (const s of all) {
      if (s.parentShopId) counts.set(s.parentShopId, (counts.get(s.parentShopId) || 0) + 1);
    }
    return all
      .filter(s => s.role === 'distributor' || !s.parentShopId)
      .map(s => ({ ...s, branchCount: counts.get(s.id) || 0 }));
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
      if (data.businessKind !== undefined) updateObj.business_kind = data.businessKind;
      if (data.onboardingCompleted !== undefined) updateObj.onboarding_completed = data.onboardingCompleted;
      if (data.openingHour !== undefined) updateObj.opening_hour = data.openingHour;
      if (data.closingHour !== undefined) updateObj.closing_hour = data.closingHour;
      if (data.weeklyHolidays !== undefined) updateObj.weekly_holidays = data.weeklyHolidays;
      if (data.shopBanner !== undefined) updateObj.shop_banner = data.shopBanner;
      // If any optional column does not yet exist in the DB, drop it and retry.
      // Makes the feature work whether or not the latest ALTER TABLE has been applied.
      //
      // BUG FIX: previously, any error that WASN'T a "missing column" error
      // (including RLS policy violations, permission denials, network
      // failures) fell into console.warn(...) + break — the loop just gave
      // up silently. The function then did a fresh SELECT and returned
      // whatever was ALREADY in the database (unchanged, since the UPDATE
      // never took effect), with no thrown error and no way for the caller
      // to know the save failed. This is exactly what caused Payment QR
      // (and, via a similar pattern in saveSiteConfig, Print Settings) to
      // silently not persist while still showing a false success toast.
      // Now: a real permission/RLS error throws, so callers can catch it
      // and show the person an honest error instead of a lie.
      let __attempt = { ...updateObj };
      let __lastRealError = null;
      for (let __tries = 0; __tries < 10; __tries++) {
        const { error: __upErr } = await supabase.from('users').update(__attempt).eq('id', userId);
        if (!__upErr) { __lastRealError = null; break; }
        const __miss = (__upErr.message || '').match(/column (?:users\.)?["']?(\w+)["']? does not exist/i);
        if (!__miss) { __lastRealError = __upErr; break; }
        delete __attempt[__miss[1]];
        if (Object.keys(__attempt).length === 0) break;
      }
      if (__lastRealError) {
        throw new Error(__lastRealError.message || 'Failed to save — you may not have permission to update this.');
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
      const { error } = await supabase.from('settings').update(updateObj).eq('id', 1);
      if (error) throw new Error(error.message);
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
      // BUG FIX: this used to do `await supabase.from(...).upsert(...)` and
      // discard the ENTIRE { data, error } response without checking it.
      // Even a hard RLS/permission error from Supabase would leave this
      // function returning normally (undefined), no exception thrown —
      // making it structurally impossible for any caller to know the save
      // failed, no matter how carefully the caller's own try/catch was
      // written. This was silently masking the real error underneath the
      // print-settings-never-saves bug this whole time.
      const { error } = await supabase.from('site_config').upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message || 'Failed to save setting.');
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

  // Shop confirms they received a dispatched order — the closing
  // confirmation. Kept separate from updateStockOrderStatus (which is
  // the DISTRIBUTOR's accept/reject/dispatch action and has its own
  // credit-ledger side effect) since this is a different actor with no
  // side effect beyond the status flip and notifying the distributor.
  async markStockOrderDelivered(orderId) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('stock_orders')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', 'dispatched')
        .select('id')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Order not found, already delivered, or not yet dispatched.');
      return { id: orderId, status: 'delivered' };
    }
    const db = getDB();
    const order = (db.stockOrders || []).find(o => o.id === orderId);
    if (order) { order.status = 'delivered'; order.deliveredAt = new Date().toISOString(); saveDB(db); }
    return order;
  },

  async getDistributorOrders(distributorId) {
    if (isSupabaseConfigured) {
      let query = supabase.from('stock_orders').select('*').order('created_at', { ascending: false });
      if (distributorId) query = query.eq('distributor_id', distributorId);
      const { data } = await query;
      return (data || []).map(row => ({
        id: row.id, shopId: row.shop_id, shopName: row.shop_name,
        items: row.items, total: row.total, status: row.status, date: row.created_at,
        distributorId: row.distributor_id,
        expectedDispatchDate: row.expected_dispatch_date || null,
        dispatchedAt: row.dispatched_at || null,
        deliveredAt: row.delivered_at || null,
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
        items: row.items, total: row.total, status: row.status, date: row.created_at,
        expectedDispatchDate: row.expected_dispatch_date || null,
        dispatchedAt: row.dispatched_at || null,
        deliveredAt: row.delivered_at || null,
      }));
    }
    const db = getDB();
    if (!db.stockOrders) db.stockOrders = [];
    return db.stockOrders.filter(o => o.shopId === shopId);
  },

  async updateStockOrderStatus(orderId, status, distributorId, expectedDispatchDate = null) {
    if (isSupabaseConfigured) {
      // Was previously fire-and-forget with no error check and no
      // verification a row changed. The caller already wraps this in
      // mustSucceed() expecting a throw on failure — but this function
      // never threw, so a blocked update (RLS, wrong id, network) would
      // silently no-op while the UI reported success. Worse: the credit
      // ledger entry below was created from a stale re-read regardless
      // of whether the status update actually landed, and the credit
      // INSERT itself was also never checked — a distributor accepting
      // an order could show 'Accepted!' with neither the status change
      // nor the money owed actually recorded.
      const updatePayload = { status };
      // expected_dispatch_date lets a distributor accept an order without
      // implying it ships today — they can give an ETA for when their
      // route to that area will actually go out, instead of every
      // acceptance reading as an immediate same-day promise.
      if (status === 'accepted' && expectedDispatchDate) {
        updatePayload.expected_dispatch_date = expectedDispatchDate;
      }
      const { data: updated, error: updErr } = await supabase
        .from('stock_orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select('*')
        .maybeSingle();
      if (updErr) throw new Error(updErr.message);
      if (!updated) throw new Error('Stock order not found or you do not have permission to update it.');

      // If accepted, also create a credit entry — reuse the row we just
      // confirmed was updated instead of a second, potentially-stale read.
      if (status === 'accepted') {
        const { error: credErr } = await supabase.from('credits').insert({
          from_id: distributorId || updated.shop_id,
          to_shop_id: updated.shop_id,
          description: `Inventory: ${(updated.items || []).map(i => `${i.name} (x${i.qty})`).join(', ')}`,
          amount: parseFloat(updated.total),
        });
        if (credErr) throw new Error(`Order accepted, but the credit entry failed to save: ${credErr.message}. The shop's balance may be out of sync — please check manually.`);
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

  // Bulk-dispatch every currently-accepted order in one tap — the real
  // "route is full, send it all" action. A distributor accepts orders as
  // they come in (each optionally carrying an expected_dispatch_date),
  // then once enough have piled up for one delivery route, selects them
  // and dispatches the whole batch together instead of one truck trip
  // per order. Server-side RPC enforces distributor ownership and only
  // touches rows still in 'accepted' status — see
  // 20260713_stock_order_dispatch.sql.
  async dispatchStockOrders(orderIds) {
    if (!isSupabaseConfigured || !orderIds?.length) return { dispatched: 0, requested: 0 };
    const { data, error } = await supabase.rpc('dispatch_stock_orders', { p_order_ids: orderIds });
    if (error) throw new Error(error.message);
    return data;
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
      const { error } = await supabase.from('announcements').update({ active: false }).eq('active', true);
      if (error) throw new Error(error.message);
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
      // Upsert on session_token (always unique per call) — if a row already
      // exists for this device, update last_seen_at instead of inserting.
      // Falls back silently on any conflict — this table is non-critical.
      const { error: upsertErr } = await supabase.from('active_sessions').upsert({
        user_id: authUid,
        session_token: crypto.randomUUID(),
        device_fingerprint: deviceFingerprint,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_fingerprint', ignoreDuplicates: false });
      if (upsertErr && upsertErr.code !== '23505' && upsertErr.code !== '409') {
        // 23505 = unique_violation, ignore silently — non-critical table
        console.warn('registerSession:', upsertErr.message);
      }
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
    // Atomic per-shop allocation via the next_invoice_no() Postgres
    // function (race-free across concurrent bills, unlike the older
    // site_config counter which had a fetch-then-write race). Returns
    // an object so the caller can use the formatted string for display
    // AND the integer for storage on order.invoice_no.
    const prefix = await this.getSiteConfig(`invPrefix_${userId}`, 'INV');
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('next_invoice_no', { p_shop_id: userId });
        if (!error && typeof data === 'number') {
          return {
            int: data,
            formatted: `${prefix}-${String(data).padStart(4, '0')}`,
            // Backwards-compat: existing code uses the result directly in
            // template strings like `${invoiceNo}` and concatenates to
            // build display labels — preserve that by overriding toString.
            toString() { return this.formatted; },
          };
        }
      } catch (_e) { /* RPC missing (migration not run) — fall through */ }
    }
    // Legacy site_config fallback for environments where the migration
    // hasn't been applied yet. Race condition exists but is unchanged
    // from prior behavior.
    const counterKey = `invCounter_${userId}`;
    const current = parseInt(await this.getSiteConfig(counterKey, 0)) || 0;
    const next = current + 1;
    await this.saveSiteConfig(counterKey, next);
    return {
      int: next,
      formatted: `${prefix}-${String(next).padStart(4, '0')}`,
      toString() { return this.formatted; },
    };
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

  // Loyalty points are unified across every branch of the same brand.
  // RK's customer who buys ₹500 at Main shop and ₹500 at the Hitech City
  // branch should see ONE 100-point balance, not 50 in each. We resolve
  // the brand root (parent_shop_id || self) and key the counter on that.
  // Standalone shops (no parent, no children) behave exactly as before —
  // their brand root is their own id.
  async _resolveBrandRoot(shopId) {
    if (!shopId) return shopId;
    if (!isSupabaseConfigured) {
      const db = getDB();
      const u = db.users.find(x => x.id === shopId);
      return (u?.parentShopId) || shopId;
    }
    try {
      const { data } = await supabase.from('users').select('parent_shop_id').eq('id', shopId).maybeSingle();
      return data?.parent_shop_id || shopId;
    } catch {
      return shopId;        // column missing (migration not run) → standalone behavior
    }
  },

  async getLoyaltyPoints(shopId, phone) {
    if (!phone) return 0;
    const brandRoot = await this._resolveBrandRoot(shopId);
    const key = `loyalty_${brandRoot}_${phone.replace(/\D/g, '')}`;
    return parseInt(await this.getSiteConfig(key, 0)) || 0;
  },

  async awardLoyaltyPoints(shopId, phone, orderTotal) {
    if (!phone) return 0;
    const brandRoot = await this._resolveBrandRoot(shopId);
    const key = `loyalty_${brandRoot}_${phone.replace(/\D/g, '')}`;
    const current = parseInt(await this.getSiteConfig(key, 0)) || 0;
    const earned = Math.floor(orderTotal / 10);
    const next = current + earned;
    if (earned > 0) await this.saveSiteConfig(key, next);
    return { earned, balance: next };
  },

  async redeemLoyaltyPoints(shopId, phone, pointsToRedeem) {
    if (!phone || pointsToRedeem <= 0) return 0;
    const brandRoot = await this._resolveBrandRoot(shopId);
    const key = `loyalty_${brandRoot}_${phone.replace(/\D/g, '')}`;
    const current = parseInt(await this.getSiteConfig(key, 0)) || 0;
    const redeemed = Math.min(pointsToRedeem, current);
    const remaining = current - redeemed;
    await this.saveSiteConfig(key, remaining);
    return remaining;
  },

  // ─── NOTIFICATIONS ─────────────────────────────────────────────────
  // In-app notification center. Rows are created by Postgres triggers on
  // real events (orders / appointments / credits / signups) so the app
  // never has to fire them from the client — one source of truth.
  async getNotifications(userId, { limit = 30 } = {}) {
    if (!isSupabaseConfigured || !userId) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('id, category, title, body, action_url, data, read, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getUnreadNotificationCount(userId) {
    if (!isSupabaseConfigured || !userId) return 0;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) return 0;
    return count || 0;
  },

  async markNotificationRead(id) {
    if (!isSupabaseConfigured || !id) return null;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async markAllNotificationsRead(userId) {
    if (!isSupabaseConfigured || !userId) return null;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw new Error(error.message);
    return true;
  },

  async deleteNotification(id) {
    if (!isSupabaseConfigured || !id) return null;
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  // ─── WEB PUSH SUBSCRIPTIONS ────────────────────────────────────────
  async savePushSubscription(userId, sub) {
    if (!isSupabaseConfigured || !userId || !sub?.endpoint) return null;
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: sub.endpoint,
      keys_p256dh: sub.keys?.p256dh || '',
      keys_auth:   sub.keys?.auth   || '',
      user_agent:  navigator.userAgent,
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) throw new Error(error.message);
    return true;
  },

  async deletePushSubscription(endpoint) {
    if (!isSupabaseConfigured || !endpoint) return null;
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) throw new Error(error.message);
    return true;
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

  // Admin assigns/changes a shop's paid plan tier.
  //
  // BUG FIX: this only updated subscription_tier + plan_expires_at, never
  // touching the `subscription` column. So after the admin "activated" a
  // shop's plan (e.g. set tier='pro'), the shop's `subscription` field
  // stayed literally 'trial' (its value from registration) — and the
  // dashboard's trial badge/banner check `user.subscription === 'trial'`
  // directly (not subscriptionTier), so it kept showing "Trial — Xd left"
  // even though the admin had activated a paid plan.
  // Now: assigning any real tier also flips subscription to 'active'.
  async updateUserSubscription(userId, tier, expiresAt) {
    const updateObj = { subscription_tier: tier, plan_expires_at: expiresAt || null, subscription: 'active' };
    if (isSupabaseConfigured) {
      // These six admin functions (through bulkUpdateSubscription below)
      // all had zero error checking — a genuinely risky gap for the
      // exact tools an admin uses to grant/adjust a client's plan or
      // resolve a locked-out account, with no visible sign anything
      // went wrong if it didn't actually apply.
      const { data, error } = await supabase.from('users').update(updateObj).eq('id', userId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('User not found or update not permitted.');
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.subscriptionTier = tier; u.planExpiresAt = expiresAt || null; u.subscription = 'active'; saveDB(db); }
  },

  async updateDistributorSubscription(userId, tier, expiresAt) {
    const updateObj = { distributor_plan_tier: tier, distributor_plan_expires_at: expiresAt || null };
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('users').update(updateObj).eq('id', userId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Distributor not found or update not permitted.');
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.distributorPlanTier = tier; u.distributorPlanExpiresAt = expiresAt || null; saveDB(db); }
  },

  async updateUserRole(userId, role) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('users').update({ role }).eq('id', userId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('User not found or role change not permitted.');
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.role = role; saveDB(db); }
  },

  async suspendUser(userId) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('users').update({ status: 'pending' }).eq('id', userId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('User not found or suspend not permitted.');
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.status = 'pending'; saveDB(db); }
  },

  async unsuspendUser(userId) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('users').update({ status: 'active' }).eq('id', userId).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('User not found or unsuspend not permitted.');
      return;
    }
    const db = getDB();
    const u = db.users.find(x => x.id === userId);
    if (u) { u.status = 'active'; saveDB(db); }
  },

  async bulkUpdateSubscription(userIds, tier) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('users').update({ subscription_tier: tier }).in('id', userIds).select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('No matching users were updated.');
      if (data.length < userIds.length) throw new Error(`Only ${data.length} of ${userIds.length} users were updated — check permissions for the rest.`);
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
    // Was destructuring only { data }, silently discarding any insert
    // error — an affiliate could refer a real signup and never get
    // commission credit for it, with no sign anything went wrong.
    const { data: inserted, error } = await supabase.from('referral_attributions').insert({
      code_id: codeRow.id, code: code.toUpperCase(),
      referrer_id: codeRow.owner_id, referred_id: referredUserId,
      commission_amount: 0, status: 'pending',
    }).select().maybeSingle();
    if (error) {
      console.error('attributeReferral failed:', error.message);
      return null; // Referral attribution is best-effort at signup time —
      // don't block registration over it, but at least log it so it's
      // findable instead of silently vanishing.
    }
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

  // ── SERVICE BOOKING MODULE ─────────────────────────────────────────────

  // --- Services (shop's catalogue) ---

  // Cheap check used by the customer-facing booking widget to decide
  // whether to render the 'Manage This Booking' link on the
  // confirmation screen. Returns true if the shop is on a plan tier
  // that includes customer self-service (Pro / Enterprise / trial).
  // Kept in sync with features.js serviceCustomerSelfService.
  //
  // Uses only the public shop-lookup allowlist columns — no RLS risk.
  async shopHasSelfService(shopId) {
    if (!isSupabaseConfigured || !shopId) return false;
    const { data } = await supabase
      .from('users')
      .select('subscription, subscription_tier')
      .eq('id', shopId)
      .maybeSingle();
    if (!data) return false;
    const tier = data.subscription_tier || '';
    if (tier === 'pro' || tier === 'enterprise') return true;
    if (data.subscription === 'trial' && !tier) return true;
    return false;
  },

  // Home Service add-on — standalone paid unlock, independent of plan
  // tier. Live date comparison (not a cached boolean) so there's no
  // dependency on a background job to switch access off — see the
  // migration comment for the full reasoning.
  async shopHasHomeServiceAddon(shopId) {
    if (!isSupabaseConfigured || !shopId) return false;
    const { data } = await supabase
      .from('users')
      .select('home_service_addon_expires_at')
      .eq('id', shopId)
      .maybeSingle();
    if (!data?.home_service_addon_expires_at) return false;
    return new Date(data.home_service_addon_expires_at).getTime() > Date.now();
  },

  // Purchase (or renew) the Home Service add-on. Renewing always resets
  // to now + 30 days rather than stacking onto remaining time — matches
  // how the existing plan-tier purchase flow already behaves (see
  // razorpay-verify-payment), not a new convention.
  //
  // Returns { orderId, amount, currency } for the caller to open the
  // Razorpay checkout with — the actual grant happens in
  // verifyHomeServiceAddonPayment after the customer completes payment.
  async createHomeServiceAddonOrder() {
    return this.createRazorpayOrder('home_service_addon', 199);
  },

  async verifyHomeServiceAddonPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, userId }) {
    return this.verifyRazorpayPayment({
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      planId: 'home_service_addon', userId,
    });
  },

  async getShopServices(shopId) {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async saveService(shopId, service) {
    if (!isSupabaseConfigured) return null;
    const payload = {
      shop_id: shopId,
      name: service.name,
      description: service.description || null,
      category: service.category || 'general',
      duration_minutes: Number(service.duration_minutes) || 30,
      price: Number(service.price) || 0,
      active: service.active !== false,
      display_order: Number(service.display_order) || 0,
      home_service_enabled: !!service.home_service_enabled,
      home_service_fee: Number(service.home_service_fee) || 0,
      updated_at: new Date().toISOString(),
    };
    if (service.id) {
      const { data, error } = await supabase.from('services').update(payload).eq('id', service.id).select().single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase.from('services').insert({ ...payload, created_at: new Date().toISOString() }).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
  },

  async deleteService(serviceId) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('services').delete().eq('id', serviceId);
    if (error) throw new Error(error.message);
    return true;
  },

  async toggleServiceActive(serviceId, active) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('services').update({ active, updated_at: new Date().toISOString() }).eq('id', serviceId);
    if (error) throw new Error(error.message);
    return true;
  },

  // --- Appointments ---

  async getAppointments(shopId, { date, status } = {}) {
    if (!isSupabaseConfigured) return [];
    let q = supabase.from('appointments').select('*').eq('shop_id', shopId);
    if (date) q = q.eq('appointment_date', date);
    if (status) q = q.eq('status', status);
    q = q.order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  // Converts 'HH:MM' or 'HH:MM:SS' into minutes-since-midnight for range math.
  _timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  },

  // Double-booking prevention — the single most universally-cited
  // must-have feature across every appointment scheduling product
  // (Fresha, Square Appointments, Setmore, Acuity, Microsoft Bookings,
  // Vagaro). Without this, two different customers can book overlapping
  // time slots at the same shop with zero warning until both show up.
  //
  // Scoped PER SHOP for now (not per staff member) — MyStoreOS doesn't
  // yet have staff-to-appointment assignment, so this assumes a
  // single-resource business (one chair/room/practitioner), which is
  // the correct default for the majority of solo salon/spa/clinic
  // owners this feature targets. Once staff assignment ships, this
  // check should be scoped to the specific staff member instead of the
  // whole shop, so two DIFFERENT staff can legitimately serve two
  // customers at the same time.
  // ── STAFF ASSIGNMENT (PROVIDERS) ────────────────────────────────────────
  //
  // Deliberately separate from login-based staff accounts (users where
  // role='staff', which require phone+password+PIN) — most small salons
  // want to list a stylist as bookable without issuing her a POS login.
  // See migration 20260705_providers_staff_assignment.sql for the full
  // design rationale.

  async getProviders(shopId) {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('providers')
      .select('*').eq('shop_id', shopId)
      .order('display_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async saveProvider(shopId, provider) {
    if (!isSupabaseConfigured) return null;
    const payload = {
      shop_id: shopId,
      name: provider.name,
      title: provider.title || null,
      photo_url: provider.photo_url || null,
      phone: provider.phone || null,
      working_hours: provider.working_hours || undefined, // let DB default apply if not given
      buffer_minutes: Number(provider.buffer_minutes) || 0,
      active: provider.active !== false,
      display_order: Number(provider.display_order) || 0,
      updated_at: new Date().toISOString(),
    };
    if (provider.id) {
      const { data, error } = await supabase.from('providers').update(payload).eq('id', provider.id).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await supabase.from('providers')
      .insert({ ...payload, created_at: new Date().toISOString() }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteProvider(id) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('providers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async toggleProviderActive(id, active) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('providers').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async getProviderTimeOff(providerId) {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('provider_time_off')
      .select('*').eq('provider_id', providerId).order('start_date', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addProviderTimeOff(providerId, startDate, endDate, reason) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.from('provider_time_off')
      .insert({ provider_id: providerId, start_date: startDate, end_date: endDate, reason: reason || null })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteProviderTimeOff(id) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('provider_time_off').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  // Combines a provider's weekly working_hours + any time-off block
  // covering the given date + already-booked ranges, so the booking
  // widget can generate a slot grid that's actually accurate — not just
  // a fixed 9am-8pm grid with bookings greyed out, but genuinely
  // reflecting when this specific person works.
  async getProviderAvailability(providerId, date) {
    if (!isSupabaseConfigured) return { isOpen: false, workingStart: null, workingEnd: null, bookedRanges: [] };
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = DAY_KEYS[new Date(date + 'T00:00:00').getDay()];

    const { data: provider, error: provErr } = await supabase.from('providers')
      .select('working_hours, buffer_minutes').eq('id', providerId).maybeSingle();
    if (provErr || !provider) return { isOpen: false, workingStart: null, workingEnd: null, bookedRanges: [] };

    const dayHours = provider.working_hours?.[dayKey];
    if (!dayHours) return { isOpen: false, workingStart: null, workingEnd: null, bookedRanges: [] };

    // Check time-off — any range covering this date blocks the whole day.
    const { data: timeOff } = await supabase.from('provider_time_off')
      .select('start_date, end_date').eq('provider_id', providerId)
      .lte('start_date', date).gte('end_date', date);
    if (timeOff && timeOff.length > 0) {
      return { isOpen: false, workingStart: null, workingEnd: null, bookedRanges: [], onTimeOff: true };
    }

    const rawBookedRanges = await this.getBookedSlots(null, date, providerId);
    // Buffer time: extend each booked range's END by buffer_minutes, so
    // the next slot can't start immediately after — gives the provider
    // prep/cleanup time. Applied here (not baked into getBookedSlots
    // itself) so shop-wide/no-provider bookings are unaffected, and the
    // owner's walk-in modal gets the same buffer-aware ranges for free.
    const buffer = Number(provider.buffer_minutes) || 0;
    const bookedRanges = buffer > 0
      ? rawBookedRanges.map(r => ({ start: r.start, end: r.end + buffer }))
      : rawBookedRanges;

    return { isOpen: true, workingStart: dayHours.start, workingEnd: dayHours.end, bookedRanges };
  },


  // better UX than only finding out after submitting. Same column
  // restriction as checkAppointmentConflict.
  //
  // If providerId is given, scopes to that provider only (two different
  // providers can serve two customers at the same time). If omitted,
  // falls back to shop-wide scoping — same as before providers existed,
  // for shops that haven't set any up.
  async getBookedSlots(shopId, date, providerId = null) {
    if (!isSupabaseConfigured) return [];
    let q = supabase.from('appointments')
      .select('appointment_time, duration_minutes')
      .eq('appointment_date', date)
      .not('status', 'in', '("cancelled")');
    q = providerId ? q.eq('provider_id', providerId) : q.eq('shop_id', shopId).is('provider_id', null);
    const { data, error } = await q;
    if (error) return [];
    return (data || []).map(a => ({
      start: this._timeToMinutes(a.appointment_time),
      end: this._timeToMinutes(a.appointment_time) + (Number(a.duration_minutes) || 30),
    }));
  },

  async checkAppointmentConflict(shopId, date, time, durationMinutes, excludeAppointmentId = null, providerId = null) {
    if (!isSupabaseConfigured) return null;
    // Only select non-identifying columns — this runs for anonymous
    // customers browsing the booking widget too, who must never see
    // another customer's name, phone, or even which service they booked.
    // See migration 20260705_appointments_privacy_fix.sql for the
    // matching column-level GRANT that makes this the only thing anon
    // can read from this table.
    let q = supabase.from('appointments')
      .select('id, appointment_time, duration_minutes')
      .eq('appointment_date', date)
      .not('status', 'in', '("cancelled")');
    q = providerId ? q.eq('provider_id', providerId) : q.eq('shop_id', shopId).is('provider_id', null);
    const { data, error } = await q;
    if (error) return null; // fail open — don't block booking on a read error

    // Fetch the provider's buffer_minutes (if scoped to one) so this
    // check — the one that actually runs right before the real insert,
    // not just the widget's visual slot picker — also respects it.
    let buffer = 0;
    if (providerId) {
      const { data: prov } = await supabase.from('providers').select('buffer_minutes').eq('id', providerId).maybeSingle();
      buffer = Number(prov?.buffer_minutes) || 0;
    }

    const newStart = this._timeToMinutes(time);
    const newEnd = newStart + (Number(durationMinutes) || 30);
    for (const existing of (data || [])) {
      if (excludeAppointmentId && existing.id === excludeAppointmentId) continue;
      const exStart = this._timeToMinutes(existing.appointment_time);
      const exEnd = exStart + (Number(existing.duration_minutes) || 30) + buffer;
      // Standard interval-overlap test: two ranges overlap unless one
      // ends at/before the other starts.
      if (newStart < exEnd && newEnd > exStart) {
        return existing; // return the conflicting appointment for a clear error message
      }
    }
    return null;
  },

  // Create a recurring booking series via RPC. Server enforces:
  //   * Enterprise-tier gate
  //   * Ownership check
  //   * Materializes each occurrence and skips (does not fail) any
  //     that would conflict with an existing appointment.
  //
  // Returns { series_id, materialized, skipped }. Caller should show
  // both counts to the user — e.g. "Booked 10 of 12 slots (2 skipped —
  // already booked)".
  async createRecurringAppointment(shopId, series) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('create_recurring_appointment', {
      p_shop_id:         shopId,
      p_service_id:      series.service_id || null,
      p_service_name:    series.service_name,
      p_service_price:   Number(series.service_price) || 0,
      p_duration_min:    Number(series.duration_minutes) || 30,
      p_customer_name:   series.customer_name,
      p_customer_phone:  series.customer_phone,
      p_time_of_day:     series.time_of_day,          // "HH:MM"
      p_starts_on:       series.starts_on,            // "YYYY-MM-DD"
      p_frequency:       series.frequency,            // 'daily' | 'weekly' | 'monthly'
      p_interval:        Number(series.interval_count) || 1,
      p_max_occurrences: Number(series.max_occurrences) || 12,
      p_ends_on:         series.ends_on || null,
      p_provider_id:     series.provider_id || null,
      p_status:          series.status || 'confirmed',
      p_service_location: series.service_location || 'in_shop',
      p_customer_address: series.customer_address || null,
      p_home_service_fee: Number(series.home_service_fee) || 0,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async bookAppointment(shopId, appointment) {
    if (!isSupabaseConfigured) return null;
    const conflict = await this.checkAppointmentConflict(
      shopId, appointment.appointment_date, appointment.appointment_time, appointment.duration_minutes,
      null, appointment.provider_id || null
    );
    if (conflict) {
      const t = conflict.appointment_time?.slice(0, 5) || '';
      throw new Error(`That time slot (${t}) is already booked. Please pick a different time.`);
    }
    const { data, error } = await supabase.from('appointments').insert({
      shop_id: shopId,
      service_id: appointment.service_id || null,
      service_name: appointment.service_name,
      service_price: Number(appointment.service_price) || 0,
      duration_minutes: Number(appointment.duration_minutes) || 30,
      customer_name: appointment.customer_name,
      customer_phone: appointment.customer_phone,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      notes: appointment.notes || null,
      booked_via: appointment.booked_via || 'consumer_portal',
      provider_id: appointment.provider_id || null,
      // Home service — service_location defaults to 'in_shop' at the DB
      // level if not passed. customer_address is required by a CHECK
      // constraint whenever service_location is 'at_home' (see
      // 20260712_home_service_bookings.sql) — Postgres itself rejects an
      // at-home booking with no address, so there's no way for this to
      // half-save.
      service_location: appointment.service_location || 'in_shop',
      customer_address: appointment.customer_address || null,
      home_service_fee: Number(appointment.home_service_fee) || 0,
      // Consumer self-bookings default to 'pending' (owner reviews and
      // confirms). Owner-created walk-in/phone bookings should default
      // to 'confirmed' — the shop already knows it's happening, there's
      // no one else to confirm it with.
      status: appointment.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
      // Explicit column list, not bare .select() (which requests every
      // column via RETURNING *). Postgres requires SELECT privilege on
      // every column named in a RETURNING clause — since anon only has
      // column-level SELECT on 6 non-identifying columns (see
      // 20260705_appointments_privacy_fix.sql / customer_self_service.sql),
      // a bare .select() here could fail privilege checks or silently
      // return incomplete data for a GUEST booking. Only request back
      // what the caller actually uses: the date (for the confirmation
      // screen) and the manage_token (for the self-service reschedule/
      // cancel link) — both are in anon's allowed column list. Do NOT
      // add customer_address/service_location/home_service_fee here —
      // anon has no SELECT grant on them and the insert would fail.
      .select('id, appointment_date, appointment_time, status, manage_token')
      .single();
    if (error) {
      // 23P01 = exclusion_violation — the rare race-condition case where
      // two bookings for the same shop+time landed within milliseconds of
      // each other and both passed the app-level checkAppointmentConflict
      // read before either insert committed. The DB-level exclusion
      // constraint (see migrations 20260705_appointment_no_overlap.sql
      // and 20260705_providers_staff_assignment.sql) is what actually
      // caught it here — give the same friendly message instead of
      // surfacing Postgres's raw constraint-violation text.
      if (error.code === '23P01') {
        throw new Error('That time slot was just booked by someone else. Please pick a different time.');
      }
      throw new Error(error.message);
    }
    return data;
  },

  async updateAppointmentStatus(appointmentId, status, staffNotes) {
    if (!isSupabaseConfigured) return null;
    const update = { status, updated_at: new Date().toISOString() };
    if (staffNotes !== undefined) update.staff_notes = staffNotes;
    const { data, error } = await supabase.from('appointments').update(update).eq('id', appointmentId).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  // Closes the loop between "the appointment happened" and "money was
  // actually collected and recorded." Previously, marking an appointment
  // 'completed' only flipped its status column — no order was ever
  // created, no revenue was recorded anywhere, and the appointments
  // table's order_id column (added specifically for this) was never
  // populated. A completed haircut with no linked bill is invisible to
  // Day Book, Reports, GST filing, and the customer's own bill history.
  //
  // This creates a REAL order (via the same placeOrder used by the POS,
  // so it behaves identically — invoice number, stock/loyalty hooks,
  // shows up in All Bills) using a single line item built from the
  // appointment's service, then links appointments.order_id to it and
  // sets status='completed' in one call.
  async completeAppointmentWithBill(appointment, { finalAmount, paymentMethod = 'Cash', completedBy, completedByName } = {}) {
    if (!isSupabaseConfigured) return null;
    const amount = Number(finalAmount) || Number(appointment.service_price) || 0;
    const invoiceNo = await this.getNextInvoiceNumber(appointment.shop_id).catch(() => null);
    const order = await this.placeOrder(
      `walk-in:${appointment.customer_name || 'Guest'}:${appointment.customer_phone || ''}`,
      appointment.shop_id,
      [{
        id: appointment.service_id || `service-${appointment.id}`,
        name: appointment.service_name,
        price: amount,
        qty: 1,
      }],
      amount,
      { phone: appointment.customer_phone },
      'Accepted',
      paymentMethod,
      invoiceNo?.int || null
    );
    // Records WHO confirmed the work was done and WHEN — the real
    // "finish confirmation" for a home visit, where nobody at the shop
    // otherwise witnesses it happening. completed_at is its own column
    // (not reused from updated_at) so a later, unrelated edit to this
    // row can never be mistaken for a new completion time.
    const { data, error } = await supabase.from('appointments')
      .update({
        status: 'completed',
        order_id: order.id,
        completed_by: completedBy || null,
        completed_by_name: completedByName || null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.id).select().single();
    if (error) throw new Error(error.message);
    return { appointment: data, order };
  },

  // Returns the LOGGED-IN customer's own appointment history. Safe
  // despite accepting customerPhone as a plain parameter: the
  // appointments_customer_own_read RLS policy (see
  // 20260705_customer_self_service.sql) independently verifies, on the
  // database side, that each returned row's customer_phone matches the
  // CALLER's own authenticated profile phone — looked up server-side
  // from auth.uid(), never trusting whatever phone the client claims. A
  // malicious call with someone else's phone number simply gets zero
  // rows back; it can never leak another customer's bookings.
  async getCustomerAppointments(customerPhone) {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('customer_phone', customerPhone)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ── GUEST SELF-SERVICE RESCHEDULE/CANCEL (capability token) ─────────────
  //
  // For guest bookings (no account). The customer receives a manage_token
  // once, on their booking confirmation screen — possessing it is the
  // only proof of ownership needed (same trust model as "anyone with the
  // link" sharing). All three calls go through SECURITY DEFINER Postgres
  // functions, which bypass RLS narrowly and only for the one row whose
  // token the caller already knows.

  async getAppointmentByToken(token) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('get_appointment_by_token', { p_token: token });
    if (error) throw new Error(error.message);
    return (data && data[0]) || null;
  },

  async cancelAppointmentByToken(token) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('cancel_appointment_by_token', { p_token: token });
    if (error) throw new Error(error.message || 'Could not cancel this booking.');
    return data;
  },

  async rescheduleAppointmentByToken(token, newDate, newTime) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('reschedule_appointment_by_token', {
      p_token: token, p_new_date: newDate, p_new_time: newTime,
    });
    if (error) throw new Error(error.message || 'Could not reschedule this booking.');
    return data;
  },

  // ── MEMBERSHIP PLANS ────────────────────────────────────────────────────

  async getMembershipPlans(shopId) {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('membership_plans')
      .select('*').eq('shop_id', shopId)
      .order('display_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async saveMembershipPlan(shopId, plan) {
    if (!isSupabaseConfigured) return null;
    const payload = {
      shop_id: shopId,
      name: plan.name,
      description: plan.description || null,
      duration_days: Number(plan.duration_days) || 30,
      price: Number(plan.price) || 0,
      discount_percent: Number(plan.discount_percent) || 0,
      free_services: Number(plan.free_services) || 0,
      color: plan.color || '#8B5CF6',
      active: plan.active !== false,
      display_order: Number(plan.display_order) || 0,
      updated_at: new Date().toISOString(),
    };
    if (plan.id) {
      const { data, error } = await supabase.from('membership_plans').update(payload).eq('id', plan.id).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await supabase.from('membership_plans')
      .insert({ ...payload, created_at: new Date().toISOString() }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteMembershipPlan(planId) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('membership_plans').delete().eq('id', planId);
    if (error) throw new Error(error.message);
    return true;
  },

  // ── MEMBERSHIPS ─────────────────────────────────────────────────────────

  async getMemberships(shopId, { status, customerPhone } = {}) {
    if (!isSupabaseConfigured) return [];
    let q = supabase.from('memberships').select('*').eq('shop_id', shopId);
    if (status) q = q.eq('status', status);
    if (customerPhone) q = q.eq('customer_phone', customerPhone);
    q = q.order('expires_on', { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async issueMembership(shopId, { plan, customerName, customerPhone, notes }) {
    if (!isSupabaseConfigured) return null;
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + (Number(plan.duration_days) || 30));
    const { data, error } = await supabase.from('memberships').insert({
      shop_id: shopId,
      plan_id: plan.id,
      plan_name: plan.name,
      plan_price: Number(plan.price) || 0,
      plan_discount_percent: Number(plan.discount_percent) || 0,
      customer_name: customerName,
      customer_phone: customerPhone,
      starts_on: now.toISOString().slice(0, 10),
      expires_on: expiry.toISOString().slice(0, 10),
      status: 'active',
      notes: notes || null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateMembershipStatus(id, status) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('memberships')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  // Lookup active membership for a phone (used at POS to auto-apply
  // membership discount to a bill)
  async findActiveMembership(shopId, customerPhone) {
    if (!isSupabaseConfigured || !customerPhone) return null;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from('memberships')
      .select('*').eq('shop_id', shopId).eq('customer_phone', customerPhone)
      .eq('status', 'active').gte('expires_on', today)
      .order('expires_on', { ascending: false }).limit(1).maybeSingle();
    if (error) return null;
    return data;
  },

  // ── FEEDBACK ────────────────────────────────────────────────────────────

  async getFeedback(shopId, { minRating, maxRating } = {}) {
    if (!isSupabaseConfigured) return [];
    let q = supabase.from('feedback').select('*').eq('shop_id', shopId);
    if (minRating) q = q.gte('rating', minRating);
    if (maxRating) q = q.lte('rating', maxRating);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async submitFeedback(shopId, { customerName, customerPhone, rating, comment, orderId, appointmentId }) {
    if (!isSupabaseConfigured) return null;
    if (!rating || rating < 1 || rating > 5) throw new Error('Rating must be 1..5');
    const { data, error } = await supabase.from('feedback').insert({
      shop_id: shopId,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      rating: Number(rating),
      comment: comment || null,
      order_id: orderId || null,
      appointment_id: appointmentId || null,
      created_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async respondToFeedback(feedbackId, responseText) {
    if (!isSupabaseConfigured) return null;
    const { error } = await supabase.from('feedback').update({
      responded: true, response_text: responseText, responded_at: new Date().toISOString(),
    }).eq('id', feedbackId);
    if (error) throw new Error(error.message);
    return true;
  },
};
