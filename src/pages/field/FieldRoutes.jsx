// ═══════════════════════════════════════════════════════════════════
// ROUTES — beat planning
//
// Two separate jobs, deliberately kept apart:
//
//   Territory  (done once, by a supervisor) — which outlets belong to
//              this beat. Real territories follow rivers, highways and
//              relationships, so this is picked by hand, not derived
//              from coordinates.
//
//   Sequence   (re-runnable) — what order to drive them in. That IS a
//              maths problem, so the sequencer does it.
//
// The old Route Planner conflated the two by sorting on distance from
// the depot, which produces a circle rather than a path.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, Plus, X, Route as RouteIcon, Zap, MapPin, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf } from '../../lib/fieldIdentity';
import { sequenceRoute } from '../../lib/routeSequencer';

const DAYS = [
  { v: 1, l: 'Mon' }, { v: 2, l: 'Tue' }, { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' }, { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' }, { v: 0, l: 'Sun' },
];

export default function FieldRoutes() {
  const { user } = useAuth();
  // Staff resolve to their employer; owners to themselves.
  const distId = distributorIdOf(user);
  const navigate = useNavigate();

  const [routes, setRoutes] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [shops, setShops] = useState([]);
  const [fieldReps, setFieldReps] = useState([]);
  const [assignBusy, setAssignBusy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(k => k + 1);

  const [newName, setNewName] = useState('');
  const [newWh, setNewWh] = useState('');
  const [newDays, setNewDays] = useState([]);

  const [openRoute, setOpenRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [seqResult, setSeqResult] = useState(null);
  const [shopFilter, setShopFilter] = useState('');

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [r, w, s, reps] = await Promise.all([
          fieldApi.getRoutes(distId),
          fieldApi.getWarehouses(distId),
          fieldApi.getRoutableShops(distId),
          fieldApi.getFieldReps(distId),
        ]);
        if (cancelled) return;
        setRoutes(r); setWarehouses(w.filter(x => x.type === 'main')); setShops(s); setFieldReps(reps);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load routes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId, reloadKey]);

  const openStops = async (route) => {
    setOpenRoute(route);
    setSeqResult(null);
    try {
      setStops(await fieldApi.getRouteStops(route.id));
    } catch (e) {
      toast.error(e.message || 'Could not load stops');
    }
  };

  const addRoute = async () => {
    if (!newName.trim()) return toast.error('Name the route');
    setBusy(true);
    try {
      await fieldApi.createRoute(distId, { name: newName, warehouseId: newWh || null, weekdays: newDays });
      toast.success(`Route "${newName}" created`);
      setNewName(''); setNewDays([]);
      reload();
    } catch (e) { toast.error(e.message || 'Could not create route'); }
    finally { setBusy(false); }
  };

  const addShop = async (shopId) => {
    setBusy(true);
    try {
      await fieldApi.addStopsToRoute(openRoute.id, [shopId]);
      setStops(await fieldApi.getRouteStops(openRoute.id));
      setSeqResult(null);
      reload();
    } catch (e) { toast.error(e.message || 'Could not add'); }
    finally { setBusy(false); }
  };

  const dropStop = async (stopId) => {
    setBusy(true);
    try {
      await fieldApi.removeStop(stopId);
      setStops(await fieldApi.getRouteStops(openRoute.id));
      setSeqResult(null);
      reload();
    } catch (e) { toast.error(e.message || 'Could not remove'); }
    finally { setBusy(false); }
  };

  // Sequences into a preview rather than saving straight away — a
  // supervisor who knows the area should get to look before it becomes
  // the order 50 reps drive tomorrow.
  const runSequencer = () => {
    if (stops.length < 2) return toast.error('Add at least two outlets first');
    const depot = warehouses.find(w => w.id === openRoute.warehouseId) || warehouses[0] || null;
    const result = sequenceRoute(stops, depot);
    setSeqResult(result);
    if (result.unlocated.length) {
      toast.warn(`${result.unlocated.length} outlet(s) have no GPS — placed at the end, not dropped`);
    }
  };

  const acceptSequence = async () => {
    setBusy(true);
    try {
      await fieldApi.saveRouteSequence(seqResult.sequenced);
      toast.success('Driving order saved');
      setStops(await fieldApi.getRouteStops(openRoute.id));
      setSeqResult(null);
    } catch (e) { toast.error(e.message || 'Could not save order'); }
    finally { setBusy(false); }
  };

  const toggleDay = (d) => setNewDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  // The column existed since the first field-distribution migration
  // and was read everywhere, but nothing ever wrote to it — any rep
  // could freely pick any route on login, with no actual lock-in.
  const assignRep = async (routeId, repId) => {
    setAssignBusy(routeId);
    try {
      await fieldApi.assignRouteToRep(routeId, repId);
      setRoutes(rs => rs.map(r => r.id === routeId
        ? { ...r, assignedRepId: repId || null, assignedRepName: fieldReps.find(x => x.userId === repId)?.name || null }
        : r));
      toast.success(repId ? 'Route assigned' : 'Route unassigned');
    } catch (e) {
      toast.error(e.message || 'Could not assign route');
    } finally {
      setAssignBusy(null);
    }
  };

  const stopIds = new Set(stops.map(s => s.id));
  const available = shops.filter(s => !stopIds.has(s.id) &&
    (!shopFilter || s.name.toLowerCase().includes(shopFilter.toLowerCase())));
  const missingGps = stops.filter(s => s.latitude == null).length;

  const S = {
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.06)', marginBottom: 16 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--c-ink-2)', marginBottom: 4 },
    h2: { fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--c-ink)', display: 'flex', alignItems: 'center', gap: 8 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-muted)' }}>Loading routes…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-ink)', margin: '0 0 4px' }}>Routes &amp; Beats</h1>
      <p style={{ fontSize: 13, color: 'var(--c-muted)', margin: '0 0 24px' }}>
        Pick which outlets belong to a beat, then let the sequencer work out the driving order.
      </p>

      {/* ─── NEW ROUTE ─────────────────────────────────────────── */}
      <div style={S.card}>
        <h2 style={S.h2}><RouteIcon size={18} color="var(--c-primary)" /> New Route</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr auto', gap: 12, alignItems: 'end', margin: '16px 0 12px' }}>
          <div>
            <label style={S.label}>Route name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Guntur East Beat" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Starts from depot</label>
            <select value={newWh} onChange={e => setNewWh(e.target.value)} style={S.input}>
              <option value="">— select —</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <button onClick={addRoute} disabled={busy} style={{ background: 'var(--c-primary)', color: 'var(--c-surface)', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Create
          </button>
        </div>
        <div>
          <label style={S.label}>Runs on</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DAYS.map(d => (
              <button key={d.v} onClick={() => toggleDay(d.v)}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${newDays.includes(d.v) ? 'var(--c-primary)' : 'var(--c-line)'}`,
                  background: newDays.includes(d.v) ? 'var(--c-primary-soft)' : 'var(--c-surface)',
                  color: newDays.includes(d.v) ? 'var(--c-primary-hover)' : 'var(--c-muted)',
                }}>{d.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── ROUTE LIST ────────────────────────────────────────── */}
      {routes.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--c-faint)' }}>No routes yet — create your first beat above.</div>
      ) : routes.map(r => (
        <div key={r.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-ink)' }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                {r.stopCount} outlet{r.stopCount === 1 ? '' : 's'}
                {r.warehouseName && ` · from ${r.warehouseName}`}
                {r.weekdays.length > 0 && ` · ${r.weekdays.map(d => DAYS.find(x => x.v === d)?.l).filter(Boolean).join(', ')}`}
              </div>
              {/* Was purely cosmetic before — the column existed but
                  nothing wrote to it, so any rep could pick any route.
                  This actually assigns it. */}
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>Assigned to:</span>
                <select value={r.assignedRepId || ''} disabled={assignBusy === r.id}
                  onChange={e => assignRep(r.id, e.target.value || null)}
                  style={{ fontSize: 12, border: '1px solid var(--c-line)', borderRadius: 6, padding: '3px 8px', color: r.assignedRepId ? 'var(--c-ink)' : 'var(--c-faint)' }}>
                  <option value="">Anyone (unassigned)</option>
                  {fieldReps.map(rep => <option key={rep.userId} value={rep.userId}>{rep.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => openRoute?.id === r.id ? setOpenRoute(null) : openStops(r)}
              style={{ background: openRoute?.id === r.id ? 'var(--c-primary-soft)' : 'var(--c-line-soft)', color: openRoute?.id === r.id ? 'var(--c-primary-hover)' : 'var(--c-ink-2)', border: '1px solid var(--c-line)', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {openRoute?.id === r.id ? 'Close' : 'Plan Outlets'}
            </button>
          </div>

          {openRoute?.id === r.id && (
            <div style={{ marginTop: 18, borderTop: '1px solid var(--c-line)', paddingTop: 18 }}>
              {missingGps > 0 && (
                <div style={{ background: 'var(--c-warning-soft)', border: '1px solid var(--c-accent-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--c-warning-strong)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} />
                  {missingGps} outlet{missingGps === 1 ? ' has' : 's have'} no GPS location — they can&apos;t be sequenced and will be placed at the end of the run.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Current stops */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      On this route ({stops.length})
                    </span>
                    {stops.length >= 2 && (
                      <button onClick={runSequencer}
                        style={{ background: 'var(--c-success-strong)', color: 'var(--c-surface)', border: 'none', padding: '6px 12px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Zap size={11} /> Sequence
                      </button>
                    )}
                  </div>

                  {seqResult && (
                    <div style={{ background: 'var(--c-success-soft)', border: '1px solid var(--c-success-soft)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-success-strong)', marginBottom: 6 }}>
                        Proposed order · {seqResult.distanceKm} km
                        {seqResult.improvementKm > 0 && ` · saved ${seqResult.improvementKm} km`}
                      </div>
                      <ol style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12, color: 'var(--c-success-strong)' }}>
                        {seqResult.sequenced.map(s => (
                          <li key={s.id} style={{ padding: '1px 0' }}>
                            {s.name}{s.latitude == null && <span style={{ color: 'var(--c-warning-strong)' }}> (no GPS)</span>}
                          </li>
                        ))}
                      </ol>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={acceptSequence} disabled={busy}
                          style={{ background: 'var(--c-success-strong)', color: 'var(--c-surface)', border: 'none', padding: '7px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          Save this order
                        </button>
                        <button onClick={() => setSeqResult(null)}
                          style={{ background: 'transparent', color: 'var(--c-muted)', border: '1px solid var(--c-line)', padding: '7px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          Discard
                        </button>
                      </div>
                    </div>
                  )}

                  {stops.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--c-faint)', textAlign: 'center', padding: '16px 0' }}>No outlets yet — add some from the right.</p>
                  ) : stops.map((s, i) => (
                    <div key={s.stopId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-ink)' }}>
                          <span style={{ color: 'var(--c-faint)', marginRight: 6 }}>{i + 1}.</span>{s.name}
                        </div>
                        <div style={{ fontSize: 10, color: s.latitude == null ? 'var(--c-warning-strong)' : 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={9} />{s.latitude == null ? 'No GPS' : (s.address || 'Located')}
                        </div>
                      </div>
                      <button onClick={() => dropStop(s.stopId)} style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger-strong)', border: '1px solid var(--c-danger-border)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Available shops */}
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-ink-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Available outlets ({available.length})
                  </span>
                  <input value={shopFilter} onChange={e => setShopFilter(e.target.value)} placeholder="Search…"
                    style={{ ...S.input, margin: '10px 0' }} />
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {available.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--c-faint)', textAlign: 'center', padding: '16px 0' }}>
                        {shops.length === 0 ? 'No linked shops yet.' : 'All linked outlets are on this route.'}
                      </p>
                    ) : available.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--c-line)', borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-ink)' }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: s.latitude == null ? 'var(--c-warning-strong)' : 'var(--c-muted)' }}>
                            {s.latitude == null ? 'No GPS' : (s.address || 'Located')}
                          </div>
                        </div>
                        <button onClick={() => addShop(s.id)} disabled={busy}
                          style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary-hover)', border: '1px solid var(--c-primary-border)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
                          <Plus size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
