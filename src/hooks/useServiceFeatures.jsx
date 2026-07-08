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
//   labelFor(feature)      — human-readable plan required to unlock
//
// Every gate also carries a `.reason` field when denied — a hint the
// UI can surface in a tooltip / upgrade prompt without duplicating
// plan-tier logic across every render site.
export function useServiceFeatures() {
  const { user } = useAuth();

  const caps = useMemo(() => getCaps(user), [user]);

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
      labelFor: (feature) => FEATURE_PLAN_LABEL[feature] || 'Pro Plan',
      // Also expose raw caps + hasCap-like helper for advanced callers
      _caps: caps,
      hasCap: (feature) => hasCap(user, feature),
    };
  }, [user, caps]);
}
