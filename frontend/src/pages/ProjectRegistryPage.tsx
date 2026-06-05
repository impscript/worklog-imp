import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, ExternalLink, FolderTree, Globe, Calendar,
  ChevronDown, ChevronRight, Edit2, Trash2, X, Save,
  Check, AlertTriangle, Clock, Activity, Users,
  Folder, FolderOpen, File, Layers, Building2,
  RefreshCw, GitBranch, Link, Shield
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useNotification } from '../context/NotificationContext';

/* ── Types ── */
type ProjectStatus = 'planning' | 'development' | 'active' | 'inactive' | 'sunset' | 'retired';

interface Project {
  id: string;
  project_name: string;
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
  // Joined fields
  parent_name?: string | null;
  // Computed
  worklog_count?: number;
  worklog_recent?: number;
  worklog_unique_users?: number;
  children?: Project[];
}

interface WorklogSummary {
  [projectName: string]: {
    count: number;
    recent_30d: number;
    unique_users: number;
  };
}

/* ── Constants ── */
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; icon: string }> = {
  planning:    { label: 'Planning',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20', icon: '🔵' },
  development: { label: 'Dev',         color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20', icon: '🟡' },
  active:      { label: 'Active',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', icon: '🟢' },
  inactive:    { label: 'Inactive',    color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200 dark:border-slate-500/20', icon: '⚪' },
  sunset:      { label: 'Sunset',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20', icon: '🟠' },
  retired:     { label: 'Retired',     color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20', icon: '🔴' },
};

const TYPE_ICONS: Record<string, string> = {
  web_app: '🌐', api: '⚙️', mobile: '📱', desktop: '💻',
  integration: '🔗', extension: '🔌', module: '🧩', internal_tool: '🛠️', infra: '☁️', other: '📁',
};

/* ── Helpers ── */
function getStatusIcon(status: ProjectStatus) {
  return STATUS_CONFIG[status]?.icon || '❓';
}
function getStatusColor(status: ProjectStatus) {
  return STATUS_CONFIG[status]?.color || '';
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

/* ── Flatten tree for display ── */
function flattenTree(tree: Project[], depth = 0): { project: Project; depth: number }[] {
  const result: { project: Project; depth: number }[] = [];
  for (const node of tree) {
    result.push({ project: node, depth });
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

/* ── Status group order ── */
const STATUS_ORDER: ProjectStatus[] = ['active', 'development', 'inactive', 'planning', 'sunset', 'retired'];

/* ── Main Component ── */
export default function ProjectRegistryPage() {
  const { showToast, showConfirm } = useNotification();

  /* ── State ── */
  const [projects, setProjects] = useState<Project[]>([]);
  const [worklogSummary, setWorklogSummary] = useState<WorklogSummary>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'tree' | 'status'>('status');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ── Form State ── */
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
  });

  /* ── Data Loading ── */
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_project_registry')
        .select('*, parent:parent_project_id(project_name)')
        .order('project_name');

      if (error) throw error;

      const mapped: Project[] = (data || []).map((p: any) => ({
        ...p,
        parent_name: p.parent?.project_name || null,
        children: [],
      }));

      setProjects(mapped);

      // Load worklog summary
      const { data: wData, error: wError } = await supabase
        .from('col_worklog')
        .select('project_name, created_at')
        .not('project_name', 'is', null);

      if (!wError && wData) {
        const summary: WorklogSummary = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const userSet: Record<string, Set<string>> = {};
        const count: Record<string, number> = {};
        const recent: Record<string, number> = {};

        wData.forEach((w: any) => {
          const name = w.project_name;
          if (!name) return;

          count[name] = (count[name] || 0) + 1;

          const createdAt = new Date(w.created_at);
          if (createdAt >= thirtyDaysAgo) {
            recent[name] = (recent[name] || 0) + 1;
          }
        });

        Object.keys(count).forEach(name => {
          summary[name] = {
            count: count[name],
            recent_30d: recent[name] || 0,
            unique_users: 0,
          };
        });

        setWorklogSummary(summary);
      }
    } catch (err: any) {
      showToast('โหลดข้อมูลโปรเจคล้มเหลว: ' + (err.message || err), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  /* ── Derived Data ── */
  const filteredProjects = useMemo(() => {
    let list = projects;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.project_name.toLowerCase().includes(q) ||
        (p.module || '').toLowerCase().includes(q) ||
        (p.owner_holding || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') {
      list = list.filter(p => p.status === filterStatus);
    }

    return list;
  }, [projects, searchQuery, filterStatus]);

  const treeData = useMemo(() => buildTree(filteredProjects), [filteredProjects]);
  const flatTree = useMemo(() => flattenTree(treeData), [treeData]);

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
    const set = new Set<string>();
    projects.forEach(p => { if (p.owner_holding) set.add(p.owner_holding); });
    return Array.from(set).sort();
  }, [projects]);

  const parentOptions = useMemo(() => {
    return projects.filter(p => p.id !== editingProject?.id);
  }, [projects, editingProject]);

  /* ── Modal Actions ── */
  const openAddModal = () => {
    setEditingProject(null);
    setFormData({
      project_name: '', description: '', parent_project_id: '',
      module: '', status: 'planning', project_type: 'web_app',
      owner_holding: '', owner_team: '', deploy_url: '',
      go_live_date: '', last_verified_date: '', last_usage_note: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormData({
      project_name: project.project_name,
      description: project.description || '',
      parent_project_id: project.parent_project_id || '',
      module: project.module || '',
      status: project.status,
      project_type: project.project_type || 'web_app',
      owner_holding: project.owner_holding || '',
      owner_team: project.owner_team || '',
      deploy_url: project.deploy_url || '',
      go_live_date: project.go_live_date || '',
      last_verified_date: project.last_verified_date || '',
      last_usage_note: project.last_usage_note || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
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
      };

      if (editingProject) {
        const { error } = await supabase
          .from('tb_project_registry')
          .update(payload)
          .eq('id', editingProject.id);

        if (error) throw error;
        showToast(`อัปเดต "${formData.project_name}" สำเร็จ ✅`, 'success');
      } else {
        const { error } = await supabase
          .from('tb_project_registry')
          .insert(payload);

        if (error) throw error;
        showToast(`เพิ่ม "${formData.project_name}" สำเร็จ ✅`, 'success');
      }

      setIsModalOpen(false);
      loadProjects();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาด: ' + (err.message || err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      // Check for children
      const { data: children } = await supabase
        .from('tb_project_registry')
        .select('id')
        .eq('parent_project_id', deleteTarget.id);

      if (children && children.length > 0) {
        const ok = await showConfirm(
          `โปรเจค "${deleteTarget.project_name}" มีโปรเจคย่อย ${children.length} รายการ\n\nยืนยันลบ? (โปรเจคย่อยจะถูกยกให้เป็น top-level)`,
          'warning'
        );
        if (!ok) return;
      }

      const { error } = await supabase
        .from('tb_project_registry')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      showToast(`ลบ "${deleteTarget.project_name}" สำเร็จ`, 'success');
      setIsDeleteConfirm(false);
      setDeleteTarget(null);
      loadProjects();
    } catch (err: any) {
      showToast('ลบไม่สำเร็จ: ' + (err.message || err), 'error');
    }
  };

  const handleDeleteClick = async (project: Project) => {
    const confirmed = await showConfirm(
      `แน่ใจว่าจะลบโปรเจค "${project.project_name}"?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
      'warning'
    );
    if (confirmed) {
      setDeleteTarget(project);
      confirmDelete();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Status summary stats ── */
  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => {
      const s = p.status || 'planning';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [projects]);

  /* ── Render: Status Badge ── */
  const StatusBadge = ({ status }: { status: ProjectStatus }) => (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide',
      getStatusColor(status)
    )}>
      <span>{getStatusIcon(status)}</span>
      <span>{STATUS_CONFIG[status]?.label || status}</span>
    </span>
  );

  /* ── Render: Project Card ── */
  const ProjectCard = ({ project, depth = 0 }: { project: Project; depth?: number }) => {
    const ws = worklogSummary[project.project_name];
    const hasChildren = project.children && project.children.length > 0;
    const isExpanded = expandedProjects.has(project.id);
    const isTopLevel = !project.parent_project_id;

    // Find worklog matching: exact name, or name prefix
    const exactWs = ws;
    const totalWorklogs = exactWs?.count || 0;
    const recentWorklogs = exactWs?.recent_30d || 0;

    return (
      <div style={{ marginLeft: depth * 24 }}>
        <div className={cn(
          'group ai-glass-interactive rounded-xl p-4 md:p-5 mb-2 transition-all duration-200',
          'border-l-[3px]',
          project.status === 'active' && 'border-l-emerald-500',
          project.status === 'development' && 'border-l-amber-500',
          project.status === 'inactive' && 'border-l-slate-400',
          project.status === 'sunset' && 'border-l-orange-500',
          project.status === 'retired' && 'border-l-rose-500',
          project.status === 'planning' && 'border-l-blue-500',
        )}>
          {/* Row 1: Identity */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {hasChildren && (
                  <button
                    onClick={() => toggleExpand(project.id)}
                    className="p-0.5 rounded hover:bg-theme-surface-tertiary text-theme-text-muted hover:text-theme-text transition-colors shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
                {depth > 0 && <Layers size={14} className="text-theme-text-muted shrink-0" />}
                <h3 className="text-sm font-bold text-theme-text truncate">
                  {project.project_name}
                </h3>
                <StatusBadge status={project.status} />
                {project.project_type && (
                  <span className="text-[10px] font-mono text-theme-text-muted border border-theme-border rounded px-1.5 py-0.5">
                    {TYPE_ICONS[project.project_type] || ''} {project.project_type}
                  </span>
                )}
                {project.module && (
                  <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded px-1.5 py-0.5">
                    📦 {project.module}
                  </span>
                )}
              </div>

              {project.description && (
                <p className="text-xs text-theme-text-secondary mt-1.5 line-clamp-2">
                  {project.description}
                </p>
              )}

              {project.parent_name && (
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-theme-text-muted">
                  <FolderOpen size={12} />
                  <span>Parent: <strong className="text-theme-text-secondary">{project.parent_name}</strong></span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                onClick={() => openEditModal(project)}
                className="p-1.5 rounded-lg border border-theme-border bg-theme-surface-secondary hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                title="Edit"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => handleDeleteClick(project)}
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
                <span className={cn(
                  'flex items-center gap-1',
                  recentWorklogs > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                )}>
                  <Clock size={12} />
                  <span>30 วัน: <strong>{recentWorklogs}</strong> รายการ</span>
                </span>
              </>
            )}
            {totalWorklogs === 0 && project.status === 'active' && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <AlertTriangle size={12} />
                <span>Active แต่ไม่มี Worklog — ควรตรวจสอบ</span>
              </span>
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
        </div>

        {/* Expanded children */}
        {hasChildren && isExpanded && project.children!.map(child => (
          <ProjectCard key={child.id} project={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  /* ── Form Modal ── */
  const ProjectFormModal = () => {
    if (!isModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 md:pt-12 overflow-y-auto">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
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
              onClick={() => setIsModalOpen(false)}
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
                  <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">ชื่อโปรเจค *</label>
                  <input
                    value={formData.project_name}
                    onChange={e => setFormData(p => ({ ...p, project_name: e.target.value }))}
                    placeholder="เช่น ERP Netsuite, WMS, 304 CRM"
                    className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  />
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
                  <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">Parent Project</label>
                  <select
                    value={formData.parent_project_id}
                    onChange={e => setFormData(p => ({ ...p, parent_project_id: e.target.value }))}
                    className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  >
                    <option value="">— Top Level —</option>
                    {parentOptions.filter(p => !p.parent_project_id).map(p => (
                      <option key={p.id} value={p.id}>{p.project_name}</option>
                    ))}
                  </select>
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
                  <input
                    value={formData.owner_holding}
                    onChange={e => setFormData(p => ({ ...p, owner_holding: e.target.value }))}
                    placeholder="เช่น Double A, Real Estate"
                    list="holdings-list"
                    className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  />
                  <datalist id="holdings-list">
                    {holdings.map(h => <option key={h} value={h} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1.5">ทีม</label>
                  <input
                    value={formData.owner_team}
                    onChange={e => setFormData(p => ({ ...p, owner_team: e.target.value }))}
                    placeholder="IMP, IT, IMP&IT"
                    className="w-full theme-field rounded-lg px-3.5 py-2.5 text-sm border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  />
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
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-theme-text-secondary hover:bg-theme-surface-tertiary border border-theme-border transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
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
          <button
            onClick={openAddModal}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>Add Project</span>
          </button>
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
          <div className="flex items-center bg-theme-surface-secondary rounded-xl border border-theme-border p-0.5">
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
              <ProjectCard key={root.id} project={root} depth={0} />
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
                    <ProjectCard key={project.id} project={project} depth={project.parent_project_id ? 1 : 0} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      <ProjectFormModal />

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
