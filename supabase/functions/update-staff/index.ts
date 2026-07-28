import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// The missing piece that forced a distributor to remove and re-add a
// staff member just to fix a typo'd phone number or a driver's new
// number — which also unlinks them from their assigned vehicle and
// warehouse in the process. Mirrors remove-staff's exact ownership
// verification: any caller (shop or distributor) who directly owns
// this staff row, or owns the branch it belongs to, may edit it.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { staffId, name, phone } = await req.json();
    if (!staffId) return json({ error: 'staffId required' }, 400);

    const trimmedName = (name || '').trim();
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    if (!trimmedName && !cleanPhone) {
      return json({ error: 'Provide a name or phone number to update' }, 400);
    }
    if (phone !== undefined && phone !== '' && cleanPhone.length !== 10) {
      return json({ error: 'Phone must be a valid 10-digit number' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller identity — identical to remove-staff.
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await admin.from('users')
      .select('id, role, parent_shop_id')
      .eq('id', caller.id)
      .maybeSingle();
    if (!callerProfile) return json({ error: 'Caller not found' }, 403);

    const { data: staffRow } = await admin.from('users')
      .select('id, role, staff_of, name, phone')
      .eq('id', staffId)
      .eq('role', 'staff')
      .maybeSingle();
    if (!staffRow) return json({ error: 'Staff not found' }, 404);

    const isAdmin = callerProfile.role === 'admin';
    const isDirectOwner = staffRow.staff_of === callerProfile.id;
    let isBranchOwner = false;
    if (!isDirectOwner && callerProfile.role === 'shop') {
      const { data: branch } = await admin.from('users')
        .select('parent_shop_id')
        .eq('id', staffRow.staff_of)
        .maybeSingle();
      isBranchOwner = branch?.parent_shop_id === callerProfile.id;
    }

    if (!isAdmin && !isDirectOwner && !isBranchOwner) {
      return json({ error: 'You can only edit staff from your own shop' }, 403);
    }

    // If changing the phone, it must not collide with a DIFFERENT
    // existing account — phone is the login identifier for every role.
    if (cleanPhone && cleanPhone !== staffRow.phone) {
      const { data: existing } = await admin.from('users')
        .select('id').eq('phone', cleanPhone).neq('id', staffId).maybeSingle();
      if (existing) return json({ error: 'That phone number is already in use by another account' }, 409);
    }

    const updates: Record<string, string> = {};
    if (trimmedName) updates.name = trimmedName;
    if (cleanPhone) updates.phone = cleanPhone;

    const { data: updated, error } = await admin.from('users')
      .update(updates).eq('id', staffId).select('id, name, phone').maybeSingle();
    if (error) return json({ error: error.message }, 500);

    return json({ success: true, staff: updated });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
