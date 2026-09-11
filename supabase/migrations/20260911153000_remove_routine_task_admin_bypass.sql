-- =============================================================================
-- Fix: routine tasks are a personal/private feature -- visibility must be
-- exactly what the creator chose (only_me or the explicit share list), with
-- no exceptions. The initial policies copied the "global admin sees
-- everything" override used elsewhere in this app for shared business data
-- (worklogs, projects), which is wrong here: it let any account with
-- users.role = 'admin' read, edit, or delete other people's "only me"
-- routine tasks. Removing the admin bypass from every routine-task policy
-- and helper function so visibility is strictly creator/shared-list only.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION app_security.can_view_routine_task(target_task_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tb_routine_task AS task
    WHERE task.id = target_task_id
      AND app_security.is_workspace_member(task.workspace_id)
      AND (
        task.created_by = app_security.current_internal_user_id()
        OR EXISTS (
          SELECT 1
          FROM public.tb_routine_task_visibility AS v
          WHERE v.task_id = task.id
            AND v.user_id = app_security.current_internal_user_id()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION app_security.is_routine_task_owner(target_task_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tb_routine_task AS task
    WHERE task.id = target_task_id
      AND task.created_by = app_security.current_internal_user_id()
  );
$$;

DROP POLICY IF EXISTS "Routine task visible to owner or shared viewers" ON public.tb_routine_task;
CREATE POLICY "Routine task visible to owner or shared viewers"
ON public.tb_routine_task FOR SELECT TO authenticated
USING (
  app_security.is_workspace_member(workspace_id)
  AND (
    created_by = app_security.current_internal_user_id()
    OR EXISTS (
      SELECT 1
      FROM public.tb_routine_task_visibility AS v
      WHERE v.task_id = tb_routine_task.id
        AND v.user_id = app_security.current_internal_user_id()
    )
  )
);

DROP POLICY IF EXISTS "Routine task update by owner" ON public.tb_routine_task;
CREATE POLICY "Routine task update by owner"
ON public.tb_routine_task FOR UPDATE TO authenticated
USING (created_by = app_security.current_internal_user_id())
WITH CHECK (created_by = app_security.current_internal_user_id());

DROP POLICY IF EXISTS "Routine task delete by owner" ON public.tb_routine_task;
CREATE POLICY "Routine task delete by owner"
ON public.tb_routine_task FOR DELETE TO authenticated
USING (created_by = app_security.current_internal_user_id());

NOTIFY pgrst, 'reload schema';

COMMIT;
