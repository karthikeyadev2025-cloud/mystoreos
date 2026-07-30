import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ═══════════════════════════════════════════════════════════════════════
// user-data-export — DPDP Act §11 (Right of Access)
//
// Authenticated call. Returns a JSON blob containing every piece of
// personal data the platform holds about the caller, as a downloadable
// attachment. Delegates the assembly to the export_my_data() SQL
// function so the same content can also be shown inline in the UI.
//
// Under DPDP Act, the platform must respond to a Right of Access
// request within a reasonable window (regulator-set, currently 30 days
// per the notified rules). Handing it as a self-service download means
// there's no operational burden per request.
// ═══════════════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = [
  'https://mystoreos.in',
  'https://localhost',
  'capacitor://localhost',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCORS(req) });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...getCORS(req), 'Content-Type': 'application/json' },
      });
    }

    // Use the ANON key with the user's JWT so the RPC runs with their
    // session context — export_my_data() uses current_profile_id() to
    // scope the data.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data, error } = await supabase.rpc('export_my_data');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...getCORS(req), 'Content-Type': 'application/json' },
      });
    }

    // Serve as a downloadable file so the user gets a real .json out
    // of the browser dialog instead of a wall of text.
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `mystoreos-my-data-${dateStr}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        ...getCORS(req),
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...getCORS(req), 'Content-Type': 'application/json' },
    });
  }
});
