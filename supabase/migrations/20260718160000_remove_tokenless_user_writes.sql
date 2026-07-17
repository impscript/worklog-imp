-- Remove browser/tokenless write paths after the JWT bridge rollout.
DROP POLICY IF EXISTS "Users insert self or admin" ON public.users;
DROP POLICY IF EXISTS "Users update self or admin" ON public.users;
DROP POLICY IF EXISTS "Users update mapped profile or global admin" ON public.users;
CREATE POLICY "Users update mapped profile or global admin" ON public.users
  FOR UPDATE
  USING (auth_user_id = auth.uid() OR app_security.current_user_is_admin())
  WITH CHECK (auth_user_id = auth.uid() OR app_security.current_user_is_admin());
REVOKE EXECUTE ON FUNCTION public.provision_hrms_user(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_security.current_internal_user_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_security.current_user_is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_security.is_workspace_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_security.is_workspace_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_security.current_internal_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app_security.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_security.is_workspace_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_security.is_workspace_admin(UUID) TO authenticated;
