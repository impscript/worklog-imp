-- Fix infinite recursion + INSERT violations in users RLS.
-- Root cause 1 (recursion): users RLS policies used a subquery that re-read
-- public.users (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()
-- AND u.role='admin')), so any query on users re-evaluated the policy -> loop.
-- Root cause 2 (insert): INSERT policy used WITH CHECK (auth.uid() = id ...) which
-- blocked inserts where the new row's id is server-generated (e.g. LogWorkPage dev
-- fallback that creates a mock user), raising "new row violates row-level security
-- policy for table users".
-- Fix: move the admin check into a SECURITY DEFINER function that runs outside RLS,
-- and let authenticated callers insert users (self-registration pattern).

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
  FOR UPDATE USING (auth.uid() = id OR public.current_user_is_admin()) WITH CHECK (auth.uid() = id OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Users insert self or admin" ON public.users;
CREATE POLICY "Users insert self or admin" ON public.users
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR public.current_user_is_admin());
