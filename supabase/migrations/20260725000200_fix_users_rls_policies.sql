-- Migration: Fix public.current_user_is_admin and public.users SELECT policy to use auth_user_id for correct RLS evaluation.
BEGIN;

-- 1. Fix public.current_user_is_admin() function definition
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'admin'
  );
$$;

-- 2. Drop and recreate the SELECT policy on public.users using auth_user_id
DROP POLICY IF EXISTS "Users read self or admin reads all" ON public.users;
CREATE POLICY "Users read self or admin reads all" ON public.users
  FOR SELECT USING (auth_user_id = auth.uid() OR app_security.current_user_is_admin());

COMMIT;
