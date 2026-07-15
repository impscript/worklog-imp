-- Migration: Add workspace_id to all master and mapping tables
BEGIN;

-- 1. tb_master_holding
ALTER TABLE public.tb_master_holding ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tb_master_holding SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;

-- 2. tb_master_role
ALTER TABLE public.tb_master_role ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tb_master_role SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;

-- 3. tb_master_project_type
ALTER TABLE public.tb_master_project_type ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tb_master_project_type SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;

-- 4. tb_master_action
ALTER TABLE public.tb_master_action ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tb_master_action SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;

-- 5. tb_map_user_role
ALTER TABLE public.tb_map_user_role ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tb_map_user_role SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;

-- 6. tb_map_project_structure
ALTER TABLE public.tb_map_project_structure ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.tb_map_project_structure SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;

-- 7. Update RLS policies for read/write on these tables
-- tb_master_holding
DROP POLICY IF EXISTS "Public read access for master holding" ON public.tb_master_holding;
CREATE POLICY "Read holdings for workspace members or system defaults" ON public.tb_master_holding
  FOR SELECT USING (
    workspace_id IS NULL 
    OR workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Allow write holding for admins" ON public.tb_master_holding;
CREATE POLICY "Write holdings for workspace admins" ON public.tb_master_holding
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_master_role
DROP POLICY IF EXISTS "Public read access for master role" ON public.tb_master_role;
CREATE POLICY "Read roles for workspace members or system defaults" ON public.tb_master_role
  FOR SELECT USING (
    workspace_id IS NULL 
    OR workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Allow write role for admins" ON public.tb_master_role;
CREATE POLICY "Write roles for workspace admins" ON public.tb_master_role
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_master_project_type
DROP POLICY IF EXISTS "Public read access for master project type" ON public.tb_master_project_type;
CREATE POLICY "Read types for workspace members or system defaults" ON public.tb_master_project_type
  FOR SELECT USING (
    workspace_id IS NULL 
    OR workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Allow write type for admins" ON public.tb_master_project_type;
CREATE POLICY "Write types for workspace admins" ON public.tb_master_project_type
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_master_action
DROP POLICY IF EXISTS "Public read access for master action" ON public.tb_master_action;
CREATE POLICY "Read actions for workspace members or system defaults" ON public.tb_master_action
  FOR SELECT USING (
    workspace_id IS NULL 
    OR workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Allow write action for admins" ON public.tb_master_action;
CREATE POLICY "Write actions for workspace admins" ON public.tb_master_action
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_map_user_role
DROP POLICY IF EXISTS "Public read access for map user role" ON public.tb_map_user_role;
CREATE POLICY "Read map user roles for workspace members or system defaults" ON public.tb_map_user_role
  FOR SELECT USING (
    workspace_id IS NULL 
    OR workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Allow write map user role for admins" ON public.tb_map_user_role;
CREATE POLICY "Write map user roles for workspace admins" ON public.tb_map_user_role
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_map_project_structure
DROP POLICY IF EXISTS "Public read access for map project structure" ON public.tb_map_project_structure;
CREATE POLICY "Read map project structures for workspace members or system defaults" ON public.tb_map_project_structure
  FOR SELECT USING (
    workspace_id IS NULL 
    OR workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Allow write map project structure for admins" ON public.tb_map_project_structure;
CREATE POLICY "Write map project structures for workspace admins" ON public.tb_map_project_structure
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

COMMIT;
