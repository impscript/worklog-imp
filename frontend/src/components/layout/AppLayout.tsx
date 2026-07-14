import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, FileText, Trophy, User, PlusCircle, Menu, X, LogOut, Database, Cpu, UploadCloud, ChevronLeft, ChevronRight, Sun, Moon, FolderTree, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { syncWorklogToGCal } from '../../lib/google-calendar';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';

type SessionUser = { 
  id: string; 
  name: string; 
  role: string; 
  workspaceRole?: 'admin' | 'manager' | 'user'; 
  empId?: string; 
  activeWorkspaceId?: string;
  workspaceInviteCode?: string;
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });
  const [user, setUser] = useState<SessionUser | null>(getSessionUser);
  const navigate = useNavigate();
  const { showToast } = useNotification();

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
  const { theme, toggleTheme } = useTheme();

  // Page access gating & redirection
  useEffect(() => {
    if (!user) return;
    const path = window.location.pathname;
    
    const isSuperAdmin = user.role === 'admin';
    const isWorkspaceAdmin = user.workspaceRole === 'admin';
    const isWorkspaceManager = user.workspaceRole === 'manager';

    if (path === '/admin' && !isSuperAdmin) {
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
    if (path === '/calendar' && !(isSuperAdmin || isWorkspaceAdmin || isWorkspaceManager)) {
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
            .eq('id', pending.logId);

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

  const handleLogout = () => {
    localStorage.removeItem('worklog_session');
    navigate('/login');
  };

  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
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

          <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto mt-2">
            <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavItem to="/log" icon={<PlusCircle size={18} />} label="Log Work" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            
            {(user?.role === 'admin' || user?.workspaceRole === 'admin' || user?.workspaceRole === 'manager') && (
              <NavItem to="/calendar" icon={<Calendar size={18} />} label="Calendar" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            
            {(user?.role === 'admin' || user?.workspaceRole === 'admin' || user?.workspaceRole === 'manager') && (
              <NavItem to="/reports" icon={<FileText size={18} />} label="Reports" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            
            <NavItem to="/leaderboard" icon={<Trophy size={18} />} label="Leaderboard" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavItem to="/hrbp" icon={<Cpu size={18} />} label="AI Enhance" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            <NavItem to="/ai-chat" icon={<MessageSquare size={18} />} label="AI Chat" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            
            {(user?.role === 'admin' || user?.workspaceRole === 'admin') && (
              <NavItem to="/team" icon={<User size={18} />} label="Manage Team" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            
            {(user?.role === 'admin' || user?.workspaceRole === 'admin') && (
              <NavItem to="/migrate" icon={<UploadCloud size={18} />} label="Data Migration" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            
            {user?.role === 'admin' && (
              <NavItem to="/admin" icon={<Database size={18} />} label="Master Data" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            
            {(user?.role === 'admin' || user?.workspaceRole === 'admin' || user?.workspaceRole === 'manager') && (
              <NavItem to="/projects" icon={<FolderTree size={18} />} label="Project Registry" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
            )}
            
            <NavItem to="/profile" icon={<User size={18} />} label="Profile" isCollapsed={isCollapsed} onClick={() => setIsSidebarOpen(false)} />
          </nav>

          {/* Logout button at bottom of sidebar */}
          <div className="p-4 border-t border-theme-border/80 bg-theme-surface/50 dark:bg-theme-bg-page/20">
            <button
              onClick={handleLogout}
              className={cn(
                "flex items-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 transition-all text-sm font-semibold tracking-wide w-full",
                isCollapsed ? "md:justify-center space-x-3 md:space-x-0 py-3" : "space-x-3 px-4 py-3"
              )}
              title={isCollapsed ? "Sign Out" : undefined}
            >
              <LogOut size={18} className="shrink-0" />
              {!isCollapsed ? (
                <span className="whitespace-nowrap animate-fade-in">Sign Out</span>
              ) : (
                <span className="whitespace-nowrap animate-fade-in md:hidden">Sign Out</span>
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
          <div className="flex items-center space-x-3 ml-auto">
            <span className="hidden sm:inline-block text-xs font-semibold text-theme-text-secondary bg-theme-surface-secondary border border-theme-border/80 px-3 py-1.5 rounded-lg font-mono tracking-wide">
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

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
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
}

function NavItem({ to, icon, label, isCollapsed, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-xl transition-all duration-300 group text-sm font-semibold relative overflow-hidden",
          isCollapsed ? "md:justify-center space-x-3 md:space-x-0 py-3" : "space-x-3 px-4 py-3",
          isActive 
            ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 after:absolute after:left-0 after:top-1/4 after:h-1/2 after:w-1 after:bg-indigo-600 dark:after:bg-indigo-500 after:rounded-r-full shadow-sm dark:shadow-none" 
            : "text-theme-text-secondary hover:bg-theme-surface-tertiary hover:text-theme-text border border-transparent"
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
