-- Secure worklog update/delete RPCs for actor provenance and tenant isolation.
CREATE OR REPLACE FUNCTION public.update_worklog_secure(
  p_worklog_id UUID,
  p_workspace_id UUID,
  p_patch JSONB
)
RETURNS public.col_worklog
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_security
AS $$
DECLARE actor_id UUID := app_security.current_internal_user_id(); result public.col_worklog;
BEGIN
  IF actor_id IS NULL OR NOT (app_security.current_user_is_admin() OR EXISTS (SELECT 1 FROM workspace_users wu WHERE wu.workspace_id=p_workspace_id AND wu.user_id=actor_id)) THEN
    RAISE EXCEPTION 'Actor is not authorized for this workspace' USING ERRCODE = '42501';
  END IF;
  UPDATE col_worklog SET
    work_date = COALESCE((p_patch->>'work_date')::date, work_date),
    start_time = COALESCE((p_patch->>'start_time')::time, start_time),
    end_time = COALESCE((p_patch->>'end_time')::time, end_time),
    break_time = COALESCE((p_patch->>'break_time')::boolean, break_time),
    total_hours = COALESCE((p_patch->>'total_hours')::numeric, total_hours),
    holding = COALESCE(p_patch->>'holding', holding),
    department_operator = COALESCE(p_patch->>'department_operator', department_operator),
    project_type = COALESCE(p_patch->>'project_type', project_type),
    project_name = COALESCE(p_patch->>'project_name', project_name),
    module = COALESCE(p_patch->>'module', module),
    bu = COALESCE(p_patch->>'bu', bu),
    department = COALESCE(p_patch->>'department', department),
    action_name = COALESCE(p_patch->>'action_name', action_name),
    action_channel = COALESCE(p_patch->>'action_channel', action_channel),
    description = COALESCE(p_patch->>'description', description),
    is_ot = COALESCE((p_patch->>'is_ot')::boolean, is_ot),
    is_implied_ot = COALESCE((p_patch->>'is_implied_ot')::boolean, is_implied_ot),
    image_urls = CASE WHEN p_patch ? 'image_urls' THEN ARRAY(SELECT jsonb_array_elements_text(p_patch->'image_urls')) ELSE image_urls END,
    updated_at = now(), updated_by = actor_id
  WHERE id=p_worklog_id AND workspace_id=p_workspace_id
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Worklog not found in workspace' USING ERRCODE = 'P0002'; END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_worklog_secure(p_worklog_id UUID, p_workspace_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_security
AS $$
DECLARE actor_id UUID := app_security.current_internal_user_id(); deleted_id UUID;
BEGIN
  IF actor_id IS NULL OR NOT (app_security.current_user_is_admin() OR EXISTS (SELECT 1 FROM workspace_users wu WHERE wu.workspace_id=p_workspace_id AND wu.user_id=actor_id)) THEN
    RAISE EXCEPTION 'Actor is not authorized for this workspace' USING ERRCODE = '42501';
  END IF;
  DELETE FROM col_worklog WHERE id=p_worklog_id AND workspace_id=p_workspace_id RETURNING id INTO deleted_id;
  IF deleted_id IS NULL THEN RAISE EXCEPTION 'Worklog not found in workspace' USING ERRCODE = 'P0002'; END IF;
  RETURN deleted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_worklog_secure(UUID,UUID,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_worklog_secure(UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_worklog_secure(UUID,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_worklog_secure(UUID,UUID) TO authenticated;
