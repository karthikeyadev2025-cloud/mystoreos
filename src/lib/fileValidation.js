// Client-side image upload guards.
//
// None of the 7 image-upload code paths in this app (product photos, logo,
// shop photos, onboarding photos, inventory CSV-adjacent image uploads)
// checked file size or type before calling FileReader.readAsDataURL() — the
// canvas-based resize logic only runs AFTER the full original file has
// already been read into memory and decoded by the browser. A 30-50MB
// phone-camera photo (very common — modern phones routinely produce
// 8-15MB JPEGs, and HEIC/RAW originals can be 20-50MB) would hang the tab
// for several seconds during that read+decode step, before the resize
// step ever gets a chance to shrink anything down.
//
// validateImageFile() runs first, synchronously, and rejects oversized or
// wrong-type files immediately with a clear toast — no FileReader, no
// decode, no hang.

export const MAX_IMAGE_UPLOAD_MB = 8;

// Returns { ok: true } or { ok: false, reason: string } — never throws, so
// callers can use it as a simple early-return guard.
export function validateImageFile(file, { maxMB = MAX_IMAGE_UPLOAD_MB } = {}) {
  if (!file) return { ok: false, reason: 'No file selected.' };
  if (!file.type || !file.type.startsWith('image/')) {
    return { ok: false, reason: 'Please choose an image file (JPG, PNG, WEBP).' };
  }
  const maxBytes = maxMB * 1024 * 1024;
  if (file.size > maxBytes) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, reason: `Image is ${sizeMB}MB — please choose one under ${maxMB}MB.` };
  }
  return { ok: true };
}
