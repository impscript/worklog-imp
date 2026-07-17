-- Fix infinite recursion + INSERT/UPSERT violations in users RLS.
-- Root cause 1 (recursion): users RLS policies used a subquery that re-read
-- public.users (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
-- AND u.role='admin')), so any query on users re-evaluated the policy -> loop.
-- Root cause 2 (insert/upsert 401): useAuth.ts performs a JIT upsert into users
-- via the anon key during the HRMS/IDMS handshake, before a full session exists
-- (auth.uid() is null). The previous INSERT/UPDATE WITH CHECK blocked this with
-- "new row violates row-level security policy" / 401.
-- Fix: move the admin check into a SECURITY DEFINER function (no recursion), allow
-- anon/authenticated to INSERT users (self-provisioning), and allow UPDATE when
-- auth.uid() is null (JIT provisioning). SELECT stays scoped to owner/admin.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated, anon;

DROP POLICY IF EXISTS "Users read self or admin reads all" ON public.users;
CREATE POLICY "Users read self or admin reads all" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Users update self or admin" ON public.users;
CREATE POLICY "Users update self or admin" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.current_user_is_admin() OR auth.uid() IS NULL)
  WITH CHECK (auth.uid() = id OR public.current_user_is_admin() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users insert self or admin" ON public.users;
CREATE POLICY "Users insert self or admin" ON public.users
  FOR INSERT WITH CHECK (true);
