-- Migration: Create tb_project_secrets for In-App Project Credential Management
-- Description: Stores project environment key-value secrets with workspace scoping and RLS policies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_project_secrets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.tb_project_registry(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  environment  TEXT NOT NULL DEFAULT 'production', -- 'production', 'staging', 'development', 'general'
  secret_key   TEXT NOT NULL,                      -- e.g. DATABASE_URL, SUPABASE_ANON_KEY
  secret_value TEXT NOT NULL,                      -- Plaintext or encrypted secret string
  note         TEXT,                               -- Optional description
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Indexes for fast project & workspace lookups
CREATE INDEX IF NOT EXISTS idx_tb_project_secrets_project_id ON public.tb_project_secrets(project_id);
CREATE INDEX IF NOT EXISTS idx_tb_project_secrets_workspace_id ON public.tb_project_secrets(workspace_id);

-- Enable RLS
ALTER TABLE public.tb_project_secrets ENABLE ROW LEVEL SECURITY;

-- ─── SELECT Policy ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members read project secrets" ON public.tb_project_secrets;
CREATE POLICY "Members read project secrets" ON public.tb_project_secrets
  FOR SELECT USING (
    app_security.is_workspace_member(workspace_id)
    OR app_security.has_workspace_grant(workspace_id)
    OR app_security.current_user_is_admin()
  );

-- ─── ALL (INSERT, UPDATE, DELETE) Policy ────────────────────────────────────
DROP POLICY IF EXISTS "Members manage project secrets" ON public.tb_project_secrets;
CREATE POLICY "Members manage project secrets" ON public.tb_project_secrets
  FOR ALL USING (
    app_security.is_workspace_member(workspace_id)
    OR app_security.current_user_is_admin()
  ) WITH CHECK (
    app_security.is_workspace_member(workspace_id)
    OR app_security.current_user_is_admin()
  );

COMMIT;
