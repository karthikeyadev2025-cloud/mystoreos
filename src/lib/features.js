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

// ---- Retailer (shop) plan capabilities — single source of truth for feature gating.
// Keeps these in sync with the `capabilities` objects in api.getSubscriptionPlans().
export const PLAN_CAPS = {
  starter: {
    maxProducts: 200, maxDevices: 1,
    whatsappShare: true, batchExpiry: false, gst: false,
    staffAccounts: false, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: false, loyaltyPoints: false, flashSales: false,
  },
  pro: {
    maxProducts: -1, maxDevices: 1,
    whatsappShare: true, batchExpiry: true, gst: false,
    staffAccounts: true, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: false, loyaltyPoints: true, flashSales: true,
  },
  enterprise: {
    maxProducts: -1, maxDevices: 5,
    whatsappShare: true, batchExpiry: true, gst: true,
    staffAccounts: true, caPortal: true, tallyExport: true,
    multiDevice: true, customInvoiceFooter: true, loyaltyPoints: true, flashSales: true,
  },
};

// Human-readable plan name required to unlock each feature (for UI labels)
export const FEATURE_PLAN_LABEL = {
  whatsappShare: 'Starter Plan',
  batchExpiry: 'Pro Plan',
  staffAccounts: 'Pro Plan',
  gst: 'Enterprise Plan',
  caPortal: 'Enterprise Plan',
  tallyExport: 'Enterprise Plan',
  multiDevice: 'Enterprise Plan',
  customInvoiceFooter: 'Enterprise Plan',
  loyaltyPoints: 'Pro Plan',
  flashSales: 'Pro Plan',
};

// Returns the capabilities object for a user.
// Admin always gets enterprise; staff gets pro-level (inherits shop rights).
export function getCaps(user) {
  if (!user) return PLAN_CAPS.starter;
  if (user.role === 'admin') return PLAN_CAPS.enterprise;
  if (user.role === 'staff') return PLAN_CAPS.pro;
  const tier = user.subscriptionTier || 'starter';
  return PLAN_CAPS[tier] ?? PLAN_CAPS.starter;
}

// Returns true if the user's current plan includes the given feature.
// For numeric caps (maxProducts, maxDevices): returns true if -1 (unlimited) or > 1.
export function hasCap(user, feature) {
  const val = getCaps(user)[feature];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === -1 || val > 1;
  return false;
}
