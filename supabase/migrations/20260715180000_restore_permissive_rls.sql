-- Migration: Restore permissive RLS for tb_ai_prompt_templates and tb_system_config
BEGIN;

-- 1. tb_ai_prompt_templates: Allow all access (select, insert, update, delete) to support mock/dev sessions
DROP POLICY IF EXISTS "Allow select tb_ai_prompt_templates for authenticated" ON public.tb_ai_prompt_templates;
DROP POLICY IF EXISTS "Write tb_ai_prompt_templates for workspace admins" ON public.tb_ai_prompt_templates;
DROP POLICY IF EXISTS "Allow read tb_ai_prompt_templates" ON public.tb_ai_prompt_templates;
DROP POLICY IF EXISTS "Allow all tb_ai_prompt_templates for dev" ON public.tb_ai_prompt_templates;

CREATE POLICY "Allow all access to tb_ai_prompt_templates for dev" 
  ON public.tb_ai_prompt_templates 
  FOR ALL 
  USING (true);

-- 2. tb_system_config: Allow all access to support mock/dev settings management
DROP POLICY IF EXISTS "Read system_config for workspace members" ON public.tb_system_config;
DROP POLICY IF EXISTS "Write system_config for workspace admins" ON public.tb_system_config;
DROP POLICY IF EXISTS "Allow all access to system_config for dev" ON public.tb_system_config;

CREATE POLICY "Allow all access to system_config for dev" 
  ON public.tb_system_config 
  FOR ALL 
  USING (true);

COMMIT;
