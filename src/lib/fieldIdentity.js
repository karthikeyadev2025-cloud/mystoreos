// ═══════════════════════════════════════════════════════════════════
// FIELD IDENTITY
//
// Every field screen needs to answer two DIFFERENT questions, and
// conflating them is exactly how attribution data gets corrupted:
//
//   "Whose business is this?"  -> distributorId  (the owner's id)
//   "Who is doing this?"       -> actorId        (the logged-in person)
//
// For a distributor OWNER these are the same id, which is why the
// original code got away with using user.id for both. For a STAFF
// member — a field rep — they are different, and using the rep's own
// id as the business id makes every query return nothing.
//
// ShopDashboard has always resolved this correctly via targetShopId.
// DistributorDashboard and the field screens never needed to until
// reps could actually log in.
// ═══════════════════════════════════════════════════════════════════

/**
 * The distributor whose data should be read/written.
 * Staff resolve to their employer; owners resolve to themselves.
 */
export function distributorIdOf(user) {
  if (!user) return null;
  return user.role === 'staff' ? (user.staff_of || user.staffOf || null) : user.id;
}

/**
 * The person performing the action — used for rep attribution on
 * visits, invoices, returns and settlements. Always the logged-in
 * user, never the employer, so "who did this" stays truthful.
 */
export function actorIdOf(user) {
  return user?.id || null;
}

export default { distributorIdOf, actorIdOf };
