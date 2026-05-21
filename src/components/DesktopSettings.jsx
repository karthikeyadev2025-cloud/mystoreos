import { Camera, MapPin, QrCode, Share2, Printer, Users, ShieldAlert, Award, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const DesktopSettings = ({
  isOwner,
  logo,
  handleLogoUpload,
  gstin,
  setGstin,
  stateCode,
  setStateCode,
  businessAddress,
  setBusinessAddress,
  handleSaveProfile,
  upiId,
  setUpiId,
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
  handleShareShop,
  staffList,
  newStaffName,
  setNewStaffName,
  newStaffPhone,
  setNewStaffPhone,
  handleAddStaff,
  user,
  plans = [],
  setShowPlanSelectorModal
}) => {
  if (!isOwner) {
    return (
      <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
        <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: 'white', margin: '0 0 8px 0' }}>Access Denied</h3>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
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
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#fbbf24" /> Shop Identity
          </h3>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '12px' }}>
            {logo ? (
              <img src={logo} alt="Shop Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }} />
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', border: '1px solid #334155' }}>No Logo</div>
            )}
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#cbd5e1', fontWeight: 'bold' }}>Shop Brand Logo</p>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: '12px', color: '#94a3b8' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold' }}>Shop GSTIN</label>
                <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="e.g. 29ABCDE1234F2Z5" style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold' }}>State Code</label>
                <input type="text" value={stateCode} onChange={e => setStateCode(e.target.value)} placeholder="e.g. 29" style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold' }}>Business Address (printed on invoices)</label>
              <textarea value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="Enter full shop address..." rows={2} style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', resize: 'vertical' }}></textarea>
            </div>
            <button onClick={handleSaveProfile} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>
              💾 Save Identity Settings
            </button>
          </div>
        </div>

        {/* UPI Payments setup */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={18} color="#10b981" /> UPI Payments Setup
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.4' }}>
            Configure your merchant payments to receive settlements instantly from customers directly in your bank account.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold' }}>UPI Payment ID</label>
                <input 
                  type="text" value={upiId} onChange={e => setUpiId(e.target.value)} 
                  placeholder="e.g. 9876543210@ybl" 
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} 
                />
              </div>
              <button onClick={handleSaveProfile} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                Save UPI ID
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              {paymentQr ? (
                <>
                  <img src={paymentQr} alt="Payment QR" style={{ width: '100px', height: '100px', objectFit: 'contain', background: '#fff', padding: '4px', borderRadius: '8px', border: '2px solid #10b981' }} />
                  <button onClick={() => setPaymentQr('')} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer' }}>Remove</button>
                </>
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '8px', background: '#0f172a', border: '2px dashed #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <Camera size={20} />
                  <span style={{ fontSize: '9px', marginTop: '4px' }}>No QR</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                <label style={{ flex: 1, background: '#3b82f6', color: 'white', padding: '6px', borderRadius: '6px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
                  Upload
                  <input type="file" accept="image/*" onChange={handlePaymentQrUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* GPS Location Grabber */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} color="#8b5cf6" /> Geolocation Coordinate lock
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.4' }}>
            Lock your storefront satellite coordinates so nearby customers can navigate to your store and order goods.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px' }}>Latitude</label>
              <input type="text" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 16.3067" style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px' }}>Longitude</label>
              <input type="text" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 80.4365" style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleGrabLocation} style={{ flex: 1, background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#a78bfa', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              🛰️ Auto-Grab Coordinates
            </button>
            <button onClick={handleSaveProfile} style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              Commit Coordinates
            </button>
          </div>
        </div>

      </div>

      {/* Right Column: QR print poster, Staff & Photos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* SaaS Subscription Info Card */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, rgba(30,41,59,0.3), rgba(15,23,42,0.3))' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚡ SaaS Subscription Plan
          </h3>
          <p style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '16px', lineHeight: '1.4' }}>
            Your current active plan is: <b>{plans?.find(p => p.id === user?.subscription)?.name || (user?.subscription === 'active' ? 'Premium PRO' : 'Free Trial')}</b>. 
            {plans?.find(p => p.id === user?.subscription) && ` This plan charges ₹${plans.find(p => p.id === user?.subscription)?.price}/mo and gives you full access.`}
          </p>
          <button 
            onClick={() => setShowPlanSelectorModal(true)} 
            style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            Change or Upgrade Plan
          </button>
        </div>

        {/* Wall QR Poster */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: 'white', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#ef4444" /> Wall QR Poster
          </h3>
          
          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px', border: '1px solid rgba(0,0,0,0.1)' }}>
            <QRCodeSVG value={getShopUrl()} size={110} />
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 'bold', color: '#3b82f6', wordBreak: 'break-all' }}>{getShopUrl()}</p>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={downloadQrPoster} style={{ flex: 1, background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Printer size={14} /> Download PDF Poster
            </button>
            <button onClick={handleShareShop} style={{ flex: 1, background: '#25D366', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Share2 size={14} /> WhatsApp Share
            </button>
          </div>
        </div>

        {/* Staff Helpers management */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#3b82f6" /> Staff Management (సహాయకులు)
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.4' }}>
            Recruit staff assistants who can scan barcodes and log quick bills but cannot access sensitive Day Books or reports.
          </p>

          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', fontWeight: 'bold' }}>Add Helper Account</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input 
                type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} 
                placeholder="Helper Name" 
                style={{ padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }} 
              />
              <input 
                type="tel" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} 
                placeholder="Mobile Login ID" 
                style={{ padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }} 
              />
            </div>
            <button onClick={handleAddStaff} style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', marginTop: '4px' }}>
              + Register Helper (Default PIN: 1234)
            </button>
          </div>

          <h4 style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '10px', fontWeight: 'bold' }}>Active Staff roster</h4>
          {staffList.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '11px', margin: 0 }}>No assistant accounts registered.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {staffList.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '12px', color: '#fff' }}>{s.name}</h5>
                    <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>Ph: {s.phone}</p>
                  </div>
                  <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Active PIN: 1234</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gallery Images */}
        <div className="premium-glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: 'white' }}>📸 Shop Photos (Max 6)</h3>
          <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>Upload photos of your storefront or inventory products.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {shopPhotos.map((photo, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={photo} alt={`Shop ${idx+1}`} style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }} />
                <button onClick={() => removeShopPhoto(idx)} style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', cursor: 'pointer', lineHeight: '18px', padding: 0 }}>×</button>
              </div>
            ))}
          </div>
          {shopPhotos.length < 6 && (
            <input type="file" accept="image/*" multiple onChange={handleShopPhotoUpload} style={{ fontSize: '11px', color: '#94a3b8' }} />
          )}
        </div>

      </div>

    </div>
  );
};

export default DesktopSettings;
