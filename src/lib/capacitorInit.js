/**
 * Native Android/iOS initialization
 * 
 * Configures status bar, splash screen, permissions, and platform-specific 
 * behavior on first app start. Runs once when the app boots in a Capacitor 
 * (native) context. Does NOTHING on web browsers — safe to import everywhere.
 */
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Camera } from '@capacitor/camera';
import { Keyboard } from '@capacitor/keyboard';

let initialized = false;

export async function initNativeApp() {
  if (initialized) return;
  initialized = true;
  
  // Only run in native (Android/iOS), skip on web
  if (!Capacitor.isNativePlatform()) {
    console.log('[Native] Skipped — running in web browser');
    return;
  }
  
  console.log('[Native] Initializing for', Capacitor.getPlatform());

  // Tag the document so CSS can apply native-only safe-area padding.
  // env(safe-area-inset-*) returns 0 on most Android devices, so we use
  // a body class + fixed pixel padding instead of relying on env().
  document.body.classList.add('cap-native');
  if (Capacitor.getPlatform() === 'android') {
    document.body.classList.add('cap-android');
  }
  
  try {
    // 1. STATUS BAR — only set COLOR and ICON STYLE here.
    // Do NOT call setOverlaysWebView — on Android it resets
    // setDecorFitsSystemWindows and forces edge-to-edge layout (content
    // under the camera/nav bar), then relies on env(safe-area-inset-*)
    // which returns 0 on most Android devices. Instead, MainActivity.java
    // owns the layout via setDecorFitsSystemWindows(true) so content
    // always sits BELOW the status bar and ABOVE the nav bar.
    await StatusBar.setBackgroundColor({ color: '#0B1F33' });

    // White icons/text on the dark status bar
    await StatusBar.setStyle({ style: Style.Light });

    console.log('[Native] Status bar configured');
  } catch (e) {
    console.warn('[Native] Status bar setup failed:', e.message);
  }
  
  try {
    // 2. SPLASH SCREEN — hide once the app is ready (no infinite splash)
    await SplashScreen.hide();
    console.log('[Native] Splash hidden');
  } catch (e) {
    console.warn('[Native] Splash hide failed:', e.message);
  }
  
  try {
    // 3. KEYBOARD — when keyboard opens, push content up instead of overlay
    await Keyboard.setResizeMode({ mode: 'body' });
    await Keyboard.setScroll({ isDisabled: false });
    console.log('[Native] Keyboard configured');
  } catch (e) {
    console.warn('[Native] Keyboard setup failed:', e.message);
  }
  
  try {
    // 4. HARDWARE BACK BUTTON — exit app from home, else navigate back
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
    console.log('[Native] Back button handler attached');
  } catch (e) {
    console.warn('[Native] Back button setup failed:', e.message);
  }
}

/**
 * Request camera permission (called when user taps the barcode scanner).
 * Returns true if granted, false otherwise.
 */
export async function requestCameraPermission() {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const status = await Camera.checkPermissions();
    if (status.camera === 'granted') return true;
    const req = await Camera.requestPermissions({ permissions: ['camera'] });
    return req.camera === 'granted';
  } catch (e) {
    console.warn('[Native] Camera permission failed:', e.message);
    return false;
  }
}

/**
 * Share a PDF file natively on Android/iOS using @capacitor/share.
 * On web, falls back to navigator.share or auto-download.
 *
 * Why: navigator.canShare({files}) returns false on Android WebView for blobs,
 * so the PDF share banner never appears and doc.save() goes to an invisible
 * location. The Capacitor Share plugin handles this correctly by converting
 * the blob to base64 and invoking the native share sheet.
 *
 * @param {Blob} blob - PDF blob from jsPDF doc.output('blob')
 * @param {string} fileName - e.g. "Invoice_001.pdf"
 * @param {string} title - Share sheet title
 * @returns {Promise<boolean>} true if shared, false if fell back to download
 */
export async function sharePdfNative(blob, fileName, title = 'Share Bill') {
  // Native path: use Capacitor Share plugin
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      // Convert blob to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await Share.share({
        title,
        text: title,
        // Capacitor Share accepts base64 via files array on Android
        files: [`data:application/pdf;base64,${base64}`],
        dialogTitle: title,
      });
      return true;
    } catch (e) {
      if (e?.message?.includes('cancel') || e?.errorMessage?.includes('cancel')) {
        return false; // user dismissed share sheet
      }
      console.warn('[sharePdfNative] Capacitor share failed, falling back:', e);
      // Fall through to web fallback
    }
  }

  // Web path: try navigator.share with File object
  if (navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return true;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return false;
    }
  }

  // Final fallback: trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  return false;
}

/**
 * Check if we're running inside the Android/iOS native app (not web browser).
 * Used to show/hide platform-specific UI like "Download our app" banner.
 */
export const isNativeApp = () => Capacitor.isNativePlatform();
export const isAndroid = () => Capacitor.getPlatform() === 'android';
export const isIOS = () => Capacitor.getPlatform() === 'ios';
