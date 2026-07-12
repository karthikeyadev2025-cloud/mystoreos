import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_AMOUNTS: Record<string, number> = { starter: 499, pro: 999, enterprise: 2499 };
const baseTier = (planId: string) => planId.replace(/_(quarterly|yearly)$/, '');
const PLAN_TIER: Record<string, string> = {
  starter: 'starter', pro: 'pro', enterprise: 'enterprise',
};
const cycleOf = (planId: string) =>
  planId.endsWith('_yearly') ? 'yearly' : planId.endsWith('_quarterly') ? 'quarterly' : 'monthly';
const isYearlyPlan = (planId: string) => planId.endsWith('_yearly');

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
      // Home Service add-on — handled as its own explicit branch, BEFORE
      // falling into the generic tier-grant logic below. Without this,
      // baseTier('home_service_addon') would pass through unchanged,
      // PLAN_TIER['home_service_addon'] would be undefined, and the
      // `?? 'pro'` fallback a few lines down would have silently
      // upgraded the shop to full PRO TIER for a ₹199 addon payment —
      // a serious billing bug, not a cosmetic one.
      if (planId === 'home_service_addon') {
        const addonExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('users').update({
          home_service_addon_expires_at: addonExpiresAt,
        }).eq('id', userId);

        // Record the actual admin-configured price, not a hardcoded
        // figure — matches what razorpay-create-order actually charged,
        // read from the same pricing_v2 config. Falls back to 199 only
        // if the config row is missing, same default as everywhere else
        // this value is read.
        let recordedAmount = 199;
        try {
          const { data: cfgRow } = await supabase
            .from('site_config').select('value').eq('key', 'pricing_v2').maybeSingle();
          const addonPrice = Number(cfgRow?.value?.addons?.homeService);
          if (addonPrice > 0) recordedAmount = addonPrice;
        } catch (_e) { /* keep the 199 fallback */ }

        await supabase.from('payment_history').insert({
          user_id: userId,
          razorpay_event_id: razorpay_payment_id,
          razorpay_order_id: razorpay_order_id ?? null,
          razorpay_payment_id,
          event_type: 'payment.captured',
          plan_id: planId,
          amount: recordedAmount,
          currency: 'INR',
          status: 'success',
          raw_payload: { razorpay_order_id, razorpay_payment_id, planId },
        });

        return new Response(JSON.stringify({ success: true, addon: 'home_service', expiresAt: addonExpiresAt }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const base = baseTier(planId);
      const cycle = cycleOf(planId);
      const days = cycle === 'yearly' ? 365 : cycle === 'quarterly' ? 90 : 30;
      const planExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const isDistributor = base.endsWith('_distributor');

      if (isDistributor) {
        // Distributor plan: grant on the distributor columns.
        await supabase.from('users').update({
          subscription: 'active',
          distributor_plan_tier: base,
          distributor_plan_expires_at: planExpiresAt,
        }).eq('id', userId);
      } else {
        const tier = PLAN_TIER[base] ?? 'pro';
        await supabase.from('users').update({
          subscription: 'active',
          subscription_tier: tier,
          plan_expires_at: planExpiresAt,
        }).eq('id', userId);
      }

      // Decrement the launch-offer counter on any discounted (non-monthly) plan.
      if (cycle !== 'monthly') {
        const { data: cfgRow } = await supabase
          .from('site_config').select('value').eq('key', 'pricing_v2').maybeSingle();
        const cfg = cfgRow?.value;
        if (cfg?.offer && Number(cfg.offer.remaining) > 0) {
          cfg.offer.remaining = Math.max(0, Number(cfg.offer.remaining) - 1);
          await supabase.from('site_config')
            .upsert({ key: 'pricing_v2', value: cfg }, { onConflict: 'key' });
        }
      }

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
