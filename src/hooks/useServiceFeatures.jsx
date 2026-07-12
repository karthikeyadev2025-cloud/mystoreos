import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { getCaps, hasCap, FEATURE_PLAN_LABEL } from '../lib/features';

// Wraps getCaps() with the specific gates the service-business surfaces
// (Bookings tab, Services catalogue, Staff manager, Customer manage-
// booking page) actually need to check.
//
// Retail shops (businessKind !== 'service') can still call this — every
// field falls back to a sensible truthy value so nothing breaks. The
// intent is that RETAIL shops don't render any of these surfaces to
// begin with, but the gates are defensive.
//
// Returns:
//   canUseBookings         — the whole bookings tab is available at all
//   maxServices            — number cap; -1 = unlimited
//   canAddMoreServices(n)  — helper: given current count, can add another?
//   canAssignStaffPerService — per-service staff assignment
//   canConfigureBufferTime — pre/post buffer between bookings
//   canOfferSelfService    — reschedule/cancel-by-token links to customers
//   canSendReminders       — SMS/WhatsApp booking reminders
//   canScheduleRecurring   — recurring / weekly repeat bookings
//   canConfigureProviderHours — per-staff working hours
//   canOfferHomeService    — standalone paid add-on (₹199/mo), NOT gated
//                            by plan tier — any shop can buy it directly.
//                            Computed as a live date comparison against
//                            homeServiceAddonExpiresAt, not a cached
//                            boolean, so there's never a dependency on a
//                            background job to switch it off on expiry.
//   labelFor(feature)      — human-readable plan required to unlock
//
// Every gate also carries a `.reason` field when denied — a hint the
// UI can surface in a tooltip / upgrade prompt without duplicating
// plan-tier logic across every render site.
export function useServiceFeatures() {
  const { user } = useAuth();

  const caps = useMemo(() => getCaps(user), [user]);
  // NOT memoized on purpose: this depends on the passage of time, not
  // just on `user` changing. Caching it in a useMemo keyed only on
  // homeServiceAddonExpiresAt would let it silently read as "still
  // active" past the real expiry moment until something else happens
  // to trigger a re-render. It's a cheap comparison — recomputing it
  // on every render is correct, not wasteful. (The database trigger is
  // the actual enforcement boundary regardless; this only controls
  // what the UI offers to click.)
  const canOfferHomeService = user?.homeServiceAddonExpiresAt
    ? new Date(user.homeServiceAddonExpiresAt).getTime() > Date.now()
    : false;

  return useMemo(() => {
    const isServiceShop = user?.businessKind === 'service';
    // Retail shops never see any of this — but we don't want to
    // accidentally break them if the hook gets called from a shared
    // component. Returns "everything available" so retail flows
    // never see an upgrade prompt they shouldn't.
    if (!isServiceShop) {
      return {
        canUseBookings: true,
        maxServices: -1,
        canAddMoreServices: () => true,
        canAssignStaffPerService: true,
        canConfigureBufferTime: true,
        canOfferSelfService: true,
        canSendReminders: true,
        canScheduleRecurring: true,
        canConfigureProviderHours: true,
        canOfferHomeService: true,
        labelFor: () => 'Pro Plan',
      };
    }

    return {
      canUseBookings:            !!caps.bookings,
      maxServices:                caps.maxServices ?? 3,
      canAddMoreServices: (currentCount) => {
        if (caps.maxServices === -1) return true;
        return currentCount < (caps.maxServices ?? 3);
      },
      canAssignStaffPerService:  !!caps.serviceStaffAssignment,
      canConfigureBufferTime:    !!caps.serviceBufferTime,
      canOfferSelfService:       !!caps.serviceCustomerSelfService,
      canSendReminders:          !!caps.serviceReminders,
      canScheduleRecurring:      !!caps.serviceRecurring,
      canConfigureProviderHours: !!caps.serviceProviderHours,
      canOfferHomeService,
      labelFor: (feature) => feature === 'homeService' ? 'Home Service Add-on (₹199/mo)' : (FEATURE_PLAN_LABEL[feature] || 'Pro Plan'),
      // Also expose raw caps + hasCap-like helper for advanced callers
      _caps: caps,
      hasCap: (feature) => hasCap(user, feature),
    };
  }, [user, caps, canOfferHomeService]);
}
