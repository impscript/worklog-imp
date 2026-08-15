-- Migration: Project Gantt Roadmap, Team Contribution Tracking & 4-Dimension Cost Savings
-- Description: Adds timeline, head lead, milestones, team contribution %, and 4-dimension MECE cost savings tables.

BEGIN;

-- 1. Extend tb_project_registry with Gantt and Executive Leadership fields
ALTER TABLE public.tb_project_registry
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS head_lead_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS head_lead_name TEXT,
ADD COLUMN IF NOT EXISTS project_health VARCHAR(20) DEFAULT 'on_track'; -- 'on_track', 'at_risk', 'delayed'

-- 2. Create tb_project_team_contribution
CREATE TABLE IF NOT EXISTS public.tb_project_team_contribution (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID NOT NULL REFERENCES public.tb_project_registry(id) ON DELETE CASCADE,
  workspace_id                UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name                   TEXT,
  role_in_project             VARCHAR(50) DEFAULT 'developer', -- 'lead', 'developer', 'qa', 'uiux', 'consultant', 'support'
  target_contribution_percent NUMERIC(5,2) DEFAULT 0.00,
  manual_actual_hours         NUMERIC(10,2), -- Manual override if not all hours in worklog
  manual_actual_percent       NUMERIC(5,2), -- Manual override of actual contribution %
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tb_proj_team_proj_id ON public.tb_project_team_contribution(project_id);
CREATE INDEX IF NOT EXISTS idx_tb_proj_team_user_id ON public.tb_project_team_contribution(user_id);

-- 3. Create tb_project_milestones
CREATE TABLE IF NOT EXISTS public.tb_project_milestones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES public.tb_project_registry(id) ON DELETE CASCADE,
  workspace_id       UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  milestone_name     VARCHAR(255) NOT NULL,
  start_date         DATE,
  due_date           DATE,
  status             VARCHAR(30) DEFAULT 'in_progress', -- 'planning', 'in_progress', 'completed', 'blocked'
  progress_percent   NUMERIC(5,2) DEFAULT 0.00,
  assigned_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_user_name TEXT,
  sequence_order     INT DEFAULT 0,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tb_proj_milestones_proj_id ON public.tb_project_milestones(project_id);

-- 4. Create tb_project_cost_savings
CREATE TABLE IF NOT EXISTS public.tb_project_cost_savings (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                    UUID NOT NULL REFERENCES public.tb_project_registry(id) ON DELETE CASCADE,
  workspace_id                  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- 1. Direct Cash Savings (Hard Savings)
  direct_savings_annual         NUMERIC(12,2) DEFAULT 0.00,
  direct_savings_notes          TEXT,
  
  -- 2. Indirect Manhour / Productivity Savings
  indirect_manhour_saved_annual NUMERIC(10,2) DEFAULT 0.00,
  indirect_hourly_rate          NUMERIC(8,2) DEFAULT 350.00,
  indirect_savings_annual       NUMERIC(12,2) DEFAULT 0.00,
  indirect_savings_notes        TEXT,
  
  -- 3. Cost Avoidance (Future Costs Avoided)
  avoidance_savings_annual      NUMERIC(12,2) DEFAULT 0.00,
  avoidance_savings_notes       TEXT,
  
  -- 4. Support / Maintenance Savings (OpEx Saved)
  support_savings_annual        NUMERIC(12,2) DEFAULT 0.00,
  support_savings_notes         TEXT,
  
  -- Manual Override if any custom overall figure
  manual_total_savings_override NUMERIC(12,2),
  
  -- Calculation Details & Audit Evidence
  baseline_before               TEXT,
  target_after                  TEXT,
  calculation_formula           TEXT,
  ref_proof_url                 TEXT,
  
  -- Verification Sign-off
  verification_status           VARCHAR(30) DEFAULT 'draft', -- 'draft', 'pending', 'verified', 'rejected'
  verified_by                   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at                   TIMESTAMPTZ,
  
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_tb_proj_savings_proj_id ON public.tb_project_cost_savings(project_id);

-- Enable RLS
ALTER TABLE public.tb_project_team_contribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_project_cost_savings ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Authenticated Workspace Users
DROP POLICY IF EXISTS "Members read team contributions" ON public.tb_project_team_contribution;
CREATE POLICY "Members read team contributions" ON public.tb_project_team_contribution
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Members manage team contributions" ON public.tb_project_team_contribution;
CREATE POLICY "Members manage team contributions" ON public.tb_project_team_contribution
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members read milestones" ON public.tb_project_milestones;
CREATE POLICY "Members read milestones" ON public.tb_project_milestones
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Members manage milestones" ON public.tb_project_milestones;
CREATE POLICY "Members manage milestones" ON public.tb_project_milestones
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members read cost savings" ON public.tb_project_cost_savings;
CREATE POLICY "Members read cost savings" ON public.tb_project_cost_savings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Members manage cost savings" ON public.tb_project_cost_savings;
CREATE POLICY "Members manage cost savings" ON public.tb_project_cost_savings
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
