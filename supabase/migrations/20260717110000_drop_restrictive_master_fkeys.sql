-- Migration: Drop composite foreign key constraints on master data to allow global master data sharing across workspaces
BEGIN;

-- 1. Drop foreign keys on public.col_worklog
ALTER TABLE public.col_worklog DROP CONSTRAINT IF EXISTS col_worklog_holding_fkey;
ALTER TABLE public.col_worklog DROP CONSTRAINT IF EXISTS col_worklog_department_operator_fkey;
ALTER TABLE public.col_worklog DROP CONSTRAINT IF EXISTS col_worklog_project_type_fkey;

-- 2. Drop foreign keys on public.tb_map_project_structure
ALTER TABLE public.tb_map_project_structure DROP CONSTRAINT IF EXISTS tb_map_project_structure_holding_fkey;
ALTER TABLE public.tb_map_project_structure DROP CONSTRAINT IF EXISTS tb_map_project_structure_department_operator_fkey;
ALTER TABLE public.tb_map_project_structure DROP CONSTRAINT IF EXISTS tb_map_project_structure_project_type_fkey;

-- 3. Drop foreign keys on public.tb_map_user_role
ALTER TABLE public.tb_map_user_role DROP CONSTRAINT IF EXISTS tb_map_user_role_holding_fkey;
ALTER TABLE public.tb_map_user_role DROP CONSTRAINT IF EXISTS tb_map_user_role_department_operator_fkey;

COMMIT;
