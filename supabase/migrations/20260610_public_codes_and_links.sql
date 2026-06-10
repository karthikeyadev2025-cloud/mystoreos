-- ============================================================
-- Phase 2: mutual unique-ID linking between shops and distributors
--
-- Each shop and distributor gets a short, shareable public_code
-- (SHP-XXXXXX / DST-XXXXXX). A distributor can add a shop by the shop's code,
-- and a shop can add a distributor by the distributor's code. Links are stored
-- in shop_distributor_links (many-to-many).
-- ============================================================

-- 1) public_code on users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS public_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_public_code_unique
  ON public.users (public_code) WHERE public_code IS NOT NULL;

-- Generate a code helper: PREFIX-6 uppercase alphanumerics
CREATE OR REPLACE FUNCTION public.gen_public_code(prefix TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no confusing 0/O/1/I
  code TEXT;
  i INT;
  ok BOOLEAN;
BEGIN
  LOOP
    code := prefix || '-';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, (floor(random()*length(chars))+1)::int, 1);
    END LOOP;
    SELECT NOT EXISTS(SELECT 1 FROM public.users WHERE public_code = code) INTO ok;
    EXIT WHEN ok;
  END LOOP;
  RETURN code;
END;
$$;

-- Backfill existing shops & distributors
UPDATE public.users SET public_code = public.gen_public_code('SHP')
  WHERE role = 'shop' AND public_code IS NULL;
UPDATE public.users SET public_code = public.gen_public_code('DST')
  WHERE role = 'distributor' AND public_code IS NULL;

-- Auto-assign on insert for new shops/distributors
CREATE OR REPLACE FUNCTION public.assign_public_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_code IS NULL THEN
    IF NEW.role = 'shop' THEN NEW.public_code := public.gen_public_code('SHP');
    ELSIF NEW.role = 'distributor' THEN NEW.public_code := public.gen_public_code('DST');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_public_code ON public.users;
CREATE TRIGGER trg_assign_public_code BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code();

-- 2) link table (shop <-> distributor, either side can create)
CREATE TABLE IF NOT EXISTS public.shop_distributor_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, distributor_id)
);
ALTER TABLE public.shop_distributor_links ENABLE ROW LEVEL SECURITY;

-- Either party in the link (or admin) can read it
DROP POLICY IF EXISTS sdl_read ON public.shop_distributor_links;
CREATE POLICY sdl_read ON public.shop_distributor_links FOR SELECT USING (
  shop_id = public.current_profile_id()
  OR distributor_id = public.current_profile_id()
  OR public.current_user_role() = 'admin'
);
-- A shop or distributor can create a link where they are one of the parties
DROP POLICY IF EXISTS sdl_insert ON public.shop_distributor_links;
CREATE POLICY sdl_insert ON public.shop_distributor_links FOR INSERT WITH CHECK (
  shop_id = public.current_profile_id()
  OR distributor_id = public.current_profile_id()
  OR public.current_user_role() = 'admin'
);
-- Either party can remove the link
DROP POLICY IF EXISTS sdl_delete ON public.shop_distributor_links;
CREATE POLICY sdl_delete ON public.shop_distributor_links FOR DELETE USING (
  shop_id = public.current_profile_id()
  OR distributor_id = public.current_profile_id()
  OR public.current_user_role() = 'admin'
);

SELECT 'public_code + shop_distributor_links ready' AS status;
