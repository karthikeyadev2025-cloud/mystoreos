// Supabase Edge Function: auth-otp-login
//
// Passwordless login: a user who has already proven phone ownership
// via Firebase OTP (client-side) exchanges that proof here for a real
// Supabase session — without needing to remember or type a password
// at all. This is the "speedy login by OTP" alternative to the
// existing phone+password login, not a replacement for it — both
// remain available.
//
// Flow:
//   1. Client completes Firebase Phone Auth OTP verification (same
//      flow already built for registration/forgot-password) and gets
//      a Firebase ID token.
//   2. Client sends that token here.
//   3. This function verifies the token server-side (own signature/
//      issuer/audience/expiry check — never trusts the client's claim
//      about who they are), looks up the Supabase account for that
//      phone, and uses Supabase Admin's generateLink to produce a
//      one-time token the client can immediately exchange for a real
//      session via supabase.auth.verifyOtp() client-side — the
//      standard, documented pattern for a trusted server process to
//      hand a client a session without a password ever being involved.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://mystoreos.in',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:5173',
];

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';

const getCORS = (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

const json = (data: object, status: number, req: Request) =>
  new Response(JSON.stringify(data), { status, headers: { ...getCORS(req), 'Content-Type': 'application/json' } });

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - s.length % 4) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extractPublicKeyFromCert(certDer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(certDer);
  const spkiHeader = [0x30, 0x82];
  const rsaOid = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
  for (let i = 0; i < bytes.length - rsaOid.length; i++) {
    let match = true;
    for (let j = 0; j < rsaOid.length; j++) {
      if (bytes[i + j] !== rsaOid[j]) { match = false; break; }
    }
    if (match) {
      for (let k = i; k >= 0; k--) {
        if (bytes[k] === spkiHeader[0] && bytes[k + 1] === spkiHeader[1]) {
          return bytes.slice(k).buffer;
        }
      }
    }
  }
  throw new Error('Could not locate public key in certificate');
}

// Same verification as auth-reset-password's Firebase check — kept as
// its own copy here rather than a shared import, matching how every
// other function in this project is self-contained (CORS handling,
// etc. are all duplicated the same way already).
async function verifyFirebaseIdTokenAndGetPhone(idToken: string): Promise<string> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Token expired');
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('Token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error('Token issuer mismatch');
  if (!payload.phone_number) throw new Error('Token has no verified phone number');

  const certsRes = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!certsRes.ok) throw new Error('Could not fetch verification certs');
  const certs: Record<string, string> = await certsRes.json();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Unknown signing key — token cannot be verified');

  const certBody = cert.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\s/g, '');
  const certBinary = atob(certBody);
  const certBytes = new Uint8Array(certBinary.length);
  for (let i = 0; i < certBinary.length; i++) certBytes[i] = certBinary.charCodeAt(i);

  const cryptoKey = await crypto.subtle.importKey(
    'spki', extractPublicKeyFromCert(certBytes.buffer),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlDecode(sigB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
  if (!valid) throw new Error('Signature verification failed');

  return payload.phone_number as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCORS(req) });

  try {
    const { phone, firebaseIdToken } = await req.json();
    if (!phone || !firebaseIdToken) return json({ error: 'phone and firebaseIdToken required' }, 400, req);
    if (!FIREBASE_PROJECT_ID) return json({ error: 'Server not configured for phone verification' }, 500, req);

    let verifiedPhone: string;
    try {
      verifiedPhone = await verifyFirebaseIdTokenAndGetPhone(firebaseIdToken);
    } catch (e) {
      return json({ error: `Phone verification failed: ${(e as Error).message}` }, 401, req);
    }

    const normalizedVerified = verifiedPhone.replace(/\D/g, '').slice(-10);
    const normalizedRequested = String(phone).replace(/\D/g, '').slice(-10);
    if (normalizedVerified !== normalizedRequested) {
      return json({ error: 'Verified phone does not match the number you\u2019re logging in with' }, 403, req);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: profile } = await admin.from('users').select('id, phone, status').eq('phone', normalizedRequested).maybeSingle();
    if (!profile) return json({ error: 'No account found with this phone number. Please register first.' }, 404, req);
    if (profile.status === 'pending') return json({ error: 'Account pending admin approval' }, 403, req);

    const email = `${profile.phone}@mystore.internal`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !linkData) return json({ error: linkErr?.message || 'Could not create login session' }, 500, req);

    // hashed_token is what the client exchanges via
    // supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) to get
    // a real session — the standard Supabase pattern for a trusted
    // server handing off a passwordless session.
    return json({
      success: true,
      token_hash: linkData.properties?.hashed_token,
    }, 200, req);
  } catch (e) {
    return json({ error: (e as Error).message }, 500, req);
  }
});
