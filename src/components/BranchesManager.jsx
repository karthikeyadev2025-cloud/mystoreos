import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { api } from '../lib/api';
import { Plus, Trash2, Edit3, X, Store, Loader2 } from 'lucide-react';

// Self-contained card that lets the shop owner manage their physical
// branches. Lives in the Settings tab on both desktop and mobile.
//
// Lifecycle:
//   • On mount → loads owner's branches via api.getOwnedBranches
//   • Main shop is rendered first with a "Main" badge (no edit/remove —
//     it's the owner's own account)
//   • Each branch row: name, phone, address, [Edit] [Remove]
//   • "Add Branch" opens a modal with the create form
//   • Edit re-opens the same modal in edit mode
//   • Remove confirms before soft-deleting (historical orders preserved)
//
// Calls onChange after any add/edit/remove so the parent (ShopDashboard)
// can refresh its `branches` state — which drives the switcher dropdown.

export default function BranchesManager({ ownerId, onChange }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create mode, branch obj = edit mode

  const reload = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const data = await api.getOwnedBranches(ownerId);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load branches:', err);
      toast.error(err?.message || 'Could not load branches');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (branch) => {
    if (!window.confirm(`Remove "${branch.name}"?\n\nHistorical bills and products from this branch will still be preserved for reports — but the branch disappears from your switcher.`)) return;
    try {
      await api.deleteBranch(branch.id, ownerId);
      toast.success(`Removed ${branch.name}`);
      await reload();
      if (onChange) onChange();
    } catch (err) {
      toast.error(err?.message || 'Could not remove branch');
    }
  };

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Store size={17} style={{ color: '#4F46E5' }} /> Your Branches
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
            Run multiple shop locations? Add each branch here. Switch between them from the dropdown next to your shop name.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          <Plus size={15} /> Add Branch
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
          <Loader2 size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading branches…
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, background: '#F8FAFC', borderRadius: 10, color: '#64748B', fontSize: 12 }}>
          No branches yet. Your main shop will show up here once branches exist.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(b => {
            const isMain = !b.parentShopId;
            return (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, background: isMain ? '#F8FAFC' : '#FFFFFF', flexWrap: 'wrap' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: isMain ? '#4F46E5' : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isMain ? '#fff' : '#475569', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {(b.name || 'B').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {b.name}
                    {isMain && <span style={{ fontSize: 9.5, background: '#4F46E5', color: '#fff', padding: '2px 7px', borderRadius: 999, fontWeight: 800, letterSpacing: 0.3 }}>MAIN</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.phone}{b.businessAddress ? ` · ${b.businessAddress}` : ''}
                  </div>
                </div>
                {!isMain && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => { setEditing(b); setModalOpen(true); }}
                      title="Edit branch"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F1F5F9', color: '#475569', border: 'none', padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      title="Remove branch"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FEF2F2', color: '#DC2626', border: 'none', padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <BranchFormModal
          ownerId={ownerId}
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={async () => { setModalOpen(false); await reload(); if (onChange) onChange(); }}
        />
      )}
    </div>
  );
}

function BranchFormModal({ ownerId, editing, onClose, onSaved }) {
  const isEdit = !!editing;
  const [name, setName] = useState(editing?.name || '');
  const [phone, setPhone] = useState(editing?.phone || '');
  const [address, setAddress] = useState(editing?.businessAddress || '');
  const [gstin, setGstin] = useState(editing?.gstin || '');
  const [stateCode, setStateCode] = useState(editing?.stateCode || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error('Branch name is required');
    const cleanedPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (!/^\d{10}$/.test(cleanedPhone)) return toast.error('Enter a valid 10-digit branch phone');
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateBranch(editing.id, ownerId, {
          name: name.trim(),
          phone: cleanedPhone,
          businessAddress: address.trim(),
          gstin: gstin.trim(),
          stateCode: stateCode.trim(),
        });
        toast.success('Branch updated');
      } else {
        await api.createBranch({
          ownerId,
          name: name.trim(),
          phone: cleanedPhone,
          address: address.trim(),
          gstin: gstin.trim(),
          stateCode: stateCode.trim(),
        });
        toast.success('Branch added');
      }
      onSaved();
    } catch (err) {
      toast.error(err?.message || 'Could not save branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: 16 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, maxWidth: 440, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
            {isEdit ? 'Edit Branch' : 'Add a New Branch'}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <Field label="Branch Name" required>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. RK Mens & Jeans — Hitech City"
            style={inputStyle}
            autoFocus
          />
        </Field>

        <Field label="Branch Phone" required>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit number for this location"
            inputMode="numeric"
            maxLength={10}
            style={inputStyle}
          />
        </Field>

        <Field label="Address" hint="Shown on bills + storefront">
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Shop No. 12, Main Road, Hitech City, Hyderabad"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
          <Field label="GSTIN" hint="Leave blank to inherit from main">
            <input
              type="text"
              value={gstin}
              onChange={e => setGstin(e.target.value.toUpperCase())}
              placeholder="15-char GSTIN"
              maxLength={15}
              style={inputStyle}
            />
          </Field>
          <Field label="State Code">
            <input
              type="text"
              value={stateCode}
              onChange={e => setStateCode(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="36"
              inputMode="numeric"
              maxLength={2}
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1, background: '#F1F5F9', color: '#475569', border: 'none', padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ flex: 1, background: saving ? '#94A3B8' : 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', border: 'none', padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add branch')}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E2E8F0',
  borderRadius: 9,
  fontSize: 13,
  color: '#0F172A',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, letterSpacing: 0.3 }}>
        {label.toUpperCase()}{required && <span style={{ color: '#DC2626', marginLeft: 3 }}>*</span>}
        {hint && <span style={{ marginLeft: 6, fontWeight: 500, color: '#94A3B8', textTransform: 'none', letterSpacing: 0 }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}
