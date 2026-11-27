-- Migration: Allow workspace admins (in the same workspace) to manage tb_user_jd.
--
-- Previous policy (20260722000000_fix_tb_user_jd_rls.sql) only allowed the row owner
-- or a global admin (`users.role = 'admin'`) to write `tb_user_jd`.
-- This update keeps the same tenant boundary while allowing Workspace Admins
-- (`workspace_users.role = 'admin'`) to manage JDs for members inside their own workspace.
--
-- Rollback:
--   DROP POLICY IF EXISTS "Owners and admins manage tb_user_jd" ON public.tb_user_jd;
--   CREATE POLICY "Owners and admins manage tb_user_jd" ON public.tb_user_jd
--     FOR ALL
--     TO authenticated
--     USING (
--       user_id = app_security.current_internal_user_id()
--       OR app_security.current_user_is_admin()
--     )
--     WITH CHECK (
--       user_id = app_security.current_internal_user_id()
--       OR app_security.current_user_is_admin()
--     );

BEGIN;

DROP POLICY IF EXISTS "Owners and admins manage tb_user_jd" ON public.tb_user_jd;

CREATE POLICY "Owners and admins manage tb_user_jd" ON public.tb_user_jd
  FOR ALL
  TO authenticated
  USING (
    user_id = app_security.current_internal_user_id()
    OR app_security.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_users wu
      WHERE wu.user_id = tb_user_jd.user_id
        AND app_security.is_workspace_admin(wu.workspace_id)
    )
  )
  WITH CHECK (
    user_id = app_security.current_internal_user_id()
    OR app_security.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_users wu
      WHERE wu.user_id = tb_user_jd.user_id
        AND app_security.is_workspace_admin(wu.workspace_id)
    )
  );

COMMIT;
