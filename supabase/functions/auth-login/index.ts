import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

// Allow all origins: web (mystoreos.in), Android (https://localhost),
// iOS (capacitor://localhost), and Capacitor custom schemes
const getAllowedOrigin = (req: Request): string => {
  const origin = req.headers.get('origin') || '';
  const allowed = [
    'https://mystoreos.in',
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
  ];
  if (allowed.some(o => origin.startsWith(o)) || origin === '') return origin || '*';
  return 'https://mystoreos.in';
};

const getCORS = (req: Request) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(req),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const json = (data: object, status = 200, req?: Request) =>
  new Response(JSON.stringify(data), { status, headers: { ...(req ? getCORS(req) : {'Access-Control-Allow-Origin': '*'}), 'Content-Type': 'application/json' } });

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
    // business_kind routes the shop to the Bookings-first service dashboard
    // vs POS-first retail. Omitting it here made EVERY service business land
    // on the retail POS at login (correct dashboard only appeared after a
    // manual page reload, when useAuth's DB refresh re-fetched the field).
    businessKind: row.business_kind || null,
    onboardingCompleted: row.onboarding_completed ?? null,
    distributorPlanTier: row.distributor_plan_tier || 'basic_distributor',
    distributorPlanExpiresAt: row.distributor_plan_expires_at || null,
    distributorTrialStartedAt: row.distributor_trial_started_at || null,
    homeServiceAddonExpiresAt: row.home_service_addon_expires_at || null,
    parentShopId: row.parent_shop_id || null,
    branchDeletedAt: row.branch_deleted_at || null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCORS(req) });

  try {
    const { phone, password } = await req.json();
    if (!phone || !password) return json({ error: 'phone and password required' }, 400, req);

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
    if (profErr || !profile) return json({ error: 'Phone number not found. Please register first.' }, 401, req);
    if (profile.status === 'pending') return json({ error: 'Account pending admin approval' }, 403, req);

    // Verify password server-side
    const stored = profile.pass || '';
    const valid = (stored.startsWith('$2b$') || stored.startsWith('$2a$'))
      ? await bcrypt.compare(password, stored)
      : stored === password;
    if (!valid) return json({ error: 'Wrong password. Try again or use Forgot Password.' }, 401);

    // ── Branch subscription inheritance ──────────────────────────────
    // If this is a branch (parent_shop_id set), look up the parent's
    // current subscription state and merge it into the branch profile.
    // This way: when the main owner upgrades to Pro, every branch
    // automatically gets Pro on their next login. The branch row in DB
    // doesn't change — we just override the profile object we return.
    let resolvedProfile = profile;
    if (profile.parent_shop_id) {
      const { data: parent } = await admin
        .from('users').select('subscription, subscription_tier, plan_expires_at, trial_started_at, trial_end_date')
        .eq('id', profile.parent_shop_id).maybeSingle();
      if (parent) {
        resolvedProfile = {
          ...profile,
          subscription: parent.subscription,
          subscription_tier: parent.subscription_tier,
          plan_expires_at: parent.plan_expires_at,
          trial_started_at: parent.trial_started_at,
          trial_end_date: parent.trial_end_date,
        };
      }
    }

    const email = `${phone}@mystore.internal`;

    // Try sign-in (user may already exist in auth.users)
    const { data: signIn1, error: signIn1Err } = await anonClient.auth.signInWithPassword({ email, password });
    if (!signIn1Err && signIn1?.session) {
      // Upgrade plain-text password to bcrypt if needed
      if (!stored.startsWith('$2b$') && !stored.startsWith('$2a$')) {
        await admin.from('users').update({ pass: await bcrypt.hash(password, 10) }).eq('phone', phone);
      }
      return json({ session: signIn1.session, profile: rowToProfile(resolvedProfile) });
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

    return json({ session: signIn2.session, profile: rowToProfile(resolvedProfile) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
