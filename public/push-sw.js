// Web Push service worker.
//
// Registered separately from the Workbox-generated PWA service worker.
// Handles the 'push' and 'notificationclick' events; that's ALL it does.
// Cache/offline behavior stays in the Workbox SW at sw.js.
//
// Deliberately kept tiny and dependency-free — service workers can be
// slow to install and update, and the smaller this file is the more
// reliably it updates without shipping a stale-cache regression.

self.addEventListener('push', (event) => {
  // Servers send: { title, body, category, action_url, icon, badge }
  let payload;
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }

  const title = payload.title || 'MyStore OS';
  const options = {
    body:  payload.body || '',
    icon:  payload.icon  || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag:   payload.tag   || payload.category || 'mystore',   // stack same-category
    data:  { url: payload.action_url || '/', ...(payload.data || {}) },
    // Vibrate on Android — short-long-short = "this is important without being annoying"
    vibrate: [80, 40, 80],
    // Renotify: when a tag repeats (same category firing again), still
    // show the second one instead of silently replacing.
    renotify: true,
    // Keep the OS notification tray entry until the user actually acts
    // on it — critical for busy shops that get bookings while doing something else.
    requireInteraction: !!payload.requireInteraction,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';

  event.waitUntil((async () => {
    // If the app is already open in a tab, focus that tab and navigate
    // it to the target URL — feels more native than opening a duplicate.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      // Focus + postMessage; the app-side listener can route without full navigation.
      if (client.url.includes(self.location.origin)) {
        try {
          await client.focus();
          client.postMessage({ type: 'navigate', url });
          return;
        } catch { /* fall through */ }
      }
    }
    // Otherwise open a new window/tab.
    await self.clients.openWindow(url);
  })());
});

// Optional: on push subscription change (browser rotated the endpoint),
// we can't re-subscribe here without app credentials. The app-side
// pushClient checks the subscription on next launch and rotates if
// needed — see src/lib/pushClient.js.
self.addEventListener('pushsubscriptionchange', (event) => {
  // Best-effort: try to re-subscribe with the same options; app will
  // pick up the new endpoint on its next foreground.
  event.waitUntil(Promise.resolve());
});
