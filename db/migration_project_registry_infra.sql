-- =============================================================================
-- Migration: Add Infrastructure & Credentials Reference Columns to tb_project_registry
-- =============================================================================

ALTER TABLE public.tb_project_registry 
  ADD COLUMN IF NOT EXISTS hosting_provider TEXT,
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS database_info TEXT,
  ADD COLUMN IF NOT EXISTS github_repo_url TEXT,
  ADD COLUMN IF NOT EXISTS credentials_ref_note TEXT;
