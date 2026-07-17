-- Add immutable actor provenance without changing existing worklog identity or FKs.
ALTER TABLE public.col_worklog ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.col_worklog ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_col_worklog_workspace_user_date ON public.col_worklog(workspace_id, user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_col_worklog_created_by ON public.col_worklog(created_by);

CREATE OR REPLACE FUNCTION public.create_worklog_secure(
  p_workspace_id UUID,
  p_target_user_id UUID,
  p_payload JSONB
)
RETURNS public.col_worklog
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_security
AS $$
DECLARE
  actor_id UUID := app_security.current_internal_user_id();
  result public.col_worklog;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated identity is required' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    app_security.current_user_is_admin()
    OR EXISTS (SELECT 1 FROM workspace_users wu WHERE wu.workspace_id = p_workspace_id AND wu.user_id = actor_id)
  ) THEN
    RAISE EXCEPTION 'Actor is not a member of this workspace' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    app_security.current_user_is_admin()
    OR EXISTS (SELECT 1 FROM workspace_users wu WHERE wu.workspace_id = p_workspace_id AND wu.user_id = p_target_user_id)
  ) THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace' USING ERRCODE = '42501';
  END IF;

  INSERT INTO col_worklog (
    user_id, workspace_id, work_date, start_time, end_time, break_time, total_hours,
    holding, department_operator, project_type, project_name, module, bu, department,
    action_name, action_channel, description, channel, is_ot, is_implied_ot,
    image_urls, project_id, module_id, created_by, updated_by
  ) VALUES (
    p_target_user_id,
    p_workspace_id,
    (p_payload->>'work_date')::date,
    (p_payload->>'start_time')::time,
    (p_payload->>'end_time')::time,
    COALESCE((p_payload->>'break_time')::boolean, false),
    (p_payload->>'total_hours')::numeric,
    p_payload->>'holding', p_payload->>'department_operator', p_payload->>'project_type',
    p_payload->>'project_name', p_payload->>'module', p_payload->>'bu', p_payload->>'department',
    p_payload->>'action_name', p_payload->>'action_channel', p_payload->>'description',
    COALESCE(p_payload->>'channel', 'Web App'),
    COALESCE((p_payload->>'is_ot')::boolean, false),
    COALESCE((p_payload->>'is_implied_ot')::boolean, false),
    CASE WHEN p_payload ? 'image_urls' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'image_urls')) ELSE NULL END,
    (p_payload->>'project_id')::uuid,
    (p_payload->>'module_id')::uuid,
    actor_id,
    actor_id
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_worklog_secure(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_worklog_secure(UUID, UUID, JSONB) TO authenticated;
