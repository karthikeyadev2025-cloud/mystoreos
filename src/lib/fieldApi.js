// ═══════════════════════════════════════════════════════════════════
// FIELD DISTRIBUTION API
//
// Deliberately a SEPARATE module from src/lib/api.js, which is already
// 5,514 lines. Field distribution is a large enough subsystem that
// folding it into that file would make both harder to work on.
//
// Everything here operates on the Phase 1 tables (warehouses,
// vehicles, field_reps, warehouse_stock, stock_transfers). Nothing in
// this file touches shop billing, products, or orders.
// ═══════════════════════════════════════════════════════════════════

import { isSupabaseConfigured, supabase } from './supabase';

const requireOnline = () => {
  if (!isSupabaseConfigured) throw new Error('Field setup requires an online connection.');
};

export const fieldApi = {

  // ─── WAREHOUSES ───────────────────────────────────────────────────
  async getWarehouses(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data } = await supabase.from('warehouses')
      .select('*').eq('distributor_id', distributorId).eq('active', true)
      .order('type').order('name');
    return (data || []).map(r => ({
      id: r.id, name: r.name, type: r.type,
      parentWarehouseId: r.parent_warehouse_id,
      address: r.address, latitude: r.latitude, longitude: r.longitude,
      createdAt: r.created_at,
    }));
  },

  async createWarehouse(distributorId, { name, type = 'main', address = '', latitude = null, longitude = null }) {
    requireOnline();
    if (!name?.trim()) throw new Error('Warehouse name is required');
    const { data, error } = await supabase.from('warehouses').insert({
      distributor_id: distributorId,
      name: name.trim(),
      type,
      address: address?.trim() || null,
      latitude, longitude,
    }).select().maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  // Soft deactivate — never hard delete. Historical stock movements
  // reference this warehouse and must stay resolvable.
  async deactivateWarehouse(warehouseId) {
    requireOnline();
    const { error } = await supabase.from('warehouses')
      .update({ active: false }).eq('id', warehouseId);
    if (error) throw new Error(error.message);
    return true;
  },

  // ─── VEHICLES ─────────────────────────────────────────────────────
  async getVehicles(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data } = await supabase.from('vehicles')
      .select('*, warehouses!vehicles_warehouse_id_fkey(name)')
      .eq('distributor_id', distributorId).eq('active', true)
      .order('code');
    return (data || []).map(r => ({
      id: r.id, code: r.code, registrationNo: r.registration_no,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouses?.name || r.code,
      createdAt: r.created_at,
    }));
  },

  // Goes through the create_field_vehicle() RPC rather than four
  // separate client-side inserts — a failure partway through would
  // otherwise leave a phantom warehouse with no vehicle, which then
  // shows up in stock reports forever.
  async createVehicle(distributorId, { code, name, registrationNo = '', parentWarehouseId = null }) {
    requireOnline();
    if (!code?.trim()) throw new Error('Vehicle code is required (e.g. V04)');
    const { data, error } = await supabase.rpc('create_field_vehicle', {
      p_distributor_id: distributorId,
      p_code: code.trim(),
      p_name: name?.trim() || code.trim(),
      p_registration: registrationNo?.trim() || null,
      p_parent_wh_id: parentWarehouseId,
    });
    if (error) {
      if (/duplicate key/i.test(error.message)) {
        throw new Error(`Vehicle code "${code.trim().toUpperCase()}" already exists.`);
      }
      throw new Error(error.message);
    }
    return data; // new vehicle id
  },

  async deactivateVehicle(vehicleId) {
    requireOnline();
    const { error } = await supabase.from('vehicles')
      .update({ active: false }).eq('id', vehicleId);
    if (error) throw new Error(error.message);
    return true;
  },

  // ─── STOCK ────────────────────────────────────────────────────────
  // Per-warehouse stock in base units, with product names resolved.
  async getWarehouseStock(warehouseId) {
    if (!isSupabaseConfigured || !warehouseId) return [];
    const { data } = await supabase.from('warehouse_stock')
      .select('*, distributor_products(name, unit)')
      .eq('warehouse_id', warehouseId).gt('qty_base', 0);
    return (data || []).map(r => ({
      id: r.id,
      productId: r.product_id,
      productName: r.distributor_products?.name || 'Unknown product',
      batchId: r.batch_id,
      qtyBase: Number(r.qty_base),
      condition: r.condition,
    }));
  },

  // ─── DOCUMENT SERIES ──────────────────────────────────────────────
  // Each van's disjoint invoice/credit-note numbering — the mechanism
  // that makes offline billing collision-proof.
  async getVehicleSeries(vehicleId) {
    if (!isSupabaseConfigured || !vehicleId) return [];
    const { data } = await supabase.from('van_document_series')
      .select('*').eq('vehicle_id', vehicleId).order('doc_type');
    return (data || []).map(r => ({
      docType: r.doc_type, prefix: r.prefix, lastSyncedNo: r.last_synced_no,
    }));
  },

  // ─── STOCK TRANSFERS ──────────────────────────────────────────────
  // Created as 'pending', applied on confirmation. That two-step is
  // deliberate, not an artefact: the depot builds the load, the driver
  // confirms what physically went on the van. Neither side can silently
  // change the other's number.
  async createTransfer(distributorId, { fromWarehouseId, toWarehouseId, kind = 'load_out', lines, note = '' }) {
    requireOnline();
    if (!fromWarehouseId || !toWarehouseId) throw new Error('Pick both a source and a destination');
    if (fromWarehouseId === toWarehouseId) throw new Error('Source and destination must be different');
    if (!lines?.length) throw new Error('Add at least one product');

    const { data: transfer, error: tErr } = await supabase.from('stock_transfers').insert({
      distributor_id: distributorId,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      kind,
      note: note?.trim() || null,
    }).select('id').maybeSingle();
    if (tErr) throw new Error(tErr.message);

    const { error: lErr } = await supabase.from('stock_transfer_lines').insert(
      lines.map(l => ({
        transfer_id: transfer.id,
        product_id: l.productId,
        batch_id: l.batchId || null,
        qty_base: l.qtyBase,
        condition: l.condition || 'sellable',
      }))
    );
    if (lErr) {
      // Don't leave a headerless transfer behind.
      await supabase.from('stock_transfers').delete().eq('id', transfer.id);
      throw new Error(lErr.message);
    }
    return transfer.id;
  },

  // Runs apply_stock_transfer() — decrements source, increments
  // destination, atomically. Rejects if the source doesn't actually
  // hold the stock, which is what stops goods vanishing between the
  // depot gate and the shop.
  async confirmTransfer(transferId) {
    requireOnline();
    const { error } = await supabase.rpc('apply_stock_transfer', { p_transfer_id: transferId });
    if (error) throw new Error(error.message);
    return true;
  },

  async getTransfers(distributorId, { status = null, limit = 50 } = {}) {
    if (!isSupabaseConfigured || !distributorId) return [];
    let q = supabase.from('stock_transfers')
      .select('*, from:warehouses!stock_transfers_from_warehouse_id_fkey(name), to:warehouses!stock_transfers_to_warehouse_id_fkey(name), stock_transfer_lines(id, qty_base, product_id, distributor_products(name))')
      .eq('distributor_id', distributorId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return (data || []).map(r => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      fromName: r.from?.name || '—',
      toName: r.to?.name || '—',
      note: r.note,
      createdAt: r.created_at,
      confirmedAt: r.confirmed_at,
      lines: (r.stock_transfer_lines || []).map(l => ({
        id: l.id,
        productId: l.product_id,
        productName: l.distributor_products?.name || 'Unknown',
        qtyBase: Number(l.qty_base),
      })),
    }));
  },

  // Products for the load-out picker. Uses distributor_products.unit /
  // pack_size (already populated) rather than the product_uoms ladder,
  // which has no data until the UoM management screen exists.
  async getTransferableProducts(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data } = await supabase.from('distributor_products')
      .select('id, name, unit, pack_size, sku').eq('distributor_id', distributorId).order('name');
    return (data || []).map(r => ({
      id: r.id, name: r.name, unit: r.unit, packSize: r.pack_size, sku: r.sku,
    }));
  },
};

export default fieldApi;
