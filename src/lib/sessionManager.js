// Stable per-device fingerprint — derived from browser properties that don't change between sessions.
// Not cryptographically secure but sufficient for multi-device cap enforcement.
export function getDeviceFingerprint() {
  try {
    const parts = [
      typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '0x0',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      typeof navigator !== 'undefined' ? navigator.language : 'en',
    ];
    return btoa(parts.join('|')).replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
  } catch {
    return 'fallback-fingerprint';
  }
}
