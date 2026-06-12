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
export const PLAN_CAPS = {
  trial: {
    maxProducts: 50, maxDevices: 1,
    whatsappShare: true, batchExpiry: false, gst: false,
    staffAccounts: false, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: false, loyaltyPoints: false, flashSales: false,
    promoCode: false, advancedReports: false, aiForecasting: false, barcodeManager: false,
  },
  starter: {
    maxProducts: 200, maxDevices: 1,
    whatsappShare: true, batchExpiry: false, gst: false,
    staffAccounts: false, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: false, loyaltyPoints: false, flashSales: false,
    promoCode: true, advancedReports: false, aiForecasting: false, barcodeManager: false,
  },
  pro: {
    maxProducts: -1, maxDevices: 2,
    whatsappShare: true, batchExpiry: true, gst: false,
    staffAccounts: true, caPortal: false, tallyExport: false,
    multiDevice: false, customInvoiceFooter: true, loyaltyPoints: true, flashSales: true,
    promoCode: true, advancedReports: true, aiForecasting: true, barcodeManager: true,
  },
  enterprise: {
    maxProducts: -1, maxDevices: 5,
    whatsappShare: true, batchExpiry: true, gst: true,
    staffAccounts: true, caPortal: true, tallyExport: true,
    multiDevice: true, customInvoiceFooter: true, loyaltyPoints: true, flashSales: true,
    promoCode: true, advancedReports: true, aiForecasting: true, barcodeManager: true,
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
};

export function getCaps(user) {
  if (!user) return PLAN_CAPS.trial;
  if (user.role === 'admin') return PLAN_CAPS.enterprise;
  if (user.role === 'staff') return PLAN_CAPS.pro;
  // Map subscription field to tier
  const sub = user.subscription || 'trial';
  const tier = user.subscriptionTier || (sub === 'active' ? 'pro' : sub);
  return PLAN_CAPS[tier] ?? PLAN_CAPS.trial;
}

export function hasCap(user, feature) {
  const val = getCaps(user)[feature];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === -1 || val > 1;
  return false;
}
