-- =============================================================================
-- Migration: Merge IMP and IT Workspaces into a Single Unified Workspace
-- =============================================================================

-- 1. Rename workspace a59b2075-8ce6-4b95-a4df-1e8ea36a0001 to a unified name
UPDATE public.workspaces
SET workspace_name = 'Improvement & Digital Innovation (IMP&IT)',
    invite_code = 'IMP-IT-99'
WHERE id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

-- 2. Update HRMS mapping rules so both map to the same workspace (a59b2075-8ce6-4b95-a4df-1e8ea36a0001)
UPDATE public.tb_hrms_mapping_rule
SET mapped_workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
WHERE mapped_workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002';

-- 3. Move all members from old IT Workspace to unified workspace
-- First update their workspace_users entries (ignoring conflicts if they are already in both)
INSERT INTO public.workspace_users (workspace_id, user_id, role)
SELECT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'::uuid, user_id, role
FROM public.workspace_users
WHERE workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- Delete old workspace_users entries for old IT Workspace
DELETE FROM public.workspace_users
WHERE workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002';

-- 4. Point all users currently in old IT Workspace to unified workspace
UPDATE public.users
SET active_workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
WHERE active_workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002';

-- 5. Move all worklogs from old IT Workspace to unified workspace
UPDATE public.col_worklog
SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
WHERE workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002';

-- 6. Move all projects from old IT Workspace to unified workspace
UPDATE public.tb_project_registry
SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
WHERE workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002';

-- 7. Delete the old IT Workspace entry safely
DELETE FROM public.workspaces
WHERE id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002';
