-- Migration: Add workspace scoping to tb_system_config and update unique constraints on mappings
BEGIN;

-- 1. tb_system_config
ALTER TABLE public.tb_system_config DROP CONSTRAINT IF EXISTS tb_system_config_pkey CASCADE;
ALTER TABLE public.tb_system_config ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tb_system_config SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;
ALTER TABLE public.tb_system_config ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tb_system_config ALTER COLUMN workspace_id SET DEFAULT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';
ALTER TABLE public.tb_system_config ADD PRIMARY KEY (config_key, workspace_id);

-- Populate config presets for new workspaces if they don't exist
INSERT INTO public.tb_system_config (config_key, config_value, description, workspace_id)
SELECT k.key, k.val, k.descr, w.id
FROM public.workspaces w
CROSS JOIN (
  VALUES 
    ('ai_provider', 'opencode', 'Active AI Provider (openai, gemini, openrouter, opencode)'),
    ('ai_model', 'big-pickle', 'Active LLM Model ID'),
    ('openai_api_key', '', 'OpenAI API Key (sk-...)'),
    ('gemini_api_key', '', 'Google Gemini API Key (AIzaSy...)'),
    ('openrouter_api_key', '', 'OpenRouter API Key (sk-or-...)'),
    ('ai_enhancement_prompt', '', 'Custom prompt guidelines for AI Worklog Description Enhancement')
) k(key, val, descr)
ON CONFLICT (config_key, workspace_id) DO NOTHING;

-- 2. Update unique constraints on mapping tables to include workspace_id
-- tb_master_action
ALTER TABLE public.tb_master_action DROP CONSTRAINT IF EXISTS tb_master_action_action_category_action_name_key CASCADE;
ALTER TABLE public.tb_master_action ADD CONSTRAINT tb_master_action_category_name_workspace_key UNIQUE (action_category, action_name, workspace_id);

-- tb_map_user_role
ALTER TABLE public.tb_map_user_role DROP CONSTRAINT IF EXISTS tb_map_user_role_name_holding_department_operator_key CASCADE;
ALTER TABLE public.tb_map_user_role ADD CONSTRAINT tb_map_user_role_name_holding_operator_workspace_key UNIQUE (name, holding, department_operator, workspace_id);

-- 3. RLS policies for tb_system_config
DROP POLICY IF EXISTS "Allow all access to system_config for dev" ON public.tb_system_config;
CREATE POLICY "Read system_config for workspace members" ON public.tb_system_config
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Write system_config for workspace admins" ON public.tb_system_config
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

COMMIT;
