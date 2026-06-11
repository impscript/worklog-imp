-- 1. Add worklog_project_type column to tb_project_registry
ALTER TABLE public.tb_project_registry 
ADD COLUMN IF NOT EXISTS worklog_project_type TEXT REFERENCES public.tb_master_project_type(type_name) ON DELETE SET NULL;

-- 2. Update trigger function fn_sync_worklog_project_ids to match project_type
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
    WHERE parent_project_id = NEW.project_id 
      AND module = NEW.module
      AND (worklog_project_type IS NULL OR worklog_project_type = NEW.project_type);
  END IF;

  -- 6.5 Normalize empty modules to NULL
  IF NEW.module IS NULL OR NEW.module = '' OR NEW.module = '-' THEN
    NEW.module_id := NULL;
    NEW.module := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
