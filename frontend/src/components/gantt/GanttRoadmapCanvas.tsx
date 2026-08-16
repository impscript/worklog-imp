import React, { useRef, useMemo } from 'react';
import {
  User,
  DollarSign,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderTree,
  Layers,
} from 'lucide-react';
import type { GanttProject, ProjectStatus } from '../../lib/project-management';
import {
  PROJECT_HEALTH_LABELS,
  TEAM_ROLE_LABELS,
  buildGanttTree,
  getUserAvatarUrl,
  getUiAvatarFallbackUrl,
  getProjectTypeMeta,
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

export const GanttRoadmapCanvas: React.FC<GanttRoadmapCanvasProps> = ({
  projects,
  zoomLevel,
  selectedYear = 'all',
  isTreeView,
  expandedProjectIds,
  onToggleExpandProject,
  onSelectProject,
  selectedProjectId,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    if (zoomLevel === 'month') {
      const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (cur <= endDate) {
        const colStart = new Date(cur);
        const colEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        const days = Math.round((colEnd.getTime() - colStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const monthName = colStart.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
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
  }, [projects, zoomLevel, selectedYear]);

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

  // Pixel widths per day depending on zoom
  const dayWidthPx = zoomLevel === 'month' ? 4.5 : zoomLevel === 'quarter' ? 2.5 : 1.2;
  const timelineCanvasWidth = Math.max(800, timelineSpan.totalDays * dayWidthPx);

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
    const rows: RenderableGanttRow[] = [];

    const traverse = (node: GanttProject, depth: number) => {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isExpanded = expandedProjectIds.has(node.id);
      const childCount = node.children ? node.children.length : 0;

      rows.push({
        project: node,
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

  const getStatusBgColor = (status: ProjectStatus, depth: number) => {
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
  };

  if (projects.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl border border-dashed border-theme-border/80 bg-theme-surface/40 text-theme-text-muted space-y-3">
        <FolderOpen size={36} className="mx-auto opacity-30 text-indigo-500" />
        <h3 className="font-bold text-sm text-theme-text">ไม่พบโครงการตามเงื่อนไขที่เลือก</h3>
        <p className="text-xs max-w-sm mx-auto">
          ลองปรับตัวกรองทีม Holding หรือค้นหาด้วยคำค้นอื่น เพื่อแสดงแผนภูมิแกนต์
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-theme-border/80 bg-theme-surface/90 dark:bg-theme-bg-page/80 backdrop-blur-xl shadow-xl overflow-hidden flex flex-col select-none">
      {/* Scrollable Container with Sticky Left Column */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto custom-scrollbar flex-1 relative max-h-[70vh] overflow-y-auto"
      >
        <div className="min-w-fit flex flex-col">
          {/* Header Row */}
          <div className="flex border-b border-theme-border/80 bg-theme-surface-secondary/70 backdrop-blur-md sticky top-0 z-20 text-xs font-bold text-theme-text">
            {/* Frozen Left Header */}
            <div className="w-80 sm:w-96 px-4 py-3 border-r border-theme-border/80 shrink-0 sticky left-0 z-30 bg-theme-surface-secondary/90 backdrop-blur-md flex items-center justify-between shadow-xs">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-theme-text-muted font-black">
                <FolderTree size={14} className="text-indigo-500" />
                {isTreeView ? 'โครงสร้างโครงการ (Parent > Child)' : 'โครงการ / หัวหน้าทีม / สุขภาพ'}
              </span>
              <span className="text-[10px] text-theme-text-muted">({renderableRows.length} รายการ)</span>
            </div>

            {/* Timeline Scale Headers */}
            <div className="flex relative" style={{ width: timelineCanvasWidth }}>
              {timelineSpan.columns.map((col, idx) => (
                <div
                  key={idx}
                  className="px-2 py-3 text-center border-r border-theme-border/40 truncate shrink-0 flex flex-col justify-center"
                  style={{ width: `${(col.days / timelineSpan.totalDays) * 100}%` }}
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
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
                style={{
                  left: `calc( ${384}px + (${timelineCanvasWidth}px * ${todayPositionPercent / 100}) )`,
                }}
              >
                <div className="bg-rose-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-md shrink-0 -translate-x-1/2">
                  วันนี้
                </div>
                <div className="w-[1.5px] flex-1 bg-rose-500/80 border-r border-dashed border-rose-500/60 shadow-xs" />
              </div>
            )}

            {renderableRows.map(({ project: p, depth, hasChildren, isExpanded, childCount }) => {
              const isSelected = p.id === selectedProjectId;
              const healthMeta = PROJECT_HEALTH_LABELS[p.project_health];
              const isChild = depth > 0;

              // Calculate Gantt Bar Offset and Width
              const startTime = p.start_date
                ? new Date(p.start_date).getTime()
                : timelineSpan.startDate.getTime();
              const dueTime = p.due_date
                ? new Date(p.due_date).getTime()
                : startTime + 30 * 86400000; // default 30 days if no due date

              const timelineStart = timelineSpan.startDate.getTime();
              const timelineEnd = timelineSpan.endDate.getTime();
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

              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p)}
                  className={cn(
                    'flex items-stretch hover:bg-indigo-500/5 transition-colors cursor-pointer group',
                    isSelected && 'bg-indigo-500/10',
                    isChild && 'bg-slate-50/40 dark:bg-slate-900/20'
                  )}
                >
                  {/* Left Sticky Column */}
                  <div className="w-88 sm:w-[410px] px-3.5 py-2 border-r border-theme-border/80 shrink-0 sticky left-0 z-10 bg-theme-surface/95 dark:bg-theme-bg-page/95 backdrop-blur-md flex flex-col justify-center gap-1.5 shadow-xs">
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
                          className={cn(
                            'truncate transition-colors',
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
                        <div
                          className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-theme-text select-none cursor-default"
                          title={`👑 หัวหน้าโครงการ (Lead): ${p.head_lead_name}`}
                        >
                          <div className="w-4.5 h-4.5 rounded-full overflow-hidden ring-1 ring-amber-400/80 shadow-xs shrink-0 bg-slate-200 dark:bg-slate-700">
                            <img
                              src={getUserAvatarUrl(p.head_lead_name, p.head_lead_emp_id)}
                              alt={p.head_lead_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = getUiAvatarFallbackUrl(p.head_lead_name, 'f59e0b');
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 truncate max-w-[85px]">
                            {p.head_lead_name.split(/\s+/)[0]}
                          </span>
                        </div>
                      ) : (
                        <div
                          className="text-[9px] font-medium text-theme-text-muted/50 shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-dashed border-theme-border/50 select-none"
                          title="ยังไม่ได้กำหนดหัวหน้าโครงการ"
                        >
                          <User size={9} />
                          <span>ยังไม่ระบุ Lead</span>
                        </div>
                      )}
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
                            <span>{childCount} โมดูลย่อย</span>
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
                              title={`ประเภทงาน: ${typeMeta.label}`}
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
                      </div>

                      {/* Team Overlapping Avatar Stack */}
                      {p.team_contributions.length > 0 ? (
                        <div
                          className="flex items-center -space-x-1.5 shrink-0 pl-1 select-none"
                          title={`ทีมงาน (${p.team_contributions.length} คน):\n${p.team_contributions.map(t => `${t.user_name} (${t.target_contribution_percent}%)`).join('\n')}`}
                        >
                          {p.team_contributions.slice(0, 3).map((tm, tIdx) => (
                            <div
                              key={tIdx}
                              className="w-5 h-5 rounded-full overflow-hidden ring-1.5 ring-theme-surface dark:ring-theme-bg-page shadow-xs shrink-0 bg-slate-200 dark:bg-slate-700 cursor-default"
                              title={`${tm.user_name} (${TEAM_ROLE_LABELS[tm.role_in_project] || tm.role_in_project}, Target: ${tm.target_contribution_percent}%)`}
                            >
                              <img
                                src={getUserAvatarUrl(tm.user_name, tm.emp_id)}
                                alt={tm.user_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = getUiAvatarFallbackUrl(tm.user_name, '6366f1');
                                }}
                              />
                            </div>
                          ))}
                          {p.team_contributions.length > 3 && (
                            <div
                              className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-[8px] ring-1.5 ring-theme-surface dark:ring-theme-bg-page shadow-xs shrink-0 cursor-default"
                              title={`และสมาชิกอีก ${p.team_contributions.length - 3} คน`}
                            >
                              +{p.team_contributions.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[9px] text-theme-text-muted/50 shrink-0">
                          ยังไม่มีทีม
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Timeline Canvas Track */}
                  <div
                    className="relative flex items-center py-2 px-1"
                    style={{ width: timelineCanvasWidth }}
                  >
                    {/* Background Column Grid Lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {timelineSpan.columns.map((col, idx) => (
                        <div
                          key={idx}
                          className="border-r border-theme-border/20 h-full"
                          style={{ width: `${(col.days / timelineSpan.totalDays) * 100}%` }}
                        />
                      ))}
                    </div>

                    {/* Gantt Bar */}
                    <div
                      className={cn(
                        'relative rounded-xl shadow-md flex items-center px-2.5 transition-all group-hover:scale-[1.01] overflow-hidden',
                        isChild ? 'h-6.5' : 'h-8'
                      )}
                      style={{
                        left: `${barStartPercent}%`,
                        width: `${barWidthPercent}%`,
                      }}
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

                      {/* Milestone Diamonds / Ticks */}
                      {p.milestones.length > 0 && (
                        <div className="absolute inset-y-0 right-2 flex items-center gap-1 z-10">
                          {p.milestones.slice(0, 3).map((m, mIdx) => (
                            <div
                              key={mIdx}
                              title={`Milestone: ${m.milestone_name} (${m.status})`}
                              className={cn(
                                'w-2 h-2 rotate-45 border border-white shadow-xs',
                                m.status === 'completed' ? 'bg-emerald-300' : 'bg-white/80'
                              )}
                            />
                          ))}
                        </div>
                      )}

                      {/* Bar Content Label */}
                      <div className="relative z-10 flex items-center justify-between w-full text-white font-extrabold text-[10.5px] gap-2 min-w-0 drop-shadow-xs">
                        <span className="truncate">
                          {p.status.toUpperCase()} · {p.progress_percent}%
                        </span>

                        {p.total_savings_annual > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-950/40 text-emerald-200 border border-emerald-400/40 text-[9px] font-mono shrink-0">
                            <DollarSign size={10} />
                            <span>{(p.total_savings_annual / 1000).toFixed(0)}k/ปี</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
