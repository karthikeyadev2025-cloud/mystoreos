// App-side helper for Web Push (VAPID).
//
// Responsibilities:
//   • Register /push-sw.js (a tiny dedicated service worker for push
//     handling — separate from the Workbox PWA SW).
//   • Ask the browser for Notification permission.
//   • Subscribe to Push with the app's VAPID public key.
//   • Persist the resulting endpoint to Supabase via api.savePushSubscription
//     so the Edge Function can fan out server-side.
//
// The VAPID public key is embedded in the client (safe — it's public).
// The matching PRIVATE key lives only in the Supabase Edge Function.
//
// Enabling flow:
//   const ok = await enableWebPush(userId);
//   if (ok) toast.success('Notifications enabled');
//
// The user only sees the browser's permission prompt when they
// actively click "Enable notifications" — never on page load.

import { api } from './api';

// Public VAPID key. Set at build time via env var so different
// environments can use different keys (staging vs prod). When unset,
// the whole feature no-ops rather than half-working.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// Read-only status — used by the settings UI to decide whether to
// show "Enable" / "Disable" / "Permission denied — enable in browser
// settings" without triggering a permission prompt.
export async function getPushStatus() {
  if (!isPushSupported()) return { supported: false, permission: 'unsupported', subscribed: false };
  const permission = Notification.permission; // 'default' | 'granted' | 'denied'
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      subscribed = !!sub;
    }
  } catch { /* not subscribed */ }
  return { supported: true, permission, subscribed };
}

// Enable path — call from a user gesture (button click). Registers
// the SW, prompts for permission, subscribes, persists.
export async function enableWebPush(userId) {
  if (!isPushSupported()) throw new Error('Web Push not supported in this browser');
  if (!VAPID_PUBLIC_KEY)  throw new Error('Push is not configured yet — VITE_VAPID_PUBLIC_KEY missing');
  if (!userId)            throw new Error('Sign in first to enable notifications');

  // Register the push SW. It's OK if this is a no-op (already registered).
  const reg = await navigator.serviceWorker.register('/push-sw.js');
  await navigator.serviceWorker.ready; // wait for activation

  // Ask permission if not already granted.
  if (Notification.permission === 'default') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error('Notification permission denied');
  } else if (Notification.permission === 'denied') {
    throw new Error('Notifications blocked — unblock in your browser settings');
  }

  // Subscribe (or reuse existing subscription with the same VAPID key).
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Persist to Supabase — extracts keys so the Edge Function can encrypt.
  const raw = sub.toJSON();
  await api.savePushSubscription(userId, {
    endpoint: raw.endpoint,
    keys: { p256dh: raw.keys?.p256dh, auth: raw.keys?.auth },
  });

  return { endpoint: raw.endpoint };
}

// Disable — unsubscribe locally and drop the endpoint server-side.
// Does NOT revoke the browser-level permission (only the user can do
// that from browser settings).
export async function disableWebPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch { /* ignore */ }
  try { await api.deletePushSubscription(endpoint); } catch { /* ignore */ }
}

// Listen for the push SW's postMessage('navigate') and route inside
// the SPA rather than a full page reload.
export function installPushNavHandler(navigate) {
  if (!('serviceWorker' in navigator)) return () => {};
  const handler = (event) => {
    if (event.data?.type === 'navigate' && event.data.url) {
      try { navigate(event.data.url); } catch { window.location.href = event.data.url; }
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
