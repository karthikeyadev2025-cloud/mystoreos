// Supabase Edge Function: auth-reset-password
//
// ═══════════════════════════════════════════════════════════════════════
// SECURITY FIX — the previous version of this function had NO
// authorization check of any kind. It accepted { phone, newPassword }
// or { userId, newPassword } and reset the password immediately, with
// nothing verifying the caller actually owned that phone number or
// was that user. Any request with the public anon key (which is
// meant to be embedded client-side, so genuinely public) could reset
// ANY account's password. This is the fix, built while adding real
// OTP-based password reset — the two had to be solved together.
// ═══════════════════════════════════════════════════════════════════════
//
// Two legitimate ways to reach this function now:
//
//   1. { userId, newPassword, accessToken } — "change password" from
//      inside the app. accessToken must be a REAL Supabase session
//      access token (not the anon key) for the account being changed.
//      Verified server-side via admin.auth.getUser(accessToken) —
//      whatever user that token actually belongs to must match userId.
//
//   2. { phone, newPassword, firebaseIdToken } — "forgot password" via
//      OTP. firebaseIdToken is the ID token Firebase returns after a
//      successful confirmationResult.confirm(otpCode) client-side.
//      Verified server-side against Firebase's own public signing
//      certs (NOT just trusted because the client says so) — checks
//      the signature, issuer, audience, and expiry, then confirms the
//      token's own phone_number claim matches the phone being reset.
//      A token for a DIFFERENT phone number cannot reset this one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

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
    'spki',
    extractPublicKeyFromCert(certBytes.buffer),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlDecode(sigB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
  if (!valid) throw new Error('Signature verification failed');

  return payload.phone_number as string;
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCORS(req) });

  try {
    const { phone, newPassword, userId, accessToken, firebaseIdToken } = await req.json();
    if (!newPassword || newPassword.length < 4) return json({ error: 'Password must be at least 4 characters' }, 400, req);
    if (!userId && !phone) return json({ error: 'phone or userId required' }, 400, req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    let profileId: string;
    let profilePhone: string;

    if (userId) {
      if (!accessToken) return json({ error: 'Not authenticated' }, 401, req);
      const { data: { user: callerUser }, error: callerErr } = await admin.auth.getUser(accessToken);
      if (callerErr || !callerUser) return json({ error: 'Invalid or expired session' }, 401, req);

      const { data } = await admin.from('users').select('id, phone').eq('id', userId).single();
      if (!data) return json({ error: 'User not found' }, 404, req);

      const expectedEmail = `${data.phone}@mystore.internal`;
      if (callerUser.email !== expectedEmail) return json({ error: 'You can only change your own password' }, 403, req);

      profileId = data.id;
      profilePhone = data.phone;
    } else {
      if (!firebaseIdToken) return json({ error: 'Phone verification required' }, 401, req);
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
        return json({ error: 'Verified phone does not match the number you\u2019re resetting' }, 403, req);
      }

      const { data } = await admin.from('users').select('id, phone').eq('phone', normalizedRequested).single();
      if (!data) return json({ error: 'Phone number not found. Please register first.' }, 404, req);
      profileId = data.id;
      profilePhone = data.phone;
    }

    await admin.from('users').update({ pass: await bcrypt.hash(newPassword, 10) }).eq('id', profileId);

    const email = `${profilePhone}@mystore.internal`;
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    const authUser = users?.find((u) => u.email === email);
    if (authUser) {
      await admin.auth.admin.updateUserById(authUser.id, { password: newPassword });
    }

    return json({ success: true }, 200, req);
  } catch (e) {
    return json({ error: (e as Error).message }, 500, req);
  }
});
