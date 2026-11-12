-- =============================================================================
-- Migration: AI request form v2 - per-task use cases and supervisor confirmation
--
-- tb_ai_enterprise_requests keeps its existing columns (title, as_is_process, ai_functions,
-- target_hours_saved_per_week ... are still filled with request-level totals so the dashboard,
-- evaluation and report screens keep working). The structured task list and the requester's
-- supervisor are stored in new columns.
--
--   use_cases              JSONB array, one object per task:
--                          { id, title, owner_key, as_is_process, ai_functions[], frequency_count,
--                            frequency_unit('day'|'week'|'month'), minutes_before, minutes_after,
--                            basis('measured'|'sandbox'|'experience'),
--                            hours_before_per_week, hours_saved_per_week, basis_factor }
--   supervisor_*           the requester's line manager who must confirm the request. Only the
--                          captured values + a 'pending' status are stored here; the confirmation
--                          workflow itself is a later step.
--
-- Rollback:
--   ALTER TABLE public.tb_ai_enterprise_requests
--     DROP COLUMN IF EXISTS use_cases,
--     DROP COLUMN IF EXISTS supervisor_name,
--     DROP COLUMN IF EXISTS supervisor_emp_id,
--     DROP COLUMN IF EXISTS supervisor_email,
--     DROP COLUMN IF EXISTS supervisor_status,
--     DROP COLUMN IF EXISTS supervisor_confirmed_at;
-- =============================================================================

BEGIN;

ALTER TABLE public.tb_ai_enterprise_requests
  ADD COLUMN IF NOT EXISTS use_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supervisor_name TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_emp_id TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_email TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS supervisor_confirmed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tb_ai_enterprise_requests_supervisor_status_check'
  ) THEN
    ALTER TABLE public.tb_ai_enterprise_requests
      ADD CONSTRAINT tb_ai_enterprise_requests_supervisor_status_check
      CHECK (supervisor_status IN ('pending', 'confirmed', 'declined'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tb_ai_enterprise_requests_use_cases_is_array'
  ) THEN
    ALTER TABLE public.tb_ai_enterprise_requests
      ADD CONSTRAINT tb_ai_enterprise_requests_use_cases_is_array
      CHECK (jsonb_typeof(use_cases) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.tb_ai_enterprise_requests.use_cases IS
'Tasks the requester wants AI to help with: [{id,title,owner_key,as_is_process,ai_functions,frequency_count,frequency_unit,minutes_before,minutes_after,basis,hours_before_per_week,hours_saved_per_week,basis_factor}]';
COMMENT ON COLUMN public.tb_ai_enterprise_requests.supervisor_status IS
'Confirmation by the requester''s line manager: pending | confirmed | declined';

COMMIT;
