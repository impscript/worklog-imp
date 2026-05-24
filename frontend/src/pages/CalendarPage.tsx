import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, ClipboardList, Clock, Eye, RefreshCw, CalendarCheck } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import EditWorklogModal from '../components/modals/EditWorklogModal';
import ViewWorklogModal from '../components/modals/ViewWorklogModal';
import { googleCalendar, syncWorklogToGCal } from '../lib/google-calendar';

interface WorklogEntry {
  id: string;
  user_id: string;
  work_date: string;
  total_hours: number;
  project_name: string;
  action_name: string;
  description: string | null;
  is_ot?: boolean;
  is_implied_ot?: boolean;
  action_channel?: string | null;
  gcal_event_id?: string | null;
  start_time?: string;
  end_time?: string;
  holding?: string;
  department_operator?: string;
  project_type?: string;
  bu?: string;
  department?: string;
  module?: string | null;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<WorklogEntry[]>([]);
  const [selectedDateEntries, setSelectedDateEntries] = useState<WorklogEntry[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [viewingLog, setViewingLog] = useState<WorklogEntry | null>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [usersList, setUsersList] = useState<{id: string; full_name: string; emp_id: string}[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);

  // ── GCal Re-Sync State ───────────────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalSyncEnabled, setGcalSyncEnabled] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────────

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper: Format date to YYYY-MM-DD
  const formatDateToYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Month boundary strings for filtering
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  // ── Sync stats for current month (current user only) ─────────────────────────
  const currentMonthEntries = useMemo(() => {
    const targetId = selectedUserId || sessionUser?.id;
    return entries.filter(
      (e) => e.user_id === targetId && e.work_date >= monthStart && e.work_date <= monthEnd
    );
  }, [entries, selectedUserId, sessionUser, monthStart, monthEnd]);

  const syncedCount = useMemo(() => currentMonthEntries.filter((e) => !!e.gcal_event_id).length, [currentMonthEntries]);
  const unsyncedEntries = useMemo(() => currentMonthEntries.filter((e) => !e.gcal_event_id), [currentMonthEntries]);
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
    const session = JSON.parse(sessionStr);
    
    // Only set session user and default selected user on mount
    if (!sessionUser) {
      setSessionUser(session);
      if (!selectedUserId) {
        setSelectedUserId(session.id);
      }
      
      // If admin, fetch users list
      if (session.role === 'admin') {
        supabase.from('users').select('id, full_name, emp_id').order('full_name').then(({data}) => {
          if (data) setUsersList(data);
        });
      }
    }

    const currentTargetId = selectedUserId || session.id;

    async function fetchMonthEntries() {
      try {
        setIsLoading(true);
        // Fetch all user entries (including gcal_event_id for sync status)
        const { data, error } = await supabase
          .from('col_worklog')
          .select('*')
          .eq('user_id', currentTargetId);

        if (error) {
          console.error('Error fetching calendar entries:', error);
        } else if (data) {
          const mapped = data.map((item: any) => ({
            ...item,
            total_hours: parseFloat(item.total_hours)
          }));
          setEntries(mapped);

          // Update side panel if a date was selected
          if (selectedDateStr) {
            setSelectedDateEntries(mapped.filter((e) => e.work_date === selectedDateStr));
          }
        }
      } catch (err) {
        console.error('Error in fetchMonthEntries:', err);
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchHolidays() {
      try {
        const { data, error } = await supabase
          .from('tb_master_holiday')
          .select('*');
        if (error) {
          console.error('Error fetching holidays:', error);
        } else if (data) {
          setHolidays(data);
        }
      } catch (err) {
        console.error('Error in fetchHolidays:', err);
      }
    }

    fetchMonthEntries();
    fetchHolidays();
  }, [navigate, selectedDateStr, refreshTrigger, selectedUserId, sessionUser]);

  // ── Check GCal connection whenever session user is loaded ─────────────────────
  useEffect(() => {
    if (!sessionUser?.id) return;
    googleCalendar.checkSessionReady(sessionUser.id).then(({ ready, syncEnabled }) => {
      setGcalSyncEnabled(syncEnabled);
      setGcalConnected(syncEnabled && ready);
    });
  }, [sessionUser]);

  // ── Month Re-Sync Handler ─────────────────────────────────────────────────────
  const handleMonthResync = async () => {
    if (isSyncing) return;
    if (!gcalConnected) {
      alert('Google Calendar ยังไม่ได้เชื่อมต่อ หรือ Session หมดอายุ\nกรุณาไปที่ Profile เพื่อ reconnect ก่อนนะคะ');
      return;
    }

    const toSync = unsyncedEntries;
    if (toSync.length === 0) {
      alert(`✅ ใบงานในเดือนนี้ sync ครบทั้งหมดแล้ว (${syncedCount}/${currentMonthEntries.length} ใบ)`);
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: toSync.length, status: 'กำลังเริ่ม...' });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < toSync.length; i++) {
      const entry = toSync[i];
      setSyncProgress({
        current: i + 1,
        total: toSync.length,
        status: `${entry.work_date} — ${entry.project_name.length > 30 ? entry.project_name.slice(0, 30) + '...' : entry.project_name}`
      });

      try {
        await syncWorklogToGCal(entry.id, 'insert');
        successCount++;
      } catch (err) {
        console.warn(`[Re-Sync] Failed for entry ${entry.id}:`, err);
        failCount++;
      }

      // Small delay to avoid rate limiting Google Calendar API
      await new Promise((r) => setTimeout(r, 300));
    }

    setIsSyncing(false);
    setSyncProgress(null);

    // Refresh entries to update gcal_event_id fields
    setRefreshTrigger((t) => t + 1);

    const msg = failCount > 0
      ? `✅ Sync เสร็จ: ${successCount} ใบ สำเร็จ, ${failCount} ใบ ล้มเหลว (ดู console สำหรับรายละเอียด)`
      : `✅ Sync สำเร็จทั้งหมด ${successCount} ใบ ในเดือน ${monthNames[month]} ${year}`;
    alert(msg);
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // Calendar calculations
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday, etc.
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Align start of week to Monday (Monday is 0, Sunday is 6)
  const mondayAlignedStart = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const prevMonthDays = new Date(year, month, 0).getDate();

  const daysArray = [];

  // Previous month fill days
  for (let i = mondayAlignedStart - 1; i >= 0; i--) {
    daysArray.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevMonthDays - i)
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i)
    });
  }

  // Next month fill days (pad to multiple of 7)
  const totalCells = Math.ceil(daysArray.length / 7) * 7;
  const remainingCells = totalCells - daysArray.length;
  for (let i = 1; i <= remainingCells; i++) {
    daysArray.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i)
    });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
    const tStr = formatDateToYMD(new Date());
    setSelectedDateStr(tStr);
    setSelectedDateEntries(entries.filter((e) => e.work_date === tStr));
  };

  const handleDayClick = (date: Date) => {
    const dStr = formatDateToYMD(date);
    setSelectedDateStr(dStr);
    setSelectedDateEntries(entries.filter((e) => e.work_date === dStr));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-theme-text tracking-tight theme-heading-gradient">
              Work Calendar
            </h1>
            <p className="text-sm text-theme-text-secondary mt-1">
              Visualize logged work hours and activities in a calendar dashboard.
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-end md:items-center gap-3">
            {sessionUser?.role === 'admin' && (
              <div className="relative w-48">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-theme-surface dark:bg-theme-surface-tertiary border border-theme-border/50 rounded-xl px-4 py-2.5 text-sm font-semibold text-theme-text-secondary appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary transition-colors"
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-theme-text-secondary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            )}

            {/* GCal Re-Sync Panel — only shown for own calendar with sync enabled */}
            {gcalSyncEnabled && selectedUserId === sessionUser?.id && (
              <div className="flex items-center gap-2">
                {/* Sync Status Badge */}
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold font-mono transition-colors",
                  syncedCount === currentMonthEntries.length && currentMonthEntries.length > 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : unsyncedEntries.length > 0
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : "bg-theme-surface-tertiary border-theme-border/50 text-theme-text-muted"
                )}>
                  <CalendarCheck size={12} />
                  <span>
                    {currentMonthEntries.length === 0
                      ? 'ไม่มีใบงานเดือนนี้'
                      : `${syncedCount}/${currentMonthEntries.length} synced`
                    }
                  </span>
                  {!gcalConnected && (
                    <span className="ml-1 text-rose-400">(disconnected)</span>
                  )}
                </div>

                {/* Re-Sync Button */}
                {unsyncedEntries.length > 0 && (
                  <button
                    onClick={handleMonthResync}
                    disabled={isSyncing}
                    title={`Re-sync ${unsyncedEntries.length} ใบงานที่ยังไม่ได้ sync`}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all active:scale-95",
                      isSyncing
                        ? "bg-indigo-500/5 border-indigo-500/10 text-indigo-400/50 cursor-not-allowed"
                        : gcalConnected
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 cursor-pointer"
                          : "bg-rose-500/10 border-rose-500/20 text-rose-400 cursor-pointer"
                    )}
                  >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                    <span>
                      {isSyncing
                        ? syncProgress ? `${syncProgress.current}/${syncProgress.total}` : '...'
                        : `Re-sync ${unsyncedEntries.length}`
                      }
                    </span>
                  </button>
                )}
              </div>
            )}

            <button 
              onClick={today}
              className="px-4 py-2 bg-theme-surface dark:bg-theme-surface-tertiary border border-theme-border/50 rounded-xl text-sm font-semibold text-theme-text-secondary hover:text-theme-text transition-all hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary"
            >
              Today
            </button>
            <div className="flex bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 border border-theme-border/50 rounded-xl overflow-hidden shadow-md">
              <button onClick={prevMonth} className="p-2.5 text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="px-4 py-2.5 text-sm font-semibold text-theme-text min-w-[140px] text-center font-mono">
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-2.5 text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary dark:hover:bg-theme-surface-tertiary transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Re-Sync Progress Bar — appears below header during sync */}
          {isSyncing && syncProgress && (
            <div className="w-full mt-2 bg-theme-surface-tertiary border border-indigo-500/20 rounded-2xl p-4 shadow-lg animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5">
                  <RefreshCw size={11} className="animate-spin" />
                  กำลัง Sync Google Calendar...
                </span>
                <span className="text-[11px] font-mono text-theme-text-secondary">
                  {syncProgress.current} / {syncProgress.total}
                </span>
              </div>
              <div className="h-1.5 bg-theme-surface-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-theme-text-muted mt-1.5 truncate font-mono">
                {syncProgress.status}
              </p>
            </div>
          )}
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Calendar Grid Container */}
          <div className="lg:col-span-2 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-6 shadow-xl flex flex-col">
            
            {/* Weekdays header */}
            <div className="grid grid-cols-7 gap-2 mb-4 text-center">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                const isWeekendLabel = day === 'Sat' || day === 'Sun';
                return (
                  <span 
                    key={day} 
                    className={cn(
                      "text-xs font-bold tracking-wider uppercase py-2",
                      isWeekendLabel ? "text-rose-400" : "text-theme-text-secondary"
                    )}
                  >
                    {day}
                  </span>
                );
              })}
            </div>

            {/* Days grid */}
            {isLoading ? (
              <div className="grid grid-cols-7 gap-2 animate-pulse flex-1 min-h-[350px]">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-theme-border/50 rounded-xl"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2 flex-1 min-h-[350px]">
                {daysArray.map((cell, index) => {
                  const dStr = formatDateToYMD(cell.date);
                  const dayEntries = entries.filter((e) => e.work_date === dStr);
                  const hoursSum = dayEntries.reduce((sum, e) => sum + e.total_hours, 0);
                  
                  const isSelected = selectedDateStr === dStr;
                  const isToday = formatDateToYMD(new Date()) === dStr;
                  const hasHours = hoursSum > 0;
                  
                  // Weekend & Holiday detection
                  const dayOfWeek = cell.date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0 Sunday, 6 Saturday
                  const holiday = holidays.find((h) => h.date === dStr);
                  
                  // Color intensities based on hours sum
                  let progressColor = "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
                  if (hoursSum >= 8) {
                    progressColor = "bg-indigo-500 text-theme-text shadow-md shadow-indigo-500/10";
                  } else if (hoursSum > 0) {
                    progressColor = "bg-indigo-500/40 text-indigo-600 dark:text-indigo-200 border-indigo-500/50";
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleDayClick(cell.date)}
                      className={cn(
                        "aspect-square rounded-xl p-2 flex flex-col justify-between items-stretch border transition-all text-left relative overflow-hidden group",
                        cell.isCurrentMonth 
                          ? cn(
                              "bg-theme-surface-secondary dark:bg-theme-surface-secondary/40 border-theme-border hover:border-theme-border",
                              isWeekend ? "bg-theme-surface-secondary dark:bg-theme-surface-secondary/35 border-theme-border/60" : "",
                              holiday ? "bg-rose-950/20 border-rose-500/25 hover:border-rose-400" : ""
                            ) 
                          : "bg-transparent border-transparent opacity-10 cursor-default pointer-events-none",
                        isSelected 
                          ? "ring-2 ring-indigo-500/80 border-transparent shadow-[0_0_15px_rgba(99,102,241,0.2)] bg-theme-surface-modal/90 scale-95" 
                          : "",
                        isToday && !isSelected ? "border-indigo-500/50" : ""
                      )}
                    >
                      {/* Day Number and Type Badge */}
                      <div className="flex justify-between items-start w-full">
                        <span className={cn(
                          "text-xs font-bold font-mono",
                          isToday ? "text-indigo-400 font-extrabold" : (holiday ? "text-rose-400 font-extrabold" : "text-theme-text-secondary group-hover:text-theme-text transition-colors")
                        )}>
                          {cell.day}
                        </span>
                        {cell.isCurrentMonth && isWeekend && !holiday && (
                          <span className="text-[8px] px-1 py-0.2 rounded font-bold text-theme-text-secondary bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 border border-theme-border/20 font-mono tracking-wide scale-90 origin-top-right">
                            WE
                          </span>
                        )}
                        {cell.isCurrentMonth && holiday && (
                          <span className="text-[8px] px-1 py-0.2 rounded font-bold text-rose-400 bg-rose-500/15 border border-rose-500/25 font-mono tracking-wide scale-90 origin-top-right animate-pulse">
                            🎉 HD
                          </span>
                        )}
                      </div>

                      {/* Display Logged Hours or Holiday Label */}
                      <div className="mt-auto flex flex-col gap-1 items-stretch">
                        {cell.isCurrentMonth && holiday && (
                          <span className="text-[8px] font-semibold text-rose-300 truncate w-full select-none" title={holiday.name}>
                            {holiday.name}
                          </span>
                        )}
                        {cell.isCurrentMonth && hasHours && (
                          <span className={cn(
                            "text-[10px] font-extrabold font-mono rounded px-1.5 py-0.5 self-start select-none shadow-sm",
                            progressColor
                          )}>
                            {hoursSum.toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Pane: Day Details */}
          <div className="bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-6 shadow-xl flex flex-col max-h-[650px] lg:sticky lg:top-8">
            <h2 className="text-lg font-bold text-theme-text mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-indigo-400" />
              <span>Details for {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Selected Day'}</span>
            </h2>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center animate-pulse py-12">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : selectedDateEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-theme-surface-tertiary dark:bg-theme-surface-tertiary flex items-center justify-center text-theme-text-secondary">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="text-theme-text-secondary font-medium">No hours logged</h4>
                  <p className="text-xs text-theme-text-secondary mt-1 max-w-[200px] mx-auto">
                    You haven't recorded any tasks for this date.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/log')}
                  className="inline-flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-theme-text text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                >
                  <Plus size={14} />
                  <span>Log Work</span>
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {selectedDateEntries.map((e) => (
                  <div 
                    key={e.id}
                    className={cn(
                      "p-4 bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border rounded-xl flex flex-col justify-between hover:border-theme-border/50 transition-all",
                      e.is_ot || e.is_implied_ot ? "border-amber-500/20 shadow-sm shadow-amber-500/5" : "border-theme-border/30"
                    )}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn(
                            "text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider",
                            e.is_ot || e.is_implied_ot 
                              ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" 
                              : "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20"
                          )}>
                            {e.project_name}
                          </span>
                          {(e.is_ot || e.is_implied_ot) && (
                            <span className="text-[9px] font-extrabold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-tight font-mono">
                              {e.is_ot ? 'OT' : 'Implied OT'}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-extrabold text-theme-text font-mono flex items-center gap-1">
                          <Clock size={12} className="text-theme-text-secondary" />
                          <span>{e.total_hours.toFixed(1)}h</span>
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-theme-text">{e.action_name}</h4>
                      {e.description && (
                        <p className="text-xs text-theme-text-secondary mt-2 bg-theme-surface-secondary/80 p-2.5 rounded-lg border border-theme-border italic leading-relaxed">
                          "{e.description}"
                        </p>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-theme-border/85 flex justify-end gap-3.5">
                      <button
                        onClick={() => setViewingLog(e)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-theme-text-secondary hover:text-theme-text transition-colors uppercase tracking-wider cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>ดูใบงาน / View</span>
                      </button>
                      {/* Only show Edit button for the log owner */}
                      {sessionUser && (e as any).user_id === sessionUser.id && (
                        <button
                          onClick={() => setEditingLog(e)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>แก้ไข / Edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={() => navigate('/log')}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-300 text-xs font-semibold py-3 rounded-xl transition-all active:scale-95"
                >
                  <Plus size={14} />
                  <span>Add Another Log</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {editingLog && (
        <EditWorklogModal
          isOpen={!!editingLog}
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSaveSuccess={() => {
            setEditingLog(null);
            setRefreshTrigger(prev => prev + 1); // Triggers re-fetch of all entries & side panel updates
          }}
        />
      )}

      <ViewWorklogModal
        isOpen={!!viewingLog}
        log={viewingLog}
        onClose={() => setViewingLog(null)}
        onDeleteSuccess={() => {
          setRefreshTrigger(prev => prev + 1);
        }}
      />
    </AppLayout>
  );
}
