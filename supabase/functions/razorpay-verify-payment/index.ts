import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_AMOUNTS: Record<string, number> = { starter: 499, pro: 999, enterprise: 2499 };
const PLAN_TIER: Record<string, string> = { starter: 'starter', pro: 'pro', enterprise: 'enterprise' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, userId } =
      await req.json();

    if (!razorpay_payment_id || !razorpay_signature || !planId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // HMAC-SHA256: sign `order_id|payment_id` with key_secret
    const message = `${razorpay_order_id}|${razorpay_payment_id}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(keySecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const expectedSig = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    if (expectedSig !== razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Signature mismatch' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Idempotency — use payment_id as the unique event key for client-side verification
    const { data: existing } = await supabase
      .from('payment_history')
      .select('id')
      .eq('razorpay_event_id', razorpay_payment_id)
      .maybeSingle();

    if (!existing) {
      const tier = PLAN_TIER[planId] ?? 'pro';
      const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from('users').update({
        subscription: 'active',
        subscription_tier: tier,
        plan_expires_at: planExpiresAt,
      }).eq('id', userId);

      await supabase.from('payment_history').insert({
        user_id: userId,
        razorpay_event_id: razorpay_payment_id,
        razorpay_order_id: razorpay_order_id ?? null,
        razorpay_payment_id,
        event_type: 'payment.captured',
        plan_id: planId,
        amount: PLAN_AMOUNTS[planId] ?? 999,
        currency: 'INR',
        status: 'success',
        raw_payload: { razorpay_order_id, razorpay_payment_id, planId },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
