import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const STEPS = ['Profile', 'Business', 'First Product', 'Done'];

function resizeImage(file, maxSize, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const safe = async (fn) => { try { return await fn(); } catch { return null; } };

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [logo, setLogo] = useState('');
  const [bizType, setBizType] = useState('grocery');
  const [refCode, setRefCode] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  const [gst, setGst] = useState('');
  const [upi, setUpi] = useState('');

  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('100');
  const [prodImage, setProdImage] = useState('');

  const handleLogoFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await resizeImage(file, 400, 0.8);
    setLogo(b64);
  };

  const handleProdImageFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await resizeImage(file, 300, 0.8);
    setProdImage(b64);
  };

  const saveStep = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (step === 0) {
        await safe(() => api.updateProfile(user.id, {
          ...(logo && { logo }),
          shopCategory: bizType,
          businessAddress: city ? `${city}\n${address}` : address,
        }));
        // Attribute referral code if provided
        if (refCode.trim()) {
          try { await api.attributeReferral(refCode.trim(), user.id); } catch (_) {}
        }
        setStep(1);
      } else if (step === 1) {
        await safe(() => api.updateProfile(user.id, {
          ...(gst && { gstin: gst }),
          ...(upi && { upiId: upi }),
        }));
        setStep(2);
      } else if (step === 2) {
        if (prodName && prodPrice) {
          await safe(() => api.addProduct(
            user.id, prodName, prodPrice, '',
            parseInt(prodStock) || 100, '', '', '', 10,
            { image: prodImage }
          ));
        }
        setStep(3);
      }
    } catch {
      toast.error('Save failed, please try again');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (step === 3) {
      const t = setTimeout(() => navigate('/waiting'), 3000);
      return () => clearTimeout(t);
    }
  }, [step, navigate]);

  if (step === 3) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f0c29,#302b63)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#f8fafc', padding: '24px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 12px' }}>You're all set!</h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>Taking you to your dashboard in a moment...</p>
        </div>
      </div>
    );
  }

  const inp = { width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Outfit, sans-serif' };
  const lbl = { display: 'block', fontSize: '12px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' };

  return (
    <>
      <style>{`.onb-hidden{display:none}`}</style>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Outfit, sans-serif' }}>
        <ToastContainer theme="dark" />
        <div style={{ background: 'rgba(30,41,59,0.85)', backdropFilter: 'blur(10px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '32px 28px', maxWidth: '460px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= step ? 'linear-gradient(90deg,#f43f5e,#8b5cf6)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
            ))}
          </div>

          <div style={{ marginBottom: '4px', fontSize: '11px', color: '#f43f5e', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Step {step + 1} of 3</div>
          <h2 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 900, color: '#f8fafc' }}>{STEPS[step]}</h2>

          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <input type="file" accept="image/*" className="onb-hidden" id="onb-logo" onChange={handleLogoFile} />
                <label htmlFor="onb-logo" style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
                  <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: '#0f172a', border: '2px dashed rgba(244,63,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {logo ? <img src={logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '28px' }}>📷</span>}
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '26px', height: '26px', background: '#f43f5e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#fff', fontWeight: 800 }}>+</div>
                </label>
                <span style={{ color: '#64748b', fontSize: '11px' }}>Tap to upload shop logo</span>
              </div>
              <div>
                <label style={lbl}>Business Type</label>
                <select value={bizType} onChange={e => setBizType(e.target.value)} style={{ ...inp, background: '#0f172a' }}>
                  <option value="grocery">Grocery / Kirana</option>
                  <option value="pharmacy">Pharmacy / Medical</option>
                  <option value="electronics">Electronics</option>
                  <option value="clothing">Clothing / Textiles</option>
                  <option value="footwear">Footwear / Shoes</option>
                  <option value="restaurant">Restaurant / Hotel</option>
                  <option value="salon">Salon / Beauty</option>
                  <option value="hardware">Hardware / Tools</option>
                  <option value="stationery">Stationery / Books</option>
                  <option value="general">General Store</option>
                </select>
              </div>
              <div>
                <label style={lbl}>City</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Hyderabad" style={inp} />
              </div>
              <div>
                <label style={lbl}>Shop Address</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Shop No. 5, MG Road..." rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div>
                <label style={lbl}>Referral Code (optional)</label>
                <input type="text" value={refCode} onChange={e => setRefCode(e.target.value.toUpperCase())} placeholder="e.g. RAVI20 — enter if someone referred you" style={inp} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 4px', lineHeight: 1.6 }}>Set up your payment and tax details. You can update these later from Settings.</p>
              <div>
                <label style={lbl}>GST Number (optional)</label>
                <input type="text" value={gst} onChange={e => setGst(e.target.value.toUpperCase())} placeholder="e.g. 29ABCDE1234F2Z5" style={inp} />
              </div>
              <div>
                <label style={lbl}>UPI ID (optional)</label>
                <input type="text" value={upi} onChange={e => setUpi(e.target.value)} placeholder="e.g. shop@upi or 9876543210@ybl" style={inp} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 4px', lineHeight: 1.6 }}>Add your first product. You can add hundreds more after approval.</p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <input type="file" accept="image/*" className="onb-hidden" id="onb-prod-img" onChange={handleProdImageFile} />
                <label htmlFor="onb-prod-img" style={{ cursor: 'pointer', position: 'relative' }}>
                  <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: '#0f172a', border: '2px dashed rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {prodImage ? <img src={prodImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '24px' }}>🖼</span>}
                  </div>
                </label>
                <span style={{ color: '#64748b', fontSize: '11px' }}>Product photo (optional)</span>
              </div>
              <div>
                <label style={lbl}>Product Name</label>
                <input type="text" value={prodName} onChange={e => setProdName(e.target.value)} placeholder="e.g. Parle-G Biscuit 100g" style={inp} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Price (₹)</label>
                  <input type="number" value={prodPrice} onChange={e => setProdPrice(e.target.value)} placeholder="e.g. 10" style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Stock Qty</label>
                  <input type="number" value={prodStock} onChange={e => setProdStock(e.target.value)} placeholder="e.g. 100" style={inp} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '12px', fontSize: '14px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Back
              </button>
            )}
            <button onClick={saveStep} disabled={saving} style={{ flex: 2, padding: '13px', background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)', border: 'none', color: '#fff', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Outfit, sans-serif' }}>
              {saving ? 'Saving...' : step === 2 ? 'Finish Setup 🚀' : 'Next →'}
            </button>
          </div>
          <button onClick={() => navigate('/waiting')} style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: '#475569', fontSize: '12px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: '8px' }}>
            Skip for now
          </button>
        </div>
      </div>
    </>
  );
}
