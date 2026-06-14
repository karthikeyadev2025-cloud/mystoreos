import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Copy, Link, LogOut, TrendingUp, Users, IndianRupee, Clock, CheckCircle } from 'lucide-react';

const S = {
  card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '24px', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' },
  label: { color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  val: { color: '#0F172A', fontSize: 28, fontWeight: 800 },
  sub: { color: '#64748B', fontSize: 12, marginTop: 4 },
  th: { color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 12px', textAlign: 'left' },
  td: { color: '#0F172A', fontSize: 13, padding: '11px 12px', borderBottom: '1px solid #F1F5F9' },
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ ...S.card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ background: `${color}22`, borderRadius: 8, padding: 7, display: 'flex' }}><Icon size={16} color={color} /></div>
        <span style={S.label}>{label}</span>
      </div>
      <div style={S.val}>{value}</div>
      {sub && <div style={S.sub}>{sub}</div>}
    </div>
  );
}

export default function AffiliateDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [codeInfo, setCodeInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [code, st] = await Promise.all([
          api.getOrCreateReferralCode(user.id, user.name),
          api.getReferralStats(user.id),
        ]);
        setCodeInfo(code); setStats(st);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  const referralLink = codeInfo ? `https://mystoreos.in/register?ref=${codeInfo.code}` : '';

  const copyCode = () => {
    if (codeInfo) { navigator.clipboard.writeText(codeInfo.code); toast.success('Code copied!'); }
  };
  const copyLink = () => {
    if (referralLink) { navigator.clipboard.writeText(referralLink); toast.success('Link copied!'); }
  };
  const shareWA = () => {
    if (!referralLink) return;
    const msg = `Join MyStore OS — India's #1 billing app for kirana shops! 🛒\n\nUse my referral link to sign up and get started free:\n${referralLink}\n\nPowered by mystoreos.in`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const statusChip = (s) => ({
    pending: <span style={{ background: '#FEF3C7', color: '#B45309', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Pending</span>,
    approved: <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Approved</span>,
    paid: <span style={{ background: '#D1FAE5', color: '#047857', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Paid</span>,
  }[s] || <span style={{ color: '#64748B', fontSize: 11 }}>{s}</span>);

  return (
    <div className="enterprise-wrapper" style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <ToastContainer position="top-right" theme="light" />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#4F46E5,#818CF8)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#fff' }}>Affiliate Portal</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Welcome, {user?.name} · Partner</div>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {loading ? (
          <div style={{ color: '#64748B', textAlign: 'center', padding: 60 }}>Loading your dashboard...</div>
        ) : (
          <>
            {/* Referral Code Card */}
            <div style={{ ...S.card, background: 'linear-gradient(135deg,#EEF2FF,#FFFFFF)', border: '1px solid #C7D2FE', marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 16px', color: '#0F172A', fontSize: 18, fontWeight: 800 }}>Your Referral Code</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ background: '#FFFFFF', border: '2px solid #818CF8', borderRadius: 12, padding: '12px 24px', fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#4F46E5', letterSpacing: 4 }}>
                  {codeInfo?.code || '—'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={copyCode} style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)', color: '#4F46E5', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: 'auto' }}>
                    <Copy size={13} /> Copy Code
                  </button>
                  <button onClick={copyLink} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: 'auto' }}>
                    <Link size={13} /> Copy Link
                  </button>
                </div>
                <button onClick={shareWA} style={{ background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', color: '#fff', padding: '14px 22px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', width: 'auto', whiteSpace: 'nowrap' }}>
                  Share on WhatsApp
                </button>
              </div>
              <div style={{ marginTop: 14, background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {referralLink}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#475569' }}>
                Commission: <strong style={{ color: '#4F46E5' }}>{codeInfo?.commissionPct || 20}%</strong> of referred user's first 3 months subscription · Approved and paid monthly by admin.
              </p>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
              <StatCard icon={Users} label="Total Referred" value={stats?.totalReferred || 0} sub="Users who signed up via your link" color="#2563EB" />
              <StatCard icon={Clock} label="Pending Commission" value={`₹${stats?.pendingAmount || 0}`} sub="Awaiting admin approval" color="#D97706" />
              <StatCard icon={IndianRupee} label="Approved Earnings" value={`₹${stats?.approvedAmount || 0}`} sub="Ready for payout" color="#059669" />
            </div>

            {/* How it works */}
            <div style={{ ...S.card, marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 16px', color: '#0F172A', fontSize: 16, fontWeight: 800 }}>How It Works</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
                {[
                  ['1', 'Share your link', 'Send your unique referral link to shop owners via WhatsApp, social media, or in-person.'],
                  ['2', 'They sign up', 'When they register using your link, they\'re automatically attributed to you.'],
                  ['3', 'They subscribe', 'When they upgrade to any paid plan, your commission is calculated.'],
                  ['4', 'You get paid', 'Admin approves and pays your commission every month.'],
                ].map(([emoji, title, desc]) => (
                  <div key={title} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{emoji}</div>
                    <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
                    <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Referrals table */}
            {stats?.referrals?.length > 0 && (
              <div style={S.card}>
                <h3 style={{ margin: '0 0 16px', color: '#0F172A', fontSize: 16, fontWeight: 800 }}>Your Referrals</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        {['Name', 'Phone', 'Plan', 'Commission', 'Status', 'Date'].map(h => <th key={h} style={S.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.referrals.map(r => (
                        <tr key={r.id}>
                          <td style={S.td}><strong>{r.name}</strong></td>
                          <td style={S.td}><span style={{ color: '#475569' }}>{r.phone || '—'}</span></td>
                          <td style={S.td}><span style={{ color: '#4F46E5', fontSize: 12 }}>{r.tier || 'trial'}</span></td>
                          <td style={S.td}><span style={{ color: '#059669', fontWeight: 700 }}>₹{r.amount}</span></td>
                          <td style={S.td}>{statusChip(r.status)}</td>
                          <td style={S.td}><span style={{ color: '#6366F1', fontSize: 12 }}>{r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!stats?.referrals?.length) && (
              <div style={{ ...S.card, textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
                <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No referrals yet</div>
                <div style={{ color: '#475569', fontSize: 13 }}>Share your referral link above to start earning commissions!</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
