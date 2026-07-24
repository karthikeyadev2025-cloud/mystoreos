// Supabase Edge Function: generate-distributor-api-key
//
// API Access for distributors — explicitly promised on the Enterprise
// plan but had zero implementation until now. This is the "generate a
// new key" endpoint, called by an authenticated distributor from their
// own Settings page (not part of the public API itself — that's
// distributor-api, a separate function).
//
// Security: the full key is only ever returned here, in this one
// response, right after generation. It is never stored anywhere —
// only its SHA-256 hash is persisted. From this point on, even this
// server can't recover the plaintext key; verifying a request means
// hashing the incoming key and comparing hashes.
//
// Generating a new key automatically revokes any existing active
// key for that distributor — one active key at a time, matching the
// simplest, safest mental model for the distributor to reason about
// ("regenerating" rather than accumulating keys).
//
// Deploy: supabase functions deploy generate-distributor-api-key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomKey(): string {
  // 32 random bytes, base64url-encoded — same order of entropy as a
  // typical API key from any major provider.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `msk_live_${b64}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await admin.from('users').select('id, role, subscription_tier').eq('id', caller.id).maybeSingle();
    if (!profile) return json({ error: 'Profile not found' }, 403);
    if (profile.role !== 'distributor' && profile.role !== 'admin') {
      return json({ error: 'Only distributors can generate API keys' }, 403);
    }

    // Revoke any existing active key for this distributor first — one
    // active key at a time.
    await admin.from('distributor_api_keys').update({ revoked: true })
      .eq('distributor_id', profile.id).eq('revoked', false);

    const fullKey = randomKey();
    const keyHash = await sha256Hex(fullKey);
    const keyPrefix = fullKey.slice(0, 18) + '…'; // "msk_live_xxxxxxxx…" — enough to recognize, not enough to reconstruct

    const { data: row, error } = await admin.from('distributor_api_keys').insert({
      distributor_id: profile.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
    }).select('id, created_at').maybeSingle();

    if (error) return json({ error: error.message }, 500);

    // The ONLY time the full key is ever returned.
    return json({ apiKey: fullKey, keyPrefix, createdAt: row?.created_at });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
