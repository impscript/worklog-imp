-- Migration: Reset seed master data to global (workspace_id = NULL) and keep holiday company-wide
BEGIN;

UPDATE public.tb_master_holding SET workspace_id = NULL;
UPDATE public.tb_master_role SET workspace_id = NULL;
UPDATE public.tb_master_project_type SET workspace_id = NULL;
UPDATE public.tb_master_action SET workspace_id = NULL;
UPDATE public.tb_map_user_role SET workspace_id = NULL;
UPDATE public.tb_map_project_structure SET workspace_id = NULL;
UPDATE public.tb_master_holiday SET workspace_id = NULL;

-- 2. Open up RLS for public read on holidays without workspace restriction
DROP POLICY IF EXISTS "Read holidays for workspace members or system defaults" ON public.tb_master_holiday;
DROP POLICY IF EXISTS "Public read access for master holiday" ON public.tb_master_holiday;
CREATE POLICY "Public read access for master holiday" ON public.tb_master_holiday 
  FOR SELECT USING (true);

COMMIT;
