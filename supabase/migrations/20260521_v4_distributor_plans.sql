-- Migration: add distributor subscription columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS distributor_plan_tier TEXT DEFAULT 'basic_distributor'
    CHECK (distributor_plan_tier IN ('basic_distributor', 'pro_distributor', 'enterprise_distributor')),
  ADD COLUMN IF NOT EXISTS distributor_plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS distributor_trial_started_at TIMESTAMPTZ;
