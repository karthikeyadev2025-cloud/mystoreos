// Shared microphone permission handling for the voice features
// (Restock voice order, POS voice add-to-bill, voice search).
//
// The rules browsers actually enforce, which this encodes:
//
//   * getUserMedia() only shows the "Allow microphone?" prompt when the
//     permission state is 'prompt'. Once the user has picked Block, no
//     site can re-prompt programmatically — the only way back is the
//     browser's own site settings. So a denied state needs *instructions*,
//     not another silent retry.
//   * navigator.mediaDevices is undefined outside a secure context
//     (https:// or localhost). Reading .getUserMedia off it throws.
//   * The prompt must be triggered from a user gesture. Callers must
//     invoke this directly from a click handler.
//
// Returns { ok: true } or { ok: false, reason, message } where message is
// already phrased for a toast.

const DENIED_HELP =
  navigator.userAgent.includes('Android')
    ? 'Microphone is blocked. Tap the 🔒 (or ⓘ) next to the address bar → Permissions → Microphone → Allow, then reload.'
    : 'Microphone is blocked. Click the 🔒 (or 🎤) icon in the address bar → Microphone → Allow, then reload this page.';

export function isSecureForMic() {
  // localhost is treated as secure by browsers even over http.
  return window.isSecureContext === true;
}

// Best-effort read of the current permission state without prompting.
// Not all browsers implement permissions.query for 'microphone'
// (notably older Safari), so 'unknown' is a normal answer.
export async function getMicPermissionState() {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'microphone' });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unknown';
  }
}

// Call this from a click handler, before starting speech recognition.
// When the state is 'prompt' (or unknown) this deliberately calls
// getUserMedia, which is what actually surfaces the browser's Allow dialog.
export async function ensureMicPermission() {
  if (!isSecureForMic()) {
    return {
      ok: false,
      reason: 'insecure',
      message: 'Microphone needs a secure (https) connection. Open the site over https and try again.',
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'This browser can\'t access the microphone. Try Chrome or Edge.',
    };
  }

  const state = await getMicPermissionState();
  if (state === 'denied') {
    return { ok: false, reason: 'denied', message: DENIED_HELP };
  }

  try {
    // This is the call that raises the Allow prompt when state is 'prompt'.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // We only wanted the grant — release the device immediately so the mic
    // indicator doesn't stay on and SpeechRecognition can claim it.
    stream.getTracks().forEach(t => t.stop());
    return { ok: true };
  } catch (err) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return { ok: false, reason: 'denied', message: DENIED_HELP };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, reason: 'nodevice', message: 'No microphone found on this device.' };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        ok: false,
        reason: 'busy',
        message: 'Microphone is in use by another app. Close it and try again.',
      };
    }
    return { ok: false, reason: 'error', message: `Could not access microphone (${name || 'unknown error'}).` };
  }
}
