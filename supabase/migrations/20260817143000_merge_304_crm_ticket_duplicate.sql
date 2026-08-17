-- Migration: Merge accidental 304 CRM rename duplicate
-- Description:
--   Earlier Project Structure rename sync could create a new "304 CRM Ticket" registry row
--   while leaving the original "304 CRM" row with its worklogs/team data. Keep the original
--   project identity and rename it to the intended final name, merging an empty duplicate shell.

BEGIN;

DO $$
DECLARE
  v_source_id UUID;
  v_duplicate_id UUID;
BEGIN
  SELECT id INTO v_source_id
  FROM public.tb_project_registry
  WHERE project_name = '304 CRM'
    AND parent_project_id IS NULL
  LIMIT 1;

  SELECT id INTO v_duplicate_id
  FROM public.tb_project_registry
  WHERE project_name = '304 CRM Ticket'
    AND parent_project_id IS NULL
  LIMIT 1;

  IF v_source_id IS NULL THEN
    RETURN;
  END IF;

  IF v_duplicate_id IS NOT NULL AND v_duplicate_id <> v_source_id THEN
    IF NOT public.fn_project_registry_is_empty_shell(v_duplicate_id) THEN
      RAISE EXCEPTION 'Cannot auto-merge 304 CRM Ticket because duplicate project % has related data', v_duplicate_id
        USING ERRCODE = '23505';
    END IF;

    UPDATE public.tb_map_project_structure
    SET project_id = v_source_id,
        project_name = '304 CRM Ticket'
    WHERE project_id = v_duplicate_id
       OR project_name IN ('304 CRM', '304 CRM Ticket');

    UPDATE public.col_worklog
    SET project_id = v_source_id,
        project_name = '304 CRM Ticket'
    WHERE project_id = v_duplicate_id
       OR project_id = v_source_id
       OR project_name IN ('304 CRM', '304 CRM Ticket');

    DELETE FROM public.tb_project_registry
    WHERE id = v_duplicate_id;
  ELSE
    UPDATE public.tb_map_project_structure
    SET project_name = '304 CRM Ticket'
    WHERE project_id = v_source_id
       OR project_name = '304 CRM';

    UPDATE public.col_worklog
    SET project_name = '304 CRM Ticket'
    WHERE project_id = v_source_id
       OR project_name = '304 CRM';
  END IF;

  UPDATE public.tb_project_registry
  SET project_name = '304 CRM Ticket',
      updated_at = now()
  WHERE id = v_source_id;

  UPDATE public.tb_project_registry
  SET project_name = CASE
        WHEN module IS NOT NULL AND module <> '' AND module <> '-' THEN '304 CRM Ticket - ' || module
        ELSE project_name
      END,
      updated_at = now()
  WHERE parent_project_id = v_source_id;
END $$;

COMMIT;
