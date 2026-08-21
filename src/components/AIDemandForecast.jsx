import { useMemo } from 'react';
import { AlertTriangle, Package, Brain, Lock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { localDateStr, lastNLocalDays } from '../lib/dateUtils';

// Exponential smoothing + day-of-week seasonality
function forecast(salesHistory, daysAhead = 7) {
  if (!salesHistory || salesHistory.length < 3) return [];
  const n = salesHistory.length;
  const alpha = 0.3, beta = 0.1;
  let level = salesHistory[0];
  let trend = (salesHistory[n - 1] - salesHistory[0]) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const pl = level;
    level = alpha * salesHistory[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - pl) + (1 - beta) * trend;
  }
  const dowIndex = Array(7).fill(0).map((_, d) => {
    const vals = salesHistory.filter((_, i) => i % 7 === d);
    return vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
  });
  const avgDow = dowIndex.reduce((s, v) => s + v, 0) / 7 || 1;
  const seasonal = dowIndex.map(v => v / avgDow);
  const today = new Date();
  return Array.from({ length: daysAhead }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i + 1);
    const dow = date.getDay();
    const raw = (level + trend * (i + 1)) * seasonal[dow];
    return {
      day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow],
      date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      predicted: Math.max(0, Math.round(raw)),
    };
  });
}

function buildProductSales(orders, products) {
  // Local calendar-day buckets — was using toISOString() (UTC), which
  // misattributes any sale made before 5:30 AM IST to the previous day's
  // bucket, feeding wrong day-of-week patterns into the forecast below.
  const days30 = lastNLocalDays(30);
  const accepted = (orders || []).filter(o =>
    ['Accepted','accepted','Completed','completed'].includes(o.status)
  );
  const productMap = {};
  (products || []).forEach(p => { productMap[p.id] = p; });
  const salesByProduct = {};
  accepted.forEach(order => {
    const dateStr = order.date ? localDateStr(new Date(order.date)) : '';
    (order.items || []).forEach(item => {
      const key = item.id || item.name;
      if (!salesByProduct[key]) {
        salesByProduct[key] = {
          id: key, name: item.name || key,
          dailySales: Object.fromEntries(days30.map(d => [d, 0])),
          totalSold: 0, totalRevenue: 0,
          currentStock: productMap[key]?.stock ?? null,
          price: item.price || 0,
        };
      }
      const qty = Number(item.qty || 1);
      if (salesByProduct[key].dailySales[dateStr] !== undefined)
        salesByProduct[key].dailySales[dateStr] += qty;
      salesByProduct[key].totalSold += qty;
      salesByProduct[key].totalRevenue += qty * Number(item.price || 0);
    });
  });
  return Object.values(salesByProduct).sort((a, b) => b.totalSold - a.totalSold);
}

function reorderRec(product, forecastData) {
  if (!forecastData.length) return null;
  const avgDaily = forecastData.reduce((s, d) => s + d.predicted, 0) / forecastData.length;
  const leadTimeDays = 3, safetyStock = Math.ceil(avgDaily * 2);
  const reorderPoint = Math.ceil(avgDaily * leadTimeDays) + safetyStock;
  const suggestedQty = Math.ceil(avgDaily * 14);
  const stock = product.currentStock;
  const daysLeft = stock !== null && avgDaily > 0 ? Math.floor(stock / avgDaily) : null;
  return {
    avgDaily: avgDaily.toFixed(1), reorderPoint, suggestedQty, daysLeft,
    urgent: stock !== null && stock <= reorderPoint,
    outSoon: daysLeft !== null && daysLeft <= 5,
  };
}

const TIER_CONFIG = {
  trial:      { forecastDays: 0,  maxProducts: 0,  label: 'Not Available',  color: 'var(--c-muted)' },
  starter:    { forecastDays: 0,  maxProducts: 0,  label: 'Pro Plan',        color: 'var(--c-muted)' },
  pro:        { forecastDays: 7,  maxProducts: 10, label: '7-Day Forecast',  color: 'var(--c-violet)' },
  enterprise: { forecastDays: 30, maxProducts: -1, label: '30-Day Forecast', color: 'var(--c-success)' },
};

export default function AIDemandForecast({ orders = [], products = [], user }) {
  const sub = user?.subscriptionTier || user?.subscription || 'trial';
  // Map active subscription to tier name
  const tierKey = sub === 'active' ? 'pro' : (TIER_CONFIG[sub] ? sub : 'trial');
  const tier = TIER_CONFIG[tierKey];
  const hasAccess = tier.forecastDays > 0;

  const productSales = useMemo(() => buildProductSales(orders, products), [orders, products]);
  const topProducts = hasAccess
    ? (tier.maxProducts === -1 ? productSales : productSales.slice(0, tier.maxProducts))
    : [];

  const forecasts = useMemo(() => topProducts.map(p => {
    const history = Object.values(p.dailySales);
    const fc = forecast(history, tier.forecastDays);
    return { ...p, forecast: fc, rec: reorderRec(p, fc) };
  }), [topProducts, tier.forecastDays]);

  const urgentItems = forecasts.filter(f => f.rec?.urgent);
  const outSoonItems = forecasts.filter(f => f.rec?.outSoon && !f.rec?.urgent);

  if (!hasAccess) {
    return (
      <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: '16px', padding: '48px 32px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--c-violet-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid var(--c-violet-soft)' }}>
          <Brain size={32} color="var(--c-violet)" />
        </div>
        <h3 style={{ color: 'var(--c-ink)', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>AI Demand Forecasting</h3>
        <p style={{ color: 'var(--c-ink-2)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          Stop guessing reorders. Our AI analyses your 30-day sales history, detects weekly seasonality patterns,
          and predicts exactly which SKUs will run out — before they do. Save money on overstocking and never lose
          a sale to stockout again.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', maxWidth: '480px', margin: '0 auto 24px' }}>
          {[
            { icon: '📈', text: '7–30 day demand forecast per SKU' },
            { icon: '🔔', text: 'Low-stock alerts with days-left counter' },
            { icon: '📦', text: 'Smart reorder quantity suggestions' },
          ].map((f, i) => (
            <div key={i} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-violet-soft)', borderRadius: '10px', padding: '12px 8px' }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{f.icon}</div>
              <div style={{ color: 'var(--c-violet)', fontSize: '11px', lineHeight: 1.4 }}>{f.text}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--c-violet-soft)', border: '1px solid var(--c-violet-soft)', borderRadius: '10px', padding: '10px 20px' }}>
          <Lock size={14} color="var(--c-violet)" />
          <span style={{ color: 'var(--c-violet)', fontSize: '13px', fontWeight: 600 }}>Available on Pro Plan (₹999/mo) and above</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `rgba(${tierKey === 'enterprise' ? '16,185,129' : '139,92,246'},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={22} color={tier.color} />
          </div>
          <div>
            <h3 style={{ color: 'var(--c-ink)', fontSize: '17px', fontWeight: 700, margin: 0 }}>AI Demand Forecasting</h3>
            <div style={{ color: tier.color, fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>
              ● {tier.label} · {topProducts.length} SKUs analysed
            </div>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--c-muted)', background: 'var(--c-bg)', border: '1px solid var(--c-line)', borderRadius: '8px', padding: '6px 12px' }}>
          Exp. Smoothing + Day-of-Week Seasonality
        </div>
      </div>

      {/* Urgent alerts */}
      {urgentItems.length > 0 && (
        <div style={{ background: 'var(--c-danger-soft)', border: '1px solid var(--c-danger-border)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={16} color="var(--c-danger)" />
            <span style={{ color: 'var(--c-danger-strong)', fontWeight: 700, fontSize: '14px' }}>Reorder Now — {urgentItems.length} item{urgentItems.length > 1 ? 's' : ''} at or below reorder point</span>
          </div>
          {urgentItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--c-surface)', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', flexWrap: 'wrap', gap: '8px', border: '1px solid var(--c-danger-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={14} color="var(--c-danger)" />
                <span style={{ color: 'var(--c-ink)', fontWeight: 600, fontSize: '13px' }}>{item.name}</span>
                {item.currentStock !== null && <span style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger-strong)', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--c-danger-border)' }}>Stock: {item.currentStock}</span>}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--c-muted)', fontSize: '11px' }}>~{item.rec.avgDaily}/day</span>
                {item.rec.daysLeft !== null && <span style={{ color: 'var(--c-danger)', fontSize: '11px', fontWeight: 700 }}>⚠ {item.rec.daysLeft}d left</span>}
                <span style={{ background: 'var(--c-success-soft)', color: 'var(--c-success)', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--c-success-soft)' }}>Order {item.rec.suggestedQty} units</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Out-soon warnings */}
      {outSoonItems.length > 0 && (
        <div style={{ background: 'var(--c-orange-soft)', border: '1px solid var(--c-orange-soft)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <AlertTriangle size={14} color="var(--c-warning)" />
          <span style={{ color: 'var(--c-orange-strong)', fontWeight: 700, fontSize: '13px' }}>Running Low:</span>
          {outSoonItems.map(item => (
            <span key={item.id} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-orange-soft)', borderRadius: '8px', padding: '4px 10px', color: 'var(--c-ink)', fontSize: '12px' }}>
              {item.name} <span style={{ color: 'var(--c-orange)' }}>({item.rec.daysLeft}d)</span>
            </span>
          ))}
        </div>
      )}

      {/* Per-product cards */}
      {forecasts.slice(0, 8).map(item => (
        <div key={item.id} style={{ background: 'var(--c-surface)', border: `1px solid ${item.rec?.urgent ? 'var(--c-danger-border)' : 'var(--c-line)'}`, borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--c-ink)', fontWeight: 700, fontSize: '14px' }}>{item.name}</span>
              {item.rec?.urgent && <span style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger)', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--c-danger-border)' }}>URGENT</span>}
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--c-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Sold 30d</div>
                <div style={{ color: 'var(--c-accent-hover)', fontWeight: 700, fontSize: '15px' }}>{item.totalSold}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--c-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Revenue</div>
                <div style={{ color: 'var(--c-success-strong)', fontWeight: 700, fontSize: '15px' }}>₹{item.totalRevenue.toLocaleString('en-IN')}</div>
              </div>
              {item.currentStock !== null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--c-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Stock</div>
                  <div style={{ color: item.rec?.urgent ? 'var(--c-danger)' : 'var(--c-ink)', fontWeight: 700, fontSize: '15px' }}>{item.currentStock}</div>
                </div>
              )}
              {item.rec?.daysLeft !== null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--c-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Days Left</div>
                  <div style={{ color: item.rec.daysLeft <= 3 ? 'var(--c-danger)' : item.rec.daysLeft <= 7 ? 'var(--c-warning)' : 'var(--c-success)', fontWeight: 700, fontSize: '15px' }}>{item.rec.daysLeft}d</div>
                </div>
              )}
            </div>
          </div>
          {item.forecast.length > 0 && (
            <div style={{ height: '90px', marginBottom: '12px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={item.forecast} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fill: 'var(--c-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--c-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '8px', fontSize: 11, color: 'var(--c-ink)' }} labelStyle={{ color: 'var(--c-muted)' }} formatter={v => [`${v} units`, 'Predicted']} />
                  <Bar dataKey="predicted" radius={[4,4,0,0]} maxBarSize={28}>
                    {item.forecast.map((_, i) => (
                      <Cell key={i} fill={item.rec?.urgent ? '#C2382B' : tier.color} fillOpacity={0.55 + i * 0.03} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {item.rec && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--c-bg)', borderRadius: '8px', padding: '8px 12px', border: '1px solid var(--c-line)' }}>
              <span style={{ color: 'var(--c-muted)', fontSize: '11px' }}>📦 Reorder trigger: {item.rec.reorderPoint} units</span>
              <span style={{ color: 'var(--c-line-strong)', fontSize: '11px' }}>·</span>
              <span style={{ color: 'var(--c-muted)', fontSize: '11px' }}>Avg demand: {item.rec.avgDaily}/day</span>
              <span style={{ color: 'var(--c-line-strong)', fontSize: '11px' }}>·</span>
              <span style={{ background: `rgba(${tierKey === 'enterprise' ? '16,185,129' : '139,92,246'},0.15)`, color: tier.color, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px' }}>
                Suggest: {item.rec.suggestedQty} units (2-week supply)
              </span>
            </div>
          )}
        </div>
      ))}

      {tierKey === 'pro' && productSales.length > 10 && (
        <div style={{ textAlign: 'center', padding: '14px', background: 'var(--c-success-soft)', border: '1px solid var(--c-success-soft)', borderRadius: '12px' }}>
          <span style={{ color: 'var(--c-success-strong)', fontSize: '13px' }}>
            Showing top 10 SKUs. <span style={{ color: 'var(--c-success)', fontWeight: 600 }}>Upgrade to Enterprise for all {productSales.length} SKUs + 30-day forecast.</span>
          </span>
        </div>
      )}

      {forecasts.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--c-muted)', padding: '40px', fontSize: '13px' }}>
          No sales history yet. Start billing customers — AI forecasts appear automatically after a few orders.
        </div>
      )}
    </div>
  );
}
