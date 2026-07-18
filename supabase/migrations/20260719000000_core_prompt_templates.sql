-- Migration: Add company-wide "Core / Public" AI prompt templates.
-- Core prompts use workspace_id = NULL (like tb_master_holiday) so every
-- workspace sees and can use them as a shared default. Only Super Admins
-- (role = 'admin') can create/modify core prompts.

BEGIN;

-- 1) Add the is_core flag
ALTER TABLE public.tb_ai_prompt_templates
  ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT false;

-- 2) Allow workspace_id to be NULL so a row can be a global/core prompt.
--    (The original scoping migration set this NOT NULL; we reverse it here.)
ALTER TABLE public.tb_ai_prompt_templates
  ALTER COLUMN workspace_id DROP NOT NULL;

-- 3) Rebuild the unique constraint so it tolerates NULL workspace_id.
--    Postgres treats NULL != NULL, so multiple core (NULL) rows with the
--    same template_key are allowed, while (template_key, workspace_id)
--    remains unique for normal workspace-scoped rows.
ALTER TABLE public.tb_ai_prompt_templates
  DROP CONSTRAINT IF EXISTS tb_ai_prompt_templates_key_workspace_key;
ALTER TABLE public.tb_ai_prompt_templates
  ADD CONSTRAINT tb_ai_prompt_templates_key_workspace_key
  UNIQUE (template_key, workspace_id);

-- 4) RLS: replace the workspace-only policies with core-aware ones.
--    NOTE: app_security.is_workspace_member(NULL) returns false (NULL = NULL
--    is unknown), so we must add an explicit `OR workspace_id IS NULL` branch
--    to let every authenticated user READ core prompts.
DROP POLICY IF EXISTS "Read prompt templates for workspace members" ON public.tb_ai_prompt_templates;
CREATE POLICY "Read prompt templates for workspace members"
  ON public.tb_ai_prompt_templates FOR SELECT
  USING (
    app_security.is_workspace_member(workspace_id)
    OR workspace_id IS NULL
    OR app_security.current_user_is_admin()
  );

DROP POLICY IF EXISTS "Write prompt templates for workspace admins" ON public.tb_ai_prompt_templates;
CREATE POLICY "Write prompt templates for workspace admins"
  ON public.tb_ai_prompt_templates FOR ALL
  USING (
    app_security.is_workspace_admin(workspace_id)
    OR app_security.current_user_is_admin()
  )
  WITH CHECK (
    app_security.is_workspace_admin(workspace_id)
    OR app_security.current_user_is_admin()
  );

-- 5) Optional seed: one example core prompt as a shared default.
--    Insert only if no core prompt exists yet.
INSERT INTO public.tb_ai_prompt_templates (
  template_key, name, description, icon, system_prompt, user_prompt_template,
  cadence_aware, requires_level, is_active, sort_order, is_core, workspace_id
)
SELECT
  'core_general_evaluation',
  'Core General Evaluation',
  'Company-wide standard evaluation prompt. Shared default for every workspace.',
  '🌐',
  'You are a fair, consistent performance evaluation assistant. Evaluate the employee against the company standard, their JD, and their logged work. Be objective and avoid bias.',
  'Evaluate the following employee worklog and JD for the period {{DATE_RANGE}}.\n\nJD:\n{{JD_TEXT}}\n\nTarget responsibilities/weights:\n{{KEY_RESPONSIBILITIES_JSON}}\n\nWorklog summary:\n{{WORKLOG_SUMMARY}}',
  false,
  false,
  true,
  0,
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.tb_ai_prompt_templates WHERE is_core = true
);

COMMIT;
