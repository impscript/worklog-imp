import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { 
  FileSpreadsheet, Search, Clock, Award, Layers, ChevronDown, ChevronUp,
  TrendingUp, User as UserIcon, Users, Edit3, Eye, Brain
} from 'lucide-react';
import EditWorklogModal from '../components/modals/EditWorklogModal';
import ViewWorklogModal from '../components/modals/ViewWorklogModal';
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
  Legend,
  ReferenceLine
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
  department?: string;
}

interface UserProfile {
  id: string;
  emp_id: string;
  full_name: string;
  nickname: string | null;
  email: string | null;
  role: string;
  department: string;
  position?: string;
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

  // View Worklog Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedLogForView, setSelectedLogForView] = useState<WorklogEntry | null>(null);

  const handleOpenViewModal = (log: WorklogEntry) => {
    setSelectedLogForView(log);
    setIsViewModalOpen(true);
  };

  const loadData = useCallback(async () => {
    const queryParams = new URLSearchParams(window.location.search);
    const token = queryParams.get('share');

    const sessionStr = localStorage.getItem('worklog_session');
    if (!sessionStr) {
      if (token) {
        // Bypass redirect for public shared view
        return;
      }
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

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const token = queryParams.get('share');
    if (token) {
      navigate(`/hrbp?share=${token}`);
    }
  }, [navigate]);

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
    Other: "text-theme-text-secondary bg-slate-400/10 border-slate-400/20"
  };

  const toggleRow = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // --- MANAGEMENT OVERVIEW TAB MEMOS & DATA ---
  const overviewData = useMemo(() => {
    // Left Group: IMP ONLY
    const impEntries = filteredAllEntries.filter(
      e => e.department_operator === 'IMP'
    );
    // Right Group: IT ONLY
    const itEntries = filteredAllEntries.filter(
      e => e.department_operator === 'IT'
    );

    const getGroupMetrics = (entries: WorklogEntry[]) => {
      const totalH = entries.reduce((s, e) => s + e.total_hours, 0);
      const otH = entries.filter(e => e.is_ot || e.is_implied_ot).reduce((s, e) => s + e.total_hours, 0);
      const uniqueUsers = new Set(entries.map(e => e.user_id)).size;
      return { totalHours: totalH, otHours: otH, usersCount: uniqueUsers };
    };

    const getGroupProjects = (entries: WorklogEntry[]) => {
      const projMap: Record<string, number> = {};
      entries.forEach(e => {
        projMap[e.project_name] = (projMap[e.project_name] || 0) + e.total_hours;
      });
      const total = entries.reduce((s, e) => s + e.total_hours, 0) || 1;
      return Object.entries(projMap)
        .map(([name, hours]) => ({
          name: name.length > 25 ? name.substring(0, 25) + '...' : name,
          hours: parseFloat(hours.toFixed(1)),
          percentage: parseFloat(((hours / total) * 100).toFixed(1))
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 6);
    };

    const impMetrics = getGroupMetrics(impEntries);
    const impProjects = getGroupProjects(impEntries);

    const itMetrics = getGroupMetrics(itEntries);
    const itProjects = getGroupProjects(itEntries);

    // --- IMP Distributions ---
    const impBuMap: Record<string, number> = {};
    impEntries.forEach(e => {
      const bu = (e.bu || 'Unassigned').trim();
      impBuMap[bu] = (impBuMap[bu] || 0) + e.total_hours;
    });
    const impTotalHours = impEntries.reduce((s, e) => s + e.total_hours, 0) || 1;
    const impBuBreakdown = Object.entries(impBuMap)
      .map(([name, hours]) => ({
        name,
        hours: parseFloat(hours.toFixed(1)),
        percentage: parseFloat(((hours / impTotalHours) * 100).toFixed(1))
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    const impDeptMap: Record<string, number> = {};
    impEntries.forEach(e => {
      let deptName = (e.department || '').trim();
      if (!deptName) {
        const user = usersList.find(u => u.id === e.user_id);
        deptName = (user?.department || 'Unassigned').trim();
      }
      impDeptMap[deptName] = (impDeptMap[deptName] || 0) + e.total_hours;
    });
    const impDeptBreakdown = Object.entries(impDeptMap)
      .map(([name, hours]) => ({
        name,
        hours: parseFloat(hours.toFixed(1)),
        percentage: parseFloat(((hours / impTotalHours) * 100).toFixed(1))
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    // --- IT Distributions ---
    const itBuMap: Record<string, number> = {};
    itEntries.forEach(e => {
      const bu = (e.bu || 'Unassigned').trim();
      itBuMap[bu] = (itBuMap[bu] || 0) + e.total_hours;
    });
    const itTotalHours = itEntries.reduce((s, e) => s + e.total_hours, 0) || 1;
    const itBuBreakdown = Object.entries(itBuMap)
      .map(([name, hours]) => ({
        name,
        hours: parseFloat(hours.toFixed(1)),
        percentage: parseFloat(((hours / itTotalHours) * 100).toFixed(1))
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    const itDeptMap: Record<string, number> = {};
    itEntries.forEach(e => {
      let deptName = (e.department || '').trim();
      if (!deptName) {
        const user = usersList.find(u => u.id === e.user_id);
        deptName = (user?.department || 'Unassigned').trim();
      }
      itDeptMap[deptName] = (itDeptMap[deptName] || 0) + e.total_hours;
    });
    const itDeptBreakdown = Object.entries(itDeptMap)
      .map(([name, hours]) => ({
        name,
        hours: parseFloat(hours.toFixed(1)),
        percentage: parseFloat(((hours / itTotalHours) * 100).toFixed(1))
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    // Helper to format date string to MM-DD
    const formatToMMDD = (dateStr: string) => {
      if (!dateStr) return '';
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length >= 3) {
          return `${parts[1]}-${parts[2]}`;
        }
        return dateStr;
      }
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length >= 3) {
          const d = parts[0].padStart(2, '0');
          const m = parts[1].padStart(2, '0');
          return `${m}-${d}`;
        }
      }
      return dateStr;
    };

    // IMP Trend: Grouped by Date, splitting Normal and OT
    const impTrendMap: Record<string, { date: string; Normal: number; OT: number }> = {};
    impEntries.forEach(log => {
      const dateStr = log.work_date;
      if (!impTrendMap[dateStr]) {
        impTrendMap[dateStr] = { date: dateStr, Normal: 0, OT: 0 };
      }
      if (log.is_ot || log.is_implied_ot) {
        impTrendMap[dateStr].OT += log.total_hours;
      } else {
        impTrendMap[dateStr].Normal += log.total_hours;
      }
    });

    const impTrendData = Object.values(impTrendMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        dateDisplay: formatToMMDD(d.date),
        Normal: parseFloat(d.Normal.toFixed(1)),
        OT: parseFloat(d.OT.toFixed(1))
      }))
      .slice(-20);

    // IT Trend: Grouped by Date, splitting Normal and OT
    const itTrendMap: Record<string, { date: string; Normal: number; OT: number }> = {};
    itEntries.forEach(log => {
      const dateStr = log.work_date;
      if (!itTrendMap[dateStr]) {
        itTrendMap[dateStr] = { date: dateStr, Normal: 0, OT: 0 };
      }
      if (log.is_ot || log.is_implied_ot) {
        itTrendMap[dateStr].OT += log.total_hours;
      } else {
        itTrendMap[dateStr].Normal += log.total_hours;
      }
    });

    const itTrendData = Object.values(itTrendMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        dateDisplay: formatToMMDD(d.date),
        Normal: parseFloat(d.Normal.toFixed(1)),
        OT: parseFloat(d.OT.toFixed(1))
      }))
      .slice(-20);

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
      imp: {
        metrics: impMetrics,
        projects: impProjects
      },
      it: {
        metrics: itMetrics,
        projects: itProjects
      },
      impBuBreakdown,
      impDeptBreakdown,
      itBuBreakdown,
      itDeptBreakdown,
      impTrend: impTrendData,
      itTrend: itTrendData,
      otLeaderboard
    };
  }, [filteredAllEntries, usersList]);


  // --- INDIVIDUAL ANALYTICS TAB MEMOS & DATA ---
  const individualData = useMemo(() => {
    if (!selectedUser) return null;
    const user = usersList.find(u => u.id === selectedUser);
    const userLogs = filteredAllEntries.filter(log => log.user_id === selectedUser);
    
    // Date formatting helper
    const formatToMMDD = (dateStr: string) => {
      if (!dateStr) return '';
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length >= 3) {
          return `${parts[1]}-${parts[2]}`;
        }
        return dateStr;
      }
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length >= 3) {
          const d = parts[0].padStart(2, '0');
          const m = parts[1].padStart(2, '0');
          return `${m}-${d}`;
        }
      }
      return dateStr;
    };

    // 1. Group by date and calculate initial Normal / OT hours
    const dailyMap: Record<string, { date: string; dateDisplay: string; Normal: number; OT: number }> = {};
    userLogs.forEach(log => {
      const dateStr = log.work_date;
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, dateDisplay: formatToMMDD(dateStr), Normal: 0, OT: 0 };
      }
      if (log.is_ot || log.is_implied_ot) {
        dailyMap[dateStr].OT += log.total_hours;
      } else {
        dailyMap[dateStr].Normal += log.total_hours;
      }
    });

    // 2. Adjust: if Normal hours in a day exceed 8 hours, split the excess into OT
    Object.keys(dailyMap).forEach(dateStr => {
      const day = dailyMap[dateStr];
      if (day.Normal > 8) {
        const excess = day.Normal - 8;
        day.Normal = 8;
        day.OT += excess;
      }
    });

    // Extract daily hours data for chart
    const dailyHoursData = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        Normal: parseFloat(d.Normal.toFixed(1)),
        OT: parseFloat(d.OT.toFixed(1))
      }));

    // Calculate adjusted totals from dailyMap
    const totalHours = Object.values(dailyMap).reduce((sum, d) => sum + d.Normal + d.OT, 0);
    const otHours = Object.values(dailyMap).reduce((sum, d) => sum + d.OT, 0);
    const normalHours = Object.values(dailyMap).reduce((sum, d) => sum + d.Normal, 0);

    const otRate = totalHours > 0 ? parseFloat(((otHours / totalHours) * 100).toFixed(1)) : 0;
    const uniqueDatesCount = Object.keys(dailyMap).length;
    const avgHoursPerDay = uniqueDatesCount > 0 ? parseFloat((totalHours / uniqueDatesCount).toFixed(1)) : 0;
    const uniqueProjectsCount = new Set(userLogs.map(e => e.project_name)).size;

    // 2. Work Type Breakdown (Pie Chart)
    const typeBreakdown: Record<string, number> = {};
    userLogs.forEach(log => {
      const type = getTableType(log.project_type);
      typeBreakdown[type] = (typeBreakdown[type] || 0) + log.total_hours;
    });
    const pieData = Object.entries(typeBreakdown).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(1))
    }));

    // 3. Project Effort Breakdown
    const projectEffort: Record<string, number> = {};
    userLogs.forEach(log => {
      projectEffort[log.project_name] = (projectEffort[log.project_name] || 0) + log.total_hours;
    });
    const projectData = Object.entries(projectEffort)
      .map(([name, hours]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, hours: parseFloat(hours.toFixed(1)) }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    // 4. Normal vs OT Split Data
    const otSplitData = [
      { name: 'Normal Hours', value: parseFloat(normalHours.toFixed(1)), percentage: totalHours > 0 ? parseFloat(((normalHours / totalHours) * 100).toFixed(1)) : 0 },
      { name: 'Overtime Hours', value: parseFloat(otHours.toFixed(1)), percentage: totalHours > 0 ? parseFloat(((otHours / totalHours) * 100).toFixed(1)) : 0 }
    ];

    // 5. Weekly Trend (8 weeks) vs Team Average
    const weeksList: string[] = [];
    const today = new Date();
    const currentSunday = new Date(today);
    currentSunday.setDate(today.getDate() - today.getDay());
    
    for (let i = 7; i >= 0; i--) {
      const d = new Date(currentSunday);
      d.setDate(currentSunday.getDate() - i * 7);
      weeksList.push(d.toISOString().split('T')[0]);
    }

    const formatDateLabel = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const weeklyTrendData = weeksList.map(weekStr => {
      const weekStartStr = weekStr;
      const weekStart = new Date(weekStr);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const userWeekLogs = userLogs.filter(e => e.work_date >= weekStartStr && e.work_date <= weekEndStr);
      const userWeekHours = userWeekLogs.reduce((sum, e) => sum + e.total_hours, 0);

      const teamWeekLogs = filteredAllEntries.filter(e => e.work_date >= weekStartStr && e.work_date <= weekEndStr);
      const totalWeekHours = teamWeekLogs.reduce((sum, e) => sum + e.total_hours, 0);
      const weekUsers = new Set(teamWeekLogs.map(e => e.user_id)).size || 1;
      const teamAvg = totalWeekHours / weekUsers;

      return {
        label: `${formatDateLabel(weekStartStr)}`,
        User: parseFloat(userWeekHours.toFixed(1)),
        TeamAvg: parseFloat(teamAvg.toFixed(1))
      };
    });

    // 6. Hours by Business Unit (BU)
    const buMap: Record<string, number> = {};
    userLogs.forEach(log => {
      const bu = (log.bu || 'Unassigned').trim();
      buMap[bu] = (buMap[bu] || 0) + log.total_hours;
    });
    const buDistributionData = Object.entries(buMap)
      .map(([name, hours]) => ({
        name,
        hours: parseFloat(hours.toFixed(1)),
        percentage: totalHours > 0 ? parseFloat(((hours / totalHours) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    // 7. Hours by Customer Dept
    const deptMap: Record<string, number> = {};
    userLogs.forEach(log => {
      const dept = (log.department || 'Unassigned').trim();
      deptMap[dept] = (deptMap[dept] || 0) + log.total_hours;
    });
    const deptDistributionData = Object.entries(deptMap)
      .map(([name, hours]) => ({
        name,
        hours: parseFloat(hours.toFixed(1)),
        percentage: totalHours > 0 ? parseFloat(((hours / totalHours) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    // 8. Top Actions Data
    const actionMap: Record<string, number> = {};
    userLogs.forEach(log => {
      const action = (log.action_name || 'Unspecified Action').trim();
      actionMap[action] = (actionMap[action] || 0) + log.total_hours;
    });
    const topActionsData = Object.entries(actionMap)
      .map(([name, hours]) => ({
        name: name.length > 28 ? name.substring(0, 28) + '...' : name,
        hours: parseFloat(hours.toFixed(1)),
        percentage: totalHours > 0 ? parseFloat(((hours / totalHours) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    // 9. Monthly Comparison Data (Normal vs OT comparison by month)
    const monthlyMap: Record<string, { month: string; Normal: number; OT: number }> = {};
    Object.values(dailyMap).forEach(day => {
      const monthStr = day.date.substring(0, 7); // YYYY-MM
      if (!monthlyMap[monthStr]) {
        monthlyMap[monthStr] = { month: monthStr, Normal: 0, OT: 0 };
      }
      monthlyMap[monthStr].Normal += day.Normal;
      monthlyMap[monthStr].OT += day.OT;
    });
    const formatMonthLabel = (monthStr: string) => {
      const [year, month] = monthStr.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };
    const monthlyComparisonData = Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => {
        const total = m.Normal + m.OT;
        return {
          month: m.month,
          monthLabel: formatMonthLabel(m.month),
          Normal: parseFloat(m.Normal.toFixed(1)),
          OT: parseFloat(m.OT.toFixed(1)),
          NormalPercent: total > 0 ? parseFloat(((m.Normal / total) * 100).toFixed(0)) : 0,
          OTPercent: total > 0 ? parseFloat(((m.OT / total) * 100).toFixed(0)) : 0
        };
      });

    // Gather unique BUs from all logs, sorted by total hours for the Radar Chart
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
      radarData,
      otSplitData,
      weeklyTrendData,
      dailyHoursData,
      buDistributionData,
      deptDistributionData,
      topActionsData,
      monthlyComparisonData
    };
  }, [selectedUser, filteredAllEntries, usersList]);

  // Color arrays for Pie cells
  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
  const GRADIENT_LIST = [
    'from-indigo-500 to-indigo-600 shadow-indigo-500/20',
    'from-emerald-500 to-teal-500 shadow-emerald-500/20',
    'from-amber-500 to-orange-500 shadow-amber-500/20',
    'from-rose-500 to-pink-500 shadow-rose-500/20',
    'from-cyan-500 to-blue-500 shadow-cyan-500/20',
    'from-purple-500 to-fuchsia-500 shadow-purple-500/20',
    'from-teal-500 to-cyan-500 shadow-teal-500/20',
    'from-violet-500 to-indigo-500 shadow-violet-500/20'
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-theme-text tracking-tight theme-heading-gradient">
              Performance & Work Reports
            </h1>
            <p className="text-sm text-theme-text-secondary mt-1.5 leading-relaxed">
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
        <div className="flex bg-theme-surface-tertiary/60 p-1 border border-theme-border/50 rounded-2xl max-w-lg shadow-inner">
          <button
            onClick={() => setActiveTab('personal')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all",
              activeTab === 'personal'
                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20 border border-indigo-400/20"
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary/40"
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
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary/40"
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
                : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-tertiary/40"
            )}
          >
            <UserIcon size={15} />
            Individual Analytics
          </button>
        </div>

        {/* Shared Filters Toolbar */}
        <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Project Name Search (Disabled on Overview) */}
          <div className="flex flex-col">
            <label className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-2">Project Name</label>
            <div className="relative">
              <input 
                type="text" 
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 pl-10 pr-4 text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-xs font-semibold"
              />
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" />
            </div>
          </div>

          {/* Date range filter */}
          <div className="flex flex-col">
            <label className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-2">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs font-semibold"
            >
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="all-time">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Type filter */}
          <div className="flex flex-col">
            <label className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-2">Activity Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-theme-surface-secondary border border-theme-border rounded-xl py-2.5 px-4 text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs font-semibold"
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
              <label className="text-xs font-bold text-amber-400/80 uppercase tracking-widest mb-2 flex items-center gap-1">
                Admin: Target User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-theme-surface-secondary border border-amber-700/50 rounded-xl py-2.5 px-4 text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer text-xs font-semibold"
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
                <label className="text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1">Start</label>
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-theme-surface-secondary border border-theme-border rounded-lg py-1.5 px-2 text-[10px] text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-theme-text-secondary uppercase tracking-wider mb-1">End</label>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-theme-surface-secondary border border-theme-border rounded-lg py-1.5 px-2 text-[10px] text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-end">
              <span className="text-[10px] text-theme-text-muted font-bold font-mono pb-2 text-center md:text-left">
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
            <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl shadow-xl overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center animate-pulse flex flex-col gap-4">
                  <div className="h-6 w-full bg-theme-surface-tertiary dark:bg-slate-800 rounded"></div>
                  <div className="h-6 w-full bg-theme-surface-tertiary dark:bg-slate-800 rounded"></div>
                  <div className="h-6 w-full bg-theme-surface-tertiary dark:bg-slate-800 rounded"></div>
                </div>
              ) : filteredPersonalEntries.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-theme-surface-tertiary dark:bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 shadow-inner">
                    <Search size={24} />
                  </div>
                  <h3 className="text-theme-text font-bold tracking-tight">No entries discovered</h3>
                  <p className="text-xs text-theme-text-secondary max-w-xs leading-relaxed">
                    Try clearing search inputs or setting a broader date range boundary.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-xs text-theme-text-secondary bg-theme-surface-secondary/50 uppercase tracking-widest border-b border-theme-border/50">
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
                                onClick={() => handleOpenViewModal(e)}
                                className={cn(
                                  "hover:bg-slate-700/30 cursor-pointer transition-colors duration-150 font-medium bg-theme-surface-tertiary/10 border-b border-theme-border/40",
                                  isExpanded && "bg-theme-surface-tertiary dark:bg-slate-800/40"
                                )}
                              >
                                <td className="px-6 py-4 font-mono text-indigo-300">
                                  <div className="font-bold">{e.work_date}</div>
                                  {e.start_time && e.end_time && (
                                    <div className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">
                                      {e.start_time.slice(0, 5)} → {e.end_time.slice(0, 5)}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-theme-text-secondary">{e.holding}</td>
                                <td className="px-6 py-4 font-bold text-theme-text max-w-[200px] truncate">{e.project_name}</td>
                                <td className="px-6 py-4 text-theme-text-secondary">{e.action_name}</td>
                                <td className="px-6 py-4 font-bold font-mono text-indigo-200">
                                  {e.total_hours.toFixed(1)}h
                                  {(e.is_ot || e.is_implied_ot) && (
                                    <span className="ml-1.5 px-1 py-0.5 text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded">OT</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn("px-2.5 py-1 text-[10px] font-bold rounded-lg border", typeColors[cat])}>
                                    {cat}
                                  </span>
                                </td>
                                <td 
                                  className="px-6 py-4 text-right"
                                  onClick={(evt) => {
                                    evt.stopPropagation();
                                    toggleRow(e.id);
                                  }}
                                >
                                  <button className="text-theme-text-secondary hover:text-theme-text p-1 rounded transition-colors">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-theme-surface-secondary/40" onClick={(evt) => evt.stopPropagation()}>
                                  <td colSpan={7} className="px-8 py-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                          <span className="text-slate-500 block uppercase font-bold text-[11px] tracking-wider mb-0.5">Holding BU</span>
                                          <span className="text-theme-text font-semibold font-mono">{e.holding}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500 block uppercase font-bold text-[11px] tracking-wider mb-0.5">Role Operator</span>
                                          <span className="text-theme-text font-semibold">{e.department_operator}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500 block uppercase font-bold text-[11px] tracking-wider mb-0.5">Project Type</span>
                                          <span className="text-theme-text font-semibold">{e.project_type}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500 block uppercase font-bold text-[11px] tracking-wider mb-0.5">Created At</span>
                                          <span className="text-theme-text font-semibold font-mono">{new Date(e.created_at).toLocaleString()}</span>
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-xs text-slate-500 uppercase font-bold font-mono block mb-1">Work Description</span>
                                        <p className="text-xs text-theme-text-secondary bg-theme-surface-tertiary/60 p-4 rounded-xl border border-theme-border/50 leading-relaxed italic">
                                          {e.description ? `"${e.description}"` : 'No custom description provided.'}
                                        </p>
                                        <div className="mt-3 flex justify-end gap-2">
                                          <button
                                            onClick={(evt) => {
                                              evt.stopPropagation();
                                              handleOpenViewModal(e);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#334155]/80 border border-slate-600/50 hover:bg-slate-700 text-theme-text font-bold text-xs rounded-xl transition-all"
                                          >
                                            <Eye size={12} />
                                            <span>เปิดใบงาน (Open)</span>
                                          </button>
                                          {/* Only show Edit button for the log owner */}
                                          {sessionUser && e.user_id === sessionUser.id && (
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
                                          )}
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
                    <div className="px-6 py-4 bg-theme-surface-secondary/40 border-t border-theme-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <span className="text-xs text-theme-text-secondary font-medium font-mono">
                        Showing {((currentPage - 1) * entriesPerPage) + 1} - {Math.min(currentPage * entriesPerPage, filteredPersonalEntries.length)} of {filteredPersonalEntries.length} entries
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="px-3 py-1.5 bg-theme-surface-tertiary border border-theme-border/50 hover:border-theme-border-strong disabled:opacity-40 disabled:cursor-not-allowed text-xs text-theme-text-secondary font-bold rounded-lg transition-all"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => {
                          const page = i + 1;
                          if (totalPages > 6 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                            if (page === 2 && currentPage > 3) return <span key={page} className="text-theme-text-muted text-xs px-1 select-none font-mono">...</span>;
                            if (page === totalPages - 1 && currentPage < totalPages - 2) return <span key={page} className="text-theme-text-muted text-xs px-1 select-none font-mono">...</span>;
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
                                  : "bg-transparent text-theme-text-secondary border-transparent hover:text-theme-text hover:bg-theme-surface-tertiary"
                              )}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          className="px-3 py-1.5 bg-theme-surface-tertiary border border-theme-border/50 hover:border-theme-border-strong disabled:opacity-40 disabled:cursor-not-allowed text-xs text-theme-text-secondary font-bold rounded-lg transition-all"
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
        {/* TAB 2: MANAGEMENT OVERVIEW (IMP VS IT COMPARISON) */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (() => {
          const impStyle = { border: 'border-blue-500/20', hover: 'hover:border-blue-500/30', bgGlow: 'bg-blue-500/5', hoverBg: 'group-hover:bg-blue-500/10', dot: 'bg-blue-500', badgeText: 'text-blue-400', badgeBg: 'bg-blue-500/10', badgeBorder: 'border-blue-500/20', barBg: 'bg-blue-500', stroke: '#3b82f6' };
          const itStyle = { border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/30', bgGlow: 'bg-emerald-500/5', hoverBg: 'group-hover:bg-emerald-500/10', dot: 'bg-emerald-500', badgeText: 'text-emerald-400', badgeBg: 'bg-emerald-500/10', badgeBorder: 'border-emerald-500/20', barBg: 'bg-emerald-500', stroke: '#10b981' };

          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Dual Stacked Bar Charts for Daily Hours Trend - MOVED TO TOP */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hours Trend IMP */}
                <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-indigo-500/10 hover:border-indigo-500/20 rounded-3xl p-6 shadow-xl transition-all h-full">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="text-indigo-400" size={18} />
                      <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider">📈 Hours Trend (IMP)</h3>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    {overviewData.impTrend.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No trend data available for IMP.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={overviewData.impTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="dateDisplay" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} 
                            labelClassName="text-theme-text-secondary font-bold font-mono text-[10px]"
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                          <Bar name="Normal" dataKey="Normal" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                          <Bar name="OT" dataKey="OT" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Hours Trend IT */}
                <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-violet-500/10 hover:border-violet-500/20 rounded-3xl p-6 shadow-xl transition-all h-full">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="text-emerald-400" size={18} />
                      <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider">📈 Hours Trend (IT)</h3>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    {overviewData.itTrend.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No trend data available for IT.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={overviewData.itTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="dateDisplay" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} 
                            labelClassName="text-theme-text-secondary font-bold font-mono text-[10px]"
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                          <Bar name="Normal" dataKey="Normal" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                          <Bar name="OT" dataKey="OT" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Comparative Operator Groups Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* IMP Group summary */}
                <div className={`bg-theme-surface-tertiary/80 backdrop-blur-xl border ${impStyle.border} ${impStyle.hover} rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full flex flex-col`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 ${impStyle.bgGlow} rounded-full blur-3xl pointer-events-none ${impStyle.hoverBg} transition-colors`}></div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <span className={`w-3.5 h-3.5 rounded-full ${impStyle.dot} animate-pulse`}></span>
                      <h2 className="text-xl font-black text-theme-text tracking-tight uppercase">IMP Group (IMP)</h2>
                    </div>
                    <span className={`text-[10px] font-bold ${impStyle.badgeBg} border ${impStyle.badgeBorder} ${impStyle.badgeText} px-3 py-1 rounded-full uppercase tracking-wider font-mono shrink-0`}>
                      {overviewData.imp.metrics.usersCount} Active {overviewData.imp.metrics.usersCount === 1 ? 'User' : 'Users'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-theme-surface-secondary/50 border border-theme-border/40 rounded-2xl p-4 shadow-inner">
                      <span className="text-[10px] text-theme-text-secondary font-bold uppercase tracking-wider block mb-1">Total Effort Hours</span>
                      <span className="text-3xl font-black text-theme-text tracking-tight font-mono">{overviewData.imp.metrics.totalHours.toFixed(1)}h</span>
                    </div>
                    <div className="bg-theme-surface-secondary/50 border border-theme-border/40 rounded-2xl p-4 shadow-inner">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">Overtime Logged</span>
                      <span className="text-3xl font-black text-amber-400 tracking-tight font-mono">{overviewData.imp.metrics.otHours.toFixed(1)}h</span>
                    </div>
                  </div>

                  {/* Top Projects */}
                  <div className="mt-6 space-y-3 flex-1">
                    <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest">🏆 Top IMP Projects</h3>
                    {overviewData.imp.projects.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block">No records logged in IMP group.</span>
                    ) : (
                      <div className="space-y-3">
                        {overviewData.imp.projects.map((p, pIdx) => (
                          <div key={pIdx} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-theme-text-secondary font-bold truncate max-w-[200px]">{p.name}</span>
                              <span className={`${impStyle.badgeText} font-bold font-mono`}>{p.hours.toFixed(1)}h ({p.percentage}%)</span>
                            </div>
                            <div className="w-full bg-theme-surface-secondary h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`${impStyle.barBg} h-full rounded-full`} 
                                style={{ width: `${p.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* IT Group summary */}
                <div className={`bg-theme-surface-tertiary/80 backdrop-blur-xl border ${itStyle.border} ${itStyle.hover} rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full flex flex-col`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 ${itStyle.bgGlow} rounded-full blur-3xl pointer-events-none ${itStyle.hoverBg} transition-colors`}></div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <span className={`w-3.5 h-3.5 rounded-full ${itStyle.dot} animate-pulse`}></span>
                      <h2 className="text-xl font-black text-theme-text tracking-tight uppercase">IT Group (IT)</h2>
                    </div>
                    <span className={`text-[10px] font-bold ${itStyle.badgeBg} border ${itStyle.badgeBorder} ${itStyle.badgeText} px-3 py-1 rounded-full uppercase tracking-wider font-mono shrink-0`}>
                      {overviewData.it.metrics.usersCount} Active {overviewData.it.metrics.usersCount === 1 ? 'User' : 'Users'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-theme-surface-secondary/50 border border-theme-border/40 rounded-2xl p-4 shadow-inner">
                      <span className="text-[10px] text-theme-text-secondary font-bold uppercase tracking-wider block mb-1">Total Effort Hours</span>
                      <span className="text-3xl font-black text-theme-text tracking-tight font-mono">{overviewData.it.metrics.totalHours.toFixed(1)}h</span>
                    </div>
                    <div className="bg-theme-surface-secondary/50 border border-theme-border/40 rounded-2xl p-4 shadow-inner">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">Overtime Logged</span>
                      <span className="text-3xl font-black text-amber-400 tracking-tight font-mono">{overviewData.it.metrics.otHours.toFixed(1)}h</span>
                    </div>
                  </div>

                  {/* Top Projects */}
                  <div className="mt-6 space-y-3 flex-1">
                    <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest">🏆 Top IT Projects</h3>
                    {overviewData.it.projects.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block">No records logged in IT group.</span>
                    ) : (
                      <div className="space-y-3">
                        {overviewData.it.projects.map((p, pIdx) => (
                          <div key={pIdx} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-theme-text-secondary font-bold truncate max-w-[200px]">{p.name}</span>
                              <span className={`${itStyle.badgeText} font-bold font-mono`}>{p.hours.toFixed(1)}h ({p.percentage}%)</span>
                            </div>
                            <div className="w-full bg-theme-surface-secondary h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`${itStyle.barBg} h-full rounded-full`} 
                                style={{ width: `${p.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* BU Distribution Comparative Row */}
              <div className="space-y-6">
                <div className="flex items-center gap-2.5 px-2">
                  <div className="w-2.5 h-6 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.5)]"></div>
                  <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider">🏢 Business Unit (BU) Distribution</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* BU Distribution IMP */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-indigo-500/10 hover:border-indigo-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6">🏢 Business Unit (BU) Distribution IMP</h3>
                    {overviewData.impBuBreakdown.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-4 text-center">No Business Unit records found.</span>
                    ) : (
                      <div className="space-y-3.5">
                        {overviewData.impBuBreakdown.map((item) => (
                          <div key={item.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-theme-text font-bold truncate max-w-[200px]">{item.name}</span>
                              <span className="text-indigo-400 font-bold font-mono">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-theme-surface-secondary h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-full rounded-full" 
                                style={{ width: `${item.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BU Distribution IT */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-violet-500/10 hover:border-violet-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full">
                    <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-6">🏢 Business Unit (BU) Distribution IT</h3>
                    {overviewData.itBuBreakdown.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-4 text-center">No Business Unit records found.</span>
                    ) : (
                      <div className="space-y-3.5">
                        {overviewData.itBuBreakdown.map((item) => (
                          <div key={item.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-theme-text font-bold truncate max-w-[200px]">{item.name}</span>
                              <span className="text-violet-400 font-bold font-mono">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-theme-surface-secondary h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-violet-500 h-full rounded-full" 
                                style={{ width: `${item.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Department Operator Distribution Comparative Row */}
              <div className="space-y-6">
                <div className="flex items-center gap-2.5 px-2">
                  <div className="w-2.5 h-6 bg-violet-500 rounded-full shadow-[0_0_12px_rgba(139,92,246,0.5)]"></div>
                  <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider">🛠️ Department Operator Support</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Department Operator Distribution IMP */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-indigo-500/10 hover:border-indigo-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6">🛠️ Department Operator Distribution IMP</h3>
                    {overviewData.impDeptBreakdown.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-4 text-center">No Department records found.</span>
                    ) : (
                      <div className="space-y-3.5">
                        {overviewData.impDeptBreakdown.map((item) => (
                          <div key={item.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-theme-text font-bold truncate max-w-[200px]">{item.name}</span>
                              <span className="text-indigo-400 font-bold font-mono">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-theme-surface-secondary h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-full rounded-full" 
                                style={{ width: `${item.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Department Operator Distribution IT */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-violet-500/10 hover:border-violet-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full">
                    <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-6">🛠️ Department Operator Distribution IT</h3>
                    {overviewData.itDeptBreakdown.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-4 text-center">No Department records found.</span>
                    ) : (
                      <div className="space-y-3.5">
                        {overviewData.itDeptBreakdown.map((item) => (
                          <div key={item.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-theme-text font-bold truncate max-w-[200px]">{item.name}</span>
                              <span className="text-violet-400 font-bold font-mono">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-theme-surface-secondary h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-violet-500 h-full rounded-full" 
                                style={{ width: `${item.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Overtime ranking leaderboard */}
              <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl max-w-2xl mx-auto">
                <div className="flex items-center gap-2.5 mb-6">
                  <Clock className="text-amber-400" size={18} />
                  <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider">⏰ Top Overtime (OT) Operators</h3>
                </div>
                <div className="space-y-4">
                  {overviewData.otLeaderboard.length === 0 ? (
                    <span className="text-xs text-slate-500 italic block text-center py-4">No overtime hours logged in selected range.</span>
                  ) : (
                    overviewData.otLeaderboard.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-theme-surface-secondary/50 border border-theme-border/40 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs font-mono border shadow-md",
                            idx === 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/5" :
                            idx === 1 ? "bg-slate-400/10 border-slate-400/30 text-theme-text-secondary" :
                            "bg-theme-surface-tertiary dark:bg-slate-800 border-slate-700 text-theme-text-secondary"
                          )}>
                            #{idx + 1}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-theme-text block">{item.name}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{item.dept} Department</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-black text-amber-400">{item.otHours.toFixed(1)}h OT</span>
                          <div className="w-16 bg-theme-surface-secondary h-2 rounded-full overflow-hidden">
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
            <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider">Select Teammate Profile</h3>
                  <p className="text-[10px] text-theme-text-secondary mt-0.5">Explore individual metrics, radar work grids, and BUs allocations.</p>
                </div>
              </div>
              
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-theme-surface-secondary border border-slate-700 rounded-xl py-2.5 px-6 text-xs text-theme-text focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold w-full sm:w-64 shadow-md"
              >
                {usersList.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.nickname || user.emp_id})
                  </option>
                ))}
              </select>
            </div>

                        {/* Sub-tab selection bar */}
            <div className="flex border-b border-theme-border/50 mt-6 mb-8">
              <button
                className="px-6 py-3 text-xs font-bold border-b-2 border-indigo-500 text-indigo-400 bg-indigo-500/5 transition-all duration-200 flex items-center gap-2 cursor-default"
              >
                <TrendingUp size={16} />
                <span>Performance Metrics & Charts</span>
              </button>
              <button
                onClick={() => navigate('/hrbp')}
                className="px-6 py-3 text-xs font-bold border-b-2 border-transparent text-theme-text-secondary hover:text-indigo-400 hover:bg-theme-surface-tertiary dark:hover:bg-slate-800/20 transition-all duration-200 flex items-center gap-2"
              >
                <Brain size={16} className="text-indigo-400 animate-pulse" />
                <span className="flex items-center gap-1.5">
                  AI Diagnostics (NEW)
                  <span className="px-1.5 py-0.5 text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full font-black uppercase tracking-wider">Try Now</span>
                </span>
              </button>
            </div>

            {/* Individual Profile & KPIs Grid */}
            {individualData && (
              <>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column Profile Card */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between items-center text-center relative overflow-hidden group">
                    <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                     <div className="w-20 h-20 rounded-full bg-theme-surface-tertiary dark:bg-slate-800 border-2 border-indigo-500/30 overflow-hidden ring-4 ring-indigo-500/10 shadow-lg flex items-center justify-center shrink-0 mb-4">
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
                      <h2 className="text-xl font-black text-theme-text tracking-tight">{individualData.user?.full_name}</h2>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-1 block">Emp ID: {individualData.user?.emp_id}</span>
                      <span className="mt-3 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold rounded-full text-[9px] uppercase tracking-wider inline-block">
                        {individualData.user?.department || 'IMP'} Department
                      </span>
                    </div>

                    <div className="w-full border-t border-theme-border/50 my-6 pt-6 grid grid-cols-2 gap-4 text-left">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">User Role</span>
                        <span className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">{individualData.user?.role || 'User'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Email Address</span>
                        <span className="text-xs font-bold text-theme-text-secondary truncate block max-w-[120px] font-mono">{individualData.user?.email || 'N/A'}</span>
                      </div>
                      <div className="col-span-2 border-t border-theme-border/60 pt-3 mt-1">
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Job Position</span>
                        <span className="text-xs font-bold text-indigo-300 truncate block">{individualData.user?.position || 'General Staff'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column KPIs Grid */}
                  <div className="lg:col-span-2 grid grid-cols-2 gap-6">
                    <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shrink-0"><Clock size={20} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-widest block mb-0.5">Total Hours Logged</span>
                        <span className="text-2xl font-black text-theme-text font-mono tracking-tight">{individualData.totalHours.toFixed(1)}h</span>
                      </div>
                    </div>

                    <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0"><Award size={20} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-widest block mb-0.5">Average Hours/Day</span>
                        <span className="text-2xl font-black text-theme-text font-mono tracking-tight">{individualData.avgHoursPerDay}h</span>
                      </div>
                    </div>

                    <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0"><Clock size={20} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-widest block mb-0.5">Overtime Rate</span>
                        <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">{individualData.otRate}%</span>
                      </div>
                    </div>

                    <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl shrink-0"><Layers size={20} /></div>
                      <div>
                        <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-widest block mb-0.5">Projects Contributed</span>
                        <span className="text-2xl font-black text-theme-text font-mono tracking-tight">{individualData.uniqueProjectsCount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. Daily Hours Trend with 8-Hour Baseline */}
                <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest">📅 Daily Logged Hours</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Daily effort showing Normal vs. Overtime hours with a red 8-hour workday standard baseline.</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5 text-theme-text-secondary">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#6366f1]"></div>
                        <span>Normal Hours</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-theme-text-secondary">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]"></div>
                        <span>Overtime</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-rose-400">
                        <div className="w-5 h-0.5 border-t-2 border-dashed border-rose-500"></div>
                        <span>8h Baseline</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    {individualData.dailyHoursData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No logging records found.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={individualData.dailyHoursData} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
                          <XAxis dataKey="dateDisplay" stroke="#64748b" fontSize={9} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={9} tickLine={false} unit="h" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                            formatter={(value: any, name: any) => [`${value}h`, name]}
                          />
                          <ReferenceLine y={8} stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" />
                          <Bar name="Normal Hours" dataKey="Normal" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                          <Bar name="Overtime" dataKey="OT" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* 2. Monthly Comparison & Weekly Trend Side-by-Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Monthly Comparison */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl">
                    <div className="mb-6">
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest font-bold">🗓️ Monthly Comparison</h3>
                      <p className="text-[10px] text-slate-500 mt-1 font-bold">Comparison of total logged hours (Normal vs OT) across active months.</p>
                    </div>
                    <div className="h-72 w-full">
                      {individualData.monthlyComparisonData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No monthly data logged.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={individualData.monthlyComparisonData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={9} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={9} tickLine={false} unit="h" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                              formatter={(value: any, name: any) => [`${value}h`, name]}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            <Bar name="Normal Hours" dataKey="Normal" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                            <Bar name="Overtime" dataKey="OT" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Weekly Trend vs Team Average */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl">
                    <div className="mb-6">
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest">📈 Weekly Trend vs Team Average</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Comparing user weekly hours to the team average over the last 8 weeks.</p>
                    </div>
                    <div className="h-72 w-full">
                      {individualData.weeklyTrendData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No weekly trend data available.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={individualData.weeklyTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="color-user-weekly" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="color-team-weekly" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="label" stroke="#64748b" fontSize={9} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={9} tickLine={false} unit="h" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} 
                              labelClassName="text-theme-text-secondary font-bold text-[10px]"
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            
                            <Area 
                              name="This User (Hours)"
                              type="monotone" 
                              dataKey="User" 
                              stroke="#6366f1" 
                              strokeWidth={2.5} 
                              fillOpacity={1} 
                              fill="url(#color-user-weekly)" 
                            />
                            <Area 
                              name="Team Average (Hours)"
                              type="monotone" 
                              dataKey="TeamAvg" 
                              stroke="#10b981" 
                              strokeWidth={2.5} 
                              fillOpacity={1} 
                              fill="url(#color-team-weekly)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Hours by BU & Hours by Customer Dept */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Hours by BU */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-6">🏢 Hours by Business Unit (BU)</h3>
                      <div className="space-y-4">
                        {individualData.buDistributionData.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-6 text-center">No BU allocation logged.</div>
                        ) : (
                          individualData.buDistributionData.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-theme-text-secondary">
                                <span className="truncate max-w-[240px]">{item.name}</span>
                                <span className="font-mono text-theme-text-secondary">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                              </div>
                              <div className="w-full bg-theme-surface-secondary h-2.5 rounded-full overflow-hidden border border-theme-border">
                                <div 
                                  className={cn(
                                    "bg-gradient-to-r h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]",
                                    GRADIENT_LIST[idx % GRADIENT_LIST.length]
                                  )}
                                  style={{ width: `${item.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hours by Customer Dept */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-6">🏬 Hours by Customer Department</h3>
                      <div className="space-y-4">
                        {individualData.deptDistributionData.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-6 text-center">No customer department hours logged.</div>
                        ) : (
                          individualData.deptDistributionData.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-theme-text-secondary">
                                <span className="truncate max-w-[240px]">{item.name}</span>
                                <span className="font-mono text-theme-text-secondary">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                              </div>
                              <div className="w-full bg-theme-surface-secondary h-2.5 rounded-full overflow-hidden border border-theme-border">
                                <div 
                                  className={cn(
                                    "bg-gradient-to-r h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]",
                                    GRADIENT_LIST[idx % GRADIENT_LIST.length]
                                  )}
                                  style={{ width: `${item.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Top Actions & Top Projects Side-by-Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Top Actions list */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-6">⚡ Top Actions by Effort</h3>
                      <div className="space-y-4">
                        {individualData.topActionsData.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-6 text-center">No action details logged.</div>
                        ) : (
                          individualData.topActionsData.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-theme-text-secondary">
                                <span className="truncate max-w-[240px]">{item.name}</span>
                                <span className="font-mono text-theme-text-secondary">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                              </div>
                              <div className="w-full bg-theme-surface-secondary h-2.5 rounded-full overflow-hidden border border-theme-border">
                                <div 
                                  className={cn(
                                    "bg-gradient-to-r h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]",
                                    GRADIENT_LIST[idx % GRADIENT_LIST.length]
                                  )}
                                  style={{ width: `${item.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top 5 Projects by Contributed Hours */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-6">🏆 Top 5 Projects by Contributed Hours</h3>
                      <div className="h-72 w-full">
                        {individualData.projectData.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No project data logged.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={individualData.projectData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                              <YAxis stroke="#64748b" fontSize={9} tickLine={false} unit="h" />
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
                  </div>
                </div>

                {/* 5. Donut, Work Type & Radar Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Normal vs Overtime Split Donut Chart */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-6">📊 Normal vs. OT Split</h3>
                      <div className="h-56 w-full flex items-center justify-center relative">
                        {individualData.otSplitData[0].value === 0 && individualData.otSplitData[1].value === 0 ? (
                          <div className="text-xs text-slate-500 italic">No hours logged.</div>
                        ) : (
                          <>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={individualData.otSplitData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={55}
                                  outerRadius={75}
                                  paddingAngle={4}
                                  dataKey="value"
                                >
                                  <Cell fill="#6366f1" />
                                  <Cell fill="#f59e0b" />
                                </Pie>
                                <Tooltip 
                                   contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                   formatter={(value: any, name: any, props: any) => [
                                     `${value}h (${props.payload.percentage}%)`,
                                     name
                                   ]}
                                 />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Centered Total Hours Info */}
                            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total</span>
                              <span className="text-xl font-black text-theme-text font-mono">{individualData.totalHours.toFixed(1)}h</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Visual Custom Legend below */}
                    <div className="flex justify-around items-center border-t border-theme-border/30 pt-4 mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-lg bg-[#6366f1] shadow-md shadow-indigo-500/20"></div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-theme-text-secondary font-bold">Normal</span>
                          <span className="text-[10px] font-bold text-theme-text font-mono">{individualData.otSplitData[0].value}h ({individualData.otSplitData[0].percentage}%)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-lg bg-[#f59e0b] shadow-md shadow-amber-500/20"></div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-theme-text-secondary font-bold">OT</span>
                          <span className="text-[10px] font-bold text-amber-400 font-mono">{individualData.otSplitData[1].value}h ({individualData.otSplitData[1].percentage}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work Type Pie Chart */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-6">🎯 Work Type Ratio</h3>
                      <div className="h-56 w-full flex items-center justify-center">
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
                                  innerRadius={50}
                                  outerRadius={70}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {individualData.pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Radar Chart (Teammate vs Team Avg in BUs) */}
                  <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-theme-text-secondary uppercase tracking-widest mb-6">🕸️ BU Allocation Map</h3>
                      <div className="h-56 w-full">
                        {individualData.radarData.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No allocation data.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="60%" data={individualData.radarData}>
                              <PolarGrid stroke="#334155" />
                              <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={8} />
                              <PolarRadiusAxis stroke="#334155" fontSize={7} />
                              <Radar name="This User" dataKey="User" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                              <Radar name="Team Avg" dataKey="TeamAvg" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                              <Legend wrapperStyle={{ fontSize: '8px', fontWeight: 'bold' }} />
                            </RadarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
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

      {/* View Worklog Modal */}
      <ViewWorklogModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedLogForView(null);
        }}
        log={selectedLogForView}
        onDeleteSuccess={loadData}
      />
    </AppLayout>
  );
}

function ReportKpi({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-theme-surface-tertiary/80 backdrop-blur-xl border border-theme-border/50 rounded-2xl p-5 shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-0.5 duration-200">
      <div className="p-3 rounded-xl bg-theme-surface-secondary/50 border border-theme-border/50 shrink-0">
        {icon}
      </div>
      <div>
        <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-wider block mb-0.5">{title}</span>
        <span className="text-2xl font-extrabold text-theme-text tracking-tight font-mono">{value}</span>
      </div>
    </div>
  );
}
