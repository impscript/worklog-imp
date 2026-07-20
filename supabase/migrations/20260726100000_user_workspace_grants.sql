-- Migration: user_workspace_grants
-- Allows designated users (e.g. HR) to access data from workspaces they don't belong to.
-- grant_role: 'viewer' (calendar only) | 'analyst' (reports + AI) | 'manager' (read+limited write)

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_workspace_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  grant_role    TEXT NOT NULL DEFAULT 'viewer'
                  CHECK (grant_role IN ('viewer', 'analyst', 'manager')),
  granted_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,   -- NULL = permanent; set a future date for time-limited access
  notes         TEXT,           -- optional reason / context
  UNIQUE (user_id, workspace_id)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_uwg_user_id     ON public.user_workspace_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_uwg_workspace_id ON public.user_workspace_grants(workspace_id);

COMMENT ON TABLE public.user_workspace_grants IS
  'Cross-workspace access grants. Allows users to view/analyse data from workspaces they are not members of.';
COMMENT ON COLUMN public.user_workspace_grants.grant_role IS
  'viewer = calendar only; analyst = reports + AI Enhance; manager = all read + limited write';
COMMENT ON COLUMN public.user_workspace_grants.expires_at IS
  'NULL means the grant is permanent until manually revoked.';

-- Enable RLS
ALTER TABLE public.user_workspace_grants ENABLE ROW LEVEL SECURITY;

-- Super admins manage everything
DROP POLICY IF EXISTS "Super admins manage grants" ON public.user_workspace_grants;
CREATE POLICY "Super admins manage grants" ON public.user_workspace_grants
  FOR ALL
  USING  (app_security.current_user_is_admin())
  WITH CHECK (app_security.current_user_is_admin());

-- Users can read their own grants (so frontend can build workspace selector)
DROP POLICY IF EXISTS "Users read own grants" ON public.user_workspace_grants;
CREATE POLICY "Users read own grants" ON public.user_workspace_grants
  FOR SELECT
  USING (
    app_security.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_workspace_grants.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

COMMIT;
