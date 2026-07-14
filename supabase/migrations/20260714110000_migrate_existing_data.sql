-- =============================================================================
-- Migration: Map Existing Users, Logs, and Projects to Workspaces
-- =============================================================================

-- 1. Map existing users to their respective workspaces based on department operator
-- Map IMP users to IMP Workspace
UPDATE public.users 
SET active_workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
WHERE (department ILIKE '%IMP%' OR nickname ILIKE '%Chatchawan%' OR nickname ILIKE '%Ronnachai%' OR full_name ILIKE '%Chatchawan%' OR full_name ILIKE '%Ronnachai%')
  AND active_workspace_id IS NULL;

-- Map IT users to IT Workspace
UPDATE public.users 
SET active_workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0002'
WHERE (department ILIKE '%IT%' OR nickname ILIKE '%Jintana%' OR nickname ILIKE '%Sutti%' OR nickname ILIKE '%Kanokaon%' OR nickname ILIKE '%Yawee%' OR nickname ILIKE '%Mungkung%' OR full_name ILIKE '%Jintana%' OR full_name ILIKE '%Sutti%')
  AND active_workspace_id IS NULL;

-- Fallback for any other remaining user to IMP Workspace so they are not locked out
UPDATE public.users
SET active_workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
WHERE active_workspace_id IS NULL;

-- 2. Onboard existing mapped users into workspace_users mapping table (RBAC roles)
INSERT INTO public.workspace_users (workspace_id, user_id, role)
SELECT 
  active_workspace_id, 
  id,
  CASE 
    WHEN nickname ILIKE '%Chatchawan%' OR nickname ILIKE '%Jintana%' OR position ILIKE '%manager%' OR position ILIKE '%head%' OR position ILIKE '%ผู้จัดการ%' THEN 'admin'::text
    ELSE 'user'::text
  END
FROM public.users
WHERE active_workspace_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 3. Map existing worklogs to their user's workspace
UPDATE public.col_worklog wl
SET workspace_id = u.active_workspace_id
FROM public.users u
WHERE wl.user_id = u.id AND wl.workspace_id IS NULL AND u.active_workspace_id IS NOT NULL;

-- 4. Map existing projects in registry to workspaces based on matched worklog workspace
UPDATE public.tb_project_registry pr
SET workspace_id = wl.workspace_id
FROM public.col_worklog wl
WHERE pr.project_name = wl.project_name AND pr.workspace_id IS NULL AND wl.workspace_id IS NOT NULL;

-- Fallback for remaining projects to IMP Workspace
UPDATE public.tb_project_registry
SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
WHERE workspace_id IS NULL;
