import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Calendar,
  User,
  Users,
  DollarSign,
  Flag,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Clock,
  Search,
  ChevronDown,
  Activity,
} from 'lucide-react';
import type {
  GanttProject,
  ProjectStatus,
  TeamMemberContribution,
  ProjectMilestone,
  ProjectCostSavings,
  ProjectGanttOverviewPayload,
  TeamRole,
  IndirectSavingsItem,
  DirectMarketRateItem,
  AvoidanceItem,
} from '../../lib/project-management';
import {
  TEAM_ROLE_LABELS,
  calculateTotalSavings,
  calculateProjectHealth,
  saveProjectGanttDetails,
  getUserAvatarUrl,
  getUiAvatarFallbackUrl,
  getProjectTypeMeta,
  isAddOnPlusType,
  USAGE_STATUS_META,
} from '../../lib/project-management';
import { MilestoneEditorModal } from './MilestoneEditorModal';
import { ConfirmDialogModal } from '../modals/ConfirmDialogModal';
import ModalPortal from '../modals/ModalPortal';
import { cn } from '../../lib/utils';
import { useNotification } from '../../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface ProjectDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: GanttProject | null;
  onProjectUpdated: (updatedProject: GanttProject) => void;
  availableUsers?: { id: string; name: string; email?: string; emp_id?: string }[];
}

interface ProjectDetailDrawerContentProps {
  project: GanttProject;
  onClose: () => void;
  onProjectUpdated: (updatedProject: GanttProject) => void;
  availableUsers: { id: string; name: string; email?: string; emp_id?: string }[];
}

interface MasterHoldingRow {
  holding_name?: string | null;
}

interface MasterProjectTypeRow {
  type_name?: string | null;
}

interface MasterSalaryRateRow {
  id: string;
  category: string;
  role: string;
  experience_bracket: string;
  salary_min: number;
  salary_max: number;
  source_label?: string | null;
  source_url?: string | null;
  source_year?: number | null;
}

const INDIRECT_CATEGORY_PRESETS = ['Analytic', 'Console Report', 'Console Data'];

function calculateProjectBusinessDays(startDate?: string | null, dueDate?: string | null): number {
  const fallback = 22; // one month of working days
  if (!startDate || !dueDate) return fallback;
  const start = new Date(startDate);
  const end = new Date(dueDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return fallback;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count || fallback;
}

interface NumberFieldProps {
  value: number;
  onValueChange: (next: number) => void;
  className?: string;
  disabled?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
}

// A numeric <input> whose displayed text is its own local state, synced from
// `value` only when `value` actually changes from the outside (a fresh item,
// a recomputed total). This lets a field show a literal "0" the user typed
// and stay blank after Backspace, instead of every keystroke elsewhere in
// this large form re-rendering the input back to "0" mid-edit.
const NumberField: React.FC<NumberFieldProps> = ({ value, onValueChange, className, disabled, min, max, step }) => {
  const [text, setText] = useState(value === 0 ? '' : String(value));
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      setText(value === 0 ? '' : String(value));
    }
  }, [value]);

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const next = raw === '' ? 0 : Number(raw);
        lastValueRef.current = next;
        onValueChange(next);
      }}
      className={className}
    />
  );
};

interface SalaryRateSearchSelectProps {
  groups: Record<string, MasterSalaryRateRow[]>;
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}

// Small searchable single-select for the market-rate position picker. Native
// <select> can't be searched by typing a substring, and the option list here
// (grouped by category) is long enough that scanning it is slow.
//
// The popover renders through a portal into document.body, positioned by the
// toggle button's own bounding rect: this component sits inside the drawer's
// scrollable tab body (overflow-y-auto), and an absolutely-positioned popover
// would otherwise be clipped by that ancestor instead of just scrolling.
const SalaryRateSearchSelect: React.FC<SalaryRateSearchSelectProps> = ({ groups, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 280, maxHeight: 300 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPos = () => {
    const btn = containerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 12;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 280),
      maxHeight: Math.max(160, Math.min(420, spaceBelow)),
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPos();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const handleReposition = () => updateMenuPos();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen]);

  const selectedLabel = useMemo(() => {
    for (const rows of Object.values(groups)) {
      const found = rows.find((r) => r.id === value);
      if (found) {
        return `${found.role} (${found.experience_bracket} ปี): ${Number(found.salary_min).toLocaleString()}-${Number(found.salary_max).toLocaleString()}`;
      }
    }
    return '';
  }, [groups, value]);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return groups;
    const result: Record<string, MasterSalaryRateRow[]> = {};
    for (const [category, rows] of Object.entries(groups)) {
      const matches = rows.filter(
        (r) =>
          r.role.toLowerCase().includes(q) ||
          category.toLowerCase().includes(q) ||
          r.experience_bracket.toLowerCase().includes(q)
      );
      if (matches.length > 0) result[category] = matches;
    }
    return result;
  }, [groups, search]);

  const hasOptions = Object.keys(filteredGroups).length > 0;

  return (
    <div className="relative flex-1 min-w-[220px]" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-semibold focus:outline-none focus:border-violet-500 cursor-pointer"
      >
        <span className={cn('flex-1 min-w-0 truncate text-left', !selectedLabel && 'text-theme-text-muted font-normal')}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={13} className={cn('text-theme-text-muted transition-transform duration-200 shrink-0', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <ModalPortal>
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            className="z-50 rounded-2xl border border-theme-border bg-theme-surface dark:bg-theme-surface-modal shadow-2xl backdrop-blur-xl p-2.5 animate-fade-in space-y-2"
          >
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="พิมพ์ค้นหาตำแหน่ง..."
                className="w-full text-xs py-1.5 pl-7 pr-2 rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="overflow-y-auto space-y-1 pr-0.5 custom-scrollbar" style={{ maxHeight: menuPos.maxHeight }}>
              {!hasOptions ? (
                <div className="py-4 text-center text-xs text-theme-text-muted">ไม่พบตำแหน่งที่ค้นหา</div>
              ) : (
                Object.entries(filteredGroups).map(([category, rows]) => (
                  <div key={category}>
                    <div className="px-2 py-1 text-[10px] font-bold text-theme-text-muted uppercase">{category}</div>
                    {rows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          onChange(row.id);
                          setIsOpen(false);
                          setSearch('');
                        }}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer',
                          row.id === value
                            ? 'bg-violet-500/10 text-violet-800 dark:text-violet-200 font-semibold'
                            : 'text-theme-text hover:bg-theme-surface-tertiary'
                        )}
                      >
                        {row.role} ({row.experience_bracket} ปี): {Number(row.salary_min).toLocaleString()}-{Number(row.salary_max).toLocaleString()}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

const ProjectDetailDrawerContent: React.FC<ProjectDetailDrawerContentProps> = ({
  project,
  onClose,
  onProjectUpdated,
  availableUsers,
}) => {
  const { t } = useTranslation();
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'savings'>('overview');
  const [isSaving, setIsSaving] = useState(false);

  // Tab 1: Overview Form State
  const [startDate, setStartDate] = useState(project.start_date || '');
  const [dueDate, setDueDate] = useState(project.due_date || '');
  const [plannedStartDate, setPlannedStartDate] = useState(project.planned_start_date || '');
  const [plannedDueDate, setPlannedDueDate] = useState(project.planned_due_date || '');
  const [usageStatus, setUsageStatus] = useState(project.usage_status || 'unverified');
  const [lastUsageNote, setLastUsageNote] = useState(project.last_usage_note || '');
  const [status, setStatus] = useState<ProjectStatus>(project.status || 'in_progress');
  const [progress, setProgress] = useState(project.progress_percent || 0);
  const [ownerTeam, setOwnerTeam] = useState(project.owner_team || 'IMP');
  const [ownerHolding, setOwnerHolding] = useState(project.owner_holding || '');
  const [worklogProjectType, setWorklogProjectType] = useState(project.worklog_project_type || 'Project');
  // Add-On (Plus) work is unplanned scope added mid-flight — it never gets a
  // Plan date pair here or a Plan bar on the roadmap.
  const isAddOn = isAddOnPlusType(worklogProjectType);
  const [masterHoldings, setMasterHoldings] = useState<string[]>([]);
  const [masterProjectTypes, setMasterProjectTypes] = useState<string[]>([]);
  const [salaryRateRows, setSalaryRateRows] = useState<MasterSalaryRateRow[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchMasterData = async () => {
      try {
        const sessionStr = localStorage.getItem('worklog_session');
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        const workspaceId = session?.activeWorkspaceId;

        // Fetch holdings from tb_master_holding
        let holdingQuery = supabase.from('tb_master_holding').select('holding_name');
        if (workspaceId) {
          holdingQuery = holdingQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
        }
        const { data: hData } = await holdingQuery.order('holding_name');
        if (isMounted && hData && hData.length > 0) {
          setMasterHoldings((hData as MasterHoldingRow[]).map((d) => d.holding_name).filter(Boolean) as string[]);
        }

        // Fetch project types from tb_master_project_type
        let typeQuery = supabase.from('tb_master_project_type').select('type_name');
        if (workspaceId) {
          typeQuery = typeQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
        }
        const { data: tData } = await typeQuery.order('type_name');
        if (isMounted && tData && tData.length > 0) {
          setMasterProjectTypes((tData as MasterProjectTypeRow[]).map((d) => d.type_name).filter(Boolean) as string[]);
        }

        // Fetch IT salary rate reference from tb_master_it_salary_rate
        let salaryRateQuery = supabase.from('tb_master_it_salary_rate').select('*').eq('is_active', true);
        if (workspaceId) {
          salaryRateQuery = salaryRateQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
        }
        const { data: srData } = await salaryRateQuery
          .order('category')
          .order('role')
          .order('experience_bracket');
        if (isMounted && srData) {
          setSalaryRateRows(srData as MasterSalaryRateRow[]);
        }

        // Fetch departments from this project's own structure (tb_map_project_structure)
        const { data: structData } = await supabase
          .from('tb_map_project_structure')
          .select('department')
          .or(`project_id.eq.${project.id},module_id.eq.${project.id}`);
        if (isMounted && structData) {
          const departments = Array.from(
            new Set(
              (structData as { department: string | null }[])
                .map((row) => row.department)
                .filter((d): d is string => Boolean(d && d.trim()))
            )
          ).sort((a, b) => a.localeCompare(b));
          setDepartmentOptions(departments);
        }
      } catch (err) {
        console.warn('Failed to load master holding, project types, salary rates, or departments in drawer:', err);
      }
    };
    void fetchMasterData();
    return () => {
      isMounted = false;
    };
  }, [project.id]);

  const availableHoldings = useMemo(() => {
    const defaults = ['Double A', 'Real Estate', 'All Holding', 'Logistic', 'Power', 'NPS', 'IMP', 'IT'];
    const set = new Set<string>(defaults);
    masterHoldings.forEach((h) => set.add(h));
    if (ownerHolding) set.add(ownerHolding);
    return Array.from(set).sort();
  }, [masterHoldings, ownerHolding]);

  const availableProjectTypes = useMemo(() => {
    const defaults = ['Project', 'Support MA', 'Support Go-Live', 'Upgrade', 'Management'];
    const set = new Set<string>(defaults);
    masterProjectTypes.forEach((t) => set.add(t));
    if (worklogProjectType) set.add(worklogProjectType);
    return Array.from(set).sort();
  }, [masterProjectTypes, worklogProjectType]);

  const [headLeadId, setHeadLeadId] = useState(project.head_lead_user_id || '');
  const [headLeadName, setHeadLeadName] = useState(project.head_lead_name || '');
  const [milestonesList, setMilestonesList] = useState<ProjectMilestone[]>(project.milestones || []);

  // Tab 2: Team Contributions State
  const [teamList, setTeamList] = useState<TeamMemberContribution[]>(project.team_contributions || []);
  const [selectedNewUserId, setSelectedNewUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<TeamRole>('developer');

  // Tab 3: Cost Savings State
  const cs = project.cost_savings;
  // Direct Savings is now always the market-rate-reference flow (the old
  // cost_reduction/replacement modes moved to Cost Avoidance as line items),
  // so the mode itself is no longer user-editable — round-trip a fixed value.
  const directSavingsMode = 'new_capability' as const;
  const [directBaselineCostAnnual, setDirectBaselineCostAnnual] = useState(Number(cs?.direct_baseline_cost_annual) || 0);
  const [directTargetCostAnnual, setDirectTargetCostAnnual] = useState(Number(cs?.direct_target_cost_annual) || 0);
  const [directSavings, setDirectSavings] = useState(Number(cs?.direct_savings_annual) || 0);
  const [directNotes, setDirectNotes] = useState(cs?.direct_savings_notes || '');
  const [directMarketRateItemsList, setDirectMarketRateItemsList] = useState<DirectMarketRateItem[]>(
    project.direct_market_rate_items || []
  );
  const [selectedSalaryRateId, setSelectedSalaryRateId] = useState('');
  const [indirectHours, setIndirectHours] = useState(Number(cs?.indirect_manhour_saved_annual) || 0);
  // Standard rate and the free-text description are no longer editable here —
  // description now lives per line item, and the rate is implied by each
  // item's own position level — but both are still round-tripped so existing
  // saved values survive a save that doesn't touch this section.
  const indirectRate = Number(cs?.indirect_hourly_rate ?? 350);
  const indirectNotes = cs?.indirect_savings_notes || '';
  const [valueAddMultiplier, setValueAddMultiplier] = useState(Number(cs?.value_add_multiplier) || 0);
  const [indirectItemsList, setIndirectItemsList] = useState<IndirectSavingsItem[]>(
    project.indirect_savings_items || []
  );
  const [newIndirectItemCategory, setNewIndirectItemCategory] = useState('');
  const [newIndirectItemLevelId, setNewIndirectItemLevelId] = useState('');
  const [newIndirectItemDepartment, setNewIndirectItemDepartment] = useState('');
  const [avoidanceSavings, setAvoidanceSavings] = useState(Number(cs?.avoidance_savings_annual) || 0);
  const [avoidanceNotes, setAvoidanceNotes] = useState(cs?.avoidance_savings_notes || '');
  const [avoidanceItemsList, setAvoidanceItemsList] = useState<AvoidanceItem[]>(
    project.avoidance_items || []
  );
  const [newAvoidanceItemMode, setNewAvoidanceItemMode] = useState<'cost_reduction' | 'replacement'>('cost_reduction');
  const [newAvoidanceItemLabel, setNewAvoidanceItemLabel] = useState('');
  const [supportSavings, setSupportSavings] = useState(Number(cs?.support_savings_annual) || 0);
  const [supportTicketBaselineMonthly, setSupportTicketBaselineMonthly] = useState(Number(cs?.support_ticket_baseline_monthly) || 0);
  const [supportTicketTargetMonthly, setSupportTicketTargetMonthly] = useState(Number(cs?.support_ticket_target_monthly) || 0);
  const [supportCostPerTicket, setSupportCostPerTicket] = useState(Number(cs?.support_cost_per_ticket) || 0);
  const [supportHoursPerTicket, setSupportHoursPerTicket] = useState(Number(cs?.support_hours_per_ticket) || 0);
  const [supportHourlyRate, setSupportHourlyRate] = useState(Number(cs?.support_hourly_rate ?? 350));
  const [supportNotes, setSupportNotes] = useState(cs?.support_savings_notes || '');
  // No longer editable here (Incremental Cost / Manual Override UI is hidden),
  // but both are still round-tripped so existing saved values survive a save.
  const incrementalRunCostAnnual = Number(cs?.incremental_run_cost_annual) || 0;
  const manualTotalOverride = cs?.manual_total_savings_override !== undefined ? cs.manual_total_savings_override : null;
  const [savingsSharePercentage, setSavingsSharePercentage] = useState(
    cs?.savings_share_percentage !== undefined && cs?.savings_share_percentage !== null
      ? cs.savings_share_percentage
      : 100
  );
  const [monthsRealizedThisYear, setMonthsRealizedThisYear] = useState<number | null>(
    cs?.months_realized_this_year !== undefined ? cs.months_realized_this_year : null
  );
  const [beneficiaryHeadcount, setBeneficiaryHeadcount] = useState<number | null>(
    cs?.beneficiary_headcount !== undefined ? cs.beneficiary_headcount : null
  );
  const [beneficiaryDepartmentCount, setBeneficiaryDepartmentCount] = useState<number | null>(
    cs?.beneficiary_department_count !== undefined ? cs.beneficiary_department_count : null
  );
  // Evidence/audit fields are no longer editable here (the UI section is hidden),
  // but all four are still round-tripped so existing saved values survive a save.
  const baselineBefore = cs?.baseline_before || '';
  const targetAfter = cs?.target_after || '';
  const formulaNotes = cs?.calculation_formula || '';
  const refProofUrl = cs?.ref_proof_url || '';
  const verificationStatus = cs?.verification_status || 'draft';

  // Milestone Modal State
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);

  // Confirmation Modals State
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showVerificationSignoffModal, setShowVerificationSignoffModal] = useState(false);

  // Each MECE dimension collapses to a summary row by default; sections that
  // already carry saved data start expanded so existing figures stay visible.
  const [isDirectExpanded, setIsDirectExpanded] = useState(
    () => (Number(cs?.direct_baseline_cost_annual) || 0) > 0 ||
      (Number(cs?.direct_target_cost_annual) || 0) > 0 ||
      (Number(cs?.direct_savings_annual) || 0) > 0
  );
  const [isIndirectExpanded, setIsIndirectExpanded] = useState(
    () => (Number(cs?.indirect_savings_annual) || 0) > 0 ||
      (Number(cs?.indirect_manhour_saved_annual) || 0) > 0 ||
      (project.indirect_savings_items?.length ?? 0) > 0
  );
  const [isAvoidanceExpanded, setIsAvoidanceExpanded] = useState(
    () => (Number(cs?.avoidance_savings_annual) || 0) > 0 || (project.avoidance_items?.length ?? 0) > 0
  );
  const [isSupportExpanded, setIsSupportExpanded] = useState(
    () => (Number(cs?.support_savings_annual) || 0) > 0 ||
      (Number(cs?.support_ticket_baseline_monthly) || 0) > 0
  );

  // "Position Level" rows power the Indirect Savings level picker below, not
  // the Direct Savings market-rate picker, so they're excluded from this group.
  const salaryRatesByCategory = salaryRateRows.reduce<Record<string, MasterSalaryRateRow[]>>((acc, row) => {
    if (row.category === 'Position Level') return acc;
    (acc[row.category] ||= []).push(row);
    return acc;
  }, {});
  const positionLevelOptions = salaryRateRows
    .filter((row) => row.category === 'Position Level')
    .sort((a, b) => Number(b.salary_min) - Number(a.salary_min));
  // Auto-pick the department when the project's structure only has one to choose from.
  const effectiveNewIndirectItemDepartment =
    newIndirectItemDepartment || (departmentOptions.length === 1 ? departmentOptions[0] : '');

  // Computed Savings Summary
  const projectBusinessDays = calculateProjectBusinessDays(startDate, dueDate);
  const marketRateItemsSum = Math.round(
    directMarketRateItemsList.reduce(
      (acc, item) =>
        acc + (item.monthly_rate / (item.working_days_per_month || 1)) * item.headcount * item.man_days,
      0
    )
  );
  const effectiveDirectBaselineCostAnnual =
    directMarketRateItemsList.length > 0 ? marketRateItemsSum : directBaselineCostAnnual;
  const hasDirectCalculator = effectiveDirectBaselineCostAnnual > 0 || directTargetCostAnnual > 0;
  const computedDirectAnnual = hasDirectCalculator
    ? Math.max(0, effectiveDirectBaselineCostAnnual - directTargetCostAnnual)
    : directSavings;
  const computedIndirectAnnual = indirectHours * indirectRate;
  const indirectItemsSum = indirectItemsList.reduce(
    (acc, item) =>
      acc + (item.monthly_salary / (item.working_days_per_month || 1)) * item.days_saved_per_month * item.headcount * 12,
    0
  );
  const effectiveIndirectAnnual = indirectItemsList.length > 0 ? indirectItemsSum : computedIndirectAnnual;
  // Line items track days saved, not hours; convert using a standard 8-hour workday
  // so the "hours saved / year" summary field can display something derived from them.
  const indirectHoursFromItems = indirectItemsList.reduce(
    (acc, item) => acc + item.days_saved_per_month * item.headcount * 12 * 8,
    0
  );
  const effectiveIndirectHours = indirectItemsList.length > 0 ? indirectHoursFromItems : indirectHours;
  // Beneficiary reach in the Grand Total banner mirrors the indirect items once any exist,
  // instead of being typed in separately.
  const derivedBeneficiaryHeadcount = indirectItemsList.reduce((acc, item) => acc + (Number(item.headcount) || 0), 0);
  const derivedBeneficiaryDepartmentCount = new Set(
    indirectItemsList.map((item) => item.department).filter((d): d is string => Boolean(d && d.trim()))
  ).size;
  const effectiveBeneficiaryHeadcount =
    indirectItemsList.length > 0 ? derivedBeneficiaryHeadcount : beneficiaryHeadcount;
  const effectiveBeneficiaryDepartmentCount =
    indirectItemsList.length > 0 ? derivedBeneficiaryDepartmentCount : beneficiaryDepartmentCount;
  const avoidanceItemsSum = avoidanceItemsList.reduce(
    (acc, item) => acc + Math.max(0, (Number(item.baseline_cost_annual) || 0) - (Number(item.target_cost_annual) || 0)),
    0
  );
  const effectiveAvoidanceAnnual = avoidanceItemsList.length > 0 ? avoidanceItemsSum : avoidanceSavings;
  const supportUnitCost = supportCostPerTicket + (supportHoursPerTicket * supportHourlyRate);
  const hasSupportCalculator = supportTicketBaselineMonthly > 0 || supportTicketTargetMonthly > 0 || supportUnitCost > 0;
  const computedSupportAnnual = hasSupportCalculator
    ? Math.max(0, supportTicketBaselineMonthly - supportTicketTargetMonthly) * 12 * supportUnitCost
    : supportSavings;
  const savingsPayloadPreview = {
    direct_savings_mode: directSavingsMode,
    direct_baseline_cost_annual: effectiveDirectBaselineCostAnnual,
    direct_target_cost_annual: directTargetCostAnnual,
    direct_savings_annual: computedDirectAnnual,
    indirect_manhour_saved_annual: effectiveIndirectHours,
    indirect_hourly_rate: indirectRate,
    indirect_savings_annual: effectiveIndirectAnnual,
    avoidance_savings_annual: effectiveAvoidanceAnnual,
    support_savings_annual: computedSupportAnnual,
    support_ticket_baseline_monthly: supportTicketBaselineMonthly,
    support_ticket_target_monthly: supportTicketTargetMonthly,
    support_cost_per_ticket: supportCostPerTicket,
    support_hours_per_ticket: supportHoursPerTicket,
    support_hourly_rate: supportHourlyRate,
    incremental_run_cost_annual: incrementalRunCostAnnual,
    manual_total_savings_override: manualTotalOverride,
    value_add_multiplier: valueAddMultiplier,
    savings_share_percentage: savingsSharePercentage,
    months_realized_this_year: monthsRealizedThisYear,
  };
  const currentTotalSavings = calculateTotalSavings({
    ...savingsPayloadPreview,
  });
  const realizedThisYearDisplay =
    monthsRealizedThisYear !== null ? currentTotalSavings * (monthsRealizedThisYear / 12) : null;

  // Team Target % Total Validation
  const totalTargetPercent = teamList.reduce((acc, curr) => acc + (Number(curr.target_contribution_percent) || 0), 0);

  // Detect Unsaved Dirty Changes
  const isDirty = useMemo(() => {
    if (startDate !== (project.start_date || '')) return true;
    if (dueDate !== (project.due_date || '')) return true;
    if (!isAddOn && plannedStartDate !== (project.planned_start_date || '')) return true;
    if (!isAddOn && plannedDueDate !== (project.planned_due_date || '')) return true;
    if (usageStatus !== (project.usage_status || 'unverified')) return true;
    if (lastUsageNote !== (project.last_usage_note || '')) return true;
    if (status !== (project.status || 'in_progress')) return true;
    if (progress !== (project.progress_percent || 0)) return true;
    if (ownerTeam !== (project.owner_team || 'IMP')) return true;
    if (ownerHolding !== (project.owner_holding || '')) return true;
    if (worklogProjectType !== (project.worklog_project_type || 'Project')) return true;
    if (headLeadId !== (project.head_lead_user_id || '')) return true;
    if (headLeadName !== (project.head_lead_name || '')) return true;
    if (JSON.stringify(teamList) !== JSON.stringify(project.team_contributions || [])) return true;
    if (JSON.stringify(milestonesList) !== JSON.stringify(project.milestones || [])) return true;
    if (directBaselineCostAnnual !== (Number(cs?.direct_baseline_cost_annual) || 0)) return true;
    if (directTargetCostAnnual !== (Number(cs?.direct_target_cost_annual) || 0)) return true;
    if (computedDirectAnnual !== (Number(cs?.direct_savings_annual) || 0)) return true;
    if (directNotes !== (cs?.direct_savings_notes || '')) return true;
    if (indirectHours !== (Number(cs?.indirect_manhour_saved_annual) || 0)) return true;
    if (avoidanceSavings !== (Number(cs?.avoidance_savings_annual) || 0)) return true;
    if (avoidanceNotes !== (cs?.avoidance_savings_notes || '')) return true;
    if (JSON.stringify(avoidanceItemsList) !== JSON.stringify(project.avoidance_items || [])) return true;
    if (computedSupportAnnual !== (Number(cs?.support_savings_annual) || 0)) return true;
    if (supportTicketBaselineMonthly !== (Number(cs?.support_ticket_baseline_monthly) || 0)) return true;
    if (supportTicketTargetMonthly !== (Number(cs?.support_ticket_target_monthly) || 0)) return true;
    if (supportCostPerTicket !== (Number(cs?.support_cost_per_ticket) || 0)) return true;
    if (supportHoursPerTicket !== (Number(cs?.support_hours_per_ticket) || 0)) return true;
    if (supportHourlyRate !== Number(cs?.support_hourly_rate ?? 350)) return true;
    if (supportNotes !== (cs?.support_savings_notes || '')) return true;
    if (valueAddMultiplier !== (Number(cs?.value_add_multiplier) || 0)) return true;
    if (savingsSharePercentage !== (cs?.savings_share_percentage ?? 100)) return true;
    if (monthsRealizedThisYear !== (cs?.months_realized_this_year ?? null)) return true;
    if (beneficiaryHeadcount !== (cs?.beneficiary_headcount ?? null)) return true;
    if (beneficiaryDepartmentCount !== (cs?.beneficiary_department_count ?? null)) return true;
    if (JSON.stringify(indirectItemsList) !== JSON.stringify(project.indirect_savings_items || [])) return true;
    if (JSON.stringify(directMarketRateItemsList) !== JSON.stringify(project.direct_market_rate_items || [])) return true;
    return false;
  }, [
    startDate, dueDate, plannedStartDate, plannedDueDate, isAddOn, usageStatus, lastUsageNote, status, progress, ownerTeam, ownerHolding, worklogProjectType, headLeadId, headLeadName,
    teamList, milestonesList, directBaselineCostAnnual, directTargetCostAnnual, computedDirectAnnual,
    directNotes, indirectHours, avoidanceSavings, avoidanceNotes, avoidanceItemsList, computedSupportAnnual,
    supportTicketBaselineMonthly, supportTicketTargetMonthly, supportCostPerTicket, supportHoursPerTicket,
    supportHourlyRate, supportNotes, valueAddMultiplier,
    savingsSharePercentage, monthsRealizedThisYear, beneficiaryHeadcount, beneficiaryDepartmentCount, indirectItemsList, directMarketRateItemsList,
    project, cs
  ]);

  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onClose();
    }
  };

  // Selectable users that are not already added to the team
  const selectableUsers = availableUsers.filter(
    (u) => !teamList.some((t) => t.user_id === u.id || t.user_name.toLowerCase() === u.name.toLowerCase())
  );

  // Helper to round to nearest 5%
  const roundToNearest5 = (val: number) => Math.round(val / 5) * 5;

  // Auto-rebalance Target % across remaining members to always equal 100% (in 5% steps)
  const handleUpdateTeamTargetPercent = (changedIndex: number, newPercent: number) => {
    const n = teamList.length;
    if (n <= 1) {
      setTeamList(teamList.map((m) => ({ ...m, target_contribution_percent: 100 })));
      return;
    }

    const clampedVal = Math.max(0, Math.min(100, roundToNearest5(newPercent)));
    const remainingBudget = Math.max(0, 100 - clampedVal);

    const otherMembers = teamList.filter((_, idx) => idx !== changedIndex);
    const currentOthersSum = otherMembers.reduce(
      (sum, m) => sum + (Number(m.target_contribution_percent) || 0),
      0
    );

    const updated = teamList.map((m, idx) => {
      if (idx === changedIndex) {
        return { ...m, target_contribution_percent: clampedVal };
      }

      let calculated: number;
      if (currentOthersSum > 0) {
        const currentVal = Number(m.target_contribution_percent) || 0;
        calculated = roundToNearest5((currentVal / currentOthersSum) * remainingBudget);
      } else {
        calculated = roundToNearest5(remainingBudget / (n - 1));
      }

      return {
        ...m,
        target_contribution_percent: Math.max(0, calculated),
      };
    });

    // Ensure exact 100% sum in 5% steps
    const currentTotal = updated.reduce(
      (sum, m) => sum + (Number(m.target_contribution_percent) || 0),
      0
    );
    const diff = 100 - currentTotal;
    if (diff !== 0 && n > 1) {
      const adjustIdx = changedIndex === 0 ? 1 : 0;
      updated[adjustIdx].target_contribution_percent = Math.max(
        0,
        updated[adjustIdx].target_contribution_percent + diff
      );
    }

    setTeamList(updated);
  };

  // Equal Split Helper in 5% steps (50/50, 35/35/30, 25/25/25/25, etc.)
  const handleEqualSplitTargetPercent = () => {
    const n = teamList.length;
    if (n === 0) return;
    if (n === 1) {
      setTeamList([{ ...teamList[0], target_contribution_percent: 100 }]);
      return;
    }

    const rawPerPerson = 100 / n;
    const basePercent = roundToNearest5(rawPerPerson);

    const updated = teamList.map((m) => ({
      ...m,
      target_contribution_percent: basePercent,
    }));

    // Reconcile remaining 5% difference
    const curTotal = basePercent * n;
    let diff = 100 - curTotal;
    let i = 0;
    while (diff !== 0 && i < n) {
      const step = diff > 0 ? 5 : -5;
      updated[i].target_contribution_percent += step;
      diff -= step;
      i = (i + 1) % n;
    }

    setTeamList(updated);
    showToast('จัดสรรสัดส่วน Target % ทีละ 5% ให้ทุกคนเรียบร้อย (รวม 100%)', 'info');
  };

  // Add new member to team list from dropdown selection (in 5% steps)
  const handleAddTeamMember = () => {
    if (!selectedNewUserId) return;
    const userObj = availableUsers.find((u) => u.id === selectedNewUserId);
    if (!userObj) return;

    const newMember: TeamMemberContribution = {
      project_id: project.id,
      user_id: userObj.id,
      user_name: userObj.name,
      role_in_project: newMemberRole,
      target_contribution_percent: 0,
      actual_contribution_percent: 0,
      logged_worklog_hours: 0,
    };

    const nextList = [...teamList, newMember];
    const n = nextList.length;
    const rawPerPerson = 100 / n;
    const basePercent = roundToNearest5(rawPerPerson);

    const balanced = nextList.map((m) => ({
      ...m,
      target_contribution_percent: basePercent,
    }));

    const curTotal = basePercent * n;
    let diff = 100 - curTotal;
    let i = 0;
    while (diff !== 0 && i < n) {
      const step = diff > 0 ? 5 : -5;
      balanced[i].target_contribution_percent += step;
      diff -= step;
      i = (i + 1) % n;
    }

    setTeamList(balanced);
    setSelectedNewUserId('');
    showToast(`เพิ่ม ${newMember.user_name} ในทีมเรียบร้อย (สัดส่วน 5% รวม 100%)`, 'success');
  };

  const handleRemoveTeamMember = (index: number) => {
    const remaining = teamList.filter((_, idx) => idx !== index);
    if (remaining.length > 0) {
      const n = remaining.length;
      const rawPerPerson = 100 / n;
      const basePercent = roundToNearest5(rawPerPerson);

      const balanced = remaining.map((m) => ({
        ...m,
        target_contribution_percent: basePercent,
      }));

      const curTotal = basePercent * n;
      let diff = 100 - curTotal;
      let i = 0;
      while (diff !== 0 && i < n) {
        const step = diff > 0 ? 5 : -5;
        balanced[i].target_contribution_percent += step;
        diff -= step;
        i = (i + 1) % n;
      }
      setTeamList(balanced);
    } else {
      setTeamList([]);
    }
  };

  const handleUpdateTeamMember = (index: number, patch: Partial<TeamMemberContribution>) => {
    setTeamList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleAddIndirectItem = () => {
    const category = newIndirectItemCategory.trim();
    const levelRow = positionLevelOptions.find((r) => r.id === newIndirectItemLevelId);
    if (!category || !levelRow) return;
    const newItem: IndirectSavingsItem = {
      id: crypto.randomUUID(),
      project_id: project.id,
      label: `${category} (${levelRow.role})`,
      category,
      position_level: levelRow.role,
      department: effectiveNewIndirectItemDepartment || null,
      monthly_salary: Number(levelRow.salary_min),
      headcount: 1,
      days_saved_per_month: 0,
      working_days_per_month: 22,
      sequence_order: indirectItemsList.length + 1,
    };
    setIndirectItemsList((prev) => [...prev, newItem]);
    setNewIndirectItemCategory('');
    setNewIndirectItemLevelId('');
    setNewIndirectItemDepartment('');
  };

  const handleRemoveIndirectItem = (index: number) => {
    setIndirectItemsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateIndirectItem = (index: number, patch: Partial<IndirectSavingsItem>) => {
    setIndirectItemsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleAddAvoidanceItem = () => {
    const label = newAvoidanceItemLabel.trim();
    if (!label) return;
    const newItem: AvoidanceItem = {
      id: crypto.randomUUID(),
      project_id: project.id,
      mode: newAvoidanceItemMode,
      label,
      baseline_cost_annual: 0,
      target_cost_annual: 0,
      sequence_order: avoidanceItemsList.length + 1,
    };
    setAvoidanceItemsList((prev) => [...prev, newItem]);
    setNewAvoidanceItemLabel('');
    setNewAvoidanceItemMode('cost_reduction');
  };

  const handleRemoveAvoidanceItem = (index: number) => {
    setAvoidanceItemsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateAvoidanceItem = (index: number, patch: Partial<AvoidanceItem>) => {
    setAvoidanceItemsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleAddMarketRateItem = () => {
    const rateRow = salaryRateRows.find((r) => r.id === selectedSalaryRateId);
    if (!rateRow) return;
    const midpoint = Math.round((Number(rateRow.salary_min) + Number(rateRow.salary_max)) / 2);
    const sourceNote = `${rateRow.source_label || 'Reference'}${rateRow.source_year ? ` (${rateRow.source_year})` : ''}: ${rateRow.role} ${rateRow.experience_bracket} ปี = ${Number(rateRow.salary_min).toLocaleString()}-${Number(rateRow.salary_max).toLocaleString()} บาท/เดือน${rateRow.source_url ? ` — ${rateRow.source_url}` : ''}`;
    const newItem: DirectMarketRateItem = {
      id: crypto.randomUUID(),
      project_id: project.id,
      position_label: rateRow.role,
      experience_bracket: rateRow.experience_bracket,
      monthly_rate: midpoint,
      headcount: 1,
      man_days: projectBusinessDays,
      working_days_per_month: 22,
      source_note: sourceNote,
      sequence_order: directMarketRateItemsList.length + 1,
    };
    setDirectMarketRateItemsList((prev) => [...prev, newItem]);
    setSelectedSalaryRateId('');
  };

  const handleRemoveMarketRateItem = (index: number) => {
    setDirectMarketRateItemsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateMarketRateItem = (index: number, patch: Partial<DirectMarketRateItem>) => {
    setDirectMarketRateItemsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  // Milestone actions
  const handleSaveMilestone = (m: ProjectMilestone) => {
    if (m.id) {
      setMilestonesList(milestonesList.map((item) => (item.id === m.id ? m : item)));
    } else {
      setMilestonesList([...milestonesList, { ...m, id: crypto.randomUUID() }]);
    }
  };

  const handleDeleteMilestone = (index: number) => {
    setMilestonesList(milestonesList.filter((_, idx) => idx !== index));
  };

  // Master Save Execution
  const executeSaveAll = async () => {
    if (startDate && dueDate && startDate > dueDate) {
      showToast('วันเริ่มต้นโครงการต้องไม่อยู่หลังวันกำหนดเสร็จ', 'error');
      return;
    }

    const invalidMilestone = milestonesList.find(
      (milestone) => milestone.start_date && milestone.due_date && milestone.start_date > milestone.due_date
    );
    if (invalidMilestone) {
      showToast(`Milestone "${invalidMilestone.milestone_name}" มีวันเริ่มต้นอยู่หลังวันกำหนดเสร็จ`, 'error');
      return;
    }

    if (teamList.length > 0 && Math.abs(totalTargetPercent - 100) > 0.001) {
      showToast('Target Contribution ของทีมต้องรวมเท่ากับ 100% ก่อนบันทึก', 'error');
      return;
    }

    const overviewPatch: ProjectGanttOverviewPayload = {
      ...(startDate !== (project.start_date || '') ? { start_date: startDate || null } : {}),
      ...(dueDate !== (project.due_date || '') ? { due_date: dueDate || null } : {}),
      // Add-On (Plus) is unplanned work — clear any stale plan dates if a
      // project was switched to this type, rather than hiding them unseen.
      ...(isAddOn
        ? (project.planned_start_date ? { planned_start_date: null } : {})
        : (plannedStartDate !== (project.planned_start_date || '') ? { planned_start_date: plannedStartDate || null } : {})),
      ...(isAddOn
        ? (project.planned_due_date ? { planned_due_date: null } : {})
        : (plannedDueDate !== (project.planned_due_date || '') ? { planned_due_date: plannedDueDate || null } : {})),
      ...(usageStatus !== (project.usage_status || 'unverified') ? { usage_status: usageStatus } : {}),
      ...(lastUsageNote !== (project.last_usage_note || '') ? { last_usage_note: lastUsageNote || null } : {}),
      ...(progress !== (project.progress_percent || 0) ? { progress_percent: Number(progress) } : {}),
      ...(status !== project.status ? { status } : {}),
      ...(ownerTeam !== (project.owner_team || 'IMP') ? { owner_team: ownerTeam } : {}),
      ...(ownerHolding !== (project.owner_holding || '') ? { owner_holding: ownerHolding || null } : {}),
      ...(worklogProjectType !== (project.worklog_project_type || 'Project')
        ? { worklog_project_type: worklogProjectType || null }
        : {}),
      ...(headLeadId !== (project.head_lead_user_id || '') ? { head_lead_user_id: headLeadId || null } : {}),
      ...(headLeadName !== (project.head_lead_name || '') ? { head_lead_name: headLeadName || null } : {}),
    };

    const savingsPayload: Partial<ProjectCostSavings> = {
      direct_savings_mode: directSavingsMode,
      direct_baseline_cost_annual: effectiveDirectBaselineCostAnnual,
      direct_target_cost_annual: directTargetCostAnnual,
      direct_savings_annual: computedDirectAnnual,
      direct_savings_notes: directNotes,
      indirect_manhour_saved_annual: effectiveIndirectHours,
      indirect_hourly_rate: indirectRate,
      indirect_savings_annual: effectiveIndirectAnnual,
      indirect_savings_notes: indirectNotes,
      avoidance_savings_annual: effectiveAvoidanceAnnual,
      avoidance_savings_notes: avoidanceNotes,
      support_savings_annual: computedSupportAnnual,
      support_ticket_baseline_monthly: supportTicketBaselineMonthly,
      support_ticket_target_monthly: supportTicketTargetMonthly,
      support_cost_per_ticket: supportCostPerTicket,
      support_hours_per_ticket: supportHoursPerTicket,
      support_hourly_rate: supportHourlyRate,
      support_savings_notes: supportNotes,
      incremental_run_cost_annual: incrementalRunCostAnnual,
      manual_total_savings_override: manualTotalOverride,
      value_add_multiplier: valueAddMultiplier,
      savings_share_percentage: savingsSharePercentage,
      months_realized_this_year: monthsRealizedThisYear,
      beneficiary_headcount: effectiveBeneficiaryHeadcount,
      beneficiary_department_count: effectiveBeneficiaryDepartmentCount,
      baseline_before: baselineBefore,
      target_after: targetAfter,
      calculation_formula: formulaNotes,
      ref_proof_url: refProofUrl,
      verification_status: verificationStatus,
    };

    setIsSaving(true);
    try {
      await saveProjectGanttDetails(project.id, overviewPatch, teamList, milestonesList, savingsPayload, indirectItemsList, directMarketRateItemsList, avoidanceItemsList);

      // Merge the saved fields straight into the in-memory project instead of
      // refetching the whole Gantt list, so the table keeps its scroll position
      // and expanded/collapsed tree state after a save.
      const leadEmpId =
        availableUsers.find((u) => u.id === headLeadId)?.emp_id ||
        availableUsers.find((u) => u.name.toLowerCase().trim() === headLeadName.toLowerCase().trim())?.emp_id ||
        null;

      const updatedProject: GanttProject = {
        ...project,
        start_date: startDate || null,
        due_date: dueDate || null,
        planned_start_date: isAddOn ? null : (plannedStartDate || null),
        planned_due_date: isAddOn ? null : (plannedDueDate || null),
        usage_status: usageStatus,
        last_usage_note: lastUsageNote || null,
        progress_percent: Number(progress),
        status,
        owner_team: ownerTeam,
        owner_holding: ownerHolding || null,
        worklog_project_type: worklogProjectType || null,
        head_lead_user_id: headLeadId || null,
        head_lead_name: headLeadName || null,
        head_lead_emp_id: leadEmpId,
        project_health: calculateProjectHealth(startDate, dueDate, Number(progress), status),
        team_contributions: teamList,
        milestones: milestonesList,
        cost_savings: {
          ...project.cost_savings,
          ...savingsPayload,
          project_id: project.id,
        } as GanttProject['cost_savings'],
        indirect_savings_items: indirectItemsList,
        direct_market_rate_items: directMarketRateItemsList,
        avoidance_items: avoidanceItemsList,
        total_savings_annual: currentTotalSavings,
      };

      showToast(t('gantt.drawer.saveSuccess'), 'success');
      onProjectUpdated(updatedProject);
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Failed to update project:', err);
      showToast(`${t('gantt.drawer.saveError')}${e.message || 'Error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (verificationStatus === 'verified' && cs?.verification_status !== 'verified') {
      setShowVerificationSignoffModal(true);
    } else {
      void executeSaveAll();
    }
  };

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[540px] lg:w-[680px] bg-theme-surface/95 dark:bg-theme-bg-page/95 backdrop-blur-2xl border-l border-theme-border/80 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 text-theme-text select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-theme-border/80 bg-theme-surface-secondary/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="p-2 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Calendar size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-sm sm:text-base text-theme-text truncate">
                {project.project_name}
              </h2>
              <p className="text-[11px] text-theme-text-muted">
                {project.owner_team || 'IMP'} · {project.owner_holding || 'Double A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer select-none"
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isSaving ? t('gantt.drawer.saving') : t('gantt.drawer.saveBtn')}</span>
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-2 rounded-2xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-theme-border/60 bg-theme-surface/40 px-6 shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-theme-text-muted hover:text-theme-text'
            )}
          >
            <span>{t('gantt.drawer.tabOverview')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={cn(
              'py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'team'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-theme-text-muted hover:text-theme-text'
            )}
          >
            <span>{t('gantt.drawer.tabTeam')} ({teamList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('savings')}
            className={cn(
              'py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'savings'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-theme-text-muted hover:text-theme-text'
            )}
          >
            <span>{t('gantt.drawer.tabSavings')}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
          {/* ─────────────────────────────────────────────────────────────
              TAB 1: Overview & Milestones
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-fade-in">
              {/* Timeline & Status Card */}
              <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface/60 space-y-4">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                  <Calendar size={14} className="text-indigo-500" />
                  กำหนดการ & สถานะโครงการ
                </h3>

                {!isAddOn && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                        วันเริ่มตามแผน (Plan)
                      </label>
                      <input
                        type="date"
                        value={plannedStartDate}
                        onChange={(e) => setPlannedStartDate(e.target.value)}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                        วันที่คาดว่าจะเสร็จตามแผน (Plan)
                      </label>
                      <input
                        type="date"
                        value={plannedDueDate}
                        onChange={(e) => setPlannedDueDate(e.target.value)}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      วันเริ่มต้น (Start Date)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      กำหนดเสร็จ (Due Date) *
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      สถานะสากล (5 Stages)
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    >
                      <option value="planning">🔵 Planning (วางแผน)</option>
                      <option value="in_progress">🟡 In Progress (กำลังพัฒนา)</option>
                      <option value="testing">🟣 Testing / UAT (ทดสอบ)</option>
                      <option value="completed">🟢 Completed (ส่งมอบแล้ว)</option>
                      <option value="on_hold">⚪ On Hold (พักชั่วคราว)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="font-bold text-theme-text-muted text-[10px] uppercase">
                        ความคืบหน้า ({progress}%)
                      </label>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="w-full accent-indigo-600 mt-2 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      ทีมรับผิดชอบ (Team)
                    </label>
                    <select
                      value={ownerTeam}
                      onChange={(e) => setOwnerTeam(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
                    >
                      <option value="IMP">IMP</option>
                      <option value="IT">IT</option>
                      <option value="IMP&IT">IMP&IT</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      Holding (กลุ่มธุรกิจ / บริษัท)
                    </label>
                    <select
                      value={ownerHolding}
                      onChange={(e) => setOwnerHolding(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                    >
                      <option value="">-- ไม่ระบุ / None --</option>
                      {availableHoldings.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      ประเภทงาน (Project / Support Type)
                    </label>
                    <select
                      value={worklogProjectType}
                      onChange={(e) => setWorklogProjectType(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
                    >
                      {availableProjectTypes.map((t) => {
                        const meta = getProjectTypeMeta(t);
                        return (
                          <option key={t} value={t}>
                            {meta.icon} {t}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                      หมวดหมู่การแสดงผล (Visual Category)
                    </label>
                    <div className="py-2 px-3 rounded-xl border border-theme-border bg-theme-surface-secondary text-theme-text flex items-center gap-1.5 font-bold">
                      {(() => {
                        const meta = getProjectTypeMeta(worklogProjectType);
                        return (
                          <>
                            <span>{meta.icon}</span>
                            <span>{meta.category === 'project' ? 'โครงการพัฒนา (Project)' : meta.category === 'support' ? 'งานดูแลระบบ (Support MA)' : meta.label}</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage Tracking Card */}
              <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface/60 space-y-3">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-500" />
                  การใช้งานจริง (Usage Tracking)
                </h3>

                <div className="space-y-1">
                  <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                    สถานะการใช้งาน (Usage Status)
                  </label>
                  <select
                    value={usageStatus}
                    onChange={(e) => setUsageStatus(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-emerald-500 cursor-pointer font-bold"
                  >
                    {Object.entries(USAGE_STATUS_META).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.icon} {meta.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-theme-text-muted text-[10px] uppercase">
                    บันทึกการใช้งานล่าสุด (Last Usage Note)
                  </label>
                  <textarea
                    rows={2}
                    value={lastUsageNote}
                    onChange={(e) => setLastUsageNote(e.target.value)}
                    placeholder="เช่น ระบบมีคนใช้ทุกวัน, ปิดการใช้งานแล้ว, รอเปลี่ยนระบบใหม่..."
                    className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs resize-none"
                  />
                </div>
              </div>

              {/* Milestones List Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                    <Flag size={14} className="text-purple-500" />
                    เป้าหมายย่อย (Milestones & Phases)
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMilestone(null);
                      setIsMilestoneModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[11px] border border-purple-500/30 transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>เพิ่ม Milestone</span>
                  </button>
                </div>

                {milestonesList.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-theme-border/80 bg-theme-surface/30 text-theme-text-muted space-y-1">
                    <p className="font-semibold">ยังไม่มี Milestone ย่อย</p>
                    <p className="text-[10px]">กดปุ่ม "เพิ่ม Milestone" เพื่อแตกเป้าหมายของโครงการ</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {milestonesList.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl border border-theme-border bg-theme-surface flex items-center justify-between gap-3 shadow-xs hover:border-purple-400 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-theme-text truncate">
                              {idx + 1}. {m.milestone_name}
                            </span>
                            <span
                              className={cn(
                                'px-1.5 py-0.2 text-[9px] font-bold rounded-md uppercase',
                                m.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                              )}
                            >
                              {m.status} ({m.progress_percent}%)
                            </span>
                          </div>
                          <div className="text-[10px] text-theme-text-muted flex items-center gap-3">
                            {m.due_date && <span>📅 กำหนด: {m.due_date}</span>}
                            {m.assigned_user_name && <span>👤 ผู้รับผิดชอบ: {m.assigned_user_name}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMilestone(m);
                              setIsMilestoneModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-purple-600 cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMilestone(idx)}
                            className="p-1.5 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: Team & Contribution Hub (Hybrid Model)
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'team' && (
            <div className="space-y-5 animate-fade-in">
              {/* Head Lead Selection */}
              <div className="p-4 rounded-3xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <User size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-theme-text">👑 หัวหน้าโครงการ (Head / Project Lead)</h3>
                    <p className="text-[10px] text-theme-text-muted">ผู้รับผิดชอบหลักของโครงการนี้</p>
                  </div>
                </div>

                <div>
                  <select
                    value={headLeadId || (availableUsers.find((u) => u.name === headLeadName)?.id || '')}
                    onChange={(e) => {
                      const selected = availableUsers.find((u) => u.id === e.target.value);
                      if (selected) {
                        setHeadLeadId(selected.id);
                        setHeadLeadName(selected.name);
                      } else {
                        setHeadLeadId('');
                        setHeadLeadName('');
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-2xl border border-indigo-500/40 bg-theme-surface text-theme-text font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
                  >
                    <option value="">-- เลือกหัวหน้าโครงการจากสมาชิกในทีม (Head / Project Lead) --</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        👑 {u.name} {u.email ? `(${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {headLeadName && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="w-6 h-6 rounded-full overflow-hidden ring-1.5 ring-indigo-500/40 shadow-xs shrink-0 bg-slate-200 dark:bg-slate-700 select-none">
                      <img
                        src={getUserAvatarUrl(
                          headLeadName,
                          availableUsers.find((u) => u.name === headLeadName || u.id === headLeadId)?.emp_id
                        )}
                        alt={headLeadName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = getUiAvatarFallbackUrl(headLeadName, '6366f1');
                        }}
                      />
                    </div>
                    <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                      👑 {headLeadName} <span className="text-[10px] font-medium text-theme-text-muted">(หัวหน้าโครงการที่เลือก)</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Total Target Contribution Gauge */}
              <div className="p-4 rounded-3xl border border-theme-border bg-theme-surface/60 space-y-2.5">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-theme-text">
                      สัดส่วนเป้าหมายรวม (Total Target %):
                    </span>
                    <button
                      type="button"
                      disabled={teamList.length === 0}
                      onClick={handleEqualSplitTargetPercent}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer select-none"
                    >
                      ⚖️ จัดสรรเท่ากัน
                    </button>
                  </div>
                  <span
                    className={cn(
                      'font-mono font-black text-sm px-2.5 py-0.5 rounded-xl border',
                      totalTargetPercent === 100
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
                    )}
                  >
                    {totalTargetPercent.toFixed(0)}% {totalTargetPercent === 100 ? '✓ ลงตัว 100%' : '⚠️ ไม่เท่ากับ 100%'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-theme-border/60 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      totalTargetPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                    style={{ width: `${Math.min(100, totalTargetPercent)}%` }}
                  />
                </div>
                <p className="text-[10px] text-theme-text-muted">
                  * เมื่อมี 2 คนขึ้นไป การเลื่อนสไลเดอร์ % ของใคร ระบบจะปรับเกลี่ย % ของคนที่เหลือให้อัตโนมัติ เพื่อให้ผลรวมได้ 100% เสมอ
                </p>
              </div>

              {/* Add Member Dropdown Bar */}
              <div className="p-3.5 rounded-2xl border border-theme-border bg-theme-surface flex flex-wrap sm:flex-nowrap items-center gap-2">
                <select
                  value={selectedNewUserId}
                  onChange={(e) => setSelectedNewUserId(e.target.value)}
                  className="flex-1 min-w-[180px] py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- เลือกสมาชิกที่จะเพิ่มเข้าทีม --</option>
                  {selectableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as TeamRole)}
                  className="py-2 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs cursor-pointer shrink-0 font-bold"
                >
                  <option value="developer">💻 Developer</option>
                  <option value="qa">🧪 QA / Tester</option>
                  <option value="uiux">🎨 UI/UX</option>
                  <option value="consultant">💡 Consultant</option>
                  <option value="support">🛠️ Support</option>
                  <option value="lead">👑 Lead</option>
                </select>
                <button
                  type="button"
                  disabled={!selectedNewUserId}
                  onClick={handleAddTeamMember}
                  className={cn(
                    'px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 select-none',
                    selectedNewUserId
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer'
                      : 'bg-theme-surface-secondary text-theme-text-muted cursor-not-allowed border border-theme-border'
                  )}
                >
                  + เพิ่มทีม
                </button>
              </div>

              {/* Team Members List (with Target % vs Actual % Variance) */}
              <div className="space-y-3">
                {teamList.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-theme-border text-theme-text-muted space-y-1">
                    <Users size={28} className="mx-auto opacity-30 text-indigo-500" />
                    <p className="font-bold">ยังไม่มีรายชื่อสมาชิกในทีม</p>
                    <p className="text-[10px]">พิมพ์ชื่อและกด "+ เพิ่มทีม" ด้านบน</p>
                  </div>
                ) : (
                  teamList.map((tm, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-3xl border border-theme-border bg-theme-surface space-y-3 shadow-xs"
                    >
                      {/* Top: Avatar, Name, Role, Delete */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-indigo-500/20 shadow-sm shrink-0 bg-slate-200 dark:bg-slate-700 select-none">
                            <img
                              src={getUserAvatarUrl(
                                tm.user_name,
                                tm.emp_id || availableUsers.find((u) => u.name === tm.user_name || u.id === tm.user_id)?.emp_id
                              )}
                              alt={tm.user_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = getUiAvatarFallbackUrl(tm.user_name, '6366f1');
                              }}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-theme-text">
                                {tm.user_name}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-theme-surface-secondary text-theme-text border border-theme-border/60">
                                {TEAM_ROLE_LABELS[tm.role_in_project] || tm.role_in_project}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTeamMember(idx)}
                          className="p-1.5 rounded-xl text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="ลบออกจากทีม"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Middle: Target % Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-theme-text-muted">
                            Target Contribution:
                          </span>
                          <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                            {tm.target_contribution_percent}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={tm.target_contribution_percent}
                          onChange={(e) =>
                            handleUpdateTeamTargetPercent(idx, Number(e.target.value))
                          }
                          className="w-full accent-indigo-600 cursor-pointer"
                        />
                      </div>

                      {/* Bottom: Worklog Actual Hours vs Manual Override */}
                      <div className="p-3 rounded-2xl bg-theme-surface-secondary/40 border border-theme-border/40 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-theme-text-muted flex items-center gap-1">
                            <Clock size={12} className="text-emerald-500" />
                            ชั่วโมง Worklog จริง:
                          </span>
                          <span className="font-mono font-bold text-theme-text">
                            {tm.logged_worklog_hours || 0} ชม. (คำนวณได้ ~{tm.actual_contribution_percent || 0}%)
                          </span>
                        </div>

                        {/* Manual Override inputs for flexibility */}
                        <div className="pt-1 border-t border-theme-border/40 grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                              ปรับชั่วโมงด้วยมือ (Manual Hrs)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={tm.manual_actual_hours ?? ''}
                              onChange={(e) =>
                                handleUpdateTeamMember(idx, {
                                  manual_actual_hours: e.target.value ? parseFloat(e.target.value) : null,
                                })
                              }
                              placeholder="เช่น 80 (ถ้าไม่ลง Worklog)"
                              className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                              ปรับ Actual % ด้วยมือ (Override %)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={tm.manual_actual_percent ?? ''}
                              onChange={(e) =>
                                handleUpdateTeamMember(idx, {
                                  manual_actual_percent: e.target.value ? parseFloat(e.target.value) : null,
                                })
                              }
                              placeholder="เช่น 35%"
                              className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: 4-Dimension MECE Cost Savings Sheet
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'savings' && (
            <div className="space-y-5 animate-fade-in">
              {/* Grand Total Value Saved Banner */}
              <div className="relative p-6 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-theme-surface to-theme-surface shadow-lg shadow-emerald-500/10 overflow-hidden">
                <div className="absolute -top-12 -right-8 w-40 h-40 rounded-full bg-emerald-400/20 blur-3xl animate-pulse-slow" />

                <div className="relative space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/30 animate-float">
                      <DollarSign size={18} className="text-white" />
                    </span>
                    <div>
                      <div className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider leading-tight">
                        ยอดประหยัดรวมทั้งโครงการ
                      </div>
                      <div className="text-[9px] font-bold text-theme-text-muted uppercase tracking-wide">
                        Total Annual Savings
                      </div>
                    </div>
                  </div>
                  <span className={cn(
                    'px-4 py-2 rounded-2xl text-base font-black tracking-tight shadow-lg',
                    currentTotalSavings >= 0
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30'
                      : 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/30'
                  )}>
                    ฿ {currentTotalSavings.toLocaleString('th-TH', { maximumFractionDigits: 0 })} / ปี
                  </span>
                </div>

                <div className="text-[10px] font-bold text-theme-text-muted space-y-0.5">
                  <div>ยอดจริง: ฿ {currentTotalSavings.toLocaleString('th-TH', { maximumFractionDigits: 0 })} / ปี</div>
                  {realizedThisYearDisplay !== null && (
                    <div className="text-amber-600 dark:text-amber-400">
                      รับรู้ปีนี้ ({monthsRealizedThisYear}/12 เดือน): ฿{realizedThisYearDisplay.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-emerald-500/20">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[9px] font-bold text-theme-text-muted uppercase">
                      <Users size={10} /> ผู้ใช้งานที่ได้รับประโยชน์ (คน)
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={indirectItemsList.length > 0}
                      value={indirectItemsList.length > 0 ? derivedBeneficiaryHeadcount : (beneficiaryHeadcount ?? '')}
                      onChange={(e) => setBeneficiaryHeadcount(e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-bold font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    {indirectItemsList.length > 0 && (
                      <p className="text-[9px] text-theme-text-muted">คำนวณจากรายการย่อย Indirect Cost Saving</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[9px] font-bold text-theme-text-muted uppercase">
                      <Flag size={10} /> จำนวนแผนกที่ใช้งาน
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={indirectItemsList.length > 0}
                      value={indirectItemsList.length > 0 ? derivedBeneficiaryDepartmentCount : (beneficiaryDepartmentCount ?? '')}
                      onChange={(e) => setBeneficiaryDepartmentCount(e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-bold font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    {indirectItemsList.length > 0 && (
                      <p className="text-[9px] text-theme-text-muted">คำนวณจากรายการย่อย Indirect Cost Saving</p>
                    )}
                  </div>
                </div>
                </div>
              </div>

              {/* 4 MECE Dimension Inputs */}
              <div className="space-y-4">
                {/* 1. Direct Cash Savings */}
                <div className="rounded-3xl border border-theme-border bg-theme-surface shadow-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsDirectExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400 font-black text-[11px] flex items-center justify-center">
                        1
                      </span>
                      <h4 className="font-extrabold text-xs text-theme-text">
                        Direct Savings (ลดการจ่ายเงินสดจริง)
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-violet-600 dark:text-violet-400">
                        ฿{computedDirectAnnual.toLocaleString()}
                      </span>
                      <ChevronDown size={14} className={cn('text-theme-text-muted transition-transform duration-200', isDirectExpanded && 'rotate-180')} />
                    </div>
                  </button>
                  {isDirectExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-theme-border/40">

                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        รายการอ้างอิงราคาตลาด (ไม่บังคับ)
                      </label>
                      <a
                        href="/admin?tab=salary_rate"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        🔗 ดูฐานข้อมูลเรทราคาตลาด
                      </a>
                    </div>

                    <div className="p-3 rounded-2xl border border-violet-500/30 bg-violet-500/5 flex flex-wrap items-center gap-2">
                      <SalaryRateSearchSelect
                        groups={salaryRatesByCategory}
                        value={selectedSalaryRateId}
                        onChange={setSelectedSalaryRateId}
                        placeholder="-- เลือกตำแหน่ง + ประสบการณ์ที่ต้องใช้ --"
                      />
                      <button
                        type="button"
                        disabled={selectedSalaryRateId === ''}
                        onClick={handleAddMarketRateItem}
                        className={cn(
                          'flex items-center gap-1 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 select-none',
                          selectedSalaryRateId !== ''
                            ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20 active:scale-95 cursor-pointer'
                            : 'bg-theme-surface-secondary text-theme-text-muted cursor-not-allowed border border-theme-border'
                        )}
                      >
                        <Plus size={14} />
                        เพิ่มตำแหน่ง
                      </button>
                    </div>
                    {salaryRateRows.length === 0 && (
                      <p className="text-[10px] text-theme-text-muted">
                        ยังไม่มีข้อมูลเรทอ้างอิงในระบบ — เพิ่มได้ที่หน้า Admin &gt; Master Data Manager &gt; IT Salary Rates
                      </p>
                    )}

                    {directMarketRateItemsList.map((item, idx) => {
                      const itemAnnual =
                        (item.monthly_rate / (item.working_days_per_month || 1)) * item.headcount * item.man_days;
                      return (
                        <div key={item.id} className="p-3.5 rounded-2xl border border-violet-500/40 bg-theme-surface space-y-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.position_label}
                              onChange={(e) => handleUpdateMarketRateItem(idx, { position_label: e.target.value })}
                              title={item.source_note || undefined}
                              className="flex-1 min-w-0 py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-xs font-bold focus:outline-none focus:border-violet-500"
                            />
                            <div className="text-right shrink-0 px-2">
                              <div className="text-[8px] font-bold text-theme-text-muted uppercase leading-none">รวม</div>
                              <div className="text-sm font-black text-violet-600 dark:text-violet-400 whitespace-nowrap">
                                ฿{itemAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMarketRateItem(idx)}
                              className="p-1.5 rounded-xl text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                              title="ลบรายการนี้"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                Man-day ที่ใช้
                              </label>
                              <NumberField
                                min="0"
                                value={item.man_days}
                                onValueChange={(v) => handleUpdateMarketRateItem(idx, { man_days: v })}
                                className="w-full py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-xs font-mono font-bold focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                อัตรา/เดือน (บาท)
                              </label>
                              <NumberField
                                min="0"
                                value={item.monthly_rate}
                                onValueChange={(v) => handleUpdateMarketRateItem(idx, { monthly_rate: v })}
                                className="w-full py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-xs font-mono font-bold focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                จำนวนคน
                              </label>
                              <NumberField
                                min="0"
                                value={item.headcount}
                                onValueChange={(v) => handleUpdateMarketRateItem(idx, { headcount: v })}
                                className="w-full py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-xs font-mono font-bold focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                วันทำงาน/เดือน
                              </label>
                              <NumberField
                                min="1"
                                value={item.working_days_per_month}
                                onValueChange={(v) => handleUpdateMarketRateItem(idx, { working_days_per_month: v })}
                                className="w-full py-1.5 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-xs font-mono font-bold focus:outline-none focus:border-violet-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-theme-border/40">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        เรทราคาตลาดพัฒนาระบบนี้ (บาท/ปี)
                      </label>
                      <NumberField
                        min="0"
                        value={directMarketRateItemsList.length > 0 ? marketRateItemsSum : directBaselineCostAnnual}
                        onValueChange={setDirectBaselineCostAnnual}
                        disabled={directMarketRateItemsList.length > 0}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-violet-500 disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                      {directMarketRateItemsList.length > 0 && (
                        <p className="text-[10px] text-theme-text-muted">
                          ปิดใช้งานเพราะมีรายการอ้างอิงราคาตลาดด้านบนแล้ว ระบบจะรวมยอดจากรายการนั้นแทน
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        ค่าใช้จ่ายที่บริษัทจ่ายจริง (บาท/ปี)
                      </label>
                      <NumberField
                        min="0"
                        value={directTargetCostAnnual}
                        onValueChange={setDirectTargetCostAnnual}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        Direct Savings ที่ระบบคำนวณ (บาท/ปี)
                      </label>
                      <NumberField
                        min="0"
                        value={computedDirectAnnual}
                        onValueChange={setDirectSavings}
                        disabled={hasDirectCalculator}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-violet-500 disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        รายละเอียดการลดค่าใช้จ่าย / เหตุผล
                      </label>
                      <input
                        type="text"
                        value={directNotes}
                        onChange={(e) => setDirectNotes(e.target.value)}
                        placeholder="เช่น ระบบใหม่เพื่อ Data Governance / Compliance / Single Source of Truth"
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                  </div>
                  )}
                </div>

                {/* 2. Indirect Manhour Savings */}
                <div className="rounded-3xl border border-theme-border bg-theme-surface shadow-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsIndirectExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-[11px] flex items-center justify-center">
                        2
                      </span>
                      <h4 className="font-extrabold text-xs text-theme-text">
                        Indirect Savings (ประหยัดเวลา / เพิ่มผลิตภาพ)
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                        ฿{effectiveIndirectAnnual.toLocaleString()}
                      </span>
                      <ChevronDown size={14} className={cn('text-theme-text-muted transition-transform duration-200', isIndirectExpanded && 'rotate-180')} />
                    </div>
                  </button>
                  {isIndirectExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-theme-border/40">

                  {/* Indirect Savings Line Items (Analytic / Console Report / Console Data breakdown) */}
                  <div className="space-y-2 pt-2 border-t border-theme-border/40">
                    <div className="p-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {INDIRECT_CATEGORY_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setNewIndirectItemCategory(preset)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border',
                              newIndirectItemCategory === preset
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-theme-border text-theme-text-muted hover:bg-theme-surface-tertiary'
                            )}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <input
                          type="text"
                          value={newIndirectItemCategory}
                          onChange={(e) => setNewIndirectItemCategory(e.target.value)}
                          placeholder="Category เช่น Analytic"
                          className="flex-1 min-w-[140px] py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs focus:outline-none focus:border-amber-500"
                        />
                        <select
                          value={newIndirectItemLevelId}
                          onChange={(e) => setNewIndirectItemLevelId(e.target.value)}
                          className="flex-1 min-w-[160px] py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="">-- เลือกตำแหน่ง --</option>
                          {positionLevelOptions.map((level) => (
                            <option key={level.id} value={level.id}>
                              {level.role} ({Number(level.salary_min).toLocaleString()} บาท/เดือน)
                            </option>
                          ))}
                        </select>
                        <select
                          value={effectiveNewIndirectItemDepartment}
                          onChange={(e) => setNewIndirectItemDepartment(e.target.value)}
                          className="flex-1 min-w-[140px] py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="">-- เลือกแผนก --</option>
                          {departmentOptions.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!newIndirectItemCategory.trim() || !newIndirectItemLevelId}
                          onClick={handleAddIndirectItem}
                          className={cn(
                            'px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 select-none flex items-center gap-1',
                            newIndirectItemCategory.trim() && newIndirectItemLevelId
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer'
                              : 'bg-theme-surface-secondary text-theme-text-muted cursor-not-allowed border border-theme-border'
                          )}
                        >
                          <Plus size={14} />
                          เพิ่มรายการ
                        </button>
                      </div>
                      {departmentOptions.length === 0 && (
                        <p className="text-[10px] text-theme-text-muted">
                          ยังไม่มีข้อมูลแผนกในโครงสร้างโปรเจ็กนี้ — เพิ่มได้ที่หน้าโครงสร้างโปรเจ็ก
                        </p>
                      )}
                    </div>

                    {indirectItemsList.map((item, idx) => {
                      const itemAnnual =
                        (item.monthly_salary / (item.working_days_per_month || 1)) *
                        item.days_saved_per_month *
                        item.headcount *
                        12;
                      return (
                        <div key={item.id} className="p-3 rounded-2xl border border-orange-500/40 bg-theme-surface space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => handleUpdateIndirectItem(idx, { label: e.target.value })}
                              className="flex-1 min-w-0 py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-xs font-bold"
                            />
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                              ฿{itemAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ปี
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveIndirectItem(idx)}
                              className="p-1.5 rounded-xl text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                              title="ลบรายการนี้"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                Category
                              </label>
                              <input
                                type="text"
                                value={item.category || ''}
                                onChange={(e) => handleUpdateIndirectItem(idx, { category: e.target.value })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                ตำแหน่ง
                              </label>
                              <select
                                value={positionLevelOptions.find((r) => r.role === item.position_level)?.id || ''}
                                onChange={(e) => {
                                  const level = positionLevelOptions.find((r) => r.id === e.target.value);
                                  if (level) {
                                    handleUpdateIndirectItem(idx, {
                                      position_level: level.role,
                                      monthly_salary: Number(level.salary_min),
                                    });
                                  }
                                }}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-bold cursor-pointer"
                              >
                                <option value="">-- เลือกตำแหน่ง --</option>
                                {positionLevelOptions.map((level) => (
                                  <option key={level.id} value={level.id}>
                                    {level.role}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                แผนก
                              </label>
                              <select
                                value={item.department || ''}
                                onChange={(e) => handleUpdateIndirectItem(idx, { department: e.target.value || null })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-bold cursor-pointer"
                              >
                                <option value="">-- เลือกแผนก --</option>
                                {departmentOptions.map((dept) => (
                                  <option key={dept} value={dept}>
                                    {dept}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                เงินเดือน/เดือน
                              </label>
                              <NumberField
                                min="0"
                                value={item.monthly_salary}
                                onValueChange={(v) => handleUpdateIndirectItem(idx, { monthly_salary: v })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                จำนวนคน
                              </label>
                              <NumberField
                                min="0"
                                value={item.headcount}
                                onValueChange={(v) => handleUpdateIndirectItem(idx, { headcount: v })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                วันที่ประหยัด/เดือน
                              </label>
                              <NumberField
                                min="0"
                                value={item.days_saved_per_month}
                                onValueChange={(v) => handleUpdateIndirectItem(idx, { days_saved_per_month: v })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                วันทำงาน/เดือน
                              </label>
                              <NumberField
                                min="1"
                                value={item.working_days_per_month}
                                onValueChange={(v) => handleUpdateIndirectItem(idx, { working_days_per_month: v })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-mono"
                              />
                            </div>
                          </div>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateIndirectItem(idx, { notes: e.target.value })}
                            placeholder="เช่น ลดเวลาทำเอกสารอนุมัติของ HR จาก 3 ชม. เหลือ 15 นาที..."
                            className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {indirectItemsList.length > 0 && (
                    <>
                      <div className="space-y-1 pt-2 border-t border-theme-border/40">
                        <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                          เวลาที่ประหยัดได้รวม (ชม./ปี)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={indirectItemsList.length > 0 ? indirectHoursFromItems : indirectHours || ''}
                          onChange={(e) => setIndirectHours(e.target.value === '' ? 0 : Number(e.target.value))}
                          disabled={indirectItemsList.length > 0}
                          className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-amber-500 disabled:opacity-70 disabled:cursor-not-allowed"
                        />
                        <p className="text-[10px] text-theme-text-muted">
                          คำนวณจากรายการย่อยด้านบน (วันที่ประหยัด × จำนวนคน × 12 เดือน × 8 ชม./วัน)
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                          ตัวคูณ Value Add (0 = ปิด, เช่น 2 = ได้โบนัสเพิ่มอีก 2 เท่าของ Indirect)
                        </label>
                        <NumberField
                          min="0"
                          step="0.1"
                          value={valueAddMultiplier}
                          onValueChange={setValueAddMultiplier}
                          className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-amber-500"
                        />
                        {valueAddMultiplier > 0 && (
                          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            โบนัส Value Add = ฿{(effectiveIndirectAnnual * valueAddMultiplier).toLocaleString()} / ปี
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  </div>
                  )}
                </div>

                {/* 3. Cost Avoidance */}
                <div className="rounded-3xl border border-theme-border bg-theme-surface shadow-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsAvoidanceExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-[11px] flex items-center justify-center">
                        3
                      </span>
                      <h4 className="font-extrabold text-xs text-theme-text">
                        Cost Avoidance (หลีกเลี่ยงต้นทุนอนาคต)
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                        ฿{effectiveAvoidanceAnnual.toLocaleString()}
                      </span>
                      <ChevronDown size={14} className={cn('text-theme-text-muted transition-transform duration-200', isAvoidanceExpanded && 'rotate-180')} />
                    </div>
                  </button>
                  {isAvoidanceExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-theme-border/40">

                  <div className="space-y-2">
                    <div className="p-3 rounded-2xl border border-blue-500/30 bg-blue-500/5 flex flex-wrap items-center gap-2">
                      <select
                        value={newAvoidanceItemMode}
                        onChange={(e) => setNewAvoidanceItemMode(e.target.value as 'cost_reduction' | 'replacement')}
                        className="py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="cost_reduction">ลดค่าใช้จ่ายเดิม</option>
                        <option value="replacement">แทนที่ Vendor / License</option>
                      </select>
                      <input
                        type="text"
                        value={newAvoidanceItemLabel}
                        onChange={(e) => setNewAvoidanceItemLabel(e.target.value)}
                        placeholder="เช่น ยกเลิก License ระบบเดิม"
                        className="flex-1 min-w-[160px] py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        disabled={!newAvoidanceItemLabel.trim()}
                        onClick={handleAddAvoidanceItem}
                        className={cn(
                          'flex items-center gap-1 px-4 py-2 rounded-xl font-bold text-xs transition-all shrink-0 select-none',
                          newAvoidanceItemLabel.trim()
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer'
                            : 'bg-theme-surface-secondary text-theme-text-muted cursor-not-allowed border border-theme-border'
                        )}
                      >
                        <Plus size={14} />
                        เพิ่มรายการ
                      </button>
                    </div>

                    {avoidanceItemsList.map((item, idx) => {
                      const itemAnnual = Math.max(0, (Number(item.baseline_cost_annual) || 0) - (Number(item.target_cost_annual) || 0));
                      return (
                        <div key={item.id} className="p-3 rounded-2xl border border-blue-500/40 bg-theme-surface space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => handleUpdateAvoidanceItem(idx, { label: e.target.value })}
                              className="flex-1 min-w-0 py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-xs font-bold"
                            />
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                              ฿{itemAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ปี
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAvoidanceItem(idx)}
                              className="p-1.5 rounded-xl text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                              title="ลบรายการนี้"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                ประเภท
                              </label>
                              <select
                                value={item.mode}
                                onChange={(e) => handleUpdateAvoidanceItem(idx, { mode: e.target.value as 'cost_reduction' | 'replacement' })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-bold cursor-pointer"
                              >
                                <option value="cost_reduction">ลดค่าใช้จ่ายเดิม</option>
                                <option value="replacement">แทนที่ Vendor / License</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                ค่าใช้จ่ายเดิม (บาท/ปี)
                              </label>
                              <NumberField
                                min="0"
                                value={item.baseline_cost_annual}
                                onValueChange={(v) => handleUpdateAvoidanceItem(idx, { baseline_cost_annual: v })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-theme-text-muted uppercase">
                                ค่าใช้จ่ายหลังทำ (บาท/ปี)
                              </label>
                              <NumberField
                                min="0"
                                value={item.target_cost_annual}
                                onValueChange={(v) => handleUpdateAvoidanceItem(idx, { target_cost_annual: v })}
                                className="w-full py-1 px-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text text-[10px] font-mono font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        ยอดต้นทุนที่เลี่ยงได้ (บาท/ปี)
                      </label>
                      <NumberField
                        min="0"
                        disabled={avoidanceItemsList.length > 0}
                        value={avoidanceItemsList.length > 0 ? avoidanceItemsSum : avoidanceSavings}
                        onValueChange={setAvoidanceSavings}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                      {avoidanceItemsList.length > 0 && (
                        <p className="text-[10px] text-theme-text-muted">
                          คำนวณจากรายการย่อยด้านบน
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        รายละเอียดการหลีกเลี่ยงต้นทุน
                      </label>
                      <input
                        type="text"
                        value={avoidanceNotes}
                        onChange={(e) => setAvoidanceNotes(e.target.value)}
                        placeholder="เช่น สเกลงานรองรับผู้ใช้ 3 เท่าโดยไม่ต้องเพิ่ม Headcount..."
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  </div>
                  )}
                </div>

                {/* 4. Support & Maintenance Savings */}
                <div className="rounded-3xl border border-theme-border bg-theme-surface shadow-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsSupportExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-black text-[11px] flex items-center justify-center">
                        4
                      </span>
                      <h4 className="font-extrabold text-xs text-theme-text">
                        Support & Usage Savings (ลดงานซัพพอร์ต & OpEx)
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-cyan-600 dark:text-cyan-400">
                        ฿{computedSupportAnnual.toLocaleString()}
                      </span>
                      <ChevronDown size={14} className={cn('text-theme-text-muted transition-transform duration-200', isSupportExpanded && 'rotate-180')} />
                    </div>
                  </button>
                  {isSupportExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-theme-border/40">

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        Ticket เดิม / เดือน
                      </label>
                      <NumberField
                        min="0"
                        value={supportTicketBaselineMonthly}
                        onValueChange={setSupportTicketBaselineMonthly}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        Ticket หลังทำ / เดือน
                      </label>
                      <NumberField
                        min="0"
                        value={supportTicketTargetMonthly}
                        onValueChange={setSupportTicketTargetMonthly}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        Cost / Ticket
                      </label>
                      <NumberField
                        min="0"
                        value={supportCostPerTicket}
                        onValueChange={setSupportCostPerTicket}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        ชม. / Ticket
                      </label>
                      <NumberField
                        min="0"
                        step="0.25"
                        value={supportHoursPerTicket}
                        onValueChange={setSupportHoursPerTicket}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        Rate (บาท/ชม.)
                      </label>
                      <NumberField
                        min="0"
                        value={supportHourlyRate}
                        onValueChange={setSupportHourlyRate}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        Support Savings ที่ระบบคำนวณ (บาท/ปี)
                      </label>
                      <NumberField
                        min="0"
                        value={computedSupportAnnual}
                        onValueChange={setSupportSavings}
                        disabled={hasSupportCalculator}
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text font-mono font-bold focus:outline-none focus:border-cyan-500 disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                      <p className="text-[10px] text-theme-text-muted">
                        สูตร: (Ticket เดิม - Ticket หลังทำ) x 12 x (Cost/Ticket + ชม./Ticket x Rate) ต้องมี baseline เดิมจึง claim เป็น savings
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-theme-text-muted uppercase">
                        รายละเอียด / Claim ปีที่เกี่ยวข้อง
                      </label>
                      <input
                        type="text"
                        value={supportNotes}
                        onChange={(e) => setSupportNotes(e.target.value)}
                        placeholder="เช่น 2027 Support MA - ลด Helpdesk Ticket ลง 80%"
                        className="w-full py-2 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  </div>
                  )}
                </div>

                {/* Share % and Partial-Year Realization (Optional) */}
                <div className="p-4 rounded-3xl border border-theme-border/60 bg-theme-surface-secondary/40 space-y-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-theme-text text-[11px]">
                      📊 ปรับยอด Share % (ค่าเริ่มต้น 100%)
                    </label>
                    <div className="flex gap-2">
                      {[10, 20, 30, 40, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setSavingsSharePercentage(pct)}
                          className={cn(
                            'flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                            savingsSharePercentage === pct
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-theme-border text-theme-text-muted hover:bg-theme-surface-tertiary'
                          )}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-theme-border/40">
                    <label className="block font-bold text-theme-text text-[11px]">
                      📅 จำนวนเดือนที่รับรู้ผลในปีนี้ (ไม่บังคับ)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={monthsRealizedThisYear ?? ''}
                      onChange={(e) =>
                        setMonthsRealizedThisYear(e.target.value ? Number(e.target.value) : null)
                      }
                      className="w-full py-1.5 px-3 rounded-xl border border-theme-border bg-theme-surface text-theme-text text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-theme-border/80 bg-theme-surface-secondary/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-theme-text-muted">
            {activeTab === 'overview' && <span>แก้ไขวันเริ่ม, Due Date, สถานะ และ Milestone</span>}
            {activeTab === 'team' && <span>ปรับ Target % ของทีม (รวม = 100%) และ Hours</span>}
            {activeTab === 'savings' && <span>ยอดประหยัด 4 มิติ รวม ฿{currentTotalSavings.toLocaleString()} / ปี</span>}
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveClick}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer select-none"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </div>

      {/* Milestone Editor Modal */}
      <MilestoneEditorModal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        milestone={editingMilestone}
        onSave={handleSaveMilestone}
        availableUsers={availableUsers}
      />

      {/* Discard Unsaved Changes Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={onClose}
        title={t('gantt.drawer.discardTitle')}
        message={t('gantt.drawer.discardDesc')}
        confirmText={t('gantt.drawer.discard')}
        cancelText={t('gantt.drawer.stay')}
        variant="warning"
      />

      {/* Verification Sign-off Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={showVerificationSignoffModal}
        onClose={() => setShowVerificationSignoffModal(false)}
        onConfirm={executeSaveAll}
        title="ยืนยันการรับรองตัวเลขผลประหยัด (Sign-off Verified Savings)"
        message={`คุณกำลังจะรับรองตัวเลขผลประหยัดต้นทุนรวม ฿${currentTotalSavings.toLocaleString()} / ปี ให้มีสถานะเป็น "Verified (รับรองแล้ว)"`}
        description="การรับรองนี้จะถูกใช้เป็นหลักฐานทางการเงินและ Audit โปรดตรวจสอบว่ามีสูตรและเอกสารอ้างอิงครบถ้วน"
        confirmText="ยืนยันการรับรองและบันทึก"
        cancelText="ตรวจสอบอีกครั้ง"
        variant="success"
        isLoading={isSaving}
      />
    </>
  );
};

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
  availableUsers = [],
}) => {
  if (!isOpen || !project) return null;

  return (
    <ProjectDetailDrawerContent
      key={project.id}
      project={project}
      onClose={onClose}
      onProjectUpdated={onProjectUpdated}
      availableUsers={availableUsers}
    />
  );
};
