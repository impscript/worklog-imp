-- Migration: Fix RLS policies to allow reading global prompts and templates
BEGIN;

-- 1. tb_ai_prompt_templates SELECT policy: allow any authenticated user to view
DROP POLICY IF EXISTS "Read tb_ai_prompt_templates for workspace members" ON public.tb_ai_prompt_templates;
CREATE POLICY "Allow select tb_ai_prompt_templates for authenticated" 
  ON public.tb_ai_prompt_templates 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- 2. tb_system_config SELECT policy: allow reading config if same workspace OR if it is a prompt key from the global workspace
DROP POLICY IF EXISTS "Read system_config for workspace members" ON public.tb_system_config;
CREATE POLICY "Read system_config for workspace members" 
  ON public.tb_system_config
  FOR SELECT 
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR (workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' AND config_key LIKE 'prompt_%')
  );

COMMIT;
