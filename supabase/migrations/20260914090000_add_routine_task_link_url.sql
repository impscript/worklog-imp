-- =============================================================================
-- Add an optional reference link to a routine task (e.g. a doc, ticket, or
-- runbook the reminder points to). Purely additive; existing rows default to
-- NULL and no RLS/behavior change is needed since it's just another column
-- on tb_routine_task, covered by the table's existing policies.
-- =============================================================================

ALTER TABLE public.tb_routine_task
ADD COLUMN IF NOT EXISTS link_url TEXT;

NOTIFY pgrst, 'reload schema';
