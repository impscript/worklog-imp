import { supabase } from './supabase';

export type ProjectStatus = 'planning' | 'in_progress' | 'testing' | 'completed' | 'on_hold' | 'inactive' | 'sunset' | 'retired';
export type ProjectHealth = 'on_track' | 'at_risk' | 'delayed' | 'on_hold' | 'completed' | 'planning' | 'archived';
export type TeamRole = 'lead' | 'developer' | 'qa' | 'uiux' | 'consultant' | 'support' | 'other';

export interface TeamMemberContribution {
  id?: string;
  project_id: string;
  user_id: string;
  user_name: string;
  emp_id?: string | null;
  role_in_project: TeamRole;
  target_contribution_percent: number; // e.g. 40.0
  manual_actual_hours?: number | null; // manual adjust if worklog wasn't logged
  manual_actual_percent?: number | null; // manual adjust override %
  // Computed fields
  logged_worklog_hours?: number;
  actual_contribution_percent?: number;
  notes?: string | null;
}

export interface ProjectMilestone {
  id?: string;
  project_id: string;
  milestone_name: string;
  start_date?: string | null;
  due_date?: string | null;
  status: 'planning' | 'in_progress' | 'completed' | 'blocked';
  progress_percent: number;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  sequence_order: number;
  notes?: string | null;
}

export interface ProjectCostSavings {
  id?: string;
  project_id: string;
  direct_savings_mode?: 'cost_reduction' | 'replacement' | 'new_capability' | null;
  // 1. Direct Cash Savings (Hard Savings)
  direct_savings_annual: number;
  direct_baseline_cost_annual?: number | null;
  direct_target_cost_annual?: number | null;
  direct_savings_notes?: string | null;
  // 2. Indirect Manhour / Productivity Savings
  indirect_manhour_saved_annual: number;
  indirect_hourly_rate: number;
  indirect_savings_annual: number; // computed
  indirect_savings_notes?: string | null;
  // 3. Cost Avoidance (Future Costs Avoided)
  avoidance_savings_annual: number;
  avoidance_savings_notes?: string | null;
  // 4. Support / Maintenance Savings (OpEx Saved)
  support_savings_annual: number;
  support_ticket_baseline_monthly?: number | null;
  support_ticket_target_monthly?: number | null;
  support_cost_per_ticket?: number | null;
  support_hours_per_ticket?: number | null;
  support_hourly_rate?: number | null;
  support_savings_notes?: string | null;
  incremental_run_cost_annual?: number | null;
  // Manual override if custom calculation
  manual_total_savings_override?: number | null;
  // Calculation details & Audit evidence
  baseline_before?: string | null;
  target_after?: string | null;
  calculation_formula?: string | null;
  ref_proof_url?: string | null;
  // Verification sign-off
  verification_status: 'draft' | 'pending' | 'verified' | 'rejected';
  verified_by?: string | null;
  verified_at?: string | null;
}

export interface GanttProject {
  worklog_project_type?: string | null;
  id: string;
  project_name: string;
  project_slug?: string;
  description?: string | null;
  workspace_id?: string | null;
  parent_project_id?: string | null;
  parent_name?: string | null;
  status: ProjectStatus;
  project_type: string;
  owner_holding?: string | null;
  owner_team?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  progress_percent: number;
  head_lead_user_id?: string | null;
  head_lead_name?: string | null;
  head_lead_emp_id?: string | null;
  project_health: ProjectHealth;
  // Related lists
  team_contributions: TeamMemberContribution[];
  milestones: ProjectMilestone[];
  cost_savings?: ProjectCostSavings | null;
  children?: GanttProject[];
  // Computed metrics
  total_worklog_hours: number;
  total_savings_annual: number;
}

/**
 * Resolves the corporate face photo URL from WMS with fallback to UI-Avatars
 */
export function getUserAvatarUrl(name?: string | null, empId?: string | null): string {
  if (empId && empId.trim() && empId.trim() !== 'N/A') {
    return `https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${empId.trim()}`;
  }
  const cleanName = (name || 'User')
    .replace(/^(นาย|นางสาว|นาง|คุณ|ดร\.|dr\.|mr\.|ms\.|mrs\.)\s*/i, '')
    .trim();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=6366f1&color=fff&bold=true`;
}

export function getUiAvatarFallbackUrl(name?: string | null, bg = '6366f1'): string {
  const cleanName = (name || 'User')
    .replace(/^(นาย|นางสาว|นาง|คุณ|ดร\.|dr\.|mr\.|ms\.|mrs\.)\s*/i, '')
    .trim();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=${bg}&color=fff&bold=true`;
}

/**
 * Builds a hierarchical parent > child tree from a flat list of Gantt projects
 */

export const PROJECT_TYPE_META: Record<
  string,
  { label: string; icon: string; badge: string; category: 'project' | 'support' | 'management' | 'other' }
> = {
  Project: {
    label: 'Project',
    icon: '🚀',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    category: 'project',
  },
  Upgrade: {
    label: 'Upgrade',
    icon: '⚡',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    category: 'project',
  },
  'Support MA': {
    label: 'Support MA',
    icon: '🛠️',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    category: 'support',
  },
  'Support Go-Live': {
    label: 'Support Go-Live',
    icon: '🚀',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    category: 'support',
  },
  Management: {
    label: 'Management',
    icon: '📋',
    badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    category: 'management',
  },
};

export function getProjectTypeMeta(type?: string | null) {
  if (!type) {
    return {
      label: 'Project',
      icon: '🚀',
      badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      category: 'project' as const,
    };
  }
  if (PROJECT_TYPE_META[type]) return PROJECT_TYPE_META[type];
  const lower = type.toLowerCase();
  if (lower.includes('support') || lower.includes('ma') || lower.includes('routine')) {
    return {
      label: type,
      icon: '🛠️',
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      category: 'support' as const,
    };
  }
  if (lower.includes('manage')) {
    return {
      label: type,
      icon: '📋',
      badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
      category: 'management' as const,
    };
  }
  return {
    label: type,
    icon: '🚀',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    category: 'project' as const,
  };
}

export function buildGanttTree(projects: GanttProject[]): GanttProject[] {
  const map = new Map<string, GanttProject>();
  const roots: GanttProject[] = [];

  projects.forEach((p) => {
    map.set(p.id, { ...p, children: [] });
  });

  projects.forEach((p) => {
    const node = map.get(p.id)!;
    if (p.parent_project_id && map.has(p.parent_project_id)) {
      const parent = map.get(p.parent_project_id)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, { label: string; color: string; bg: string; dot: string }> = {
  planning: {
    label: 'Planning',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  testing: {
    label: 'Testing / UAT',
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  on_hold: {
    label: 'On Hold',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  inactive: {
    label: 'Inactive',
    color: 'text-stone-600 dark:text-stone-400',
    bg: 'bg-stone-500/10 border-stone-500/30 text-stone-700 dark:text-stone-300',
    dot: 'bg-stone-400',
  },
  sunset: {
    label: 'Sunset',
    color: 'text-zinc-600 dark:text-zinc-400',
    bg: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-700 dark:text-zinc-300',
    dot: 'bg-zinc-400',
  },
  retired: {
    label: 'Retired',
    color: 'text-neutral-600 dark:text-neutral-400',
    bg: 'bg-neutral-500/10 border-neutral-500/30 text-neutral-700 dark:text-neutral-300',
    dot: 'bg-neutral-400',
  },
};

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, { label: string; badge: string; icon: string }> = {
  on_track: {
    label: 'On Track',
    badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    icon: '🟢',
  },
  at_risk: {
    label: 'At Risk',
    badge: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300',
    icon: '🟡',
  },
  delayed: {
    label: 'Delayed',
    badge: 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300',
    icon: '🔴',
  },
  on_hold: {
    label: 'On Hold',
    badge: 'bg-slate-500/15 border-slate-500/30 text-slate-700 dark:text-slate-300',
    icon: '⏸️',
  },
  completed: {
    label: 'Completed',
    badge: 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300',
    icon: '✅',
  },
  planning: {
    label: 'Planning',
    badge: 'bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300',
    icon: '🗓️',
  },
  archived: {
    label: 'Archived',
    badge: 'bg-stone-500/15 border-stone-500/30 text-stone-700 dark:text-stone-300',
    icon: '📦',
  },
};

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  lead: '👑 Head / Project Lead',
  developer: '💻 Developer / Engineer',
  qa: '🧪 QA / Tester',
  uiux: '🎨 UI/UX Designer',
  consultant: '💡 Solution Consultant',
  support: '🛠️ Support / Operations',
  other: '📁 Contributor',
};

/**
 * Calculates Project Health based on Status, Due Date, and Progress
 */
export function calculateProjectHealth(
  startDateStr?: string | null,
  dueDateStr?: string | null,
  progressPercent: number = 0,
  status: ProjectStatus = 'in_progress'
): ProjectHealth {
  // 1. Specific lifecycle statuses override pace
  if (status === 'on_hold') return 'on_hold';
  if (status === 'completed') return 'completed';
  if (status === 'sunset' || status === 'retired' || status === 'inactive') return 'archived';
  if (status === 'planning') return 'planning';

  // 2. Active execution schedule health check
  if (!dueDateStr) return 'on_track';

  const now = new Date();
  const dueDate = new Date(dueDateStr);
  const nowTime = now.getTime();
  const dueDateTime = dueDate.getTime();

  // If already past due date and not 100% complete
  if (nowTime > dueDateTime && progressPercent < 100) {
    return 'delayed';
  }

  // Calculate elapsed progress vs timeline ratio
  if (startDateStr) {
    const startDate = new Date(startDateStr);
    const totalDuration = dueDateTime - startDate.getTime();
    const elapsed = nowTime - startDate.getTime();
    if (totalDuration > 0 && elapsed > 0) {
      const elapsedRatio = elapsed / totalDuration;
      // If elapsed time is more than 75% but progress is under 50%
      if (elapsedRatio >= 0.75 && progressPercent < 50) {
        return 'at_risk';
      }
    }
  }

  // If due within 14 days and progress is under 70%
  const daysRemaining = (dueDateTime - nowTime) / (1000 * 60 * 60 * 24);
  if (daysRemaining <= 14 && progressPercent < 70) {
    return 'at_risk';
  }

  return 'on_track';
}

/**
 * Checks if a project's active timeline overlaps with a given calendar year.
 */
export function isProjectInYear(project: GanttProject, year: number | 'all'): boolean {
  if (year === 'all') return true;

  const yearStart = new Date(year, 0, 1, 0, 0, 0).getTime();
  const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

  let pStart = yearStart;
  if (project.start_date) {
    const parsed = new Date(project.start_date).getTime();
    if (!isNaN(parsed)) pStart = parsed;
  }

  let pDue = yearEnd;
  if (project.due_date) {
    const parsed = new Date(project.due_date).getTime();
    if (!isNaN(parsed)) pDue = parsed;
  } else {
    // If no due date, project defaults to 30 days after start_date
    pDue = pStart + 30 * 86400000;
  }

  // Intersect condition: [pStart, pDue] overlaps with [yearStart, yearEnd]
  return pStart <= yearEnd && pDue >= yearStart;
}

/**
 * Extracts all unique years from projects plus surrounding window (current year ± 2)
 */
export function getAvailableProjectYears(projects: GanttProject[]): number[] {
  const currentYear = new Date().getFullYear();
  const yearSet = new Set<number>([
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
  ]);

  projects.forEach((p) => {
    if (p.start_date) {
      const y = new Date(p.start_date).getFullYear();
      if (!isNaN(y) && y >= 2000 && y <= 2100) yearSet.add(y);
    }
    if (p.due_date) {
      const y = new Date(p.due_date).getFullYear();
      if (!isNaN(y) && y >= 2000 && y <= 2100) yearSet.add(y);
    }
  });

  return Array.from(yearSet).sort((a, b) => b - a); // Descending (e.g. 2028, 2027, 2026, 2025, 2024)
}

/**
 * Computes Gross Annual Savings from 4-Dimension Cost Savings
 */
export function calculateGrossSavings(savings?: Partial<ProjectCostSavings> | null): number {
  if (!savings) return 0;
  if (savings.manual_total_savings_override !== undefined && savings.manual_total_savings_override !== null && savings.manual_total_savings_override > 0) {
    return Number(savings.manual_total_savings_override);
  }

  const directMode = savings.direct_savings_mode || 'cost_reduction';
  const baselineCost = Number(savings.direct_baseline_cost_annual) || 0;
  const targetCost = Number(savings.direct_target_cost_annual) || 0;
  const hasDirectCalculator = baselineCost > 0 || targetCost > 0;
  const direct = directMode === 'new_capability'
    ? 0
    : hasDirectCalculator
      ? Math.max(0, baselineCost - targetCost)
      : Number(savings.direct_savings_annual) || 0;
  const indirectHours = Number(savings.indirect_manhour_saved_annual) || 0;
  const rate = Number(savings.indirect_hourly_rate) || 350;
  const indirect = Number(savings.indirect_savings_annual) || (indirectHours * rate);
  const avoidance = Number(savings.avoidance_savings_annual) || 0;
  const supportBaseline = Number(savings.support_ticket_baseline_monthly) || 0;
  const supportTarget = Number(savings.support_ticket_target_monthly) || 0;
  const supportCostPerTicket = Number(savings.support_cost_per_ticket) || 0;
  const supportHoursPerTicket = Number(savings.support_hours_per_ticket) || 0;
  const supportHourlyRate = Number(savings.support_hourly_rate) || 350;
  const supportCostUnit = supportCostPerTicket + (supportHoursPerTicket * supportHourlyRate);
  const hasSupportCalculator = supportBaseline > 0 || supportTarget > 0 || supportCostUnit > 0;
  const support = hasSupportCalculator
    ? Math.max(0, supportBaseline - supportTarget) * 12 * supportCostUnit
    : Number(savings.support_savings_annual) || 0;

  return direct + indirect + avoidance + support;
}

/**
 * Computes Net Annual Benefit after incremental run cost.
 */
export function calculateTotalSavings(savings?: Partial<ProjectCostSavings> | null): number {
  if (!savings) return 0;
  return calculateGrossSavings(savings) - (Number(savings.incremental_run_cost_annual) || 0);
}

/**
 * Helper to get currently active workspace ID from session
 */
export function getActiveWorkspaceId(): string | null {
  try {
    const sessionStr = localStorage.getItem('worklog_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    return session?.activeWorkspaceId || null;
  } catch {
    return null;
  }
}

/**
 * Fetch all projects for Gantt Roadmap view with team members, milestones, and cost savings
 */
export async function fetchGanttProjects(workspaceId?: string | null): Promise<GanttProject[]> {
  try {
    const activeWsId = workspaceId !== undefined ? workspaceId : getActiveWorkspaceId();

    // 1. Fetch Projects from tb_project_registry scoped by workspace
    let query = supabase.from('tb_project_registry').select('*, parent:parent_project_id(project_name)').order('created_at', { ascending: false });
    if (activeWsId) {
      query = query.eq('workspace_id', activeWsId);
    }
    const { data: rawProjects, error: projErr } = await query;
    if (projErr) throw projErr;

    if (!rawProjects || rawProjects.length === 0) return [];

    const projectIds = rawProjects.map((p) => p.id);

    // 2. Fetch Users Map for resolving corporate employee photo (emp_id)
    const { data: usersData } = await supabase
      .from('users')
      .select('id, emp_id, full_name, nickname');

    const userMapById = new Map<string, { emp_id?: string; full_name?: string }>();
    const userMapByName = new Map<string, string>(); // lowercase name -> emp_id

    (usersData || []).forEach((u) => {
      if (u.id) {
        userMapById.set(u.id, { emp_id: u.emp_id || undefined, full_name: u.full_name || undefined });
      }
      if (u.full_name && u.emp_id) {
        userMapByName.set(u.full_name.toLowerCase().trim(), u.emp_id);
      }
      if (u.nickname && u.emp_id) {
        userMapByName.set(u.nickname.toLowerCase().trim(), u.emp_id);
      }
    });

    // 3. Fetch Team Contributions
    const { data: teamData } = await supabase
      .from('tb_project_team_contribution')
      .select('*')
      .in('project_id', projectIds);

    // 4. Fetch Milestones
    const { data: milestonesData } = await supabase
      .from('tb_project_milestones')
      .select('*')
      .in('project_id', projectIds)
      .order('sequence_order', { ascending: true });

    // 5. Fetch Cost Savings
    const { data: savingsData } = await supabase
      .from('tb_project_cost_savings')
      .select('*')
      .in('project_id', projectIds);

    // 6. Fetch Actual Worklog Hours grouped by project_name and user_id / employee_name
    const projectNames = rawProjects.map((p) => p.project_name);
    const { data: worklogs } = await supabase
      .from('col_worklog')
      .select('project_name, user_id, emp_name, employee_name, total_hours')
      .in('project_name', projectNames);

    // Build worklog aggregation map: projectName -> { totalHours, userHours: { [userIdOrName]: hours } }
    const worklogSummary = new Map<string, { totalHours: number; userHours: Map<string, number> }>();
    interface RawWorklogEntry {
      project_name?: string | null;
      user_id?: string | null;
      emp_name?: string | null;
      employee_name?: string | null;
      total_hours?: string | number | null;
    }
    ((worklogs || []) as RawWorklogEntry[]).forEach((w) => {
      const pName = w.project_name || '';
      if (!worklogSummary.has(pName)) {
        worklogSummary.set(pName, { totalHours: 0, userHours: new Map<string, number>() });
      }
      const pSummary = worklogSummary.get(pName)!;
      const hours = typeof w.total_hours === 'number' ? w.total_hours : parseFloat(String(w.total_hours || 0)) || 0;
      pSummary.totalHours += hours;

      const userKey = (w.user_id || w.emp_name || w.employee_name || 'unknown').toLowerCase();
      pSummary.userHours.set(userKey, (pSummary.userHours.get(userKey) || 0) + hours);
    });

    // 7. Assemble Full Gantt Projects
    const projects: GanttProject[] = rawProjects.map((p) => {
      const pTeam = (teamData || []).filter((t) => t.project_id === p.id);
      const pMilestones = (milestonesData || []).filter((m) => m.project_id === p.id);
      const pSavings = (savingsData || []).find((s) => s.project_id === p.id);

      const pWorklog = worklogSummary.get(p.project_name);
      const totalWorklogHours = pWorklog ? pWorklog.totalHours : 0;

      // Map team members with actual hours and % (auto-synced or manual adjust)
      const teamContributions: TeamMemberContribution[] = pTeam.map((tm) => {
        let loggedHours = 0;
        if (pWorklog) {
          const userKey = (tm.user_id || tm.user_name || '').toLowerCase();
          loggedHours = pWorklog.userHours.get(userKey) || 0;
        }

        // Use manual override if specified, otherwise use logged worklog hours
        const effectiveHours = tm.manual_actual_hours !== undefined && tm.manual_actual_hours !== null
          ? tm.manual_actual_hours
          : loggedHours;

        let computedActualPercent = 0;
        if (tm.manual_actual_percent !== undefined && tm.manual_actual_percent !== null) {
          computedActualPercent = tm.manual_actual_percent;
        } else if (totalWorklogHours > 0) {
          computedActualPercent = parseFloat(((effectiveHours / totalWorklogHours) * 100).toFixed(1));
        }

        const memberEmpId =
          (tm.user_id ? userMapById.get(tm.user_id)?.emp_id : null) ||
          (tm.user_name ? userMapByName.get(tm.user_name.toLowerCase().trim()) : null) ||
          null;

        return {
          id: tm.id,
          project_id: tm.project_id,
          user_id: tm.user_id,
          user_name: tm.user_name || 'ทีมงาน',
          emp_id: memberEmpId,
          role_in_project: tm.role_in_project || 'developer',
          target_contribution_percent: parseFloat(tm.target_contribution_percent || 0),
          manual_actual_hours: tm.manual_actual_hours,
          manual_actual_percent: tm.manual_actual_percent,
          logged_worklog_hours: loggedHours,
          actual_contribution_percent: computedActualPercent,
          notes: tm.notes,
        };
      });

      // Normalise status
      let status: ProjectStatus = 'in_progress';
      if (['planning', 'in_progress', 'testing', 'completed', 'on_hold'].includes(p.status)) {
        status = p.status as ProjectStatus;
      } else if (p.status === 'active' || p.status === 'development') {
        status = 'in_progress';
      } else if (p.status === 'sunset' || p.status === 'retired') {
        status = 'completed';
      }

      // Default start/due dates if missing for clean visualization
      const startDate = p.start_date || p.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
      const dueDate = p.due_date || p.go_live_date || null;
      const progressPercent = parseFloat(p.progress_percent || (status === 'completed' ? 100 : 0));

      const projectHealth = calculateProjectHealth(startDate, dueDate, progressPercent, status);
      const totalSavingsAnnual = calculateTotalSavings(pSavings);

      const leadEmpId =
        (p.head_lead_user_id ? userMapById.get(p.head_lead_user_id)?.emp_id : null) ||
        (p.head_lead_name ? userMapByName.get(p.head_lead_name.toLowerCase().trim()) : null) ||
        null;

      return {
        id: p.id,
        project_name: p.project_name,
        project_slug: p.project_slug,
        description: p.description,
        workspace_id: p.workspace_id,
        parent_project_id: p.parent_project_id || null,
        parent_name: (p.parent && typeof p.parent === 'object' ? p.parent.project_name : null) || null,
        status,
        project_type: p.project_type || 'web_app',
        worklog_project_type: p.worklog_project_type || null,
        owner_holding: p.owner_holding,
        owner_team: p.owner_team,
        start_date: startDate,
        due_date: dueDate,
        progress_percent: progressPercent,
        head_lead_user_id: p.head_lead_user_id,
        head_lead_name: p.head_lead_name,
        head_lead_emp_id: leadEmpId,
        project_health: projectHealth,
        team_contributions: teamContributions,
        milestones: pMilestones,
        cost_savings: pSavings || null,
        total_worklog_hours: totalWorklogHours,
        total_savings_annual: totalSavingsAnnual,
      };
    });

    return projects;
  } catch (err) {
    console.error('Error fetching Gantt projects:', err);
    throw err;
  }
}

/**
 * Update Project Roadmap Overview details
 */
export async function updateProjectGanttOverview(
  projectId: string,
  payload: {
    start_date?: string | null;
    due_date?: string | null;
    progress_percent?: number;
    status?: ProjectStatus;
    head_lead_user_id?: string | null;
    head_lead_name?: string | null;
    owner_team?: string | null;
    owner_holding?: string | null;
    worklog_project_type?: string | null;
    project_health?: ProjectHealth;
  }
) {
  // Try full update with Gantt fields
  const { error } = await supabase
    .from('tb_project_registry')
    .update({
      ...payload,
      go_live_date: payload.due_date, // sync with legacy go_live_date
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  if (error) {
    // If due_date column is not yet in schema cache (migration pending), fallback to legacy columns
    if (error.message && (error.message.includes('due_date') || error.message.includes('schema cache'))) {
      const legacyPayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (payload.due_date !== undefined) legacyPayload.go_live_date = payload.due_date;
      if (payload.owner_team !== undefined) legacyPayload.owner_team = payload.owner_team;
      if (payload.owner_holding !== undefined) legacyPayload.owner_holding = payload.owner_holding;
      if (payload.worklog_project_type !== undefined) legacyPayload.worklog_project_type = payload.worklog_project_type;

      const { error: fallbackErr } = await supabase
        .from('tb_project_registry')
        .update(legacyPayload)
        .eq('id', projectId);

      if (fallbackErr) throw fallbackErr;
      return;
    }
    throw error;
  }
}

/**
 * Save / Upsert Team Member Contributions (with Target % & Manual overrides)
 */
export async function saveTeamMemberContributions(
  projectId: string,
  workspaceId: string | null | undefined,
  teamList: TeamMemberContribution[]
) {
  const activeWsId = workspaceId !== undefined && workspaceId !== null ? workspaceId : getActiveWorkspaceId();

  // First, delete current team mappings for this project
  const { error: delErr } = await supabase
    .from('tb_project_team_contribution')
    .delete()
    .eq('project_id', projectId);

  if (delErr) console.warn('Clean prior team error:', delErr);

  if (teamList.length === 0) return;

  const rows = teamList.map((tm) => ({
    project_id: projectId,
    workspace_id: activeWsId || null,
    user_id: tm.user_id,
    user_name: tm.user_name,
    role_in_project: tm.role_in_project,
    target_contribution_percent: tm.target_contribution_percent,
    manual_actual_hours: tm.manual_actual_hours,
    manual_actual_percent: tm.manual_actual_percent,
    notes: tm.notes || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('tb_project_team_contribution').insert(rows);
  if (error) throw error;
}

/**
 * Save / Upsert Project Milestones
 */
export async function saveProjectMilestones(
  projectId: string,
  workspaceId: string | null | undefined,
  milestones: ProjectMilestone[]
) {
  const activeWsId = workspaceId !== undefined && workspaceId !== null ? workspaceId : getActiveWorkspaceId();

  const { error: delErr } = await supabase
    .from('tb_project_milestones')
    .delete()
    .eq('project_id', projectId);

  if (delErr) console.warn('Clean prior milestones error:', delErr);

  if (milestones.length === 0) return;

  const rows = milestones.map((m, idx) => ({
    project_id: projectId,
    workspace_id: activeWsId || null,
    milestone_name: m.milestone_name,
    start_date: m.start_date || null,
    due_date: m.due_date || null,
    status: m.status || 'in_progress',
    progress_percent: m.progress_percent || 0,
    assigned_user_id: m.assigned_user_id || null,
    assigned_user_name: m.assigned_user_name || null,
    sequence_order: idx + 1,
    notes: m.notes || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('tb_project_milestones').insert(rows);
  if (error) throw error;
}

/**
 * Save / Upsert 4-Dimension Cost Savings
 */
export async function saveProjectCostSavings(
  projectId: string,
  workspaceId: string | null | undefined,
  savingsData: Partial<ProjectCostSavings>
) {
  const activeWsId = workspaceId !== undefined && workspaceId !== null ? workspaceId : getActiveWorkspaceId();
  const indirectRate = savingsData.indirect_hourly_rate || 350;
  const indirectHours = savingsData.indirect_manhour_saved_annual || 0;
  const indirectAnnual = indirectHours * indirectRate;
  const directMode = savingsData.direct_savings_mode || 'cost_reduction';
  const directBaseline = savingsData.direct_baseline_cost_annual || 0;
  const directTarget = savingsData.direct_target_cost_annual || 0;
  const hasDirectCalculator = directBaseline > 0 || directTarget > 0;
  const directAnnual = directMode === 'new_capability'
    ? 0
    : hasDirectCalculator
      ? Math.max(0, directBaseline - directTarget)
      : savingsData.direct_savings_annual || 0;
  const supportBaseline = savingsData.support_ticket_baseline_monthly || 0;
  const supportTarget = savingsData.support_ticket_target_monthly || 0;
  const supportCostPerTicket = savingsData.support_cost_per_ticket || 0;
  const supportHoursPerTicket = savingsData.support_hours_per_ticket || 0;
  const supportHourlyRate = savingsData.support_hourly_rate || 350;
  const supportCostUnit = supportCostPerTicket + (supportHoursPerTicket * supportHourlyRate);
  const hasSupportCalculator = supportBaseline > 0 || supportTarget > 0 || supportCostUnit > 0;
  const supportAnnual = hasSupportCalculator
    ? Math.max(0, supportBaseline - supportTarget) * 12 * supportCostUnit
    : savingsData.support_savings_annual || 0;

  const payload = {
    project_id: projectId,
    workspace_id: activeWsId || null,
    direct_savings_mode: directMode,
    direct_baseline_cost_annual: directBaseline,
    direct_target_cost_annual: directTarget,
    direct_savings_annual: directAnnual,
    direct_savings_notes: savingsData.direct_savings_notes || null,
    indirect_manhour_saved_annual: indirectHours,
    indirect_hourly_rate: indirectRate,
    indirect_savings_annual: indirectAnnual,
    indirect_savings_notes: savingsData.indirect_savings_notes || null,
    avoidance_savings_annual: savingsData.avoidance_savings_annual || 0,
    avoidance_savings_notes: savingsData.avoidance_savings_notes || null,
    support_savings_annual: supportAnnual,
    support_ticket_baseline_monthly: supportBaseline,
    support_ticket_target_monthly: supportTarget,
    support_cost_per_ticket: supportCostPerTicket,
    support_hours_per_ticket: supportHoursPerTicket,
    support_hourly_rate: supportHourlyRate,
    support_savings_notes: savingsData.support_savings_notes || null,
    incremental_run_cost_annual: savingsData.incremental_run_cost_annual || 0,
    manual_total_savings_override: savingsData.manual_total_savings_override || null,
    baseline_before: savingsData.baseline_before || null,
    target_after: savingsData.target_after || null,
    calculation_formula: savingsData.calculation_formula || null,
    ref_proof_url: savingsData.ref_proof_url || null,
    verification_status: savingsData.verification_status || 'draft',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('tb_project_cost_savings')
    .upsert(payload, { onConflict: 'project_id' });

  if (error) throw error;
}
