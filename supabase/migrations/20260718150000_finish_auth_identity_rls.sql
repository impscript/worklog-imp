-- Align master, mapping, template, and audit policies with mapped Supabase Auth identity.
DROP POLICY IF EXISTS "Read holdings for workspace members or system defaults" ON public.tb_master_holding;
DROP POLICY IF EXISTS "Write holdings for workspace admins" ON public.tb_master_holding;
DROP POLICY IF EXISTS "Read roles for workspace members or system defaults" ON public.tb_master_role;
DROP POLICY IF EXISTS "Write roles for workspace admins" ON public.tb_master_role;
DROP POLICY IF EXISTS "Read types for workspace members or system defaults" ON public.tb_master_project_type;
DROP POLICY IF EXISTS "Write types for workspace admins" ON public.tb_master_project_type;
DROP POLICY IF EXISTS "Read actions for workspace members or system defaults" ON public.tb_master_action;
DROP POLICY IF EXISTS "Write actions for workspace admins" ON public.tb_master_action;
DROP POLICY IF EXISTS "Read map user roles for workspace members or system defaults" ON public.tb_map_user_role;
DROP POLICY IF EXISTS "Write map user roles for workspace admins" ON public.tb_map_user_role;
DROP POLICY IF EXISTS "Read map project structures for workspace members or system def" ON public.tb_map_project_structure;
DROP POLICY IF EXISTS "Write map project structures for workspace admins" ON public.tb_map_project_structure;

CREATE POLICY "Auth members read holdings" ON public.tb_master_holding FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth admins write holdings" ON public.tb_master_holding FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth members read roles" ON public.tb_master_role FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth admins write roles" ON public.tb_master_role FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth members read project types" ON public.tb_master_project_type FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth admins write project types" ON public.tb_master_project_type FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth members read actions" ON public.tb_master_action FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth admins write actions" ON public.tb_master_action FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth members read user maps" ON public.tb_map_user_role FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth admins write user maps" ON public.tb_map_user_role FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth members read project maps" ON public.tb_map_project_structure FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Auth admins write project maps" ON public.tb_map_project_structure FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());

DROP POLICY IF EXISTS "Workspace admins can read audit log" ON public.tb_audit_log;
CREATE POLICY "Workspace admins can read audit log" ON public.tb_audit_log FOR SELECT USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());
