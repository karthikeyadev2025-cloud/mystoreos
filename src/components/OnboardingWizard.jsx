import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { CheckCircle, ChevronRight, ChevronLeft, Plus, X } from 'lucide-react';
import { validateImageFile } from '../lib/fileValidation';

const BIZ_TYPES = ['Kirana / Grocery', 'Supermarket', 'Medical / Pharmacy', 'Salon / Beauty',
  'Tailor / Garments', 'Restaurant / Hotel', 'Hardware / Electronics', 'Wholesale / Distribution', 'Other'];

const emptyProd = () => ({ name: '', price: '', stock: '' });

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,var(--c-ink-surface),var(--c-primary),var(--c-ink-surface-2))', padding: '20px', fontFamily: 'Plus Jakarta Sans, sans-serif' },
  card: { background: 'rgba(30,41,59,0.9)', backdropFilter: 'blur(20px)', padding: '36px 28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 480, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' },
  inp: { width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: 'var(--c-surface)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  lbl: { display: 'block', color: 'var(--c-line-strong)', fontSize: '12px', marginBottom: 5, fontWeight: 600 },
  row: { marginBottom: 14 },
  skip: { flex: '0 0 auto', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--c-muted)', fontSize: '13px', cursor: 'pointer' },
  next: { flex: 1, padding: '14px', background: 'linear-gradient(135deg,var(--c-danger),var(--c-violet))', color: 'var(--c-surface)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
};

function ProgressBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '28px' }}>
      {[1, 2, 3, 4].map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 4 ? 1 : 'none' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, background: step >= s ? 'linear-gradient(135deg,var(--c-danger),var(--c-violet))' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step >= s ? 'var(--c-surface)' : 'var(--c-muted)', fontSize: '12px', fontWeight: 700, border: step === s ? '2px solid var(--c-danger)' : '2px solid transparent' }}>
            {step > s ? '✓' : s}
          </div>
          {i < 3 && <div style={{ flex: 1, height: '2px', background: step > s ? 'linear-gradient(to right,var(--c-danger),var(--c-violet))' : 'rgba(255,255,255,0.08)', margin: '0 4px' }} />}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingWizard() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [bizName, setBizName] = useState(user?.name || '');
  const [bizType, setBizType] = useState('');
  const [city, setCity] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  const [gstin, setGstin] = useState('');
  const [upiId, setUpiId] = useState('');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState(user?.phone || '');

  const [products, setProducts] = useState([emptyProd(), emptyProd(), emptyProd()]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.status !== 'pending') { navigate('/dashboard'); }
  }, [user, navigate]);

  const markDone = () => {
    try { localStorage.setItem(`onboarded_${user?.id}`, '1'); } catch { /* ignore */ }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) { toast.error(check.reason); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Resize before storing — was the only image upload path in the app
      // with NO compression step at all: saveProfile() later uploads
      // whatever's in logoFile straight to storage, so an unresized 5-8MB
      // onboarding photo would have been the permanent shop logo loaded
      // on every single page view (storefront, bills, every dashboard
      // visit) from day one.
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(400 / img.width, 400 / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setLogoPreview(canvas.toDataURL('image/jpeg', 0.8));
        canvas.toBlob((blob) => {
          if (blob) setLogoFile(new File([blob], 'logo.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.8);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    try {
      const updates = { name: bizName || user.name, businessAddress: [city, address].filter(Boolean).join(', ') };
      if (upiId) updates.upiId = upiId;
      if (gstin) updates.gstin = gstin;
      if (logoFile) { const url = await api.uploadAsset(logoFile, user.id, 'logos'); updates.logo = url; }
      const updated = await api.updateProfile(user.id, updates);
      if (updated) login({ ...user, ...updated });
    } catch (e) { console.error('Profile save failed:', e); }
  };

  const saveProducts = async () => {
    const toSave = products.filter(p => p.name && p.price);
    for (const p of toSave) {
      try { await api.addProduct(user.id, p.name, parseFloat(p.price) || 0, '', parseInt(p.stock) || 0); }
      catch { /* non-fatal */ }
    }
  };

  const goStep2 = () => setStep(2);

  const step2Continue = async () => {
    setSaving(true);
    await saveProfile();
    setSaving(false);
    if (user?.role === 'distributor') { markDone(); setStep(4); } else setStep(3);
  };

  const step3Done = async (skip = false) => {
    setSaving(true);
    if (!skip) await saveProducts();
    markDone();
    setSaving(false);
    setStep(4);
  };

  if (!user) return null;

  const backBtn = (toStep) => (
    <button onClick={() => setStep(toStep)} style={{ background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: 0, marginBottom: 16 }}>
      <ChevronLeft size={14} /> Back
    </button>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <ProgressBar step={step} />

        {step === 1 && (
          <>
            <h1 style={{ fontSize: '22px', color: 'var(--c-surface)', fontWeight: 900, margin: '0 0 4px' }}>Let's set up your business</h1>
            <p style={{ color: 'var(--c-faint)', fontSize: '13px', margin: '0 0 22px' }}>Step 1 of 4 — Basic profile</p>

            <div style={S.row}>
              <label style={S.lbl}>Business Name</label>
              <input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="e.g. Sai Supermarket" style={S.inp} />
            </div>
            <div style={S.row}>
              <label style={S.lbl}>Business Type</label>
              <select value={bizType} onChange={e => setBizType(e.target.value)} style={{ ...S.inp, background: 'var(--c-ink)' }}>
                <option value="">Select type…</option>
                {BIZ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={S.row}>
              <label style={S.lbl}>City / District</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai, Hyderabad" style={S.inp} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={S.lbl}>Shop Logo <span style={{ color: 'var(--c-muted)', fontWeight: 400 }}>(optional)</span></label>
              {logoPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={logoPreview} alt="logo" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
                  <button onClick={() => { setLogoFile(null); setLogoPreview(''); }} style={{ background: 'none', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <X size={13} /> Remove
                  </button>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '10px' }}>
                  <Plus size={15} color="var(--c-muted)" />
                  <span style={{ color: 'var(--c-muted)', fontSize: '13px' }}>Upload logo image</span>
                  <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={S.skip} onClick={() => { markDone(); setStep(4); }}>Skip all</button>
              <button style={S.next} onClick={goStep2}>Continue <ChevronRight size={16} /></button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {backBtn(1)}
            <h1 style={{ fontSize: '22px', color: 'var(--c-surface)', fontWeight: 900, margin: '0 0 4px' }}>Business details</h1>
            <p style={{ color: 'var(--c-faint)', fontSize: '13px', margin: '0 0 22px' }}>Step 2 of 4 — Helps us verify your business</p>

            <div style={S.row}>
              <label style={S.lbl}>GST Number <span style={{ color: 'var(--c-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} style={S.inp} />
            </div>
            <div style={S.row}>
              <label style={S.lbl}>UPI ID <span style={{ color: 'var(--c-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="9876543210@ybl" style={S.inp} />
            </div>
            <div style={S.row}>
              <label style={S.lbl}>Business Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, area, landmark" style={S.inp} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={S.lbl}>WhatsApp Number</label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} placeholder="10-digit number" style={S.inp} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={S.skip} onClick={() => user?.role === 'distributor' ? (markDone(), setStep(4)) : setStep(3)}>Skip</button>
              <button style={{ ...S.next, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }} onClick={step2Continue} disabled={saving}>
                {saving ? 'Saving…' : <><span>Continue</span> <ChevronRight size={16} /></>}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {backBtn(2)}
            <h1 style={{ fontSize: '22px', color: 'var(--c-surface)', fontWeight: 900, margin: '0 0 4px' }}>Add your first products</h1>
            <p style={{ color: 'var(--c-faint)', fontSize: '13px', margin: '0 0 22px' }}>Step 3 of 4 — Up to 3 products to get started</p>

            {products.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px', gap: '8px', marginBottom: 10 }}>
                <input value={p.name} onChange={e => setProducts(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={`Product ${i + 1}`} style={{ ...S.inp, fontSize: '13px', padding: '10px 12px' }} />
                <input value={p.price} onChange={e => setProducts(prev => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="₹ Price" type="number" style={{ ...S.inp, fontSize: '13px', padding: '10px 12px' }} />
                <input value={p.stock} onChange={e => setProducts(prev => prev.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))} placeholder="Qty" type="number" style={{ ...S.inp, fontSize: '13px', padding: '10px 12px' }} />
              </div>
            ))}
            <p style={{ color: 'var(--c-muted)', fontSize: '11px', margin: '4px 0 20px' }}>Name · Price (₹) · Stock — fill any row to save</p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={S.skip} onClick={() => step3Done(true)}>I'll add later</button>
              <button style={{ ...S.next, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }} onClick={() => step3Done(false)} disabled={saving}>
                {saving ? 'Saving…' : <><span>Submit Profile</span> <ChevronRight size={16} /></>}
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <CheckCircle size={68} color="var(--c-success)" style={{ margin: '0 auto 16px' }} />
            <h1 style={{ fontSize: '24px', color: 'var(--c-surface)', fontWeight: 900, margin: '0 0 10px' }}>Profile Submitted!</h1>
            <p style={{ color: 'var(--c-faint)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 22px' }}>
              Admin will approve within <strong style={{ color: 'var(--c-warning)' }}>24 hours</strong>.<br />
              You'll get a WhatsApp notification when approved.
            </p>

            <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px', textAlign: 'left' }}>
              <p style={{ color: 'var(--c-success)', fontSize: '11px', fontWeight: 700, margin: '0 0 8px' }}>WHAT YOU GET AFTER APPROVAL</p>
              {['Digital billing & receipts', 'Inventory with barcode scanning', 'GST invoicing & Tally export', 'Customer loyalty points', 'Distributor credit ledger'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 5 }}>
                  <span style={{ color: 'var(--c-success)', fontSize: '12px' }}>✓</span>
                  <span style={{ color: 'var(--c-line-strong)', fontSize: '13px' }}>{f}</span>
                </div>
              ))}
            </div>

            <a href="/support"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: '10px', color: '#25d366', fontSize: '13px', fontWeight: 600, textDecoration: 'none', marginBottom: '12px' }}>
              💬 Open Support
            </a>

            <button onClick={() => navigate('/waiting')} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,var(--c-danger),var(--c-violet))', color: 'var(--c-surface)', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
              Check My Application Status →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
