-- Migration: Add workspace scoping to tb_ai_prompt_templates
BEGIN;

ALTER TABLE public.tb_ai_prompt_templates ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tb_ai_prompt_templates SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;
ALTER TABLE public.tb_ai_prompt_templates ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tb_ai_prompt_templates ALTER COLUMN workspace_id SET DEFAULT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

-- Drop the template_key unique constraint
ALTER TABLE public.tb_ai_prompt_templates DROP CONSTRAINT IF EXISTS tb_ai_prompt_templates_template_key_key CASCADE;
-- Add composite unique constraint
ALTER TABLE public.tb_ai_prompt_templates ADD CONSTRAINT tb_ai_prompt_templates_key_workspace_key UNIQUE (template_key, workspace_id);

-- Populate prompts templates presets for other workspaces
INSERT INTO public.tb_ai_prompt_templates (
  template_key, name, description, icon, system_prompt, user_prompt_template,
  cadence_aware, requires_level, is_active, sort_order, workspace_id
)
SELECT t.template_key, t.name, t.description, t.icon, t.system_prompt, t.user_prompt_template,
       t.cadence_aware, t.requires_level, t.is_active, t.sort_order, w.id
FROM public.workspaces w
CROSS JOIN public.tb_ai_prompt_templates t
WHERE t.workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
ON CONFLICT (template_key, workspace_id) DO NOTHING;

-- RLS
DROP POLICY IF EXISTS "Allow read tb_ai_prompt_templates" ON public.tb_ai_prompt_templates;
CREATE POLICY "Read tb_ai_prompt_templates for workspace members" ON public.tb_ai_prompt_templates
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Allow all tb_ai_prompt_templates for dev" ON public.tb_ai_prompt_templates;
CREATE POLICY "Write tb_ai_prompt_templates for workspace admins" ON public.tb_ai_prompt_templates
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

COMMIT;
