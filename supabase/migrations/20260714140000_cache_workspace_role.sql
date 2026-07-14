-- =============================================================================
-- Migration: Cache Workspace Role in Users Table to Eliminate RLS Recursion
-- =============================================================================

-- 1. Add workspace_role column to users table
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS workspace_role TEXT DEFAULT 'user' CHECK (workspace_role IN ('admin', 'manager', 'user'));

-- 2. Populate workspace_role from workspace_users
UPDATE public.users u
SET workspace_role = wu.role
FROM public.workspace_users wu
WHERE u.id = wu.user_id AND u.active_workspace_id = wu.workspace_id;

-- 3. Clean up helper functions and policies
DROP FUNCTION IF EXISTS public.get_active_workspace(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_workspace_role(UUID, UUID) CASCADE;

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

-- 4. Re-create new, recursion-free RLS policies using subqueries on public.users table

-- workspaces table
CREATE POLICY "Allow select workspaces users belong to" ON public.workspaces
  FOR SELECT USING (
    id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow workspaces update for workspace admins" ON public.workspaces
  FOR UPDATE USING (
    (id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid()) 
     AND (SELECT workspace_role FROM public.users WHERE id = auth.uid()) = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- workspace_users table
CREATE POLICY "Allow select members of your workspaces" ON public.workspace_users
  FOR SELECT USING (
    workspace_id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage members for workspace admins" ON public.workspace_users
  FOR ALL USING (
    (workspace_id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid()) 
     AND (SELECT workspace_role FROM public.users WHERE id = auth.uid()) = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- col_worklog table
CREATE POLICY "Allow select worklogs of active workspaces" ON public.col_worklog
  FOR SELECT USING (
    workspace_id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow all operations for workspace members on col_worklog" ON public.col_worklog
  FOR ALL USING (
    workspace_id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_project_registry table
CREATE POLICY "Allow select projects of active workspaces" ON public.tb_project_registry
  FOR SELECT USING (
    workspace_id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage projects for workspace admins/managers" ON public.tb_project_registry
  FOR ALL USING (
    (workspace_id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid()) 
     AND (SELECT workspace_role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'))
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_workspace_prompt_draft table
CREATE POLICY "Allow select drafts for workspace admins" ON public.tb_workspace_prompt_draft
  FOR SELECT USING (
    (workspace_id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid()) 
     AND (SELECT workspace_role FROM public.users WHERE id = auth.uid()) = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage drafts for workspace admins" ON public.tb_workspace_prompt_draft
  FOR ALL USING (
    (workspace_id = (SELECT active_workspace_id FROM public.users WHERE id = auth.uid()) 
     AND (SELECT workspace_role FROM public.users WHERE id = auth.uid()) = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
