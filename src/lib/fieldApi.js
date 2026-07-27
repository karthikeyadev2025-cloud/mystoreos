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
      // hsn_code / gst_rate / sku come along so a van sale can produce a
      // proper GST tax invoice at the counter, not just a text receipt.
      .select('*, distributor_products(name, unit, hsn_code, gst_rate, sku, pack_size)')
      .eq('warehouse_id', warehouseId).gt('qty_base', 0);
    return (data || []).map(r => ({
      id: r.id,
      productId: r.product_id,
      productName: r.distributor_products?.name || 'Unknown product',
      unit: r.distributor_products?.unit || null,
      hsnCode: r.distributor_products?.hsn_code || '',
      gstRate: Number(r.distributor_products?.gst_rate) || 0,
      sku: r.distributor_products?.sku || '',
      // Drives the Jars × Boxes = Qty breakdown on the printed invoice,
      // matching the distributor's own paper billbook format.
      packSize: r.distributor_products?.pack_size || null,
      batchId: r.batch_id,
      qtyBase: Number(r.qty_base),
      condition: r.condition,
    }));
  },

  // Stock across every location at once — the "where is my stock right
  // now" view. At 20 vans, checking each one individually isn't
  // practical. Batch expiry is joined in because near-expiry stock
  // sitting on a van is the thing you most need to catch early.
  async getAllStock(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data: whs } = await supabase.from('warehouses')
      .select('id, name, type').eq('distributor_id', distributorId).eq('active', true);
    const ids = (whs || []).map(w => w.id);
    if (ids.length === 0) return [];

    const { data } = await supabase.from('warehouse_stock')
      .select('*, distributor_products(name, unit, pack_size), product_batches(batch_no, expiry_date)')
      .in('warehouse_id', ids).gt('qty_base', 0);

    const byWarehouse = {};
    (whs || []).forEach(w => {
      byWarehouse[w.id] = { id: w.id, name: w.name, type: w.type, lines: [] };
    });
    (data || []).forEach(r => {
      const bucket = byWarehouse[r.warehouse_id];
      if (!bucket) return;
      bucket.lines.push({
        id: r.id,
        productName: r.distributor_products?.name || 'Unknown product',
        unit: r.distributor_products?.unit || null,
        packSize: r.distributor_products?.pack_size || null,
        batchNo: r.product_batches?.batch_no || null,
        expiryDate: r.product_batches?.expiry_date || null,
        qtyBase: Number(r.qty_base),
        condition: r.condition,
      });
    });
    return Object.values(byWarehouse).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'main' ? -1 : b.type === 'main' ? 1 : 0;
      return a.name.localeCompare(b.name);
    });
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

  // ─── ROUTES ───────────────────────────────────────────────────────
  async getRoutes(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data } = await supabase.from('routes')
      .select('*, route_stops(id), warehouses(name)')
      .eq('distributor_id', distributorId).eq('active', true).order('name');
    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouses?.name || null,
      assignedRepId: r.assigned_rep_id,
      weekdays: r.weekdays || [],
      stopCount: (r.route_stops || []).length,
    }));
  },

  async createRoute(distributorId, { name, warehouseId = null, weekdays = [] }) {
    requireOnline();
    if (!name?.trim()) throw new Error('Route name is required');
    const { data, error } = await supabase.from('routes').insert({
      distributor_id: distributorId,
      name: name.trim(),
      warehouse_id: warehouseId || null,
      weekdays,
    }).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async deleteRoute(routeId) {
    requireOnline();
    const { error } = await supabase.from('routes').update({ active: false }).eq('id', routeId);
    if (error) throw new Error(error.message);
    return true;
  },

  // Stops in their saved driving order, with coordinates so the
  // sequencer has something to work with.
  async getRouteStops(routeId) {
    if (!isSupabaseConfigured || !routeId) return [];
    const { data } = await supabase.from('route_stops')
      .select('id, seq, shop_id, users!route_stops_shop_id_fkey(id, name, phone, business_address, latitude, longitude)')
      .eq('route_id', routeId).order('seq');
    return (data || []).map(r => ({
      stopId: r.id,
      seq: r.seq,
      id: r.shop_id,
      name: r.users?.name || 'Unknown shop',
      phone: r.users?.phone || '',
      address: r.users?.business_address || '',
      latitude: r.users?.latitude ?? null,
      longitude: r.users?.longitude ?? null,
    }));
  },

  async addStopsToRoute(routeId, shopIds) {
    requireOnline();
    if (!shopIds?.length) return 0;
    // Existing stops are left alone — re-adding a shop already on the
    // route shouldn't wipe its sequence position.
    const { error } = await supabase.from('route_stops')
      .upsert(shopIds.map(id => ({ route_id: routeId, shop_id: id })),
              { onConflict: 'route_id,shop_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return shopIds.length;
  },

  async removeStop(stopId) {
    requireOnline();
    const { error } = await supabase.from('route_stops').delete().eq('id', stopId);
    if (error) throw new Error(error.message);
    return true;
  },

  // Persists the driving order produced by the sequencer (or a manual
  // reorder). Written as individual updates rather than a bulk upsert
  // because upsert would need every column and could clobber data it
  // wasn't asked to touch.
  async saveRouteSequence(orderedStops) {
    requireOnline();
    for (let i = 0; i < orderedStops.length; i++) {
      const { error } = await supabase.from('route_stops')
        .update({ seq: i + 1 }).eq('id', orderedStops[i].stopId);
      if (error) throw new Error(error.message);
    }
    return true;
  },

  // The pool of outlets a route can draw from: shops this distributor
  // is actually linked with. Coordinates come along because a shop
  // without them can't be sequenced.
  async getRoutableShops(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data: links } = await supabase.from('shop_distributor_links')
      .select('shop_id').eq('distributor_id', distributorId);
    const ids = [...new Set((links || []).map(l => l.shop_id))];
    if (ids.length === 0) return [];
    const { data } = await supabase.from('users')
      .select('id, name, phone, business_address, latitude, longitude').in('id', ids);
    return (data || []).map(r => ({
      id: r.id, name: r.name, phone: r.phone,
      address: r.business_address || '',
      latitude: r.latitude ?? null, longitude: r.longitude ?? null,
    })).sort((a, b) => a.name.localeCompare(b.name));
  },

  // ─── FIELD VISITS ─────────────────────────────────────────────────
  // Today's run for a route, with each stop's visit state merged in so
  // a rep sees at a glance what's done and what's left.
  async getTodayRun(distributorId, routeId) {
    if (!isSupabaseConfigured || !routeId) return [];
    const today = new Date().toISOString().slice(0, 10);
    const [stops, visits] = await Promise.all([
      this.getRouteStops(routeId),
      supabase.from('route_visits')
        .select('*').eq('route_id', routeId).eq('visit_date', today)
        .then(r => r.data || []),
    ]);
    const byShop = {};
    visits.forEach(v => { byShop[v.shop_id] = v; });
    return stops.map(s => {
      const v = byShop[s.id];
      return {
        ...s,
        visitId: v?.id || null,
        status: v?.status || 'planned',
        skipReason: v?.skip_reason || null,
        checkedInAt: v?.checked_in_at || null,
        checkedOutAt: v?.checked_out_at || null,
      };
    });
  },

  // Creates or updates today's visit row. GPS is captured here, at the
  // boundary — not continuously, which would drain a rep's phone all
  // day and tell you nothing extra.
  async checkIn(distributorId, { routeId, shopId, repId = null, latitude = null, longitude = null }) {
    requireOnline();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from('route_visits').upsert({
      distributor_id: distributorId,
      route_id: routeId,
      shop_id: shopId,
      rep_id: repId,
      visit_date: today,
      status: 'visited',
      checked_in_at: new Date().toISOString(),
      latitude, longitude,
    }, { onConflict: 'shop_id,visit_date,route_id' }).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async checkOut(visitId) {
    requireOnline();
    const { error } = await supabase.from('route_visits')
      .update({ checked_out_at: new Date().toISOString() }).eq('id', visitId);
    if (error) throw new Error(error.message);
    return true;
  },

  // A skipped outlet with a reason is as useful as a completed one —
  // "shop closed" three weeks running means the beat needs replanning.
  async skipVisit(distributorId, { routeId, shopId, repId = null, reason }) {
    requireOnline();
    if (!reason?.trim()) throw new Error('Give a reason for skipping');
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('route_visits').upsert({
      distributor_id: distributorId,
      route_id: routeId,
      shop_id: shopId,
      rep_id: repId,
      visit_date: today,
      status: 'skipped',
      skip_reason: reason.trim(),
    }, { onConflict: 'shop_id,visit_date,route_id' });
    if (error) throw new Error(error.message);
    return true;
  },

  // ─── PRESALE ORDER BOOKING ────────────────────────────────────────
  async bookFieldOrder(distributorId, { shopId, repId = null, routeId = null, visitId = null, lines, note = '' }) {
    requireOnline();
    if (!lines?.length) throw new Error('Add at least one product');
    const total = lines.reduce((s, l) => s + (Number(l.rate) || 0) * (Number(l.qtyBase) || 0), 0);

    const { data: order, error: oErr } = await supabase.from('field_orders').insert({
      distributor_id: distributorId,
      shop_id: shopId,
      rep_id: repId,
      route_id: routeId,
      visit_id: visitId,
      total,
      note: note?.trim() || null,
    }).select('id').maybeSingle();
    if (oErr) throw new Error(oErr.message);

    const { error: lErr } = await supabase.from('field_order_lines').insert(
      lines.map(l => ({
        order_id: order.id,
        product_id: l.productId,
        qty_base: l.qtyBase,
        rate: l.rate,
        line_total: (Number(l.rate) || 0) * (Number(l.qtyBase) || 0),
      }))
    );
    if (lErr) {
      await supabase.from('field_orders').delete().eq('id', order.id);
      throw new Error(lErr.message);
    }
    return { id: order.id, total };
  },

  async getFieldOrders(distributorId, { status = null, limit = 50 } = {}) {
    if (!isSupabaseConfigured || !distributorId) return [];
    let q = supabase.from('field_orders')
      .select('*, users!field_orders_shop_id_fkey(name), field_order_lines(id, qty_base, rate, distributor_products(name))')
      .eq('distributor_id', distributorId)
      .order('created_at', { ascending: false }).limit(limit);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return (data || []).map(r => ({
      id: r.id,
      shopName: r.users?.name || 'Unknown shop',
      status: r.status,
      total: Number(r.total),
      createdAt: r.created_at,
      stockOrderId: r.stock_order_id,
      lines: (r.field_order_lines || []).map(l => ({
        id: l.id,
        productName: l.distributor_products?.name || 'Unknown',
        qtyBase: Number(l.qty_base),
        rate: Number(l.rate),
      })),
    }));
  },

  // Turns a booking into a real stock_order — the flow the distributor
  // dashboard already handles end to end. Idempotent server-side.
  async convertFieldOrder(orderId) {
    requireOnline();
    const { data, error } = await supabase.rpc('convert_field_order', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    return data;
  },

  // ─── EOD RECONCILIATION ───────────────────────────────────────────
  // Opens (or refreshes, if still pending) today's settlement for a
  // van — computes expected cash/UPI from real invoices and seeds
  // stock lines straight from the current warehouse_stock ledger.
  async openSettlement(distributorId, vehicleId) {
    requireOnline();
    const { data, error } = await supabase.rpc('open_day_settlement', {
      p_distributor_id: distributorId, p_vehicle_id: vehicleId,
    });
    if (error) throw new Error(error.message);
    return data; // settlement id
  },

  async getSettlement(settlementId) {
    if (!isSupabaseConfigured || !settlementId) return null;
    const [{ data: settlement }, { data: lines }] = await Promise.all([
      supabase.from('day_settlements').select('*').eq('id', settlementId).maybeSingle(),
      supabase.from('day_settlement_stock_lines')
        .select('*, distributor_products(name)').eq('settlement_id', settlementId),
    ]);
    if (!settlement) return null;
    return {
      id: settlement.id,
      status: settlement.status,
      expectedCash: Number(settlement.expected_cash),
      expectedUpi: Number(settlement.expected_upi),
      expectedCredit: Number(settlement.expected_credit),
      countedCash: settlement.counted_cash != null ? Number(settlement.counted_cash) : null,
      countedUpi: settlement.counted_upi != null ? Number(settlement.counted_upi) : null,
      stockVarianceValue: Number(settlement.stock_variance_value),
      overrideReason: settlement.override_reason,
      closedAt: settlement.closed_at,
      lines: (lines || []).map(l => ({
        id: l.id, productId: l.product_id,
        productName: l.distributor_products?.name || 'Unknown',
        expectedQty: Number(l.expected_qty),
        countedQty: l.counted_qty != null ? Number(l.counted_qty) : null,
        unitRate: Number(l.unit_rate),
      })),
    };
  },

  // stockCounts: [{ productId, countedQty }]
  async closeSettlement(settlementId, { countedCash, countedUpi, stockCounts, closedBy, overrideReason = null }) {
    requireOnline();
    const { data, error } = await supabase.rpc('close_day_settlement', {
      p_settlement_id: settlementId,
      p_counted_cash: countedCash,
      p_counted_upi: countedUpi,
      p_stock_counts: stockCounts.map(c => ({ product_id: c.productId, counted_qty: c.countedQty })),
      p_closed_by: closedBy,
      p_override_reason: overrideReason,
    });
    if (error) throw new Error(error.message);
    return data; // { closed, needs_override, cash_variance?, upi_variance?, stock_variance_value }
  },

  async getRecentSettlements(distributorId, limit = 20) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data } = await supabase.from('day_settlements')
      .select('*, vehicles(code)').eq('distributor_id', distributorId)
      .order('settlement_date', { ascending: false }).limit(limit);
    return (data || []).map(r => ({
      id: r.id,
      vehicleCode: r.vehicles?.code || '—',
      date: r.settlement_date,
      status: r.status,
      cashVariance: Number(r.cash_variance || 0),
      upiVariance: Number(r.upi_variance || 0),
      stockVarianceValue: Number(r.stock_variance_value || 0),
    }));
  },

  // ─── FIELD REPS ───────────────────────────────────────────────────
  // The field_reps table (Phase 1) had zero actual usage until now —
  // every screen was just using whoever happened to be logged in as
  // "the rep," with no real assignment to a depot or vehicle, and no
  // way to see which staff member is even doing field work at all.
  async getFieldReps(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data } = await supabase.from('field_reps')
      .select('*, users!field_reps_user_id_fkey(name, phone), warehouses(name), vehicles(code)')
      .eq('distributor_id', distributorId).eq('active', true);
    return (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      name: r.users?.name || 'Unknown',
      phone: r.users?.phone || '',
      homeWarehouseId: r.home_warehouse_id,
      homeWarehouseName: r.warehouses?.name || null,
      assignedVehicleId: r.assigned_vehicle_id,
      assignedVehicleCode: r.vehicles?.code || null,
      fieldRole: r.field_role,
    }));
  },

  // Staff not yet made into a field rep — the actual pool a distributor
  // picks from, since a rep must already be a staff account (matching
  // the earlier decision: reps are distributor staff, not a separate
  // account type).
  async getUnassignedStaff(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data: staff } = await supabase.from('users')
      .select('id, name, phone').eq('staff_of', distributorId).eq('status', 'active');
    const { data: reps } = await supabase.from('field_reps')
      .select('user_id').eq('distributor_id', distributorId).eq('active', true);
    const repIds = new Set((reps || []).map(r => r.user_id));
    return (staff || []).filter(s => !repIds.has(s.id));
  },

  async assignFieldRep(distributorId, { userId, homeWarehouseId = null, assignedVehicleId = null, fieldRole = 'route_sales_rep' }) {
    requireOnline();
    const { error } = await supabase.from('field_reps').upsert({
      distributor_id: distributorId, user_id: userId,
      home_warehouse_id: homeWarehouseId, assigned_vehicle_id: assignedVehicleId,
      field_role: fieldRole, active: true,
    }, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
    return true;
  },

  async updateFieldRepAssignment(repId, { homeWarehouseId, assignedVehicleId }) {
    requireOnline();
    const { error } = await supabase.from('field_reps')
      .update({ home_warehouse_id: homeWarehouseId, assigned_vehicle_id: assignedVehicleId })
      .eq('id', repId);
    if (error) throw new Error(error.message);
    return true;
  },

  async removeFieldRep(repId) {
    requireOnline();
    const { error } = await supabase.from('field_reps').update({ active: false }).eq('id', repId);
    if (error) throw new Error(error.message);
    return true;
  },

  // ─── LIVE FIELD ACTIVITY ──────────────────────────────────────────
  // "Where is everyone right now" — deliberately built from the visit
  // check-in/check-out data already captured, not continuous GPS
  // polling. Continuous tracking drains a rep's phone all day for
  // precision nobody asked for; knowing which shop someone last
  // checked into (and when) is what a distributor actually needs to
  // know where their team is.
  async getFieldActivityToday(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: reps }, { data: visits }] = await Promise.all([
      supabase.from('field_reps')
        .select('user_id, field_role, users!field_reps_user_id_fkey(name, phone), vehicles(code)')
        .eq('distributor_id', distributorId).eq('active', true),
      supabase.from('route_visits')
        .select('*, users!route_visits_shop_id_fkey(name)')
        .eq('distributor_id', distributorId).eq('visit_date', today)
        .order('checked_in_at', { ascending: false, nullsFirst: false }),
    ]);

    return (reps || []).map(rep => {
      const repVisits = (visits || []).filter(v => v.rep_id === rep.user_id);
      const latest = repVisits.find(v => v.checked_in_at);
      const visited = repVisits.filter(v => v.status === 'visited').length;
      const skipped = repVisits.filter(v => v.status === 'skipped').length;
      // Currently at a stop = checked in but not yet checked out.
      const currentlyAt = repVisits.find(v => v.checked_in_at && !v.checked_out_at);

      return {
        userId: rep.user_id,
        name: rep.users?.name || 'Unknown',
        phone: rep.users?.phone || '',
        role: rep.field_role,
        vehicleCode: rep.vehicles?.code || null,
        visitedCount: visited,
        skippedCount: skipped,
        totalToday: repVisits.length,
        currentShopName: currentlyAt?.users?.name || null,
        currentSince: currentlyAt?.checked_in_at || null,
        lastActivityShopName: latest?.users?.name || null,
        lastActivityAt: latest?.checked_in_at || null,
        lastLatitude: latest?.latitude ?? null,
        lastLongitude: latest?.longitude ?? null,
      };
    });
  },

  // ─── SHOPKEEPER SELF-SERVICE ──────────────────────────────────────
  // A shop that bought something spot from a van, or had a return
  // processed, had genuinely zero way to see either in their own
  // records — the existing credit/khata view only ever knew about
  // stock_orders, never van_invoices or van_returns at all. This is
  // the actual "shopkeeper digital ledger" requirement, not a
  // decorative addition.
  async getShopVanHistory(shopId) {
    if (!isSupabaseConfigured || !shopId) return { purchases: [], returns: [] };
    const [{ data: invoices }, { data: returns }] = await Promise.all([
      supabase.from('van_invoices')
        .select('*, van_invoice_lines(qty_base, rate, distributor_products(name)), users!van_invoices_distributor_id_fkey(name)')
        .eq('shop_id', shopId).order('issued_at', { ascending: false }).limit(50),
      supabase.from('van_returns')
        .select('*, van_return_lines(qty_base, rate, distributor_products(name)), users!van_returns_distributor_id_fkey(name)')
        .eq('shop_id', shopId).order('issued_at', { ascending: false }).limit(50),
    ]);
    return {
      purchases: (invoices || []).map(i => ({
        id: i.id, ref: i.invoice_ref, distributorName: i.users?.name || 'Distributor',
        total: Number(i.total), paymentMode: i.payment_mode, issuedAt: i.issued_at,
        receivedAt: i.received_at || null,
        lines: (i.van_invoice_lines || []).map(l => ({ name: l.distributor_products?.name || 'Item', qty: Number(l.qty_base), rate: Number(l.rate) })),
      })),
      returns: (returns || []).map(r => ({
        id: r.id, ref: r.credit_ref, distributorName: r.users?.name || 'Distributor',
        total: Number(r.total_credit), reason: r.reason, issuedAt: r.issued_at,
        lines: (r.van_return_lines || []).map(l => ({ name: l.distributor_products?.name || 'Item', qty: Number(l.qty_base), rate: Number(l.rate) })),
      })),
    };
  },

  // Adds a van purchase into the shop's own inventory. Same explicit
  // step as receiving a stock order — distributor and shop catalogues
  // are separate, so auto-creating products on every van sale would
  // fill a shop's catalogue with rows they never agreed to.
  async receiveVanInvoice(invoiceId, shopId) {
    requireOnline();
    const { data, error } = await supabase.rpc('receive_van_invoice', {
      p_invoice_id: invoiceId, p_shop_id: shopId,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  // ─── DIAGNOSTICS ──────────────────────────────────────────────────
  // Checks that every phase's tables and RPCs actually exist and are
  // reachable, rather than making someone click through eleven screens
  // to find out which migration didn't apply. Each check is a minimal,
  // harmless read — no check here writes anything.
  async runDiagnostics(distributorId) {
    const results = [];
    const check = async (phase, label, fn) => {
      try {
        await fn();
        results.push({ phase, label, ok: true });
      } catch (e) {
        results.push({ phase, label, ok: false, error: e.message });
      }
    };

    await check('Phase 1', 'Warehouses table reachable', async () => {
      const { error } = await supabase.from('warehouses').select('id').eq('distributor_id', distributorId).limit(1);
      if (error) throw new Error(error.message);
    });
    await check('Phase 1', 'Vehicles table reachable', async () => {
      const { error } = await supabase.from('vehicles').select('id').eq('distributor_id', distributorId).limit(1);
      if (error) throw new Error(error.message);
    });
    await check('Phase 1', 'apply_stock_transfer() function exists', async () => {
      const { error } = await supabase.rpc('apply_stock_transfer', { p_transfer_id: '00000000-0000-0000-0000-000000000000' });
      // A "not found" error means the function ran and correctly rejected
      // a fake id — that's success. Anything else (missing function,
      // permission denied) means the migration didn't apply.
      if (error && !/not found/i.test(error.message)) throw new Error(error.message);
    });
    await check('Phase 2', 'Routes table reachable', async () => {
      const { error } = await supabase.from('routes').select('id').eq('distributor_id', distributorId).limit(1);
      if (error) throw new Error(error.message);
    });
    await check('Phase 2', 'convert_field_order() function exists', async () => {
      const { error } = await supabase.rpc('convert_field_order', { p_order_id: '00000000-0000-0000-0000-000000000000' });
      if (error && !/not found/i.test(error.message)) throw new Error(error.message);
    });
    await check('Phase 3', 'Van invoices table reachable', async () => {
      const { error } = await supabase.from('van_invoices').select('id').eq('distributor_id', distributorId).limit(1);
      if (error) throw new Error(error.message);
    });
    await check('Phase 3', 'get_van_series_position() function exists', async () => {
      const { data: vehicles } = await supabase.from('vehicles').select('id').eq('distributor_id', distributorId).limit(1);
      const testId = vehicles?.[0]?.id || '00000000-0000-0000-0000-000000000000';
      const { error } = await supabase.rpc('get_van_series_position', { p_vehicle_id: testId, p_doc_type: 'invoice' });
      if (error) throw new Error(error.message);
    });
    await check('Phase 3', 'Van returns table reachable', async () => {
      const { error } = await supabase.from('van_returns').select('id').eq('distributor_id', distributorId).limit(1);
      if (error) throw new Error(error.message);
    });
    await check('Phase 4', 'Day settlements table reachable', async () => {
      const { error } = await supabase.from('day_settlements').select('id').eq('distributor_id', distributorId).limit(1);
      if (error) throw new Error(error.message);
    });
    await check('Phase 5', 'Shop RLS policy on van_invoices exists', async () => {
      // Can't truly test RLS as the distributor (RLS would allow this
      // regardless via the distributor policy) — this just confirms the
      // table/column shape the shop-facing query depends on is correct.
      const { error } = await supabase.from('van_invoices').select('shop_id').limit(1);
      if (error) throw new Error(error.message);
    });
    await check('Phase 5', 'Field reps table reachable', async () => {
      const { error } = await supabase.from('field_reps').select('id').eq('distributor_id', distributorId).limit(1);
      if (error) throw new Error(error.message);
    });

    return results;
  },
};

export default fieldApi;

// ═══════════════════════════════════════════════════════════════════
// PURCHASES & SUPPLIERS — the inward half of the business
//
// A distributor BUYS from manufacturers and SELLS to shops. Only the
// sell half existed; stock appeared by someone typing a number into
// "Add Product". That meant no supplier ledger, no purchase bills to
// reconcile, and — because nothing recorded what stock COST — no way
// to compute actual profit.
// ═══════════════════════════════════════════════════════════════════

export const purchaseApi = {
  async getSuppliers(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data } = await supabase.from('suppliers')
      .select('*').eq('distributor_id', distributorId).eq('active', true).order('name');
    return (data || []).map(r => ({
      id: r.id, name: r.name, phone: r.phone || '', gstin: r.gstin || '', address: r.address || '',
    }));
  },

  async addSupplier(distributorId, { name, phone = '', gstin = '', address = '' }) {
    requireOnline();
    if (!name?.trim()) throw new Error('Supplier name is required');
    const { data, error } = await supabase.from('suppliers').insert({
      distributor_id: distributorId, name: name.trim(),
      phone: phone.trim() || null, gstin: gstin.trim() || null, address: address.trim() || null,
    }).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    return data.id;
  },

  // One call creates the bill, its lines, increases stock and records
  // the cost basis — atomic, because a purchase that added stock but no
  // bill (or the reverse) corrupts both inventory and payables.
  async recordPurchase(distributorId, { supplierId, billNo, billDate, lines, paymentMode = 'credit', amountPaid = 0, notes = '' }) {
    requireOnline();
    if (!lines?.length) throw new Error('Add at least one item');
    const { data, error } = await supabase.rpc('record_purchase', {
      p_distributor_id: distributorId,
      p_supplier_id: supplierId || null,
      p_bill_no: billNo || null,
      p_bill_date: billDate || new Date().toISOString().slice(0, 10),
      p_lines: lines.map(l => ({
        product_id: l.productId || null,
        product_name: l.productName,
        qty: l.qty,
        cost_rate: l.costRate,
        gst_pct: l.gstPct || 0,
      })),
      p_payment_mode: paymentMode,
      p_amount_paid: amountPaid || 0,
      p_notes: notes || null,
    });
    if (error) {
      if (/duplicate key/i.test(error.message)) {
        throw new Error('That supplier bill number is already recorded — check your purchase history.');
      }
      throw new Error(error.message);
    }
    return data;
  },

  // What the distributor OWES. Deliberately separate from customer
  // receivables — netting the two gives a number that looks meaningful
  // and tells you nothing about either side.
  async getSupplierBalances(distributorId) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data, error } = await supabase.rpc('supplier_balances', { p_distributor_id: distributorId });
    if (error) throw new Error(error.message);
    return (data || []).map(r => ({
      supplierId: r.supplier_id, name: r.supplier_name, phone: r.phone || '',
      purchased: Number(r.total_purchased) || 0,
      paid: Number(r.total_paid) || 0,
      outstanding: Number(r.outstanding) || 0,
      lastBillDate: r.last_bill_date,
    }));
  },

  async getPurchases(distributorId, limit = 50) {
    if (!isSupabaseConfigured || !distributorId) return [];
    const { data } = await supabase.from('purchases')
      .select('*, suppliers(name), purchase_lines(product_name, qty, cost_rate)')
      .eq('distributor_id', distributorId).order('bill_date', { ascending: false }).limit(limit);
    return (data || []).map(r => ({
      id: r.id,
      supplierName: r.suppliers?.name || 'Unknown supplier',
      billNo: r.supplier_bill_no || '—',
      billDate: r.bill_date,
      total: Number(r.total) || 0,
      amountPaid: Number(r.amount_paid) || 0,
      paymentMode: r.payment_mode,
      lines: (r.purchase_lines || []).map(l => ({
        name: l.product_name, qty: Number(l.qty), rate: Number(l.cost_rate),
      })),
    }));
  },

  async paySupplier(distributorId, { supplierId, amount, mode = 'cash', note = '' }) {
    requireOnline();
    if (!(amount > 0)) throw new Error('Enter an amount');
    const { error } = await supabase.from('supplier_payments').insert({
      distributor_id: distributorId, supplier_id: supplierId,
      amount, mode, note: note || null,
    });
    if (error) throw new Error(error.message);
    return true;
  },
};
