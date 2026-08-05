-- Migration: Ensure project_id and module_id exist on tb_map_project_structure and fix cascade trigger
-- Fixes: record "new" has no field "module_id" when updating rows in tb_map_project_structure

BEGIN;

-- 1. Ensure project_id and module_id columns exist on tb_map_project_structure
ALTER TABLE public.tb_map_project_structure 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.tb_project_registry(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.tb_project_registry(id) ON DELETE SET NULL;

-- 2. Backfill project_id and module_id on tb_map_project_structure if null
UPDATE public.tb_map_project_structure s
SET project_id = r.id
FROM public.tb_project_registry r
WHERE s.project_id IS NULL 
  AND r.parent_project_id IS NULL 
  AND s.project_name = r.project_name;

UPDATE public.tb_map_project_structure s
SET module_id = r.id
FROM public.tb_project_registry r
WHERE s.module_id IS NULL 
  AND s.project_id IS NOT NULL 
  AND r.parent_project_id = s.project_id 
  AND s.module IS NOT NULL 
  AND s.module = r.module;

-- 3. Sync trigger to maintain project_id & module_id on tb_map_project_structure inserts/updates
CREATE OR REPLACE FUNCTION public.fn_sync_mapping_project_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NULL AND NEW.project_name IS NOT NULL THEN
    SELECT id INTO NEW.project_id 
    FROM public.tb_project_registry 
    WHERE project_name = NEW.project_name AND parent_project_id IS NULL;
  END IF;

  IF NEW.module_id IS NULL AND NEW.module IS NOT NULL AND NEW.module <> '' AND NEW.module <> '-' AND NEW.project_id IS NOT NULL THEN
    SELECT id INTO NEW.module_id 
    FROM public.tb_project_registry 
    WHERE parent_project_id = NEW.project_id AND module = NEW.module;
  END IF;

  IF NEW.module IS NULL OR NEW.module = '' OR NEW.module = '-' THEN
    NEW.module_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_mapping_project_id ON public.tb_map_project_structure;

CREATE TRIGGER trg_sync_mapping_project_id
BEFORE INSERT OR UPDATE ON public.tb_map_project_structure
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mapping_project_id();

-- 4. Re-create fn_cascade_mapping_structure_update safely
CREATE OR REPLACE FUNCTION public.fn_cascade_mapping_structure_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.project_name IS DISTINCT FROM NEW.project_name) OR (OLD.module IS DISTINCT FROM NEW.module) THEN
    -- Update col_worklog matching project_id, module_id, or matching project_name/module
    IF NEW.project_id IS NOT NULL AND NEW.module_id IS NOT NULL THEN
      UPDATE public.col_worklog
      SET project_name = NEW.project_name,
          module = NEW.module
      WHERE project_id = NEW.project_id AND module_id = NEW.module_id;
    ELSIF NEW.project_id IS NOT NULL THEN
      UPDATE public.col_worklog
      SET project_name = NEW.project_name,
          module = NEW.module
      WHERE project_id = NEW.project_id AND (OLD.module IS NULL OR module = OLD.module);
    ELSE
      UPDATE public.col_worklog
      SET project_name = NEW.project_name,
          module = NEW.module
      WHERE project_name = OLD.project_name AND (OLD.module IS NULL OR module = OLD.module);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cascade_mapping_structure_update ON public.tb_map_project_structure;

CREATE TRIGGER trg_cascade_mapping_structure_update
AFTER UPDATE ON public.tb_map_project_structure
FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_mapping_structure_update();

COMMIT;
