import { useRef, useState } from 'react';
import { Camera, MapPin, QrCode, Share2, Printer, Users, ShieldAlert, Award, FileText, CreditCard, Eye, EyeOff, Clock, Tag, Image, Truck, Lock, Phone, User, Trash2, AlertTriangle } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-toastify';
import { PlanGate, LockedFeature } from './PlanGate';
import { validateImageFile } from '../lib/fileValidation';

const DesktopSettings = ({
  logo,
  gstin,
  setGstin,
  stateCode,
  setStateCode,
  businessAddress,
  setBusinessAddress,
  handleSaveProfile = () => {},
  editName = '',
  setEditName,
  editPhone = '',
  setEditPhone,
  currentPassword = '',
  setCurrentPassword,
  newPassword = '',
  setNewPassword,
  confirmPassword = '',
  setConfirmPassword,
  profileSaving = false,
  handleSaveAccountDetails = () => {},
  handleChangePassword = () => {},
  upiId,
  setUpiId,
  merchantUpiId,
  setMerchantUpiId,
  merchantCode,
  setMerchantCode,
  paymentQr,
  setPaymentQr,
  handlePaymentQrUpload,
  shopPhotos,
  handleShopPhotoUpload,
  removeShopPhoto,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
  handleGrabLocation,
  getShopUrl,
  downloadQrPoster,
  downloadQrPng,
  handleShareShop,
  staffList,
  newStaffName,
  setNewStaffName,
  newStaffPhone,
  setNewStaffPhone,
  newStaffPin,
  setNewStaffPin,
  handleAddStaff,
  user,
  handleResetTestData = () => {},
  myDistributors = [],
  distCodeInput = '',
  setDistCodeInput = () => {},
  handleLinkDistributor = () => {},
  handleUnlinkDistributor = () => {},
  plans = [],
  setShowPlanSelectorModal,
  paymentHistory = [],
  invoiceFooter = '',
  setInvoiceFooter,
  invoicePrefix = 'INV',
  setInvoicePrefix,
  handleSaveInvoiceSettings,
  exchangePolicy = '',
  setExchangePolicy,
  termsConditions = '',
  setTermsConditions,
  // Print settings
  printFormat = 'a4',
  setPrintFormat,
  printFontSize = 'normal',
  setPrintFontSize,
  printShowLogo = true,
  setPrintShowLogo,
  printCopies = 1,
  setPrintCopies,
  handleSavePrintSettings,
  hideFromSearch: _hideFromSearch = false,
  onToggleHideFromSearch: _onToggleHideFromSearch,
  onLogoChange,
  onLogoRemove,
  openingHour = 8,
  setOpeningHour,
  closingHour = 21,
  setClosingHour,
  weeklyHolidays = [],
  setWeeklyHolidays,
  shopBanner = { title: '', subtitle: '', discountPercent: 0, active: false },
  setShopBanner,
  handleSaveShopHours,
  handleSaveShopBanner,
}) => {
  const [showCurrPw, setShowCurrPw] = useState(false);
  const [showNewPw,  setShowNewPw]  = useState(false);
  const [showConfPw, setShowConfPw] = useState(false);
  const qrCanvasRef = useRef(null);
  const logoFileRef = useRef(null);
  const handleLogoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) { toast.error(check.reason); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      // window.Image explicitly — plain `new Image()` here was resolving to
      // the lucide-react <Image> ICON component imported at the top of this
      // file (named import shadowed the global), not the browser's native
      // Image constructor. That threw "Image is not a constructor" the
      // instant a file was picked, silently breaking every desktop logo
      // upload — the click/file-picker worked fine, but the resize step
      // that's supposed to run right after crashed before saving anything.
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(400 / img.width, 400 / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        if (onLogoChange) onLogoChange(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Check if user is shop owner or admin
  if (user.role !== 'shop' && user.role !== 'admin' && !user.isOwner) {
    return (
      <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', textAlign: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
        <ShieldAlert size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: '#0F172A', margin: '0 0 8px 0' }}>Access Denied</h3>
        <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
          Only the Shop Owner accounts can configure settings, UPI payment keys, and recruit staff helpers.
        </p>
      </div>
    );
  }

  return (
    <div className="settings-masonry">

        {/* ── ACCOUNT DETAILS ─────────────────────────────────────────── */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', marginBottom: '0' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="#4F46E5" /> Account Details
          </h3>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '18px' }}>Update your shop name or mobile number</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {user.role === 'distributor' ? 'Company Name' : 'Shop / Your Name'}
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName && setEditName(e.target.value)}
                placeholder={user.name}
                style={{ width: '100%', padding: '9px 12px', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '9px', color: '#0F172A', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                onFocus={e => e.target.style.borderColor = '#4F46E5'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mobile Number (Login ID)
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={e => setEditPhone && setEditPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                placeholder={user.phone}
                maxLength={10}
                style={{ width: '100%', padding: '9px 12px', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '9px', color: '#0F172A', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                onFocus={e => e.target.style.borderColor = '#4F46E5'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>
          </div>

          {/* Current values hint */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Current name: <b style={{ color: '#475569' }}>{user.name}</b></span>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Current number: <b style={{ color: '#475569' }}>{user.phone}</b></span>
          </div>

          <button
            onClick={handleSaveAccountDetails}
            disabled={profileSaving}
            style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: profileSaving ? 0.7 : 1 }}
          >
            {profileSaving ? '⏳ Saving…' : <><User size={13} /> Save Account Details</>}
          </button>
        </div>

        {/* ── CHANGE PASSWORD / PIN ─────────────────────────────────────── */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', marginBottom: '0' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="#4F46E5" /> {user.role === 'staff' ? 'Change PIN' : 'Change Password'}
          </h3>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '18px' }}>
            {user.role === 'staff' ? 'Update your 4-digit login PIN' : 'Set a new password for your account'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                New {user.role === 'staff' ? 'PIN' : 'Password'}
              </label>
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword && setNewPassword(e.target.value)}
                placeholder={user.role === 'staff' ? '4-digit PIN' : 'Min 4 characters'}
                maxLength={user.role === 'staff' ? 4 : undefined}
                inputMode={user.role === 'staff' ? 'numeric' : 'text'}
                style={{ width: '100%', padding: '9px 40px 9px 12px', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '9px', color: '#0F172A', fontSize: '14px', outline: 'none', boxSizing: 'border-box', letterSpacing: user.role === 'staff' ? '0.3em' : 'normal' }}
                onFocus={e => e.target.style.borderColor = '#4F46E5'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
              <button onClick={() => setShowNewPw(v => !v)} type="button" style={{ position: 'absolute', right: '10px', top: '30px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confirm {user.role === 'staff' ? 'PIN' : 'Password'}
              </label>
              <input
                type={showConfPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword && setConfirmPassword(e.target.value)}
                placeholder={`Re-enter ${user.role === 'staff' ? 'PIN' : 'password'}`}
                maxLength={user.role === 'staff' ? 4 : undefined}
                inputMode={user.role === 'staff' ? 'numeric' : 'text'}
                style={{ width: '100%', padding: '9px 40px 9px 12px', background: '#F8FAFC', border: `1.5px solid ${confirmPassword && newPassword && confirmPassword !== newPassword ? '#EF4444' : confirmPassword && newPassword && confirmPassword === newPassword ? '#10B981' : '#E2E8F0'}`, borderRadius: '9px', color: '#0F172A', fontSize: '14px', outline: 'none', boxSizing: 'border-box', letterSpacing: user.role === 'staff' ? '0.3em' : 'normal' }}
              />
              <button onClick={() => setShowConfPw(v => !v)} type="button" style={{ position: 'absolute', right: '10px', top: '30px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                {showConfPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              {confirmPassword && newPassword && (
                <p style={{ fontSize: '11px', marginTop: '4px', color: confirmPassword === newPassword ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                  {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={profileSaving || !newPassword || newPassword !== confirmPassword}
            style={{ background: (newPassword && newPassword === confirmPassword) ? 'linear-gradient(135deg,#10B981,#059669)' : '#CBD5E1', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: '700', cursor: (newPassword && newPassword === confirmPassword) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {profileSaving ? '⏳ Updating…' : <><Lock size={13} /> Update {user.role === 'staff' ? 'PIN' : 'Password'}</>}
          </button>
        </div>
      
      {/* All settings cards in an auto-balancing 2-column masonry */}
        
        {/* Brand Logo & Business Info */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#64748B" /> Shop Identity
          </h3>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px', background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <input type="file" accept="image/*" ref={logoFileRef} style={{ display: 'none' }} onChange={handleLogoFile} />
            <div onClick={() => logoFileRef.current?.click()} style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {logo
                  ? <img src={logo} alt="Shop Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex'; }} />
                  : null}
                <span style={{ fontSize: '36px', display: logo ? 'none' : 'flex' }}>🏪</span>
              </div>
              <div style={{ position: 'absolute', bottom: '4px', right: '4px', width: '28px', height: '28px', background: '#3B82F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={14} color="#fff" />
              </div>
            </div>
            <div>
              <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Shop Brand Logo</p>
              <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748B' }}>Click circle to change</p>
              {logo && (
                <button onClick={onLogoRemove} style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Remove Logo
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Shop GSTIN</label>
                <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="e.g. 29ABCDE1234F2Z5" style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>State Code</label>
                <input type="text" value={stateCode} onChange={e => setStateCode(e.target.value)} placeholder="e.g. 29" style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Business Address (printed on invoices)</label>
              <textarea value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="Enter full shop address..." rows={2} style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', resize: 'vertical' }}></textarea>
            </div>
            <button onClick={handleSaveProfile} style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>
              💾 Save Identity Settings
            </button>
          </div>
        </div>

        {/* UPI Payments setup */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={18} color="#64748B" /> UPI Payments Setup
          </h3>
          <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.4' }}>
            Configure your merchant payments to receive settlements instantly from customers directly in your bank account.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>UPI Payment ID</label>
                <input 
                  type="text" value={upiId} onChange={e => setUpiId(e.target.value)} 
                  placeholder="e.g. 9876543210@ybl" 
                  style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} 
                />
              </div>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#166534', marginBottom: '4px', fontWeight: 800 }}>⭐ Merchant UPI ID (for "Tap to Pay")</label>
                <p style={{ fontSize: '10.5px', color: '#15803D', margin: '0 0 8px', lineHeight: 1.4 }}>
                  Personal UPI IDs can only be <b>scanned</b>. To let customers <b>tap a link</b> to pay (PhonePe/GPay/Paytm), get a free Merchant UPI ID from the <b>PhonePe Business / Paytm for Business / GPay for Business</b> app and paste it here.
                </p>
                <input 
                  type="text" value={merchantUpiId || ''} onChange={e => setMerchantUpiId(e.target.value)} 
                  placeholder="e.g. yourstore.12345@ybl (merchant VPA)" 
                  style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', marginBottom: '8px' }} 
                />
                <input 
                  type="text" value={merchantCode || ''} onChange={e => setMerchantCode(e.target.value)} 
                  placeholder="Merchant Category Code (optional, e.g. 5411)" 
                  style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} 
                />
              </div>
              <button onClick={handleSaveProfile} style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                Save UPI Settings
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              {paymentQr ? (
                <>
                  <img src={paymentQr} alt="Payment QR" style={{ width: '100px', height: '100px', objectFit: 'contain', background: '#fff', padding: '4px', borderRadius: '8px', border: '2px solid #10B981' }} />
                  <button onClick={() => setPaymentQr('')} style={{ background: 'transparent', border: '1px solid #EF4444', color: '#EF4444', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Remove</button>
                </>
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '8px', background: '#FFFFFF', border: '2px dashed #CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                  <Camera size={20} />
                  <span style={{ fontSize: '9px', marginTop: '4px' }}>No QR</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                <label style={{ flex: 1, background: '#3B82F6', color: '#FFFFFF', padding: '6px', borderRadius: '6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
                  Upload
                  <input type="file" accept="image/*" onChange={handlePaymentQrUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* GPS Location Grabber */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} color="#64748B" /> Geolocation Coordinate lock
          </h3>
          <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.4' }}>
            Lock your storefront satellite coordinates so nearby customers can navigate to your store and order goods.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px' }}>Latitude</label>
              <input type="text" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 16.3067" style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px' }}>Longitude</label>
              <input type="text" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 80.4365" style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleGrabLocation} style={{ flex: 1, background: '#F3E8FF', border: '1px solid #E9D5FF', color: '#6D28D9', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              🛰️ Auto-Grab Coordinates
            </button>
            <button onClick={handleSaveProfile} style={{ flex: 1, background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              Commit Coordinates
            </button>
          </div>
        </div>

        {/* Invoice Customization */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#64748B" /> Invoice Customization
          </h3>
          <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.4' }}>
            Customize the invoice number prefix and the footer message printed on every bill PDF.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Invoice Number Prefix</label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={e => setInvoicePrefix && setInvoicePrefix(e.target.value.toUpperCase())}
                placeholder="e.g. INV"
                maxLength={10}
                style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }}
              />
              <p style={{ fontSize: '10px', color: '#64748B', margin: '4px 0 0 0' }}>Bills will be numbered: {invoicePrefix || 'INV'}-0001, {invoicePrefix || 'INV'}-0002, …</p>
            </div>

            <PlanGate feature="customInvoiceFooter" fallback={<LockedFeature feature="customInvoiceFooter" />}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>Custom Invoice Footer Message</label>
                <textarea
                  value={invoiceFooter}
                  onChange={e => setInvoiceFooter && setInvoiceFooter(e.target.value)}
                  placeholder="e.g. Thank you for shopping with us! GST registered. All sales final."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                />
              </div>
            </PlanGate>

            {/* Exchange / Return Policy */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>
                🔄 Exchange / Return Policy <span style={{ color: '#94A3B8', fontWeight: 400 }}>(printed on every bill)</span>
              </label>
              <input
                type="text"
                value={exchangePolicy}
                onChange={e => setExchangePolicy && setExchangePolicy(e.target.value)}
                placeholder="e.g. Exchange only within 2 days with original bill. No cash refund."
                style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none' }}
              />
            </div>

            {/* Terms & Conditions */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 'bold' }}>
                📋 Terms &amp; Conditions <span style={{ color: '#94A3B8', fontWeight: 400 }}>(printed on every bill)</span>
              </label>
              <textarea
                value={termsConditions}
                onChange={e => setTermsConditions && setTermsConditions(e.target.value)}
                placeholder="e.g. All disputes subject to local jurisdiction. Goods once sold cannot be returned except on quality issues."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '13px', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <button
              onClick={handleSaveInvoiceSettings}
              style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
            >
              💾 Save Invoice Settings
            </button>
          </div>
        </div>

        {/* Print Settings */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={18} color="#64748B" /> Print Settings
          </h3>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '18px', lineHeight: '1.5' }}>
            Set your printer type once — every bill, estimate, and challan PDF will automatically use the right paper size, layout, and font size.
          </p>

          {/* Paper Size */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paper / Printer Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { key: 'a4',        icon: '📄', label: 'A4 Sheet',       sub: '210 × 297 mm\nLaser / Inkjet' },
                { key: 'thermal80', icon: '🖨️', label: '80mm Thermal',   sub: '80mm wide roll\nMost POS printers' },
                { key: 'thermal58', icon: '🧾', label: '58mm Thermal',   sub: '58mm wide roll\nSmall receipt printer' },
              ].map(o => (
                <button key={o.key} onClick={() => setPrintFormat && setPrintFormat(o.key)}
                  style={{ padding: '14px 10px', border: printFormat === o.key ? '2px solid #4F46E5' : '1px solid #E2E8F0', background: printFormat === o.key ? '#EEF2FF' : '#F8FAFC', borderRadius: '12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>{o.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: printFormat === o.key ? '#4F46E5' : '#0F172A', marginBottom: '3px' }}>{o.label}</div>
                  <div style={{ fontSize: '10px', color: '#64748B', whiteSpace: 'pre-line', lineHeight: '1.4' }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Font Size</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ key: 'normal', label: 'Normal', sub: 'Standard' }, { key: 'large', label: 'Large', sub: 'Easier to read' }].map(o => (
                <button key={o.key} onClick={() => setPrintFontSize && setPrintFontSize(o.key)}
                  style={{ flex: 1, padding: '10px', border: printFontSize === o.key ? '2px solid #4F46E5' : '1px solid #E2E8F0', background: printFontSize === o.key ? '#EEF2FF' : '#F8FAFC', borderRadius: '10px', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: printFontSize === o.key ? '13px' : '12px', fontWeight: '700', color: printFontSize === o.key ? '#4F46E5' : '#0F172A' }}>{o.label}</div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Logo + Copies */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shop Logo on Bill</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ key: true, label: '✅ Show' }, { key: false, label: '🚫 Hide' }].map(o => (
                  <button key={String(o.key)} onClick={() => setPrintShowLogo && setPrintShowLogo(o.key)}
                    style={{ flex: 1, padding: '9px', border: printShowLogo === o.key ? '2px solid #4F46E5' : '1px solid #E2E8F0', background: printShowLogo === o.key ? '#EEF2FF' : '#F8FAFC', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: printShowLogo === o.key ? '#4F46E5' : '#475569' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Copies per Bill</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setPrintCopies && setPrintCopies(n)}
                    style={{ flex: 1, padding: '9px', border: printCopies === n ? '2px solid #4F46E5' : '1px solid #E2E8F0', background: printCopies === n ? '#EEF2FF' : '#F8FAFC', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '800', color: printCopies === n ? '#4F46E5' : '#475569' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview summary */}
          <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>{ printFormat === 'a4' ? '📄' : '🧾' }</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                { printFormat === 'a4' ? 'A4 full-page invoice' : printFormat === 'thermal80' ? '80mm thermal receipt' : '58mm thermal receipt' }
                {' · '}{printFontSize === 'large' ? 'Large font' : 'Normal font'}
                {' · '}{printShowLogo ? 'With logo' : 'No logo'}
                {' · '}{printCopies} cop{printCopies === 1 ? 'y' : 'ies'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>This setting applies to all bills, estimates, and challans</div>
            </div>
          </div>

          <button onClick={handleSavePrintSettings}
            style={{ width: '100%', background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Printer size={14} /> Save Print Settings
          </button>
        </div>

        {/* SaaS Subscription Info Card */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚡ SaaS Subscription Plan
          </h3>
          <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', lineHeight: '1.4' }}>
            Your current active plan is: <b>{plans?.find(p => p.id === user?.subscription)?.name || (user?.subscription === 'active' ? 'Premium PRO' : 'Free Trial')}</b>. 
            {plans?.find(p => p.id === user?.subscription) && ` This plan charges ₹${plans.find(p => p.id === user?.subscription)?.price}/mo and gives you full access.`}
          </p>
          <button 
            onClick={() => setShowPlanSelectorModal(true)} 
            style={{ width: '100%', background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            Change or Upgrade Plan
          </button>
        </div>

        {/* Billing History */}
        {paymentHistory.length > 0 && (
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={16} color="#10B981" /> Billing History
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {paymentHistory.map(payment => (
                <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#0F172A', textTransform: 'capitalize' }}>
                      {payment.planId?.replace('_', ' ')} Plan
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#475569' }}>
                      {new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {payment.paymentId && ` · ${payment.paymentId.slice(-8)}`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#10B981' }}>
                      ₹{Number(payment.amount).toLocaleString('en-IN')}
                    </p>
                    <span style={{
                      fontSize: '9px', fontWeight: 'bold', padding: '1px 6px', borderRadius: '8px',
                      background: payment.status === 'success' ? '#DCFCE7' : '#FEE2E2',
                      color: payment.status === 'success' ? '#15803D' : '#B91C1C',
                      textTransform: 'uppercase',
                    }}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Store Discoverability — admin-controlled premium feature (coming soon) */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} color="#94A3B8" /> Store Discoverability
            </h3>
            <span style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>COMING SOON</span>
          </div>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', lineHeight: '1.5' }}>
            Get your shop featured in the public customer search and storefront so nearby shoppers can discover you. This is a premium visibility add-on launching soon — enabled by our team.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: '14px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', opacity: 0.6, pointerEvents: 'none' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#64748B' }}>Featured in customer search</div>
            <div style={{ width: '52px', height: '28px', borderRadius: '14px', background: '#CBD5E1', position: 'relative', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: '4px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', left: '4px' }} />
            </div>
          </div>
        </div>

        {/* Your Store QR Code */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', textAlign: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={18} color="#64748B" /> Your Store QR Code
          </h3>
          <p style={{ fontSize: '12px', color: '#6B7280', textAlign: 'left', marginBottom: '16px' }}>Share this QR for customers to instantly open your catalogue.</p>

          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '12px', border: '1px solid #E2E8F0' }}>
            <QRCodeSVG value={getShopUrl()} size={120} />
          </div>
          {/* Hidden canvas for PNG export */}
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <QRCodeCanvas ref={qrCanvasRef} value={getShopUrl()} size={300} />
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#2563EB', wordBreak: 'break-all', fontWeight: '500' }}>{getShopUrl()}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => {
                const canvas = qrCanvasRef.current;
                if (canvas) {
                  const dataUrl = canvas.toDataURL('image/png');
                  const a = document.createElement('a');
                  a.href = dataUrl;
                  a.download = 'store-qr.png';
                  a.click();
                } else {
                  toast.error('QR code not ready yet — please try again in a moment.');
                }
              }}
              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '10px 6px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              ⬇ PNG
            </button>
            <button
              onClick={handleShareShop}
              style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', color: '#2E7D32', padding: '10px 6px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              <Share2 size={12} /> Share
            </button>
            <button
              onClick={() => {
                const url = getShopUrl();
                const qrHtml = '<html><body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#fff">'
                  + '<h2 style="color:#0F172A;margin-bottom:8px">' + (user?.name || 'My Store') + '</h2>'
                  + '<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(url) + '" style="border:8px solid #F0F0F0;border-radius:12px"/>'
                  + '<p style="color:#64748B;font-size:13px;margin-top:12px">' + url + '</p>'
                  + '</body></html>';
                const blob = new Blob([qrHtml], { type: 'text/html' });
                const blobUrl = URL.createObjectURL(blob);
                const win = window.open(blobUrl, '_blank');
                if (win) win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl); });
              }}
              style={{ background: '#F3E8FF', border: '1px solid #E9D5FF', color: '#6D28D9', padding: '10px 6px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              <Printer size={12} /> Print
            </button>
          </div>

          <div style={{ marginTop: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={downloadQrPng} style={{ width: '100%', background: '#4F46E5', color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <QrCode size={14} /> Download QR Code (PNG)
            </button>
            <button onClick={downloadQrPoster} style={{ width: '100%', background: '#4F46E5', color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <FileText size={14} /> Download Full PDF Poster
            </button>
          </div>
        </div>

        {/* Shop ID & Distributor linking */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}><Truck size={18} color="#64748B" /> My Distributors</h3>
          {user?.publicCode && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ color: '#64748B', fontSize: '11px' }}>Your shop code (share with distributors)</div>
                <div style={{ color: '#0F172A', fontSize: '18px', fontWeight: 800, letterSpacing: '1px', fontFamily: 'monospace' }}>{user.publicCode}</div>
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(user.publicCode); }} style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>Copy</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input type="text" value={distCodeInput} onChange={e => setDistCodeInput(e.target.value.toUpperCase())} placeholder="Add distributor by code (DST-XXXXXX)" style={{ flex: 1, minWidth: 0, padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
            <button onClick={handleLinkDistributor} style={{ background: '#16A34A', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>Add</button>
          </div>
          {myDistributors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myDistributors.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                  <div>
                    <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: 700 }}>{d.name}</div>
                    <div style={{ color: '#64748B', fontSize: '12px', fontFamily: 'monospace' }}>{d.publicCode}</div>
                  </div>
                  <button onClick={() => handleUnlinkDistributor(d.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94A3B8', fontSize: '12px', textAlign: 'center', margin: '4px 0' }}>No distributors linked yet.</p>
          )}
        </div>

        {/* Staff Helpers management */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={18} color="#64748B" /> Staff Management (సహాయకులు)</span>
            <PlanGate feature="staffAccounts" fallback={<LockedFeature feature="staffAccounts" compact />}>{null}</PlanGate>
          </h3>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', lineHeight: '1.4' }}>
            Add helpers who can scan barcodes and bill customers. You set their 4-digit PIN — share it with them directly.
          </p>

          <PlanGate feature="staffAccounts" fallback={<LockedFeature feature="staffAccounts" />}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#475569', fontWeight: '700' }}>➕ Add New Staff Member</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                  placeholder="Staff Name (e.g. Raju)"
                  style={{ padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', color: '#0F172A', fontSize: '12px', outline: 'none' }}
                />
                <input
                  type="tel" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)}
                  placeholder="Mobile Number (login ID)"
                  style={{ padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', color: '#0F172A', fontSize: '12px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: '700' }}>🔐 Set 4-digit PIN (you choose, share with staff)</label>
                  <input
                    type="password" value={newStaffPin} onChange={e => setNewStaffPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                    placeholder="e.g. 5678" inputMode="numeric" maxLength={4}
                    style={{ width: '100%', padding: '8px 10px', background: '#FFFFFF', border: '1px solid #C7D2FE', borderRadius: '6px', color: '#0F172A', fontSize: '14px', outline: 'none', letterSpacing: '0.3em', boxSizing: 'border-box' }}
                  />
                </div>
                {newStaffPin.length === 4 && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '8px', padding: '6px 10px', flexShrink: 0, marginTop: '16px' }}>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: '700' }}>✓ PIN ready</span>
                  </div>
                )}
              </div>
              <button onClick={handleAddStaff} style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '9px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                + Add Staff Member
              </button>
            </div>

            <h4 style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', fontWeight: 'bold' }}>Active Staff</h4>
            {staffList.length === 0 ? (
              <p style={{ color: '#64748B', fontSize: '11px', margin: 0 }}>No staff added yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {staffList.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#4F46E5,#818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                        {(s.name || 'S')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#0F172A' }}>{s.name}</div>
                        <div style={{ fontSize: '10px', color: '#64748B' }}>📱 {s.phone}</div>
                      </div>
                    </div>
                    <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '10px', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold' }}>● Active</span>
                  </div>
                ))}
              </div>
            )}
          </PlanGate>
        </div>

        {/* Shop Hours */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} color="#64748B" /> Shop Hours</h3>
          <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '16px' }}>Set your opening and closing times. An "Open Now" badge appears on your dashboard header.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>Opens at</label>
              <select value={openingHour} onChange={e => setOpeningHour && setOpeningHour(Number(e.target.value))} style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', padding: '8px 10px', borderRadius: '8px', fontSize: '13px' }}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i-12}:00 PM`}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>Closes at</label>
              <select value={closingHour} onChange={e => setClosingHour && setClosingHour(Number(e.target.value))} style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', padding: '8px 10px', borderRadius: '8px', fontSize: '13px' }}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i-12}:00 PM`}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: '600' }}>Weekly Holidays (tap to toggle closed days)</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day => (
                <button key={day} onClick={() => setWeeklyHolidays && setWeeklyHolidays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                  style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', border: `1px solid ${weeklyHolidays.includes(day) ? '#FCA5A5' : '#E2E8F0'}`, background: weeklyHolidays.includes(day) ? '#FEE2E2' : '#FFFFFF', color: weeklyHolidays.includes(day) ? '#B91C1C' : '#475569', width: 'auto', flexShrink: 0 }}>
                  {day.slice(0,3)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSaveShopHours} style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', width: 'auto' }}>
            💾 Save Shop Hours
          </button>
        </div>

        {/* Offer Banner */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}><Tag size={18} color="#64748B" /> Offer Banner</h3>
          <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '16px' }}>Highlight a promotion. Appears as a highlighted banner on your shop home when active.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>Banner Title</label>
              <input value={shopBanner?.title || ''} onChange={e => setShopBanner && setShopBanner(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Diwali Mega Sale!" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>Subtitle (optional)</label>
              <input value={shopBanner?.subtitle || ''} onChange={e => setShopBanner && setShopBanner(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="e.g. Up to 40% off on all sweets" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>Discount %</label>
                <input type="number" min="0" max="100" value={shopBanner?.discountPercent || 0} onChange={e => setShopBanner && setShopBanner(prev => ({ ...prev, discountPercent: Number(e.target.value) }))} style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>Status</label>
                <button onClick={() => setShopBanner && setShopBanner(prev => ({ ...prev, active: !prev?.active }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', border: `1px solid ${shopBanner?.active ? '#86EFAC' : '#E2E8F0'}`, background: shopBanner?.active ? '#DCFCE7' : '#FFFFFF', color: shopBanner?.active ? '#166534' : '#475569' }}>
                  {shopBanner?.active ? '✅ Live' : '⬜ Inactive'}
                </button>
              </div>
            </div>
          </div>
          <button onClick={handleSaveShopBanner} style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            💾 Save Banner
          </button>
        </div>

        {/* Gallery Images */}
        <div className="premium-glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Image size={18} color="#64748B" /> Shop Photos
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>{shopPhotos.length}/6</span>
            </h3>
            <a href={getShopUrl()} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#4F46E5', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '4px 10px', borderRadius: '8px' }}>
              👁 Preview on Storefront →
            </a>
          </div>

          {/* How they're used info */}
          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>📸</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#4F46E5', marginBottom: '2px' }}>These photos appear on your public storefront</div>
              <div style={{ fontSize: '11px', color: '#6366F1', lineHeight: '1.5' }}>
                Customers see an auto-scrolling carousel of your photos when they open your shop link. Upload your shop front, products, or interiors to make a great first impression.
              </div>
            </div>
          </div>

          {/* Photo grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {shopPhotos.map((photo, idx) => (
              <div key={idx} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <img src={photo} alt={`Shop ${idx+1}`} style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
                {/* Overlay with index */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', padding: '3px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>
                    {idx === 0 ? '🌟 Cover' : `Photo ${idx + 1}`}
                  </span>
                </div>
                <button onClick={() => removeShopPhoto(idx)} title="Remove photo"
                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', lineHeight: '20px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>×</button>
              </div>
            ))}

            {/* Upload slot */}
            {shopPhotos.length < 6 && (
              <label style={{ height: '80px', border: '2px dashed #C7D2FE', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#F8FAFF', transition: 'border-color .2s', gap: '4px' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#4F46E5'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#C7D2FE'}>
                <span style={{ fontSize: '22px' }}>➕</span>
                <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: '600' }}>Add Photo</span>
                <input type="file" accept="image/*" multiple onChange={handleShopPhotoUpload} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {shopPhotos.length === 0 && (
            <p style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', margin: '0 0 8px' }}>No photos yet — add up to 6 photos to showcase your shop</p>
          )}

          {shopPhotos.length > 0 && (
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
              💡 First photo is the cover image shown in search results. Drag to reorder is coming soon.
            </p>
          )}
        </div>

        {/* Danger Zone — Reset Test Data — main shop only, not branches */}
        {(user.role === 'shop' || user.isOwner) && !user.parentShopId && (
          <div className="premium-glass" style={{ padding: '24px', borderRadius: '14px', border: '1.5px solid #FECACA', background: '#FFFBFA', boxShadow: '0 1px 3px rgba(220,38,38,0.06)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#DC2626" /> Danger Zone
            </h3>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '18px' }}>Irreversible actions — use with care.</p>

            <div style={{ background: '#FFFFFF', border: '1px solid #FEE2E2', borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>Reset Test Data</div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0, lineHeight: '1.5' }}>
                  Permanently deletes <strong>all bills, estimates, challans, credit ledger entries, and stock orders</strong> for this shop,
                  and resets your invoice number back to <strong>#0001</strong>. Use this once after testing — before going live with real customers.
                </p>
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: '8px 0 0' }}>
                  ✅ Kept: your products, customer list, staff accounts, logo, QR code, and all settings.
                </p>
              </div>
              <button
                onClick={handleResetTestData}
                style={{ flexShrink: 0, background: '#FEF2F2', border: '1.5px solid #FCA5A5', color: '#DC2626', padding: '10px 16px', borderRadius: '9px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Trash2 size={14} /> Reset Now
              </button>
            </div>
          </div>
        )}

        {/* Build stamp — lets us instantly confirm whether a given screen
            is running the latest deployed code, without guessing from
            screenshots or wall-clock timing against a git push. */}
        <p style={{ textAlign: 'center', fontSize: '10px', color: '#CBD5E1', margin: '8px 0 0' }}>
          Build: {typeof __BUILD_STAMP__ !== 'undefined' ? new Date(__BUILD_STAMP__).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'dev'}
        </p>

    </div>
  );
};

export default DesktopSettings;
