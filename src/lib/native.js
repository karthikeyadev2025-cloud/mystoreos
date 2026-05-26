// Native bridge — wraps Capacitor plugins with web fallbacks
// Works on web (no-op fallbacks) AND in iOS/Android Capacitor shell

let Camera, Haptics, StatusBar, SplashScreen, PushNotifications, Share, Browser;

const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const isAndroid = () => isNative() && window.Capacitor.getPlatform() === 'android';
const isIOS = () => isNative() && window.Capacitor.getPlatform() === 'ios';

// Dynamically import Capacitor plugins only in native context
async function loadPlugins() {
  if (!isNative()) return;
  try {
    ({ Camera } = await import('@capacitor/camera'));
    ({ Haptics } = await import('@capacitor/haptics'));
    ({ StatusBar } = await import('@capacitor/status-bar'));
    ({ SplashScreen } = await import('@capacitor/splash-screen'));
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
    ({ Share } = await import('@capacitor/share'));
    ({ Browser } = await import('@capacitor/browser'));
  } catch (e) {
    console.warn('Capacitor plugin load error:', e);
  }
}

loadPlugins();

// ── Camera / barcode ──────────────────────────────────────────────
export async function takeBarcodePhoto() {
  if (!isNative() || !Camera) return null;
  try {
    const { CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });
    return photo.webPath || photo.path;
  } catch { return null; }
}

// ── Haptic feedback ───────────────────────────────────────────────
export async function hapticSuccess() {
  if (!isNative() || !Haptics) return;
  try {
    const { ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

export async function hapticError() {
  if (!isNative() || !Haptics) return;
  try {
    await Haptics.vibrate({ duration: 200 });
  } catch {}
}

// ── Status bar ────────────────────────────────────────────────────
export async function setStatusBarDark() {
  if (!isNative() || !StatusBar) return;
  try {
    const { Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch {}
}

// ── Splash screen ─────────────────────────────────────────────────
export async function hideSplash() {
  if (!isNative() || !SplashScreen) return;
  try { await SplashScreen.hide(); } catch {}
}

// ── Native share (WhatsApp bill) ──────────────────────────────────
export async function nativeShare(title, text, url) {
  if (!isNative() || !Share) return false;
  try {
    await Share.share({ title, text, url, dialogTitle: 'Share Bill' });
    return true;
  } catch { return false; }
}

// ── Open external URL in native browser ───────────────────────────
export async function openUrl(url) {
  if (isNative() && Browser) {
    try { await Browser.open({ url }); return; } catch {}
  }
  window.open(url, '_blank');
}

// ── Push notification setup ────────────────────────────────────────
export async function setupPushNotifications(onReceive) {
  if (!isNative() || !PushNotifications) return;
  try {
    const { PermissionState } = await import('@capacitor/push-notifications');
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
    PushNotifications.addListener('pushNotificationReceived', onReceive);
    PushNotifications.addListener('registration', token => {
      console.log('FCM Token:', token.value);
      // Store token for server-side push
    });
  } catch (e) { console.warn('Push setup failed:', e); }
}

export { isNative, isAndroid, isIOS };
