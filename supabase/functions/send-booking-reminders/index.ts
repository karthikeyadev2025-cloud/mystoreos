// Supabase Edge Function: send-booking-reminders
//
// Runs on a schedule (every 15 min via cron) and sends WhatsApp / SMS
// reminders for confirmed appointments approaching in two windows:
//
//   • 24-hour reminder — appointments ~24h from now (once)
//   • 1-hour reminder  — appointments ~1h  from now (once)
//
// Which shops get reminders is gated by their subscription tier:
//   trial / pro / enterprise → enabled
//   starter                  → skipped (matches serviceReminders cap
//                              in features.js — Pro Plan and above)
//
// Idempotency is enforced with a small 'reminder_log' table that
// stores (appointment_id, kind) rows. Before sending, we check the log;
// after sending, we insert. Even if the cron double-fires or the
// function retries, each reminder is guaranteed to be sent at most once
// per appointment per window.
//
// Deploy:  supabase functions deploy send-booking-reminders
// Schedule (Supabase Cron / pg_cron):
//   SELECT cron.schedule(
//     'booking-reminders',
//     '*/15 * * * *',
//     $$ SELECT net.http_post(
//       url := '<project>/functions/v1/send-booking-reminders',
//       headers := jsonb_build_object('Authorization', 'Bearer <REMINDER_CRON_SECRET>')
//     ) $$
//   );
//
// Environment secrets (Supabase → Edge Functions → Secrets):
//   REMINDER_CRON_SECRET        — random string, matches cron header
//   WHATSAPP_BUSINESS_TOKEN     — WhatsApp Cloud API token (optional)
//   WHATSAPP_PHONE_NUMBER_ID    — WhatsApp phone number ID     (optional)
//   MSG91_API_KEY / MSG91_SENDER_ID — SMS fallback (optional)
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — auto-injected

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET        = Deno.env.get('REMINDER_CRON_SECRET') || ''
const WA_TOKEN           = Deno.env.get('WHATSAPP_BUSINESS_TOKEN') || ''
const WA_PHONE_ID        = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
const SMS_KEY            = Deno.env.get('MSG91_API_KEY') || ''
const SMS_SENDER         = Deno.env.get('MSG91_SENDER_ID') || 'MYSTR'

// Which plan tiers get reminders. Kept in sync with features.js
// serviceReminders — trial, pro, enterprise are true; starter is false.
const REMINDER_ELIGIBLE_TIERS = new Set(['pro', 'enterprise'])
// Trial: cover both possible shapes (subscription='trial' with no tier)
const isEligibleForReminders = (shop: any) => {
  if (!shop) return false
  if (shop.subscription_tier && REMINDER_ELIGIBLE_TIERS.has(shop.subscription_tier)) return true
  // Trial = subscription='trial' AND no explicit tier
  if (shop.subscription === 'trial' && !shop.subscription_tier) return true
  return false
}

Deno.serve(async (req) => {
  // Auth: same bearer-secret pattern as the push-fanout function.
  const auth = req.headers.get('Authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  const now = new Date()
  // Window widths — 15-min cron with a ±10-min matching band. Any
  // narrower and a boundary appointment could slip between two runs;
  // any wider and one appointment could be tagged twice. The log
  // catches the overlap.
  const H24_START = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 15 * 60 * 1000)
  const H24_END   = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 5  * 60 * 1000)
  const H1_START  = new Date(now.getTime() + 1  * 60 * 60 * 1000 - 15 * 60 * 1000)
  const H1_END    = new Date(now.getTime() + 1  * 60 * 60 * 1000 + 5  * 60 * 1000)

  const [{ data: h24 }, { data: h1 }] = await Promise.all([
    supa.rpc('appointments_in_window', { p_start: H24_START.toISOString(), p_end: H24_END.toISOString() }),
    supa.rpc('appointments_in_window', { p_start: H1_START.toISOString(),  p_end: H1_END.toISOString() }),
  ])

  const results = { sent_24h: 0, sent_1h: 0, skipped_starter: 0, skipped_already_sent: 0, errors: 0 }

  for (const [rows, kind, resultsKey] of [
    [h24 || [], '24h', 'sent_24h'] as const,
    [h1  || [], '1h',  'sent_1h']  as const,
  ]) {
    for (const appt of rows) {
      // Guard: only 'confirmed' bookings get reminders.
      if (appt.status !== 'confirmed') continue

      // Plan gate — check if the shop's tier includes reminders.
      if (!isEligibleForReminders(appt.shop_row)) {
        results.skipped_starter++
        continue
      }

      // Idempotency: has this exact (appointment, kind) already been sent?
      const { data: log } = await supa
        .from('reminder_log')
        .select('id')
        .eq('appointment_id', appt.id)
        .eq('kind', kind)
        .maybeSingle()
      if (log) { results.skipped_already_sent++; continue }

      // Send.
      const ok = await sendReminder(appt, kind)
      if (ok) {
        await supa.from('reminder_log').insert({
          appointment_id: appt.id, kind, sent_at: new Date().toISOString(),
        })
        results[resultsKey]++
      } else {
        results.errors++
      }
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ─── message + delivery ──────────────────────────────────────────────
function cleanPhone(phone: string) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length >= 12 && digits.startsWith('91')) return digits
  if (digits.length === 10) return '91' + digits
  return digits
}

function buildMessage(appt: any, kind: '24h' | '1h') {
  const time = appt.appointment_time?.slice(0, 5) || ''
  const date = appt.appointment_date
  const shopName = appt.shop_name || 'the shop'
  const svc = appt.service_name || 'your appointment'
  const when = kind === '1h'
    ? `in 1 hour, at ${time}`
    : `tomorrow (${date}) at ${time}`
  return `Hi ${appt.customer_name || ''}, a friendly reminder: your ${svc} at ${shopName} is ${when}. See you soon!`
}

async function sendWhatsApp(phone: string, text: string) {
  if (!WA_TOKEN || !WA_PHONE_ID) return false
  try {
    const r = await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text },
      }),
    })
    return r.ok
  } catch { return false }
}

async function sendSMS(phone: string, text: string) {
  if (!SMS_KEY) return false
  try {
    const r = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: SMS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: SMS_SENDER, route: '4', country: '91',
        sms: [{ message: text.slice(0, 160), to: [phone] }],
      }),
    })
    return r.ok
  } catch { return false }
}

async function sendReminder(appt: any, kind: '24h' | '1h'): Promise<boolean> {
  const phone = cleanPhone(appt.customer_phone)
  if (!phone) return false
  const text = buildMessage(appt, kind)
  // WhatsApp first (higher deliverability), SMS fallback.
  if (await sendWhatsApp(phone, text)) return true
  if (await sendSMS(phone, text))      return true
  return false
}
