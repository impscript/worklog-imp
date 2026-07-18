-- Migration: Fix RLS on tb_system_config with proper workspace scoping.
--
-- Each workspace has its own config rows (workspace_id). Members can read their
-- own workspace's config; workspace/global admins can manage it.

BEGIN;

DROP POLICY IF EXISTS "Allow all access to system_config for dev" ON public.tb_system_config;

CREATE POLICY "Read system_config for workspace members"
  ON public.tb_system_config FOR SELECT
  USING (
    app_security.is_workspace_member(workspace_id)
    OR app_security.current_user_is_admin()
  );

CREATE POLICY "Write system_config for workspace admins"
  ON public.tb_system_config FOR ALL
  USING (
    app_security.is_workspace_admin(workspace_id)
    OR app_security.current_user_is_admin()
  )
  WITH CHECK (
    app_security.is_workspace_admin(workspace_id)
    OR app_security.current_user_is_admin()
  );

COMMIT;
