-- =========================================================================
-- Migration: Clean-up AI Prompt Templates → Core / Public only
-- =========================================================================
-- STRATEGY
-- ─────────────────────────────────────────────────────────────────────────
-- 1. Upsert the 3 prompts that were workspace-scoped but should be core:
--      • master           → HRBP Diagnostics (Standard)
--      • individual_coach → Executive Coach (5-Lens Framework)
--      • coaching_fairness→ Coaching & Fairness Diagnostics
--    (core_general_evaluation + perf_evaluation are already is_core=true)
--
-- 2. DELETE every row that still has a workspace_id (workspace-scoped).
--    All meaningful prompt content is now in the core rows (workspace_id IS NULL).
--
-- 3. RLS reminder: the current policy already allows every authenticated
--    user to read rows where workspace_id IS NULL, so no policy change needed.
--
-- FUTURE WORKFLOW
--   • Core prompts  → is_core = true, workspace_id = NULL (Super Admin only)
--   • WS-custom     → is_core = false, workspace_id = <uuid> (WS Admin)
-- =========================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1a) HRBP Diagnostics (Standard) → upgrade to core
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.tb_ai_prompt_templates (
  template_key, name, description, icon,
  system_prompt, user_prompt_template, output_schema,
  cadence_aware, requires_level,
  is_active, sort_order, is_core, workspace_id
)
SELECT
  t.template_key,
  t.name,
  t.description,
  t.icon,
  t.system_prompt,
  t.user_prompt_template,
  t.output_schema,
  t.cadence_aware,
  t.requires_level,
  true,   -- is_active
  1,      -- sort_order (after core_general_evaluation=0)
  true,   -- is_core
  NULL    -- workspace_id = NULL → Core / Public
FROM public.tb_ai_prompt_templates t
WHERE t.template_key = 'master'
  AND t.workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
ON CONFLICT (template_key, workspace_id) DO UPDATE
  SET
    name               = EXCLUDED.name,
    description        = EXCLUDED.description,
    icon               = EXCLUDED.icon,
    system_prompt      = EXCLUDED.system_prompt,
    user_prompt_template = EXCLUDED.user_prompt_template,
    output_schema      = EXCLUDED.output_schema,
    cadence_aware      = EXCLUDED.cadence_aware,
    requires_level     = EXCLUDED.requires_level,
    is_active          = EXCLUDED.is_active,
    sort_order         = EXCLUDED.sort_order,
    is_core            = EXCLUDED.is_core,
    updated_at         = now();

-- ─────────────────────────────────────────────────────────────────────────
-- 1b) Executive Coach (5-Lens Framework) → upgrade to core
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.tb_ai_prompt_templates (
  template_key, name, description, icon,
  system_prompt, user_prompt_template, output_schema,
  cadence_aware, requires_level,
  is_active, sort_order, is_core, workspace_id
)
SELECT
  t.template_key,
  t.name,
  t.description,
  t.icon,
  t.system_prompt,
  t.user_prompt_template,
  t.output_schema,
  t.cadence_aware,
  t.requires_level,
  true,   -- is_active
  2,      -- sort_order
  true,   -- is_core
  NULL    -- workspace_id = NULL → Core / Public
FROM public.tb_ai_prompt_templates t
WHERE t.template_key = 'individual_coach'
  AND t.workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
ON CONFLICT (template_key, workspace_id) DO UPDATE
  SET
    name               = EXCLUDED.name,
    description        = EXCLUDED.description,
    icon               = EXCLUDED.icon,
    system_prompt      = EXCLUDED.system_prompt,
    user_prompt_template = EXCLUDED.user_prompt_template,
    output_schema      = EXCLUDED.output_schema,
    cadence_aware      = EXCLUDED.cadence_aware,
    requires_level     = EXCLUDED.requires_level,
    is_active          = EXCLUDED.is_active,
    sort_order         = EXCLUDED.sort_order,
    is_core            = EXCLUDED.is_core,
    updated_at         = now();

-- ─────────────────────────────────────────────────────────────────────────
-- 1c) Coaching & Fairness Diagnostics → upgrade to core
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.tb_ai_prompt_templates (
  template_key, name, description, icon,
  system_prompt, user_prompt_template, output_schema,
  cadence_aware, requires_level,
  is_active, sort_order, is_core, workspace_id
)
SELECT
  t.template_key,
  t.name,
  t.description,
  t.icon,
  t.system_prompt,
  t.user_prompt_template,
  t.output_schema,
  t.cadence_aware,
  t.requires_level,
  true,   -- is_active
  3,      -- sort_order
  true,   -- is_core
  NULL    -- workspace_id = NULL → Core / Public
FROM public.tb_ai_prompt_templates t
WHERE t.template_key = 'coaching_fairness'
  AND t.workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
ON CONFLICT (template_key, workspace_id) DO UPDATE
  SET
    name               = EXCLUDED.name,
    description        = EXCLUDED.description,
    icon               = EXCLUDED.icon,
    system_prompt      = EXCLUDED.system_prompt,
    user_prompt_template = EXCLUDED.user_prompt_template,
    output_schema      = EXCLUDED.output_schema,
    cadence_aware      = EXCLUDED.cadence_aware,
    requires_level     = EXCLUDED.requires_level,
    is_active          = EXCLUDED.is_active,
    sort_order         = EXCLUDED.sort_order,
    is_core            = EXCLUDED.is_core,
    updated_at         = now();

-- ─────────────────────────────────────────────────────────────────────────
-- 1d) Fix sort_order of perf_evaluation core row (was 3, now should be 4)
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.tb_ai_prompt_templates
SET sort_order = 4
WHERE template_key = 'perf_evaluation'
  AND workspace_id IS NULL
  AND is_core = true;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) DELETE all workspace-scoped rows
--    All content has been promoted to core rows above.
-- ─────────────────────────────────────────────────────────────────────────
DELETE FROM public.tb_ai_prompt_templates
WHERE workspace_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Verify final state (informational — does not fail migration)
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  core_count INT;
  ws_count   INT;
BEGIN
  SELECT count(*) INTO core_count FROM public.tb_ai_prompt_templates WHERE workspace_id IS NULL;
  SELECT count(*) INTO ws_count   FROM public.tb_ai_prompt_templates WHERE workspace_id IS NOT NULL;
  RAISE NOTICE 'AI Prompt Templates after cleanup: % core rows, % workspace-scoped rows (should be 0)', core_count, ws_count;
END;
$$;

COMMIT;
