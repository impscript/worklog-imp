-- Migration: Promote HR Super Admins (680644, 668085)
-- Description: Assigns 'admin' role to HR team members with employee IDs 680644 and 668085
-- giving them Super Admin permissions across all workspaces and admin modules.

-- 1. Update user system role in public.users
UPDATE public.users 
SET 
  role = 'admin',
  updated_at = now()
WHERE emp_id IN ('680644', '668085');

-- 2. Update workspace membership role if records exist
UPDATE public.workspace_users
SET role = 'admin'
WHERE user_id IN (
  SELECT id FROM public.users WHERE emp_id IN ('680644', '668085')
);
