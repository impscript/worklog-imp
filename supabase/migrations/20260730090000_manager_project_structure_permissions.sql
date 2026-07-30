-- Helper function to check if current user is workspace admin or manager
CREATE OR REPLACE FUNCTION app_security.is_workspace_admin_or_manager(target_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, app_security AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_users wu 
    JOIN public.users u ON u.id = wu.user_id 
    WHERE wu.workspace_id = target_workspace_id 
      AND wu.role IN ('admin', 'manager') 
      AND u.auth_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION app_security.is_workspace_admin_or_manager(UUID) TO authenticated;

-- Update write policy on tb_map_project_structure to allow workspace admins and managers
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
