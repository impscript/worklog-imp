-- Add Value-Add multiplier, Share %, partial-year realization, and a
-- per-line-item indirect savings breakdown to the Gantt cost-savings sheet.
-- Additive only: every new column defaults to a no-op so existing projects'
-- stored and displayed totals are unchanged unless a project opts in.

BEGIN;

ALTER TABLE public.tb_project_cost_savings
ADD COLUMN IF NOT EXISTS value_add_multiplier NUMERIC(6,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS savings_share_percentage NUMERIC(5,2) NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS months_realized_this_year NUMERIC(4,2);

ALTER TABLE public.tb_project_cost_savings
ADD CONSTRAINT tb_project_cost_savings_valueadd_check
CHECK (
  value_add_multiplier >= 0
  AND savings_share_percentage BETWEEN 0 AND 100
  AND (months_realized_this_year IS NULL OR months_realized_this_year BETWEEN 0 AND 12)
) NOT VALID;

CREATE TABLE IF NOT EXISTS public.tb_project_indirect_savings_items (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.tb_project_registry(id) ON DELETE CASCADE,
  workspace_id UUID,
  label TEXT NOT NULL,
  monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  headcount NUMERIC(6,2) NOT NULL DEFAULT 1,
  days_saved_per_month NUMERIC(6,2) NOT NULL DEFAULT 0,
  working_days_per_month NUMERIC(4,1) NOT NULL DEFAULT 22,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_indirect_savings_items_project
ON public.tb_project_indirect_savings_items (project_id);

ALTER TABLE public.tb_project_indirect_savings_items
ADD CONSTRAINT tb_project_indirect_savings_items_nonnegative_check
CHECK (
  monthly_salary >= 0
  AND headcount >= 0
  AND days_saved_per_month >= 0
  AND working_days_per_month > 0
) NOT VALID;

ALTER TABLE public.tb_project_indirect_savings_items ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_sync_gantt_indirect_items_workspace ON public.tb_project_indirect_savings_items;
CREATE TRIGGER trg_sync_gantt_indirect_items_workspace
BEFORE INSERT OR UPDATE OF project_id, workspace_id
ON public.tb_project_indirect_savings_items
FOR EACH ROW EXECUTE FUNCTION app_security.sync_gantt_child_workspace();

DROP POLICY IF EXISTS "Gantt members read indirect savings items" ON public.tb_project_indirect_savings_items;
DROP POLICY IF EXISTS "Gantt managers insert indirect savings items" ON public.tb_project_indirect_savings_items;
DROP POLICY IF EXISTS "Gantt managers update indirect savings items" ON public.tb_project_indirect_savings_items;
DROP POLICY IF EXISTS "Gantt managers delete indirect savings items" ON public.tb_project_indirect_savings_items;

CREATE POLICY "Gantt members read indirect savings items"
ON public.tb_project_indirect_savings_items FOR SELECT TO authenticated
USING (app_security.can_read_gantt_project(project_id));
CREATE POLICY "Gantt managers insert indirect savings items"
ON public.tb_project_indirect_savings_items FOR INSERT TO authenticated
WITH CHECK (app_security.can_manage_gantt_project(project_id));
CREATE POLICY "Gantt managers update indirect savings items"
ON public.tb_project_indirect_savings_items FOR UPDATE TO authenticated
USING (app_security.can_manage_gantt_project(project_id))
WITH CHECK (app_security.can_manage_gantt_project(project_id));
CREATE POLICY "Gantt managers delete indirect savings items"
ON public.tb_project_indirect_savings_items FOR DELETE TO authenticated
USING (app_security.can_manage_gantt_project(project_id));

REVOKE ALL ON TABLE public.tb_project_indirect_savings_items FROM anon;
REVOKE ALL ON TABLE public.tb_project_indirect_savings_items FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tb_project_indirect_savings_items TO authenticated;

-- The RPC gains a 6th parameter, so replace it outright rather than risk a
-- second overloaded signature confusing PostgREST's RPC dispatch.
DROP FUNCTION IF EXISTS public.save_gantt_project_details(UUID, JSONB, JSONB, JSONB, JSONB);

CREATE FUNCTION public.save_gantt_project_details(
  p_project_id UUID,
  p_overview JSONB,
  p_team JSONB,
  p_milestones JSONB,
  p_savings JSONB,
  p_indirect_items JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, app_security
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  IF NOT app_security.can_manage_gantt_project(p_project_id) THEN
    RAISE EXCEPTION 'Not authorized to manage Gantt project %', p_project_id
      USING ERRCODE = '42501';
  END IF;

  SELECT project.workspace_id
  INTO v_workspace_id
  FROM public.tb_project_registry AS project
  WHERE project.id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gantt project % does not exist', p_project_id
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tb_project_registry
  SET start_date = CASE
        WHEN p_overview ? 'start_date' THEN NULLIF(p_overview ->> 'start_date', '')::DATE
        ELSE start_date
      END,
      due_date = CASE
        WHEN p_overview ? 'due_date' THEN NULLIF(p_overview ->> 'due_date', '')::DATE
        ELSE due_date
      END,
      go_live_date = CASE
        WHEN p_overview ? 'due_date' THEN NULLIF(p_overview ->> 'due_date', '')::DATE
        ELSE go_live_date
      END,
      progress_percent = CASE
        WHEN p_overview ? 'progress_percent' THEN COALESCE((p_overview ->> 'progress_percent')::NUMERIC, 0)
        ELSE progress_percent
      END,
      status = CASE
        WHEN p_overview ? 'status' THEN p_overview ->> 'status'
        ELSE status
      END,
      owner_team = CASE
        WHEN p_overview ? 'owner_team' THEN NULLIF(p_overview ->> 'owner_team', '')
        ELSE owner_team
      END,
      owner_holding = CASE
        WHEN p_overview ? 'owner_holding' THEN NULLIF(p_overview ->> 'owner_holding', '')
        ELSE owner_holding
      END,
      worklog_project_type = CASE
        WHEN p_overview ? 'worklog_project_type' THEN NULLIF(p_overview ->> 'worklog_project_type', '')
        ELSE worklog_project_type
      END,
      head_lead_user_id = CASE
        WHEN p_overview ? 'head_lead_user_id' THEN NULLIF(p_overview ->> 'head_lead_user_id', '')::UUID
        ELSE head_lead_user_id
      END,
      head_lead_name = CASE
        WHEN p_overview ? 'head_lead_name' THEN NULLIF(p_overview ->> 'head_lead_name', '')
        ELSE head_lead_name
      END,
      updated_at = now()
  WHERE id = p_project_id;

  INSERT INTO public.tb_project_team_contribution (
    project_id,
    workspace_id,
    user_id,
    user_name,
    role_in_project,
    target_contribution_percent,
    manual_actual_hours,
    manual_actual_percent,
    notes,
    updated_at
  )
  SELECT
    p_project_id,
    v_workspace_id,
    (item ->> 'user_id')::UUID,
    item ->> 'user_name',
    COALESCE(item ->> 'role_in_project', 'developer'),
    COALESCE((item ->> 'target_contribution_percent')::NUMERIC, 0),
    NULLIF(item ->> 'manual_actual_hours', '')::NUMERIC,
    NULLIF(item ->> 'manual_actual_percent', '')::NUMERIC,
    NULLIF(item ->> 'notes', ''),
    now()
  FROM jsonb_array_elements(COALESCE(p_team, '[]'::JSONB)) AS rows(item)
  ON CONFLICT (project_id, user_id) DO UPDATE
  SET workspace_id = EXCLUDED.workspace_id,
      user_name = EXCLUDED.user_name,
      role_in_project = EXCLUDED.role_in_project,
      target_contribution_percent = EXCLUDED.target_contribution_percent,
      manual_actual_hours = EXCLUDED.manual_actual_hours,
      manual_actual_percent = EXCLUDED.manual_actual_percent,
      notes = EXCLUDED.notes,
      updated_at = now();

  DELETE FROM public.tb_project_team_contribution AS existing
  WHERE existing.project_id = p_project_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_team, '[]'::JSONB)) AS rows(item)
      WHERE (item ->> 'user_id')::UUID = existing.user_id
    );

  INSERT INTO public.tb_project_milestones (
    id,
    project_id,
    workspace_id,
    milestone_name,
    start_date,
    due_date,
    status,
    progress_percent,
    assigned_user_id,
    assigned_user_name,
    sequence_order,
    notes,
    updated_at
  )
  SELECT
    (item ->> 'id')::UUID,
    p_project_id,
    v_workspace_id,
    item ->> 'milestone_name',
    NULLIF(item ->> 'start_date', '')::DATE,
    NULLIF(item ->> 'due_date', '')::DATE,
    COALESCE(item ->> 'status', 'in_progress'),
    COALESCE((item ->> 'progress_percent')::NUMERIC, 0),
    NULLIF(item ->> 'assigned_user_id', '')::UUID,
    NULLIF(item ->> 'assigned_user_name', ''),
    COALESCE((item ->> 'sequence_order')::INTEGER, 0),
    NULLIF(item ->> 'notes', ''),
    now()
  FROM jsonb_array_elements(COALESCE(p_milestones, '[]'::JSONB)) AS rows(item)
  ON CONFLICT (id) DO UPDATE
  SET project_id = EXCLUDED.project_id,
      workspace_id = EXCLUDED.workspace_id,
      milestone_name = EXCLUDED.milestone_name,
      start_date = EXCLUDED.start_date,
      due_date = EXCLUDED.due_date,
      status = EXCLUDED.status,
      progress_percent = EXCLUDED.progress_percent,
      assigned_user_id = EXCLUDED.assigned_user_id,
      assigned_user_name = EXCLUDED.assigned_user_name,
      sequence_order = EXCLUDED.sequence_order,
      notes = EXCLUDED.notes,
      updated_at = now();

  DELETE FROM public.tb_project_milestones AS existing
  WHERE existing.project_id = p_project_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_milestones, '[]'::JSONB)) AS rows(item)
      WHERE (item ->> 'id')::UUID = existing.id
    );

  INSERT INTO public.tb_project_indirect_savings_items (
    id,
    project_id,
    workspace_id,
    label,
    monthly_salary,
    headcount,
    days_saved_per_month,
    working_days_per_month,
    sequence_order,
    updated_at
  )
  SELECT
    (item ->> 'id')::UUID,
    p_project_id,
    v_workspace_id,
    item ->> 'label',
    COALESCE((item ->> 'monthly_salary')::NUMERIC, 0),
    COALESCE((item ->> 'headcount')::NUMERIC, 1),
    COALESCE((item ->> 'days_saved_per_month')::NUMERIC, 0),
    COALESCE((item ->> 'working_days_per_month')::NUMERIC, 22),
    COALESCE((item ->> 'sequence_order')::INTEGER, 0),
    now()
  FROM jsonb_array_elements(COALESCE(p_indirect_items, '[]'::JSONB)) AS rows(item)
  ON CONFLICT (id) DO UPDATE
  SET project_id = EXCLUDED.project_id,
      workspace_id = EXCLUDED.workspace_id,
      label = EXCLUDED.label,
      monthly_salary = EXCLUDED.monthly_salary,
      headcount = EXCLUDED.headcount,
      days_saved_per_month = EXCLUDED.days_saved_per_month,
      working_days_per_month = EXCLUDED.working_days_per_month,
      sequence_order = EXCLUDED.sequence_order,
      updated_at = now();

  DELETE FROM public.tb_project_indirect_savings_items AS existing
  WHERE existing.project_id = p_project_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_indirect_items, '[]'::JSONB)) AS rows(item)
      WHERE (item ->> 'id')::UUID = existing.id
    );

  INSERT INTO public.tb_project_cost_savings (
    project_id,
    workspace_id,
    direct_savings_mode,
    direct_baseline_cost_annual,
    direct_target_cost_annual,
    direct_savings_annual,
    direct_savings_notes,
    indirect_manhour_saved_annual,
    indirect_hourly_rate,
    indirect_savings_annual,
    indirect_savings_notes,
    avoidance_savings_annual,
    avoidance_savings_notes,
    support_savings_annual,
    support_ticket_baseline_monthly,
    support_ticket_target_monthly,
    support_cost_per_ticket,
    support_hours_per_ticket,
    support_hourly_rate,
    support_savings_notes,
    incremental_run_cost_annual,
    manual_total_savings_override,
    value_add_multiplier,
    savings_share_percentage,
    months_realized_this_year,
    baseline_before,
    target_after,
    calculation_formula,
    ref_proof_url,
    verification_status,
    updated_at
  ) VALUES (
    p_project_id,
    v_workspace_id,
    COALESCE(p_savings ->> 'direct_savings_mode', 'cost_reduction'),
    COALESCE((p_savings ->> 'direct_baseline_cost_annual')::NUMERIC, 0),
    COALESCE((p_savings ->> 'direct_target_cost_annual')::NUMERIC, 0),
    COALESCE((p_savings ->> 'direct_savings_annual')::NUMERIC, 0),
    NULLIF(p_savings ->> 'direct_savings_notes', ''),
    COALESCE((p_savings ->> 'indirect_manhour_saved_annual')::NUMERIC, 0),
    COALESCE((p_savings ->> 'indirect_hourly_rate')::NUMERIC, 350),
    COALESCE((p_savings ->> 'indirect_savings_annual')::NUMERIC, 0),
    NULLIF(p_savings ->> 'indirect_savings_notes', ''),
    COALESCE((p_savings ->> 'avoidance_savings_annual')::NUMERIC, 0),
    NULLIF(p_savings ->> 'avoidance_savings_notes', ''),
    COALESCE((p_savings ->> 'support_savings_annual')::NUMERIC, 0),
    COALESCE((p_savings ->> 'support_ticket_baseline_monthly')::NUMERIC, 0),
    COALESCE((p_savings ->> 'support_ticket_target_monthly')::NUMERIC, 0),
    COALESCE((p_savings ->> 'support_cost_per_ticket')::NUMERIC, 0),
    COALESCE((p_savings ->> 'support_hours_per_ticket')::NUMERIC, 0),
    COALESCE((p_savings ->> 'support_hourly_rate')::NUMERIC, 350),
    NULLIF(p_savings ->> 'support_savings_notes', ''),
    COALESCE((p_savings ->> 'incremental_run_cost_annual')::NUMERIC, 0),
    NULLIF(p_savings ->> 'manual_total_savings_override', '')::NUMERIC,
    COALESCE((p_savings ->> 'value_add_multiplier')::NUMERIC, 0),
    COALESCE((p_savings ->> 'savings_share_percentage')::NUMERIC, 100),
    NULLIF(p_savings ->> 'months_realized_this_year', '')::NUMERIC,
    NULLIF(p_savings ->> 'baseline_before', ''),
    NULLIF(p_savings ->> 'target_after', ''),
    NULLIF(p_savings ->> 'calculation_formula', ''),
    NULLIF(p_savings ->> 'ref_proof_url', ''),
    COALESCE(p_savings ->> 'verification_status', 'draft'),
    now()
  )
  ON CONFLICT (project_id) DO UPDATE
  SET workspace_id = EXCLUDED.workspace_id,
      direct_savings_mode = EXCLUDED.direct_savings_mode,
      direct_baseline_cost_annual = EXCLUDED.direct_baseline_cost_annual,
      direct_target_cost_annual = EXCLUDED.direct_target_cost_annual,
      direct_savings_annual = EXCLUDED.direct_savings_annual,
      direct_savings_notes = EXCLUDED.direct_savings_notes,
      indirect_manhour_saved_annual = EXCLUDED.indirect_manhour_saved_annual,
      indirect_hourly_rate = EXCLUDED.indirect_hourly_rate,
      indirect_savings_annual = EXCLUDED.indirect_savings_annual,
      indirect_savings_notes = EXCLUDED.indirect_savings_notes,
      avoidance_savings_annual = EXCLUDED.avoidance_savings_annual,
      avoidance_savings_notes = EXCLUDED.avoidance_savings_notes,
      support_savings_annual = EXCLUDED.support_savings_annual,
      support_ticket_baseline_monthly = EXCLUDED.support_ticket_baseline_monthly,
      support_ticket_target_monthly = EXCLUDED.support_ticket_target_monthly,
      support_cost_per_ticket = EXCLUDED.support_cost_per_ticket,
      support_hours_per_ticket = EXCLUDED.support_hours_per_ticket,
      support_hourly_rate = EXCLUDED.support_hourly_rate,
      support_savings_notes = EXCLUDED.support_savings_notes,
      incremental_run_cost_annual = EXCLUDED.incremental_run_cost_annual,
      manual_total_savings_override = EXCLUDED.manual_total_savings_override,
      value_add_multiplier = EXCLUDED.value_add_multiplier,
      savings_share_percentage = EXCLUDED.savings_share_percentage,
      months_realized_this_year = EXCLUDED.months_realized_this_year,
      baseline_before = EXCLUDED.baseline_before,
      target_after = EXCLUDED.target_after,
      calculation_formula = EXCLUDED.calculation_formula,
      ref_proof_url = EXCLUDED.ref_proof_url,
      verification_status = EXCLUDED.verification_status,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_gantt_project_details(UUID, JSONB, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_gantt_project_details(UUID, JSONB, JSONB, JSONB, JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_gantt_project_details(UUID, JSONB, JSONB, JSONB, JSONB, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
