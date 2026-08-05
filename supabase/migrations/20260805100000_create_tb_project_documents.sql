-- Migration: Create tb_project_documents for Technical Blueprints, User Manuals, and SOP Assets
-- Description: Stores project documentation metadata with workspace scoping, category filtering, and RLS policies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_project_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.tb_project_registry(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category      TEXT NOT NULL DEFAULT 'blueprint', -- 'blueprint', 'user_manual', 'architecture', 'sop', 'config'
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_size     BIGINT DEFAULT 0,
  mime_type     TEXT DEFAULT 'application/pdf',
  version_label TEXT DEFAULT 'v1.0',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Index for efficient project and workspace querying
CREATE INDEX IF NOT EXISTS idx_tb_project_docs_project_id ON public.tb_project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_tb_project_docs_workspace_id ON public.tb_project_documents(workspace_id);

-- Enable RLS
ALTER TABLE public.tb_project_documents ENABLE ROW LEVEL SECURITY;

-- ─── SELECT Policy ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members read project documents" ON public.tb_project_documents;
CREATE POLICY "Members read project documents" ON public.tb_project_documents
  FOR SELECT USING (
    app_security.is_workspace_member(workspace_id)
    OR app_security.has_workspace_grant(workspace_id)
    OR app_security.current_user_is_admin()
  );

-- ─── ALL (INSERT, UPDATE, DELETE) Policy ────────────────────────────────────
DROP POLICY IF EXISTS "Members manage project documents" ON public.tb_project_documents;
CREATE POLICY "Members manage project documents" ON public.tb_project_documents
  FOR ALL USING (
    app_security.is_workspace_member(workspace_id)
    OR app_security.current_user_is_admin()
  ) WITH CHECK (
    app_security.is_workspace_member(workspace_id)
    OR app_security.current_user_is_admin()
  );

COMMIT;
