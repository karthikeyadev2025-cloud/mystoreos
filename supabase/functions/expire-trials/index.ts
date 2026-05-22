// Supabase Edge Function: expire-trials
// Runs daily — expires 7-day trials and paid plans past grace period.
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

const TRIAL_DAYS = 7
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
  const trialCutoff = new Date(now.getTime() - TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const graceCutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000)

  // 1. Expire free trials older than TRIAL_DAYS
  const { data: expiredTrials, error: trialError } = await supabase
    .from('users')
    .update({ subscription: 'expired' })
    .eq('role', 'shop')
    .eq('subscription', 'trial')
    .lt('trial_started_at', trialCutoff.toISOString())
    .select('id, name, phone')

  // 2. Expire paid plans that have passed plan_expires_at + grace period.
  // Active premium subscriptions have subscription = 'active' and subscription_tier set to starter/pro/enterprise.
  const { data: expiredPaid, error: paidError } = await supabase
    .from('users')
    .update({ subscription: 'expired' })
    .eq('role', 'shop')
    .in('subscription', ['active', 'starter', 'pro', 'enterprise'])
    .not('plan_expires_at', 'is', null)
    .lt('plan_expires_at', graceCutoff.toISOString())
    .select('id, name, phone')

  const result = {
    ran_at: now.toISOString(),
    expired_trials: expiredTrials?.length ?? 0,
    expired_paid_plans: expiredPaid?.length ?? 0,
    errors: [
      trialError ? { stage: 'trials', message: trialError.message } : null,
      paidError ? { stage: 'paid', message: paidError.message } : null,
    ].filter(Boolean),
  }

  console.log('expire-trials result:', JSON.stringify(result))

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
