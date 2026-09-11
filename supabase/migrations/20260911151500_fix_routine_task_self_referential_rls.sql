-- =============================================================================
-- Fix: tb_routine_task's own SELECT/UPDATE/DELETE policies called
-- can_view_routine_task()/is_routine_task_owner(), which re-query
-- tb_routine_task by id. For `INSERT ... RETURNING`, Postgres implicitly
-- re-checks SELECT-policy visibility on the newly inserted row, and that
-- self-referential re-query cannot see a row still being created within the
-- same statement -- so every INSERT with RETURNING was rejected as an RLS
-- violation even for the row's own creator.
--
-- Fix: policies on tb_routine_task itself now reference the row's own
-- columns directly (no self-referential subquery). can_view_routine_task()
-- and is_routine_task_owner() remain correct and are still used by the child
-- tables (tb_routine_task_visibility, tb_routine_task_completion), where the
-- parent row they look up always exists in a separate, already-committed
-- statement.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "Routine task visible to owner or shared viewers" ON public.tb_routine_task;
CREATE POLICY "Routine task visible to owner or shared viewers"
ON public.tb_routine_task FOR SELECT TO authenticated
USING (
  app_security.is_workspace_member(workspace_id)
  AND (
    created_by = app_security.current_internal_user_id()
    OR app_security.current_user_is_admin()
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
USING (
  created_by = app_security.current_internal_user_id()
  OR app_security.current_user_is_admin()
)
WITH CHECK (
  created_by = app_security.current_internal_user_id()
  OR app_security.current_user_is_admin()
);

DROP POLICY IF EXISTS "Routine task delete by owner" ON public.tb_routine_task;
CREATE POLICY "Routine task delete by owner"
ON public.tb_routine_task FOR DELETE TO authenticated
USING (
  created_by = app_security.current_internal_user_id()
  OR app_security.current_user_is_admin()
);

NOTIFY pgrst, 'reload schema';

COMMIT;
