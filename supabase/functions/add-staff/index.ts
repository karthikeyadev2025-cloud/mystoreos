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
    const { shopId, phone, name, pin = '1234' } = await req.json();
    if (!shopId || !phone || !name) return json({ error: 'shopId, phone and name are required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    const callerToken = authHeader.replace('Bearer ', '');
    if (!callerToken) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Resolve caller from JWT
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !caller) return json({ error: 'Unauthorized' }, 401);

    // Fetch full caller profile — need id, role, parent_shop_id, staff_of
    const { data: callerProfile, error: profileErr } = await admin
      .from('users')
      .select('id, role, parent_shop_id, staff_of')
      .eq('id', caller.id)
      .maybeSingle();

    // Fallback: look up by phone (for legacy auth flow)
    let profile = callerProfile;
    if (!profile) {
      const phone_from_email = caller.email?.replace('@mystore.internal', '') ?? '';
      const { data: fallback } = await admin
        .from('users')
        .select('id, role, parent_shop_id, staff_of')
        .eq('phone', phone_from_email)
        .maybeSingle();
      profile = fallback;
    }

    if (!profile) return json({ error: 'Caller profile not found' }, 403);

    // Authorization logic:
    // 1. Admin role — always allowed
    // 2. Main owner (role=shop, no parent_shop_id) adding staff to their own shop
    // 3. Branch owner (role=shop, has parent_shop_id) adding staff to their own branch
    // 4. Main owner adding staff to one of their branches (shopId's parent_shop_id = caller.id)
    const isAdmin = profile.role === 'admin';
    const isOwnShop = profile.role === 'shop' && profile.id === shopId;

    // Check if shopId is a branch owned by this caller
    let isOwnBranch = false;
    if (profile.role === 'shop' && profile.id !== shopId) {
      const { data: targetShop } = await admin
        .from('users')
        .select('parent_shop_id')
        .eq('id', shopId)
        .maybeSingle();
      isOwnBranch = targetShop?.parent_shop_id === profile.id;
    }

    if (!isAdmin && !isOwnShop && !isOwnBranch) {
      return json({ error: 'You can only add staff to your own shop or branches' }, 403);
    }

    // Check phone not already in use
    const { data: existing } = await admin.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existing) return json({ error: 'This phone number is already registered' }, 409);

    const email = `${phone}@mystore.internal`;
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create Supabase Auth user
    let uid: string;
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email, password: pin, email_confirm: true,
    });

    if (authErr) {
      // Auth user might already exist — find and reuse
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
      const existingAuth = users?.find((u) => u.email === email);
      if (!existingAuth) return json({ error: `Auth setup failed: ${authErr.message}` }, 500);
      uid = existingAuth.id;
      await admin.auth.admin.updateUserById(uid, { password: pin });
    } else {
      uid = authUser.user!.id;
    }

    // Insert staff profile
    const { data: staffRow, error: insertErr } = await admin.from('users').insert({
      id: uid,
      phone,
      pass: hashedPin,
      pass_verify: pin,
      role: 'staff',
      name,
      status: 'active',
      staff_of: shopId,
    }).select().maybeSingle();

    if (insertErr) {
      await admin.auth.admin.deleteUser(uid);
      return json({ error: insertErr.message }, 500);
    }

    return json({
      id: staffRow.id,
      phone: staffRow.phone,
      name: staffRow.name,
      role: staffRow.role,
      staff_of: staffRow.staff_of,
    });

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
