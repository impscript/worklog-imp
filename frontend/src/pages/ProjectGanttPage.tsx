import { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useNotification } from '../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type {
  GanttProject,
  ProjectStatus,
  ProjectHealth,
} from '../lib/project-management';
import {
  fetchGanttProjects,
  isProjectInYear,
  getAvailableProjectYears,
} from '../lib/project-management';
import { ExecutiveSummaryKPIs } from '../components/gantt/ExecutiveSummaryKPIs';
import {
  GanttFilterToolbar,
  type GanttZoomLevel,
  type PortfolioViewMode,
} from '../components/gantt/GanttFilterToolbar';
import { GanttRoadmapCanvas } from '../components/gantt/GanttRoadmapCanvas';
import {
  ProjectKanbanCanvas,
  type KanbanGroupBy,
  type KanbanSwimlane,
} from '../components/kanban/ProjectKanbanCanvas';
import { ProjectDetailDrawer } from '../components/gantt/ProjectDetailDrawer';
import { FolderKanban, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProjectGanttPage() {
  const { t } = useTranslation();
  const { showToast } = useNotification();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<GanttProject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string; email?: string; emp_id?: string }[]>([]);

  // View Mode & Kanban States
  const [viewMode, setViewMode] = useState<PortfolioViewMode>('gantt');
  const [kanbanGroupBy, setKanbanGroupBy] = useState<KanbanGroupBy>('status');
  const [kanbanSwimlane, setKanbanSwimlane] = useState<KanbanSwimlane>('none');

  // Filter & Hierarchy State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedHoldings, setSelectedHoldings] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ProjectStatus[]>([]);
  const [selectedHealths, setSelectedHealths] = useState<ProjectHealth[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showParentsOnly, setShowParentsOnly] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<GanttZoomLevel>('month');
  const [isTreeView, setIsTreeView] = useState<boolean>(true);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());

  // Projects hidden from this executive report. Backed by the `is_hidden_from_gantt`
  // column on tb_project_registry, so the hidden state is shared by everyone who
  // opens this page and survives a refresh — like hiding a row in a spreadsheet —
  // without touching any of the project's real data.
  const hiddenProjectIds = useMemo(
    () => new Set(projects.filter((p) => p.is_hidden_from_gantt).map((p) => p.id)),
    [projects]
  );

  // Reset All Filters Helper
  const handleResetAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedYear(new Date().getFullYear());
    setSelectedProjectTypes([]);
    setSelectedTeams([]);
    setSelectedHoldings([]);
    setSelectedStatuses([]);
    setSelectedHealths([]);
    setSelectedUsers([]);
    setShowParentsOnly(false);
  }, []);

  // Load active workspace name from session
  const [workspaceName, setWorkspaceName] = useState<string>('');

  // Load Projects from Supabase
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchGanttProjects();
      setProjects(data);
      // Default: Keep child sub-projects collapsed for clean executive overview
      setExpandedProjectIds(new Set());
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Failed to load Gantt projects:', err);
      showToast(`${t('gantt.loadError')}${e.message || 'Error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  // Load Users list for Lead & Team assignments scoped by active workspace
  const loadUsers = useCallback(async () => {
    try {
      const sessionStr = localStorage.getItem('worklog_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const activeWsId = session?.activeWorkspaceId;
      if (session?.workspaceName) {
        setWorkspaceName(session.workspaceName);
      }

      if (activeWsId) {
        const { data: memData, error: membersError } = await supabase
          .from('workspace_users')
          .select(`
            user_id,
            role,
            users (
              id,
              emp_id,
              full_name,
              nickname,
              email
            )
          `)
          .eq('workspace_id', activeWsId);
        if (membersError) throw membersError;

        interface RawMemberRecord {
          user_id: string;
          users?: { id?: string; emp_id?: string | null; full_name?: string | null; nickname?: string | null; email?: string | null } | null;
        }

        if (memData && memData.length > 0) {
          const list: { id: string; name: string; email?: string; emp_id?: string }[] = [];
          (memData as unknown as RawMemberRecord[]).forEach((m) => {
            const u = m.users;
            if (!u) return;
            const displayName = u.nickname
              ? `${u.full_name || ''} (${u.nickname})`.trim()
              : u.full_name || u.email || 'User';
            list.push({
              id: m.user_id,
              name: displayName,
              email: u.email || undefined,
              emp_id: u.emp_id || undefined,
            });
          });

          setAvailableUsers(list);
          return;
        }
      }

      // Fallback: Global users
      const { data, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, nickname, email, emp_id')
        .order('full_name');
      if (usersError) throw usersError;

      if (data) {
        const globalList: { id: string; name: string; email?: string; emp_id?: string }[] = data.map((u: { id: string; full_name?: string | null; nickname?: string | null; email?: string | null; emp_id?: string | null }) => {
          const displayName = u.nickname
            ? `${u.full_name || ''} (${u.nickname})`.trim()
            : u.full_name || u.email || 'User';
          return {
            id: u.id,
            name: displayName,
            email: u.email || undefined,
            emp_id: u.emp_id || undefined,
          };
        });
        setAvailableUsers(globalList);
      }
    } catch (err) {
      console.error('Failed to load users for Gantt:', err);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadProjects();
      void loadUsers();
    });
  }, [loadProjects, loadUsers]);

  // Unique Project Types
  const projectTypesList = useMemo(() => {
    const set = new Set<string>(['Project', 'Support MA', 'Support Go-Live', 'Upgrade', 'Management']);
    projects.forEach((p) => {
      if (p.worklog_project_type) set.add(p.worklog_project_type);
    });
    return Array.from(set);
  }, [projects]);

  // Unique Holdings & Teams for filter options
  const holdingsList = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.owner_holding) set.add(p.owner_holding);
    });
    return Array.from(set);
  }, [projects]);

  const teamsList = useMemo(() => {
    const set = new Set<string>(['IMP', 'IT', 'IMP&IT']);
    projects.forEach((p) => {
      if (p.owner_team) set.add(p.owner_team);
    });
    return Array.from(set);
  }, [projects]);

  // Available Project Years (Descending)
  const availableYears = useMemo(() => {
    return getAvailableProjectYears(projects);
  }, [projects]);

  // Projects that truly match the filters and should be counted in KPI / claims.
  const kpiProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return projects.filter((p) => {
      if (!isProjectInYear(p, selectedYear)) return false;

      // 0. Parent Projects Only
      if (showParentsOnly && p.parent_project_id) return false;

      // 1. Multi-Select Project Types Filter
      if (selectedProjectTypes.length > 0) {
        const pType = (p.worklog_project_type || 'Project').toLowerCase();
        const matchesAnyType = selectedProjectTypes.some((selected) => {
          const sLower = selected.toLowerCase();
          return pType === sLower || (p.worklog_project_type || '').toLowerCase() === sLower;
        });
        if (!matchesAnyType) return false;
      }

      // 2. Multi-Select Teams Filter
      if (selectedTeams.length > 0) {
        const pTeam = p.owner_team || 'IMP';
        if (!selectedTeams.includes(pTeam)) return false;
      }

      // 3. Multi-Select Holdings Filter
      if (selectedHoldings.length > 0) {
        const pHolding = p.owner_holding || '';
        if (!selectedHoldings.includes(pHolding)) return false;
      }

      // 4. Multi-Select Status Filter
      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(p.status)) return false;
      }

      // 5. Multi-Select Health Filter
      if (selectedHealths.length > 0) {
        if (!selectedHealths.includes(p.project_health)) return false;
      }

      // 6. Multi-Select Member / User Filter
      if (selectedUsers.length > 0) {
        const isUserMatch = selectedUsers.some((uid) => {
          const uObj = availableUsers.find((u) => u.id === uid);
          const targetName = uObj?.name.toLowerCase() || '';
          const isLead =
            p.head_lead_user_id === uid ||
            (targetName && (p.head_lead_name || '').toLowerCase().includes(targetName));
          const isTeamMember = p.team_contributions?.some(
            (tm) =>
              tm.user_id === uid ||
              (targetName && (tm.user_name || '').toLowerCase().includes(targetName))
          );
          return isLead || isTeamMember;
        });
        if (!isUserMatch) return false;
      }

      // 7. Search Text Match
      if (!q) return true;
      return (
        p.project_name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.head_lead_name || '').toLowerCase().includes(q) ||
        (p.owner_holding || '').toLowerCase().includes(q) ||
        (p.owner_team || '').toLowerCase().includes(q)
      );
    });
  }, [
    projects,
    selectedYear,
    showParentsOnly,
    searchQuery,
    selectedProjectTypes,
    selectedTeams,
    selectedHoldings,
    selectedStatuses,
    selectedHealths,
    selectedUsers,
    availableUsers,
  ]);

  // Projects still matching the real data filters, minus anything the presenter has
  // temporarily hidden. This is what the KPI cards and Kanban board are scoped to.
  const visibleKpiProjects = useMemo(
    () => kpiProjects.filter((p) => !hiddenProjectIds.has(p.id)),
    [kpiProjects, hiddenProjectIds]
  );

  // Display rows may include parents for tree context, but those parents must not
  // affect KPI, and a hidden project never reappears as tree-context scaffolding.
  const displayProjects = useMemo(() => {
    if (!isTreeView) return visibleKpiProjects;

    // In tree mode, ensure parents of matching children are also kept in the list
    const matchingIds = new Set(visibleKpiProjects.map((p) => p.id));
    const finalSet = new Set(visibleKpiProjects);

    visibleKpiProjects.forEach((p) => {
      if (p.parent_project_id && !matchingIds.has(p.parent_project_id) && !hiddenProjectIds.has(p.parent_project_id)) {
        const parent = projects.find((item) => item.id === p.parent_project_id);
        if (parent) finalSet.add(parent);
      }
    });

    return Array.from(finalSet);
  }, [isTreeView, visibleKpiProjects, projects, hiddenProjectIds]);

  // Hidden projects' names, looked up from the unfiltered list so a chip still
  // reads correctly even if the project falls outside the current data filters.
  const hiddenProjects = useMemo(
    () =>
      projects
        .filter((p) => hiddenProjectIds.has(p.id))
        .map((p) => ({ id: p.id, project_name: p.project_name })),
    [projects, hiddenProjectIds]
  );

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const handleSelectProject = (proj: GanttProject) => {
    setSelectedProjectId(proj.id);
    setIsDrawerOpen(true);
  };

  // Patches the single edited project in place after a drawer save, instead of
  // refetching the whole Gantt list — keeps the table's scroll position and
  // expanded/collapsed tree state intact.
  const handleProjectUpdatedInPlace = useCallback((updatedProject: GanttProject) => {
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
  }, []);

  const handleToggleExpandProject = (id: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedProjectIds(new Set(projects.map((p) => p.id)));
  };

  const handleCollapseAll = () => {
    setExpandedProjectIds(new Set());
  };

  const setProjectHiddenFlag = useCallback(
    async (ids: string[], hidden: boolean) => {
      if (ids.length === 0) return;
      const prevProjects = projects;

      // Optimistic update so the report reacts instantly
      setProjects((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, is_hidden_from_gantt: hidden } : p))
      );

      try {
        const { error } = await supabase
          .from('tb_project_registry')
          .update({ is_hidden_from_gantt: hidden })
          .in('id', ids);
        if (error) throw error;
      } catch (err: unknown) {
        const e = err as { message?: string };
        console.error('Failed to update hidden state:', err);
        setProjects(prevProjects); // rollback
        showToast(`${t('gantt.kanban.updateError')}${e.message || 'Error'}`, 'error');
      }
    },
    [projects, showToast, t]
  );

  const handleHideProject = useCallback(
    (id: string) => {
      void setProjectHiddenFlag([id], true);
    },
    [setProjectHiddenFlag]
  );

  const handleRestoreProject = useCallback(
    (id: string) => {
      void setProjectHiddenFlag([id], false);
    },
    [setProjectHiddenFlag]
  );

  const handleRestoreAllHidden = useCallback(() => {
    void setProjectHiddenFlag(Array.from(hiddenProjectIds), false);
  }, [setProjectHiddenFlag, hiddenProjectIds]);

  // Optimistic Status Update (via Drag & Drop or Quick Move)
  const handleUpdateProjectStatus = useCallback(
    async (projectId: string, newStatus: ProjectStatus) => {
      const prevProjects = [...projects];
      const target = projects.find((p) => p.id === projectId);
      if (!target) return;

      // Optimistic update local state
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
      );

      try {
        const updates: { status: ProjectStatus; progress_percent?: number } = { status: newStatus };
        // If moving to completed and progress is not 100%, adjust progress
        if (newStatus === 'completed' && (target.progress_percent || 0) < 100) {
          updates.progress_percent = 100;
        }

        const { error } = await supabase.from('tb_projects').update(updates).eq('id', projectId);
        if (error) throw error;

        showToast(
          t('gantt.kanban.statusUpdated', {
            name: target.project_name,
            status: newStatus,
          }),
          'success'
        );
      } catch (err: unknown) {
        const e = err as { message?: string };
        console.error('Failed to update project status:', err);
        setProjects(prevProjects); // rollback
        showToast(`${t('gantt.kanban.updateError')}${e.message || 'Error'}`, 'error');
      }
    },
    [projects, showToast, t]
  );

  // Optimistic Health Update (via Drag & Drop or Quick Move)
  const handleUpdateProjectHealth = useCallback(
    async (projectId: string, newHealth: ProjectHealth) => {
      const prevProjects = [...projects];
      const target = projects.find((p) => p.id === projectId);
      if (!target) return;

      // Optimistic update local state
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, project_health: newHealth } : p))
      );

      try {
        const { error } = await supabase
          .from('tb_projects')
          .update({ project_health: newHealth })
          .eq('id', projectId);
        if (error) throw error;

        showToast(
          t('gantt.kanban.healthUpdated', {
            name: target.project_name,
          }),
          'success'
        );
      } catch (err: unknown) {
        const e = err as { message?: string };
        console.error('Failed to update project health:', err);
        setProjects(prevProjects); // rollback
        showToast(`${t('gantt.kanban.updateError')}${e.message || 'Error'}`, 'error');
      }
    },
    [projects, showToast, t]
  );

  return (
    <AppLayout>
      <div className="space-y-3 animate-fade-in pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-theme-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <FolderKanban size={16} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-theme-text tracking-tight flex items-center gap-2 flex-wrap">
                <span>{t('gantt.title')}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {t('gantt.badge')}
                </span>
                {workspaceName && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    🏢 {workspaceName}
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-theme-text-secondary">
                {t('gantt.subtitle')}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="px-3 py-1.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text font-bold text-xs transition-all cursor-pointer select-none"
            >
              📋 {t('gantt.registryBtn')}
            </button>
          </div>
        </div>

        {/* Executive Summary Top Cards (Scoped to Filtered, Visible Projects) */}
        <ExecutiveSummaryKPIs projects={visibleKpiProjects} />

        {/* Filter Toolbar with View Switcher, Year, Tree View, Kanban & Zoom controls */}
        <GanttFilterToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          kanbanGroupBy={kanbanGroupBy}
          onKanbanGroupByChange={setKanbanGroupBy}
          kanbanSwimlane={kanbanSwimlane}
          onKanbanSwimlaneChange={setKanbanSwimlane}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          availableYears={availableYears}
          selectedProjectTypes={selectedProjectTypes}
          onProjectTypesChange={setSelectedProjectTypes}
          projectTypesList={projectTypesList}
          selectedTeams={selectedTeams}
          onTeamsChange={setSelectedTeams}
          selectedHoldings={selectedHoldings}
          onHoldingsChange={setSelectedHoldings}
          selectedStatuses={selectedStatuses}
          onStatusesChange={setSelectedStatuses}
          selectedHealths={selectedHealths}
          onHealthsChange={setSelectedHealths}
          selectedUsers={selectedUsers}
          onUsersChange={setSelectedUsers}
          usersList={availableUsers}
          showParentsOnly={showParentsOnly}
          onShowParentsOnlyChange={setShowParentsOnly}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          holdingsList={holdingsList}
          teamsList={teamsList}
          onRefresh={loadProjects}
          isLoading={isLoading}
          isTreeView={isTreeView}
          onToggleTreeView={setIsTreeView}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onResetAllFilters={handleResetAllFilters}
          hiddenProjects={hiddenProjects}
          onRestoreProject={handleRestoreProject}
          onRestoreAllHidden={handleRestoreAllHidden}
        />

        {/* Main Canvas: Gantt Roadmap or Kanban Board */}
        {isLoading ? (
          <div className="p-16 text-center rounded-3xl border border-theme-border/60 bg-theme-surface/40 animate-pulse space-y-3">
            <RefreshCw size={28} className="mx-auto text-indigo-500 animate-spin" />
            <p className="text-xs font-bold text-theme-text-muted">{t('gantt.loading')}</p>
          </div>
        ) : viewMode === 'gantt' ? (
          <GanttRoadmapCanvas
            projects={displayProjects}
            zoomLevel={zoomLevel}
            selectedYear={selectedYear}
            isTreeView={isTreeView}
            expandedProjectIds={expandedProjectIds}
            onToggleExpandProject={handleToggleExpandProject}
            onSelectProject={handleSelectProject}
            selectedProjectId={selectedProjectId}
            onHideProject={handleHideProject}
          />
        ) : (
          <ProjectKanbanCanvas
            projects={visibleKpiProjects}
            selectedYear={selectedYear}
            groupBy={kanbanGroupBy}
            swimlane={kanbanSwimlane}
            onSelectProject={handleSelectProject}
            selectedProjectId={selectedProjectId}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onUpdateProjectHealth={handleUpdateProjectHealth}
            onHideProject={handleHideProject}
          />
        )}

        {/* Bottom Feature Highlights Card */}
        <div className="p-5 rounded-3xl border border-theme-border/60 bg-theme-surface/50 dark:bg-theme-bg-page/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-theme-text-secondary">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-theme-text">โครงสร้าง Project / Support Claim (Best Practices):</span>
              <p className="text-[11px] leading-relaxed">
                ใช้ Parent เป็น Product/System กลาง แล้วแยก Implementation Project และ Annual Support MA เป็น Child รายปี เพื่อป้องกันการนับ Save Cost ซ้ำข้ามปี
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Detail & Value Realization Drawer */}
      <ProjectDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedProjectId(null);
        }}
        project={selectedProject}
        onProjectUpdated={handleProjectUpdatedInPlace}
        availableUsers={availableUsers}
      />
    </AppLayout>
  );
}
