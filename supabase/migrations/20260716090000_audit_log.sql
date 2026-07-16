-- =============================================================================
-- Migration: Audit Log for HR Compliance & Transparency
-- Records critical actions: add/remove member, role changes, exports
-- =============================================================================
BEGIN;

-- 1. Create audit log table
CREATE TABLE IF NOT EXISTS public.tb_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  actor_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name   TEXT,
  action       TEXT NOT NULL,         -- e.g. 'MEMBER_ADDED', 'MEMBER_REMOVED', 'ROLE_CHANGED'
  target_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_name  TEXT,
  metadata     JSONB DEFAULT '{}',    -- additional context (old_role, new_role, etc.)
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace ON public.tb_audit_log (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor     ON public.tb_audit_log (actor_id);

-- 3. Enable RLS
ALTER TABLE public.tb_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Workspace admins can read logs for their own workspace
CREATE POLICY "Workspace admins can read audit log"
  ON public.tb_audit_log
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Any authenticated user can insert (client logs their own actions)
CREATE POLICY "Authenticated users can insert audit log"
  ON public.tb_audit_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Super admins can do everything
CREATE POLICY "Super admins full access audit log"
  ON public.tb_audit_log
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

COMMIT;
