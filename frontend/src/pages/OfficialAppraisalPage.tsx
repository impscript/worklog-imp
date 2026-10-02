import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  CalendarCheck,
  Award,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
  BrainCircuit,
  Eye,
  RefreshCw,
  FileCheck,
  History,
  Info,
  X,
  ShieldCheck
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';

interface UserProfile {
  id: string;
  emp_id: string;
  full_name: string;
  nickname?: string;
  department?: string;
  position?: string;
  employee_level?: string;
  avatar_url?: string;
  role?: string;
  active_workspace_id?: string;
  activeWorkspaceId?: string;
  workspaceName?: string;
}

interface JdData {
  id?: string;
  jd_text?: string;
  position_name?: string;
  key_responsibilities?: Record<string, unknown>[];
}

interface WorklogEntry {
  id: string;
  work_date: string;
  project_name?: string;
  action_name?: string;
  description: string;
  total_hours?: number;
  holding?: string;
  is_ot?: boolean;
}

interface AppraisalResult {
  overall_score: number;
  level: string;
  confidence: 'High' | 'Medium' | 'Low';
  role_type: 'manager' | 'officer';
  cycle: string;
  period: string;
  executive_summary: string;
  scores: {
    quantity: { score: number; max: number; level: string; sufficiency: string; reason: string };
    quality: { score: number; max: number; level: string; sufficiency: string; reason: string };
    learning: { score: number; max: number; level: string; sufficiency: string; reason: string };
    accountability: { score: number; max: number; level: string; sufficiency: string; reason: string };
    proactiveness: { score: number; max: number; level: string; sufficiency: string; reason: string };
  };
  evidences: {
    quantity: string[];
    quality: string[];
    learning: string[];
    accountability: string[];
    proactiveness: string[];
  };
  work_status: {
    completed: string[];
    in_progress: string[];
    pending: string[];
    overdue: string[];
  };
  jd_coverage: { item: string; status: 'Found' | 'Missing'; details: string }[];
  evidence_gaps: string[];
  top_strengths: string[];
  development_priorities: string[];
  recommendations: string[];
  calendar_logging_guide: string;
  operating_paradigm?: {
    ai_lead: { has_evidence: boolean; count: number; title: string; detail: string; badge: string };
    human_in_the_loop: { has_evidence: boolean; count: number; title: string; detail: string; badge: string };
    expert_in_the_loop: { has_evidence: boolean; count: number; title: string; detail: string; badge: string };
  };
}

interface AnalysisHistoryItem {
  id: string;
  template_id?: string;
  analysis_data?: AppraisalResult;
  score?: number;
  jd_alignment_score?: number;
  strengths?: string[];
  improvements?: string[];
  raw_ai_report?: string;
  created_at?: string;
  analysis_date?: string;
  start_date?: string;
  end_date?: string;
}

export default function OfficialAppraisalPage() {
  const navigate = useNavigate();

  // Session User
  const [currentUser] = useState<UserProfile | null>(() => {
    try {
      const sessionStr = typeof localStorage !== 'undefined' ? localStorage.getItem('worklog_session') : null;
      if (!sessionStr) return null;
      const parsed = JSON.parse(sessionStr);
      return {
        id: parsed.id,
        emp_id: parsed.empId || parsed.emp_id || '',
        full_name: parsed.name || parsed.full_name || '',
        nickname: parsed.nickname,
        department: parsed.department,
        position: parsed.position,
        role: parsed.role,
        avatar_url: parsed.avatar_url,
        active_workspace_id: parsed.activeWorkspaceId || parsed.active_workspace_id,
        activeWorkspaceId: parsed.activeWorkspaceId || parsed.active_workspace_id,
        workspaceName: parsed.workspaceName,
      };
    } catch {
      return null;
    }
  });
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);

  // Mode: Self vs Team
  const [evalMode, setEvalMode] = useState<'self' | 'team'>('self');
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>(() => {
    try {
      const sessionStr = typeof localStorage !== 'undefined' ? localStorage.getItem('worklog_session') : null;
      return sessionStr ? JSON.parse(sessionStr).id || '' : '';
    } catch {
      return '';
    }
  });

  // Cycle & Year
  const [selectedCycle, setSelectedCycle] = useState<'half_year' | 'end_year'>('half_year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Role prompt override
  const [roleOverride, setRoleOverride] = useState<'auto' | 'manager' | 'officer'>('auto');

  // Logs & Pre-flight stats
  const [candidateLogs, setCandidateLogs] = useState<WorklogEntry[]>([]);
  const [candidateJd, setCandidateJd] = useState<JdData | null>(null);
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);
  const [isPreflightLoading, setIsPreflightLoading] = useState<boolean>(false);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisPhase, setAnalysisPhase] = useState<string>('');
  const [appraisalResult, setAppraisalResult] = useState<AppraisalResult | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'infographic' | 'report' | 'growth'>('infographic');
  const [infographicMode, setInfographicMode] = useState<'single' | 'deck'>('single');

  // Modals & History
  const [isRefModalOpen, setIsRefModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyFilterTab, setHistoryFilterTab] = useState<'official' | 'all'>('official');
  const [savedHistory, setSavedHistory] = useState<AnalysisHistoryItem[]>([]);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // 1. Guard Session
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // 2. Load Workspace Users for Manager/Admin Team Evaluation (Strictly Scoped)
  useEffect(() => {
    async function fetchWorkspaceUsers() {
      if (!currentUser) return;
      setLoadingUsers(true);
      try {
        const currentWsId = currentUser.activeWorkspaceId || currentUser.active_workspace_id;
        let loadedUsers: UserProfile[] = [];

        if (currentWsId) {
          // 1. Primary: query workspace_users joined with users (avatar_url column does not exist on users table)
          const { data: memData, error: memErr } = await supabase
            .from('workspace_users')
            .select(`
              user_id,
              role,
              users (
                id,
                emp_id,
                full_name,
                nickname,
                department,
                position,
                employee_level,
                role,
                active_workspace_id
              )
            `)
            .eq('workspace_id', currentWsId);

          if (!memErr && memData && memData.length > 0) {
            loadedUsers = (memData as unknown as { users: UserProfile | null }[])
              .map((row) => row.users)
              .filter((u): u is UserProfile => Boolean(u))
              .map((u) => ({
                id: u.id,
                emp_id: u.emp_id,
                full_name: u.full_name,
                nickname: u.nickname,
                department: u.department,
                position: u.position,
                employee_level: u.employee_level,
                role: u.role,
                active_workspace_id: u.active_workspace_id,
              }));
          } else {
            // Fallback: Query users table directly with active_workspace_id
            const { data: directUsers, error: dirErr } = await supabase
              .from('users')
              .select('id, emp_id, full_name, nickname, department, position, employee_level, role, active_workspace_id')
              .eq('active_workspace_id', currentWsId)
              .order('full_name', { ascending: true });

            if (!dirErr && directUsers) {
              loadedUsers = directUsers;
            }
          }
        } else if (currentUser.role === 'admin') {
          // Admin fallback if no workspace is active
          const { data: allUsers } = await supabase
            .from('users')
            .select('id, emp_id, full_name, nickname, department, position, employee_level, role, active_workspace_id')
            .order('full_name', { ascending: true });
          if (allUsers) loadedUsers = allUsers;
        }

        // Deduplicate and sort by full_name
        const uniqueMap = new Map<string, UserProfile>();
        loadedUsers.forEach((u) => {
          if (u && u.id) uniqueMap.set(u.id, u);
        });
        const sorted = Array.from(uniqueMap.values()).sort((a, b) =>
          (a.full_name || '').localeCompare(b.full_name || '', 'th')
        );

        setUsersList(sorted);

        if (sorted.length > 0) {
          setSelectedTargetUserId((prev) => {
            if (prev && sorted.some((u) => u.id === prev)) {
              return prev;
            }
            const foundCurrent = sorted.find((u) => u.id === currentUser.id);
            return foundCurrent ? foundCurrent.id : sorted[0].id;
          });
        }
      } catch (e) {
        console.error('Failed to load workspace users:', e);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchWorkspaceUsers();
  }, [currentUser]);

  // Target Evaluated User
  const evaluatedUser = useMemo(() => {
    if (evalMode === 'self' || !selectedTargetUserId) {
      return currentUser;
    }
    return usersList.find((u) => u.id === selectedTargetUserId) || currentUser;
  }, [evalMode, selectedTargetUserId, currentUser, usersList]);

  // Evaluator Leader Status (Controls whether logged in user can switch to Team Evaluation)
  const isCurrentUserLeader = useMemo(() => {
    const pos = (currentUser?.position || '').toLowerCase();
    const lvl = (currentUser?.employee_level || '').toLowerCase();
    const role = (currentUser?.role || '').toLowerCase();
    return (
      role === 'admin' ||
      /section|manager|head|director|vp|chief|ผู้จัดการ|หัวหน้า/i.test(pos) ||
      /manager|mgr|head|director/i.test(lvl)
    );
  }, [currentUser]);

  // Is Manager Check for the Evaluated Candidate (Controls HR Prompt Standard: half-year-manager vs half-year-officer)
  const isManagerEvaluated = useMemo(() => {
    if (roleOverride === 'manager') return true;
    if (roleOverride === 'officer') return false;
    const pos = (evaluatedUser?.position || '').toLowerCase();
    const lvl = (evaluatedUser?.employee_level || '').toLowerCase();
    return (
      /section\s*manager|dept\s*manager|department\s*manager|head\s*of|director|vp|chief|ผู้จัดการ|หัวหน้าฝ่าย|หัวหน้าส่วน/i.test(pos) ||
      /section\s*mgr|dept\s*mgr|department\s*mgr|director|manager/i.test(lvl)
    );
  }, [roleOverride, evaluatedUser]);

  // Date Range calculation
  const dateRange = useMemo(() => {
    if (isCustomDate && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    if (selectedCycle === 'half_year') {
      return {
        start: `${selectedYear}-06-01`,
        end: `${selectedYear}-08-31`,
      };
    }
    // End-Year: Sept - Dec
    return {
      start: `${selectedYear}-09-01`,
      end: `${selectedYear}-12-31`,
    };
  }, [selectedCycle, selectedYear, isCustomDate, customStartDate, customEndDate]);

  // NOTE: appraisalResult & roleOverride are reset directly in event handlers below (no useEffect needed)

  // 3. Pre-flight Check: Fetch logs & JD for target user
  useEffect(() => {
    let isMounted = true;
    async function fetchPreflight() {
      if (!evaluatedUser?.id) return;
      setIsPreflightLoading(true);
      try {
        // Fetch JD, Logs, and Company Holidays in parallel
        const [jdRes, logsRes, holRes] = await Promise.allSettled([
          supabase
            .from('tb_user_jd')
            .select('*')
            .eq('user_id', evaluatedUser.id)
            .maybeSingle(),
          supabase
            .from('col_worklog')
            .select('id, work_date, project_name, action_name, description, total_hours, holding, is_ot')
            .eq('user_id', evaluatedUser.id)
            .gte('work_date', dateRange.start)
            .lte('work_date', dateRange.end)
            .order('work_date', { ascending: true }),
          supabase
            .from('tb_master_holiday')
            .select('date, name')
            .gte('date', dateRange.start)
            .lte('date', dateRange.end),
        ]);

        if (!isMounted) return;

        if (jdRes.status === 'fulfilled' && jdRes.value.data) {
          setCandidateJd(jdRes.value.data);
        } else {
          setCandidateJd(null);
        }

        if (logsRes.status === 'fulfilled' && logsRes.value.data) {
          setCandidateLogs(logsRes.value.data);
        } else {
          setCandidateLogs([]);
        }

        if (holRes.status === 'fulfilled' && holRes.value.data) {
          setHolidays(holRes.value.data);
        } else {
          setHolidays([]);
        }
      } catch (e) {
        console.error('Error preflight checking:', e);
      } finally {
        if (isMounted) {
          setIsPreflightLoading(false);
        }
      }
    }
    fetchPreflight();
    return () => {
      isMounted = false;
    };
  }, [evaluatedUser, dateRange.start, dateRange.end]);

  // Preflight Metrics
  const uniqueLoggedDays = useMemo(() => {
    return new Set(candidateLogs.map((l) => l.work_date)).size;
  }, [candidateLogs]);

  // Total Business Days in period: Excludes Saturdays (6), Sundays (0), and Company Holidays (tb_master_holiday)
  const businessDays = useMemo(() => {
    let count = 0;
    const cur = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const holidayDates = new Set(holidays.map((h) => h.date));
    while (cur <= end) {
      const day = cur.getDay();
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      // Exclude Saturday (6), Sunday (0), and Company Holidays
      if (day !== 0 && day !== 6 && !holidayDates.has(dateStr)) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count || 1;
  }, [dateRange.start, dateRange.end, holidays]);

  // Count company holidays that fell on weekdays in this period
  const holidayCountInPeriod = useMemo(() => {
    const cur = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const holidayDates = new Set(holidays.map((h) => h.date));
    let count = 0;
    while (cur <= end) {
      const day = cur.getDay();
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      if (day !== 0 && day !== 6 && holidayDates.has(dateStr)) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }, [dateRange.start, dateRange.end, holidays]);

  const loggingCoveragePct = useMemo(() => {
    return Math.min(100, Math.round((uniqueLoggedDays / businessDays) * 100));
  }, [uniqueLoggedDays, businessDays]);

  // 4. Run Appraisal Engine
  const handleStartAppraisal = async () => {
    if (!evaluatedUser) return;
    setIsAnalyzing(true);
    setAnalysisPhase('ดึงข้อมูลกิจกรรมและบันทึกงานตามเกณฑ์มาตรฐาน HR...');

    try {
      const totalEntries = candidateLogs.length;

      // 1. Group candidate logs by project
      const projectMap: Record<string, { count: number; hours: number; sampleLogs: WorklogEntry[] }> = {};
      candidateLogs.forEach((l) => {
        const pName = l.project_name?.trim() || 'งานประจำ/ทั่วไป';
        if (!projectMap[pName]) {
          projectMap[pName] = { count: 0, hours: 0, sampleLogs: [] };
        }
        projectMap[pName].count += 1;
        projectMap[pName].hours += Number(l.total_hours || 0);
        if (projectMap[pName].sampleLogs.length < 5) {
          projectMap[pName].sampleLogs.push(l);
        }
      });
      const sortedProjects = Object.entries(projectMap)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, data]) => ({ name, ...data }));

      // 2. Delivery / Closure evidence logs
      const completionRegex = /\[result\]|\[ผลลัพธ์ที่ได้\]|\[ผลลัพธ์\]|สำเร็จ|live|deploy|release|uat|เสร็จสิ้น|เสร็จแล้ว|ปิดงาน|ส่งมอบ|sign.?off|accept|ยืนยัน/i;
      const deliverableLogs = candidateLogs.filter((l) =>
        completionRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );

      // 3. Learning & Development logs — Learn → Apply → Improve → Share
      const learningRegex = /train|อบรม|workshop|learn|knowledge|ศึกษา|ทบทวน|wi\b|case study|แชร์|transfer|lesson|review.*wi|knowledge.*sharing/i;
      const learningLogs = candidateLogs.filter((l) =>
        learningRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );
      // Applied / shared learning = higher evidence quality
      const learningAppliedRegex = /นำไปใช้|ประยุกต์|apply|improve|แชร์|share|transfer|จัดทำ.*wi|จัดเซสชัน|สรุปความรู้/i;
      const learningAppliedLogs = candidateLogs.filter((l) =>
        learningAppliedRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );

      // 4. TeamOps — general coordination
      const teamOpsRegex = /teamops|มอบหมาย|ติดตาม|feedback|ฟีดแบ็ก|ประสานงาน|sync|follow.?up/i;
      const teamOpsLogs = candidateLogs.filter((l) =>
        teamOpsRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );
      // Manager-specific: Coaching & Delegation tracked separately
      const coachingRegex = /coach|1.on.1|one.on.one|mentor|พัฒนาทีม|ให้คำแนะนำ|สอนงาน|feedback.*team/i;
      const delegationRegex = /delegate|delegat|มอบหมายงาน|assign.*team|สั่งงาน.*ทีม/i;
      const coachingLogs = candidateLogs.filter((l) =>
        coachingRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );
      const delegationLogs = candidateLogs.filter((l) =>
        delegationRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );

      // 5. Proactiveness — Anticipate → Initiate → Prevent → Improve
      const proactiveRegex = /improve|ปรับปรุง|ริเริ่ม|root.?cause|ป้องกัน|automation|เสนอ|แก้ปัญหา|พัฒนาเครื่องมือ|preventive|initiative|risk.*ident|ดักจับ/i;
      const proactiveLogs = candidateLogs.filter((l) =>
        proactiveRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );

      // 6. Sharing & Knowledge Transfer (Tier 3 Learning)
      const sharingRegex = /share|แบ่งปัน|สอนงาน|ถ่ายทอด|knowledge transfer|kt\b|case study|จัดอบรม|เขียน wi|จัดทำ wi|คู่มือ|workshop.*ทีม|mentor/i;
      const sharingLogs = candidateLogs.filter((l) =>
        sharingRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );

      // 7. Paradigm: AI Lead evidence
      const aiLeadRegex = /\bai\b|chatgpt|claude|gemini|copilot|prompt|automation|script|bot|llm|ocr|auto(mate|mation)/i;
      const aiLeadLogs = candidateLogs.filter((l) =>
        aiLeadRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );

      // 8. Paradigm: Human in the Loop (User Touch & Stakeholder Context)
      const humanTouchRegex = /user|ผู้ใช้|ลูกค้า|customer|stakeholder|interview|pain.?point|workshop|บรีฟ|รับฟัง|อบรมผู้ใช้|สอบถาม|สำรวจ|หน้างาน|uat/i;
      const humanTouchLogs = candidateLogs.filter((l) =>
        humanTouchRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );

      // 9. Paradigm: Expert in the Loop (Governance & Quality Gate)
      const expertGovRegex = /review|ตรวจทาน|re.?check|audit|อนุมัติ|approve|governance|มาตรฐาน|supervisor|หัวหน้า|validate|qa\b|qc\b|wi\b|sop|compliance/i;
      const expertGovLogs = candidateLogs.filter((l) =>
        expertGovRegex.test((l.action_name || '') + ' ' + (l.description || ''))
      );

      setAnalysisPhase('ประมวลผล 5 มิติหลักและวิเคราะห์ด้วย AI...');

      // 6. Invoke analyze-performance edge function (with perf_evaluation template)
      let aiResponse: {
        strengths?: string[];
        improvements?: string[];
        markdown_executive_summary?: string;
        dimension_scores?: unknown;
      } | null = null;

      try {
        const { data: aiData, error: aiErr } = await supabase.functions.invoke('analyze-performance', {
          body: {
            user_id: evaluatedUser.id,
            start_date: dateRange.start,
            end_date: dateRange.end,
            template_id: 'perf_evaluation',
            workspace_id: evaluatedUser.active_workspace_id || currentUser?.activeWorkspaceId || 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001',
          },
        });
        if (!aiErr && aiData) {
          aiResponse = aiData;
        }
      } catch (err) {
        console.warn('Edge function invoke warning:', err);
      }

      setAnalysisPhase('คำนวณคะแนนเชิงประจักษ์และตรวจสอบความเพียงพอของหลักฐาน...');

      // Helper: scale ratio [0,1] to score out of max, clamped
      const scoreFromRatio = (ratio: number, max: number): number =>
        parseFloat(Math.min(max, Math.max(0, ratio * max)).toFixed(1));

      // Helper: map ratio to grade per HR prompt thresholds (90%/75%/60%)
      const ratioToLevel = (ratio: number): string =>
        ratio >= 0.9 ? 'ดีเยี่ยม' : ratio >= 0.75 ? 'ดี' : ratio >= 0.6 ? 'พอใช้' : 'ต้องพัฒนา';

      const ratioToSufficiency = (ratio: number, logCount: number): 'High' | 'Medium' | 'Low' =>
        logCount >= 10 && ratio >= 0.6 ? 'High' : logCount >= 3 ? 'Medium' : 'Low';

      // ─────────────────────────────────────────────────────────────────
      // 7. Pillar 1: Quantity (20%)
      // Best Practice: 50% Consistency (Logging Coverage) + 30% Output Volume + 20% Project/JD Diversity
      // Prevents exact keyword mismatches from penalizing prolific employees
      // ─────────────────────────────────────────────────────────────────
      const jdResponsibilities = candidateJd?.key_responsibilities && Array.isArray(candidateJd.key_responsibilities)
        ? (candidateJd.key_responsibilities as { category: string; weight?: number }[])
        : [];
      const jdTotal = Math.max(jdResponsibilities.length, 1);
      const jdMatchCount = jdResponsibilities.filter((kr) => {
        const cat = (kr.category || '').toLowerCase().trim();
        if (!cat) return false;
        const tokens = cat.split(/[\s,/-]+/).filter((t) => t.length > 2);
        return candidateLogs.some((l) => {
          const logText = ((l.project_name || '') + ' ' + (l.action_name || '') + ' ' + (l.description || '')).toLowerCase();
          return tokens.some((t) => logText.includes(t));
        });
      }).length;
      const jdCoverageRatio = jdResponsibilities.length > 0 ? jdMatchCount / jdTotal : 1.0;

      const coverageRatio = loggingCoveragePct / 100;
      const volumeRatio = Math.min(1, totalEntries / Math.max(businessDays * 1.5, 40));
      const projectDiversityRatio = Math.min(1, Math.max(sortedProjects.length / 4, jdCoverageRatio));

      const qtyCompositeRatio = 0.50 * coverageRatio + 0.30 * volumeRatio + 0.20 * projectDiversityRatio;
      const qtyScore = scoreFromRatio(qtyCompositeRatio, 20);
      const qtyLevel = ratioToLevel(qtyCompositeRatio);
      const qtySufficiency: 'High' | 'Medium' | 'Low' =
        totalEntries >= 30 && loggingCoveragePct >= 60 ? 'High' :
        totalEntries >= 10 ? 'Medium' : 'Low';
      const jdNoteQty = jdResponsibilities.length > 0
        ? `ครอบคลุม JD ${jdMatchCount}/${jdTotal} หน้าที่หลัก, ${sortedProjects.length} โครงการ`
        : `ครอบคลุม ${sortedProjects.length} โครงการหลัก`;
      const qtyReason = `บันทึกงาน ${loggingCoveragePct}% ของวันทำการ (${uniqueLoggedDays}/${businessDays} วัน) รวม ${totalEntries} รายการ; ${jdNoteQty} — ถ่วงน้ำหนักความสม่ำเสมอ (50%) + ปริมาณผลงาน (30%) + ความครอบคลุม (20%)`;

      // ─────────────────────────────────────────────────────────────────
      // Pillar 2: Quality (20%)
      // "Insufficient Evidence" when evidence is too low — not a floor score
      // ─────────────────────────────────────────────────────────────────
      const topProjectNames = sortedProjects.slice(0, 3).map((p) => p.name).join(', ') || 'โครงการหลัก';
      let qualScore: number;
      let qualLevel: string;
      let qualSufficiency: 'High' | 'Medium' | 'Low';
      let qualReason: string;

      if (totalEntries < 5) {
        qualScore = 0;
        qualLevel = 'ไม่เพียงพอ (Insufficient Evidence)';
        qualSufficiency = 'Low';
        qualReason = `ข้อมูล worklog มีเพียง ${totalEntries} รายการ ไม่เพียงพอต่อการประเมินคุณภาพงาน (Insufficient Evidence) — ต้องขอยืนยันจาก Supervisor`;
      } else {
        const resultTagged = candidateLogs.filter((l) =>
          /\[result\]|\[ผลลัพธ์\]|outcome|impact/i.test(l.description || '')
        ).length;
        const deliveryRatio = Math.min(1, deliverableLogs.length / Math.max(totalEntries * 0.2, 5));
        const resultBonus = Math.min(0.1, resultTagged * 0.02);
        const qualRatio = Math.min(1, deliveryRatio + resultBonus);
        qualScore = scoreFromRatio(qualRatio, 20);
        qualLevel = ratioToLevel(qualRatio);
        qualSufficiency = ratioToSufficiency(qualRatio, deliverableLogs.length);
        qualReason = deliverableLogs.length >= 3
          ? `พบหลักฐานการส่งมอบงาน ${deliverableLogs.length} รายการใน ${topProjectNames}${resultTagged > 0 ? `, บันทึก Result/Outcome ชัดเจน ${resultTagged} รายการ` : ' แต่ยังขาดการระบุผลลัพธ์เชิงตัวเลข'} (Supervisor Validation Required)`
          : `พบหลักฐานการส่งมอบงาน ${deliverableLogs.length} รายการ ยังขาดการบันทึก Result/Outcome หรือหลักฐานการปิดงานที่ชัดเจน (Supervisor Validation Required)`;
      }

      // ─────────────────────────────────────────────────────────────────
      // Pillar 3: Learning (20%)
      // 3-Tiered Hierarchy per HR Standard: Learn → Apply → Share
      // Tier 1 (Attendance only): Max cap 13.0 / 20 (65% พอใช้)
      // Tier 2 (Apply to job): Max cap 16.5 / 20 (82.5% ดี)
      // Tier 3 (Share / Transfer to team / Standardize WI): Up to 20 / 20 (100% ดีเยี่ยม)
      // ─────────────────────────────────────────────────────────────────
      let learnScore: number;
      let learnLevel: string;
      let learnSufficiency: 'High' | 'Medium' | 'Low';
      let learnReason: string;

      if (totalEntries < 5) {
        learnScore = 0;
        learnLevel = 'ไม่เพียงพอ (Insufficient Evidence)';
        learnSufficiency = 'Low';
        learnReason = `ข้อมูลไม่เพียงพอต่อการประเมิน Learning (Insufficient Evidence)`;
      } else {
        const expectedLearnSessions = Math.max(businessDays / 8, 4);
        const attendanceRatio = Math.min(1, learningLogs.length / expectedLearnSessions);
        const applyRatio = Math.min(1, learningAppliedLogs.length / Math.max(expectedLearnSessions * 0.6, 2));
        const shareRatio = Math.min(1, sharingLogs.length / 2);

        // Raw composite: Attendance (30%) + Application (40%) + Sharing/KT (30%)
        const rawLearnRatio = 0.30 * attendanceRatio + 0.40 * applyRatio + 0.30 * shareRatio;

        // Apply strict HR capping:
        let maxCapRatio = 0.65; // Tier 1: Learn only -> Max 13/20
        if (sharingLogs.length >= 1) {
          maxCapRatio = 1.0; // Tier 3: Share/KT present -> Up to 20/20
        } else if (learningAppliedLogs.length >= 2) {
          maxCapRatio = 0.825; // Tier 2: Applied to work -> Max 16.5/20
        }

        const cappedRatio = Math.min(maxCapRatio, rawLearnRatio);
        learnScore = scoreFromRatio(cappedRatio, 20);
        learnLevel = ratioToLevel(cappedRatio);
        learnSufficiency = ratioToSufficiency(cappedRatio, learningLogs.length);

        if (learningLogs.length === 0) {
          learnScore = scoreFromRatio(0.2, 20);
          learnLevel = 'ต้องพัฒนา';
          learnSufficiency = 'Low';
          learnReason = `ไม่พบบันทึกการเรียนรู้หรือพัฒนาทักษะ ควรเพิ่มการ Upskill/Reskill และบันทึกการนำความรู้ไปใช้งาน`;
        } else if (sharingLogs.length > 0) {
          learnReason = `พบบันทึกการเรียนรู้ ${learningLogs.length} รายการ, นำไปใช้ ${learningAppliedLogs.length} รายการ, และถ่ายทอด/แบ่งปัน ${sharingLogs.length} รายการ (ครบวงจร Learn→Apply→Share)`;
        } else if (learningAppliedLogs.length > 0) {
          learnReason = `พบบันทึกการเรียนรู้ ${learningLogs.length} รายการ มีหลักฐานการนำไปใช้จริง ${learningAppliedLogs.length} รายการ — แต่ยังขาด Knowledge Transfer สู่ทีม (คะแนนจำกัดเพดานที่ระดับ 'ดี' ตามเกณฑ์ HR)`;
        } else {
          learnReason = `พบบันทึกการเรียนรู้ ${learningLogs.length} รายการ แต่ยังขาดหลักฐานการนำความรู้ไปประยุกต์ใช้หรือแบ่งปัน (การเข้าร่วม Training อย่างเดียวจำกัดเพดานคะแนนที่ระดับ 'พอใช้')`;
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // Pillar 4: Accountability (20%)
      // Manager: TeamOps (40%) + Coaching (35%) + Delegation (25%)
      // Officer: Closure evidence (60%) + Follow-up (40%) — NOT loggingCoveragePct
      // ─────────────────────────────────────────────────────────────────
      let acctScore: number;
      let acctLevel: string;
      let acctSufficiency: 'High' | 'Medium' | 'Low';
      let acctReason: string;

      if (isManagerEvaluated) {
        const teamOpsRatio = Math.min(1, teamOpsLogs.length / Math.max(businessDays / 5, 4));
        const coachRatio = Math.min(1, coachingLogs.length / Math.max(businessDays / 10, 2));
        const delegRatio = Math.min(1, delegationLogs.length / Math.max(businessDays / 15, 2));
        const acctRatio = 0.4 * teamOpsRatio + 0.35 * coachRatio + 0.25 * delegRatio;
        acctScore = scoreFromRatio(acctRatio, 20);
        acctLevel = ratioToLevel(acctRatio);
        acctSufficiency = ratioToSufficiency(acctRatio, teamOpsLogs.length + coachingLogs.length + delegationLogs.length);
        acctReason = `TeamOps/ติดตาม ${teamOpsLogs.length} ครั้ง | Coaching ${coachingLogs.length} ครั้ง | Delegation ${delegationLogs.length} ครั้ง — ถ่วงน้ำหนัก 40%/35%/25% ตามมาตรฐาน Manager`;
        if (acctSufficiency === 'Low') acctReason += ' — หลักฐานยังน้อย ควรบันทึก Coaching Session และการมอบหมายงานให้ชัดเจน';
      } else {
        const followUpRegex = /follow.?up|ติดตาม|อัพเดต|update.*status|รายงานความคืบหน้า|escalat/i;
        const followUpLogs = candidateLogs.filter((l) =>
          followUpRegex.test((l.action_name || '') + ' ' + (l.description || ''))
        );
        const closureRatio = Math.min(1, deliverableLogs.length / Math.max(sortedProjects.length * 0.5, 2));
        const followUpRatio = Math.min(1, followUpLogs.length / Math.max(businessDays / 10, 2));
        const acctRatio = 0.6 * closureRatio + 0.4 * followUpRatio;
        acctScore = scoreFromRatio(acctRatio, 20);
        acctLevel = ratioToLevel(acctRatio);
        acctSufficiency = ratioToSufficiency(acctRatio, deliverableLogs.length + followUpLogs.length);
        if (deliverableLogs.length === 0 && followUpLogs.length === 0) {
          acctScore = scoreFromRatio(0.3, 20);
          acctLevel = 'ต้องพัฒนา';
          acctSufficiency = 'Low';
          acctReason = `ไม่พบหลักฐานการ Close งานหรือการ Follow-up สถานะ — ควรเพิ่มการบันทึกการปิดงาน ส่งมอบ และการอัปเดต Progress (Supervisor Validation Required)`;
        } else {
          acctReason = `พบหลักฐาน Closure/ปิดงาน ${deliverableLogs.length} รายการ, Follow-up/ติดตาม ${followUpLogs.length} รายการ — ถ่วงน้ำหนัก Closure (60%) + Follow-up (40%)`;
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // Pillar 5: Proactiveness (20%)
      // Balanced: 50% Absolute Output Volume + 50% Density Ratio
      // Avoids penalizing high-volume workers whose denominator is large
      // ─────────────────────────────────────────────────────────────────
      let proactScore: number;
      let proactLevel: string;
      let proactSufficiency: 'High' | 'Medium' | 'Low';
      let proactReason: string;

      if (totalEntries < 5) {
        proactScore = 0;
        proactLevel = 'ไม่เพียงพอ (Insufficient Evidence)';
        proactSufficiency = 'Low';
        proactReason = `ข้อมูลไม่เพียงพอต่อการประเมิน Proactiveness (Insufficient Evidence)`;
      } else {
        const proactiveDensity = proactiveLogs.length / Math.max(totalEntries, 1);
        const densityRatio = Math.min(1, proactiveDensity / 0.15); // 15%+ density = 1.0
        const volumeRatio = Math.min(1, proactiveLogs.length / 15); // 15+ proactive actions in half-year = 1.0
        const proactRatio = 0.50 * volumeRatio + 0.50 * densityRatio;

        proactScore = scoreFromRatio(proactRatio, 20);
        proactLevel = ratioToLevel(proactRatio);
        proactSufficiency = ratioToSufficiency(proactRatio, proactiveLogs.length);
        if (proactiveLogs.length === 0) {
          proactScore = scoreFromRatio(0.3, 20);
          proactLevel = 'ต้องพัฒนา';
          proactSufficiency = 'Low';
          proactReason = `ไม่พบหลักฐานการริเริ่มแก้ Root Cause, เสนอ Improvement หรือป้องกันปัญหาล่วงหน้า — การตอบสนองเร็วหลังได้รับคำสั่ง = Responsiveness ไม่ใช่ Proactiveness`;
        } else {
          proactReason = `พบกิจกรรม Proactive ${proactiveLogs.length} รายการ (${(proactiveDensity * 100).toFixed(0)}% ของงานทั้งหมด) — ถ่วงน้ำหนักจากปริมาณริเริ่มจริง (${proactiveLogs.length} ครั้ง) ร่วมกับสัดส่วนงาน`;
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // 8. Total Score & Grade
      // ─────────────────────────────────────────────────────────────────
      const totalScore = parseFloat((qtyScore + qualScore + learnScore + acctScore + proactScore).toFixed(1));
      const gradeLevel = totalScore >= 90 ? 'ดีเยี่ยม' : totalScore >= 75 ? 'ดี' : totalScore >= 60 ? 'พอใช้' : 'ต้องพัฒนา';
      const overallConfidence: 'High' | 'Medium' | 'Low' =
        totalEntries >= 50 && loggingCoveragePct >= 75 ? 'High' : totalEntries >= 20 ? 'Medium' : 'Low';

      // ─────────────────────────────────────────────────────────────────
      // 9. Work Status from REAL logs
      // ─────────────────────────────────────────────────────────────────
      const completedList: string[] = [];
      const inProgressList: string[] = [];
      const pendingList: string[] = [];
      const overdueList: string[] = [];

      // Completed: only logs with clear closure/deliverable marker
      deliverableLogs.slice(0, 4).forEach((l) => {
        const text = l.description.split('\n')[0].replace(/\[.*?\]/g, '').trim();
        const item = `${l.project_name || 'งาน'}: ${text.slice(0, 80)}`;
        if (!completedList.includes(item)) completedList.push(item);
      });

      // In-progress: top projects with NO deliverable marker (still ongoing)
      sortedProjects.slice(0, 5).forEach((p) => {
        const hasDeliverable = deliverableLogs.some((l) => l.project_name === p.name);
        if (!hasDeliverable && inProgressList.length < 3) {
          const sample = p.sampleLogs[0]?.description.split('\n')[0].replace(/\[.*?\]/g, '').trim() || 'ดำเนินงานต่อเนื่อง';
          const item = `${p.name}: ${sample.slice(0, 80)}`;
          if (!completedList.includes(item)) inProgressList.push(item);
        }
      });
      if (inProgressList.length === 0 && sortedProjects[0]) {
        inProgressList.push(`${sortedProjects[0].name}: ดำเนินงานและขยายผลอย่างต่อเนื่อง`);
      }

      pendingList.push('การสรุปตัวเลขผลกระทบเชิงธุรกิจ (Business Outcome & Saving Metrics) ร่วมกับ Supervisor');
      if (loggingCoveragePct < 70) {
        pendingList.push(`บันทึกข้อมูลย้อนหลังสำหรับวันทำการที่ยังไม่ได้ลงงาน (ขาดบันทึก ${businessDays - uniqueLoggedDays} วัน)`);
      }

      // Overdue: projects silent for >4 weeks before period end with no closure marker
      const fourWeeksMs = 28 * 24 * 60 * 60 * 1000;
      const endPeriodMs = new Date(dateRange.end).getTime();
      sortedProjects.slice(0, 5).forEach((p) => {
        const lastLog = p.sampleLogs[p.sampleLogs.length - 1];
        if (lastLog) {
          const lastLogMs = new Date(lastLog.work_date).getTime();
          if (endPeriodMs - lastLogMs > fourWeeksMs && !deliverableLogs.some((d) => d.project_name === p.name)) {
            if (overdueList.length < 2) overdueList.push(`${p.name}: ไม่มีบันทึกงานมาเกิน 4 สัปดาห์ก่อนสิ้นรอบ — ควรตรวจสอบสถานะ`);
          }
        }
      });

      // ─────────────────────────────────────────────────────────────────
      // 10. JD Coverage (real JD responsibilities vs logs)
      // ─────────────────────────────────────────────────────────────────
      let jdCoverageItems: { item: string; status: 'Found' | 'Missing'; details: string }[] = [];
      if (jdResponsibilities.length > 0) {
        jdCoverageItems = jdResponsibilities.map((kr) => {
          const cat = kr.category || '';
          const matched = candidateLogs.filter((l) =>
            new RegExp(cat.replace(/[^a-zA-Z0-9ก-๙\s]/g, '.'), 'i').test(
              (l.project_name || '') + ' ' + (l.action_name || '') + ' ' + (l.description || '')
            )
          );
          const label = `${cat}${kr.weight ? ` (${kr.weight}%)` : ''}`;
          if (matched.length > 0) {
            const sampleProj = Array.from(new Set(matched.map((m) => m.project_name).filter(Boolean))).slice(0, 2).join(', ');
            return { item: label, status: 'Found' as const, details: `พบบันทึกสอดคล้อง ${matched.length} รายการ (${sampleProj || 'งานที่เกี่ยวข้อง'})` };
          }
          return { item: label, status: 'Missing' as const, details: 'ไม่พบบันทึกงานที่สอดคล้องกับหน้าที่นี้ในช่วงเวลาประเมิน' };
        });
      } else {
        jdCoverageItems = [
          { item: `การปฏิบัติงานในโครงการหลัก (${sortedProjects[0]?.name || 'งานประจำ'})`, status: 'Found', details: `พบบันทึกงาน ${sortedProjects[0]?.count || 0} รายการ` },
          { item: `การบริหารจัดการและสนับสนุน (${sortedProjects[1]?.name || 'งานสนับสนุน'})`, status: sortedProjects[1] ? 'Found' : 'Missing', details: sortedProjects[1] ? `พบบันทึกงาน ${sortedProjects[1].count} รายการ` : 'ไม่พบโครงการสนับสนุนในช่วงนี้' },
          { item: 'การประสานงานและติดตามงานในทีม (TeamOps)', status: teamOpsLogs.length > 0 ? 'Found' : 'Missing', details: teamOpsLogs.length > 0 ? `พบกิจกรรมประสานงาน ${teamOpsLogs.length} ครั้ง` : 'ไม่พบบันทึกการติดตามงานในทีม' },
          { item: 'การเรียนรู้และพัฒนาทักษะ (Continuous Learning)', status: learningLogs.length > 0 ? 'Found' : 'Missing', details: learningLogs.length > 0 ? `พบกิจกรรมอบรม/ศึกษา ${learningLogs.length} รายการ` : 'ไม่พบบันทึกการอบรม/ศึกษา' },
          { item: 'การสรุปผลงานและวัดผลสัมฤทธิ์ (Deliverable Tracking)', status: deliverableLogs.length > 0 ? 'Found' : 'Missing', details: deliverableLogs.length > 0 ? `พบการบันทึกผลงานสำเร็จ ${deliverableLogs.length} รายการ` : 'ยังขาดการบันทึกตัวชี้วัดผลสัมฤทธิ์' },
        ];
      }

      // ─────────────────────────────────────────────────────────────────
      // 11. Executive Summary
      // ─────────────────────────────────────────────────────────────────
      let disciplineText = '';
      if (loggingCoveragePct >= 85) {
        disciplineText = `ได้อย่างมีวินัยสูง บันทึกงานสม่ำเสมอถึง ${loggingCoveragePct}% (${uniqueLoggedDays} จาก ${businessDays} วันทำการ)`;
      } else if (loggingCoveragePct >= 70) {
        disciplineText = `มีความสม่ำเสมอในการบันทึกงานที่ดี (${loggingCoveragePct}% หรือ ${uniqueLoggedDays} จาก ${businessDays} วันทำการ)`;
      } else if (loggingCoveragePct >= 50) {
        disciplineText = `มีอัตราการบันทึกงาน ${loggingCoveragePct}% (${uniqueLoggedDays} จาก ${businessDays} วันทำการ) ปานกลาง พบช่วงที่ไม่ลงงานหลายสัปดาห์`;
      } else {
        disciplineText = `มีอัตราการบันทึกงานเพียง ${loggingCoveragePct}% (${uniqueLoggedDays} จาก ${businessDays} วันทำการ) ต้องปรับปรุงความสม่ำเสมออย่างเร่งด่วน`;
      }
      const roleFocusText = isManagerEvaluated
        ? 'การวางแผนกำกับดูแลทีมงาน (TeamOps) และการผลักดันโครงการเชิงกลยุทธ์'
        : `การส่งมอบงานในโครงการหลัก (${sortedProjects.slice(0, 2).map((p) => p.name).join(', ') || 'งานที่ได้รับมอบหมาย'})`;
      const executiveSummary = `${evaluatedUser.full_name} (${evaluatedUser.position || 'พนักงาน'}) ปฏิบัติงานในรอบ ${
        selectedCycle === 'half_year' ? 'ครึ่งปีแรก' : 'สิ้นปี'
      } ${disciplineText} โดยมีภาระงานหลักขับเคลื่อนใน ${sortedProjects.slice(0, 3).map((p) => p.name).join(', ') || 'โครงการหลัก'} มีจุดแข็งสำคัญในด้าน ${roleFocusText} โดยควรต่อยอดด้านการบันทึกตัวชี้วัดผลกระทบเชิงธุรกิจ (Business Outcome Metrics) และการปิดลูปตรวจรับงาน (Closure) ให้สมบูรณ์ยิ่งขึ้น`;

      // ─────────────────────────────────────────────────────────────────
      // 12. Strengths, Priorities & Recommendations (all derived, none hardcoded)
      // ─────────────────────────────────────────────────────────────────
      const realStrengths: string[] = [];
      if (aiResponse?.strengths && Array.isArray(aiResponse.strengths) && aiResponse.strengths.length > 0) {
        realStrengths.push(...aiResponse.strengths.slice(0, 3));
      } else {
        if (sortedProjects[0]) realStrengths.push(`ความมุ่งมั่นและเชี่ยวชาญในการขับเคลื่อนโครงการ ${sortedProjects[0].name} อย่างต่อเนื่อง`);
        if (loggingCoveragePct >= 80) realStrengths.push(`มีวินัยในการลงบันทึกงานสม่ำเสมอสูงถึง ${loggingCoveragePct}% ตรวจสอบย้อนกลับได้ชัดเจน`);
        if (learningAppliedLogs.length >= 2) realStrengths.push(`มีหลักฐานการนำความรู้ไปประยุกต์ใช้จริง ${learningAppliedLogs.length} ครั้ง (วงจร Learn→Apply)`);
        else if (learningLogs.length >= 5) realStrengths.push(`ให้ความสำคัญกับการเรียนรู้และพัฒนาทักษะ (พบประวัติอบรม ${learningLogs.length} ครั้ง)`);
        if (isManagerEvaluated && (coachingLogs.length + delegationLogs.length) >= 3) realStrengths.push(`มีภาวะผู้นำในการ Coaching และมอบหมายงาน (${coachingLogs.length + delegationLogs.length} ครั้ง)`);
        if (proactiveLogs.length >= 3) realStrengths.push(`มีความคิดริเริ่มเชิงรุก ปรับปรุงงาน ${proactiveLogs.length} รายการ`);
        if (realStrengths.length < 2 && sortedProjects[1]) realStrengths.push(`สามารถสนับสนุนภาระงานหลากหลายด้าน รวมถึง ${sortedProjects[1].name}`);
      }

      // Priorities: derived from pillars scoring < 80% of max (16/20)
      const pillarResults = [
        { name: 'Quantity', score: qtyScore, max: 20, hint: `ยกระดับการบันทึกงานให้ครอบคลุม JD ทุกหน้าที่ (ปัจจุบัน ${loggingCoveragePct}% ของวันทำการ)` },
        { name: 'Quality', score: qualScore, max: 20, hint: `เพิ่มการบันทึก Result/Outcome ของงานให้ชัดเจน ใช้สูตร [What]→[Action]→[Result]→[Follow-up]` },
        { name: 'Learning', score: learnScore, max: 20, hint: `ยกระดับ Learning Loop: บันทึกว่านำความรู้ไปใช้ที่ไหน และจัด Knowledge Sharing ให้ทีม` },
        { name: 'Accountability', score: acctScore, max: 20, hint: isManagerEvaluated ? `เพิ่มความถี่ Coaching Session และบันทึก Delegation เป็นลายลักษณ์อักษร` : `เพิ่มการบันทึก Closure และ Follow-up ก่อนปิดงาน` },
        { name: 'Proactiveness', score: proactScore, max: 20, hint: `บันทึก Root Cause Analysis, Improvement Proposal หรือ Risk Identification ที่ริเริ่มเอง` },
      ];
      const realPriorities = pillarResults
        .filter((p) => p.score / p.max < 0.8)
        .sort((a, b) => (a.score / a.max) - (b.score / b.max))
        .slice(0, 3)
        .map((p) => `[${p.name}] ${p.hint}`);
      if (realPriorities.length === 0) {
        realPriorities.push('กำหนดตัวชี้วัดผลกระทบเชิงธุรกิจ (Business Outcome / Man-hour Saving) ในทุกโครงการที่ส่งมอบ');
        realPriorities.push('จัดทำบันทึกสรุปขั้นตอนการทำงาน (WI / Case Study) เพื่อส่งต่อความรู้ทีม');
      }

      // Recommendations: derived from actual gaps
      const realRecommendations: string[] = [
        'บันทึกผลลัพธ์ของงานแต่ละวันตามสูตร: [What] ➔ [Action] ➔ [Result] ➔ [Follow-up]',
      ];
      if (deliverableLogs.length < 3) realRecommendations.push('เพิ่มการบันทึกหลักฐานการปิดงาน เช่น UAT Sign-off, Deploy note หรือ "ส่งมอบงาน [วันที่]"');
      if (proactiveLogs.length < 3) realRecommendations.push('บันทึก Root Cause Analysis และ Improvement Proposal ทุกครั้งที่พบปัญหาซ้ำ');
      if (isManagerEvaluated && coachingLogs.length < 2) realRecommendations.push('จัดทำ 1-on-1 Feedback ทุก 2 สัปดาห์และบันทึกแผนพัฒนาของทีมงาน');
      if (learningAppliedLogs.length < 1 && learningLogs.length > 0) realRecommendations.push('หลังเข้าอบรมให้บันทึกว่านำความรู้ไปใช้ที่งานไหน ด้วยผลลัพธ์อย่างไร');

      // Evidence gaps: derived from JD misses + universal gaps
      const evidenceGaps: string[] = jdCoverageItems
        .filter((i) => i.status === 'Missing')
        .map((i) => `ไม่พบหลักฐานสำหรับ: ${i.item} — ต้องขอยืนยันจาก Supervisor`);
      evidenceGaps.push('ตัวเลขสถิติผลกระทบเชิงปริมาณ (Man-hour/Cost Saving) ต้องขอยืนยันจาก Supervisor');
      if (overdueList.length > 0) evidenceGaps.push('พบโครงการที่หยุดบันทึกงานนาน — ต้องตรวจสอบสถานะกับผู้รับผิดชอบ');

      const generatedResult: AppraisalResult = {
        overall_score: totalScore,
        level: gradeLevel,
        confidence: overallConfidence,
        role_type: isManagerEvaluated ? 'manager' : 'officer',
        cycle: selectedCycle === 'half_year' ? 'Half-Year' : 'End-Year',
        period: `${dateRange.start} ถึง ${dateRange.end}`,
        executive_summary: executiveSummary,
        scores: {
          quantity: { score: qtyScore, max: 20, level: qtyLevel, sufficiency: qtySufficiency, reason: qtyReason },
          quality: { score: qualScore, max: 20, level: qualLevel, sufficiency: qualSufficiency, reason: qualReason },
          learning: { score: learnScore, max: 20, level: learnLevel, sufficiency: learnSufficiency, reason: learnReason },
          accountability: { score: acctScore, max: 20, level: acctLevel, sufficiency: acctSufficiency, reason: acctReason },
          proactiveness: { score: proactScore, max: 20, level: proactLevel, sufficiency: proactSufficiency, reason: proactReason },
        },
        evidences: {
          quantity: [
            `สถิติการบันทึกงานครอบคลุม ${loggingCoveragePct}% ของวันทำการ (${uniqueLoggedDays}/${businessDays} วัน)`,
            `รวมบันทึกทั้งสิ้น ${totalEntries} รายการ ช่วง ${dateRange.start} ถึง ${dateRange.end}; ${jdNoteQty}`,
          ],
          quality: deliverableLogs.slice(0, 4).map((l) => `[${l.work_date}] ${l.project_name || '-'}: ${l.description.slice(0, 100)}...`),
          learning: learningLogs.slice(0, 4).map((l) => `[${l.work_date}] ${l.action_name || l.project_name}: ${l.description.slice(0, 100)}...`),
          accountability: isManagerEvaluated
            ? [...coachingLogs.slice(0, 2), ...delegationLogs.slice(0, 2)].map((l) => `[${l.work_date}] ${l.action_name || l.project_name}: ${l.description.slice(0, 100)}...`)
            : teamOpsLogs.slice(0, 4).map((l) => `[${l.work_date}] ${l.action_name || l.project_name}: ${l.description.slice(0, 100)}...`),
          proactiveness: proactiveLogs.slice(0, 4).map((l) => `[${l.work_date}] ${l.project_name || '-'}: ${l.description.slice(0, 100)}...`),
        },
        work_status: {
          completed: completedList,
          in_progress: inProgressList,
          pending: pendingList,
          overdue: overdueList,
        },
        jd_coverage: jdCoverageItems,
        evidence_gaps: evidenceGaps.slice(0, 5),
        top_strengths: realStrengths.slice(0, 3),
        development_priorities: realPriorities.slice(0, 3),
        recommendations: realRecommendations.slice(0, 4),
        calendar_logging_guide: 'ในรอบถัดไป แนะนำให้บันทึกตามสูตร: [What]: ชื่องานหรือปัญหา -> [Action]: วิธีการแก้ไขและบทบาทของตน -> [Result]: ผลลัพธ์ที่ได้จริง -> [Follow-up]: ขั้นตอนปิดงานหรือผู้รับผิดชอบต่อ',
        operating_paradigm: {
          ai_lead: {
            has_evidence: aiLeadLogs.length > 0,
            count: aiLeadLogs.length,
            title: aiLeadLogs.length > 0 ? 'ประยุกต์ใช้ AI / Automation ในงานจริง' : 'โอกาสนำ AI มาช่วยเร่งสปีดงาน',
            detail: aiLeadLogs.length > 0
              ? `พบหลักฐานการนำ AI/Script มาช่วยทุ่นแรง ${aiLeadLogs.length} รายการ (เช่น ${aiLeadLogs.slice(0, 2).map((l) => l.project_name || l.description.slice(0, 30)).join(', ')}) ช่วยลดเวลาทำงานซ้ำซ้อน`
              : 'ยังไม่พบการใช้ AI หรือ Automation ในบันทึกงาน — แนะนำให้เริ่มใช้ Generative AI ร่างเอกสาร สรุปประชุม หรือทำ Script ช่วยงาน Routine',
            badge: aiLeadLogs.length > 0 ? `พบ ${aiLeadLogs.length} รายการ` : 'ยังไม่มีหลักฐาน',
          },
          human_in_the_loop: {
            has_evidence: humanTouchLogs.length > 0,
            count: humanTouchLogs.length,
            title: humanTouchLogs.length > 0 ? 'เข้าใจบริบทและ Pain Point ผู้ใช้จริง' : 'ควรเพิ่มการสัมผัสผู้ใช้งานหน้างาน',
            detail: humanTouchLogs.length > 0
              ? `มีส่วนร่วมกับผู้ใช้งานและ Stakeholders ${humanTouchLogs.length} รายการ (เช่น ${humanTouchLogs.slice(0, 2).map((l) => l.project_name || l.description.slice(0, 30)).join(', ')}) ช่วยให้งานตอบโจทย์ Adoption สูง`
              : 'บันทึกงานส่วนใหญ่เป็นงานภายใน — แนะนำให้เพิ่มการเก็บ Feedback, สัมภาษณ์ Pain Point หรือทำ UAT ร่วมกับผู้ใช้จริง',
            badge: humanTouchLogs.length > 0 ? `พบ ${humanTouchLogs.length} รายการ` : 'เน้นงานเบื้องหลัง',
          },
          expert_in_the_loop: {
            has_evidence: expertGovLogs.length > 0,
            count: expertGovLogs.length,
            title: expertGovLogs.length > 0 ? 'มี Quality Gate และการกำกับดูแล' : 'ควรเพิ่มกระบวนการ Review/Validation',
            detail: expertGovLogs.length > 0
              ? `มีหลักฐานการตรวจทาน Audit, Review หรือปรึกษาหัวหน้างาน ${expertGovLogs.length} รายการ (เช่น ${expertGovLogs.slice(0, 2).map((l) => l.project_name || l.description.slice(0, 30)).join(', ')}) สร้างความถูกต้องตามมาตรฐาน`
              : 'ยังไม่พบบันทึกการให้ Supervisor หรือ SME ตรวจทานงานอย่างเป็นทางการ — แนะนำให้เพิ่มจุดตรวจทาน Quality Gate ก่อน Release',
            badge: expertGovLogs.length > 0 ? `พบ ${expertGovLogs.length} รายการ` : 'ยังไม่พบการรีวิว',
          },
        },
      };

      setAppraisalResult(generatedResult);

      // Save to tb_ai_individual_analysis — upsert to prevent duplicates
      try {
        const templateId = isManagerEvaluated ? 'half_year_manager' : 'half_year_officer';
        await supabase.from('tb_ai_individual_analysis').upsert(
          {
            user_id: evaluatedUser.id,
            template_id: templateId,
            analysis_data: generatedResult,
            score: generatedResult.overall_score,
            jd_alignment_score: Math.round(generatedResult.overall_score),
            strengths: generatedResult.top_strengths || [],
            improvements: generatedResult.development_priorities || [],
            raw_ai_report: generatedResult.executive_summary || '',
            analysis_date: new Date().toISOString(),
            start_date: dateRange.start,
            end_date: dateRange.end,
            evaluated_full_name: evaluatedUser.full_name,
            evaluated_position: evaluatedUser.position,
            evaluated_department: evaluatedUser.department,
          },
          { onConflict: 'user_id,template_id,start_date,end_date', ignoreDuplicates: false }
        );
      } catch (saveErr) {
        console.warn('Could not cache analysis row to DB:', saveErr);
      }
    } catch (e: unknown) {
      console.error('Appraisal error:', e);
    } finally {
      setIsAnalyzing(false);
      setAnalysisPhase('');
    }
  };

  // Copy Markdown Report
  const handleCopyReport = () => {
    if (!appraisalResult || !evaluatedUser) return;
    const r = appraisalResult;
    const text = `# รายงานผลการประเมินการปฏิบัติงาน (${r.cycle} Appraisal)
**ชื่อ-นามสกุล:** ${evaluatedUser.full_name} (${evaluatedUser.emp_id})
**ตำแหน่ง:** ${evaluatedUser.position || '-'} | **ฝ่าย:** ${evaluatedUser.department || '-'}
**ระดับชุดคำสั่ง:** ${isManagerEvaluated ? 'หัวหน้างาน (half-year-manager.md)' : 'พนักงานทั่วไป (half-year-officer.md)'}
**ช่วงเวลา:** ${r.period}
**คะแนนรวม:** ${r.overall_score} / 100 (${r.level}) | **ความเพียงพอของหลักฐาน:** ${r.confidence}

---
## บทสรุปผู้บริหาร (Executive Summary)
${r.executive_summary}

---
## ตารางสรุปคะแนน 5 มิติหลัก
- Quantity (ความครบถ้วน): ${r.scores.quantity.score}/20 [${r.scores.quantity.sufficiency}] - ${r.scores.quantity.reason}
- Quality (คุณภาพ): ${r.scores.quality.score}/20 [${r.scores.quality.sufficiency}] - ${r.scores.quality.reason}
- Learning (การเรียนรู้): ${r.scores.learning.score}/20 [${r.scores.learning.sufficiency}] - ${r.scores.learning.reason}
- Accountability (ความรับผิดชอบ): ${r.scores.accountability.score}/20 [${r.scores.accountability.sufficiency}] - ${r.scores.accountability.reason}
- Proactiveness (การริเริ่ม): ${r.scores.proactiveness.score}/20 [${r.scores.proactiveness.sufficiency}] - ${r.scores.proactiveness.reason}

---
## จุดแข็งหลัก 3 ประการ
${r.top_strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}

---
## จุดที่ควรพัฒนา 3 ประการ
${r.development_priorities.map((d, i) => `${i + 1}. ${d}`).join('\n')}

---
## คำแนะนำการลงบันทึกในรอบถัดไป
${r.calendar_logging_guide}
`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Load History
  const handleOpenHistory = async () => {
    if (!evaluatedUser?.id) return;
    setIsHistoryModalOpen(true);
    try {
      const { data } = await supabase
        .from('tb_ai_individual_analysis')
        .select('*')
        .eq('user_id', evaluatedUser.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setSavedHistory(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ========================================================= */}
        {/* 1. Header Banner & Official Standard Badge                */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-50/90 via-white to-purple-50/60 dark:from-slate-900 dark:via-indigo-950/70 dark:to-slate-900 border border-indigo-100 dark:border-indigo-500/20 shadow-xs dark:shadow-xl p-6 print:hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="p-2 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30">
                  <CalendarCheck size={22} />
                </span>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  AI Half - End Year
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck size={12} /> HR OFFICIAL STANDARD
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                ระบบประเมินผลการปฏิบัติงานรอบครึ่งปี (Half-Year: มิ.ย.-ส.ค.) และรอบสิ้นปี (End-Year: ก.ย.-ธ.ค.)
                ประเมินจากหลักฐานในระบบจริงตามเกณฑ์มาตรฐาน HR 100% ไร้การคาดเดา
              </p>
            </div>

            {/* Quick Action Badges */}
            <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
              <button
                onClick={() => setIsRefModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 transition-all shadow-xs"
              >
                <BookOpen size={14} />
                <span>ดูเกณฑ์มาตรฐาน HR (Prompt Ref)</span>
              </button>
              <button
                onClick={handleOpenHistory}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shadow-xs"
              >
                <History size={14} />
                <span>ประวัติการประเมิน</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. Setup Controls: Cycle, Mode, Role & Dates              */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 print:hidden">
          {/* Left Column: Target & Mode (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BrainCircuit size={18} className="text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">ผู้รับการประเมิน (Evaluation Target)</h3>
              </div>

              {/* Dual Mode Switcher if Admin/Leader */}
              {(currentUser?.role === 'admin' || isCurrentUserLeader) && (
                <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium">
                  <button
                    onClick={() => {
                      setEvalMode('self');
                      setAppraisalResult(null);
                      setRoleOverride('auto');
                      if (currentUser) setSelectedTargetUserId(currentUser.id);
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      evalMode === 'self'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ประเมินตนเอง
                  </button>
                  <button
                    onClick={() => {
                      setEvalMode('team');
                      setAppraisalResult(null);
                      setRoleOverride('auto');
                      if (usersList.length > 0 && !usersList.some((u) => u.id === selectedTargetUserId)) {
                        setSelectedTargetUserId(usersList[0].id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      evalMode === 'team'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ประเมินทีมงาน
                  </button>
                </div>
              )}
            </div>

            {/* Target Select */}
            {evalMode === 'team' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">เลือกพนักงานในสังกัด:</label>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40 font-medium">
                    🏢 {currentUser?.workspaceName || 'Workspace ปัจจุบัน'} ({usersList.length} คน)
                  </span>
                </div>
                <select
                  value={selectedTargetUserId}
                  onChange={(e) => {
                    setSelectedTargetUserId(e.target.value);
                    setAppraisalResult(null);
                    setRoleOverride('auto');
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {loadingUsers ? (
                    <option>กำลังโหลดรายชื่อพนักงานใน Workspace...</option>
                  ) : usersList.length === 0 ? (
                    <option>ไม่พบพนักงานใน Workspace นี้</option>
                  ) : (
                    usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.emp_id}) — {u.position || u.department || 'Staff'}
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : null}

            {/* Selected Profile Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden shrink-0 relative">
                  {evaluatedUser?.emp_id && (
                    <img
                      src={`https://wms.advanceagro.net/WSVIS/api/Face/GetImage?CardID=${evaluatedUser.emp_id}`}
                      alt={evaluatedUser.full_name || 'Avatar'}
                      className="w-full h-full object-cover absolute inset-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <span className="font-bold text-sm select-none">
                    {evaluatedUser?.full_name ? evaluatedUser.full_name.trim().slice(0, 2) : 'EM'}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                    <span>{evaluatedUser?.full_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">({evaluatedUser?.emp_id})</span>
                  </div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium truncate">
                    {evaluatedUser?.position || 'ตำแหน่งไม่ระบุ'} • {evaluatedUser?.department || 'IMP'}
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Role Detection & Override */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">ชุดคำสั่งที่เลือกใช้ (Prompt Standard):</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                    isManagerEvaluated
                      ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40'
                      : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40'
                  }`}
                >
                  {isManagerEvaluated ? <Award size={12} /> : <FileCheck size={12} />}
                  {isManagerEvaluated ? 'half-year-manager.md' : 'half-year-officer.md'}
                </span>
              </div>

              {/* Manual Override Buttons */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">สลับเกณฑ์:</span>
                <button
                  type="button"
                  onClick={() => setRoleOverride('auto')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                    roleOverride === 'auto'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  ตรวจจับอัตโนมัติ
                </button>
                <button
                  type="button"
                  onClick={() => setRoleOverride('manager')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                    roleOverride === 'manager'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  👔 ระดับผู้จัดการ
                </button>
                <button
                  type="button"
                  onClick={() => setRoleOverride('officer')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                    roleOverride === 'officer'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-2xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  💼 พนักงานทั่วไป
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Cycle & Pre-flight Evidence Status (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">รอบการประเมิน (Appraisal Cycle)</h3>
              </div>

              {/* Year Switcher */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">ปี:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-2 py-1 rounded-md text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                >
                  <option value={2026}>2026 (ปัจจุบัน)</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </div>
            </div>

            {/* Cycle Selection Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => {
                  setSelectedCycle('half_year');
                  setIsCustomDate(false);
                  setAppraisalResult(null);
                  setRoleOverride('auto');
                }}
                className={`cursor-pointer rounded-xl p-3 border transition-all ${
                  selectedCycle === 'half_year' && !isCustomDate
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${selectedCycle === 'half_year' && !isCustomDate ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    รอบครึ่งปี (Half-Year)
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${selectedCycle === 'half_year' && !isCustomDate ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-200/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300'}`}>
                    มิ.ย. - ส.ค.
                  </span>
                </div>
                <div className={`text-[11px] ${selectedCycle === 'half_year' && !isCustomDate ? 'text-indigo-700 dark:text-indigo-300/90 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                  1 มิ.ย. {selectedYear} – 31 ส.ค. {selectedYear}
                </div>
              </div>

              <div
                onClick={() => {
                  setSelectedCycle('end_year');
                  setIsCustomDate(false);
                  setAppraisalResult(null);
                  setRoleOverride('auto');
                }}
                className={`cursor-pointer rounded-xl p-3 border transition-all ${
                  selectedCycle === 'end_year' && !isCustomDate
                    ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-400 dark:border-purple-500 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${selectedCycle === 'end_year' && !isCustomDate ? 'text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    รอบสิ้นปี (End-Year)
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${selectedCycle === 'end_year' && !isCustomDate ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30' : 'bg-slate-200/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300'}`}>
                    ก.ย. - ธ.ค.
                  </span>
                </div>
                <div className={`text-[11px] ${selectedCycle === 'end_year' && !isCustomDate ? 'text-purple-700 dark:text-purple-300/90 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                  1 ก.ย. {selectedYear} – 31 ธ.ค. {selectedYear}
                </div>
              </div>
            </div>

            {/* Custom Dates Option Toggle */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">ช่วงวันที่จริงที่ใช้:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {dateRange.start} ถึง {dateRange.end}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomDate(!isCustomDate)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold underline underline-offset-2"
                >
                  {isCustomDate ? 'ใช้ช่วงมาตรฐาน' : 'กำหนดวันที่เอง'}
                </button>
              </div>

              {isCustomDate && (
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 font-medium">วันเริ่มต้น:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 font-medium">วันสิ้นสุด:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Pre-flight Data Stats */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">บันทึกงาน</div>
                <div className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {isPreflightLoading ? '...' : `${candidateLogs.length} งาน`}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">วันทำการ</div>
                <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {isPreflightLoading ? '...' : `${uniqueLoggedDays}/${businessDays}`}
                </div>
                {holidayCountInPeriod > 0 && (
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                    (หักวันหยุด {holidayCountInPeriod} วัน)
                  </div>
                )}
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">ความสม่ำเสมอ</div>
                <div className="text-sm font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">
                  {isPreflightLoading ? '...' : `${loggingCoveragePct}%`}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">สถานะ JD</div>
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {isPreflightLoading ? '...' : candidateJd ? 'พร้อม' : 'ทั่วไป'}
                </div>
              </div>
            </div>

            {/* Action Button: Start Appraisal */}
            <button
              onClick={handleStartAppraisal}
              disabled={isAnalyzing || isPreflightLoading || candidateLogs.length === 0}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all ${
                isAnalyzing || candidateLogs.length === 0
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 active:scale-[0.99]'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-white" />
                  <span>{analysisPhase || 'กำลังวิเคราะห์ผลงานตามเกณฑ์มาตรฐาน...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>
                    เริ่มประเมินผลงานรอบ {selectedCycle === 'half_year' ? 'Half-Year' : 'End-Year'} ด้วย AI
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. Results Hub (Infographic / Official Report / Growth)   */}
        {/* ========================================================= */}
        {/* Loading / Analyzing Progress Card */}
        {isAnalyzing && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 p-8 text-center space-y-4 shadow-lg animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
              <RefreshCw size={28} className="animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                กำลังประมวลผลการประเมินด้วย AI...
              </h3>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {analysisPhase || 'กำลังวิเคราะห์ผลงานตามเกณฑ์มาตรฐาน...'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                วิเคราะห์ {candidateLogs.length} บันทึกงานของ {evaluatedUser?.full_name} เปรียบเทียบกับเกณฑ์มาตรฐาน 5 มิติ (Quantity, Quality, Learning, Accountability, Proactiveness)
              </p>
            </div>
          </div>
        )}

        {/* Un-evaluated Readiness Card (Shown when employee switched or not evaluated yet) */}
        {!appraisalResult && !isAnalyzing && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center space-y-4 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
              <Sparkles size={28} />
            </div>
            <div className="max-w-lg mx-auto space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold border border-indigo-100 dark:border-indigo-900/40">
                <FileCheck size={12} />
                <span>สถานะ: พร้อมเริ่มประเมินผลงานสำหรับพนักงานท่านนี้</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                พนักงานเป้าหมาย: {evaluatedUser?.full_name} ({evaluatedUser?.emp_id})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เกณฑ์ประเมิน: <strong className="text-indigo-600 dark:text-indigo-400">{isManagerEvaluated ? 'half-year-manager.md (ระดับผู้จัดการ)' : 'half-year-officer.md (พนักงานทั่วไป)'}</strong> • รอบ: {selectedCycle === 'half_year' ? 'Half-Year' : 'End-Year'} ({dateRange.start} ถึง {dateRange.end})
              </p>
              <div className="pt-2 flex justify-center items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                <span>บันทึกงานจริง: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{candidateLogs.length} งาน</strong></span>
                <span>•</span>
                <span>ลงงานแล้ว: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{uniqueLoggedDays}/{businessDays} วัน</strong>{holidayCountInPeriod > 0 ? ` (หักวันหยุด ${holidayCountInPeriod} วัน)` : ''}</span>
                <span>•</span>
                <span>ความสม่ำเสมอ: <strong className="text-sky-600 dark:text-sky-400 font-mono">{loggingCoveragePct}%</strong></span>
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={handleStartAppraisal}
                disabled={candidateLogs.length === 0}
                className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-md hover:shadow-indigo-500/25 transition-all inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={16} />
                <span>เริ่มประเมินผลงานรอบ {selectedCycle === 'half_year' ? 'Half-Year' : 'End-Year'} ด้วย AI ทันที</span>
              </button>
            </div>
          </div>
        )}

        {appraisalResult && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-6 space-y-6 print:border-none print:shadow-none print:p-0 print:bg-white">
            {/* Results Navigation Tabs & Actions (Hidden on Print) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveResultTab('infographic')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeResultTab === 'infographic'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Eye size={14} />
                  <span>1. Executive Infographic (Dashboard & Deck)</span>
                </button>

                <button
                  onClick={() => setActiveResultTab('report')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeResultTab === 'report'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileCheck size={14} />
                  <span>2. Official HR Report (เอกสารทางการ)</span>
                </button>

                <button
                  onClick={() => setActiveResultTab('growth')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeResultTab === 'growth'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span>3. Growth & Action Plan</span>
                </button>
              </div>

              {/* Action Buttons: Copy / Print */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <button
                  onClick={handleCopyReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700"
                >
                  {copiedReport ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedReport ? 'คัดลอกรายงานแล้ว!' : 'คัดลอก Markdown'}</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all active:scale-[0.98]"
                >
                  <Printer size={14} />
                  <span>Export to PDF / พิมพ์</span>
                </button>
              </div>
            </div>

            {/* Printable Document Container */}
            <div className="print-appraisal-sheet print:w-full print:p-0 print:m-0 space-y-6">
              {/* Dedicated Print Only Header */}
              <div className="hidden print:flex flex-col border-b-2 border-slate-900 pb-3 mb-6 print:w-full">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                      WORKLOG SYSTEM • OFFICIAL PERFORMANCE APPRAISAL
                    </div>
                    <h1 className="text-xl font-black text-slate-900">
                      รายงานผลการประเมินการปฏิบัติงานทางการ ({selectedCycle === 'half_year' ? 'HALF-YEAR: มิ.ย.-ส.ค.' : 'END-YEAR: ก.ย.-ธ.ค.'} {selectedYear})
                    </h1>
                    <div className="text-xs text-slate-600 mt-0.5">
                      ตามเกณฑ์มาตรฐาน HR ({isManagerEvaluated ? 'half-year-manager.md' : 'half-year-officer.md'})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-indigo-700">{appraisalResult.overall_score} / 100</div>
                    <div className="text-xs font-bold text-slate-800">ระดับ "{appraisalResult.level}"</div>
                    <div className="text-[10px] text-slate-600">ความเพียงพอของหลักฐาน: {appraisalResult.confidence}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2.5 mt-2.5 border-t border-slate-300 text-xs text-slate-800">
                  <div><strong>พนักงาน:</strong> {evaluatedUser?.full_name} ({evaluatedUser?.emp_id})</div>
                  <div><strong>ตำแหน่ง:</strong> {evaluatedUser?.position || '-'}</div>
                  <div><strong>ฝ่าย:</strong> {evaluatedUser?.department || '-'}</div>
                  <div><strong>วันที่พิมพ์:</strong> {new Date().toLocaleDateString('th-TH')}</div>
                </div>
              </div>

              {/* TAB 1: EXECUTIVE INFOGRAPHIC */}
              {activeResultTab === 'infographic' && (
                <div className="space-y-6">
                  {/* Infographic Sub-mode Switcher (Hidden on Print) */}
                  <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 print:hidden">
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-cyan-500 dark:text-cyan-400" />
                      <span>Executive Visualization: ธีม Premium Modern รองรับการนำเสนอ C-Level</span>
                    </div>
                    <div className="flex p-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                      <button
                        onClick={() => setInfographicMode('single')}
                        className={`px-3 py-1 rounded-md transition-all font-semibold ${
                          infographicMode === 'single'
                            ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Option 1: One-Pager Dashboard
                      </button>
                      <button
                        onClick={() => setInfographicMode('deck')}
                        className={`px-3 py-1 rounded-md transition-all font-semibold ${
                          infographicMode === 'deck'
                            ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Option 2: 3-Slide Deck
                      </button>
                    </div>
                  </div>

                  {/* Single Page Dashboard View */}
                  {infographicMode === 'single' ? (
                    <div className="rounded-2xl bg-white dark:bg-[#07090e] border border-slate-200 dark:border-cyan-500/20 p-6 text-slate-900 dark:text-white space-y-6 shadow-sm dark:shadow-2xl print:border-none print:shadow-none print:p-0">
                      {/* Top KPI Banner */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-200 dark:border-slate-800/80">
                        <div>
                          <div className="text-xs text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-wider mb-1">
                            EXECUTIVE PERFORMANCE APPRAISAL • {appraisalResult.cycle}
                          </div>
                          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{evaluatedUser?.full_name}</h2>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {evaluatedUser?.position} • ฝ่าย {evaluatedUser?.department} • รอบ {appraisalResult.period}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-500/30 px-5 py-3 rounded-2xl">
                          <div className="text-right">
                            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">คะแนนประเมินรวม</div>
                            <div className="text-sm font-bold text-cyan-700 dark:text-cyan-400">ระดับ "{appraisalResult.level}"</div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                              สม่ำเสมอ {loggingCoveragePct}% ({uniqueLoggedDays}/{businessDays} วัน)
                            </div>
                          </div>
                          <div className="w-16 h-16 rounded-full border-2 border-cyan-500 flex flex-col items-center justify-center bg-cyan-100/60 dark:bg-cyan-500/10 shadow-xs dark:shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                            <span className="text-xl font-black text-cyan-900 dark:text-white">{appraisalResult.overall_score}</span>
                            <span className="text-[8px] text-cyan-700 dark:text-slate-400 font-bold">/ 100</span>
                          </div>
                        </div>
                      </div>

                      {/* Modern Operating Model: 3 Loops */}
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <BrainCircuit size={14} className="text-purple-600 dark:text-purple-400" />
                          <span>MODERN OPERATING PARADIGM: AI LEAD × HUMAN × EXPERT IN THE LOOP</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* 1. AI LEAD */}
                          <div className={`p-4 rounded-xl border space-y-2 transition-all ${
                            appraisalResult.operating_paradigm?.ai_lead.has_evidence
                              ? 'bg-purple-50/70 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30'
                              : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                          }`}>
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                                1. AI LEAD (Machine Velocity)
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                appraisalResult.operating_paradigm?.ai_lead.has_evidence
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                                {appraisalResult.operating_paradigm?.ai_lead.badge || (candidateLogs.some((l) => /ai|script|auto/i.test(l.description)) ? 'พบหลักฐาน' : 'ยังไม่มีหลักฐาน')}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {appraisalResult.operating_paradigm?.ai_lead.title || 'เร่งสปีดการวิเคราะห์และขึ้นระบบ'}
                            </h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                              {appraisalResult.operating_paradigm?.ai_lead.detail || 'นำ AI เข้ามาช่วยวิเคราะห์ สรุปข้อมูล และร่างโครงสร้างระบบ ลดระยะเวลาทำงานซ้ำซ้อน'}
                            </p>
                          </div>

                          {/* 2. HUMAN IN THE LOOP */}
                          <div className={`p-4 rounded-xl border space-y-2 transition-all ${
                            appraisalResult.operating_paradigm?.human_in_the_loop.has_evidence
                              ? 'bg-cyan-50/70 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30'
                              : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                          }`}>
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold">
                                2. HUMAN IN THE LOOP (Context)
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                appraisalResult.operating_paradigm?.human_in_the_loop.has_evidence
                                  ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                              }`}>
                                {appraisalResult.operating_paradigm?.human_in_the_loop.badge || 'สัมผัสผู้ใช้งาน'}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {appraisalResult.operating_paradigm?.human_in_the_loop.title || 'ตอบโจทย์การใช้งานจริงของคน'}
                            </h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                              {appraisalResult.operating_paradigm?.human_in_the_loop.detail || 'สัมผัส Pain Point จากผู้ใช้งานจริงและหน่วยงานที่เกี่ยวข้อง เพื่อปรับแต่งให้ตอบโจทย์หน้างานและเกิด Adoption สูงสุด'}
                            </p>
                          </div>

                          {/* 3. EXPERT IN THE LOOP */}
                          <div className={`p-4 rounded-xl border space-y-2 transition-all ${
                            appraisalResult.operating_paradigm?.expert_in_the_loop.has_evidence
                              ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                          }`}>
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                                3. EXPERT IN THE LOOP (Governance)
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                appraisalResult.operating_paradigm?.expert_in_the_loop.has_evidence
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                                {appraisalResult.operating_paradigm?.expert_in_the_loop.badge || 'การกำกับดูแล'}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {appraisalResult.operating_paradigm?.expert_in_the_loop.title || 'ธรรมาภิบาลและการโค้ชชิ่ง'}
                            </h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                              {appraisalResult.operating_paradigm?.expert_in_the_loop.detail || 'ตรวจทานความถูกต้อง กำกับทิศทาง และโค้ชชิ่งทีมงานตามมาตรฐานวิชาชีพ'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 5 Pillars Progress Bars & Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            5 HR PERFORMANCE PILLARS (คะแนนจำแนก 5 มิติ)
                          </div>

                          {/* Pillar 1 */}
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-800 dark:text-slate-200">1. Quantity (ความครบถ้วนของงาน)</span>
                              <span className="text-cyan-600 dark:text-cyan-400 font-bold">{appraisalResult.scores.quantity.score} / 20</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-cyan-500 rounded-full"
                                style={{ width: `${(appraisalResult.scores.quantity.score / 20) * 100}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">{appraisalResult.scores.quantity.reason}</div>
                          </div>

                          {/* Pillar 2 */}
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-800 dark:text-slate-200">2. Quality (คุณภาพและผลลัพธ์)</span>
                              <span className="text-sky-600 dark:text-sky-400 font-bold">{appraisalResult.scores.quality.score} / 20</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-sky-500 rounded-full"
                                style={{ width: `${(appraisalResult.scores.quality.score / 20) * 100}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">{appraisalResult.scores.quality.reason}</div>
                          </div>

                          {/* Pillar 3 */}
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-800 dark:text-slate-200">3. Learning (การเรียนรู้และการส่งต่อ)</span>
                              <span className="text-purple-600 dark:text-purple-400 font-bold">{appraisalResult.scores.learning.score} / 20</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${(appraisalResult.scores.learning.score / 20) * 100}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">{appraisalResult.scores.learning.reason}</div>
                          </div>

                          {/* Pillar 4 */}
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-800 dark:text-slate-200">4. Accountability (ความรับผิดชอบและการดูแลทีม)</span>
                              <span className="text-amber-600 dark:text-amber-400 font-bold">{appraisalResult.scores.accountability.score} / 20</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${(appraisalResult.scores.accountability.score / 20) * 100}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">{appraisalResult.scores.accountability.reason}</div>
                          </div>

                          {/* Pillar 5 */}
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-800 dark:text-slate-200">5. Proactiveness (การคิดและลงมือก่อน)</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{appraisalResult.scores.proactiveness.score} / 20</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${(appraisalResult.scores.proactiveness.score / 20) * 100}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">{appraisalResult.scores.proactiveness.reason}</div>
                          </div>
                        </div>

                        {/* Right: Key Deliverables & Growth */}
                        <div className="space-y-4">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            STRATEGIC DELIVERABLES & IMPACT
                          </div>
                          <div className="space-y-2">
                            {appraisalResult.work_status.completed.slice(0, 3).map((item, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                                  <span className="font-semibold text-slate-900 dark:text-white">{item}</span>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
                                  COMPLETED
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Top Strengths */}
                          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 space-y-1.5">
                            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                              <Award size={14} /> จุดแข็งสำคัญ (Top Strengths)
                            </div>
                            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                              {appraisalResult.top_strengths.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 3-Slide Deck View */
                    <div className="space-y-6">
                      {/* Slide 1 */}
                      <div className="p-6 rounded-2xl bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-cyan-500/20 text-slate-900 dark:text-white space-y-4 shadow-sm dark:shadow-xl print:border-slate-300 print:mb-6">
                        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div>
                            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 tracking-widest uppercase">
                              SLIDE 1 / 3 • EXECUTIVE SCORECARD
                            </span>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">ผลประเมินและสถิติความสม่ำเสมอในการทำงาน</h3>
                          </div>
                          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
                            {appraisalResult.overall_score} <span className="text-xs text-slate-500">/ 100</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{appraisalResult.executive_summary}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">อัตราการลงงาน</div>
                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{loggingCoveragePct}%</div>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">จำนวนบันทึกงาน</div>
                            <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{candidateLogs.length} งาน</div>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">ระดับผลงาน</div>
                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{appraisalResult.level}</div>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">ความเพียงพอของหลักฐาน</div>
                            <div className="text-lg font-bold text-sky-600 dark:text-sky-400">{appraisalResult.confidence}</div>
                          </div>
                        </div>
                      </div>

                      {/* Slide 2 */}
                      <div className="p-6 rounded-2xl bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-purple-500/20 text-slate-900 dark:text-white space-y-4 shadow-sm dark:shadow-xl print:border-slate-300 print:mb-6">
                        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div>
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 tracking-widest uppercase">
                              SLIDE 2 / 3 • MODERN OPERATING MODEL
                            </span>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">สถาปัตยกรรมทำงาน: AI-Lead × Human × Expert in the Loop</h3>
                          </div>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                            HYBRID SDLC
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                            <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300">1. AI Lead (ความเร็วเครื่องจักร)</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              ใช้ AI เป็นตัวเร่งการ Coding และวิเคราะห์ความต้องการ ช่วยลดภาระการจัดทำเอกสารและสคริปต์
                            </p>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                            <h4 className="text-xs font-bold text-cyan-700 dark:text-cyan-300">2. Human in the Loop (บริบทมนุษย์)</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              ผู้ใช้งานจริงและหน่วยงานรับมอบร่วมทดสอบ เพื่อขจัดปัญหาการใช้งานและสร้างคุณค่าจริง
                            </p>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">3. Expert in the Loop (ธรรมาภิบาล)</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              หัวหน้างานกำกับสถาปัตยกรรมระบบ ตรวจทานความถูกต้องของข้อมูล และโค้ชชิ่งทีมสม่ำเสมอ
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Slide 3 */}
                      <div className="p-6 rounded-2xl bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-emerald-500/20 text-slate-900 dark:text-white space-y-4 shadow-sm dark:shadow-xl print:border-slate-300 print:mb-6">
                        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase">
                              SLIDE 3 / 3 • DELIVERABLES & ROADMAP
                            </span>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">ผลสัมฤทธิ์และแผนยกระดับในรอบถัดไป</h3>
                          </div>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                            NEXT HORIZON
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">โครงการที่ส่งมอบสำเร็จ:</h4>
                            {appraisalResult.work_status.completed.map((c, i) => (
                              <div key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                                <span>{c}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">แผนพัฒนาในรอบถัดไป:</h4>
                            {appraisalResult.development_priorities.map((d, i) => (
                              <div key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <ChevronRight size={13} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                                <span>{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* TAB 2: OFFICIAL HR REPORT */}
            {activeResultTab === 'report' && (
              <div className="space-y-6 text-slate-900 dark:text-slate-100">
                {/* Executive Summary */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
                    Executive Summary (สรุปภาพรวม)
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {appraisalResult.executive_summary}
                  </p>
                </div>

                {/* 5-Pillar Score Summary Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    ตารางคะแนนประเมิน 5 ด้าน (คะแนนเต็ม 100%)
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold">
                        <tr>
                          <th className="py-2.5 px-4">หัวข้อการประเมิน</th>
                          <th className="py-2.5 px-3 text-center">คะแนนเต็ม</th>
                          <th className="py-2.5 px-3 text-center">คะแนนที่ได้</th>
                          <th className="py-2.5 px-3 text-center">ระดับ</th>
                          <th className="py-2.5 px-3 text-center">Evidence Sufficiency</th>
                          <th className="py-2.5 px-4">เหตุผลเชิงประจักษ์</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        <tr>
                          <td className="py-2.5 px-4 font-semibold">1. Quantity (ความครบถ้วนของงาน)</td>
                          <td className="py-2.5 px-3 text-center">20</td>
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-500">
                            {appraisalResult.scores.quantity.score}
                          </td>
                          <td className="py-2.5 px-3 text-center">{appraisalResult.scores.quantity.level}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                              {appraisalResult.scores.quantity.sufficiency}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {appraisalResult.scores.quantity.reason}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-semibold">2. Quality (คุณภาพและผลลัพธ์)</td>
                          <td className="py-2.5 px-3 text-center">20</td>
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-500">
                            {appraisalResult.scores.quality.score}
                          </td>
                          <td className="py-2.5 px-3 text-center">{appraisalResult.scores.quality.level}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">
                              {appraisalResult.scores.quality.sufficiency}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {appraisalResult.scores.quality.reason}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-semibold">3. Learning (การเรียนรู้และการส่งต่อ)</td>
                          <td className="py-2.5 px-3 text-center">20</td>
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-500">
                            {appraisalResult.scores.learning.score}
                          </td>
                          <td className="py-2.5 px-3 text-center">{appraisalResult.scores.learning.level}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                              {appraisalResult.scores.learning.sufficiency}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {appraisalResult.scores.learning.reason}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-semibold">4. Accountability (ความรับผิดชอบต่องาน)</td>
                          <td className="py-2.5 px-3 text-center">20</td>
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-500">
                            {appraisalResult.scores.accountability.score}
                          </td>
                          <td className="py-2.5 px-3 text-center">{appraisalResult.scores.accountability.level}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                              {appraisalResult.scores.accountability.sufficiency}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {appraisalResult.scores.accountability.reason}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-semibold">5. Proactiveness (การคิดและลงมือก่อน)</td>
                          <td className="py-2.5 px-3 text-center">20</td>
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-500">
                            {appraisalResult.scores.proactiveness.score}
                          </td>
                          <td className="py-2.5 px-3 text-center">{appraisalResult.scores.proactiveness.level}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                              {appraisalResult.scores.proactiveness.sufficiency}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {appraisalResult.scores.proactiveness.reason}
                          </td>
                        </tr>
                        <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                          <td className="py-2.5 px-4">รวมคะแนนทั้งสิ้น</td>
                          <td className="py-2.5 px-3 text-center">100</td>
                          <td className="py-2.5 px-3 text-center text-sm font-black text-indigo-600 dark:text-indigo-400">
                            {appraisalResult.overall_score}
                          </td>
                          <td className="py-2.5 px-3 text-center">{appraisalResult.level}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-500">{appraisalResult.confidence}</td>
                          <td className="py-2.5 px-4 text-slate-500">ผ่านเกณฑ์มาตรฐานการประเมิน</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* JD Coverage */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    ความสอดคล้องกับ Job Description (JD Coverage)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {appraisalResult.jd_coverage.map((jd, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs flex items-start gap-2"
                      >
                        <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{jd.item}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{jd.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence Gaps */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                  <div className="text-xs font-bold text-amber-500 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle size={14} /> ข้อมูลที่ต้องประสานเพิ่มเติม (Evidence Gap)
                  </div>
                  <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                    {appraisalResult.evidence_gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 3: GROWTH & ACTION PLAN */}
            {activeResultTab === 'growth' && (
              <div className="space-y-6">
                {/* Top 3 Priorities */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp size={14} /> จุดที่ควรพัฒนาในรอบถัดไป (Development Priorities)
                    </h4>
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-2">
                      {appraisalResult.development_priorities.map((p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Award size={14} /> พฤติกรรมที่แนะนำให้ปรับใช้ (Actionable Behaviors)
                    </h4>
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-2">
                      {appraisalResult.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-purple-500 mt-0.5 shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Calendar Logging Formula Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/60 dark:from-indigo-900/30 dark:via-slate-900 dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-500/30 space-y-2">
                  <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                    <CalendarCheck size={16} />
                    <span>สูตรการบันทึก Worklog & Calendar ในรอบถัดไปให้สะท้อนผลงานชัดเจน</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-slate-800 font-mono text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
                    <div>[What] ➔ ระบุชื่องาน หรือปัญหาที่พบให้ชัดเจน</div>
                    <div>[Action] ➔ ระบุสิ่งที่ทำ บทบาท และเทคนิค/AI ที่ใช้</div>
                    <div>[Result] ➔ ระบุผลลัพธ์ที่ได้จริงหรือประโยชน์ที่เกิดขึ้น</div>
                    <div>[Follow-up] ➔ ระบุขั้นตอนถัดไปและกำหนดวันปิดงาน (Closure)</div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. MODAL: Official HR Reference & Verbatim Prompt Viewer */}
        {/* ========================================================= */}
        {isRefModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-500 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Official HR Performance Appraisal Standards (เกณฑ์มาตรฐาน HR)
                  </h3>
                </div>
                <button
                  onClick={() => setIsRefModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-900 dark:text-indigo-300 flex items-start gap-2.5">
                  <Info size={16} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <strong>มาตรฐานเดียวกับบริษัทกำหนด (Verbatim Corporate HR Standard):</strong>
                    <div className="mt-0.5 text-indigo-800 dark:text-indigo-200">
                      ระบบ AI Half - End Year ใช้ชุดคำสั่งประเมินที่ถอดมาจากระเบียบปฏิบัติของฝ่ายบุคคลโดยตรง
                      โดยแบ่งตามบทบาทพนักงาน (Manager vs Officer) ไม่มีการปรุงแต่งหรือลดหย่อนเกณฑ์
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-400">1. เกณฑ์ประเมิน คะแนนเต็ม 100%</h4>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-600 dark:text-slate-400">
                    <li>
                      <strong className="text-slate-800 dark:text-slate-200">Quantity / ความครบถ้วน (20%):</strong> พิจารณาจากความสม่ำเสมอของงานเทียบกับ JD/KPI
                      (ห้ามตัดสินจากจำนวน Event เพียงอย่างเดียว)
                    </li>
                    <li>
                      <strong className="text-slate-800 dark:text-slate-200">Quality / คุณภาพและผลลัพธ์ (20%):</strong> วัดจาก Completion, Accuracy, Timeliness, Result
                      และ Rework หากไม่มีหลักฐานชัดเจนให้ระบุ "Supervisor Validation Required"
                    </li>
                    <li>
                      <strong className="text-slate-800 dark:text-slate-200">Learning / การเรียนรู้ (20%):</strong> ยึดหลัก <em>Learn → Apply → Improve → Share</em>{' '}
                      การเข้าอบรมอย่างเดียวไม่ได้รับคะแนนเต็มหากไม่มีการนำไปใช้
                    </li>
                    <li>
                      <strong className="text-slate-800 dark:text-slate-200">Accountability / ความรับผิดชอบ (20%):</strong> ยึดหลัก <em>Own → Follow-up → Deliver → Close</em>{' '}
                      และสำหรับการบริหารทีม ให้ดูการ Coach, Delegate, Feedback
                    </li>
                    <li>
                      <strong className="text-slate-800 dark:text-slate-200">Proactiveness / การคิดก่อน (20%):</strong> ยึดหลัก{' '}
                      <em>Anticipate → Initiate → Prevent → Improve</em> ไม่นับความเร็วจากการรอรับคำสั่ง (Responsiveness)
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">2. การแบ่งระดับตามตำแหน่ง</h4>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-900 dark:text-white mb-1">👔 ระดับ Section Manager ขึ้นไป</div>
                      <div className="text-slate-600 dark:text-slate-400">
                        ไฟล์อ้างอิง: <code>evaluation-hr/half-year-manager.md</code>
                        <br />
                        เน้นย้ำ: ภาวะผู้นำ, การวางแผน TeamOps, การมอบหมายงาน, และการโค้ชชิ่งทีม
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-900 dark:text-white mb-1">💼 ระดับ Officer ทั่วไป</div>
                      <div className="text-slate-600 dark:text-slate-400">
                        ไฟล์อ้างอิง: <code>evaluation-hr/half-year-officer.md</code>
                        <br />
                        เน้นย้ำ: การส่งมอบงานตาม JD, ความถูกต้องแม่นยำ, วินัย และการพัฒนาตนเอง
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-200 dark:border-slate-800 pt-3 text-[11px] text-slate-600 dark:text-slate-400">
                  <h4 className="font-bold text-rose-600 dark:text-rose-400">ข้อควรระวังสำคัญ (Zero Bias Policy):</h4>
                  <div>• ห้ามอวย หรือเพิ่มคะแนนเพราะข้อความดูดี</div>
                  <div>• ห้ามสมมติ Result ที่ไม่ได้ถูกบันทึกจริงใน Worklog / Calendar</div>
                  <div>• ห้ามนำ Evidence Sufficiency ต่ำ ไปตัดสินว่าผลงานไม่ดีโดยอัตโนมัติ</div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
                <button
                  onClick={() => setIsRefModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs"
                >
                  รับทราบและปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. MODAL: History Viewer Modal                            */}
        {/* ========================================================= */}
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">ประวัติการประเมินที่ผ่านมา</h3>
                </div>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 px-4 pt-2 gap-2 text-xs">
                <button
                  onClick={() => setHistoryFilterTab('official')}
                  className={`pb-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    historyFilterTab === 'official'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <span>รอบ Half - End Year</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold">
                    {savedHistory.filter((i) => i.template_id?.startsWith('half_year') || i.template_id?.startsWith('end_year')).length}
                  </span>
                </button>
                <button
                  onClick={() => setHistoryFilterTab('all')}
                  className={`pb-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    historyFilterTab === 'all'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <span>ประวัติอื่นทั้งหมด</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                    {savedHistory.length}
                  </span>
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-2">
                {(() => {
                  const filtered = savedHistory.filter((item) => {
                    if (historyFilterTab === 'official') {
                      return item.template_id?.startsWith('half_year') || item.template_id?.startsWith('end_year');
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    if (historyFilterTab === 'official') {
                      return (
                        <div className="p-6 text-center space-y-2">
                          <p className="text-xs text-slate-600 dark:text-slate-400">ยังไม่มีบันทึกประเมินรอบทางการ Half - End Year สำหรับพนักงานท่านนี้</p>
                          <p className="text-[11px] text-slate-400">กดปุ่ม <b>"ประเมินผลรอบครึ่งปี (Half-Year)"</b> เพื่อเริ่มประเมินและบันทึกประวัติใหม่ หรือคลิกแท็บ <b>"ประวัติอื่นทั้งหมด"</b> เพื่อดูผลวิเคราะห์เดิม</p>
                        </div>
                      );
                    }
                    return <div className="p-6 text-center text-xs text-slate-500">ไม่พบประวัติการประเมินสำหรับพนักงานท่านนี้</div>;
                  }

                  return filtered.map((item) => {
                    // Resolve score: use score column first, fallback to nested analysis_data or jd_alignment_score
                    const rawScore =
                      item.score != null
                        ? item.score
                        : (item.analysis_data as { overall_score?: number } | null)?.overall_score ??
                          (item as { jd_alignment_score?: number }).jd_alignment_score ?? null;
                    const displayScore = rawScore != null ? Math.round(Number(rawScore)) : null;

                    // Human-readable role label
                    const roleLabel =
                      item.template_id === 'half_year_manager' ? 'Manager (ครึ่งปี)' :
                      item.template_id === 'half_year_officer' ? 'Officer (ครึ่งปี)' :
                      item.template_id === 'end_year_manager' ? 'Manager (สิ้นปี)' :
                      item.template_id === 'end_year_officer' ? 'Officer (สิ้นปี)' :
                      item.template_id === 'perf_evaluation' ? '5 Dimensions (Performance)' :
                      item.template_id === 'master' ? 'HRBP Diagnostics' :
                      item.template_id === 'coaching_fairness' ? 'Coaching & Fairness' :
                      item.template_id === 'individual_coach' ? 'Executive Coach' :
                      item.template_id ?? 'ทั่วไป';

                    const roleBadgeColor =
                      item.template_id?.includes('manager')
                        ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                        : item.template_id?.includes('officer')
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                        : item.template_id === 'perf_evaluation'
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                        : item.template_id === 'master'
                        ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30'
                        : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30';

                    const scoreColor =
                      displayScore == null ? 'text-slate-400' :
                      displayScore >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                      displayScore >= 75 ? 'text-indigo-600 dark:text-cyan-400' :
                      displayScore >= 60 ? 'text-amber-600 dark:text-amber-400' :
                      'text-red-500 dark:text-red-400';

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.analysis_data) {
                            setAppraisalResult(item.analysis_data as AppraisalResult);
                            setIsHistoryModalOpen(false);
                          } else {
                            // Synthesize preview result for legacy row
                            const scoreNum = displayScore ?? 75;
                            const eachPillar = Math.round((scoreNum / 100) * 20);
                            const legacyResult: AppraisalResult = {
                              overall_score: scoreNum,
                              level: scoreNum >= 85 ? 'ดีเยี่ยม (Exceptional)' : scoreNum >= 75 ? 'ดีมาก (Exceeds Standard)' : scoreNum >= 60 ? 'มาตรฐาน (Meets Standard)' : 'ต้องพัฒนา (Needs Improvement)',
                              confidence: 'Medium',
                              role_type: item.template_id?.includes('manager') ? 'manager' : 'officer',
                              cycle: item.template_id?.includes('end') ? 'End-Year' : 'Half-Year',
                              period: `${item.start_date || '-'} ถึง ${item.end_date || '-'}`,
                              executive_summary: item.raw_ai_report?.slice(0, 300) || `ผลการประเมินประวัติเดิม คะแนนรวม ${scoreNum}/100`,
                              scores: {
                                quantity: { score: eachPillar, max: 20, level: 'Meets Standard', sufficiency: 'Medium', reason: 'ข้อมูลจากประวัติเดิม' },
                                quality: { score: eachPillar, max: 20, level: 'Meets Standard', sufficiency: 'Medium', reason: 'ข้อมูลจากประวัติเดิม' },
                                learning: { score: eachPillar, max: 20, level: 'Meets Standard', sufficiency: 'Medium', reason: 'ข้อมูลจากประวัติเดิม' },
                                accountability: { score: eachPillar, max: 20, level: 'Meets Standard', sufficiency: 'Medium', reason: 'ข้อมูลจากประวัติเดิม' },
                                proactiveness: { score: eachPillar, max: 20, level: 'Meets Standard', sufficiency: 'Medium', reason: 'ข้อมูลจากประวัติเดิม' },
                              },
                              evidences: {
                                quantity: ['ดึงจากประวัติเดิมในระบบ'],
                                quality: ['ดึงจากประวัติเดิมในระบบ'],
                                learning: ['ดึงจากประวัติเดิมในระบบ'],
                                accountability: ['ดึงจากประวัติเดิมในระบบ'],
                                proactiveness: ['ดึงจากประวัติเดิมในระบบ'],
                              },
                              work_status: {
                                completed: [],
                                in_progress: [],
                                pending: [],
                                overdue: [],
                              },
                              jd_coverage: [],
                              evidence_gaps: [],
                              top_strengths: Array.isArray(item.strengths) ? (item.strengths as string[]).slice(0, 3) : [],
                              development_priorities: Array.isArray(item.improvements) ? (item.improvements as string[]).slice(0, 3) : [],
                              recommendations: item.raw_ai_report ? [item.raw_ai_report.slice(0, 200) + '...'] : ['สามารถกดประเมินใหม่ด้วยเกณฑ์ HR Standard ด้านบนเพื่อดูรายละเอียด 5 มิติล่าสุด'],
                              calendar_logging_guide: 'แนะนำให้บันทึกงานอย่างสม่ำเสมอตามสูตร [What] -> [Action] -> [Result]',
                            };
                            setAppraisalResult(legacyResult);
                            setIsHistoryModalOpen(false);
                          }
                        }}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 cursor-pointer flex justify-between items-center text-xs transition-all"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span>รอบ {item.start_date} ถึง {item.end_date}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColor}`}>
                              {roleLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            ประเมินเมื่อ: {item.created_at || item.analysis_date
                              ? new Date(item.created_at || item.analysis_date || '').toLocaleDateString('th-TH')
                              : '-'}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className={`text-base font-extrabold ${scoreColor}`}>
                            {displayScore != null ? displayScore : '-'}
                          </span>
                          <span className="text-[10px] text-slate-500"> / 100</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
