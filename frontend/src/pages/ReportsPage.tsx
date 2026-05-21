import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { 
  FileSpreadsheet, Search, Clock, Award, Layers, ChevronDown, ChevronUp,
  TrendingUp, User as UserIcon, Users, Edit3, Eye,
  Brain, Sparkles, AlertTriangle, Activity, FileText, CheckCircle2, Target, RefreshCw, PlusCircle, Save, Loader2,
  Globe, Lock, Printer, Copy, ExternalLink, Share2, X, UserCheck
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

  // --- AI DIAGNOSTICS STATES ---
  const [individualSubTab, setIndividualSubTab] = useState<'charts' | 'ai'>('charts');
  const [jdText, setJdText] = useState('');
  const [keyResponsibilities, setKeyResponsibilities] = useState<{ category: string; weight: number }[]>([]);
  const [jdSource, setJdSource] = useState<'uploaded' | 'ai_recommended' | 'manual_entry'>('manual_entry');
  const [customPosition, setCustomPosition] = useState('');
  const [isJdEditing, setIsJdEditing] = useState(false);
  const [isSavingJd, setIsSavingJd] = useState(false);
  const [isRecommendingJd, setIsRecommendingJd] = useState(false);
  
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [activeAiSubTab, setActiveAiSubTab] = useState<'summary' | 'gaps' | 'coaching' | 'logs' | 'history'>('summary');
  const [aiStep, setAiStep] = useState<number>(0);
  const [aiStepLogs, setAiStepLogs] = useState<{ time: string; message: string; type: 'info' | 'success' | 'error' }[]>([]);
  const [aiProvider, setAiProvider] = useState<string>('openrouter');
  const [aiModel, setAiModel] = useState<string>('');
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // --- Acknowledge, Share & Print Preview State ---
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isAckConfirmOpen, setIsAckConfirmOpen] = useState(false);
  const [isTogglingShare, setIsTogglingShare] = useState(false);
  const [isShareSettingsOpen, setIsShareSettingsOpen] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedUser, setSharedUser] = useState<any>(null);
  const [sharedReport, setSharedReport] = useState<any>(null);

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

  // Load JD and Cached AI Analysis on selectedUser / Date Range change
  useEffect(() => {
    const loadJdAndAnalysis = async () => {
      if (!selectedUser) return;
      
      let startDate = '';
      let endDate = '';
      const todayStr = formatDateToYMD(new Date());
      
      if (dateFilter === 'this-week') {
        startDate = dateBoundaries.week.start;
        endDate = dateBoundaries.week.end;
      } else if (dateFilter === 'this-month') {
        startDate = dateBoundaries.month.start;
        endDate = dateBoundaries.month.end;
      } else if (dateFilter === 'custom') {
        startDate = customStart || dateBoundaries.month.start;
        endDate = customEnd || dateBoundaries.month.end;
      } else {
        startDate = '2020-01-01';
        endDate = todayStr;
      }

      try {
        // Fetch JD
        const { data: jdData } = await supabase
          .from('tb_user_jd')
          .select('*')
          .eq('user_id', selectedUser)
          .maybeSingle();

        if (jdData) {
          setJdText(jdData.jd_text);
          setKeyResponsibilities(jdData.key_responsibilities || []);
          setJdSource(jdData.jd_source);
          setCustomPosition(jdData.position_name || '');
        } else {
          setJdText('');
          setKeyResponsibilities([]);
          setJdSource('manual_entry');
          const userObj = usersList.find(u => u.id === selectedUser);
          setCustomPosition(userObj?.position || '');
        }

        // Fetch Cached AI Analysis (within last 24h)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const { data: cached } = await supabase
          .from('tb_ai_individual_analysis')
          .select('*')
          .eq('user_id', selectedUser)
          .eq('start_date', startDate)
          .eq('end_date', endDate)
          .gte('created_at', yesterday.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached) {
          // Get logs count and total hours for this range
          const { data: logs } = await supabase
            .from('col_worklog')
            .select('total_hours')
            .eq('user_id', selectedUser)
            .gte('work_date', startDate)
            .lte('work_date', endDate);
          const totalHours = (logs || []).reduce((sum, e) => sum + Number(e.total_hours || 0), 0);

          // Get active model
          const { data: modelConfig } = await supabase
            .from('tb_system_config')
            .select('config_value')
            .eq('config_key', 'ai_model')
            .maybeSingle();
          const activeModel = modelConfig?.config_value || 'openai/gpt-oss-20b:free';

          setAiAnalysis({
            jd_alignment_score: cached.jd_alignment_score,
            burnout_risk_score: cached.burnout_risk_score,
            workload_allocation: cached.actual_vs_target,
            strengths: cached.strengths,
            improvements: cached.improvements,
            development_plan: cached.development_plan,
            markdown_executive_summary: cached.raw_ai_report,
            created_at: cached.created_at,
            isCached: true,
            model: activeModel,
            start_date: startDate,
            end_date: endDate,
            total_hours: totalHours,
            logs_count: logs?.length || 0,
            weights: jdData?.key_responsibilities || []
          });
        } else {
          setAiAnalysis(null);
        }

        // Always pull fresh history for the sidebar/list as well!
        loadAnalysisHistory();
      } catch (err) {
        console.error('Error fetching JD or analysis cache:', err);
      }
    };

    loadJdAndAnalysis();
  }, [selectedUser, dateFilter, customStart, customEnd, dateBoundaries, usersList]);

  // Recommend JD by calling the real AI API with position + current target weights
  const recommendJd = async () => {
    const targetPos = customPosition || usersList.find(u => u.id === selectedUser)?.position || '';
    setIsRecommendingJd(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: {
          action: 'recommend_jd',
          position: targetPos || 'General Staff',
          target_weights: keyResponsibilities,  // send current weights so AI respects them
        }
      });

      if (error) throw new Error(error.message || 'AI recommendation failed');

      if (data?.jd_text) setJdText(data.jd_text);
      if (data?.key_responsibilities?.length > 0) setKeyResponsibilities(data.key_responsibilities);
      setJdSource('ai_recommended');

      const engineLabel = data?.actualModel ? ` (${data.actualModel})` : '';
      showToast(`AI แนะนำ JD สำหรับตำแหน่ง "${targetPos || 'General Staff'}" เรียบร้อย${engineLabel}`, 'success');
    } catch (err: any) {
      console.error('JD recommend error:', err);
      showToast('ไม่สามารถขอคำแนะนำ JD จาก AI ได้: ' + err.message, 'error');
    } finally {
      setIsRecommendingJd(false);
    }
  };

  // Save Job Description to Database
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

      // Sync position back to user profile so that HRMS overrides display correctly across system
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
          // Update the local usersList state so the UI reflects the change immediately
          setUsersList(prev => prev.map(u => u.id === selectedUser ? { ...u, position: customPosition } : u));
        }
      }

      showToast('Job Description saved successfully', 'success');
      setIsJdEditing(false);
    } catch (err: any) {
      console.error('Error saving JD:', err);
      showToast('Failed to save Job Description: ' + err.message, 'error');
    } finally {
      setIsSavingJd(false);
    }
  };

  // Execute AI performance diagnostics endpoint
  const handleRunAiAnalysis = async (forceRefresh = false) => {
    if (!selectedUser) return;
    
    // Validate JD and weights
    const totalWeight = keyResponsibilities.reduce((sum, item) => sum + item.weight, 0);
    if (!jdText.trim()) {
      showToast('Please save a Job Description first.', 'error');
      return;
    }
    if (totalWeight !== 100) {
      showToast(`Target weights must total exactly 100% (currently ${totalWeight}%).`, 'error');
      return;
    }

    let startDate = '';
    let endDate = '';
    const todayStr = formatDateToYMD(new Date());
    
    if (dateFilter === 'this-week') {
      startDate = dateBoundaries.week.start;
      endDate = dateBoundaries.week.end;
    } else if (dateFilter === 'this-month') {
      startDate = dateBoundaries.month.start;
      endDate = dateBoundaries.month.end;
    } else if (dateFilter === 'custom') {
      startDate = customStart || dateBoundaries.month.start;
      endDate = customEnd || dateBoundaries.month.end;
    } else {
      startDate = '2020-01-01';
      endDate = todayStr;
    }

    setIsAiAnalyzing(true);
    setAiStep(1);
    setAiStepLogs([
      { time: new Date().toLocaleTimeString(), message: 'Initiating AI Performance Diagnostics...', type: 'info' },
      { time: new Date().toLocaleTimeString(), message: `Validating JD text & key weights: Total weights = ${totalWeight}%`, type: 'info' }
    ]);

    try {
      // Step 2: Fetch worklogs from database
      await new Promise(r => setTimeout(r, 800));
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
      await new Promise(r => setTimeout(r, 800));
      setAiStep(3);
      setAiStepLogs(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString(), message: `Found ${logs?.length || 0} worklog records totaling ${totalHours.toFixed(1)} effort hours.`, type: 'info' },
        { time: new Date().toLocaleTimeString(), message: 'Calculating actual task category distributions vs target weights.', type: 'info' }
      ]);
      
      // Step 4: Connecting to LLM API
      await new Promise(r => setTimeout(r, 800));
      setAiStep(4);
      
      // Query system config to see active model and active provider dynamically
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
          force_refresh: forceRefresh
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
      showToast('Performance diagnostics complete!', 'success');
      // Update history logs in background
      loadAnalysisHistory();
    } catch (err: any) {
      console.error('Error running performance diagnostics:', err);
      setAiStepLogs(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString(), message: `Execution failed: ${err.message}`, type: 'error' }
      ]);
      showToast('Diagnostics Error: ' + err.message, 'error');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Load analysis history for selected user
  const loadAnalysisHistory = async () => {
    if (!selectedUser) return;
    try {
      setIsLoadingHistory(true);
      const { data, error } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('user_id', selectedUser)
        .order('analysis_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      setAnalysisHistory(data || []);
    } catch (err: any) {
      showToast('\u0e42\u0e2b\u0e25\u0e14\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + err.message, 'error');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load a historical record into the current analysis view
  const loadHistoryRecord = (record: any) => {
    setAiAnalysis({
      id: record.id,
      share_token: record.share_token,
      is_public: record.is_public,
      acknowledged_at: record.acknowledged_at,
      acknowledged_by: record.acknowledged_by,
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
    setActiveAiSubTab('summary');
    showToast('โหลดผลวิเคราะห์ย้อนหลังสำเร็จ', 'success');
  };

  // Load public shared report
  const loadSharedReport = async (token: string) => {
    try {
      setIsLoading(true);
      // Fetch report by share_token
      const { data: report, error: reportErr } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();

      if (reportErr) throw reportErr;
      if (!report) {
        showToast('ไม่พบรายงานที่แชร์ หรือรายงานหมดอายุแล้ว / Shared report not found or expired', 'error');
        setIsLoading(false);
        return;
      }

      // Check expiry
      if (report.expires_at && new Date(report.expires_at) < new Date()) {
        showToast('รายงานที่แชร์หมดอายุการใช้งานแล้ว / Shared report has expired', 'error');
        setIsLoading(false);
        return;
      }

      // Fetch user details associated with the report
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', report.user_id)
        .maybeSingle();

      setSharedReport(report);
      setSharedUser(userData);

      // Populate aiAnalysis state so we reuse the exact same sub-components!
      setAiAnalysis({
        id: report.id,
        share_token: report.share_token,
        is_public: report.is_public,
        acknowledged_at: report.acknowledged_at,
        acknowledged_by: report.acknowledged_by,
        jd_alignment_score: report.jd_alignment_score,
        burnout_risk_score: report.burnout_risk_score,
        workload_allocation: report.actual_vs_target,
        strengths: report.strengths,
        improvements: report.improvements,
        development_plan: report.development_plan,
        markdown_executive_summary: report.raw_ai_report,
        created_at: report.created_at,
        isCached: true,
        model: report.engine_model || 'Historical Record',
        start_date: report.start_date,
        end_date: report.end_date,
        total_hours: null,
        logs_count: null,
        weights: []
      });

      // Switch sub-tabs automatically to show AI report
      setIndividualSubTab('ai');
      setActiveAiSubTab('summary');
    } catch (err: any) {
      console.error('Error loading shared report:', err);
      showToast('ไม่สามารถดึงข้อมูลรายงานที่แชร์ได้: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const token = queryParams.get('share');
    if (token) {
      setIsSharedView(true);
      loadSharedReport(token);
    }
  }, []);

  // Handle Acknowledge analysis
  const handleAcknowledgeAnalysis = async () => {
    if (!aiAnalysis || !aiAnalysis.id) {
      showToast('ไม่พบข้อมูลการวิเคราะห์ที่จะลงนาม', 'error');
      return;
    }
    try {
      setIsAcknowledging(true);
      const ackTime = new Date().toISOString();
      const ackUser = sessionUser?.id;

      if (!ackUser) {
        showToast('เซสชันผู้ใช้หมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
        return;
      }

      const { data, error } = await supabase
        .from('tb_ai_individual_analysis')
        .update({
          acknowledged_at: ackTime,
          acknowledged_by: ackUser
        })
        .eq('id', aiAnalysis.id)
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Update local state
      setAiAnalysis((prev: any) => ({
        ...prev,
        acknowledged_at: data.acknowledged_at,
        acknowledged_by: data.acknowledged_by
      }));
      
      showToast('ลงนามรับทราบผลการวิเคราะห์เรียบร้อยแล้ว!', 'success');
      // Refresh history to update indicators
      loadAnalysisHistory();
    } catch (err: any) {
      console.error('Error acknowledging analysis:', err);
      showToast('การลงนามล้มเหลว: ' + err.message, 'error');
    } finally {
      setIsAcknowledging(false);
      setIsAckConfirmOpen(false);
    }
  };

  // Toggle Share visibility
  const handleToggleShareAnalysis = async () => {
    if (!aiAnalysis || !aiAnalysis.id) {
      showToast('ไม่พบข้อมูลการวิเคราะห์ที่จะแชร์', 'error');
      return;
    }
    try {
      setIsTogglingShare(true);
      const newIsPublic = !aiAnalysis.is_public;
      
      const { data, error } = await supabase
        .from('tb_ai_individual_analysis')
        .update({
          is_public: newIsPublic
        })
        .eq('id', aiAnalysis.id)
        .select('*')
        .single();
        
      if (error) throw error;
      
      // Update local state
      setAiAnalysis((prev: any) => ({
        ...prev,
        is_public: data.is_public
      }));
      
      const action = data.is_public 
        ? 'เปิดการแชร์รายงานนี้สู่สาธารณะเรียบร้อย!' 
        : 'ปิดการแชร์รายงานนี้สู่สาธารณะเรียบร้อย!';
      showToast(action, 'success');
      
      // Refresh history
      loadAnalysisHistory();
    } catch (err: any) {
      console.error('Error toggling share status:', err);
      showToast('แชร์รายงานล้มเหลว: ' + err.message, 'error');
    } finally {
      setIsTogglingShare(false);
    }
  };

  // Copy share URL to clipboard
  const handleCopyShareLink = () => {
    if (!aiAnalysis || !aiAnalysis.share_token) return;
    const shareUrl = `${window.location.origin}/reports?share=${aiAnalysis.share_token}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('คัดลอกลิงก์แชร์ไปยังคลิปบอร์ดแล้ว / Copied share link to clipboard!', 'success');
  };

  // Simple clean markdown parser for pure React
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-4 text-slate-300 text-xs sm:text-sm leading-relaxed font-sans">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('###')) {
            return (
              <h4 key={idx} className="text-sm font-extrabold text-indigo-400 mt-5 mb-2 border-b border-slate-700/50 pb-1 uppercase tracking-wider">
                {trimmed.replace('###', '').trim()}
              </h4>
            );
          }
          if (trimmed.startsWith('##')) {
            return (
              <h3 key={idx} className="text-base font-black text-white mt-6 mb-3 uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="text-indigo-400" size={16} /> {trimmed.replace('##', '').trim()}
              </h3>
            );
          }
          if (trimmed.startsWith('#')) {
            return (
              <h2 key={idx} className="text-lg font-black text-white mt-8 mb-4 uppercase tracking-widest border-b-2 border-indigo-500 pb-2">
                {trimmed.replace('#', '').trim()}
              </h2>
            );
          }
          if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-3 py-0.5 hover:bg-slate-800/10 rounded transition-colors">
                <span className="text-indigo-400 mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-md shadow-indigo-500/50"></span>
                <span>{trimmed.substring(1).trim()}</span>
              </div>
            );
          }
          if (trimmed.startsWith('>')) {
            return (
              <blockquote key={idx} className="border-l-4 border-indigo-500 bg-indigo-500/5 pl-4 py-3 rounded-r-xl my-3 text-slate-300 italic font-medium shadow-inner">
                {trimmed.substring(1).trim()}
              </blockquote>
            );
          }
          if (!trimmed) return <div key={idx} className="h-1.5"></div>;
          return <p key={idx} className="indent-2 py-0.5">{trimmed}</p>;
        })}
      </div>
    );
  };

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
    
    const totalHours = userLogs.reduce((sum, e) => sum + e.total_hours, 0);
    const otHours = userLogs.filter(e => e.is_ot || e.is_implied_ot).reduce((sum, e) => sum + e.total_hours, 0);
    const otRate = totalHours > 0 ? parseFloat(((otHours / totalHours) * 100).toFixed(1)) : 0;
    const uniqueDatesCount = new Set(userLogs.map(e => e.work_date)).size;
    const avgHoursPerDay = uniqueDatesCount > 0 ? parseFloat((totalHours / uniqueDatesCount).toFixed(1)) : 0;
    const uniqueProjectsCount = new Set(userLogs.map(e => e.project_name)).size;

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

    // 1. Daily Hours Data (stacked Normal vs OT)
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
    const dailyHoursData = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        Normal: parseFloat(d.Normal.toFixed(1)),
        OT: parseFloat(d.OT.toFixed(1))
      }));

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
    const normalHours = Math.max(0, totalHours - otHours);
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
    userLogs.forEach(log => {
      const dateStr = log.work_date;
      const monthStr = dateStr.substring(0, 7); // YYYY-MM
      if (!monthlyMap[monthStr]) {
        monthlyMap[monthStr] = { month: monthStr, Normal: 0, OT: 0 };
      }
      if (log.is_ot || log.is_implied_ot) {
        monthlyMap[monthStr].OT += log.total_hours;
      } else {
        monthlyMap[monthStr].Normal += log.total_hours;
      }
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

  if (isSharedView) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-200 font-sans relative flex flex-col p-6 sm:p-12 items-center justify-center">
        {/* Dynamic Background Glowing Blobs */}
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-12 right-1/4 w-[350px] h-[350px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Stylesheet for Printing */}
        <style>{`
          @media print {
            body, html {
              background: white !important;
              color: black !important;
            }
            .no-print, button, header, nav, .print\\:hidden {
              display: none !important;
            }
            main, .print-container {
              padding: 0 !important;
              margin: 0 !important;
              background: white !important;
              box-shadow: none !important;
              border: none !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            .print-only {
              display: block !important;
            }
            @page {
              size: A4;
              margin: 20mm;
            }
          }
        `}</style>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-indigo-400" size={32} />
            <p className="text-sm font-bold text-slate-400">กำลังโหลดรายงานการวิเคราะห์... / Loading analysis report...</p>
          </div>
        ) : !sharedReport ? (
          /* Lockout Screen: Expired / Invalid */
          <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 to-orange-500" />
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight mb-2">ลิงก์แชร์รายงานหมดอายุหรือไม่มีอยู่จริง</h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Shared Report has expired or is invalid. The sharing token might have been deactivated, deleted, or has passed its 30-day validity period.
            </p>
            <div className="text-[10px] text-slate-500 font-mono bg-slate-950/40 py-2.5 px-4 rounded-xl border border-slate-800/80 inline-block font-sans">
              Code: ERR_SHARE_EXPIRED_OR_INVALID
            </div>
          </div>
        ) : (
          /* Valid Shared Report Presentation */
          <div className="w-full max-w-4xl space-y-6 print-container animate-in fade-in duration-300">
            {/* Action Bar for Shared View */}
            <div className="flex flex-wrap items-center justify-between gap-4 no-print bg-[#1E293B]/80 border border-slate-700/50 rounded-2xl p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Individual Audit Report</h3>
                  <span className="text-[9px] text-slate-400 font-mono">Shared publicly via token</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-750 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Report</span>
                </button>
              </div>
            </div>

            {/* Standard Dashboard for Shared View */}
            <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-xl relative overflow-hidden space-y-8 no-print">
              {/* Header inside the container */}
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-6">
                <div>
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">AI Diagnostics Report</span>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {sharedUser?.full_name || 'Employee'} ({sharedUser?.nickname || 'N/A'})
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Position: <span className="text-slate-200 font-bold">{sharedUser?.position || 'N/A'}</span> | Department: <span className="text-slate-200 font-bold">{sharedUser?.department || 'N/A'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Analysis Window</span>
                  <span className="text-xs font-mono text-slate-300 font-bold block">{sharedReport.start_date} ~ {sharedReport.end_date}</span>
                </div>
              </div>

              {/* The Score Dials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Dial: JD Alignment */}
                <div className="bg-[#0F172A]/40 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">JD Alignment Index</span>
                    <h4 className="text-3xl font-black text-white tracking-tight">{sharedReport.jd_alignment_score || 0}%</h4>
                    <p className="text-[10px] text-slate-500 leading-normal max-w-[160px]">
                      Consistency score of actual logs relative to target JD allocation.
                    </p>
                  </div>
                  <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="32" className="stroke-slate-700/40 fill-none" strokeWidth="6" />
                      <circle 
                        cx="40" 
                        cy="40" 
                        r="32" 
                        className="stroke-indigo-500 fill-none" 
                        strokeWidth="6" 
                        strokeDasharray={`${2 * Math.PI * 32}`} 
                        strokeDashoffset={`${2 * Math.PI * 32 * (1 - (sharedReport.jd_alignment_score || 0) / 100)}`}
                        strokeLinecap="round" 
                      />
                    </svg>
                    <span className="absolute text-xs font-mono font-black text-indigo-400">{sharedReport.jd_alignment_score || 0}%</span>
                  </div>
                </div>

                {/* Dial: Burnout Risk */}
                <div className="bg-[#0F172A]/40 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Burnout Risk Status</span>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                        (sharedReport.burnout_risk_score || 0) > 70
                          ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
                          : (sharedReport.burnout_risk_score || 0) > 40
                            ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                            : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                      )}>
                        {(sharedReport.burnout_risk_score || 0) > 70 ? 'High Risk' : (sharedReport.burnout_risk_score || 0) > 40 ? 'Moderate' : 'Low Risk'}
                      </span>
                    </div>
                    <h4 className="text-3xl font-black text-white tracking-tight">{sharedReport.burnout_risk_score || 0}%</h4>
                    <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full",
                          (sharedReport.burnout_risk_score || 0) > 70
                            ? "bg-rose-500"
                            : (sharedReport.burnout_risk_score || 0) > 40
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        )} 
                        style={{ width: `${sharedReport.burnout_risk_score || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* MD Executive Summary Block */}
              <div className="border-t border-slate-700/50 pt-6 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={14} /> Executive Summary
                </h3>
                <div className="bg-[#0F172A]/40 border border-slate-800 rounded-2xl p-6">
                  {sharedReport.raw_ai_report ? (
                    renderMarkdown(sharedReport.raw_ai_report)
                  ) : (
                    <div className="text-slate-500 text-xs italic">No executive summary found.</div>
                  )}
                </div>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-700/50 pt-6">
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Key Strengths
                  </h4>
                  <div className="space-y-2">
                    {(sharedReport.strengths || []).map((str: string, i: number) => (
                      <div key={i} className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-xs text-slate-300">
                        <span className="text-emerald-400 font-bold font-mono mr-1.5">{i + 1}.</span>
                        {str}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Execution Gaps
                  </h4>
                  <div className="space-y-2">
                    {(sharedReport.improvements || []).map((imp: string, i: number) => (
                      <div key={i} className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-xs text-slate-300">
                        <span className="text-amber-400 font-bold font-mono mr-1.5">{i + 1}.</span>
                        {imp}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Development Coaching Plan */}
              {sharedReport.development_plan && (
                <div className="border-t border-slate-700/50 pt-6 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Target size={16} /> Strategic Development Plan
                  </h4>
                  <div className="space-y-3">
                    {sharedReport.development_plan.short_term_90_days && (
                      <div className="bg-[#0F172A]/40 border border-slate-800 rounded-2xl p-5">
                        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">Short-Term Goals (90 Days)</div>
                        <p className="text-xs text-slate-300 leading-relaxed">{sharedReport.development_plan.short_term_90_days}</p>
                      </div>
                    )}
                    {sharedReport.development_plan.long_term_goals && (
                      <div className="bg-[#0F172A]/40 border border-slate-800 rounded-2xl p-5">
                        <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1.5">Long-Term Career Goals</div>
                        <p className="text-xs text-slate-300 leading-relaxed">{sharedReport.development_plan.long_term_goals}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Audit Sign-off info */}
              <div className="border-t border-slate-700/50 pt-6 flex flex-wrap justify-between items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-400" size={16} />
                  <span className="text-slate-400">
                    Status: <strong className="text-white">Audit-Ready / Verified</strong>
                  </span>
                </div>
                {sharedReport.acknowledged_at && (
                  <div className="text-slate-400 font-mono text-[10px]">
                    ✓ Acknowledged on {new Date(sharedReport.acknowledged_at).toLocaleString('th-TH')}
                  </div>
                )}
              </div>
            </div>

            {/* Print Only component for shared view */}
            <PrintReportView 
              user={sharedUser} 
              report={sharedReport} 
            />
          </div>
        )}
      </div>
    );
  }

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
                  className="bg-[#0F172A] border border-slate-700 rounded-lg py-1.5 px-2 text-[10px] text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">End</label>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-[#0F172A] border border-slate-700 rounded-lg py-1.5 px-2 text-[10px] text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
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
                                onClick={() => handleOpenViewModal(e)}
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
                                <td 
                                  className="px-6 py-4 text-right"
                                  onClick={(evt) => {
                                    evt.stopPropagation();
                                    toggleRow(e.id);
                                  }}
                                >
                                  <button className="text-slate-400 hover:text-white p-1 rounded transition-colors">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-[#0F172A]/40" onClick={(evt) => evt.stopPropagation()}>
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
                                        <div className="mt-3 flex justify-end gap-2">
                                          <button
                                            onClick={(evt) => {
                                              evt.stopPropagation();
                                              handleOpenViewModal(e);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#334155]/80 border border-slate-600/50 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all"
                                          >
                                            <Eye size={12} />
                                            <span>เปิดใบงาน (Open)</span>
                                          </button>
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
                <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-indigo-500/10 hover:border-indigo-500/20 rounded-3xl p-6 shadow-xl transition-all h-full">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="text-indigo-400" size={18} />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">📈 Hours Trend (IMP)</h3>
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
                            labelClassName="text-slate-400 font-bold font-mono text-[10px]"
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
                <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-violet-500/10 hover:border-violet-500/20 rounded-3xl p-6 shadow-xl transition-all h-full">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="text-emerald-400" size={18} />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">📈 Hours Trend (IT)</h3>
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
                            labelClassName="text-slate-400 font-bold font-mono text-[10px]"
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
                <div className={`bg-[#1E293B]/80 backdrop-blur-xl border ${impStyle.border} ${impStyle.hover} rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full flex flex-col`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 ${impStyle.bgGlow} rounded-full blur-3xl pointer-events-none ${impStyle.hoverBg} transition-colors`}></div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <span className={`w-3.5 h-3.5 rounded-full ${impStyle.dot} animate-pulse`}></span>
                      <h2 className="text-xl font-black text-white tracking-tight uppercase">IMP Group (IMP)</h2>
                    </div>
                    <span className={`text-[10px] font-bold ${impStyle.badgeBg} border ${impStyle.badgeBorder} ${impStyle.badgeText} px-3 py-1 rounded-full uppercase tracking-wider font-mono shrink-0`}>
                      {overviewData.imp.metrics.usersCount} Active {overviewData.imp.metrics.usersCount === 1 ? 'User' : 'Users'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0F172A]/50 border border-slate-700/40 rounded-2xl p-4 shadow-inner">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Total Effort Hours</span>
                      <span className="text-3xl font-black text-white tracking-tight font-mono">{overviewData.imp.metrics.totalHours.toFixed(1)}h</span>
                    </div>
                    <div className="bg-[#0F172A]/50 border border-slate-700/40 rounded-2xl p-4 shadow-inner">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">Overtime Logged</span>
                      <span className="text-3xl font-black text-amber-400 tracking-tight font-mono">{overviewData.imp.metrics.otHours.toFixed(1)}h</span>
                    </div>
                  </div>

                  {/* Top Projects */}
                  <div className="mt-6 space-y-3 flex-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">🏆 Top IMP Projects</h3>
                    {overviewData.imp.projects.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block">No records logged in IMP group.</span>
                    ) : (
                      <div className="space-y-3">
                        {overviewData.imp.projects.map((p, pIdx) => (
                          <div key={pIdx} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-300 font-bold truncate max-w-[200px]">{p.name}</span>
                              <span className={`${impStyle.badgeText} font-bold font-mono`}>{p.hours.toFixed(1)}h ({p.percentage}%)</span>
                            </div>
                            <div className="w-full bg-[#0F172A] h-1.5 rounded-full overflow-hidden">
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
                <div className={`bg-[#1E293B]/80 backdrop-blur-xl border ${itStyle.border} ${itStyle.hover} rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full flex flex-col`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 ${itStyle.bgGlow} rounded-full blur-3xl pointer-events-none ${itStyle.hoverBg} transition-colors`}></div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <span className={`w-3.5 h-3.5 rounded-full ${itStyle.dot} animate-pulse`}></span>
                      <h2 className="text-xl font-black text-white tracking-tight uppercase">IT Group (IT)</h2>
                    </div>
                    <span className={`text-[10px] font-bold ${itStyle.badgeBg} border ${itStyle.badgeBorder} ${itStyle.badgeText} px-3 py-1 rounded-full uppercase tracking-wider font-mono shrink-0`}>
                      {overviewData.it.metrics.usersCount} Active {overviewData.it.metrics.usersCount === 1 ? 'User' : 'Users'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0F172A]/50 border border-slate-700/40 rounded-2xl p-4 shadow-inner">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Total Effort Hours</span>
                      <span className="text-3xl font-black text-white tracking-tight font-mono">{overviewData.it.metrics.totalHours.toFixed(1)}h</span>
                    </div>
                    <div className="bg-[#0F172A]/50 border border-slate-700/40 rounded-2xl p-4 shadow-inner">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">Overtime Logged</span>
                      <span className="text-3xl font-black text-amber-400 tracking-tight font-mono">{overviewData.it.metrics.otHours.toFixed(1)}h</span>
                    </div>
                  </div>

                  {/* Top Projects */}
                  <div className="mt-6 space-y-3 flex-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">🏆 Top IT Projects</h3>
                    {overviewData.it.projects.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block">No records logged in IT group.</span>
                    ) : (
                      <div className="space-y-3">
                        {overviewData.it.projects.map((p, pIdx) => (
                          <div key={pIdx} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-300 font-bold truncate max-w-[200px]">{p.name}</span>
                              <span className={`${itStyle.badgeText} font-bold font-mono`}>{p.hours.toFixed(1)}h ({p.percentage}%)</span>
                            </div>
                            <div className="w-full bg-[#0F172A] h-1.5 rounded-full overflow-hidden">
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
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">🏢 Business Unit (BU) Distribution</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* BU Distribution IMP */}
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-indigo-500/10 hover:border-indigo-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6">🏢 Business Unit (BU) Distribution IMP</h3>
                    {overviewData.impBuBreakdown.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-4 text-center">No Business Unit records found.</span>
                    ) : (
                      <div className="space-y-3.5">
                        {overviewData.impBuBreakdown.map((item) => (
                          <div key={item.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-200 font-bold truncate max-w-[200px]">{item.name}</span>
                              <span className="text-indigo-400 font-bold font-mono">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-[#0F172A] h-1.5 rounded-full overflow-hidden">
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-violet-500/10 hover:border-violet-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full">
                    <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-6">🏢 Business Unit (BU) Distribution IT</h3>
                    {overviewData.itBuBreakdown.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-4 text-center">No Business Unit records found.</span>
                    ) : (
                      <div className="space-y-3.5">
                        {overviewData.itBuBreakdown.map((item) => (
                          <div key={item.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-200 font-bold truncate max-w-[200px]">{item.name}</span>
                              <span className="text-violet-400 font-bold font-mono">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-[#0F172A] h-1.5 rounded-full overflow-hidden">
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
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">🛠️ Department Operator Support</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Department Operator Distribution IMP */}
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-indigo-500/10 hover:border-indigo-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6">🛠️ Department Operator Distribution IMP</h3>
                    {overviewData.impDeptBreakdown.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-4 text-center">No Department records found.</span>
                    ) : (
                      <div className="space-y-3.5">
                        {overviewData.impDeptBreakdown.map((item) => (
                          <div key={item.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-200 font-bold truncate max-w-[200px]">{item.name}</span>
                              <span className="text-indigo-400 font-bold font-mono">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-[#0F172A] h-1.5 rounded-full overflow-hidden">
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-violet-500/10 hover:border-violet-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group transition-all h-full">
                    <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-6">🛠️ Department Operator Distribution IT</h3>
                    {overviewData.itDeptBreakdown.length === 0 ? (
                      <span className="text-xs text-slate-500 italic block py-4 text-center">No Department records found.</span>
                    ) : (
                      <div className="space-y-3.5">
                        {overviewData.itDeptBreakdown.map((item) => (
                          <div key={item.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-200 font-bold truncate max-w-[200px]">{item.name}</span>
                              <span className="text-violet-400 font-bold font-mono">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-[#0F172A] h-1.5 rounded-full overflow-hidden">
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
                          <span className="text-xs font-mono font-black text-amber-400">{item.otHours.toFixed(1)}h OT</span>
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

            {/* Sub-tab selection bar */}
            <div className="flex border-b border-slate-700/50 mt-6 mb-8">
              <button
                onClick={() => setIndividualSubTab('charts')}
                className={cn(
                  "px-6 py-3 text-xs font-bold border-b-2 transition-all duration-200 flex items-center gap-2",
                  individualSubTab === 'charts'
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
                )}
              >
                <TrendingUp size={16} />
                <span>Performance Metrics & Charts</span>
              </button>
              <button
                onClick={() => setIndividualSubTab('ai')}
                className={cn(
                  "px-6 py-3 text-xs font-bold border-b-2 transition-all duration-200 flex items-center gap-2",
                  individualSubTab === 'ai'
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
                )}
              >
                <Brain size={16} />
                <span className="flex items-center gap-1.5">
                  AI Diagnostics & Coaching
                  <span className="px-1.5 py-0.5 text-[8px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-full font-black uppercase tracking-wider animate-pulse">Core</span>
                </span>
              </button>
            </div>

            {/* Individual Profile & KPIs Grid */}
            {individualData && (
              <>
                {individualSubTab === 'charts' && (
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
                      <div className="col-span-2 border-t border-slate-800/60 pt-3 mt-1">
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Job Position</span>
                        <span className="text-xs font-bold text-indigo-300 truncate block">{individualData.user?.position || 'General Staff'}</span>
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

                {/* 1. Daily Hours Trend with 8-Hour Baseline */}
                <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">📅 Daily Logged Hours</h3>
                      <p className="text-[10px] text-slate-500 mt-1">Daily effort showing Normal vs. Overtime hours with a red 8-hour workday standard baseline.</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#6366f1]"></div>
                        <span>Normal Hours</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                    <div className="mb-6">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-bold">🗓️ Monthly Comparison</h3>
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                    <div className="mb-6">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">📈 Weekly Trend vs Team Average</h3>
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
                              labelClassName="text-slate-400 font-bold text-[10px]"
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">🏢 Hours by Business Unit (BU)</h3>
                      <div className="space-y-4">
                        {individualData.buDistributionData.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-6 text-center">No BU allocation logged.</div>
                        ) : (
                          individualData.buDistributionData.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-slate-300">
                                <span className="truncate max-w-[240px]">{item.name}</span>
                                <span className="font-mono text-slate-400">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                              </div>
                              <div className="w-full bg-[#0F172A] h-2.5 rounded-full overflow-hidden border border-slate-800">
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">🏬 Hours by Customer Department</h3>
                      <div className="space-y-4">
                        {individualData.deptDistributionData.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-6 text-center">No customer department hours logged.</div>
                        ) : (
                          individualData.deptDistributionData.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-slate-300">
                                <span className="truncate max-w-[240px]">{item.name}</span>
                                <span className="font-mono text-slate-400">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                              </div>
                              <div className="w-full bg-[#0F172A] h-2.5 rounded-full overflow-hidden border border-slate-800">
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">⚡ Top Actions by Effort</h3>
                      <div className="space-y-4">
                        {individualData.topActionsData.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-6 text-center">No action details logged.</div>
                        ) : (
                          individualData.topActionsData.map((item, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-slate-300">
                                <span className="truncate max-w-[240px]">{item.name}</span>
                                <span className="font-mono text-slate-400">{item.hours.toFixed(1)}h ({item.percentage}%)</span>
                              </div>
                              <div className="w-full bg-[#0F172A] h-2.5 rounded-full overflow-hidden border border-slate-800">
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">🏆 Top 5 Projects by Contributed Hours</h3>
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">📊 Normal vs. OT Split</h3>
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
                              <span className="text-xl font-black text-white font-mono">{individualData.totalHours.toFixed(1)}h</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Visual Custom Legend below */}
                    <div className="flex justify-around items-center border-t border-slate-700/30 pt-4 mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-lg bg-[#6366f1] shadow-md shadow-indigo-500/20"></div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-bold">Normal</span>
                          <span className="text-[10px] font-bold text-white font-mono">{individualData.otSplitData[0].value}h ({individualData.otSplitData[0].percentage}%)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-lg bg-[#f59e0b] shadow-md shadow-amber-500/20"></div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-bold">OT</span>
                          <span className="text-[10px] font-bold text-amber-400 font-mono">{individualData.otSplitData[1].value}h ({individualData.otSplitData[1].percentage}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work Type Pie Chart */}
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">🎯 Work Type Ratio</h3>
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
                  <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">🕸️ BU Allocation Map</h3>
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

                {/* SUB-TAB 2: AI DIAGNOSTICS */}
                {individualSubTab === 'ai' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    
                    {/* LEFT COLUMN: JOB DESCRIPTION (JD) & TARGET WEIGHTS */}
                    <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col h-fit">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                      
                      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-4">
                        <div className="flex items-center gap-2">
                          <FileText className="text-indigo-400" size={18} />
                          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Job Description (JD)</h3>
                        </div>
                        {!isJdEditing ? (
                          <button
                            onClick={() => setIsJdEditing(true)}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg"
                          >
                            <Edit3 size={12} />
                            <span>Edit JD</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={recommendJd}
                              disabled={isRecommendingJd}
                              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {isRecommendingJd ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                              {isRecommendingJd ? 'AI กำลังคิด...' : 'AI Recommend'}
                            </button>
                            <button
                              onClick={() => setIsJdEditing(false)}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-300 transition-colors bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* JD Text Viewer or Editor */}
                      <div className="space-y-4">
                        {/* Position Field Override */}
                        {!isJdEditing ? (
                          <div className="mb-1 bg-[#0F172A]/40 border border-slate-700/30 rounded-2xl p-4 flex items-center justify-between shadow-inner animate-in fade-in duration-200">
                            <div className="truncate pr-2">
                              <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">Target Position</span>
                              <span className="text-xs font-bold text-slate-200 truncate block">
                                {customPosition || individualData?.user?.position || 'General Staff'}
                              </span>
                            </div>
                            <div className="text-[9px] text-slate-500 italic bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/40 font-semibold shrink-0">
                              {individualData?.user?.position && customPosition && customPosition !== individualData.user.position ? 'Override Active' : 'HRMS Synced'}
                            </div>
                          </div>
                        ) : (
                          <div className="mb-1 bg-[#0F172A]/80 border border-slate-700/60 rounded-2xl p-4 focus-within:ring-2 focus-within:ring-indigo-500/40 transition-all shadow-inner animate-in fade-in duration-200">
                            <label className="text-[10px] text-indigo-400 uppercase font-black tracking-widest block mb-1.5">
                              Position / Job Title
                            </label>
                            <input
                              type="text"
                              value={customPosition}
                              onChange={(e) => setCustomPosition(e.target.value)}
                              placeholder="e.g. Senior Software Developer"
                              className="w-full bg-transparent border-0 p-0 text-xs font-bold text-white focus:outline-none focus:ring-0 placeholder-slate-600"
                            />
                          </div>
                        )}

                        {!isJdEditing ? (
                          <div className="bg-[#0F172A]/50 border border-slate-700/30 rounded-2xl p-4 shadow-inner max-h-48 overflow-y-auto">
                            {jdText ? (
                              <pre className="text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">{jdText}</pre>
                            ) : (
                              <div className="text-xs text-slate-500 italic text-center py-6">
                                No job description configured. Click "Edit JD" to define key responsibilities.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              value={jdText}
                              onChange={(e) => setJdText(e.target.value)}
                              placeholder="Enter the full employee job description, requirements, or core responsibilities here..."
                              className="w-full h-44 bg-[#0F172A] border border-slate-700/80 rounded-2xl p-4 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-sans placeholder-slate-600 resize-none transition-all shadow-inner"
                            />
                          </div>
                        )}

                        {/* KEY RESPONSIBILITIES & TARGET WEIGHTS */}
                        <div className="mt-6 border-t border-slate-700/50 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                              <Target className="text-indigo-400" size={16} />
                              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Weights</h4>
                            </div>
                            {isJdEditing && (
                              <button
                                onClick={() => setKeyResponsibilities([...keyResponsibilities, { category: '', weight: 0 }])}
                                className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                              >
                                <PlusCircle size={12} />
                                <span>Add Category</span>
                              </button>
                            )}
                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {keyResponsibilities.length === 0 ? (
                              <div className="text-[11px] text-slate-500 italic py-3 text-center">
                                No responsibility categories defined.
                              </div>
                            ) : (
                              keyResponsibilities.map((item, index) => (
                                <div key={index} className="flex items-center gap-2 bg-[#0F172A]/30 border border-slate-700/20 rounded-xl p-2">
                                  {isJdEditing ? (
                                    <>
                                      <input
                                        type="text"
                                        value={item.category}
                                        onChange={(e) => {
                                          const newWeights = [...keyResponsibilities];
                                          newWeights[index].category = e.target.value;
                                          setKeyResponsibilities(newWeights);
                                        }}
                                        placeholder="Category name"
                                        className="bg-[#0F172A] border border-slate-700/80 rounded-lg py-1 px-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1"
                                      />
                                      <div className="flex items-center gap-1 w-16">
                                        <input
                                          type="number"
                                          value={item.weight || ''}
                                          onChange={(e) => {
                                            const newWeights = [...keyResponsibilities];
                                            newWeights[index].weight = parseInt(e.target.value) || 0;
                                            setKeyResponsibilities(newWeights);
                                          }}
                                          placeholder="%"
                                          className="bg-[#0F172A] border border-slate-700/80 rounded-lg py-1 px-1 text-center text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-mono font-bold"
                                        />
                                        <span className="text-slate-500 text-[10px]">%</span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          const newWeights = keyResponsibilities.filter((_, idx) => idx !== index);
                                          setKeyResponsibilities(newWeights);
                                        }}
                                        className="text-red-400 hover:text-red-300 p-1 transition-colors"
                                      >
                                        &times;
                                      </button>
                                    </>
                                  ) : (
                                    <div className="flex justify-between items-center w-full px-2 text-xs">
                                      <span className="text-slate-300 font-medium truncate max-w-[180px]">{item.category}</span>
                                      <span className="text-indigo-400 font-bold font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/15">{item.weight}%</span>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* Total Weights Validation */}
                          <div className="flex items-center justify-between border-t border-slate-700/50 pt-3 mt-3">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Total Target weight:</span>
                            <span className={cn(
                              "text-xs font-mono font-black px-2.5 py-0.5 rounded-full border shadow-sm",
                              keyResponsibilities.reduce((sum, item) => sum + item.weight, 0) === 100
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                : "bg-red-500/15 border-red-500/30 text-red-400"
                            )}>
                              {keyResponsibilities.reduce((sum, item) => sum + item.weight, 0)}% / 100%
                            </span>
                          </div>
                        </div>

                        {/* Save JD Button */}
                        {isJdEditing && (
                          <button
                            onClick={handleSaveJd}
                            disabled={isSavingJd}
                            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                          >
                            {isSavingJd ? (
                              <>
                                <RefreshCw className="animate-spin" size={14} />
                                <span>Saving to Supabase...</span>
                              </>
                            ) : (
                              <>
                                <Save size={14} />
                                <span>Save Changes & Sync</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: PERFORMANCE DIAGNOSTICS & AI EXECUTIVE SUMMARY */}
                    <div className="lg:col-span-2 space-y-6">
                      
                      {isAiAnalyzing ? (
                        /* AI AUDIT PROCESS TRACKER WITH LIVE LOGS CONSOLE */
                        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-10 shadow-xl flex flex-col justify-center relative overflow-hidden h-full min-h-[500px]">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
                          
                          <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner animate-spin animate-duration-1000">
                              <Loader2 size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-white tracking-tight uppercase">AI Performance Auditing</h3>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Process ID: {Math.random().toString(36).substring(2, 9).toUpperCase()}</p>
                            </div>
                          </div>

                          {/* Progress Steps */}
                          <div className="space-y-5 relative pl-4 border-l-2 border-slate-700/40">
                            {[
                              { step: 1, label: 'Validate Job Description & Targets', desc: 'Validating alignment weights and JD definitions' },
                              { step: 2, label: 'Collect User Activity Logs', desc: 'Querying col_worklog database for specified period' },
                              { step: 3, label: 'Aggregate Workload Allocations', desc: 'Calculating actual task hours vs target weights' },
                              { step: 4, label: 'Run AI Diagnostic Engine', desc: `Orchestrating LLM performance mapping on ${aiProvider === 'opencode' ? 'OpenCode' : aiProvider === 'openai' ? 'OpenAI' : aiProvider === 'gemini' ? 'Gemini' : 'OpenRouter'}${aiModel ? ` (${aiModel.split('/').pop()})` : ''}` },
                              { step: 5, label: 'Compile & Cache Performance Report', desc: 'Caching finalized diagnostics & development plan' }
                            ].map((item) => {
                              const isCompleted = aiStep > item.step;
                              const isActive = aiStep === item.step;
                              return (
                                <div key={item.step} className="relative flex gap-4 transition-all duration-300">
                                  {/* Step bullet */}
                                  <div className={cn(
                                    "absolute -left-[25px] w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all duration-300",
                                    isCompleted 
                                      ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                                      : isActive 
                                        ? "bg-indigo-500 border-indigo-500 text-white animate-pulse" 
                                        : "bg-slate-900 border-slate-700 text-slate-500"
                                  )}>
                                    {isCompleted ? '✓' : item.step}
                                  </div>
                                  
                                  <div className={cn(
                                    "transition-all duration-300",
                                    isCompleted ? "opacity-60" : isActive ? "opacity-100 scale-[1.01]" : "opacity-40"
                                  )}>
                                    <h4 className="text-xs font-bold text-white leading-none mb-1 flex items-center gap-1.5">
                                      {item.label}
                                      {isActive && <RefreshCw className="animate-spin text-indigo-400" size={12} />}
                                    </h4>
                                    <p className="text-[10px] text-slate-400">{item.desc}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Live Step Logs Console */}
                          <div className="mt-8 border border-slate-700/40 bg-[#0F172A]/90 rounded-2xl p-4 font-mono text-[9px] h-36 overflow-y-auto space-y-1.5 shadow-inner">
                            <div className="text-slate-500 border-b border-slate-800 pb-1 mb-1.5 flex justify-between">
                              <span>CONSOLE OUTPUT</span>
                              <span className="animate-pulse text-indigo-400">● LIVE LOGS</span>
                            </div>
                            {aiStepLogs.map((log, index) => (
                              <div key={index} className="flex gap-2">
                                <span className="text-slate-500">[{log.time}]</span>
                                <span className={cn(
                                  log.type === 'success' ? "text-emerald-400" : log.type === 'error' ? "text-red-400 font-bold" : "text-slate-300"
                                )}>{log.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : !aiAnalysis ? (
                        /* EMPTY STATE: RUN DIAGNOSTICS WITH PREMIUM DUAL-PANEL */
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                          {/* LEFT PANEL: EXECUTION */}
                          <div className="lg:col-span-7 bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[460px]">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
                            
                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 shadow-inner animate-pulse">
                              <Brain size={28} />
                            </div>
                            
                            <h3 className="text-lg font-black text-white tracking-tight uppercase mb-2">AI Performance Diagnostics</h3>
                            <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                              วิเคราะห์ใบงานย้อนหลัง เทียบกับเกณฑ์น้ำหนักความรับผิดชอบ (Job Description) เพื่อประเมินความสอดคล้อง ดัชนีภาวะหมดไฟ และสร้างแผนการโค้ชพนักงานระดับพรีเมียม
                            </p>

                            <button
                              onClick={() => handleRunAiAnalysis()}
                              className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:via-indigo-400 hover:to-purple-500 text-white font-black py-3.5 px-8 rounded-2xl text-xs tracking-wider uppercase transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2.5 active:scale-[0.98]"
                            >
                              <Sparkles className="w-4 h-4 animate-bounce" />
                              <span>Execute Performance Audit</span>
                            </button>

                            <div className="grid grid-cols-3 gap-4 max-w-sm mt-8 w-full pt-6 border-t border-slate-700/40">
                              <div className="text-center">
                                <span className="text-sm font-black text-indigo-400 block mb-0.5">🎯 Alignment</span>
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">JD vs Worklogs</span>
                              </div>
                              <div className="text-center border-x border-slate-700/40">
                                <span className="text-sm font-black text-indigo-400 block mb-0.5">🔥 Burnout</span>
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Risk Level</span>
                              </div>
                              <div className="text-center">
                                <span className="text-sm font-black text-indigo-400 block mb-0.5">🚀 Coaching</span>
                                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Action Plans</span>
                              </div>
                            </div>
                          </div>

                          {/* RIGHT PANEL: HISTORICAL ARCHIVES */}
                          <div className="lg:col-span-5 bg-[#1E293B]/60 backdrop-blur-xl border border-slate-700/40 rounded-3xl p-6 shadow-xl flex flex-col min-h-[460px]">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-700/40 pb-3">
                              <div className="flex items-center gap-2">
                                <Clock className="text-emerald-400" size={16} />
                                <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">ประวัติผลวิเคราะห์</span>
                              </div>
                              <button
                                onClick={loadAnalysisHistory}
                                disabled={isLoadingHistory}
                                className="text-[10px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                              >
                                <RefreshCw size={10} className={isLoadingHistory ? 'animate-spin' : ''} />
                                {isLoadingHistory ? 'กำลังโหลด...' : 'รีเฟรช'}
                              </button>
                            </div>

                            {isLoadingHistory ? (
                              <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500 italic py-8">
                                <Loader2 className="animate-spin text-emerald-400 mb-2" size={18} />
                                กำลังดึงข้อมูลประวัติย้อนหลัง...
                              </div>
                            ) : analysisHistory.length === 0 ? (
                              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-700/30 rounded-2xl">
                                <Clock className="text-slate-600 mb-3" size={28} />
                                <p className="text-xs text-slate-400 font-bold mb-1">ไม่พบประวัติการวิเคราะห์</p>
                                <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px]">
                                  เริ่มการวิเคราะห์ครั้งแรกเพื่อบันทึกประวัติผลงานเก็บไว้ในระบบ
                                </p>
                              </div>
                            ) : (
                              <div className="flex-1 flex flex-col">
                                <p className="text-[10px] text-slate-400 mb-3">
                                  เลือกดูรายงานและแผนพัฒนาที่ AI เคยทำการวิเคราะห์และบันทึกไว้:
                                </p>
                                <div className="space-y-2.5 overflow-y-auto max-h-[310px] pr-1 flex-1">
                                  {analysisHistory.map((record: any, idx: number) => (
                                    <div
                                      key={record.id || idx}
                                      className="bg-[#0F172A]/70 border border-slate-700/50 hover:border-emerald-500/30 rounded-2xl px-4 py-3.5 transition-all group flex flex-col gap-2 relative"
                                    >
                                      <div className="flex justify-between items-start gap-1">
                                        <div className="flex flex-col gap-0.5">
                                          <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                                            📅 {record.start_date} ~ {record.end_date}
                                          </div>
                                          <div className="text-[9px] text-slate-500 font-mono">
                                            วิเคราะห์เมื่อ: {new Date(record.created_at).toLocaleDateString('th-TH')}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => loadHistoryRecord(record)}
                                          className="shrink-0 px-2.5 py-1.5 rounded-xl text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all opacity-90 lg:opacity-0 lg:group-hover:opacity-100"
                                        >
                                          ดูรายงานนี้
                                        </button>
                                      </div>
                                      <div className="flex gap-4 border-t border-slate-700/30 pt-2">
                                        <span className="text-[9px] text-indigo-400 font-mono">JD Align: <strong>{record.jd_alignment_score}%</strong></span>
                                        <span className="text-[9px] text-amber-400 font-mono">Burnout: <strong>{record.burnout_risk_score}%</strong></span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        
                        /* ANALYSIS PRESENTATION DASHBOARD */
                        <div className="space-y-6 animate-in fade-in duration-300">
                          
                          {/* TOP DIALS & SCORES GRID */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            
                            {/* Dial: JD Alignment */}
                            <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden flex items-center justify-between group">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">JD Alignment Index</span>
                                <h4 className="text-3xl font-black text-white tracking-tight">{aiAnalysis.jd_alignment_score || 0}%</h4>
                                <p className="text-[10px] text-slate-400 leading-normal max-w-[160px]">
                                  Consistency score of actual logs relative to target JD allocation.
                                </p>
                              </div>
                              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle cx="40" cy="40" r="32" className="stroke-slate-700/40 fill-none" strokeWidth="6" />
                                  <circle 
                                    cx="40" 
                                    cy="40" 
                                    r="32" 
                                    className="stroke-indigo-500 fill-none transition-all duration-1000 ease-out" 
                                    strokeWidth="6" 
                                    strokeDasharray={`${2 * Math.PI * 32}`} 
                                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - (aiAnalysis.jd_alignment_score || 0) / 100)}`}
                                    strokeLinecap="round" 
                                  />
                                </svg>
                                <span className="absolute text-xs font-mono font-black text-indigo-400">{aiAnalysis.jd_alignment_score || 0}%</span>
                              </div>
                            </div>

                            {/* Burnout Risk Assessment */}
                            <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden flex items-center justify-between group">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>
                              <div className="space-y-1 w-full">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Burnout Risk Status</span>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border shadow-sm",
                                    (aiAnalysis.burnout_risk_score || 0) > 70
                                      ? "bg-rose-500/20 border-rose-500/30 text-rose-400 animate-pulse"
                                      : (aiAnalysis.burnout_risk_score || 0) > 40
                                        ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                                        : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                  )}>
                                    {(aiAnalysis.burnout_risk_score || 0) > 70 ? 'High Risk' : (aiAnalysis.burnout_risk_score || 0) > 40 ? 'Moderate' : 'Low Risk'}
                                  </span>
                                </div>
                                <h4 className="text-3xl font-black text-white tracking-tight">{aiAnalysis.burnout_risk_score || 0}%</h4>
                                <div className="w-full bg-slate-800/80 rounded-full h-2 mt-2 border border-slate-700/30 shadow-inner overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all duration-1000 ease-out",
                                      (aiAnalysis.burnout_risk_score || 0) > 70
                                        ? "bg-rose-500"
                                        : (aiAnalysis.burnout_risk_score || 0) > 40
                                          ? "bg-amber-500"
                                          : "bg-emerald-500"
                                    )} 
                                    style={{ width: `${aiAnalysis.burnout_risk_score || 0}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-slate-400 leading-normal mt-1 block">
                                  Computed based on work hours volatility, overtime frequency, and task density.
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* ACTIONS & AUDIT SIGN-OFF PANEL */}
                          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1E293B]/60 backdrop-blur-xl border border-slate-700/40 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                                aiAnalysis.acknowledged_at
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              )}>
                                <UserCheck size={20} />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">HRBP Audit Sign-off</h4>
                                <span className="text-[10px] text-slate-400 block">
                                  {aiAnalysis.acknowledged_at ? (
                                    <>
                                      ลงนามรับทราบแล้วโดย <span className="text-emerald-400 font-bold">HRBP Administrator</span> เมื่อ {new Date(aiAnalysis.acknowledged_at).toLocaleString('th-TH')}
                                    </>
                                  ) : (
                                    "รอยืนยันและลงนามรับทราบเพื่อบันทึกประวัติการตรวจสอบ / Awaiting signature"
                                  )}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Print Button */}
                              <button
                                onClick={() => window.print()}
                                className="bg-slate-800 hover:bg-slate-750 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                              >
                                <Printer size={13} />
                                <span>Print Executive Report</span>
                              </button>

                              {/* Share Settings Button */}
                              <button
                                onClick={() => setIsShareSettingsOpen(true)}
                                className={cn(
                                  "font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 border transition-all cursor-pointer shadow-sm active:scale-[0.98]",
                                  aiAnalysis.is_public
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                                )}
                              >
                                <Share2 size={13} />
                                <span>{aiAnalysis.is_public ? "Shared Publicly" : "Private / Share Link"}</span>
                              </button>

                              {/* Acknowledge Button */}
                              {!aiAnalysis.acknowledged_at && (
                                <button
                                  onClick={() => setIsAckConfirmOpen(true)}
                                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black py-2 px-5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-[0.98]"
                                >
                                  <UserCheck size={14} />
                                  <span>Confirm Acknowledge</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* REFRESH / FORCE GENERATE CONTROLS */}
                          <div className="flex justify-between items-center bg-[#1E293B]/40 border border-slate-700/30 rounded-2xl px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <Activity className="text-indigo-400 animate-pulse" size={16} />
                              <span className="text-[11px] text-slate-400">Cached Diagnostic Report active</span>
                            </div>
                            <button
                              onClick={() => handleRunAiAnalysis(true)}
                              className="text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
                            >
                              <RefreshCw size={12} />
                              <span>Force Recalculate</span>
                            </button>
                          </div>

                          {/* TABBED ANALYSIS VIEW */}
                          <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            
                            {/* Transparent Process Context Header */}
                            <div className="mb-6 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-wrap items-center justify-between gap-4 text-[11px]">
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Analysis Context (ข้อมูลการประมวลผล)</span>
                                <div className="text-slate-300 flex items-center gap-4 flex-wrap">
                                  <span>📅 ช่วงวันที่: <strong className="text-white font-mono">{aiAnalysis.start_date} ~ {aiAnalysis.end_date}</strong></span>
                                  <span>⏰ เวลาทำงานจริง: <strong className="text-white font-mono">{aiAnalysis.total_hours ? Number(aiAnalysis.total_hours).toFixed(1) : 0} ชม. ({aiAnalysis.logs_count || 0} ใบงาน)</strong></span>
                                </div>
                              </div>
                              <div className="text-slate-400 text-right space-y-0.5">
                                <div className="text-[9px] uppercase font-mono tracking-wider">Engine: <span className="text-slate-300 font-bold">{aiAnalysis.model || aiAnalysis.actualModel || 'N/A'}</span>{aiAnalysis.provider ? <span className="ml-1 text-indigo-400/70">({aiAnalysis.provider})</span> : null}</div>
                                <div>
                                  {aiAnalysis.isCached ? (
                                    <span className="text-amber-400/90 font-bold font-mono">● ข้อมูลแคชเมื่อ {new Date(aiAnalysis.created_at).toLocaleString('th-TH')}</span>
                                  ) : (
                                    <span className="text-emerald-400/90 font-bold font-mono">● ประมวลผลสดใหม่</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Tabs Header */}
                            <div className="flex gap-2 border-b border-slate-700/50 pb-3 mb-6 overflow-x-auto">
                              <button
                                onClick={() => setActiveAiSubTab('summary')}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                  activeAiSubTab === 'summary'
                                    ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                                    : "text-slate-400 hover:text-slate-200"
                                )}
                              >
                                <Sparkles size={14} />
                                <span>Executive Summary</span>
                              </button>
                              <button
                                onClick={() => setActiveAiSubTab('gaps')}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                  activeAiSubTab === 'gaps'
                                    ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                                    : "text-slate-400 hover:text-slate-200"
                                )}
                              >
                                <AlertTriangle size={14} />
                                <span>Strengths & Gaps</span>
                              </button>
                              <button
                                onClick={() => setActiveAiSubTab('coaching')}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                  activeAiSubTab === 'coaching'
                                    ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                                    : "text-slate-400 hover:text-slate-200"
                                )}
                              >
                                <Target size={14} />
                                <span>Development Plan</span>
                              </button>
                              <button
                                onClick={() => setActiveAiSubTab('logs')}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                  activeAiSubTab === 'logs'
                                    ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                                    : "text-slate-400 hover:text-slate-200"
                                )}
                              >
                                <FileText size={14} />
                                <span>Diagnostic Logs</span>
                              </button>
                              <button
                                onClick={() => { setActiveAiSubTab('history'); loadAnalysisHistory(); }}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                  activeAiSubTab === 'history'
                                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                    : "text-slate-400 hover:text-slate-200"
                                )}
                              >
                                <Clock size={14} />
                                <span>ประวัติการวิเคราะห์</span>
                              </button>
                            </div>

                            {/* Tab Content Display */}
                            <div className="min-h-[250px]">
                              {activeAiSubTab === 'summary' && (
                                <div className="space-y-4">
                                  {aiAnalysis.markdown_executive_summary ? (
                                    renderMarkdown(aiAnalysis.markdown_executive_summary)
                                  ) : (
                                    <div className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                                      No executive summary generated.
                                    </div>
                                  )}
                                </div>
                              )}

                              {activeAiSubTab === 'gaps' && (
                                <div className="space-y-6">
                                  <div>
                                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <CheckCircle2 size={16} /> Key Strengths Identified
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2.5">
                                      {(aiAnalysis.strengths || []).length === 0 ? (
                                        <div className="text-xs text-slate-500 italic">No direct strength logs computed.</div>
                                      ) : (
                                        aiAnalysis.strengths.map((str: string, i: number) => (
                                          <div key={i} className="flex items-start gap-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3.5 shadow-sm text-xs text-slate-300">
                                            <span className="text-emerald-400 font-extrabold font-mono mt-0.5">{i + 1}.</span>
                                            <span>{str}</span>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-700/40 pt-6">
                                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <AlertTriangle size={16} /> Key Execution Gaps & Redundancies
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2.5">
                                      {(aiAnalysis.improvements || []).length === 0 ? (
                                        <div className="text-xs text-slate-500 italic">No specific gap metrics recorded.</div>
                                      ) : (
                                        aiAnalysis.improvements.map((imp: string, i: number) => (
                                          <div key={i} className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3.5 shadow-sm text-xs text-slate-300">
                                            <span className="text-amber-400 font-extrabold font-mono mt-0.5">{i + 1}.</span>
                                            <span>{imp}</span>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeAiSubTab === 'coaching' && (
                                <div className="space-y-4">
                                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                    <Target size={16} /> Strategic Development &amp; Action Plan
                                  </h4>
                                  {(() => {
                                    const plan = aiAnalysis.development_plan;
                                    if (!plan || (typeof plan === 'object' && !Array.isArray(plan) && Object.keys(plan).length === 0)) {
                                      return <div className="text-xs text-slate-500 italic font-mono">No development plan generated.</div>;
                                    }
                                    // Handle object shape {short_term_90_days, long_term_goals}
                                    if (typeof plan === 'object' && !Array.isArray(plan)) {
                                      return (
                                        <div className="space-y-4">
                                          {plan.short_term_90_days && (
                                            <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4">
                                              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                                                Short-Term Goals (90 Days)
                                              </div>
                                              <p className="text-xs text-slate-300 leading-relaxed">{plan.short_term_90_days}</p>
                                            </div>
                                          )}
                                          {plan.long_term_goals && (
                                            <div className="bg-violet-500/5 border border-violet-500/15 rounded-2xl p-4">
                                              <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                                                Long-Term Career Goals
                                              </div>
                                              <p className="text-xs text-slate-300 leading-relaxed">{plan.long_term_goals}</p>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    // Handle legacy array shape
                                    if (Array.isArray(plan)) {
                                      return (
                                        <div className="grid grid-cols-1 gap-3">
                                          {plan.map((act: string, i: number) => (
                                            <div key={i} className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 shadow-sm text-xs text-slate-300">
                                              <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 font-mono font-bold text-[10px]">{i + 1}</div>
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

                              {activeAiSubTab === 'logs' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                  {/* Top summary cards */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[#0F172A]/60 border border-slate-700/40 rounded-2xl p-4 space-y-2">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Analysis Window</span>
                                      <div className="text-xs text-slate-200 font-mono">
                                        Period: {aiAnalysis.start_date} to {aiAnalysis.end_date}
                                      </div>
                                      <div className="text-xs text-slate-200 font-mono">
                                        Data Scope: {aiAnalysis.logs_count || 0} work logs | {aiAnalysis.total_hours ? Number(aiAnalysis.total_hours).toFixed(1) : 0} effort hours
                                      </div>
                                    </div>
                                    <div className="bg-[#0F172A]/60 border border-slate-700/40 rounded-2xl p-4 space-y-2">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Engine Config</span>
                                      <div className="text-xs text-slate-200 font-mono truncate">
                                        Model: {aiAnalysis.model || 'openai/gpt-oss-20b:free'}
                                      </div>
                                      <div className="text-xs text-slate-200 font-mono">
                                        Cache Status: {aiAnalysis.isCached ? (
                                          <span className="text-amber-400 font-bold">Cached Run ({new Date(aiAnalysis.created_at).toLocaleString('th-TH')})</span>
                                        ) : (
                                          <span className="text-emerald-400 font-bold">Fresh Run (No Cache)</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Job Criteria & Weight Allocation details */}
                                  <div className="bg-[#0F172A]/40 border border-slate-700/30 rounded-2xl p-4">
                                    <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Evaluated Criteria & Assigned Weights</h5>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                      {(aiAnalysis.weights || []).map((w: any, index: number) => (
                                        <div key={index} className="flex justify-between items-center text-[11px] py-1 border-b border-slate-800/40 last:border-0 font-mono">
                                          <span className="text-slate-300 truncate max-w-[280px]">{w.category}</span>
                                          <span className="text-indigo-400 font-bold">{w.weight}%</span>
                                        </div>
                                      ))}
                                      {(!aiAnalysis.weights || aiAnalysis.weights.length === 0) && (
                                        <div className="text-slate-500 italic text-xs">No JD target weights loaded for this run.</div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Reconstructed step logs */}
                                  <div className="bg-[#0F172A]/80 border border-slate-700/50 rounded-2xl p-4 font-mono text-[10px] leading-relaxed space-y-2 shadow-inner">
                                    <div className="text-slate-500 border-b border-slate-800 pb-1.5 mb-2 flex justify-between">
                                      <span>AUDIT PROCESS LOGS</span>
                                      <span className="text-slate-600">STATUS: DONE</span>
                                    </div>
                                    {aiAnalysis.isCached ? (
                                      <>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[{new Date(aiAnalysis.created_at).toLocaleTimeString()}]</span>
                                          <span className="text-slate-300">[INFO] Found cached performance audit result in Supabase.</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[{new Date(aiAnalysis.created_at).toLocaleTimeString()}]</span>
                                          <span className="text-slate-300">[INFO] Loaded JD configuration for active position.</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[{new Date(aiAnalysis.created_at).toLocaleTimeString()}]</span>
                                          <span className="text-slate-300">[INFO] Retrieved {aiAnalysis.logs_count || 0} matching worklog items total.</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[{new Date(aiAnalysis.created_at).toLocaleTimeString()}]</span>
                                          <span className="text-slate-300">[INFO] Validated cache date validity within 24-hour limit.</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[{new Date(aiAnalysis.created_at).toLocaleTimeString()}]</span>
                                          <span className="text-emerald-400 font-bold">[SUCCESS] Cache diagnostics retrieved and loaded to Dashboard.</span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[INFO]</span>
                                          <span className="text-slate-300">New Performance Diagnostics Executed.</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[INFO]</span>
                                          <span className="text-slate-300">Worklogs queried: {aiAnalysis.logs_count || 0} logs found.</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[INFO]</span>
                                          <span className="text-slate-300">Effort hours aggregated: {aiAnalysis.total_hours ? Number(aiAnalysis.total_hours).toFixed(1) : 0}h.</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[INFO]</span>
                                          <span className="text-slate-300">Model used: {aiAnalysis.model}</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-slate-500">[SUCCESS]</span>
                                          <span className="text-emerald-400">Analysis completed and saved successfully to database cache.</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              {activeAiSubTab === 'history' && (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                      <Clock size={14} /> ประวัติผลการวิเคราะห์
                                    </h4>
                                    <button
                                      onClick={loadAnalysisHistory}
                                      disabled={isLoadingHistory}
                                      className="text-[10px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                                    >
                                      <RefreshCw size={10} className={isLoadingHistory ? 'animate-spin' : ''} />
                                      {isLoadingHistory ? 'กำลังโหลด...' : 'รีเฟรช'}
                                    </button>
                                  </div>
                                  {isLoadingHistory ? (
                                    <div className="text-xs text-slate-500 italic text-center py-8">กำลังโหลดประวัติ...</div>
                                  ) : analysisHistory.length === 0 ? (
                                    <div className="text-xs text-slate-500 italic text-center py-8 border border-dashed border-slate-700/50 rounded-2xl">
                                      ยังไม่มีประวัติการวิเคราะห์สำหรับพนักงานคนนี้
                                    </div>
                                  ) : (
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                      {analysisHistory.map((record: any, idx: number) => (
                                        <div
                                          key={record.id || idx}
                                          className="flex items-center justify-between bg-[#0F172A]/60 border border-slate-700/40 hover:border-emerald-500/30 rounded-2xl px-4 py-3 transition-all group"
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            <div className="text-xs font-semibold text-slate-200">
                                              📅 {record.start_date} → {record.end_date}
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-500">
                                              วิเคราะห์เมื่อ: {new Date(record.created_at).toLocaleString('th-TH')}
                                            </div>
                                            <div className="flex gap-3 mt-1">
                                              <span className="text-[10px] text-indigo-400 font-mono">JD Align: <strong>{record.jd_alignment_score}%</strong></span>
                                              <span className="text-[10px] text-amber-400 font-mono">Burnout: <strong>{record.burnout_risk_score}%</strong></span>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => loadHistoryRecord(record)}
                                            className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all opacity-0 group-hover:opacity-100"
                                          >
                                            โหลดผล
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

      {/* Acknowledge Confirmation Modal */}
      {isAckConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsAckConfirmOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#1E293B] border border-slate-700/60 rounded-3xl p-6 shadow-2xl overflow-hidden text-center animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <button 
              onClick={() => setIsAckConfirmOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <UserCheck size={24} />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight mb-2">ยืนยันการลงนามรับทราบผลการวิเคราะห์</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              การลงนามรับทราบหมายถึงท่านได้ตรวจสอบผลการประมวลผลของพนักงานคนนี้ และพร้อมที่จะบันทึกประวัติเพื่อเป็นหลักฐานการทำ Audit ยืนยันที่จะดำเนินการต่อหรือไม่?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsAckConfirmOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs border border-slate-700 transition-all cursor-pointer"
              >
                ยกเลิก / Cancel
              </button>
              <button
                onClick={handleAcknowledgeAnalysis}
                disabled={isAcknowledging}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-emerald-800 disabled:to-teal-800 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isAcknowledging ? (
                  <>
                    <Loader2 className="animate-spin" size={13} />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>ลงนามรับทราบ / Confirm</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Settings Modal */}
      {isShareSettingsOpen && aiAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsShareSettingsOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-[#1E293B] border border-slate-700/60 rounded-3xl p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
            <button 
              onClick={() => setIsShareSettingsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
                <Share2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Public Share Settings</h3>
                <span className="text-[10px] text-slate-400 block">ควบคุมสิทธิ์การเข้าถึงรายงานการวิเคราะห์นี้</span>
              </div>
            </div>
            <div className="bg-[#0F172A]/40 border border-slate-800 rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 block mb-0.5 font-sans">การแชร์สาธารณะ (Public Sharing)</span>
                <span className="text-[10px] text-slate-500 leading-normal block max-w-[320px] font-sans">
                  เมื่อเปิดใช้งาน ลิงก์ภายนอกจะสามารถเข้าถึงหน้ารายงานสรุปผลได้โดยตรงโดยไม่ต้องทำการล็อกอินเข้าสู่ระบบ
                </span>
              </div>
              <button
                onClick={handleToggleShareAnalysis}
                disabled={isTogglingShare}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                  aiAnalysis.is_public ? "bg-indigo-600" : "bg-slate-700"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    aiAnalysis.is_public ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
            {aiAnalysis.is_public ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Public Shared Link</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={`${window.location.origin}/reports?share=${aiAnalysis.share_token}`}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono flex-1 focus:outline-none focus:border-indigo-500/50"
                    />
                    <button
                      onClick={handleCopyShareLink}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-2.5 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer shrink-0"
                      title="Copy URL"
                    >
                      <Copy size={14} />
                    </button>
                    <a
                      href={`/reports?share=${aiAnalysis.share_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold p-2.5 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer shrink-0"
                      title="Open in new window"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10px] text-slate-400 leading-normal flex items-start gap-2">
                  <Globe className="text-indigo-400 shrink-0 mt-0.5" size={12} />
                  <div>
                    <span className="font-bold text-slate-300 block mb-0.5">ลิงก์แชร์ใช้งานได้ 30 วัน</span>
                    สิทธิ์การเข้าถึงจะหมดอายุโดยอัตโนมัติในวันที่ {aiAnalysis.expires_at ? new Date(aiAnalysis.expires_at).toLocaleDateString('th-TH') : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('th-TH')} หรือท่านสามารถกดปิดปุ่มการแชร์ข้างต้นเพื่อเพิกถอนสิทธิ์ได้ทันที
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl text-center py-6 animate-in fade-in duration-200">
                <Lock className="text-slate-650 mx-auto mb-2" size={24} />
                <h4 className="text-xs font-bold text-slate-300 mb-1 font-sans">รายงานนี้ได้รับการคุ้มครองสิทธิ์ (Private Mode)</h4>
                <p className="text-[10px] text-slate-500 leading-normal max-w-sm mx-auto font-sans">
                  ขณะนี้การแชร์สาธารณะถูกปิดอยู่ ผู้ใช้งานภายนอกไม่สามารถเข้าถึงรายงานได้ หากต้องการส่งรายงานให้ผู้เกี่ยวข้อง กรุณาเปิดสวิตช์เปิดใช้งานลิงก์สาธารณะด้านบน
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => setIsShareSettingsOpen(false)}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 px-5 rounded-xl text-xs border border-slate-700 transition-all cursor-pointer"
              >
                ปิดหน้าต่าง / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Only component for the standard view */}
      {aiAnalysis && (
        <PrintReportView 
          user={usersList.find(u => u.id === selectedUser)} 
          report={aiAnalysis} 
        />
      )}

    </AppLayout>
  );
}

function PrintReportView({ user, report }: { user: any, report: any }) {
  if (!report) return null;
  return (
    <div className="hidden print:block print-only w-full bg-white text-slate-900 p-8 font-sans" style={{ color: '#000' }}>
      <div className="border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight">AI Employee Diagnostics Audit Report</h1>
        <p className="text-sm text-slate-600">CONFIDENTIAL — HUMAN RESOURCES AUDIT TRAIL</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-slate-50 p-4 border border-slate-200 rounded-lg">
        <div>
          <span className="font-bold block text-slate-500 uppercase tracking-wider text-[9px]">Employee Target</span>
          <span className="font-black text-sm text-slate-850">{user?.full_name || 'N/A'} ({user?.nickname || 'N/A'})</span>
          <span className="block text-slate-600 mt-1">Position: {user?.position || 'N/A'} | Department: {user?.department || 'N/A'}</span>
        </div>
        <div className="text-right">
          <span className="font-bold block text-slate-500 uppercase tracking-wider text-[9px]">Audit Period</span>
          <span className="font-bold text-slate-800">{report.start_date} ~ {report.end_date}</span>
          <span className="block text-slate-600 mt-1">Generated: {new Date(report.created_at).toLocaleString('th-TH')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
          <span className="font-bold block text-slate-500 uppercase tracking-wider text-[9px] mb-1">JD Alignment Score</span>
          <span className="text-3xl font-black text-slate-900">{report.jd_alignment_score || 0}%</span>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
          <span className="font-bold block text-slate-500 uppercase tracking-wider text-[9px] mb-1">Burnout Risk Score</span>
          <span className="text-3xl font-black text-slate-900">{report.burnout_risk_score || 0}%</span>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-300 pb-1 mb-3">Executive Summary</h3>
        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
          {report.markdown_executive_summary || report.raw_ai_report || 'No executive summary available.'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-widest border-b border-slate-300 pb-1 mb-3">Key Strengths</h3>
          <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
            {(report.strengths || []).map((str: string, i: number) => (
              <li key={i}>{str}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest border-b border-slate-300 pb-1 mb-3">Execution Gaps</h3>
          <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
            {(report.improvements || []).map((imp: string, i: number) => (
              <li key={i}>{imp}</li>
            ))}
          </ul>
        </div>
      </div>

      {report.development_plan && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-300 pb-1 mb-3">Strategic Development Plan</h3>
          <div className="space-y-3 text-xs text-slate-700">
            {report.development_plan.short_term_90_days && (
              <div>
                <strong className="block text-slate-800">Short-Term Goals (90 Days):</strong>
                <p>{report.development_plan.short_term_90_days}</p>
              </div>
            )}
            {report.development_plan.long_term_goals && (
              <div className="mt-2">
                <strong className="block text-slate-800">Long-Term Career Goals:</strong>
                <p>{report.development_plan.long_term_goals}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sign-off section at the bottom */}
      <div className="mt-12 border-t border-slate-300 pt-6">
        <div className="grid grid-cols-2 gap-6 text-xs text-slate-600">
          <div>
            <span className="block font-bold text-slate-800">HRBP Signature Sign-off</span>
            <span className="block mt-4 border-b border-slate-400 w-48 h-6" />
            <span className="block mt-1">Date: ________________________</span>
          </div>
          <div className="text-right">
            <span className="block font-bold text-slate-800">Audit Status</span>
            <span className="block mt-1 font-bold text-slate-900">
              {report.acknowledged_at ? '✓ ACKNOWLEDGED' : 'AWAITING SIGNATURE'}
            </span>
            {report.acknowledged_at && (
              <span className="block mt-1 text-[10px] text-slate-500 font-mono">
                Signed on: {new Date(report.acknowledged_at).toLocaleString('th-TH')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
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
