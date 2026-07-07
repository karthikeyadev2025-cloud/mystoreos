// Supabase Edge Function: push-fanout
//
// Fans a single notification row out to every Web Push subscription
// belonging to that user. Called from a Postgres trigger via pg_net
// AFTER a row lands in public.notifications — so if the notification
// insert fails, no push goes out (single source of truth).
//
// Environment (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL              — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//   VAPID_PUBLIC_KEY          — your public VAPID key (base64 URL-safe)
//   VAPID_PRIVATE_KEY         — matching private key (base64 URL-safe)
//   VAPID_SUBJECT             — mailto: or https:// URL identifying you
//   PUSH_FANOUT_SECRET        — shared secret pg_net includes in Authorization
//
// Deploy:  supabase functions deploy push-fanout
//
// Invoked with JSON body { notification_id: "…uuid…" }. Loads the row,
// loads the user's push_subscriptions, sends encrypted push messages.
// Endpoints that return 404/410 (subscription expired) get deleted so
// the table doesn't accumulate dead endpoints forever.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7?target=deno'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC       = Deno.env.get('VAPID_PUBLIC_KEY')  || ''
const VAPID_PRIVATE      = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT      = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@mystoreos.in'
const PUSH_FANOUT_SECRET = Deno.env.get('PUSH_FANOUT_SECRET') || ''

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

Deno.serve(async (req) => {
  // Simple bearer-secret auth — pg_net sends 'Authorization: Bearer <secret>'.
  // No JWT verification because the trigger runs with service-role privileges
  // and we control both endpoints. Rotate the secret if it ever leaks.
  const auth = req.headers.get('Authorization') || ''
  if (PUSH_FANOUT_SECRET && auth !== `Bearer ${PUSH_FANOUT_SECRET}`) {
    return new Response('unauthorized', { status: 401 })
  }

  let body: { notification_id?: string } = {}
  try { body = await req.json() } catch { /* empty body → no-op */ }
  const notifId = body.notification_id
  if (!notifId) return new Response('missing notification_id', { status: 400 })

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  // Load the notification and the user's subscriptions in parallel.
  const [{ data: notif }, ] = await Promise.all([
    supa.from('notifications').select('id, user_id, category, title, body, action_url, data').eq('id', notifId).maybeSingle(),
  ])
  if (!notif) return new Response('notification not found', { status: 404 })

  const { data: subs } = await supa
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('user_id', notif.user_id)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), { status: 200 })
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ sent: 0, reason: 'VAPID keys not configured' }), { status: 200 })
  }

  const payload = JSON.stringify({
    title:      notif.title,
    body:       notif.body || '',
    category:   notif.category,
    action_url: notif.action_url,
    tag:        notif.category,     // stack same-category on Android tray
    data:       notif.data || {},
    // Category-driven default; the SW falls back to the app icon.
    icon:       '/icon-192.png',
    badge:      '/icon-192.png',
    requireInteraction: notif.category === 'order' || notif.category === 'booking',
  })

  const results = await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } },
        payload,
      )
      return { ok: true, id: s.id }
    } catch (e: any) {
      // 404 Not Found / 410 Gone → subscription is dead, clean up.
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supa.from('push_subscriptions').delete().eq('id', s.id)
        return { ok: false, id: s.id, gone: true }
      }
      // Other errors (invalid VAPID, encryption failure) — leave the
      // subscription and log to Deno console for later diagnosis.
      console.error('push send error', s.endpoint, e?.statusCode, e?.body || e?.message)
      return { ok: false, id: s.id, err: String(e?.message || e) }
    }
  }))

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).ok).length
  return new Response(JSON.stringify({ sent, total: subs.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
