// ═══════════════════════════════════════════════════════════════════
// FIELD SETUP — depots and vans
//
// Deliberately its own page and its own lazy chunk, NOT a tab inside
// DistributorDashboard.jsx (already 3,314 lines / 771KB built). Field
// Mode will grow considerably; folding it in would push a single chunk
// past a megabyte for reps on low-end Android phones who need almost
// none of it.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { Warehouse, Truck, Plus, ArrowLeft, Package, Map, ClipboardList, Scale, Users, MapPin } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';
import { getDistCaps } from '../../lib/features';

const TYPE_LABEL = { main: 'Depot', van: 'Van', quarantine: 'Quarantine Bay' };
const TYPE_COLOR = { main: '#4F46E5', van: '#059669', quarantine: '#DC2626' };

export default function FieldSetup() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const caps = getDistCaps(user);
  const [busy, setBusy] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [whName, setWhName] = useState('');
  const [whType, setWhType] = useState('main');
  const [whAddress, setWhAddress] = useState('');

  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [vReg, setVReg] = useState('');
  const [vParent, setVParent] = useState('');

  // Bumped to trigger a refetch after any create — avoids a memoized
  // callback in the effect dependency list, which the lint rule
  // (correctly) flags as a cascading-render risk.
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey(k => k + 1);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;

    (async () => {
      try {
        const [w, v] = await Promise.all([
          fieldApi.getWarehouses(distId),
          fieldApi.getVehicles(distId),
        ]);
        if (cancelled) return;
        setWarehouses(w);
        setVehicles(v);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load field setup');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [distId, reloadKey]);

  const addWarehouse = async () => {
    if (!whName.trim()) return toast.error('Enter a name');
    setBusy(true);
    try {
      await fieldApi.createWarehouse(distId, { name: whName, type: whType, address: whAddress });
      toast.success(`${TYPE_LABEL[whType]} "${whName}" created`);
      setWhName(''); setWhAddress('');
      load();
    } catch (e) {
      toast.error(e.message || 'Could not create');
    } finally { setBusy(false); }
  };

  const addVehicle = async () => {
    if (!vCode.trim()) return toast.error('Enter a vehicle code (e.g. V04)');
    setBusy(true);
    try {
      await fieldApi.createVehicle(distId, {
        code: vCode, name: vName, registrationNo: vReg,
        parentWarehouseId: vParent || null,
      });
      toast.success(`Van ${vCode.toUpperCase()} created with its own stock ledger and invoice series`);
      setVCode(''); setVName(''); setVReg('');
      load();
    } catch (e) {
      toast.error(e.message || 'Could not create van');
    } finally { setBusy(false); }
  };

  // Vans get their stock ledger via createVehicle, so the manual
  // warehouse form only offers the two types you'd create directly.
  const depots = warehouses.filter(w => w.type === 'main');

  const S = {
    card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.06)' },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 },
    primary: { background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
    h2: { fontSize: 17, fontWeight: 800, margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 },
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading field setup…</div>;
  }

  // Tier gate. Enforced HERE at the module entry point rather than on
  // each of the eleven screens — this is the only door in, so gating it
  // gates the whole feature without scattering checks everywhere. The
  // pricing page advertises field distribution as Pro+, so it has to
  // actually be Pro+ in the product.
  if (!caps.fieldDistribution) {
    return (
      <div style={{ padding: 20, maxWidth: 560, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <button onClick={() => navigate('/distributor')}
          style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <Truck size={30} color="#B45309" style={{ marginBottom: 10 }} />
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#92400E', margin: '0 0 6px' }}>Field Distribution is a Pro feature</h2>
          <p style={{ fontSize: 13, color: '#78350F', margin: '0 0 16px', lineHeight: 1.6 }}>
            Run routes and beats, book presale orders from the field, track your team live,
            and reconcile stock and cash at day&apos;s end. Van sales with offline billing is
            available on Enterprise.
          </p>
          <button onClick={() => navigate('/distributor')}
            style={{ background: '#B45309', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            View Upgrade Options
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/distributor')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>Field Setup</h1>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 24px' }}>
        Depots hold your main stock. Each van is its own moving sub-warehouse with an independent stock ledger and invoice series.
      </p>

      <button onClick={() => navigate('/field/diagnostics')}
        style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', padding: '9px 16px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer', marginBottom: 16 }}>
        🩺 Run Field Diagnostics
      </button>

      {vehicles.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/field/loadout')}
            style={{ background: '#059669', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={15} /> Van Load-Out
          </button>
          <button onClick={() => navigate('/field/run')}
            style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={15} /> Today's Run
          </button>
          <button onClick={() => navigate('/field/activity')}
            style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={15} /> Field Activity
          </button>
          <button onClick={() => navigate('/field/reps')}
            style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={15} /> Field Reps
          </button>
          <button onClick={() => navigate('/field/settlement')}
            style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scale size={15} /> EOD Settlement
          </button>
          <button onClick={() => navigate('/field/billing')}
            style={{ background: '#059669', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={15} /> Van Billing
          </button>
          <button onClick={() => navigate('/field/orders')}
            style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={15} /> Booked Orders
          </button>
          <button onClick={() => navigate('/field/routes')}
            style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Map size={15} /> Routes & Beats
          </button>
          <button onClick={() => navigate('/field/stock')}
            style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={15} /> Stock Overview
          </button>
        </div>
      )}

      {/* ─── DEPOTS ─────────────────────────────────────────────── */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <h2 style={S.h2}><Warehouse size={18} color="#4F46E5" /> Depots &amp; Bays</h2>
        <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 16px' }}>
          Your physical stock locations. A quarantine bay holds damaged or expired returns so they can never be reloaded onto a van.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1.5fr auto', gap: 10, alignItems: 'end', marginBottom: 18 }}>
          <div>
            <label style={S.label}>Name</label>
            <input value={whName} onChange={e => setWhName(e.target.value)} placeholder="e.g. Guntur Main Depot" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Type</label>
            <select value={whType} onChange={e => setWhType(e.target.value)} style={S.input}>
              <option value="main">Depot</option>
              <option value="quarantine">Quarantine Bay</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Address (optional)</label>
            <input value={whAddress} onChange={e => setWhAddress(e.target.value)} placeholder="Location" style={S.input} />
          </div>
          <button onClick={addWarehouse} disabled={busy} style={{ ...S.primary, width: isMobile ? '100%' : 'auto' }}>
            <Plus size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Add Depot
          </button>
        </div>

        {warehouses.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No locations yet — add your main depot to get started.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {warehouses.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{w.name}</div>
                  {w.address && <div style={{ fontSize: 11, color: '#64748B' }}>{w.address}</div>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: TYPE_COLOR[w.type], background: `${TYPE_COLOR[w.type]}14`, border: `1px solid ${TYPE_COLOR[w.type]}33`, padding: '3px 10px', borderRadius: 20 }}>
                  {TYPE_LABEL[w.type]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── VANS ───────────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.h2}><Truck size={18} color="#059669" /> Vans</h2>
        <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 16px' }}>
          Adding a van also creates its stock ledger and its own invoice series (e.g. <code>INV-V04-00001</code>), so it can bill with no network connection without ever clashing with another van.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.7fr 1.2fr 1fr 1.2fr auto', gap: 10, alignItems: 'end', marginBottom: 18 }}>
          <div>
            <label style={S.label}>Code</label>
            <input value={vCode} onChange={e => setVCode(e.target.value.toUpperCase())} placeholder="V04" maxLength={6} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Name (optional)</label>
            <input value={vName} onChange={e => setVName(e.target.value)} placeholder="Van 04" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Registration</label>
            <input value={vReg} onChange={e => setVReg(e.target.value.toUpperCase())} placeholder="AP07AB1234" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Reports to</label>
            <select value={vParent} onChange={e => setVParent(e.target.value)} style={S.input}>
              <option value="">— select depot —</option>
              {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <button onClick={addVehicle} disabled={busy} style={{ ...S.primary, background: '#059669', width: isMobile ? '100%' : 'auto' }}>
            <Plus size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Add Van
          </button>
        </div>

        {vehicles.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No vans yet. Add a depot first, then register your vans.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {vehicles.map(v => (
              <div key={v.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, background: '#F8FAFC' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#059669' }}>{v.code}</span>
                  <Package size={14} color="#94A3B8" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{v.warehouseName}</div>
                {v.registrationNo && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{v.registrationNo}</div>}
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8, fontFamily: 'monospace' }}>INV-{v.code}-•••••</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
