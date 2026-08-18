-- Repair the Gantt detail schema, make child writes tenant-safe, and align
-- database permissions with the admin/manager-only Gantt UI.

BEGIN;

-- Repeat the additive cost-savings columns so environments whose migration
-- history drifted still converge before PostgREST reloads its schema cache.
ALTER TABLE public.tb_project_cost_savings
ADD COLUMN IF NOT EXISTS direct_savings_mode VARCHAR(40) DEFAULT 'cost_reduction',
ADD COLUMN IF NOT EXISTS direct_baseline_cost_annual NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS direct_target_cost_annual NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS incremental_run_cost_annual NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_ticket_baseline_monthly NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_ticket_target_monthly NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_cost_per_ticket NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_hours_per_ticket NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_hourly_rate NUMERIC(8,2) DEFAULT 350.00;

ALTER TABLE public.tb_project_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_project_team_contribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_project_cost_savings ENABLE ROW LEVEL SECURITY;

-- The parent project owns tenant scope. Repair existing child rows where the
-- parent has a workspace and keep future rows synchronized by trigger.
UPDATE public.tb_project_team_contribution AS child
SET workspace_id = project.workspace_id
FROM public.tb_project_registry AS project
WHERE project.id = child.project_id
  AND project.workspace_id IS NOT NULL
  AND child.workspace_id IS DISTINCT FROM project.workspace_id;

UPDATE public.tb_project_milestones AS child
SET workspace_id = project.workspace_id
FROM public.tb_project_registry AS project
WHERE project.id = child.project_id
  AND project.workspace_id IS NOT NULL
  AND child.workspace_id IS DISTINCT FROM project.workspace_id;

UPDATE public.tb_project_cost_savings AS child
SET workspace_id = project.workspace_id
FROM public.tb_project_registry AS project
WHERE project.id = child.project_id
  AND project.workspace_id IS NOT NULL
  AND child.workspace_id IS DISTINCT FROM project.workspace_id;

CREATE OR REPLACE FUNCTION app_security.sync_gantt_child_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
BEGIN
  SELECT project.workspace_id
  INTO NEW.workspace_id
  FROM public.tb_project_registry AS project
  WHERE project.id = NEW.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gantt project % does not exist', NEW.project_id
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_security.sync_gantt_child_workspace() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_sync_gantt_team_workspace ON public.tb_project_team_contribution;
CREATE TRIGGER trg_sync_gantt_team_workspace
BEFORE INSERT OR UPDATE OF project_id, workspace_id
ON public.tb_project_team_contribution
FOR EACH ROW EXECUTE FUNCTION app_security.sync_gantt_child_workspace();

DROP TRIGGER IF EXISTS trg_sync_gantt_milestone_workspace ON public.tb_project_milestones;
CREATE TRIGGER trg_sync_gantt_milestone_workspace
BEFORE INSERT OR UPDATE OF project_id, workspace_id
ON public.tb_project_milestones
FOR EACH ROW EXECUTE FUNCTION app_security.sync_gantt_child_workspace();

DROP TRIGGER IF EXISTS trg_sync_gantt_savings_workspace ON public.tb_project_cost_savings;
CREATE TRIGGER trg_sync_gantt_savings_workspace
BEFORE INSERT OR UPDATE OF project_id, workspace_id
ON public.tb_project_cost_savings
FOR EACH ROW EXECUTE FUNCTION app_security.sync_gantt_child_workspace();

-- Central helpers avoid trusting a client-provided child.workspace_id in RLS.
CREATE OR REPLACE FUNCTION app_security.can_read_gantt_project(target_project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tb_project_registry AS project
    WHERE project.id = target_project_id
      AND (
        app_security.is_workspace_member(project.workspace_id)
        OR app_security.has_workspace_grant(project.workspace_id)
        OR app_security.current_user_is_admin()
      )
  );
$$;

CREATE OR REPLACE FUNCTION app_security.can_manage_gantt_project(target_project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tb_project_registry AS project
    WHERE project.id = target_project_id
      AND (
        app_security.is_workspace_admin_or_manager(project.workspace_id)
        OR app_security.current_user_is_admin()
      )
  );
$$;

REVOKE ALL ON FUNCTION app_security.can_read_gantt_project(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_security.can_manage_gantt_project(UUID) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_security TO authenticated;
GRANT EXECUTE ON FUNCTION app_security.can_read_gantt_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_security.can_manage_gantt_project(UUID) TO authenticated;

-- Keep the verification actor/time server-controlled.
CREATE OR REPLACE FUNCTION app_security.set_cost_savings_verification_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_security
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.verification_status = 'verified' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified_by := app_security.current_internal_user_id();
      NEW.verified_at := now();
    ELSIF OLD.verification_status IS DISTINCT FROM 'verified' THEN
      NEW.verified_by := app_security.current_internal_user_id();
      NEW.verified_at := now();
    ELSE
      NEW.verified_by := OLD.verified_by;
      NEW.verified_at := OLD.verified_at;
    END IF;
  ELSE
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_security.set_cost_savings_verification_audit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_cost_savings_verification_audit ON public.tb_project_cost_savings;
CREATE TRIGGER trg_cost_savings_verification_audit
BEFORE INSERT OR UPDATE
ON public.tb_project_cost_savings
FOR EACH ROW EXECUTE FUNCTION app_security.set_cost_savings_verification_audit();

-- Replace the permissive policies with operation-specific workspace policies.
DROP POLICY IF EXISTS "Members read team contributions" ON public.tb_project_team_contribution;
DROP POLICY IF EXISTS "Members manage team contributions" ON public.tb_project_team_contribution;
DROP POLICY IF EXISTS "Gantt members read team contributions" ON public.tb_project_team_contribution;
DROP POLICY IF EXISTS "Gantt managers insert team contributions" ON public.tb_project_team_contribution;
DROP POLICY IF EXISTS "Gantt managers update team contributions" ON public.tb_project_team_contribution;
DROP POLICY IF EXISTS "Gantt managers delete team contributions" ON public.tb_project_team_contribution;

CREATE POLICY "Gantt members read team contributions"
ON public.tb_project_team_contribution FOR SELECT TO authenticated
USING (app_security.can_read_gantt_project(project_id));
CREATE POLICY "Gantt managers insert team contributions"
ON public.tb_project_team_contribution FOR INSERT TO authenticated
WITH CHECK (app_security.can_manage_gantt_project(project_id));
CREATE POLICY "Gantt managers update team contributions"
ON public.tb_project_team_contribution FOR UPDATE TO authenticated
USING (app_security.can_manage_gantt_project(project_id))
WITH CHECK (app_security.can_manage_gantt_project(project_id));
CREATE POLICY "Gantt managers delete team contributions"
ON public.tb_project_team_contribution FOR DELETE TO authenticated
USING (app_security.can_manage_gantt_project(project_id));

DROP POLICY IF EXISTS "Members read milestones" ON public.tb_project_milestones;
DROP POLICY IF EXISTS "Members manage milestones" ON public.tb_project_milestones;
DROP POLICY IF EXISTS "Gantt members read milestones" ON public.tb_project_milestones;
DROP POLICY IF EXISTS "Gantt managers insert milestones" ON public.tb_project_milestones;
DROP POLICY IF EXISTS "Gantt managers update milestones" ON public.tb_project_milestones;
DROP POLICY IF EXISTS "Gantt managers delete milestones" ON public.tb_project_milestones;

CREATE POLICY "Gantt members read milestones"
ON public.tb_project_milestones FOR SELECT TO authenticated
USING (app_security.can_read_gantt_project(project_id));
CREATE POLICY "Gantt managers insert milestones"
ON public.tb_project_milestones FOR INSERT TO authenticated
WITH CHECK (app_security.can_manage_gantt_project(project_id));
CREATE POLICY "Gantt managers update milestones"
ON public.tb_project_milestones FOR UPDATE TO authenticated
USING (app_security.can_manage_gantt_project(project_id))
WITH CHECK (app_security.can_manage_gantt_project(project_id));
CREATE POLICY "Gantt managers delete milestones"
ON public.tb_project_milestones FOR DELETE TO authenticated
USING (app_security.can_manage_gantt_project(project_id));

DROP POLICY IF EXISTS "Members read cost savings" ON public.tb_project_cost_savings;
DROP POLICY IF EXISTS "Members manage cost savings" ON public.tb_project_cost_savings;
DROP POLICY IF EXISTS "Gantt members read cost savings" ON public.tb_project_cost_savings;
DROP POLICY IF EXISTS "Gantt managers insert cost savings" ON public.tb_project_cost_savings;
DROP POLICY IF EXISTS "Gantt managers update cost savings" ON public.tb_project_cost_savings;
DROP POLICY IF EXISTS "Gantt managers delete cost savings" ON public.tb_project_cost_savings;

CREATE POLICY "Gantt members read cost savings"
ON public.tb_project_cost_savings FOR SELECT TO authenticated
USING (app_security.can_read_gantt_project(project_id));
CREATE POLICY "Gantt managers insert cost savings"
ON public.tb_project_cost_savings FOR INSERT TO authenticated
WITH CHECK (app_security.can_manage_gantt_project(project_id));
CREATE POLICY "Gantt managers update cost savings"
ON public.tb_project_cost_savings FOR UPDATE TO authenticated
USING (app_security.can_manage_gantt_project(project_id))
WITH CHECK (app_security.can_manage_gantt_project(project_id));

-- The route already admits workspace managers, so make the registry RLS agree.
DROP POLICY IF EXISTS "Allow manage projects for workspace admins/managers" ON public.tb_project_registry;
DROP POLICY IF EXISTS "Admins manage own projects" ON public.tb_project_registry;
DROP POLICY IF EXISTS "Admins or managers manage own projects" ON public.tb_project_registry;
CREATE POLICY "Admins or managers manage own projects"
ON public.tb_project_registry FOR ALL TO authenticated
USING (
  app_security.is_workspace_admin_or_manager(workspace_id)
  OR app_security.current_user_is_admin()
)
WITH CHECK (
  app_security.is_workspace_admin_or_manager(workspace_id)
  OR app_security.current_user_is_admin()
);

-- Explicit Data API grants: signed-out clients get no Gantt data; RLS decides
-- row access for authenticated clients.
REVOKE ALL ON TABLE public.tb_project_registry FROM anon;
REVOKE ALL ON TABLE public.tb_project_team_contribution FROM anon;
REVOKE ALL ON TABLE public.tb_project_milestones FROM anon;
REVOKE ALL ON TABLE public.tb_project_cost_savings FROM anon;

REVOKE ALL ON TABLE public.tb_project_registry FROM authenticated;
REVOKE ALL ON TABLE public.tb_project_team_contribution FROM authenticated;
REVOKE ALL ON TABLE public.tb_project_milestones FROM authenticated;
REVOKE ALL ON TABLE public.tb_project_cost_savings FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tb_project_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tb_project_team_contribution TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tb_project_milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tb_project_cost_savings TO authenticated;

-- Guard every numeric/status/date field exposed by the drawer. NOT VALID keeps
-- legacy rows deployable while enforcing the rules for new and changed rows.
ALTER TABLE public.tb_project_registry
ADD CONSTRAINT tb_project_registry_gantt_progress_check
CHECK (progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100) NOT VALID,
ADD CONSTRAINT tb_project_registry_gantt_dates_check
CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date) NOT VALID;

ALTER TABLE public.tb_project_team_contribution
ADD CONSTRAINT tb_project_team_role_check
CHECK (role_in_project IN ('lead', 'developer', 'qa', 'uiux', 'consultant', 'support', 'other')) NOT VALID,
ADD CONSTRAINT tb_project_team_target_percent_check
CHECK (target_contribution_percent IS NULL OR target_contribution_percent BETWEEN 0 AND 100) NOT VALID,
ADD CONSTRAINT tb_project_team_actual_hours_check
CHECK (manual_actual_hours IS NULL OR manual_actual_hours >= 0) NOT VALID,
ADD CONSTRAINT tb_project_team_actual_percent_check
CHECK (manual_actual_percent IS NULL OR manual_actual_percent BETWEEN 0 AND 100) NOT VALID;

ALTER TABLE public.tb_project_milestones
ADD CONSTRAINT tb_project_milestones_status_check
CHECK (status IN ('planning', 'in_progress', 'completed', 'blocked')) NOT VALID,
ADD CONSTRAINT tb_project_milestones_progress_check
CHECK (progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100) NOT VALID,
ADD CONSTRAINT tb_project_milestones_dates_check
CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date) NOT VALID;

ALTER TABLE public.tb_project_cost_savings
ADD CONSTRAINT tb_project_cost_savings_direct_mode_check
CHECK (direct_savings_mode IN ('cost_reduction', 'replacement', 'new_capability')) NOT VALID,
ADD CONSTRAINT tb_project_cost_savings_verification_check
CHECK (verification_status IN ('draft', 'pending', 'verified', 'rejected')) NOT VALID,
ADD CONSTRAINT tb_project_cost_savings_nonnegative_check
CHECK (
  COALESCE(direct_savings_annual, 0) >= 0
  AND COALESCE(direct_baseline_cost_annual, 0) >= 0
  AND COALESCE(direct_target_cost_annual, 0) >= 0
  AND COALESCE(indirect_manhour_saved_annual, 0) >= 0
  AND COALESCE(indirect_hourly_rate, 0) >= 0
  AND COALESCE(indirect_savings_annual, 0) >= 0
  AND COALESCE(avoidance_savings_annual, 0) >= 0
  AND COALESCE(support_savings_annual, 0) >= 0
  AND COALESCE(support_ticket_baseline_monthly, 0) >= 0
  AND COALESCE(support_ticket_target_monthly, 0) >= 0
  AND COALESCE(support_cost_per_ticket, 0) >= 0
  AND COALESCE(support_hours_per_ticket, 0) >= 0
  AND COALESCE(support_hourly_rate, 0) >= 0
  AND COALESCE(incremental_run_cost_annual, 0) >= 0
  AND (manual_total_savings_override IS NULL OR manual_total_savings_override >= 0)
) NOT VALID;

-- Persist the entire drawer in one database transaction. This prevents a late
-- team/milestone failure from leaving overview or savings partially updated.
CREATE OR REPLACE FUNCTION public.save_gantt_project_details(
  p_project_id UUID,
  p_overview JSONB,
  p_team JSONB,
  p_milestones JSONB,
  p_savings JSONB
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
      baseline_before = EXCLUDED.baseline_before,
      target_after = EXCLUDED.target_after,
      calculation_formula = EXCLUDED.calculation_formula,
      ref_proof_url = EXCLUDED.ref_proof_url,
      verification_status = EXCLUDED.verification_status,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_gantt_project_details(UUID, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_gantt_project_details(UUID, JSONB, JSONB, JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_gantt_project_details(UUID, JSONB, JSONB, JSONB, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
