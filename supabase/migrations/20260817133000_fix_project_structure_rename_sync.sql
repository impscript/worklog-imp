-- Migration: Fix Project Structure rename sync
-- Description:
--   Preserve existing project_id/module_id when tb_map_project_structure is renamed.
--   A rename must update the linked registry/worklog records instead of creating a new registry project.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_project_registry_is_empty_shell(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (SELECT 1 FROM public.tb_project_registry WHERE parent_project_id = p_project_id)
    AND NOT EXISTS (SELECT 1 FROM public.col_worklog WHERE project_id = p_project_id)
    AND NOT EXISTS (SELECT 1 FROM public.tb_project_notes WHERE project_id = p_project_id)
    AND NOT EXISTS (SELECT 1 FROM public.tb_project_documents WHERE project_id = p_project_id)
    AND NOT EXISTS (SELECT 1 FROM public.tb_project_secrets WHERE project_id = p_project_id)
    AND NOT EXISTS (SELECT 1 FROM public.tb_project_team_contribution WHERE project_id = p_project_id)
    AND NOT EXISTS (SELECT 1 FROM public.tb_project_milestones WHERE project_id = p_project_id)
    AND NOT EXISTS (SELECT 1 FROM public.tb_project_cost_savings WHERE project_id = p_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_merge_empty_project_shell(
  p_shell_project_id UUID,
  p_target_project_id UUID
)
RETURNS VOID AS $$
BEGIN
  IF p_shell_project_id IS NULL OR p_target_project_id IS NULL OR p_shell_project_id = p_target_project_id THEN
    RETURN;
  END IF;

  IF NOT public.fn_project_registry_is_empty_shell(p_shell_project_id) THEN
    RAISE EXCEPTION 'Cannot merge project %, target name already exists and has related data', p_shell_project_id
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.tb_map_project_structure
  SET project_id = p_target_project_id
  WHERE project_id = p_shell_project_id;

  UPDATE public.col_worklog
  SET project_id = p_target_project_id
  WHERE project_id = p_shell_project_id;

  DELETE FROM public.tb_project_registry
  WHERE id = p_shell_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_sync_mapping_project_id()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_id UUID;
  v_module_id UUID;
  v_existing_id UUID;
  v_mapped_project_type TEXT;
  v_child_project_name TEXT;
BEGIN
  -- When this row is being updated by a registry cascade, do not bounce the update back.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  v_mapped_project_type := CASE
    WHEN LOWER(COALESCE(NEW.project_type, '')) IN ('web_app', 'api', 'mobile', 'desktop', 'integration', 'extension', 'module', 'internal_tool', 'infra', 'other') THEN LOWER(NEW.project_type)
    ELSE 'other'
  END;

  -- Rename path: keep the linked project_id and rename that registry row.
  IF TG_OP = 'UPDATE'
    AND OLD.project_name IS DISTINCT FROM NEW.project_name
    AND COALESCE(NEW.project_id, OLD.project_id) IS NOT NULL THEN

    v_parent_id := COALESCE(NEW.project_id, OLD.project_id);

    SELECT id INTO v_existing_id
    FROM public.tb_project_registry
    WHERE project_name = NEW.project_name
      AND parent_project_id IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL AND v_existing_id <> v_parent_id THEN
      PERFORM public.fn_merge_empty_project_shell(v_existing_id, v_parent_id);
    END IF;

    UPDATE public.tb_project_registry
    SET project_name = NEW.project_name,
        description = COALESCE(NEW.project_description, description),
        project_type = CASE
          WHEN LOWER(COALESCE(NEW.project_type, '')) IN ('web_app', 'api', 'mobile', 'desktop', 'integration', 'extension', 'module', 'internal_tool', 'infra', 'other') THEN v_mapped_project_type
          ELSE project_type
        END,
        owner_holding = NEW.holding,
        owner_team = NEW.department_operator,
        workspace_id = COALESCE(NEW.workspace_id, workspace_id),
        status = CASE WHEN NEW.is_active = FALSE THEN 'inactive' ELSE 'active' END,
        updated_at = now()
    WHERE id = v_parent_id
      AND parent_project_id IS NULL;

    NEW.project_id := v_parent_id;
  ELSIF NEW.project_name IS NOT NULL AND NEW.project_name <> '' THEN
    -- Normal insert/link path: only create a registry row when there is no project_id to preserve.
    IF NEW.project_id IS NOT NULL THEN
      v_parent_id := NEW.project_id;
    ELSE
      SELECT id INTO v_parent_id
      FROM public.tb_project_registry
      WHERE project_name = NEW.project_name
        AND parent_project_id IS NULL
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
  END IF;

  -- Module/sub-project path.
  IF NEW.module IS NOT NULL AND NEW.module <> '' AND NEW.module <> '-' AND NEW.project_id IS NOT NULL THEN
    v_child_project_name := NEW.project_name || ' - ' || NEW.module;

    IF TG_OP = 'UPDATE'
      AND (OLD.module IS DISTINCT FROM NEW.module OR OLD.project_name IS DISTINCT FROM NEW.project_name)
      AND COALESCE(NEW.module_id, OLD.module_id) IS NOT NULL THEN

      v_module_id := COALESCE(NEW.module_id, OLD.module_id);

      UPDATE public.tb_project_registry
      SET project_name = v_child_project_name,
          module = NEW.module,
          parent_project_id = NEW.project_id,
          description = COALESCE(NEW.project_description, description),
          project_type = 'module',
          owner_holding = NEW.holding,
          owner_team = NEW.department_operator,
          workspace_id = COALESCE(NEW.workspace_id, workspace_id),
          status = CASE WHEN NEW.is_active = FALSE THEN 'inactive' ELSE 'active' END,
          updated_at = now()
      WHERE id = v_module_id;

      NEW.module_id := v_module_id;
    ELSE
      IF NEW.module_id IS NOT NULL THEN
        v_module_id := NEW.module_id;
      ELSE
        SELECT id INTO v_module_id
        FROM public.tb_project_registry
        WHERE parent_project_id = NEW.project_id
          AND (module = NEW.module OR project_name = v_child_project_name OR project_name = NEW.module)
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
            SET module = EXCLUDED.module,
                parent_project_id = EXCLUDED.parent_project_id
          RETURNING id INTO v_module_id;
        END IF;

        NEW.module_id := v_module_id;
      END IF;
    END IF;
  ELSIF NEW.module IS NULL OR NEW.module = '' OR NEW.module = '-' THEN
    NEW.module_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_cascade_project_registry_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Mapping-trigger initiated registry updates are already handled by the mapping cascade.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Top-level project rename.
  IF OLD.parent_project_id IS NULL AND NEW.project_name IS DISTINCT FROM OLD.project_name THEN
    UPDATE public.tb_project_registry
    SET project_name = CASE
          WHEN module IS NOT NULL AND module <> '' AND module <> '-' THEN NEW.project_name || ' - ' || module
          ELSE NEW.project_name
        END,
        updated_at = now()
    WHERE parent_project_id = NEW.id;

    UPDATE public.tb_map_project_structure
    SET project_name = NEW.project_name
    WHERE project_id = NEW.id OR project_name = OLD.project_name;

    UPDATE public.col_worklog
    SET project_name = NEW.project_name
    WHERE project_id = NEW.id OR project_name = OLD.project_name;
  END IF;

  -- Child/module rename.
  IF NEW.parent_project_id IS NOT NULL THEN
    IF NEW.module IS DISTINCT FROM OLD.module THEN
      UPDATE public.tb_map_project_structure
      SET module = NEW.module
      WHERE module_id = NEW.id
         OR (project_id = NEW.parent_project_id AND (OLD.module IS NULL OR module = OLD.module));

      UPDATE public.col_worklog
      SET module = NEW.module
      WHERE module_id = NEW.id
         OR (project_id = NEW.parent_project_id AND (OLD.module IS NULL OR module = OLD.module));
    END IF;

    IF NEW.project_name IS DISTINCT FROM OLD.project_name THEN
      UPDATE public.col_worklog
      SET project_name = NEW.project_name
      WHERE module_id = NEW.id OR project_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_cascade_mapping_structure_update()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF (OLD.project_name IS DISTINCT FROM NEW.project_name) OR (OLD.module IS DISTINCT FROM NEW.module) THEN
    IF NEW.project_id IS NOT NULL AND OLD.project_name IS DISTINCT FROM NEW.project_name THEN
      UPDATE public.tb_map_project_structure
      SET project_name = NEW.project_name
      WHERE project_id = NEW.project_id
        AND id <> NEW.id
        AND project_name IS DISTINCT FROM NEW.project_name;

      UPDATE public.tb_project_registry
      SET project_name = CASE
            WHEN module IS NOT NULL AND module <> '' AND module <> '-' THEN NEW.project_name || ' - ' || module
            ELSE project_name
          END,
          updated_at = now()
      WHERE parent_project_id = NEW.project_id;
    END IF;

    IF NEW.module_id IS NOT NULL THEN
      UPDATE public.tb_project_registry
      SET project_name = CASE
            WHEN NEW.module IS NOT NULL AND NEW.module <> '' AND NEW.module <> '-' THEN NEW.project_name || ' - ' || NEW.module
            ELSE NEW.project_name
          END,
          module = NULLIF(NEW.module, ''),
          parent_project_id = NEW.project_id,
          updated_at = now()
      WHERE id = NEW.module_id;
    END IF;

    IF NEW.project_id IS NOT NULL AND NEW.module_id IS NOT NULL THEN
      UPDATE public.col_worklog
      SET project_name = NEW.project_name,
          module = NEW.module,
          module_id = NEW.module_id
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

DROP TRIGGER IF EXISTS trg_sync_mapping_project_id ON public.tb_map_project_structure;
CREATE TRIGGER trg_sync_mapping_project_id
BEFORE INSERT OR UPDATE ON public.tb_map_project_structure
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mapping_project_id();

DROP TRIGGER IF EXISTS trg_cascade_project_registry_update ON public.tb_project_registry;
CREATE TRIGGER trg_cascade_project_registry_update
AFTER UPDATE ON public.tb_project_registry
FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_project_registry_update();

DROP TRIGGER IF EXISTS trg_cascade_mapping_structure_update ON public.tb_map_project_structure;
CREATE TRIGGER trg_cascade_mapping_structure_update
AFTER UPDATE ON public.tb_map_project_structure
FOR EACH ROW EXECUTE FUNCTION public.fn_cascade_mapping_structure_update();

COMMIT;
