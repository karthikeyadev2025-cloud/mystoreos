import { useRef } from 'react';
import { Camera, MapPin, QrCode, Share2, Printer, Users, ShieldAlert, Award, FileText, CreditCard, Eye } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { PlanGate, LockedFeature } from './PlanGate';

const DesktopSettings = ({
  logo,
  handleLogoUpload: _handleLogoUpload,
  gstin,
  setGstin,
  stateCode,
  setStateCode,
  businessAddress,
  setBusinessAddress,
  handleSaveProfile = () => {},
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
  handleAddStaff,
  user,
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
  const qrCanvasRef = useRef(null);
  const logoFileRef = useRef(null);
  const handleLogoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
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
      <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <ShieldAlert size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: '#0F172A', margin: '0 0 8px 0' }}>Access Denied</h3>
        <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
          Only the Shop Owner accounts can configure settings, UPI payment keys, and recruit staff helpers.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', alignItems: 'start' }}>
      
      {/* Left Column: Logo, GST and UPI setup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Brand Logo & Business Info */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#fbbf24" /> Shop Identity
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
              <div style={{ position: 'absolute', bottom: '4px', right: '4px', width: '28px', height: '28px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={18} color="#10B981" /> UPI Payments Setup
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
                <label style={{ flex: 1, background: '#3b82f6', color: '#FFFFFF', padding: '6px', borderRadius: '6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
                  Upload
                  <input type="file" accept="image/*" onChange={handlePaymentQrUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* GPS Location Grabber */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} color="#8b5cf6" /> Geolocation Coordinate lock
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
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#a78bfa" /> Invoice Customization
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

            <button
              onClick={handleSaveInvoiceSettings}
              style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
            >
              💾 Save Invoice Settings
            </button>
          </div>
        </div>

      </div>

      {/* Right Column: QR print poster, Staff & Photos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* SaaS Subscription Info Card */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
          <div className="premium-glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} color="#94A3B8" /> Store Discoverability
            </h3>
            <span style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', letterSpacing: '0.5px' }}>COMING SOON</span>
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
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={18} color="#8b5cf6" /> Your Store QR Code
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
                  + '<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(url) + '" style="border:8px solid #f0f0f0;border-radius:12px"/>'
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
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>🚚 My Distributors</h3>
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
            <button onClick={handleLinkDistributor} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>Add</button>
          </div>
          {myDistributors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myDistributors.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                  <div>
                    <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: 700 }}>{d.name}</div>
                    <div style={{ color: '#64748B', fontSize: '12px', fontFamily: 'monospace' }}>{d.publicCode}</div>
                  </div>
                  <button onClick={() => handleUnlinkDistributor(d.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94A3B8', fontSize: '12px', textAlign: 'center', margin: '4px 0' }}>No distributors linked yet.</p>
          )}
        </div>

        {/* Staff Helpers management */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={18} color="#3b82f6" /> Staff Management (సహాయకులు)</span>
            <PlanGate feature="staffAccounts" fallback={<LockedFeature feature="staffAccounts" compact />}>{null}</PlanGate>
          </h3>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', lineHeight: '1.4' }}>
            Recruit staff assistants who can scan barcodes and log quick bills but cannot access sensitive Day Books or reports.
          </p>

          <PlanGate feature="staffAccounts" fallback={<LockedFeature feature="staffAccounts" />}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>Add Helper Account</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input 
                  type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} 
                  placeholder="Helper Name" 
                  style={{ padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', color: '#0F172A', fontSize: '12px', outline: 'none' }} 
                />
                <input 
                  type="tel" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} 
                  placeholder="Mobile Login ID" 
                  style={{ padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', color: '#0F172A', fontSize: '12px', outline: 'none' }} 
                />
              </div>
              <button onClick={handleAddStaff} style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', marginTop: '4px', alignSelf: 'flex-start' }}>
                + Register Helper (Default PIN: 1234)
              </button>
            </div>

            <h4 style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', fontWeight: 'bold' }}>Active Staff roster</h4>
            {staffList.length === 0 ? (
              <p style={{ color: '#64748B', fontSize: '11px', margin: 0 }}>No assistant accounts registered.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {staffList.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '12px', color: '#0F172A' }}>{s.name}</h5>
                      <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>Ph: {s.phone}</p>
                    </div>
                    <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Active PIN: 1234</span>
                  </div>
                ))}
              </div>
            )}
          </PlanGate>
        </div>

        {/* Shop Hours */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>🕐 Shop Hours</h3>
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
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>🏷️ Offer Banner</h3>
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
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>📸 Shop Photos (Max 6)</h3>
          <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '16px' }}>Upload photos of your storefront or inventory products.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {shopPhotos.map((photo, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={photo} alt={`Shop ${idx+1}`} style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                <button onClick={() => removeShopPhoto(idx)} style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', cursor: 'pointer', lineHeight: '18px', padding: 0 }}>×</button>
              </div>
            ))}
          </div>
          {shopPhotos.length < 6 && (
            <input type="file" accept="image/*" multiple onChange={handleShopPhotoUpload} style={{ fontSize: '11px', color: '#6B7280' }} />
          )}
        </div>

      </div>

    </div>
  );
};

export default DesktopSettings;
