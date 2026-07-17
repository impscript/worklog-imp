-- Non-destructive bridge from the existing internal user identity to Supabase Auth.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

CREATE SCHEMA IF NOT EXISTS app_security;

CREATE OR REPLACE FUNCTION app_security.current_internal_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_security
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app_security.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_security
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.role = 'admin'
  );
$$;

REVOKE ALL ON SCHEMA app_security FROM PUBLIC;
GRANT USAGE ON SCHEMA app_security TO anon, authenticated;
REVOKE ALL ON FUNCTION app_security.current_internal_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_security.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_security.current_internal_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_security.current_user_is_admin() TO anon, authenticated;
