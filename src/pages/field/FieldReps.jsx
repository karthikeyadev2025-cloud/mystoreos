// ═══════════════════════════════════════════════════════════════════
// FIELD REPS — who's actually doing field work
//
// The field_reps table has existed since Phase 1 with zero UI. Every
// screen since (Run, Billing, Settlement) has just used whoever
// happened to be logged in as "the rep," with no real record of which
// staff member is assigned to which depot or vehicle.
//
// Reps must already be a distributor staff account — matching the
// earlier decision that field reps are staff, not a separate account
// type — so this screen assigns an EXISTING staff member into field
// work, rather than creating a new kind of login.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, Users, Warehouse, X, Pencil, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { api } from '../../lib/api';
import { distributorIdOf } from '../../lib/fieldIdentity';

const ROLE_LABEL = {
  route_sales_rep: 'Route Sales Rep',
  presale_booker: 'Presale Booker',
  driver: 'Driver',
  supervisor: 'Supervisor',
};

export default function FieldReps() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();

  const [reps, setReps] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [pickStaff, setPickStaff] = useState('');
  const [pickRole, setPickRole] = useState('route_sales_rep');
  const [pickWarehouse, setPickWarehouse] = useState('');
  const [pickVehicle, setPickVehicle] = useState('');

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [r, u, w, v] = await Promise.all([
          fieldApi.getFieldReps(distId),
          fieldApi.getUnassignedStaff(distId),
          fieldApi.getWarehouses(distId),
          fieldApi.getVehicles(distId),
        ]);
        if (cancelled) return;
        setReps(r); setUnassigned(u); setWarehouses(w); setVehicles(v);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId, reloadKey]);

  const assign = async () => {
    if (!pickStaff) return toast.error('Pick a staff member');
    setBusy(true);
    try {
      await fieldApi.assignFieldRep(distId, {
        userId: pickStaff, fieldRole: pickRole,
        homeWarehouseId: pickWarehouse || null, assignedVehicleId: pickVehicle || null,
      });
      toast.success('Assigned to field work');
      setPickStaff(''); setPickWarehouse(''); setPickVehicle('');
      setReloadKey(k => k + 1);
    } catch (e) { toast.error(e.message || 'Could not assign'); }
    finally { setBusy(false); }
  };

  const reassignVehicle = async (rep, vehicleId) => {
    setBusy(true);
    try {
      await fieldApi.updateFieldRepAssignment(rep.id, {
        homeWarehouseId: rep.homeWarehouseId, assignedVehicleId: vehicleId || null,
      });
      toast.success(`${rep.name} reassigned`);
      setReloadKey(k => k + 1);
    } catch (e) { toast.error(e.message || 'Could not reassign'); }
    finally { setBusy(false); }
  };

  const remove = async (rep) => {
    if (!window.confirm(`Remove ${rep.name} from field work? Their staff login is unaffected.`)) return;
    setBusy(true);
    try {
      await fieldApi.removeFieldRep(rep.id);
      toast.success(`${rep.name} removed from field work`);
      setReloadKey(k => k + 1);
    } catch (e) { toast.error(e.message || 'Could not remove'); }
    finally { setBusy(false); }
  };

  // The gap this closes: correcting a typo'd number, or updating it
  // when a driver's phone actually changes, previously meant removing
  // and re-adding them — which also unlinks them from their vehicle
  // and warehouse. This edits in place.
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const startEdit = (rep) => {
    setEditingId(rep.userId);
    setEditName(rep.name);
    setEditPhone(rep.phone || '');
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.updateStaff(editingId, { name: editName, phone: editPhone });
      toast.success('Updated');
      setEditingId(null);
      setReloadKey(k => k + 1);
    } catch (e) { toast.error(e.message || 'Could not update'); }
    finally { setBusy(false); }
  };

  const S = {
    card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.06)', marginBottom: 16 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>Field Reps</h1>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
        Assign your staff to depots and vans. A rep must already be added as staff in Distributor Settings.
      </p>

      <div style={S.card}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} color="#4F46E5" /> Assign a Staff Member
        </h2>

        {unassigned.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94A3B8' }}>
            No unassigned staff. Add staff in Distributor Settings first, then assign them here.
          </p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={S.label}>Staff member</label>
                <select value={pickStaff} onChange={e => setPickStaff(e.target.value)} style={S.input}>
                  <option value="">— select —</option>
                  {unassigned.map(s => <option key={s.id} value={s.id}>{s.name} · {s.phone}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Role</label>
                <select value={pickRole} onChange={e => setPickRole(e.target.value)} style={S.input}>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Home depot</label>
                <select value={pickWarehouse} onChange={e => setPickWarehouse(e.target.value)} style={S.input}>
                  <option value="">— none —</option>
                  {warehouses.filter(w => w.type === 'main').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Vehicle (if driver/rep)</label>
                <select value={pickVehicle} onChange={e => setPickVehicle(e.target.value)} style={S.input}>
                  <option value="">— none —</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.code}</option>)}
                </select>
              </div>
            </div>
            <button onClick={assign} disabled={busy}
              style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Assign to Field Work
            </button>
          </>
        )}
      </div>

      <div style={S.card}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 14px' }}>Active Field Team ({reps.length})</h2>
        {reps.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94A3B8' }}>No one assigned to field work yet.</p>
        ) : reps.map(rep => (
          <div key={rep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
            {editingId === rep.userId ? (
              <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 240, flexWrap: 'wrap' }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name"
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #C7D2FE', borderRadius: 6, fontSize: 12 }} />
                <input value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric" placeholder="Phone" style={{ width: 110, padding: '7px 10px', border: '1px solid #C7D2FE', borderRadius: 6, fontSize: 12 }} />
                <button onClick={saveEdit} disabled={busy} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 10px', cursor: 'pointer' }}>
                  <Check size={12} />
                </button>
                <button onClick={() => setEditingId(null)} style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 6, padding: '7px 10px', cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{rep.name}</div>
                  <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{ROLE_LABEL[rep.fieldRole]}</span>
                    {/* Was invisible on this screen entirely — no way to
                        even SEE a rep's phone here, let alone fix it. */}
                    {rep.phone && <span>{rep.phone}</span>}
                    {rep.homeWarehouseName && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Warehouse size={10} />{rep.homeWarehouseName}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select value={rep.assignedVehicleId || ''} onChange={e => reassignVehicle(rep, e.target.value)}
                    style={{ padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }}>
                    <option value="">No vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.code}</option>)}
                  </select>
                  <button onClick={() => startEdit(rep)} style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}>
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => remove(rep)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}>
                    <X size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
