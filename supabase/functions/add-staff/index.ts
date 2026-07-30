import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { findAuthUserByEmail } from '../_shared/paginated-list-users.ts';

// ═══════════════════════════════════════════════════════════════════════
// add-staff — creates a staff account under a shop or distributor
//
// Changes from the previous version:
//   • CORS locked to specific origins (was '*'). Prevents third-party
//     sites embedding a page that forges add-staff requests from a
//     signed-in shop owner's session.
//   • Removed pass_verify: pin storage. Plaintext PIN was intentionally
//     kept so the owner could "share credentials" — nice UX, but combined
//     with the row-level anon-read on shop rows (which staff INHERIT via
//     users_select_staff_of_owner) it means every staff PIN was accessible
//     to anyone who could impersonate the owner even briefly. The bcrypt
//     hash is enough for authentication; the plaintext is dead weight
//     with real risk.
//   • Server-side plan cap enforcement. The client's hasCap('staff') check
//     is easily bypassed — anyone with a session token can hit this
//     edge function directly. The check here verifies the shop's plan
//     supports staff before creating one.
//   • findAuthUserByEmail paginates through pages instead of taking
//     only the first 1000 users.
// ═══════════════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = [
  'https://mystoreos.in',
  'https://localhost',        // Capacitor Android
  'capacitor://localhost',    // Capacitor iOS
  'http://localhost',
  'http://localhost:5173',
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
  new Response(JSON.stringify(data), {
    status, headers: { ...getCORS(req), 'Content-Type': 'application/json' },
  });

// Plan caps for staff — a shop's plan must allow staff accounts.
// Kept in sync with src/lib/features.js PLAN_CAPS.staff.
// Distributor tiers unchanged from client behaviour.
const STAFF_CAP: Record<string, number> = {
  trial: 3,
  starter: 0, service_starter: 0,
  pro: 5, service_pro: 5,
  enterprise: -1, service_enterprise: -1,       // -1 = unlimited
  basic_distributor: 0,
  pro_distributor: 3,
  enterprise_distributor: -1,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCORS(req) });

  try {
    const { shopId, phone, name, pin = '1234' } = await req.json();
    if (!shopId || !phone || !name) {
      return json({ error: 'shopId, phone and name are required' }, 400, req);
    }
    if (typeof pin !== 'string' || pin.length < 4) {
      return json({ error: 'PIN must be at least 4 characters' }, 400, req);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    const callerToken = authHeader.replace('Bearer ', '');
    if (!callerToken) return json({ error: 'Unauthorized' }, 401, req);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Resolve caller from JWT
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !caller) return json({ error: 'Unauthorized' }, 401, req);

    // Load caller's full profile including subscription state for plan-cap check
    let profile: any = null;
    {
      const { data } = await admin
        .from('users')
        .select('id, role, parent_shop_id, staff_of, subscription, subscription_tier, distributor_plan_tier, plan_expires_at, distributor_plan_expires_at')
        .eq('id', caller.id)
        .maybeSingle();
      profile = data;
    }

    // Legacy phone fallback (matches auth-login's flow)
    if (!profile) {
      const phone_from_email = caller.email?.replace('@mystore.internal', '') ?? '';
      const { data } = await admin
        .from('users')
        .select('id, role, parent_shop_id, staff_of, subscription, subscription_tier, distributor_plan_tier, plan_expires_at, distributor_plan_expires_at')
        .eq('phone', phone_from_email)
        .maybeSingle();
      profile = data;
    }

    if (!profile) return json({ error: 'Caller profile not found' }, 403, req);

    // ── Authorization ─────────────────────────────────────────────────
    const isAdmin = profile.role === 'admin';
    const isOwnShop = profile.role === 'shop' && profile.id === shopId;
    const isOwnDistributor = profile.role === 'distributor' && profile.id === shopId;

    let isOwnBranch = false;
    if (profile.role === 'shop' && profile.id !== shopId) {
      const { data: targetShop } = await admin
        .from('users').select('parent_shop_id').eq('id', shopId).maybeSingle();
      isOwnBranch = targetShop?.parent_shop_id === profile.id;
    }

    if (!isAdmin && !isOwnShop && !isOwnBranch && !isOwnDistributor) {
      return json({ error: 'You can only add staff to your own shop, branches, or distributor account' }, 403, req);
    }

    // ── Plan cap enforcement (server-side) ────────────────────────────
    // Admins bypass. Otherwise resolve the tier that governs staff caps.
    if (!isAdmin) {
      // Trial always grants max caps (matches client behaviour in features.js)
      let effectiveTier: string;
      if (profile.subscription === 'trial') {
        effectiveTier = 'trial';
      } else if (profile.role === 'distributor') {
        effectiveTier = profile.distributor_plan_tier || 'basic_distributor';
      } else {
        effectiveTier = profile.subscription_tier || 'starter';
      }

      const cap = STAFF_CAP[effectiveTier];
      if (cap === undefined) {
        console.warn('add-staff: unknown tier for cap check', { effectiveTier });
        // Fail-closed: unknown tier = no staff allowed
        return json({ error: 'Plan does not support staff accounts' }, 403, req);
      }

      // Count current staff for the target
      if (cap === 0) {
        return json({ error: 'Your plan does not include staff accounts. Upgrade to add staff.' }, 402, req);
      }
      if (cap > 0) {
        const { count: existingStaff } = await admin
          .from('users').select('id', { count: 'exact', head: true })
          .eq('staff_of', shopId).eq('role', 'staff');
        if ((existingStaff ?? 0) >= cap) {
          return json({
            error: `Your plan allows up to ${cap} staff account${cap === 1 ? '' : 's'}. Upgrade for more.`,
          }, 402, req);
        }
      }
    }

    // ── Uniqueness + auth user setup ──────────────────────────────────
    const { data: existing } = await admin.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existing) return json({ error: 'This phone number is already registered' }, 409, req);

    const email = `${phone}@mystore.internal`;
    const hashedPin = await bcrypt.hash(pin, 10);

    let uid: string;
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email, password: pin, email_confirm: true,
    });

    if (authErr) {
      // Auth user already exists — paginate through to find them.
      const existingAuth = await findAuthUserByEmail(admin, email);
      if (!existingAuth) return json({ error: `Auth setup failed: ${authErr.message}` }, 500, req);
      uid = existingAuth.id;
      await admin.auth.admin.updateUserById(uid, { password: pin });
    } else {
      uid = authUser.user!.id;
    }

    // ── Insert profile — NO pass_verify. bcrypt hash only. ────────────
    const { data: staffRow, error: insertErr } = await admin.from('users').insert({
      id: uid,
      phone,
      pass: hashedPin,
      role: 'staff',
      name,
      status: 'active',
      staff_of: shopId,
    }).select('id, phone, name, role, staff_of').maybeSingle();

    if (insertErr) {
      // Roll back the auth user if the profile insert fails, so the phone
      // remains reusable and we don't leave a dangling auth account.
      await admin.auth.admin.deleteUser(uid).catch(() => {});
      return json({ error: insertErr.message }, 500, req);
    }

    return json(staffRow ?? { id: uid, phone, name, role: 'staff', staff_of: shopId }, 200, req);

  } catch (e) {
    return json({ error: (e as Error).message }, 500, req);
  }
});
