import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  DollarSign,
  Layers,
  Inbox,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  GanttProject,
  ProjectStatus,
  ProjectHealth,
} from '../../lib/project-management';
import { ProjectKanbanCard } from './ProjectKanbanCard';
import { cn } from '../../lib/utils';

interface ProjectKanbanColumnProps {
  columnKey: string;
  title: string;
  dotColor?: string;
  badgeColor?: string;
  projects: GanttProject[];
  isCollapsed?: boolean;
  onToggleCollapse?: (columnKey: string) => void;
  groupBy: 'status' | 'health' | 'team' | 'type';
  onSelectProject: (project: GanttProject) => void;
  selectedProjectId?: string | null;
  onQuickMoveStatus?: (projectId: string, newStatus: ProjectStatus) => void;
  onQuickMoveHealth?: (projectId: string, newHealth: ProjectHealth) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, project: GanttProject) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOverColumn?: (e: React.DragEvent<HTMLDivElement>, columnKey: string) => void;
  onDragLeaveColumn?: (e: React.DragEvent<HTMLDivElement>, columnKey: string) => void;
  onDropOnColumn?: (e: React.DragEvent<HTMLDivElement>, columnKey: string) => void;
  isDragOver?: boolean;
  draggedProjectId?: string | null;
  onOpenCreateProject?: () => void;
}

export const ProjectKanbanColumn: React.FC<ProjectKanbanColumnProps> = ({
  columnKey,
  title,
  dotColor = 'bg-slate-400',
  projects,
  isCollapsed = false,
  onToggleCollapse,
  groupBy,
  onSelectProject,
  selectedProjectId,
  onQuickMoveStatus,
  onQuickMoveHealth,
  onDragStart,
  onDragEnd,
  onDragOverColumn,
  onDragLeaveColumn,
  onDropOnColumn,
  isDragOver = false,
  draggedProjectId,
  onOpenCreateProject,
}) => {
  const { t } = useTranslation();

  // Aggregate stats for column header
  const { totalSavingsFormatted } = useMemo(() => {
    let savingsSum = 0;

    projects.forEach((p) => {
      savingsSum += p.total_savings_annual || 0;
    });

    let savingsStr = '฿0';
    if (savingsSum >= 1_000_000) {
      savingsStr = `฿${(savingsSum / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
    } else if (savingsSum >= 1_000) {
      savingsStr = `฿${(savingsSum / 1_000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
    } else if (savingsSum > 0) {
      savingsStr = `฿${savingsSum.toLocaleString()}`;
    }

    return {
      totalSavingsFormatted: savingsStr,
    };
  }, [projects]);

  // Collapsed Column View
  if (isCollapsed) {
    return (
      <div
        onClick={() => onToggleCollapse?.(columnKey)}
        className="w-12 shrink-0 bg-theme-surface/60 hover:bg-theme-surface-secondary/80 border border-theme-border/70 rounded-3xl p-3 flex flex-col items-center justify-between cursor-pointer transition-all duration-200 min-h-[500px] select-none group"
        title={`${title} (${projects.length}) - ${t('gantt.kanban.expandCol')}`}
      >
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-theme-surface text-theme-text-muted group-hover:text-theme-text transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <span className={cn('w-2.5 h-2.5 rounded-full', dotColor)} />
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-theme-surface-secondary text-theme-text border border-theme-border/60">
            {projects.length}
          </span>
        </div>

        {/* Vertical Text for Title */}
        <div className="writing-vertical-lr rotate-180 text-xs font-bold text-theme-text-secondary tracking-wider uppercase py-4">
          {title}
        </div>

        <div className="flex flex-col items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <DollarSign size={13} />
        </div>
      </div>
    );
  }

  // Normal Expanded Column View
  return (
    <div
      onDragOver={(e) => onDragOverColumn?.(e, columnKey)}
      onDragLeave={(e) => onDragLeaveColumn?.(e, columnKey)}
      onDrop={(e) => onDropOnColumn?.(e, columnKey)}
      className={cn(
        'w-[300px] sm:w-[320px] lg:w-[340px] shrink-0 rounded-3xl border flex flex-col transition-all duration-200',
        'bg-theme-surface/50 dark:bg-theme-bg-page/50 backdrop-blur-xs',
        isDragOver
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-lg'
          : 'border-theme-border/70 hover:border-theme-border'
      )}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-theme-border/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status Dot / Icon */}
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColor)} />

          {/* Title */}
          <h2 className="text-xs font-extrabold text-theme-text uppercase tracking-wider truncate">
            {title}
          </h2>

          {/* Projects Count Pill */}
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-theme-surface-secondary text-theme-text-secondary border border-theme-border/60 shrink-0">
            {projects.length}
          </span>
        </div>

        {/* Right side: Savings Total Badge & Collapse Button */}
        <div className="flex items-center gap-1 shrink-0">
          {totalSavingsFormatted !== '฿0' && (
            <span
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-0.5"
              title={`${t('gantt.kanban.totalPipelineSavings')}: ${totalSavingsFormatted}`}
            >
              <DollarSign size={10} className="text-emerald-500" />
              <span>{totalSavingsFormatted}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => onToggleCollapse?.(columnKey)}
            className="p-1 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            title={t('gantt.kanban.collapseCol')}
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Cards List Container */}
      <div className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[400px]">
        {/* Drop Zone Placeholder when Dragging Over */}
        {isDragOver && (
          <div className="p-3 rounded-2xl border-2 border-dashed border-indigo-500 bg-indigo-500/10 text-center animate-pulse text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-2">
            <Layers size={14} />
            <span>{t('gantt.kanban.dropHere')}</span>
          </div>
        )}

        {/* Project Cards */}
        {projects.map((project) => (
          <ProjectKanbanCard
            key={project.id}
            project={project}
            onSelectProject={onSelectProject}
            isSelected={selectedProjectId === project.id}
            groupBy={groupBy}
            onQuickMoveStatus={onQuickMoveStatus}
            onQuickMoveHealth={onQuickMoveHealth}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggedProjectId === project.id}
          />
        ))}

        {/* Empty State */}
        {projects.length === 0 && !isDragOver && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-theme-border/50 rounded-2xl my-2">
            <Inbox size={28} className="text-theme-text-muted mb-2 opacity-50" />
            <p className="text-xs font-semibold text-theme-text-muted">
              {t('gantt.kanban.emptyColumn')}
            </p>
          </div>
        )}
      </div>

      {/* Column Footer: Quick Add Project (if callback provided) */}
      {onOpenCreateProject && (
        <div className="p-2.5 border-t border-theme-border/40 bg-theme-surface/30">
          <button
            type="button"
            onClick={onOpenCreateProject}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-theme-border hover:border-indigo-500/50 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 text-theme-text-muted hover:text-indigo-600 dark:hover:text-indigo-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={13} />
            <span>{t('gantt.filters.createProject')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
