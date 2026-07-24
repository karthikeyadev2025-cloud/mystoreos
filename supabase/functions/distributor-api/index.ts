// Supabase Edge Function: distributor-api
//
// The actual public API — this is what an Enterprise distributor's
// own systems (their ERP, a custom script, a Zapier/Make automation)
// would call directly, authenticated with the key generated via
// generate-distributor-api-key. Not the Supabase anon key, not a user
// session — this is a genuinely external-facing integration point.
//
// Auth: X-API-Key header. Verified by hashing the provided key and
// matching against the stored hash (the plaintext key was never
// stored anywhere, including here).
//
// GET /distributor-api?resource=orders    — stock orders received
// GET /distributor-api?resource=catalog   — published wholesale products
// GET /distributor-api?resource=credits   — outstanding credit ledger
//
// Deploy: supabase functions deploy distributor-api --no-verify-jwt
// (--no-verify-jwt is required — external callers have no Supabase
// anon key at all, only their own API key)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
};
const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
    if (!apiKey || !apiKey.startsWith('msk_live_')) {
      return json({ error: 'Missing or malformed API key. Pass it in the X-API-Key header.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const keyHash = await sha256Hex(apiKey);
    const { data: keyRow } = await admin.from('distributor_api_keys')
      .select('id, distributor_id, revoked').eq('key_hash', keyHash).maybeSingle();

    if (!keyRow || keyRow.revoked) {
      return json({ error: 'Invalid or revoked API key.' }, 401);
    }

    // Fire-and-forget last-used stamp — never block or fail the actual
    // request over this being slow or erroring.
    admin.from('distributor_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id).then(() => {});

    const url = new URL(req.url);
    const resource = url.searchParams.get('resource');
    const distId = keyRow.distributor_id;

    if (resource === 'orders') {
      const { data, error } = await admin.from('stock_orders').select('*').eq('distributor_id', distId).order('created_at', { ascending: false }).limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ orders: data });
    }

    if (resource === 'catalog') {
      const { data, error } = await admin.from('distributor_products').select('id, name, price, stock, category').eq('distributor_id', distId);
      if (error) return json({ error: error.message }, 500);
      return json({ catalog: data });
    }

    if (resource === 'credits') {
      const { data, error } = await admin.from('credits').select('id, to_shop_id, description, amount, paid, created_at').eq('from_id', distId).order('created_at', { ascending: false }).limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ credits: data });
    }

    return json({ error: "Unknown resource. Use ?resource=orders, ?resource=catalog, or ?resource=credits." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
