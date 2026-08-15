import React from 'react';
import { Search, Filter, Calendar, RefreshCw, Plus, FolderTree, List, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { ProjectStatus, ProjectHealth } from '../../lib/project-management';
import { cn } from '../../lib/utils';

export type GanttZoomLevel = 'month' | 'quarter' | 'year';

interface GanttFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedYear: number | 'all';
  onYearChange: (year: number | 'all') => void;
  availableYears: number[];
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  selectedHolding: string;
  onHoldingChange: (holding: string) => void;
  selectedStatus: ProjectStatus | 'all';
  onStatusChange: (status: ProjectStatus | 'all') => void;
  selectedHealth: ProjectHealth | 'all';
  onHealthChange: (health: ProjectHealth | 'all') => void;
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
}

export const GanttFilterToolbar: React.FC<GanttFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedYear,
  onYearChange,
  availableYears,
  selectedTeam,
  onTeamChange,
  selectedHolding,
  onHoldingChange,
  selectedStatus,
  onStatusChange,
  selectedHealth,
  onHealthChange,
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
}) => {
  const currentYear = new Date().getFullYear();

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

      {/* Bottom Row: Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-theme-border/40 text-xs">
        <span className="text-[11px] font-bold text-theme-text-muted flex items-center gap-1 pr-1">
          <Filter size={13} /> ตัวกรอง:
        </span>

        {/* Year Filter */}
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

        {/* Team Filter */}
        <select
          value={selectedTeam}
          onChange={(e) => onTeamChange(e.target.value)}
          className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="all">🏢 ทุกทีม (All Teams)</option>
          {teamsList.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Holding Filter */}
        <select
          value={selectedHolding}
          onChange={(e) => onHoldingChange(e.target.value)}
          className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="all">🌐 ทุก Holding</option>
          {holdingsList.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value as ProjectStatus | 'all')}
          className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="all">📊 ทุกสถานะ (All Statuses)</option>
          <option value="planning">🔵 Planning</option>
          <option value="in_progress">🟡 In Progress</option>
          <option value="testing">🟣 Testing / UAT</option>
          <option value="completed">🟢 Completed</option>
          <option value="on_hold">⚪ On Hold</option>
        </select>

        {/* Health Filter */}
        <select
          value={selectedHealth}
          onChange={(e) => onHealthChange(e.target.value as ProjectHealth | 'all')}
          className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="all">❤️ ทุกระดับสุขภาพ</option>
          <option value="on_track">🟢 On Track (ตามแผน)</option>
          <option value="at_risk">🟡 At Risk (เสี่ยงล่าช้า)</option>
          <option value="delayed">🔴 Delayed (เกินกำหนด)</option>
        </select>

        {/* Active Filters Clear */}
        {(selectedYear !== currentYear ||
          selectedTeam !== 'all' ||
          selectedHolding !== 'all' ||
          selectedStatus !== 'all' ||
          selectedHealth !== 'all' ||
          searchQuery.trim()) && (
          <button
            type="button"
            onClick={() => {
              onYearChange(currentYear);
              onTeamChange('all');
              onHoldingChange('all');
              onStatusChange('all');
              onHealthChange('all');
              onSearchChange('');
            }}
            className="text-[11px] font-bold text-rose-500 hover:underline px-2 cursor-pointer ml-auto"
          >
            รีเซ็ตตัวกรอง
          </button>
        )}
      </div>
    </div>
  );
};
