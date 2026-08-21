import React from 'react';
import {
  Search,
  Filter,
  Calendar,
  RefreshCw,
  Plus,
  FolderTree,
  FolderKanban,
  List,
  ChevronsDownUp,
  ChevronsUpDown,
  RotateCcw,
  X,
  Layers,
  Building2,
  Globe,
  Activity,
  HeartPulse,
  Users,
  Grid,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectStatus, ProjectHealth } from '../../lib/project-management';
import { cn } from '../../lib/utils';
import {
  MultiSelectFilter,
  type MultiSelectOption,
  type MultiSelectPreset,
} from '../common/MultiSelectFilter';
import type { KanbanGroupBy, KanbanSwimlane } from '../kanban/ProjectKanbanCanvas';

export type GanttZoomLevel = 'month' | 'quarter' | 'year';
export type PortfolioViewMode = 'gantt' | 'kanban';

interface GanttFilterToolbarProps {
  viewMode: PortfolioViewMode;
  onViewModeChange: (mode: PortfolioViewMode) => void;
  kanbanGroupBy?: KanbanGroupBy;
  onKanbanGroupByChange?: (groupBy: KanbanGroupBy) => void;
  kanbanSwimlane?: KanbanSwimlane;
  onKanbanSwimlaneChange?: (swimlane: KanbanSwimlane) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedYear: number | 'all';
  onYearChange: (year: number | 'all') => void;
  availableYears: number[];
  selectedProjectTypes: string[];
  onProjectTypesChange: (types: string[]) => void;
  projectTypesList: string[];
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
  selectedHoldings: string[];
  onHoldingsChange: (holdings: string[]) => void;
  selectedStatuses: ProjectStatus[];
  onStatusesChange: (statuses: ProjectStatus[]) => void;
  selectedHealths: ProjectHealth[];
  onHealthsChange: (healths: ProjectHealth[]) => void;
  selectedUsers: string[];
  onUsersChange: (userIds: string[]) => void;
  usersList: { id: string; name: string; email?: string }[];
  zoomLevel: GanttZoomLevel;
  onZoomChange: (zoom: GanttZoomLevel) => void;
  holdingsList: string[];
  teamsList: string[];
  onRefresh: () => void;
  isLoading: boolean;
  onOpenCreateProject?: () => void;
  isTreeView: boolean;
  onToggleTreeView: (tree: boolean) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onResetAllFilters: () => void;
}

export const GanttFilterToolbar: React.FC<GanttFilterToolbarProps> = ({
  viewMode,
  onViewModeChange,
  kanbanGroupBy = 'status',
  onKanbanGroupByChange,
  kanbanSwimlane = 'none',
  onKanbanSwimlaneChange,
  searchQuery,
  onSearchChange,
  selectedYear,
  onYearChange,
  availableYears,
  selectedProjectTypes,
  onProjectTypesChange,
  projectTypesList,
  selectedTeams,
  onTeamsChange,
  selectedHoldings,
  onHoldingsChange,
  selectedStatuses,
  onStatusesChange,
  selectedHealths,
  onHealthsChange,
  selectedUsers,
  onUsersChange,
  usersList,
  zoomLevel,
  onZoomChange,
  holdingsList,
  teamsList,
  onRefresh,
  isLoading,
  onOpenCreateProject,
  isTreeView,
  onToggleTreeView,
  onExpandAll,
  onCollapseAll,
  onResetAllFilters,
}) => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  // Project Types Options & Presets
  const projectTypeOptions: MultiSelectOption[] = React.useMemo(() => {
    return projectTypesList.map((type) => ({
      value: type,
      label: type,
      icon: (
        <span>
          {type === 'Project' || type === 'Upgrade'
            ? '🚀'
            : type.toLowerCase().includes('support')
            ? '🛠️'
            : '📋'}
        </span>
      ),
    }));
  }, [projectTypesList]);

  const projectTypePresets: MultiSelectPreset[] = React.useMemo(
    () => [
      {
        label: t('gantt.filters.presetDev'),
        icon: '🚀',
        values: ['Project', 'Upgrade'].filter((v) => projectTypesList.includes(v)),
      },
      {
        label: t('gantt.filters.presetSupport'),
        icon: '🛠️',
        values: ['Support MA', 'Support Go-Live'].filter((v) => projectTypesList.includes(v)),
      },
      {
        label: t('gantt.filters.presetMgmt'),
        icon: '📋',
        values: ['Management'].filter((v) => projectTypesList.includes(v)),
      },
    ],
    [projectTypesList, t]
  );

  // Teams Options
  const teamOptions: MultiSelectOption[] = React.useMemo(() => {
    return teamsList.map((team) => ({
      value: team,
      label: team,
    }));
  }, [teamsList]);

  // Holdings Options
  const holdingOptions: MultiSelectOption[] = React.useMemo(() => {
    return holdingsList.map((h) => ({
      value: h,
      label: h,
    }));
  }, [holdingsList]);

  // Status Options
  const statusOptions: MultiSelectOption[] = React.useMemo(
    () => [
      { value: 'planning', label: 'Planning', icon: '🔵' },
      { value: 'in_progress', label: 'In Progress', icon: '🟡' },
      { value: 'testing', label: 'Testing / UAT', icon: '🟣' },
      { value: 'completed', label: 'Completed', icon: '🟢' },
      { value: 'on_hold', label: 'On Hold', icon: '⚪' },
    ],
    []
  );

  // Health Options
  const healthOptions: MultiSelectOption[] = React.useMemo(
    () => [
      { value: 'on_track', label: 'On Track', icon: '🟢' },
      { value: 'at_risk', label: 'At Risk', icon: '🟡' },
      { value: 'delayed', label: 'Delayed', icon: '🔴' },
      { value: 'on_hold', label: 'On Hold', icon: '⏸️' },
      { value: 'completed', label: 'Completed', icon: '✅' },
    ],
    []
  );

  // Users Options
  const userOptions: MultiSelectOption[] = React.useMemo(() => {
    return usersList.map((u) => ({
      value: u.id,
      label: u.name,
      description: u.email,
      icon: <span>👤</span>,
    }));
  }, [usersList]);

  // Check if any filter is active
  const hasActiveFilters =
    selectedProjectTypes.length > 0 ||
    selectedTeams.length > 0 ||
    selectedHoldings.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedHealths.length > 0 ||
    selectedUsers.length > 0 ||
    selectedYear !== currentYear ||
    Boolean(searchQuery.trim());

  return (
    <div className="relative z-30 p-4 rounded-3xl border border-theme-border/70 bg-theme-surface/80 dark:bg-theme-bg-page/60 backdrop-blur-md shadow-sm mb-5 space-y-3.5 select-none">
      {/* Top Row: View Switcher + Search + Specific Controls + Action Buttons */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* View Mode Switcher (Gantt vs Kanban) */}
          <div className="flex items-center gap-1 bg-theme-surface-secondary/80 p-1 rounded-2xl border border-theme-border/60 shrink-0">
            <button
              type="button"
              onClick={() => onViewModeChange('gantt')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5',
                viewMode === 'gantt'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text'
              )}
            >
              <FolderKanban size={14} />
              <span>{t('gantt.viewGantt')}</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('kanban')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5',
                viewMode === 'kanban'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text'
              )}
            >
              <Grid size={14} />
              <span>{t('gantt.viewKanban')}</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-3 text-theme-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('gantt.filters.searchPlaceholder')}
              className="w-full text-xs sm:text-sm py-2 pl-9 pr-3 rounded-2xl border border-theme-border bg-theme-surface text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* View-Specific Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {viewMode === 'gantt' ? (
            <>
              {/* Gantt View: Tree Hierarchy vs Flat List */}
              <div className="flex items-center gap-1 bg-theme-surface-secondary/70 p-1 rounded-2xl border border-theme-border/60 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleTreeView(true)}
                  className={cn(
                    'px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
                    isTreeView
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-theme-text-muted hover:text-theme-text'
                  )}
                  title={t('gantt.filters.viewTree')}
                >
                  <FolderTree size={13} />
                  <span>{t('gantt.filters.viewTree')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTreeView(false)}
                  className={cn(
                    'px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
                    !isTreeView
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-theme-text-muted hover:text-theme-text'
                  )}
                  title={t('gantt.filters.viewFlat')}
                >
                  <List size={13} />
                  <span>{t('gantt.filters.viewFlat')}</span>
                </button>
              </div>

              {/* Gantt View: Zoom Controls (Month / Quarter / Year) */}
              <div className="flex items-center gap-1.5 bg-theme-surface-secondary/70 p-1 rounded-2xl border border-theme-border/60 shrink-0">
                <span className="text-[10px] font-bold text-theme-text-muted px-2 flex items-center gap-1">
                  <Calendar size={12} /> {t('gantt.filters.zoom')}
                </span>
                {(['month', 'quarter', 'year'] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => onZoomChange(z)}
                    className={cn(
                      'px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer select-none',
                      zoomLevel === z
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-theme-text-muted hover:text-theme-text'
                    )}
                  >
                    {z === 'month'
                      ? t('gantt.filters.month')
                      : z === 'quarter'
                      ? t('gantt.filters.quarter')
                      : t('gantt.filters.year')}
                  </button>
                ))}
              </div>

              {/* Tree Expand/Collapse All */}
              {isTreeView && onExpandAll && onCollapseAll && (
                <div className="flex items-center gap-1 bg-theme-surface-secondary/50 p-1 rounded-2xl border border-theme-border/60">
                  <button
                    type="button"
                    onClick={onExpandAll}
                    className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-indigo-600 transition-colors cursor-pointer"
                    title={t('gantt.filters.expandAll')}
                  >
                    <ChevronsUpDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={onCollapseAll}
                    className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-indigo-600 transition-colors cursor-pointer"
                    title={t('gantt.filters.collapseAll')}
                  >
                    <ChevronsDownUp size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Kanban View: Group By Selector */}
              <div className="flex items-center gap-1.5 bg-theme-surface-secondary/70 px-2 py-1 rounded-2xl border border-theme-border/60 shrink-0">
                <span className="text-[10px] font-bold text-theme-text-muted">{t('gantt.kanban.groupBy')}</span>
                <select
                  value={kanbanGroupBy}
                  onChange={(e) => onKanbanGroupByChange?.(e.target.value as KanbanGroupBy)}
                  className="text-xs font-bold py-1 px-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="status">📊 {t('gantt.kanban.groupByStatus')}</option>
                  <option value="health">❤️ {t('gantt.kanban.groupByHealth')}</option>
                  <option value="team">🏢 {t('gantt.kanban.groupByTeam')}</option>
                  <option value="type">🎯 {t('gantt.kanban.groupByType')}</option>
                </select>
              </div>

              {/* Kanban View: Swimlane Selector */}
              <div className="flex items-center gap-1.5 bg-theme-surface-secondary/70 px-2 py-1 rounded-2xl border border-theme-border/60 shrink-0">
                <span className="text-[10px] font-bold text-theme-text-muted">{t('gantt.kanban.swimlane')}</span>
                <select
                  value={kanbanSwimlane}
                  onChange={(e) => onKanbanSwimlaneChange?.(e.target.value as KanbanSwimlane)}
                  className="text-xs font-bold py-1 px-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="none">📄 {t('gantt.kanban.swimlaneNone')}</option>
                  <option value="parent">📁 {t('gantt.kanban.swimlaneParent')}</option>
                </select>
              </div>
            </>
          )}

          {/* Refresh Action */}
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-all cursor-pointer"
            title={t('gantt.filters.refresh')}
          >
            <RefreshCw size={15} className={cn(isLoading && 'animate-spin text-indigo-500')} />
          </button>

          {/* Create Project Button */}
          {onOpenCreateProject && (
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>{t('gantt.filters.createProject')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Multi-Select Filter Popovers */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-theme-border/40 text-xs">
        <span className="text-[11px] font-bold text-theme-text-muted flex items-center gap-1 pr-1">
          <Filter size={13} /> {t('gantt.filters.filterLabel')}
        </span>

        {/* Year Filter (Single select) */}
        <select
          value={String(selectedYear)}
          onChange={(e) => {
            const val = e.target.value;
            onYearChange(val === 'all' ? 'all' : Number(val));
          }}
          className="text-xs font-bold py-1.5 px-2.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
        >
          <option value="all">🌐 {t('gantt.filters.allYears')}</option>
          {availableYears.map((y) => (
            <option key={y} value={String(y)}>
              📅 {t('gantt.filters.yearLabel')} {y} {y === currentYear ? t('gantt.filters.currentYear') : y > currentYear ? t('gantt.filters.futureYear') : t('gantt.filters.pastYear')}
            </option>
          ))}
        </select>

        {/* 1. Multi-Select: Project Types */}
        <MultiSelectFilter
          label={t('gantt.filters.projectType')}
          defaultAllLabel={`🎯 ${t('gantt.filters.allProjectTypes')}`}
          icon={<Layers size={13} />}
          options={projectTypeOptions}
          selectedValues={selectedProjectTypes}
          onChange={onProjectTypesChange}
          presets={projectTypePresets}
        />

        {/* 2. Multi-Select: Teams */}
        <MultiSelectFilter
          label={t('gantt.filters.team')}
          defaultAllLabel={`🏢 ${t('gantt.filters.allTeams')}`}
          icon={<Building2 size={13} />}
          options={teamOptions}
          selectedValues={selectedTeams}
          onChange={onTeamsChange}
        />

        {/* 3. Multi-Select: Holdings */}
        <MultiSelectFilter
          label={t('gantt.filters.holding')}
          defaultAllLabel={`🌐 ${t('gantt.filters.allHoldings')}`}
          icon={<Globe size={13} />}
          options={holdingOptions}
          selectedValues={selectedHoldings}
          onChange={onHoldingsChange}
        />

        {/* 4. Multi-Select: Status */}
        <MultiSelectFilter
          label={t('gantt.filters.status')}
          defaultAllLabel={`📊 ${t('gantt.filters.allStatuses')}`}
          icon={<Activity size={13} />}
          options={statusOptions}
          selectedValues={selectedStatuses}
          onChange={(vals) => onStatusesChange(vals as ProjectStatus[])}
        />

        {/* 5. Multi-Select: Health */}
        <MultiSelectFilter
          label={t('gantt.filters.health')}
          defaultAllLabel={`❤️ ${t('gantt.filters.allHealths')}`}
          icon={<HeartPulse size={13} />}
          options={healthOptions}
          selectedValues={selectedHealths}
          onChange={(vals) => onHealthsChange(vals as ProjectHealth[])}
        />

        {/* 6. Multi-Select: Users / Assignees */}
        <MultiSelectFilter
          label={t('gantt.filters.member')}
          defaultAllLabel={`👥 ${t('gantt.filters.allMembers')}`}
          icon={<Users size={13} />}
          options={userOptions}
          selectedValues={selectedUsers}
          onChange={onUsersChange}
          align="right"
        />

        {/* Reset All Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetAllFilters}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-2.5 py-1 rounded-xl transition-colors cursor-pointer ml-auto"
            title={t('gantt.filters.resetAll')}
          >
            <RotateCcw size={12} />
            <span>{t('gantt.filters.resetAll')}</span>
          </button>
        )}
      </div>

      {/* Active Filter Chips / Badges Row */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs animate-fade-in border-t border-theme-border/20">
          <span className="text-[10px] font-bold uppercase text-theme-text-muted tracking-wider mr-1">
            {t('gantt.filters.filteringBy')}
          </span>

          {/* Project Types Chips */}
          {selectedProjectTypes.map((type) => (
            <span
              key={`chip-pt-${type}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 shadow-xs"
            >
              <span>📌 {type}</span>
              <button
                type="button"
                onClick={() => onProjectTypesChange(selectedProjectTypes.filter((t) => t !== type))}
                className="hover:bg-indigo-500/30 rounded-full p-0.5 transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Teams Chips */}
          {selectedTeams.map((team) => (
            <span
              key={`chip-team-${team}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 shadow-xs"
            >
              <span>🏢 {team}</span>
              <button
                type="button"
                onClick={() => onTeamsChange(selectedTeams.filter((t) => t !== team))}
                className="hover:bg-violet-500/30 rounded-full p-0.5 transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Holdings Chips */}
          {selectedHoldings.map((h) => (
            <span
              key={`chip-h-${h}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shadow-xs"
            >
              <span>🌐 {h}</span>
              <button
                type="button"
                onClick={() => onHoldingsChange(selectedHoldings.filter((item) => item !== h))}
                className="hover:bg-blue-500/30 rounded-full p-0.5 transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Status Chips */}
          {selectedStatuses.map((st) => (
            <span
              key={`chip-st-${st}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs"
            >
              <span>
                {st === 'planning'
                  ? '🔵 Planning'
                  : st === 'in_progress'
                  ? '🟡 In Progress'
                  : st === 'testing'
                  ? '🟣 Testing'
                  : st === 'completed'
                  ? '🟢 Completed'
                  : '⚪ On Hold'}
              </span>
              <button
                type="button"
                onClick={() => onStatusesChange(selectedStatuses.filter((item) => item !== st))}
                className="hover:bg-amber-500/30 rounded-full p-0.5 transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Health Chips */}
          {selectedHealths.map((he) => (
            <span
              key={`chip-he-${he}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs"
            >
              <span>
                {he === 'on_track'
                  ? '🟢 On Track'
                  : he === 'at_risk'
                  ? '🟡 At Risk'
                  : he === 'delayed'
                  ? '🔴 Delayed'
                  : he === 'on_hold'
                  ? '⏸️ On Hold'
                  : '✅ Completed'}
              </span>
              <button
                type="button"
                onClick={() => onHealthsChange(selectedHealths.filter((item) => item !== he))}
                className="hover:bg-emerald-500/30 rounded-full p-0.5 transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Users Chips */}
          {selectedUsers.map((uid) => {
            const u = usersList.find((item) => item.id === uid);
            return (
              <span
                key={`chip-u-${uid}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/30 shadow-xs"
              >
                <span>👤 {u?.name || uid}</span>
                <button
                  type="button"
                  onClick={() => onUsersChange(selectedUsers.filter((item) => item !== uid))}
                  className="hover:bg-pink-500/30 rounded-full p-0.5 transition-colors cursor-pointer"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
