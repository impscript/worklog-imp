-- =============================================================================
-- Migration: Add team_members and member_breakdown columns for Group AI Intake
-- =============================================================================

BEGIN;

-- 1. Add team_members column to tb_ai_enterprise_requests
ALTER TABLE public.tb_ai_enterprise_requests
ADD COLUMN IF NOT EXISTS team_members JSONB DEFAULT '[]'::jsonb;

-- 2. Add member_breakdown column to tb_ai_enterprise_monthly_reports
ALTER TABLE public.tb_ai_enterprise_monthly_reports
ADD COLUMN IF NOT EXISTS member_breakdown JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tb_ai_enterprise_requests.team_members IS 
'Array of tagged team members for group AI seats: [{emp_id, name, department, position, email, is_lead}]';

COMMENT ON COLUMN public.tb_ai_enterprise_monthly_reports.member_breakdown IS 
'Array of individual usage breakdowns for team seats: [{emp_id, name, active_days, hours_saved}]';

COMMIT;
