// ═══════════════════════════════════════════════════════════════════
// VAN BILLING QUEUE — the offline core of Phase 3
//
// Deliberately NOT built on the existing offlineQueue.js. That queue
// is a thin, generic insert/update/delete replay with no domain
// awareness — it has no concept of "this device owns a numbered
// series" or "this specific write decrements physical stock." Van
// billing needs both, and forcing them into a generic queue would
// make failures nearly impossible to diagnose (is a wrong total a
// sync bug or a sequencing bug?).
//
// THE CORE GUARANTEE: invoice numbers are allocated ON THE DEVICE,
// before any network call. A rep can sell to 40 shops with zero
// signal all day. Numbers can never collide across vans (each van's
// series is disjoint — see the Phase 3a migration), and a retried
// sync of the same invoice is idempotent server-side, so a flaky
// connection can NEVER double-sell or double-decrement stock.
//
// Storage: localStorage, not IndexedDB. Van billing volume (a few
// dozen invoices per rep per day) doesn't need IndexedDB's complexity,
// and localStorage is synchronous, which keeps the offline path
// simple and easy to reason about under a bad-connection retry loop.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from './supabase';

const KEY_PREFIX = 'mystore_van_';
const seriesKey = (vehicleId) => `${KEY_PREFIX}series_${vehicleId}`;
const pendingKey = (vehicleId) => `${KEY_PREFIX}pending_${vehicleId}`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* storage full or unavailable — invoice stays in memory for this session, which is the best that can be done */ }
}

/**
 * Must be called ONCE, while online — typically right after load-out.
 * Fetches this van's current series position from the server so a
 * fresh or reinstalled device doesn't restart numbering at 1 and
 * collide with invoices already issued.
 */
export async function primeSeries(vehicleId) {
  const { data, error } = await supabase.rpc('get_van_series_position', {
    p_vehicle_id: vehicleId, p_doc_type: 'invoice',
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error('This van has no invoice series — check Field Setup.');
  writeJSON(seriesKey(vehicleId), { prefix: row.prefix, lastNo: row.last_no });
  return { prefix: row.prefix, lastNo: row.last_no };
}

export function getSeriesState(vehicleId) {
  return readJSON(seriesKey(vehicleId), null);
}

/**
 * Allocates the next invoice number for this van. Pure local
 * arithmetic — no network call, which is what makes it work with zero
 * signal. Persisted immediately so two rapid sales (or a page reload
 * mid-sale) can't hand out the same number twice on one device.
 */
export function allocateInvoiceNumber(vehicleId) {
  const state = getSeriesState(vehicleId);
  if (!state) throw new Error('Van not primed for billing yet — go online once first.');
  const nextNo = state.lastNo + 1;
  writeJSON(seriesKey(vehicleId), { ...state, lastNo: nextNo });
  const ref = `${state.prefix}${String(nextNo).padStart(5, '0')}`;
  return { invoiceNo: nextNo, invoiceRef: ref };
}

/**
 * Records a completed sale locally and queues it for sync. Returns
 * immediately — this is what makes checkout instant regardless of
 * connectivity.
 */
export function queueInvoice(vehicleId, invoice) {
  const pending = readJSON(pendingKey(vehicleId), []);
  pending.push({ ...invoice, queuedAt: new Date().toISOString(), synced: false });
  writeJSON(pendingKey(vehicleId), pending);
  return invoice;
}

export function getPendingInvoices(vehicleId) {
  return readJSON(pendingKey(vehicleId), []).filter(i => !i.synced);
}

export function getAllLocalInvoices(vehicleId) {
  return readJSON(pendingKey(vehicleId), []);
}

/**
 * Pushes every unsynced invoice for this van to the server, in
 * allocation order. Each call is independently safe to retry — the
 * server-side idempotency (same vehicle_id + invoice_no returns the
 * existing row) means calling this repeatedly, or having it partially
 * fail and run again later, can never create a duplicate sale.
 *
 * Failures don't abort the batch: one bad invoice (e.g. a vehicle
 * that got deactivated mid-day) shouldn't block the other thirty-nine
 * from syncing.
 */
export async function syncPendingInvoices(vehicleId) {
  const all = readJSON(pendingKey(vehicleId), []);
  const pending = all.filter(i => !i.synced);
  let ok = 0, failed = 0;

  for (const inv of pending) {
    try {
      const { error } = await supabase.rpc('sync_van_invoice', {
        p_distributor_id: inv.distributorId,
        p_vehicle_id: vehicleId,
        p_shop_id: inv.shopId,
        p_invoice_no: inv.invoiceNo,
        p_invoice_ref: inv.invoiceRef,
        p_issued_at: inv.issuedAt,
        p_total: inv.total,
        p_payment_mode: inv.paymentMode,
        p_amount_paid: inv.amountPaid,
        p_lines: inv.lines,
        p_rep_id: inv.repId || null,
      });
      if (error) throw new Error(error.message);
      inv.synced = true;
      ok++;
    } catch (e) {
      inv.lastError = e.message;
      failed++;
    }
  }

  writeJSON(pendingKey(vehicleId), all);
  return { ok, failed, remaining: all.filter(i => !i.synced).length };
}

export default {
  primeSeries, getSeriesState, allocateInvoiceNumber,
  queueInvoice, getPendingInvoices, getAllLocalInvoices, syncPendingInvoices,
};
