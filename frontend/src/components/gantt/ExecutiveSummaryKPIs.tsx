import React from 'react';
import { Layers, DollarSign, Activity, PlayCircle, CheckCircle2, PlusCircle, Rocket, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isAddOnPlusType, type GanttProject, type ProjectStatus } from '../../lib/project-management';

interface ExecutiveSummaryKPIsProps {
  projects: GanttProject[];
  selectedStatuses: ProjectStatus[];
  onStatusesChange: (next: ProjectStatus[]) => void;
  selectedProjectTypes: string[];
  onProjectTypesChange: (next: string[]) => void;
  selectedUsageStatuses: string[];
  onUsageStatusesChange: (next: string[]) => void;
  showParentsOnly: boolean;
  onShowParentsOnlyChange: (value: boolean) => void;
}

const MAIN_PROJECT_TYPES = ['Project', 'Upgrade'];
const ADD_ON_TYPES = ['Add On (Plus)'];

const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every((v) => a.includes(v));

// Section header icon chip: solid color circle with a white icon, used to give
// each dashboard section a quick, scannable visual identity.
const SectionBadge: React.FC<{ colorClass: string; className?: string; children: React.ReactNode }> = ({
  colorClass,
  className,
  children,
}) => (
  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 ${colorClass} ${className || ''}`}>
    {children}
  </div>
);

// Multi-segment donut ring (score-card style): each segment's arc length is
// proportional to its share of `total`, drawn with rounded caps and a small
// gap between segments. Colors are passed as Tailwind text-* classes so the
// SVG stroke can use currentColor and stay theme-consistent.
const StatusRing: React.FC<{
  segments: { value: number; colorClass: string }[];
  total: number;
  centerValue: React.ReactNode;
  size?: number;
}> = ({ segments, total, centerValue, size = 88 }) => {
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const safeTotal = total || 1;
  const gapPct = 3;

  const arcs = segments
    .filter((seg) => seg.value > 0)
    .reduce<{ colorClass: string; startPct: number; lenPct: number }[]>((acc, seg) => {
      const pct = (seg.value / safeTotal) * 100;
      const startPct = acc.length > 0 ? acc[acc.length - 1].startPct + acc[acc.length - 1].lenPct + gapPct : 0;
      acc.push({ colorClass: seg.colorClass, startPct, lenPct: Math.max(pct - gapPct, 0) });
      return acc;
    }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-black/[0.06] dark:stroke-white/10"
      />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${a.lenPct} ${100 - a.lenPct}`}
            strokeDashoffset={-a.startPct}
            className={a.colorClass}
          />
        ))}
      </g>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-theme-text font-bold"
        style={{ fontSize: size * 0.3 }}
      >
        {centerValue}
      </text>
    </svg>
  );
};

const rowBaseClass =
  'w-full text-left rounded-lg -mx-1.5 px-1.5 transition-colors cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05]';

// Inner "white card" row: colored dot + label on the left, value on the right —
// mirrors a sleep-score style summary list (dot · label ····· value). Clickable
// to drill the Gantt/Kanban list below into just this usage status.
const StatRow: React.FC<{
  dot: React.ReactNode;
  label: string;
  value: React.ReactNode;
  active?: boolean;
  activeClass?: string;
  onClick?: () => void;
  compact?: boolean;
}> = ({ dot, label, value, active, activeClass, onClick, compact }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${rowBaseClass} flex items-center justify-between first:pt-0 last:pb-0 ${compact ? 'py-1' : 'py-1.5'} ${active ? activeClass : ''}`}
  >
    <span className={`flex items-center gap-1.5 text-theme-text-muted ${compact ? 'text-[10px]' : 'text-[11.5px]'}`}>
      {dot}
      {label}
    </span>
    <span className={`font-semibold text-theme-text tabular-nums ${compact ? 'text-[10.5px]' : 'text-[12px]'}`}>{value}</span>
  </button>
);

// Compact vertical tile: icon badge, value/percent, label, thin bar underneath —
// sized to sit 4-across in one row and match the Usage Status table's height.
// Clickable to drill the Gantt/Kanban list below into just this category; the
// on-track/at-risk or scope breakdown that used to print inline now shows as a
// hover tooltip instead, since a single row leaves no room for a second line.
const MiniStatTile: React.FC<{
  icon: React.ReactNode;
  iconBgClass: string;
  label: string;
  value: number;
  total: number;
  barColorClass: string;
  hint?: string;
  active?: boolean;
  activeClass?: string;
  onClick?: () => void;
}> = ({ icon, iconBgClass, label, value, total, barColorClass, hint, active, activeClass, onClick }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`flex flex-col items-center text-center gap-0.5 rounded-lg py-1.5 px-1 transition-colors cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05] ${
        active ? activeClass : ''
      }`}
    >
      <span className="flex items-center gap-1">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 ${iconBgClass}`}>{icon}</span>
        <span className="text-[12px] font-bold text-theme-text tabular-nums leading-none">
          {value}
          <span className="text-[8px] font-normal text-theme-text-muted ml-0.5">{pct}%</span>
        </span>
      </span>
      <span className="text-[8.5px] text-theme-text-muted leading-tight truncate max-w-full">{label}</span>
      <div className="w-full h-1 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${barColorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
};

export const ExecutiveSummaryKPIs: React.FC<ExecutiveSummaryKPIsProps> = ({
  projects,
  selectedStatuses,
  onStatusesChange,
  selectedProjectTypes,
  onProjectTypesChange,
  selectedUsageStatuses,
  onUsageStatusesChange,
  showParentsOnly,
  onShowParentsOnlyChange,
}) => {
  const { t } = useTranslation();
  const totalProjects = projects.length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const onHoldCount = projects.filter((p) => p.status === 'on_hold').length;
  const projectCount = projects.filter((p) => {
    const type = (p.worklog_project_type || 'Project').toLowerCase();
    return type === 'project' || type === 'upgrade';
  }).length;
  const inProgressProjects = projects.filter((p) => p.status === 'in_progress');
  const inProgressCount = inProgressProjects.length;
  const onTrackInProgressCount = inProgressProjects.filter((p) => p.project_health === 'on_track').length;
  const atRiskInProgressCount = inProgressCount - onTrackInProgressCount;
  const addOnCount = projects.filter((p) => isAddOnPlusType(p.worklog_project_type)).length;
  const activeUsageCount = projects.filter((p) => p.usage_status === 'active').length;
  const inactiveUsageCount = projects.filter((p) => p.usage_status === 'inactive').length;
  const unverifiedUsageCount = projects.filter((p) => !p.usage_status || p.usage_status === 'unverified').length;

  let totalSavings = 0;
  projects.forEach((p) => {
    totalSavings += p.total_savings_annual;
  });

  const isStatusActive = (status: ProjectStatus) => selectedStatuses.length === 1 && selectedStatuses[0] === status;
  const toggleStatus = (status: ProjectStatus) => onStatusesChange(isStatusActive(status) ? [] : [status]);

  const isTypesActive = (types: string[]) => sameSet(selectedProjectTypes, types);
  const toggleTypes = (types: string[]) => onProjectTypesChange(isTypesActive(types) ? [] : types);

  const isUsageActive = (status: string) => selectedUsageStatuses.length === 1 && selectedUsageStatuses[0] === status;
  const toggleUsage = (status: string) => onUsageStatusesChange(isUsageActive(status) ? [] : [status]);

  return (
    <div className="rounded-[24px] bg-slate-100 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] p-3.5 md:p-4 mb-3 select-none">
      <div className="grid grid-cols-1 md:grid-cols-[1.35fr_0.85fr_0.85fr] gap-3 items-start">
        {/* SECTION 1: Project Portfolio — amount + status breakdown (clickable to drill) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-medium text-theme-text-muted">{t('gantt.kpi.portfolio')}</span>
            <span className="text-lg font-bold text-theme-text tracking-tight tabular-nums leading-none">
              {totalProjects}
            </span>
            <span className="text-[10px] font-medium text-theme-text-muted -ml-1">{t('gantt.kpi.projectsUnit')}</span>

            <label
              title={t('gantt.kpi.parentOnlyHint')}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer select-none transition-colors ${
                showParentsOnly
                  ? 'bg-indigo-100 dark:bg-indigo-500/15 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                  : 'border-black/10 dark:border-white/15 text-theme-text-muted hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={showParentsOnly}
                onChange={(e) => onShowParentsOnlyChange(e.target.checked)}
                className="sr-only"
              />
              <span
                className={`w-3 h-3 rounded-[3px] border flex items-center justify-center shrink-0 ${
                  showParentsOnly ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-black/20 dark:border-white/25'
                }`}
              >
                {showParentsOnly && <Check size={8} strokeWidth={3} />}
              </span>
              {t('gantt.kpi.parentOnlyLabel')}
            </label>

            {onHoldCount > 0 && (
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-lime-200/70 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300">
                +{onHoldCount} {t('gantt.kpi.onHold')}
              </span>
            )}

            <SectionBadge colorClass="bg-blue-500" className="ml-auto">
              <Layers size={12.5} strokeWidth={2.25} />
            </SectionBadge>
          </div>

          <div className="rounded-xl bg-white dark:bg-white/[0.06] px-2 py-3.5 grid grid-cols-4 gap-1 divide-x divide-black/[0.05] dark:divide-white/[0.08]">
            <MiniStatTile
              icon={<PlayCircle size={12} strokeWidth={2.5} />}
              iconBgClass="bg-emerald-500"
              label={t('gantt.kpi.inProgress')}
              value={inProgressCount}
              total={totalProjects}
              barColorClass="bg-emerald-500"
              hint={`${t('gantt.kpi.inProgress')}: ${onTrackInProgressCount} ${t('gantt.kpi.onTrack')} · ${atRiskInProgressCount} ${t('gantt.kpi.atRisk')}`}
              active={isStatusActive('in_progress')}
              activeClass="bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-300 dark:ring-emerald-500/40"
              onClick={() => toggleStatus('in_progress')}
            />
            <MiniStatTile
              icon={<CheckCircle2 size={12} strokeWidth={2.5} />}
              iconBgClass="bg-blue-500"
              label={t('gantt.kpi.completed')}
              value={completedCount}
              total={totalProjects}
              barColorClass="bg-blue-500"
              active={isStatusActive('completed')}
              activeClass="bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-300 dark:ring-blue-500/40"
              onClick={() => toggleStatus('completed')}
            />
            <MiniStatTile
              icon={<PlusCircle size={12} strokeWidth={2.5} />}
              iconBgClass="bg-violet-500"
              label={t('gantt.kpi.addOnProjects')}
              value={addOnCount}
              total={totalProjects}
              barColorClass="bg-violet-500"
              active={isTypesActive(ADD_ON_TYPES)}
              activeClass="bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-300 dark:ring-violet-500/40"
              onClick={() => toggleTypes(ADD_ON_TYPES)}
            />
            <MiniStatTile
              icon={<Rocket size={12} strokeWidth={2.5} />}
              iconBgClass="bg-amber-500"
              label={t('gantt.kpi.mainProjects')}
              value={projectCount}
              total={totalProjects}
              barColorClass="bg-amber-500"
              hint={`${t('gantt.kpi.mainProjects')}: ${t('gantt.kpi.mainProjectsHint')}`}
              active={isTypesActive(MAIN_PROJECT_TYPES)}
              activeClass="bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-300 dark:ring-amber-500/40"
              onClick={() => toggleTypes(MAIN_PROJECT_TYPES)}
            />
          </div>
        </div>

        {/* SECTION 2: Usage Status — how many shipped projects are still actively used
            (clickable to drill). Ring on the left, the narrower breakdown list on the right. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-theme-text-muted">{t('gantt.kpi.usageStatusSection')}</span>
            <SectionBadge colorClass="bg-violet-500">
              <Activity size={12.5} strokeWidth={2.25} />
            </SectionBadge>
          </div>

          <div className="flex items-center gap-2">
            <StatusRing
              size={68}
              total={totalProjects}
              centerValue={activeUsageCount}
              segments={[
                { value: activeUsageCount, colorClass: 'text-emerald-500' },
                { value: inactiveUsageCount, colorClass: 'text-slate-400' },
                { value: unverifiedUsageCount, colorClass: 'text-amber-500' },
              ]}
            />

            <div className="flex-1 min-w-0 rounded-xl bg-white dark:bg-white/[0.06] px-2 py-1.5 divide-y divide-black/[0.05] dark:divide-white/[0.08]">
              <StatRow
                compact
                dot={<span className="text-[11px]">🟢</span>}
                label={t('gantt.kpi.usageActive')}
                value={`${activeUsageCount}/${totalProjects}`}
                active={isUsageActive('active')}
                activeClass="bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-300 dark:ring-emerald-500/40"
                onClick={() => toggleUsage('active')}
              />
              <StatRow
                compact
                dot={<span className="text-[11px]">⚪</span>}
                label={t('gantt.kpi.usageInactive')}
                value={`${inactiveUsageCount}/${totalProjects}`}
                active={isUsageActive('inactive')}
                activeClass="bg-slate-50 dark:bg-slate-500/10 ring-1 ring-slate-300 dark:ring-slate-500/40"
                onClick={() => toggleUsage('inactive')}
              />
              <StatRow
                compact
                dot={<span className="text-[11px]">❓</span>}
                label={t('gantt.kpi.usageUnverified')}
                value={`${unverifiedUsageCount}/${totalProjects}`}
                active={isUsageActive('unverified')}
                activeClass="bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-300 dark:ring-amber-500/40"
                onClick={() => toggleUsage('unverified')}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Cost Saving — total value realization */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-theme-text-muted">{t('gantt.kpi.totalSavings')}</span>
            <SectionBadge colorClass="bg-emerald-500">
              <DollarSign size={12.5} strokeWidth={2.25} />
            </SectionBadge>
          </div>

          <div className="rounded-xl bg-white dark:bg-white/[0.06] px-3 py-3 text-center">
            <div className="text-[22px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
              ฿{totalSavings.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-theme-text-muted mt-1 leading-snug">{t('gantt.kpi.savingsBreakdown')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
