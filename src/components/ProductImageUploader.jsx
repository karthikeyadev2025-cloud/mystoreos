import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../lib/api';
import { validateImageFile } from '../lib/fileValidation';

// Client-side compress an image File down to maxDim px, JPEG, and return a File.
// 900px @ 0.85 — storefront cards render images at ~300-400px wide, and the
// detail gallery at ~460px, so a 900px source is plenty. The previous 1280px
// was about 2x larger in file size for no visible benefit on phone storefronts
// where customers complained the page was "loading heavy."
function compressToFile(file, maxDim = 900, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('compress failed'));
            const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
            resolve(new File([blob], base + '.jpg', { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('decode failed'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

// images: string[] (public URLs). onChange(nextArray). userId for storage path.
export default function ProductImageUploader({ images = [], onChange, userId, max = 4, dark = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const list = (images || []).filter(Boolean);

  const labelColor = dark ? '#CBD5E1' : '#475569';
  const hintColor = '#94A3B8';
  const addBg = dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
  const addBorder = dark ? '1.5px dashed rgba(255,255,255,0.18)' : '1.5px dashed #CBD5E1';
  const addText = dark ? '#94A3B8' : '#64748B';

  const pick = () => { if (!busy && list.length < max) inputRef.current?.click(); };

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    const room = max - list.length;
    const added = [];
    let skipped = 0;
    for (const f of files.slice(0, room)) {
      const check = validateImageFile(f);
      if (!check.ok) { skipped++; continue; }
      try {
        const small = await compressToFile(f);
        const url = await api.uploadAsset(small, userId, 'products');
        if (url) added.push(url);
      } catch { /* skip a bad file, keep going */ }
    }
    setBusy(false);
    if (skipped) {
      toast.error(`${skipped} photo${skipped > 1 ? 's' : ''} skipped — must be an image under 8MB`);
    }
    if (added.length) onChange([...list, ...added].slice(0, max));
  };

  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const makeCover = (i) => {
    if (i === 0) return;
    const next = [...list];
    const [picked] = next.splice(i, 1);
    onChange([picked, ...next]);
  };

  const tile = { width: 84, height: 84, borderRadius: 10, border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden', background: '#FFFFFF', flexShrink: 0 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: labelColor }}>Product Photos</label>
        <span style={{ fontSize: 11, color: hintColor }}>{list.length}/{max} · first is the cover</span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {list.map((url, i) => (
          <div key={url + i} style={tile}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {i === 0 && (
              <span style={{ position: 'absolute', top: 4, left: 4, background: '#4F46E5', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 5 }}>COVER</span>
            )}
            <button type="button" onClick={() => remove(i)} aria-label="Remove photo"
              style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 11, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>
            {i !== 0 && (
              <button type="button" onClick={() => makeCover(i)}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, border: 'none', background: 'rgba(15,23,42,0.62)', color: '#fff', fontSize: 9, fontWeight: 600, padding: '3px 0', cursor: 'pointer' }}>Set cover</button>
            )}
          </div>
        ))}

        {list.length < max && (
          <button type="button" onClick={pick} disabled={busy}
            style={{ ...tile, background: addBg, border: addBorder, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: busy ? 'default' : 'pointer', color: addText }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{busy ? '…' : '+'}</span>
            <span style={{ fontSize: 10 }}>{busy ? 'Uploading' : 'Add photo'}</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
      <p style={{ margin: '8px 0 0', fontSize: 11, color: hintColor }}>Add up to {max} clear photos. The first photo shows on the storefront card; customers can swipe the rest.</p>
    </div>
  );
}
