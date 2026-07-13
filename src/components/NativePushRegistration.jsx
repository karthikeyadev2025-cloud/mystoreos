import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { setupPushNotifications } from '../lib/native';
import { api } from '../lib/api';

// Was completely missing — setupPushNotifications() existed in
// src/lib/native.js but was never imported or called anywhere in the
// whole app (confirmed: zero imports of that file, anywhere). Even if
// it had been called, the FCM token it retrieves was only ever
// console.logged, never saved anywhere a server could look it up to
// actually send a push. This component is both fixes: mounts once a
// real user is known, registers for native push (no-ops instantly on
// web — isNative() check inside setupPushNotifications), and persists
// the resulting token via api.saveFCMToken so it's actually usable.
//
// Mirrors PushNavigationBridge's pattern (mounted once, keyed off
// user identity, renders nothing) rather than being folded into
// useAuth or App.jsx directly, so this one piece can be reasoned about
// and tested on its own.
export default function NativePushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    setupPushNotifications(
      (token) => {
        api.saveFCMToken(user.id, token).catch(e => {
          console.warn('[NativePushRegistration] Failed to save FCM token:', e.message);
        });
      },
      // onReceive — a push arrived while the app was in the foreground.
      // No custom handling needed yet; the OS already shows it in the
      // notification tray per capacitor.config.json's defaults.
      undefined,
      // onAction — user tapped a delivered notification. Not wired to
      // in-app navigation yet (that's what PushNavigationBridge does
      // for the web push path) — a reasonable next step once this is
      // confirmed working, not blocking the core registration/storage
      // fix this component exists for.
      undefined
    );
  }, [user?.id]);

  return null;
}
