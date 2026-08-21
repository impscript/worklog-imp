import React, { useState, useMemo, useCallback } from 'react';
import {
  FolderKanban,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  GanttProject,
  ProjectStatus,
  ProjectHealth,
} from '../../lib/project-management';
import {
  getProjectTypeMeta,
} from '../../lib/project-management';
import { ProjectKanbanColumn } from './ProjectKanbanColumn';

export type KanbanGroupBy = 'status' | 'health' | 'team' | 'type';
export type KanbanSwimlane = 'none' | 'parent';

interface ProjectKanbanCanvasProps {
  projects: GanttProject[];
  selectedYear?: number | 'all';
  groupBy: KanbanGroupBy;
  swimlane: KanbanSwimlane;
  onSelectProject: (project: GanttProject) => void;
  selectedProjectId?: string | null;
  onUpdateProjectStatus?: (projectId: string, newStatus: ProjectStatus) => Promise<void>;
  onUpdateProjectHealth?: (projectId: string, newHealth: ProjectHealth) => Promise<void>;
  onOpenCreateProject?: () => void;
}

interface ColumnConfig {
  key: string;
  title: string;
  dotColor: string;
  badgeColor: string;
}

export const ProjectKanbanCanvas: React.FC<ProjectKanbanCanvasProps> = ({
  projects,
  groupBy,
  swimlane,
  onSelectProject,
  selectedProjectId,
  onUpdateProjectStatus,
  onUpdateProjectHealth,
  onOpenCreateProject,
}) => {
  const { t } = useTranslation();

  // Collapsed columns state
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());

  // Collapsed swimlanes state
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());

  // Dragging state
  const [draggedProject, setDraggedProject] = useState<GanttProject | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Column definitions based on Group By
  const columns: ColumnConfig[] = useMemo(() => {
    if (groupBy === 'health') {
      return [
        {
          key: 'on_track',
          title: '🟢 On Track',
          dotColor: 'bg-emerald-500',
          badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        },
        {
          key: 'at_risk',
          title: '🟡 At Risk',
          dotColor: 'bg-amber-500',
          badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
        },
        {
          key: 'delayed',
          title: '🔴 Delayed',
          dotColor: 'bg-rose-500',
          badgeColor: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
        },
        {
          key: 'on_hold',
          title: '⏸️ On Hold',
          dotColor: 'bg-slate-400',
          badgeColor: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
        },
        {
          key: 'completed',
          title: '✅ Completed',
          dotColor: 'bg-blue-500',
          badgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
        },
      ];
    }

    if (groupBy === 'team') {
      const teams = new Set<string>(['IMP', 'IT', 'IMP&IT']);
      projects.forEach((p) => {
        if (p.owner_team) teams.add(p.owner_team);
      });
      return Array.from(teams).map((team) => ({
        key: team,
        title: `🏢 ${team}`,
        dotColor: 'bg-indigo-500',
        badgeColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      }));
    }

    if (groupBy === 'type') {
      const types = ['Project', 'Support MA', 'Support Go-Live', 'Upgrade', 'Management'];
      return types.map((type) => {
        const meta = getProjectTypeMeta(type);
        return {
          key: type,
          title: `${meta.icon} ${meta.label}`,
          dotColor: 'bg-indigo-500',
          badgeColor: meta.badge,
        };
      });
    }

    // Default: Group By Status (5 Stages)
    return [
      {
        key: 'planning',
        title: '📝 Planning / Backlog',
        dotColor: 'bg-blue-500',
        badgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
      },
      {
        key: 'in_progress',
        title: '⚡ In Progress',
        dotColor: 'bg-amber-500',
        badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
      },
      {
        key: 'testing',
        title: '🧪 Testing / QA',
        dotColor: 'bg-purple-500',
        badgeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
      },
      {
        key: 'completed',
        title: '✅ Completed / Realized',
        dotColor: 'bg-emerald-500',
        badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      },
      {
        key: 'on_hold',
        title: '⏸️ On Hold',
        dotColor: 'bg-slate-400',
        badgeColor: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
      },
    ];
  }, [groupBy, projects]);

  // Toggle Column Collapse
  const handleToggleColumnCollapse = (columnKey: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  // Toggle Swimlane Collapse
  const handleToggleSwimlaneCollapse = (laneId: string) => {
    setCollapsedSwimlanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) {
        next.delete(laneId);
      } else {
        next.add(laneId);
      }
      return next;
    });
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, project: GanttProject) => {
    setDraggedProject(project);
    e.dataTransfer.setData('text/plain', project.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedProject(null);
    setDragOverColumn(null);
  };

  const handleDragOverColumn = (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragLeaveColumn = (_e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    if (dragOverColumn === columnKey) {
      setDragOverColumn(null);
    }
  };

  const handleDropOnColumn = async (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    const projectId = e.dataTransfer.getData('text/plain') || draggedProject?.id;
    if (!projectId) return;

    const targetProject = projects.find((p) => p.id === projectId);
    if (!targetProject) return;

    if (groupBy === 'status') {
      if (targetProject.status === columnKey) return;
      await onUpdateProjectStatus?.(projectId, columnKey as ProjectStatus);
    } else if (groupBy === 'health') {
      if (targetProject.project_health === columnKey) return;
      await onUpdateProjectHealth?.(projectId, columnKey as ProjectHealth);
    }
  };

  // Quick Move Handlers (via Card menu)
  const handleQuickMoveStatus = useCallback(
    (projectId: string, newStatus: ProjectStatus) => {
      void onUpdateProjectStatus?.(projectId, newStatus);
    },
    [onUpdateProjectStatus]
  );

  const handleQuickMoveHealth = useCallback(
    (projectId: string, newHealth: ProjectHealth) => {
      void onUpdateProjectHealth?.(projectId, newHealth);
    },
    [onUpdateProjectHealth]
  );

  // Group Projects into Swimlanes
  const swimlanes = useMemo(() => {
    if (swimlane === 'parent') {
      // Group by Parent Project Name
      const lanesMap = new Map<string, { id: string; name: string; projects: GanttProject[] }>();

      // 1. Group items having parent_project_id
      projects.forEach((p) => {
        const laneKey = p.parent_project_id || 'root_standalone';
        const laneName = p.parent_name || (p.parent_project_id ? `Parent (${p.parent_project_id.slice(0, 6)})` : '🌟 Core Systems & Standalone Projects');

        if (!lanesMap.has(laneKey)) {
          lanesMap.set(laneKey, { id: laneKey, name: laneName, projects: [] });
        }
        lanesMap.get(laneKey)!.projects.push(p);
      });

      return Array.from(lanesMap.values()).sort((a, b) => {
        if (a.id === 'root_standalone') return -1;
        if (b.id === 'root_standalone') return 1;
        return a.name.localeCompare(b.name);
      });
    }

    // No Swimlane: Single flat lane
    return [{ id: 'all', name: '', projects }];
  }, [swimlane, projects]);

  // If no projects matching filters
  if (projects.length === 0) {
    return (
      <div className="p-16 text-center rounded-3xl border border-theme-border/60 bg-theme-surface/30 backdrop-blur-xs space-y-3">
        <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
          <FolderKanban size={28} />
        </div>
        <h3 className="text-base font-bold text-theme-text">
          {t('gantt.canvas.noProjects')}
        </h3>
        <p className="text-xs text-theme-text-muted max-w-md mx-auto">
          {t('gantt.canvas.noProjectsDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {swimlanes.map((lane) => {
        const isLaneCollapsed = collapsedSwimlanes.has(lane.id);

        // Aggregate stats for swimlane header
        const laneSavings = lane.projects.reduce((sum, p) => sum + (p.total_savings_annual || 0), 0);
        const laneHours = lane.projects.reduce((sum, p) => sum + (p.total_worklog_hours || 0), 0);

        let savingsStr = '฿0';
        if (laneSavings >= 1_000_000) {
          savingsStr = `฿${(laneSavings / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
        } else if (laneSavings >= 1_000) {
          savingsStr = `฿${(laneSavings / 1_000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
        } else if (laneSavings > 0) {
          savingsStr = `฿${laneSavings.toLocaleString()}`;
        }

        return (
          <div key={lane.id} className="space-y-3">
            {/* Swimlane Header (only shown if swimlane mode is active) */}
            {swimlane !== 'none' && (
              <div
                onClick={() => handleToggleSwimlaneCollapse(lane.id)}
                className="flex items-center justify-between p-3 rounded-2xl bg-theme-surface/70 hover:bg-theme-surface border border-theme-border/70 cursor-pointer transition-all duration-200 select-none shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button type="button" className="p-0.5 text-theme-text-muted">
                    {isLaneCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <FolderOpen size={16} className="text-indigo-500 shrink-0" />
                  <h3 className="text-sm font-extrabold text-theme-text truncate">
                    {lane.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-theme-surface-secondary text-theme-text-secondary border border-theme-border/60">
                    {lane.projects.length} {t('gantt.kpi.projectsUnit')}
                  </span>
                </div>

                {/* Swimlane Summary Badges */}
                <div className="flex items-center gap-2">
                  {laneSavings > 0 && (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-1">
                      <DollarSign size={12} className="text-emerald-500" />
                      <span>{savingsStr}/yr</span>
                    </span>
                  )}
                  {laneHours > 0 && (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-1">
                      <Clock size={12} className="text-indigo-500" />
                      <span>{Math.round(laneHours * 10) / 10}h</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Swimlane Columns Board */}
            {!isLaneCollapsed && (
              <div className="overflow-x-auto pb-4 pt-1">
                <div className="flex items-start gap-4 min-w-max">
                  {columns.map((col) => {
                    // Filter projects belonging to this column
                    const colProjects = lane.projects.filter((p) => {
                      if (groupBy === 'health') return p.project_health === col.key;
                      if (groupBy === 'team') return (p.owner_team || 'IMP') === col.key;
                      if (groupBy === 'type') return (p.worklog_project_type || 'Project') === col.key;
                      return p.status === col.key;
                    });

                    return (
                      <ProjectKanbanColumn
                        key={`${lane.id}-${col.key}`}
                        columnKey={col.key}
                        title={col.title}
                        dotColor={col.dotColor}
                        badgeColor={col.badgeColor}
                        projects={colProjects}
                        isCollapsed={collapsedColumns.has(col.key)}
                        onToggleCollapse={handleToggleColumnCollapse}
                        groupBy={groupBy}
                        onSelectProject={onSelectProject}
                        selectedProjectId={selectedProjectId}
                        onQuickMoveStatus={handleQuickMoveStatus}
                        onQuickMoveHealth={handleQuickMoveHealth}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOverColumn={handleDragOverColumn}
                        onDragLeaveColumn={handleDragLeaveColumn}
                        onDropOnColumn={handleDropOnColumn}
                        isDragOver={dragOverColumn === col.key}
                        draggedProjectId={draggedProject?.id}
                        onOpenCreateProject={onOpenCreateProject}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
