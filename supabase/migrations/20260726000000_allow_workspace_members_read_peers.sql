-- Migration: Allow workspace members to read profiles of co-workers in the same workspace.
-- Problem: The current SELECT policy on public.users only allows a user to read their own row
-- (auth_user_id = auth.uid()) or if they are a global admin. This breaks Leaderboard, Reports,
-- AI Enhance (HrbpPage), and Calendar team member pickers for non-admin users.
-- Fix: Add a SECURITY DEFINER helper function that checks if two users share a workspace,
-- then use it in the SELECT policy. SECURITY DEFINER bypasses RLS inside the function body,
-- avoiding infinite recursion.

BEGIN;

-- 1. Create a helper: returns TRUE if the currently authenticated user shares
--    at least one workspace with `target_user_id`.
--    Uses workspace_users (no RLS recursion) + a single lookup via auth.uid().
CREATE OR REPLACE FUNCTION app_security.users_share_workspace(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_security
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.workspace_users wu_self
    JOIN   public.workspace_users wu_peer  ON wu_peer.workspace_id = wu_self.workspace_id
    JOIN   public.users           u_self   ON u_self.id = wu_self.user_id
    WHERE  u_self.auth_user_id = auth.uid()
      AND  wu_peer.user_id = target_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION app_security.users_share_workspace(UUID) TO anon, authenticated;

-- 2. Drop and recreate the SELECT policy to include same-workspace peers.
DROP POLICY IF EXISTS "Users read self or admin reads all" ON public.users;
CREATE POLICY "Users read self or admin reads all" ON public.users
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR app_security.current_user_is_admin()
    OR app_security.users_share_workspace(id)
  );

COMMIT;
