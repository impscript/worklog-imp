-- Migration: Snapshot the evaluated employee's identity at analysis time.
--
-- Why: the shared/public view (anon viewers) cannot read the live `users` /
-- `tb_user_jd` rows (RLS blocks anon), so owner name/position/avatar were missing.
-- More importantly, pulling live profile data would also show WRONG identity on
-- historical reports once the employee changes position / department / JD.
-- We store a point-in-time snapshot on the analysis row itself.

BEGIN;

ALTER TABLE public.tb_ai_individual_analysis
  ADD COLUMN IF NOT EXISTS evaluated_full_name TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_nickname TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_position TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_department TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_jd_text TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_avatar_emp_id TEXT;

COMMIT;
