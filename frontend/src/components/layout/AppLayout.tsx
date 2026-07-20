import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, FileText, Trophy, User, PlusCircle, Menu, X, LogOut, Database, Cpu, UploadCloud, ChevronLeft, ChevronRight, Sun, Moon, FolderTree, MessageSquare, Sparkles, LayoutGrid, Shield, Search, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { syncWorklogToGCal } from '../../lib/google-calendar';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../LanguageToggle';

type SessionUser = { 
  id: string; 
  name: string; 
  nickname?: string;
  role: string; 
  workspaceRole?: 'admin' | 'manager' | 'user'; 
  empId?: string; 
  activeWorkspaceId?: string;
  workspaceInviteCode?: string;
  workspaceName?: string;
  position?: string;
  department?: string;
  companyName?: string;
};

function getSessionUser(): SessionUser | null {
  try {
    const session = localStorage.getItem('worklog_session');
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });
  const [user, setUser] = useState<SessionUser | null>(getSessionUser);
  const navigate = useNavigate();
  const { showToast } = useNotification();

  // Onboarding workspace states
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceCode, setNewWorkspaceCode] = useState('');
  const [isSubmittingWorkspace, setIsSubmittingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [onboardingTab, setOnboardingTab] = useState<'join' | 'create'>('join');

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim() || !user) return;
    setIsSubmittingWorkspace(true);
    setWorkspaceError('');
    try {
      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .select('id, workspace_name')
        .eq('invite_code', inviteCodeInput.trim().toUpperCase())
        .maybeSingle();

      if (wsErr) throw wsErr;
      if (!ws) {
        throw new Error('ไม่พบรหัสเชิญชวนของทีมนี้ / Invite code not found');
      }

      // Update user
      const { error: userErr } = await supabase
        .from('users')
        .update({ active_workspace_id: ws.id })
        .eq('id', user.id);

      if (userErr) throw userErr;

      // Add to workspace_users
      const isManager = /section manager|sec mgr|department manager|dept mgr|head of|director|ผู้จัดการ/i.test(user.position || '');
      const mappedRole = (isManager ? 'admin' : 'user') as 'admin' | 'manager' | 'user';

      const { error: memberErr } = await supabase
        .from('workspace_users')
        .upsert({
          workspace_id: ws.id,
          user_id: user.id,
          role: mappedRole
        }, { onConflict: 'workspace_id,user_id' });

      if (memberErr) throw memberErr;

      // Update session
      const updatedSession = {
        ...user,
        activeWorkspaceId: ws.id,
        workspaceInviteCode: inviteCodeInput.trim().toUpperCase(),
        workspaceRole: mappedRole
      };
      localStorage.setItem('worklog_session', JSON.stringify(updatedSession));
      setUser(updatedSession);
      showToast(`เข้าร่วมกลุ่ม ${ws.workspace_name} สำเร็จ!`, 'success');
      window.location.reload();
    } catch (err: any) {
      setWorkspaceError(err.message || 'Failed to join workspace');
    } finally {
      setIsSubmittingWorkspace(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || !newWorkspaceCode.trim() || !user) return;
    setIsSubmittingWorkspace(true);
    setWorkspaceError('');
    try {
      const { data: newWs, error: createErr } = await supabase
        .from('workspaces')
        .insert({
          workspace_name: newWorkspaceName.trim(),
          invite_code: newWorkspaceCode.trim().toUpperCase()
        })
        .select('id')
        .maybeSingle();

      if (createErr) {
        if (createErr.code === '23505') {
          throw new Error('ชื่อทีมหรือรหัสเชิญนี้มีอยู่แล้ว / Workspace name or invite code already exists');
        }
        throw createErr;
      }
      if (!newWs) throw new Error('สร้าง Workspace ไม่สำเร็จ');

      // Update user
      const { error: userErr } = await supabase
        .from('users')
        .update({ active_workspace_id: newWs.id })
        .eq('id', user.id);

      if (userErr) throw userErr;

      // Add as admin
      const { error: memberErr } = await supabase
        .from('workspace_users')
        .insert({
          workspace_id: newWs.id,
          user_id: user.id,
          role: 'admin'
        });

      if (memberErr) throw memberErr;

      const updatedSession = {
        ...user,
        activeWorkspaceId: newWs.id,
        workspaceInviteCode: newWorkspaceCode.trim().toUpperCase(),
        workspaceRole: 'admin' as 'admin' | 'manager' | 'user'
      };
      localStorage.setItem('worklog_session', JSON.stringify(updatedSession));
      setUser(updatedSession);
      showToast(`สร้างและเข้าร่วมกลุ่ม ${newWorkspaceName} สำเร็จ!`, 'success');
      window.location.reload();
    } catch (err: any) {
      setWorkspaceError(err.message || 'Failed to create workspace');
    } finally {
      setIsSubmittingWorkspace(false);
    }
  };

  // Self-healing check: if workspaceInviteCode is missing in active session, fetch it dynamically
  useEffect(() => {
    if (user && user.activeWorkspaceId && !user.workspaceInviteCode) {
      async function fetchInviteCode() {
        try {
          const { data } = await supabase
            .from('workspaces')
            .select('invite_code')
            .eq('id', user!.activeWorkspaceId)
            .maybeSingle();
          if (data?.invite_code) {
            const updatedUser = { ...user!, workspaceInviteCode: data.invite_code };
            setUser(updatedUser);
            localStorage.setItem('worklog_session', JSON.stringify(updatedUser));
          }
        } catch (e) {
          console.error('Failed to fetch workspace invite code on layout load:', e);
        }
      }
      fetchInviteCode();
    }
  }, [user]);

  // Load workspaces list for switcher if Super Admin
  const [workspacesList, setWorkspacesList] = useState<any[]>([]);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  useEffect(() => {
    if (user?.role === 'admin') {
      async function loadWorkspaces() {
        try {
          const { data } = await supabase
            .from('workspaces')
            .select('id, workspace_name, invite_code')
            .order('workspace_name');
          if (data) setWorkspacesList(data);
        } catch (e) {
          console.error('Failed to load workspaces list:', e);
        }
      }
      loadWorkspaces();
    }
  }, [user]);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (!user) return;
    try {
      // A global admin remains a Super Admin while viewing any workspace.
      // Selecting a workspace is context, not a loss of global authority.
      const isSuperAdmin = user.role === 'admin';

      // Non-super-admins must be a member of the destination workspace before switching.
      if (workspaceId && !isSuperAdmin) {
        const { data: membership, error: memErr } = await supabase
          .from('workspace_users')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (memErr) throw memErr;
        if (!membership) {
          showToast('คุณไม่มีสิทธิ์เข้าถึง Workspace นี้', 'error');
          return;
        }
      }

      let updatedSession = { ...user };
      if (!workspaceId) {
        // Switch back to Global
        updatedSession.activeWorkspaceId = undefined;
        delete (updatedSession as any).workspaceName;
        delete (updatedSession as any).workspaceInviteCode;
      } else {
        const selected = workspacesList.find(w => w.id === workspaceId);
        updatedSession.activeWorkspaceId = workspaceId;
        (updatedSession as any).workspaceName = selected?.workspace_name || '';
        (updatedSession as any).workspaceInviteCode = selected?.invite_code || '';
      }

      // Audit: record any workspace switch (including super-admin cross-tenant support access)
      await supabase.from('tb_audit_log').insert({
        workspace_id: workspaceId || user.activeWorkspaceId || null,
        actor_id: user.id,
        actor_name: user.name || user.empId || user.id,
        action: 'SUPERADMIN_WORKSPACE_SWITCH',
        target_id: workspaceId || null,
        target_name: workspaceId ? workspacesList.find(w => w.id === workspaceId)?.workspace_name || '' : 'Global',
        metadata: { from: user.activeWorkspaceId || 'Global', to: workspaceId || 'Global', is_super_admin: isSuperAdmin }
      });

      // Update the profile through the authenticated identity mapping.
      const { data: { user: authUser }, error: authUserError } = await supabase.auth.getUser();
      if (authUserError || !authUser) throw authUserError || new Error('ไม่พบ Supabase Auth session');
      const dbVal = workspaceId || null;
      const { error: dbErr } = await supabase
        .from('users')
        .update({ active_workspace_id: dbVal })
        .eq('auth_user_id', authUser.id);

      if (dbErr) throw dbErr;

      localStorage.setItem('worklog_session', JSON.stringify(updatedSession));
      setUser(updatedSession);
      showToast(workspaceId ? `สลับไปฝ่าย ${updatedSession.workspaceName} สำเร็จ` : 'สลับกลับเป็นผู้ดูแลระบบส่วนกลางสำเร็จ', 'success');

      window.location.reload();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการสลับ Workspace: ' + err.message, 'error');
    }
  };

  const { theme, toggleTheme } = useTheme();

  // Page access gating & redirection
  useEffect(() => {
    if (!user) return;
    const path = window.location.pathname;
    
    const isSuperAdmin = user.role === 'admin';
    const isWorkspaceAdmin = user.workspaceRole === 'admin';
    const isWorkspaceManager = user.workspaceRole === 'manager';

    if (path === '/admin' && !(isSuperAdmin || isWorkspaceAdmin)) {
      showToast('ไม่มีสิทธิ์เข้าถึงหน้านี้ / Permission Denied', 'error');
      navigate('/');
    }
    if (path === '/migrate' && !(isSuperAdmin || isWorkspaceAdmin)) {
      showToast('ไม่มีสิทธิ์เข้าถึงหน้านี้ / Permission Denied', 'error');
      navigate('/');
    }
    if (path === '/projects' && !(isSuperAdmin || isWorkspaceAdmin || isWorkspaceManager)) {
      showToast('ไม่มีสิทธิ์เข้าถึงหน้านี้ / Permission Denied', 'error');
      navigate('/');
    }
    if (path === '/reports' && !(isSuperAdmin || isWorkspaceAdmin || isWorkspaceManager)) {
      showToast('ไม่มีสิทธิ์เข้าถึงหน้านี้ / Permission Denied', 'error');
      navigate('/');
    }
    if (path === '/team' && !(isSuperAdmin || isWorkspaceAdmin)) {
      showToast('ไม่มีสิทธิ์เข้าถึงหน้านี้ / Permission Denied', 'error');
      navigate('/');
    }
  }, [user, navigate, showToast]);

  // Background runner for pending Google Calendar sync submissions/updates
  useEffect(() => {
    async function processPendingSync() {
      const pendingStr = localStorage.getItem('gcal_pending_sync');
      if (!pendingStr) return;

      try {
        const pending = JSON.parse(pendingStr);
        // Clear immediately to prevent double processing / infinite loops
        localStorage.removeItem('gcal_pending_sync');

        showToast('กำลังกู้คืนข้อมูลและบันทึกใบงานโดยอัตโนมัติ... / Autocompleting worklog save...', 'info');

        if (pending.action === 'insert') {
          const insertedIds: string[] = [];
          for (const row of pending.inserts) {
            const { data, error } = await supabase
              .from('col_worklog')
              .insert(row)
              .select('id')
              .maybeSingle();

            if (error) throw error;
            if (data?.id) insertedIds.push(data.id);
          }

          // Sync to GCal
          for (const id of insertedIds) {
            try {
              await syncWorklogToGCal(id, 'insert');
            } catch (syncErr) {
              console.warn('[GCal] Background sync warning:', syncErr);
            }
          }

          showToast('บันทึกใบงานและซิงค์ลง Google Calendar สำเร็จ! / Worklog saved and synced successfully!', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } 
        else if (pending.action === 'update' && pending.logId) {
          const { error } = await supabase
            .from('col_worklog')
            .update(pending.updatePayload)
            .eq('id', pending.logId)
            .eq('workspace_id', user?.activeWorkspaceId);

          if (error) throw error;

          // Insert any remaining segments
          if (pending.inserts && pending.inserts.length > 0) {
            for (const row of pending.inserts) {
              const { data, error: errorNew } = await supabase
                .from('col_worklog')
                .insert(row)
                .select('id')
                .maybeSingle();
              if (errorNew) throw errorNew;
              if (data?.id) {
                try {
                  await syncWorklogToGCal(data.id, 'insert');
                } catch (syncErr) {
                  console.warn('[GCal] Background sync warning:', syncErr);
                }
              }
            }
          }

          // Sync the updated entry
          try {
            await syncWorklogToGCal(pending.logId, 'update');
          } catch (syncErr) {
            console.warn('[GCal] Background sync warning:', syncErr);
          }

          showToast('อัปเดตใบงานและซิงค์ลง Google Calendar สำเร็จ! / Worklog updated and synced successfully!', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err: unknown) {
        console.error('[AppLayout] Failed to process pending sync:', err);
        showToast('เกิดข้อผิดพลาดในการบันทึกและซิงค์ GCal: ' + getErrorMessage(err), 'error');
      }
    }

    processPendingSync();
  }, [showToast]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('worklog_session');
    localStorage.removeItem('gcal_pending_sync');
    localStorage.removeItem('gcal_pending_origin');
    navigate('/login');
  };

  const getFormattedDate = () => {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'short' });    // Mon
    const date = now.getDate();                                            // 20
    const month = now.toLocaleDateString('en-US', { month: 'short' });    // Jul
    const year = now.getFullYear();                                        // 2026
    return `${day}, ${date} ${month} ${year}`; // "Mon, 20 Jul 2026"
  };

  const queryParams = new URLSearchParams(window.location.search);
  const isSharedView = queryParams.has('share');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-theme-bg-page ai-cyber-grid text-theme-text font-sans relative">
      
      {/* Dynamic Background Glowing Blobs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-12 right-1/4 w-[350px] h-[350px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && !isSharedView && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!isSharedView && (
        <aside 
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 bg-theme-surface-secondary/80 dark:bg-theme-bg-page/80 backdrop-blur-xl border-r border-theme-border/80 flex flex-col transform transition-all duration-300 ease-in-out md:relative md:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
            isCollapsed ? "md:w-20" : "md:w-64"
          )}
        >
          <div className={cn(
            "h-16 flex items-center justify-between border-b border-theme-border/60 bg-theme-surface/50 dark:bg-theme-bg-page/20 transition-all duration-300",
            isCollapsed ? "px-4 justify-center" : "px-6"
          )}>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/20 shrink-0">
                <span className="text-sm font-black tracking-tighter">MOS</span>
              </div>
              {!isCollapsed && (
                <div className="ml-3 flex flex-col justify-center animate-fade-in">
                  <span className="text-sm font-black tracking-wider bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-300 bg-clip-text text-transparent leading-none">
                    MOS
                  </span>
                  <span className="text-[7.5px] font-semibold text-theme-text-secondary uppercase tracking-widest leading-none mt-0.5 whitespace-nowrap">
                    Management Operating System
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Desktop Collapse Button */}
              <button 
                onClick={toggleCollapse} 
                className="hidden md:flex items-center justify-center p-1.5 rounded-lg border border-theme-border hover:border-indigo-500/50 dark:hover:border-indigo-500/50 bg-theme-surface hover:bg-indigo-50 dark:bg-theme-surface-secondary/50 dark:hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-600 dark:text-theme-text-secondary dark:hover:text-indigo-400 transition-all duration-200"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>

              {/* Close button for mobile */}
              <button onClick={toggleSidebar} className="md:hidden text-theme-text-muted hover:text-theme-text dark:text-theme-text-secondary dark:hover:text-theme-text-invert">
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Connection status box */}
          {!isCollapsed ? (
            <div className="mt-4 mx-4 px-4 py-3.5 rounded-xl bg-theme-surface/80 dark:bg-theme-bg-page/50 border border-theme-border/80 flex items-center justify-between text-[11px] backdrop-blur-md animate-fade-in shadow-sm">
              <div className="flex items-center gap-2 text-theme-text-secondary font-mono">
                <Cpu size={12} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
                <span className="font-semibold tracking-wider">AI COPILOT</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span>ONLINE</span>
              </div>
            </div>
          ) : (
            <div 
              className="mt-4 mx-auto w-10 h-10 rounded-xl bg-theme-surface/80 dark:bg-theme-bg-page/50 border border-theme-border/80 flex items-center justify-center backdrop-blur-md relative group cursor-pointer shadow-sm"
              title="AI Copilot: Online"
            >
              <Cpu size={16} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
              <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-theme-bg-page" />
            </div>
          )}

          {/* Grouped Navigation */}
          <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto mt-2">
            
            {/* Section 1: My Work */}
            {(!isCollapsed) && (
              <h3 className="px-4 pt-2 pb-1 text-[9.5px] font-black uppercase text-indigo-400/80 tracking-widest font-mono">
                {t('nav.myWork')}
              </h3>
            )}
            <NavItem to="/" icon={<LayoutDashboard size={18} />} label={t('nav.dashboard')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavItem to="/log" icon={<PlusCircle size={18} />} label={t('nav.logWork')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavItem to="/calendar" icon={<Calendar size={18} />} label={t('nav.calendar')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavItem to="/profile" icon={<User size={18} />} label={t('nav.profile')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />

            {/* Section 2: Collaboration */}
            {((user?.role === 'admin' || user?.workspaceRole === 'admin' || user?.workspaceRole === 'manager') || !isCollapsed) && (
              <div className="border-t border-theme-border/30 my-2 pt-2">
                {!isCollapsed && (
                  <h3 className="px-4 pb-1 text-[9.5px] font-black uppercase text-indigo-400/80 tracking-widest font-mono">
                    {t('nav.collaboration')}
                  </h3>
                )}
              </div>
            )}
            {(user?.role === 'admin' || user?.workspaceRole === 'admin' || user?.workspaceRole === 'manager') && (
              <NavItem to="/reports" icon={<FileText size={18} />} label={t('nav.reports')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            {(user?.role === 'admin' || user?.workspaceRole === 'admin') && (
              <NavItem to="/team" icon={<User size={18} />} label={t('nav.team')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            {(user?.role === 'admin' || user?.workspaceRole === 'admin' || user?.workspaceRole === 'manager') && (
              <NavItem to="/projects" icon={<FolderTree size={18} />} label={t('nav.projects')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            <NavItem to="/leaderboard" icon={<Trophy size={18} />} label={t('nav.leaderboard')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />

            {/* Section 3: AI Copilot */}
            <div className="border-t border-theme-border/30 my-2 pt-2">
              {!isCollapsed && (
                <h3 className="px-4 pb-1 text-[9.5px] font-black uppercase text-indigo-400/80 tracking-widest font-mono">
                  {t('nav.aiCopilot')}
                </h3>
              )}
            </div>
            <NavItem to="/hrbp" icon={<Cpu size={18} />} label="AI Enhance" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavItem to="/ai-chat" icon={<MessageSquare size={18} />} label={t('nav.aiChat')} isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />

            {/* Section 4: ผู้ดูแลระบบใหญ่ (Super Admin) */}
            {user?.role === 'admin' && (
              <SysAdminSection isCollapsed={isCollapsed} onNav={() => setIsSidebarOpen(false)} />
            )}
          </nav>

          {/* Logout button at bottom of sidebar */}
          <div className="p-4 border-t border-theme-border/80 bg-theme-surface/50 dark:bg-theme-bg-page/20">
            <button
              onClick={handleLogout}
              className={cn(
                "flex items-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 transition-all text-sm font-semibold tracking-wide w-full",
                isCollapsed ? "md:justify-center space-x-3 md:space-x-0 py-3" : "space-x-3 px-4 py-3"
              )}
              title={isCollapsed ? t('nav.logout') : undefined}
            >
              <LogOut size={18} className="shrink-0" />
              {!isCollapsed ? (
                <span className="whitespace-nowrap animate-fade-in">{t('nav.logout')}</span>
              ) : (
                <span className="whitespace-nowrap animate-fade-in md:hidden">{t('nav.logout')}</span>
              )}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-b from-theme-surface-secondary via-theme-surface to-theme-surface-secondary dark:from-theme-bg-page dark:via-theme-bg-page/70 dark:to-theme-bg-page relative z-10">
        
        {/* Header */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-theme-border/50 bg-theme-surface/80 dark:bg-theme-surface/25 backdrop-blur-md relative z-20">
          {/* Mobile menu button & breadcrumbs */}
          {!isSharedView ? (
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleSidebar}
                className="md:hidden p-2 -ml-2 text-theme-text-muted hover:text-theme-text dark:text-theme-text-secondary dark:hover:text-theme-text-invert rounded-xl hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary/60 transition-colors shrink-0"
              >
                <Menu size={24} />
              </button>
              <h2 className="hidden md:block text-sm font-black text-theme-text tracking-wide uppercase font-mono">
                Executive Diagnostics Dashboard
              </h2>
            </div>
          ) : (
             <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg border border-indigo-400/20 shrink-0">
                <span className="text-xs font-black tracking-tighter">MOS</span>
              </div>
              <span className="text-xs font-black tracking-wider uppercase text-theme-text ml-1 whitespace-nowrap">
                MOS - PERFORMANCE DIAGNOSTICS
              </span>
            </div>
          )}

          {/* Right aligned user metadata and controls */}
          <div className="flex items-center gap-2 ml-auto min-w-0">
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => { setWorkspaceSearch(''); setIsWorkspacePickerOpen(true); }}
                className="flex items-center gap-1.5 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-xl shadow-sm hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                title={user.workspaceName || 'เลือก Workspace'}
              >
                <Shield size={12} className="text-rose-400 shrink-0" />
                <span className="hidden sm:inline text-[9px] font-black uppercase text-rose-400 tracking-wider whitespace-nowrap">
                  ADMIN:
                </span>
                <span className="text-[10px] font-bold text-rose-300 max-w-[90px] sm:max-w-[130px] truncate">
                  {user.workspaceName
                    ? user.workspaceName.replace('Improvement & Digital Innovation', 'IMP&IT').replace('Management Operating System', 'MOS')
                    : (user.activeWorkspaceId ? user.workspaceInviteCode || 'WS' : 'Global')}
                </span>
                <ChevronsUpDown size={11} className="shrink-0 text-rose-400" />
              </button>
            )}

            <span className="hidden md:inline-block text-[11px] font-semibold text-theme-text-secondary bg-theme-surface-secondary border border-theme-border/80 px-2.5 py-1.5 rounded-lg font-mono tracking-wide whitespace-nowrap shrink-0">
              {getFormattedDate()}
            </span>
            
            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-theme-border bg-theme-surface-secondary hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text-invert transition-all duration-200 active:scale-95 shrink-0"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <LanguageToggle />

            {!isSharedView && (
              <div className="flex items-center space-x-3 pl-3 border-l border-theme-border shrink-0">
                <div className="w-8 h-8 rounded-full bg-theme-surface-tertiary flex items-center justify-center overflow-hidden ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/5">
                  <img 
                    src={`https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${user?.empId}`}
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Guest')}&background=818cf8&color=fff`;
                    }}
                  />
                </div>
                <div className="hidden sm:flex flex-col text-left leading-none space-y-0.5">
                  <span className="text-xs font-bold text-theme-text">
                    {user?.name || 'Loading...'}
                  </span>
                  {user?.workspaceInviteCode ? (
                    <span className="text-[9px] text-indigo-500 dark:text-indigo-400 font-mono font-bold tracking-tight" title={`Workspace ID: ${user.activeWorkspaceId}`}>
                      WS: {user.workspaceInviteCode}
                    </span>
                  ) : user?.activeWorkspaceId ? (
                    <span className="text-[9px] text-indigo-500 dark:text-indigo-400 font-mono font-bold tracking-tight" title={`Workspace ID: ${user.activeWorkspaceId}`}>
                      WS: {user.activeWorkspaceId.substring(0, 8)}...
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </header>

        {isWorkspacePickerOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setIsWorkspacePickerOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl border border-theme-border bg-theme-surface-modal p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-black text-theme-text">เลือก Workspace</h2>
                  <p className="text-xs text-theme-text-muted mt-1">เลือกบริบทการทำงานและการบันทึกใบงาน</p>
                </div>
                <button type="button" onClick={() => setIsWorkspacePickerOpen(false)} className="p-2 rounded-lg hover:bg-theme-surface-tertiary text-theme-text-muted"><X size={18} /></button>
              </div>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                <input
                  autoFocus
                  value={workspaceSearch}
                  onChange={(e) => setWorkspaceSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ Workspace..."
                  className="w-full rounded-xl border border-theme-border bg-theme-surface-secondary py-2.5 pl-9 pr-3 text-sm text-theme-text outline-none focus:border-indigo-500"
                />
              </div>
              <div className="max-h-[min(55vh,420px)] overflow-y-auto space-y-1">
                <button
                  type="button"
                  onClick={() => { setIsWorkspacePickerOpen(false); handleSwitchWorkspace(''); }}
                  className={cn('w-full flex items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-theme-surface-tertiary', !user?.activeWorkspaceId && 'bg-indigo-500/10')}
                >
                  <span><span className="block text-sm font-bold text-theme-text">Global</span><span className="block text-xs text-theme-text-muted">ยังไม่เลือก Workspace</span></span>
                  {!user?.activeWorkspaceId && <Check size={17} className="text-indigo-400" />}
                </button>
                {workspacesList
                  .filter((ws) => ws.workspace_name.toLowerCase().includes(workspaceSearch.trim().toLowerCase()))
                  .map((ws) => (
                    <button
                      type="button"
                      key={ws.id}
                      onClick={() => { setIsWorkspacePickerOpen(false); handleSwitchWorkspace(ws.id); }}
                      className={cn('w-full flex items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-theme-surface-tertiary', user?.activeWorkspaceId === ws.id && 'bg-indigo-500/10')}
                    >
                      <span><span className="block text-sm font-bold text-theme-text">{ws.workspace_name}</span><span className="block text-[10px] font-mono text-theme-text-muted">{ws.id}</span></span>
                      {user?.activeWorkspaceId === ws.id && <Check size={17} className="text-indigo-400" />}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {user && (!user.activeWorkspaceId || user.activeWorkspaceId === 'N/A') && user.role !== 'admin' && window.location.pathname !== '/profile' ? (
            <div className="max-w-md mx-auto my-12 p-8 ai-glass rounded-3xl border border-indigo-500/20 shadow-2xl space-y-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles size={24} className="animate-pulse" />
                </div>
                <h2 className="text-xl font-extrabold text-theme-text tracking-tight">
                  จัดตั้งห้องทำงานของคุณ / Workspace Setup
                </h2>
                <p className="text-xs text-theme-text-muted">
                  ตรวจพบประวัติพนักงานของคุณแล้ว แต่ยังไม่มีกลุ่มทำงานสังกัดในระบบ กรุณากรอกรหัสเชิญชวนของทีมคุณ หรือขอจดทะเบียนทีมงานใหม่
                </p>
              </div>

              {workspaceError && (
                <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl text-red-400 text-xs font-semibold text-center">
                  {workspaceError}
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-theme-border/60 pb-2">
                <button
                  type="button"
                  onClick={() => setOnboardingTab('join')}
                  className={cn(
                    "flex-1 py-2 text-xs font-extrabold transition-all border-b-2",
                    onboardingTab === 'join' ? "border-indigo-500 text-indigo-500" : "border-transparent text-theme-text-muted"
                  )}
                >
                  เข้าร่วมกลุ่ม (Join Team)
                </button>
                {/* Only managers or super admins can create workspaces */}
                {(user.role === 'admin' || /section manager|sec mgr|department manager|dept mgr|head of|director|ผู้จัดการ/i.test(user.position || '')) && (
                  <button
                    type="button"
                    onClick={() => setOnboardingTab('create')}
                    className={cn(
                      "flex-1 py-2 text-xs font-extrabold transition-all border-b-2",
                      onboardingTab === 'create' ? "border-indigo-500 text-indigo-500" : "border-transparent text-theme-text-muted"
                    )}
                  >
                    สร้างกลุ่มใหม่ (Create Team)
                  </button>
                )}
              </div>

              {onboardingTab === 'join' ? (
                <form onSubmit={handleJoinWorkspace} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">
                      รหัสเชิญชวนเข้ากลุ่ม (Invite Code)
                    </label>
                    <input
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      placeholder="ตัวอย่าง: IMP-TEAM-99"
                      className="w-full bg-theme-bg-page/60 border border-theme-border rounded-xl py-3 px-4 text-theme-text placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-sm"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmittingWorkspace}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 transition-all cursor-pointer"
                  >
                    {isSubmittingWorkspace ? 'กำลังตรวจสอบ...' : 'เข้าร่วม Workspace'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCreateWorkspace} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">
                      ชื่อกลุ่มงาน / แผนก (Workspace Name)
                    </label>
                    <input
                      type="text"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="ตัวอย่าง: Real Estate Marketing"
                      className="w-full bg-theme-bg-page/60 border border-theme-border rounded-xl py-3 px-4 text-theme-text placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest">
                      รหัสคำเชิญใหม่ (Custom Invite Code)
                    </label>
                    <input
                      type="text"
                      value={newWorkspaceCode}
                      onChange={(e) => setNewWorkspaceCode(e.target.value)}
                      placeholder="ตัวอย่าง: RE-MKT-99"
                      className="w-full bg-theme-bg-page/60 border border-theme-border rounded-xl py-3 px-4 text-theme-text placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-sm"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmittingWorkspace}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 transition-all cursor-pointer"
                  >
                    {isSubmittingWorkspace ? 'กำลังสร้าง...' : 'สร้างและเชื่อมต่อ Workspace'}
                  </button>
                </form>
              )}

              {/* Detected HRMS Stats Card */}
              <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2 text-[11px]">
                <p className="font-bold text-slate-400 uppercase tracking-widest">
                  ข้อมูลโปรไฟล์ทางการของคุณ (HRMS Profile)
                </p>
                <div className="grid grid-cols-2 gap-y-1 text-slate-300 font-medium">
                  <div className="text-slate-400">รหัสพนักงาน:</div>
                  <div className="font-mono text-indigo-400">{user.empId || 'N/A'}</div>
                  <div className="text-slate-400">ตำแหน่งงาน:</div>
                  <div className="text-slate-200">{user.position || 'N/A'}</div>
                  <div className="text-slate-400">หน่วยงาน (BU):</div>
                  <div className="text-slate-200">{user.department || 'N/A'}</div>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  isCollapsed?: boolean;
  onClick?: () => void;
  forceActive?: boolean;
  end?: boolean;
}

function NavItem({ to, icon, label, isCollapsed, onClick, forceActive, end }: NavItemProps) {
  const activeClass = "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 after:absolute after:left-0 after:top-1/4 after:h-1/2 after:w-1 after:bg-indigo-600 dark:after:bg-indigo-500 after:rounded-r-full shadow-sm dark:shadow-none";
  const inactiveClass = "text-theme-text-secondary hover:bg-theme-surface-tertiary hover:text-theme-text border border-transparent";

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-xl transition-all duration-300 group text-sm font-semibold relative overflow-hidden",
          isCollapsed ? "md:justify-center space-x-3 md:space-x-0 py-3" : "space-x-3 px-4 py-3",
          (forceActive !== undefined ? forceActive : isActive) ? activeClass : inactiveClass
        )
      }
      title={isCollapsed ? label : undefined}
    >
      <span className={cn(
        "transition-all duration-300 group-hover:scale-110 shrink-0",
        "text-theme-text-muted group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
      )}>
        {icon}
      </span>
      {!isCollapsed ? (
        <span className="tracking-wide whitespace-nowrap animate-fade-in">{label}</span>
      ) : (
        <span className="tracking-wide whitespace-nowrap animate-fade-in md:hidden">{label}</span>
      )}
    </NavLink>
  );
}

function SysAdminSection({ isCollapsed, onNav }: { isCollapsed: boolean; onNav: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const isWorkspacesActive = location.pathname === '/workspaces';
  const isMasterDataActive = location.pathname === '/admin';

  return (
    <div className="border-t border-rose-500/20 my-2 pt-2">
      {!isCollapsed && (
        <h3 className="px-4 pb-1.5 flex items-center gap-1.5 text-[9.5px] font-black uppercase text-rose-400 tracking-widest font-mono">
          <Shield size={10} />
          {t('nav.systemAdmin')}
        </h3>
      )}
      <NavItem
        to="/workspaces"
        icon={<LayoutGrid size={18} />}
        label={t('nav.workspaces')}
        isCollapsed={isCollapsed}
        onClick={onNav}
        forceActive={isWorkspacesActive}
      />
      <NavItem
        to="/admin"
        icon={<Database size={18} />}
        label={t('nav.admin')}
        isCollapsed={isCollapsed}
        onClick={onNav}
        forceActive={isMasterDataActive}
        end
      />
      <NavItem
        to="/migrate"
        icon={<UploadCloud size={18} />}
        label={t('nav.migrate')}
        isCollapsed={isCollapsed}
        onClick={onNav}
      />
    </div>
  );
}
