-- =============================================================================
-- Migration: AI Enterprise Hub (Intake, Rubric Evaluations, and Monthly Reports)
-- Tables:
--   - public.tb_ai_enterprise_requests (FM-PI-AI-001)
--   - public.tb_ai_enterprise_evaluations (CoE Scoring Rubric 100 pts)
--   - public.tb_ai_enterprise_monthly_reports (FM-PI-AI-002)
-- =============================================================================

BEGIN;

-- 1. AI Intake & Use Case Requests (FM-PI-AI-001)
CREATE TABLE IF NOT EXISTS public.tb_ai_enterprise_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Requester Information
  requester_name TEXT,
  department TEXT NOT NULL,
  position TEXT,
  email TEXT,
  requested_seats INTEGER NOT NULL DEFAULT 1 CHECK (requested_seats > 0),
  tier TEXT NOT NULL DEFAULT 'virtual_employee' CHECK (tier IN ('virtual_employee', 'general_web')),
  ai_jd TEXT,
  contract_months INTEGER NOT NULL DEFAULT 3 CHECK (contract_months > 0),
  
  -- As-Is Process & Current Pain Points
  title TEXT NOT NULL,
  as_is_process TEXT NOT NULL,
  work_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (work_frequency IN ('daily', 'weekly', 'monthly')),
  as_is_hours_per_week NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (as_is_hours_per_week >= 0),
  
  -- To-Be Process & Targets
  ai_functions TEXT[] NOT NULL DEFAULT '{}',
  target_hours_saved_per_week NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (target_hours_saved_per_week >= 0),
  expected_benefits TEXT,
  
  -- Data Governance & PDPA
  data_safety_certified BOOLEAN NOT NULL DEFAULT false,
  
  -- Status & Integration
  status TEXT NOT NULL DEFAULT 'pending_review' 
    CHECK (status IN ('pending_review', 'approved_sandbox', 'waiting_list', 'rejected', 'completed')),
  linked_project_id UUID REFERENCES public.tb_project_registry(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CoE Rubric Evaluation (เกณฑ์ 4 มิติ รวม 100 คะแนน เกณฑ์ผ่าน 70)
CREATE TABLE IF NOT EXISTS public.tb_ai_enterprise_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.tb_ai_enterprise_requests(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  score_problem_clarity NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score_problem_clarity BETWEEN 0 AND 25),
  score_business_roi NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score_business_roi BETWEEN 0 AND 35),
  score_readiness NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score_readiness BETWEEN 0 AND 20),
  score_data_safety NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score_data_safety BETWEEN 0 AND 20),
  total_score NUMERIC(5,2) GENERATED ALWAYS AS (score_problem_clarity + score_business_roi + score_readiness + score_data_safety) STORED,
  
  evaluation_notes TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approve_sandbox', 'waiting_list', 'revision_needed', 'reject')),
  
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Monthly Impact & Deliverable Reports (FM-PI-AI-002)
CREATE TABLE IF NOT EXISTS public.tb_ai_enterprise_monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.tb_ai_enterprise_requests(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  report_month TEXT NOT NULL, -- Format 'YYYY-MM'
  active_days INTEGER NOT NULL DEFAULT 0 CHECK (active_days >= 0),
  actual_hours_saved_per_week NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (actual_hours_saved_per_week >= 0),
  turnaround_time_reduction TEXT,
  error_rate_reduction TEXT,
  key_deliverables TEXT NOT NULL,
  
  coe_feedback TEXT,
  coe_decision TEXT NOT NULL DEFAULT 'maintain' CHECK (coe_decision IN ('maintain', 'scale', 'warning', 'revoke')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_requests_workspace ON public.tb_ai_enterprise_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_user ON public.tb_ai_enterprise_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON public.tb_ai_enterprise_requests(status);

CREATE INDEX IF NOT EXISTS idx_ai_evaluations_request ON public.tb_ai_enterprise_evaluations(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_workspace ON public.tb_ai_enterprise_evaluations(workspace_id);

CREATE INDEX IF NOT EXISTS idx_ai_monthly_reports_request ON public.tb_ai_enterprise_monthly_reports(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_monthly_reports_month ON public.tb_ai_enterprise_monthly_reports(report_month);

-- Enable RLS
ALTER TABLE public.tb_ai_enterprise_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_ai_enterprise_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_ai_enterprise_monthly_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies: tb_ai_enterprise_requests
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tb_ai_enterprise_requests' AND policyname = 'Members read ai requests') THEN
    CREATE POLICY "Members read ai requests" ON public.tb_ai_enterprise_requests
      FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tb_ai_enterprise_requests' AND policyname = 'Members write ai requests') THEN
    CREATE POLICY "Members write ai requests" ON public.tb_ai_enterprise_requests
      FOR ALL USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin())
      WITH CHECK (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
  END IF;
END $$;

-- RLS Policies: tb_ai_enterprise_evaluations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tb_ai_enterprise_evaluations' AND policyname = 'Members read ai evaluations') THEN
    CREATE POLICY "Members read ai evaluations" ON public.tb_ai_enterprise_evaluations
      FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tb_ai_enterprise_evaluations' AND policyname = 'Members write ai evaluations') THEN
    CREATE POLICY "Members write ai evaluations" ON public.tb_ai_enterprise_evaluations
      FOR ALL USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin())
      WITH CHECK (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
  END IF;
END $$;

-- RLS Policies: tb_ai_enterprise_monthly_reports
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tb_ai_enterprise_monthly_reports' AND policyname = 'Members read ai monthly reports') THEN
    CREATE POLICY "Members read ai monthly reports" ON public.tb_ai_enterprise_monthly_reports
      FOR SELECT USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tb_ai_enterprise_monthly_reports' AND policyname = 'Members write ai monthly reports') THEN
    CREATE POLICY "Members write ai monthly reports" ON public.tb_ai_enterprise_monthly_reports
      FOR ALL USING (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin())
      WITH CHECK (workspace_id IS NULL OR app_security.is_workspace_member(workspace_id) OR app_security.current_user_is_admin());
  END IF;
END $$;

COMMIT;
