import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
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

    let uid: string;
    // Create Supabase Auth user
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });

    if (authErr) {
      // If user already exists in Supabase Auth, let's find their ID and update password
      if (authErr.message.includes('already been registered') || authErr.status === 422 || authErr.message.includes('already exists')) {
        const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
        if (listErr) return json({ error: `Auth listing failed: ${listErr.message}` }, 500);

        const existingAuth = users?.find(u => u.email === email);
        if (!existingAuth) {
          return json({ error: 'Auth user conflict, please contact support.' }, 500);
        }

        uid = existingAuth.id;
        // Update password for the existing auth user to ensure it is synchronized
        const { error: updateErr } = await admin.auth.admin.updateUserById(uid, { password });
        if (updateErr) return json({ error: `Failed to update credentials: ${updateErr.message}` }, 500);
      } else {
        return json({ error: authErr.message }, 500);
      }
    } else {
      if (!authUser?.user) return json({ error: 'Auth user creation returned empty' }, 500);
      uid = authUser.user.id;
    }
    const requiresApproval = role === 'shop' || role === 'distributor';
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const subscription = role === 'shop' ? 'trial' : role === 'distributor' ? 'dist_trial' : 'active';
    const subscription_tier = role === 'shop' ? 'starter' : role === 'distributor' ? 'dist_basic' : null;
    const trial_started_at = requiresApproval ? new Date().toISOString() : null;
    const plan_expires_at = requiresApproval ? trialEnd : null;

    // Insert profile with id = auth UUID so RLS can use auth.uid() = id
    const { data: profileRow, error: insertErr } = await admin.from('users').insert({
      id: uid, phone,
      pass: await bcrypt.hash(password, 10),
      pass_verify: password,
      role, name,
      status: requiresApproval ? 'pending' : 'active',
      subscription, subscription_tier, trial_started_at, plan_expires_at,
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
      status: profileRow.status ?? (requiresApproval ? 'pending' : 'active'), subscription: profileRow.subscription,
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
