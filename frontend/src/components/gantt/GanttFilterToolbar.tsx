import React from 'react';
import {
  Search,
  Filter,
  Calendar,
  RefreshCw,
  Plus,
  FolderTree,
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
} from 'lucide-react';
import type { ProjectStatus, ProjectHealth } from '../../lib/project-management';
import { cn } from '../../lib/utils';
import {
  MultiSelectFilter,
  type MultiSelectOption,
  type MultiSelectPreset,
} from '../common/MultiSelectFilter';

export type GanttZoomLevel = 'month' | 'quarter' | 'year';

interface GanttFilterToolbarProps {
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
  const currentYear = new Date().getFullYear();

  // Project Types Options & Presets
  const projectTypeOptions: MultiSelectOption[] = React.useMemo(() => {
    return projectTypesList.map((t) => ({
      value: t,
      label: t,
      icon: (
        <span>
          {t === 'Project' || t === 'Upgrade'
            ? '🚀'
            : t.toLowerCase().includes('support')
            ? '🛠️'
            : '📋'}
        </span>
      ),
    }));
  }, [projectTypesList]);

  const projectTypePresets: MultiSelectPreset[] = React.useMemo(
    () => [
      {
        label: 'โครงการพัฒนา',
        icon: '🚀',
        values: ['Project', 'Upgrade'].filter((v) => projectTypesList.includes(v)),
      },
      {
        label: 'งานดูแลระบบ',
        icon: '🛠️',
        values: ['Support MA', 'Support Go-Live'].filter((v) => projectTypesList.includes(v)),
      },
      {
        label: 'บริหารจัดการ',
        icon: '📋',
        values: ['Management'].filter((v) => projectTypesList.includes(v)),
      },
    ],
    [projectTypesList]
  );

  // Teams Options
  const teamOptions: MultiSelectOption[] = React.useMemo(() => {
    return teamsList.map((t) => ({
      value: t,
      label: t,
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
      { value: 'planning', label: 'Planning (วางแผน)', icon: '🔵' },
      { value: 'in_progress', label: 'In Progress (กำลังพัฒนา)', icon: '🟡' },
      { value: 'testing', label: 'Testing / UAT (ทดสอบ)', icon: '🟣' },
      { value: 'completed', label: 'Completed (เสร็จสิ้น)', icon: '🟢' },
      { value: 'on_hold', label: 'On Hold (พักงาน)', icon: '⚪' },
    ],
    []
  );

  // Health Options
  const healthOptions: MultiSelectOption[] = React.useMemo(
    () => [
      { value: 'on_track', label: 'On Track (ตามแผน)', icon: '🟢' },
      { value: 'at_risk', label: 'At Risk (เสี่ยงล่าช้า)', icon: '🟡' },
      { value: 'delayed', label: 'Delayed (เกินกำหนด)', icon: '🔴' },
      { value: 'on_hold', label: 'On Hold (พักโครงการ)', icon: '⏸️' },
      { value: 'completed', label: 'Completed (เสร็จสิ้น)', icon: '✅' },
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
    <div className="p-4 rounded-3xl border border-theme-border/70 bg-theme-surface/80 dark:bg-theme-bg-page/60 backdrop-blur-md shadow-sm mb-5 space-y-3.5 select-none">
      {/* Top Row: Search + View Hierarchy Toggle + Zoom Pills + Action Buttons */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-3 text-theme-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อโครงการ, หัวหน้าทีม, หรือรายละเอียด..."
            className="w-full text-xs sm:text-sm py-2 pl-9 pr-3 rounded-2xl border border-theme-border bg-theme-surface text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* View Mode: Tree Hierarchy vs Flat List */}
        <div className="flex items-center gap-1 bg-theme-surface-secondary/70 p-1 rounded-2xl border border-theme-border/60 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onToggleTreeView(true)}
            className={cn(
              'px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
              isTreeView
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-theme-text-muted hover:text-theme-text'
            )}
            title="จัดกลุ่มโครงการหลัก > โมดูลย่อย (Parent-Child Tree)"
          >
            <FolderTree size={13} />
            <span>ลำดับชั้น (แม่-ลูก)</span>
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
            title="แสดงรายการโครงการทั้งหมดแบบ Flat List"
          >
            <List size={13} />
            <span>ทั้งหมด (Flat)</span>
          </button>
        </div>

        {/* Zoom Controls (Month / Quarter / Year) */}
        <div className="flex items-center gap-1.5 bg-theme-surface-secondary/70 p-1 rounded-2xl border border-theme-border/60 shrink-0 self-start sm:self-auto">
          <span className="text-[10px] font-bold text-theme-text-muted px-2 flex items-center gap-1">
            <Calendar size={12} /> ซูม:
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
              {z === 'month' ? 'เดือน' : z === 'quarter' ? 'ไตรมาส' : 'ปี'}
            </button>
          ))}
        </div>

        {/* Tree Expand/Collapse All + Refresh + Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isTreeView && onExpandAll && onCollapseAll && (
            <div className="flex items-center gap-1 bg-theme-surface-secondary/50 p-1 rounded-2xl border border-theme-border/60">
              <button
                type="button"
                onClick={onExpandAll}
                className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-indigo-600 transition-colors cursor-pointer"
                title="กางโมดูลย่อยทั้งหมด (Expand All)"
              >
                <ChevronsUpDown size={14} />
              </button>
              <button
                type="button"
                onClick={onCollapseAll}
                className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-indigo-600 transition-colors cursor-pointer"
                title="หุบโมดูลย่อยทั้งหมด (Collapse All)"
              >
                <ChevronsDownUp size={14} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-all cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={15} className={cn(isLoading && 'animate-spin text-indigo-500')} />
          </button>

          {onOpenCreateProject && (
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>สร้างโครงการใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Multi-Select Filter Popovers */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-theme-border/40 text-xs">
        <span className="text-[11px] font-bold text-theme-text-muted flex items-center gap-1 pr-1">
          <Filter size={13} /> ตัวกรอง:
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
          <option value="all">🌐 ทุกช่วงปี (All Years)</option>
          {availableYears.map((y) => (
            <option key={y} value={String(y)}>
              📅 ปี {y} {y === currentYear ? '(ปีปัจจุบัน)' : y > currentYear ? '(แผนล่วงหน้า)' : '(ย้อนหลัง)'}
            </option>
          ))}
        </select>

        {/* 1. Multi-Select: Project Types */}
        <MultiSelectFilter
          label="ประเภทงาน"
          defaultAllLabel="🎯 ทุกประเภทงาน"
          icon={<Layers size={13} />}
          options={projectTypeOptions}
          selectedValues={selectedProjectTypes}
          onChange={onProjectTypesChange}
          presets={projectTypePresets}
          searchPlaceholder="ค้นหาประเภทงาน..."
        />

        {/* 2. Multi-Select: Teams */}
        <MultiSelectFilter
          label="ทีม"
          defaultAllLabel="🏢 ทุกทีม"
          icon={<Building2 size={13} />}
          options={teamOptions}
          selectedValues={selectedTeams}
          onChange={onTeamsChange}
          searchPlaceholder="ค้นหาทีม..."
        />

        {/* 3. Multi-Select: Holdings */}
        <MultiSelectFilter
          label="Holding"
          defaultAllLabel="🌐 ทุก Holding"
          icon={<Globe size={13} />}
          options={holdingOptions}
          selectedValues={selectedHoldings}
          onChange={onHoldingsChange}
          searchPlaceholder="ค้นหา Holding..."
        />

        {/* 4. Multi-Select: Status */}
        <MultiSelectFilter
          label="สถานะ"
          defaultAllLabel="📊 ทุกสถานะ"
          icon={<Activity size={13} />}
          options={statusOptions}
          selectedValues={selectedStatuses}
          onChange={(vals) => onStatusesChange(vals as ProjectStatus[])}
          searchPlaceholder="ค้นหาสถานะ..."
        />

        {/* 5. Multi-Select: Health */}
        <MultiSelectFilter
          label="สุขภาพ"
          defaultAllLabel="❤️ ทุกระดับสุขภาพ"
          icon={<HeartPulse size={13} />}
          options={healthOptions}
          selectedValues={selectedHealths}
          onChange={(vals) => onHealthsChange(vals as ProjectHealth[])}
          searchPlaceholder="ค้นหาระดับสุขภาพ..."
        />

        {/* 6. Multi-Select: Users / Assignees */}
        <MultiSelectFilter
          label="สมาชิก"
          defaultAllLabel="👥 สมาชิกทุกคน"
          icon={<Users size={13} />}
          options={userOptions}
          selectedValues={selectedUsers}
          onChange={onUsersChange}
          searchPlaceholder="ค้นหาชื่อสมาชิก..."
          align="right"
        />

        {/* Reset All Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetAllFilters}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-2.5 py-1 rounded-xl transition-colors cursor-pointer ml-auto"
            title="ล้างตัวกรองทั้งหมด"
          >
            <RotateCcw size={12} />
            <span>ล้างตัวกรอง</span>
          </button>
        )}
      </div>

      {/* Active Filter Chips / Badges Row */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs animate-fade-in border-t border-theme-border/20">
          <span className="text-[10px] font-bold uppercase text-theme-text-muted tracking-wider mr-1">
            กำลังกรอง:
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
