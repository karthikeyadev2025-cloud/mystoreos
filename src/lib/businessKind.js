// Shared service-business detection for accounts that predate the
// explicit business_kind field.
//
// Registration's category field is FREE TEXT ("e.g. Salon, Clinic,
// Gym…"), not a fixed dropdown, so real values in the DB include "Spa",
// "Beauty Parlour", "Hair Salon", "Dental Clinic", "Bike Repair Shop",
// "Yoga Studio", etc. — arbitrary capitalization and phrasing.
//
// This used to be re-implemented independently in three separate files
// (ShopDashboard.jsx, DesktopSidebar.jsx, and a duplicate effect further
// down ShopDashboard.jsx) as an exact, case-sensitive match against 5
// hardcoded lowercase words. Any real category typed with different
// casing or wording — e.g. "Spa" with a capital S, which is exactly what
// a real shop named "karthikeya spa" had — silently failed the match and
// fell through to the retail dashboard on both mobile and desktop.
//
// isServiceCategory() does a case-insensitive keyword search instead,
// and lives in ONE place so all three call sites can never drift out of
// sync with each other again.
export const SERVICE_CATEGORY_KEYWORDS = [
  'salon', 'saloon', 'spa', 'clinic', 'fitness', 'gym', 'repair',
  'parlour', 'parlor', 'massage', 'wellness', 'dental', 'physio',
  'yoga', 'studio', 'tailor', 'barber',
];

export function isServiceCategory(categoryText) {
  if (!categoryText) return false;
  const t = String(categoryText).toLowerCase();
  return SERVICE_CATEGORY_KEYWORDS.some(kw => t.includes(kw));
}

// businessKind is the authoritative field (set once at signup, locked).
// Only falls back to category-text matching when it's null — i.e. an
// account that predates the field existing.
export function isServiceBusinessKind(businessKind, shopCategory) {
  return businessKind === 'service' || (!businessKind && isServiceCategory(shopCategory));
}
