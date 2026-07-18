-- Migration: Store total_hours and logs_count on the analysis row so the
-- shared (public) view can display them without querying col_worklog (anon
-- viewers are blocked by workspace-scoped RLS on col_worklog).
--
-- These values are written by the edge function at analysis time.

BEGIN;

ALTER TABLE public.tb_ai_individual_analysis
  ADD COLUMN IF NOT EXISTS total_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logs_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evaluated_key_responsibilities JSONB;

COMMIT;
