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

-- Tokenless HRMS/IDMS login provisions users through this RPC instead of a
-- direct client upsert, so an existing emp_id can be updated without requiring
-- a Supabase Auth JWT on the browser request.
CREATE OR REPLACE FUNCTION public.provision_hrms_user(
  p_emp_id TEXT,
  p_email TEXT,
  p_full_name TEXT,
  p_nickname TEXT,
  p_department TEXT,
  p_position TEXT,
  p_phone TEXT,
  p_employee_level TEXT,
  p_role_start_date DATE,
  p_company_code TEXT,
  p_company_name TEXT
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.users;
BEGIN
  INSERT INTO public.users (
    emp_id, email, full_name, nickname, department, position, phone,
    employee_level, role_start_date, company_code, company_name, status, updated_at
  ) VALUES (
    p_emp_id, p_email, p_full_name, p_nickname, p_department, p_position, p_phone,
    p_employee_level, p_role_start_date, p_company_code, p_company_name, 'Active', now()
  )
  ON CONFLICT (emp_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    nickname = EXCLUDED.nickname,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    phone = EXCLUDED.phone,
    employee_level = EXCLUDED.employee_level,
    role_start_date = EXCLUDED.role_start_date,
    company_code = EXCLUDED.company_code,
    company_name = EXCLUDED.company_name,
    status = 'Active',
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_hrms_user(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_hrms_user(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT) TO anon, authenticated;
