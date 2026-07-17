-- =============================================================================
-- Migration: Fix RLS Policy for Project Registry
-- Description: Adds a developer-friendly policy to public.tb_project_registry
--              allowing both authenticated and anonymous (dev) users to insert/update/delete.
-- =============================================================================

-- 1. Drop existing dev policy if exists
DROP POLICY IF EXISTS "Allow full access to tb_project_registry for dev" ON public.tb_project_registry;

-- 2. Create the dev policy allowing full write access (matching other tables like col_worklog and tb_map_project_structure)
CREATE POLICY "Allow full access to tb_project_registry for dev"
  ON public.tb_project_registry 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
