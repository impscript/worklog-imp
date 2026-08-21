import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  DollarSign,
  Calendar,
  MoreVertical,
  FolderOpen,
  ArrowRightLeft,
  CheckCircle2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  GanttProject,
  ProjectStatus,
  ProjectHealth,
} from '../../lib/project-management';
import {
  PROJECT_HEALTH_LABELS,
  getUserAvatarUrl,
  getProjectTypeMeta,
} from '../../lib/project-management';
import { cn } from '../../lib/utils';

interface ProjectKanbanCardProps {
  project: GanttProject;
  onSelectProject: (project: GanttProject) => void;
  isSelected?: boolean;
  groupBy: 'status' | 'health' | 'team' | 'type';
  onQuickMoveStatus?: (projectId: string, newStatus: ProjectStatus) => void;
  onQuickMoveHealth?: (projectId: string, newHealth: ProjectHealth) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, project: GanttProject) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}

export const ProjectKanbanCard: React.FC<ProjectKanbanCardProps> = ({
  project,
  onSelectProject,
  isSelected = false,
  groupBy,
  onQuickMoveStatus,
  onQuickMoveHealth,
  onDragStart,
  onDragEnd,
  isDragging = false,
}) => {
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const typeMeta = getProjectTypeMeta(project.worklog_project_type);
  const healthMeta = PROJECT_HEALTH_LABELS[project.project_health] || PROJECT_HEALTH_LABELS.on_track;

  // Format currency savings nicely
  const formattedSavings = React.useMemo(() => {
    const val = project.total_savings_annual || 0;
    if (val <= 0) return null;
    if (val >= 1_000_000) {
      return `฿${(val / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
    }
    if (val >= 1_000) {
      return `฿${(val / 1_000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
    }
    return `฿${val.toLocaleString()}`;
  }, [project.total_savings_annual]);

  // Milestone stats
  const milestoneStats = React.useMemo(() => {
    if (!project.milestones || project.milestones.length === 0) return null;
    const completed = project.milestones.filter((m) => m.status === 'completed').length;
    return {
      completed,
      total: project.milestones.length,
      percent: Math.round((completed / project.milestones.length) * 100),
    };
  }, [project.milestones]);

  // Format due date & check overdue
  const dueDateInfo = React.useMemo(() => {
    if (!project.due_date) return null;
    const due = new Date(project.due_date);
    if (isNaN(due.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = due < today && project.status !== 'completed';
    const isDueSoon = !isOverdue && due.getTime() - today.getTime() <= 7 * 24 * 60 * 60 * 1000 && project.status !== 'completed';

    const locale = i18n.language === 'en' ? 'en-US' : 'th-TH';
    const dateStr = due.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });

    return { dateStr, isOverdue, isDueSoon };
  }, [project.due_date, project.status, i18n.language]);

  // Status transitions list for Quick Move
  const allStatuses: { key: ProjectStatus; label: string }[] = [
    { key: 'planning', label: 'Planning' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'testing', label: 'Testing / UAT' },
    { key: 'completed', label: 'Completed' },
    { key: 'on_hold', label: 'On Hold' },
  ];

  // Health transitions list for Quick Move
  const allHealths: { key: ProjectHealth; label: string; icon: string }[] = [
    { key: 'on_track', label: 'On Track', icon: '🟢' },
    { key: 'at_risk', label: 'At Risk', icon: '🟡' },
    { key: 'delayed', label: 'Delayed', icon: '🔴' },
    { key: 'on_hold', label: 'On Hold', icon: '⏸️' },
    { key: 'completed', label: 'Completed', icon: '✅' },
  ];

  // Distinct team members list for avatar stack (including lead first, then other unique contributors)
  const avatarStackList = React.useMemo(() => {
    const list: { name: string; empId?: string | null; role: string; isLead: boolean }[] = [];
    const seenNames = new Set<string>();

    // 1. Add Lead first (if exists)
    if (project.head_lead_name) {
      list.push({
        name: project.head_lead_name,
        empId: project.head_lead_emp_id,
        role: 'Lead',
        isLead: true,
      });
      seenNames.add(project.head_lead_name.trim().toLowerCase());
    }

    // 2. Add Contributors (excluding duplicate lead)
    if (project.team_contributions) {
      project.team_contributions.forEach((tm) => {
        if (!tm.user_name) return;
        const lower = tm.user_name.trim().toLowerCase();
        if (!seenNames.has(lower)) {
          seenNames.add(lower);
          list.push({
            name: tm.user_name,
            empId: tm.emp_id,
            role: tm.role_in_project || 'Member',
            isLead: false,
          });
        }
      });
    }

    return list;
  }, [project.head_lead_name, project.head_lead_emp_id, project.team_contributions]);

  const maxVisibleAvatars = 4;
  const visibleAvatars = avatarStackList.slice(0, maxVisibleAvatars);
  const remainingCount = Math.max(0, avatarStackList.length - maxVisibleAvatars);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, project)}
      onDragEnd={onDragEnd}
      onClick={() => onSelectProject(project)}
      className={cn(
        'group relative rounded-2xl border p-4 transition-all duration-200 cursor-grab active:cursor-grabbing select-none',
        'bg-theme-surface hover:bg-theme-surface-secondary/70 shadow-xs hover:shadow-md',
        isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
          : 'border-theme-border/70 hover:border-indigo-500/40',
        isDragging && 'opacity-40 scale-[0.98] border-dashed border-indigo-500 ring-1 ring-indigo-500'
      )}
    >
      {/* Card Header: Type & Slug + Health Badge + Quick Menu */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Project Type Badge */}
          <span
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 inline-flex items-center gap-1',
              typeMeta.badge
            )}
          >
            <span>{typeMeta.icon}</span>
            <span>{typeMeta.label}</span>
          </span>

          {/* Project Code / Slug (if available) */}
          {project.project_slug ? (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-theme-surface-secondary text-theme-text-muted border border-theme-border/50 truncate max-w-[100px]">
              {project.project_slug}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-theme-surface-secondary text-theme-text-muted border border-theme-border/50">
              #{project.id.slice(0, 6)}
            </span>
          )}
        </div>

        {/* Right side: Health Badge & Quick Action Button */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Health Pulse Indicator */}
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1.5',
              healthMeta.badge
            )}
            title={`Health: ${healthMeta.label}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {project.project_health === 'at_risk' || project.project_health === 'delayed' ? (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              ) : null}
              <span
                className={cn(
                  'relative inline-flex rounded-full h-1.5 w-1.5',
                  project.project_health === 'on_track' && 'bg-emerald-500',
                  project.project_health === 'at_risk' && 'bg-amber-500',
                  project.project_health === 'delayed' && 'bg-rose-500',
                  project.project_health === 'on_hold' && 'bg-slate-400',
                  project.project_health === 'completed' && 'bg-blue-500'
                )}
              />
            </span>
            <span className="hidden sm:inline">{healthMeta.label}</span>
          </span>

          {/* Quick Action Move Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((prev) => !prev);
              }}
              className="p-1 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
              title={t('gantt.kanban.quickMove')}
            >
              <MoreVertical size={14} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-theme-border bg-theme-surface p-1.5 shadow-xl z-50 animate-fade-in text-xs"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-theme-text-muted tracking-wider border-b border-theme-border/50 mb-1 flex items-center gap-1">
                  <ArrowRightLeft size={11} />
                  <span>{groupBy === 'health' ? t('gantt.kanban.groupByHealth') : t('gantt.kanban.quickMove')}</span>
                </div>

                {groupBy === 'health'
                  ? allHealths.map((h) => (
                      <button
                        key={h.key}
                        type="button"
                        onClick={() => {
                          onQuickMoveHealth?.(project.id, h.key);
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors font-medium cursor-pointer',
                          project.project_health === h.key
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'hover:bg-theme-surface-secondary text-theme-text'
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{h.icon}</span>
                          <span>{h.label}</span>
                        </span>
                        {project.project_health === h.key && <CheckCircle2 size={12} className="text-indigo-500" />}
                      </button>
                    ))
                  : allStatuses.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          onQuickMoveStatus?.(project.id, s.key);
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors font-medium cursor-pointer',
                          project.status === s.key
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'hover:bg-theme-surface-secondary text-theme-text'
                        )}
                      >
                        <span>{s.label}</span>
                        {project.status === s.key && <CheckCircle2 size={12} className="text-indigo-500" />}
                      </button>
                    ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Title */}
      <h3 className="text-sm font-bold text-theme-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 transition-colors mb-1">
        {project.project_name}
      </h3>

      {/* Parent System Tag (if subproject) */}
      {project.parent_name && (
        <div className="flex items-center gap-1 text-[11px] font-medium text-theme-text-muted mb-2 truncate">
          <FolderOpen size={12} className="text-indigo-400 shrink-0" />
          <span className="truncate">{project.parent_name}</span>
        </div>
      )}

      {/* Description Snippet (if available) */}
      {project.description && !project.parent_name && (
        <p className="text-[11px] text-theme-text-muted line-clamp-1 mb-2 font-normal">
          {project.description}
        </p>
      )}

      {/* Progress & Milestone Bar */}
      <div className="space-y-1 my-2.5">
        <div className="flex items-center justify-between text-[10px] font-semibold text-theme-text-secondary">
          <div className="flex items-center gap-1.5">
            <span>{project.progress_percent || 0}%</span>
            {milestoneStats && (
              <span className="text-theme-text-muted font-normal">
                • 🚩 {milestoneStats.completed}/{milestoneStats.total} {t('gantt.kanban.cardMilestones')}
              </span>
            )}
          </div>
          {project.owner_team && (
            <span className="px-1.5 py-0.2 rounded bg-theme-surface-secondary text-[10px] font-bold text-theme-text-muted border border-theme-border/40">
              {project.owner_team}
            </span>
          )}
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-theme-border/60 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              project.status === 'completed'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : project.project_health === 'delayed'
                ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500'
            )}
            style={{ width: `${Math.min(100, Math.max(0, project.progress_percent || 0))}%` }}
          />
        </div>
      </div>

      {/* Value Realization & Worklog Metric Badges */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-theme-border/40 text-[11px]">
        {/* Cost Savings Badge */}
        {formattedSavings ? (
          <span
            className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-bold inline-flex items-center gap-1"
            title={`${t('gantt.kanban.cardSavings')}: ฿${project.total_savings_annual.toLocaleString()}/year`}
          >
            <DollarSign size={11} className="text-emerald-500" />
            <span>{formattedSavings}/yr</span>
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-lg bg-theme-surface-secondary text-theme-text-muted border border-theme-border/40 font-medium text-[10px] inline-flex items-center gap-1">
            <DollarSign size={10} />
            <span>0/yr</span>
          </span>
        )}

        {/* Logged Worklog Hours Badge */}
        <span
          className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-semibold inline-flex items-center gap-1"
          title={`${t('gantt.kanban.cardWorklog')}: ${project.total_worklog_hours.toLocaleString()} hrs`}
        >
          <Clock size={11} className="text-indigo-500" />
          <span>{project.total_worklog_hours > 0 ? `${project.total_worklog_hours.toLocaleString()}h` : '0h'}</span>
        </span>
      </div>

      {/* Card Footer: Overlapping Avatar Stack (Lead + Contributors) + Due Date */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-theme-border/50">
        {/* Left: Overlapping Avatar Stack */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center -space-x-2 hover:-space-x-1 transition-all duration-200 shrink-0">
            {visibleAvatars.map((member, idx) => {
              const cleanShortName = member.name.split(' ')[0];
              return (
                <div
                  key={`${member.name}-${idx}`}
                  className="relative group/avatar"
                  title={`${member.isLead ? '👑 ' : ''}${member.name} (${member.role})`}
                  style={{ zIndex: visibleAvatars.length - idx }}
                >
                  <img
                    src={getUserAvatarUrl(member.name, member.empId)}
                    alt={member.name}
                    className={cn(
                      'w-7 h-7 rounded-full object-cover border-2 border-theme-surface shadow-xs transition-transform duration-150 hover:scale-115 hover:z-30 cursor-pointer',
                      member.isLead ? 'ring-1.5 ring-indigo-500' : 'ring-1 ring-theme-border/80'
                    )}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanShortName)}&background=6366f1&color=fff&bold=true`;
                    }}
                  />
                  {member.isLead && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white dark:border-zinc-900 flex items-center justify-center text-[7px] text-white"
                      title="Project Lead"
                    >
                      ★
                    </span>
                  )}
                </div>
              );
            })}

            {/* Remaining Count Badge */}
            {remainingCount > 0 && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black bg-theme-surface-secondary text-theme-text border-2 border-theme-surface ring-1 ring-theme-border/80 shadow-xs z-0"
                title={`${remainingCount} more team members`}
              >
                +{remainingCount}
              </div>
            )}
          </div>

          {/* Lead Name (short) if only 1 avatar */}
          {avatarStackList.length === 1 && project.head_lead_name && (
            <span className="text-[11px] font-semibold text-theme-text-secondary truncate max-w-[100px]">
              {project.head_lead_name.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Right: Due Date Badge */}
        {dueDateInfo && (
          <div
            className={cn(
              'px-2 py-0.5 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 shrink-0',
              dueDateInfo.isOverdue
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                : dueDateInfo.isDueSoon
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-theme-surface-secondary text-theme-text-secondary border-theme-border/60'
            )}
            title={
              dueDateInfo.isOverdue
                ? `${t('gantt.kanban.cardOverdue')}: ${dueDateInfo.dateStr}`
                : `${t('gantt.kanban.cardDue')}: ${dueDateInfo.dateStr}`
            }
          >
            <Calendar size={11} className={dueDateInfo.isOverdue ? 'text-rose-500' : 'text-theme-text-muted'} />
            <span>{dueDateInfo.dateStr}</span>
          </div>
        )}
      </div>
    </div>
  );
};
