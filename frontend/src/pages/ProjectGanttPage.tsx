import { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useNotification } from '../context/NotificationContext';
import { supabase } from '../lib/supabase';
import type {
  GanttProject,
  ProjectStatus,
  ProjectHealth,
} from '../lib/project-management';
import { fetchGanttProjects } from '../lib/project-management';
import { ExecutiveSummaryKPIs } from '../components/gantt/ExecutiveSummaryKPIs';
import { GanttFilterToolbar, type GanttZoomLevel } from '../components/gantt/GanttFilterToolbar';
import { GanttRoadmapCanvas } from '../components/gantt/GanttRoadmapCanvas';
import { ProjectDetailDrawer } from '../components/gantt/ProjectDetailDrawer';
import { FolderKanban, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProjectGanttPage() {
  const { showToast } = useNotification();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<GanttProject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string; email?: string }[]>([]);

  // Filter & Hierarchy State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedHolding, setSelectedHolding] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | 'all'>('all');
  const [selectedHealth, setSelectedHealth] = useState<ProjectHealth | 'all'>('all');
  const [zoomLevel, setZoomLevel] = useState<GanttZoomLevel>('month');
  const [isTreeView, setIsTreeView] = useState<boolean>(true);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());

  // Load active workspace name from session
  const [workspaceName, setWorkspaceName] = useState<string>('');

  // Load Projects from Supabase
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchGanttProjects();
      setProjects(data);
      // Auto-expand all parent projects with children by default
      const parentsWithChildren = data.filter((p) => data.some((child) => child.parent_project_id === p.id));
      setExpandedProjectIds(new Set(parentsWithChildren.map((p) => p.id)));
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Failed to load Gantt projects:', err);
      showToast(`โหลดข้อมูลไม่สำเร็จ: ${e.message || 'Error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

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
        const { data: memData } = await supabase
          .from('workspace_users')
          .select(`
            user_id,
            role,
            users (
              id,
              full_name,
              nickname,
              email
            )
          `)
          .eq('workspace_id', activeWsId);

        interface RawMemberRecord {
          user_id: string;
          users?: { id?: string; full_name?: string | null; nickname?: string | null; email?: string | null } | null;
        }

        if (memData && memData.length > 0) {
          const usersList = (memData as unknown as RawMemberRecord[])
            .map((m) => {
              const u = m.users;
              if (!u) return null;
              return {
                id: u.id || m.user_id,
                name: u.full_name || u.nickname || u.email?.split('@')[0] || 'ผู้ใช้งาน',
                email: u.email || undefined,
              };
            })
            .filter(Boolean);
          setAvailableUsers(usersList as { id: string; name: string; email?: string }[]);
          return;
        }
      }

      // Fallback if no workspace members found or superadmin
      const { data } = await supabase.from('users').select('id, full_name, email').limit(200);
      if (data) {
        interface RawUserEntry {
          id: string;
          full_name?: string | null;
          email?: string | null;
        }
        setAvailableUsers(
          (data as RawUserEntry[]).map((u) => ({
            id: u.id,
            name: u.full_name || u.email?.split('@')[0] || 'ผู้ใช้งาน',
            email: u.email || undefined,
          }))
        );
      }
    } catch (err) {
      console.warn('Could not load users list for assignment:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const [projData] = await Promise.all([
          fetchGanttProjects(),
          loadUsers(),
        ]);
        if (isMounted) {
          setProjects(projData);
          const parentsWithChildren = projData.filter((p) => projData.some((child) => child.parent_project_id === p.id));
          setExpandedProjectIds(new Set(parentsWithChildren.map((p) => p.id)));
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const e = err as { message?: string };
          console.error('Failed to load Gantt projects:', err);
          showToast(`โหลดข้อมูลไม่สำเร็จ: ${e.message || 'Error'}`, 'error');
          setIsLoading(false);
        }
      }
    };

    void initData();

    return () => {
      isMounted = false;
    };
  }, [loadUsers, showToast]);

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

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return projects.filter((p) => {
      if (selectedTeam !== 'all' && (p.owner_team || 'IMP') !== selectedTeam) return false;
      if (selectedHolding !== 'all' && (p.owner_holding || '') !== selectedHolding) return false;
      if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
      if (selectedHealth !== 'all' && p.project_health !== selectedHealth) return false;

      if (!q) return true;
      return (
        p.project_name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.head_lead_name || '').toLowerCase().includes(q) ||
        (p.owner_holding || '').toLowerCase().includes(q) ||
        (p.owner_team || '').toLowerCase().includes(q)
      );
    });
  }, [projects, searchQuery, selectedTeam, selectedHolding, selectedStatus, selectedHealth]);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const handleSelectProject = (proj: GanttProject) => {
    setSelectedProjectId(proj.id);
    setIsDrawerOpen(true);
  };

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

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-theme-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <FolderKanban size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-theme-text tracking-tight flex items-center gap-2 flex-wrap">
                <span>แผนภูมิแกนต์และพอร์ตโฟลิโอโครงการ</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Gantt Roadmap & Value Realization
                </span>
                {workspaceName && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    🏢 {workspaceName}
                  </span>
                )}
              </h1>
              <p className="text-xs text-theme-text-secondary">
                ติดตาม Timeline กำหนดเสร็จ, หัวหน้าทีม & สัดส่วน Contribution (Target vs Actual), และผลประหยัดต้นทุน 4 มิติ
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="px-3.5 py-2 rounded-2xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text font-bold text-xs transition-all cursor-pointer select-none"
            >
              📋 ทะเบียนโครงการ (Registry)
            </button>
          </div>
        </div>

        {/* Executive Summary Top Cards */}
        <ExecutiveSummaryKPIs projects={projects} />

        {/* Filter Toolbar with Tree View & Zoom controls */}
        <GanttFilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTeam={selectedTeam}
          onTeamChange={setSelectedTeam}
          selectedHolding={selectedHolding}
          onHoldingChange={setSelectedHolding}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedHealth={selectedHealth}
          onHealthChange={setSelectedHealth}
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
        />

        {/* Main Gantt Roadmap Canvas */}
        {isLoading ? (
          <div className="p-16 text-center rounded-3xl border border-theme-border/60 bg-theme-surface/40 animate-pulse space-y-3">
            <RefreshCw size={28} className="mx-auto text-indigo-500 animate-spin" />
            <p className="text-xs font-bold text-theme-text-muted">กำลังประมวลผล Timeline และชั่วโมง Worklog...</p>
          </div>
        ) : (
          <GanttRoadmapCanvas
            projects={filteredProjects}
            zoomLevel={zoomLevel}
            isTreeView={isTreeView}
            expandedProjectIds={expandedProjectIds}
            onToggleExpandProject={handleToggleExpandProject}
            onSelectProject={handleSelectProject}
            selectedProjectId={selectedProjectId}
          />
        )}

        {/* Bottom Feature Highlights Card */}
        <div className="p-5 rounded-3xl border border-theme-border/60 bg-theme-surface/50 dark:bg-theme-bg-page/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-theme-text-secondary">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-theme-text">โครงสร้างโครงการและการทำงานแบบ Hybrid (Best Practices):</span>
              <p className="text-[11px] leading-relaxed">
                จัดกลุ่มโครงการเป็น Parent (โครงการหลัก) ➔ Child (โมดูลย่อย) เพื่อรวมศูนย์ตัวเลข Save Cost และหัวหน้าทีมไว้ที่โครงการหลัก พร้อมดึงสมาชิกในทีมจาก Dropdown ได้สะดวกรวดเร็ว
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
        onProjectUpdated={loadProjects}
        availableUsers={availableUsers}
      />
    </AppLayout>
  );
}
