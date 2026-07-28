-- Migration: Deduplicate master worklog templates and add unique constraint handling NULL workspace_id
BEGIN;

-- 1. Remove duplicate records keeping the latest updated/created row per (template_name, workspace_id)
DELETE FROM public.tb_master_worklog_templates t1
WHERE t1.id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY template_name, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY updated_at DESC, created_at DESC, id DESC
           ) as rnum
    FROM public.tb_master_worklog_templates
  ) sub
  WHERE sub.rnum > 1
);

-- 2. Add unique index for (template_name, COALESCE(workspace_id, ...)) to prevent future duplicate inserts when workspace_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tb_master_worklog_templates_name_ws
ON public.tb_master_worklog_templates (template_name, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid));

COMMIT;
