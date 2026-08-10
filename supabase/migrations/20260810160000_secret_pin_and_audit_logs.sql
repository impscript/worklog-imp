-- Migration: Add Security PIN for SuperAdmins and Create tb_secret_access_logs
-- Description: Adds PIN verification and audit tracking for secrets vault access.

BEGIN;

-- 1. Add security_pin_hash and security_pin_updated_at columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS security_pin_hash TEXT NULL,
ADD COLUMN IF NOT EXISTS security_pin_updated_at TIMESTAMPTZ NULL;

-- 2. Create tb_secret_access_logs table
CREATE TABLE IF NOT EXISTS public.tb_secret_access_logs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID REFERENCES public.tb_project_registry(id) ON DELETE CASCADE,
  workspace_id                UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id                     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  authorized_by_superadmin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type                 TEXT NOT NULL, -- 'OPEN_VAULT', 'REVEAL_SECRET', 'COPY_SECRET', 'COPY_ENV_BLOCK'
  secret_key                  TEXT NULL,
  environment                 TEXT NULL,
  status                      TEXT NOT NULL, -- 'SUCCESS', 'FAILED_PIN'
  ip_address                  TEXT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tb_secret_access_logs_user ON public.tb_secret_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tb_secret_access_logs_superadmin ON public.tb_secret_access_logs(authorized_by_superadmin_id);
CREATE INDEX IF NOT EXISTS idx_tb_secret_access_logs_created_at ON public.tb_secret_access_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.tb_secret_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissive secret access logs policy" ON public.tb_secret_access_logs;
CREATE POLICY "Permissive secret access logs policy" ON public.tb_secret_access_logs
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
