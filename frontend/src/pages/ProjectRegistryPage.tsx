import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, ExternalLink, FolderTree, FolderKanban, Calendar,
  ChevronDown, ChevronRight, Edit2, Trash2, X, Save,
  Check, Clock, Activity, Users, FileText, FileCode,
  FolderOpen, Layers, Building2,
  RefreshCw, Link, Server, Database, Mail, Key, GitBranch
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useNotification } from '../context/NotificationContext';
import ViewWorklogModal from '../components/modals/ViewWorklogModal';
import ProjectNotesModal from '../components/modals/ProjectNotesModal';
import ProjectNotesExportModal from '../components/modals/ProjectNotesExportModal';
import ProjectDocumentsModal from '../components/modals/ProjectDocumentsModal';
import ProjectSecretsModal from '../components/modals/ProjectSecretsModal';

/* ── Types ── */
type ProjectStatus =
  | 'planning'
  | 'development'
  | 'in_progress'
  | 'testing'
  | 'active'
  | 'completed'
  | 'on_hold'
  | 'inactive'
  | 'sunset'
  | 'retired';

interface Project {
  id: string;
  project_name: string;
  workspace_id?: string | null;
  project_slug: string;
  description: string | null;
  parent_project_id: string | null;
  module: string | null;
  status: ProjectStatus;
  project_type: string;
  owner_holding: string | null;
  owner_team: string | null;
  deploy_url: string | null;
  go_live_date: string | null;
  last_verified_date: string | null;
  last_usage_note: string | null;
  is_auto_check_enabled: boolean;
  created_at: string;
  updated_at: string;
  worklog_project_type?: string | null;
  // Joined fields
  parent_name?: string | null;
  // Computed
  worklog_count?: number;
  worklog_recent?: number;
  worklog_unique_users?: number;
  recentLogs?: any[];
  children?: Project[];
  notes_count?: number;
  documents_count?: number;
  secrets_count?: number;
  // Added fields
  hosting_provider?: string | null;
  admin_email?: string | null;
  database_info?: string | null;
  github_repo_url?: string | null;
  credentials_ref_note?: string | null;
  vault_url?: string | null;
}

interface WorklogSummary {
  [projectId: string]: {
    count: number;
    recent_30d: number;
    unique_users: number;
    logs: any[];
  };
}

interface ProjectRegistryRow extends Project {
  parent?: { project_name?: string | null } | null;
}

interface ProjectTypeRow {
  type_name?: string | null;
}

interface ProjectCountRow {
  project_id?: string | null;
}

interface RegistryWorklogSummaryRow {
  id: string;
  project_id?: string | null;
  module_id?: string | null;
  work_date?: string | null;
  created_at?: string | null;
  action_name?: string | null;
  description?: string | null;
}

/* ── Constants ── */
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: string }> = {
  planning:    { label: 'Planning',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20', icon: '🔵' },
  development: { label: 'Dev',         color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20', icon: '🟡' },
  in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/25', icon: '▶' },
  testing:     { label: 'Testing / UAT', color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-500/25', icon: '◇' },
  active:      { label: 'Active',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', icon: '🟢' },
  completed:   { label: 'Completed',   color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300 border-teal-200 dark:border-teal-500/25', icon: '✓' },
  on_hold:     { label: 'On Hold',     color: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300 border-slate-200 dark:border-slate-500/25', icon: 'Ⅱ' },
  inactive:    { label: 'Inactive',    color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200 dark:border-slate-500/20', icon: '⚪' },
  sunset:      { label: 'Sunset',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20', icon: '🟠' },
  retired:     { label: 'Retired',     color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20', icon: '🔴' },
};

const TYPE_ICONS: Record<string, string> = {
  web_app: '🌐', api: '⚙️', mobile: '📱', desktop: '💻',
  integration: '🔗', extension: '🔌', module: '🧩', internal_tool: '🛠️', infra: '☁️', other: '📁',
};

const DEFAULT_HOLDINGS = ['Double A', 'Real Estate', 'All Holding', 'Logistic', 'Power', 'NPS', 'IMP', 'IT'];
const DEFAULT_TEAMS = ['IMP', 'IMP&IT', 'IT'];

/* ── Helpers ── */
function getStatusIcon(status: ProjectStatus) {
  return STATUS_CONFIG[status]?.icon || '•';
}
function getStatusColor(status: ProjectStatus) {
  return STATUS_CONFIG[status]?.color || 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300 border-slate-200 dark:border-slate-500/25';
}
export function sanitizeProjectName(name: string): string {
  if (!name) return '';
  const clean = name.split(/<br\s*\/?>|\n/i)[0].replace(/<[^>]+>/g, '').trim();
  return clean || name;
}

/* ── Build tree from flat list ── */
function buildTree(projects: Project[]): Project[] {
  const map = new Map<string, Project>();
  const roots: Project[] = [];

  projects.forEach(p => {
    map.set(p.id, { ...p, children: [] });
  });

  projects.forEach(p => {
    const node = map.get(p.id)!;
    if (p.parent_project_id && map.has(p.parent_project_id)) {
      map.get(p.parent_project_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}


/* ── Types ── */
const STATUS_ORDER: ProjectStatus[] = ['active', 'in_progress', 'testing', 'development', 'completed', 'on_hold', 'inactive', 'planning', 'sunset', 'retired'];

/* ── StatusBadge (top-level for stable identity) ── */
function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide',
      getStatusColor(status)
    )}>
      <span>{getStatusIcon(status)}</span>
      <span>{STATUS_CONFIG[status]?.label || status}</span>
    </span>
  );
}

/* ── ProjectCard props ── */
interface ProjectCardProps {
  project: Project;
  depth?: number;
  isLast?: boolean;
  expandedProjects: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onViewLog: (log: any) => void;
  onOpenNotes: (project: Project) => void;
  onOpenDocs: (project: Project) => void;
  onOpenSecrets: (project: Project) => void;
}

/* ── ProjectCard (top-level for stable identity) ── */
function ProjectCard({
  project,
  depth = 0,
  expandedProjects,
  onToggleExpand,
  onEdit,
  onDelete,
  onViewLog,
  onOpenNotes,
  onOpenDocs,
  onOpenSecrets,
}: ProjectCardProps) {
  const hasChildren = project.children && project.children.length > 0;
  const isExpanded = expandedProjects.has(project.id);
  const totalWorklogs = project.worklog_count || 0;
  const recentWorklogs = project.worklog_recent || 0;
  const recentLogs = project.recentLogs || [];
  const isChild = depth > 0;

  return (
    <div className="relative">
      {isChild && (
        <div
          className="absolute border-indigo-400/50 dark:border-indigo-500/40"
          style={{
            left: -26, top: 22, width: 26, height: 2,
            borderTopWidth: 0, borderBottomWidth: 2, borderBottomStyle: 'solid',
            borderLeftWidth: 2, borderLeftStyle: 'solid', borderRadius: '0 0 0 6px',
          }}
        />
      )}

      <div className={cn(
        'group transition-all duration-200 mb-2',
        isChild
          ? 'p-3.5 md:p-4 rounded-xl border border-indigo-200/70 dark:border-indigo-900/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/20 to-purple-50/20 dark:from-slate-900/60 dark:via-indigo-950/30 dark:to-slate-900/60 shadow-sm border-l-[4px]'
          : 'ai-glass-interactive p-4 md:p-5 rounded-2xl border border-theme-border/90 bg-white/95 dark:bg-theme-surface shadow-md shadow-indigo-500/5 border-l-[5px]',
        project.status === 'active'      && 'border-l-emerald-500',
        project.status === 'in_progress' && 'border-l-indigo-500',
        project.status === 'testing'     && 'border-l-fuchsia-500',
        project.status === 'development' && 'border-l-amber-500',
        project.status === 'completed'   && 'border-l-teal-500',
        project.status === 'on_hold'     && 'border-l-slate-500',
        project.status === 'inactive'    && 'border-l-slate-400',
        project.status === 'sunset'      && 'border-l-orange-500',
        project.status === 'retired'     && 'border-l-rose-500',
        project.status === 'planning'    && 'border-l-blue-500',
      )}>
        {/* Row 1: Identity */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {hasChildren && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); onToggleExpand(project.id); }}
                  className="p-1 rounded-lg bg-theme-surface-secondary hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-600 transition-colors shrink-0 border border-theme-border"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              {isChild && (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2 py-0.5 flex items-center gap-1 shrink-0">
                  <Layers size={10} /> Sub-module
                </span>
              )}
              <h3 className={cn('font-bold text-theme-text truncate', isChild ? 'text-xs text-indigo-950 dark:text-indigo-200' : 'text-sm')}>
                {project.project_name}
              </h3>
              <StatusBadge status={project.status} />
              {project.project_type && (
                <span className="text-[10px] font-mono text-theme-text-muted border border-theme-border rounded px-1.5 py-0.5">
                  {TYPE_ICONS[project.project_type] || ''} {project.project_type}
                </span>
              )}
              {project.module && (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded px-1.5 py-0.5">
                  📦 {project.module}
                </span>
              )}
              {project.worklog_project_type && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded px-1.5 py-0.5">
                  🎯 {project.worklog_project_type}
                </span>
              )}
            </div>

            {project.description && (
              <p className={cn('text-theme-text-secondary line-clamp-2', isChild ? 'text-[11px] mt-1' : 'text-xs mt-1.5')}>
                {project.description}
              </p>
            )}

            {project.parent_name && !isChild && (
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-theme-text-muted">
                <FolderOpen size={12} />
                <span>Parent: <strong className="text-theme-text-secondary">{project.parent_name}</strong></span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onOpenSecrets(project)}
              className="p-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all flex items-center gap-1 text-xs font-semibold px-2"
              title="ดูและจัดการ In-App Project Secrets / Environment Variables"
            >
              <Key size={13} />
              <span className="text-[11px]">Secrets</span>
              {project.secrets_count ? (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white font-bold">
                  {project.secrets_count}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => onOpenDocs(project)}
              className="p-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-all flex items-center gap-1 text-xs font-semibold px-2"
              title="ดูและจัดการเอกสาร System Blueprints / User Manuals"
            >
              <FileCode size={13} />
              <span className="text-[11px]">Docs</span>
              {project.documents_count ? (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-600 text-white font-bold">
                  {project.documents_count}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => onOpenNotes(project)}
              className="p-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition-all flex items-center gap-1 text-xs font-semibold px-2"
              title="ดูและเพิ่มบันทึก Internal Logs / WI"
            >
              <FileText size={13} />
              <span className="text-[11px]">Notes</span>
              {project.notes_count ? (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-600 text-white font-bold">
                  {project.notes_count}
                </span>
              ) : null}
            </button>
            {project.deploy_url && (
              <a
                href={project.deploy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg border border-theme-border bg-theme-surface-secondary hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-theme-text-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
                title="Open project"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <button
              type="button"
              onClick={() => onEdit(project)}
              className="p-1.5 rounded-lg border border-theme-border bg-theme-surface-secondary hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(project)}
              className="p-1.5 rounded-lg border border-theme-border bg-theme-surface-secondary hover:bg-rose-50 dark:hover:bg-rose-500/10 text-theme-text-muted hover:text-rose-600 dark:hover:text-rose-400 transition-all"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Metadata + Worklog Stats */}
        <div className="flex items-center gap-4 md:gap-6 mt-3 pt-3 border-t border-theme-border/50 flex-wrap text-[11px]">
          {project.owner_holding && (
            <span className="flex items-center gap-1 text-theme-text-muted">
              <Building2 size={12} />
              <span>{project.owner_holding}</span>
            </span>
          )}
          {project.owner_team && (
            <span className="flex items-center gap-1 text-theme-text-muted">
              <Users size={12} />
              <span>{project.owner_team}</span>
            </span>
          )}
          {project.hosting_provider && (
            <span className="flex items-center gap-1 text-theme-text-muted" title="Hosting Provider">
              <Server size={12} />
              <span>{project.hosting_provider}</span>
            </span>
          )}
          {project.admin_email && (
            <span className="flex items-center gap-1 text-theme-text-muted" title="Admin Account">
              <Mail size={12} />
              <span>{project.admin_email}</span>
            </span>
          )}
          {project.database_info && (
            <span className="flex items-center gap-1 text-theme-text-muted" title="Database">
              <Database size={12} />
              <span>{project.database_info}</span>
            </span>
          )}
          {project.vault_url && (
            <a
              href={project.vault_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-amber-500 hover:underline font-semibold"
              title="Open Secrets Vault"
            >
              <Key size={12} />
              <span>Secrets Vault</span>
            </a>
          )}
          {project.github_repo_url && (
            <a
              href={project.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              title="GitHub Repository"
            >
              <GitBranch size={12} />
              <span className="truncate max-w-[200px]">Repository</span>
            </a>
          )}
          {project.deploy_url && (
            <a
              href={project.deploy_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              <Link size={12} />
              <span className="truncate max-w-[200px]">{project.deploy_url}</span>
            </a>
          )}
          {totalWorklogs > 0 && (
            <>
              <span className="flex items-center gap-1 text-theme-text-muted">
                <Activity size={12} />
                <span>ทั้งหมด <strong className="text-theme-text-secondary">{totalWorklogs.toLocaleString()}</strong> เวิร์คล็อก</span>
              </span>
              <span className={cn('flex items-center gap-1', recentWorklogs > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
                <Clock size={12} />
                <span>30 วัน: <strong>{recentWorklogs}</strong> รายการ</span>
              </span>
              {recentLogs.length > 0 && (
                <span className="flex items-center gap-1.5 border border-theme-border bg-theme-surface-secondary/40 py-0.5 px-2 rounded-full shrink-0">
                  <span className="text-theme-text-muted text-[10px] uppercase font-bold tracking-wider mr-1">ล่าสุด:</span>
                  <span className="flex items-center gap-1">
                    {recentLogs.map((log: any, idx: number) => {
                      const formattedDate = log.work_date
                        ? new Date(log.work_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                        : '';
                      const descSnippet = log.description
                        ? (log.description.length > 150 ? log.description.slice(0, 150) + '...' : log.description)
                        : 'ไม่มีรายละเอียด';
                      const tooltipText = `วันที่: ${formattedDate}\nกิจกรรม: ${log.action_name}\nรายละเอียด:\n${descSnippet}`;
                      return (
                        <button
                          key={log.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onViewLog(log); }}
                          className="w-5 h-5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 border border-indigo-500/25 transition-all flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                          title={tooltipText}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </span>
                </span>
              )}
            </>
          )}
          {project.go_live_date && (
            <span className="flex items-center gap-1 text-theme-text-muted">
              <Calendar size={12} />
              <span>Go-live: {project.go_live_date}</span>
            </span>
          )}
          {project.last_verified_date && (
            <span className="flex items-center gap-1 text-theme-text-muted">
              <Check size={12} />
              <span>ยืนยันล่าสุด: {project.last_verified_date}</span>
            </span>
          )}
        </div>

        {project.last_usage_note && (
          <div className="mt-2 text-[11px] text-theme-text-secondary italic bg-theme-surface-secondary/50 rounded-lg px-3 py-1.5 border border-theme-border/50">
            📝 {project.last_usage_note}
          </div>
        )}

        {project.credentials_ref_note && (
          <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/5 rounded-lg px-3 py-1.5 border border-amber-500/20 flex items-start gap-2">
            <Key size={12} className="mt-0.5 shrink-0" />
            <div>
              <strong className="font-semibold block md:inline md:mr-1">Credentials Access:</strong>
              <span>{project.credentials_ref_note}</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded children with vertical guide line */}
      {hasChildren && isExpanded && (
        <div className="relative ml-8 md:ml-12 mt-2 space-y-2">
          <div
            className="absolute top-0 bottom-6 border-l-2 border-indigo-400/40 dark:border-indigo-500/40 rounded-full"
            style={{ left: -26 }}
          />
          {project.children!.map((child, childIdx) => (
            <ProjectCard
              key={child.id}
              project={child}
              depth={depth + 1}
              isLast={childIdx === project.children!.length - 1}
              expandedProjects={expandedProjects}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewLog={onViewLog}
              onOpenNotes={onOpenNotes}
              onOpenDocs={onOpenDocs}
              onOpenSecrets={onOpenSecrets}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function ProjectRegistryPage() {
  const navigate = useNavigate();
  const { showToast, showConfirm } = useNotification();

  /* ── State ── */
  const [projects, setProjects] = useState<Project[]>([]);
  const [worklogSummary, setWorklogSummary] = useState<WorklogSummary>({});
  const [workspaceProjectTypes, setWorkspaceProjectTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterHolding, setFilterHolding] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'tree' | 'status'>('tree');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedWorklog, setSelectedWorklog] = useState<any | null>(null);

  // Notes & Documents & Secrets state
  const [notesCountMap, setNotesCountMap] = useState<Record<string, number>>({});
  const [notesProject, setNotesProject] = useState<Project | null>(null);
  const [isExportNotesOpen, setIsExportNotesOpen] = useState(false);
  const [docsCountMap, setDocsCountMap] = useState<Record<string, number>>({});
  const [docsModalProject, setDocsModalProject] = useState<Project | null>(null);
  const [secretsCountMap, setSecretsCountMap] = useState<Record<string, number>>({});
  const [secretsModalProject, setSecretsModalProject] = useState<Project | null>(null);

  /* ── Data Loading ── */
  const loadProjectStats = useCallback(async (workspaceId?: string | null) => {
    try {
      setNotesCountMap({});
      setDocsCountMap({});
      setSecretsCountMap({});
      setWorklogSummary({});

      let notesQuery = supabase.from('tb_project_notes').select('project_id');
      let docsQuery = supabase.from('tb_project_documents').select('project_id');
      let secretsQuery = supabase.from('tb_project_secrets').select('project_id');
      let worklogQuery = supabase
        .from('col_worklog')
        .select('id, project_id, module_id, work_date, created_at, action_name, description')
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (workspaceId) {
        notesQuery = notesQuery.eq('workspace_id', workspaceId);
        docsQuery = docsQuery.eq('workspace_id', workspaceId);
        secretsQuery = secretsQuery.eq('workspace_id', workspaceId);
        worklogQuery = worklogQuery.eq('workspace_id', workspaceId);
      }

      const [notesRes, docsRes, secretsRes, worklogRes] = await Promise.all([
        notesQuery,
        docsQuery,
        secretsQuery,
        worklogQuery,
      ]);

      const countByProjectId = (rows?: ProjectCountRow[] | null) => {
        const counts: Record<string, number> = {};
        (rows || []).forEach((row) => {
          if (row.project_id) counts[row.project_id] = (counts[row.project_id] || 0) + 1;
        });
        return counts;
      };

      if (notesRes.data) setNotesCountMap(countByProjectId(notesRes.data as ProjectCountRow[]));
      if (docsRes.data) setDocsCountMap(countByProjectId(docsRes.data as ProjectCountRow[]));
      if (secretsRes.data) setSecretsCountMap(countByProjectId(secretsRes.data as ProjectCountRow[]));

      if (!worklogRes.error && worklogRes.data) {
        const summary: WorklogSummary = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const count: Record<string, number> = {};
        const recent: Record<string, number> = {};
        const logsMap: Record<string, RegistryWorklogSummaryRow[]> = {};

        (worklogRes.data as RegistryWorklogSummaryRow[]).forEach((w) => {
          const id = w.module_id || w.project_id;
          if (!id) return;

          count[id] = (count[id] || 0) + 1;

          const createdAt = new Date(w.created_at || w.work_date || '');
          if (!Number.isNaN(createdAt.getTime()) && createdAt >= thirtyDaysAgo) {
            recent[id] = (recent[id] || 0) + 1;
          }

          if (!logsMap[id]) logsMap[id] = [];
          if (logsMap[id].length < 3) logsMap[id].push(w);
        });

        Object.keys(count).forEach((id) => {
          summary[id] = {
            count: count[id],
            recent_30d: recent[id] || 0,
            unique_users: 0,
            logs: logsMap[id] || [],
          };
        });

        setWorklogSummary(summary);
      } else if (worklogRes.error) {
        console.warn('Project Registry worklog summary failed:', worklogRes.error.message);
      }
    } catch (err) {
      console.warn('Project Registry background stats failed:', err);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const sessionStr = localStorage.getItem('worklog_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const workspaceId = session?.activeWorkspaceId;

      const projectTypesPromise = workspaceId
        ? supabase
          .from('tb_master_project_type')
          .select('type_name')
          .eq('workspace_id', workspaceId)
          .order('type_name')
        : Promise.resolve({ data: null, error: null });

      let query = supabase
        .from('tb_project_registry')
        .select('*, parent:parent_project_id(project_name)');

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const [typesRes, projectsRes] = await Promise.all([
        projectTypesPromise,
        query.order('project_name'),
      ]);

      if (typesRes.data && typesRes.data.length > 0) {
        setWorkspaceProjectTypes((typesRes.data as ProjectTypeRow[]).map((t) => t.type_name).filter(Boolean) as string[]);
      } else {
        setWorkspaceProjectTypes(['Project', 'Support', 'Management', 'Event', 'Routine', 'Other']);
      }

      if (projectsRes.error) throw projectsRes.error;

      const mapped: Project[] = ((projectsRes.data || []) as ProjectRegistryRow[]).map((p) => ({
        ...p,
        project_name: sanitizeProjectName(p.project_name),
        parent_name: p.parent?.project_name ? sanitizeProjectName(p.parent.project_name) : null,
        children: [],
      }));

      setProjects(mapped);
      setIsLoading(false);
      void loadProjectStats(workspaceId);
    } catch (err: any) {
      showToast('โหลดข้อมูลโปรเจคล้มเหลว: ' + (err.message || err), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [loadProjectStats, showToast]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadProjects();
    });
  }, [loadProjects]);

  /* ── Derived Data ── */
  const projectsWithStats = useMemo(() => {
    const memo = new Map<string, { count: number; recent_30d: number; logs: any[] }>();

    const getStats = (id: string): { count: number; recent_30d: number; logs: any[] } => {
      if (memo.has(id)) return memo.get(id)!;

      const direct = worklogSummary[id];
      let count = direct?.count || 0;
      let recent_30d = direct?.recent_30d || 0;
      let logs = direct?.logs ? [...direct.logs] : [];

      const children = projects.filter(p => p.parent_project_id === id);
      children.forEach(child => {
        const childStats = getStats(child.id);
        count += childStats.count;
        recent_30d += childStats.recent_30d;
        logs = [...logs, ...childStats.logs];
      });

      // Sort logs by work_date desc, created_at desc
      logs.sort((a, b) => {
        const dateA = a.work_date || '';
        const dateB = b.work_date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.created_at || '').localeCompare(a.created_at || '');
      });

      const result = { count, recent_30d, logs: logs.slice(0, 3) };
      memo.set(id, result);
      return result;
    };

    return projects.map(p => {
      const stats = getStats(p.id);
      return {
        ...p,
        worklog_count: stats.count,
        worklog_recent: stats.recent_30d,
        recentLogs: stats.logs,
        notes_count: notesCountMap[p.id] || 0,
        documents_count: docsCountMap[p.id] || 0,
        secrets_count: secretsCountMap[p.id] || 0,
      };
    });
  }, [projects, worklogSummary, notesCountMap, docsCountMap, secretsCountMap]);

  const filteredProjects = useMemo(() => {
    let list = projectsWithStats;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.project_name.toLowerCase().includes(q) ||
        (p.module || '').toLowerCase().includes(q) ||
        (p.owner_holding || '').toLowerCase().includes(q) ||
        (p.owner_team || '').toLowerCase().includes(q) ||
        (p.project_type || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') {
      list = list.filter(p => p.status === filterStatus);
    }
    if (filterTeam !== 'all') {
      list = list.filter(p => p.owner_team === filterTeam);
    }
    if (filterHolding !== 'all') {
      list = list.filter(p => p.owner_holding === filterHolding);
    }
    if (filterType !== 'all') {
      list = list.filter(p => p.project_type === filterType);
    }

    return list;
  }, [projectsWithStats, searchQuery, filterStatus, filterTeam, filterHolding, filterType]);

  const treeData = useMemo(() => buildTree(filteredProjects), [filteredProjects]);

  const groupedByStatus = useMemo(() => {
    const groups: Record<string, Project[]> = {};
    filteredProjects.forEach(p => {
      const s = p.status || 'planning';
      if (!groups[s]) groups[s] = [];
      groups[s].push(p);
    });
    return groups;
  }, [filteredProjects]);

  const holdings = useMemo(() => {
    const set = new Set<string>(DEFAULT_HOLDINGS);
    projects.forEach(p => { if (p.owner_holding) set.add(p.owner_holding); });
    return Array.from(set).sort();
  }, [projects]);

  const teams = useMemo(() => {
    const set = new Set<string>(DEFAULT_TEAMS);
    projects.forEach(p => { if (p.owner_team) set.add(p.owner_team); });
    return Array.from(set).sort();
  }, [projects]);

  const types = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (p.project_type) set.add(p.project_type); });
    return Array.from(set).sort();
  }, [projects]);

  const parentOptions = useMemo(() => {
    return projects.filter(p => p.id !== editingProject?.id);
  }, [projects, editingProject]);

  /* ── Modal Actions ── */
  const openAddModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: any) => {
    try {
      const sessionStr = localStorage.getItem('worklog_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const workspaceId = session?.activeWorkspaceId;

      if (editingProject) {
        const { error } = await supabase
          .from('tb_project_registry')
          .update(payload)
          .eq('id', editingProject.id)
          .eq('workspace_id', workspaceId);

        if (error) throw error;
        showToast(`อัปเดต "${payload.project_name}" สำเร็จ ✅`, 'success');
      } else {
        const { error } = await supabase
          .from('tb_project_registry')
          .insert({
            ...payload,
            workspace_id: workspaceId
          });

        if (error) throw error;
        showToast(`เพิ่ม "${payload.project_name}" สำเร็จ ✅`, 'success');
      }

      setIsModalOpen(false);
      loadProjects();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + (err.message || err), 'error');
      throw err;
    }
  };

  const handleDeleteClick = async (project: Project) => {
    const sessionStr = localStorage.getItem('worklog_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบโปรเจค',
      message:
        `คุณกำลังจะลบโปรเจค:\n` +
        `• ชื่อ: "${project.project_name}"\n` +
        `• Workspace: ${project.workspace_id === session?.activeWorkspaceId ? (session?.workspaceName || project.workspace_id) : (project.workspace_id || 'ไม่ระบุ')}\n\n` +
        `การกระทำนี้ไม่สามารถย้อนกลับได้`,
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      // Check for children
      const { data: children } = await supabase
        .from('tb_project_registry')
        .select('id')
        .eq('parent_project_id', project.id);

      if (children && children.length > 0) {
        const ok = await showConfirm({
          title: 'ยืนยันการลบ',
          message: `โปรเจค "${project.project_name}" มีโปรเจคย่อย ${children.length} รายการ\n\nยืนยันลบ? (โปรเจคย่อยจะถูกยกให้เป็น top-level)`,
          type: 'danger'
        });
        if (!ok) return;
      }

      let deleteQuery = supabase
        .from('tb_project_registry')
        .delete()
        .eq('id', project.id);

      if (project.workspace_id) {
        deleteQuery = deleteQuery.eq('workspace_id', project.workspace_id);
      }

      const { error } = await deleteQuery;

      if (error) throw error;

      showToast(`ลบ "${project.project_name}" สำเร็จ`, 'success');
      loadProjects();
    } catch (err: any) {
      showToast('ลบไม่สำเร็จ: ' + (err.message || err), 'error');
    }
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ── Status summary stats ── */
  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      const s = p.status || 'planning';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [projects]);

  /* ── Stable callbacks for ProjectCard (useCallback avoids unnecessary re-renders) ── */
  const handleEditProject = useCallback((project: Project) => openEditModal(project), []);
  const handleDeleteProject = useCallback((project: Project) => handleDeleteClick(project), []);
  const handleViewLog = useCallback(async (log: any) => {
    if (!log?.id) {
      setSelectedWorklog(log);
      return;
    }

    const { data, error } = await supabase
      .from('col_worklog')
      .select('*')
      .eq('id', log.id)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load full worklog detail:', error.message);
      setSelectedWorklog(log);
      return;
    }

    setSelectedWorklog(data || log);
  }, []);
  const handleOpenNotes = useCallback((project: Project) => setNotesProject(project), []);

  /* ── Render ── */
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-theme-text tracking-tight flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
                <FolderTree size={18} />
              </div>
              <span className="theme-heading-gradient">Project Registry</span>
            </h1>
            <p className="text-xs text-theme-text-muted mt-1 ml-12">
              จัดการพอร์ตโฟลิโอโปรเจค — สถานะ, ลำดับชั้น, URL, และปริมาณการใช้งาน
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/projects/gantt')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="เปิดดูแผนภูมิแกนต์และพอร์ตโฟลิโอ"
            >
              <FolderKanban size={16} />
              <span>Gantt Roadmap</span>
            </button>
            <button
              onClick={() => setIsExportNotesOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-theme-text border border-theme-border bg-theme-surface-secondary hover:bg-theme-surface-tertiary shadow-sm transition-all active:scale-95 cursor-pointer"
              title="สรุปและส่งออก Notes ทั้งหมด"
            >
              <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span>Notes Summary</span>
            </button>
            <button
              onClick={openAddModal}
              className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Project</span>
            </button>
          </div>
        </div>


        {/* ── Status Summary Bar ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {STATUS_ORDER.map(s => (
            <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface-secondary/70 border border-theme-border/80 text-[11px] font-semibold">
              <span>{STATUS_CONFIG[s].icon}</span>
              <span className="text-theme-text-secondary">{STATUS_CONFIG[s].label}</span>
              <span className="text-theme-text font-black">{(statusSummary[s] || 0)}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
            <FolderTree size={12} />
            <span>รวม {projects.length} โปรเจค</span>
          </div>
        </div>

        {/* ── Search & Filters ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาโปรเจค ชื่อ, module, holding..."
              className="w-full theme-field pl-9 pr-4 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="theme-field px-3.5 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
          >
            <option value="all">🏳️ All Status</option>
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <select
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            className="theme-field px-3.5 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
          >
            <option value="all">👥 All Teams</option>
            {teams.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterHolding}
            onChange={e => setFilterHolding(e.target.value)}
            className="theme-field px-3.5 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
          >
            <option value="all">🏢 All Holdings</option>
            {holdings.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="theme-field px-3.5 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
          >
            <option value="all">📦 All Types</option>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="flex items-center bg-theme-surface-secondary rounded-xl border border-theme-border p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('status')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                viewMode === 'status'
                  ? 'bg-white dark:bg-theme-surface text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-500/20'
                  : 'text-theme-text-muted hover:text-theme-text'
              )}
            >
              <Activity size={13} className="inline mr-1" />
              Status
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                viewMode === 'tree'
                  ? 'bg-white dark:bg-theme-surface text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-500/20'
                  : 'text-theme-text-muted hover:text-theme-text'
              )}
            >
              <FolderTree size={13} className="inline mr-1" />
              Tree
            </button>
          </div>
          <button
            onClick={loadProjects}
            className="p-2.5 rounded-xl border border-theme-border bg-theme-surface-secondary hover:bg-theme-surface-tertiary text-theme-text-muted hover:text-theme-text transition-all"
            title="Refresh"
          >
            <RefreshCw size={15} className={cn(isLoading && 'animate-spin')} />
          </button>
          {/* Mobile add button */}
          <button
            onClick={openAddModal}
            className="md:hidden p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-theme-text-muted">
              <RefreshCw size={28} className="animate-spin text-indigo-500" />
              <span className="text-sm font-semibold">กำลังโหลดข้อมูลโปรเจค...</span>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-theme-surface-tertiary border border-theme-border flex items-center justify-center mb-4">
              <FolderTree size={28} className="text-theme-text-muted" />
            </div>
            <h3 className="text-base font-bold text-theme-text mb-1">ไม่พบโปรเจค</h3>
            <p className="text-xs text-theme-text-muted mb-4">
              {searchQuery ? 'ลองเปลี่ยนคำค้นหา' : 'ยังไม่มีโปรเจคในระบบ คลิก Add Project เพื่อเพิ่ม'}
            </p>
            {!searchQuery && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/25 transition-all"
              >
                <Plus size={16} /> Add First Project
              </button>
            )}
          </div>
        ) : viewMode === 'tree' ? (
          /* ── Tree View ── */
          <div className="space-y-1">
            {treeData.map(root => (
              <ProjectCard
                key={root.id}
                project={root}
                depth={0}
                expandedProjects={expandedProjects}
                onToggleExpand={toggleExpand}
                onEdit={handleEditProject}
                onDelete={handleDeleteProject}
                onViewLog={handleViewLog}
                onOpenNotes={handleOpenNotes}
                onOpenDocs={setDocsModalProject}
                onOpenSecrets={setSecretsModalProject}
              />
            ))}
          </div>
        ) : (
          /* ── Status Grouped View ── */
          <div className="space-y-6">
            {STATUS_ORDER.filter(s => groupedByStatus[s]?.length > 0).map(status => (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{STATUS_CONFIG[status].icon}</span>
                  <h2 className="text-sm font-bold text-theme-text">
                    {STATUS_CONFIG[status].label}
                  </h2>
                  <span className="text-[11px] font-mono text-theme-text-muted bg-theme-surface-secondary px-2 py-0.5 rounded-full border border-theme-border">
                    {groupedByStatus[status].length}
                  </span>
                </div>
                <div className="space-y-1">
                  {groupedByStatus[status].map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      depth={0}
                      expandedProjects={expandedProjects}
                      onToggleExpand={toggleExpand}
                      onEdit={handleEditProject}
                      onDelete={handleDeleteProject}
                      onViewLog={handleViewLog}
                      onOpenNotes={handleOpenNotes}
                      onOpenDocs={setDocsModalProject}
                      onOpenSecrets={setSecretsModalProject}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      <ProjectFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProject={editingProject}
        holdings={holdings}
        teams={teams}
        parentOptions={parentOptions}
        workspaceProjectTypes={workspaceProjectTypes}
        onSave={handleSave}
      />

      {/* ── View Worklog Modal ── */}
      <ViewWorklogModal
        isOpen={!!selectedWorklog}
        onClose={() => setSelectedWorklog(null)}
        log={selectedWorklog}
        onDeleteSuccess={loadProjects}
      />

      {/* ── Project Notes Modal ── */}
      <ProjectNotesModal
        isOpen={!!notesProject}
        onClose={() => setNotesProject(null)}
        project={notesProject}
        onNotesUpdated={loadProjects}
      />

      {/* ── Project Notes Export Modal ── */}
      <ProjectNotesExportModal
        isOpen={isExportNotesOpen}
        onClose={() => setIsExportNotesOpen(false)}
        projects={projects}
      />

      {/* ── Project Documents Modal ── */}
      {docsModalProject && (
        <ProjectDocumentsModal
          isOpen={!!docsModalProject}
          onClose={() => setDocsModalProject(null)}
          project={{
            id: docsModalProject.id,
            project_name: docsModalProject.project_name,
            workspace_id: docsModalProject.workspace_id || ''
          }}
          sessionUser={(() => {
            try {
              const s = localStorage.getItem('worklog_session');
              return s ? JSON.parse(s) : null;
            } catch { return null; }
          })()}
        />
      )}

      {/* ── Project Secrets Modal ── */}
      {secretsModalProject && (
        <ProjectSecretsModal
          isOpen={!!secretsModalProject}
          onClose={() => setSecretsModalProject(null)}
          project={{
            id: secretsModalProject.id,
            project_name: secretsModalProject.project_name,
            workspace_id: secretsModalProject.workspace_id || ''
          }}
          sessionUser={(() => {
            try {
              const s = localStorage.getItem('worklog_session');
              return s ? JSON.parse(s) : null;
            } catch { return null; }
          })()}
        />
      )}


      {/* ── Mobile FAB ── */}
      <button
        onClick={openAddModal}
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center active:scale-90 transition-transform"
      >
        <Plus size={24} />
      </button>
    </AppLayout>
  );
}

/* ── Form Modal Component (Extracted to top-level for performance & focus) ── */
interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProject: Project | null;
  holdings: string[];
  teams: string[];
  parentOptions: Project[];
  workspaceProjectTypes: string[];
  onSave: (payload: any) => Promise<void>;
}

const ProjectFormModal = ({
  isOpen,
  onClose,
  editingProject,
  holdings,
  teams,
  parentOptions,
  workspaceProjectTypes,
  onSave,
}: ProjectFormModalProps) => {
  const { showToast } = useNotification();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    project_name: '',
    description: '',
    parent_project_id: '',
    module: '',
    status: 'planning' as ProjectStatus,
    project_type: 'web_app',
    owner_holding: '',
    owner_team: '',
    deploy_url: '',
    go_live_date: '',
    last_verified_date: '',
    last_usage_note: '',
    worklog_project_type: '',
    hosting_provider: '',
    admin_email: '',
    database_info: '',
    github_repo_url: '',
    credentials_ref_note: '',
    vault_url: '',
  });

  // ── Searchable combobox state ──
  const [nameQuery, setNameQuery] = useState('');
  const [showNameDrop, setShowNameDrop] = useState(false);
  const [worklogOptions, setWorklogOptions] = useState<{ project_name: string; module: string | null }[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Searchable parent project combobox state ──
  const [parentQuery, setParentQuery] = useState('');
  const [showParentDrop, setShowParentDrop] = useState(false);
  const parentInputRef = useRef<HTMLInputElement>(null);
  const parentDropRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        nameInputRef.current && !nameInputRef.current.contains(e.target as Node)
      ) {
        setShowNameDrop(false);
      }
      if (
        parentDropRef.current && !parentDropRef.current.contains(e.target as Node) &&
        parentInputRef.current && !parentInputRef.current.contains(e.target as Node)
      ) {
        setShowParentDrop(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch unique project_name + module pairs from col_worklog AND tb_map_project_structure once when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const fetch = async () => {
      const sessionStr = localStorage.getItem('worklog_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const workspaceId = session?.activeWorkspaceId;

      let wQuery = supabase
        .from('col_worklog')
        .select('project_name, module');

      let sQuery = supabase
        .from('tb_map_project_structure')
        .select('project_name, module');

      if (workspaceId) {
        wQuery = wQuery.eq('workspace_id', workspaceId);
        sQuery = sQuery.eq('workspace_id', workspaceId);
      }

      const [wRes, sRes] = await Promise.all([wQuery, sQuery]);
      const combined = [...(wRes.data || []), ...(sRes.data || [])];

      if (combined.length > 0) {
        // Deduplicate by (project_name + module)
        const seen = new Set<string>();
        const unique: { project_name: string; module: string | null }[] = [];
        combined.forEach((row: any) => {
          if (!row.project_name) return;
          const nameTrimmed = sanitizeProjectName(row.project_name);
          const moduleTrimmed = row.module ? row.module.trim() : null;
          const key = `${nameTrimmed}||${moduleTrimmed || ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push({ project_name: nameTrimmed, module: moduleTrimmed });
          }
        });
        // Sort: project_name asc, then module asc
        unique.sort((a, b) => {
          if (a.project_name !== b.project_name) return a.project_name.localeCompare(b.project_name);
          return (a.module || '').localeCompare(b.module || '');
        });
        setWorklogOptions(unique);
      }
    };
    fetch();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const name = editingProject?.project_name || '';
      const parentId = editingProject?.parent_project_id || '';
      const parentObj = parentOptions.find(p => p.id === parentId);

      setFormData({
        project_name: name,
        description: editingProject?.description || '',
        parent_project_id: parentId,
        module: editingProject?.module || '',
        status: editingProject?.status || 'planning',
        project_type: editingProject?.project_type || 'web_app',
        owner_holding: editingProject?.owner_holding || '',
        owner_team: editingProject?.owner_team || '',
        deploy_url: editingProject?.deploy_url || '',
        go_live_date: editingProject?.go_live_date || '',
        last_verified_date: editingProject?.last_verified_date || '',
        last_usage_note: editingProject?.last_usage_note || '',
        worklog_project_type: editingProject?.worklog_project_type || '',
        hosting_provider: editingProject?.hosting_provider || '',
        admin_email: editingProject?.admin_email || '',
        database_info: editingProject?.database_info || '',
        github_repo_url: editingProject?.github_repo_url || '',
        credentials_ref_note: editingProject?.credentials_ref_note || '',
        vault_url: editingProject?.vault_url || '',
      });
      setNameQuery(name);
      setParentQuery(parentObj ? parentObj.project_name : '');
    }
  }, [isOpen, editingProject, parentOptions]);

  // Filtered options for comboboxes
  const filteredNameOptions = nameQuery.trim().length === 0
    ? worklogOptions
    : worklogOptions.filter(opt =>
        opt.project_name.toLowerCase().includes(nameQuery.toLowerCase()) ||
        (opt.module || '').toLowerCase().includes(nameQuery.toLowerCase())
      );

  const topLevelParentOptions = useMemo(() => {
    return parentOptions.filter(p => !p.parent_project_id);
  }, [parentOptions]);

  const filteredParentOptions = useMemo(() => {
    if (!parentQuery.trim()) return topLevelParentOptions;
    const q = parentQuery.toLowerCase();
    return topLevelParentOptions.filter(p => p.project_name.toLowerCase().includes(q));
  }, [topLevelParentOptions, parentQuery]);

  if (!isOpen) return null;

  const handleLocalSave = async () => {
    if (!formData.project_name.trim()) {
      showToast('กรุณาใส่ชื่อโปรเจค', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        project_name: formData.project_name.trim(),
        description: formData.description.trim() || null,
        parent_project_id: formData.parent_project_id || null,
        module: formData.module.trim() || null,
        status: formData.status,
        project_type: formData.project_type,
        owner_holding: formData.owner_holding.trim() || null,
        owner_team: formData.owner_team.trim() || null,
        deploy_url: formData.deploy_url.trim() || null,
        go_live_date: formData.go_live_date || null,
        last_verified_date: formData.last_verified_date || null,
        last_usage_note: formData.last_usage_note.trim() || null,
        worklog_project_type: formData.parent_project_id ? (formData.worklog_project_type || null) : null,
        hosting_provider: formData.hosting_provider.trim() || null,
        admin_email: formData.admin_email.trim() || null,
        database_info: formData.database_info.trim() || null,
        github_repo_url: formData.github_repo_url.trim() || null,
        credentials_ref_note: formData.credentials_ref_note.trim() || null,
        vault_url: formData.vault_url.trim() || null,
      };
      await onSave(payload);
    } catch (err: any) {
      // Error is already toasted by parent handler
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 md:pt-12 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 theme-panel border border-theme-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-lg">
              {editingProject ? <Edit2 size={16} /> : <Plus size={16} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-theme-text">
                {editingProject ? 'แก้ไขโปรเจค' : 'เพิ่มโปรเจคใหม่'}
              </h2>
              <p className="text-[11px] text-theme-text-muted">
                {editingProject ? 'แก้ไขรายละเอียดโปรเจค' : 'เพิ่มโปรเจคเข้าสู่ Portfolio'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-theme-surface-tertiary text-theme-text-muted hover:text-theme-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Basic Info */}
          <div>
            <h3 className="text-xs font-bold text-theme-text tracking-wide mb-3 uppercase">ข้อมูลพื้นฐาน</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">
                  ชื่อโปรเจค *
                  <span className="ml-2 text-indigo-400 font-normal normal-case">
                    — ค้นหาจาก Worklog ({worklogOptions.length} รายการ)
                  </span>
                </label>
                {/* ── Searchable Combobox ── */}
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    value={nameQuery}
                    onChange={e => {
                      const v = e.target.value;
                      setNameQuery(v);
                      setFormData(p => ({ ...p, project_name: v }));
                      setShowNameDrop(true);
                    }}
                    onFocus={() => setShowNameDrop(true)}
                    placeholder="พิมพ์เพื่อค้นหา หรือกรอกชื่อใหม่..."
                    className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all pr-9"
                    autoComplete="off"
                  />
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />

                  {showNameDrop && filteredNameOptions.length > 0 && (
                    <div
                      ref={dropRef}
                      className="absolute z-[60] top-full mt-1 left-0 right-0 max-h-60 overflow-y-auto rounded-xl border border-theme-border bg-theme-surface-modal shadow-2xl shadow-black/20 animate-in fade-in slide-in-from-top-1 duration-100"
                    >
                      {filteredNameOptions.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            setNameQuery(opt.project_name);
                            setFormData(p => ({
                              ...p,
                              project_name: opt.project_name,
                              module: opt.module || p.module,
                            }));
                            setShowNameDrop(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-500/10 transition-colors flex items-center justify-between gap-3 border-b border-theme-border/40 last:border-0"
                        >
                          <span className="font-medium text-theme-text truncate">{opt.project_name}</span>
                          {opt.module && (
                            <span className="shrink-0 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5">
                              📦 {opt.module}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">คำอธิบาย</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="โปรเจคนี้คืออะไร? ใช้ทำอะไร?"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5 flex items-center justify-between">
                  <span>Parent Project (โปรเจคหลัก)</span>
                  {formData.parent_project_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(p => ({ ...p, parent_project_id: '' }));
                        setParentQuery('');
                      }}
                      className="text-indigo-400 hover:underline font-normal text-[10px]"
                    >
                      (ล้างตัวเลือก ✖)
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    ref={parentInputRef}
                    value={parentQuery}
                    onChange={e => {
                      const v = e.target.value;
                      setParentQuery(v);
                      setShowParentDrop(true);
                      if (!v.trim()) {
                        setFormData(p => ({ ...p, parent_project_id: '' }));
                      }
                    }}
                    onFocus={() => setShowParentDrop(true)}
                    placeholder="พิมพ์เพื่อค้นหา Parent Project..."
                    className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all pr-8"
                    autoComplete="off"
                  />
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />

                  {showParentDrop && (
                    <div
                      ref={parentDropRef}
                      className="absolute z-[60] top-full mt-1 left-0 right-0 max-h-56 overflow-y-auto rounded-xl border border-theme-border bg-theme-surface-modal shadow-2xl shadow-black/20 animate-in fade-in slide-in-from-top-1 duration-100"
                    >
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          setFormData(p => ({ ...p, parent_project_id: '' }));
                          setParentQuery('');
                          setShowParentDrop(false);
                        }}
                        className={cn(
                          'w-full text-left px-4 py-2 text-sm hover:bg-indigo-500/10 transition-colors flex items-center justify-between border-b border-theme-border/40 font-semibold',
                          !formData.parent_project_id ? 'text-indigo-500 bg-indigo-500/5' : 'text-theme-text-muted'
                        )}
                      >
                        <span>— Top Level (ไม่มี Parent) —</span>
                      </button>
                      {filteredParentOptions.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-theme-text-muted text-center">ไม่พบโปรเจคที่ค้นหา</div>
                      ) : (
                        filteredParentOptions.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              setFormData(prev => ({ ...prev, parent_project_id: p.id }));
                              setParentQuery(p.project_name);
                              setShowParentDrop(false);
                            }}
                            className={cn(
                              'w-full text-left px-4 py-2 text-sm hover:bg-indigo-500/10 transition-colors flex items-center justify-between border-b border-theme-border/40 last:border-0',
                              formData.parent_project_id === p.id ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-theme-text'
                            )}
                          >
                            <span className="truncate">{p.project_name}</span>
                            {p.owner_holding && (
                              <span className="text-[10px] text-theme-text-muted bg-theme-surface-secondary px-1.5 py-0.5 rounded border border-theme-border shrink-0">
                                {p.owner_holding}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Module (Optional)</label>
                <input
                  value={formData.module}
                  onChange={e => setFormData(p => ({ ...p, module: e.target.value }))}
                  placeholder="เช่น FxCurrency, Item Master"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              {formData.parent_project_id && (
                <div>
                  <label className="block text-[11px] font-semibold text-indigo-400 mb-1.5 flex items-center gap-1.5">
                    🎯 Worklog Project Type (ประเภทงานที่ใช้กรอง)
                  </label>
                  <select
                    value={formData.worklog_project_type}
                    onChange={e => setFormData(p => ({ ...p, worklog_project_type: e.target.value }))}
                    className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border border-indigo-500/30 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  >
                    <option value="">— ไม่กำหนด (ใช้ได้ทุกประเภทงาน) —</option>
                    {workspaceProjectTypes.map((typeName) => (
                      <option key={typeName} value={typeName}>{typeName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Status & Type */}
          <div className="border-t border-theme-border/50 pt-5">
            <h3 className="text-xs font-bold text-theme-text tracking-wide mb-3 uppercase">สถานะและประเภท</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">สถานะ</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(p => ({ ...p, status: e.target.value as ProjectStatus }))}
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                >
                  {STATUS_ORDER.map(s => (
                    <option key={s} value={s}>
                      {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label} — {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">ประเภท</label>
                <select
                  value={formData.project_type}
                  onChange={e => setFormData(p => ({ ...p, project_type: e.target.value }))}
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                >
                  {Object.entries(TYPE_ICONS).map(([k, v]) => (
                    <option key={k} value={k}>{v} {k.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">เจ้าของ Holding</label>
                <select
                  value={formData.owner_holding}
                  onChange={e => setFormData(p => ({ ...p, owner_holding: e.target.value }))}
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all text-theme-text bg-theme-surface"
                >
                  <option value="">-- เลือก Holding --</option>
                  {holdings.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">ทีม</label>
                <select
                  value={formData.owner_team}
                  onChange={e => setFormData(p => ({ ...p, owner_team: e.target.value }))}
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all text-theme-text bg-theme-surface"
                >
                  <option value="">-- เลือกทีม --</option>
                  {teams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Deployment */}
          <div className="border-t border-theme-border/50 pt-5">
            <h3 className="text-xs font-bold text-theme-text tracking-wide mb-3 uppercase">การนำไปใช้งาน / URL</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Deploy URL</label>
                <input
                  value={formData.deploy_url}
                  onChange={e => setFormData(p => ({ ...p, deploy_url: e.target.value }))}
                  placeholder="https://project-name.pages.dev"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Go-live Date</label>
                <input
                  type="date"
                  value={formData.go_live_date}
                  onChange={e => setFormData(p => ({ ...p, go_live_date: e.target.value }))}
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Last Verified</label>
                <input
                  type="date"
                  value={formData.last_verified_date}
                  onChange={e => setFormData(p => ({ ...p, last_verified_date: e.target.value }))}
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Infrastructure & Access */}
          <div className="border-t border-theme-border/50 pt-5">
            <h3 className="text-xs font-bold text-theme-text tracking-wide mb-3 uppercase flex items-center gap-1.5">
              ☁️ โครงสร้างพื้นฐานและการเข้าถึง (Infrastructure)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Hosting Provider</label>
                <input
                  value={formData.hosting_provider}
                  onChange={e => setFormData(p => ({ ...p, hosting_provider: e.target.value }))}
                  placeholder="เช่น Vercel, AWS, Supabase, Netlify"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Admin Email (Gmail คุมระบบ)</label>
                <input
                  type="email"
                  value={formData.admin_email}
                  onChange={e => setFormData(p => ({ ...p, admin_email: e.target.value }))}
                  placeholder="เช่น company.dev@gmail.com"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Database Info</label>
                <input
                  value={formData.database_info}
                  onChange={e => setFormData(p => ({ ...p, database_info: e.target.value }))}
                  placeholder="เช่น Supabase (PostgreSQL), MongoDB Atlas"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">GitHub Repository URL</label>
                <input
                  value={formData.github_repo_url}
                  onChange={e => setFormData(p => ({ ...p, github_repo_url: e.target.value }))}
                  placeholder="https://github.com/owner/repository"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-indigo-400 mb-1.5 flex items-center gap-1">
                  🔒 Secrets Vault Link (1Password / Bitwarden / Secrets URL)
                  <span className="text-[10px] text-theme-text-muted font-normal italic">
                    (ลิงก์ไปยัง Vault จัดเก็บรหัสผ่านอย่างปลอดภัย)
                  </span>
                </label>
                <input
                  type="url"
                  value={formData.vault_url}
                  onChange={e => setFormData(p => ({ ...p, vault_url: e.target.value }))}
                  placeholder="https://my.1password.com/... หรือ Vault Link ชนิดจำกัดสิทธิ์"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border border-indigo-500/30 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-amber-500 mb-1.5 flex items-center gap-1">
                  ⚠️ แหล่งอ้างอิง Credential / Secrets
                  <span className="text-[10px] text-theme-text-muted font-normal italic">
                    (ห้ามกรอกรหัสผ่านตรงๆ ให้ระบุสถานที่เก็บหรือช่องทางการขอแทน)
                  </span>
                </label>
                <textarea
                  value={formData.credentials_ref_note}
                  onChange={e => setFormData(p => ({ ...p, credentials_ref_note: e.target.value }))}
                  rows={2}
                  placeholder="เช่น เก็บไว้ใน Vercel Env Vars หรือ ขอคีย์จาก 1Password ของทีม IMP"
                  className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border border-amber-500/30 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-theme-border/50 pt-5">
            <h3 className="text-xs font-bold text-theme-text tracking-wide mb-3 uppercase">บันทึก</h3>
            <div>
              <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Last Usage Note</label>
              <textarea
                value={formData.last_usage_note}
                onChange={e => setFormData(p => ({ ...p, last_usage_note: e.target.value }))}
                rows={2}
                placeholder="เช่น ระบบมีคนใช้ทุกวัน, ปิดการใช้งานแล้ว, รอเปลี่ยนระบบใหม่..."
                className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-theme-border/60 bg-theme-surface-secondary/50 rounded-b-2xl">
          <div className="text-[11px] text-theme-text-muted">
            {editingProject ? '🔄 แก้ไขโปรเจคที่มีอยู่' : '➕ เพิ่มโปรเจคใหม่ใน Portfolio'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-theme-text-secondary hover:bg-theme-surface-tertiary border border-theme-border transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleLocalSave}
              disabled={submitting || !formData.project_name.trim()}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <><RefreshCw size={14} className="animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Save size={14} /> บันทึก</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
