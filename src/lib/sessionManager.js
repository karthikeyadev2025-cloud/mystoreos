// Stable per-device fingerprint — derived from browser properties that don't change between sessions.
// Not cryptographically secure but sufficient for multi-device cap enforcement.
export function getDeviceFingerprint() {
  const parts = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
  ];
  return btoa(parts.join('|')).replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
}
