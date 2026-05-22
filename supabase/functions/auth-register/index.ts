import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { name, phone, password, role } = await req.json();
    if (!name || !phone || !password || !role) return json({ error: 'name, phone, password and role required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check phone uniqueness
    const { data: existing } = await admin.from('users').select('id').eq('phone', phone).single();
    if (existing) return json({ error: 'Phone already registered' }, 409);

    const email = `${phone}@mystore.internal`;

    // Create Supabase Auth user
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (authErr || !authUser?.user) return json({ error: authErr?.message || 'Auth user creation failed' }, 500);

    const uid = authUser.user.id;
    const subscription = role === 'shop' ? 'trial' : 'active';
    const subscription_tier = role === 'shop' ? 'starter' : null;
    const trial_started_at = role === 'shop' ? new Date().toISOString() : null;

    // Insert profile with id = auth UUID so RLS can use auth.uid() = id
    const { data: profileRow, error: insertErr } = await admin.from('users').insert({
      id: uid, phone,
      pass: await bcrypt.hash(password, 10),
      role, name, status: 'active',
      subscription, subscription_tier, trial_started_at,
    }).select().single();

    if (insertErr) {
      // Rollback auth user creation on profile insert failure
      await admin.auth.admin.deleteUser(uid);
      return json({ error: insertErr.message }, 500);
    }

    // Sign in to get session
    const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn?.session) return json({ error: 'Registration succeeded but login failed. Please sign in manually.' }, 500);

    const profile = {
      id: profileRow.id, phone: profileRow.phone, role: profileRow.role, name: profileRow.name,
      status: profileRow.status, subscription: profileRow.subscription,
      upiId: profileRow.upi_id, logo: profileRow.logo, shopPhotos: profileRow.shop_photos || [],
      paymentQr: profileRow.payment_qr, avatar: profileRow.avatar,
      staff_of: profileRow.staff_of, latitude: profileRow.latitude, longitude: profileRow.longitude,
      gstin: profileRow.gstin, stateCode: profileRow.state_code, businessAddress: profileRow.business_address,
      subscriptionTier: profileRow.subscription_tier || 'starter',
      planExpiresAt: profileRow.plan_expires_at || null,
      trialStartedAt: profileRow.trial_started_at || null,
      distributorPlanTier: profileRow.distributor_plan_tier || 'basic_distributor',
      distributorPlanExpiresAt: profileRow.distributor_plan_expires_at || null,
      distributorTrialStartedAt: profileRow.distributor_trial_started_at || null,
    };

    return json({ session: signIn.session, profile });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
