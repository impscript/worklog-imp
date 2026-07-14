-- =============================================================================
-- Migration: Open RLS Policies to Support Tokenless SSO Client-Side Auth
-- =============================================================================

-- 1. Clean up existing auth.uid() dependent policies
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

-- 2. Create recursion-free open RLS policies (relying on client-side workspace/user filters)

-- workspaces table
CREATE POLICY "Allow select workspaces for all" ON public.workspaces
  FOR SELECT USING (true);

CREATE POLICY "Allow manage workspaces for all" ON public.workspaces
  FOR ALL USING (true);

-- workspace_users table
CREATE POLICY "Allow select workspace_users for all" ON public.workspace_users
  FOR SELECT USING (true);

CREATE POLICY "Allow manage workspace_users for all" ON public.workspace_users
  FOR ALL USING (true);

-- col_worklog table
CREATE POLICY "Allow select col_worklog for all" ON public.col_worklog
  FOR SELECT USING (true);

CREATE POLICY "Allow manage col_worklog for all" ON public.col_worklog
  FOR ALL USING (true);

-- tb_project_registry table
CREATE POLICY "Allow select tb_project_registry for all" ON public.tb_project_registry
  FOR SELECT USING (true);

CREATE POLICY "Allow manage tb_project_registry for all" ON public.tb_project_registry
  FOR ALL USING (true);

-- tb_workspace_prompt_draft table
CREATE POLICY "Allow select drafts for all" ON public.tb_workspace_prompt_draft
  FOR SELECT USING (true);

CREATE POLICY "Allow manage drafts for all" ON public.tb_workspace_prompt_draft
  FOR ALL USING (true);
