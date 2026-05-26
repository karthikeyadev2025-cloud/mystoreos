// Capacitor native bridge — uses window.Capacitor global (no npm imports)
// Safe to include in web builds — all Capacitor APIs are optional and fall back gracefully.

const cap = () => window.Capacitor;
export const isNative = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
export const isAndroid = () => isNative() && cap().getPlatform() === 'android';
export const isIOS = () => isNative() && cap().getPlatform() === 'ios';

const getPlugin = (name) => cap()?.Plugins?.[name] || null;

// ── Haptic feedback ───────────────────────────────────────────────
export async function hapticSuccess() {
  const H = getPlugin('Haptics');
  if (!H) return;
  try { await H.impact({ style: 'MEDIUM' }); } catch {}
}

export async function hapticError() {
  const H = getPlugin('Haptics');
  if (!H) return;
  try { await H.vibrate({ duration: 200 }); } catch {}
}

// ── Status bar ────────────────────────────────────────────────────
export async function setStatusBarDark() {
  const S = getPlugin('StatusBar');
  if (!S) return;
  try {
    await S.setStyle({ style: 'DARK' });
    await S.setBackgroundColor({ color: '#0f172a' });
  } catch {}
}

// ── Splash screen ─────────────────────────────────────────────────
export async function hideSplash() {
  const S = getPlugin('SplashScreen');
  if (!S) return;
  try { await S.hide(); } catch {}
}

// ── Native share ──────────────────────────────────────────────────
export async function nativeShare(title, text, url) {
  const S = getPlugin('Share');
  if (!S) return false;
  try {
    await S.share({ title, text, url, dialogTitle: 'Share Bill' });
    return true;
  } catch { return false; }
}

// ── Open URL ──────────────────────────────────────────────────────
export async function openUrl(url) {
  const B = getPlugin('Browser');
  if (isNative() && B) {
    try { await B.open({ url }); return; } catch {}
  }
  window.open(url, '_blank');
}

// ── Camera photo ──────────────────────────────────────────────────
export async function takeBarcodePhoto() {
  const C = getPlugin('Camera');
  if (!C) return null;
  try {
    const photo = await C.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: 'uri',
      source: 'CAMERA',
    });
    return photo.webPath || photo.path || null;
  } catch { return null; }
}

// ── Push notification setup ────────────────────────────────────────
export async function setupPushNotifications(onReceive) {
  const P = getPlugin('PushNotifications');
  if (!P) return;
  try {
    let perm = await P.checkPermissions();
    if (perm.receive === 'prompt') perm = await P.requestPermissions();
    if (perm.receive !== 'granted') return;
    await P.register();
    P.addListener('pushNotificationReceived', onReceive);
    P.addListener('registration', token => {
      console.log('[MyStore OS] FCM Token:', token.value);
    });
  } catch (e) { console.warn('Push setup failed:', e); }
}

// Auto-init on load (web safe — no-ops if not in Capacitor shell)
if (typeof window !== 'undefined') {
  setStatusBarDark();
  setTimeout(hideSplash, 400);
}
