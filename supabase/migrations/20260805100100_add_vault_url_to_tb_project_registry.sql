-- Migration: Add vault_url to tb_project_registry
-- Description: Adds a dedicated Secrets Vault URL column for referencing external Vaults (1Password, Bitwarden, AWS Secrets Manager).

BEGIN;

ALTER TABLE public.tb_project_registry
ADD COLUMN IF NOT EXISTS vault_url TEXT;

COMMIT;
