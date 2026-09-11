-- =============================================================================
-- Migration: Routine Tasks (daily/weekly/monthly self-reminders)
--
-- tb_routine_task            : the task definition, owned by its creator
-- tb_routine_task_visibility : extra people (besides the creator) allowed to
--                               see a 'specific'-visibility task
-- tb_routine_task_completion : per-user, per-calendar-day checkmark
--
-- Every row is pinned to the workspace it was created under via a trigger
-- that re-derives workspace_id from the parent task, so visibility can never
-- leak across workspaces even for users who belong to more than one.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_routine_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,

  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'monthly')),
  days_of_week INTEGER[],
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),

  visibility TEXT NOT NULL DEFAULT 'only_me' CHECK (visibility IN ('only_me', 'specific')),
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tb_routine_task_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tb_routine_task(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tb_routine_task_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tb_routine_task(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id, completed_date)
);

CREATE INDEX IF NOT EXISTS idx_routine_task_workspace ON public.tb_routine_task(workspace_id);
CREATE INDEX IF NOT EXISTS idx_routine_task_created_by ON public.tb_routine_task(created_by);
CREATE INDEX IF NOT EXISTS idx_routine_task_visibility_task ON public.tb_routine_task_visibility(task_id);
CREATE INDEX IF NOT EXISTS idx_routine_task_visibility_user ON public.tb_routine_task_visibility(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_task_completion_task ON public.tb_routine_task_completion(task_id);
CREATE INDEX IF NOT EXISTS idx_routine_task_completion_user_date ON public.tb_routine_task_completion(user_id, completed_date);

ALTER TABLE public.tb_routine_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_routine_task_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_routine_task_completion ENABLE ROW LEVEL SECURITY;

-- Keep child.workspace_id locked to the parent task's workspace; never trust
-- a client-provided value for it (same technique as sync_gantt_child_workspace).
CREATE OR REPLACE FUNCTION app_security.sync_routine_task_child_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
BEGIN
  SELECT task.workspace_id
  INTO NEW.workspace_id
  FROM public.tb_routine_task AS task
  WHERE task.id = NEW.task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Routine task % does not exist', NEW.task_id
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_security.sync_routine_task_child_workspace() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_sync_routine_task_visibility_workspace ON public.tb_routine_task_visibility;
CREATE TRIGGER trg_sync_routine_task_visibility_workspace
BEFORE INSERT OR UPDATE OF task_id, workspace_id
ON public.tb_routine_task_visibility
FOR EACH ROW EXECUTE FUNCTION app_security.sync_routine_task_child_workspace();

DROP TRIGGER IF EXISTS trg_sync_routine_task_completion_workspace ON public.tb_routine_task_completion;
CREATE TRIGGER trg_sync_routine_task_completion_workspace
BEFORE INSERT OR UPDATE OF task_id, workspace_id
ON public.tb_routine_task_completion
FOR EACH ROW EXECUTE FUNCTION app_security.sync_routine_task_child_workspace();

-- Keep updated_at accurate on edits.
CREATE OR REPLACE FUNCTION app_security.touch_routine_task_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_security.touch_routine_task_updated_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_touch_routine_task_updated_at ON public.tb_routine_task;
CREATE TRIGGER trg_touch_routine_task_updated_at
BEFORE UPDATE ON public.tb_routine_task
FOR EACH ROW EXECUTE FUNCTION app_security.touch_routine_task_updated_at();

-- Central visibility helpers so RLS never has to trust client input, and so
-- 'workspace membership' is always re-checked against the task's own fixed
-- workspace_id (not the viewer's currently active workspace).
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
        OR app_security.current_user_is_admin()
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
      AND (
        task.created_by = app_security.current_internal_user_id()
        OR app_security.current_user_is_admin()
      )
  );
$$;

REVOKE ALL ON FUNCTION app_security.can_view_routine_task(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_security.is_routine_task_owner(UUID) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_security TO authenticated;
GRANT EXECUTE ON FUNCTION app_security.can_view_routine_task(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_security.is_routine_task_owner(UUID) TO authenticated;

-- tb_routine_task: creator has full control; shared viewers get read-only.
DROP POLICY IF EXISTS "Routine task visible to owner or shared viewers" ON public.tb_routine_task;
CREATE POLICY "Routine task visible to owner or shared viewers"
ON public.tb_routine_task FOR SELECT TO authenticated
USING (app_security.can_view_routine_task(id));

DROP POLICY IF EXISTS "Routine task insert by workspace member as self" ON public.tb_routine_task;
CREATE POLICY "Routine task insert by workspace member as self"
ON public.tb_routine_task FOR INSERT TO authenticated
WITH CHECK (
  app_security.is_workspace_member(workspace_id)
  AND created_by = app_security.current_internal_user_id()
);

DROP POLICY IF EXISTS "Routine task update by owner" ON public.tb_routine_task;
CREATE POLICY "Routine task update by owner"
ON public.tb_routine_task FOR UPDATE TO authenticated
USING (app_security.is_routine_task_owner(id))
WITH CHECK (app_security.is_routine_task_owner(id));

DROP POLICY IF EXISTS "Routine task delete by owner" ON public.tb_routine_task;
CREATE POLICY "Routine task delete by owner"
ON public.tb_routine_task FOR DELETE TO authenticated
USING (app_security.is_routine_task_owner(id));

-- tb_routine_task_visibility: only the creator manages who else can see a task.
DROP POLICY IF EXISTS "Routine task visibility readable to viewers" ON public.tb_routine_task_visibility;
CREATE POLICY "Routine task visibility readable to viewers"
ON public.tb_routine_task_visibility FOR SELECT TO authenticated
USING (app_security.can_view_routine_task(task_id));

DROP POLICY IF EXISTS "Routine task visibility managed by owner" ON public.tb_routine_task_visibility;
CREATE POLICY "Routine task visibility managed by owner"
ON public.tb_routine_task_visibility FOR INSERT TO authenticated
WITH CHECK (app_security.is_routine_task_owner(task_id));

DROP POLICY IF EXISTS "Routine task visibility deleted by owner" ON public.tb_routine_task_visibility;
CREATE POLICY "Routine task visibility deleted by owner"
ON public.tb_routine_task_visibility FOR DELETE TO authenticated
USING (app_security.is_routine_task_owner(task_id));

-- tb_routine_task_completion: everyone marks only their own checkbox, on a
-- task they can actually see; the owner may additionally read everyone's
-- completion to track team compliance.
DROP POLICY IF EXISTS "Routine task completion readable to self or owner" ON public.tb_routine_task_completion;
CREATE POLICY "Routine task completion readable to self or owner"
ON public.tb_routine_task_completion FOR SELECT TO authenticated
USING (
  user_id = app_security.current_internal_user_id()
  OR app_security.is_routine_task_owner(task_id)
);

DROP POLICY IF EXISTS "Routine task completion written by self" ON public.tb_routine_task_completion;
CREATE POLICY "Routine task completion written by self"
ON public.tb_routine_task_completion FOR INSERT TO authenticated
WITH CHECK (
  user_id = app_security.current_internal_user_id()
  AND app_security.can_view_routine_task(task_id)
);

DROP POLICY IF EXISTS "Routine task completion deleted by self" ON public.tb_routine_task_completion;
CREATE POLICY "Routine task completion deleted by self"
ON public.tb_routine_task_completion FOR DELETE TO authenticated
USING (user_id = app_security.current_internal_user_id());

-- Explicit Data API grants: signed-out clients get nothing; RLS decides row
-- access for authenticated clients.
REVOKE ALL ON TABLE public.tb_routine_task FROM anon;
REVOKE ALL ON TABLE public.tb_routine_task_visibility FROM anon;
REVOKE ALL ON TABLE public.tb_routine_task_completion FROM anon;

REVOKE ALL ON TABLE public.tb_routine_task FROM authenticated;
REVOKE ALL ON TABLE public.tb_routine_task_visibility FROM authenticated;
REVOKE ALL ON TABLE public.tb_routine_task_completion FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tb_routine_task TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.tb_routine_task_visibility TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.tb_routine_task_completion TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
