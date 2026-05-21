import { useState, useMemo, useEffect, useRef } from 'react';
import { Users, Search, ShoppingBag, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';

const StatCard = ({ icon, value, label, color }) => (
  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
    <div style={{ background: `${color}22`, color, width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <h4 style={{ margin: 0, fontSize: '18px', color: 'white', fontWeight: '800' }}>{value}</h4>
      <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{label}</p>
    </div>
  </div>
);

const DesktopCustomers = ({ orders, targetShopId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);
  const [loyaltyMap, setLoyaltyMap] = useState({});
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

  return (
    <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="#3b82f6" /> Customer CRM
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            {customers.length} unique customers tracked from billing history
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#0f172a', borderRadius: '10px', padding: '2px 12px', border: '1px solid #334155', width: '260px' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text" placeholder="Search by name or phone..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', margin: 0, width: '100%', padding: '10px 0', color: 'white', outline: 'none', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon={<Users size={18} />} value={customers.length} label="Total Customers" color="#3b82f6" />
        <StatCard icon={<ShoppingBag size={18} />} value={`₹${totalRevenue.toLocaleString('en-IN')}`} label="Total Revenue" color="#10b981" />
        <StatCard icon={<Star size={18} />} value={highValueCount} label="High-Value (₹1000+)" color="#f59e0b" />
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Users size={48} color="white" style={{ opacity: 0.15, marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
          <h3 style={{ color: '#fff', margin: '0 0 6px 0' }}>
            {customers.length === 0 ? 'No Customers Yet' : 'No Results Found'}
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
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

            return (
              <div key={key} className="premium-glass" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                {/* Summary row */}
                <div
                  style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `hsl(${avatarHue},60%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '14px', flexShrink: 0 }}>
                    {initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: '14px', color: 'white', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                      {c.phone ? `📞 ${c.phone}` : 'No phone'} · Last visit: {lastOrder?.date ? new Date(lastOrder.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#10b981' }}>₹{c.totalSpend.toLocaleString('en-IN')}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>{c.orders.length} order{c.orders.length !== 1 ? 's' : ''}</p>
                    </div>

                    {pts > 0 && (
                      <div style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '8px', padding: '4px 10px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#a78bfa' }}>⭐ {pts}</p>
                        <p style={{ margin: 0, fontSize: '9px', color: '#7c3aed' }}>pts</p>
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

                    {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                  </div>
                </div>

                {/* Expanded order history */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '16px 20px', background: 'rgba(0,0,0,0.15)' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Order History ({c.orders.length})
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                      {sortedOrders.map(order => (
                        <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {order.items?.map(i => i.name).join(', ') || 'Custom Order'}
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#475569' }}>
                              {order.date ? new Date(order.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#10b981' }}>₹{order.total}</p>
                            <span style={{
                              fontSize: '9px', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase',
                              background: order.status === 'Accepted' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                              color: order.status === 'Accepted' ? '#10b981' : '#f59e0b',
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
