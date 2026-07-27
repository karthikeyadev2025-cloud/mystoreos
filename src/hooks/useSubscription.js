import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { getCaps, hasCap } from '../lib/features';
import { isTrialExpired } from '../lib/api';

// Returns the current user's subscription state and feature capabilities.
//
// isExpired  — trial ran out OR subscription = 'expired' OR plan_expires_at is in the past
// isOnTrial  — currently within the 15-day free trial
// planLabel  — human-readable plan name for display
// capabilities — raw caps object (maxProducts, maxDevices, etc.)
// hasFeature(key) — boolean gate check for a named capability
export function useSubscription() {
  const { user } = useAuth();

  const capabilities = useMemo(() => getCaps(user), [user]);

  const isExpired = useMemo(() => {
    // Was `user.role !== 'shop'` — which meant a DISTRIBUTOR could never
    // be expired at all, no matter how long past their trial. Combined
    // with expire-trials missing 'dist_trial' entirely, distributors
    // used the product free indefinitely. Both roles pay, so both
    // expire.
    if (!user || (user.role !== 'shop' && user.role !== 'distributor')) return false;
    if (user.subscription === 'expired') return true;
    if (isTrialExpired(user)) return true;
    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) return true;
    return false;
  }, [user]);

  const isOnTrial = useMemo(
    // Was `... && !user.subscriptionTier` — but subscriptionTier is
    // ALWAYS populated at signup (starter, service_starter, or
    // basic_distributor), so that guard could never actually be true
    // for any real shop. Every trial-period shop saw their own plan
    // mislabeled below as "Starter Plan" instead of "Free Trial" — not
    // a capability bug (getCaps()/hasCap() already correctly check
    // subscription === 'trial' directly, unaffected by this), purely a
    // confusing display label.
    () => !!(user && user.subscription === 'trial' && !isTrialExpired(user) && user.subscription !== 'active'),
    [user]
  );

  const planLabel = useMemo(() => {
    if (!user) return 'Starter Plan';
    if (user.role === 'admin') return 'Enterprise (Admin)';
    if (isOnTrial) return 'Free Trial';
    const tier = user.subscriptionTier || 'starter';
    if (tier === 'pro') return 'Premium PRO Plan';
    if (tier === 'enterprise') return 'Enterprise Ultra Plan';
    return 'Starter Plan';
  }, [user, isOnTrial]);

  return {
    capabilities,
    hasFeature: (feature) => hasCap(user, feature),
    isExpired,
    isOnTrial,
    planLabel,
  };
}
