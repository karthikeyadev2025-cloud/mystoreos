import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ═══════════════════════════════════════════════════════════════════════
// support-chat — Gemini-backed AI support assistant
//
// Changes from the previous version:
//   • REQUIRES a Supabase session token. Was unauthenticated. Any anon
//     could burn the Gemini quota in a tight loop.
//   • Rate limited via public.check_rate_limit() — 15 messages per hour
//     per user by default, plus a fallback IP-based limit (30/hour) for
//     the edge case of a session token that resolves to no user.
//   • Message length capped at 4000 chars per turn (was already there),
//     conversation length capped at 20 turns to bound the Gemini call.
// ═══════════════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SYSTEM = `You are the MyStore OS support assistant. MyStore OS is a retail billing + ERP SaaS for Indian kirana shops, distributors, and CAs. Be concise, friendly, and practical. Help with: billing/POS, inventory, subscription plans (monthly/quarterly/yearly), payments (UPI/scanner), distributor & CA linking, and account issues. If a question needs human help (refunds, account changes, bugs you can't solve), tell the user to raise a support ticket from this screen and a human will respond. Never invent prices — say the current price is shown on the Plans screen. Keep answers short.`;

// Rate-limit budget — tuned so a real support conversation (5-10 turns
// over ~20 minutes) doesn't get throttled but a scripted attacker
// spending 100 turns per minute does.
const PER_USER_LIMIT = 15;
const PER_USER_WINDOW_SEC = 3600;   // 15 messages / hour
const PER_IP_LIMIT = 30;
const PER_IP_WINDOW_SEC = 3600;     // 30 messages / hour from one IP

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ reply: 'Support chat is not configured yet. Please raise a ticket and our team will help.' });

    // ── Require a session ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please log in to use support chat.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json({ error: 'Session expired — please log in again.' }, 401);

    // ── Rate limit: per user first, per IP as a safety net ────────────
    const userIdentifier = `support-chat:user:${user.id}`;
    const { data: userAllowed, error: rateErr } = await supabase.rpc('check_rate_limit', {
      p_bucket: 'support-chat',
      p_identifier: userIdentifier,
      p_limit: PER_USER_LIMIT,
      p_window_sec: PER_USER_WINDOW_SEC,
    });

    if (!rateErr && userAllowed === false) {
      return json({
        reply: `You've reached the support chat limit for this hour. Please raise a support ticket instead — a human will get back to you.`,
      }, 429);
    }

    // Per-IP as backup (in case one user shares a token across many devices
    // or the user check somehow no-ops)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('cf-connecting-ip')
            || 'unknown';
    if (ip !== 'unknown') {
      const { data: ipAllowed } = await supabase.rpc('check_rate_limit', {
        p_bucket: 'support-chat',
        p_identifier: `support-chat:ip:${ip}`,
        p_limit: PER_IP_LIMIT,
        p_window_sec: PER_IP_WINDOW_SEC,
      });
      if (ipAllowed === false) {
        return json({
          reply: 'Support chat rate limit reached. Please raise a ticket for detailed help.',
        }, 429);
      }
    }

    // ── Gemini call ────────────────────────────────────────────────────
    const { messages } = await req.json();
    const history = Array.isArray(messages) ? messages.slice(-20) : []; // cap conversation
    const contents = history
      .filter((m: any) => m?.body)
      .map((m: any) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: String(m.body).slice(0, 4000) }],
      }));
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (contents.length === 0) return json({ reply: 'Ask me anything about billing, plans, payments, or your account!' });

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
        }),
      },
    );
    const data = await resp.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) return json({ reply });

    console.error('support-chat no candidate:', JSON.stringify(data).slice(0, 600));
    return json({ reply: "Sorry, I couldn't process that. Please raise a ticket and our team will help." });
  } catch (_e) {
    return json({ reply: 'Something went wrong. Please raise a support ticket and our team will help.' });
  }
});
