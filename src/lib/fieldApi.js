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
};

export default fieldApi;
