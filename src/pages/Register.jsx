import { useState } from 'react';
import { api } from '../lib/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSiteConfig } from '../lib/siteConfig';
import { ToastContainer, toast } from 'react-toastify';
import { Eye, EyeOff, ArrowLeft, Zap, ShieldCheck } from 'lucide-react';
import 'react-toastify/dist/ReactToastify.css';
import MLogo from '../components/MLogo';
import { sendPhoneOTP, resetRecaptcha, signOutFirebasePhoneSession } from '../lib/firebasePhoneAuth';

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  .reg-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0D1117;
    padding: clamp(16px, 4vw, 32px);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }
  .reg-card {
    background: #161B22;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px;
    padding: clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px);
    width: 100%;
    max-width: 440px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }
  .reg-input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.12);
    border-radius: 9px;
    color: #fff;
    font-size: 14px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    transition: border-color .18s, box-shadow .18s;
    outline: none;
  }
  .reg-input:focus {
    border-color: #4F46E5;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.18);
  }
  .reg-input::placeholder { color: rgba(255,255,255,0.28); }
  .reg-label {
    display: block;
    color: rgba(255,255,255,0.5);
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 7px;
    letter-spacing: .04em;
  }
  .reg-submit {
    width: 100%;
    padding: 14px;
    background: #4F46E5;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: filter .15s, transform .1s;
    box-shadow: 0 0 24px rgba(79,70,229,0.4);
  }
  .reg-submit:hover:not(:disabled) { filter: brightness(1.1); }
  .reg-submit:active { transform: scale(.98); }
  .reg-submit:disabled { opacity: .6; cursor: not-allowed; }
  .reg-type-btn {
    flex: 1;
    padding: 11px 8px;
    background: transparent;
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: rgba(255,255,255,0.45);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    text-align: center;
    transition: all .15s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .reg-type-btn.active {
    background: rgba(79,70,229,0.15);
    border-color: rgba(79,70,229,0.4);
    color: #fff;
  }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fade-in { animation: fadeIn .3s ease both; }
`;

const TYPES = [
  { value: 'shop',        icon: '🏪', label: 'Business' },
  { value: 'distributor', icon: '🚚', label: 'Distributor' },
  { value: 'customer',    icon: '🛒', label: 'Customer' },
];

// Top-level business model chosen at signup — LOCKED after registration.
// Retail → POS-first ShopDashboard. Service → Bookings-first ShopDashboard.
// (Distributors get DistributorDashboard entirely, separate top-level.)
const BUSINESS_KINDS = [
  {
    value: 'retail',
    icon: '🛍️',
    label: 'Retailer',
    tagline: 'I sell products (walk-in customers, POS-first)',
    color: '#10B981',
  },
  {
    value: 'service',
    icon: '📅',
    label: 'Service Business',
    tagline: 'I sell time or appointments (Bookings-first)',
    color: '#8B5CF6',
  },
];

// Suggestions shown when the free-text category field is focused. Users
// can pick one OR type their own — it's a free-text field, these are just
// autocomplete hints for the most common cases in each business kind.
const CATEGORY_SUGGESTIONS = {
  retail: [
    'Kirana / Grocery', 'Electronics', 'Mobile & Accessories', 'Textiles / Clothing',
    'Sweets & Bakery', 'Hardware', 'Stationery & Books', 'Pharmacy',
    'Jewellery', 'Restaurant / Cafe', 'Auto Parts', 'Footwear',
    'Cosmetics', 'Home Furnishing', 'Toys',
  ],
  service: [
    'Salon & Beauty', 'Spa & Wellness', 'Clinic / Doctor', 'Dental',
    'Gym & Fitness', 'Yoga Studio', 'Car / Bike Service', 'Home Repair',
    'Photography Studio', 'Tuition / Coaching', 'Legal / CA Office', 'Pet Grooming',
  ],
};

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { config } = useSiteConfig();
  const registrationClosed = config?.registrationOpen === false;
  // Claim mode: when a shop sends a bill to a customer not yet on
  // MyStore, the WhatsApp message includes a link
  // /register?phone={normalized}&claim=1 that lands here. The phone is
  // prefilled and locked (read-only) so the customer can only register
  // with the phone the bill was sent to — and businessType is forced to
  // 'customer' since they're a buyer, not a shop. After they register,
  // getUserOrders unions their bills in via the customer_phone column.
  const claimPhone = (searchParams.get('phone') || '').replace(/\D/g, '').slice(-10);
  const claimMode = searchParams.get('claim') === '1' && claimPhone.length === 10;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(claimMode ? claimPhone : '');
  const [pass, setPass] = useState('');
  const [businessType, setBusinessType] = useState(
    claimMode ? 'customer' : (searchParams.get('type') || 'shop')
  );
  const [businessKind, setBusinessKind] = useState('retail');   // 'retail' | 'service'
  const [shopCategory, setShopCategory] = useState('');         // free-text
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Phone OTP verification — didn't exist at all before tonight.
  // Registration used to create an account the instant the form was
  // submitted, with zero proof the phone number actually belonged to
  // whoever typed it in. otpStep gates handleRegister into two phases:
  // 'idle' (nothing sent yet) -> send OTP -> 'sent' (waiting for the
  // code) -> verify -> only then does the real account get created.
  const [otpStep, setOtpStep] = useState('idle'); // 'idle' | 'sent'
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const sendOtp = async (e) => {
    e.preventDefault();
    if (registrationClosed) return toast.error('New registrations are temporarily closed. Please check back later.');
    if (!name || !phone || !pass) return toast.error('Please fill all fields');
    if (!/^\d{10}$/.test(phone)) return toast.error('Enter valid 10-digit mobile number (digits only)');
    setSendingOtp(true);
    try {
      const result = await sendPhoneOTP(`+91${phone}`);
      setConfirmationResult(result);
      setOtpStep('sent');
      toast.success(`OTP sent to +91 ${phone}`);
    } catch (err) {
      let msg = err?.message || 'Could not send OTP. Please try again.';
      if (msg.includes('too-many-requests')) msg = 'Too many attempts. Please wait a few minutes and try again.';
      else if (msg.includes('invalid-phone-number')) msg = 'That doesn\u2019t look like a valid phone number.';
      toast.error(msg);
      resetRecaptcha();
    } finally {
      setSendingOtp(false);
    }
  };

  const changePhoneNumber = () => {
    setOtpStep('idle');
    setOtpCode('');
    setConfirmationResult(null);
    resetRecaptcha();
  };

  const resendOtp = async () => {
    resetRecaptcha();
    setOtpStep('idle');
    // Re-trigger the send on the next tick so the recaptcha reset above
    // has actually taken effect before a fresh one is created.
    setTimeout(() => sendOtp({ preventDefault: () => {} }), 50);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!confirmationResult) return toast.error('Please verify your phone number first.');
    if (!/^\d{6}$/.test(otpCode)) return toast.error('Enter the 6-digit code sent to your phone.');
    setVerifyingOtp(true);
    try {
      await confirmationResult.confirm(otpCode);
      // Phone ownership proven — immediately sign out of the Firebase
      // side, we never wanted an ongoing Firebase session, only the
      // verification itself. The real session is Supabase's, created
      // by completeRegistration() right below.
      await signOutFirebasePhoneSession();
    } catch (err) {
      setVerifyingOtp(false);
      let msg = err?.message || 'Incorrect code.';
      if (msg.includes('invalid-verification-code')) msg = 'That code doesn\u2019t match. Check and try again.';
      else if (msg.includes('code-expired')) msg = 'This code has expired — request a new one.';
      return toast.error(msg);
    }
    await completeRegistration();
    setVerifyingOtp(false);
  };

  const completeRegistration = async () => {
    try {
      setLoading(true);
      const newUser = await api.register(name, phone, pass, businessType);
      // For shop accounts, persist:
      //   business_kind → hard split between POS-first (retail) and
      //                   Bookings-first (service) dashboard
      //   shop_category → free-text industry label (Electronics, Salon, etc)
      // business_kind is LOCKED after registration — user can't change it
      // in Settings; super admin has to update the row if they need to switch.
      if (businessType === 'shop' && newUser?.id) {
        try {
          // Was forcing 'General Retail'/'General Services' onto any
          // shop that left this blank — every business selling
          // anything that didn't fit a generic bucket (or who just
          // hadn't filled it in yet) got a fake, meaningless label
          // instead of genuinely having none. Safe to leave empty:
          // businessKind (set explicitly above, always) is what
          // actually drives retail-vs-service routing — shopCategory
          // is purely a descriptive label, never load-bearing for that.
          const trimmedCategory = (shopCategory || '').trim();
          // Same moment businessKind is first known is also the first
          // moment we can set the RIGHT starting tier. auth-register
          // hardcodes subscription_tier to the generic 'starter' at
          // account creation, before businessKind exists at all — for a
          // service business that's the wrong tier (retail Starter has
          // no bookings; a service business needs service_starter,
          // which does). This only matters once the 15-day trial ends
          // (getCaps() grants full trial access regardless of this
          // value while subscription === 'trial') — but setting it
          // correctly now means there's nothing to fix later.
          await api.updateProfile(newUser.id, {
            businessKind,
            shopCategory: trimmedCategory,
            subscriptionTier: businessKind === 'service' ? 'service_starter' : 'starter',
          });
          newUser.businessKind = businessKind;
          newUser.shopCategory = trimmedCategory;
        } catch (_e) {
          // Non-fatal — user can still complete signup, admin can fix later.
        }
      }
      login(newUser);

      // Auto-link to the distributor whose public catalog they arrived
      // from — set only when someone reached /register via
      // /catalog/:code and tapped "order" on a product. Wrapped
      // non-fatally, matching the pattern above: a failed auto-link
      // must never block registration itself, since the shop can
      // always link manually afterwards from their own dashboard.
      // Without this, every one of the ~10,000 shops a distributor
      // shares this link with would need a SEPARATE manual step after
      // signing up just to reach the account they came here to reach.
      const linkDistCode = searchParams.get('distributor');
      if (businessType === 'shop' && linkDistCode && newUser?.id) {
        try {
          await api.linkByPublicCode(newUser.id, 'shop', linkDistCode);
        } catch (_e) {
          // Non-fatal — most commonly an already-superseded or invalid
          // code. The shop can link manually from their own dashboard;
          // silently failing here must never block account creation.
        }
      }

      if (businessType === 'customer') {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      let msg = err.message || 'Registration failed';
      if (msg.includes('Edge Function') || msg.includes('non-2xx') || msg.includes('Failed to fetch') || msg.includes('TypeError'))
        msg = "Couldn't connect to our servers. Please check your internet and try again.";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    // If we're in claim mode, stash the locked phone so the AuthCallback
    // can create the customer profile with it after the Google roundtrip.
    // Outside claim mode this stash is empty and Google sign-in behaves
    // exactly like the normal /login → Google flow.
    try {
      if (claimMode && claimPhone) {
        sessionStorage.setItem('mystore_oauth_claim', JSON.stringify({
          phone: claimPhone, ts: Date.now(),
        }));
      } else {
        sessionStorage.removeItem('mystore_oauth_claim');
      }
    } catch {}
    try {
      await api.signInWithGoogle();
      // Browser is redirecting to Google — nothing else to do here.
    } catch (err) {
      sessionStorage.removeItem('mystore_oauth_claim');
      toast.error(err?.message || 'Google sign-in is not available right now.');
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="reg-page">
        <ToastContainer theme="dark" position="top-center"/>
        <div className="reg-card fade-in">
          {/* Back */}
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, padding: 0, marginBottom: 24, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
            fontWeight: 500,
          }}>
            <ArrowLeft size={14}/> Back to Home
          </button>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 52, height: 52, background: 'rgba(79,70,229,0.15)',
              border: '1px solid rgba(79,70,229,0.3)', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Zap size={24} color="#4F46E5" strokeWidth={2}/>
            </div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>
              {businessType === 'customer' ? 'Create Shopper Account' : 'Start Your Free Trial'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5 }}>
              {businessType === 'customer' ? 'Join the digital shopping revolution' : 'No credit card · 15 days free · Cancel anytime'}
            </p>
          </div>

          <form onSubmit={otpStep === 'idle' ? sendOtp : handleRegister}>
            <div id="firebase-recaptcha-container"></div>
            {claimMode && (
              <div style={{ background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 18, boxShadow: '0 6px 16px rgba(79,70,229,.25)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>📲 Claim your bills</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.45 }}>
                  Create your free account with <b>{claimPhone}</b> and every bill sent to this number — from any MyStore shop — will appear in your purchase history automatically, even bills sent before today.
                </div>
              </div>
            )}
            {/* Business Type Selector — hidden in claim mode (always 'customer') */}
            {!claimMode && (
              <div style={{ marginBottom: 20 }}>
                <label className="reg-label">ACCOUNT TYPE</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {TYPES.map(({ value, icon, label }) => (
                    <button key={value} type="button"
                      onClick={() => setBusinessType(value)}
                      className={`reg-type-btn${businessType === value ? ' active' : ''}`}
                    >
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <span style={{ fontSize: 11 }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Business Model — Retailer vs Service. Only for 'shop' accounts.
                LOCKED after registration; decides which dashboard the shop
                sees (POS-first vs Bookings-first). */}
            {!claimMode && businessType === 'shop' && (
              <div style={{ marginBottom: 20 }}>
                <label className="reg-label">BUSINESS MODEL</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {BUSINESS_KINDS.map(({ value, icon, label, tagline, color }) => (
                    <button key={value} type="button"
                      onClick={() => { setBusinessKind(value); setShopCategory(''); }}
                      className={`reg-type-btn${businessKind === value ? ' active' : ''}`}
                      style={{
                        padding: '14px 12px', minHeight: 92, textAlign: 'left', alignItems: 'flex-start',
                        borderColor: businessKind === value ? color : undefined,
                        background: businessKind === value ? `${color}18` : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: businessKind === value ? color : undefined }}>{label}</span>
                      </div>
                      <span style={{ fontSize: 10.5, opacity: 0.75, lineHeight: 1.3 }}>{tagline}</span>
                    </button>
                  ))}
                </div>
                <p style={{ margin: '8px 2px 0', fontSize: 10.5, color: '#94a3b8', lineHeight: 1.4 }}>
                  ⚠️ You can't change this later without contacting support.
                </p>
              </div>
            )}

            {/* Business Category — FREE TEXT with suggestions. Industry label
                only (Electronics, Sweet Shop, Salon, whatever). Doesn't affect
                the dashboard; used for display, search, and reports. */}
            {!claimMode && businessType === 'shop' && (
              <div style={{ marginBottom: 20, position: 'relative' }}>
                <label className="reg-label">BUSINESS CATEGORY</label>
                <input
                  type="text"
                  value={shopCategory}
                  onChange={e => setShopCategory(e.target.value)}
                  onFocus={() => setShowCatSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCatSuggestions(false), 200)}
                  placeholder={businessKind === 'service' ? 'e.g. Salon, Clinic, Gym…' : 'e.g. Electronics, Grocery, Sweets…'}
                  className="reg-input"
                  autoComplete="off"
                />
                {showCatSuggestions && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {CATEGORY_SUGGESTIONS[businessKind]
                      .filter(s => !shopCategory.trim() || s.toLowerCase().includes(shopCategory.trim().toLowerCase()))
                      .slice(0, 8)
                      .map(s => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); setShopCategory(s); setShowCatSuggestions(false); }}
                          style={{
                            padding: '5px 11px', borderRadius: 999, border: '1px solid rgba(139,92,246,0.4)',
                            background: 'rgba(139,92,246,0.12)', color: '#a78bfa', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Google one-tap — shown for customer-type registrations (and
                always in claim mode). Shop/distributor accounts still need
                the phone+password path since they require role-specific
                approval and onboarding flows. */}
            {(claimMode || businessType === 'customer') && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#475569', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                  Continue with Google
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  OR USE MOBILE
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                </div>
              </>
            )}

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label className="reg-label">
                {businessType === 'customer' ? 'YOUR FULL NAME' : 'BUSINESS NAME'}
              </label>
              <input
                className="reg-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={businessType === 'customer' ? 'Enter your full name' : 'e.g. Sai Supermarket or Ravi Traders'}
              />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 16 }}>
              <label className="reg-label">MOBILE NUMBER</label>
              <input
                className="reg-input"
                type="tel"
                value={phone}
                onChange={e => !claimMode && otpStep === 'idle' && setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="numeric"
                readOnly={claimMode || otpStep === 'sent'}
                style={(claimMode || otpStep === 'sent') ? { background: '#F1F5F9', cursor: 'not-allowed' } : undefined}
              />
              {claimMode && (
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 5 }}>
                  Locked — registering with the number your bill was sent to.
                </div>
              )}
              {otpStep === 'sent' && (
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 5 }}>
                  Code sent to this number. <button type="button" onClick={changePhoneNumber} style={{ background: 'none', border: 'none', color: '#818CF8', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}>Change number</button>
                </div>
              )}
            </div>

            {/* OTP — didn't exist before tonight. A real 6-digit code
                sent via Firebase Phone Auth, required before the
                account underneath is actually created. */}
            {otpStep === 'sent' && (
              <div style={{ marginBottom: 16 }}>
                <label className="reg-label">ENTER 6-DIGIT CODE</label>
                <input
                  className="reg-input"
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  style={{ letterSpacing: 4, fontSize: 18, textAlign: 'center' }}
                />
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 5, textAlign: 'center' }}>
                  Didn't get it? <button type="button" onClick={resendOtp} style={{ background: 'none', border: 'none', color: '#818CF8', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}>Resend code</button>
                </div>
              </div>
            )}

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label className="reg-label">CREATE PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="reg-input"
                  type={showPassword ? 'text' : 'password'}
                  value={pass}
                  onChange={e => otpStep === 'idle' && setPass(e.target.value)}
                  placeholder="Min 4 characters"
                  readOnly={otpStep === 'sent'}
                  style={{ paddingRight: 44, ...(otpStep === 'sent' ? { background: '#F1F5F9', cursor: 'not-allowed' } : {}) }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
                  width: 28, height: 28, color: 'rgba(255,255,255,0.85)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
                  transition: 'background .15s, color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,70,229,0.25)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}>
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {registrationClosed && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, color: '#FCA5A5', fontSize: 13, textAlign: 'center' }}>
                New registrations are temporarily closed. Please check back later.
              </div>
            )}

            <button className="reg-submit" type="submit" disabled={loading || sendingOtp || verifyingOtp || registrationClosed}>
              {otpStep === 'idle' ? (
                sendingOtp ? 'Sending code…' : <>Send Verification Code</>
              ) : (
                verifyingOtp || loading ? 'Verifying…' : (
                  businessType === 'customer'
                    ? <><ShieldCheck size={16}/>Verify &amp; Create Account</>
                    : <><Zap size={16}/>Verify &amp; Start Free 15-Day Trial</>
                )
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 20 }}>
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} style={{
              background: 'none', border: 'none', color: '#818CF8',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Sign in →</button>
          </p>

          {/* Trust */}
          <div style={{ marginTop: 24, padding: '12px 14px', background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.18)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
            <div>
              <div style={{ color: '#6EE7B7', fontSize: 11, fontWeight: 700, marginBottom: 1 }}>Safe & Secure</div>
              <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5 }}>256-bit SSL · Your data is private</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
