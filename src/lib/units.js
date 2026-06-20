// ─────────────────────────────────────────────────────────────────────────
//  Unit system — maps shop business category → sensible default selling unit,
//  plus the list of units a shopkeeper can pick from for each product.
//
//  Used by: Add/Edit Product modal, POS bill lines, Inventory, printed bills.
//  No DB migration required — `unit` is optional everywhere and falls back to
//  the category default when a product has no explicit unit set.
// ─────────────────────────────────────────────────────────────────────────

// All selectable units, grouped for the dropdown.
export const ALL_UNITS = [
  { value: 'pcs',   label: 'Piece (pcs)',     group: 'Count' },
  { value: 'qty',   label: 'Quantity (qty)',  group: 'Count' },
  { value: 'pair',  label: 'Pair',            group: 'Count' },
  { value: 'box',   label: 'Box',             group: 'Count' },
  { value: 'pack',  label: 'Pack',            group: 'Count' },
  { value: 'dozen', label: 'Dozen',           group: 'Count' },
  { value: 'set',   label: 'Set',             group: 'Count' },
  { value: 'kg',    label: 'Kilogram (kg)',   group: 'Weight' },
  { value: 'g',     label: 'Gram (g)',        group: 'Weight' },
  { value: 'litre', label: 'Litre (L)',       group: 'Volume' },
  { value: 'ml',    label: 'Millilitre (ml)', group: 'Volume' },
  { value: 'metre', label: 'Metre (m)',       group: 'Length' },
  { value: 'plate', label: 'Plate',           group: 'Food' },
  { value: 'cup',   label: 'Cup',             group: 'Food' },
];

// Quick lookup: unit value → short suffix shown next to quantities.
export const UNIT_SUFFIX = {
  pcs: 'pcs', qty: '', pair: 'pair', box: 'box', pack: 'pack',
  dozen: 'dozen', set: 'set', kg: 'kg', g: 'g', litre: 'L',
  ml: 'ml', metre: 'm', plate: 'plate', cup: 'cup',
};

// Whether a unit is fractional (allows 0.5, 1.25 …) or whole-count only.
export const FRACTIONAL_UNITS = new Set(['kg', 'g', 'litre', 'ml', 'metre']);

// Business category (shopCategory on the shop) → default unit + suggested units.
// `default` is pre-selected in the Add Product form; `units` are surfaced first
// in the dropdown for that business type (the full list is always available).
export const CATEGORY_UNITS = {
  grocery:     { default: 'kg',    units: ['kg', 'g', 'litre', 'ml', 'pcs', 'pack'] },
  pharmacy:    { default: 'qty',   units: ['qty', 'pcs', 'pack', 'box', 'ml'] },
  electronics: { default: 'pcs',   units: ['pcs', 'box', 'set'] },
  clothing:    { default: 'pcs',   units: ['pcs', 'pair', 'set', 'metre'] },
  footwear:    { default: 'pair',  units: ['pair', 'pcs', 'box'] },
  restaurant:  { default: 'plate', units: ['plate', 'pcs', 'cup', 'litre'] },
  salon:       { default: 'qty',   units: ['qty', 'pcs', 'ml', 'pack'] },
  hardware:    { default: 'pcs',   units: ['pcs', 'kg', 'metre', 'box', 'set'] },
  stationery:  { default: 'pcs',   units: ['pcs', 'pack', 'dozen', 'box'] },
  general:     { default: 'pcs',   units: ['pcs', 'kg', 'litre', 'pack', 'qty'] },
};

const DEFAULT_FALLBACK = { default: 'pcs', units: ['pcs', 'qty', 'kg', 'litre', 'pack'] };

// Default unit for a given shop business category.
export function defaultUnitForCategory(category) {
  return (CATEGORY_UNITS[category] || DEFAULT_FALLBACK).default;
}

// Ordered unit option list for a category — suggested units first, then the rest.
export function unitOptionsForCategory(category) {
  const cfg = CATEGORY_UNITS[category] || DEFAULT_FALLBACK;
  const suggested = cfg.units;
  const rest = ALL_UNITS.map(u => u.value).filter(v => !suggested.includes(v));
  const order = [...suggested, ...rest];
  return order.map(v => ALL_UNITS.find(u => u.value === v)).filter(Boolean);
}

// Resolve the unit to display for a product: explicit product.unit wins,
// otherwise fall back to the shop's category default.
export function resolveUnit(product, shopCategory) {
  if (product && product.unit) return product.unit;
  return defaultUnitForCategory(shopCategory);
}

// Suggested PRODUCT categories per shop business type — shown as quick-pick
// chips in Add/Edit Product, but the field stays free text since real shops
// sell mixed inventory and any fixed list will eventually be wrong for
// someone. This is just a head start, not a locked enum.
export const PRODUCT_CATEGORY_SUGGESTIONS = {
  grocery:     ['Grains', 'Oils & Ghee', 'Dairy', 'Snacks', 'Beverages', 'Cleaning', 'Spices', 'Personal Care', 'Bakery'],
  pharmacy:    ['Medicines', 'Personal Care', 'Baby Care', 'Health Devices', 'Supplements', 'First Aid'],
  electronics: ['Mobiles', 'Accessories', 'Home Appliances', 'Audio', 'Cables & Chargers', 'Computers'],
  clothing:    ['Shirts', 'Trousers', 'Sarees', 'Kidswear', 'Ethnic Wear', 'Innerwear', 'Winterwear'],
  footwear:    ['Sandals', 'Sneakers', 'Formal Shoes', 'Slippers', 'Kids Footwear'],
  restaurant:  ['Starters', 'Main Course', 'Beverages', 'Desserts', 'Combos'],
  salon:       ['Hair Care', 'Skin Care', 'Tools & Equipment', 'Cosmetics', 'Fragrances'],
  hardware:    ['Tools', 'Electricals', 'Plumbing', 'Paints', 'Fasteners', 'Sanitary'],
  stationery:  ['Notebooks', 'Pens & Pencils', 'Art Supplies', 'Office Supplies', 'Files & Folders'],
  general:     ['Grocery', 'Household', 'Personal Care', 'Stationery', 'Misc'],
};

export function categorySuggestionsFor(shopCategory) {
  return PRODUCT_CATEGORY_SUGGESTIONS[shopCategory] || PRODUCT_CATEGORY_SUGGESTIONS.general;
}

// Format a quantity with its unit suffix, e.g. (2, 'pair') → "2 pair",
// (1.5, 'kg') → "1.5 kg", (3, 'qty') → "3".
export function formatQty(qty, unit) {
  const suffix = UNIT_SUFFIX[unit] ?? unit ?? '';
  const n = Number(qty);
  const num = Number.isInteger(n) ? n : parseFloat(n.toFixed(3));
  return suffix ? `${num} ${suffix}` : `${num}`;
}

// Step size for +/- controls in POS for a unit (fractional units step by 0.5).
export function stepForUnit(unit) {
  return FRACTIONAL_UNITS.has(unit) ? 0.5 : 1;
}
