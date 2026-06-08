-- =============================================================================
-- Migration: Project and Module ID-Based Mapping
-- Description: Adds project_id and module_id to col_worklog and tb_map_project_structure.
--              Includes backfilling script and BEFORE triggers to maintain 
--              two-way compatibility (Names <-> IDs).
-- =============================================================================

-- 1. Add Columns to tb_map_project_structure
ALTER TABLE public.tb_map_project_structure 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.tb_project_registry(id) ON DELETE SET NULL;

-- 2. Add Columns to col_worklog
ALTER TABLE public.col_worklog 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.tb_project_registry(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.tb_project_registry(id) ON DELETE SET NULL;

-- 3. Backfill mapping table ids
UPDATE public.tb_map_project_structure s
SET project_id = r.id
FROM public.tb_project_registry r
WHERE s.project_name = r.project_name AND r.parent_project_id IS NULL;

-- 4. Backfill worklog table ids
-- 4.1 Update project_id first
UPDATE public.col_worklog w
SET project_id = r.id
FROM public.tb_project_registry r
WHERE w.project_name = r.project_name AND r.parent_project_id IS NULL;

-- 4.2 Update module_id
UPDATE public.col_worklog w
SET module_id = r.id
FROM public.tb_project_registry r
WHERE w.project_id = r.parent_project_id 
  AND w.module = r.module
  AND r.parent_project_id IS NOT NULL;

-- 5. Trigger Function for tb_map_project_structure
CREATE OR REPLACE FUNCTION public.fn_sync_mapping_project_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NULL AND NEW.project_name IS NOT NULL THEN
    SELECT id INTO NEW.project_id 
    FROM public.tb_project_registry 
    WHERE project_name = NEW.project_name AND parent_project_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_mapping_project_id ON public.tb_map_project_structure;

CREATE TRIGGER trg_sync_mapping_project_id
BEFORE INSERT OR UPDATE ON public.tb_map_project_structure
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mapping_project_id();

-- 6. Trigger Function for col_worklog (Names <-> IDs bidirectional sync)
CREATE OR REPLACE FUNCTION public.fn_sync_worklog_project_ids()
RETURNS TRIGGER AS $$
BEGIN
  -- 6.1 If project_id is provided, but project_name is NULL (new style write)
  IF NEW.project_id IS NOT NULL AND NEW.project_name IS NULL THEN
    SELECT project_name INTO NEW.project_name 
    FROM public.tb_project_registry 
    WHERE id = NEW.project_id;
  END IF;

  -- 6.2 If project_name is provided, but project_id is NULL (legacy style write)
  IF NEW.project_id IS NULL AND NEW.project_name IS NOT NULL THEN
    SELECT id INTO NEW.project_id 
    FROM public.tb_project_registry 
    WHERE project_name = NEW.project_name AND parent_project_id IS NULL;
  END IF;

  -- 6.3 If module_id is provided, but module is NULL (new style write)
  IF NEW.module_id IS NOT NULL AND NEW.module IS NULL THEN
    SELECT module INTO NEW.module 
    FROM public.tb_project_registry 
    WHERE id = NEW.module_id;
  END IF;

  -- 6.4 If module is provided (not empty or '-'), but module_id is NULL
  IF NEW.module_id IS NULL AND NEW.module IS NOT NULL AND NEW.module <> '' AND NEW.module <> '-' AND NEW.project_id IS NOT NULL THEN
    SELECT id INTO NEW.module_id 
    FROM public.tb_project_registry 
    WHERE parent_project_id = NEW.project_id AND module = NEW.module;
  END IF;

  -- 6.5 Normalize empty modules to NULL
  IF NEW.module IS NULL OR NEW.module = '' OR NEW.module = '-' THEN
    NEW.module_id := NULL;
    NEW.module := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_worklog_project_ids ON public.col_worklog;

CREATE TRIGGER trg_sync_worklog_project_ids
BEFORE INSERT OR UPDATE ON public.col_worklog
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_worklog_project_ids();
