// Supabase Edge Function: expire-trials
// Runs daily — expires trials (per plan_expires_at, set at signup) and
// paid plans past grace period.
//
// Deploy:  supabase functions deploy expire-trials
// Trigger: Supabase Cron — add in Dashboard > Database > Cron Jobs:
//   select cron.schedule('expire-trials', '0 2 * * *',
//     $$ select net.http_post(
//         url := 'https://<project>.functions.supabase.co/expire-trials',
//         headers := '{"Authorization": "Bearer <CRON_SECRET>"}') $$);
//
// Or trigger from GitHub Actions / Vercel Cron via HTTP POST with Authorization header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRACE_DAYS = 3  // paid plans get 3 days grace after plan_expires_at before lockout

Deno.serve(async (req: Request) => {
  // Validate cron secret to prevent unauthorized triggers
  const authHeader = req.headers.get('Authorization')
  const expectedAuth = `Bearer ${Deno.env.get('CRON_SECRET')}`
  if (authHeader !== expectedAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Use service role key — bypasses RLS so we can update any user row
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const now = new Date()
  const graceCutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000)

  // 1. Expire free trials past their actual plan_expires_at.
  //
  // Was .eq('role', 'shop') only — distributor trials use the exact
  // same plan_expires_at column and subscription='trial' value (both
  // set once at signup in auth-register, shared across roles), but
  // this query never matched a distributor row at all. Combined with
  // getDistCaps() previously having no trial branch (see
  // src/lib/features.js — fixed in the same pass as this), a
  // distributor's trial neither granted full access NOR ever actually
  // ended: subscription would stay 'trial' indefinitely, forever
  // eligible for whatever getDistCaps() decided a mid-trial distributor
  // should get. Fixed together, not separately — fixing only the caps
  // side would have left every distributor on permanent free full
  // access with no expiry at all.
  //
  // BUG FIX: this used to recompute a cutoff from a hardcoded
  // TRIAL_DAYS = 7 constant applied to trial_started_at — cutting every
  // trial short at 7 days, even though auth-register grants a 15-day
  // trial and writes the real expiry to plan_expires_at at signup time,
  // and both the landing page and pricing page promise 15 days. Using
  // plan_expires_at directly means there is exactly one place that
  // decides how long a trial lasts (auth-register, at signup) instead
  // of two that can silently drift out of sync with each other.
  // BUG FIX: this filtered on subscription = 'trial' only, but
  // auth-register assigns distributors subscription = 'dist_trial'
  // (shops get 'trial'). So distributor trials matched NOTHING here and
  // never expired — every distributor who ever signed up kept using the
  // product indefinitely without paying. The .in('role',...) above
  // already included 'distributor', which made the intent clear and the
  // omission easy to miss. Matching both values fixes it at the source.
  const { data: expiredTrials, error: trialError } = await supabase
    .from('users')
    .update({ subscription: 'expired' })
    .in('role', ['shop', 'distributor'])
    .in('subscription', ['trial', 'dist_trial'])
    .not('plan_expires_at', 'is', null)
    .lt('plan_expires_at', now.toISOString())
    .select('id, name, phone')

  // 2. Expire paid SHOP plans that have passed plan_expires_at + grace period.
  // Active premium subscriptions have subscription = 'active' and subscription_tier set to starter/pro/enterprise.
  const { data: expiredPaid, error: paidError } = await supabase
    .from('users')
    .update({ subscription: 'expired' })
    .eq('role', 'shop')
    .in('subscription', ['active', 'starter', 'pro', 'enterprise'])
    .not('plan_expires_at', 'is', null)
    .lt('plan_expires_at', graceCutoff.toISOString())
    .select('id, name, phone')

  // 3. Expire paid DISTRIBUTOR plans — was missing entirely. A paid
  // distributor's real expiry lives on a SEPARATE column
  // (distributor_plan_expires_at), set by razorpay-verify-payment's
  // distributor upgrade branch — that branch never touches
  // plan_expires_at at all, so checking plan_expires_at here (like the
  // shop query above) would have looked at a stale value frozen at
  // whatever the original trial's end date was, not the real paid-plan
  // expiry. Confirmed by reading the actual upgrade code before writing
  // this rather than assuming the same column applied.
  const { data: expiredPaidDist, error: paidDistError } = await supabase
    .from('users')
    .update({ subscription: 'expired' })
    .eq('role', 'distributor')
    .eq('subscription', 'active')
    .not('distributor_plan_expires_at', 'is', null)
    .lt('distributor_plan_expires_at', graceCutoff.toISOString())
    .select('id, name, phone')

  // "Trial ending soon" warning — didn't exist in any form before.
  // Every trial (shop or distributor) just silently expired with zero
  // warning beforehand — no standard SaaS practice of giving someone a
  // chance to convert before being cut off. Fires exactly once per
  // account: checks for trials landing in the [2-day, 3-day) window
  // from now, a narrow enough slice that a daily cron run only ever
  // catches a given account on one single day, without needing a
  // separate "already warned" tracking column.
  const warnFrom = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
  const warnTo = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const { data: trialsEndingSoon } = await supabase
    .from('users')
    .select('id, role')
    .in('role', ['shop', 'distributor'])
    .eq('subscription', 'trial')
    .not('plan_expires_at', 'is', null)
    .gte('plan_expires_at', warnFrom.toISOString())
    .lt('plan_expires_at', warnTo.toISOString())

  for (const u of trialsEndingSoon || []) {
    try {
      await supabase.rpc('push_notification', {
        p_user_id: u.id,
        p_category: 'info',
        p_title: 'Your free trial ends in 3 days',
        p_body: 'Choose a plan now to keep every feature active with no interruption.',
        p_action_url: u.role === 'distributor' ? '/distributor?tab=settings' : '/shop?tab=profile',
        p_data: {},
      })
    } catch (_e) { /* one account's notification failing should never block the rest */ }
  }

  const result = {
    ran_at: now.toISOString(),
    expired_trials: expiredTrials?.length ?? 0,
    expired_paid_plans: expiredPaid?.length ?? 0,
    expired_paid_distributor_plans: expiredPaidDist?.length ?? 0,
    trials_warned_ending_soon: trialsEndingSoon?.length ?? 0,
    errors: [
      trialError ? { stage: 'trials', message: trialError.message } : null,
      paidError ? { stage: 'paid', message: paidError.message } : null,
      paidDistError ? { stage: 'paid_distributor', message: paidDistError.message } : null,
    ].filter(Boolean),
  }

  console.log('expire-trials result:', JSON.stringify(result))

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
