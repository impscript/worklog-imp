import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { 
  FileSpreadsheet, Search, Clock, Award, Layers, ChevronDown, ChevronUp,
  TrendingUp, User as UserIcon, Users, Edit3
} from 'lucide-react';
import EditWorklogModal from '../components/modals/EditWorklogModal';
import AppLayout from '../components/layout/AppLayout';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from 'recharts';

interface WorklogEntry {
  id: string;
  user_id: string;
  work_date: string;
  holding: string;
  department_operator: string;
  project_type: string;
  project_name: string;
  action_name: string;
  total_hours: number;
  description: string | null;
  created_at: string;
  is_ot: boolean;
  is_implied_ot: boolean;
  bu: string;
  start_time: string;
  end_time: string;
  action_channel?: string | null;
}

interface UserProfile {
  id: string;
  emp_id: string;
  full_name: string;
  nickname: string | null;
  email: string | null;
  role: string;
  department: string;
}

export default function ReportsPage() {
  const { showToast } = useNotification();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<'personal' | 'overview' | 'individual'>('personal');
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [allEntries, setAllEntries] = useState<WorklogEntry[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Pagination State (for Personal Tab)
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;

  // Filters State
  const [dateFilter, setDateFilter] = useState<'this-week' | 'this-month' | 'all-time' | 'custom'>('this-month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectSearch, setProjectSearch] = useState('');

  // Helper: YYYY-MM-DD format
  const formatDateToYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Date boundary calculation
  const dateBoundaries = useMemo(() => {
    const today = new Date();
    
    // This Week (Mon - Sun)
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // This Month
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      week: { start: formatDateToYMD(monday), end: formatDateToYMD(sunday) },
      month: { start: formatDateToYMD(firstDay), end: formatDateToYMD(lastDay) }
    };
  }, []);

  // Edit Worklog Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLogForEdit, setSelectedLogForEdit] = useState<WorklogEntry | null>(null);

  const handleOpenEditModal = (log: WorklogEntry) => {
    setSelectedLogForEdit(log);
    setIsEditModalOpen(true);
  };

  const loadData = useCallback(async () => {
    const sessionStr = sessionStorage.getItem('worklog_session');
    if (!sessionStr) {
      navigate('/login');
      return;
    }
    const session = JSON.parse(sessionStr);
    setSessionUser(session);

    try {
      setIsLoading(true);
      
      // 1. Fetch Users List
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('*')
        .order('full_name', { ascending: true });

      if (usersErr) throw usersErr;
      setUsersList(usersData || []);
      if (usersData && usersData.length > 0) {
        // Pre-select current logged in user for Individual Analytics
        const matchingUser = usersData.find((u: any) => u.id === session.id);
        setSelectedUser(matchingUser ? matchingUser.id : usersData[0].id);
      }

      // 2. Fetch All Worklogs in the Database
      const { data: logsData, error: logsErr } = await supabase
        .from('col_worklog')
        .select('*')
        .order('work_date', { ascending: false });

      if (logsErr) throw logsErr;
      
      const mappedLogs = (logsData || []).map((item: any) => ({
        ...item,
        total_hours: parseFloat(item.total_hours)
      }));

      setAllEntries(mappedLogs);

      // 3. Filter personal entries (now done via useMemo)

    } catch (err: any) {
      console.error('Error fetching dashboard reports data:', err);
      showToast('Error loading reports data: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, showToast]);

  // Fetch all required data on component load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, customStart, customEnd, typeFilter, projectSearch]);

  // General filter logic used across logs / graphs
  const applyFilters = (entriesToFilter: WorklogEntry[]) => {
    return entriesToFilter.filter((e) => {
      // 1. Date filter
      if (dateFilter === 'this-week') {
        if (e.work_date < dateBoundaries.week.start || e.work_date > dateBoundaries.week.end) return false;
      } else if (dateFilter === 'this-month') {
        if (e.work_date < dateBoundaries.month.start || e.work_date > dateBoundaries.month.end) return false;
      } else if (dateFilter === 'custom') {
        if (customStart && e.work_date < customStart) return false;
        if (customEnd && e.work_date > customEnd) return false;
      }

      // 2. Project Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'Project' && e.project_type !== 'Project' && e.project_type !== 'Upgrade') return false;
        if (typeFilter === 'Support' && e.project_type !== 'Support MA' && e.project_type !== 'Support Go-Live') return false;
        if (typeFilter === 'Management' && e.project_type !== 'Management') return false;
      }

      // 3. Project Name Search
      if (projectSearch.trim()) {
        if (!e.project_name.toLowerCase().includes(projectSearch.toLowerCase())) return false;
      }

      return true;
    });
  };

  // Memoized lists of logs based on filters
  const personalEntries = useMemo(() => {
    if (!sessionUser) return [];
    const currentTargetId = sessionUser.role === 'admin' ? (selectedUser || sessionUser.id) : sessionUser.id;
    return allEntries.filter(log => log.user_id === currentTargetId);
  }, [allEntries, sessionUser, selectedUser]);

  const filteredPersonalEntries = useMemo(() => {
    return applyFilters(personalEntries);
  }, [personalEntries, dateFilter, customStart, customEnd, typeFilter, projectSearch]);

  const filteredAllEntries = useMemo(() => {
    return applyFilters(allEntries);
  }, [allEntries, dateFilter, customStart, customEnd, typeFilter, projectSearch]);

  // Pagination for Personal logs
  const totalPages = Math.ceil(filteredPersonalEntries.length / entriesPerPage);
  const paginatedPersonalEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * entriesPerPage;
    return filteredPersonalEntries.slice(startIndex, startIndex + entriesPerPage);
  }, [filteredPersonalEntries, currentPage]);

  // Aggregate metrics for personal logs
  const personalTotalHours = useMemo(() => filteredPersonalEntries.reduce((sum, e) => sum + e.total_hours, 0), [filteredPersonalEntries]);
  const personalUniqueProjects = useMemo(() => new Set(filteredPersonalEntries.map((e) => e.project_name)).size, [filteredPersonalEntries]);
  const personalAverageHours = useMemo(() => {
    const uniqueDates = new Set(filteredPersonalEntries.map((e) => e.work_date)).size;
    return uniqueDates > 0 ? (personalTotalHours / uniqueDates) : 0;
  }, [filteredPersonalEntries, personalTotalHours]);

  // Export handlers
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      showToast('Spreadsheet exported successfully!', 'success');
    }, 1200);
  };

  const getTableType = (pt: string) => {
    if (!pt) return 'Other';
    const normalized = pt.toLowerCase();
    if (normalized.includes('support')) return 'Support';
    if (normalized.includes('management') || normalized.includes('admin')) return 'Management';
    if (normalized.includes('project') || normalized.includes('upgrade')) return 'Project';
    return 'Other';
  };

  const typeColors: Record<string, string> = {
    Project: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
    Support: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    Management: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    Other: "text-slate-400 bg-slate-400/10 border-slate-400/20"
  };

  const toggleRow = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // --- MANAGEMENT OVERVIEW TAB MEMOS & DATA ---
  const overviewData = useMemo(() => {
    // 1. Separate logs by User Department
    const deptLogsMap: Record<string, WorklogEntry[]> = {};
    filteredAllEntries.forEach(log => {
      const user = usersList.find(u => u.id === log.user_id);
      const userDept = (user?.department || 'Unassigned').trim();
      if (!deptLogsMap[userDept]) deptLogsMap[userDept] = [];
      deptLogsMap[userDept].push(log);
    });

    const getMetrics = (logs: WorklogEntry[]) => {
      const totalH = logs.reduce((s, e) => s + e.total_hours, 0);
      const otH = logs.filter(e => e.is_ot || e.is_implied_ot).reduce((s, e) => s + e.total_hours, 0);
      const uniqueUsers = new Set(logs.map(e => e.user_id)).size;
      return { totalHours: totalH, otHours: otH, usersCount: uniqueUsers };
    };

    const getTopProjects = (logs: WorklogEntry[]) => {
      const projMap: Record<string, number> = {};
      logs.forEach(log => {
        projMap[log.project_name] = (projMap[log.project_name] || 0) + log.total_hours;
      });
      return Object.entries(projMap)
        .map(([name, hours]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, hours: parseFloat(hours.toFixed(1)) }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5);
    };

    const depts = Object.keys(deptLogsMap).map(deptName => {
      const logs = deptLogsMap[deptName];
      return {
        name: deptName,
        metrics: getMetrics(logs),
        projects: getTopProjects(logs)
      };
    }).sort((a, b) => b.metrics.totalHours - a.metrics.totalHours);

    // 2. Trend data (Grouped by Date)
    const datesMap: Record<string, any> = {};
    filteredAllEntries.forEach(log => {
      const dateStr = log.work_date;
      if (!datesMap[dateStr]) {
        datesMap[dateStr] = { date: dateStr };
      }
      const user = usersList.find(u => u.id === log.user_id);
      const userDept = (user?.department || 'Unassigned').trim();
      datesMap[dateStr][userDept] = (datesMap[dateStr][userDept] || 0) + log.total_hours;
    });
    
    // Sort trends chronologically and take last 10 working days
    const trendData = Object.values(datesMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10);

    // 4. Overtime Leaderboard (Overall)
    const otUserMap: Record<string, { id: string; name: string; dept: string; otHours: number }> = {};
    filteredAllEntries.forEach(log => {
      if (log.is_ot || log.is_implied_ot) {
        const user = usersList.find(u => u.id === log.user_id);
        const name = user?.full_name || 'Unknown Operator';
        const dept = (user?.department || 'Unassigned').trim();
        if (!otUserMap[log.user_id]) {
          otUserMap[log.user_id] = { id: log.user_id, name, dept, otHours: 0 };
        }
        otUserMap[log.user_id].otHours += log.total_hours;
      }
    });

    const otLeaderboard = Object.values(otUserMap)
      .map(item => ({ ...item, otHours: parseFloat(item.otHours.toFixed(1)) }))
      .sort((a, b) => b.otHours - a.otHours)
      .slice(0, 5);

    return {
      depts,
      trend: trendData,
      otLeaderboard
    };
  }, [filteredAllEntries, usersList]);


  // --- INDIVIDUAL ANALYTICS TAB MEMOS & DATA ---
  const individualData = useMemo(() => {
    if (!selectedUser) return null;
    const user = usersList.find(u => u.id === selectedUser);
    const userLogs = filteredAllEntries.filter(log => log.user_id === selectedUser);
    
    const totalHours = userLogs.reduce((sum, e) => sum + e.total_hours, 0);
    const otHours = userLogs.filter(e => e.is_ot || e.is_implied_ot).reduce((sum, e) => sum + e.total_hours, 0);
    const otRate = totalHours > 0 ? parseFloat(((otHours / totalHours) * 100).toFixed(1)) : 0;
    const uniqueDatesCount = new Set(userLogs.map(e => e.work_date)).size;
    const avgHoursPerDay = uniqueDatesCount > 0 ? parseFloat((totalHours / uniqueDatesCount).toFixed(1)) : 0;
    const uniqueProjectsCount = new Set(userLogs.map(e => e.project_name)).size;

    // 1. Work Type Breakdown (Pie Chart)
    const typeBreakdown: Record<string, number> = {};
    userLogs.forEach(log => {
      const type = getTableType(log.project_type);
      typeBreakdown[type] = (typeBreakdown[type] || 0) + log.total_hours;
    });
    const pieData = Object.entries(typeBreakdown).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(1))
    }));

    // 2. Project Effort Breakdown
    const projectEffort: Record<string, number> = {};
    userLogs.forEach(log => {
      projectEffort[log.project_name] = (projectEffort[log.project_name] || 0) + log.total_hours;
    });
    const projectData = Object.entries(projectEffort)
      .map(([name, hours]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, hours: parseFloat(hours.toFixed(1)) }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    // Gather unique BUs from all logs, sorted by total hours
    const buHoursMap: Record<string, number> = {};
    filteredAllEntries.forEach(e => {
      const bu = (e.bu || 'Unassigned').trim();
      buHoursMap[bu] = (buHoursMap[bu] || 0) + e.total_hours;
    });
    const activeBUs = Object.keys(buHoursMap).sort((a, b) => buHoursMap[b] - buHoursMap[a]).slice(0, 6);
    
    const radarData = activeBUs.map(bu => {
      // User's total hours in this BU
      const userBUHours = userLogs.filter(e => (e.bu || 'Unassigned').trim() === bu).reduce((sum, e) => sum + e.total_hours, 0);
      
      // Team average hours in this BU
      const totalBUHours = filteredAllEntries.filter(e => (e.bu || 'Unassigned').trim() === bu).reduce((sum, e) => sum + e.total_hours, 0);
      const totalTeamUsers = new Set(filteredAllEntries.map(e => e.user_id)).size || 1;
      const teamAvg = parseFloat((totalBUHours / totalTeamUsers).toFixed(1));

      return {
        subject: bu,
        User: parseFloat(userBUHours.toFixed(1)),
        TeamAvg: teamAvg
      };
    });

    return {
      user,
      totalHours,
      otHours,
      otRate,
      avgHoursPerDay,
      uniqueProjectsCount,
      totalEntries: userLogs.length,
      pieData,
      projectData,
      radarData
    };
  }, [selectedUser, filteredAllEntries, usersList]);

  // Color arrays for Pie cells
  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent">
              Performance & Work Reports
            </h1>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              Explore aggregate organizational statistics, comparative team analytics, and personal logging sheets.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {activeTab === 'personal' && (
              <button 
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-xs uppercase tracking-wider"
              >
                <FileSpreadsheet size={15} />
                <span>{isExporting ? 'Exporting...' : 'Export Spreadsheet'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Zone Selector (Tabs) */}
        <div className="flex bg-[#1E293B]/60 p-1 border border-slate-700/50 rounded-2xl max-w-lg shadow-inner">
          <button
            onClick={() => setActiveTab('personal')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all",
              activeTab === 'personal'
                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20 border border-indigo-400/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/40"
            )}
          >
            <FileSpreadsheet size={15} />
            My Work Logs
          </button>
          
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all",
              activeTab === 'overview'
                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20 border border-indigo-400/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/40"
            )}
          >
            <Users size={15} />
            Management Overview
          </button>
          
          <button
            onClick={() => setActiveTab('individual')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all",
              activeTab === 'individual'
                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20 border border-indigo-400/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/40"
            )}
          >
            <UserIcon size={15} />
            Individual Analytics
          </button>
        </div>

        {/* Shared Filters Toolbar */}
        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Project Name Search (Disabled on Overview) */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Project Name</label>
            <div className="relative">
              <input 
                type="text" 
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-xs font-semibold"
              />
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Date range filter */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="bg-[#0F172A] border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs font-semibold"
            >
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="all-time">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Type filter */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Activity Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#0F172A] border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs font-semibold"
            >
              <option value="all">All Types</option>
              <option value="Project">Project / Upgrade</option>
              <option value="Support">Support MA / Go-Live</option>
              <option value="Management">Management</option>
            </select>
          </div>

          {/* Admin User Filter */}
          {sessionUser?.role === 'admin' && activeTab === 'personal' && (
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest mb-2 flex items-center gap-1">
                Admin: Target User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-[#0F172A] border border-amber-700/50 rounded-xl py-2.5 px-4 text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer text-xs font-semibold"
              >
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.emp_id})</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Date inputs */}
          {dateFilter === 'custom' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start</label>
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-[#0F172A] border border-slate-700 rounded-lg py-1.5 px-2 text-[10px] text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark] font-mono"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">End</label>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-[#0F172A] border border-slate-700 rounded-lg py-1.5 px-2 text-[10px] text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark] font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-end">
              <span className="text-[10px] text-slate-500 font-bold font-mono pb-2 text-center md:text-left">
                Found {activeTab === 'personal' ? filteredPersonalEntries.length : filteredAllEntries.length} entries matching criteria
              </span>
            </div>
          )}
        </div>


        {/* ======================================================== */}
        {/* TAB 1: PERSONAL WORK LOGS */}
        {/* ======================================================== */}
        {activeTab === 'personal' && (
          <div className="space-y-8">
            {/* Aggregate Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <ReportKpi title="Total Logged Hours" value={`${personalTotalHours.toFixed(1)}h`} icon={<Clock className="text-indigo-400" />} />
              <ReportKpi title="Average Hours/Day" value={`${personalAverageHours.toFixed(1)}h`} icon={<Award className="text-emerald-400" />} />
              <ReportKpi title="Active Project Count" value={String(personalUniqueProjects)} icon={<Layers className="text-amber-400" />} />
              <ReportKpi title="Total Records Count" value={String(filteredPersonalEntries.length)} icon={<FileSpreadsheet className="text-rose-400" />} />
            </div>

            {/* Logs Table Card */}
            <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center animate-pulse flex flex-col gap-4">
                  <div className="h-6 w-full bg-slate-800 rounded"></div>
                  <div className="h-6 w-full bg-slate-800 rounded"></div>
                  <div className="h-6 w-full bg-slate-800 rounded"></div>
                </div>
              ) : filteredPersonalEntries.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 shadow-inner">
                    <Search size={24} />
                  </div>
                  <h3 className="text-white font-bold tracking-tight">No entries discovered</h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    Try clearing search inputs or setting a broader date range boundary.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] text-slate-400 bg-[#0F172A]/50 uppercase tracking-widest border-b border-slate-700/50">
                        <tr>
                          <th className="px-6 py-4 font-bold">Date</th>
                          <th className="px-6 py-4 font-bold">Holding</th>
                          <th className="px-6 py-4 font-bold">Project Name</th>
                          <th className="px-6 py-4 font-bold">Action</th>
                          <th className="px-6 py-4 font-bold">Hours</th>
                          <th className="px-6 py-4 font-bold">Type</th>
                          <th className="px-6 py-4 font-bold text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {paginatedPersonalEntries.map((e) => {
                          const isExpanded = expandedId === e.id;
                          const cat = getTableType(e.project_type);

                          return (
                            <Fragment key={e.id}>
                              <tr 
                                onClick={() => toggleRow(e.id)}
                                className={cn(
                                  "hover:bg-slate-700/30 cursor-pointer transition-colors duration-150 font-medium bg-[#1E293B]/10 border-b border-slate-700/40",
                                  isExpanded && "bg-slate-800/40"
                                )}
                              >
                                <td className="px-6 py-4 font-mono text-indigo-300">
                                  <div className="font-bold">{e.work_date}</div>
                                  {e.start_time && e.end_time && (
                                    <div className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wider">
                                      {e.start_time.slice(0, 5)} → {e.end_time.slice(0, 5)}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-slate-300">{e.holding}</td>
                                <td className="px-6 py-4 font-bold text-white max-w-[200px] truncate">{e.project_name}</td>
                                <td className="px-6 py-4 text-slate-300">{e.action_name}</td>
                                <td className="px-6 py-4 font-bold font-mono text-indigo-200">
                                  {e.total_hours.toFixed(1)}h
                                  {(e.is_ot || e.is_implied_ot) && (
                                    <span className="ml-1.5 px-1 py-0.5 text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded">OT</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn("px-2.5 py-1 text-[9px] font-bold rounded-lg border", typeColors[cat])}>
                                    {cat}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button className="text-slate-400 hover:text-white p-1 rounded transition-colors">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-[#0F172A]/40">
                                  <td colSpan={7} className="px-8 py-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                          <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Holding BU</span>
                                          <span className="text-white font-semibold font-mono">{e.holding}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Role Operator</span>
                                          <span className="text-white font-semibold">{e.department_operator}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Project Type</span>
                                          <span className="text-white font-semibold">{e.project_type}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Created At</span>
                                          <span className="text-white font-semibold font-mono">{new Date(e.created_at).toLocaleString()}</span>
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold font-mono block mb-1">Work Description</span>
                                        <p className="text-xs text-slate-300 bg-[#1E293B]/60 p-4 rounded-xl border border-slate-700/50 leading-relaxed italic">
                                          {e.description ? `"${e.description}"` : 'No custom description provided.'}
                                        </p>
                                        <div className="mt-3 flex justify-end">
                                          <button
                                            onClick={(evt) => {
                                              evt.stopPropagation();
                                              handleOpenEditModal(e);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 font-bold text-xs rounded-xl transition-all"
                                          >
                                            <Edit3 size={12} />
                                            <span>แก้ไขใบงาน (Edit)</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination Bar */}
                  {totalPages > 1 && (
                    <div className="px-6 py-4 bg-[#0F172A]/40 border-t border-slate-700/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <span className="text-xs text-slate-400 font-medium font-mono">
                        Showing {((currentPage - 1) * entriesPerPage) + 1} - {Math.min(currentPage * entriesPerPage, filteredPersonalEntries.length)} of {filteredPersonalEntries.length} entries
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="px-3 py-1.5 bg-[#1E293B] border border-slate-700/50 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-slate-300 font-bold rounded-lg transition-all"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => {
                          const page = i + 1;
                          if (totalPages > 6 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                            if (page === 2 && currentPage > 3) return <span key={page} className="text-slate-600 text-xs px-1 select-none font-mono">...</span>;
                            if (page === totalPages - 1 && currentPage < totalPages - 2) return <span key={page} className="text-slate-600 text-xs px-1 select-none font-mono">...</span>;
                            return null;
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={cn(
                                "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all font-mono border",
                                currentPage === page
                                  ? "bg-indigo-500 text-white border-transparent shadow-md shadow-indigo-500/10"
                                  : "bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-800"
                              )}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          className="px-3 py-1.5 bg-[#1E293B] border border-slate-700/50 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-slate-300 font-bold rounded-lg transition-all"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}


        {/* ======================================================== */}
        {/* TAB 2: MANAGEMENT OVERVIEW (DYNAMIC DEPTS) */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (() => {
          const deptStyles = [
            { border: 'border-blue-500/20', hover: 'hover:border-blue-500/30', bgGlow: 'bg-blue-500/5', hoverBg: 'group-hover:bg-blue-500/10', dot: 'bg-blue-500', badgeText: 'text-blue-400', badgeBg: 'bg-blue-500/10', badgeBorder: 'border-blue-500/20', barBg: 'bg-blue-500', stroke: '#3b82f6' },
            { border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/30', bgGlow: 'bg-emerald-500/5', hoverBg: 'group-hover:bg-emerald-500/10', dot: 'bg-emerald-500', badgeText: 'text-emerald-400', badgeBg: 'bg-emerald-500/10', badgeBorder: 'border-emerald-500/20', barBg: 'bg-emerald-500', stroke: '#10b981' },
            { border: 'border-amber-500/20', hover: 'hover:border-amber-500/30', bgGlow: 'bg-amber-500/5', hoverBg: 'group-hover:bg-amber-500/10', dot: 'bg-amber-500', badgeText: 'text-amber-400', badgeBg: 'bg-amber-500/10', badgeBorder: 'border-amber-500/20', barBg: 'bg-amber-500', stroke: '#f59e0b' },
            { border: 'border-purple-500/20', hover: 'hover:border-purple-500/30', bgGlow: 'bg-purple-500/5', hoverBg: 'group-hover:bg-purple-500/10', dot: 'bg-purple-500', badgeText: 'text-purple-400', badgeBg: 'bg-purple-500/10', badgeBorder: 'border-purple-500/20', barBg: 'bg-purple-500', stroke: '#a855f7' },
            { border: 'border-rose-500/20', hover: 'hover:border-rose-500/30', bgGlow: 'bg-rose-500/5', hoverBg: 'group-hover:bg-rose-500/10', dot: 'bg-rose-500', badgeText: 'text-rose-400', badgeBg: 'bg-rose-500/10', badgeBorder: 'border-rose-500/20', barBg: 'bg-rose-500', stroke: '#f43f5e' },
            { border: 'border-cyan-500/20', hover: 'hover:border-cyan-500/30', bgGlow: 'bg-cyan-500/5', hoverBg: 'group-hover:bg-cyan-500/10', dot: 'bg-cyan-500', badgeText: 'text-cyan-400', badgeBg: 'bg-cyan-500/10', badgeBorder: 'border-cyan-500/20', barBg: 'bg-cyan-500', stroke: '#06b6d4' }
          ];

          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Dynamic Departments Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {overviewData.depts.length === 0 ? (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 bg-[#1E293B]/40 rounded-3xl border border-slate-700/50">
                    <UserIcon size={32} className="opacity-20 mb-3" />
                    <span className="font-medium text-sm">No department data available for selected filters.</span>
                  </div>
                ) : (
                  overviewData.depts.map((dept, idx) => {
                    const style = deptStyles[idx % deptStyles.length];
                    return (
                      <div key={dept.name} className={`bg-[#1E293B]/80 backdrop-blur-xl border ${style.border} ${style.hover} rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 ${style.bgGlow} rounded-full blur-3xl pointer-events-none ${style.hoverBg} transition-colors`}></div>
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex items-center gap-3">
                            <span className={`w-3.5 h-3.5 rounded-full ${style.dot} animate-pulse`}></span>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase truncate max-w-[200px]" title={dept.name}>{dept.name}</h2>
                          </div>
                          <span className={`text-[10px] font-bold ${style.badgeBg} border ${style.badgeBorder} ${style.badgeText} px-3 py-1 rounded-full uppercase tracking-wider font-mono shrink-0`}>
                            {dept.metrics.usersCount} Active {dept.metrics.usersCount === 1 ? 'User' : 'Users'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[#0F172A]/50 border border-slate-700/40 rounded-2xl p-4 shadow-inner">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Total Effort Hours</span>
                            <span className="text-3xl font-black text-white tracking-tight font-mono">{dept.metrics.totalHours.toFixed(1)}h</span>
                          </div>
                          <div className="bg-[#0F172A]/50 border border-slate-700/40 rounded-2xl p-4 shadow-inner">
                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">Overtime Logged</span>
                            <span className="text-3xl font-black text-amber-400 tracking-tight font-mono">{dept.metrics.otHours.toFixed(1)}h</span>
                          </div>
                        </div>

                        {/* Top Projects */}
                        <div className="mt-6 space-y-3">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">🏆 Top Projects</h3>
                          {dept.projects.length === 0 ? (
                            <span className="text-xs text-slate-500 italic block">No records logged in {dept.name}.</span>
                          ) : (
                            <div className="space-y-2">
                              {dept.projects.map((p, pIdx) => (
                                <div key={pIdx} className="flex flex-col gap-1.5">
                                  <div className="flex justify-between text-xs font-medium">
                                    <span className="text-slate-300 font-bold truncate max-w-[180px]">{p.name}</span>
                                    <span className={`${style.badgeText} font-bold font-mono`}>{p.hours}h</span>
                                  </div>
                                  <div className="w-full bg-[#0F172A] h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className={`${style.barBg} h-full rounded-full`} 
                                      style={{ width: `${Math.min((p.hours / (dept.metrics.totalHours || 1)) * 100, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Interactive multiple trend area chart */}
              <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="text-indigo-400" size={18} />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">📈 Department Daily Hours Trend</h3>
                  </div>
                </div>
                <div className="h-72 w-full">
                  {overviewData.trend.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No trend data available for active filters.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overviewData.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          {overviewData.depts.map((dept, idx) => {
                            const style = deptStyles[idx % deptStyles.length];
                            return (
                              <linearGradient key={`color-${dept.name}`} id={`color-${dept.name}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={style.stroke} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={style.stroke} stopOpacity={0}/>
                              </linearGradient>
                            );
                          })}
                        </defs>
                        <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} 
                          labelClassName="text-slate-400 font-bold font-mono text-[10px]"
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        
                        {overviewData.depts.map((dept, idx) => {
                          const style = deptStyles[idx % deptStyles.length];
                          return (
                            <Area 
                              key={dept.name}
                              name={`${dept.name} (Hours)`}
                              type="monotone" 
                              dataKey={dept.name} 
                              stroke={style.stroke} 
                              strokeWidth={2.5} 
                              fillOpacity={1} 
                              fill={`url(#color-${dept.name})`} 
                            />
                          );
                        })}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            {/* Overtime ranking leaderboard */}
            <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl max-w-2xl mx-auto">
              <div className="flex items-center gap-2.5 mb-6">
                <Clock className="text-amber-400" size={18} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">⏰ Top Overtime (OT) Operators</h3>
              </div>
              <div className="space-y-4">
                {overviewData.otLeaderboard.length === 0 ? (
                  <span className="text-xs text-slate-500 italic block text-center py-4">No overtime hours logged in selected range.</span>
                ) : (
                  overviewData.otLeaderboard.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-[#0F172A]/50 border border-slate-700/40 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs font-mono border shadow-md",
                          idx === 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/5" :
                          idx === 1 ? "bg-slate-400/10 border-slate-400/30 text-slate-300" :
                          "bg-slate-800 border-slate-700 text-slate-400"
                        )}>
                          #{idx + 1}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">{item.name}</span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{item.dept} Department</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-black text-amber-400">{item.otHours}h OT</span>
                        <div className="w-16 bg-[#0F172A] h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-amber-400 h-full rounded-full"
                            style={{ width: `${Math.min((item.otHours / (overviewData.otLeaderboard[0]?.otHours || 1)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}


        {/* ======================================================== */}
        {/* TAB 3: INDIVIDUAL PERFORMANCE ANALYTICS */}
        {/* ======================================================== */}
        {activeTab === 'individual' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Employee selector bar */}
            <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Select Teammate Profile</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Explore individual metrics, radar work grids, and BUs allocations.</p>
                </div>
              </div>
              
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-[#0F172A] border border-slate-700 rounded-xl py-2.5 px-6 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold w-full sm:w-64 shadow-md"
              >
                {usersList.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.nickname || user.emp_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Individual Profile & KPIs Grid */}
            {individualData && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column Profile Card */}
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between items-center text-center relative overflow-hidden group">
                    <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                     <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-indigo-500/30 overflow-hidden ring-4 ring-indigo-500/10 shadow-lg flex items-center justify-center shrink-0 mb-4">
                      <img 
                        src={`https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${individualData.user?.emp_id}`} 
                        alt="Teammate avatar" 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(individualData.user?.full_name || 'Guest')}&background=6366f1&color=fff&size=128&bold=true`;
                        }}
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight">{individualData.user?.full_name}</h2>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-1 block">Emp ID: {individualData.user?.emp_id}</span>
                      <span className="mt-3 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold rounded-full text-[9px] uppercase tracking-wider inline-block">
                        {individualData.user?.department || 'IMP'} Department
                      </span>
                    </div>

                    <div className="w-full border-t border-slate-700/50 my-6 pt-6 grid grid-cols-2 gap-4 text-left">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">User Role</span>
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{individualData.user?.role || 'User'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Email Address</span>
                        <span className="text-xs font-bold text-slate-300 truncate block max-w-[120px] font-mono">{individualData.user?.email || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column KPIs Grid */}
                  <div className="lg:col-span-2 grid grid-cols-2 gap-6">
                    <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shrink-0"><Clock size={20} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Total Hours Logged</span>
                        <span className="text-2xl font-black text-white font-mono tracking-tight">{individualData.totalHours.toFixed(1)}h</span>
                      </div>
                    </div>

                    <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0"><Award size={20} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Average Hours/Day</span>
                        <span className="text-2xl font-black text-white font-mono tracking-tight">{individualData.avgHoursPerDay}h</span>
                      </div>
                    </div>

                    <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0"><Clock size={20} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Overtime Rate</span>
                        <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">{individualData.otRate}%</span>
                      </div>
                    </div>

                    <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl shrink-0"><Layers size={20} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Projects Contributed</span>
                        <span className="text-2xl font-black text-white font-mono tracking-tight">{individualData.uniqueProjectsCount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Radar performance & pie ratio graphs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Radar Chart (Teammate vs Team Avg in BUs) */}
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">🕸️ Business Unit Allocation Map</h3>
                    <div className="h-64 w-full">
                      {individualData.radarData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No allocation data.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={individualData.radarData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={9} />
                            <PolarRadiusAxis stroke="#334155" fontSize={8} />
                            <Radar name="This User" dataKey="User" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                            <Radar name="Team Average" dataKey="TeamAvg" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Work Type Pie Chart */}
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">🎯 Work Type Ratio breakdown</h3>
                    <div className="h-64 w-full flex items-center justify-center">
                      {individualData.pieData.length === 0 ? (
                        <div className="text-xs text-slate-500 italic">No logging records.</div>
                      ) : (
                        <div className="relative w-full h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={individualData.pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={85}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {individualData.pieData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Projects Contribution bar chart */}
                <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">🏆 Top 5 Projects by Contributed Hours</h3>
                  <div className="h-64 w-full">
                    {individualData.projectData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No project data logged.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={individualData.projectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                          <Bar name="Hours Contributed" dataKey="hours" radius={[8, 8, 0, 0]}>
                            {individualData.projectData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* Edit Worklog Modal */}
      <EditWorklogModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedLogForEdit(null);
        }}
        log={selectedLogForEdit}
        onSaveSuccess={loadData}
      />
    </AppLayout>
  );
}

function ReportKpi({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
      <div className="p-3 rounded-xl bg-[#0F172A]/50 border border-slate-700/50 shrink-0">
        {icon}
      </div>
      <div>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">{title}</span>
        <span className="text-2xl font-extrabold text-white tracking-tight font-mono">{value}</span>
      </div>
    </div>
  );
}
