import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const baseTier = (planId: string) => planId.replace(/_(quarterly|yearly)$/, '');
const PLAN_TIER: Record<string, string> = {
  starter: 'starter', pro: 'pro', enterprise: 'enterprise',
  service_starter: 'service_starter', service_pro: 'service_pro', service_enterprise: 'service_enterprise',
};
const cycleOf = (planId: string) =>
  planId.endsWith('_yearly') ? 'yearly' : planId.endsWith('_quarterly') ? 'quarterly' : 'monthly';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Client-supplied payload ───────────────────────────────────────────
    // We accept planId + userId in the body but TREAT THEM AS UNTRUSTED HINTS.
    // The authoritative values come from the Razorpay order's own notes,
    // which we fetch back and cross-check. Prior to this change, the client
    // body was used to write the DB row, so an attacker could pay ₹1 for
    // starter_yearly in their own name, then replay the verify call with
    // userId=<victim> and planId=enterprise_yearly — the HMAC signature
    // (which only covers order_id|payment_id) would still verify, and the
    // victim account would be granted Enterprise for free.
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId: clientPlanId,
      userId: clientUserId,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const rzKeyId   = Deno.env.get('RAZORPAY_KEY_ID');
    if (!keySecret || !rzKeyId) return json({ error: 'Server not configured' }, 500);

    // ── HMAC signature verification (still needed to prove the payment
    //    itself is real — the order fetch below is not a replacement for
    //    it, just an additional binding on top). ────────────────────────
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
      return json({ error: 'Signature mismatch' }, 401);
    }

    // ── Fetch the Razorpay order itself; use its notes as authoritative
    //    userId + planId + amount. If we can't reach Razorpay, we refuse
    //    to proceed rather than falling back to client body (which is the
    //    behaviour we're specifically closing a spoofing hole against). ─
    const rzAuth = btoa(`${rzKeyId}:${keySecret}`);
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { 'Authorization': `Basic ${rzAuth}` },
    });
    if (!orderRes.ok) {
      return json({ error: 'Could not verify order with Razorpay' }, 502);
    }
    const orderData = await orderRes.json();
    const notes = (orderData?.notes ?? {}) as Record<string, string>;

    const serverUserId: string | undefined = notes.userId ?? notes.user_id;
    const serverPlanId: string | undefined = notes.planId ?? notes.plan_id;
    const serverAmountPaise: number | undefined = orderData?.amount;

    if (!serverUserId || !serverPlanId) {
      // razorpay-create-order writes both into notes; missing means the
      // order was created outside our system or by an older client build.
      return json({ error: 'Order missing binding metadata' }, 400);
    }

    // ── Reject explicit tampering — if the client body disagrees with
    //    the order's notes, this is almost certainly an attacker replay,
    //    and returning a hard error surfaces it. Do NOT silently accept
    //    the server values; the client is telling us it thinks the plan
    //    or user is something else, and we want that recorded in logs. ─
    if (clientUserId && clientUserId !== serverUserId) {
      console.warn('verify-payment: userId tampering detected', {
        order_id: razorpay_order_id, clientUserId, serverUserId,
      });
      return json({ error: 'userId does not match order' }, 403);
    }
    if (clientPlanId && clientPlanId !== serverPlanId) {
      console.warn('verify-payment: planId tampering detected', {
        order_id: razorpay_order_id, clientPlanId, serverPlanId,
      });
      return json({ error: 'planId does not match order' }, 403);
    }

    // From here on, use ONLY the server-fetched values.
    const userId = serverUserId;
    const planId = serverPlanId;
    const actualAmountPaid = typeof serverAmountPaise === 'number'
      ? serverAmountPaise / 100
      : 999;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Idempotency — payment_id is the deduplication key
    const { data: existing } = await supabase
      .from('payment_history')
      .select('id')
      .eq('razorpay_event_id', razorpay_payment_id)
      .maybeSingle();
    if (existing) return json({ success: true, alreadyProcessed: true });

    // ── Home service addon: separate branch (its own expiry column) ───
    if (planId === 'home_service_addon') {
      const addonExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('users').update({
        home_service_addon_expires_at: addonExpiresAt,
      }).eq('id', userId);

      let recordedAmount = actualAmountPaid;
      // Belt-and-braces: also confirm against pricing_v2 config; if the
      // fetched Razorpay amount and the current admin-set price disagree,
      // record the Razorpay amount (source of truth for what was charged).
      try {
        const { data: cfgRow } = await supabase
          .from('site_config').select('value').eq('key', 'pricing_v2').maybeSingle();
        const addonPrice = Number(cfgRow?.value?.addons?.homeService);
        if (addonPrice > 0 && Math.abs(addonPrice - actualAmountPaid) < 0.01) {
          recordedAmount = addonPrice;
        }
      } catch (_e) { /* keep actualAmountPaid */ }

      await supabase.from('payment_history').insert({
        user_id: userId,
        razorpay_event_id: razorpay_payment_id,
        razorpay_order_id, razorpay_payment_id,
        event_type: 'payment.captured',
        plan_id: planId,
        amount: recordedAmount,
        currency: 'INR',
        status: 'success',
        raw_payload: { razorpay_order_id, razorpay_payment_id, planId, source: 'verify' },
      });

      await supabase.rpc('push_notification', {
        p_user_id: userId,
        p_category: 'payment',
        p_title: 'Home Service Booking enabled ✅',
        p_body: `₹${recordedAmount} charged. Active for 30 days — you can now offer home visits.`,
        p_action_url: '/shop?tab=services',
        p_data: {},
      });

      return json({ success: true, addon: 'home_service', expiresAt: addonExpiresAt });
    }

    // ── Regular plan upgrades ──────────────────────────────────────────
    const base = baseTier(planId);
    const cycle = cycleOf(planId);
    const days = cycle === 'yearly' ? 365 : cycle === 'quarterly' ? 90 : 30;
    const planExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const isDistributor = base.endsWith('_distributor');

    if (isDistributor) {
      await supabase.from('users').update({
        subscription: 'active',
        distributor_plan_tier: base,
        distributor_plan_expires_at: planExpiresAt,
      }).eq('id', userId);

      await supabase.rpc('push_notification', {
        p_user_id: userId,
        p_category: 'payment',
        p_title: `Plan upgraded to ${base.replace('_distributor', '').replace(/^\w/, (c: string) => c.toUpperCase())} ✅`,
        p_body: `Payment successful. Your new plan is active until ${new Date(planExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
        p_action_url: '/distributor?tab=settings',
        p_data: {},
      });
    } else {
      // Unknown non-distributor tier → refuse rather than silently
      // fall back to 'pro'. The previous ?? 'pro' fallback was the
      // vector for granting Pro on any misconfigured payment.
      const tier = PLAN_TIER[base];
      if (!tier) {
        console.error('verify-payment: unknown non-distributor plan', { planId, base });
        return json({ error: 'Unknown plan; contact support' }, 400);
      }

      await supabase.from('users').update({
        subscription: 'active',
        subscription_tier: tier,
        plan_expires_at: planExpiresAt,
      }).eq('id', userId);

      await supabase.rpc('push_notification', {
        p_user_id: userId,
        p_category: 'payment',
        p_title: `Plan upgraded to ${tier.replace('service_', 'Service ').replace(/^\w/, (c: string) => c.toUpperCase())} ✅`,
        p_body: `Payment successful. Your new plan is active until ${new Date(planExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
        p_action_url: '/shop?tab=profile',
        p_data: {},
      });
    }

    // Launch-offer counter decrement (unchanged behaviour)
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
      razorpay_order_id, razorpay_payment_id,
      event_type: 'payment.captured',
      plan_id: planId,
      amount: actualAmountPaid,
      currency: 'INR',
      status: 'success',
      raw_payload: { razorpay_order_id, razorpay_payment_id, planId, source: 'verify' },
    });

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
