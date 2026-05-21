// Vercel serverless function — Razorpay webhook receiver
// Verifies HMAC-SHA256 signature before processing any event.
//
// Required environment variables (set in Vercel dashboard, never in code):
//   RAZORPAY_WEBHOOK_SECRET   — webhook secret from Razorpay dashboard
//   SUPABASE_URL              — your project URL (same as VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY — server-side only, never exposed to browser
//
// Razorpay dashboard → Settings → Webhooks → Add webhook URL:
//   https://<your-domain>/api/razorpay-webhook
//   Events: payment.captured, payment.failed, subscription.activated, subscription.charged
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Disable Vercel's default body parser — we need the raw bytes to verify the signature.
export const config = { api: { bodyParser: false } };

const PLAN_EXPIRY_DAYS = { pro: 30, enterprise: 30 };
const PLAN_TIERS = { pro: 'pro', enterprise: 'enterprise' };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // Read raw body before any parsing
  const rawBody = await readRawBody(req);
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
  }

  // Verify HMAC-SHA256 — reject anything that doesn't match
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(signature, 'hex'))) {
    console.warn('Razorpay webhook: signature mismatch — possible spoofed request');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Acknowledge receipt immediately — Razorpay retries on non-2xx
  res.status(200).json({ received: true });

  // Only proceed with DB updates if Supabase is configured
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Supabase not configured — webhook acknowledged but no DB update');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const eventType = event.event;
  const paymentEntity = event?.payload?.payment?.entity;
  const subscriptionEntity = event?.payload?.subscription?.entity;

  try {
    if (eventType === 'payment.captured' && paymentEntity) {
      await handlePaymentCaptured(supabase, paymentEntity);
    } else if (eventType === 'payment.failed' && paymentEntity) {
      await handlePaymentFailed(supabase, paymentEntity);
    } else if (eventType === 'subscription.activated' && subscriptionEntity) {
      await handleSubscriptionActivated(supabase, subscriptionEntity);
    } else if (eventType === 'subscription.charged' && subscriptionEntity) {
      await handleSubscriptionCharged(supabase, subscriptionEntity);
    }
  } catch (err) {
    // Log but don't re-throw — we already sent 200 to Razorpay
    console.error(`Webhook handler error for ${eventType}:`, err);
  }
}

async function handlePaymentCaptured(supabase, payment) {
  const orderId = payment.order_id;
  const paymentId = payment.id;
  const notes = payment.notes || {};
  const planId = notes.plan_id;
  const userId = notes.user_id;

  // Update payment_history record by order_id
  await supabase
    .from('payment_history')
    .update({ status: 'captured', razorpay_payment_id: paymentId, processed_at: new Date().toISOString() })
    .eq('razorpay_order_id', orderId);

  // Upgrade the user's subscription if plan and user are known
  if (userId && planId && PLAN_TIERS[planId]) {
    const expiresAt = addDays(PLAN_EXPIRY_DAYS[planId] || 30);
    await supabase
      .from('users')
      .update({
        subscription_tier: PLAN_TIERS[planId],
        subscription: 'active',
        plan_expires_at: expiresAt,
      })
      .eq('id', userId);
  }
}

async function handlePaymentFailed(supabase, payment) {
  const orderId = payment.order_id;
  if (!orderId) return;
  await supabase
    .from('payment_history')
    .update({ status: 'failed', processed_at: new Date().toISOString() })
    .eq('razorpay_order_id', orderId);
}

async function handleSubscriptionActivated(supabase, subscription) {
  const notes = subscription.notes || {};
  const userId = notes.user_id;
  const planId = notes.plan_id;
  if (!userId || !planId || !PLAN_TIERS[planId]) return;

  const expiresAt = subscription.current_end
    ? new Date(subscription.current_end * 1000).toISOString()
    : addDays(30);

  await supabase
    .from('users')
    .update({
      subscription_tier: PLAN_TIERS[planId],
      subscription: 'active',
      plan_expires_at: expiresAt,
    })
    .eq('id', userId);
}

async function handleSubscriptionCharged(supabase, subscription) {
  // Renewal — extend the expiry date
  await handleSubscriptionActivated(supabase, subscription);
}
