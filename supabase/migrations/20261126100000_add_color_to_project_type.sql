-- Migration: Let each workspace pick a display colour for its project types.
-- Additive only: nullable column, no data change. NULL = use the built-in fallback colour.
-- Existing RLS on tb_master_project_type already limits writes to workspace admins.
BEGIN;

ALTER TABLE public.tb_master_project_type
  ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE public.tb_master_project_type
  DROP CONSTRAINT IF EXISTS tb_master_project_type_color_hex_check;
ALTER TABLE public.tb_master_project_type
  ADD CONSTRAINT tb_master_project_type_color_hex_check
  CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

COMMIT;

-- Rollback:
--   ALTER TABLE public.tb_master_project_type DROP CONSTRAINT IF EXISTS tb_master_project_type_color_hex_check;
--   ALTER TABLE public.tb_master_project_type DROP COLUMN IF EXISTS color;
