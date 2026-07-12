// ---- Distributor plan capabilities ----
export const DIST_PLAN_CAPS = {
  basic_distributor: {
    maxShops: 10, routePlanner: false, bulkOrderCSV: false,
    tallyExport: false, multiDevice: 1, advancedAnalytics: false,
  },
  pro_distributor: {
    maxShops: 50, routePlanner: true, bulkOrderCSV: true,
    tallyExport: true, multiDevice: 3, advancedAnalytics: true,
  },
  enterprise_distributor: {
    maxShops: -1, routePlanner: true, bulkOrderCSV: true,
    tallyExport: true, multiDevice: 10, advancedAnalytics: true,
    multiBranch: true, apiAccess: true, staffAccounts: true,
  },
};

export const DIST_FEATURE_PLAN_LABEL = {
  routePlanner: 'Pro Distributor',
  bulkOrderCSV: 'Pro Distributor',
  tallyExport: 'Pro Distributor',
  advancedAnalytics: 'Pro Distributor',
  multiBranch: 'Enterprise Distributor',
  apiAccess: 'Enterprise Distributor',
  staffAccounts: 'Enterprise Distributor',
};

export function getDistCaps(user) {
  if (!user) return DIST_PLAN_CAPS.basic_distributor;
  if (user.role === 'admin') return DIST_PLAN_CAPS.enterprise_distributor;
  const tier = user.distributorPlanTier || 'basic_distributor';
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
  // Service-side unlock labels
  bookings: 'Pro Plan',
  serviceStaffAssignment: 'Pro Plan',
  serviceBufferTime: 'Pro Plan',
  serviceCustomerSelfService: 'Pro Plan',
  serviceReminders: 'Pro Plan',
  serviceProviderHours: 'Pro Plan',
  serviceRecurring: 'Enterprise Plan',
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
