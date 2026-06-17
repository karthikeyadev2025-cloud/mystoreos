// Capacitor native bridge
// Imports real @capacitor/* packages — falls back gracefully in web builds.
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export const isNative   = () => Capacitor.isNativePlatform();
export const isAndroid  = () => Capacitor.getPlatform() === 'android';
export const isIOS      = () => Capacitor.getPlatform() === 'ios';
export const platform   = () => Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

// ── Status Bar ────────────────────────────────────────────────────────────────
export async function setStatusBarDark() {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (isAndroid()) await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch {}
}

export async function setStatusBarLight() {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Light });
    if (isAndroid()) await StatusBar.setBackgroundColor({ color: '#ffffff' });
  } catch {}
}

// ── Splash Screen ─────────────────────────────────────────────────────────────
export async function hideSplash() {
  if (!isNative()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {}
}

// ── Haptics ───────────────────────────────────────────────────────────────────
export async function hapticSuccess() {
  if (!isNative()) return;
  try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
}
export async function hapticLight() {
  if (!isNative()) return;
  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
}
export async function hapticError() {
  if (!isNative()) return;
  try { await Haptics.vibrate({ duration: 250 }); } catch {}
}
export async function hapticHeavy() {
  if (!isNative()) return;
  try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
}

// ── Native Share ──────────────────────────────────────────────────────────────
export async function nativeShare(title, text, url, files) {
  if (!isNative()) return false;
  try {
    await Share.share({ title, text, url, dialogTitle: 'Share Bill' });
    return true;
  } catch { return false; }
}

// ── Browser ───────────────────────────────────────────────────────────────────
export async function openUrl(url) {
  if (isNative()) {
    try { await Browser.open({ url, presentationStyle: 'popover' }); return; } catch {}
  }
  window.open(url, '_blank');
}

// ── Camera ────────────────────────────────────────────────────────────────────
export async function takeBarcodePhoto() {
  if (!isNative()) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });
    return photo.webPath || null;
  } catch { return null; }
}

// ── Network ───────────────────────────────────────────────────────────────────
export async function getNetworkStatus() {
  try {
    const status = await Network.getStatus();
    return status.connected;
  } catch { return true; }
}
export function onNetworkChange(cb) {
  try { return Network.addListener('networkStatusChange', s => cb(s.connected)); } catch { return () => {}; }
}

// ── Preferences (persistent key-value) ───────────────────────────────────────
export async function setPref(key, value) {
  try { await Preferences.set({ key, value: JSON.stringify(value) }); } catch {}
}
export async function getPref(key, fallback = null) {
  try {
    const { value } = await Preferences.get({ key });
    return value != null ? JSON.parse(value) : fallback;
  } catch { return fallback; }
}
export async function removePref(key) {
  try { await Preferences.remove({ key }); } catch {}
}

// ── App Events ────────────────────────────────────────────────────────────────
export function onAppResume(cb) {
  try { return App.addListener('resume', cb); } catch { return () => {}; }
}
export function onAppPause(cb) {
  try { return App.addListener('pause', cb); } catch { return () => {}; }
}
export function onBackButton(cb) {
  try { return App.addListener('backButton', cb); } catch { return () => {}; }
}
export async function getAppInfo() {
  try { return await App.getInfo(); } catch { return null; }
}

// ── Push Notifications ────────────────────────────────────────────────────────
export async function setupPushNotifications(onReceive, onAction) {
  if (!isNative()) return null;
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return null;
    await PushNotifications.register();
    PushNotifications.addListener('registration', token => {
      console.log('[MyStore OS] FCM Token:', token.value);
      return token.value;
    });
    if (onReceive) PushNotifications.addListener('pushNotificationReceived', onReceive);
    if (onAction)  PushNotifications.addListener('pushNotificationActionPerformed', onAction);
    const { notifications } = await PushNotifications.getDeliveredNotifications();
    return notifications;
  } catch (e) { console.warn('Push setup failed:', e); return null; }
}

// ── OTA Live Updates (Capgo) ──────────────────────────────────────────────────
// Call once on app start. Downloads new JS bundle in background.
// Next app launch will run the new code — no Play Store wait!
export async function initOtaUpdates() {
  if (!isNative()) return;
  try {
    // Tell Capgo the app loaded successfully (prevents rollback)
    await CapacitorUpdater.notifyAppReady();

    // Listen for new bundle download events
    CapacitorUpdater.addListener('updateAvailable', async (res) => {
      console.log('[OTA] Update available:', res.bundle?.version);
      try {
        // Set the new bundle to load on next launch
        await CapacitorUpdater.set(res.bundle);
        console.log('[OTA] Bundle set. Will apply on next launch.');
      } catch (e) { console.warn('[OTA] Set bundle failed:', e); }
    });

    CapacitorUpdater.addListener('noNeedUpdate', () => console.log('[OTA] App is up to date'));
    CapacitorUpdater.addListener('downloadComplete', (b) => console.log('[OTA] Download complete:', b.bundle?.version));
    CapacitorUpdater.addListener('error', (e) => console.warn('[OTA] Error:', e));

  } catch (e) { console.warn('[OTA] Init failed:', e); }
}

// ── Auto-init ─────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  // Run after React mounts — 400ms so splash stays visible during first render
  setTimeout(async () => {
    await setStatusBarDark();
    await hideSplash();
    await initOtaUpdates();
  }, 400);
}
