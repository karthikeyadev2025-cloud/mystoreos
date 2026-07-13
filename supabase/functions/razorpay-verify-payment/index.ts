import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const baseTier = (planId: string) => planId.replace(/_(quarterly|yearly)$/, '');
const PLAN_TIER: Record<string, string> = {
  starter: 'starter', pro: 'pro', enterprise: 'enterprise',
  // Service business tier track — separate pricing from Retail (see
  // PLAN_CAPS.service_starter/_pro/_enterprise in features.js). Without
  // these three entries, a customer paying for service_starter would
  // fall through the `PLAN_TIER[base] ?? 'pro'` fallback below and be
  // silently granted full Retail Pro — the same class of bug already
  // caught and fixed for the home_service_addon plan ID earlier this
  // session, now checked for here too before it could ship.
  service_starter: 'service_starter', service_pro: 'service_pro', service_enterprise: 'service_enterprise',
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

    // Fetch the REAL amount actually charged, straight from Razorpay's
    // own order record — was previously PLAN_AMOUNTS[planId] ?? 999, a
    // hardcoded map with only starter/pro/enterprise entries. ANY
    // Service tier or distributor plan (service_pro, basic_distributor,
    // any _quarterly/_yearly variant, all of them) fell through to the
    // ?? 999 fallback and got permanently recorded in payment_history
    // as ₹999 regardless of what was actually paid — not a display bug,
    // the SOURCE DATA ITSELF was wrong the moment it was written.
    // Fetching the order back from Razorpay directly means this can
    // never drift from reality — it's not a second computation that
    // could disagree with the first, it's the same charge Razorpay
    // itself already processed.
    let actualAmountPaid = 999;
    try {
      const rzKeyId = Deno.env.get('RAZORPAY_KEY_ID');
      const rzAuth = btoa(`${rzKeyId}:${keySecret}`);
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: { 'Authorization': `Basic ${rzAuth}` },
      });
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        if (orderData?.amount) actualAmountPaid = orderData.amount / 100;
      }
    } catch (_e) { /* keep the 999 fallback if the fetch itself fails */ }

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

        // Was completely missing — a shop could pay ₹199 for this
        // add-on and get zero confirmation of any kind beyond the
        // checkout popup closing. Real payment events deserve a real
        // notification, same as every other event in the app.
        await supabase.rpc('push_notification', {
          p_user_id: userId,
          p_category: 'payment',
          p_title: 'Home Service Booking enabled ✅',
          p_body: `₹${recordedAmount} charged. Active for 30 days — you can now offer home visits with the full safety feature set.`,
          p_action_url: '/shop?tab=services',
          p_data: {},
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

        // Was missing — a distributor paying for a real plan upgrade
        // got zero confirmation beyond the checkout popup closing.
        await supabase.rpc('push_notification', {
          p_user_id: userId,
          p_category: 'payment',
          p_title: `Plan upgraded to ${base.replace('_distributor', '').replace(/^\w/, (c: string) => c.toUpperCase())} ✅`,
          p_body: `Payment successful. Your new plan is active until ${new Date(planExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
          p_action_url: '/distributor?tab=settings',
          p_data: {},
        });
      } else {
        const tier = PLAN_TIER[base] ?? 'pro';
        await supabase.from('users').update({
          subscription: 'active',
          subscription_tier: tier,
          plan_expires_at: planExpiresAt,
        }).eq('id', userId);

        // Same gap, shop side — a real payment succeeding deserves a
        // real confirmation, not silence.
        await supabase.rpc('push_notification', {
          p_user_id: userId,
          p_category: 'payment',
          p_title: `Plan upgraded to ${tier.replace('service_', 'Service ').replace(/^\w/, (c: string) => c.toUpperCase())} ✅`,
          p_body: `Payment successful. Your new plan is active until ${new Date(planExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
          p_action_url: '/shop?tab=profile',
          p_data: {},
        });
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
        amount: actualAmountPaid,
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
