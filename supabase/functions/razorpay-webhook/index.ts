import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLAN_TIER: Record<string, string> = { starter: 'starter', pro: 'pro', enterprise: 'enterprise' };

Deno.serve(async (req: Request) => {
  try {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) return new Response('Not configured', { status: 500 });

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') ?? '';

    // HMAC-SHA256 verification
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const expectedSig = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    if (expectedSig !== signature) return new Response('Unauthorized', { status: 401 });

    const payload = JSON.parse(rawBody);
    const eventType: string = payload.event;

    // Only process payment captures
    if (eventType !== 'payment.captured') return new Response('OK', { status: 200 });

    const payment = payload.payload?.payment?.entity;
    if (!payment) return new Response('OK', { status: 200 });

    // Use `wh_<payment_id>` so webhook and verify-payment have different event IDs (prevent race/lock)
    const eventId = `wh_${payment.id}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Idempotency check
    const { data: existing } = await supabase
      .from('payment_history')
      .select('id')
      .eq('razorpay_event_id', eventId)
      .maybeSingle();

    if (existing) return new Response('Already processed', { status: 200 });

    const notes = payment.notes ?? {};
    const planId: string = notes.planId ?? notes.plan_id ?? 'pro';
    const tier = PLAN_TIER[planId] ?? 'pro';
    const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Resolve user ID directly from notes first
    let userId: string | null = notes.userId ?? notes.user_id ?? null;

    // 2. Fallback to phone contact mapping if no userId is in notes
    if (!userId) {
      const contact: string = (payment.contact ?? '')
        .replace(/^\+91/, '').replace(/\D/g, '').slice(-10);

      if (contact) {
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('phone', contact)
          .maybeSingle();
        userId = userRow?.id ?? null;
      }
    }

    if (userId) {
      await supabase.from('users').update({
        subscription: 'active',
        subscription_tier: tier,
        plan_expires_at: planExpiresAt,
      }).eq('id', userId);
    }

    await supabase.from('payment_history').insert({
      user_id: userId,
      razorpay_event_id: eventId,
      razorpay_order_id: payment.order_id ?? null,
      razorpay_payment_id: payment.id,
      event_type: eventType,
      plan_id: planId,
      amount: (payment.amount ?? 0) / 100,
      currency: payment.currency ?? 'INR',
      status: userId ? 'success' : 'orphan',
      raw_payload: payload,
    });

    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Internal error', { status: 500 });
  }
});
