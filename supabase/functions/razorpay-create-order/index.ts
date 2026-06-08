import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { planId, amount, currency = 'INR', userId } = await req.json();
    if (!planId || !amount) {
      return new Response(JSON.stringify({ error: 'planId and amount required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      return new Response(JSON.stringify({ error: 'Razorpay not configured on server' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Capture user ID either explicitly passed in body or extracted from auth token JWT
    let resolvedUserId = userId || null;
    if (!resolvedUserId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const payloadBase64 = token.split('.')[1];
          const decodedPayload = JSON.parse(atob(payloadBase64));
          resolvedUserId = decodedPayload.sub || null; // 'sub' field in Supabase JWT is the auth.uid()
        } catch (_) {
          // Silent fallback if JWT parsing fails
        }
      }
    }

    const auth = btoa(`${keyId}:${keySecret}`);
    const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency,
        receipt: `mso_${planId}_${Date.now()}`,
        notes: {
          planId,
          userId: resolvedUserId,
          plan_id: planId,
          user_id: resolvedUserId
        },
      }),
    });

    if (!rzRes.ok) {
      const detail = await rzRes.text();
      return new Response(JSON.stringify({ error: 'Razorpay order failed', detail }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const order = await rzRes.json();
    return new Response(
      JSON.stringify({ orderId: order.id, amount: order.amount, currency: order.currency }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
