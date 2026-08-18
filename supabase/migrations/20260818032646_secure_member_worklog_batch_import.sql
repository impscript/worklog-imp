-- Open the CSV migration workflow to authenticated workspace members while
-- keeping every write scoped to the target user and workspace.

BEGIN;

CREATE OR REPLACE FUNCTION app_security.can_write_worklog(
  target_workspace_id UUID,
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
  SELECT
    app_security.current_internal_user_id() IS NOT NULL
    AND target_workspace_id IS NOT NULL
    AND target_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspace_users AS target_membership
      WHERE target_membership.workspace_id = target_workspace_id
        AND target_membership.user_id = target_user_id
    )
    AND (
      app_security.current_internal_user_id() = target_user_id
      OR app_security.is_workspace_admin_or_manager(target_workspace_id)
      OR app_security.current_user_is_admin()
    );
$$;

REVOKE ALL ON FUNCTION app_security.can_write_worklog(UUID, UUID) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_security TO authenticated;
GRANT EXECUTE ON FUNCTION app_security.can_write_worklog(UUID, UUID) TO authenticated;

ALTER TABLE public.col_worklog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own worklogs" ON public.col_worklog;
DROP POLICY IF EXISTS "Members manage own worklogs" ON public.col_worklog;
DROP POLICY IF EXISTS "Authenticated members insert permitted worklogs" ON public.col_worklog;
DROP POLICY IF EXISTS "Authenticated members update permitted worklogs" ON public.col_worklog;
DROP POLICY IF EXISTS "Authenticated members delete permitted worklogs" ON public.col_worklog;

CREATE POLICY "Members read workspace worklogs"
ON public.col_worklog FOR SELECT TO authenticated
USING (
  app_security.is_workspace_member(workspace_id)
  OR app_security.has_workspace_grant(workspace_id)
  OR app_security.current_user_is_admin()
);

CREATE POLICY "Authenticated members insert permitted worklogs"
ON public.col_worklog FOR INSERT TO authenticated
WITH CHECK (app_security.can_write_worklog(workspace_id, user_id));

CREATE POLICY "Authenticated members update permitted worklogs"
ON public.col_worklog FOR UPDATE TO authenticated
USING (app_security.can_write_worklog(workspace_id, user_id))
WITH CHECK (app_security.can_write_worklog(workspace_id, user_id));

CREATE POLICY "Authenticated members delete permitted worklogs"
ON public.col_worklog FOR DELETE TO authenticated
USING (app_security.can_write_worklog(workspace_id, user_id));

REVOKE ALL ON TABLE public.col_worklog FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.col_worklog TO authenticated;

-- Keep the existing single-row workflow aligned with the same ownership rule.
CREATE OR REPLACE FUNCTION public.create_worklog_secure(
  p_workspace_id UUID,
  p_target_user_id UUID,
  p_payload JSONB
)
RETURNS public.col_worklog
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, app_security
AS $$
DECLARE
  actor_id UUID := app_security.current_internal_user_id();
  result public.col_worklog;
BEGIN
  IF NOT app_security.can_write_worklog(p_workspace_id, p_target_user_id) THEN
    RAISE EXCEPTION 'Actor is not allowed to create worklogs for this user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.col_worklog (
    user_id, workspace_id, work_date, start_time, end_time, break_time, total_hours,
    holding, department_operator, project_type, project_name, module, bu, department,
    action_name, action_channel, description, channel, is_ot, is_implied_ot,
    image_urls, project_id, module_id, created_by, updated_by
  ) VALUES (
    p_target_user_id,
    p_workspace_id,
    (p_payload ->> 'work_date')::DATE,
    (p_payload ->> 'start_time')::TIME,
    (p_payload ->> 'end_time')::TIME,
    COALESCE((p_payload ->> 'break_time')::BOOLEAN, FALSE),
    (p_payload ->> 'total_hours')::NUMERIC,
    p_payload ->> 'holding',
    p_payload ->> 'department_operator',
    p_payload ->> 'project_type',
    p_payload ->> 'project_name',
    NULLIF(p_payload ->> 'module', ''),
    p_payload ->> 'bu',
    p_payload ->> 'department',
    p_payload ->> 'action_name',
    NULLIF(p_payload ->> 'action_channel', ''),
    NULLIF(p_payload ->> 'description', ''),
    COALESCE(NULLIF(p_payload ->> 'channel', ''), 'Web App'),
    COALESCE((p_payload ->> 'is_ot')::BOOLEAN, FALSE),
    COALESCE((p_payload ->> 'is_implied_ot')::BOOLEAN, FALSE),
    CASE
      WHEN p_payload ? 'image_urls'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_payload -> 'image_urls'))
      ELSE ARRAY[]::TEXT[]
    END,
    NULLIF(p_payload ->> 'project_id', '')::UUID,
    NULLIF(p_payload ->> 'module_id', '')::UUID,
    actor_id,
    actor_id
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_worklog_secure(
  p_worklog_id UUID,
  p_workspace_id UUID,
  p_patch JSONB
)
RETURNS public.col_worklog
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, app_security
AS $$
DECLARE
  actor_id UUID := app_security.current_internal_user_id();
  target_user_id UUID;
  result public.col_worklog;
BEGIN
  SELECT worklog.user_id
  INTO target_user_id
  FROM public.col_worklog AS worklog
  WHERE worklog.id = p_worklog_id
    AND worklog.workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worklog not found in workspace' USING ERRCODE = 'P0002';
  END IF;

  IF NOT app_security.can_write_worklog(p_workspace_id, target_user_id) THEN
    RAISE EXCEPTION 'Actor is not allowed to update this worklog'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.col_worklog
  SET work_date = COALESCE((p_patch ->> 'work_date')::DATE, work_date),
      start_time = COALESCE((p_patch ->> 'start_time')::TIME, start_time),
      end_time = COALESCE((p_patch ->> 'end_time')::TIME, end_time),
      break_time = COALESCE((p_patch ->> 'break_time')::BOOLEAN, break_time),
      total_hours = COALESCE((p_patch ->> 'total_hours')::NUMERIC, total_hours),
      holding = COALESCE(p_patch ->> 'holding', holding),
      department_operator = COALESCE(p_patch ->> 'department_operator', department_operator),
      project_type = COALESCE(p_patch ->> 'project_type', project_type),
      project_name = COALESCE(p_patch ->> 'project_name', project_name),
      module = CASE WHEN p_patch ? 'module' THEN NULLIF(p_patch ->> 'module', '') ELSE module END,
      bu = COALESCE(p_patch ->> 'bu', bu),
      department = COALESCE(p_patch ->> 'department', department),
      action_name = COALESCE(p_patch ->> 'action_name', action_name),
      action_channel = CASE
        WHEN p_patch ? 'action_channel' THEN NULLIF(p_patch ->> 'action_channel', '')
        ELSE action_channel
      END,
      description = CASE
        WHEN p_patch ? 'description' THEN NULLIF(p_patch ->> 'description', '')
        ELSE description
      END,
      is_ot = COALESCE((p_patch ->> 'is_ot')::BOOLEAN, is_ot),
      is_implied_ot = COALESCE((p_patch ->> 'is_implied_ot')::BOOLEAN, is_implied_ot),
      image_urls = CASE
        WHEN p_patch ? 'image_urls'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_patch -> 'image_urls'))
        ELSE image_urls
      END,
      updated_at = now(),
      updated_by = actor_id
  WHERE id = p_worklog_id
    AND workspace_id = p_workspace_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_worklog_secure(
  p_worklog_id UUID,
  p_workspace_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, app_security
AS $$
DECLARE
  target_user_id UUID;
  deleted_id UUID;
BEGIN
  SELECT worklog.user_id
  INTO target_user_id
  FROM public.col_worklog AS worklog
  WHERE worklog.id = p_worklog_id
    AND worklog.workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worklog not found in workspace' USING ERRCODE = 'P0002';
  END IF;

  IF NOT app_security.can_write_worklog(p_workspace_id, target_user_id) THEN
    RAISE EXCEPTION 'Actor is not allowed to delete this worklog'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.col_worklog
  WHERE id = p_worklog_id
    AND workspace_id = p_workspace_id
  RETURNING id INTO deleted_id;

  RETURN deleted_id;
END;
$$;

-- Import a CSV preview in one statement so any bad row rolls the whole batch back.
CREATE OR REPLACE FUNCTION public.import_worklogs_batch_secure(
  p_workspace_id UUID,
  p_target_user_id UUID,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, app_security
AS $$
DECLARE
  actor_id UUID := app_security.current_internal_user_id();
  batch_row RECORD;
  target_id UUID;
  existing_workspace_id UUID;
  existing_user_id UUID;
  inserted_count INTEGER := 0;
  updated_count INTEGER := 0;
BEGIN
  IF NOT app_security.can_write_worklog(p_workspace_id, p_target_user_id) THEN
    RAISE EXCEPTION 'Actor is not allowed to import worklogs for this user'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Import rows must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_rows) > 1000 THEN
    RAISE EXCEPTION 'A batch may contain at most 1000 rows' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) AS rows(item)
    WHERE NULLIF(rows.item ->> 'id', '') IS NOT NULL
    GROUP BY rows.item ->> 'id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate worklog IDs are not allowed in one batch'
      USING ERRCODE = '22023';
  END IF;

  FOR batch_row IN
    SELECT rows.item, rows.ordinality
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS rows(item, ordinality)
  LOOP
    IF jsonb_typeof(batch_row.item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Import row % must be a JSON object', batch_row.ordinality
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      target_id := COALESCE(
        NULLIF(batch_row.item ->> 'id', '')::UUID,
        gen_random_uuid()
      );
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Import row % has an invalid worklog ID', batch_row.ordinality
        USING ERRCODE = '22P02';
    END;

    SELECT worklog.workspace_id, worklog.user_id
    INTO existing_workspace_id, existing_user_id
    FROM public.col_worklog AS worklog
    WHERE worklog.id = target_id;

    IF FOUND THEN
      IF existing_workspace_id IS DISTINCT FROM p_workspace_id
        OR existing_user_id IS DISTINCT FROM p_target_user_id
      THEN
        RAISE EXCEPTION 'Import row % cannot overwrite another user or workspace', batch_row.ordinality
          USING ERRCODE = '42501';
      END IF;

      UPDATE public.col_worklog
      SET work_date = (batch_row.item ->> 'work_date')::DATE,
          start_time = (batch_row.item ->> 'start_time')::TIME,
          end_time = (batch_row.item ->> 'end_time')::TIME,
          break_time = COALESCE((batch_row.item ->> 'break_time')::BOOLEAN, FALSE),
          total_hours = (batch_row.item ->> 'total_hours')::NUMERIC,
          holding = NULLIF(batch_row.item ->> 'holding', ''),
          department_operator = NULLIF(batch_row.item ->> 'department_operator', ''),
          project_type = NULLIF(batch_row.item ->> 'project_type', ''),
          project_name = batch_row.item ->> 'project_name',
          module = NULLIF(batch_row.item ->> 'module', ''),
          bu = batch_row.item ->> 'bu',
          department = batch_row.item ->> 'department',
          action_name = batch_row.item ->> 'action_name',
          action_channel = NULLIF(batch_row.item ->> 'action_channel', ''),
          description = NULLIF(batch_row.item ->> 'description', ''),
          channel = 'CSV Import',
          is_ot = COALESCE((batch_row.item ->> 'is_ot')::BOOLEAN, FALSE),
          is_implied_ot = COALESCE((batch_row.item ->> 'is_implied_ot')::BOOLEAN, FALSE),
          updated_at = now(),
          updated_by = actor_id
      WHERE id = target_id;

      updated_count := updated_count + 1;
    ELSE
      INSERT INTO public.col_worklog (
        id, user_id, workspace_id, work_date, start_time, end_time, break_time,
        total_hours, holding, department_operator, project_type, project_name,
        module, bu, department, action_name, action_channel, description, channel,
        is_ot, is_implied_ot, created_by, updated_by
      ) VALUES (
        target_id,
        p_target_user_id,
        p_workspace_id,
        (batch_row.item ->> 'work_date')::DATE,
        (batch_row.item ->> 'start_time')::TIME,
        (batch_row.item ->> 'end_time')::TIME,
        COALESCE((batch_row.item ->> 'break_time')::BOOLEAN, FALSE),
        (batch_row.item ->> 'total_hours')::NUMERIC,
        NULLIF(batch_row.item ->> 'holding', ''),
        NULLIF(batch_row.item ->> 'department_operator', ''),
        NULLIF(batch_row.item ->> 'project_type', ''),
        batch_row.item ->> 'project_name',
        NULLIF(batch_row.item ->> 'module', ''),
        batch_row.item ->> 'bu',
        batch_row.item ->> 'department',
        batch_row.item ->> 'action_name',
        NULLIF(batch_row.item ->> 'action_channel', ''),
        NULLIF(batch_row.item ->> 'description', ''),
        'CSV Import',
        COALESCE((batch_row.item ->> 'is_ot')::BOOLEAN, FALSE),
        COALESCE((batch_row.item ->> 'is_implied_ot')::BOOLEAN, FALSE),
        actor_id,
        actor_id
      );

      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_worklog_secure(UUID, UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_worklog_secure(UUID, UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_worklog_secure(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_worklogs_batch_secure(UUID, UUID, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_worklog_secure(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_worklog_secure(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_worklog_secure(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_worklogs_batch_secure(UUID, UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
