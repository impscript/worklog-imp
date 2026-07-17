-- Public share is intentionally unauthenticated, but must not expose the worklog table.
-- Return only the fields rendered by PublicWorklogPage for the requested opaque id.
CREATE OR REPLACE FUNCTION public.get_public_worklog(p_worklog_id UUID)
RETURNS TABLE (
  id UUID,
  work_date DATE,
  start_time TIME,
  end_time TIME,
  break_time BOOLEAN,
  total_hours NUMERIC,
  holding TEXT,
  department_operator TEXT,
  project_type TEXT,
  project_name TEXT,
  module TEXT,
  bu TEXT,
  department TEXT,
  action_name TEXT,
  action_channel TEXT,
  description TEXT,
  image_urls TEXT[],
  created_at TIMESTAMPTZ,
  is_ot BOOLEAN,
  is_implied_ot BOOLEAN,
  emp_id TEXT,
  full_name TEXT,
  nickname TEXT,
  employee_position TEXT,
  employee_department TEXT,
  employee_role TEXT,
  employee_level TEXT,
  phone TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id, w.work_date, w.start_time, w.end_time, w.break_time, w.total_hours,
    w.holding, w.department_operator, w.project_type, w.project_name, w.module,
    w.bu, w.department, w.action_name, w.action_channel, w.description,
    w.image_urls, w.created_at, w.is_ot, w.is_implied_ot,
    u.emp_id, u.full_name, u.nickname, u.position AS employee_position,
    u.department AS employee_department, u.role AS employee_role,
    u.employee_level, u.phone
  FROM public.col_worklog w
  JOIN public.users u ON u.id = w.user_id
  WHERE w.id = p_worklog_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_worklog(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_worklog(UUID) TO anon, authenticated;
