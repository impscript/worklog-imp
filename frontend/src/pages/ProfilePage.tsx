import { useState, useEffect } from 'react';
import { LogOut, Shield, Award, Calendar, BookOpen, CalendarRange, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    const sessionStr = sessionStorage.getItem('worklog_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
    const sessionData = JSON.parse(sessionStr);
    setSession(sessionData);


    // Handle Google Calendar redirect callback hash
    if (window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes('access_token')) {
        // Clear hash fragment from address bar immediately
        window.history.replaceState(null, "", window.location.pathname);
        
        async function processOAuthCallback() {
          try {
            setIsSyncing(true);
            const conn = await googleCalendar.handleCallbackHash(hash);
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
          .eq('user_id', sessionData.id);

        if (logs) {
          const totalHours = logs.reduce((sum, item) => sum + parseFloat(item.total_hours), 0);
          const uniqueDays = new Set(logs.map((item) => item.work_date)).size;
          setStats({
            totalHours,
            totalDays: uniqueDays,
            totalTasks: logs.length
          });
        }

        // 3. Fetch Google Calendar Settings from DB
        const { data: dbUser } = await supabase
          .from('users')
          .select('gcal_sync_enabled, gcal_email, gcal_calendar_id')
          .eq('id', sessionData.id)
          .maybeSingle();

        if (dbUser) {
          setGcalSyncEnabled(dbUser.gcal_sync_enabled || false);
          setGcalEmail(dbUser.gcal_email || '');
          setGcalCalendarId(dbUser.gcal_calendar_id || 'primary');
          
          // Verify if actual token is active in local storage
          const activeToken = googleCalendar.getAccessToken();
          if (activeToken) {
            setGcalConnected(true);
          } else {
            setGcalConnected(false);
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

  const handleLogout = () => {
    sessionStorage.removeItem('worklog_session');
    navigate('/login');
  };

  const handleConnectGCal = () => {
    window.location.href = googleCalendar.getAuthUrl();
  };

  const handleDisconnectGCal = async () => {
    googleCalendar.disconnect();
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            User Profile
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your account settings, holdings, and system preferences.
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          {/* Glass background highlights */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            {/* Avatar — WMS Face Photo */}
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-800 flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0 ring-2 ring-indigo-500/20">
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
                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
                  {session?.department || 'IMP'} Department ({session?.role || 'User'})
                </span>
                <h2 className="text-2xl font-black text-white mt-2.5 tracking-tight">{session?.name}</h2>
                <p className="text-sm text-slate-400 mt-0.5">{session?.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm pt-2">
                <div className="bg-[#0F172A]/50 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Employee ID</span>
                  <span className="text-sm font-semibold text-slate-200 font-mono mt-0.5 block">{session?.empId || 'EMP-XXXXX'}</span>
                </div>
                <div className="bg-[#0F172A]/50 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nickname</span>
                  <span className="text-sm font-semibold text-slate-200 mt-0.5 block">{session?.name?.split(' ')[0] || 'User'}</span>
                </div>
              </div>
            </div>

            {/* Action */}
            <button 
              onClick={handleLogout}
              className="inline-flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-sm font-bold px-6 py-3 rounded-2xl transition-all active:scale-95 whitespace-nowrap self-center md:self-start"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
              <Award size={24} className="text-indigo-400" />
              <h3 className="text-xl font-bold text-white tracking-tight">Performance Statistics</h3>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="h-28 bg-slate-800 animate-pulse rounded-2xl"></div>
                <div className="h-28 bg-slate-800 animate-pulse rounded-2xl"></div>
                <div className="h-28 bg-slate-800 animate-pulse rounded-2xl"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Logged Days */}
                <div className="bg-[#0F172A]/50 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700/30 transition-all duration-300">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Logged Days</span>
                    <span className="text-2xl font-black text-white mt-1 block">{stats.totalDays}</span>
                  </div>
                </div>

                {/* Total Tasks */}
                <div className="bg-[#0F172A]/50 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700/30 transition-all duration-300">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Total Tasks</span>
                    <span className="text-2xl font-black text-white mt-1 block">
                      {stats.totalTasks} <span className="text-xs text-slate-400 font-normal font-mono">Logs</span>
                    </span>
                  </div>
                </div>

                {/* Total Hours */}
                <div className="bg-[#0F172A]/50 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700/30 transition-all duration-300">
                  <div className="p-3 bg-[#0F172A]/80 border border-slate-800 rounded-xl text-indigo-400">
                    <Shield size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Total Hours</span>
                    <span className="text-2xl font-black text-indigo-400 mt-1 block">
                      {stats.totalHours.toFixed(1)} <span className="text-xs text-slate-400 font-normal font-mono">hrs</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Google Calendar Sync Card */}
        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <CalendarRange className="text-indigo-400" size={24} />
                  <span>Google Calendar Synchronization</span>
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Sync your normal work logs and OT shifts to your Google Calendar in real-time.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                {gcalConnected ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>Not Connected</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              {/* Left Side: Sync Toggle and Settings */}
              <div className="space-y-6">
                {/* Sync Toggle */}
                <div className="flex items-center justify-between p-4 bg-[#0F172A]/40 border border-slate-800 rounded-2xl hover:border-slate-700/30 transition-all">
                  <div>
                    <span className="text-sm font-bold text-slate-200 block">Automatic Synchronization</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">
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
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                  </label>
                </div>

                {/* Calendar ID Configuration */}
                <div className="p-4 bg-[#0F172A]/40 border border-slate-800 rounded-2xl space-y-3">
                  <div>
                    <span className="text-sm font-bold text-slate-200 block">Target Calendar ID</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">
                      Use "primary" or enter a shared Google Calendar ID.
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={gcalCalendarId}
                      onChange={(e) => setGcalCalendarId(e.target.value)}
                      placeholder="primary"
                      className="flex-1 bg-[#0F172A] border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono focus:outline-none transition-colors"
                    />
                    <button
                      onClick={() => handleSaveCalendarId(gcalCalendarId)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: Account connection & status */}
              <div className="p-6 bg-[#0F172A]/40 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Google Session</span>
                  {gcalConnected ? (
                    <div>
                      <span className="text-base font-bold text-white block">{gcalEmail}</span>
                      <span className="text-xs text-slate-400 mt-1 block">
                        Work logs synced using this account will appear directly on your calendar timeline.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm text-slate-400 block">
                        Authorize connection to Google Calendar to begin syncing your daily activities and overtime segments.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  {gcalConnected ? (
                    <button
                      onClick={handleDisconnectGCal}
                      className="w-full inline-flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95"
                    >
                      <XCircle size={16} />
                      <span>Disconnect Google Account</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGCal}
                      disabled={isSyncing}
                      className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/25 disabled:opacity-50"
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
          <div className="fixed bottom-6 right-6 z-50 bg-[#1E293B] border border-slate-700/80 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
