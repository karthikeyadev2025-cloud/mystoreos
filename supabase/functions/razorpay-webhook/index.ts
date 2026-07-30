import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ═══════════════════════════════════════════════════════════════════════
// Razorpay payment.captured webhook
//
// This is the RELIABLE fallback path — Razorpay guarantees delivery even
// if the client-side verify-payment call fails (network drop, user closes
// tab, etc). Prior to this rewrite the webhook was stuck at the original
// three-tier design (starter/pro/enterprise, 30-day expiry, no
// distributor/addon handling). All other plan variants silently defaulted
// to Pro / 30 days here, even though verify-payment handled them
// correctly. Bringing the webhook to parity so both entry points grant
// exactly the same thing for the same payment.
// ═══════════════════════════════════════════════════════════════════════

const baseTier = (planId: string) => planId.replace(/_(quarterly|yearly)$/, '');
const PLAN_TIER: Record<string, string> = {
  starter: 'starter', pro: 'pro', enterprise: 'enterprise',
  service_starter: 'service_starter', service_pro: 'service_pro', service_enterprise: 'service_enterprise',
};
const cycleOf = (planId: string) =>
  planId.endsWith('_yearly') ? 'yearly' : planId.endsWith('_quarterly') ? 'quarterly' : 'monthly';
const daysFor = (cycle: string) =>
  cycle === 'yearly' ? 365 : cycle === 'quarterly' ? 90 : 30;

Deno.serve(async (req: Request) => {
  try {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) return new Response('Not configured', { status: 500 });

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') ?? '';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const expectedSig = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    if (expectedSig !== signature) return new Response('Unauthorized', { status: 401 });

    const payload = JSON.parse(rawBody);
    if (payload.event !== 'payment.captured') return new Response('OK', { status: 200 });

    const payment = payload.payload?.payment?.entity;
    if (!payment) return new Response('OK', { status: 200 });

    // Use `wh_<payment_id>` so webhook and verify-payment have distinct
    // event IDs — they may both run for the same payment, and this
    // avoids a race on the payment_history uniqueness check.
    const eventId = `wh_${payment.id}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Idempotency
    const { data: existing } = await supabase
      .from('payment_history')
      .select('id')
      .eq('razorpay_event_id', eventId)
      .maybeSingle();
    if (existing) return new Response('Already processed', { status: 200 });

    // ── Cross-check: verify-payment may have already granted the plan
    //    (using the payment_id, not wh_prefix). If so, we still record
    //    the webhook event for audit but skip the grant to avoid a
    //    duplicate expiry-date bump. ──────────────────────────────────
    const { data: alreadyGranted } = await supabase
      .from('payment_history')
      .select('id')
      .eq('razorpay_event_id', payment.id)
      .maybeSingle();

    // ── Resolve target user ────────────────────────────────────────────
    const notes = payment.notes ?? {};
    const planIdRaw: string = notes.planId ?? notes.plan_id ?? '';
    let userId: string | null = notes.userId ?? notes.user_id ?? null;

    // Phone fallback if notes.userId is absent (older client builds)
    if (!userId) {
      const contact: string = (payment.contact ?? '')
        .replace(/^\+91/, '').replace(/\D/g, '').slice(-10);
      if (contact) {
        const { data: userRow } = await supabase
          .from('users').select('id').eq('phone', contact).maybeSingle();
        userId = userRow?.id ?? null;
      }
    }

    // Amount from Razorpay (source of truth for what was actually charged)
    const amountRupees = (payment.amount ?? 0) / 100;

    // ── If verify-payment already ran successfully, we're just here
    //    for the audit trail. Skip the grant, record the webhook event. ─
    if (alreadyGranted && userId) {
      await supabase.from('payment_history').insert({
        user_id: userId,
        razorpay_event_id: eventId,
        razorpay_order_id: payment.order_id ?? null,
        razorpay_payment_id: payment.id,
        event_type: 'payment.captured',
        plan_id: planIdRaw || null,
        amount: amountRupees,
        currency: payment.currency ?? 'INR',
        status: 'success_duplicate',
        raw_payload: payload,
      });
      return new Response('OK', { status: 200 });
    }

    // ── First time this payment is being processed. Grant the plan
    //    matching what was actually paid for, with the correct cycle. ─
    let grantStatus: 'success' | 'orphan' | 'error' = 'orphan';

    if (userId && planIdRaw) {
      try {
        if (planIdRaw === 'home_service_addon') {
          const addonExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await supabase.from('users').update({
            home_service_addon_expires_at: addonExpiresAt,
          }).eq('id', userId);
          grantStatus = 'success';
        } else {
          const base = baseTier(planIdRaw);
          const cycle = cycleOf(planIdRaw);
          const planExpiresAt = new Date(Date.now() + daysFor(cycle) * 24 * 60 * 60 * 1000).toISOString();
          const isDistributor = base.endsWith('_distributor');

          if (isDistributor) {
            await supabase.from('users').update({
              subscription: 'active',
              distributor_plan_tier: base,
              distributor_plan_expires_at: planExpiresAt,
            }).eq('id', userId);
            grantStatus = 'success';
          } else {
            const tier = PLAN_TIER[base];
            if (tier) {
              await supabase.from('users').update({
                subscription: 'active',
                subscription_tier: tier,
                plan_expires_at: planExpiresAt,
              }).eq('id', userId);
              grantStatus = 'success';
            } else {
              // Unknown plan: record but do not grant a fallback tier.
              // Log so someone can look at what came through.
              console.error('webhook: unknown non-distributor plan', { planIdRaw });
              grantStatus = 'error';
            }
          }
        }
      } catch (grantErr) {
        console.error('webhook: grant failed', { userId, planIdRaw, err: (grantErr as Error).message });
        grantStatus = 'error';
      }
    }

    // Always record the event, even orphan/error cases — they're the
    // ones you most need to find later when reconciling.
    await supabase.from('payment_history').insert({
      user_id: userId,
      razorpay_event_id: eventId,
      razorpay_order_id: payment.order_id ?? null,
      razorpay_payment_id: payment.id,
      event_type: 'payment.captured',
      plan_id: planIdRaw || null,
      amount: amountRupees,
      currency: payment.currency ?? 'INR',
      status: grantStatus,
      raw_payload: payload,
    });

    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Internal error', { status: 500 });
  }
});
