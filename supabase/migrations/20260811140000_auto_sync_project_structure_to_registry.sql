-- Migration: Auto-sync Project Structure to Project Registry & Historical Backfill
-- Description: 
-- 1. Updates fn_sync_mapping_project_id trigger function so that whenever a row is inserted
--    or updated in tb_map_project_structure, matching entries in tb_project_registry are
--    automatically created (if they don't exist yet) and linked.
-- 2. Backfills all existing historical rows in tb_map_project_structure into tb_project_registry.

BEGIN;

-- 1. Update trigger function to auto-create missing entries in tb_project_registry
CREATE OR REPLACE FUNCTION public.fn_sync_mapping_project_id()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_id UUID;
  v_module_id UUID;
  v_mapped_project_type TEXT;
  v_child_project_name TEXT;
BEGIN
  -- Helper: map project_type to valid enum in tb_project_registry
  v_mapped_project_type := CASE 
    WHEN LOWER(COALESCE(NEW.project_type, '')) IN ('web_app', 'api', 'mobile', 'desktop', 'integration', 'extension', 'module', 'internal_tool', 'infra', 'other') THEN LOWER(NEW.project_type)
    ELSE 'other'
  END;

  -- 1. Check or Auto-Create Parent Project in tb_project_registry
  IF NEW.project_name IS NOT NULL AND NEW.project_name <> '' THEN
    SELECT id INTO v_parent_id 
    FROM public.tb_project_registry 
    WHERE project_name = NEW.project_name AND parent_project_id IS NULL
    LIMIT 1;

    IF v_parent_id IS NULL THEN
      INSERT INTO public.tb_project_registry (
        project_name,
        description,
        project_type,
        owner_holding,
        owner_team,
        workspace_id,
        status
      ) VALUES (
        NEW.project_name,
        NEW.project_description,
        v_mapped_project_type,
        NEW.holding,
        NEW.department_operator,
        NEW.workspace_id,
        CASE WHEN NEW.is_active = FALSE THEN 'inactive' ELSE 'active' END
      )
      ON CONFLICT (project_name) DO UPDATE 
        SET workspace_id = EXCLUDED.workspace_id
      RETURNING id INTO v_parent_id;
    END IF;

    NEW.project_id := v_parent_id;
  END IF;

  -- 2. Check or Auto-Create Module / Sub-project in tb_project_registry
  IF NEW.module IS NOT NULL AND NEW.module <> '' AND NEW.module <> '-' AND NEW.project_id IS NOT NULL THEN
    -- Construct unique project_name for module in format: "Parent Project Name - Module Name"
    v_child_project_name := NEW.project_name || ' - ' || NEW.module;

    SELECT id INTO v_module_id 
    FROM public.tb_project_registry 
    WHERE parent_project_id = NEW.project_id AND (module = NEW.module OR project_name = v_child_project_name OR project_name = NEW.module)
    LIMIT 1;

    IF v_module_id IS NULL THEN
      INSERT INTO public.tb_project_registry (
        project_name,
        module,
        parent_project_id,
        description,
        project_type,
        owner_holding,
        owner_team,
        workspace_id,
        status
      ) VALUES (
        v_child_project_name,
        NEW.module,
        NEW.project_id,
        NEW.project_description,
        'module',
        NEW.holding,
        NEW.department_operator,
        NEW.workspace_id,
        CASE WHEN NEW.is_active = FALSE THEN 'inactive' ELSE 'active' END
      )
      ON CONFLICT (project_name) DO UPDATE 
        SET module = EXCLUDED.module, parent_project_id = EXCLUDED.parent_project_id
      RETURNING id INTO v_module_id;
    END IF;

    NEW.module_id := v_module_id;
  ELSIF NEW.module IS NULL OR NEW.module = '' OR NEW.module = '-' THEN
    NEW.module_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_sync_mapping_project_id ON public.tb_map_project_structure;

CREATE TRIGGER trg_sync_mapping_project_id
BEFORE INSERT OR UPDATE ON public.tb_map_project_structure
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mapping_project_id();

-- 2. Historical Backfill: Insert missing Parent Projects into tb_project_registry
INSERT INTO public.tb_project_registry (
  project_name,
  description,
  project_type,
  owner_holding,
  owner_team,
  workspace_id,
  status
)
SELECT DISTINCT ON (s.project_name)
  s.project_name,
  s.project_description,
  CASE 
    WHEN LOWER(COALESCE(s.project_type, '')) IN ('web_app', 'api', 'mobile', 'desktop', 'integration', 'extension', 'module', 'internal_tool', 'infra', 'other') THEN LOWER(s.project_type)
    ELSE 'other'
  END,
  s.holding,
  s.department_operator,
  s.workspace_id,
  CASE WHEN s.is_active = FALSE THEN 'inactive' ELSE 'active' END
FROM public.tb_map_project_structure s
WHERE s.project_name IS NOT NULL AND s.project_name <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.tb_project_registry r 
    WHERE r.parent_project_id IS NULL AND r.project_name = s.project_name
  )
ORDER BY s.project_name, s.is_active DESC
ON CONFLICT (project_name) DO NOTHING;

-- 3. Historical Backfill: Link project_id on tb_map_project_structure
UPDATE public.tb_map_project_structure s
SET project_id = r.id
FROM public.tb_project_registry r
WHERE (s.project_id IS NULL OR s.project_id <> r.id)
  AND r.parent_project_id IS NULL 
  AND s.project_name = r.project_name;

-- 4. Historical Backfill: Insert missing Modules into tb_project_registry
INSERT INTO public.tb_project_registry (
  project_name,
  module,
  parent_project_id,
  description,
  project_type,
  owner_holding,
  owner_team,
  workspace_id,
  status
)
SELECT DISTINCT ON (s.project_id, s.module)
  (s.project_name || ' - ' || s.module),
  s.module,
  s.project_id,
  s.project_description,
  'module',
  s.holding,
  s.department_operator,
  s.workspace_id,
  CASE WHEN s.is_active = FALSE THEN 'inactive' ELSE 'active' END
FROM public.tb_map_project_structure s
WHERE s.module IS NOT NULL AND s.module <> '' AND s.module <> '-' AND s.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tb_project_registry r 
    WHERE r.parent_project_id = s.project_id AND (r.module = s.module OR r.project_name = (s.project_name || ' - ' || s.module) OR r.project_name = s.module)
  )
ORDER BY s.project_id, s.module, s.is_active DESC
ON CONFLICT (project_name) DO NOTHING;

-- 5. Historical Backfill: Link module_id on tb_map_project_structure
UPDATE public.tb_map_project_structure s
SET module_id = r.id
FROM public.tb_project_registry r
WHERE (s.module_id IS NULL OR s.module_id <> r.id)
  AND s.project_id IS NOT NULL 
  AND r.parent_project_id = s.project_id 
  AND s.module IS NOT NULL 
  AND (r.module = s.module OR r.project_name = (s.project_name || ' - ' || s.module) OR r.project_name = s.module);

COMMIT;
