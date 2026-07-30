import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const ALLOWED_ORIGINS = [
  'https://mystoreos.in',
  'https://localhost',       // Capacitor Android (androidScheme: https)
  'capacitor://localhost',   // Capacitor iOS
  'http://localhost',        // local dev
  'http://localhost:5173',   // Vite dev server
];

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

import { findAuthUserByEmail } from '../_shared/paginated-list-users.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCORS(req) });

  try {
    const { name, phone, password, role } = await req.json();
    if (!name || !phone || !password || !role) return json({ error: 'name, phone, password and role required' }, 400, req);
    if (String(password).length < 6) return json({ error: 'Password must be at least 6 characters.' }, 400, req);

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
    if (existing) return json({ error: 'Phone already registered' }, 409, req);

    const email = `${phone}@mystore.internal`;

    let uid: string;
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });

    if (authErr) {
      if (authErr.message.includes('already been registered') || authErr.status === 422 || authErr.message.includes('already exists')) {
        const existingAuth = await findAuthUserByEmail(admin, email);
        if (!existingAuth) return json({ error: 'Auth user conflict, please contact support.' }, 500, req);
        uid = existingAuth.id;
        const { error: updateErr } = await admin.auth.admin.updateUserById(uid, { password });
        if (updateErr) return json({ error: `Failed to update credentials: ${updateErr.message}` }, 500, req);
      } else {
        return json({ error: authErr.message }, 500, req);
      }
    } else {
      if (!authUser?.user) return json({ error: 'Auth user creation returned empty' }, 500, req);
      uid = authUser.user.id;
    }

    const requiresApproval = role === 'shop' || role === 'distributor';
    const trialEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const subscription = role === 'shop' ? 'trial' : role === 'distributor' ? 'dist_trial' : 'active';
    // Was 'dist_basic' — a legacy naming inconsistency traced fully
    // before changing: distributor_plan_tier (the column that actually
    // determines capabilities and revenue calculations, via
    // getDistCaps()/isPaidDist() in api.js) is a SEPARATE column with
    // its own database DEFAULT of 'basic_distributor' and its own CHECK
    // constraint permitting only basic_distributor/pro_distributor/
    // enterprise_distributor — subscription_tier's value was never
    // actually read by anything capability- or revenue-related for a
    // distributor account, confirmed by tracing every consumer of both
    // columns. Standardizing to the same canonical naming purely for
    // consistency; functionally this was dead weight, not a live bug.
    const subscription_tier = role === 'shop' ? 'starter' : role === 'distributor' ? 'basic_distributor' : null;
    const trial_started_at = requiresApproval ? new Date().toISOString() : null;
    const plan_expires_at = requiresApproval ? trialEnd : null;

    const baseInsert: Record<string, unknown> = {
      id: uid, phone,
      pass: await bcrypt.hash(password, 10),
      // pass_verify (plaintext) intentionally dropped — P0 already
      // revoked anon/authenticated SELECT on this column, but writing
      // the plaintext at all was unnecessary risk with no consumer left
      // depending on it. bcrypt hash is sufficient for authentication.
      role, name,
      status: requiresApproval ? 'pending' : 'active',
      subscription, subscription_tier, trial_started_at, plan_expires_at,
      onboarding_completed: !requiresApproval,
    };

    let profileRow: any = null;
    let insertErr: any = null;
    {
      const attempt = { ...baseInsert };
      let res = await admin.from('users').insert(attempt).select().single();
      if (res.error && /find the ['""]?onboarding_completed['""]? column/i.test(res.error.message || '')) {
        delete (attempt as any).onboarding_completed;
        res = await admin.from('users').insert(attempt).select().single();
      }
      profileRow = res.data;
      insertErr = res.error;
    }

    if (insertErr) {
      await admin.auth.admin.deleteUser(uid);
      return json({ error: insertErr.message }, 500, req);
    }

    // Welcome notification — didn't exist at all before. Fires through
    // the same push_notification() → notifications table → push-fanout
    // pipeline every other notification in the app already uses, so it
    // reaches the new user in-app immediately and via background push
    // once they've enabled it, same as any other alert.
    try {
      const welcomeCopy: Record<string, { title: string; body: string }> = {
        shop: {
          title: `Welcome to MyStore OS, ${name || 'there'}! 👋`,
          body: 'Your 15-day trial is live with every feature unlocked. Add your first products or services to get started.',
        },
        distributor: {
          title: `Welcome to MyStore OS, ${name || 'there'}! 👋`,
          body: 'Your 15-day trial is live with every feature unlocked. Share your distributor code with shops to start receiving stock orders.',
        },
        customer: {
          title: `Welcome, ${name || 'there'}! 👋`,
          body: 'Browse shops near you, place orders, and book services — all in one place.',
        },
      };
      const copy = welcomeCopy[role] || welcomeCopy.customer;
      await admin.rpc('push_notification', {
        p_user_id: profileRow.id,
        p_category: 'welcome',
        p_title: copy.title,
        p_body: copy.body,
        p_action_url: null,
        p_data: {},
      });
    } catch (_e) {
      // A welcome message failing to send should never block a real
      // registration — this is best-effort, not a critical step.
    }

    const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn?.session) return json({ error: 'Registration succeeded but login failed. Please sign in manually.' }, 500, req);

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

    return json({ session: signIn.session, profile }, 200, req);
  } catch (e) {
    return json({ error: (e as Error).message }, 500, req);
  }
});
