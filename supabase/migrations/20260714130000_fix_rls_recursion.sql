-- =============================================================================
-- Migration: Fix RLS Infinite Recursion using SECURITY DEFINER functions
-- =============================================================================

-- 1. Create helper functions that run with SECURITY DEFINER to bypass RLS evaluation
CREATE OR REPLACE FUNCTION public.get_active_workspace(usr_id UUID)
RETURNS UUID SECURITY DEFINER AS $$
  SELECT active_workspace_id FROM public.users WHERE id = usr_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION public.get_workspace_role(usr_id UUID, ws_id UUID)
RETURNS TEXT SECURITY DEFINER AS $$
  SELECT role FROM public.workspace_users WHERE user_id = usr_id AND workspace_id = ws_id;
$$ LANGUAGE sql;

-- 2. Clean up existing recursive policies
DROP POLICY IF EXISTS "Allow select workspaces users belong to" ON public.workspaces;
DROP POLICY IF EXISTS "Allow workspaces update for workspace admins" ON public.workspaces;
DROP POLICY IF EXISTS "Allow select members of your workspaces" ON public.workspace_users;
DROP POLICY IF EXISTS "Allow manage members for workspace admins" ON public.workspace_users;
DROP POLICY IF EXISTS "Allow select worklogs of active workspaces" ON public.col_worklog;
DROP POLICY IF EXISTS "Allow all operations for workspace members on col_worklog" ON public.col_worklog;
DROP POLICY IF EXISTS "Allow select projects of active workspaces" ON public.tb_project_registry;
DROP POLICY IF EXISTS "Allow manage projects for workspace admins/managers" ON public.tb_project_registry;
DROP POLICY IF EXISTS "Allow select drafts for workspace admins" ON public.tb_workspace_prompt_draft;
DROP POLICY IF EXISTS "Allow manage drafts for workspace admins" ON public.tb_workspace_prompt_draft;

-- 3. Re-create new, clean RLS policies with recursion-free checks

-- workspaces table
CREATE POLICY "Allow select workspaces users belong to" ON public.workspaces
  FOR SELECT USING (
    id = public.get_active_workspace(auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow workspaces update for workspace admins" ON public.workspaces
  FOR UPDATE USING (
    (id = public.get_active_workspace(auth.uid()) AND public.get_workspace_role(auth.uid(), id) = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- workspace_users table
CREATE POLICY "Allow select members of your workspaces" ON public.workspace_users
  FOR SELECT USING (
    workspace_id = public.get_active_workspace(auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage members for workspace admins" ON public.workspace_users
  FOR ALL USING (
    (workspace_id = public.get_active_workspace(auth.uid()) AND public.get_workspace_role(auth.uid(), workspace_id) = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- col_worklog table
CREATE POLICY "Allow select worklogs of active workspaces" ON public.col_worklog
  FOR SELECT USING (
    workspace_id = public.get_active_workspace(auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow all operations for workspace members on col_worklog" ON public.col_worklog
  FOR ALL USING (
    workspace_id = public.get_active_workspace(auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_project_registry table
CREATE POLICY "Allow select projects of active workspaces" ON public.tb_project_registry
  FOR SELECT USING (
    workspace_id = public.get_active_workspace(auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage projects for workspace admins/managers" ON public.tb_project_registry
  FOR ALL USING (
    (workspace_id = public.get_active_workspace(auth.uid()) AND public.get_workspace_role(auth.uid(), workspace_id) IN ('admin', 'manager'))
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_workspace_prompt_draft table
CREATE POLICY "Allow select drafts for workspace admins" ON public.tb_workspace_prompt_draft
  FOR SELECT USING (
    (workspace_id = public.get_active_workspace(auth.uid()) AND public.get_workspace_role(auth.uid(), workspace_id) = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage drafts for workspace admins" ON public.tb_workspace_prompt_draft
  FOR ALL USING (
    (workspace_id = public.get_active_workspace(auth.uid()) AND public.get_workspace_role(auth.uid(), workspace_id) = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
