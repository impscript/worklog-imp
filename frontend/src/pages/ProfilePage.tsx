import { useState, useEffect } from 'react';
import { LogOut, Shield, Award, Calendar, BookOpen, CalendarRange, CheckCircle2, XCircle, RefreshCw, Edit } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { googleCalendar } from '../lib/google-calendar';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState({
    totalHours: 0,
    totalDays: 0,
    totalTasks: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // Google Calendar Integration states
  const [gcalSyncEnabled, setGcalSyncEnabled] = useState(false);
  const [gcalEmail, setGcalEmail] = useState('');
  const [gcalCalendarId, setGcalCalendarId] = useState('primary');
  const [gcalConnected, setGcalConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit Profile States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editEmployeeLevel, setEditEmployeeLevel] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editRoleStartDate, setEditRoleStartDate] = useState('');
  const [editManagerName, setEditManagerName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
    const sessionData = JSON.parse(sessionStr);
    setSession(sessionData);


    // Handle Google Calendar redirect callback code (offline access)
    if (window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        // Clear query parameters from address bar immediately
        window.history.replaceState(null, "", window.location.pathname);
        
        async function processOAuthCallbackCode() {
          try {
            setIsSyncing(true);
            const conn = await googleCalendar.handleCallbackCode(
              code as string, 
              window.location.origin + '/profile', 
              sessionData?.id || ''
            );
            if (conn.connected) {
              setGcalConnected(true);
              setGcalEmail(conn.email || '');
              setGcalSyncEnabled(true);
              setToastMessage('Google Calendar Connected Successfully! 🎉');
              
              const origin = localStorage.getItem('gcal_pending_origin');
              if (origin) {
                localStorage.removeItem('gcal_pending_origin');
                setTimeout(() => {
                  navigate(origin);
                }, 1200);
                return;
              }
              
              setTimeout(() => setToastMessage(null), 5000);
            }
          } catch (err) {
            console.error('Failed to parse Google OAuth callback code:', err);
            setToastMessage('Failed to connect Google Calendar.');
            setTimeout(() => setToastMessage(null), 5000);
          } finally {
            setIsSyncing(false);
          }
        }
        processOAuthCallbackCode();
      }
    }

    // Handle Google Calendar redirect callback hash (Legacy fallback)
    if (window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes('access_token')) {
        // Clear hash fragment from address bar immediately
        window.history.replaceState(null, "", window.location.pathname);
        
        async function processOAuthCallback() {
          try {
            setIsSyncing(true);
            const conn = await googleCalendar.handleCallbackHash(hash, sessionData.id);
            if (conn.connected) {
              setGcalConnected(true);
              setGcalEmail(conn.email || '');
              
              // Enable sync in database and local state
              await supabase
                .from('users')
                .update({
                  gcal_sync_enabled: true,
                  gcal_email: conn.email || ''
                })
                .eq('id', sessionData.id);
              
              setGcalSyncEnabled(true);
              setToastMessage('Google Calendar Connected Successfully! 🎉');
              
              const origin = localStorage.getItem('gcal_pending_origin');
              if (origin) {
                localStorage.removeItem('gcal_pending_origin');
                setTimeout(() => {
                  navigate(origin);
                }, 1200);
                return;
              }
              
              setTimeout(() => setToastMessage(null), 5000);
            }
          } catch (err) {
            console.error('Failed to parse Google OAuth callback:', err);
          } finally {
            setIsSyncing(false);
          }
        }
        processOAuthCallback();
      }
    }

    async function loadProfileData() {
      try {
        setIsLoading(true);


        // 2. Fetch col_worklog summary stats
        const { data: logs } = await supabase
          .from('col_worklog')
          .select('work_date, total_hours')
          .eq('user_id', sessionData.id)
          .eq('workspace_id', sessionData.activeWorkspaceId);

        if (logs) {
          const totalHours = logs.reduce((sum, item) => sum + parseFloat(item.total_hours), 0);
          const uniqueDays = new Set(logs.map((item) => item.work_date)).size;
          setStats({
            totalHours,
            totalDays: uniqueDays,
            totalTasks: logs.length
          });
        }

        // 3. Fetch Google Calendar Settings & HR profile details from DB (including nickname, position, and full_name)
        const { data: dbUser } = await supabase
          .from('users')
          .select('gcal_sync_enabled, gcal_email, gcal_calendar_id, full_name, nickname, position, employee_level, role_start_date, company_name, manager_name, active_workspace_id')
          .eq('id', sessionData.id)
          .maybeSingle();

        let workspaceName = '';
        let workspaceInviteCode = '';

        if (dbUser?.active_workspace_id) {
          const { data: wsData } = await supabase
            .from('workspaces')
            .select('workspace_name, invite_code')
            .eq('id', dbUser.active_workspace_id)
            .maybeSingle();
          if (wsData) {
            workspaceName = wsData.workspace_name;
            workspaceInviteCode = wsData.invite_code;
          }
        }

        if (dbUser) {
          setGcalSyncEnabled(dbUser.gcal_sync_enabled || false);
          setGcalEmail(dbUser.gcal_email || '');
          setGcalCalendarId(dbUser.gcal_calendar_id || 'primary');
          setGcalConnected(dbUser.gcal_sync_enabled || false);
          
          // Merge DB profile details into session state so it's easily accessible in rendering
          setSession((prev: any) => ({
            ...prev,
            name: dbUser.full_name || prev.name,
            nickname: dbUser.nickname || prev.nickname,
            position: dbUser.position || prev.position,
            employee_level: dbUser.employee_level,
            role_start_date: dbUser.role_start_date,
            company_name: dbUser.company_name,
            manager_name: dbUser.manager_name,
            activeWorkspaceId: dbUser.active_workspace_id,
            workspaceName,
            workspaceInviteCode
          }));

          if (dbUser.gcal_sync_enabled) {
            // Attempt to silently refresh token in the background so the UI updates
            await googleCalendar.getAccessTokenAsync(sessionData.id);
          }
        }
      } catch (err) {
        console.error('Error loading profile data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfileData();
  }, [navigate]);

  const handleOpenEditModal = () => {
    if (!session) return;
    setEditNickname(session.nickname || session.name?.split(' ')[0] || '');
    setEditPosition(session.position || '');
    setEditEmployeeLevel(session.employee_level || 'Senior');
    setEditCompanyName(session.company_name || '');
    setEditRoleStartDate(session.role_start_date || '');
    setEditManagerName(session.manager_name || '');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.id) return;

    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          nickname: editNickname,
          position: editPosition,
          employee_level: editEmployeeLevel,
          company_name: editCompanyName,
          role_start_date: editRoleStartDate || null,
          manager_name: editManagerName,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (error) throw error;

      // Update local session state
      const updatedSession = {
        ...session,
        nickname: editNickname,
        position: editPosition,
        employee_level: editEmployeeLevel,
        company_name: editCompanyName,
        role_start_date: editRoleStartDate,
        manager_name: editManagerName
      };
      setSession(updatedSession);

      // Sync back to localStorage session state (ALL profile fields, not just nickname/position)
      const localStorageSession = JSON.parse(localStorage.getItem('worklog_session') || '{}');
      const updatedLocalStorageSession = {
        ...localStorageSession,
        nickname: editNickname,
        position: editPosition,
        employee_level: editEmployeeLevel,
        company_name: editCompanyName,
        role_start_date: editRoleStartDate || null,
        manager_name: editManagerName,
      };
      localStorage.setItem('worklog_session', JSON.stringify(updatedLocalStorageSession));

      setToastMessage('Profile updated successfully! 🎉');
      setIsEditModalOpen(false);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Error saving profile changes:', err);
      alert('Failed to update profile: ' + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('worklog_session');
    localStorage.removeItem('gcal_pending_sync');
    localStorage.removeItem('gcal_pending_origin');
    navigate('/login');
  };

  const handleConnectGCal = () => {
    window.location.href = googleCalendar.getAuthUrl();
  };

  const handleDisconnectGCal = async () => {
    googleCalendar.disconnect(session?.id);
    setGcalConnected(false);
    setGcalEmail('');
    setGcalSyncEnabled(false);
    
    // Update DB
    if (session) {
      await supabase
        .from('users')
        .update({
          gcal_sync_enabled: false,
          gcal_email: null
        })
        .eq('id', session.id);
    }
    
    setToastMessage('Disconnected from Google Calendar Successfully.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleSync = async (checked: boolean) => {
    if (checked && !gcalConnected) {
      handleConnectGCal();
      return;
    }

    setGcalSyncEnabled(checked);
    if (session) {
      await supabase
        .from('users')
        .update({ gcal_sync_enabled: checked })
        .eq('id', session.id);
      
      setToastMessage(checked ? 'Google Calendar Sync Enabled! 🚀' : 'Google Calendar Sync Disabled.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleSaveCalendarId = async (id: string) => {
    setGcalCalendarId(id);
    if (session) {
      await supabase
        .from('users')
        .update({ gcal_calendar_id: id })
        .eq('id', session.id);
      
      setToastMessage('Calendar ID Updated Successfully! 📅');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const isTokenExpired = gcalConnected && !googleCalendar.getAccessToken(session?.id);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-theme-text tracking-tight theme-heading-gradient">
            User Profile
          </h1>
          <p className="text-sm text-theme-text-secondary mt-1">
            Manage your account settings, holdings, and system preferences.
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          {/* Glass background highlights */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            {/* Avatar — WMS Face Photo */}
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-theme-surface-tertiary dark:bg-theme-surface-tertiary flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0 ring-2 ring-indigo-500/20">
              <img
                src={`https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${session?.empId}`}
                alt={session?.name || 'Profile'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to ui-avatars if WMS image not found
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(session?.name || 'User')}&background=6366f1&color=fff&size=128&bold=true`;
                }}
              />
            </div>

            {/* Info details */}
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
                  {session?.department || 'IMP'} Department ({session?.role || 'User'})
                </span>
                <h2 className="text-2xl font-black text-theme-text mt-2.5 tracking-tight">{session?.name}</h2>
                <p className="text-sm text-theme-text-secondary mt-0.5">{session?.email}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl pt-2">
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-3">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Employee ID</span>
                  <span className="text-sm font-semibold text-theme-text font-mono mt-0.5 block">{session?.empId || 'EMP-XXXXX'}</span>
                </div>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-3">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Nickname</span>
                  <span className="text-sm font-semibold text-theme-text mt-0.5 block">{session?.nickname || session?.name?.split(' ')[0] || 'User'}</span>
                </div>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-3">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Position (ตำแหน่ง)</span>
                  <span className="text-sm font-semibold text-theme-text mt-0.5 block truncate" title={session?.position}>{session?.position || 'N/A'}</span>
                </div>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-3">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Level</span>
                  <span className="text-sm font-semibold text-theme-text mt-0.5 block">{session?.employee_level || 'N/A'}</span>
                </div>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-3">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Company</span>
                  <span className="text-sm font-semibold text-theme-text mt-0.5 block truncate" title={session?.company_name}>{session?.company_name || 'N/A'}</span>
                </div>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-3">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Start Date</span>
                  <span className="text-sm font-semibold text-theme-text mt-0.5 block">
                    {session?.role_start_date ? new Date(session.role_start_date).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </span>
                </div>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-3">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Tenure (อายุงาน)</span>
                  <span className="text-sm font-semibold text-theme-text mt-0.5 block">
                    {session?.role_start_date ? (
                      (() => {
                        const start = new Date(session.role_start_date);
                        const diffMs = new Date().getTime() - start.getTime();
                        const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
                        return `${years.toFixed(1)} ปี`;
                      })()
                    ) : 'N/A'}
                  </span>
                </div>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-3 col-span-2">
                  <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Manager Name</span>
                  <span className="text-sm font-semibold text-theme-text mt-0.5 block">{session?.manager_name || 'N/A'}</span>
                </div>
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-xl p-5 col-span-3 space-y-4">
                  {session?.role === 'admin' && (!session?.activeWorkspaceId || session?.activeWorkspaceId === 'N/A') ? (
                    /* Super Admin — no workspace */
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                        <Shield size={20} className="text-rose-400" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Super Admin Account</span>
                        <span className="text-sm font-bold text-theme-text mt-0.5 block">
                          บัญชีนี้เป็นผู้ดูแลระบบส่วนกลาง ไม่ได้สังกัดฝ่ายงานใดๆ
                        </span>
                        <span className="text-xs text-theme-text-muted mt-1 block">
                          มีสิทธิ์เข้าถึงทุก Workspace และจัดการข้อมูลได้ทั้งระบบ
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Normal user — show workspace info */
                    <>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Active Workspace (ฝ่ายงานที่สังกัด)</span>
                      <div className="divide-y divide-theme-border/50">
                        {/* Workspace Name */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
                          <div>
                            <span className="text-[9px] text-theme-text-muted uppercase font-bold tracking-wider">Workspace Name</span>
                            <span className="text-sm font-bold text-theme-text mt-0.5 block">
                              {session?.workspaceName || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Workspace Code (Invite) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
                          <div>
                            <span className="text-[9px] text-theme-text-muted uppercase font-bold tracking-wider">Workspace Code (รหัสเชิญสำหรับหัวหน้างาน)</span>
                            <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
                              {session?.workspaceInviteCode || 'N/A'}
                            </span>
                          </div>
                          {session?.workspaceInviteCode && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(session.workspaceInviteCode);
                                alert('คัดลอกรหัสเชิญสำเร็จ! / Copied Invite Code!');
                              }}
                              className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all active:scale-95 w-fit"
                            >
                              Copy Invite Code
                            </button>
                          )}
                        </div>

                        {/* Workspace ID */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3">
                          <div>
                            <span className="text-[9px] text-theme-text-muted uppercase font-bold tracking-wider">Workspace ID (สำหรับผู้ดูแลระบบ/ไอที)</span>
                            <span className="text-xs font-semibold text-theme-text-secondary font-mono mt-0.5 block">
                              {session?.activeWorkspaceId || 'N/A'}
                            </span>
                          </div>
                          {session?.activeWorkspaceId && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(session.activeWorkspaceId);
                                alert('คัดลอก Workspace ID สำเร็จ! / Copied Workspace ID!');
                              }}
                              className="bg-slate-800 hover:bg-slate-700 text-theme-text-secondary text-xs font-bold px-3 py-1.5 rounded-lg border border-theme-border transition-all active:scale-95 w-fit"
                            >
                              Copy Full ID
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="flex flex-col gap-3 self-center md:self-start shrink-0">
              <button 
                onClick={handleOpenEditModal}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-6 py-3 rounded-2xl transition-all active:scale-95 whitespace-nowrap"
              >
                <Edit size={16} />
                <span>Edit Profile</span>
              </button>
              
              <button 
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-sm font-bold px-6 py-3 rounded-2xl transition-all active:scale-95 whitespace-nowrap"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3 border-b border-theme-border/80 pb-4">
              <Award size={24} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xl font-bold text-theme-text tracking-tight">Performance Statistics</h3>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="h-28 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary animate-pulse rounded-2xl"></div>
                <div className="h-28 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary animate-pulse rounded-2xl"></div>
                <div className="h-28 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary animate-pulse rounded-2xl"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Logged Days */}
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-2xl p-5 flex items-center gap-4 hover:border-theme-border/30 transition-all duration-300">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-theme-text-secondary font-medium block">Logged Days</span>
                    <span className="text-2xl font-black text-theme-text mt-1 block">{stats.totalDays}</span>
                  </div>
                </div>

                {/* Total Tasks */}
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-2xl p-5 flex items-center gap-4 hover:border-theme-border/30 transition-all duration-300">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-theme-text-secondary font-medium block">Total Tasks</span>
                    <span className="text-2xl font-black text-theme-text mt-1 block">
                      {stats.totalTasks} <span className="text-xs text-theme-text-secondary font-normal font-mono">Logs</span>
                    </span>
                  </div>
                </div>

                {/* Total Hours */}
                <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border rounded-2xl p-5 flex items-center gap-4 hover:border-theme-border/30 transition-all duration-300">
                  <div className="p-3 bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border border-theme-border rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Shield size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-theme-text-secondary font-medium block">Total Hours</span>
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                      {stats.totalHours.toFixed(1)} <span className="text-xs text-theme-text-secondary font-normal font-mono">hrs</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Google Calendar Sync Card */}
        <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border/80 pb-6">
              <div>
                <h3 className="text-xl font-bold text-theme-text flex items-center gap-2.5">
                  <CalendarRange className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <span>Google Calendar Synchronization</span>
                </h3>
                <p className="text-sm text-theme-text-secondary mt-1">
                  Sync your normal work logs and OT shifts to your Google Calendar in real-time.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                {gcalConnected ? (
                  isTokenExpired ? (
                    <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm shadow-amber-500/10">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      <span>Linked (Auth Expired)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm shadow-emerald-500/10">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Connected & Active</span>
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-theme-surface-secondary0/10 text-theme-text-secondary border border-slate-500/20 text-xs font-bold px-3 py-1.5 rounded-full">
                    <span>Not Connected</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              {/* Left Side: Sync Toggle and Settings */}
              <div className="space-y-6">
                {/* Sync Toggle */}
                <div className="flex items-center justify-between p-4 bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 border border-theme-border rounded-2xl hover:border-theme-border/30 transition-all">
                  <div>
                    <span className="text-sm font-bold text-theme-text block">Automatic Synchronization</span>
                    <span className="text-xs text-theme-text-secondary mt-0.5 block">
                      Sync shifts automatically when creating or editing logs.
                    </span>
                  </div>
                  
                  {/* Premium Switch */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={gcalSyncEnabled}
                      onChange={(e) => handleToggleSync(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                  </label>
                </div>

                {/* Calendar ID Configuration */}
                <div className="p-4 bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 border border-theme-border rounded-2xl space-y-3">
                  <div>
                    <span className="text-sm font-bold text-theme-text block">Target Calendar ID</span>
                    <span className="text-xs text-theme-text-secondary mt-0.5 block">
                      Use "primary" or enter a shared Google Calendar ID.
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={gcalCalendarId}
                      onChange={(e) => setGcalCalendarId(e.target.value)}
                      placeholder="primary"
                      className="flex-1 bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-theme-text font-mono focus:outline-none transition-colors"
                    />
                    <button
                      onClick={() => handleSaveCalendarId(gcalCalendarId)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-theme-text font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: Account connection & status */}
              <div className="p-6 bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 border border-theme-border rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Google Session</span>
                  {gcalConnected ? (
                    <div>
                      <span className="text-base font-bold text-theme-text block">{gcalEmail}</span>
                      <span className="text-xs text-theme-text-secondary mt-1 block">
                        {isTokenExpired 
                          ? "Your Google session has expired. Please click below to refresh it for continuous background sync." 
                          : "Work logs synced using this account will appear directly on your calendar timeline."}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm text-theme-text-secondary block">
                        Authorize connection to Google Calendar to begin syncing your daily activities and overtime segments.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  {gcalConnected ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      {isTokenExpired && (
                        <button
                          onClick={handleConnectGCal}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-theme-text text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-600/25"
                        >
                          <RefreshCw size={16} />
                          <span>Re-authorize Session</span>
                        </button>
                      )}
                      <button
                        onClick={handleDisconnectGCal}
                        className={`inline-flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95 ${isTokenExpired ? "w-auto" : "w-full"}`}
                      >
                        <XCircle size={16} />
                        <span>{isTokenExpired ? "Disconnect" : "Disconnect Google Account"}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectGCal}
                      disabled={isSyncing}
                      className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-theme-text text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      <span>Connect Google Account</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-theme-surface dark:bg-theme-surface-tertiary border border-theme-border/80 text-theme-text px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Edit Profile Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-theme-surface border border-theme-border rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold text-theme-text mb-4 flex items-center gap-2">
                <Edit className="text-indigo-600 dark:text-indigo-400" size={20} />
                <span>Edit User Profile</span>
              </h3>
              <p className="text-xs text-theme-text-secondary mb-6">
                Update your professional profile details. These details are used by reports and AI evaluations.
              </p>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold block mb-1.5">Nickname</label>
                    <input
                      type="text"
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full bg-theme-surface-secondary border border-theme-border focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-theme-text focus:outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold block mb-1.5">Level</label>
                    <input
                      type="text"
                      value={editEmployeeLevel}
                      onChange={(e) => setEditEmployeeLevel(e.target.value)}
                      placeholder="e.g. Senior"
                      className="w-full bg-theme-surface-secondary border border-theme-border focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-theme-text focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold block mb-1.5">Position</label>
                  <input
                    type="text"
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    placeholder="e.g. Senior Developer"
                    className="w-full bg-theme-surface-secondary border border-theme-border focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-theme-text focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold block mb-1.5">Company</label>
                  <input
                    type="text"
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    placeholder="e.g. Double A"
                    className="w-full bg-theme-surface-secondary border border-theme-border focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-theme-text focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold block mb-1.5">Start Date</label>
                    <input
                      type="date"
                      value={editRoleStartDate}
                      onChange={(e) => setEditRoleStartDate(e.target.value)}
                      className="w-full bg-theme-surface-secondary border border-theme-border focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-theme-text focus:outline-none transition-colors animate-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold block mb-1.5">Manager Name</label>
                    <input
                      type="text"
                      value={editManagerName}
                      onChange={(e) => setEditManagerName(e.target.value)}
                      placeholder="Manager's Full Name"
                      className="w-full bg-theme-surface-secondary border border-theme-border focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-theme-text focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-theme-border/80 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-theme-surface-secondary border border-theme-border hover:bg-theme-surface-secondary/85 text-theme-text-secondary rounded-xl text-sm font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
