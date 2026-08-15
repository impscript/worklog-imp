-- Migration: Expand tb_project_registry status check constraint
-- Description: Allows modern Gantt Roadmap lifecycle stages ('in_progress', 'testing', 'completed', 'on_hold') alongside legacy statuses.

BEGIN;

ALTER TABLE public.tb_project_registry
DROP CONSTRAINT IF EXISTS tb_project_registry_status_check;

ALTER TABLE public.tb_project_registry
DROP CONSTRAINT IF EXISTS tb_project_registry_project_type_check;

ALTER TABLE public.tb_project_registry
ADD CONSTRAINT tb_project_registry_status_check
CHECK (status = ANY (ARRAY[
  'planning'::text,
  'development'::text,
  'in_progress'::text,
  'testing'::text,
  'active'::text,
  'completed'::text,
  'on_hold'::text,
  'inactive'::text,
  'sunset'::text,
  'retired'::text
]));

NOTIFY pgrst, 'reload schema';

COMMIT;
