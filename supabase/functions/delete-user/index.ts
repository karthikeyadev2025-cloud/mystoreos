import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { userId } = await req.json();
    if (!userId) return json({ error: 'userId required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the CALLER's JWT using the service client (anon key is deprecated
    // in this project, so we pass the bearer token straight to getUser()).
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Not authenticated (no token)' }, 401);
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller) return json({ error: 'Not authenticated', detail: callerErr?.message }, 401);

    // Confirm caller's profile role is admin. Primary: id == auth uid.
    // Fallbacks: match by {phone}@mystore.internal email -> users.phone.
    let callerRole: string | null = null;
    const { data: byId } = await admin
      .from('users').select('role').eq('id', caller.id).maybeSingle();
    callerRole = byId?.role ?? null;

    if (callerRole !== 'admin' && caller.email) {
      const phone = caller.email.replace('@mystore.internal', '');
      const { data: byPhone } = await admin
        .from('users').select('role').eq('phone', phone).maybeSingle();
      callerRole = byPhone?.role ?? callerRole;
    }

    if (callerRole !== 'admin') {
      return json({ error: 'Only admins can delete users', detail: { callerId: caller.id, callerEmail: caller.email, foundRole: callerRole } }, 403);
    }

    // Look up the target so we can delete the matching auth user too.
    const { data: target } = await admin
      .from('users').select('id, phone').eq('id', userId).maybeSingle();

    // 1) delete the profile row
    const { error: delProfileErr } = await admin.from('users').delete().eq('id', userId);
    if (delProfileErr) return json({ error: `Profile delete failed: ${delProfileErr.message}` }, 500);

    // 2) delete the matching Supabase Auth user so the phone can be reused.
    //    The auth user's id equals the profile id (we insert id = uid on register),
    //    but fall back to email lookup ({phone}@mystore.internal) just in case.
    let authDeleted = false;
    try {
      const { error: e1 } = await admin.auth.admin.deleteUser(userId);
      if (!e1) authDeleted = true;
    } catch (_e) { /* try fallback below */ }

    if (!authDeleted && target?.phone) {
      const email = `${target.phone}@mystore.internal`;
      const { data: list } = await admin.auth.admin.listUsers();
      const match = list?.users?.find((u) => u.email === email);
      if (match) {
        await admin.auth.admin.deleteUser(match.id).catch(() => {});
      }
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 500);
  }
});
