import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { staffId } = await req.json();
    if (!staffId) return json({ error: 'staffId required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller identity
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    // Fetch caller profile
    const { data: callerProfile } = await admin.from('users')
      .select('id, role, parent_shop_id')
      .eq('id', caller.id)
      .maybeSingle();
    if (!callerProfile) return json({ error: 'Caller not found' }, 403);

    // Fetch staff row to verify ownership
    const { data: staffRow } = await admin.from('users')
      .select('id, role, staff_of, name')
      .eq('id', staffId)
      .eq('role', 'staff')
      .maybeSingle();
    if (!staffRow) return json({ error: 'Staff not found' }, 404);

    // Verify caller owns this staff member
    const isAdmin = callerProfile.role === 'admin';
    const isDirectOwner = staffRow.staff_of === callerProfile.id;
    // Check if staff belongs to a branch owned by caller
    let isBranchOwner = false;
    if (!isDirectOwner && callerProfile.role === 'shop') {
      const { data: branch } = await admin.from('users')
        .select('parent_shop_id')
        .eq('id', staffRow.staff_of)
        .maybeSingle();
      isBranchOwner = branch?.parent_shop_id === callerProfile.id;
    }

    if (!isAdmin && !isDirectOwner && !isBranchOwner) {
      return json({ error: 'You can only remove staff from your own shop' }, 403);
    }

    // Delete from auth + users table
    await admin.from('users').delete().eq('id', staffId);
    await admin.auth.admin.deleteUser(staffId);

    return json({ success: true, removed: staffRow.name });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
