-- Migration: Cross-workspace RLS functions and policy updates
-- Adds has_workspace_grant() + get_granted_workspace_ids() helpers,
-- then extends RLS on worklogs, users, workspace_users, and master data
-- so grant holders can read across workspace boundaries.

BEGIN;

-- ─── Helper 1: Does the current auth user have an active grant for this workspace? ───
CREATE OR REPLACE FUNCTION app_security.has_workspace_grant(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_security
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.user_workspace_grants g
    JOIN   public.users u ON u.id = g.user_id
    WHERE  u.auth_user_id = auth.uid()
      AND  g.workspace_id = target_workspace_id
      AND  (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION app_security.has_workspace_grant(UUID) TO anon, authenticated;

-- ─── Helper 2: Returns all workspace_ids the current user has an active grant for ───
-- Used by the frontend workspace selector to build the list of viewable workspaces.
CREATE OR REPLACE FUNCTION public.get_granted_workspace_ids()
RETURNS TABLE (
  workspace_id  UUID,
  grant_role    TEXT,
  expires_at    TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_security
AS $$
  SELECT g.workspace_id, g.grant_role, g.expires_at
  FROM   public.user_workspace_grants g
  JOIN   public.users u ON u.id = g.user_id
  WHERE  u.auth_user_id = auth.uid()
    AND  (g.expires_at IS NULL OR g.expires_at > now());
$$;

GRANT EXECUTE ON FUNCTION public.get_granted_workspace_ids() TO authenticated;

-- ─── Update col_worklog SELECT policy ───────────────────────────────────────────────
-- Grant holders (any role: viewer/analyst/manager) can read worklogs in granted workspaces
DROP POLICY IF EXISTS "Members read own worklogs" ON public.col_worklog;
CREATE POLICY "Members read own worklogs" ON public.col_worklog
  FOR SELECT USING (
    app_security.is_workspace_member(workspace_id)
    OR app_security.has_workspace_grant(workspace_id)
    OR app_security.current_user_is_admin()
  );

-- ─── Update users SELECT policy ─────────────────────────────────────────────────────
-- Grant holders can read users whose active_workspace_id is a granted workspace
DROP POLICY IF EXISTS "Users read self or admin reads all" ON public.users;
CREATE POLICY "Users read self or admin reads all" ON public.users
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR app_security.current_user_is_admin()
    OR app_security.users_share_workspace(id)
    OR app_security.has_workspace_grant(active_workspace_id)
  );

-- ─── Update workspace_users SELECT policy ───────────────────────────────────────────
DROP POLICY IF EXISTS "Members read own workspace_users" ON public.workspace_users;
CREATE POLICY "Members read own workspace_users" ON public.workspace_users
  FOR SELECT USING (
    app_security.is_workspace_member(workspace_id)
    OR app_security.has_workspace_grant(workspace_id)
    OR app_security.current_user_is_admin()
  );

-- ─── Update workspaces SELECT policy ────────────────────────────────────────────────
-- Grant holders can read workspace metadata (name, invite code) for display
DROP POLICY IF EXISTS "Members read own workspaces" ON public.workspaces;
CREATE POLICY "Members read own workspaces" ON public.workspaces
  FOR SELECT USING (
    app_security.is_workspace_member(id)
    OR app_security.has_workspace_grant(id)
    OR app_security.current_user_is_admin()
  );

-- ─── Update tb_project_registry ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members read own projects" ON public.tb_project_registry;
CREATE POLICY "Members read own projects" ON public.tb_project_registry
  FOR SELECT USING (
    app_security.is_workspace_member(workspace_id)
    OR app_security.has_workspace_grant(workspace_id)
    OR app_security.current_user_is_admin()
  );

COMMIT;
