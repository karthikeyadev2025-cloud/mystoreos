import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function rowToProfile(row: Record<string, unknown>) {
  return {
    id: row.id, phone: row.phone, role: row.role, name: row.name,
    status: row.status, subscription: row.subscription,
    upiId: row.upi_id, logo: row.logo, shopPhotos: row.shop_photos || [],
    paymentQr: row.payment_qr, avatar: row.avatar,
    staff_of: row.staff_of, latitude: row.latitude, longitude: row.longitude,
    gstin: row.gstin, stateCode: row.state_code, businessAddress: row.business_address,
    subscriptionTier: row.subscription_tier || 'starter',
    planExpiresAt: row.plan_expires_at || null,
    trialStartedAt: row.trial_started_at || null,
    createdAt: row.created_at || null,
    publicCode: row.public_code || null,
    merchantUpiId: row.merchant_upi_id || null,
    merchantCode: row.merchant_code || null,
    hideFromSearch: row.hide_from_search || false,
    shopCategory: row.shop_category || null,
    distributorPlanTier: row.distributor_plan_tier || 'basic_distributor',
    distributorPlanExpiresAt: row.distributor_plan_expires_at || null,
    distributorTrialStartedAt: row.distributor_trial_started_at || null,
    parentShopId: row.parent_shop_id || null,
    branchDeletedAt: row.branch_deleted_at || null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { phone, password } = await req.json();
    if (!phone || !password) return json({ error: 'phone and password required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Load profile by phone
    const { data: profile, error: profErr } = await admin
      .from('users').select('*').eq('phone', phone).single();
    if (profErr || !profile) return json({ error: 'Phone number not found. Please register first.' }, 401);
    if (profile.status === 'pending') return json({ error: 'Account pending admin approval' }, 403);

    // Verify password server-side
    const stored = profile.pass || '';
    const valid = (stored.startsWith('$2b$') || stored.startsWith('$2a$'))
      ? await bcrypt.compare(password, stored)
      : stored === password;
    if (!valid) return json({ error: 'Wrong password. Try again or use Forgot Password.' }, 401);

    const email = `${phone}@mystore.internal`;

    // Try sign-in (user may already exist in auth.users)
    const { data: signIn1, error: signIn1Err } = await anonClient.auth.signInWithPassword({ email, password });
    if (!signIn1Err && signIn1?.session) {
      // Upgrade plain-text password to bcrypt if needed
      if (!stored.startsWith('$2b$') && !stored.startsWith('$2a$')) {
        await admin.from('users').update({ pass: await bcrypt.hash(password, 10) }).eq('phone', phone);
      }
      return json({ session: signIn1.session, profile: rowToProfile(profile) });
    }

    // User not in auth.users — create with the SAME id as the profile
    // so auth.uid() === public.users.id and RLS policies resolve correctly.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      id: profile.id,
      email, password, email_confirm: true,
    });

    if (createErr) {
      // User already registered but with different password — find and update
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
      const existing = users?.find((u) => u.email === email);
      if (!existing) return json({ error: 'Auth setup failed. Please contact support.' }, 500);
      await admin.auth.admin.updateUserById(existing.id, { password });
    }

    const { data: signIn2, error: signIn2Err } = await anonClient.auth.signInWithPassword({ email, password });
    if (signIn2Err || !signIn2?.session) {
      return json({ error: 'Login failed after account setup. Please try again.' }, 500);
    }

    // Upgrade plain-text to bcrypt
    if (!stored.startsWith('$2b$') && !stored.startsWith('$2a$')) {
      await admin.from('users').update({ pass: await bcrypt.hash(password, 10) }).eq('phone', phone);
    }

    return json({ session: signIn2.session, profile: rowToProfile(profile) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
