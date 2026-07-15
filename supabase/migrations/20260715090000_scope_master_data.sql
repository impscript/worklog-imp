-- Migration: Scope Holiday and Templates to Workspaces
BEGIN;

-- 1. Modify tb_master_worklog_templates
ALTER TABLE public.tb_master_worklog_templates DROP CONSTRAINT IF EXISTS tb_master_worklog_templates_template_name_key;
ALTER TABLE public.tb_master_worklog_templates ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Update existing templates to IMP's workspace ('a59b2075-8ce6-4b95-a4df-1e8ea36a0001')
UPDATE public.tb_master_worklog_templates 
SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' 
WHERE workspace_id IS NULL;

ALTER TABLE public.tb_master_worklog_templates ADD CONSTRAINT tb_master_worklog_templates_name_workspace_key UNIQUE (template_name, workspace_id);

-- 2. Modify tb_master_holiday
ALTER TABLE public.tb_master_holiday ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Update existing holidays to IMP's workspace
UPDATE public.tb_master_holiday 
SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' 
WHERE workspace_id IS NULL;

-- 3. Open up RLS for workspace users
DROP POLICY IF EXISTS "Allow public read tb_master_worklog_templates" ON public.tb_master_worklog_templates;
CREATE POLICY "Allow read templates in same workspace" ON public.tb_master_worklog_templates
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow write templates in same workspace for admins" ON public.tb_master_worklog_templates
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

COMMIT;
