import { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  User as UserIcon, Sparkles, AlertTriangle, Activity, 
  FileText, CheckCircle2, Target, PlusCircle, Save, Loader2, 
  Globe, Lock, Printer, Copy, X, UserCheck, 
  ChevronRight, ArrowRight, ArrowLeft, Terminal, Cpu, Award, 
  Check, Info, Trash2, Calendar, FileSpreadsheet, TrendingUp, Clock, RefreshCw
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

interface UserProfile {
  id: string;
  emp_id: string;
  full_name: string;
  nickname: string | null;
  email: string | null;
  role: string;
  department: string;
  position?: string;
  employee_level?: string;
  role_start_date?: string;
  manager_name?: string;
}

interface KeyResponsibility {
  category: string;
  weight: number;
}

export default function HrbpPage() {
  const { showToast } = useNotification();
  const navigate = useNavigate();

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
  
  // App Session
  const [sessionUser, setSessionUser] = useState<any>(null);

  // Core Wizard Steps
  // 1 = Setup, 2 = Console (Running Diagnostics), 3 = Results
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // States
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customPosition, setCustomPosition] = useState<string>('');
  
  // Job Description Config
  const [jdText, setJdText] = useState<string>('');
  const [keyResponsibilities, setKeyResponsibilities] = useState<KeyResponsibility[]>([]);
  const [jdSource, setJdSource] = useState<string>('manual_entry');
  const [isSavingJd, setIsSavingJd] = useState<boolean>(false);
  const [isRecommendingJd, setIsRecommendingJd] = useState<boolean>(false);

  // Date Filters
  const [dateFilter, setDateFilter] = useState<'this-week' | 'this-month' | 'this-quarter' | 'this-year' | 'quarters'>('this-month');
  const [selectedQuarters, setSelectedQuarters] = useState<number[]>([Math.floor(new Date().getMonth() / 3) + 1]);

  // Diagnostic Logs & Progress
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiStep, setAiStep] = useState<number>(1);
  const [aiStepLogs, setAiStepLogs] = useState<{ time: string; message: string; type: 'info' | 'success' | 'error' }[]>([]);
  const [aiModel, setAiModel] = useState<string>('');
  const [aiProvider, setAiProvider] = useState<string>('');

  // Results & History
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [activeResultsSubTab, setActiveResultsSubTab] = useState<'summary' | 'gaps' | 'coaching' | 'logs' | 'history'>('summary');
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [showAckModal, setShowAckModal] = useState<boolean>(false);
  const [isSubmittingAck, setIsSubmittingAck] = useState<boolean>(false);

  // New weight input states
  const [newCatName, setNewCatName] = useState('');
  const [newCatWeight, setNewCatWeight] = useState<number>(10);

  // AI Prompt Template & Custom Overrides
  const [templateId, setTemplateId] = useState<string>('master');
  const [templatesList, setTemplatesList] = useState<any[]>([
    {
      template_key: 'master',
      name: 'HRBP Diagnostics (Standard)',
      icon: '📊',
      description: 'การวิเคราะห์มาตรฐาน: JD Alignment, Burnout Risk, Workload Allocation เหมาะสำหรับการมอนิเตอร์และรีพอร์ตทั่วไป'
    },
    {
      template_key: 'individual_coach',
      name: 'Executive Coach (5-Lens & 1:1 Guide)',
      icon: '🎯',
      description: 'วิเคราะห์เชิงลึก 5 มิติ: Value Mix, Work Style, Reflection และคำถาม Coaching 1:1 ไกด์นำทางสำหรับหัวหน้างาน'
    },
    {
      template_key: 'coaching_fairness',
      name: 'Coaching & Fairness Diagnostics',
      icon: '🤝',
      description: 'การประเมินแบบเข้าอกเข้าใจหน้างานจริง เน้นสะท้อนงานปฏิบัติงานและกลยุทธ์อย่างสมดุล (ภาษาไทยเป็นหลัก)'
    }
  ]);
  const [cadenceType, setCadenceType] = useState<'weekly' | 'monthly' | 'quarterly' | 'auto'>('auto');
  const [employeeLevel, setEmployeeLevel] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');

  // Delete history record states
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState<boolean>(false);

  // View mode for 5-Lens Dashboard
  const [viewMode, setViewMode] = useState<'manager' | 'employee'>('manager');

  useEffect(() => {
    if (viewMode === 'employee' && (activeResultsSubTab === 'coaching' || activeResultsSubTab === 'well_being' as any)) {
      setActiveResultsSubTab('summary');
    }
  }, [viewMode, activeResultsSubTab]);


  const selectedUserInfo = useMemo(() => {
    return usersList.find(u => u.id === selectedUser);
  }, [usersList, selectedUser]);

  useEffect(() => {
    if (selectedUserInfo) {
      setEmployeeLevel(selectedUserInfo.employee_level || 'Senior');
      setManagerName(selectedUserInfo.manager_name || '');
    }
  }, [selectedUserInfo]);

  // Shared View / Public Share Link
  const [isSharedView, setIsSharedView] = useState<boolean>(false);

  // Target YYYY-MM-DD
  const formatDateToYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

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
    const refDate = new Date();
    const firstDay = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // This Quarter (Q1, Q2, Q3, Q4)
    const currentMonth = refDate.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    const firstDayOfQuarter = new Date(refDate.getFullYear(), quarterStartMonth, 1);
    const lastDayOfQuarter = new Date(refDate.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);

    // This Year
    const firstDayOfYear = new Date(refDate.getFullYear(), 0, 1);
    const lastDayOfYear = new Date(refDate.getFullYear(), 11, 31, 23, 59, 59, 999);

    return {
      week: {
        start: formatDateToYMD(monday),
        end: formatDateToYMD(sunday)
      },
      month: {
        start: formatDateToYMD(firstDay),
        end: formatDateToYMD(lastDay)
      },
      quarter: {
        start: formatDateToYMD(firstDayOfQuarter),
        end: formatDateToYMD(lastDayOfQuarter)
      },
      year: {
        start: formatDateToYMD(firstDayOfYear),
        end: formatDateToYMD(lastDayOfYear)
      }
    };
  }, []);

  const getQuartersDateRange = () => {
    if (selectedQuarters.length === 0) {
      return { start: dateBoundaries.month.start, end: dateBoundaries.month.end };
    }
    const currentYear = new Date().getFullYear();
    const sortedQs = [...selectedQuarters].sort((a, b) => a - b);
    const minQ = sortedQs[0];
    const maxQ = sortedQs[sortedQs.length - 1];

    let start = '';
    let end = '';

    if (minQ === 1) start = `${currentYear}-01-01`;
    else if (minQ === 2) start = `${currentYear}-04-01`;
    else if (minQ === 3) start = `${currentYear}-07-01`;
    else if (minQ === 4) start = `${currentYear}-10-01`;

    if (maxQ === 1) end = `${currentYear}-03-31`;
    else if (maxQ === 2) end = `${currentYear}-06-30`;
    else if (maxQ === 3) end = `${currentYear}-09-30`;
    else if (maxQ === 4) end = `${currentYear}-12-31`;

    return { start, end };
  };

  // Load Session and Initial Users
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const token = queryParams.get('share');
    const sessionStr = localStorage.getItem('worklog_session');
    
    if (!sessionStr && !token) {
      navigate('/login');
      return;
    }
    
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    if (session) {
      setSessionUser(session);
    }

    const loadData = async () => {
      try {
        setIsLoading(true);

        if (token) {
          setIsSharedView(true);
          setStep(3);
          await loadSharedReport(token);
          
          // Optionally load users for display, but swallow error if RLS blocks it (e.g. unauthenticated share viewer)
          try {
            const { data: usersData } = await supabase
              .from('users')
              .select('*')
              .order('full_name', { ascending: true });
            if (usersData) {
              setUsersList(usersData);
            }
          } catch (e) {
            console.log('Swallowed user list loading error in public shared view:', e);
          }
        } else {
          let userQuery = supabase
            .from('users')
            .select('*')
            .order('full_name', { ascending: true });

          if (session?.activeWorkspaceId) {
            userQuery = userQuery.eq('active_workspace_id', session.activeWorkspaceId);
          }

          const { data: usersData, error: usersErr } = await userQuery;

          if (usersErr) throw usersErr;
          setUsersList(usersData || []);

          if (usersData && usersData.length > 0 && session) {
            // Pre-select current user or first user
            const matchingUser = usersData.find((u: any) => u.id === session.id);
            setSelectedUser(matchingUser ? matchingUser.id : usersData[0].id);
          }
        }

        // Fetch AI prompt templates
        let templatesQuery = supabase
          .from('tb_ai_prompt_templates')
          .select('*')
          .eq('is_active', true);

        if (session?.activeWorkspaceId) {
          templatesQuery = templatesQuery.eq('workspace_id', session.activeWorkspaceId);
        } else {
          templatesQuery = templatesQuery.eq('workspace_id', 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001');
        }

        const { data: templatesData, error: templatesErr } = await templatesQuery.order('sort_order', { ascending: true });

        if (templatesErr) {
          console.warn('Failed to load templates from DB, using default static ones:', templatesErr);
        } else if (templatesData && templatesData.length > 0) {
          setTemplatesList(templatesData);
        }
      } catch (err: any) {
        console.error('Error loading initialization data:', err);
        showToast('ไม่สามารถดึงข้อมูลพนักงานได้: ' + err.message, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  // Clean up and Purge logic upon step changes or selectedUser updates
  // Prevents state leakage
  useEffect(() => {
    if (selectedUser && !isSharedView) {
      loadJdAndAnalysis();
    }
  }, [selectedUser, dateFilter, selectedQuarters, templateId]);

  // Load historical diagnostic entries
  const loadAnalysisHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const { data, error: err } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('user_id', selectedUser)
        .eq('template_id', templateId)
        .order('analysis_date', { ascending: false });

      if (err) throw err;
      setAnalysisHistory(data || []);
    } catch (err) {
      console.error('Error loading analysis history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadJdAndAnalysis = async () => {
    if (!selectedUser) return;
    
    let startDate = '';
    let endDate = '';
    
    if (dateFilter === 'this-week') {
      startDate = dateBoundaries.week.start;
      endDate = dateBoundaries.week.end;
    } else if (dateFilter === 'this-month') {
      startDate = dateBoundaries.month.start;
      endDate = dateBoundaries.month.end;
    } else if (dateFilter === 'this-quarter') {
      startDate = dateBoundaries.quarter.start;
      endDate = dateBoundaries.quarter.end;
    } else if (dateFilter === 'this-year') {
      startDate = dateBoundaries.year.start;
      endDate = dateBoundaries.year.end;
    } else if (dateFilter === 'quarters') {
      const qRange = getQuartersDateRange();
      startDate = qRange.start;
      endDate = qRange.end;
    } else {
      startDate = dateBoundaries.month.start;
      endDate = dateBoundaries.month.end;
    }

    try {
      // 1. Fetch JD
      const { data: jdData } = await supabase
        .from('tb_user_jd')
        .select('*')
        .eq('user_id', selectedUser)
        .maybeSingle();

      if (jdData) {
        setJdText(jdData.jd_text || '');
        setKeyResponsibilities(jdData.key_responsibilities || []);
        setJdSource(jdData.jd_source || 'manual_entry');
        setCustomPosition(jdData.position_name || '');
      } else {
        setJdText('');
        setKeyResponsibilities([]);
        setJdSource('manual_entry');
        const userObj = usersList.find(u => u.id === selectedUser);
        setCustomPosition(userObj?.position || '');
      }

      // 2. Fetch Cached AI Analysis (within last 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: cached } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('user_id', selectedUser)
        .eq('start_date', startDate)
        .eq('end_date', endDate)
        .eq('template_id', templateId)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const { data: logs } = await supabase
          .from('col_worklog')
          .select('total_hours')
          .eq('user_id', selectedUser)
          .gte('work_date', startDate)
          .lte('work_date', endDate);
        const totalHours = (logs || []).reduce((sum, e) => sum + Number(e.total_hours || 0), 0);

        setAiAnalysis({
          id: cached.id,
          share_token: cached.share_token,
          is_public: cached.is_public,
          acknowledged_at: cached.acknowledged_at,
          acknowledged_by: cached.acknowledged_by,
          template_id: cached.template_id,
          jd_alignment_score: cached.jd_alignment_score,
          burnout_risk_score: cached.burnout_risk_score,
          reflection_level: cached.reflection_level,
          value_mix: cached.value_mix,
          headline_insight: cached.headline_insight,
          coaching_guide: cached.coaching_guide,
          well_being_signal: cached.well_being_signal,
          message_to_employee: cached.message_to_employee,
          workload_allocation: cached.actual_vs_target,
          strengths: cached.strengths,
          improvements: cached.improvements,
          development_plan: cached.development_plan,
          markdown_executive_summary: cached.raw_ai_report,
          created_at: cached.created_at,
          isCached: true,
          model: cached.engine_model || 'Historical Cache',
          start_date: startDate,
          end_date: endDate,
          total_hours: totalHours,
          logs_count: logs?.length || 0,
          weights: jdData?.key_responsibilities || []
        });
      } else {
        setAiAnalysis(null);
      }

      loadAnalysisHistory();
    } catch (err) {
      console.error('Error fetching JD or analysis cache:', err);
    }
  };

  const loadSharedReport = async (token: string) => {
    try {
      setIsLoading(true);
      const { data: report, error: reportErr } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();

      if (reportErr) throw reportErr;
      if (!report) {
        showToast('ไม่พบรายงานที่แชร์ หรือหมดอายุ / Shared report not found or expired', 'error');
        setIsLoading(false);
        return;
      }

      if (report.expires_at && new Date(report.expires_at) < new Date()) {
        showToast('รายงานนี้หมดอายุการใช้งานแล้ว / Shared report expired', 'error');
        setIsLoading(false);
        return;
      }

      // Try fetching the specific user's details to populate metadata in results view
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', report.user_id)
          .maybeSingle();
        if (userData) {
          setSelectedUser(userData.id);
          setUsersList(prev => {
            if (prev.some(u => u.id === userData.id)) return prev;
            return [...prev, userData];
          });
        }
      } catch (userErr) {
        console.error('Swallowed user details fetch error in shared view:', userErr);
      }

      // Try fetching the user's JD details to show in the shared view
      try {
        const { data: jdData } = await supabase
          .from('tb_user_jd')
          .select('*')
          .eq('user_id', report.user_id)
          .maybeSingle();
        if (jdData) {
          setJdText(jdData.jd_text || '');
          setKeyResponsibilities(jdData.key_responsibilities || []);
          if (jdData.position_name) {
            setCustomPosition(jdData.position_name);
          }
        }
      } catch (jdErr) {
        console.error('Swallowed JD fetch error in shared view:', jdErr);
      }

      // Query work logs to compute total hours and logs count (wrapped in try-catch for unauthenticated users)
      let totalHours = 0;
      let logsCount = 0;
      try {
        const { data: logs } = await supabase
          .from('col_worklog')
          .select('total_hours')
          .eq('user_id', report.user_id)
          .gte('work_date', report.start_date)
          .lte('work_date', report.end_date);
        
        if (logs) {
          totalHours = logs.reduce((sum, e) => sum + Number(e.total_hours || 0), 0);
          logsCount = logs.length;
        }
      } catch (logsErr) {
        console.log('Skipping log metrics calculation in shared view (read-only):', logsErr);
      }

      setTemplateId(report.template_id || 'master');
      setViewMode('employee');

      setAiAnalysis({
        id: report.id,
        share_token: report.share_token,
        is_public: report.is_public,
        acknowledged_at: report.acknowledged_at,
        acknowledged_by: report.acknowledged_by,
        template_id: report.template_id,
        jd_alignment_score: report.jd_alignment_score,
        burnout_risk_score: report.burnout_risk_score,
        reflection_level: report.reflection_level,
        value_mix: report.value_mix,
        headline_insight: report.headline_insight,
        coaching_guide: report.coaching_guide,
        well_being_signal: report.well_being_signal,
        message_to_employee: report.message_to_employee,
        workload_allocation: report.actual_vs_target,
        strengths: report.strengths,
        improvements: report.improvements,
        development_plan: report.development_plan,
        markdown_executive_summary: report.raw_ai_report,
        created_at: report.created_at,
        isCached: true,
        model: report.engine_model || 'Historical Shared Record',
        start_date: report.start_date,
        end_date: report.end_date,
        total_hours: totalHours,
        logs_count: logsCount,
        weights: []
      });

      setActiveResultsSubTab('summary');
    } catch (err: any) {
      console.error('Error loading shared report:', err);
      showToast('ไม่สามารถดึงข้อมูลรายงานที่แชร์ได้: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoryRecord = async (record: any) => {
    try {
      const { data: logs } = await supabase
        .from('col_worklog')
        .select('total_hours')
        .eq('user_id', record.user_id)
        .gte('work_date', record.start_date)
        .lte('work_date', record.end_date);
      const totalHours = (logs || []).reduce((sum, e) => sum + Number(e.total_hours || 0), 0);

      setAiAnalysis({
        id: record.id,
        share_token: record.share_token,
        is_public: record.is_public,
        acknowledged_at: record.acknowledged_at,
        acknowledged_by: record.acknowledged_by,
        template_id: record.template_id,
        reflection_level: record.reflection_level,
        value_mix: record.value_mix,
        coaching_guide: record.coaching_guide,
        well_being_signal: record.well_being_signal,
        message_to_employee: record.message_to_employee,
        jd_alignment_score: record.jd_alignment_score,
        burnout_risk_score: record.burnout_risk_score,
        workload_allocation: record.actual_vs_target,
        strengths: record.strengths,
        improvements: record.improvements,
        development_plan: record.development_plan,
        markdown_executive_summary: record.raw_ai_report,
        created_at: record.created_at,
        isCached: true,
        model: record.engine_model || 'Historical Record',
        start_date: record.start_date,
        end_date: record.end_date,
        total_hours: totalHours,
        logs_count: logs?.length || 0,
        weights: keyResponsibilities
      });
      setActiveResultsSubTab('summary');
      showToast('โหลดผลวิเคราะห์ย้อนหลังสำเร็จ', 'success');
    } catch (err) {
      console.error('Error loading history record work logs:', err);
      setAiAnalysis({
        id: record.id,
        share_token: record.share_token,
        is_public: record.is_public,
        acknowledged_at: record.acknowledged_at,
        acknowledged_by: record.acknowledged_by,
        template_id: record.template_id,
        reflection_level: record.reflection_level,
        value_mix: record.value_mix,
        coaching_guide: record.coaching_guide,
        well_being_signal: record.well_being_signal,
        message_to_employee: record.message_to_employee,
        jd_alignment_score: record.jd_alignment_score,
        burnout_risk_score: record.burnout_risk_score,
        workload_allocation: record.actual_vs_target,
        strengths: record.strengths,
        improvements: record.improvements,
        development_plan: record.development_plan,
        markdown_executive_summary: record.raw_ai_report,
        created_at: record.created_at,
        isCached: true,
        model: record.engine_model || 'Historical Record',
        start_date: record.start_date,
        end_date: record.end_date,
        total_hours: null,
        logs_count: null,
        weights: keyResponsibilities
      });
      setActiveResultsSubTab('summary');
      showToast('โหลดผลวิเคราะห์ย้อนหลังสำเร็จ (ไม่มีข้อมูลชั่วโมงงาน)', 'warning');
    }
  };

  const handleDeleteRecord = async () => {
    if (!deleteRecordId) return;
    setIsDeletingRecord(true);
    try {
      const { error } = await supabase
        .from('tb_ai_individual_analysis')
        .delete()
        .eq('id', deleteRecordId);

      if (error) throw error;

      showToast('ลบประวัติการประเมินสำเร็จ', 'success');
      setAnalysisHistory(prev => prev.filter(r => r.id !== deleteRecordId));
      if (aiAnalysis?.id === deleteRecordId) {
        setAiAnalysis(null);
      }
    } catch (err: any) {
      console.error('Error deleting record:', err);
      showToast('ไม่สามารถลบประวัติการประเมินได้: ' + err.message, 'error');
    } finally {
      setIsDeletingRecord(false);
      setDeleteRecordId(null);
    }
  };


  // Recommendations: Pos + weights
  const recommendJd = async () => {
    const targetPos = customPosition || selectedUserInfo?.position || '';
    setIsRecommendingJd(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          action: 'recommend_jd',
          position: targetPos || 'General Staff',
          target_weights: keyResponsibilities,
        }
      });

      if (error) {
        let errMsg = error.message || 'AI recommendation failed';
        if (error.context && typeof error.context.clone === 'function') {
          try {
            const resClone = error.context.clone();
            const text = await resClone.text();
            try {
              const parsed = JSON.parse(text);
              if (parsed.error) errMsg = parsed.error;
              else if (parsed.message) errMsg = parsed.message;
            } catch {
              if (text && text.length < 150) errMsg = text;
            }
          } catch (e) {
            console.error('Failed to parse error response context:', e);
          }
        }
        throw new Error(errMsg);
      }

      if (data?.jd_text) setJdText(data.jd_text);
      if (data?.key_responsibilities?.length > 0) setKeyResponsibilities(data.key_responsibilities);
      setJdSource('ai_recommended');

      const engineLabel = data?.actualModel ? ` (${data.actualModel})` : '';
      showToast(`AI แนะนำ JD สำหรับตำแหน่ง "${targetPos || 'General Staff'}" เรียบร้อย${engineLabel}`, 'success');
    } catch (err: any) {
      console.error('JD recommend error:', err);
      showToast(err.message || 'ไม่สามารถขอคำแนะนำ JD จาก AI ได้', 'error');
    } finally {
      setIsRecommendingJd(false);
    }
  };

  const handleSaveJd = async () => {
    if (!selectedUser) return;
    setIsSavingJd(true);
    try {
      const totalWeight = keyResponsibilities.reduce((sum, item) => sum + item.weight, 0);
      if (keyResponsibilities.length > 0 && totalWeight !== 100) {
        showToast('Total responsibilities weight must equal exactly 100% (currently ' + totalWeight + '%)', 'warning');
        setIsSavingJd(false);
        return;
      }

      const { error } = await supabase
        .from('tb_user_jd')
        .upsert({
          user_id: selectedUser,
          jd_text: jdText,
          jd_source: jdSource,
          position_name: customPosition,
          key_responsibilities: keyResponsibilities,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      // Sync back to users table
      if (customPosition.trim()) {
        const { error: userError } = await supabase
          .from('users')
          .update({
            position: customPosition,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedUser);
        
        if (userError) {
          console.error('Error updating user position:', userError);
        } else {
          setUsersList(prev => prev.map(u => u.id === selectedUser ? { ...u, position: customPosition } : u));
        }
      }

      showToast('Job Description saved successfully', 'success');
    } catch (err: any) {
      console.error('Error saving JD:', err);
      showToast('Failed to save Job Description: ' + err.message, 'error');
    } finally {
      setIsSavingJd(false);
    }
  };

  const handleAddWeight = () => {
    if (!newCatName.trim()) {
      showToast('กรุณากรอกชื่อหัวข้อความรับผิดชอบ / Category name is required', 'warning');
      return;
    }
    const totalCurrent = keyResponsibilities.reduce((sum, r) => sum + r.weight, 0);
    if (totalCurrent + newCatWeight > 100) {
      showToast(`ไม่สามารถเพิ่มน้ำหนักได้: น้ำหนักรวมจะเกิน 100% (ปัจจุบัน ${totalCurrent}%)`, 'warning');
      return;
    }
    setKeyResponsibilities(prev => [...prev, { category: newCatName.trim(), weight: newCatWeight }]);
    setNewCatName('');
    setNewCatWeight(10);
  };

  const handleRemoveWeight = (index: number) => {
    setKeyResponsibilities(prev => prev.filter((_, i) => i !== index));
  };

  const handleWeightChange = (index: number, newWeight: number) => {
    setKeyResponsibilities(prev => prev.map((w, i) => i === index ? { ...w, weight: Math.max(0, Math.min(100, newWeight)) } : w));
  };

  const handleRunAiAnalysis = async (forceRefresh = false) => {
    if (!selectedUser) return;
    
    // Validate weights and Jd
    const totalWeight = keyResponsibilities.reduce((sum, item) => sum + item.weight, 0);
    if (!jdText.trim()) {
      showToast('กรุณาใส่ Job Description ก่อนวิเคราะห์', 'error');
      return;
    }
    if (totalWeight !== 100) {
      showToast(`สัดส่วนน้ำหนักเป้าหมาย (Target Weights) ต้องรวมกันได้ 100% (ปัจจุบันมี ${totalWeight}%)`, 'error');
      return;
    }

    let startDate = '';
    let endDate = '';
    
    if (dateFilter === 'this-week') {
      startDate = dateBoundaries.week.start;
      endDate = dateBoundaries.week.end;
    } else if (dateFilter === 'this-month') {
      startDate = dateBoundaries.month.start;
      endDate = dateBoundaries.month.end;
    } else if (dateFilter === 'this-quarter') {
      startDate = dateBoundaries.quarter.start;
      endDate = dateBoundaries.quarter.end;
    } else if (dateFilter === 'this-year') {
      startDate = dateBoundaries.year.start;
      endDate = dateBoundaries.year.end;
    } else if (dateFilter === 'quarters') {
      const qRange = getQuartersDateRange();
      startDate = qRange.start;
      endDate = qRange.end;
    } else {
      startDate = dateBoundaries.month.start;
      endDate = dateBoundaries.month.end;
    }

    // Advance to Console Step (Step 2)
    setStep(2);
    setIsAiAnalyzing(true);
    setAiStep(1);
    setAiStepLogs([
      { time: new Date().toLocaleTimeString(), message: 'Initiating AI Performance Diagnostics Engine...', type: 'info' },
      { time: new Date().toLocaleTimeString(), message: `Validating JD text & key weights: Total target = ${totalWeight}%`, type: 'info' }
    ]);

    try {
      // Step 2: Fetch worklogs from database
      await new Promise(r => setTimeout(r, 600));
      setAiStep(2);
      setAiStepLogs(prev => [
        ...prev, 
        { time: new Date().toLocaleTimeString(), message: `Querying worklogs for selected period: ${startDate} to ${endDate}`, type: 'info' }
      ]);
      
      const { data: logs, error: logsErr } = await supabase
        .from('col_worklog')
        .select('project_name, action_name, description, total_hours')
        .eq('user_id', selectedUser)
        .gte('work_date', startDate)
        .lte('work_date', endDate);
        
      if (logsErr) throw logsErr;
      
      const totalHours = (logs || []).reduce((sum, e) => sum + Number(e.total_hours || 0), 0);
      
      // Step 3: Compute actual vs target allocation
      await new Promise(r => setTimeout(r, 600));
      setAiStep(3);
      setAiStepLogs(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString(), message: `Found ${logs?.length || 0} worklog records totaling ${totalHours.toFixed(1)} effort hours.`, type: 'info' },
        { time: new Date().toLocaleTimeString(), message: 'Calculating actual task category distributions vs target weights.', type: 'info' }
      ]);
      
      // Step 4: Connecting to LLM API
      await new Promise(r => setTimeout(r, 600));
      setAiStep(4);
      
      // Look up system config
      const { data: configsData } = await supabase
        .from('tb_system_config')
        .select('config_key, config_value')
        .in('config_key', ['ai_model', 'ai_provider']);
        
      const configs: Record<string, string> = {};
      (configsData || []).forEach(row => { configs[row.config_key] = row.config_value; });

      const activeProvider = configs.ai_provider || 'openrouter';
      const activeModel = configs.ai_model || 'google/gemini-2.0-flash-exp:free';

      setAiProvider(activeProvider);
      setAiModel(activeModel);

      const providerDisplayNames: Record<string, string> = {
        openrouter: 'OpenRouter',
        opencode: 'OpenCode AI Engine',
        openai: 'OpenAI Cloud',
        gemini: 'Google Gemini'
      };

      const providerName = providerDisplayNames[activeProvider] || activeProvider;
      
      setAiStepLogs(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString(), message: `Connecting to ${providerName}: invoking model "${activeModel}"...`, type: 'info' }
      ]);

      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          user_id: selectedUser,
          start_date: startDate,
          end_date: endDate,
          force_refresh: forceRefresh,
          template_id: templateId,
          cadence_type: cadenceType === 'auto' ? undefined : cadenceType,
          employee_level: employeeLevel || undefined,
          manager_name: managerName || undefined
        }
      });

      if (error) {
        let errMsg = error.message || 'Failed to complete analysis';
        if (error.context && typeof error.context.clone === 'function') {
          try {
            const resClone = error.context.clone();
            const text = await resClone.text();
            try {
              const parsed = JSON.parse(text);
              if (parsed.error) errMsg = parsed.error;
              else if (parsed.message) errMsg = parsed.message;
            } catch {
              if (text && text.length < 150) errMsg = text;
            }
          } catch (e) {
            console.error('Failed to parse error response context:', e);
          }
        }
        throw new Error(errMsg);
      }

      // Step 5: Structuring Analytics & Saving to Cache
      setAiStep(5);
      
      const resolvedModel = data.actualModel || activeModel;
      const resolvedProvider = data.provider || activeProvider;
      
      setAiStepLogs(prev => {
        const logsList: { time: string; message: string; type: 'info' | 'success' | 'error' }[] = [
          ...prev,
          { time: new Date().toLocaleTimeString(), message: 'Success response received from AI engine.', type: 'success' }
        ];
        
        // Premium Fallback Alert: Transparently inform when a fallback happens
        if (data.actualModel && data.actualModel !== activeModel) {
          logsList.push({
            time: new Date().toLocaleTimeString(),
            message: `⚠️ [Fallback Recovered] Primary model failed or timed out. Switched to "${data.actualModel}" on ${providerDisplayNames[resolvedProvider] || resolvedProvider} to ensure audit integrity.`,
            type: 'error'
          });
        } else {
          logsList.push({
            time: new Date().toLocaleTimeString(),
            message: `Processing successfully completed on "${resolvedModel}" via ${providerDisplayNames[resolvedProvider] || resolvedProvider}.`,
            type: 'success'
          });
        }
        
        logsList.push({
          time: new Date().toLocaleTimeString(),
          message: 'Structuring report analytics and updating Supabase cache.',
          type: 'info'
        });
        
        return logsList;
      });
      
      await new Promise(r => setTimeout(r, 600));
      setAiAnalysis({
        id: data.id,
        share_token: data.share_token,
        is_public: data.is_public,
        acknowledged_at: data.acknowledged_at,
        acknowledged_by: data.acknowledged_by,
        template_id: data.template_id || templateId,
        reflection_level: data.reflection_level,
        value_mix: data.value_mix,
        coaching_guide: data.coaching_guide,
        well_being_signal: data.well_being_signal,
        message_to_employee: data.message_to_employee,
        jd_alignment_score: data.jd_alignment_score,
        burnout_risk_score: data.burnout_risk_score,
        workload_allocation: data.workload_allocation,
        strengths: data.strengths,
        improvements: data.improvements,
        development_plan: data.development_plan,
        markdown_executive_summary: data.markdown_executive_summary || data.raw_ai_report,
        created_at: data.created_at || new Date().toISOString(),
        isCached: false,
        model: resolvedModel,
        provider: data.provider || 'unknown',
        start_date: startDate,
        end_date: endDate,
        total_hours: totalHours,
        logs_count: logs?.length || 0,
        weights: keyResponsibilities
      });
      
      setAiStep(6);
      showToast('การประเมินประสิทธิภาพเสร็จสมบูรณ์ / Performance diagnostics complete!', 'success');
      loadAnalysisHistory();
      
      // Advance to Results Step (Step 3)
      setStep(3);
    } catch (err: any) {
      console.error('Error running performance diagnostics:', err);
      setAiStepLogs(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString(), message: `Execution failed: ${err.message}`, type: 'error' },
        { time: new Date().toLocaleTimeString(), message: `💡 คำแนะนำในการตรวจสอบแก้ไข (Troubleshooting tips):`, type: 'info' },
        { time: new Date().toLocaleTimeString(), message: `• หากเจอ Timeout (45s) หรือ Aborted: แปลว่า LLM ใช้เวลาประมวลผลนานกว่าปกติเนื่องจากเซิร์ฟเวอร์ปลายทางมีภาระงานสูง (มักเกิดกับโมเดลตระกูล Flash หรือ API คีย์ฟรีภายใต้โหลดเยอะ) แนะนำให้รอสักครู่แล้วกดรันประเมินใหม่อีกครั้ง`, type: 'info' },
        { time: new Date().toLocaleTimeString(), message: `• ตรวจสอบการตั้งค่า API Key และ Provider ของท่านได้ที่หน้าเมนู Admin → AI Settings ว่ากำหนดค่าถูกต้อง สมบูรณ์ และมีเครดิตการใช้งานเหลืออยู่หรือไม่`, type: 'info' },
        { time: new Date().toLocaleTimeString(), message: `• หากใช้ OpenRouter: โปรดลองสลับไปใช้โมเดลฟรีตัวอื่น หรือโมเดลเสียค่าบริการเพื่อให้การตอบสนองเร็วและมีความเสถียรเพิ่มขึ้น`, type: 'info' }
      ]);
      showToast('เกิดข้อผิดพลาดในการวิเคราะห์: ' + err.message, 'error');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleAcknowledgeAnalysis = async () => {
    if (!aiAnalysis || !aiAnalysis.id) {
      showToast('ไม่พบข้อมูลการประเมินที่จะเซ็นรับทราบ / No analysis data found to sign', 'error');
      return;
    }

    setIsSubmittingAck(true);
    try {
      const { error } = await supabase
        .from('tb_ai_individual_analysis')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: sessionUser?.name || 'AI Specialist'
        })
        .eq('id', aiAnalysis.id);

      if (error) throw error;

      setAiAnalysis((prev: any) => ({
        ...prev,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: sessionUser?.name || 'AI Specialist'
      }));

      // Update in history as well
      setAnalysisHistory(prev => prev.map(item => 
        item.id === aiAnalysis.id 
          ? { ...item, acknowledged_at: new Date().toISOString(), acknowledged_by: sessionUser?.name || 'AI Specialist' }
          : item
      ));

      showToast('ลงนามรับทราบการประเมินโดยระบบ AI Enhance สำเร็จ / Report acknowledged successfully', 'success');
      setShowAckModal(false);
    } catch (err: any) {
      console.error('Error acknowledging report:', err);
      showToast('ไม่สามารถบันทึกการรับทราบได้: ' + err.message, 'error');
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const toggleSharePublicly = async () => {
    if (!aiAnalysis || !aiAnalysis.id) return;
    const newIsPublic = !aiAnalysis.is_public;
    try {
      const { error } = await supabase
        .from('tb_ai_individual_analysis')
        .update({ is_public: newIsPublic })
        .eq('id', aiAnalysis.id);

      if (error) throw error;

      setAiAnalysis((prev: any) => ({ ...prev, is_public: newIsPublic }));
      setAnalysisHistory(prev => prev.map(item => item.id === aiAnalysis.id ? { ...item, is_public: newIsPublic } : item));
      showToast(newIsPublic ? 'เปิดแชร์ผลการวิเคราะห์สู่สาธารณะแล้ว' : 'ปิดการเข้าถึงสาธารณะเรียบร้อย', 'success');
    } catch (err: any) {
      console.error('Error toggling share status:', err);
      showToast('ไม่สามารถเปลี่ยนสถานะการแชร์ได้: ' + err.message, 'error');
    }
  };

  const copyShareLink = () => {
    if (!aiAnalysis || !aiAnalysis.share_token) return;
    const shareUrl = `${window.location.origin}/hrbp?share=${aiAnalysis.share_token}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('คัดลอกลิงก์ผลการวิเคราะห์ลง Clipboard สำเร็จ', 'success');
  };

  const toggleHistoryRecordShare = async (recordId: string, currentIsPublic: boolean) => {
    const newIsPublic = !currentIsPublic;
    try {
      const { error } = await supabase
        .from('tb_ai_individual_analysis')
        .update({ is_public: newIsPublic })
        .eq('id', recordId);

      if (error) throw error;

      setAnalysisHistory(prev => prev.map(item => item.id === recordId ? { ...item, is_public: newIsPublic } : item));
      
      if (aiAnalysis && aiAnalysis.id === recordId) {
        setAiAnalysis((prev: any) => ({ ...prev, is_public: newIsPublic }));
      }
      
      showToast(newIsPublic ? 'เปิดแชร์ผลการวิเคราะห์สู่สาธารณะแล้ว' : 'ปิดการเข้าถึงสาธารณะเรียบร้อย', 'success');
    } catch (err: any) {
      console.error('Error toggling share status:', err);
      showToast('ไม่สามารถเปลี่ยนสถานะการแชร์ได้: ' + err.message, 'error');
    }
  };

  const copyHistoryShareLink = (shareToken: string) => {
    if (!shareToken) return;
    const shareUrl = `${window.location.origin}/hrbp?share=${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('คัดลอกลิงก์ผลการวิเคราะห์ลง Clipboard สำเร็จ', 'success');
  };

  // Helper to parse bold and italic styling inside markdown text
  const parseInlineStyles = (text: string) => {
    if (!text) return '';
    const boldParts = text.split('**');
    return boldParts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-extrabold text-indigo-900 dark:text-indigo-200">{part}</strong>;
      }
      const italicParts = part.split('*');
      return italicParts.map((iPart, iIndex) => {
        if (iIndex % 2 === 1) {
          return <em key={iIndex} className="italic text-theme-text-secondary">{iPart}</em>;
        }
        return iPart;
      });
    });
  };

  // Helper markdown parser
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentType: 'paragraph' | 'bullets' | 'numbered' | 'table' | null = null;
    let buffer: string[] = [];

    const flushBuffer = (key: string | number) => {
      if (buffer.length === 0) return;
      if (currentType === 'paragraph') {
        elements.push(
          <p key={`p-${key}`} className="text-justify leading-relaxed text-theme-text text-xs sm:text-sm font-normal">
            {parseInlineStyles(buffer.join(' '))}
          </p>
        );
      } else if (currentType === 'bullets') {
        elements.push(
          <ul key={`ul-${key}`} className="space-y-1.5 pl-3 my-1">
            {buffer.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-theme-text font-normal">
                <span className="text-indigo-500 dark:text-indigo-400 mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shadow-md shadow-indigo-500/30"></span>
                <span className="leading-relaxed">{parseInlineStyles(item)}</span>
              </li>
            ))}
          </ul>
        );
      } else if (currentType === 'numbered') {
        elements.push(
          <ol key={`ol-${key}`} className="space-y-3 pl-5 my-2 list-decimal text-xs sm:text-sm text-theme-text font-normal">
            {buffer.map((item, idx) => {
              const textContent = item.replace(/^\d+\.\s+/, '');
              return (
                <li key={idx} className="leading-relaxed pl-1 marker:text-indigo-500 marker:font-black">
                  {parseInlineStyles(textContent)}
                </li>
              );
            })}
          </ol>
        );
      } else if (currentType === 'table') {
        const rows = buffer.filter(row => !row.match(/^\|\s*:?-+:?\s*\|/));
        if (rows.length > 0) {
          const headerRow = rows[0];
          const bodyRows = rows.slice(1);
          
          const parseCells = (rowText: string) => {
            const clean = rowText.replace(/^\|/, '').replace(/\|$/, '');
            return clean.split('|').map(cell => cell.trim());
          };
          
          const headers = parseCells(headerRow).slice(0, 4); // Only the first 4 metric columns

          const getHeaderStyle = (index: number) => {
            if (index === 0) return "w-[40%] text-left px-5 py-4 font-black text-theme-text uppercase tracking-wider";
            if (index === 1) return "w-[20%] text-center px-5 py-4 font-black text-theme-text uppercase tracking-wider";
            if (index === 2) return "w-[20%] text-center px-5 py-4 font-black text-theme-text uppercase tracking-wider";
            return "w-[20%] text-center px-5 py-4 font-black text-theme-text uppercase tracking-wider";
          };
          
          elements.push(
            <div key={`table-wrapper-${key}`} className="my-5 overflow-x-auto rounded-3xl border border-theme-border/60 bg-theme-surface-secondary dark:bg-[#090d16] shadow-xl">
              <table className="min-w-full divide-y divide-theme-border/60 text-xs sm:text-sm table-fixed">
                <thead className="bg-slate-200/40 dark:bg-[#0f172a]/70">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className={getHeaderStyle(i)}>
                        {parseInlineStyles(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/40 bg-transparent">
                  {bodyRows.map((r, rowIdx) => {
                    const cells = parseCells(r);
                    const isTotalRow = r.includes('คะแนนรวมถ่วงน้ำหนัก') || r.includes('Overall Score');
                    
                    if (isTotalRow) {
                      const col0 = cells[0] || '';
                      const col1 = cells[1] || '';
                      const col2 = cells[2] || '';
                      const col3 = cells[3] || '';
                      const col4 = cells[4] || '';
                      
                      return (
                        <Fragment key={rowIdx}>
                          <tr className="bg-indigo-500/10 font-bold border-t-2 border-indigo-500/30">
                            <td className="px-5 py-4 text-left font-black text-indigo-500 dark:text-indigo-400 w-[40%]">
                              {parseInlineStyles(col0)}
                            </td>
                            <td className="px-5 py-4 text-center text-theme-text font-black w-[20%]">
                              {parseInlineStyles(col1)}
                            </td>
                            <td className="px-5 py-4 text-center text-theme-text font-black w-[20%]">
                              {parseInlineStyles(col2)}
                            </td>
                            <td className="px-5 py-4 text-center text-indigo-600 dark:text-indigo-400 font-black text-base w-[20%]">
                              {parseInlineStyles(col3)}
                            </td>
                          </tr>
                          {col4 && (
                            <tr className="bg-indigo-500/5 dark:bg-indigo-500/10 border-b-2 border-indigo-500/30 font-bold">
                              <td colSpan={4} className="px-5 py-3 text-right">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500 text-white dark:bg-indigo-400 dark:text-slate-950 text-xs font-black shadow-md uppercase tracking-wider">
                                  🏆 {col4.replace('ระดับประเมิน:', '').replace('ระดับประเมิน', '').trim()}
                                </span>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    } else {
                      const dimension = cells[0] || '';
                      const weight = cells[1] || '';
                      const rawScore = cells[2] || '';
                      const weightedScore = cells[3] || '';
                      const explanation = cells[4] || '';
                      
                      return (
                        <Fragment key={rowIdx}>
                          <tr className="hover:bg-slate-100/30 dark:hover:bg-slate-900/20 transition-colors">
                            <td className="px-5 py-3.5 text-left font-bold text-theme-text w-[40%]">
                              {parseInlineStyles(dimension)}
                            </td>
                            <td className="px-5 py-3.5 text-center text-theme-text font-semibold w-[20%]">
                              {parseInlineStyles(weight)}
                            </td>
                            <td className="px-5 py-3.5 text-center text-theme-text-secondary w-[20%]">
                              {parseInlineStyles(rawScore)}
                            </td>
                            <td className="px-5 py-3.5 text-center text-theme-text-secondary font-semibold w-[20%]">
                              {parseInlineStyles(weightedScore)}
                            </td>
                          </tr>
                          {explanation && (
                            <tr className="bg-theme-surface/50 dark:bg-slate-950/10 border-b border-theme-border/40">
                              <td colSpan={4} className="px-5 pb-4 pt-2 text-left">
                                <div className="pl-4 border-l-2 border-indigo-500/40 text-xs sm:text-[13px] text-theme-text-secondary leading-relaxed text-justify max-w-none">
                                  <span className="font-bold text-theme-text dark:text-indigo-300 block mb-1 text-[10px] uppercase tracking-wider">
                                    💡 คำชี้แจงและหลักฐานประเมิน:
                                  </span>
                                  {parseInlineStyles(explanation)}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          );
        }
      }
      buffer = [];
      currentType = null;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      const isHeader1 = trimmed.startsWith('# ');
      const isHeader2 = trimmed.startsWith('## ');
      const isHeader3 = trimmed.startsWith('### ');
      const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
      const isQuote = trimmed.startsWith('>');
      const isTable = trimmed.startsWith('|');
      const isNumbered = /^\d+\.\s+/.test(trimmed);
      const isEmpty = !trimmed;

      if (isHeader1 || isHeader2 || isHeader3 || isQuote || isEmpty) {
        flushBuffer(idx);

        if (isHeader3) {
          elements.push(
            <h4 key={idx} className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400 mt-4 mb-1.5 border-b border-theme-border/50 pb-1 uppercase tracking-wider">
              {parseInlineStyles(trimmed.replace('###', '').trim())}
            </h4>
          );
        } else if (isHeader2) {
          elements.push(
            <h3 key={idx} className="text-sm sm:text-base font-black text-theme-text mt-5 mb-2.5 uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="text-indigo-600 dark:text-indigo-400" size={15} /> {parseInlineStyles(trimmed.replace('##', '').trim())}
            </h3>
          );
        } else if (isHeader1) {
          elements.push(
            <h2 key={idx} className="text-base sm:text-lg font-black text-theme-text mt-7 mb-3 uppercase tracking-widest border-b-2 border-indigo-500 pb-1.5">
              {parseInlineStyles(trimmed.replace('#', '').trim())}
            </h2>
          );
        } else if (isQuote) {
          elements.push(
            <blockquote key={idx} className="border-l-4 border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/5 pl-4 py-2.5 rounded-r-xl my-2 text-theme-text italic font-medium shadow-inner text-xs sm:text-sm">
              {parseInlineStyles(trimmed.substring(1).trim())}
            </blockquote>
          );
        }
      } else if (isBullet) {
        if (currentType !== 'bullets') {
          flushBuffer(idx);
          currentType = 'bullets';
        }
        buffer.push(trimmed.replace(/^[-*]\s+/, ''));
      } else if (isNumbered) {
        if (currentType !== 'numbered') {
          flushBuffer(idx);
          currentType = 'numbered';
        }
        buffer.push(trimmed);
      } else if (isTable) {
        if (currentType !== 'table') {
          flushBuffer(idx);
          currentType = 'table';
        }
        buffer.push(trimmed);
      } else {
        if (currentType !== 'paragraph') {
          flushBuffer(idx);
          currentType = 'paragraph';
        }
        buffer.push(trimmed);
      }
    });

    flushBuffer('final');

    return (
      <div className="space-y-3.5 text-theme-text leading-relaxed font-sans font-normal">
        {elements}
      </div>
    );
  };

  // Recharts chart compiler data
  const chartData = useMemo(() => {
    if (!aiAnalysis || !aiAnalysis.workload_allocation) return [];
    
    // We try to find total hours to compute actual hours as a fallback if not provided
    const totalHours = aiAnalysis.total_hours || 0;
    
    return aiAnalysis.workload_allocation.map((item: any) => {
      const actualPct = Math.round(
        item.actual_percentage !== undefined 
          ? item.actual_percentage 
          : (item.actual_weight_pct !== undefined 
              ? item.actual_weight_pct 
              : 0)
      );
      
      const targetPct = Math.round(
        item.target_percentage !== undefined 
          ? item.target_percentage 
          : (item.target_weight_pct !== undefined 
              ? item.target_weight_pct 
              : 0)
      );
      
      let actualHours = 0;
      if (item.actual_hours !== undefined) {
        actualHours = Number(item.actual_hours);
      } else if (item.hours !== undefined) {
        actualHours = Number(item.hours);
      } else if (totalHours > 0) {
        actualHours = (totalHours * actualPct) / 100;
      }
      
      return {
        name: item.category,
        'Actual %': actualPct,
        'Target %': targetPct,
        'Actual Hours': actualHours.toFixed(1)
      };
    });
  }, [aiAnalysis]);

  return (
    <AppLayout>
      <div className="w-full max-w-7xl mx-auto space-y-6">
        
        {/* Global Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-theme-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg">
                <Cpu size={16} className="text-theme-text" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-theme-text uppercase">
                AI Enhance Diagnostics
              </h1>
            </div>
            <p className="text-xs text-theme-text-secondary">
              {isSharedView ? "กำลังดูรายงานผลวิเคราะห์สมรรถนะการทำงานที่แชร์" : "ห้องแล็บจำลองและประเมินการพัฒนาศักยภาพพนักงานด้วยระบบ AI (AI Enhance)"}
            </p>
          </div>

          {!isSharedView && (
            <div className="flex items-center gap-2">
              {/* Step Navigation Wizard Bar */}
              <div className="flex items-center gap-1 bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 p-1 rounded-xl border border-theme-border/80">
                <button
                  onClick={() => setStep(1)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all tracking-wider flex items-center gap-1.5",
                    step === 1 ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-theme-surface-tertiary dark:bg-theme-surface-tertiary flex items-center justify-center text-[9px] font-bold">1</span>
                  Setup
                </button>
                
                <ChevronRight size={12} className="text-theme-text" />
                
                <button
                  onClick={() => {
                    if (jdText.trim() && keyResponsibilities.length > 0) {
                      setStep(2);
                    } else {
                      showToast('กรุณากรอก JD และ Weights ให้เรียบร้อยก่อนเข้าริมหน้าควบคุม', 'warning');
                    }
                  }}
                  disabled={!jdText.trim()}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all tracking-wider flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none",
                    step === 2 ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-theme-surface-tertiary dark:bg-theme-surface-tertiary flex items-center justify-center text-[9px] font-bold">2</span>
                  Console
                </button>

                <ChevronRight size={12} className="text-theme-text" />

                <button
                  onClick={() => {
                    setStep(3);
                    if (!aiAnalysis) {
                      setActiveResultsSubTab('history');
                      loadAnalysisHistory();
                    }
                  }}
                  disabled={!selectedUser}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all tracking-wider flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none",
                    step === 3 ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-theme-surface-tertiary dark:bg-theme-surface-tertiary flex items-center justify-center text-[9px] font-bold">3</span>
                  Results & History
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LOADING BAR */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-indigo-400" size={32} />
              <p className="text-theme-text-secondary text-xs font-semibold">กำลังโหลดข้อมูลระบบ...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="w-full">
            {/* ========================================================================= */}
            {/* STEP 1: SETUP WORKFLOW */}
            {/* ========================================================================= */}
            {step === 1 && !isSharedView && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Left Side: Setup Parameters & User Select */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Analysis Mode / Template Selector */}
                  <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border border-theme-border/80 shadow-2xl space-y-4">
                    <h3 className="text-xs font-black text-theme-text-secondary uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                      0. รูปแบบการวิเคราะห์ (Analysis Mode)
                    </h3>
                    <div className="space-y-3">
                      <select
                        value={templateId}
                        onChange={(e) => {
                          setTemplateId(e.target.value);
                          setAiAnalysis(null);
                        }}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border/60 rounded-xl px-4 py-3.5 text-sm text-theme-text outline-none focus:border-indigo-500/80 transition-colors cursor-pointer"
                      >
                        {templatesList.map((t) => (
                          <option key={t.template_key} value={t.template_key} className="bg-theme-surface dark:bg-slate-900 text-theme-text">
                            {t.icon || '🤖'} {t.name}
                          </option>
                        ))}
                      </select>
                      
                      {(() => {
                        const activeTemplate = templatesList.find(t => t.template_key === templateId);
                        if (!activeTemplate) return null;
                        return (
                          <div className="p-4 bg-theme-surface-tertiary dark:bg-slate-950/40 border border-theme-border/50 rounded-2xl text-[10px] text-theme-text-secondary leading-relaxed transition-all duration-300 animate-in fade-in zoom-in-95">
                            <div className="font-bold text-theme-text uppercase tracking-widest text-[9px] mb-1">คำอธิบายรูปแบบการวิเคราะห์:</div>
                            {activeTemplate.description}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Select Employee */}
                  <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border border-theme-border/80 shadow-2xl space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
                    
                    <h3 className="text-xs font-black text-theme-text-secondary uppercase tracking-wider flex items-center gap-2">
                      <UserIcon size={14} className="text-indigo-400" />
                      1. เลือกพนักงานที่จะวิเคราะห์
                    </h3>

                    <div className="space-y-2">
                      <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold">Employee Profile</label>
                      <select
                        value={selectedUser}
                        onChange={(e) => {
                          setSelectedUser(e.target.value);
                          setAiAnalysis(null);
                        }}
                        className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border/60 rounded-xl px-4 py-3 text-sm text-theme-text outline-none focus:border-indigo-500/80 transition-colors"
                      >
                        {usersList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.nickname || 'ไม่มีชื่อเล่น'}) — {u.department}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedUserInfo && (
                      <div className="space-y-3">
                        <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/60 rounded-2xl p-4 border border-theme-border/80 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-theme-text-secondary">ชื่อ-นามสกุล:</span>
                            <span className="text-theme-text font-bold">{selectedUserInfo.full_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-theme-text-secondary">แผนกงาน:</span>
                            <span className="text-indigo-300 font-bold">{selectedUserInfo.department}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-theme-text-secondary">ตำแหน่ง HRMS:</span>
                            <span className="text-indigo-400 font-bold">{selectedUserInfo.position || 'General Staff'}</span>
                          </div>
                        </div>

                        {isCoachTemplate(templateId) && (
                          <div className="bg-indigo-950/10 border border-indigo-500/10 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-200">
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase tracking-widest text-theme-text-secondary font-bold">Employee Level (สำหรับ Coach Mode)</label>
                              <select
                                value={employeeLevel}
                                onChange={(e) => setEmployeeLevel(e.target.value)}
                                className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border/60 rounded-xl px-3 py-2 text-xs text-theme-text outline-none focus:border-indigo-500/80"
                              >
                                <option value="Junior">Junior / General Staff</option>
                                <option value="Senior">Senior / Specialist</option>
                                <option value="Manager">Manager / Section Mgr.</option>
                                <option value="Director">Director / Department Head</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase tracking-widest text-theme-text-secondary font-bold">Manager Name (ผู้รายงานการประเมิน)</label>
                              <input
                                type="text"
                                placeholder="ระบุชื่อผู้ประเมิน"
                                value={managerName}
                                onChange={(e) => setManagerName(e.target.value)}
                                className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border/60 rounded-xl px-3 py-2 text-xs text-theme-text outline-none focus:border-indigo-500/80"
                              />
                            </div>
                          </div>
                        )}

                        <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-theme-text-secondary block uppercase font-bold tracking-wider">ประวัติการวิเคราะห์ / History</span>
                            <span className="text-indigo-300 font-mono font-bold">มีบันทึก {analysisHistory.length} รายการ</span>
                          </div>
                          <button
                            onClick={() => {
                              setStep(3);
                              setActiveResultsSubTab('history');
                              loadAnalysisHistory();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 hover:text-indigo-300 text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            จัดการประวัติ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Diagnostic Date Period Filter */}
                  <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border border-theme-border/80 shadow-2xl space-y-4">
                    <h3 className="text-xs font-black text-theme-text-secondary uppercase tracking-wider flex items-center gap-2">
                      <Calendar size={14} className="text-indigo-400" />
                      2. ช่วงเวลาตรวจประเมิน
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                      {(['this-week', 'this-month', 'this-quarter', 'this-year', 'quarters'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => {
                            setDateFilter(filter);
                            setAiAnalysis(null);
                          }}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-extrabold uppercase transition-all tracking-wider border",
                            filter === 'quarters' ? "col-span-2" : "",
                            dateFilter === filter
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                              : "bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 text-theme-text-secondary border-transparent hover:border-theme-border hover:text-theme-text"
                          )}
                        >
                          {filter === 'this-week' && 'สัปดาห์นี้'}
                          {filter === 'this-month' && 'เดือนนี้'}
                          {filter === 'this-quarter' && 'ไตรมาสนี้'}
                          {filter === 'this-year' && 'ปีนี้'}
                          {filter === 'quarters' && 'เลือกช่วงไตรมาส (Q1 - Q4)'}
                        </button>
                      ))}
                    </div>

                    {dateFilter === 'quarters' && (
                      <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                        <span className="text-[9px] uppercase tracking-widest text-theme-text-secondary font-bold block">
                          เลือกไตรมาสที่ต้องการวิเคราะห์ (เลือกได้มากกว่า 1)
                        </span>
                        <div className="grid grid-cols-4 gap-2">
                          {([1, 2, 3, 4] as const).map((q) => {
                            const isSelected = selectedQuarters.includes(q);
                            return (
                              <button
                                key={q}
                                type="button"
                                onClick={() => {
                                  let updated = [...selectedQuarters];
                                  if (isSelected) {
                                    if (updated.length > 1) {
                                      updated = updated.filter(item => item !== q);
                                    } else {
                                      showToast('ต้องเลือกอย่างน้อย 1 ไตรมาส', 'warning');
                                    }
                                  } else {
                                    updated.push(q);
                                  }
                                  setSelectedQuarters(updated);
                                  setAiAnalysis(null);
                                }}
                                className={cn(
                                  "py-2 rounded-xl text-xs font-bold transition-all border",
                                  isSelected
                                    ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                                    : "bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 text-theme-text-secondary border-transparent hover:border-theme-border"
                                )}
                              >
                                Q{q}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isCoachTemplate(templateId) && (
                      <div className="space-y-2 pt-3 border-t border-theme-border/60">
                        <label className="text-[9px] uppercase tracking-widest text-theme-text-secondary font-bold block">Cadence (รอบการประเมินของโค้ช)</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['auto', 'weekly', 'monthly', 'quarterly'] as const).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCadenceType(c)}
                              className={cn(
                                "px-1.5 py-2 rounded-xl text-[9px] font-black uppercase transition-all tracking-wider border",
                                cadenceType === c
                                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                  : "bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 text-theme-text-secondary border-transparent hover:border-theme-border hover:text-theme-text"
                              )}
                            >
                              {c === 'auto' ? 'Auto ⏱️' : c === 'weekly' ? 'Week' : c === 'monthly' ? 'Month' : 'Quarter'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Job Description & Target Weights Setup */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border border-theme-border/80 shadow-2xl space-y-6">
                    
                    {/* Header bar inside setting */}
                    <div className="flex items-center justify-between border-b border-theme-border/60 pb-4">
                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-theme-text uppercase tracking-wider flex items-center gap-2">
                          <FileSpreadsheet size={16} className="text-indigo-400" />
                          3. กำหนดความคาดหวังภาระงาน (Job Description & Target Weights)
                        </h3>
                        <p className="text-[10px] text-theme-text-secondary">
                          ระบุหน้าที่งานและจัดสรรสัดส่วนน้ำหนักเป้าหมายของงานให้อ้างอิงรวมกันได้ 100%
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={recommendJd}
                          disabled={isRecommendingJd}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[10px] font-black uppercase text-theme-text shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                        >
                          {isRecommendingJd ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>กำลังคิด...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} className="animate-pulse" />
                              <span>AI แนะนำ JD</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleSaveJd}
                          disabled={isSavingJd}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-[10px] font-black uppercase text-theme-text shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                        >
                          {isSavingJd ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                          <span>บันทึก JD</span>
                        </button>
                      </div>
                    </div>

                    {/* Position and JD details editor */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1 space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold">ตำแหน่งงานสำหรับการประเมิน (Override Position)</label>
                          <input
                            type="text"
                            value={customPosition}
                            onChange={(e) => setCustomPosition(e.target.value)}
                            placeholder={selectedUserInfo?.position || 'เช่น Senior Developer, Manager'}
                            className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border/60 rounded-xl px-4 py-3 text-xs text-theme-text outline-none focus:border-indigo-500/80 transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold">แหล่งที่มาของข้อมูล (Source)</label>
                          <div className="p-3.5 rounded-xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/60 border border-theme-border/80 text-[11px] font-mono text-theme-text-secondary flex items-center justify-between">
                            <span>Status:</span>
                            <span className={cn(
                              "font-bold uppercase tracking-wider",
                              jdSource === 'ai_recommended' ? "text-indigo-400" : "text-theme-text-secondary"
                            )}>
                              {jdSource === 'ai_recommended' ? '✨ AI Recommended' : '✏️ Manual Entry'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold">หน้าที่รับผิดชอบโดยละเอียด (Raw Job Description Text)</label>
                        <textarea
                          rows={6}
                          value={jdText}
                          onChange={(e) => setJdText(e.target.value)}
                          placeholder="กรอกหน้าที่งาน บทบาท ความเชี่ยวชาญ และความคาดหวังที่นี่ หรือกด 'AI แนะนำ JD' เพื่อสร้างเนื้อหาให้โดยอัตโนมัติ..."
                          className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border/60 rounded-2xl px-4 py-3 text-xs text-theme-text outline-none focus:border-indigo-500/80 transition-colors font-sans leading-relaxed resize-none"
                        />
                      </div>
                    </div>

                    {/* Target Weights allocation slider list */}
                    <div className="border-t border-theme-border/60 pt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-theme-text-secondary uppercase tracking-wider flex items-center gap-2">
                          <Target size={14} className="text-indigo-400" />
                          การกระจายน้ำหนักภาระงานเป้าหมาย (Key Weight Responsibilities Allocation)
                        </h4>
                        
                        {/* Target weights status indicator */}
                        {(() => {
                          const total = keyResponsibilities.reduce((sum, item) => sum + item.weight, 0);
                          return (
                            <div className={cn(
                              "px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold tracking-wider font-mono flex items-center gap-2",
                              total === 100 
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                                : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                            )}>
                              {total === 100 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                              <span>รวมสัดส่วน: {total}% / 100%</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Responsibilities weights list */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {keyResponsibilities.length === 0 ? (
                            <div className="text-center p-8 rounded-2xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-dashed border-theme-border/80 text-xs text-theme-text-secondary italic">
                              ไม่มีหัวข้อความรับผิดชอบ / ยังไม่ได้เพิ่มสัดส่วนงานเป้าหมาย
                            </div>
                          ) : (
                            keyResponsibilities.map((w, index) => (
                              <div key={index} className="flex items-center justify-between p-3.5 bg-theme-surface dark:bg-theme-surface-secondary/40 border border-theme-border/80 rounded-2xl gap-4 hover:border-theme-border dark:hover:border-theme-border/80 transition-colors">
                                <div className="flex-1 space-y-1">
                                  <div className="text-[11px] font-bold text-theme-text line-clamp-1">{w.category}</div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={w.weight}
                                      onChange={(e) => handleWeightChange(index, parseInt(e.target.value))}
                                      className="flex-1 h-1.5 rounded-lg bg-slate-200 dark:bg-theme-surface-tertiary accent-indigo-500 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-mono font-extrabold text-indigo-400 w-8 text-right">{w.weight}%</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveWeight(index)}
                                  className="p-2 rounded-lg text-theme-text-secondary hover:text-rose-400 hover:bg-rose-500/5 transition-all"
                                  title="ลบสัดส่วนภาระงานนี้"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add key weights config form */}
                        <div className="p-5 rounded-2xl bg-theme-surface dark:bg-theme-surface-secondary/40 border border-theme-border/80 space-y-4">
                          <div className="text-[10px] font-extrabold text-theme-text-secondary uppercase tracking-widest">
                            ➕ เพิ่มหัวข้อความรับผิดชอบใหม่
                          </div>
                          
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase tracking-widest text-theme-text-secondary font-bold">ชื่อหน้าที่ / ลักษณะงานหลัก</span>
                              <input
                                type="text"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                placeholder="เช่น พัฒนาซอฟต์แวร์, ทำแผนงานบำรุงรักษา, เอกสาร"
                                className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border/60 rounded-xl px-3.5 py-2.5 text-xs text-theme-text"
                              />
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 items-end">
                              <div className="col-span-2 space-y-1">
                                <span className="text-[9px] uppercase tracking-widest text-theme-text-secondary font-bold">น้ำหนักภาระงาน (%)</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={newCatWeight}
                                  onChange={(e) => setNewCatWeight(parseInt(e.target.value) || 0)}
                                  className="w-full bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border/60 rounded-xl px-3.5 py-2 text-xs text-theme-text"
                                />
                              </div>
                              
                              <button
                                type="button"
                                onClick={handleAddWeight}
                                className="w-full py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/25 hover:text-indigo-300 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                              >
                                <PlusCircle size={12} />
                                <span>เพิ่ม</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Diagnostic Trigger Buttons */}
                    <div className="flex items-center justify-between border-t border-theme-border/60 pt-6">
                      <div className="flex items-center gap-2 text-[10px] text-theme-text-secondary font-mono">
                        <Info size={12} className="text-theme-text-secondary shrink-0" />
                        <span>การบันทึก Job Description และสัดส่วนภาระงานมีความจำเป็นก่อนเริ่มต้นประเมินผลประสิทธิภาพ</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {aiAnalysis && (
                          <button
                            onClick={() => setStep(3)}
                            className="px-4 py-2.5 rounded-xl bg-theme-surface-tertiary dark:bg-theme-surface-secondary border border-theme-border hover:border-theme-border dark:hover:border-theme-border text-theme-text-secondary text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                          >
                            <span>ข้ามไปดูผลลัพธ์ล่าสุด</span>
                            <ArrowRight size={12} />
                          </button>
                        )}

                        <button
                          onClick={() => handleRunAiAnalysis(true)}
                          disabled={!jdText.trim() || keyResponsibilities.reduce((sum, r) => sum + r.weight, 0) !== 100}
                          className="px-5 py-3 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:pointer-events-none text-[10px] font-black uppercase tracking-wider text-theme-text shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                          <Sparkles size={14} className="animate-pulse" />
                          <span>เริ่มวิเคราะห์ AI Performance Audit</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 2: CONSOLE WORKFLOW */}
            {/* ========================================================================= */}
            {step === 2 && !isSharedView && (
              <div className="w-full max-w-4xl mx-auto p-6 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border/80 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 space-y-6">
                
                {/* Embedded Glowing background lines */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="flex items-center justify-between pb-4 border-b border-theme-border/60">
                  <div className="flex items-center gap-2">
                    <Terminal size={18} className="text-indigo-400 animate-pulse" />
                    <h3 className="text-sm font-black text-theme-text uppercase tracking-wider">
                      AI DIAGNOSTIC CONSOLE AUDITING
                    </h3>
                  </div>

                  {/* Engine Model details */}
                  <div className="flex items-center gap-2 bg-theme-surface-secondary dark:bg-theme-surface-secondary border border-theme-border px-3.5 py-1.5 rounded-xl text-[10px] font-mono">
                    <span className="text-theme-text-secondary uppercase tracking-widest font-semibold shrink-0">Model:</span>
                    <span className="text-indigo-400 font-extrabold shrink-0">{aiModel || 'ตรวจหาความเชื่อมต่อ...'}</span>
                    {aiProvider && (
                      <span className="text-[9px] text-theme-text-secondary font-bold uppercase tracking-wider ml-1">({aiProvider})</span>
                    )}
                  </div>
                </div>

                {/* real-time connection telemetry indicator */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 font-bold font-mono text-xs">
                      1
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-widest block">Connection Pipeline</span>
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        SECURE ONLINE
                      </span>
                    </div>
                  </div>

                  <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 font-bold font-mono text-xs">
                      2
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-widest block">Active Telemetry Step</span>
                      <span className="text-xs text-indigo-300 font-bold">
                        {aiStep === 1 && '1. เริ่มต้นวิเคราะห์ข้อมูล'}
                        {aiStep === 2 && '2. ตรวจสอบใบงานพนักงาน'}
                        {aiStep === 3 && '3. จัดคำนวณสัดส่วนงานจริง'}
                        {aiStep === 4 && '4. เชื่อมโยง LLM Fallback'}
                        {aiStep === 5 && '5. โครงสร้างข้อมูลและแคช'}
                        {aiStep === 6 && '6. สรุปผลวิเคราะห์เรียบร้อย'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border border-theme-border p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 font-bold font-mono text-xs">
                      3
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-widest block">Audit Status</span>
                      <span className={cn(
                        "text-xs font-bold",
                        isAiAnalyzing ? "text-indigo-400 animate-pulse" : "text-emerald-400"
                      )}>
                        {isAiAnalyzing ? 'RUNNING AUTOMATED AUDIT' : 'COMPLETED'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono tracking-widest uppercase">
                    <span className="text-theme-text-secondary">Step Progression</span>
                    <span className="text-indigo-400 font-bold">{Math.round((aiStep / 6) * 100)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-theme-surface-secondary border border-theme-border/80 rounded-full overflow-hidden p-0.5 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(aiStep / 6) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Step Logs Console Terminal */}
                <div className="space-y-2">
                  <span className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-extrabold block">
                    Execution Log Feed
                  </span>

                  <div className="w-full h-[280px] bg-theme-surface-tertiary dark:bg-theme-bg-page border border-theme-border rounded-2xl p-4 font-mono text-xs leading-relaxed overflow-y-auto flex flex-col gap-2.5 shadow-inner select-text">
                    {aiStepLogs.map((log, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "flex items-start gap-3 border-l-2 pl-3 py-0.5 hover:bg-slate-200/50 dark:hover:bg-theme-surface-secondary dark:hover:bg-slate-900/50 rounded transition-colors",
                          log.type === 'error' ? "text-rose-600 dark:text-rose-400 border-rose-500 bg-rose-500/5" :
                          log.type === 'success' ? "text-emerald-600 dark:text-emerald-400 border-emerald-500 bg-emerald-500/5" :
                          "text-theme-text-secondary border-indigo-500 bg-indigo-500/5"
                        )}
                      >
                        <span className="text-theme-text-secondary text-[10px] font-bold shrink-0">[{log.time}]</span>
                        <span className="flex-1 whitespace-pre-wrap">{log.message}</span>
                      </div>
                    ))}
                    {isAiAnalyzing && (
                      <div className="flex items-center gap-2 text-indigo-400 font-bold pl-3 animate-pulse pt-2 border-l border-indigo-500/40">
                        <Loader2 className="animate-spin" size={12} />
                        <span>กำลังประมวลผลข้อมูลการทำงาน...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-theme-border/60 pt-6">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl bg-theme-surface-tertiary dark:bg-theme-surface-secondary border border-theme-border hover:border-theme-border dark:hover:border-theme-border text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  >
                    <ArrowLeft size={12} />
                    <span>ย้อนกลับไป Setup / Cancel</span>
                  </button>

                  <button
                    onClick={() => setStep(3)}
                    disabled={isAiAnalyzing || !aiAnalysis}
                    className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-[10px] font-black uppercase tracking-wider text-theme-text shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-1.5"
                  >
                    <span>ดูสรุปผลลัพธ์ (Step 3)</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 3: RESULTS & HISTORY */}
            {/* ========================================================================= */}
            {step === 3 && aiAnalysis && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* 3.0 Employee Profile & JD Summary (Performance CV Card) */}
                <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-theme-surface-secondary dark:bg-gradient-to-r dark:from-[#0d1527] dark:to-[#0a0d16] border border-theme-border/80 shadow-2xl relative overflow-hidden space-y-4">
                  {/* Subtle design gradients */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-36 h-36 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 pb-4 border-b border-theme-border/80">
                    {/* User info left side */}
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-full overflow-hidden border border-indigo-400/20 shadow-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5">
                          <div className="w-full h-full rounded-full overflow-hidden bg-theme-surface dark:bg-theme-bg-page flex items-center justify-center font-black text-xl text-theme-text">
                            {selectedUserInfo?.emp_id ? (
                              <img 
                                src={`${import.meta.env.VITE_HRMS_FACE_IMAGE_URL || 'https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID='}${selectedUserInfo.emp_id}`} 
                                alt={selectedUserInfo.full_name} 
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent && !parent.querySelector('.fallback-letter')) {
                                    const span = document.createElement('span');
                                    span.className = 'fallback-letter text-xl font-black text-theme-text';
                                    span.innerText = selectedUserInfo?.nickname?.slice(0, 2).toUpperCase() || selectedUserInfo?.full_name?.charAt(0) || 'E';
                                    parent.appendChild(span);
                                  }
                                }} 
                                className="w-full h-full object-cover animate-in fade-in duration-300"
                              />
                            ) : (
                              <span className="fallback-letter">{selectedUserInfo?.nickname?.slice(0, 2).toUpperCase() || selectedUserInfo?.full_name?.charAt(0) || 'E'}</span>
                            )}
                          </div>
                        </div>
                        {selectedUserInfo?.employee_level && (
                          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[8px] font-black uppercase bg-emerald-500 text-slate-950 rounded-md border border-slate-900 shadow-sm whitespace-nowrap z-10" title="Employee Level">
                            {selectedUserInfo.employee_level}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-extrabold text-theme-text tracking-tight">
                            {selectedUserInfo?.full_name || 'Employee Name'}
                          </h2>
                          {selectedUserInfo?.nickname && (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                              ({selectedUserInfo.nickname})
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-theme-text-secondary">
                          {selectedUserInfo?.position || customPosition || 'General Specialist'}
                        </p>
                        <p className="text-xs text-theme-text-secondary font-mono">
                          {selectedUserInfo?.department || 'Department'} | ID: {selectedUserInfo?.emp_id || 'N/A'}
                        </p>
                        {aiAnalysis && (
                          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-indigo-500/10 shadow-sm animate-in fade-in duration-300">
                              <span>🎯 รูปแบบการประเมิน:</span>
                              <span className="font-extrabold">{templatesList.find(t => t.template_key === aiAnalysis.template_id)?.name || aiAnalysis.template_id}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats summary right side */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 font-mono">
                      <div className="p-3 bg-slate-200/50 dark:bg-theme-surface-secondary/60 rounded-2xl border border-theme-border/60 text-center">
                        <div className="text-[9px] text-theme-text-secondary font-bold uppercase tracking-wider">ประเมินช่วง / Period</div>
                        <div className="text-xs font-black text-theme-text mt-1">
                          {aiAnalysis.start_date} ~ {aiAnalysis.end_date}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-200/50 dark:bg-theme-surface-secondary/60 rounded-2xl border border-theme-border/60 text-center">
                        <div className="text-[9px] text-theme-text-secondary font-bold uppercase tracking-wider">ชั่วโมงทำงานจริง / Hours</div>
                        <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                          {aiAnalysis.total_hours || 0} ชม. ({aiAnalysis.logs_count || 0} รายการ)
                        </div>
                      </div>
                      <div className="p-3 bg-slate-200/50 dark:bg-theme-surface-secondary/60 rounded-2xl border border-theme-border/60 text-center col-span-2 sm:col-span-1">
                        <div className="text-[9px] text-theme-text-secondary font-bold uppercase tracking-wider">สถานะการรับรอง / Status</div>
                        <div className="text-xs font-black mt-1 flex items-center justify-center gap-1">
                          {aiAnalysis.acknowledged_at ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><CheckCircle2 size={12} /> Verified</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5"><AlertTriangle size={12} /> Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Job Description (JD) and Target Weights Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 pt-2">
                    {/* JD Box */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5 font-mono">
                          <FileText size={12} />
                          EXPECTED JOB DESCRIPTION (JD)
                        </h4>
                      </div>
                      <div className="p-4 rounded-2xl bg-theme-surface dark:bg-theme-bg-page/40 border border-theme-border/80 text-xs text-theme-text leading-relaxed min-h-[120px] max-h-[300px] overflow-y-auto scrollbar-thin whitespace-pre-line font-light">
                        {jdText || 'ไม่มีข้อมูลรายละเอียดงานในระบบ / No Job Description defined.'}
                      </div>
                    </div>

                    {/* Target Weights Box */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase text-pink-600 dark:text-pink-400 tracking-wider flex items-center gap-1.5 font-mono">
                        <Target size={12} />
                        TARGET RESPONSIBILITIES &amp; WEIGHTS
                      </h4>
                      <div className="p-4 rounded-2xl bg-theme-surface dark:bg-theme-bg-page/40 border border-theme-border/80 min-h-[120px] max-h-[300px] overflow-y-auto space-y-2 scrollbar-thin">
                        {keyResponsibilities.length === 0 && chartData.length === 0 ? (
                          <div className="text-xs text-theme-text-secondary italic">ไม่มีข้อมูลน้ำหนักความรับผิดชอบเป้าหมาย / No target weights defined.</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(keyResponsibilities.length > 0 ? keyResponsibilities.map((item: any) => ({ category: item.category, weight: item.weight })) : chartData.map((item: any) => ({ category: item.name, weight: item['Target %'] }))).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-theme-surface-secondary dark:bg-theme-surface-secondary/60 border border-theme-border/80 rounded-xl text-[11px]">
                                <span className="font-bold text-theme-text truncate pr-2" title={item.category}>
                                  {item.category}
                                </span>
                                <span className="text-pink-600 dark:text-pink-400 font-mono font-bold shrink-0">
                                  {item.weight}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>                {/* 3.1 Top Highlights Analytics Row (Premium Cards) */}
                {isCoachTemplate(aiAnalysis.template_id) ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Card 1: Job Description Alignment Score */}
                    <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-gradient-to-br dark:from-[#0B0F19] dark:to-[#0A0D15] border border-theme-border/80 shadow-2xl relative overflow-hidden flex items-center justify-between">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                          <Award size={14} className="text-indigo-600 dark:text-indigo-400" />
                          JD ALIGNMENT SCORE
                        </span>
                        <h4 className="text-4xl font-black text-theme-text tracking-tight">
                          {aiAnalysis.jd_alignment_score || 0}%
                        </h4>
                        <p className="text-[10px] text-theme-text-secondary">
                          {aiAnalysis.template_id === 'coaching_fairness'
                            ? "ระดับความสอดคล้องตามเกณฑ์ประเมินที่เป็นธรรม เปรียบเทียบกับ JD คาดหวัง"
                            : "ระดับความสอดคล้องตามกรอบ 5-Lens เปรียบเทียบสัดส่วนจริงกับ JD คาดหวัง"}
                        </p>
                      </div>
                      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="40" cy="40" r="32" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="6" fill="transparent" />
                          <circle 
                            cx="40" 
                            cy="40" 
                            r="32" 
                            stroke="#6366f1" 
                            strokeWidth="6" 
                            fill="transparent" 
                            strokeDasharray={`${2 * Math.PI * 32}`}
                            strokeDashoffset={`${2 * Math.PI * 32 * (1 - (aiAnalysis.jd_alignment_score || 0) / 100)}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                          {aiAnalysis.jd_alignment_score || 0}%
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Reflection Maturity */}
                    <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-gradient-to-br dark:from-[#0B0F19] dark:to-[#0A0D15] border border-theme-border/80 shadow-2xl relative overflow-hidden flex flex-col justify-between gap-4">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest flex items-center gap-1.5 font-mono">
                          <Sparkles size={14} className="text-violet-500 dark:text-violet-400" />
                          REFLECTION MATURITY
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                          Level {aiAnalysis.reflection_level || 1}/4
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xl font-black text-theme-text tracking-tight">
                          {aiAnalysis.reflection_level === 4 ? 'Reflective Practitioner 🌟' :
                           aiAnalysis.reflection_level === 3 ? 'Result Oriented 🎯' :
                           aiAnalysis.reflection_level === 2 ? 'Process Thinker ⚙️' :
                           'Activity Logger 📝'}
                        </h4>
                        <p className="text-[10px] text-theme-text-secondary leading-relaxed">
                          ระดับคุณภาพการเขียนสะท้อนผลลัพธ์และความคิดสร้างสรรค์ในใบงานจริง
                        </p>
                      </div>
                    </div>

                    {/* Card 3: Well-being Signal */}
                    <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-gradient-to-br dark:from-[#0B0F19] dark:to-[#0A0D15] border border-theme-border/80 shadow-2xl relative overflow-hidden flex flex-col justify-between gap-4">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest flex items-center gap-1.5 font-mono">
                          <Activity size={14} className="text-rose-500 dark:text-rose-400" />
                          WELL-BEING SIGNAL
                        </span>
                        {aiAnalysis.well_being_signal && (
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono tracking-wider",
                            viewMode === 'employee' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                            aiAnalysis.well_being_signal.level === 'red' ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" :
                            aiAnalysis.well_being_signal.level === 'yellow' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          )}>
                            {viewMode === 'employee' ? 'ACTIVE CARE' : aiAnalysis.well_being_signal.level.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xl font-black text-theme-text tracking-tight capitalize">
                          {viewMode === 'employee' ? 'Supportive Care Active' : (aiAnalysis.well_being_signal?.risk_type === 'none' ? 'Perfect Health' : aiAnalysis.well_being_signal?.risk_type || 'Healthy')}
                        </h4>
                        <p className="text-[10px] text-theme-text-secondary leading-relaxed">
                          {viewMode === 'employee' ? 'ระดับสุขภาวะและการดูแลความสมดุลในการทำงาน (Work-Life Balance)' : `ระดับสุขภาวะและความเครียด วิเคราะห์ความสอดคล้องกับ burnout risk (${aiAnalysis.burnout_risk_score}%)`}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Card 1: Job Description Alignment Score */}
                    <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-gradient-to-br dark:from-[#0B0F19] dark:to-[#0A0D15] border border-theme-border/80 shadow-2xl relative overflow-hidden flex items-center justify-between">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                          <Award size={14} className="text-indigo-600 dark:text-indigo-400" />
                          JD ALIGNMENT SCORE
                        </span>
                        <h4 className="text-4xl font-black text-theme-text tracking-tight">
                          {aiAnalysis.jd_alignment_score || 0}%
                        </h4>
                        <p className="text-[10px] text-theme-text-secondary">
                          ระดับความสอดคล้องของพฤติกรรมการทำงานจริงเปรียบเทียบกับ JD คาดหวัง
                        </p>
                      </div>

                      {/* Circular Score Visualizer */}
                      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="40" cy="40" r="32" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="6" fill="transparent" />
                          <circle 
                            cx="40" 
                            cy="40" 
                            r="32" 
                            stroke="#6366f1" 
                            strokeWidth="6" 
                            fill="transparent" 
                            strokeDasharray={`${2 * Math.PI * 32}`}
                            strokeDashoffset={`${2 * Math.PI * 32 * (1 - (aiAnalysis.jd_alignment_score || 0) / 100)}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                          {aiAnalysis.jd_alignment_score || 0}%
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Burnout & Workload Fatigue Risk */}
                    <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-gradient-to-br dark:from-[#0B0F19] dark:to-[#0A0D15] border border-theme-border/80 shadow-2xl relative overflow-hidden flex flex-col justify-between gap-4">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                          <Activity size={14} className="text-rose-500 dark:text-rose-400" />
                          BURNOUT / FATIGUE RISK
                        </span>
                        
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono tracking-wider",
                          (aiAnalysis.burnout_risk_score || 0) > 70 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" :
                          (aiAnalysis.burnout_risk_score || 0) > 40 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        )}>
                          {(aiAnalysis.burnout_risk_score || 0) > 70 ? 'High Risk' : (aiAnalysis.burnout_risk_score || 0) > 40 ? 'Moderate' : 'Low Risk'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-4xl font-black text-theme-text tracking-tight">
                          {aiAnalysis.burnout_risk_score || 0}%
                        </h4>
                        
                        <div className="space-y-1">
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-theme-surface-tertiary rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                (aiAnalysis.burnout_risk_score || 0) > 70 ? "bg-rose-500" :
                                (aiAnalysis.burnout_risk_score || 0) > 40 ? "bg-amber-500" :
                                "bg-emerald-500"
                              )}
                              style={{ width: `${aiAnalysis.burnout_risk_score || 0}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-theme-text-secondary">ประเมินจากความสม่ำเสมอ ชั่วโมงโอที และความแปรปรวนในกิจกรรมรายวัน</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Actionable Controls & Sign-off Acknowledgment */}
                    <div className="p-6 rounded-3xl bg-theme-surface-secondary dark:bg-gradient-to-br dark:from-[#0B0F19] dark:to-[#0A0D15] border border-theme-border/80 shadow-2xl relative overflow-hidden flex flex-col justify-between gap-3">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                          <UserCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
                          AUDIT SIGN-OFF &amp; ACKNOWLEDGEMENT
                        </span>
                      </div>

                      <div className="bg-theme-surface dark:bg-theme-surface-secondary/60 rounded-2xl p-3.5 border border-theme-border/80 text-[11px]">
                        {aiAnalysis.acknowledged_at ? (
                          <div className="space-y-1 text-theme-text">
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold uppercase text-[9px] tracking-widest">
                              <Check size={12} />
                              <span>VERIFIED BY AI ENHANCE</span>
                            </div>
                            <div>ลงนามโดย: <span className="text-theme-text font-bold">{aiAnalysis.acknowledged_by}</span></div>
                            <div className="text-[10px] text-theme-text-secondary">{new Date(aiAnalysis.acknowledged_at).toLocaleString('th-TH')}</div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-theme-text-secondary text-[10px] leading-relaxed">
                              รายงานนี้ยังไม่ได้รับการลงนามบันทึกรับทราบผลการประเมินความสามารถเพื่อประกอบคำแนะนำ
                            </p>
                            {!isSharedView && (
                              <button
                                onClick={() => setShowAckModal(true)}
                                className="w-full py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:text-indigo-500 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5"
                              >
                                <UserCheck size={12} />
                                <span>ลงนามบันทึกรับทราบผล (Acknowledge)</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}



                {/* 3.2 Main Content Split Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Workload Allocation vs Target BarChart */}
                  <div className="lg:col-span-1 p-6 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border border-theme-border/80 shadow-2xl space-y-4">
                    <h3 className="text-xs font-black text-theme-text uppercase tracking-wider flex items-center gap-2 border-b border-theme-border/60 pb-3">
                      <TrendingUp size={14} className="text-indigo-600 dark:text-indigo-400" />
                      📊 Actual Distribution vs Target Weights
                    </h3>

                    {chartData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-xs text-theme-text-secondary italic font-mono">
                        ไม่มีข้อมูลสัดส่วนความรับผิดชอบจริง
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart
                              data={chartData}
                              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                            >
                              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                              <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                              <Tooltip 
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border/80 p-3 rounded-2xl shadow-xl space-y-1 z-30">
                                        <p className="text-[10px] font-black text-theme-text-secondary font-mono tracking-wider">{label}</p>
                                        {payload.map((entry: any, idx: number) => (
                                          <div key={idx} className="flex items-center gap-2 text-[11px] font-bold">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill || entry.color }} />
                                            <span className="text-theme-text-secondary">{entry.name}:</span>
                                            <span className="text-theme-text dark:text-white font-mono font-black ml-auto">{entry.value}%</span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 10 }} />
                              <Bar dataKey="Actual %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Target %" fill="#ec4899" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* List detailing differences */}
                        <div className="space-y-2 pr-1">
                          {chartData.map((item: any, idx: number) => {
                            const diff = Math.round(item['Actual %'] - item['Target %']);
                            return (
                              <div key={idx} className="p-3 bg-theme-surface dark:bg-theme-surface-secondary/40 border border-theme-border/60 rounded-xl flex items-center justify-between text-xs">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-theme-text block truncate max-w-[150px]">{item.name}</span>
                                  <span className="text-[10px] text-theme-text-secondary font-mono">จริง: {item['Actual %']}% | เป้าหมาย: {item['Target %']}% ({item['Actual Hours']} ชม.)</span>
                                </div>

                                <div className={cn(
                                  "px-2 py-0.5 rounded-lg text-[9px] font-bold font-mono tracking-wider",
                                  diff > 15 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                                  diff < -15 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                                  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                )}>
                                  {diff > 0 ? `+${diff}%` : `${diff}%`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Detailed Tabbed reports & diagnostic writeups */}
                  <div className="lg:col-span-2 p-6 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/80 border border-theme-border/80 shadow-2xl flex flex-col gap-6">
                    
                    {/* Share bar and quick actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border/60 pb-4">
                      
                      {/* Telemetry info about the model caching */}
                      <div className="flex flex-col gap-1">
                        <div className="text-[10px] font-extrabold uppercase text-theme-text-secondary tracking-wider">
                          Diagnostic Audit Report Summary
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-theme-text-secondary font-mono">
                          <span>ช่วงเวลาประเมิน: <strong>{aiAnalysis.start_date} ~ {aiAnalysis.end_date}</strong></span>
                          <span>|</span>
                          <span>Engine: <strong>{aiAnalysis.model}</strong></span>
                          {aiAnalysis.isCached && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">CACHED</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {/* Share link panel */}
                        <div className="flex items-center bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-xl p-0.5">
                          <button
                            onClick={toggleSharePublicly}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                              aiAnalysis.is_public
                                ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                            )}
                            title="Toggle public web sharing link access"
                          >
                            {aiAnalysis.is_public ? <Globe size={11} /> : <Lock size={11} />}
                            <span>{aiAnalysis.is_public ? 'Public' : 'Private'}</span>
                          </button>

                          {aiAnalysis.share_token && (
                            <button
                              onClick={copyShareLink}
                              className="p-1.5 text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text transition-colors"
                              title="Copy URL Share Link to Clipboard"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>

                        {/* View mode switcher */}
                        {isCoachTemplate(aiAnalysis.template_id) && (
                          <div className="flex items-center bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border rounded-xl p-0.5 font-mono text-[9px] font-bold">
                            <button
                              onClick={() => setViewMode('manager')}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg transition-all",
                                viewMode === 'manager'
                                  ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-black"
                                  : "text-theme-text-secondary hover:text-theme-text"
                              )}
                            >
                              Manager View
                            </button>
                            <button
                              onClick={() => setViewMode('employee')}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg transition-all",
                                viewMode === 'employee'
                                  ? "bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 font-black"
                                  : "text-theme-text-secondary hover:text-theme-text"
                              )}
                            >
                              Employee View
                            </button>
                          </div>
                        )}

                        {/* Print Control */}
                        <button
                          onClick={() => window.print()}
                          className="p-2.5 rounded-xl bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border hover:border-theme-border dark:hover:border-theme-border text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text transition-colors"
                          title="Print / Save PDF Report"
                        >
                          <Printer size={13} />
                        </button>

                      </div>

                    </div>

                    {/* Tab Header Selector — only shown in admin view */}
                    {!isSharedView && (
                    <div className="flex gap-2 border-b border-theme-border/40 pb-3 overflow-x-auto">
                      {isCoachTemplate(aiAnalysis.template_id) ? (
                        <>
                          <button
                            onClick={() => setActiveResultsSubTab('summary')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                              activeResultsSubTab === 'summary'
                                ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                            )}
                          >
                            <Sparkles size={13} />
                            <span>{aiAnalysis.template_id === 'coaching_fairness' ? 'Coaching & Fairness Summary' : '5-Lens Summary'}</span>
                          </button>
                          
                          {viewMode === 'manager' && (
                            <button
                              onClick={() => setActiveResultsSubTab('coaching')}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                activeResultsSubTab === 'coaching'
                                  ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                  : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                              )}
                            >
                              <Target size={13} />
                              <span>Coaching 1:1 Guide</span>
                            </button>
                          )}

                          <button
                            onClick={() => setActiveResultsSubTab('gaps')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                              activeResultsSubTab === 'gaps'
                                ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                            )}
                          >
                            <Award size={13} />
                            <span>Action Plan &amp; Strengths</span>
                          </button>

                          {viewMode === 'manager' && (
                            <button
                              onClick={() => setActiveResultsSubTab('well_being' as any)}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                activeResultsSubTab === ('well_being' as any)
                                  ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                  : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                              )}
                            >
                              <Activity size={13} />
                              <span>Risk &amp; Well-being</span>
                            </button>
                          )}

                          <button
                            onClick={() => setActiveResultsSubTab('message' as any)}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                              activeResultsSubTab === ('message' as any)
                                ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                            )}
                          >
                            <FileText size={13} />
                            <span>Direct Message</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setActiveResultsSubTab('summary')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                              activeResultsSubTab === 'summary'
                                ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                            )}
                          >
                            <Sparkles size={13} />
                            <span>Executive Summary</span>
                          </button>

                          <button
                            onClick={() => setActiveResultsSubTab('gaps')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                              activeResultsSubTab === 'gaps'
                                ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                            )}
                          >
                            <AlertTriangle size={13} />
                            <span>Strengths &amp; Gaps</span>
                          </button>

                          <button
                            onClick={() => setActiveResultsSubTab('coaching')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                              activeResultsSubTab === 'coaching'
                                ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                            )}
                          >
                            <Target size={13} />
                            <span>Development Plan</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setActiveResultsSubTab('logs')}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                          activeResultsSubTab === 'logs'
                            ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                            : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                        )}
                      >
                        <FileText size={13} />
                        <span>Diagnostic Logs</span>
                      </button>

                      <button
                        onClick={() => { setActiveResultsSubTab('history'); loadAnalysisHistory(); }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                          activeResultsSubTab === 'history'
                            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text"
                        )}
                      >
                        <Clock size={13} />
                        <span>ประวัติการวิเคราะห์</span>
                      </button>
                    </div>
                    )}

                    {/* Tab display (admin) / Stacked scroll (shared view) */}
                    <div className="flex-1 min-h-[300px]">

                      {/* ── SHARED VIEW: stacked scroll layout ── */}
                      {isSharedView && (
                        <div className="space-y-8">
                          {isCoachTemplate(aiAnalysis.template_id) ? (
                            <>
                              {/* Coach Stacked: Summary Header */}
                              <div>
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-theme-border/40 pb-2">
                                  <Sparkles size={14} /> {aiAnalysis.template_id === 'coaching_fairness' ? 'Coaching & Fairness Summary' : '5-Lens Executive Summary'}
                                </h3>
                                {aiAnalysis.markdown_executive_summary ? (
                                  renderMarkdown(aiAnalysis.markdown_executive_summary)
                                ) : (
                                  <div className="text-theme-text-secondary text-xs italic">ไม่มีบทวิเคราะห์หลัก</div>
                                )}
                              </div>

                              {/* Coach Stacked: Value Mix */}
                              {aiAnalysis.value_mix && (() => {
                                const mix = normalizeValueMix(aiAnalysis.value_mix);
                                return (
                                  <div className="border-t border-theme-border/60 pt-6 space-y-4">
                                    <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-theme-border/40 pb-2">
                                      <Activity size={14} /> Value Mix & Contribution (สัดส่วนลักษณะงาน)
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 text-center">
                                        <span className="text-[10px] text-theme-text-secondary font-bold block mb-1">Strategic</span>
                                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{mix.strategic}%</span>
                                      </div>
                                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-center">
                                        <span className="text-[10px] text-theme-text-secondary font-bold block mb-1">Tactical</span>
                                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{mix.tactical}%</span>
                                      </div>
                                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-center">
                                        <span className="text-[10px] text-theme-text-secondary font-bold block mb-1">Operational</span>
                                        <span className="text-lg font-black text-amber-600 dark:text-amber-400">{mix.operational}%</span>
                                      </div>
                                      <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 text-center">
                                        <span className="text-[10px] text-theme-text-secondary font-bold block mb-1">Reactive</span>
                                        <span className="text-lg font-black text-rose-600 dark:text-rose-400">{mix.reactive}%</span>
                                      </div>
                                    </div>
                                    <div className="w-full h-3 bg-slate-200 dark:bg-theme-surface-tertiary rounded-full overflow-hidden flex font-mono text-[9px] font-bold text-white text-center">
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
                                    <p className="text-[10px] text-theme-text-secondary leading-relaxed">
                                      * <strong>S: Strategic</strong> (คิดค้น วางแผน วิเคราะห์), <strong>T: Tactical</strong> (ลงมือทำโครงการ นำความคิดไปปฏิบัติ), <strong>O: Operational</strong> (งานประจำ รูทีน), <strong>R: Reactive</strong> (งานแก้ปัญหาเฉพาะหน้า งานด่วนแทรก)
                                    </p>
                                  </div>
                                );
                              })()}


                              {/* Coach Stacked: Strengths & Dev Areas */}
                              <div className="border-t border-theme-border/60 pt-6 space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-theme-border/40 pb-2">
                                  <Award size={14} /> Key Strengths & Opportunities for Development
                                </h3>
                                <div className="space-y-4 text-xs sm:text-sm">
                                  <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-emerald-500 mb-2">Key Strengths</h4>
                                    <div className="space-y-2">
                                      {(aiAnalysis.strengths || []).map((s: any, i: number) => {
                                        const parsedS = parseJsonIfNeeded(s);
                                        const item = typeof parsedS === 'string' ? { title: parsedS, evidence: '', amplify: '' } : parsedS;
                                        return (
                                          <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                            <div className="font-bold text-theme-text">{i+1}. {item.title}</div>
                                            {item.evidence && <p className="text-theme-text-secondary mt-1 text-xs sm:text-sm leading-relaxed"><strong>Evidence:</strong> {item.evidence}</p>}
                                            {item.amplify && <p className="text-emerald-600 dark:text-emerald-400 mt-0.5 text-xs sm:text-sm leading-relaxed"><strong>Amplify:</strong> {item.amplify}</p>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-amber-500 mb-2">Opportunities for Development</h4>
                                    <div className="space-y-2">
                                      {(aiAnalysis.improvements || []).map((imp: any, i: number) => {
                                        const parsedImp = parseJsonIfNeeded(imp);
                                        const item = typeof parsedImp === 'string' ? { observation: parsedImp, evidence: '', recommended_action: '', success_indicator: '' } : parsedImp;
                                        return (
                                          <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                            <div className="font-bold text-theme-text">{i+1}. {item.observation}</div>
                                            {item.evidence && <p className="text-theme-text-secondary mt-1 text-xs sm:text-sm leading-relaxed"><strong>Evidence:</strong> {item.evidence}</p>}
                                            {item.recommended_action && <p className="text-theme-text mt-0.5 text-xs sm:text-sm leading-relaxed"><strong>Action:</strong> {item.recommended_action}</p>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Coach Stacked: Development Priorities */}
                              {aiAnalysis.development_plan?.priorities && (
                                <div className="border-t border-theme-border/60 pt-6 space-y-3">
                                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-theme-border/40 pb-2">
                                    <Target size={14} /> Action Priorities (ลำดับความสำคัญ)
                                  </h3>
                                  <div className="space-y-3 text-xs sm:text-sm">
                                    {aiAnalysis.development_plan.priorities.map((p: any, i: number) => (
                                      <div key={i} className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3">
                                        <div className="font-bold text-indigo-400">{i+1}. {p.title}</div>
                                        <p className="text-theme-text-secondary mt-1 leading-relaxed"><strong>Action:</strong> {p.specific_action}</p>
                                        <p className="text-emerald-400 leading-relaxed"><strong>Metric:</strong> {p.success_metric}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Coach Stacked: Well-being Indicator */}
                              {aiAnalysis.well_being_signal && (
                                <div className="border-t border-theme-border/60 pt-6 space-y-3">
                                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-theme-border/40 pb-2">
                                    <Activity size={14} /> Well-being Care Signal
                                  </h3>
                                  <div className={cn(
                                    "p-4 rounded-xl border text-xs sm:text-sm leading-relaxed",
                                    viewMode === 'employee' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                                    aiAnalysis.well_being_signal.level === 'red' ? "bg-rose-500/10 border-rose-500/30 text-rose-500" :
                                    aiAnalysis.well_being_signal.level === 'yellow' ? "bg-amber-500/10 border-amber-500/30 text-amber-500" :
                                    "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  )}>
                                    <div className="font-bold text-sm text-theme-text">
                                      Health Status: {viewMode === 'employee' ? 'Supportive Care Active' : (aiAnalysis.well_being_signal.risk_type === 'none' ? 'Perfect Health' : aiAnalysis.well_being_signal.risk_type || 'Healthy')}
                                    </div>
                                    <p className="text-theme-text-secondary mt-1"><strong>Observation:</strong> {aiAnalysis.well_being_signal.evidence}</p>
                                    {viewMode === 'manager' && aiAnalysis.well_being_signal.manager_action && (
                                      <p className="text-theme-text mt-1.5 pt-1.5 border-t border-theme-border/40">
                                        <strong>Recommended Action:</strong> {aiAnalysis.well_being_signal.manager_action}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Coach Stacked: Direct Message to Employee */}
                              {aiAnalysis.message_to_employee && (
                                <div className="border-t border-theme-border/60 pt-6 space-y-3">
                                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-theme-border/40 pb-2">
                                    <FileText size={14} /> Direct Message to Employee
                                  </h3>
                                  <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs italic text-theme-text leading-relaxed whitespace-pre-line">
                                    "{aiAnalysis.message_to_employee}"
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Standard Stacked */}
                              <div>
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-theme-border/40 pb-2">
                                  <Sparkles size={14} /> Executive Summary
                                </h3>
                                {aiAnalysis.markdown_executive_summary ? (
                                  renderMarkdown(aiAnalysis.markdown_executive_summary)
                                ) : (
                                  <div className="text-theme-text-secondary text-xs italic">ไม่มีบทวิเคราะห์หลัก</div>
                                )}
                              </div>

                              <div className="border-t border-theme-border/60 pt-6">
                                <h3 className="text-xs font-black text-theme-text uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                  <AlertTriangle size={14} className="text-amber-500" /> Strengths &amp; Execution Gaps
                                </h3>
                                <div className="space-y-6">
                                  <div>
                                    <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <CheckCircle2 size={14} /> Key Strengths Identified
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                      {(aiAnalysis.strengths || []).length === 0 ? (
                                        <div className="text-xs sm:text-sm text-theme-text-secondary italic">ไม่มีบันทึกข้อมูลสมรรถนะเด่น</div>
                                      ) : aiAnalysis.strengths.map((str: any, i: number) => {
                                        const parsedStr = parseJsonIfNeeded(str);
                                        const displayStr = typeof parsedStr === 'string' ? parsedStr : parsedStr.title || parsedStr.observation || JSON.stringify(parsedStr);
                                        return (
                                          <div key={i} className="flex items-start gap-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3.5 text-xs sm:text-sm text-theme-text leading-relaxed">
                                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono mt-0.5">{i + 1}.</span>
                                            <span>{displayStr}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <AlertTriangle size={14} /> Key Execution Gaps &amp; Redundancies
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                      {(aiAnalysis.improvements || []).length === 0 ? (
                                        <div className="text-xs sm:text-sm text-theme-text-secondary italic font-mono">ไม่มีประเด็นข้อบกพร่อง/ช่องว่างภาระงาน</div>
                                      ) : aiAnalysis.improvements.map((imp: any, i: number) => {
                                        const parsedImp = parseJsonIfNeeded(imp);
                                        const displayImp = typeof parsedImp === 'string' ? parsedImp : parsedImp.observation || parsedImp.title || JSON.stringify(parsedImp);
                                        return (
                                          <div key={i} className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3.5 text-xs sm:text-sm text-theme-text leading-relaxed">
                                            <span className="text-amber-600 dark:text-amber-400 font-extrabold font-mono mt-0.5">{i + 1}.</span>
                                            <span>{displayImp}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* ── ADMIN VIEW: tabbed layout ── */}
                      {!isSharedView && activeResultsSubTab === 'summary' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                          {aiAnalysis.markdown_executive_summary ? (
                            renderMarkdown(aiAnalysis.markdown_executive_summary)
                          ) : (
                            <div className="text-theme-text-secondary text-xs sm:text-sm leading-relaxed italic">
                              ไม่มีบทวิเคราะห์เนื้อหาประเมินความสอดคล้องหลัก
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tab panels for individual_coach template */}
                      {!isSharedView && isCoachTemplate(aiAnalysis.template_id) && (
                        <>
                          {/* Coaching Guide Tab */}
                          {activeResultsSubTab === 'coaching' && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                              <div className="flex justify-between items-center border-b border-theme-border/60 pb-3">
                                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                  <Target size={15} /> Coaching Conversation Guide (1:1 คู่มือคำถามชวนคุย)
                                </h4>
                                <button
                                  onClick={() => {
                                    const guide = aiAnalysis.coaching_guide;
                                    if (!guide) return;
                                    const text = `=== 1:1 Coaching Conversation Guide ===
[Opening]: ${guide.opening_question || ''}
[Exploration]:
${(guide.exploration_questions || []).map((q: string, i: number) => `${i+1}. ${q}`).join('\n')}
[Insight]:
${(guide.insight_questions || []).map((q: string, i: number) => `${i+1}. ${q}`).join('\n')}
[Commitment]: ${guide.commitment_question || ''}`;
                                    navigator.clipboard.writeText(text);
                                    showToast('คัดลอกคู่มือ Coaching Guide สำเร็จแล้ว!', 'success');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all"
                                >
                                  <Copy size={11} />
                                  <span>Copy Guide</span>
                                </button>
                              </div>

                              {aiAnalysis.coaching_guide ? (
                                <div className="space-y-4 text-xs leading-relaxed">
                                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm space-y-1.5">
                                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest font-mono">1. Opening &amp; Psychological Safety (Warm-up)</span>
                                    <p className="text-theme-text font-semibold">"{aiAnalysis.coaching_guide.opening_question}"</p>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 shadow-sm space-y-3">
                                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono block">2. Exploration &amp; Deep-Dive Questions (ชวนคุยเจาะลึกภาระงานจริง)</span>
                                    <div className="space-y-2">
                                      {(aiAnalysis.coaching_guide.exploration_questions || []).map((q: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                          <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">{i+1}</span>
                                          <span className="font-semibold text-theme-text">"{q}"</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15 shadow-sm space-y-3">
                                    <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest font-mono block">3. Prompting Insight (ชวนสะท้อนความตระหนักรู้และแนวคิด)</span>
                                    <div className="space-y-2">
                                      {(aiAnalysis.coaching_guide.insight_questions || []).map((q: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                          <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">{i+1}</span>
                                          <span className="font-semibold text-theme-text">"{q}"</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-pink-500/5 border border-pink-500/20 shadow-sm space-y-1.5">
                                    <span className="text-[9px] font-bold text-pink-500 uppercase tracking-widest font-mono">4. Closing &amp; Commitment to Action (ปิดและตั้งข้อตกลงร่วมกัน)</span>
                                    <p className="text-theme-text font-semibold">"{aiAnalysis.coaching_guide.commitment_question}"</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-theme-text-secondary italic">ไม่มีข้อมูลไกด์คำถามโค้ชชิ่ง</div>
                              )}
                            </div>
                          )}

                          {/* Action Plan & Strengths Tab */}
                          {activeResultsSubTab === 'gaps' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                              {/* Strengths */}
                              <div>
                                <h4 className="text-xs font-black text-emerald-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <CheckCircle2 size={15} /> Lens 1 &amp; 3: Key Strengths (จุดเด่นหลักและการต่อยอด)
                                </h4>
                                <div className="grid grid-cols-1 gap-3.5 text-xs sm:text-sm">
                                  {(aiAnalysis.strengths || []).length === 0 ? (
                                    <div className="text-xs sm:text-sm text-theme-text-secondary italic">ไม่มีบันทึกข้อมูลจุดเด่น</div>
                                  ) : (
                                    aiAnalysis.strengths.map((s: any, i: number) => {
                                      const parsedS = parseJsonIfNeeded(s);
                                      const item = typeof parsedS === 'string' ? { title: parsedS, evidence: '', amplify: '' } : parsedS;
                                      return (
                                        <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-2 shadow-sm">
                                          <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                            <span className="font-extrabold text-theme-text text-sm">{item.title}</span>
                                          </div>
                                          {item.evidence && (
                                            <p className="text-theme-text-secondary pl-7 leading-relaxed">
                                              <strong>Evidence:</strong> <span className="font-normal">{item.evidence}</span>
                                            </p>
                                          )}
                                          {item.amplify && (
                                            <p className="text-emerald-600 dark:text-emerald-400 pl-7 leading-relaxed">
                                              <strong>How to Amplify:</strong> <span className="font-semibold">{item.amplify}</span>
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>

                              {/* Improvements */}
                              <div className="border-t border-theme-border/60 pt-5">
                                <h4 className="text-xs sm:text-sm font-black text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <AlertTriangle size={15} /> Opportunities for Development (โอกาสพัฒนาและความสำเร็จ)
                                </h4>
                                <div className="grid grid-cols-1 gap-3.5 text-xs sm:text-sm">
                                  {(aiAnalysis.improvements || []).length === 0 ? (
                                    <div className="text-xs sm:text-sm text-theme-text-secondary italic">ไม่มีบันทึกข้อมูลจุดพัฒนา</div>
                                  ) : (
                                    aiAnalysis.improvements.map((imp: any, i: number) => {
                                      const parsedImp = parseJsonIfNeeded(imp);
                                      const item = typeof parsedImp === 'string' ? { observation: parsedImp, evidence: '', recommended_action: '', success_indicator: '' } : parsedImp;
                                      return (
                                        <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-2 shadow-sm">
                                          <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                            <span className="font-extrabold text-theme-text text-sm">{item.observation}</span>
                                          </div>
                                          {item.evidence && (
                                            <p className="text-theme-text-secondary pl-7 leading-relaxed">
                                              <strong>Evidence:</strong> <span className="font-normal">{item.evidence}</span>
                                            </p>
                                          )}
                                          {item.recommended_action && (
                                            <p className="text-theme-text pl-7 leading-relaxed">
                                              <strong>Action:</strong> <span className="font-semibold text-indigo-400">{item.recommended_action}</span>
                                            </p>
                                          )}
                                          {item.success_indicator && (
                                            <p className="text-amber-600 dark:text-amber-400 pl-7 leading-relaxed">
                                              <strong>Success Metric:</strong> <span className="font-semibold">{item.success_indicator}</span>
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>

                              {/* priorities */}
                              {aiAnalysis.development_plan?.priorities && (
                                <div className="border-t border-theme-border/60 pt-5">
                                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Target size={15} /> Action Priorities (3 ลำดับความสำคัญเร่งด่วน)
                                  </h4>
                                  <div className="grid grid-cols-1 gap-3 text-xs sm:text-sm">
                                    {(aiAnalysis.development_plan.priorities || []).map((p: any, i: number) => (
                                      <div key={i} className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center justify-between border-b border-indigo-500/10 pb-1.5">
                                          <span className="font-extrabold text-indigo-400 flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">{i+1}</span>
                                            <span>{p.title}</span>
                                          </span>
                                        </div>
                                        <p className="text-theme-text-secondary leading-relaxed"><strong>Why it matters:</strong> {p.why_matters}</p>
                                        <p className="text-theme-text leading-relaxed"><strong>Specific Action:</strong> {p.specific_action}</p>
                                        <p className="text-emerald-400 font-semibold leading-relaxed"><strong>Metric:</strong> {p.success_metric}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Risk & Well-being Tab */}
                          {activeResultsSubTab === ('well_being' as any) && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                              <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Activity size={15} /> Well-being Indicator &amp; Flags (วิเคราะห์สุขภาวะและ burnout risk)
                              </h4>

                              {aiAnalysis.well_being_signal ? (
                                <div className="space-y-4 text-xs sm:text-sm leading-relaxed">
                                  <div className={cn(
                                    "p-5 rounded-3xl border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden relative",
                                    aiAnalysis.well_being_signal.level === 'red' ? "bg-rose-500/10 border-rose-500/30" :
                                    aiAnalysis.well_being_signal.level === 'yellow' ? "bg-amber-500/10 border-amber-500/30" :
                                    "bg-emerald-500/10 border-emerald-500/30"
                                  )}>
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-widest block">Risk Assessment Level</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-2xl font-black text-theme-text capitalize">
                                          {aiAnalysis.well_being_signal.risk_type === 'none' ? 'Perfect Health' : aiAnalysis.well_being_signal.risk_type}
                                        </span>
                                        <span className={cn(
                                          "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider font-mono",
                                          aiAnalysis.well_being_signal.level === 'red' ? "bg-rose-500 text-white animate-pulse" :
                                          aiAnalysis.well_being_signal.level === 'yellow' ? "bg-amber-500 text-black" :
                                          "bg-emerald-500 text-white"
                                        )}>
                                          {aiAnalysis.well_being_signal.level.toUpperCase()}
                                        </span>
                                      </div>
                                      {aiAnalysis.well_being_signal.urgency_days && (
                                        <span className="text-xs text-rose-400 font-semibold block mt-1">
                                          ⚠️ แนะนำคุยเพื่อช่วยเหลือหรือชี้แจงภายใน {aiAnalysis.well_being_signal.urgency_days} วัน
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-center font-black text-4xl shrink-0">
                                      {aiAnalysis.well_being_signal.level === 'red' ? '🚨' : aiAnalysis.well_being_signal.level === 'yellow' ? '⚠️' : '✅'}
                                    </div>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-theme-surface dark:bg-theme-bg-page/60 border border-theme-border/80 space-y-2">
                                    <span className="text-[9px] font-bold text-theme-text-secondary uppercase tracking-widest font-mono block">Evidence (หลักฐานข้อบ่งชี้ทางพฤติกรรม)</span>
                                    <p className="font-light text-theme-text">{aiAnalysis.well_being_signal.evidence}</p>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 space-y-2">
                                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono block">Recommended Actions for Manager (คำสั่งการหัวหน้างาน)</span>
                                    <p className="font-semibold text-theme-text">{aiAnalysis.well_being_signal.manager_action}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-theme-text-secondary italic">ไม่มีข้อมูลวิเคราะห์สุขภาวะ</div>
                              )}
                            </div>
                          )}

                          {/* Direct Message Tab */}
                          {activeResultsSubTab === ('message' as any) && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                              <div className="flex justify-between items-center border-b border-theme-border/60 pb-3">
                                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText size={15} /> Empathetic Feedback Message (ร่างข้อความสำหรับส่งให้พนักงาน)
                                </h4>
                                <button
                                  onClick={() => {
                                    if (!aiAnalysis.message_to_employee) return;
                                    navigator.clipboard.writeText(aiAnalysis.message_to_employee);
                                    showToast('คัดลอกข้อความร่างเรียบร้อยแล้ว!', 'success');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all"
                                >
                                  <Copy size={11} />
                                  <span>Copy Message</span>
                                </button>
                              </div>

                              {aiAnalysis.message_to_employee ? (
                                <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/20 shadow-lg relative max-w-2xl mx-auto space-y-4 text-xs">
                                  <span className="text-5xl text-indigo-500/20 font-black absolute top-2 left-4 select-none pointer-events-none">“</span>
                                  
                                  <p className="leading-relaxed text-theme-text font-semibold relative z-10 pl-6 pr-4 whitespace-pre-line">
                                    {aiAnalysis.message_to_employee}
                                  </p>

                                  <div className="flex justify-end pt-2 text-[10px] text-theme-text-secondary font-mono italic">
                                    — สามารถส่งข้อความนี้ทาง Chat หรือ Email เพื่อเป็นการสนับสนุนหลังการพูดคุยแบบ 1:1
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-theme-text-secondary italic">ไม่มีข้อมูลร่างข้อความสำหรับพนักงาน</div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Standard tab panels for master template */}
                      {!isSharedView && !isCoachTemplate(aiAnalysis.template_id) && (
                        <>
                          {activeResultsSubTab === 'gaps' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                              <div>
                                <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <CheckCircle2 size={14} /> Core Strengths &amp; Achievements
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                  {(aiAnalysis.strengths || []).length === 0 ? (
                                    <div className="text-xs text-theme-text-secondary italic font-mono">ไม่มีข้อมูลจุดแข็ง</div>
                                  ) : (aiAnalysis.strengths || []).map((str: any, i: number) => {
                                    const parsedStr = parseJsonIfNeeded(str);
                                    const displayStr = typeof parsedStr === 'string' ? parsedStr : parsedStr.title || parsedStr.observation || JSON.stringify(parsedStr);
                                    return (
                                      <div key={i} className="flex items-start gap-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3.5 text-xs text-theme-text">
                                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono mt-0.5">{i + 1}.</span>
                                        <span>{displayStr}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <AlertTriangle size={14} /> Key Execution Gaps &amp; Redundancies
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                  {(aiAnalysis.improvements || []).length === 0 ? (
                                    <div className="text-xs text-theme-text-secondary italic font-mono">ไม่มีประเด็นข้อบกพร่อง/ช่องว่างภาระงาน</div>
                                  ) : aiAnalysis.improvements.map((imp: any, i: number) => {
                                    const parsedImp = parseJsonIfNeeded(imp);
                                    const displayImp = typeof parsedImp === 'string' ? parsedImp : parsedImp.observation || parsedImp.title || JSON.stringify(parsedImp);
                                    return (
                                      <div key={i} className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3.5 text-xs text-theme-text">
                                        <span className="text-amber-600 dark:text-amber-400 font-extrabold font-mono mt-0.5">{i + 1}.</span>
                                        <span>{displayImp}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
          )}
                          {/* Section 3: Development Plan */}
                          {aiAnalysis.development_plan && (
                            <div className="border-t border-theme-border/60 pt-6">
                              <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                <Target size={14} /> Strategic Development &amp; Action Plan
                              </h3>
                              {(() => {
                                const plan = aiAnalysis.development_plan;
                                if (typeof plan === 'object' && !Array.isArray(plan)) {
                                  return (
                                    <div className="space-y-3">
                                      {plan.short_term_90_days && (
                                        <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4">
                                          <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Short-Term Goals (90 Days)
                                          </div>
                                          <p className="text-xs text-theme-text leading-relaxed">{plan.short_term_90_days}</p>
                                        </div>
                                      )}
                                      {plan.long_term_goals && (
                                        <div className="bg-violet-500/5 border border-violet-500/15 rounded-2xl p-4">
                                          <div className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-violet-500"></span> Long-Term Career Goals
                                          </div>
                                          <p className="text-xs text-theme-text leading-relaxed">{plan.long_term_goals}</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                if (Array.isArray(plan)) {
                                  return (
                                    <div className="grid grid-cols-1 gap-3">
                                      {plan.map((act: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 text-xs text-theme-text">
                                          <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-mono font-bold text-[10px]">{i + 1}</div>
                                          <div className="flex-1 leading-relaxed">{act}</div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </>
                      )}

                      {/* ── ADMIN VIEW: tabbed layout ── */}
                      {!isSharedView && !isCoachTemplate(aiAnalysis.template_id) && activeResultsSubTab === 'summary' && (
                        <div className="space-y-4">
                          {aiAnalysis.markdown_executive_summary ? (
                            renderMarkdown(aiAnalysis.markdown_executive_summary)
                          ) : (
                            <div className="text-theme-text-secondary text-xs sm:text-sm leading-relaxed italic">
                              ไม่มีบทวิเคราะห์เนื้อหาประเมินความสอดคล้องหลัก
                            </div>
                          )}
                        </div>
                      )}

                      {!isSharedView && !isCoachTemplate(aiAnalysis.template_id) && activeResultsSubTab === 'gaps' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div>
                            <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <CheckCircle2 size={16} /> Key Strengths Identified
                            </h4>
                            <div className="grid grid-cols-1 gap-2.5">
                              {(aiAnalysis.strengths || []).length === 0 ? (
                                <div className="text-xs text-theme-text-secondary italic">ไม่มีบันทึกข้อมูลสมรรถนะเด่นเชิงสถวิทยา / No statistical strengths identified.</div>
                              ) : (
                                aiAnalysis.strengths.map((str: any, i: number) => {
                                  const parsedStr = parseJsonIfNeeded(str);
                                  const displayStr = typeof parsedStr === 'string' ? parsedStr : parsedStr.title || parsedStr.observation || JSON.stringify(parsedStr);
                                  return (
                                    <div key={i} className="flex items-start gap-2.5 bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10 rounded-2xl p-3.5 shadow-sm text-xs text-theme-text">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono mt-0.5">{i + 1}.</span>
                                      <span>{displayStr}</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div className="border-t border-theme-border/60 pt-6">
                            <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <AlertTriangle size={16} /> Key Execution Gaps &amp; Redundancies
                            </h4>
                            <div className="grid grid-cols-1 gap-2.5">
                              {(aiAnalysis.improvements || []).length === 0 ? (
                                <div className="text-xs text-theme-text-secondary italic">ไม่มีประเด็นข้อบกพร่อง/ช่องว่างภาระงาน / No execution gaps identified.</div>
                              ) : (
                                aiAnalysis.improvements.map((imp: any, i: number) => {
                                  const parsedImp = parseJsonIfNeeded(imp);
                                  const displayImp = typeof parsedImp === 'string' ? parsedImp : parsedImp.observation || parsedImp.title || JSON.stringify(parsedImp);
                                  return (
                                    <div key={i} className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-200 dark:border-amber-500/10 rounded-2xl p-3.5 shadow-sm text-xs text-theme-text">
                                      <span className="text-amber-600 dark:text-amber-400 font-extrabold font-mono mt-0.5">{i + 1}.</span>
                                      <span>{displayImp}</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {!isSharedView && !isCoachTemplate(aiAnalysis.template_id) && activeResultsSubTab === 'coaching' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                            <Target size={16} /> Strategic Development &amp; Action Plan
                          </h4>
                          {(() => {
                            const plan = aiAnalysis.development_plan;
                            if (!plan || (typeof plan === 'object' && !Array.isArray(plan) && Object.keys(plan).length === 0)) {
                              return <div className="text-xs text-theme-text-secondary italic font-mono">ไม่มีข้อแนะนำการพัฒนาพนักงานในประเด็นนี้</div>;
                            }
                            if (typeof plan === 'object' && !Array.isArray(plan)) {
                              return (
                                <div className="space-y-4">
                                  {plan.short_term_90_days && (
                                    <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4">
                                      <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                        Short-Term Goals (90 Days)
                                      </div>
                                      <p className="text-xs text-theme-text leading-relaxed">{plan.short_term_90_days}</p>
                                    </div>
                                  )}
                                  {plan.long_term_goals && (
                                    <div className="bg-violet-500/5 border border-violet-500/15 rounded-2xl p-4">
                                      <div className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                                        Long-Term Career Goals
                                      </div>
                                      <p className="text-xs text-theme-text leading-relaxed">{plan.long_term_goals}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            if (Array.isArray(plan)) {
                              return (
                                <div className="grid grid-cols-1 gap-3">
                                  {plan.map((act: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 shadow-sm text-xs text-theme-text">
                                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-mono font-bold text-[10px]">{i + 1}</div>
                                      <div className="flex-1 leading-relaxed">{act}</div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      {!isSharedView && activeResultsSubTab === 'logs' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-theme-surface-tertiary dark:bg-theme-surface-secondary/60 border border-theme-border/40 rounded-2xl p-4 space-y-2">
                              <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Telemetry Parameters</span>
                              <div className="text-xs text-theme-text font-mono">
                                Date Scope: {aiAnalysis.start_date} to {aiAnalysis.end_date}
                              </div>
                              <div className="text-xs text-theme-text-secondary font-mono">
                                Total log volume: {aiAnalysis.logs_count || 'N/A'} entries | Effort hours: {aiAnalysis.total_hours ? Number(aiAnalysis.total_hours).toFixed(1) : 'N/A'}h
                              </div>
                            </div>
                            
                            <div className="bg-theme-surface-tertiary dark:bg-theme-surface-secondary/60 border border-theme-border/40 rounded-2xl p-4 space-y-2">
                              <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">LLM Processing Core</span>
                              <div className="text-xs text-theme-text font-mono flex items-center gap-1.5">
                                <Cpu size={12} className="text-indigo-600 dark:text-indigo-400" />
                                <span>{aiAnalysis.model || 'N/A'}</span>
                              </div>
                              <div className="text-[10px] text-theme-text-secondary font-mono">
                                Provider payload: {aiAnalysis.provider || 'unknown'}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider block">Audit Diagnostic Step Logs</span>
                            <div className="bg-theme-surface-tertiary dark:bg-theme-bg-page border border-theme-border rounded-2xl p-4 h-[200px] overflow-y-auto font-mono text-[11px] leading-relaxed text-theme-text-secondary flex flex-col gap-2 shadow-inner select-text">
                              <div className="flex items-start gap-3 border-l border-emerald-500/40 pl-3">
                                <span className="text-theme-text-secondary font-bold shrink-0">[{new Date(aiAnalysis.created_at).toLocaleTimeString()}]</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-bold">[INFO] Performance diagnostic process completed.</span>
                              </div>
                              <div className="flex items-start gap-3 border-l border-indigo-500/40 pl-3">
                                <span className="text-theme-text-secondary font-bold shrink-0">[{new Date(aiAnalysis.created_at).toLocaleTimeString()}]</span>
                                <span className="text-theme-text-secondary">Fetched employee activities matching scope successfully.</span>
                              </div>
                              <div className="flex items-start gap-3 border-l border-indigo-500/40 pl-3">
                                <span className="text-theme-text-secondary font-bold shrink-0">[{new Date(aiAnalysis.created_at).toLocaleTimeString()}]</span>
                                <span className="text-theme-text-secondary">Resolved LLM configurations. Cached and stored.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeResultsSubTab === 'history' && !isSharedView && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-theme-text uppercase tracking-wider flex items-center gap-2">
                            <Clock size={16} /> ประวัติรายงานย้อนหลัง (Historical Diagnostics Logs)
                          </h4>

                          {isLoadingHistory ? (
                            <div className="flex justify-center p-8">
                              <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={24} />
                            </div>
                          ) : analysisHistory.length === 0 ? (
                            <div className="text-center p-12 rounded-2xl bg-theme-surface-tertiary dark:bg-theme-surface-secondary/30 border border-theme-border/80 text-xs text-theme-text-secondary italic">
                              ไม่มีประวัติการประเมินมาก่อน / No history logs found
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
                              {analysisHistory.map((record) => (
                                <div 
                                  key={record.id} 
                                  className={cn(
                                    "p-4 rounded-2xl border text-xs flex flex-col gap-3 justify-between transition-all hover:border-indigo-500/40 cursor-pointer",
                                    aiAnalysis?.id === record.id 
                                      ? "bg-indigo-500/5 border-indigo-500/30 shadow-indigo-500/5 shadow-md"
                                      : "bg-theme-surface dark:bg-theme-surface-secondary/50 border-theme-border/80"
                                  )}
                                  onClick={() => loadHistoryRecord(record)}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-0.5">
                                      <span className="font-bold text-theme-text font-mono tracking-wide">
                                        📅 {record.start_date} ~ {record.end_date}
                                      </span>
                                      <span className="text-[10px] text-theme-text-secondary block">
                                        วิเคราะห์เมื่อ: {new Date(record.created_at).toLocaleString('th-TH')}
                                      </span>
                                    </div>

                                    {record.acknowledged_at && (
                                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider font-mono">
                                        SIGNED
                                      </span>
                                    )}
                                  </div>

                                  <div className="bg-theme-surface-tertiary dark:bg-theme-bg-page/60 p-2 rounded-xl border border-theme-border/60 flex items-center justify-around font-mono text-[10px] font-bold">
                                    <div className="text-center">
                                      <span className="text-theme-text-secondary uppercase block text-[8px] tracking-widest mb-0.5">ALIGNMENT</span>
                                      <span className="text-indigo-600 dark:text-indigo-400">{record.jd_alignment_score || 0}%</span>
                                    </div>
                                    <div className="text-center border-l border-theme-border/80 pl-3">
                                      <span className="text-theme-text-secondary uppercase block text-[8px] tracking-widest mb-0.5">BURNOUT</span>
                                      <span className={cn(
                                        (record.burnout_risk_score || 0) > 70 ? "text-rose-600 dark:text-rose-400" :
                                        (record.burnout_risk_score || 0) > 40 ? "text-amber-600 dark:text-amber-400" :
                                        "text-emerald-600 dark:text-emerald-400"
                                      )}>
                                        {record.burnout_risk_score || 0}%
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between border-t border-theme-border/60 pt-3" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => toggleHistoryRecordShare(record.id, record.is_public)}
                                        className={cn(
                                          "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                                          record.is_public
                                            ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                            : "bg-theme-surface-tertiary dark:bg-theme-surface-tertiary text-theme-text-secondary border border-theme-border/50 hover:text-theme-text dark:hover:text-theme-text"
                                        )}
                                      >
                                        {record.is_public ? <Globe size={11} /> : <Lock size={11} />}
                                        <span>{record.is_public ? 'Public' : 'Private'}</span>
                                      </button>

                                      {record.is_public && record.share_token && (
                                        <button
                                          onClick={() => copyHistoryShareLink(record.share_token)}
                                          className="p-1.5 rounded-lg bg-theme-surface-tertiary dark:bg-theme-surface-tertiary text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text transition-colors border border-theme-border/50"
                                          title="Copy URL Share Link to Clipboard"
                                        >
                                          <Copy size={11} />
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button 
                                        className="p-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors border border-rose-500/20"
                                        onClick={() => setDeleteRecordId(record.id)}
                                        title="ลบรายงานนี้ / Delete report"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                      <button 
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-theme-text font-black uppercase tracking-wider transition-all text-[10px] shadow-lg shadow-indigo-600/10"
                                        onClick={() => loadHistoryRecord(record)}
                                      >
                                        LOAD
                                      </button>
                                    </div>

                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Step back control */}
                    {!isSharedView && (
                      <div className="border-t border-theme-border/60 pt-4 flex justify-between items-center text-xs">
                        <button
                          onClick={() => setStep(1)}
                          className="px-4 py-2 rounded-xl bg-theme-surface-tertiary dark:bg-theme-surface-secondary border border-theme-border hover:border-theme-border dark:hover:border-theme-border text-theme-text-secondary hover:text-theme-text dark:hover:text-theme-text text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                        >
                          <ArrowLeft size={12} />
                          <span>กลับไปขั้นตอน Setup</span>
                        </button>

                        <button
                          onClick={() => handleRunAiAnalysis(true)}
                          className="px-4 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:text-indigo-700 dark:hover:text-indigo-300 font-black uppercase text-[10px] tracking-wider transition-all flex items-center gap-1.5"
                        >
                          <RefreshCw size={12} />
                          <span>สั่งวิเคราะห์สดอีกครั้ง (Force Refresh)</span>
                        </button>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            )}

            {/* If no analysis runs exist yet and we are in step 3 */}
            {step === 3 && !aiAnalysis && (
              <div className="w-full max-w-4xl mx-auto p-6 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/90 border border-theme-border/80 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 space-y-6">
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="flex items-center justify-between pb-4 border-b border-theme-border/60">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-black text-theme-text uppercase tracking-wider">
                      ประวัติการประเมินย้อนหลัง (HISTORICAL DIAGNOSTICS LOGS)
                    </h3>
                  </div>
                  
                  <button
                    onClick={() => setStep(1)}
                    className="px-3.5 py-1.5 rounded-xl bg-theme-surface-tertiary dark:bg-theme-surface-secondary border border-theme-border hover:border-theme-border dark:hover:border-theme-border text-theme-text-secondary text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    ย้อนกลับ / Setup Page
                  </button>
                </div>

                <div className="space-y-4">
                  {isLoadingHistory ? (
                    <div className="flex justify-center p-12">
                      <Loader2 className="animate-spin text-indigo-400" size={32} />
                    </div>
                  ) : analysisHistory.length === 0 ? (
                    <div className="text-center p-12 rounded-3xl bg-theme-surface-secondary dark:bg-theme-surface-secondary/30 border border-theme-border/80 text-xs text-theme-text-secondary italic space-y-4">
                      <div>ไม่มีประวัติการประเมินมาก่อนสำหรับพนักงานรายนี้ / No history logs found for this employee</div>
                      <button
                        onClick={() => setStep(1)}
                        className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black uppercase tracking-wider text-theme-text shadow-xl shadow-indigo-600/20 transition-all inline-block not-italic"
                      >
                        กำหนดตัวแปรและเริ่มวิเคราะห์ (Setup Page)
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                      {analysisHistory.map((record) => (
                        <div 
                          key={record.id} 
                          className="p-5 rounded-2xl border text-xs flex flex-col gap-4 justify-between transition-all hover:border-indigo-500/40 bg-theme-surface-secondary dark:bg-theme-surface-secondary/50 border-theme-border/80"
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <span className="font-bold text-theme-text font-mono tracking-wide text-sm">
                                📅 {record.start_date} ~ {record.end_date}
                              </span>
                              <span className="text-[10px] text-theme-text-secondary block">
                                วิเคราะห์เมื่อ: {new Date(record.created_at).toLocaleString('th-TH')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {record.acknowledged_at && (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider font-mono">
                                  SIGNED
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 bg-theme-surface/80 dark:bg-theme-bg-page/60 p-3 rounded-xl border border-theme-border/60 font-mono text-xs font-bold text-center">
                            <div>
                              <span className="text-theme-text-secondary uppercase block text-[8px] tracking-widest mb-0.5">ALIGNMENT</span>
                              <span className="text-indigo-400 text-sm">{record.jd_alignment_score || 0}%</span>
                            </div>
                            <div className="border-l border-theme-border/80">
                              <span className="text-theme-text-secondary uppercase block text-[8px] tracking-widest mb-0.5">BURNOUT</span>
                              <span className={cn(
                                "text-sm",
                                (record.burnout_risk_score || 0) > 70 ? "text-rose-400" :
                                (record.burnout_risk_score || 0) > 40 ? "text-amber-400" :
                                "text-emerald-400"
                              )}>
                                {record.burnout_risk_score || 0}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-theme-border/60 pt-3">
                            <div className="flex items-center gap-2">
                              {/* Public / Private Toggle */}
                              <button
                                onClick={() => toggleHistoryRecordShare(record.id, record.is_public)}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                                  record.is_public
                                    ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20"
                                    : "bg-theme-surface-tertiary dark:bg-theme-surface-tertiary text-theme-text-secondary border border-theme-border/50 hover:text-theme-text"
                                )}
                              >
                                {record.is_public ? <Globe size={11} /> : <Lock size={11} />}
                                <span>{record.is_public ? 'Public' : 'Private'}</span>
                              </button>

                              {record.is_public && record.share_token && (
                                <button
                                  onClick={() => copyHistoryShareLink(record.share_token)}
                                  className="p-1.5 rounded-lg bg-theme-surface-tertiary dark:bg-theme-surface-tertiary text-theme-text-secondary hover:text-theme-text transition-colors border border-theme-border/50"
                                  title="Copy URL Share Link to Clipboard"
                                >
                                  <Copy size={11} />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                className="p-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors border border-rose-500/20"
                                onClick={() => setDeleteRecordId(record.id)}
                                title="ลบรายงานนี้ / Delete report"
                              >
                                <Trash2 size={11} />
                              </button>
                              <button 
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-theme-text font-black uppercase tracking-wider transition-all text-[10px] shadow-lg shadow-indigo-600/10"
                                onClick={() => loadHistoryRecord(record)}
                              >
                                LOAD REPORT
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* SIGN-OFF ACKNOWLEDGMENT MODAL */}
      {/* ========================================================================= */}
      {showAckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border/90 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
            
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="text-indigo-400" size={18} />
                <h3 className="text-sm font-black text-theme-text uppercase tracking-wider">
                  AI Enhance Verification Sign-Off
                </h3>
              </div>
              <button 
                onClick={() => setShowAckModal(false)}
                className="text-theme-text-secondary hover:text-theme-text transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-theme-text leading-relaxed">
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/10 text-indigo-700 dark:text-indigo-300 flex items-start gap-2.5">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>การลงนามรับทราบนี้ เป็นการยืนยันการรับทราบข้อมูลวิเคราะห์สมรรถนะ แผนการดำเนินงาน และแผนพัฒนาประสิทธิภาพนี้เพื่อประโยชน์ในการเพิ่มศักยภาพพนักงาน</span>
              </div>
              
              <div className="bg-theme-surface-tertiary dark:bg-theme-surface-secondary/60 p-3.5 rounded-2xl border border-theme-border/80 space-y-2 text-theme-text-secondary">
                <div>ผู้ลงนาม: <span className="text-theme-text font-bold">{sessionUser?.name || 'AI Specialist'}</span></div>
                <div>ตำแหน่งลงนาม: <span className="text-theme-text font-bold">{sessionUser?.role === 'admin' ? 'AI Enhance Administrator / Super Admin' : 'AI Enhance Associate'}</span></div>
                <div>รหัสพนักงาน: <span className="text-theme-text-secondary font-mono">{sessionUser?.empId || 'N/A'}</span></div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAckModal(false)}
                className="px-4 py-2 rounded-xl text-theme-text-secondary hover:text-theme-text text-[10px] font-black uppercase tracking-wider"
              >
                ยกเลิก (Cancel)
              </button>

              <button
                type="button"
                onClick={handleAcknowledgeAnalysis}
                disabled={isSubmittingAck}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[10px] font-black uppercase text-theme-text shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-1.5"
              >
                {isSubmittingAck ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                <span>ลงนามยืนยันข้อมูล</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {deleteRecordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-theme-surface dark:bg-theme-surface-secondary border border-theme-border/90 shadow-2xl space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-rose-500 pb-3 border-b border-theme-border/60">
              <AlertTriangle size={20} />
              <h3 className="text-sm font-black uppercase tracking-wider">
                ยืนยันการลบประวัติการวิเคราะห์
              </h3>
            </div>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              คุณต้องการลบประวัติการประเมินนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteRecordId(null)}
                className="px-4 py-2 rounded-xl text-theme-text-secondary hover:text-theme-text text-[10px] font-black uppercase tracking-wider"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                onClick={handleDeleteRecord}
                disabled={isDeletingRecord}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-[10px] font-black uppercase text-theme-text shadow-xl shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                {isDeletingRecord ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                <span>ยืนยันลบข้อมูล</span>
              </button>
            </div>
          </div>
        </div>
      )}


    </AppLayout>
  );
}
