import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, ClipboardList, Clock, Eye } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import EditWorklogModal from '../components/modals/EditWorklogModal';
import ViewWorklogModal from '../components/modals/ViewWorklogModal';

interface WorklogEntry {
  id: string;
  work_date: string;
  total_hours: number;
  project_name: string;
  action_name: string;
  description: string | null;
  is_ot?: boolean;
  is_implied_ot?: boolean;
  action_channel?: string | null;
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper: Format date to YYYY-MM-DD
  const formatDateToYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    const sessionStr = sessionStorage.getItem('worklog_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
    const session = JSON.parse(sessionStr);

    async function fetchMonthEntries() {
      try {
        setIsLoading(true);
        // Fetch all user entries
        const { data, error } = await supabase
          .from('col_worklog')
          .select('*')
          .eq('user_id', session.id);

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
  }, [navigate, selectedDateStr, refreshTrigger]);

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
            <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Work Calendar
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Visualize logged work hours and activities in a calendar dashboard.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={today}
              className="px-4 py-2 bg-[#1E293B] border border-slate-700/50 rounded-xl text-sm font-semibold text-slate-300 hover:text-white transition-all hover:bg-slate-800"
            >
              Today
            </button>
            <div className="flex bg-[#1E293B]/80 border border-slate-700/50 rounded-xl overflow-hidden shadow-md">
              <button onClick={prevMonth} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="px-4 py-2.5 text-sm font-semibold text-white min-w-[140px] text-center font-mono">
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Calendar Grid Container */}
          <div className="lg:col-span-2 bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col">
            
            {/* Weekdays header */}
            <div className="grid grid-cols-7 gap-2 mb-4 text-center">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                const isWeekendLabel = day === 'Sat' || day === 'Sun';
                return (
                  <span 
                    key={day} 
                    className={cn(
                      "text-xs font-bold tracking-wider uppercase py-2",
                      isWeekendLabel ? "text-rose-400" : "text-slate-400"
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
                  <div key={i} className="aspect-square bg-[#0F172A]/30 border border-slate-800/50 rounded-xl"></div>
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
                    progressColor = "bg-indigo-500 text-white shadow-md shadow-indigo-500/10";
                  } else if (hoursSum > 0) {
                    progressColor = "bg-indigo-500/40 text-indigo-200 border-indigo-500/50";
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleDayClick(cell.date)}
                      className={cn(
                        "aspect-square rounded-xl p-2 flex flex-col justify-between items-stretch border transition-all text-left relative overflow-hidden group",
                        cell.isCurrentMonth 
                          ? cn(
                              "bg-[#0F172A]/40 border-slate-800 hover:border-slate-600",
                              isWeekend ? "bg-slate-900/35 border-slate-850/60" : "",
                              holiday ? "bg-rose-950/20 border-rose-500/25 hover:border-rose-400" : ""
                            ) 
                          : "bg-transparent border-transparent opacity-10 cursor-default pointer-events-none",
                        isSelected 
                          ? "ring-2 ring-indigo-500/80 border-transparent shadow-[0_0_15px_rgba(99,102,241,0.2)] bg-[#1e293b]/90 scale-95" 
                          : "",
                        isToday && !isSelected ? "border-indigo-500/50" : ""
                      )}
                    >
                      {/* Day Number and Type Badge */}
                      <div className="flex justify-between items-start w-full">
                        <span className={cn(
                          "text-xs font-bold font-mono",
                          isToday ? "text-indigo-400 font-extrabold" : (holiday ? "text-rose-400 font-extrabold" : "text-slate-400 group-hover:text-white transition-colors")
                        )}>
                          {cell.day}
                        </span>
                        {cell.isCurrentMonth && isWeekend && !holiday && (
                          <span className="text-[8px] px-1 py-0.2 rounded font-bold text-slate-500 bg-slate-800/40 border border-slate-700/20 font-mono tracking-wide scale-90 origin-top-right">
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
          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-indigo-400" />
              <span>Details for {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Selected Day'}</span>
            </h2>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center animate-pulse py-12">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : selectedDateEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="text-slate-300 font-medium">No hours logged</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                    You haven't recorded any tasks for this date.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/log')}
                  className="inline-flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
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
                      "p-4 bg-[#0F172A]/50 border rounded-xl flex flex-col justify-between hover:border-slate-600/50 transition-all",
                      e.is_ot || e.is_implied_ot ? "border-amber-500/20 shadow-sm shadow-amber-500/5" : "border-slate-700/30"
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
                        <span className="text-sm font-extrabold text-white font-mono flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          <span>{e.total_hours.toFixed(1)}h</span>
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">{e.action_name}</h4>
                      {e.description && (
                        <p className="text-xs text-slate-400 mt-2 bg-[#1e293b]/40 p-2.5 rounded-lg border border-slate-800 italic leading-relaxed">
                          "{e.description}"
                        </p>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800/85 flex justify-end gap-3.5">
                      <button
                        onClick={() => setViewingLog(e)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>ดูใบงาน / View</span>
                      </button>
                      <button
                        onClick={() => setEditingLog(e)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>แก้ไข / Edit</span>
                      </button>
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
      />
    </AppLayout>
  );
}
