-- =============================================================================
-- Replace the single-link_url column with a proper child table so a routine
-- task can carry any number of reference links, matching the same pattern as
-- tb_routine_task_visibility (workspace_id trigger-synced from the parent,
-- readable by anyone who can view the task, writable only by its owner).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_routine_task_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tb_routine_task(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routine_task_link_task ON public.tb_routine_task_link(task_id);

ALTER TABLE public.tb_routine_task_link ENABLE ROW LEVEL SECURITY;

-- Reuse the existing generic child-workspace-sync trigger function (already
-- used by tb_routine_task_visibility / tb_routine_task_completion).
DROP TRIGGER IF EXISTS trg_sync_routine_task_link_workspace ON public.tb_routine_task_link;
CREATE TRIGGER trg_sync_routine_task_link_workspace
BEFORE INSERT OR UPDATE OF task_id, workspace_id
ON public.tb_routine_task_link
FOR EACH ROW EXECUTE FUNCTION app_security.sync_routine_task_child_workspace();

DROP POLICY IF EXISTS "Routine task links readable to viewers" ON public.tb_routine_task_link;
CREATE POLICY "Routine task links readable to viewers"
ON public.tb_routine_task_link FOR SELECT TO authenticated
USING (app_security.can_view_routine_task(task_id));

DROP POLICY IF EXISTS "Routine task links managed by owner" ON public.tb_routine_task_link;
CREATE POLICY "Routine task links managed by owner"
ON public.tb_routine_task_link FOR INSERT TO authenticated
WITH CHECK (app_security.is_routine_task_owner(task_id));

DROP POLICY IF EXISTS "Routine task links deleted by owner" ON public.tb_routine_task_link;
CREATE POLICY "Routine task links deleted by owner"
ON public.tb_routine_task_link FOR DELETE TO authenticated
USING (app_security.is_routine_task_owner(task_id));

REVOKE ALL ON TABLE public.tb_routine_task_link FROM anon;
REVOKE ALL ON TABLE public.tb_routine_task_link FROM authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.tb_routine_task_link TO authenticated;

-- Migrate any existing single-link data into the new table before dropping
-- the column.
INSERT INTO public.tb_routine_task_link (task_id, workspace_id, url)
SELECT id, workspace_id, link_url
FROM public.tb_routine_task
WHERE link_url IS NOT NULL AND TRIM(link_url) <> '';

ALTER TABLE public.tb_routine_task DROP COLUMN IF EXISTS link_url;

NOTIFY pgrst, 'reload schema';

COMMIT;
