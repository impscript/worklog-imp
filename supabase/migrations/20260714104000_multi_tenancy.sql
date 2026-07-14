-- =============================================================================
-- Migration: Multi-Tenancy & Workspace Isolation Setup
-- =============================================================================

-- 1. Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_name TEXT UNIQUE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create workspace_users mapping table (RBAC roles)
CREATE TABLE IF NOT EXISTS public.workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- 3. Add workspace_id column to core entities
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS active_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outlook_calendar_url TEXT;

ALTER TABLE public.col_worklog 
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.tb_project_registry 
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 4. Create HRMS mapping and exceptions tables
CREATE TABLE IF NOT EXISTS public.tb_hrms_mapping_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hrms_bu_working TEXT NOT NULL,
  hrms_line_of_work TEXT NOT NULL,
  mapped_workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  UNIQUE(hrms_bu_working, hrms_line_of_work)
);

CREATE TABLE IF NOT EXISTS public.tb_onboarding_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id TEXT NOT NULL,
  email TEXT,
  full_name TEXT NOT NULL,
  hrms_bu_working TEXT,
  hrms_line_of_work TEXT,
  position TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tb_workspace_prompt_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  prompt_name TEXT NOT NULL,
  prompt_content TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_worklog_workspace_date ON public.col_worklog (workspace_id, work_date);
CREATE INDEX IF NOT EXISTS idx_project_registry_workspace ON public.tb_project_registry (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user ON public.workspace_users (user_id);

-- 6. Clean up old permissive RLS policies
DROP POLICY IF EXISTS "Allow full access to col_worklog for dev" ON public.col_worklog;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.tb_project_registry;
DROP POLICY IF EXISTS "Allow authenticated write" ON public.tb_project_registry;

-- 7. Enable RLS on new tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_hrms_mapping_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_onboarding_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_workspace_prompt_draft ENABLE ROW LEVEL SECURITY;

-- 8. Define Tenant-Based RLS Policies

-- workspaces policies
CREATE POLICY "Allow select workspaces users belong to" ON public.workspaces
  FOR SELECT USING (
    id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow workspaces update for workspace admins" ON public.workspaces
  FOR UPDATE USING (
    id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- workspace_users policies
CREATE POLICY "Allow select members of your workspaces" ON public.workspace_users
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage members for workspace admins" ON public.workspace_users
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- col_worklog policies
CREATE POLICY "Allow select worklogs of active workspaces" ON public.col_worklog
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow all operations for workspace members on col_worklog" ON public.col_worklog
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_project_registry policies
CREATE POLICY "Allow select projects of active workspaces" ON public.tb_project_registry
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage projects for workspace admins/managers" ON public.tb_project_registry
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_hrms_mapping_rule policies
CREATE POLICY "Allow select rules for authenticated users" ON public.tb_hrms_mapping_rule
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write rules for super admins" ON public.tb_hrms_mapping_rule
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_onboarding_exceptions policies
CREATE POLICY "Allow read/write exceptions for super admins" ON public.tb_onboarding_exceptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- tb_workspace_prompt_draft policies
CREATE POLICY "Allow select drafts for workspace admins" ON public.tb_workspace_prompt_draft
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow manage drafts for workspace admins" ON public.tb_workspace_prompt_draft
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
