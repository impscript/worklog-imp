import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  DollarSign,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderTree,
  Layers,
  EyeOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { GanttProject, ProjectStatus } from '../../lib/project-management';
import {
  PROJECT_HEALTH_LABELS,
  TEAM_ROLE_LABELS,
  buildGanttTree,
  getProjectTypeMeta,
  isAddOnPlusType,
  USAGE_STATUS_META,
} from '../../lib/project-management';
import { cn } from '../../lib/utils';
import type { GanttZoomLevel } from './GanttFilterToolbar';

interface GanttRoadmapCanvasProps {
  projects: GanttProject[];
  zoomLevel: GanttZoomLevel;
  selectedYear?: number | 'all';
  isTreeView: boolean;
  expandedProjectIds: Set<string>;
  onToggleExpandProject: (id: string) => void;
  onSelectProject: (project: GanttProject) => void;
  selectedProjectId?: string | null;
  onHideProject: (id: string) => void;
}

interface TimelineSpan {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  columns: { label: string; subLabel?: string; startDate: Date; endDate: Date; days: number }[];
}

interface RenderableGanttRow {
  project: GanttProject;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  childCount: number;
}

function getStatusBgColor(status: ProjectStatus, depth: number) {
  if (depth > 0) {
    switch (status) {
      case 'planning':
        return 'bg-blue-400/90 hover:bg-blue-500 border-blue-300';
      case 'in_progress':
        return 'bg-amber-400/90 hover:bg-amber-500 border-amber-300';
      case 'testing':
        return 'bg-purple-400/90 hover:bg-purple-500 border-purple-300';
      case 'completed':
        return 'bg-emerald-400/90 hover:bg-emerald-500 border-emerald-300';
      case 'on_hold':
        return 'bg-slate-400/90 hover:bg-slate-500 border-slate-300';
      default:
        return 'bg-indigo-400/90 hover:bg-indigo-500 border-indigo-300';
    }
  }

  switch (status) {
    case 'planning':
      return 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 border-blue-400';
    case 'in_progress':
      return 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 border-amber-400';
    case 'testing':
      return 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 border-purple-400';
    case 'completed':
      return 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 border-emerald-400';
    case 'on_hold':
      return 'bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-700 hover:to-slate-600 border-slate-400';
    default:
      return 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 border-indigo-400';
  }
}

interface GanttRowProps {
  project: GanttProject;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  childCount: number;
  isSelected: boolean;
  timelineStart: number;
  timelineEnd: number;
  /** CSS background that draws the column divider lines (same for every row). */
  gridBackground: string;
  fillTimelineWidth: boolean;
  timelineCanvasWidth?: number;
  trackWidth: number;
  t: TFunction;
  onSelectProject: (project: GanttProject) => void;
  onToggleExpandProject: (id: string) => void;
  onHideProject: (id: string) => void;
}

// One memoized row: selecting a project, opening the drawer or typing in a filter no longer repaints
// every row, only the rows whose own props changed.
const GanttRow = React.memo(function GanttRow({
  project: p,
  depth,
  hasChildren,
  isExpanded,
  childCount,
  isSelected,
  timelineStart,
  timelineEnd,
  gridBackground,
  fillTimelineWidth,
  timelineCanvasWidth,
  trackWidth,
  t,
  onSelectProject,
  onToggleExpandProject,
  onHideProject,
}: GanttRowProps) {
  const healthMeta = PROJECT_HEALTH_LABELS[p.project_health];
  const usageMeta = USAGE_STATUS_META[p.usage_status || 'unverified'];
  const isChild = depth > 0;

  // Calculate Gantt Bar Offset and Width
  const startTime = p.start_date
    ? new Date(p.start_date).getTime()
    : timelineStart;
  const dueTime = p.due_date
    ? new Date(p.due_date).getTime()
    : startTime + 30 * 86400000; // default 30 days if no due date

  const totalTimelineDuration = timelineEnd - timelineStart;

  const barStartPercent = Math.max(
    0,
    Math.min(100, ((startTime - timelineStart) / totalTimelineDuration) * 100)
  );
  const barEndPercent = Math.max(
    barStartPercent + 2,
    Math.min(100, ((dueTime - timelineStart) / totalTimelineDuration) * 100)
  );
  const barWidthPercent = Math.max(2.5, barEndPercent - barStartPercent);

  // Plan bar (ghost/outline, painted behind Actual): only when the
  // project actually has both plan dates and isn't unplanned
  // Add-On (Plus) scope.
  const hasPlanBar =
    !!p.planned_start_date && !!p.planned_due_date && !isAddOnPlusType(p.worklog_project_type);
  let planBarStartPercent = 0;
  let planBarWidthPercent = 0;
  if (hasPlanBar) {
    const planStartTime = new Date(p.planned_start_date as string).getTime();
    const planDueTime = new Date(p.planned_due_date as string).getTime();
    planBarStartPercent = Math.max(
      0,
      Math.min(100, ((planStartTime - timelineStart) / totalTimelineDuration) * 100)
    );
    const planBarEndPercent = Math.max(
      planBarStartPercent + 2,
      Math.min(100, ((planDueTime - timelineStart) / totalTimelineDuration) * 100)
    );
    planBarWidthPercent = Math.max(2.5, planBarEndPercent - planBarStartPercent);
  }

  return (
    <div
      onClick={() => onSelectProject(p)}
      className={cn(
        'flex items-stretch hover:bg-indigo-500/5 transition-colors cursor-pointer group',
        isSelected && 'bg-indigo-500/10',
        isChild && 'bg-slate-50/40 dark:bg-slate-900/20'
      )}
    >
      {/* Left Sticky Column */}
      <div className="w-96 sm:w-[480px] px-3.5 py-2 border-r border-theme-border/80 shrink-0 sticky left-0 z-10 bg-theme-surface dark:bg-theme-bg-page flex flex-col justify-center gap-1.5 shadow-xs">
        {/* Line 1: Name + Lead Avatar */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div
            className="flex items-center gap-1.5 min-w-0 flex-1"
            style={{ paddingLeft: depth > 0 ? `${depth * 18}px` : undefined }}
          >
            {/* Expand / Collapse Button for Parent */}
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpandProject(p.id);
                }}
                className="p-1 rounded-lg hover:bg-indigo-500/15 text-theme-text-muted hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}

            {/* Child Indent Indicator */}
            {isChild && (
              <span className="text-indigo-400/80 font-mono text-[11px] shrink-0">
                ↳
              </span>
            )}

            <span
              title={p.project_name}
              className={cn(
                'min-w-0 line-clamp-2 leading-snug [overflow-wrap:anywhere] transition-colors',
                isChild
                  ? 'text-[11px] font-semibold text-theme-text-secondary group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                  : 'text-xs font-black text-theme-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
              )}
            >
              {p.project_name}
            </span>
          </div>

          {/* Head Lead Avatar Badge */}
          {p.head_lead_name ? (
            <span
              className="shrink-0 max-w-[170px] truncate text-[11px] select-none cursor-default"
              title={`${t('gantt.canvas.lead')}: ${p.head_lead_name}`}
            >
              <span className="text-theme-text-muted">{t('gantt.canvas.leadShort')}: </span>
              <span className="font-semibold text-amber-700 dark:text-amber-300">{p.head_lead_name.split(/\s+/)[0]}</span>
            </span>
          ) : (
            <span className="shrink-0 text-[10px] text-theme-text-muted/60 select-none" title={`${t('gantt.canvas.lead')}: ${t('gantt.canvas.unassigned')}`}>
              {t('gantt.canvas.leadShort')}: {t('gantt.canvas.unassigned')}
            </span>
          )}

          {/* Temporarily Hide Project (presentation-only) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHideProject(p.id);
            }}
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-500/15 text-theme-text-muted hover:text-slate-600 dark:hover:text-slate-300 transition-all cursor-pointer shrink-0"
            title={t('gantt.canvas.hideProject')}
          >
            <EyeOff size={13} />
          </button>
        </div>

        {/* Line 2: Badges + Team Contribution Avatar Stack */}
        <div
          className="flex items-center justify-between gap-1.5 text-[10px]"
          style={{ paddingLeft: depth > 0 ? `${depth * 18 + 14}px` : undefined }}
        >
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Sub-module Count Pill for Parent */}
            {hasChildren && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[9.5px]">
                <Layers size={10} />
                <span>{childCount}</span>
              </span>
            )}

            {/* Project Type Badge (Project vs Support) */}
            {(() => {
              const typeMeta = getProjectTypeMeta(p.worklog_project_type);
              return (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-extrabold border text-[9.5px] select-none',
                    typeMeta.badge
                  )}
                  title={`${t('gantt.filters.projectType')}: ${typeMeta.label}`}
                >
                  <span>{typeMeta.icon}</span>
                  <span>{typeMeta.label}</span>
                </span>
              );
            })()}

            {/* Team / Holding Badges */}
            <span className="px-1.5 py-0.5 rounded-md font-bold bg-theme-surface-secondary text-theme-text border border-theme-border/60 text-[9.5px]">
              {p.owner_team || 'IMP'}
            </span>
            {p.owner_holding && (
              <span className="px-1.5 py-0.5 rounded-md font-semibold text-theme-text-muted border border-theme-border/40 truncate max-w-[70px] text-[9.5px]">
                {p.owner_holding}
              </span>
            )}

            {/* Health Indicator Badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold border text-[9.5px]',
                healthMeta.badge
              )}
            >
              <span>{healthMeta.icon}</span>
              <span>{healthMeta.label}</span>
            </span>

            {/* Usage Status Badge — is this shipped project still
                actually used? Separate from schedule health above. */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold border text-[9.5px]',
                usageMeta.badge
              )}
              title={p.last_usage_note || undefined}
            >
              <span>{usageMeta.icon}</span>
              <span>{usageMeta.shortLabel}</span>
            </span>
          </div>

          {/* Team Overlapping Avatar Stack */}
          {p.team_contributions.length > 0 ? (
            <span
              className="shrink-0 max-w-[50%] truncate pl-1 text-[10.5px] font-medium text-theme-text-secondary select-none cursor-default"
              title={`${t('gantt.drawer.tabTeam')} (${p.team_contributions.length}):\n${p.team_contributions.map(item => `${item.user_name} (${TEAM_ROLE_LABELS[item.role_in_project] || item.role_in_project}, ${item.target_contribution_percent}%)`).join('\n')}`}
            >
              <span className="text-theme-text-muted">{t('gantt.canvas.teamShort')}: </span>
              {p.team_contributions.slice(0, 3).map((tm) => tm.user_name.split(/\s+/)[0]).join(', ')}
              {p.team_contributions.length > 3 && ` +${p.team_contributions.length - 3}`}
            </span>
          ) : (
            <div className="text-[9px] text-theme-text-muted/50 shrink-0">
              {t('gantt.canvas.teamShort')}: {t('gantt.canvas.unassigned')}
            </div>
          )}
        </div>
      </div>

      {/* Right Timeline Canvas Track */}
      <div
        className={cn('relative flex items-center py-2 px-1', fillTimelineWidth && 'flex-1 min-w-0')}
        style={{ backgroundImage: gridBackground, ...(fillTimelineWidth ? {} : { width: timelineCanvasWidth }) }}
      >
        {(() => {
          // Adaptive bar: the label (status · progress, savings chip,
          // milestones) is drawn inside the bar only when the bar is wide
          // enough in real pixels; otherwise the unfit parts are drawn
          // beside the bar so short projects never hide their data.
          const trackPx = trackWidth || 1000;
          const barPx = (barWidthPercent / 100) * trackPx;
          const milestoneCount = Math.min(3, p.milestones.length);
          const statusText = `${p.status.toUpperCase()} · ${p.progress_percent}%`;
          const savingsText =
            p.total_savings_annual > 0
              ? `${(p.total_savings_annual / 1000).toFixed(0)}k/${t('gantt.filters.year')}`
              : null;

          const showStatusInside = barPx >= 120;
          const showSavingsInside = barPx >= 230;
          const showMilestonesInside = barPx >= 60;

          const showStatusOutside = !showStatusInside;
          const showSavingsOutside = !!savingsText && !showSavingsInside;
          const showMilestonesOutside = milestoneCount > 0 && !showMilestonesInside;
          const hasCallout = showStatusOutside || showSavingsOutside || showMilestonesOutside;

          const calloutPx =
            12 +
            (showStatusOutside ? 118 : 0) +
            (showSavingsOutside ? 84 : 0) +
            (showMilestonesOutside ? milestoneCount * 12 : 0);
          const barEndPx = ((barStartPercent + barWidthPercent) / 100) * trackPx;
          const calloutOnRight = barEndPx + 6 + calloutPx <= trackPx;

          const rowHeight = isChild ? 26 : 32;
          const planHeight = isChild ? 8 : 11;
          const actualHeight = hasPlanBar ? (isChild ? 16 : 20) : rowHeight;

          const barTitle = `${p.project_name} — ${statusText}${savingsText ? ` · ${savingsText}` : ''}`;

          const milestoneDiamonds = (inside: boolean) =>
            p.milestones.slice(0, 3).map((m, mIdx) => (
              <div
                key={mIdx}
                title={`Milestone: ${m.milestone_name} (${m.status})`}
                className={cn(
                  'w-2 h-2 rotate-45 border shrink-0',
                  inside
                    ? cn('border-white shadow-xs', m.status === 'completed' ? 'bg-emerald-300' : 'bg-white/80')
                    : cn('border-slate-400/70', m.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-500')
                )}
              />
            ));

          const savingsChip = (inside: boolean) => (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[9px] font-mono shrink-0',
                inside
                  ? 'bg-emerald-950/40 text-emerald-200 border-emerald-400/40'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              )}
            >
              <DollarSign size={10} />
              <span>{savingsText}</span>
            </span>
          );

          return (
            <div className="relative w-full" style={{ height: rowHeight }}>
              {/* Plan Line */}
              {hasPlanBar && (
                <div
                  className="absolute top-0 rounded-full bg-slate-400 dark:bg-slate-400/80 flex items-center justify-center overflow-hidden"
                  style={{
                    left: `${planBarStartPercent}%`,
                    width: `${planBarWidthPercent}%`,
                    height: planHeight,
                  }}
                  title={`${t('gantt.canvas.legendPlan')}: ${p.planned_start_date} → ${p.planned_due_date}`}
                >
                  <span className="text-[6px] font-bold text-white/90 tracking-wider leading-none select-none truncate px-0.5">
                    PLAN
                  </span>
                </div>
              )}

              {/* Actual Bar */}
              <div
                title={barTitle}
                className={cn(
                  'absolute bottom-0 shadow-md flex items-center transition-all group-hover:scale-[1.01] overflow-hidden',
                  hasPlanBar ? 'rounded-lg px-2' : 'rounded-xl px-2.5'
                )}
                style={{ left: `${barStartPercent}%`, width: `${barWidthPercent}%`, height: actualHeight }}
              >
                {/* Base Bar Fill */}
                <div
                  className={cn(
                    'absolute inset-0 border transition-colors opacity-95',
                    getStatusBgColor(p.status, depth)
                  )}
                />

                {/* Progress Shading Inner Bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-black/20 dark:bg-white/20 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, p.progress_percent))}%` }}
                />

                {/* Milestone Diamonds / Ticks (only when they fit) */}
                {showMilestonesInside && milestoneCount > 0 && (
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1 z-10">
                    {milestoneDiamonds(true)}
                  </div>
                )}

                {/* Bar Content Label (only the parts that fit) */}
                {(showStatusInside || (showSavingsInside && savingsText)) && (
                  <div className="relative z-10 flex items-center justify-between w-full text-white font-extrabold text-[10.5px] gap-2 min-w-0 drop-shadow-xs">
                    <span className="truncate">{showStatusInside ? statusText : ''}</span>
                    {showSavingsInside && savingsText && savingsChip(true)}
                  </div>
                )}
              </div>

              {/* Callout beside the bar for whatever did not fit inside */}
              {hasCallout && (
                <div
                  className="absolute bottom-0 z-20 flex items-center gap-1.5 px-1.5 rounded-md border border-theme-border/60 bg-theme-surface dark:bg-theme-bg-page shadow-xs whitespace-nowrap pointer-events-none"
                  style={{
                    height: actualHeight,
                    ...(calloutOnRight
                      ? { left: `calc(${barStartPercent + barWidthPercent}% + 6px)` }
                      : { right: `calc(${100 - barStartPercent}% + 6px)` }),
                  }}
                >
                  {showMilestonesOutside && (
                    <span className="flex items-center gap-1">{milestoneDiamonds(false)}</span>
                  )}
                  {showStatusOutside && (
                    <span className="text-[10px] font-extrabold text-theme-text">{statusText}</span>
                  )}
                  {showSavingsOutside && savingsChip(false)}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
});

export const GanttRoadmapCanvas: React.FC<GanttRoadmapCanvasProps> = ({
  projects,
  zoomLevel,
  selectedYear = 'all',
  isTreeView,
  expandedProjectIds,
  onToggleExpandProject,
  onSelectProject,
  selectedProjectId,
  onHideProject,
}) => {
  const { t, i18n } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Pixel width of the timeline track (identical for every row), so each bar can
  // decide whether its label fits inside or must be drawn beside it.
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      setTrackWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute overall timeline bounds across all projects or anchor to selected year
  const timelineSpan = useMemo((): TimelineSpan => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const targetYear = selectedYear && selectedYear !== 'all' ? selectedYear : currentYear;

    let minTime = new Date(targetYear, 0, 1).getTime();
    let maxTime = new Date(targetYear, 11, 31).getTime();

    if (selectedYear === 'all') {
      projects.forEach((p) => {
        if (p.start_date) {
          const sTime = new Date(p.start_date).getTime();
          if (!isNaN(sTime) && sTime < minTime) minTime = sTime;
        }
        if (p.due_date) {
          const dTime = new Date(p.due_date).getTime();
          if (!isNaN(dTime) && dTime > maxTime) maxTime = dTime;
        }
      });
    }

    // Expand bounds with padding
    const startDate = new Date(minTime);
    startDate.setDate(1); // Start of month

    const endDate = new Date(maxTime);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // End of month

    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Generate columns based on zoom level
    const columns: TimelineSpan['columns'] = [];
    const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';

    if (zoomLevel === 'month') {
      const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (cur <= endDate) {
        const colStart = new Date(cur);
        const colEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        const days = Math.round((colEnd.getTime() - colStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const monthName = colStart.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
        columns.push({ label: monthName, startDate: colStart, endDate: colEnd, days });
        cur.setMonth(cur.getMonth() + 1);
      }
    } else if (zoomLevel === 'quarter') {
      const startQuarter = Math.floor(startDate.getMonth() / 3);
      const cur = new Date(startDate.getFullYear(), startQuarter * 3, 1);
      while (cur <= endDate) {
        const colStart = new Date(cur);
        const qNum = Math.floor(colStart.getMonth() / 3) + 1;
        const colEnd = new Date(cur.getFullYear(), qNum * 3, 0);
        const days = Math.round((colEnd.getTime() - colStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        columns.push({
          label: `Q${qNum}`,
          subLabel: String(colStart.getFullYear()),
          startDate: colStart,
          endDate: colEnd,
          days,
        });
        cur.setMonth(cur.getMonth() + 3);
      }
    } else {
      // Year zoom
      const curYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      for (let y = curYear; y <= endYear; y++) {
        const colStart = new Date(y, 0, 1);
        const colEnd = new Date(y, 11, 31);
        const days = Math.round((colEnd.getTime() - colStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        columns.push({ label: String(y), startDate: colStart, endDate: colEnd, days });
      }
    }

    return { startDate, endDate, totalDays, columns };
  }, [projects, zoomLevel, selectedYear, i18n.language]);

  // Cumulative left/width % for each column, computed once and shared by the header
  // and every row's grid-line overlay. Rendering columns as absolutely-positioned
  // boxes from this single shared array (instead of letting each of the ~90 row
  // copies independently flex-distribute the same percentages) avoids the tiny
  // cross-tree rounding drift that showed up as a visible seam on the darker
  // quarter-boundary lines.
  const columnsWithOffset = useMemo(() => {
    return timelineSpan.columns.reduce<Array<TimelineSpan['columns'][number] & { widthPercent: number; leftPercent: number }>>(
      (acc, col) => {
        const widthPercent = (col.days / timelineSpan.totalDays) * 100;
        const leftPercent = acc.length > 0 ? acc[acc.length - 1].leftPercent + acc[acc.length - 1].widthPercent : 0;
        acc.push({ ...col, widthPercent, leftPercent });
        return acc;
      },
      []
    );
  }, [timelineSpan]);

  // Today position in %
  const todayPositionPercent = useMemo(() => {
    const nowTime = new Date().getTime();
    const startTime = timelineSpan.startDate.getTime();
    const endTime = timelineSpan.endDate.getTime();
    if (nowTime < startTime) return null;
    if (nowTime > endTime) return null;
    const ratio = (nowTime - startTime) / (endTime - startTime);
    return Math.min(100, Math.max(0, ratio * 100));
  }, [timelineSpan]);

  // Month zoom stretches to fill the visible table exactly (no horizontal scroll needed) —
  // but only while the span stays short enough to stay readable. Once a project date range
  // pushes month zoom past this many columns, fall back to a fixed pixel density (like
  // quarter/year) so labels don't get crushed illegibly, and let it scroll horizontally instead.
  const MAX_FILL_MONTHS = 18;
  const fillTimelineWidth = zoomLevel === 'month' && timelineSpan.columns.length <= MAX_FILL_MONTHS;
  const dayWidthPx = zoomLevel === 'month' ? 3.2 : zoomLevel === 'quarter' ? 2.5 : 1.2;
  const timelineCanvasWidth = fillTimelineWidth
    ? undefined
    : Math.max(800, timelineSpan.totalDays * dayWidthPx);

  // In month zoom, darken the divider that lands on a quarter boundary (end of
  // Mar/Jun/Sep/Dec) so quarters are easy to spot without switching zoom levels.
  const isQuarterEndColumn = (col: TimelineSpan['columns'][number]) =>
    zoomLevel === 'month' && (col.startDate.getMonth() + 1) % 3 === 0;

  // Column divider lines drawn as ONE background on each row's track (hard-stop gradient), instead of one
  // absolutely-positioned div per column per row. Same positions as the header's dividers, behind the bars.
  const gridBackground = useMemo(() => {
    const light = 'color-mix(in srgb, var(--theme-border) 20%, transparent)';
    const strong = 'color-mix(in srgb, var(--theme-border) 60%, transparent)';
    const stops: string[] = [];
    columnsWithOffset.forEach((col) => {
      const edge = col.leftPercent + col.widthPercent;
      const color = zoomLevel === 'month' && (col.startDate.getMonth() + 1) % 3 === 0 ? strong : light;
      stops.push(`transparent calc(${edge}% - 1px)`, `${color} calc(${edge}% - 1px)`, `${color} ${edge}%`, `transparent ${edge}%`);
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [columnsWithOffset, zoomLevel]);

  // Flatten Hierarchical Tree into Renderable Rows
  const renderableRows = useMemo((): RenderableGanttRow[] => {
    if (!isTreeView) {
      return projects.map((p) => ({
        project: p,
        depth: 0,
        hasChildren: false,
        isExpanded: false,
        childCount: 0,
      }));
    }

    const tree = buildGanttTree(projects);
    const originalById = new Map(projects.map((item) => [item.id, item]));
    const rows: RenderableGanttRow[] = [];

    const traverse = (node: GanttProject, depth: number) => {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isExpanded = expandedProjectIds.has(node.id);
      const childCount = node.children ? node.children.length : 0;

      rows.push({
        project: originalById.get(node.id) ?? node,
        depth,
        hasChildren,
        isExpanded,
        childCount,
      });

      if (hasChildren && isExpanded && node.children) {
        node.children.forEach((child) => traverse(child, depth + 1));
      }
    };

    tree.forEach((root) => traverse(root, 0));
    return rows;
  }, [projects, isTreeView, expandedProjectIds]);

  if (projects.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl border border-dashed border-theme-border/80 bg-theme-surface/40 text-theme-text-muted space-y-3">
        <FolderOpen size={36} className="mx-auto opacity-30 text-indigo-500" />
        <h3 className="font-bold text-sm text-theme-text">{t('gantt.canvas.noProjects')}</h3>
        <p className="text-xs max-w-sm mx-auto">
          {t('gantt.canvas.noProjectsDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-theme-border/80 bg-theme-surface dark:bg-theme-bg-page shadow-xl overflow-hidden flex flex-col select-none">
      {/* Scrollable Container with Sticky Left Column */}
      <div
        ref={scrollContainerRef}
        className={cn(
          'custom-scrollbar flex-1 relative max-h-[70vh] overflow-y-auto',
          // Month zoom is sized to fit exactly, so any horizontal scrollbar here
          // would only be from sub-pixel rounding noise — clip it instead of
          // letting a hairline scrollbar appear for a fraction of a pixel.
          fillTimelineWidth ? 'overflow-x-hidden' : 'overflow-x-auto'
        )}
      >
        <div className={cn('flex flex-col', fillTimelineWidth ? 'w-full' : 'min-w-fit')}>
          {/* Header Row */}
          <div className="flex border-b border-theme-border/80 bg-theme-surface-secondary sticky top-0 z-20 text-xs font-bold text-theme-text">
            {/* Frozen Left Header */}
            <div className="w-96 sm:w-[480px] px-4 py-3 border-r border-theme-border/80 shrink-0 sticky left-0 z-30 bg-theme-surface-secondary flex items-center justify-between shadow-xs">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-theme-text-muted font-black">
                <FolderTree size={14} className="text-indigo-500" />
                {isTreeView ? t('gantt.canvas.projectAndModules') : t('gantt.canvas.timeline')}
              </span>
              <span className="text-[10px] text-theme-text-muted">({renderableRows.length})</span>
            </div>

            {/* Timeline Scale Headers */}
            <div
              ref={trackRef}
              className={cn('relative', fillTimelineWidth && 'flex-1 min-w-0')}
              style={fillTimelineWidth ? undefined : { width: timelineCanvasWidth }}
            >
              {columnsWithOffset.map((col, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'absolute top-0 bottom-0 px-2 py-3 text-center border-r truncate flex flex-col justify-center',
                    isQuarterEndColumn(col) ? 'border-theme-border' : 'border-theme-border/40'
                  )}
                  style={{ left: `${col.leftPercent}%`, width: `${col.widthPercent}%` }}
                >
                  <span className="text-[11px] font-bold text-theme-text">{col.label}</span>
                  {col.subLabel && (
                    <span className="text-[9px] text-theme-text-muted font-normal">{col.subLabel}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Project Rows */}
          <div className="divide-y divide-theme-border/40 relative">
            {/* Red "TODAY" Line */}
            {todayPositionPercent !== null && (
              // A box exactly as wide as the timeline track (starts after the label
              // column; fixed pixel width when the canvas is not stretched, otherwise the
              // remaining width). Percent positions inside it therefore follow the zoom.
              // Measuring against the whole row instead put the line at the same pixel in
              // every zoom, because the row is always as wide as the screen while the
              // Quarter/Year canvas can be narrower.
              <div
                className={cn(
                  'absolute top-0 bottom-0 z-10 pointer-events-none left-96 sm:left-[480px]',
                  fillTimelineWidth && 'right-0'
                )}
                style={fillTimelineWidth ? undefined : { width: timelineCanvasWidth }}
              >
                <div
                  className="absolute top-0 bottom-0 flex flex-col items-center -translate-x-1/2"
                  style={{ left: `${todayPositionPercent}%` }}
                >
                  <div className="bg-rose-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-md shrink-0">
                    {t('gantt.canvas.today')}
                  </div>
                  <div className="w-[1.5px] flex-1 bg-rose-500/80 border-r border-dashed border-rose-500/60 shadow-xs" />
                </div>
              </div>
            )}

            {renderableRows.map((row) => (
              <GanttRow
                key={row.project.id}
                project={row.project}
                depth={row.depth}
                hasChildren={row.hasChildren}
                isExpanded={row.isExpanded}
                childCount={row.childCount}
                isSelected={row.project.id === selectedProjectId}
                timelineStart={timelineSpan.startDate.getTime()}
                timelineEnd={timelineSpan.endDate.getTime()}
                gridBackground={gridBackground}
                fillTimelineWidth={fillTimelineWidth}
                timelineCanvasWidth={timelineCanvasWidth}
                trackWidth={trackWidth}
                t={t}
                onSelectProject={onSelectProject}
                onToggleExpandProject={onToggleExpandProject}
                onHideProject={onHideProject}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
