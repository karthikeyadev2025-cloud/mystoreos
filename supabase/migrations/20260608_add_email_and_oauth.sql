-- ============================================================
-- Add real email support for Google OAuth + email password reset
--
-- Background: accounts authenticate with a synthetic email
-- {phone}@mystore.internal, which cannot receive mail and does not match
-- a Google account. To support (a) Supabase email password-reset links and
-- (b) "Login with Google", we store a REAL email on the profile and a flag
-- for the auth provider.
--
-- email is NULLABLE so existing phone-only accounts keep working unchanged.
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'phone';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- One profile per real email (partial unique index ignores NULLs so the many
-- phone-only accounts with email = NULL don't collide).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

-- current_profile_id() already resolves via id-match OR {phone}@mystore.internal.
-- Extend it so a Google login (whose auth email is the user's REAL email) also
-- resolves to the linked profile by matching users.email to the auth email.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.id = auth.uid()
     OR u.phone = split_part(
          (SELECT email FROM auth.users WHERE id = auth.uid()), '@', 1)
     OR lower(u.email) = lower(
          (SELECT email FROM auth.users WHERE id = auth.uid()))
  LIMIT 1
$$;

SELECT 'email + auth_provider columns added; current_profile_id() now matches real email too' AS status;
