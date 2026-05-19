import { useState, useEffect } from 'react';
import { TrendingUp, FolderGit2, Ticket, Plus, Calendar as CalendarIcon, ClipboardList, Eye } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { cn } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
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
  const [entries, setEntries] = useState<WorklogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [viewingLog, setViewingLog] = useState<WorklogEntry | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  // Helper: Format date to YYYY-MM-DD
  const formatDateToYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
    const sessionStr = sessionStorage.getItem('worklog_session');
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

    fetchEntries();
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

  // Helper for nice date formats
  const formatTableDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {isLoading ? (
          // Sleek Glass Skeleton Loader
          <div className="space-y-8 animate-pulse">
            <div className="h-10 w-64 bg-[#1E293B]/40 rounded-lg"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-[#1E293B]/40 rounded-2xl border border-slate-700/30"></div>
              ))}
            </div>
            <div className="h-44 bg-[#1E293B]/40 rounded-2xl border border-slate-700/30"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 h-80 bg-[#1E293B]/40 rounded-2xl border border-slate-700/30"></div>
              <div className="h-80 bg-[#1E293B]/40 rounded-2xl border border-slate-700/30"></div>
            </div>
          </div>
        ) : (
          <>
            {/* Welcoming Header Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Welcome back, {user?.name || 'Developer'}!
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Here is a professional summary of your logged work activities and attendance.
                </p>
              </div>
            </div>

            {/* KPI Row - Made 4 columns and more compact */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard 
                title="Total Hours" 
                value={`${totalHoursThisWeek.toFixed(1)}h`} 
                icon={<TrendingUp className="text-indigo-400" size={20} />} 
                trend={totalHoursThisWeek >= 40 ? "Goal Met" : "In Progress"} 
                trendColor={totalHoursThisWeek >= 40 ? "text-emerald-400 bg-emerald-400/10" : "text-amber-400 bg-amber-400/10"}
                className="border-indigo-500/30 bg-gradient-to-br from-[#1E293B] to-indigo-900/20"
              />
              <KpiCard 
                title="OT Hours" 
                value={`${otHoursThisWeek.toFixed(1)}h`} 
                icon={<TrendingUp className="text-rose-400" size={20} />} 
              />
              <KpiCard 
                title="Active Projects" 
                value={String(activeProjectsCount)} 
                icon={<FolderGit2 className="text-emerald-400" size={20} />} 
              />
              <KpiCard 
                title="Support Tasks" 
                value={String(supportTicketsCount)} 
                icon={<Ticket className="text-amber-400" size={20} />} 
              />
            </div>

            {/* Main Content Grid: 2/3 Left (Calendar + Logs) | 1/3 Right (Chart) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Weekly Strip - Moved here to save vertical space */}
                <div className="ai-glass rounded-2xl p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <CalendarIcon size={18} className="text-indigo-400" />
                      <span>This Week's Attendance</span>
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">
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

                {/* Recent Entries Table */}
                <div className="ai-glass rounded-2xl shadow-xl overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/40">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <ClipboardList size={18} className="text-indigo-400" />
                      <span>Recent Work Logs</span>
                    </h2>
                  </div>
                  {entries.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                        <ClipboardList size={28} />
                      </div>
                      <h3 className="text-white font-medium">No work logged yet</h3>
                      <p className="text-sm text-slate-400 max-w-sm">
                        You haven't recorded any work times yet. Get started by logging your tasks for today.
                      </p>
                      <Link 
                        to="/log" 
                        className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/10 active:scale-[0.98]"
                      >
                        <Plus size={16} />
                        <span>Log First Task</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-slate-400 bg-[#0F172A]/80 uppercase border-b border-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                          <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Action</th>
                            <th className="px-4 py-3 font-medium">Hours</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {entries.slice(0, 15).map((entry) => (
                            <TableRow 
                              key={entry.id}
                              date={formatTableDate(entry.work_date)} 
                              project={entry.project_name} 
                              action={entry.description || entry.action_name} 
                              hours={entry.total_hours.toFixed(1)} 
                              type={
                                entry.project_type === 'Support MA' || entry.project_type === 'Support Go-Live' 
                                  ? 'Support' 
                                  : entry.project_type === 'Management' 
                                  ? 'Management' 
                                  : 'Project'
                              } 
                              actionChannel={entry.action_channel}
                              onEdit={() => setEditingLog(entry)}
                              onView={() => setViewingLog(entry)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {entries.length > 15 && (
                    <div className="p-3 border-t border-slate-700/30 text-center bg-slate-900/40">
                      <Link to="/reports" className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider">
                        View all work logs ({entries.length}) →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Hours by Type Chart */}
              <div className="ai-glass rounded-2xl p-6 shadow-xl flex flex-col justify-between lg:sticky lg:top-6 self-start">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-6">Hours Breakdown</h2>
                  <div className="flex flex-col items-center justify-center py-6">
                    {/* Premium Circle Gauge */}
                    <div className="relative w-48 h-48 rounded-full border-[14px] border-slate-800 flex items-center justify-center mb-6">
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
                        <div className="text-3xl font-extrabold text-white tracking-tight">
                          {typeSummary.total.toFixed(1)}h
                        </div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                          Total Hours
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-slate-700/30 pb-2">
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-indigo-500 mr-3"></span>
                      <span className="text-slate-300">Project / Upgrade</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-semibold">{typeSummary.project.toFixed(1)}h</span>
                      <span className="text-slate-500 text-xs ml-2">({typeSummary.pct.project}%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-700/30 pb-2">
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 mr-3"></span>
                      <span className="text-slate-300">Support Tasks</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-semibold">{typeSummary.support.toFixed(1)}h</span>
                      <span className="text-slate-500 text-xs ml-2">({typeSummary.pct.support}%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-amber-500 mr-3"></span>
                      <span className="text-slate-300">Management</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-semibold">{typeSummary.management.toFixed(1)}h</span>
                      <span className="text-slate-500 text-xs ml-2">({typeSummary.pct.management}%)</span>
                    </div>
                  </div>
                </div>
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
            />
          </>
        )}

      </div>
    </AppLayout>
  );
}

function KpiCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", 
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
    <div className={cn("ai-glass-interactive rounded-xl p-4 shadow-xl flex flex-col justify-between hover:scale-[1.02] duration-300", className)}>
      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 group-hover:scale-110 duration-300">
          {icon}
        </div>
        {trend && <span className={cn("text-[9px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider", trendColor)}>{trend}</span>}
      </div>
      <div>
        <h3 className="text-2xl font-extrabold text-white tracking-tight mb-0.5 font-mono">{value}</h3>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
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
        ? "ai-glass border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/20" 
        : "bg-slate-950/40 border-slate-900",
      isWeekend ? "opacity-40 border-slate-950" : ""
    )}>
      {active && (
        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-indigo-500 rounded-bl-full shadow-lg shadow-indigo-500/50" />
      )}
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{day}</span>
      <span className={cn("text-xl font-extrabold mb-3 font-mono", active ? "text-indigo-400" : "text-white")}>{date}</span>
      
      <div className="w-full h-1.5 rounded-full bg-slate-900 mb-2 overflow-hidden border border-slate-800/40">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", active ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-slate-700")} 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <span className="text-xs font-semibold text-slate-400 font-mono">{hours}</span>
    </div>
  );
}

function TableRow({ 
  date, 
  project, 
  action, 
  hours, 
  type,
  actionChannel,
  onEdit,
  onView
}: { 
  date: string; 
  project: string; 
  action: string; 
  hours: string; 
  type: 'Project' | 'Support' | 'Management'; 
  actionChannel?: string | null;
  onEdit?: () => void;
  onView?: () => void;
}) {
  const typeColors = {
    Project: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    Support: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Management: "text-amber-400 bg-amber-500/10 border-amber-500/20"
  };

  return (
    <tr className="hover:bg-slate-900/35 border-b border-slate-900 transition-colors group">
      <td className="px-4 py-3 text-slate-400 font-semibold font-mono text-xs whitespace-nowrap">{date}</td>
      <td className="px-4 py-3 font-bold text-slate-200 whitespace-nowrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800/70">{project}</span>
      </td>
      <td className="px-4 py-3 text-slate-400 max-w-[150px] text-xs">
        <div className="truncate">{action}</div>
        {actionChannel && (
          <div className="flex flex-wrap gap-1 mt-1">
            {actionChannel.split(',').map((c) => c.trim()).map((channel) => (
              <span 
                key={channel}
                className={cn(
                  "px-1 py-0.5 rounded-full text-[8px] font-extrabold border shrink-0 uppercase tracking-wider flex items-center gap-0.5",
                  channel === 'Meeting' && "bg-indigo-500/10 border-indigo-500/25 text-indigo-400",
                  channel === 'Discuss via phone' && "bg-amber-500/10 border-amber-500/25 text-amber-400",
                  channel === 'On site' && "bg-rose-500/10 border-rose-500/25 text-rose-400"
                )}
              >
                {channel === 'Meeting' && '👥'}
                {channel === 'Discuss via phone' && '📞'}
                {channel === 'On site' && '📍'}
                <span>{channel}</span>
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 font-extrabold text-white font-mono text-sm">{hours}h</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("px-2 py-0.5 text-[8px] font-extrabold rounded uppercase tracking-wider border", typeColors[type])}>
          {type}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="flex justify-end items-center gap-1.5">
          {onView && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className="bg-slate-800/60 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/60 text-slate-400 px-2 py-1 rounded-md cursor-pointer font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-1"
              title="ดูใบงานแบบเต็ม"
            >
              <Eye size={10} />
              <span>View</span>
            </button>
          )}
          {onEdit && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="bg-indigo-500/10 hover:bg-indigo-500/25 active:scale-95 border border-indigo-500/30 text-indigo-400 px-2.5 py-1 rounded-md cursor-pointer font-bold text-[9px] uppercase tracking-wider transition-all shadow-sm shadow-indigo-500/5"
            >
              Edit
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
