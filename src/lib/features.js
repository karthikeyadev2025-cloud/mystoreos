// ---- Distributor plan capabilities ----
export const DIST_PLAN_CAPS = {
  // Was completely missing — getDistCaps() had no trial branch at all,
  // meaning every distributor's 15-day trial silently granted only
  // basic_distributor limits (10 shops, no route planner, no bulk CSV,
  // no Tally export, no advanced analytics) instead of the full-access
  // trial promised on the landing page and training manual. Exactly
  // the same bug class already found and fixed for shops (see
  // PLAN_CAPS.trial below and its comment) — this is that fix, applied
  // to the side of the app that never got it.
  trial: {
    maxShops: -1, routePlanner: true, bulkOrderCSV: true,
    tallyExport: true, multiDevice: 3, advancedAnalytics: true,
    // Field distribution — trial grants full access, same principle as
    // every other cap here.
    fieldDistribution: true, vanSales: true, maxVehicles: -1,
    eodSettlement: true, fieldReps: true,
  },
  basic_distributor: {
    maxShops: 10, routePlanner: false, bulkOrderCSV: false,
    tallyExport: false, multiDevice: 1, advancedAnalytics: false,
    // Basic is a catalog-and-orders tier — no field operations at all.
    fieldDistribution: false, vanSales: false, maxVehicles: 0,
    eodSettlement: false, fieldReps: false,
  },
  pro_distributor: {
    maxShops: 50, routePlanner: true, bulkOrderCSV: true,
    tallyExport: true, multiDevice: 3, advancedAnalytics: true,
    // Pro gets presale field operations (routes, visits, order booking)
    // and a limited fleet — but not offline van billing, which is the
    // genuinely heavyweight capability.
    fieldDistribution: true, vanSales: false, maxVehicles: 3,
    eodSettlement: true, fieldReps: true,
  },
  enterprise_distributor: {
    maxShops: -1, routePlanner: true, bulkOrderCSV: true,
    tallyExport: true, multiDevice: 10, advancedAnalytics: true,
    multiBranch: true, apiAccess: true, staffAccounts: true,
    customBranding: true,
    // Full field distribution including offline van sales and unlimited
    // fleet — this is the tier the whole van-sales build targets.
    fieldDistribution: true, vanSales: true, maxVehicles: -1,
    eodSettlement: true, fieldReps: true,
  },
};

export function normalizeDistTier(t) {
  if (!t) return 'basic_distributor';
  const lower = String(t).toLowerCase().trim();
  if (lower === 'enterprise' || lower === 'enterprise_distributor') return 'enterprise_distributor';
  if (lower === 'pro' || lower === 'pro_distributor') return 'pro_distributor';
  if (lower === 'basic' || lower === 'basic_distributor') return 'basic_distributor';
  return lower;
}

// Add aliases so 'enterprise', 'pro', and 'basic' resolve seamlessly
DIST_PLAN_CAPS.enterprise = DIST_PLAN_CAPS.enterprise_distributor;
DIST_PLAN_CAPS.pro = DIST_PLAN_CAPS.pro_distributor;
DIST_PLAN_CAPS.basic = DIST_PLAN_CAPS.basic_distributor;

export const DIST_FEATURE_PLAN_LABEL = {
  routePlanner: 'Pro Distributor',
  bulkOrderCSV: 'Pro Distributor',
  tallyExport: 'Pro Distributor',
  advancedAnalytics: 'Pro Distributor',
  fieldDistribution: 'Pro Distributor',
  eodSettlement: 'Pro Distributor',
  fieldReps: 'Pro Distributor',
  multiBranch: 'Enterprise Distributor',
  apiAccess: 'Enterprise Distributor',
  staffAccounts: 'Enterprise Distributor',
  vanSales: 'Enterprise Distributor',
};

export function getDistCaps(user) {
  if (!user) return DIST_PLAN_CAPS.basic_distributor;
  if (user.role === 'admin') return DIST_PLAN_CAPS.enterprise_distributor;

  if (user.role === 'staff' && user.ownerRole === 'distributor') {
    if (user.ownerSubscription === 'trial' || user.ownerSubscription === 'dist_trial') return DIST_PLAN_CAPS.trial;
    const ownerTier = normalizeDistTier(user.ownerDistributorPlanTier);
    return DIST_PLAN_CAPS[ownerTier] ?? DIST_PLAN_CAPS.basic_distributor;
  }

  if (user.subscription === 'trial' || user.subscription === 'dist_trial') return DIST_PLAN_CAPS.trial;
  const tier = normalizeDistTier(user.distributorPlanTier);
  return DIST_PLAN_CAPS[tier] ?? DIST_PLAN_CAPS.basic_distributor;
}

export function hasDistCap(user, feature) {
  const val = getDistCaps(user)[feature];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === -1 || val > 1;
  return false;
}

// ---- Retailer (shop) plan capabilities — single source of truth ----
// trial  = Free (7 days), basic billing only
// starter = ₹499/mo — digital billing, 200 products, WhatsApp share
// pro     = ₹999/mo — unlimited products, staff, loyalty, flash sales, batch/expiry
// enterprise = ₹2499/mo — GST invoicing, Tally XML, CA portal, multi-device, custom footer
//
// Service-business specific caps live under the *Service* keys below.
// The gating pattern (see useServiceFeatures) uses these to decide
// whether a shop with businessKind='service' can see / use each
// advanced feature. Retail-only shops never touch these, so setting
// them to false on lower tiers costs retailers nothing.
export const PLAN_CAPS = {
  trial: {
    maxProducts: 50, maxDevices: 1,
    whatsappShare: true, batchExpiry: false, gst: false,
    staffAccounts: false, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: false, loyaltyPoints: false, flashSales: false,
    promoCode: false, advancedReports: false, aiForecasting: false, barcodeManager: false,
    bookings: true,       // free during 15-day trial so users can evaluate
    // Service caps: everything unlocked during trial so users can evaluate.
    maxServices: -1, serviceStaffAssignment: true, serviceBufferTime: true,
    serviceCustomerSelfService: true, serviceReminders: true, serviceRecurring: true,
    serviceProviderHours: true,
  },
  starter: {
    maxProducts: 200, maxDevices: 1,
    whatsappShare: true, batchExpiry: false, gst: false,
    staffAccounts: false, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: false, loyaltyPoints: false, flashSales: false,
    promoCode: true, advancedReports: false, aiForecasting: false, barcodeManager: false,
    bookings: false,      // Bookings add-on ₹249/month (see subscription.bookings_addon)
    // Service caps — free-tier service business gets a small catalogue
    // and single-staff bookings, but no advanced scheduling primitives.
    maxServices: 3, serviceStaffAssignment: false, serviceBufferTime: false,
    serviceCustomerSelfService: false, serviceReminders: false, serviceRecurring: false,
    serviceProviderHours: false,
  },
  pro: {
    maxProducts: -1, maxDevices: 2,
    whatsappShare: true, batchExpiry: true, gst: false,
    staffAccounts: true, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: true, loyaltyPoints: true, flashSales: true,
    promoCode: true, advancedReports: true, aiForecasting: true, barcodeManager: true,
    bookings: true,       // included in Pro
    // Service caps — Pro is the natural home for a serious salon/spa/clinic.
    // Unlimited services, multi-staff assignment, buffer time between
    // bookings, customer self-service links, automated reminders,
    // per-staff working hours. Recurring bookings stay Enterprise-only.
    maxServices: -1, serviceStaffAssignment: true, serviceBufferTime: true,
    serviceCustomerSelfService: true, serviceReminders: true, serviceRecurring: false,
    serviceProviderHours: true,
  },
  enterprise: {
    maxProducts: -1, maxDevices: 5,
    whatsappShare: true, batchExpiry: true, gst: true,
    staffAccounts: true, caPortal: true, tallyExport: true,
    multiDevice: true, customInvoiceFooter: true, loyaltyPoints: true, flashSales: true,
    promoCode: true, advancedReports: true, aiForecasting: true, barcodeManager: true,
    bookings: true,       // included in Enterprise
    // Enterprise unlocks everything, including recurring bookings.
    maxServices: -1, serviceStaffAssignment: true, serviceBufferTime: true,
    serviceCustomerSelfService: true, serviceReminders: true, serviceRecurring: true,
    serviceProviderHours: true,
  },
  // ── SERVICE BUSINESS TIER TRACK — separately priced from Retail ──
  // Added, not a replacement: retail's starter/pro/enterprise above are
  // completely untouched, so every existing retail AND existing service
  // business already on those tiers keeps exactly what they have today.
  // These three are for the SEPARATE, cheaper pricing track service
  // businesses get going forward (see pricing_v2.serviceTiers in api.js).
  //
  // The one real capability change from the retail equivalents: Service
  // Starter grants bookings=true. Retail Starter correctly has no
  // bookings (a pure retail shop doesn't need them) — but a "Starter"
  // tier for a SERVICE business that can't take a single booking isn't
  // a usable starting point, it's nothing. The literal 'Bookings add-on
  // ₹249/month' comment on retail starter below was this exact idea,
  // written down but never actually built — this is that, done properly
  // as a real tier rather than a bolt-on toggle.
  service_starter: {
    maxProducts: 200, maxDevices: 1,
    whatsappShare: true, batchExpiry: false, gst: false,
    staffAccounts: false, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: false, loyaltyPoints: false, flashSales: false,
    promoCode: true, advancedReports: false, aiForecasting: false, barcodeManager: false,
    bookings: true,        // the whole point of this tier existing
    maxServices: 10, serviceStaffAssignment: false, serviceBufferTime: false,
    serviceCustomerSelfService: false, serviceReminders: false, serviceRecurring: false,
    serviceProviderHours: false,
  },
  service_pro: {
    maxProducts: -1, maxDevices: 2,
    whatsappShare: true, batchExpiry: false, gst: false,
    staffAccounts: true, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: true, loyaltyPoints: false, flashSales: false,
    promoCode: true, advancedReports: true, aiForecasting: false, barcodeManager: false,
    bookings: true,
    // Same service capability level as retail 'pro' — multi-staff,
    // buffer time, self-service links, automated reminders. Retail-only
    // extras (stock/expiry batching, loyalty, flash sales) left off:
    // a pure service business doesn't sell tracked stock.
    maxServices: -1, serviceStaffAssignment: true, serviceBufferTime: true,
    serviceCustomerSelfService: true, serviceReminders: true, serviceRecurring: false,
    serviceProviderHours: true,
  },
  service_enterprise: {
    maxProducts: -1, maxDevices: 5,
    whatsappShare: true, batchExpiry: false, gst: false,
    staffAccounts: true, caPortal: false, tallyExport: false,
    multiDevice: true, customInvoiceFooter: true, loyaltyPoints: false, flashSales: false,
    promoCode: true, advancedReports: true, aiForecasting: true, barcodeManager: true,
    bookings: true,
    // Full service capability, including recurring bookings and
    // multi-branch. GST/CA-portal/Tally left off deliberately — those
    // are retail compliance features; a service business that also
    // needs them would be on the retail track instead.
    maxServices: -1, serviceStaffAssignment: true, serviceBufferTime: true,
    serviceCustomerSelfService: true, serviceReminders: true, serviceRecurring: true,
    serviceProviderHours: true,
  },
};

// Human-readable plan name required to unlock each feature
export const FEATURE_PLAN_LABEL = {
  whatsappShare: 'Starter Plan',
  batchExpiry: 'Pro Plan',
  staffAccounts: 'Pro Plan',
  loyaltyPoints: 'Pro Plan',
  flashSales: 'Pro Plan',
  customInvoiceFooter: 'Pro Plan',
  advancedReports: 'Pro Plan',
  aiForecasting: 'Pro Plan',
  barcodeManager: 'Pro Plan',
  promoCode: 'Starter Plan',
  gst: 'Enterprise Plan',
  caPortal: 'Enterprise Plan',
  tallyExport: 'Enterprise Plan',
  multiDevice: 'Enterprise Plan',
  // Service-side unlock labels — only ever shown to service businesses
  // (retail returns 'everything available' before reaching these).
  bookings: 'Service Starter Plan',
  serviceStaffAssignment: 'Service Pro Plan',
  serviceBufferTime: 'Service Pro Plan',
  serviceCustomerSelfService: 'Service Pro Plan',
  serviceReminders: 'Service Pro Plan',
  serviceProviderHours: 'Service Pro Plan',
  serviceRecurring: 'Service Enterprise Plan',
};

export function getCaps(user) {
  if (!user) return PLAN_CAPS.trial;
  if (user.role === 'admin') return PLAN_CAPS.enterprise;
  if (user.role === 'staff') return PLAN_CAPS.pro;
  // An ACTIVE trial always grants full trial-tier access, regardless of
  // what subscriptionTier is set to. auth-register pre-sets
  // subscriptionTier to 'starter' at signup time — that's the tier the
  // account falls back to once the trial ends, not a cap that should
  // apply while subscription is still 'trial'. Checking subscriptionTier
  // first (as this function used to, unconditionally) meant every new
  // signup was capped at Starter limits — 3 services, no staff
  // scheduling, no reminders, bookings disabled — from the very first
  // second after registering, instead of the 15-day full-access trial
  // promised on the landing page and pricing page.
  if (user.subscription === 'trial') return PLAN_CAPS.trial;
  // For shop owners (main + branches) NOT on an active trial:
  // subscriptionTier is the explicit paid tier set by admin, chosen at
  // checkout, or inherited from parent via auth-login. Always trust it
  // when present — it overrides the subscription field.
  if (user.subscriptionTier && PLAN_CAPS[user.subscriptionTier]) {
    return PLAN_CAPS[user.subscriptionTier];
  }
  // Fallback: derive from subscription field
  const sub = user.subscription || 'trial';
  if (sub === 'active') return PLAN_CAPS.pro;
  return PLAN_CAPS[sub] ?? PLAN_CAPS.trial;
}

export function hasCap(user, feature) {
  const val = getCaps(user)[feature];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === -1 || val > 1;
  return false;
}
