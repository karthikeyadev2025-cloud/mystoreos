// Supabase Edge Function: send-payment-reminders
//
// Auto payment reminders — explicitly promised on the Pro Distributor
// plan ("Auto payment reminders") but had zero implementation. Only
// manual Call/WhatsApp buttons existed in Route Planner before this —
// nothing automatic.
//
// Runs daily (matching expire-trials' schedule) — finds credits that
// are genuinely overdue (unpaid, older than 7 days), belong to a
// distributor on Pro or Enterprise tier (matching the pricing page's
// tier gate for this exact feature), and haven't been reminded in the
// last 7 days. Sends a real in-app/push notification to the shop via
// the same push_notification() pipeline every other notification in
// the app already uses — not a separate, one-off mechanism.
//
// Idempotency via credit_reminder_log, same proven pattern as
// send-booking-reminders — a daily cron run never re-reminds the same
// outstanding balance more than once every 7 days.
//
// Deploy: supabase functions deploy send-payment-reminders
// Schedule (Supabase Cron):
//   select cron.schedule('payment-reminders', '0 9 * * *',
//     $$ select net.http_post(
//         url := 'https://<project>.functions.supabase.co/send-payment-reminders',
//         headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')) $$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PRO_PLUS_TIERS = ['pro_distributor', 'enterprise_distributor'];

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  const expectedAuth = `Bearer ${Deno.env.get('CRON_SECRET')}`;
  if (authHeader !== expectedAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Overdue, unpaid credits older than 7 days
    const { data: overdueCredits, error: creditsErr } = await supabase
      .from('credits')
      .select('id, from_id, to_shop_id, amount, description, created_at')
      .eq('paid', false)
      .lt('created_at', sevenDaysAgo.toISOString());

    if (creditsErr) throw creditsErr;
    if (!overdueCredits || overdueCredits.length === 0) {
      return new Response(JSON.stringify({ ran_at: now.toISOString(), reminders_sent: 0, reason: 'no overdue credits' }), { status: 200 });
    }

    // Only distributors on Pro+ tier get this feature, matching the
    // pricing page's tier gate exactly.
    const distributorIds = [...new Set(overdueCredits.map(c => c.from_id))];
    const { data: distributors } = await supabase
      .from('users').select('id, distributor_plan_tier, subscription')
      .in('id', distributorIds).eq('role', 'distributor');
    const eligibleDistIds = new Set(
      (distributors || [])
        .filter(d => d.subscription === 'trial' || PRO_PLUS_TIERS.includes(d.distributor_plan_tier))
        .map(d => d.id)
    );

    // Already-paid-so-far amounts, so the reminder shows the real
    // outstanding balance, not the original full amount if a partial
    // payment has already come in.
    const creditIds = overdueCredits.map(c => c.id);
    const { data: payments } = await supabase.from('credit_payments').select('credit_id, amount').in('credit_id', creditIds);
    const paidMap: Record<string, number> = {};
    (payments || []).forEach(p => { paidMap[p.credit_id] = (paidMap[p.credit_id] || 0) + Number(p.amount); });

    // Which of these already got a reminder in the last 7 days
    const { data: recentReminders } = await supabase
      .from('credit_reminder_log').select('credit_id').in('credit_id', creditIds).gte('sent_at', sevenDaysAgo.toISOString());
    const recentlyRemindedIds = new Set((recentReminders || []).map(r => r.credit_id));

    let sent = 0;
    for (const credit of overdueCredits) {
      if (!eligibleDistIds.has(credit.from_id)) continue;
      if (recentlyRemindedIds.has(credit.id)) continue;
      const outstanding = Number(credit.amount) - (paidMap[credit.id] || 0);
      if (outstanding <= 0) continue; // fully paid via partial payments, just not flagged yet

      try {
        await supabase.rpc('push_notification', {
          p_user_id: credit.to_shop_id,
          p_category: 'credit',
          p_title: `Payment reminder: ₹${outstanding} outstanding`,
          p_body: `${credit.description || 'Stock supply credit'} — please settle at your earliest convenience.`,
          p_action_url: '/shop?tab=credit',
          p_data: {},
        });
        await supabase.from('credit_reminder_log').insert({ credit_id: credit.id });
        sent++;
      } catch (_e) {
        // One failed reminder should never block the rest of the run.
      }
    }

    return new Response(JSON.stringify({ ran_at: now.toISOString(), reminders_sent: sent, overdue_checked: overdueCredits.length }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
