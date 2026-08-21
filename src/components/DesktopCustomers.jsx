import { useState, useMemo, useEffect, useRef } from 'react';
import { Users, Search, ShoppingBag, Star, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';

function getSegment(c) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyAgo = new Date(now); thirtyAgo.setDate(now.getDate() - 30);
  const thisMonthOrders = c.orders.filter(o => new Date(o.date) >= monthStart);
  const thisMonthSpend = thisMonthOrders.filter(o => o.status === 'Accepted').reduce((s, o) => s + Number(o.total || 0), 0);
  const allDates = c.orders.map(o => new Date(o.date));
  const lastDate = allDates.length ? new Date(Math.max(...allDates)) : null;
  const isNew = c.orders.every(o => new Date(o.date) >= monthStart);
  if (thisMonthSpend >= 5000) return { label: 'VIP', color: 'var(--c-warning-strong)', bg: 'var(--c-warning-soft)', border: 'var(--c-accent-border)' };
  if (thisMonthOrders.length >= 3) return { label: '🔄 Regular', color: 'var(--c-primary)', bg: 'var(--c-primary-soft)', border: 'var(--c-primary-border)' };
  if (isNew && c.orders.length > 0) return { label: '🆕 New', color: 'var(--c-success-strong)', bg: 'var(--c-success-soft)', border: 'var(--c-success-soft)' };
  if (!lastDate || lastDate < thirtyAgo) return { label: '⚠️ At-risk', color: 'var(--c-danger-strong)', bg: 'var(--c-danger-soft)', border: 'var(--c-danger-border)' };
  return null;
}

const StatCard = ({ icon, value, label, color }) => (
  <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
    <div style={{ background: `${color}18`, color, width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--c-ink)', fontWeight: '800' }}>{value}</h4>
      <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-ink-2)' }}>{label}</p>
    </div>
  </div>
);

const DesktopCustomers = ({ orders, targetShopId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);
  const [loyaltyMap, setLoyaltyMap] = useState({});
  const [showVipPanel, setShowVipPanel] = useState(false);
  const loadedRef = useRef(false);

  const customers = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const parts = (order.userId || '').split(':');
      let name = 'Walk-in', phone = '';
      if (parts.length >= 2 && !['walk-in-customer', ''].includes(parts[0])) {
        name = parts[1]?.trim() || 'Guest';
        phone = parts[2]?.replace(/\D/g, '') || '';
      }
      if (!name || name === 'Guest' || name === 'Walk-in') return;
      const key = phone || name;
      if (!map[key]) map[key] = { name, phone, orders: [], totalSpend: 0 };
      map[key].orders.push(order);
      if (order.status === 'Accepted') map[key].totalSpend += order.total;
    });
    return Object.values(map).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [orders]);

  useEffect(() => {
    if (loadedRef.current || customers.length === 0) return;
    loadedRef.current = true;
    const phonedCustomers = customers.filter(c => c.phone);
    if (phonedCustomers.length === 0) return;
    Promise.all(
      phonedCustomers.map(c =>
        api.getLoyaltyPoints(targetShopId, c.phone).then(pts => [c.phone, pts])
      )
    ).then(results => {
      const m = {};
      results.forEach(([phone, pts]) => { m[phone] = pts; });
      setLoyaltyMap(m);
    });
  }, [customers, targetShopId]);

  const filtered = useMemo(() =>
    customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    ), [customers, searchTerm]);

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpend, 0);
  const highValueCount = customers.filter(c => c.totalSpend >= 1000).length;
  const vipCustomers = useMemo(() => customers.filter(c => getSegment(c)?.label === 'VIP'), [customers]);

  return (
    <div className="premium-glass" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--c-line)', background: 'var(--c-surface)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--c-ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="var(--c-muted)" /> Customer CRM
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--c-ink-2)' }}>
            {customers.length} unique customers tracked from billing history
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {vipCustomers.length > 0 && (
            <button
              onClick={() => setShowVipPanel(v => !v)}
              style={{ background: 'var(--c-warning-soft)', color: 'var(--c-warning-strong)', border: '1px solid var(--c-accent-border)', padding: '9px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <MessageSquare size={14} /> WhatsApp VIP ({vipCustomers.length})
            </button>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--c-surface)', borderRadius: '10px', padding: '2px 12px', border: '1px solid var(--c-line)', width: '260px' }}>
            <Search size={16} color="var(--c-muted)" />
            <input
              type="text" placeholder="Search by name or phone..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', margin: 0, width: '100%', padding: '10px 0', color: 'var(--c-ink)', outline: 'none', fontSize: '13px' }}
            />
          </div>
        </div>
      </div>

      {/* VIP bulk-message panel */}
      {showVipPanel && vipCustomers.length > 0 && (
        <div style={{ marginBottom: '20px', background: 'var(--c-warning-soft)', border: '1px solid var(--c-accent-border)', borderRadius: '12px', padding: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '800', color: 'var(--c-warning-strong)' }}>VIP Customers — Send WhatsApp</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {vipCustomers.map(c => (
              <button
                key={c.phone || c.name}
                onClick={() => {
                  const msg = `Hi ${c.name}! 🌟 You are one of our VIP customers. Thank you for your loyalty! We have exclusive deals for you. Visit us soon!`;
                  window.open(`https://wa.me/${c.phone ? c.phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                disabled={!c.phone}
                style={{ background: '#25D366', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: c.phone ? 'pointer' : 'not-allowed', opacity: c.phone ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {c.name} {c.phone ? '' : '(no phone)'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon={<Users size={18} />} value={customers.length} label="Total Customers" color="var(--c-info)" />
        <StatCard icon={<ShoppingBag size={18} />} value={`₹${totalRevenue.toLocaleString('en-IN')}`} label="Total Revenue" color="var(--c-success)" />
        <StatCard icon={<Star size={18} />} value={highValueCount} label="High-Value (₹1000+)" color="var(--c-warning)" />
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Users size={48} color="var(--c-ink-2)" style={{ opacity: 0.15, marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
          <h3 style={{ color: 'var(--c-ink)', margin: '0 0 6px 0' }}>
            {customers.length === 0 ? 'No Customers Yet' : 'No Results Found'}
          </h3>
          <p style={{ color: 'var(--c-ink-2)', fontSize: '13px', margin: 0 }}>
            {customers.length === 0
              ? 'Customers appear here after you enter their name while billing.'
              : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(c => {
            const key = c.phone || c.name;
            const isExpanded = expandedKey === key;
            const sortedOrders = [...c.orders].sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastOrder = sortedOrders[0];
            const pts = c.phone ? loyaltyMap[c.phone] : 0;
            const initials = c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const avatarHue = (c.name.charCodeAt(0) * 7) % 360;
            const segment = getSegment(c);

            return (
              <div key={key} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.2s', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
                {/* Summary row */}
                <div
                  style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `hsl(${avatarHue},60%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '14px', flexShrink: 0 }}>
                    {initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--c-ink)', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</h4>
                      {segment && (
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: segment.bg, color: segment.color, border: `1px solid ${segment.border}`, fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {segment.label}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--c-ink-2)' }}>
                      {c.phone ? c.phone : 'No phone'} · Last visit: {lastOrder?.date ? new Date(lastOrder.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--c-success-strong)' }}>₹{c.totalSpend.toLocaleString('en-IN')}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--c-muted)' }}>{c.orders.length} order{c.orders.length !== 1 ? 's' : ''}</p>
                    </div>

                    {pts > 0 && (
                      <div style={{ background: 'var(--c-violet-soft)', border: '1px solid var(--c-violet-soft)', borderRadius: '8px', padding: '4px 10px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--c-violet)' }}>{pts}</p>
                        <p style={{ margin: 0, fontSize: '9px', color: 'var(--c-violet-strong)' }}>pts</p>
                      </div>
                    )}

                    {c.phone && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const msg = `Hi ${c.name}! 👋 Thank you for shopping with us. We appreciate your loyalty!`;
                          window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        style={{ background: '#25D366', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        WhatsApp
                      </button>
                    )}

                    {isExpanded ? <ChevronUp size={16} color="var(--c-muted)" /> : <ChevronDown size={16} color="var(--c-muted)" />}
                  </div>
                </div>

                {/* Expanded order history */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--c-line)', padding: '16px 20px', background: 'var(--c-bg)' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--c-ink-2)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Order History ({c.orders.length})
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                      {sortedOrders.map(order => (
                        <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--c-surface)', borderRadius: '8px', padding: '8px 12px', border: '1px solid var(--c-line)' }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-ink)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {order.items?.map(i => i.name).join(', ') || 'Custom Order'}
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--c-muted)' }}>
                              {order.date ? new Date(order.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--c-success-strong)' }}>₹{order.total}</p>
                            <span style={{
                              fontSize: '9px', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase',
                              background: order.status === 'Accepted' ? 'var(--c-success-soft)' : 'var(--c-warning-soft)',
                              color: order.status === 'Accepted' ? 'var(--c-success-strong)' : 'var(--c-warning-strong)',
                            }}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DesktopCustomers;
