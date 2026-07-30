-- =============================================================================
-- Migration: Sanitize Dirty Project Names Containing HTML <br> Tags
-- =============================================================================
-- Problem: Legacy GCal sync or auto-provisioning occasionally captured formatted HTML strings 
--          (e.g., "ERP - Netsuite<br>📦 Module: Accounting<br>...") as the project_name.
-- Fix: Clean up project_name in tb_project_registry, tb_map_project_structure, and col_worklog
--      to keep only the actual project title (everything before <br>).
-- =============================================================================

-- 1. Sanitize tb_project_registry
UPDATE public.tb_project_registry
SET project_name = TRIM(REGEXP_REPLACE(SPLIT_PART(project_name, '<br', 1), '<[^>]+>', '', 'g'))
WHERE project_name LIKE '%<br%';

-- 2. Sanitize tb_map_project_structure
UPDATE public.tb_map_project_structure
SET project_name = TRIM(REGEXP_REPLACE(SPLIT_PART(project_name, '<br', 1), '<[^>]+>', '', 'g'))
WHERE project_name LIKE '%<br%';

-- 3. Sanitize col_worklog
UPDATE public.col_worklog
SET project_name = TRIM(REGEXP_REPLACE(SPLIT_PART(project_name, '<br', 1), '<[^>]+>', '', 'g'))
WHERE project_name LIKE '%<br%';
