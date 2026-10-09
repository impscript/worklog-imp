-- Migration: Fix Project Structure RLS permissions for Workspace Admins & Managers
-- Description:
-- 1. Updates app_security.is_workspace_admin_or_manager(target_workspace_id UUID)
--    so that when target_workspace_id IS NULL (global master data, e.g. company-wide tb_map_project_structure),
--    any authenticated user who is an admin or manager in at least one workspace is authorized.
--    When target_workspace_id IS NOT NULL, it strictly enforces that the user must be
--    an admin or manager of that specific workspace.
-- 2. Grants EXECUTE on app_security.is_workspace_admin_or_manager to anon, authenticated, public.
-- 3. Re-applies write policy on public.tb_map_project_structure to ensure both global (workspace_id IS NULL)
--    and tenant-scoped structures can be managed by workspace admins/managers and super admins.

BEGIN;

CREATE OR REPLACE FUNCTION app_security.is_workspace_admin_or_manager(target_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, app_security AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_users wu 
    JOIN public.users u ON u.id = wu.user_id 
    WHERE (target_workspace_id IS NULL OR wu.workspace_id = target_workspace_id)
      AND wu.role IN ('admin', 'manager') 
      AND u.auth_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION app_security.is_workspace_admin_or_manager(UUID) TO anon, authenticated, public;

DROP POLICY IF EXISTS "Auth admins write project maps" ON public.tb_map_project_structure;
DROP POLICY IF EXISTS "Auth admins or managers write project maps" ON public.tb_map_project_structure;

CREATE POLICY "Auth admins or managers write project maps" ON public.tb_map_project_structure 
FOR ALL 
USING (
  app_security.is_workspace_admin_or_manager(workspace_id) OR app_security.current_user_is_admin()
) 
WITH CHECK (
  app_security.is_workspace_admin_or_manager(workspace_id) OR app_security.current_user_is_admin()
);

COMMIT;
