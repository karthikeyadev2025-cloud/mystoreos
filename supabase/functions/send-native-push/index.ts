// Supabase Edge Function: send-native-push
//
// Sends a real push notification to a native Android/iOS device via
// Firebase Cloud Messaging's HTTP v1 API. This is the missing half of
// native push — registration and token storage were wired up earlier
// (see NativePushRegistration.jsx, api.saveFCMToken), this is what
// actually SENDS something to a saved token.
//
// Triggered the same way push-fanout (the web-push equivalent) is —
// called with a notification_id, looks up every 'native' client
// subscription for that notification's user, and sends to each.
//
// FCM's HTTP v1 API requires a real OAuth2 access token, not a static
// API key — obtained here via the standard Google service-account JWT
// Bearer flow: sign a short-lived JWT with the service account's
// private key (RS256), exchange it at Google's token endpoint for an
// access token, then use that to call FCM.
//
// Required secrets (Supabase Dashboard → Edge Functions → Secrets):
//   FIREBASE_PROJECT_ID     — from the service account JSON
//   FIREBASE_CLIENT_EMAIL   — from the service account JSON
//   FIREBASE_PRIVATE_KEY    — from the service account JSON (the full
//                             PEM block, including the BEGIN/END lines
//                             — paste exactly as-is, newlines and all)
//   PUSH_FANOUT_SECRET      — same secret already used by the web-push
//                             fanout trigger, reused here so both
//                             fanout paths share one shared-secret
//                             authorization scheme rather than two.
//
// Deploy: supabase functions deploy send-native-push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
const FIREBASE_PRIVATE_KEY = (Deno.env.get('FIREBASE_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
const PUSH_FANOUT_SECRET = Deno.env.get('PUSH_FANOUT_SECRET') || '';

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const contents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(contents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Signs a JWT with the service account's private key (RS256) and
// exchanges it for a real OAuth2 access token — the standard Google
// service-account JWT Bearer flow, same one every Firebase Admin SDK
// does internally. Built directly with Web Crypto rather than pulling
// in a full SDK, since this is the one thing actually needed from it.
async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(FIREBASE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${detail}`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  // Same shared-secret authorization pattern as push-fanout — only the
  // database trigger (which knows this secret) is meant to call this.
  const auth = req.headers.get('Authorization') || '';
  if (!PUSH_FANOUT_SECRET || auth !== `Bearer ${PUSH_FANOUT_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: 'Firebase secrets not configured on server' }), { status: 500 });
  }

  try {
    const { notification_id } = await req.json();
    if (!notification_id) return new Response(JSON.stringify({ error: 'notification_id required' }), { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: notif } = await supabase.from('notifications').select('*').eq('id', notification_id).maybeSingle();
    if (!notif) return new Response(JSON.stringify({ error: 'Notification not found' }), { status: 404 });

    // Only 'native' client rows — 'web' rows are push-fanout's job.
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint')
      .eq('user_id', notif.user_id)
      .eq('client', 'native');

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no native tokens for this user' }), { status: 200 });
    }

    const accessToken = await getGoogleAccessToken();

    const results = await Promise.allSettled(subs.map(async (sub: { id: string; endpoint: string }) => {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: sub.endpoint, // the FCM registration token, stored in the endpoint column
              notification: {
                title: notif.title,
                body: notif.body,
              },
              data: {
                category: notif.category || 'info',
                action_url: notif.action_url || '',
                notification_id: notif.id,
              },
              android: {
                // sos/overdue_checkin get the same "don't let this get
                // missed" treatment on native as they already do on web
                // push (requireInteraction there; sticky + high priority
                // here) — see notif_priority below.
                priority: (notif.category === 'sos' || notif.category === 'overdue_checkin') ? 'high' : 'normal',
                notification: {
                  channel_id: 'mystoreos_default',
                  sticky: notif.category === 'sos',
                },
              },
            },
          }),
        },
      );
      if (!res.ok) {
        const detail = await res.text();
        // FCM returns UNREGISTERED for a token that's no longer valid
        // (app uninstalled, etc.) — clean it up so future sends don't
        // keep wasting a call on a dead token.
        if (detail.includes('UNREGISTERED') || detail.includes('NOT_FOUND')) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
        throw new Error(detail);
      }
      await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id);
      return { ok: true, id: sub.id };
    }));

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason?.message || 'unknown');

    return new Response(JSON.stringify({ sent, failed_count: failed.length, failures: failed }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
