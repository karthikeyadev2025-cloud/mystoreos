// Subscription plan capabilities — single source of truth for feature gating.
// Keeps these in sync with the `capabilities` objects in api.getSubscriptionPlans().
export const PLAN_CAPS = {
  starter: {
    maxProducts: 200, maxDevices: 1,
    whatsappShare: false, batchExpiry: false, gst: false,
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
  whatsappShare: 'Pro Plan',
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
