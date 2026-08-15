import React, { useRef, useMemo } from 'react';
import {
  User,
  DollarSign,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import type { GanttProject, ProjectStatus } from '../../lib/project-management';
import {
  PROJECT_HEALTH_LABELS,
} from '../../lib/project-management';
import { cn } from '../../lib/utils';
import type { GanttZoomLevel } from './GanttFilterToolbar';

interface GanttRoadmapCanvasProps {
  projects: GanttProject[];
  zoomLevel: GanttZoomLevel;
  onSelectProject: (project: GanttProject) => void;
  selectedProjectId?: string | null;
}

interface TimelineSpan {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  columns: { label: string; subLabel?: string; startDate: Date; endDate: Date; days: number }[];
}

export const GanttRoadmapCanvas: React.FC<GanttRoadmapCanvasProps> = ({
  projects,
  zoomLevel,
  onSelectProject,
  selectedProjectId,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Compute overall timeline bounds across all projects or default to current year
  const timelineSpan = useMemo((): TimelineSpan => {
    const now = new Date();
    const currentYear = now.getFullYear();

    let minTime = new Date(currentYear, 0, 1).getTime();
    let maxTime = new Date(currentYear, 11, 31).getTime();

    // Check min & max dates among projects
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
  }, [projects, zoomLevel]);

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

  const getStatusBgColor = (status: ProjectStatus) => {
    switch (status) {
      case 'planning':
        return 'bg-blue-500 hover:bg-blue-600 border-blue-400';
      case 'in_progress':
        return 'bg-amber-500 hover:bg-amber-600 border-amber-400';
      case 'testing':
        return 'bg-purple-500 hover:bg-purple-600 border-purple-400';
      case 'completed':
        return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400';
      case 'on_hold':
        return 'bg-slate-500 hover:bg-slate-600 border-slate-400';
      default:
        return 'bg-indigo-500 hover:bg-indigo-600 border-indigo-400';
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
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-theme-text-muted">
                <FolderOpen size={14} className="text-indigo-500" />
                โครงการ / หัวหน้าทีม / สุขภาพ
              </span>
              <span className="text-[10px] text-theme-text-muted">({projects.length} รายการ)</span>
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

            {projects.map((p) => {
              const isSelected = p.id === selectedProjectId;
              const healthMeta = PROJECT_HEALTH_LABELS[p.project_health];

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
                    isSelected && 'bg-indigo-500/10'
                  )}
                >
                  {/* Left Sticky Column */}
                  <div className="w-80 sm:w-96 px-4 py-3 border-r border-theme-border/80 shrink-0 sticky left-0 z-10 bg-theme-surface/95 dark:bg-theme-bg-page/95 backdrop-blur-md flex flex-col justify-center gap-1.5 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-extrabold text-xs text-theme-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {p.project_name}
                      </span>
                      <ChevronRight size={14} className="text-theme-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      {/* Team / Holding Badges */}
                      <span className="px-2 py-0.5 rounded-md font-bold bg-theme-surface-secondary text-theme-text border border-theme-border/60">
                        {p.owner_team || 'IMP'}
                      </span>
                      {p.owner_holding && (
                        <span className="px-1.5 py-0.5 rounded-md font-semibold text-theme-text-muted border border-theme-border/40 truncate max-w-[90px]">
                          {p.owner_holding}
                        </span>
                      )}

                      {/* Health Indicator Badge */}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold border',
                          healthMeta.badge
                        )}
                      >
                        <span>{healthMeta.icon}</span>
                        <span>{healthMeta.label}</span>
                      </span>

                      {/* Head Lead Avatar/Name */}
                      <div className="inline-flex items-center gap-1 text-theme-text-muted ml-auto font-semibold">
                        <User size={11} className="text-indigo-500" />
                        <span className="truncate max-w-[80px]">
                          {p.head_lead_name || (p.team_contributions[0]?.user_name) || 'ยังไม่ระบุ'}
                        </span>
                      </div>
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
                      className="relative h-8 rounded-xl shadow-md flex items-center px-2.5 transition-all group-hover:scale-[1.01] overflow-hidden"
                      style={{
                        left: `${barStartPercent}%`,
                        width: `${barWidthPercent}%`,
                      }}
                    >
                      {/* Base Bar Fill */}
                      <div
                        className={cn(
                          'absolute inset-0 border transition-colors opacity-90',
                          getStatusBgColor(p.status)
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
                      <div className="relative z-10 flex items-center justify-between w-full text-white font-extrabold text-[11px] gap-2 min-w-0 drop-shadow-xs">
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
