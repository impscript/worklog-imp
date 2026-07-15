-- Migration: Convert master tables to composite primary keys (name, workspace_id)
BEGIN;

-- 1. Drop existing foreign keys referencing the master tables
ALTER TABLE public.tb_map_user_role DROP CONSTRAINT IF EXISTS tb_map_user_role_holding_fkey;
ALTER TABLE public.tb_map_user_role DROP CONSTRAINT IF EXISTS tb_map_user_role_department_operator_fkey;

ALTER TABLE public.tb_map_project_structure DROP CONSTRAINT IF EXISTS tb_map_project_structure_holding_fkey;
ALTER TABLE public.tb_map_project_structure DROP CONSTRAINT IF EXISTS tb_map_project_structure_department_operator_fkey;
ALTER TABLE public.tb_map_project_structure DROP CONSTRAINT IF EXISTS tb_map_project_structure_project_type_fkey;

ALTER TABLE public.col_worklog DROP CONSTRAINT IF EXISTS col_worklog_holding_fkey;
ALTER TABLE public.col_worklog DROP CONSTRAINT IF EXISTS col_worklog_department_operator_fkey;
ALTER TABLE public.col_worklog DROP CONSTRAINT IF EXISTS col_worklog_project_type_fkey;

-- 2. Ensure workspace_id is NOT NULL in the master tables (defaulting to IMP workspace 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001')
UPDATE public.tb_master_holding SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;
ALTER TABLE public.tb_master_holding ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tb_master_holding ALTER COLUMN workspace_id SET DEFAULT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

UPDATE public.tb_master_role SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;
ALTER TABLE public.tb_master_role ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tb_master_role ALTER COLUMN workspace_id SET DEFAULT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

UPDATE public.tb_master_project_type SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;
ALTER TABLE public.tb_master_project_type ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tb_master_project_type ALTER COLUMN workspace_id SET DEFAULT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

UPDATE public.tb_master_action SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;
ALTER TABLE public.tb_master_action ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tb_master_action ALTER COLUMN workspace_id SET DEFAULT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

UPDATE public.tb_map_user_role SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;
ALTER TABLE public.tb_map_user_role ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tb_map_user_role ALTER COLUMN workspace_id SET DEFAULT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

UPDATE public.tb_map_project_structure SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001' WHERE workspace_id IS NULL;
ALTER TABLE public.tb_map_project_structure ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tb_map_project_structure ALTER COLUMN workspace_id SET DEFAULT 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001';

-- 3. Re-define Primary Keys on master tables to include workspace_id
ALTER TABLE public.tb_master_holding DROP CONSTRAINT IF EXISTS tb_master_holding_pkey CASCADE;
ALTER TABLE public.tb_master_holding ADD PRIMARY KEY (holding_name, workspace_id);

ALTER TABLE public.tb_master_role DROP CONSTRAINT IF EXISTS tb_master_role_pkey CASCADE;
ALTER TABLE public.tb_master_role ADD PRIMARY KEY (role_name, workspace_id);

ALTER TABLE public.tb_master_project_type DROP CONSTRAINT IF EXISTS tb_master_project_type_pkey CASCADE;
ALTER TABLE public.tb_master_project_type ADD PRIMARY KEY (type_name, workspace_id);

-- 4. Re-add foreign keys as composite keys matching (name, workspace_id)
ALTER TABLE public.tb_map_user_role 
  ADD CONSTRAINT tb_map_user_role_holding_fkey FOREIGN KEY (holding, workspace_id) 
  REFERENCES public.tb_master_holding (holding_name, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.tb_map_user_role 
  ADD CONSTRAINT tb_map_user_role_department_operator_fkey FOREIGN KEY (department_operator, workspace_id) 
  REFERENCES public.tb_master_role (role_name, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.tb_map_project_structure 
  ADD CONSTRAINT tb_map_project_structure_holding_fkey FOREIGN KEY (holding, workspace_id) 
  REFERENCES public.tb_master_holding (holding_name, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.tb_map_project_structure 
  ADD CONSTRAINT tb_map_project_structure_department_operator_fkey FOREIGN KEY (department_operator, workspace_id) 
  REFERENCES public.tb_master_role (role_name, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.tb_map_project_structure 
  ADD CONSTRAINT tb_map_project_structure_project_type_fkey FOREIGN KEY (project_type, workspace_id) 
  REFERENCES public.tb_master_project_type (type_name, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.col_worklog 
  ADD CONSTRAINT col_worklog_holding_fkey FOREIGN KEY (holding, workspace_id) 
  REFERENCES public.tb_master_holding (holding_name, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.col_worklog 
  ADD CONSTRAINT col_worklog_department_operator_fkey FOREIGN KEY (department_operator, workspace_id) 
  REFERENCES public.tb_master_role (role_name, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.col_worklog 
  ADD CONSTRAINT col_worklog_project_type_fkey FOREIGN KEY (project_type, workspace_id) 
  REFERENCES public.tb_master_project_type (type_name, workspace_id) ON DELETE CASCADE;

COMMIT;
