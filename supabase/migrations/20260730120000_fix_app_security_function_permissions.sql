-- =============================================================================
-- Migration: Fix Permission Denied for app_security functions
-- =============================================================================
-- Problem: RLS policies on tables (tb_project_registry, tb_map_project_structure, 
--          tb_project_notes, col_worklog, etc.) invoke app_security functions.
--          If EXECUTE permission on these SECURITY DEFINER functions is missing for 
--          anon or public, Postgres returns "permission denied for function is_workspace_admin".
-- Fix: Grant EXECUTE permissions to anon, authenticated, and public roles for all app_security functions.
-- =============================================================================

GRANT EXECUTE ON FUNCTION app_security.is_workspace_member(UUID) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION app_security.is_workspace_admin(UUID) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION app_security.current_user_is_admin() TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION app_security.current_internal_user_id() TO anon, authenticated, public;

DO $$
BEGIN
  -- Grant on is_workspace_admin_or_manager if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_security' AND p.proname = 'is_workspace_admin_or_manager'
  ) THEN
    GRANT EXECUTE ON FUNCTION app_security.is_workspace_admin_or_manager(UUID) TO anon, authenticated, public;
  END IF;

  -- Grant on users_share_workspace if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_security' AND p.proname = 'users_share_workspace'
  ) THEN
    GRANT EXECUTE ON FUNCTION app_security.users_share_workspace(UUID) TO anon, authenticated, public;
  END IF;

  -- Grant on has_workspace_grant if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_security' AND p.proname = 'has_workspace_grant'
  ) THEN
    GRANT EXECUTE ON FUNCTION app_security.has_workspace_grant(UUID) TO anon, authenticated, public;
  END IF;
END $$;
