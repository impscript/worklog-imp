-- ======================================================
-- FIX: Add INSERT / UPDATE / DELETE policies for master
-- and mapping tables that previously had SELECT-only RLS
-- Run this in Supabase SQL Editor → https://supabase.com/dashboard/project/mcrmkyppxoityveebgex/sql
-- ======================================================

-- tb_master_holding
DROP POLICY IF EXISTS "Allow full access to tb_master_holding for dev" ON public.tb_master_holding;
CREATE POLICY "Allow full access to tb_master_holding for dev"
  ON public.tb_master_holding FOR ALL USING (true) WITH CHECK (true);

-- tb_master_role
DROP POLICY IF EXISTS "Allow full access to tb_master_role for dev" ON public.tb_master_role;
CREATE POLICY "Allow full access to tb_master_role for dev"
  ON public.tb_master_role FOR ALL USING (true) WITH CHECK (true);

-- tb_master_project_type
DROP POLICY IF EXISTS "Allow full access to tb_master_project_type for dev" ON public.tb_master_project_type;
CREATE POLICY "Allow full access to tb_master_project_type for dev"
  ON public.tb_master_project_type FOR ALL USING (true) WITH CHECK (true);

-- tb_master_action
DROP POLICY IF EXISTS "Allow full access to tb_master_action for dev" ON public.tb_master_action;
CREATE POLICY "Allow full access to tb_master_action for dev"
  ON public.tb_master_action FOR ALL USING (true) WITH CHECK (true);

-- tb_map_user_role  ← root cause of the reported error
DROP POLICY IF EXISTS "Allow full access to tb_map_user_role for dev" ON public.tb_map_user_role;
CREATE POLICY "Allow full access to tb_map_user_role for dev"
  ON public.tb_map_user_role FOR ALL USING (true) WITH CHECK (true);

-- tb_map_project_structure
DROP POLICY IF EXISTS "Allow full access to tb_map_project_structure for dev" ON public.tb_map_project_structure;
CREATE POLICY "Allow full access to tb_map_project_structure for dev"
  ON public.tb_map_project_structure FOR ALL USING (true) WITH CHECK (true);

-- Verify: list all policies on the affected tables
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'tb_master_holding', 'tb_master_role', 'tb_master_project_type',
  'tb_master_action', 'tb_map_user_role', 'tb_map_project_structure'
)
ORDER BY tablename, cmd;
