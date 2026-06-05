import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';
import { Users, Link, CheckCircle, Clock, Plus, ToggleLeft, ToggleRight, IndianRupee, TrendingUp } from 'lucide-react';

const S = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
  label: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' },
  val: { color: '#f8fafc', fontSize: '26px', fontWeight: 700 },
  th: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 12px', textAlign: 'left' },
  td: { color: '#f8fafc', fontSize: '13px', padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  inp: { width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' },
  btn: (color) => ({ background: color, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }),
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ ...S.card, marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ background: `${color}22`, borderRadius: '8px', padding: '7px', display: 'flex' }}><Icon size={16} color={color} /></div>
        <span style={S.label}>{label}</span>
      </div>
      <div style={S.val}>{value}</div>
    </div>
  );
}

export default function TabAffiliate() {
  const [codes, setCodes] = useState([]);
  const [attrs, setAttrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [approveId, setApproveId] = useState('');
  const [approveAmt, setApproveAmt] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('overview');

  const load = async () => {
    setLoading(true);
    const [c, a] = await Promise.all([api.getAllReferralCodes(), api.getAllReferralAttributions()]);
    setCodes(c || []); setAttrs(a || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalPending = attrs.filter(a => a.status === 'pending').reduce((s, a) => s + (a.amount || 0), 0);
  const totalApproved = attrs.filter(a => a.status === 'approved' || a.status === 'paid').reduce((s, a) => s + (a.amount || 0), 0);

  const handleCreateAffiliate = async () => {
    if (!newPhone.trim() || !newName.trim()) return toast.error('Phone and name required');
    try {
      await api.createAffiliateUser(newPhone.trim(), newName.trim());
      toast.success(`Affiliate account created for ${newName}`);
      setNewPhone(''); setNewName(''); load();
    } catch (e) { toast.error(e.message); }
  };

  const handleToggleCode = async (id, current) => {
    try { await api.toggleReferralCode(id, !current); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleApprove = async () => {
    if (!approveId || !approveAmt) return;
    try {
      await api.approveReferralCommission(approveId, Number(approveAmt));
      toast.success('Commission approved ✅');
      setApproveId(''); setApproveAmt(''); load();
    } catch (e) { toast.error(e.message); }
  };

  const statusChip = (s) => ({
    pending: <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Pending</span>,
    approved: <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Approved</span>,
    paid: <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Paid</span>,
  }[s] || <span style={{ color: '#64748b', fontSize: 11 }}>{s}</span>);

  return (
    <div style={{ padding: '24px', maxWidth: 1100 }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>🔗 Affiliate & Referral System</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '13px' }}>Manage affiliate partners, referral codes, and commission approvals.</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard icon={Users} label="Total Affiliates" value={codes.length} color="#8b5cf6" />
        <StatCard icon={TrendingUp} label="Total Referrals" value={attrs.length} color="#3b82f6" />
        <StatCard icon={Clock} label="Pending Commissions" value={`₹${totalPending}`} color="#f59e0b" />
        <StatCard icon={IndianRupee} label="Approved Commissions" value={`₹${totalApproved}`} color="#10b981" />
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['overview','Referral Codes'],['attributions','Referral Attributions'],['create','Create Affiliate']].map(([id,lbl]) => (
          <button key={id} onClick={() => setActiveSubTab(id)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: activeSubTab === id ? '#8b5cf6' : 'rgba(255,255,255,0.06)', color: activeSubTab === id ? '#fff' : '#94a3b8' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : (
        <>
          {/* ── Referral Codes ── */}
          {activeSubTab === 'overview' && (
            <div style={S.card}>
              <h3 style={{ margin: '0 0 16px', color: '#f8fafc', fontSize: 15, fontWeight: 700 }}>All Referral Codes</h3>
              {codes.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 13 }}>No referral codes yet. Create an affiliate to generate one.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Code','Owner','Role','Commission','Status','Action'].map(h => <th key={h} style={S.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {codes.map(c => (
                        <tr key={c.id}>
                          <td style={S.td}><span style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', borderRadius: 6, padding: '3px 10px', fontWeight: 800, fontFamily: 'monospace', fontSize: 14 }}>{c.code}</span></td>
                          <td style={S.td}><div style={{ fontWeight: 600 }}>{c.ownerName}</div><div style={{ color: '#64748b', fontSize: 11 }}>{c.ownerPhone}</div></td>
                          <td style={S.td}><span style={{ color: '#94a3b8', fontSize: 12 }}>{c.ownerRole}</span></td>
                          <td style={S.td}><span style={{ color: '#10b981', fontWeight: 700 }}>{c.commissionPct}%</span></td>
                          <td style={S.td}>{c.isActive ? <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>● Active</span> : <span style={{ color: '#ef4444', fontSize: 12 }}>● Inactive</span>}</td>
                          <td style={S.td}>
                            <button onClick={() => handleToggleCode(c.id, c.isActive)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                              {c.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Attributions / Commissions ── */}
          {activeSubTab === 'attributions' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 15, fontWeight: 700 }}>Referral Attributions</h3>
                {approveId && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#f59e0b', fontSize: 12 }}>Approve selected →</span>
                    <input type="number" placeholder="₹ amount" value={approveAmt} onChange={e => setApproveAmt(e.target.value)}
                      style={{ ...S.inp, width: 100 }} />
                    <button onClick={handleApprove} style={S.btn('#10b981')}>Approve</button>
                    <button onClick={() => { setApproveId(''); setApproveAmt(''); }} style={S.btn('#475569')}>Cancel</button>
                  </div>
                )}
              </div>
              {attrs.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 13 }}>No referral attributions yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Code','Referred By','New User','Plan','Commission','Status','Action'].map(h => <th key={h} style={S.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {attrs.map(a => (
                        <tr key={a.id} style={{ background: approveId === a.id ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                          <td style={S.td}><span style={{ fontFamily: 'monospace', color: '#a78bfa', fontWeight: 700 }}>{a.code}</span></td>
                          <td style={S.td}><div style={{ fontWeight: 600 }}>{a.referrerName || '—'}</div><div style={{ color: '#64748b', fontSize: 11 }}>{a.referrerPhone}</div></td>
                          <td style={S.td}><div style={{ fontWeight: 600 }}>{a.referredName || '—'}</div><div style={{ color: '#64748b', fontSize: 11 }}>{a.referredPhone}</div></td>
                          <td style={S.td}><span style={{ color: '#8b5cf6', fontSize: 12 }}>{a.tier || 'trial'}</span></td>
                          <td style={S.td}><span style={{ color: '#10b981', fontWeight: 700 }}>₹{a.amount || 0}</span></td>
                          <td style={S.td}>{statusChip(a.status)}</td>
                          <td style={S.td}>
                            {a.status === 'pending' && (
                              <button onClick={() => { setApproveId(a.id); setApproveAmt(''); }}
                                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Create Affiliate ── */}
          {activeSubTab === 'create' && (
            <div style={S.card}>
              <h3 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: 15, fontWeight: 700 }}>Create New Affiliate Account</h3>
              <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 20px' }}>Creates a new user with role "affiliate" and sends them a login. They will access the affiliate panel at /affiliate.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 480 }}>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>Full Name</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Ravi Kumar" style={S.inp} />
                </div>
                <div>
                  <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>Mobile Number</label>
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="10-digit number" style={S.inp} />
                </div>
              </div>
              <button onClick={handleCreateAffiliate} style={{ ...S.btn('linear-gradient(135deg,#8b5cf6,#6d28d9)'), marginTop: 16, padding: '10px 24px' }}>
                + Create Affiliate Account
              </button>
              <p style={{ color: '#475569', fontSize: 11, marginTop: 12 }}>
                ⚠️ After creating, set their password via Admin → User Directory, or ask them to use "Forgot Password".
                A referral code will be auto-generated when they first visit their affiliate dashboard.
              </p>
            </div>
          )}
        </>
      )}

      {/* SQL reminder */}
      <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '14px 18px', marginTop: 20 }}>
        <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>⚠️ Required: Run this SQL in Supabase SQL Editor once</div>
        <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{`CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  commission_pct integer DEFAULT 20,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid REFERENCES referral_codes(id) ON DELETE SET NULL,
  code text NOT NULL,
  referrer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  referred_id uuid REFERENCES users(id) ON DELETE CASCADE,
  commission_amount integer DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);`}</pre>
      </div>
    </div>
  );
}
