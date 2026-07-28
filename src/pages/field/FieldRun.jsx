// ═══════════════════════════════════════════════════════════════════
// FIELD RUN — the rep's actual working screen
//
// Used standing in a shop doorway on a phone, often on bad signal,
// 40 times a day. That drives every decision here:
//
//   • Big tap targets, one action visible at a time
//   • The current stop is expanded; the rest are collapsed
//   • Booking is 3 taps: pick product, qty, add
//   • Skipping needs a reason — a skipped outlet with a reason is as
//     useful as a completed one
//
// This is presale: the rep books, the depot dispatches tomorrow. No
// stock moves and no invoice is raised here, which is exactly why
// Phase 2 can ship before offline billing exists.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import { ArrowLeft, MapPin, Check, SkipForward, Plus, X, Phone, ClipboardList } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import fieldApi from '../../lib/fieldApi';
import { distributorIdOf, actorIdOf } from '../../lib/fieldIdentity';

const SKIP_REASONS = ['Shop closed', 'Owner not available', 'No requirement', 'Payment pending', 'Other'];

export default function FieldRun() {
  const { user } = useAuth();
  // Two different questions: whose business (distId) vs who is
  // doing the work (actorId). For an owner they're the same id; for a
  // rep they are not, and conflating them breaks both data scoping and
  // rep attribution.
  const distId = distributorIdOf(user);
  const actorId = actorIdOf(user);
  const navigate = useNavigate();

  const [routes, setRoutes] = useState([]);
  const [routeId, setRouteId] = useState('');
  const [run, setRun] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [activeShop, setActiveShop] = useState(null);
  const [cart, setCart] = useState([]);
  const [pickProduct, setPickProduct] = useState('');
  const [pickQty, setPickQty] = useState('');
  const [pickRate, setPickRate] = useState('');
  const [skipFor, setSkipFor] = useState(null);

  useEffect(() => {
    if (!distId) return;
    let cancelled = false;
    (async () => {
      try {
        const [r, p] = await Promise.all([
          fieldApi.getRoutes(distId),
          fieldApi.getTransferableProducts(distId),
        ]);
        if (cancelled) return;
        setRoutes(r); setProducts(p);
        // Default to a route scheduled for today, so the common case
        // needs no selection at all.
        const dow = new Date().getDay();
        const todays = r.find(x => (x.weekdays || []).includes(dow));
        if (todays) setRouteId(todays.id);
        else if (r.length === 1) setRouteId(r[0].id);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [distId]);

  // Bumped after any action that changes the run, so the effect below
  // is the single place that fetches it.
  const [runKey, setRunKey] = useState(0);
  const refreshRun = () => setRunKey(k => k + 1);

  useEffect(() => {
    if (!routeId || !distId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fieldApi.getTodayRun(distId, routeId);
        if (!cancelled) setRun(data);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Could not load run');
      }
    })();
    return () => { cancelled = true; };
  }, [routeId, distId, runKey]);

  // GPS is best-effort: a rep in a metal-roofed shop may get no fix,
  // and blocking check-in on that would make the app unusable exactly
  // where it's needed.
  const getPosition = () => new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ latitude: null, longitude: null });
    const timer = setTimeout(() => resolve({ latitude: null, longitude: null }), 4000);
    navigator.geolocation.getCurrentPosition(
      pos => { clearTimeout(timer); resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
      () => { clearTimeout(timer); resolve({ latitude: null, longitude: null }); },
      { enableHighAccuracy: false, timeout: 4000 }
    );
  });

  const doCheckIn = async (stop) => {
    setBusy(true);
    try {
      const pos = await getPosition();
      await fieldApi.checkIn(distId, { routeId, shopId: stop.id, repId: actorId, ...pos });
      toast.success(`Checked in at ${stop.name}`);
      setActiveShop(stop.id);
      setCart([]);
      refreshRun();
    } catch (e) { toast.error(e.message || 'Check-in failed'); }
    finally { setBusy(false); }
  };

  const doSkip = async (stop, reason) => {
    setBusy(true);
    try {
      await fieldApi.skipVisit(distId, { routeId, shopId: stop.id, repId: actorId, reason });
      toast.info(`${stop.name} skipped — ${reason}`);
      setSkipFor(null);
      refreshRun();
    } catch (e) { toast.error(e.message || 'Could not skip'); }
    finally { setBusy(false); }
  };

  const addToCart = () => {
    if (!pickProduct) return toast.error('Pick a product');
    const qty = parseFloat(pickQty);
    const rate = parseFloat(pickRate);
    if (!qty || qty <= 0) return toast.error('Enter quantity');
    if (!rate || rate <= 0) return toast.error('Enter rate');
    const prod = products.find(p => p.id === pickProduct);
    setCart(prev => {
      const found = prev.find(l => l.productId === pickProduct);
      if (found) return prev.map(l => l.productId === pickProduct ? { ...l, qtyBase: l.qtyBase + qty } : l);
      return [...prev, { productId: pickProduct, name: prod.name, unit: prod.unit, qtyBase: qty, rate }];
    });
    setPickQty(''); setPickRate('');
  };

  const submitOrder = async (stop) => {
    setBusy(true);
    try {
      const visit = run.find(s => s.id === stop.id);
      const { total } = await fieldApi.bookFieldOrder(distId, {
        shopId: stop.id, routeId, repId: actorId, visitId: visit?.visitId || null,
        lines: cart.map(l => ({ productId: l.productId, qtyBase: l.qtyBase, rate: l.rate })),
      });
      if (visit?.visitId) await fieldApi.checkOut(visit.visitId);
      toast.success(`Order booked · ₹${total.toLocaleString('en-IN')}`);
      setCart([]); setActiveShop(null);
      refreshRun();
    } catch (e) { toast.error(e.message || 'Could not book order'); }
    finally { setBusy(false); }
  };

  const cartTotal = cart.reduce((s, l) => s + l.rate * l.qtyBase, 0);
  const done = run.filter(s => s.status !== 'planned').length;

  const S = {
    input: { width: '100%', padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 15, boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", paddingBottom: 40 }}>
      <ToastContainer theme="light" position="top-center" />

      <button onClick={() => navigate('/field/setup')}
        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Field Setup
      </button>

      <h1 style={{ fontSize: 21, fontWeight: 900, color: '#0F172A', margin: '0 0 12px' }}>Today&apos;s Run</h1>

      {routes.length === 0 ? (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12, padding: 18, textAlign: 'center', color: '#92400E', fontSize: 13 }}>
          No routes set up yet.
          <div style={{ marginTop: 10 }}>
            <button onClick={() => navigate('/field/routes')} style={{ background: '#B45309', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Plan a Route
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Was every route belonging to the distributor, freely
              pickable by anyone — the assignment feature existed in the
              database but nothing enforced it. Now shows only routes
              assigned to THIS rep, plus any genuinely unassigned ones —
              not a hard lock, since a rep covering for someone out sick
              still needs to be able to pick up an open route. */}
          <select value={routeId} onChange={e => { setRouteId(e.target.value); setActiveShop(null); setRun([]); }}
            style={{ ...S.input, marginBottom: 14, fontWeight: 700 }}>
            <option value="">— pick a route —</option>
            {routes
              .filter(r => !r.assignedRepId || r.assignedRepId === actorId)
              .map(r => <option key={r.id} value={r.id}>{r.name} ({r.stopCount} stops){r.assignedRepId ? '' : ' · open'}</option>)}
          </select>

          {routeId && run.length > 0 && (
            <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontWeight: 700, color: '#4338CA', textAlign: 'center' }}>
              {done} of {run.length} outlets done
            </div>
          )}

          {routeId && run.length === 0 && (
            <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '20px 0' }}>
              This route has no outlets yet.
            </p>
          )}

          {run.map((stop, i) => {
            const isActive = activeShop === stop.id;
            const isDone = stop.status === 'visited' && stop.checkedOutAt;
            const isSkipped = stop.status === 'skipped';

            return (
              <div key={stop.id} style={{
                background: '#fff',
                border: `1px solid ${isActive ? '#4F46E5' : '#E2E8F0'}`,
                borderLeft: `4px solid ${isSkipped ? '#94A3B8' : isDone ? '#059669' : isActive ? '#4F46E5' : '#E2E8F0'}`,
                borderRadius: 12, padding: 14, marginBottom: 10,
                opacity: (isDone || isSkipped) && !isActive ? 0.65 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                      <span style={{ color: '#94A3B8', marginRight: 6 }}>{i + 1}.</span>{stop.name}
                    </div>
                    {stop.address && (
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={10} />{stop.address}
                      </div>
                    )}
                    {isSkipped && (
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4, fontStyle: 'italic' }}>
                        Skipped — {stop.skipReason}
                      </div>
                    )}
                  </div>
                  {isDone && <Check size={18} color="#059669" style={{ flexShrink: 0 }} />}
                </div>

                {/* Not yet actioned — offer check-in or skip */}
                {stop.status === 'planned' && !isActive && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => doCheckIn(stop)} disabled={busy}
                      style={{ flex: 1, background: '#4F46E5', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                      Check In
                    </button>
                    <button onClick={() => setSkipFor(skipFor === stop.id ? null : stop.id)}
                      style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      <SkipForward size={14} />
                    </button>
                    {stop.phone && (
                      <a href={`tel:${stop.phone}`}
                        style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #A5D6A7', padding: '12px 14px', borderRadius: 10, display: 'flex', alignItems: 'center' }}>
                        <Phone size={14} />
                      </a>
                    )}
                  </div>
                )}

                {skipFor === stop.id && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {SKIP_REASONS.map(r => (
                      <button key={r} onClick={() => doSkip(stop, r)} disabled={busy}
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', padding: '8px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                )}

                {/* Checked in — order booking */}
                {isActive && (
                  <div style={{ marginTop: 14, borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#4338CA', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ClipboardList size={13} /> Book Order
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <label style={S.label}>Product</label>
                      <select value={pickProduct}
                        onChange={e => {
                          setPickProduct(e.target.value);
                          setPickRate('');  // rate is per-outlet negotiable, don't carry it over
                        }}
                        style={S.input}>
                        <option value="">— select —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={S.label}>Qty</label>
                        <input type="number" inputMode="decimal" value={pickQty} onChange={e => setPickQty(e.target.value)} placeholder="0" style={S.input} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={S.label}>Rate ₹</label>
                        <input type="number" inputMode="decimal" value={pickRate} onChange={e => setPickRate(e.target.value)} placeholder="0" style={S.input} />
                      </div>
                      <button onClick={addToCart}
                        style={{ alignSelf: 'flex-end', background: '#4F46E5', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: 10, cursor: 'pointer' }}>
                        <Plus size={16} />
                      </button>
                    </div>

                    {cart.map(l => (
                      <div key={l.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{l.name}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {l.qtyBase} {l.unit || 'units'} × ₹{l.rate} = ₹{(l.qtyBase * l.rate).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <button onClick={() => setCart(c => c.filter(x => x.productId !== l.productId))}
                          style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {cart.length > 0 && (
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#059669', textAlign: 'right', margin: '10px 0' }}>
                        ₹{cartTotal.toLocaleString('en-IN')}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => submitOrder(stop)} disabled={busy || cart.length === 0}
                        style={{ flex: 1, background: cart.length === 0 ? '#CBD5E1' : '#059669', color: '#fff', border: 'none', padding: '13px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: cart.length === 0 ? 'default' : 'pointer' }}>
                        {busy ? 'Saving…' : 'Book & Next'}
                      </button>
                      <button onClick={() => { setActiveShop(null); setCart([]); }}
                        style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', padding: '13px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
