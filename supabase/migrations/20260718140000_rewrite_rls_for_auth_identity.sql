-- Replace tokenless policies with policies based on the mapped Supabase Auth identity.
CREATE OR REPLACE FUNCTION app_security.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, app_security AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_users wu JOIN public.users u ON u.id = wu.user_id WHERE wu.workspace_id = target_workspace_id AND u.auth_user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION app_security.is_workspace_admin(target_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, app_security AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_users wu JOIN public.users u ON u.id = wu.user_id WHERE wu.workspace_id = target_workspace_id AND wu.role = 'admin' AND u.auth_user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION app_security.current_user_is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, app_security AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'admin');
$$;

GRANT EXECUTE ON FUNCTION app_security.is_workspace_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_security.is_workspace_admin(UUID) TO anon, authenticated;

-- Users: only the mapped profile or a global admin can read/update profiles.
DROP POLICY IF EXISTS "Users read self or admin reads all" ON public.users;
CREATE POLICY "Users read self or admin reads all" ON public.users FOR SELECT USING (auth_user_id = auth.uid() OR app_security.current_user_is_admin());
DROP POLICY IF EXISTS "Users update self or admin" ON public.users;
CREATE POLICY "Users update self or admin" ON public.users FOR UPDATE USING (auth_user_id = auth.uid() OR app_security.current_user_is_admin()) WITH CHECK (auth_user_id = auth.uid() OR app_security.current_user_is_admin());

-- Workspace core.
DROP POLICY IF EXISTS "Members read own workspaces" ON public.workspaces;
CREATE POLICY "Members read own workspaces" ON public.workspaces FOR SELECT USING (app_security.is_workspace_member(id) OR app_security.current_user_is_admin());
DROP POLICY IF EXISTS "Admins manage workspaces" ON public.workspaces;
CREATE POLICY "Admins manage workspaces" ON public.workspaces FOR ALL USING (app_security.current_user_is_admin()) WITH CHECK (app_security.current_user_is_admin());
DROP POLICY IF EXISTS "Members read own workspace_users" ON public.workspace_users;
CREATE POLICY "Members read own workspace_users" ON public.workspace_users FOR SELECT USING (app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
DROP POLICY IF EXISTS "Admins manage workspace_users" ON public.workspace_users;
CREATE POLICY "Admins manage workspace_users" ON public.workspace_users FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());

-- Worklogs and projects.
CREATE POLICY "Members read own worklogs" ON public.col_worklog FOR SELECT USING (app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Members manage own worklogs" ON public.col_worklog FOR ALL USING (app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Members read own projects" ON public.tb_project_registry FOR SELECT USING (app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
CREATE POLICY "Admins manage own projects" ON public.tb_project_registry FOR ALL USING (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin()) WITH CHECK (app_security.is_workspace_admin(workspace_id) OR app_security.current_user_is_admin());
