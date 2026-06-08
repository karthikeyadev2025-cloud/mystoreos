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
    const { phone, newPassword, userId } = await req.json();
    if ((!phone && !userId) || !newPassword) return json({ error: 'phone or userId, and newPassword required' }, 400);
    if (newPassword.length < 4) return json({ error: 'Password too short' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let profileId: string;
    let profilePhone: string;

    if (userId) {
      const { data } = await admin.from('users').select('id, phone').eq('id', userId).single();
      if (!data) return json({ error: 'User not found' }, 404);
      profileId = data.id;
      profilePhone = data.phone;
    } else {
      const { data } = await admin.from('users').select('id, phone').eq('phone', phone).single();
      if (!data) return json({ error: 'Phone number not found. Please register first.' }, 404);
      profileId = data.id;
      profilePhone = data.phone;
    }

    // Update bcrypt hash in public.users
    await admin.from('users').update({ pass: await bcrypt.hash(newPassword, 10) }).eq('id', profileId);

    // Update auth.users password if user has been migrated
    const email = `${profilePhone}@mystore.internal`;
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    const authUser = users?.find((u) => u.email === email);
    if (authUser) {
      await admin.auth.admin.updateUserById(authUser.id, { password: newPassword });
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
