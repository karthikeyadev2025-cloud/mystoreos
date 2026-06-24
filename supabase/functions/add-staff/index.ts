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
    const { shopId, phone, name, pin = '1234' } = await req.json();
    if (!shopId || !phone || !name) return json({ error: 'shopId, phone and name are required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is the actual shop owner by checking their JWT
    const authHeader = req.headers.get('Authorization') || '';
    const callerToken = authHeader.replace('Bearer ', '');
    if (!callerToken) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Resolve caller identity from their JWT
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !caller) return json({ error: 'Unauthorized' }, 401);

    // Look up caller's profile and confirm they own the shop
    const { data: callerProfile } = await admin.from('users').select('id, role, staff_of').eq('id', caller.id).maybeSingle()
      ?? await admin.from('users').select('id, role, staff_of').eq('phone', caller.email?.split('@')[0] ?? '').maybeSingle();

    if (!callerProfile) return json({ error: 'Caller profile not found' }, 403);

    // ownerId = who actually owns the shop being modified.
    // For a branch login: callerProfile.id IS the branch shop ID (branches
    // have role='shop' and a parent_shop_id set). They should be allowed
    // to add staff to their own branch (shopId === callerProfile.id).
    // For staff: staff_of is their shop, but staff can't add other staff.
    // For main owner: callerProfile.id === shopId directly.
    const isMainOwner = callerProfile.role === 'shop' && callerProfile.id === shopId;
    const isBranchOwner = callerProfile.role === 'shop' && callerProfile.id === shopId;
    const isAdmin = callerProfile.role === 'admin';

    // Also allow: main owner adding staff to a branch they own
    // (check parent_shop_id of the target shop matches caller)
    let isParentOwner = false;
    if (callerProfile.role === 'shop') {
      const { data: targetShop } = await admin.from('users').select('parent_shop_id').eq('id', shopId).maybeSingle();
      isParentOwner = targetShop?.parent_shop_id === callerProfile.id;
    }

    if (!isMainOwner && !isBranchOwner && !isParentOwner && !isAdmin) {
      return json({ error: 'You can only add staff to your own shop' }, 403);
    }

    // Check phone not already in use
    const { data: existing } = await admin.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existing) return json({ error: 'A user with this phone number already exists' }, 409);

    const email = `${phone}@mystore.internal`;
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create Supabase Auth user so staff can log in
    let uid: string;
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email, password: pin, email_confirm: true,
    });

    if (authErr) {
      // Auth user already exists — find and update password
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
      const existingAuth = users?.find((u) => u.email === email);
      if (!existingAuth) return json({ error: `Auth setup failed: ${authErr.message}` }, 500);
      uid = existingAuth.id;
      await admin.auth.admin.updateUserById(uid, { password: pin });
    } else {
      uid = authUser.user!.id;
    }

    // Insert staff profile with id = auth UUID so RLS resolves correctly on login
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
      // Rollback: remove auth user we just created
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
