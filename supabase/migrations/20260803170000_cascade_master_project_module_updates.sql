-- Migration: Cascade Master Project and Module Updates
-- Description: Creates triggers to cascade project_name and module updates 
--              from tb_project_registry and tb_map_project_structure down to col_worklog.

BEGIN;

-- 0. Ensure project_id and module_id exist on tb_map_project_structure
ALTER TABLE public.tb_map_project_structure 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.tb_project_registry(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.tb_project_registry(id) ON DELETE SET NULL;

-- 1. Trigger Function for tb_project_registry
CREATE OR REPLACE FUNCTION public.fn_cascade_project_registry_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Case A: Top-level project_name changed (parent_project_id IS NULL)
  IF OLD.parent_project_id IS NULL AND NEW.project_name IS DISTINCT FROM OLD.project_name THEN
    -- A1. Update child projects in tb_project_registry referencing this parent
    UPDATE public.tb_project_registry
    SET project_name = NEW.project_name
    WHERE parent_project_id = NEW.id;

    -- A2. Update tb_map_project_structure
    UPDATE public.tb_map_project_structure
    SET project_name = NEW.project_name
    WHERE project_id = NEW.id OR project_name = OLD.project_name;

    -- A3. Update col_worklog
    UPDATE public.col_worklog
    SET project_name = NEW.project_name
    WHERE project_id = NEW.id OR project_name = OLD.project_name;
  END IF;

  -- Case B: Sub-project / module level update (parent_project_id IS NOT NULL)
  IF NEW.parent_project_id IS NOT NULL THEN
    -- B1. If module name changed
    IF NEW.module IS DISTINCT FROM OLD.module THEN
      UPDATE public.tb_map_project_structure
      SET module = NEW.module
      WHERE module_id = NEW.id OR (project_name = NEW.project_name AND (OLD.module IS NULL OR module = OLD.module));

      UPDATE public.col_worklog
      SET module = NEW.module
      WHERE module_id = NEW.id OR (project_name = NEW.project_name AND (OLD.module IS NULL OR module = OLD.module));
    END IF;

    -- B2. If project_name on child project changed
    IF NEW.project_name IS DISTINCT FROM OLD.project_name THEN
      UPDATE public.tb_map_project_structure
      SET project_name = NEW.project_name
      WHERE module_id = NEW.id OR project_id = NEW.id;

      UPDATE public.col_worklog
      SET project_name = NEW.project_name
      WHERE module_id = NEW.id OR project_id = NEW.id;
    END IF;
  END IF;

  -- Case C: Direct module field update on top-level project
  IF OLD.parent_project_id IS NULL AND NEW.module IS DISTINCT FROM OLD.module THEN
    UPDATE public.tb_map_project_structure
    SET module = NEW.module
    WHERE project_id = NEW.id OR (project_name = NEW.project_name AND (OLD.module IS NULL OR module = OLD.module));

    UPDATE public.col_worklog
    SET module = NEW.module
    WHERE project_id = NEW.id OR (project_name = NEW.project_name AND (OLD.module IS NULL OR module = OLD.module));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_cascade_project_registry_update ON public.tb_project_registry;

CREATE TRIGGER trg_cascade_project_registry_update
AFTER UPDATE ON public.tb_project_registry
FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_project_registry_update();


-- 2. Trigger Function for tb_map_project_structure
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

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_cascade_mapping_structure_update ON public.tb_map_project_structure;

CREATE TRIGGER trg_cascade_mapping_structure_update
AFTER UPDATE ON public.tb_map_project_structure
FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_mapping_structure_update();


-- 3. Immediate Backfill script to align existing out-of-sync col_worklog rows
UPDATE public.col_worklog w
SET project_name = r.project_name
FROM public.tb_project_registry r
WHERE w.project_id = r.id AND w.project_name <> r.project_name;

UPDATE public.col_worklog w
SET module = r.module
FROM public.tb_project_registry r
WHERE w.module_id = r.id AND (w.module IS NULL OR r.module IS NULL OR w.module <> r.module);

COMMIT;
