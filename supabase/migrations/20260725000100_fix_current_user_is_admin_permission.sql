-- Migration: Restore execute permissions on current_user_is_admin and is_workspace_member functions to resolve RLS permission denied errors.
BEGIN;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_security.current_user_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_security.is_workspace_member(UUID) TO anon, authenticated;

COMMIT;
