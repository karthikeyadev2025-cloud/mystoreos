import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': 'https://mystoreos.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SYSTEM = `You are the MyStore OS support assistant. MyStore OS is a retail billing + ERP SaaS for Indian kirana shops, distributors, and CAs. Be concise, friendly, and practical. Help with: billing/POS, inventory, subscription plans (monthly/quarterly/yearly), payments (UPI/scanner), distributor & CA linking, and account issues. If a question needs human help (refunds, account changes, bugs you can't solve), tell the user to raise a support ticket from this screen and a human will respond. Never invent prices — say the current price is shown on the Plans screen. Keep answers short.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ reply: 'Support chat is not configured yet. Please raise a ticket and our team will help.' });

    const { messages } = await req.json();
    const history = Array.isArray(messages) ? messages : [];
    // Map our {sender, body} to Gemini contents
    const contents = history
      .filter((m: any) => m?.body)
      .map((m: any) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: String(m.body).slice(0, 4000) }],
      }));
    // Gemini requires the conversation to START with a 'user' turn. Our chat
    // opens with a bot greeting (role 'model'), so drop any leading non-user
    // turns or the API rejects the request and returns no candidates.
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
    // No candidate returned — log server-side but show the customer a
    // clean message. Earlier this surfaced the raw API error to the
    // user as a diagnostic; that's now removed so customers don't see
    // internal error details.
    console.error('support-chat no candidate:', JSON.stringify(data).slice(0, 600));
    return json({ reply: "Sorry, I couldn't process that. Please raise a ticket and our team will help." });
  } catch (e) {
    return json({ reply: 'Something went wrong. Please raise a support ticket and our team will help.' });
  }
});
