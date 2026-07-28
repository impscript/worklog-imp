import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  FolderGit2, 
  Ticket, 
  Plus, 
  Calendar as CalendarIcon, 
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Heart,
  Activity,
  UserCheck,
  Clock,
  RefreshCw,
  Flame,
  Check,
  ListTodo,
  Award
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { cn } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import EditWorklogModal from '../components/modals/EditWorklogModal';
import ViewWorklogModal from '../components/modals/ViewWorklogModal';

interface WorklogEntry {
  id: string;
  user_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_time: boolean;
  total_hours: number;
  is_ot?: boolean;
  holding: string;
  department_operator: string;
  project_type: string;
  project_name: string;
  module: string | null;
  bu: string;
  department: string;
  action_name: string;
  description: string | null;
  channel: string;
  created_at: string;
  action_channel?: string | null;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<WorklogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [viewingLog, setViewingLog] = useState<WorklogEntry | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  // New States for Actionable Dashboard Redesign
  const [userJd, setUserJd] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);

  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('dashboard_checklist_tasks');
    return saved ? JSON.parse(saved) : {};
  });

  const isCoachTemplate = (id: string | null | undefined) => {
    return id === 'individual_coach' || id === 'coaching_fairness';
  };

  const parseJsonIfNeeded = (val: any) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          return JSON.parse(trimmed);
        } catch (e) {
          console.warn('Failed to parse strength/improvement item:', val, e);
        }
      }
    }
    return val;
  };

  const normalizeValueMix = (mix: any) => {
    if (!mix) return { strategic: 0, tactical: 0, operational: 0, reactive: 0 };
    const s = mix.strategic || 0;
    const t = mix.tactical || 0;
    const o = mix.operational || 0;
    const r = mix.reactive || 0;
    const sum = s + t + o + r;
    if (sum > 0 && sum <= 1.05) {
      return {
        strategic: Math.round(s * 100),
        tactical: Math.round(t * 100),
        operational: Math.round(o * 100),
        reactive: Math.round(r * 100)
      };
    }
    return {
      strategic: Math.round(s),
      tactical: Math.round(t),
      operational: Math.round(o),
      reactive: Math.round(r)
    };
  };

  // Helper: Format date to YYYY-MM-DD
  const formatDateToYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const toggleTask = (taskText: string) => {
    setCheckedTasks(prev => {
      const updated = { ...prev, [taskText]: !prev[taskText] };
      localStorage.setItem('dashboard_checklist_tasks', JSON.stringify(updated));
      return updated;
    });
  };

  const fetchJdAndAnalysis = async (userId: string) => {
    try {
      const { data: jdData } = await supabase
        .from('tb_user_jd')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (jdData) setUserJd(jdData);

      const { data: analysisData } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('user_id', userId)
        .order('analysis_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (analysisData) setAiAnalysis(analysisData);
    } catch (err) {
      console.error('Error fetching JD or AI Analysis:', err);
    }
  };

  const getAnalysisDateRange = () => {
    const today = new Date();
    const endStr = formatDateToYMD(today);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const startStr = formatDateToYMD(thirtyDaysAgo);
    return { start: startStr, end: endStr };
  };

  const handleRunDiagnostics = async () => {
    if (!user) return;
    setIsAnalyzing(true);
    setDiagnosticsError(null);
    setAnalysisLogs([
      'Initializing diagnostic engine...',
      'Mapping designated Job Description alignment parameters...'
    ]);
    
    try {
      const range = getAnalysisDateRange();
      setAnalysisLogs(prev => [...prev, `Requesting AI review from ${range.start} to ${range.end}...`]);
      
      const sessionStr = localStorage.getItem('worklog_session');
      const sessionData = sessionStr ? JSON.parse(sessionStr) : null;

      const { error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          user_id: user.id,
          start_date: range.start,
          end_date: range.end,
          force_refresh: true,
          workspace_id: sessionData?.activeWorkspaceId,
        }
      });

      if (error) {
        throw new Error(error.message || 'AI assessment failed to complete');
      }

      setAnalysisLogs(prev => [...prev, 'Structuring diagnostics & saving to database...', 'Diagnostics assessment completed successfully!']);
      await fetchJdAndAnalysis(user.id);
    } catch (err: any) {
      console.error('Error running AI diagnostics:', err);
      setDiagnosticsError(err.message || 'Failed to analyze performance.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate week dates (Monday to Sunday)
  const getWeekDays = () => {
    const today = new Date();
    const day = today.getDay();
    // Monday is 1, Sunday is 0. If Sunday, we want to go back 6 days to get Monday.
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDays.push(d);
    }
    return weekDays;
  };

  const weekDays = getWeekDays();
  const startOfWeek = formatDateToYMD(weekDays[0]);
  const endOfWeek = formatDateToYMD(weekDays[6]);

  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
    const session = JSON.parse(sessionStr);
    setUser(session);

    async function fetchEntries() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('col_worklog')
          .select('*')
          .eq('user_id', session.id)
          .order('work_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching work logs:', error);
        } else if (data) {
          // Map database types properly
          const mappedData = data.map((item: any) => ({
            ...item,
            total_hours: parseFloat(item.total_hours)
          }));
          setEntries(mappedData);
        }
      } catch (err) {
        console.error('Error in fetchEntries:', err);
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

    fetchEntries();
    fetchHolidays();
    fetchJdAndAnalysis(session.id);
  }, [navigate, refreshTrigger]);

  // Filter entries for this week
  const thisWeekEntries = entries.filter(
    (e) => e.work_date >= startOfWeek && e.work_date <= endOfWeek
  );

  // Compute Weekly metrics
  const totalHoursThisWeek = thisWeekEntries.reduce((sum, e) => sum + e.total_hours, 0);
  const otHoursThisWeek = thisWeekEntries.filter(e => e.is_ot).reduce((sum, e) => sum + e.total_hours, 0);
  const activeProjectsCount = new Set(thisWeekEntries.map((e) => e.project_name)).size;
  const supportTicketsCount = thisWeekEntries.filter(
    (e) => e.project_type === 'Support MA' || e.project_type === 'Support Go-Live'
  ).length;

  // Get Cut-off Information (26th of previous month to 25th of current month)
  const getCutoffInfo = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    const currentDate = today.getDate();
    
    let start: Date;
    let end: Date;
    
    if (currentDate >= 26) {
      start = new Date(currentYear, currentMonth, 26);
      end = new Date(currentYear, currentMonth + 1, 25);
    } else {
      start = new Date(currentYear, currentMonth - 1, 26);
      end = new Date(currentYear, currentMonth, 25);
    }
    
    // Total working days in period (excluding weekends and public holidays)
    let totalWorkingDays = 0;
    const temp = new Date(start);
    const endForCalc = today < end ? today : end;
    
    while (temp <= endForCalc) {
      const dayOfWeek = temp.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const formattedDate = formatDateToYMD(temp);
      const isHoliday = holidays.some(h => h.date === formattedDate);
      if (!isWeekend && !isHoliday) {
        totalWorkingDays++;
      }
      temp.setDate(temp.getDate() + 1);
    }
    
    // Calculate total hours logged in the current cutoff period
    const startStr = formatDateToYMD(start);
    const endStr = formatDateToYMD(end);
    const cutoffEntries = entries.filter(e => e.work_date >= startStr && e.work_date <= endStr);
    const loggedHours = cutoffEntries.reduce((sum, e) => sum + e.total_hours, 0);
    
    const targetHours = totalWorkingDays * 8;
    const completionPct = targetHours > 0 ? Math.round((loggedHours / targetHours) * 100) : 0;
    
    // Remaining days to end of period
    const diffTime = end.getTime() - today.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    return {
      start: startStr,
      end: endStr,
      daysRemaining,
      loggedHours,
      targetHours,
      completionPct,
      cutoffEnd: end
    };
  };

  // Find missing log weekdays in current period (excluding public holidays)
  const getMissingLogDays = () => {
    const cutoff = getCutoffInfo();
    const today = new Date();
    const [startY, startM, startD] = cutoff.start.split('-').map(Number);
    const start = new Date(startY, startM - 1, startD);
    const end = today < cutoff.cutoffEnd ? today : cutoff.cutoffEnd;
    
    const missingDays: string[] = [];
    const temp = new Date(start);
    
    while (temp <= end) {
      const dayOfWeek = temp.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const formattedDate = formatDateToYMD(temp);
      const isHoliday = holidays.some(h => h.date === formattedDate);
      if (!isWeekend && !isHoliday) {
        const hoursOnDay = entries
          .filter(e => e.work_date === formattedDate)
          .reduce((sum, e) => sum + e.total_hours, 0);
        
        if (hoursOnDay === 0) {
          missingDays.push(formattedDate);
        }
      }
      temp.setDate(temp.getDate() + 1);
    }
    
    return missingDays.reverse(); // Show newest missing days first
  };

  // Aggregate Hours by Project Type (all time or this week)
  const computeHoursByType = () => {
    let project = 0;
    let support = 0;
    let management = 0;

    entries.forEach((e) => {
      if (e.project_type === 'Project' || e.project_type === 'Upgrade') {
        project += e.total_hours;
      } else if (e.project_type === 'Support MA' || e.project_type === 'Support Go-Live') {
        support += e.total_hours;
      } else if (e.project_type === 'Management') {
        management += e.total_hours;
      } else {
        project += e.total_hours; // fallback
      }
    });

    const total = project + support + management;
    if (total === 0) return { project: 0, support: 0, management: 0, total: 0, pct: { project: 0, support: 0, management: 0 } };

    return {
      project,
      support,
      management,
      total,
      pct: {
        project: Math.round((project / total) * 100),
        support: Math.round((support / total) * 100),
        management: Math.round((management / total) * 100)
      }
    };
  };

  const typeSummary = computeHoursByType();
  const cutoff = getCutoffInfo();
  const missingLogDays = getMissingLogDays();



  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {isLoading ? (
          // Sleek Glass Skeleton Loader
          <div className="space-y-8 animate-pulse">
            <div className="h-10 w-64 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 rounded-lg"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 rounded-2xl border border-theme-border dark:border-theme-border/30"></div>
              ))}
            </div>
            <div className="h-44 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 rounded-2xl border border-theme-border dark:border-theme-border/30"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 h-80 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 rounded-2xl border border-theme-border dark:border-theme-border/30"></div>
              <div className="h-80 bg-theme-surface-tertiary dark:bg-theme-surface-tertiary/40 rounded-2xl border border-theme-border dark:border-theme-border/30"></div>
            </div>
          </div>
        ) : (
          <>
            {/* Welcoming Header Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-theme-border dark:border-theme-border/60 pb-5">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                  Welcome back, {user?.name || 'Developer'}!
                </h1>
                <p className="text-sm text-theme-text-secondary mt-1">
                  Here is a professional summary of your logged work activities and attendance.
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-full self-start md:self-center">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse"></span>
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest font-mono">
                  Weekly: {startOfWeek} ~ {endOfWeek}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard 
                title="Total Hours" 
                value={`${totalHoursThisWeek.toFixed(1)}h`} 
                icon={<TrendingUp className="text-indigo-600 dark:text-indigo-400" size={20} />} 
                trend={totalHoursThisWeek >= 40 ? "Goal Met" : "In Progress"} 
                trendColor={totalHoursThisWeek >= 40 ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10" : "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10"}
                className="border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50 to-white dark:from-[#1E293B] dark:to-indigo-900/20"
              />
              <KpiCard 
                title="OT Hours" 
                value={`${otHoursThisWeek.toFixed(1)}h`} 
                icon={<TrendingUp className="text-rose-600 dark:text-rose-400" size={20} />} 
              />
              <KpiCard 
                title="Active Projects" 
                value={String(activeProjectsCount)} 
                icon={<FolderGit2 className="text-emerald-600 dark:text-emerald-400" size={20} />} 
              />
              <KpiCard 
                title="Support Tasks" 
                value={String(supportTicketsCount)} 
                icon={<Ticket className="text-amber-600 dark:text-amber-400" size={20} />} 
              />
            </div>

            {/* Main Content Grid: 2/3 Left (Calendar + Logs) | 1/3 Right (Chart) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Weekly Strip - Moved here to save vertical space */}
                <div className="ai-glass bg-theme-surface dark:bg-theme-bg-page/50 rounded-2xl p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-base font-semibold text-theme-text flex items-center gap-2">
                      <CalendarIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
                      <span>This Week's Attendance</span>
                    </h2>
                    <span className="text-xs text-theme-text-secondary font-mono">
                      {startOfWeek} to {endOfWeek}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
                    {weekDays.map((d, index) => {
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                      const dateNum = String(d.getDate());
                      const formattedYMD = formatDateToYMD(d);
                      
                      const hoursOnDay = entries
                        .filter((e) => e.work_date === formattedYMD)
                        .reduce((sum, e) => sum + e.total_hours, 0);

                      const progress = Math.min((hoursOnDay / 8.0) * 100, 100);
                      const isToday = formatDateToYMD(new Date()) === formattedYMD;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                      return (
                        <DayCard 
                          key={index} 
                          day={dayName} 
                          date={dateNum} 
                          hours={hoursOnDay > 0 ? `${hoursOnDay.toFixed(1)}h` : '-'} 
                          progress={progress} 
                          active={isToday} 
                          isWeekend={isWeekend} 
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Cut-off Tracker & Compliance */}
                <div className="ai-glass bg-theme-surface dark:bg-theme-bg-page/50 rounded-2xl p-6 shadow-xl flex flex-col space-y-4">
                  <div className="flex justify-between items-center border-b border-theme-border dark:border-theme-border/60 pb-4">
                    <h2 className="text-base font-semibold text-theme-text flex items-center gap-2">
                      <Clock size={18} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
                      <span>Cut-off & Submission Compliance</span>
                    </h2>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      cutoff.daysRemaining <= 3 
                        ? 'bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-400' 
                        : cutoff.daysRemaining <= 7
                        ? 'bg-amber-50 border border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-400'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-400'
                    }`}>
                      {cutoff.daysRemaining === 0 ? 'Cut-off Today!' : `${cutoff.daysRemaining} days remaining`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-theme-text-secondary font-semibold uppercase tracking-wider">
                        <span>Submitted Log Hours</span>
                        <span>{cutoff.completionPct}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden border border-slate-300/55 dark:border-theme-border/30">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 transition-all duration-500" 
                          style={{ width: `${Math.min(100, cutoff.completionPct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-theme-text-muted mt-1 font-mono">
                        <span>Period: {cutoff.start} ~ {cutoff.end}</span>
                        <span>{cutoff.loggedHours.toFixed(1)}h / {cutoff.targetHours}h</span>
                      </div>
                    </div>

                    {/* Missing logs quick action */}
                    <div className="bg-theme-surface-secondary/50 dark:bg-slate-950/20 rounded-xl p-4 border border-theme-border dark:border-slate-900/60">
                      <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <AlertTriangle size={14} className={missingLogDays.length > 0 ? "text-amber-500 animate-bounce" : "text-emerald-500"} />
                        <span>Missing Log Days</span>
                      </h3>
                      {missingLogDays.length === 0 ? (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 size={16} />
                          <span>All weekdays logged. Great job keeping up!</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-theme-text-secondary mb-2">
                            Click to log missed weekdays:
                          </p>
                          <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
                            {missingLogDays.slice(0, 6).map((dateStr) => {
                              const [y, m, dayVal] = dateStr.split('-').map(Number);
                              const d = new Date(y, m - 1, dayVal);
                              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                              const displayDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                              return (
                                <Link
                                  key={dateStr}
                                  to={`/log?date=${dateStr}`}
                                  className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-[0.97]"
                                >
                                  <Plus size={12} />
                                  <span>{dayName} {displayDate}</span>
                                </Link>
                              );
                            })}
                            {missingLogDays.length > 6 && (
                              <span className="text-xs text-theme-text-muted self-center">
                                +{missingLogDays.length - 6} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* JD Alignment & Well-being Diagnostics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* JD Alignment Tracker */}
                  <div className="ai-glass bg-theme-surface dark:bg-theme-bg-page/50 rounded-2xl p-6 shadow-xl flex flex-col space-y-4">
                    <div className="flex justify-between items-center border-b border-theme-border dark:border-theme-border/60 pb-3">
                      <h2 className="text-base font-semibold text-theme-text flex items-center gap-2">
                        <UserCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
                        <span>JD Alignment Tracker</span>
                      </h2>
                      <span className="text-xs text-theme-text-muted font-bold font-mono">
                        {userJd?.position_name || 'Designated Role'}
                      </span>
                    </div>

                    {/* Score section */}
                    <div className="flex items-center gap-5">
                      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="transparent" stroke="var(--theme-border, #e2e8f0)" strokeWidth="8" />
                          <circle 
                            cx="50" cy="50" r="42" fill="transparent" 
                            stroke="#6366f1" strokeWidth="8" 
                            strokeDasharray={`${2 * Math.PI * 42}`}
                            strokeDashoffset={`${2 * Math.PI * 42 * (1 - (aiAnalysis?.jd_alignment_score || 0) / 100)}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-xl font-extrabold text-theme-text font-mono">
                          {aiAnalysis?.jd_alignment_score || 0}%
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">
                          Role Congruence Score
                        </h3>
                        <p className="text-xs text-theme-text-muted leading-relaxed">
                          {aiAnalysis ? (
                            aiAnalysis.jd_alignment_score >= 80 
                              ? 'Excellent focus on your primary role objectives.'
                              : aiAnalysis.jd_alignment_score >= 50
                              ? 'Moderate alignment. Consider reducing side tasks.'
                              : 'Low alignment. Discuss responsibilities with your lead.'
                          ) : (
                            'AI diagnosis pending. Click "Run Diagnostics" below to calculate.'
                          )}
                        </p>
                        {aiAnalysis?.reflection_level && (
                          <div className="mt-2 text-[10px] text-indigo-500 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg inline-block font-mono">
                            Maturity: {aiAnalysis.reflection_level}/4 ({
                              aiAnalysis.reflection_level === 4 ? 'Reflective Practitioner 🌟' :
                              aiAnalysis.reflection_level === 3 ? 'Result Oriented 🎯' :
                              aiAnalysis.reflection_level === 2 ? 'Process Thinker ⚙️' :
                              'Activity Logger 📝'
                            })
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Target responsibilities breakdown */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider mb-1">
                        Target Allocation (JD)
                      </h4>
                      {userJd?.key_responsibilities && userJd.key_responsibilities.length > 0 ? (
                        <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                          {userJd.key_responsibilities.map((resp: any, i: number) => {
                            const targetPct = resp.weight || resp.weight_percentage || 0;
                            let actualPct = 0;
                            if (aiAnalysis?.actual_vs_target) {
                              const found = aiAnalysis.actual_vs_target.find((item: any) => 
                                item.category?.toLowerCase() === resp.category?.toLowerCase()
                              );
                              actualPct = found?.actual || 0;
                            }
                            
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                  <span className="text-theme-text truncate max-w-[150px]">{resp.category}</span>
                                  <span className="text-theme-text-secondary font-mono">
                                    {actualPct}% <span className="text-theme-text-muted">/ {targetPct}% Target</span>
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-theme-border/20 flex overflow-hidden">
                                  <div 
                                    className="bg-indigo-500/20 h-full"
                                    style={{ width: `${targetPct}%` }}
                                  />
                                  <div 
                                    className="bg-indigo-500 h-full -ml-[100%]"
                                    style={{ width: `${actualPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-theme-text-muted bg-theme-surface-secondary/40 border border-dashed border-theme-border dark:border-slate-800 p-4 rounded-xl text-center">
                          No specific JD allocation parameters found.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wellbeing & Balance Monitor */}
                  <div className="ai-glass bg-theme-surface dark:bg-theme-bg-page/50 rounded-2xl p-6 shadow-xl flex flex-col space-y-4">
                    <div className="flex justify-between items-center border-b border-theme-border dark:border-theme-border/60 pb-3">
                      <h2 className="text-base font-semibold text-theme-text flex items-center gap-2">
                        <Heart size={18} className="text-emerald-500" />
                        <span>Work-Life Balance &amp; Health</span>
                      </h2>
                      <span className="text-xs text-theme-text-muted font-bold font-mono">
                        Balance Score
                      </span>
                    </div>

                    {/* Score section */}
                    <div className="flex items-center gap-5">
                      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="transparent" stroke="var(--theme-border, #e2e8f0)" strokeWidth="8" />
                          <circle 
                            cx="50" cy="50" r="42" fill="transparent" 
                            stroke={(100 - (aiAnalysis?.burnout_risk_score || 0)) <= 30 ? "#f43f5e" : (100 - (aiAnalysis?.burnout_risk_score || 0)) <= 60 ? "#f59e0b" : "#10b981"} 
                            strokeWidth="8" 
                            strokeDasharray={`${2 * Math.PI * 42}`}
                            strokeDashoffset={`${2 * Math.PI * 42 * (1 - (100 - (aiAnalysis?.burnout_risk_score || 0)) / 100)}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className={`text-xl font-extrabold font-mono ${
                          (100 - (aiAnalysis?.burnout_risk_score || 0)) <= 30 ? "text-rose-500" : (100 - (aiAnalysis?.burnout_risk_score || 0)) <= 60 ? "text-amber-500" : "text-emerald-500"
                        }`}>
                          {100 - (aiAnalysis?.burnout_risk_score || 0)}%
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">
                          Balance &amp; Energy Index
                        </h3>
                        <p className="text-xs text-theme-text-muted leading-relaxed">
                          {aiAnalysis ? (
                            aiAnalysis.burnout_risk_score >= 70 
                              ? 'High fatigue warning. Rest and request a workload review.'
                              : aiAnalysis.burnout_risk_score >= 40
                              ? 'Moderate workload tension. Maintain standard working hours.'
                              : 'Healthy work patterns. Workload distribution is well-balanced.'
                          ) : (
                            'Well-being diagnosis pending. Click "Run Diagnostics" below to calculate.'
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Wellbeing indicators */}
                    {(() => {
                      const totalHrs = entries.reduce((sum, e) => sum + e.total_hours, 0);
                      const mtgHrs = entries.filter(e => 
                        /meeting|discuss|sync|ประชุม|คุย/i.test(e.action_name || '') || 
                        /ประชุม|คุย/i.test(e.description || '')
                      ).reduce((sum, e) => sum + e.total_hours, 0);
                      const mtgPct = totalHrs > 0 ? Math.round((mtgHrs / totalHrs) * 100) : 0;
                      const otHrs = entries.filter(e => e.is_ot).reduce((sum, e) => sum + e.total_hours, 0);
                      const lateDays = entries.filter(e => {
                        const endHour = parseInt(e.end_time.split(':')[0]);
                        return endHour >= 19;
                      }).length;

                      return (
                        <div className="space-y-3 pt-2 border-t border-theme-border/40">
                          <h4 className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">
                            Risk Metrics (Last 30 Days)
                          </h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-theme-surface-secondary/50 dark:bg-slate-950/20 border border-theme-border dark:border-theme-border/40 p-2.5 rounded-xl flex items-center gap-2">
                              <Clock size={16} className="text-rose-500 shrink-0" />
                              <div>
                                <p className="text-[9px] font-bold text-theme-text-muted uppercase tracking-wider leading-none">OT hours</p>
                                <p className="text-xs font-extrabold text-theme-text font-mono mt-1">
                                  {otHrs.toFixed(1)}h
                                </p>
                              </div>
                            </div>
                            
                            <div className="bg-theme-surface-secondary/50 dark:bg-slate-950/20 border border-theme-border dark:border-theme-border/40 p-2.5 rounded-xl flex items-center gap-2">
                              <Flame size={16} className="text-amber-500 shrink-0" />
                              <div>
                                <p className="text-[9px] font-bold text-theme-text-muted uppercase tracking-wider leading-none">Late logs</p>
                                <p className="text-xs font-extrabold text-theme-text font-mono mt-1">
                                  {lateDays} days
                                </p>
                              </div>
                            </div>

                            <div className={cn(
                              "bg-theme-surface-secondary/50 dark:bg-slate-950/20 border p-2.5 rounded-xl flex items-center gap-2",
                              mtgPct >= 40 
                                ? "border-rose-500/30 bg-rose-500/5" 
                                : "border-theme-border dark:border-theme-border/40"
                            )}>
                              <Activity size={16} className={cn("shrink-0", mtgPct >= 40 ? "text-rose-500 animate-pulse" : "text-indigo-400")} />
                              <div>
                                <p className="text-[9px] font-bold text-theme-text-muted uppercase tracking-wider leading-none font-mono">Mtg Ratio</p>
                                <p className={cn(
                                  "text-xs font-extrabold font-mono mt-1",
                                  mtgPct >= 40 ? "text-rose-400" : "text-theme-text"
                                )}>
                                  {mtgPct}%
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* AI Coaching & Development Action Items */}
                <div className="ai-glass bg-theme-surface dark:bg-theme-bg-page/50 rounded-2xl p-6 shadow-xl flex flex-col space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-theme-border dark:border-theme-border/60 pb-4">
                    <h2 className="text-base font-semibold text-theme-text flex items-center gap-2">
                      <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
                      <span>AI Development & Weekly Coaching Feedback</span>
                    </h2>
                    
                    <button
                      onClick={handleRunDiagnostics}
                      disabled={isAnalyzing}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md active:scale-[0.98] disabled:cursor-not-allowed shrink-0"
                    >
                      <RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} />
                      <span>{isAnalyzing ? 'Analyzing Logs...' : 'Run Diagnostics Assessment'}</span>
                    </button>
                  </div>

                  {isAnalyzing && (
                    <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-xl p-4 space-y-3 animate-pulse">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        <Activity size={14} className="animate-bounce" />
                        <span>AI Engine is processing your recent work activities...</span>
                      </div>
                      <div className="space-y-1.5 font-mono text-[10px] text-theme-text-secondary max-h-[100px] overflow-y-auto">
                        {analysisLogs.map((log, index) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <span className="text-emerald-500 font-bold">✓</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {diagnosticsError && (
                    <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-4 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      <span>Error running assessment: {diagnosticsError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Actionable Checklist */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                        <ListTodo size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Actionable Development Plan</span>
                      </h3>
                      {(() => {
                        const items = isCoachTemplate(aiAnalysis?.template_id)
                          ? (aiAnalysis.development_plan?.priorities || []).map((p: any) => `${p.title}: ${p.specific_action}`)
                          : (aiAnalysis?.improvements || []).map((imp: any) => {
                              const parsedImp = parseJsonIfNeeded(imp);
                              return typeof parsedImp === 'string' ? parsedImp : parsedImp.observation || parsedImp.title || JSON.stringify(parsedImp);
                            });
                        
                        if (items.length > 0) {
                          return (
                            <div className="space-y-2">
                              {items.map((imp: string, index: number) => {
                                const isChecked = !!checkedTasks[imp];
                                return (
                                  <div 
                                    key={index}
                                    onClick={() => toggleTask(imp)}
                                    className={cn(
                                      "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                                      isChecked 
                                        ? "bg-slate-50 dark:bg-slate-900/30 border-theme-border/60 dark:border-theme-border/20 opacity-60" 
                                        : "bg-theme-surface-secondary/40 border-theme-border hover:border-indigo-500/30 dark:border-slate-950/20 dark:border-slate-900 dark:hover:border-indigo-500/20"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                                      isChecked 
                                        ? "bg-indigo-600 border-indigo-600 text-white" 
                                        : "border-slate-300 dark:border-theme-border bg-white dark:bg-slate-950"
                                    )}>
                                      {isChecked && <Check size={10} strokeWidth={4} />}
                                    </div>
                                    <span className={cn(
                                      "text-xs font-medium leading-relaxed text-theme-text",
                                      isChecked && "line-through text-theme-text-muted"
                                    )}>
                                      {imp}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        } else {
                          return (
                            <div className="text-xs text-theme-text-muted bg-theme-surface-secondary/40 border border-dashed border-theme-border dark:border-slate-800 p-6 rounded-xl text-center">
                              Run diagnostics to generate your customized AI development plan.
                            </div>
                          );
                        }
                      })()}
                    </div>

                    {/* Coaching Summary */}
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                          <Award size={14} className="text-emerald-600 dark:text-emerald-400" />
                          <span>Identified Professional Strengths</span>
                        </h3>
                        {aiAnalysis?.strengths && aiAnalysis.strengths.length > 0 ? (
                          <div className="space-y-2">
                            {aiAnalysis.strengths.map((str: any, index: number) => {
                              const parsedStr = parseJsonIfNeeded(str);
                              const displayStr = typeof parsedStr === 'string' ? parsedStr : parsedStr.title || parsedStr.observation || JSON.stringify(parsedStr);
                              return (
                                <div key={index} className="flex items-start gap-2 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 p-3 rounded-xl">
                                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400 leading-relaxed">
                                    {displayStr}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-theme-text-muted bg-theme-surface-secondary/40 border border-dashed border-theme-border dark:border-slate-800 p-4 rounded-xl text-center">
                            No strengths computed. Run diagnostics to retrieve feedback.
                          </div>
                        )}
                      </div>

                      {/* AI Coach reinforced advice */}
                      {((isCoachTemplate(aiAnalysis?.template_id)
                        ? aiAnalysis.message_to_employee
                        : aiAnalysis?.development_plan?.focus_areas)) && (
                        <div className="bg-indigo-50/55 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/15 p-4 rounded-xl space-y-1">
                          <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                            <Sparkles size={12} />
                            <span>{isCoachTemplate(aiAnalysis?.template_id) ? 'สาส์นจาก AI Coach' : 'AI Weekly Coach Advice'}</span>
                          </h4>
                          <p className="text-xs text-indigo-800 dark:text-indigo-300/90 leading-relaxed font-medium whitespace-pre-line">
                            {isCoachTemplate(aiAnalysis?.template_id) ? aiAnalysis.message_to_employee : aiAnalysis.development_plan.focus_areas}
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
              
              {/* Hours by Type Chart */}
              <div className="ai-glass bg-theme-surface dark:bg-theme-bg-page/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between lg:sticky lg:top-6 self-start">
                <div>
                  <h2 className="text-lg font-semibold text-theme-text mb-6">Hours Breakdown</h2>
                  <div className="flex flex-col items-center justify-center py-6">
                    {/* Premium Circle Gauge */}
                    <div className="relative w-48 h-48 rounded-full border-[14px] border-slate-100 dark:border-theme-border flex items-center justify-center mb-6">
                      <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Circle segment 1: Project (Indigo) */}
                        <circle 
                          cx="50" cy="50" r="40" 
                          fill="transparent" 
                          stroke="#6366f1" 
                          strokeWidth="8" 
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - typeSummary.pct.project / 100)}`}
                          strokeLinecap="round"
                        />
                        {/* Circle segment 2: Support (Emerald) */}
                        <circle 
                          cx="50" cy="50" r="40" 
                          fill="transparent" 
                          stroke="#10b981" 
                          strokeWidth="8" 
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - typeSummary.pct.support / 100)}`}
                          style={{
                            transformOrigin: '50% 50%',
                            transform: `rotate(${typeSummary.pct.project * 3.6}deg)`
                          }}
                          strokeLinecap="round"
                        />
                        {/* Circle segment 3: Management (Amber) */}
                        <circle 
                          cx="50" cy="50" r="40" 
                          fill="transparent" 
                          stroke="#f59e0b" 
                          strokeWidth="8" 
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - typeSummary.pct.management / 100)}`}
                          style={{
                            transformOrigin: '50% 50%',
                            transform: `rotate(${(typeSummary.pct.project + typeSummary.pct.support) * 3.6}deg)`
                          }}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="text-center z-10">
                        <div className="text-3xl font-extrabold text-theme-text tracking-tight">
                          {typeSummary.total.toFixed(1)}h
                        </div>
                        <div className="text-xs uppercase font-bold tracking-wider text-theme-text-secondary mt-0.5">
                          Total Hours
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-theme-border dark:border-theme-border/30 pb-2">
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-indigo-500 mr-3"></span>
                      <span className="text-theme-text">Project / Upgrade</span>
                    </div>
                    <div className="text-right">
                      <span className="text-theme-text font-semibold">{typeSummary.project.toFixed(1)}h</span>
                      <span className="text-theme-text-muted text-xs ml-2">({typeSummary.pct.project}%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-theme-border dark:border-theme-border/30 pb-2">
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 mr-3"></span>
                      <span className="text-theme-text">Support Tasks</span>
                    </div>
                    <div className="text-right">
                      <span className="text-theme-text font-semibold">{typeSummary.support.toFixed(1)}h</span>
                      <span className="text-theme-text-muted text-xs ml-2">({typeSummary.pct.support}%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-amber-500 mr-3"></span>
                      <span className="text-theme-text">Management</span>
                    </div>
                    <div className="text-right">
                      <span className="text-theme-text font-semibold">{typeSummary.management.toFixed(1)}h</span>
                      <span className="text-theme-text-muted text-xs ml-2">({typeSummary.pct.management}%)</span>
                    </div>
                  </div>
                </div>

                {/* Value Mix Section */}
                {aiAnalysis?.value_mix && (() => {
                  const mix = normalizeValueMix(aiAnalysis.value_mix);
                  return (
                    <div className="mt-6 border-t border-theme-border dark:border-theme-border/30 pt-4 space-y-3">
                      <h3 className="text-xs font-black text-theme-text uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        <Sparkles size={13} className="text-indigo-500" />
                        <span>Value Mix &amp; Contribution</span>
                      </h3>
                      <div className="w-full h-3 bg-slate-200 dark:bg-theme-surface-tertiary rounded-full overflow-hidden flex font-mono text-[9px] font-bold text-white text-center border border-slate-300/40 dark:border-theme-border/20">
                        {mix.strategic > 0 && (
                          <div style={{ width: `${mix.strategic}%` }} className="bg-indigo-600 flex items-center justify-center" title="Strategic">
                            S
                          </div>
                        )}
                        {mix.tactical > 0 && (
                          <div style={{ width: `${mix.tactical}%` }} className="bg-emerald-600 flex items-center justify-center" title="Tactical">
                            T
                          </div>
                        )}
                        {mix.operational > 0 && (
                          <div style={{ width: `${mix.operational}%` }} className="bg-amber-600 flex items-center justify-center" title="Operational">
                            O
                          </div>
                        )}
                        {mix.reactive > 0 && (
                          <div style={{ width: `${mix.reactive}%` }} className="bg-rose-600 flex items-center justify-center" title="Reactive">
                            R
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono font-semibold">
                        <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                          <span>Strategic:</span>
                          <span>{mix.strategic || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Tactical:</span>
                          <span>{mix.tactical || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-600 dark:text-amber-500">
                          <span>Operational:</span>
                          <span>{mix.operational || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                          <span>Reactive:</span>
                          <span>{mix.reactive || 0}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
            
            {/* Floating Action Button */}
            <Link to="/log" className="fixed bottom-8 right-8 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-6 py-4 rounded-full shadow-xl shadow-indigo-500/25 flex items-center gap-2 font-semibold transition-transform hover:-translate-y-1 hover:scale-105 active:scale-95 duration-200">
              <Plus size={20} />
              <span>Log Task</span>
            </Link>

            {editingLog && (
              <EditWorklogModal
                isOpen={!!editingLog}
                log={editingLog}
                onClose={() => setEditingLog(null)}
                onSaveSuccess={() => {
                  setEditingLog(null);
                  setRefreshTrigger(prev => prev + 1);
                }}
              />
            )}

            <ViewWorklogModal
              isOpen={!!viewingLog}
              log={viewingLog}
              onClose={() => setViewingLog(null)}
              onDeleteSuccess={() => setRefreshTrigger(prev => prev + 1)}
            />
          </>
        )}

        {/* Floating Quick Log Button for Mobile */}
        <Link
          to="/log"
          className="md:hidden fixed bottom-20 right-4 z-40 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold py-3 px-4 rounded-full shadow-2xl flex items-center gap-2 border border-indigo-400/40 active:scale-95 transition-all shadow-indigo-500/30 min-h-[48px]"
        >
          <Plus size={20} />
          <span className="text-xs uppercase tracking-wider">{t('nav.logWork', { defaultValue: '+ บันทึกงาน' })}</span>
        </Link>

      </div>
    </AppLayout>
  );
}

function KpiCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendColor = "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20", 
  className 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  trend?: string; 
  trendColor?: string; 
  className?: string; 
}) {
  return (
    <div className={cn("ai-glass-interactive rounded-xl p-4 shadow-xl flex flex-col justify-between hover:scale-[1.02] duration-300 bg-theme-surface/80 dark:bg-slate-950/20", className)}>
      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 rounded-lg bg-theme-surface-secondary dark:bg-slate-950/50 border border-theme-border dark:border-theme-border/80 group-hover:scale-110 duration-300">
          {icon}
        </div>
        {trend && <span className={cn("text-[11px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider", trendColor)}>{trend}</span>}
      </div>
      <div>
        <h3 className="text-2xl font-extrabold text-theme-text tracking-tight mb-0.5 font-mono">{value}</h3>
        <p className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">{title}</p>
      </div>
    </div>
  );
}

function DayCard({ 
  day, 
  date, 
  hours, 
  progress, 
  active, 
  isWeekend 
}: { 
  day: string; 
  date: string; 
  hours: string; 
  progress: number; 
  active?: boolean; 
  isWeekend?: boolean; 
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer hover:border-indigo-500/40 relative overflow-hidden",
      active 
        ? "ai-glass bg-theme-surface dark:bg-slate-950/20 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/20" 
        : "bg-theme-surface-secondary dark:bg-slate-950/40 border-theme-border dark:border-slate-900",
      isWeekend ? "opacity-50 dark:opacity-40 border-theme-border dark:border-slate-950" : ""
    )}>
      {active && (
        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-indigo-500 rounded-bl-full shadow-lg shadow-indigo-500/50" />
      )}
      <span className="text-xs font-bold text-theme-text-muted uppercase tracking-wider mb-1">{day}</span>
      <span className={cn("text-xl font-extrabold mb-3 font-mono", active ? "text-indigo-600 dark:text-indigo-400" : "text-theme-text")}>{date}</span>
      
      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-900 mb-2 overflow-hidden border border-slate-300 dark:border-theme-border/40">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", active ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-slate-400 dark:bg-slate-700")} 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <span className="text-xs font-semibold text-theme-text-secondary font-mono">{hours}</span>
    </div>
  );
}


