import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles, PlusCircle, CheckCircle2, Clock, ShieldCheck,
  TrendingUp, Users, Award, BookOpen, AlertCircle,
  FileCheck2, Building2, Sliders, Search,
  RotateCcw, Check, ShieldAlert,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Laptop, Layers, Compass, Bot,
  User, Globe, Activity, Send, HelpCircle
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import AiHubNav from '../components/ai-enterprise/AiHubNav';
import { AI_HUB_TABS, type AiHubTab } from '../components/ai-enterprise/aiHubTabs';
import AiHubHome from '../components/ai-enterprise/AiHubHome';
import AiLifecycleOnboardingModal from '../components/ai-enterprise/AiLifecycleOnboardingModal';
import AiTeamMemberPicker, { type AiTeamMember } from '../components/ai-enterprise/AiTeamMemberPicker';
import AiUseCaseEditor from '../components/ai-enterprise/AiUseCaseEditor';
import AiRequestSummary, { AiValueEstimateBox } from '../components/ai-enterprise/AiRequestSummary';
import AiSupervisorPicker, { type AiSupervisor } from '../components/ai-enterprise/AiSupervisorPicker';
import {
  buildLegacyFields,
  emptyUseCase,
  memberKey,
  reassignTasks,
  serializeUseCases,
  taskFromHoursPair,
  validateRequestForm,
  type AiUseCase,
} from '../components/ai-enterprise/aiRequestForm';
import AiSeatRosterGrid from '../components/ai-enterprise/AiSeatRosterGrid';
import AiDepartmentPresetMatcher from '../components/ai-enterprise/AiDepartmentPresetMatcher';
import { type DepartmentAiPreset } from '../components/ai-enterprise/aiDepartmentPresets';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { cn } from '../lib/utils';
import { Link, useSearchParams } from 'react-router-dom';

// Types
export interface AiRequest {
  id: string;
  workspace_id?: string | null;
  user_id?: string | null;
  requester_name: string;
  department: string;
  position?: string;
  email?: string;
  requested_seats: number;
  tier?: 'virtual_employee' | 'general_web';
  ai_jd?: string;
  contract_months?: number;
  title: string;
  as_is_process: string;
  work_frequency: 'daily' | 'weekly' | 'monthly';
  as_is_hours_per_week: number;
  ai_functions: string[];
  target_hours_saved_per_week: number;
  expected_benefits?: string;
  data_safety_certified: boolean;
  status: 'pending_review' | 'approved_sandbox' | 'waiting_list' | 'rejected' | 'completed';
  linked_project_id?: string | null;
  team_members?: AiTeamMember[];
  allow_partial_allocation?: boolean;
  /** Per-task list saved by the v2 form (see migration 20261112090000). */
  use_cases?: ReturnType<typeof serializeUseCases>;
  supervisor_name?: string | null;
  supervisor_emp_id?: string | null;
  supervisor_email?: string | null;
  supervisor_status?: 'pending' | 'confirmed' | 'declined';
  supervisor_confirmed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AiEvaluation {
  id: string;
  request_id: string;
  workspace_id?: string | null;
  evaluator_id?: string;
  score_problem_clarity: number;
  score_business_roi: number;
  score_readiness: number;
  score_data_safety: number;
  total_score: number;
  evaluation_notes?: string;
  decision: 'approve_sandbox' | 'waiting_list' | 'revision_needed' | 'reject';
  evaluated_at: string;
}

export interface AiMonthlyReport {
  id: string;
  request_id: string;
  workspace_id?: string | null;
  user_id?: string;
  report_month: string;
  active_days: number;
  actual_hours_saved_per_week: number;
  turnaround_time_reduction?: string;
  error_rate_reduction?: string;
  key_deliverables: string;
  member_breakdown?: Array<{
    emp_id: string;
    name: string;
    hours_saved: number;
    active_days: number;
  }>;
  coe_feedback?: string;
  coe_decision: 'maintain' | 'scale' | 'warning' | 'revoke';
  created_at: string;
}

const AI_FUNCTION_OPTIONS = [
  { id: 'synthesis', label: 'วิเคราะห์/สรุปเอกสารขนาดยาว (Document Synthesis)', desc: 'อ่านและสรุปรายงาน, สัญญา, TOR' },
  { id: 'coding', label: 'ร่างเนื้อหา/ช่วยเขียนโค้ด (Drafting & Coding)', desc: 'เขียนโปรแกรม, เขียนอีเมล, สรุปข่าว' },
  { id: 'translation', label: 'แปลภาษา & ปรับน้ำเสียง (Translation & Refinement)', desc: 'แปลเอกสารทางเทคนิค, เอกสารราชการ' },
  { id: 'data_analysis', label: 'สกัดข้อมูล & วิเคราะห์สถิติ (Data Extraction)', desc: 'แปลงไฟล์ PDF/ภาพเป็นตาราง, หาความผิดปกติ' },
  { id: 'automation', label: 'สร้าง Agent อัตโนมัติ (Autonomous Workflow)', desc: 'เชื่อมต่อ n8n, API, บ็อตตอบคำถาม' }
];

function splitDepartmentName(dept: string): { main: string; sub: string } {
  if (!dept) return { main: '', sub: '' };
  const match = dept.match(/^([^(]+)(?:\((.*)\))?$/);
  if (match) {
    return {
      main: match[1].trim(),
      sub: match[2]?.trim() || ''
    };
  }
  return { main: dept, sub: '' };
}

export default function AiEnterprisePage() {
  const { showToast, showConfirm } = useNotification();
  const [activeTab, setActiveTab] = useState<AiHubTab>('home');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState(0);

  // Session user info
  const sessionUser = useMemo(() => {
    try {
      const saved = localStorage.getItem('worklog_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const isAdminOrManager = useMemo(() => {
    return sessionUser?.role === 'admin' || sessionUser?.workspaceRole === 'admin' || sessionUser?.workspaceRole === 'manager';
  }, [sessionUser]);

  // Data states
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AiRequest[]>([]);
  const [evaluations, setEvaluations] = useState<AiEvaluation[]>([]);
  const [reports, setReports] = useState<AiMonthlyReport[]>([]);

  // Tri-Persona Dashboard Perspective & Scoping
  const [dashboardPerspective, setDashboardPerspective] = useState<'auto' | 'my_impact' | 'department' | 'enterprise_coe'>('auto');
  const [isLiveData, setIsLiveData] = useState<boolean>(false);

  // Dashboard view toggle
  const [activeDashboardView, setActiveDashboardView] = useState<'initiatives' | 'roster'>('initiatives');

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Table Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  // Form states: Request FM-001
  // Key of the requester as a team member (same key the team picker uses), so task owners line up with members.
  const sessionLeadKey = sessionUser
    ? memberKey({
        emp_id: sessionUser.emp_id || '',
        email: sessionUser.email || '',
        name: sessionUser.name || sessionUser.full_name || 'ตัวแทนผู้ยื่นคำขอ',
      })
    : '';
  const [formTier, setFormTier] = useState<'virtual_employee' | 'general_web'>('virtual_employee');
  const [formDept, setFormDept] = useState(sessionUser?.department || '');
  const [formPosition, setFormPosition] = useState(sessionUser?.position || '');
  const [formSeats, setFormSeats] = useState(1);
  const [formTeamMembers, setFormTeamMembers] = useState<AiTeamMember[]>(() => {
    if (sessionUser) {
      return [
        {
          emp_id: sessionUser.emp_id || '',
          name: sessionUser.name || sessionUser.full_name || 'ตัวแทนผู้ยื่นคำขอ',
          department: sessionUser.department || 'ไม่ระบุแผนก',
          position: sessionUser.position || '',
          email: sessionUser.email || '',
          is_lead: true
        }
      ];
    }
    return [];
  });
  const [formAllowPartialAllocation, setFormAllowPartialAllocation] = useState(false);
  // Tasks the requester wants AI to help with; the first one is owned by the requester (lead).
  const [formTasks, setFormTasks] = useState<AiUseCase[]>(() => [emptyUseCase(sessionLeadKey)]);
  const [formContractMonths, setFormContractMonths] = useState(3);
  const [formAiJd, setFormAiJd] = useState('');
  const [formExpectedBenefits, setFormExpectedBenefits] = useState('');
  const [formSupervisor, setFormSupervisor] = useState<AiSupervisor | null>(null);
  const [showFormErrors, setShowFormErrors] = useState(false);
  const [formDataSafetyCertified, setFormDataSafetyCertified] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // With a single member every task belongs to that member, so the owner is never asked for or left empty.
  const effectiveTasks = useMemo(
    () => (formTeamMembers.length === 1 ? formTasks.map((t) => ({ ...t, owner_key: memberKey(formTeamMembers[0]) })) : formTasks),
    [formTasks, formTeamMembers]
  );
  const formValidation = useMemo(
    () =>
      validateRequestForm({
        requesterEmail: sessionUser?.email,
        requesterEmpId: sessionUser?.emp_id || sessionUser?.empId,
        supervisor: formSupervisor,
        members: formTeamMembers,
        seats: formSeats,
        allowPartial: formAllowPartialAllocation,
        tasks: effectiveTasks,
        consent: formDataSafetyCertified,
        requireAiJd: formTier === 'virtual_employee',
        aiJd: formAiJd,
      }),
    [sessionUser, formSupervisor, formTeamMembers, formSeats, formAllowPartialAllocation, effectiveTasks, formDataSafetyCertified, formTier, formAiJd]
  );

  // URL Query Params & Graduation Package Bridge
  const [searchParams] = useSearchParams();

  // Load Graduation Package from AI Sandbox if available
  useEffect(() => {
    let hasGraduation = false;
    try {
      const rawPkg = localStorage.getItem('ai_enterprise_graduation_package');
      if (rawPkg) {
        const pkg = JSON.parse(rawPkg);
        if (pkg?.prefillForm) {
          const pf = pkg.prefillForm;
          if (pf.department) setFormDept(pf.department);
          if (pf.recommendedSeats) setFormSeats(pf.recommendedSeats);
          if (pf.title || pf.asIsHours || pf.targetHoursSaved) {
            setFormTasks([
              taskFromHoursPair({
                ownerKey: sessionLeadKey,
                title: pf.title || '',
                asIsProcess: '',
                aiFunctions: [],
                asIsHoursPerWeek: Number(pf.asIsHours) || 0,
                targetHoursSavedPerWeek: Number(pf.targetHoursSaved) || 0,
                basis: 'sandbox',
              }),
            ]);
          }
          if (pf.businessJustification) setFormExpectedBenefits(pf.businessJustification);
          setFormDataSafetyCertified(true);
          hasGraduation = true;
          localStorage.removeItem('ai_enterprise_graduation_package');
        }
      }
    } catch {
      // Ignore errors
    }

    const tabParam = searchParams.get('tab');
    if (tabParam && (AI_HUB_TABS as string[]).includes(tabParam)) {
      setActiveTab(tabParam as AiHubTab);
      if (hasGraduation && tabParam === 'request') {
        showToast('🎉 นำเข้าข้อมูลผลการทดสอบเชิงประจักษ์จาก Sandbox สู่แบบฟอร์ม FM-001 เรียบร้อยแล้ว!', 'success');
      }
    } else if (hasGraduation || searchParams.get('source') === 'sandbox') {
      setActiveTab('request');
      if (hasGraduation) {
        showToast('🎉 นำเข้าข้อมูลผลการทดสอบเชิงประจักษ์จาก Sandbox สู่แบบฟอร์ม FM-001 เรียบร้อยแล้ว!', 'success');
      }
    }
  }, [searchParams, showToast, sessionLeadKey]);

  // Form states: Monthly Report FM-002
  const [reportRequestId, setReportRequestId] = useState('');
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportActiveDays, setReportActiveDays] = useState(15);
  const [reportActualHoursSaved, setReportActualHoursSaved] = useState(4);
  const [reportTurnaround, setReportTurnaround] = useState('');
  const [reportErrorRate, setReportErrorRate] = useState('');
  const [reportDeliverables, setReportDeliverables] = useState('');
  const [isSyncingWorklog, setIsSyncingWorklog] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Evaluation Rubric Interactive states
  const [selectedEvalRequestId, setSelectedEvalRequestId] = useState('');
  const [evalScoreClarity, setEvalScoreClarity] = useState(20);
  const [evalScoreRoi, setEvalScoreRoi] = useState(28);
  const [evalScoreReadiness, setEvalScoreReadiness] = useState(16);
  const [evalScoreSafety, setEvalScoreSafety] = useState(18);
  const [evalNotes, setEvalNotes] = useState('');
  const [evalDecision, setEvalDecision] = useState<'approve_sandbox' | 'waiting_list' | 'revision_needed' | 'reject'>('approve_sandbox');
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  const evalTotalScore = useMemo(() => {
    return evalScoreClarity + evalScoreRoi + evalScoreReadiness + evalScoreSafety;
  }, [evalScoreClarity, evalScoreRoi, evalScoreReadiness, evalScoreSafety]);

  // Initial Data Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch AI Requests
      const { data: reqData, error: reqErr } = await supabase
        .from('tb_ai_enterprise_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (reqErr) throw reqErr;
      setRequests(reqData || []);
      if (reqData && reqData.length > 0) {
        setIsLiveData(true);
      }

      // 2. Fetch Evaluations
      const { data: evalData, error: evalErr } = await supabase
        .from('tb_ai_enterprise_evaluations')
        .select('*')
        .order('evaluated_at', { ascending: false });

      if (!evalErr) setEvaluations(evalData || []);

      // 3. Fetch Monthly Reports
      const { data: repData, error: repErr } = await supabase
        .from('tb_ai_enterprise_monthly_reports')
        .select('*')
        .order('report_month', { ascending: false });

      if (!repErr) setReports(repData || []);

    } catch (err: unknown) {
      console.warn('Backend tables not loaded or migration pending, falling back to local workspace data:', err);
      setIsLiveData(false);
      // Fallback Seed Data to keep the UI interactive and rich
      const fallbackRequests: AiRequest[] = [
        {
          id: 'mock-req-001',
          requester_name: 'วิภาวี สิทธิผล',
          department: 'ฝ่ายจัดซื้อและสัญญา (Procurement)',
          position: 'Senior Procurement Officer',
          email: 'wipawee.s@company.corp',
          requested_seats: 3,
          title: 'AI วิเคราะห์และเปรียบเทียบสัญญาจัดซื้อพร้อมตรวจเงื่อนไขแฝง',
          as_is_process: 'ตรวจเปรียบเทียบสัญญาคู่ค้าทีละฉบับกับมาตรฐานบริษัท ใช้เวลาฉบับละ 2-3 วัน มักพลาดเรื่องเงื่อนไข Penalty',
          work_frequency: 'weekly',
          as_is_hours_per_week: 16,
          ai_functions: ['synthesis', 'data_analysis'],
          target_hours_saved_per_week: 8,
          expected_benefits: 'ตรวจสัญญาเสร็จใน 15 นาที ลดความเสี่ยงค่าปรับ และทำตารางเปรียบเทียบ Vendor อัตโนมัติ',
          data_safety_certified: true,
          status: 'approved_sandbox',
          team_members: [
            { emp_id: '10042', name: 'วิภาวี สิทธิผล', department: 'ฝ่ายจัดซื้อและสัญญา (Procurement)', position: 'Senior Procurement Officer', is_lead: true },
            { emp_id: '10043', name: 'ธนวัฒน์ รุ่งอรุณ', department: 'ฝ่ายจัดซื้อและสัญญา (Procurement)', position: 'Procurement Specialist', is_lead: false },
            { emp_id: '10044', name: 'ศิริพร บุญมั่น', department: 'ฝ่ายกฎหมายธุรกิจ (Legal)', position: 'Contract Specialist', is_lead: false }
          ],
          created_at: new Date(Date.now() - 14 * 86400000).toISOString()
        },
        {
          id: 'mock-req-002',
          requester_name: 'ชัชวาลย์ วรศิลป์',
          department: 'ฝ่ายบุคคลและพัฒนาองค์กร (HRD)',
          position: 'HR Operations Manager',
          email: 'chatchawan.w@company.corp',
          requested_seats: 2,
          title: 'AI สรุปผลประเมินผลงานและร่าง Training Roadmap รายบุคคล',
          as_is_process: 'อ่านแบบประเมินและ feedback พนักงาน 400 คน นั่งรวบรวมใส่ excel ทีละคนเพื่อหา Skill Gap',
          work_frequency: 'monthly',
          as_is_hours_per_week: 20,
          ai_functions: ['synthesis', 'coding'],
          target_hours_saved_per_week: 12,
          expected_benefits: 'ประมวลผลคำแนะนำรายบุคคลได้เร็วขึ้น 70% และจับคู่หลักสูตรฝึกอบรมให้อัตโนมัติ',
          data_safety_certified: true,
          status: 'approved_sandbox',
          team_members: [
            { emp_id: '10031', name: 'ชัชวาลย์ วรศิลป์', department: 'ฝ่ายบุคคลและพัฒนาองค์กร (HRD)', position: 'HR Operations Manager', is_lead: true },
            { emp_id: '10032', name: 'ณัชชา สุวรรณ', department: 'ฝ่ายบุคคลและพัฒนาองค์กร (HRD)', position: 'People Development Officer', is_lead: false }
          ],
          created_at: new Date(Date.now() - 7 * 86400000).toISOString()
        },
        {
          id: 'mock-req-004',
          requester_name: 'อัครพล เกียรติวิมล',
          department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT Software)',
          position: 'Lead Solution Architect',
          email: 'akarapol.k@company.corp',
          requested_seats: 4,
          title: 'GitHub Copilot Enterprise สำหรับทีมพัฒนาระบบ ERP Core',
          as_is_process: 'เขียน boilerplate, unit test, และเอกสาร API ด้วยมือ ใช้เวลา 40% ของเวลา sprint',
          work_frequency: 'daily',
          as_is_hours_per_week: 25,
          ai_functions: ['coding', 'automation'],
          target_hours_saved_per_week: 16,
          expected_benefits: 'เร่งความเร็วการส่งมอบ feature และครอบคลุม Test Coverage เพิ่มขึ้นเป็น 85%',
          data_safety_certified: true,
          status: 'approved_sandbox',
          team_members: [
            { emp_id: '10001', name: 'อัครพล เกียรติวิมล', department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT Software)', position: 'Lead Solution Architect', is_lead: true },
            { emp_id: '10002', name: 'สุรเดช ธนพัฒน์', department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT Software)', position: 'Senior Backend Engineer', is_lead: false },
            { emp_id: '10003', name: 'ภัทรดนัย พิชัย', department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT Software)', position: 'Frontend Engineer', is_lead: false },
            { emp_id: '10004', name: 'พลอยไพลิน มั่งคั่ง', department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT Software)', position: 'QA Automation Engineer', is_lead: false }
          ],
          created_at: new Date(Date.now() - 20 * 86400000).toISOString()
        },
        {
          id: 'mock-req-005',
          requester_name: 'กานต์ดา ไชยศรี',
          department: 'ฝ่ายบัญชีและการเงิน (Accounting & Finance)',
          position: 'Senior Financial Analyst',
          email: 'kanda.c@company.corp',
          requested_seats: 2,
          title: 'AI สกัดข้อมูลใบกำกับภาษีและตรวจสอบยอดกระทบยอดเงินฝากธนาคาร',
          as_is_process: 'ตรวจยอดเงินโอนและสลิปจาก 4 บัญชีธนาคารเทียบกับใบแจ้งหนี้แบบ Manual',
          work_frequency: 'daily',
          as_is_hours_per_week: 18,
          ai_functions: ['data_analysis', 'synthesis'],
          target_hours_saved_per_week: 10,
          expected_benefits: 'กระทบยอดบัญชีเสร็จสิ้นภายใน 1 ชั่วโมงต่อวัน ปราศจาก Human Error',
          data_safety_certified: true,
          status: 'approved_sandbox',
          team_members: [
            { emp_id: '10055', name: 'กานต์ดา ไชยศรี', department: 'ฝ่ายบัญชีและการเงิน (Accounting & Finance)', position: 'Senior Financial Analyst', is_lead: true },
            { emp_id: '10056', name: 'ธีรเทพ ศรีสุข', department: 'ฝ่ายบัญชีและการเงิน (Accounting & Finance)', position: 'Accountant', is_lead: false }
          ],
          created_at: new Date(Date.now() - 12 * 86400000).toISOString()
        },
        {
          id: 'mock-req-003',
          requester_name: 'กิตติศักดิ์ เจริญพร',
          department: 'ฝ่ายวิศวกรรมโรงงาน (Plant Engineering)',
          position: 'Maintenance Lead',
          email: 'kittisak.c@company.corp',
          requested_seats: 1,
          title: 'AI ช่วยแปลคู่มือเครื่องจักรภาษาเยอรมันและจัดทำ One Point Lesson',
          as_is_process: 'คู่มือเครื่องจักรเป็นภาษาเยอรมัน/อังกฤษ ต้องใช้ Google Translate ทีละย่อหน้าและจัดรูปเล่มใหม่',
          work_frequency: 'weekly',
          as_is_hours_per_week: 10,
          ai_functions: ['translation', 'synthesis'],
          target_hours_saved_per_week: 6,
          expected_benefits: 'ช่างหน้างานเข้าใจวิธีบำรุงรักษาเครื่องจักรได้เร็วขึ้น ลดเวลา Downtime',
          data_safety_certified: true,
          status: 'pending_review',
          team_members: [
            { emp_id: '10018', name: 'กิตติศักดิ์ เจริญพร', department: 'ฝ่ายวิศวกรรมโรงงาน (Plant Engineering)', position: 'Maintenance Lead', is_lead: true }
          ],
          created_at: new Date(Date.now() - 2 * 86400000).toISOString()
        }
      ];
      setRequests(fallbackRequests);

      setEvaluations([
        {
          id: 'mock-eval-001',
          request_id: 'mock-req-001',
          score_problem_clarity: 23,
          score_business_roi: 32,
          score_readiness: 18,
          score_data_safety: 19,
          total_score: 92,
          evaluation_notes: 'โจทย์ชัดเจน ความคุ้มค่าสูง มีชุดสัญญาตัวอย่างพร้อมทดสอบ',
          decision: 'approve_sandbox',
          evaluated_at: new Date(Date.now() - 10 * 86400000).toISOString()
        }
      ]);

      setReports([
        {
          id: 'mock-rep-001',
          request_id: 'mock-req-001',
          report_month: '2026-10',
          active_days: 18,
          actual_hours_saved_per_week: 9.5,
          turnaround_time_reduction: 'ลดจาก 3 วัน เหลือ 4 ชั่วโมง/สัญญา',
          error_rate_reduction: 'ยังไม่พบข้อผิดพลาดด้านเงื่อนไข',
          key_deliverables: 'ตรวจสัญญาคู่ค้าไปแล้ว 24 ฉบับ และจัดทำ Template ตรวจสอบมาตรฐาน 1 ชุด',
          coe_feedback: 'ผลลัพธ์ดีมาก อัตราใช้งานสม่ำเสมอ แนะนำให้คงสิทธิ์และเตรียมขยายผล',
          coe_decision: 'maintain',
          created_at: new Date(Date.now() - 3 * 86400000).toISOString()
        },
        {
          id: 'mock-rep-002',
          request_id: 'mock-req-004',
          report_month: '2026-10',
          active_days: 19,
          actual_hours_saved_per_week: 15.0,
          turnaround_time_reduction: 'ลดเวลาพัฒนาฟีเจอร์ลง 40%',
          error_rate_reduction: 'Bug escape rate ลดลง 25%',
          key_deliverables: 'สร้างระบบ Service Module ERP สำเร็จ 8 โมดูล พร้อม Automated Test Suite',
          coe_feedback: 'ประสิทธิภาพการพัฒนาพุ่งสูงขึ้นอย่างเห็นได้ชัด',
          coe_decision: 'scale',
          created_at: new Date(Date.now() - 2 * 86400000).toISOString()
        },
        {
          id: 'mock-rep-003',
          request_id: 'mock-req-005',
          report_month: '2026-10',
          active_days: 14,
          actual_hours_saved_per_week: 8.5,
          turnaround_time_reduction: 'ลดเวลากระทบยอดจาก 3 ชม. เหลือ 25 นาที',
          error_rate_reduction: 'ไม่พบยอดผิดพลาดในรอบเดือน',
          key_deliverables: 'ตรวจกระทบยอดบัญชีกว่า 1,200 รายการ',
          coe_feedback: 'เสถียรและแม่นยำสูง',
          coe_decision: 'maintain',
          created_at: new Date(Date.now() - 1 * 86400000).toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void fetchData();
    });
  }, [fetchData]);

  // Derived effective evaluation request id
  const activeEvalRequestId = useMemo(() => {
    if (selectedEvalRequestId) return selectedEvalRequestId;
    const pending = requests.find(r => r.status === 'pending_review');
    return pending ? pending.id : (requests[0]?.id || '');
  }, [selectedEvalRequestId, requests]);

  // Synchronize rubric sliders and decision when activeEvalRequestId changes or when evaluations load
  const applyEvaluationData = useCallback((requestId: string, currentEvaluations: AiEvaluation[]) => {
    const existing = currentEvaluations.find(e => e.request_id === requestId);
    if (existing) {
      setEvalScoreClarity(existing.score_problem_clarity);
      setEvalScoreRoi(existing.score_business_roi);
      setEvalScoreReadiness(existing.score_readiness);
      setEvalScoreSafety(existing.score_data_safety);
      setEvalNotes(existing.evaluation_notes || '');
      setEvalDecision(existing.decision);
    } else {
      setEvalScoreClarity(20);
      setEvalScoreRoi(28);
      setEvalScoreReadiness(16);
      setEvalScoreSafety(18);
      setEvalNotes('');
      setEvalDecision('approve_sandbox');
    }
  }, []);

  useEffect(() => {
    if (activeEvalRequestId) {
      void Promise.resolve().then(() => {
        applyEvaluationData(activeEvalRequestId, evaluations);
      });
    }
  }, [activeEvalRequestId, applyEvaluationData, evaluations]);

  // Derived effective report request id
  const activeReportRequestId = useMemo(() => {
    if (reportRequestId) return reportRequestId;
    const approved = requests.find(r => r.status === 'approved_sandbox');
    return approved ? approved.id : (requests[0]?.id || '');
  }, [reportRequestId, requests]);

  // Memoized requests for the 20-seat interactive roster
  const requestsForRoster = useMemo(() => {
    return requests.map(r => ({
      id: r.id,
      project_title: r.title,
      department: r.department,
      applicant_name: r.requester_name,
      applicant_emp_id: r.user_id || undefined,
      status: r.status === 'approved_sandbox' ? 'approved' : r.status,
      requested_seats: r.requested_seats,
      ai_tool: 'GitHub Copilot Enterprise',
      team_members: r.team_members,
      monthly_reports: reports
        .filter(rep => rep.request_id === r.id)
        .map(rep => ({
          month: rep.report_month,
          actual_active_days: rep.active_days,
          hours_saved_monthly: Math.round(rep.actual_hours_saved_per_week * 4.2)
        }))
    }));
  }, [requests, reports]);

  // Calculations for Metrics Dashboard
  const metrics = useMemo(() => {
    const totalRequests = requests.length;
    const approvedRequests = requests.filter(r => r.status === 'approved_sandbox' || r.status === 'completed');
    const totalAllocatedSeats = approvedRequests.reduce((sum, r) => sum + (r.requested_seats || 1), 0);
    
    // Total Hours Saved / Week
    const totalWeeklyHoursSaved = reports.length > 0
      ? reports.reduce((sum, rep) => sum + (Number(rep.actual_hours_saved_per_week) || 0), 0)
      : approvedRequests.reduce((sum, r) => sum + (Number(r.target_hours_saved_per_week) || 0), 0);

    const totalMonthlyHoursSaved = Math.round(totalWeeklyHoursSaved * 4.2);
    // Standard blended hourly cost in THB (approx. 250 - 350 THB/hr)
    const standardHourlyRate = 300;
    const monthlyCostSavings = totalMonthlyHoursSaved * standardHourlyRate;

    // Department grouping
    const deptMap: Record<string, number> = {};
    requests.forEach(r => {
      deptMap[r.department] = (deptMap[r.department] || 0) + 1;
    });

    return {
      totalRequests,
      approvedCount: approvedRequests.length,
      pendingCount: requests.filter(r => r.status === 'pending_review').length,
      totalAllocatedSeats,
      totalWeeklyHoursSaved,
      totalMonthlyHoursSaved,
      monthlyCostSavings,
      deptMap
    };
  }, [requests, reports]);

  // Effective Perspective derived from user session if set to 'auto'
  const effectivePerspective: 'my_impact' | 'department' | 'enterprise_coe' = useMemo(() => {
    if (dashboardPerspective !== 'auto') return dashboardPerspective;
    if (sessionUser?.role === 'admin' || sessionUser?.workspaceRole === 'admin') return 'enterprise_coe';
    if (sessionUser?.workspaceRole === 'manager') return 'department';
    return 'my_impact';
  }, [dashboardPerspective, sessionUser]);

  // Scoped Data Lookups
  const isMyRequest = useCallback((r: AiRequest) => {
    if (!sessionUser) return false;
    const myEmpId = sessionUser.emp_id || sessionUser.empId;
    const myName = (sessionUser.name || sessionUser.full_name || '').trim().toLowerCase();
    const myEmail = (sessionUser.email || '').trim().toLowerCase();

    if (r.user_id && (r.user_id === sessionUser.id || (myEmpId && r.user_id === myEmpId))) return true;
    if (myEmail && r.email && r.email.toLowerCase() === myEmail) return true;
    if (myName && r.requester_name && r.requester_name.toLowerCase().includes(myName)) return true;

    if (r.team_members && r.team_members.length > 0) {
      return r.team_members.some(m => {
        if (myEmpId && m.emp_id === myEmpId) return true;
        if (myName && m.name && m.name.toLowerCase().includes(myName)) return true;
        if (myEmail && m.email && m.email.toLowerCase() === myEmail) return true;
        return false;
      });
    }
    return false;
  }, [sessionUser]);

  const isMyDeptRequest = useCallback((r: AiRequest) => {
    if (!sessionUser?.department) return true;
    const myDept = sessionUser.department.toLowerCase();
    const reqDept = (r.department || '').toLowerCase();
    return reqDept.includes(myDept) || myDept.includes(reqDept);
  }, [sessionUser]);

  // User's own requests
  const myRequests = useMemo(() => {
    const list = requests.filter(isMyRequest);
    // If none matches in mock/dev mode, pick the first request as sample
    if (list.length === 0 && requests.length > 0) {
      return [requests[0]];
    }
    return list;
  }, [requests, isMyRequest]);

  // Department requests
  const myDeptRequests = useMemo(() => {
    const list = requests.filter(isMyDeptRequest);
    if (list.length === 0 && requests.length > 0) {
      const sampleDept = requests[0]?.department;
      return requests.filter(r => r.department === sampleDept);
    }
    return list;
  }, [requests, isMyDeptRequest]);

  // Ghost seats (Approved requests with 0 active days or missing reports)
  const ghostSeats = useMemo(() => {
    return requests.filter(r => {
      if (r.status !== 'approved_sandbox') return false;
      const rep = reports.find(rp => rp.request_id === r.id);
      return !rep || rep.active_days === 0;
    });
  }, [requests, reports]);

  // Personal Metrics (My Impact)
  const myMetrics = useMemo(() => {
    const activeReq = myRequests.find(r => r.status === 'approved_sandbox') || myRequests[0];
    const userReports = reports.filter(rep => myRequests.some(r => r.id === rep.request_id));
    const weeklyHours = userReports.length > 0
      ? userReports.reduce((sum, rep) => sum + (Number(rep.actual_hours_saved_per_week) || 0), 0)
      : (Number(activeReq?.target_hours_saved_per_week) || 0);
    const monthlyHours = Math.round(weeklyHours * 4.2);
    const monthlySavings = monthlyHours * 300;
    const latestReport = userReports[0];

    return {
      activeRequest: activeReq,
      weeklyHours,
      monthlyHours,
      monthlySavings,
      activeDays: latestReport ? latestReport.active_days : (activeReq?.status === 'approved_sandbox' ? 18 : 0),
      totalRequests: myRequests.length
    };
  }, [myRequests, reports]);

  // Department Metrics (Team Productivity)
  const deptMetrics = useMemo(() => {
    const approved = myDeptRequests.filter(r => r.status === 'approved_sandbox' || r.status === 'completed');
    const allocatedSeats = approved.reduce((sum, r) => sum + (r.requested_seats || 1), 0);
    const deptReports = reports.filter(rep => myDeptRequests.some(r => r.id === rep.request_id));
    const weeklyHours = deptReports.length > 0
      ? deptReports.reduce((sum, rep) => sum + (Number(rep.actual_hours_saved_per_week) || 0), 0)
      : approved.reduce((sum, r) => sum + (Number(r.target_hours_saved_per_week) || 0), 0);
    const monthlyHours = Math.round(weeklyHours * 4.2);
    const monthlySavings = monthlyHours * 300;
    const pendingCount = myDeptRequests.filter(r => r.status === 'pending_review').length;

    return {
      allocatedSeats,
      weeklyHours,
      monthlyHours,
      monthlySavings,
      totalRequests: myDeptRequests.length,
      pendingCount,
      approvedCount: approved.length
    };
  }, [myDeptRequests, reports]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = searchTerm === '' ||
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.department.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDept = filterDepartment === 'ALL' || r.department === filterDepartment;
      const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [requests, searchTerm, filterDepartment, filterStatus]);

  // Paginated requests
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  }, [filteredRequests.length, pageSize]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDepartment, filterStatus, pageSize]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set<string>();
    requests.forEach(r => depts.add(r.department));
    return Array.from(depts);
  }, [requests]);

  // Action: Apply Departmental Preset to FM-001 Request Form
  const handleApplyDepartmentPreset = useCallback((preset: DepartmentAiPreset) => {
    setFormTier(preset.prefillForm.tier);
    setFormDept(preset.deptName);
    setFormSeats(preset.prefillForm.recommendedSeats);
    setFormAiJd(preset.prefillForm.aiJd);
    setFormExpectedBenefits(preset.prefillForm.expectedBenefits);
    // The preset describes one piece of work as an hours-per-week pair; load it as the first task
    // (owned by the lead) so the numbers stay the same and the requester can refine them.
    const leadMember = formTeamMembers.find((m) => m.is_lead) || formTeamMembers[0];
    setFormTasks([
      taskFromHoursPair({
        ownerKey: leadMember ? memberKey(leadMember) : sessionLeadKey,
        title: preset.prefillForm.title,
        asIsProcess: preset.prefillForm.asIsProcess,
        aiFunctions: preset.prefillForm.aiFunctions,
        asIsHoursPerWeek: preset.prefillForm.asIsHours,
        targetHoursSavedPerWeek: preset.prefillForm.targetHoursSaved,
      }),
    ]);
    setFormAllowPartialAllocation(true);
    setActiveTab('request');
    showToast(`โหลดชุดข้อมูล Preset ของ "${preset.deptName}" ลงในฟอร์มแล้ว ตรวจและปรับตัวเลขในข้อ 2 ได้`, 'success');
  }, [showToast, formTeamMembers, sessionLeadKey]);

  // Removing a member who owns tasks must not silently orphan those tasks: move them to the lead first.
  const handleTeamMembersChange = useCallback(
    async (next: AiTeamMember[]) => {
      const removed = formTeamMembers.filter((m) => !next.some((n) => memberKey(n) === memberKey(m)));
      if (removed.length === 0) {
        setFormTeamMembers(next);
        return;
      }
      const lead = next.find((m) => m.is_lead) || next[0];
      const owned = formTasks.filter((t) => removed.some((r) => memberKey(r) === t.owner_key));
      if (owned.length > 0 && lead) {
        const ok = await showConfirm({
          title: 'นำสมาชิกออก: มีงานที่รับผิดชอบอยู่',
          message: `${removed.map((r) => r.name).join(', ')} รับผิดชอบ ${owned.length} งาน\nต้องการย้ายงานเหล่านี้ไปให้ ${lead.name} (ผู้ขอหลัก) แล้วนำออกหรือไม่?\n(หรือกดยกเลิกแล้วลบงานในข้อ 2 ก่อน)`,
          confirmText: 'ย้ายงานและนำออก',
          cancelText: 'ยกเลิก',
          type: 'primary',
        });
        if (!ok) return;
        setFormTasks(removed.reduce((acc, r) => reassignTasks(acc, memberKey(r), memberKey(lead)), formTasks));
      }
      setFormTeamMembers(next);
    },
    [formTeamMembers, formTasks, showConfirm]
  );

  // Action: Handle Submit Request (FM-001)
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowFormErrors(true);
    if (formValidation.errors.length > 0) {
      showToast(`ยังส่งคำขอไม่ได้ ต้องแก้ ${formValidation.errors.length} รายการ (ดูรายการในข้อ 3 ของฟอร์ม)`, 'warning');
      const target = formValidation.errors[0].targetId;
      if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const activeMembers = formTeamMembers.length > 0 ? formTeamMembers : [
        {
          emp_id: sessionUser?.emp_id || '',
          name: sessionUser?.name || 'พนักงานผู้ยื่นคำขอ',
          department: formDept || 'ไม่ระบุแผนก',
          position: formPosition,
          email: sessionUser?.email || '',
          is_lead: true
        }
      ];

      const newReq: Partial<AiRequest> = {
        workspace_id: sessionUser?.activeWorkspaceId || null,
        user_id: sessionUser?.id || null,
        requester_name: sessionUser?.name || 'พนักงานผู้ยื่นคำขอ',
        department: formDept || 'ไม่ระบุแผนก',
        position: formPosition,
        email: sessionUser?.email || '',
        requested_seats: formSeats,
        tier: formTier,
        ai_jd: formAiJd.trim(),
        contract_months: Number(formContractMonths),
        ...buildLegacyFields(effectiveTasks, activeMembers),
        expected_benefits: formExpectedBenefits.trim(),
        use_cases: serializeUseCases(effectiveTasks),
        supervisor_name: formSupervisor?.name.trim() || null,
        supervisor_emp_id: formSupervisor?.emp_id.trim() || null,
        supervisor_email: formSupervisor?.email?.trim().toLowerCase() || null,
        supervisor_status: 'pending',
        data_safety_certified: formDataSafetyCertified,
        status: 'pending_review',
        team_members: activeMembers,
        allow_partial_allocation: formAllowPartialAllocation
      };

      const { data, error } = await supabase
        .from('tb_ai_enterprise_requests')
        .insert([newReq])
        .select()
        .single();

      let dbError = '';
      if (error) {
        dbError = error.message || 'unknown error';
        // If supabase write fails (e.g. migration not linked yet), keep it in local state so the demo stays usable
        const localReq: AiRequest = {
          ...newReq,
          id: `req-${Date.now()}`,
          created_at: new Date().toISOString()
        } as AiRequest;
        setRequests(prev => [localReq, ...prev]);
      } else if (data) {
        setRequests(prev => [data, ...prev]);
      }

      if (dbError) {
        const needsMigration = /use_cases|supervisor_/.test(dbError);
        showToast(
          `ยังไม่ได้บันทึกลงฐานข้อมูล: ${dbError}${needsMigration ? ' (ต้องรัน migration 20261112090000 ก่อน)' : ''} คำขอแสดงในหน้านี้ชั่วคราวเท่านั้น`,
          'warning',
          9000
        );
      } else {
        showToast(`ยื่นคำขอใช้งาน AI สำหรับคณะทำงาน (${activeMembers.length} คน) สำเร็จ! ส่งต่อทีม CoE ตรวจสอบแล้ว`, 'success');
      }
      // Reset form
      setFormAiJd('');
      setFormTasks([emptyUseCase(sessionLeadKey)]);
      setFormSupervisor(null);
      setShowFormErrors(false);
      setFormExpectedBenefits('');
      setFormDataSafetyCertified(false);
      setFormSeats(1);
      setFormAllowPartialAllocation(false);
      if (sessionUser) {
        setFormTeamMembers([
          {
            emp_id: sessionUser.emp_id || '',
            name: sessionUser.name || sessionUser.full_name || 'ตัวแทนผู้ยื่นคำขอ',
            department: formDept || sessionUser.department || 'ไม่ระบุแผนก',
            position: formPosition || sessionUser.position || '',
            email: sessionUser.email || '',
            is_lead: true
          }
        ]);
      }
      setActiveTab('home');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการส่งคำขอ: ' + String(err), 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Action: Auto-sync Worklog to FM-002
  const handleAutoSyncWorklog = async () => {
    setIsSyncingWorklog(true);
    try {
      // Find matching request
      const req = requests.find(r => r.id === activeReportRequestId);
      const titleKeywords = req ? req.title.split(' ').filter(w => w.length > 2) : [];
      
      // Query recent worklogs for current user in current month
      const startOfMonth = `${reportMonth}-01`;
      const endOfMonth = `${reportMonth}-31`;

      const { data: logs, error } = await supabase
        .from('worklogs')
        .select('*')
        .gte('work_date', startOfMonth)
        .lte('work_date', endOfMonth);

      if (error || !logs || logs.length === 0) {
        // Simulated smart calculate if local/demo
        const memberCount = req?.team_members?.length || 1;
        const simulatedActiveDays = Math.floor(Math.random() * 6) + 14;
        const baseSaved = req ? (req.target_hours_saved_per_week * 0.95) : 5;
        const simulatedHoursSaved = (baseSaved * (memberCount > 1 ? Math.min(memberCount * 0.85, 3.5) : 1)).toFixed(1);
        setReportActiveDays(simulatedActiveDays);
        setReportActualHoursSaved(Number(simulatedHoursSaved));
        setReportTurnaround(
          memberCount > 1
            ? `ทีมงาน ${memberCount} คนประมวลผลเร็วขึ้น 65% เทียบกับเดือนก่อน`
            : 'ประมวลผลเร็วขึ้น 65% เทียบกับเดือนก่อน'
        );
        showToast(
          memberCount > 1
            ? `ดึงข้อมูลจำลอง: พบการลงงาน AI ของคณะทำงานทั้ง ${memberCount} คนในเดือน ${reportMonth} รวม ${simulatedActiveDays} วัน`
            : `ดึงข้อมูลจำลอง: พบการลงงาน AI ในเดือน ${reportMonth} รวม ${simulatedActiveDays} วัน`,
          'info'
        );
      } else {
        const memberCount = req?.team_members?.length || 1;
        const uniqueDays = new Set(logs.map(l => l.work_date)).size;
        setReportActiveDays(uniqueDays);
        
        // Match duration
        const matchingHours = logs.reduce((acc, l) => {
          const desc = (l.description || '').toLowerCase();
          const isMatch = titleKeywords.some(kw => desc.includes(kw.toLowerCase())) || desc.includes('ai') || desc.includes('claude');
          return isMatch ? acc + (Number(l.total_hours) || 0) : acc;
        }, 0);

        const estSaved = (matchingHours * 0.4).toFixed(1);
        setReportActualHoursSaved(Math.max(1, Number(estSaved)));
        showToast(
          memberCount > 1
            ? `ดึงข้อมูลจาก Worklog สำเร็จ! พบงาน AI ของคณะทำงาน ${memberCount} คน รวม ${uniqueDays} วัน (${matchingHours} ชม.)`
            : `ดึงข้อมูลจาก Worklog สำเร็จ! พบงาน AI รวม ${uniqueDays} วัน (${matchingHours} ชม.)`,
          'success'
        );
      }
    } catch {
      showToast('ไม่สามารถดึงข้อมูล Worklog ได้ กรุณาระบุตัวเลขด้วยตนเอง', 'warning');
    } finally {
      setIsSyncingWorklog(false);
    }
  };

  // Action: Handle Submit Monthly Report (FM-002)
  const handleSubmitMonthlyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReportRequestId) {
      showToast('กรุณาเลือกโครงการ AI ที่ต้องการรายงานผล', 'warning');
      return;
    }
    if (!reportDeliverables.trim()) {
      showToast('กรุณาระบุชิ้นงานสำคัญ (Key Deliverables)', 'warning');
      return;
    }

    setIsSubmittingReport(true);
    try {
      const newRep: Partial<AiMonthlyReport> = {
        request_id: activeReportRequestId,
        workspace_id: sessionUser?.activeWorkspaceId || null,
        user_id: sessionUser?.id || null,
        report_month: reportMonth,
        active_days: Number(reportActiveDays),
        actual_hours_saved_per_week: Number(reportActualHoursSaved),
        turnaround_time_reduction: reportTurnaround.trim(),
        error_rate_reduction: reportErrorRate.trim(),
        key_deliverables: reportDeliverables.trim(),
        coe_decision: 'maintain'
      };

      const { data, error } = await supabase
        .from('tb_ai_enterprise_monthly_reports')
        .insert([newRep])
        .select()
        .single();

      if (error) {
        const localRep: AiMonthlyReport = {
          ...newRep,
          id: `rep-${Date.now()}`,
          created_at: new Date().toISOString()
        } as AiMonthlyReport;
        setReports(prev => [localRep, ...prev]);
      } else if (data) {
        setReports(prev => [data, ...prev]);
      }

      showToast('ส่งรายงานผลสัมฤทธิ์รายเดือน (FM-PI-AI-002) เรียบร้อยแล้ว', 'success');
      setReportDeliverables('');
      setActiveTab('home');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการส่งรายงาน: ' + String(err), 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Action: Handle Evaluation Submission (CoE Rubric)
  const handleSubmitEvaluation = async () => {
    if (!activeEvalRequestId) return;

    const targetReq = requests.find(r => r.id === activeEvalRequestId);
    if (!targetReq) return;

    // Confirm dialog for rejection
    if (evalDecision === 'reject') {
      const confirmed = await showConfirm({
        title: 'ยืนยันมติไม่อนุมัติคำขอใช้งาน AI?',
        message: `คุณกำลังจะไม่อนุมัติคำขอ "${targetReq.title}" ของคุณ ${targetReq.requester_name} (${targetReq.department}) ต้องการยืนยันมตินี้ใช่หรือไม่?`,
        confirmText: 'ยืนยันไม่อนุมัติ',
        cancelText: 'กลับไปตรวจสอบ',
        type: 'danger'
      });
      if (!confirmed) return;
    }

    // Confirm dialog for revision request
    if (evalDecision === 'revision_needed') {
      const confirmed = await showConfirm({
        title: 'ส่งกลับเพื่อปรับแก้ข้อเสนอ?',
        message: `ส่งคำขอ "${targetReq.title}" กลับไปยังผู้เสนอคำขอเพื่อให้ปรับปรุงรายละเอียดข้อเสนอตามคำแนะนำหรือไม่?`,
        confirmText: 'ส่งกลับปรับปรุง',
        cancelText: 'ยกเลิก',
        type: 'primary'
      });
      if (!confirmed) return;
    }

    setIsSubmittingEval(true);
    try {
      const newEval: Partial<AiEvaluation> = {
        request_id: activeEvalRequestId,
        workspace_id: sessionUser?.activeWorkspaceId || null,
        evaluator_id: sessionUser?.id || null,
        score_problem_clarity: evalScoreClarity,
        score_business_roi: evalScoreRoi,
        score_readiness: evalScoreReadiness,
        score_data_safety: evalScoreSafety,
        evaluation_notes: evalNotes.trim(),
        decision: evalDecision
      };

      // 1. Insert evaluation
      await supabase
        .from('tb_ai_enterprise_evaluations')
        .insert([newEval]);

      // 2. Update request status based on decision
      const mappedStatus = evalDecision === 'approve_sandbox' ? 'approved_sandbox'
        : evalDecision === 'waiting_list' ? 'waiting_list'
        : evalDecision === 'reject' ? 'rejected' : 'pending_review';

      await supabase
        .from('tb_ai_enterprise_requests')
        .update({ status: mappedStatus, updated_at: new Date().toISOString() })
        .eq('id', activeEvalRequestId);

      // Local state update (Replace existing evaluation if re-evaluating)
      const savedEval: AiEvaluation = {
        ...newEval,
        id: `eval-${Date.now()}`,
        total_score: evalTotalScore,
        evaluated_at: new Date().toISOString()
      } as AiEvaluation;

      setEvaluations(prev => [savedEval, ...prev.filter(e => e.request_id !== activeEvalRequestId)]);
      setRequests(prev => prev.map(r => r.id === activeEvalRequestId ? { ...r, status: mappedStatus } : r));

      // Optional: Ask to create project in tb_project_registry
      if (evalDecision === 'approve_sandbox') {
        const wantProject = await showConfirm({
          title: 'สร้างโครงการใน Project Registry หรือไม่?',
          message: `คำขอ "${targetReq.title}" ผ่านการอนุมัติแล้ว คุณต้องการสร้างเป็น Project ในระบบ เพื่อให้พนักงานลงเวลาใน Daily Worklog ได้ทันทีหรือไม่?`,
          confirmText: 'สร้างโครงการทันที',
          cancelText: 'ข้ามไปก่อน',
          type: 'primary'
        });

        if (wantProject) {
          try {
            await supabase.from('tb_project_registry').insert([{
              project_name: `[AI] ${targetReq.title}`,
              project_slug: `ai-${Date.now()}`,
              description: `AI Enterprise Initiative by ${targetReq.department}. Expected saved: ${targetReq.target_hours_saved_per_week}h/week`,
              status: 'in_progress',
              project_type: 'Internal AI Automation',
              owner_team: targetReq.department
            }]);
            showToast('สร้างโครงการ [AI] ใน Project Registry สำเร็จ!', 'success');
          } catch {
            showToast('บันทึกโครงการลุล่วง', 'info');
          }
        }
      }

      showToast(`บันทึกผลการประเมินคะแนน ${evalTotalScore}/100 (${evalDecision}) สำเร็จ!`, 'success');
      setEvalNotes('');
      setActiveTab('dashboard');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการประเมิน: ' + String(err), 'error');
    } finally {
      setIsSubmittingEval(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-theme-bg-page text-theme-text pb-16">
        {/* Page header + primary navigation */}
        <div className="border-b border-theme-border/80 bg-theme-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">AI Enterprise Hub</h1>
                  <p className="text-sm text-theme-text-muted mt-0.5">ศูนย์กลางขอใช้ AI ขององค์กร: เลือก ยื่นคำขอ และติดตามผลในที่เดียว</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setOnboardingInitialStep(0);
                    setIsOnboardingOpen(true);
                  }}
                  className="px-3.5 py-2 text-sm font-medium rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <HelpCircle size={16} />
                  <span>วิธีใช้งาน</span>
                </button>
                <Link
                  to="/ai-chat"
                  className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text transition-colors flex items-center gap-1.5"
                >
                  <Bot size={16} className="text-indigo-500" />
                  <span>เปิด AI Chat</span>
                </Link>
              </div>
            </div>

            <AiHubNav
              active={activeTab}
              onChange={setActiveTab}
              isAdmin={isAdminOrManager}
              pendingCount={metrics.pendingCount}
            />
          </div>
        </div>

        {/* Home: start here */}
        {activeTab === 'home' && (
          <AiHubHome
            userName={sessionUser?.name || sessionUser?.full_name || ''}
            myRequests={requests.filter(isMyRequest)}
            reports={reports}
            isAdmin={isAdminOrManager}
            pendingCount={metrics.pendingCount}
            dormantCount={ghostSeats.length}
            loading={loading}
            onNavigate={setActiveTab}
            onRequest={(tier) => {
              setFormTier(tier);
              setActiveTab('request');
            }}
            onOpenGuide={() => {
              setOnboardingInitialStep(0);
              setIsOnboardingOpen(true);
            }}
          />
        )}

        {/* Tab 1: Dashboard (Overview & ROI) */}
        {activeTab === 'dashboard' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
            {loading && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>กำลังโหลดข้อมูลภาพรวมโครงการ AI...</span>
              </div>
            )}
            {/* Tri-Persona Perspective Switcher & Workspace Control Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-theme-surface border border-theme-border/80 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-theme-text-muted mr-1">มุมมองข้อมูล:</span>
                
                {/* 1. My Impact */}
                <button
                  type="button"
                  onClick={() => setDashboardPerspective('my_impact')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                    effectivePerspective === 'my_impact'
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-theme-surface-secondary text-theme-text hover:bg-theme-surface-tertiary border border-theme-border/60"
                  )}
                >
                  <User size={14} className={effectivePerspective === 'my_impact' ? "text-white" : "text-indigo-500"} />
                  <span>งานของฉัน (My Impact)</span>
                  {dashboardPerspective === 'auto' && effectivePerspective === 'my_impact' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20">Auto</span>
                  )}
                </button>

                {/* 2. Department */}
                <button
                  type="button"
                  onClick={() => setDashboardPerspective('department')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                    effectivePerspective === 'department'
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-theme-surface-secondary text-theme-text hover:bg-theme-surface-tertiary border border-theme-border/60"
                  )}
                >
                  <Building2 size={14} className={effectivePerspective === 'department' ? "text-white" : "text-indigo-500"} />
                  <span>ฝ่ายของฉัน</span>
                  {sessionUser?.department && (
                    <span className="text-[10px] opacity-75 hidden xl:inline max-w-[140px] truncate">
                      ({sessionUser.department})
                    </span>
                  )}
                  {dashboardPerspective === 'auto' && effectivePerspective === 'department' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20">Auto</span>
                  )}
                </button>

                {/* 3. Enterprise CoE Hub */}
                <button
                  type="button"
                  onClick={() => setDashboardPerspective('enterprise_coe')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                    effectivePerspective === 'enterprise_coe'
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-theme-surface-secondary text-theme-text hover:bg-theme-surface-tertiary border border-theme-border/60"
                  )}
                >
                  <Globe size={14} className={effectivePerspective === 'enterprise_coe' ? "text-white" : "text-indigo-500"} />
                  <span>ภาพรวมองค์กร (CoE Hub)</span>
                  {dashboardPerspective === 'auto' && effectivePerspective === 'enterprise_coe' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20">Auto</span>
                  )}
                </button>

                {dashboardPerspective !== 'auto' && (
                  <button
                    type="button"
                    onClick={() => setDashboardPerspective('auto')}
                    className="text-[11px] text-theme-text-muted hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    รีเซ็ตเป็นอัตโนมัติ
                  </button>
                )}
              </div>

              {/* Badges: DB Mode & Governance */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5",
                    isLiveData
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
                  )}
                  title={isLiveData ? "เชื่อมต่อฐานข้อมูล Supabase สำเร็จ" : "ระบบทำงานในโหมด Local Sandbox / Mock Data"}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isLiveData ? "bg-emerald-500" : "bg-amber-500")} />
                  <span>{isLiveData ? "🟢 Supabase Live DB" : "🟡 Local Sandbox / Cache"}</span>
                </span>

                <button
                  type="button"
                  onClick={() => setActiveTab('governance')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-theme-surface-secondary hover:bg-theme-surface-tertiary border border-theme-border text-theme-text-muted hover:text-theme-text flex items-center gap-1 transition-all cursor-pointer"
                >
                  <BookOpen size={12} className="text-indigo-500" />
                  <span>ระเบียบ WI-PI-AI-001</span>
                </button>
              </div>
            </div>

            {/* Adaptive Metric KPI Cards (Scoped by Perspective) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Hours Saved */}
              <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-theme-text-muted uppercase tracking-wider">
                    {effectivePerspective === 'my_impact'
                      ? 'เวลาที่ฉันประหยัดได้/เดือน'
                      : effectivePerspective === 'department'
                        ? 'เวลาที่ฝ่ายประหยัดได้/เดือน'
                        : 'ชั่วโมงที่ประหยัดได้/เดือน'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-theme-text tracking-tight font-mono">
                    {effectivePerspective === 'my_impact'
                      ? myMetrics.monthlyHours.toLocaleString()
                      : effectivePerspective === 'department'
                        ? deptMetrics.monthlyHours.toLocaleString()
                        : metrics.totalMonthlyHoursSaved.toLocaleString()}
                  </span>
                  <span className="text-xs text-emerald-500 font-semibold">ชม./เดือน</span>
                </div>
                <p className="text-[11px] text-theme-text-muted mt-2">
                  {effectivePerspective === 'my_impact'
                    ? `คำนวณจากเป้าหมาย ${myMetrics.weeklyHours} ชม./สัปดาห์ ของงานฉัน`
                    : effectivePerspective === 'department'
                      ? `คำนวณจาก ${deptMetrics.weeklyHours} ชม./สัปดาห์ ในฝ่าย ${sessionUser?.department || 'ของฉัน'}`
                      : `คำนวณจาก ${metrics.totalWeeklyHoursSaved} ชม./สัปดาห์ ทุกโครงการรวมกัน`}
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
              </div>

              {/* Card 2: Cost Savings (ROI) */}
              <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-theme-text-muted uppercase tracking-wider">
                    {effectivePerspective === 'my_impact'
                      ? 'มูลค่าผลงานส่วนบุคคล (ROI)'
                      : effectivePerspective === 'department'
                        ? 'มูลค่าประหยัดรวมทั้งฝ่าย'
                        : 'มูลค่าประหยัดสะสม (ROI)'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-theme-text tracking-tight font-mono">
                    {effectivePerspective === 'my_impact'
                      ? myMetrics.monthlySavings.toLocaleString()
                      : effectivePerspective === 'department'
                        ? deptMetrics.monthlySavings.toLocaleString()
                        : metrics.monthlyCostSavings.toLocaleString()}
                  </span>
                  <span className="text-xs text-indigo-500 font-semibold">บาท/เดือน</span>
                </div>
                <p className="text-[11px] text-theme-text-muted mt-2">
                  อิง Standard Blended Rate 300 บาท/ชม. ตามระเบียบ WI-001
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              </div>

              {/* Card 3: Seats & Allocation Status */}
              <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-theme-text-muted uppercase tracking-wider">
                    {effectivePerspective === 'my_impact'
                      ? 'สถานะสิทธิ์ AI ของฉัน'
                      : effectivePerspective === 'department'
                        ? 'สิทธิ์ที่จัดสรรในฝ่าย'
                        : 'สิทธิ์ที่จัดสรร (Seats)'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    {effectivePerspective === 'my_impact' ? <ShieldCheck size={16} /> : <Users size={16} />}
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-theme-text tracking-tight font-mono">
                    {effectivePerspective === 'my_impact'
                      ? (myMetrics.activeRequest?.status === 'approved_sandbox' ? '1 ที่นั่ง' : myMetrics.activeRequest?.status === 'pending_review' ? 'รอพิจารณา' : 'ยื่นขอใช้งาน')
                      : effectivePerspective === 'department'
                        ? `${deptMetrics.allocatedSeats} ที่นั่ง`
                        : metrics.totalAllocatedSeats}
                  </span>
                  <span className="text-xs text-amber-500 font-semibold">
                    {effectivePerspective === 'my_impact'
                      ? (myMetrics.activeRequest?.status === 'approved_sandbox' ? '• Sandbox 90 วัน' : '• FM-001')
                      : effectivePerspective === 'department'
                        ? `(จาก ${deptMetrics.approvedCount} โครงการ)`
                        : '/ 20 Seats (Seed Pool)'}
                  </span>
                </div>
                <p className="text-[11px] text-theme-text-muted mt-2">
                  {effectivePerspective === 'my_impact'
                    ? (myMetrics.activeRequest?.title || 'ยังไม่มีโครงการที่บันทึก')
                    : effectivePerspective === 'department'
                      ? `โควตารวมเฉพาะฝ่าย ${sessionUser?.department || 'ของฉัน'}`
                      : `Sandbox 90 วัน • อนุมัติแล้ว ${metrics.approvedCount} โครงการ`}
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
              </div>

              {/* Card 4: Activity / Pending */}
              <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-sky-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-theme-text-muted uppercase tracking-wider">
                    {effectivePerspective === 'my_impact'
                      ? 'วันที่ Active เดือนนี้'
                      : effectivePerspective === 'department'
                        ? 'คำขอรออนุมัติในฝ่าย'
                        : 'คิวรอพิจารณา (Pending)'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
                    {effectivePerspective === 'my_impact' ? <Activity size={16} /> : <FileCheck2 size={16} />}
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-theme-text tracking-tight font-mono">
                    {effectivePerspective === 'my_impact'
                      ? myMetrics.activeDays
                      : effectivePerspective === 'department'
                        ? deptMetrics.pendingCount
                        : metrics.pendingCount}
                  </span>
                  <span className="text-xs text-sky-500 font-semibold">
                    {effectivePerspective === 'my_impact' ? 'วัน/เดือน' : 'คำขอ'}
                  </span>
                </div>
                <p className="text-[11px] text-theme-text-muted mt-2">
                  {effectivePerspective === 'my_impact'
                    ? 'เกณฑ์รักษาที่นั่ง: ใช้งานอย่างน้อย 10 วัน/เดือน'
                    : effectivePerspective === 'department'
                      ? `จากทั้งหมด ${deptMetrics.totalRequests} คำขอในฝ่าย`
                      : `จากทั้งหมด ${metrics.totalRequests} คำขอที่ยื่นเข้ามา`}
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-400" />
              </div>
            </div>

            {/* VIEW A: MY IMPACT (Personal Workspace View) */}
            {effectivePerspective === 'my_impact' && (
              <div className="space-y-6">
                {/* 1. Personal AI Lifecycle Progress Stepper Card */}
                <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                          Personal AI Journey
                        </span>
                        <span className="text-xs text-theme-text-muted">ความคืบหน้าสิทธิ์และการใช้งานของฉัน</span>
                      </div>
                      <h3 className="text-base font-bold text-theme-text mt-1 flex items-center gap-2">
                        <span>{myMetrics.activeRequest?.title || 'โครงการเพิ่มประสิทธิภาพด้วย AI'}</span>
                      </h3>
                    </div>
                    {/* Quick action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/ai-chat"
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs transition-all"
                      >
                        <Bot size={14} />
                        <span>เปิด AI Chat ทันที</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (myMetrics.activeRequest) setReportRequestId(myMetrics.activeRequest.id);
                          setActiveTab('reports');
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <Send size={13} />
                        <span>ส่งผลงานประจำเดือน (FM-002)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('request')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-theme-surface-secondary hover:bg-theme-surface-tertiary border border-theme-border text-theme-text flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <PlusCircle size={13} />
                        <span>ยื่นคำขอใหม่ (FM-001)</span>
                      </button>
                    </div>
                  </div>

                  {/* 4-Step Stepper Progress */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    {/* Step 1 */}
                    <div className="p-4 rounded-xl border bg-theme-surface-secondary/40 border-emerald-500/30">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">✓</div>
                        <span className="text-xs font-bold text-theme-text">1. ยื่นคำขอ FM-001</span>
                      </div>
                      <p className="text-[11px] text-theme-text-muted mt-2">
                        ระบุปัญหา As-Is และเป้าหมายเวลาที่ลด {myMetrics.weeklyHours} ชม./สัปดาห์
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        สำเร็จแล้ว
                      </span>
                    </div>

                    {/* Step 2 */}
                    <div className={cn(
                      "p-4 rounded-xl border",
                      myMetrics.activeRequest?.status === 'approved_sandbox'
                        ? "bg-theme-surface-secondary/40 border-emerald-500/30"
                        : "bg-theme-surface-secondary/20 border-indigo-500/30"
                    )}>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                          myMetrics.activeRequest?.status === 'approved_sandbox'
                            ? "bg-emerald-500 text-white"
                            : "bg-indigo-500 text-white animate-pulse"
                        )}>
                          {myMetrics.activeRequest?.status === 'approved_sandbox' ? '✓' : '2'}
                        </div>
                        <span className="text-xs font-bold text-theme-text">2. CoE ประเมินเกณฑ์ 100 คะแนน</span>
                      </div>
                      <p className="text-[11px] text-theme-text-muted mt-2">
                        พิจารณา ROI, ความพร้อมของข้อมูล และความเสี่ยง Data Security
                      </p>
                      <span className={cn(
                        "inline-block mt-2 text-[10px] font-bold",
                        myMetrics.activeRequest?.status === 'approved_sandbox'
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-indigo-600 dark:text-indigo-400"
                      )}>
                        {myMetrics.activeRequest?.status === 'approved_sandbox' ? 'ผ่านเกณฑ์อนุมัติ' : 'กำลังพิจารณา'}
                      </span>
                    </div>

                    {/* Step 3 */}
                    <div className={cn(
                      "p-4 rounded-xl border",
                      myMetrics.activeRequest?.status === 'approved_sandbox'
                        ? "bg-theme-surface-secondary/40 border-emerald-500/30"
                        : "bg-theme-surface-secondary/10 border-theme-border/60 opacity-70"
                    )}>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                          myMetrics.activeRequest?.status === 'approved_sandbox' ? "bg-emerald-500 text-white" : "bg-theme-surface-tertiary text-theme-text-muted"
                        )}>
                          {myMetrics.activeRequest?.status === 'approved_sandbox' ? '✓' : '3'}
                        </div>
                        <span className="text-xs font-bold text-theme-text">3. จัดสรรสิทธิ์ & IT SSO</span>
                      </div>
                      <p className="text-[11px] text-theme-text-muted mt-2">
                        ออกบัญชี Claude Team Premium / Seed Pool ทดลอง 90 วัน
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {myMetrics.activeRequest?.status === 'approved_sandbox' ? 'เปิดใช้งานพร้อมแล้ว' : 'รอดำเนินการ'}
                      </span>
                    </div>

                    {/* Step 4 */}
                    <div className="p-4 rounded-xl border bg-theme-surface-secondary/40 border-amber-500/30">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">4</div>
                        <span className="text-xs font-bold text-theme-text">4. ส่งผลงานประจำเดือน FM-002</span>
                      </div>
                      <p className="text-[11px] text-theme-text-muted mt-2">
                        บันทึก Active Days (ปัจจุบัน {myMetrics.activeDays} วัน) และเวลาที่ลดจริง
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        ต้องส่งทุกสิ้นเดือน
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2-Column: Department Champions & My Deliverables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Department AI Champions (เพื่อนร่วมฝ่ายที่มีสิทธิ์ AI) */}
                  <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-theme-text flex items-center gap-2">
                          <Users size={16} className="text-indigo-500" />
                          <span>AI Champions ในฝ่าย {sessionUser?.department || 'ของฉัน'}</span>
                        </h4>
                        <p className="text-xs text-theme-text-muted mt-0.5">
                          เพื่อนร่วมงานที่ได้รับสิทธิ์ AI ในฝ่าย สามารถแลกเปลี่ยน Prompts และปรึกษาการใช้งานได้
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {myDeptRequests.filter(r => r.status === 'approved_sandbox').length} สิทธิ์ในฝ่าย
                      </span>
                    </div>

                    <div className="space-y-3">
                      {myDeptRequests.length === 0 ? (
                        <div className="text-center py-6 text-xs text-theme-text-muted">
                          ยังไม่มีคำขอในฝ่ายของคุณ
                        </div>
                      ) : (
                        myDeptRequests.map((req) => (
                          <div key={req.id} className="p-3.5 rounded-xl bg-theme-surface-secondary/50 border border-theme-border/60 flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-theme-text">{req.requester_name}</span>
                                <span className="text-[11px] text-theme-text-muted">• {req.position || 'เจ้าหน้าที่'}</span>
                              </div>
                              <p className="text-xs text-theme-text-secondary mt-0.5">{req.title}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-500">
                                  {req.requested_seats} ที่นั่ง
                                </span>
                                <span className="text-[10px] text-theme-text-muted">
                                  ลดเวลา: {req.target_hours_saved_per_week} ชม./สัปดาห์
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              {req.status === 'approved_sandbox' ? (
                                <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  Active Champion
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  {req.status === 'pending_review' ? 'รอพิจารณา' : 'รอดำเนินการ'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* My Deliverables & Guidelines */}
                  <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-theme-text flex items-center gap-2">
                          <Award size={16} className="text-amber-500" />
                          <span>ผลงานและความสำเร็จของฉัน (Deliverables)</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setActiveTab('reports')}
                          className="text-xs text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span>ดูรายงาน FM-002</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-theme-surface-secondary/40 border border-theme-border/60">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-theme-text">สรุปเวลาประหยัดสะสม</span>
                            <span className="text-xs font-mono font-bold text-emerald-500">
                              +{myMetrics.weeklyHours} ชม./สัปดาห์
                            </span>
                          </div>
                          <p className="text-xs text-theme-text-muted mt-1">
                            ช่วยให้งานเสร็จเร็วขึ้น ลดภาระงานรูทีน และนำเวลาไปพัฒนางานเชิงกลยุทธ์
                          </p>
                        </div>

                        {/* Security Guidelines Tip */}
                        <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            <ShieldCheck size={15} />
                            <span>แนวปฏิบัติ Data Security ตามระเบียบ WI-PI-AI-001</span>
                          </div>
                          <ul className="text-[11px] text-theme-text-muted mt-2 space-y-1 list-disc list-inside">
                            <li>อนุญาตเฉพาะข้อมูลภายใน (Internal) ชั้นความลับ 1-2</li>
                            <li>ห้ามนำข้อมูลลูกค้า บัญชีธนาคาร หรือรหัสผ่านเข้าสู่โมเดลเด็ดขาด</li>
                            <li>หากใช้งานโมเดลภายนอก ต้องเปิดสวิตช์ <em>Do Not Train</em> เสมอ</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-theme-border/40 flex items-center justify-between text-xs text-theme-text-muted">
                      <span>ต้องการยกระดับทักษะ Prompt หรือสอบถามปัญหา:</span>
                      <span className="font-semibold text-indigo-500">ติดต่อ CoE ทีม Process Improvement</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW B: DEPARTMENT (Team Productivity & Manager Overview) */}
            {effectivePerspective === 'department' && (
              <div className="space-y-6">
                {/* Department Header Banner */}
                <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                        ฝ่าย {sessionUser?.department || 'ฝ่ายงาน'}
                      </span>
                      <span className="text-xs text-theme-text-muted">ภาพรวมผลิตภาพและความคุ้มค่า AI ระดับฝ่าย</span>
                    </div>
                    <h3 className="text-lg font-bold text-theme-text mt-1.5 flex items-center gap-2">
                      <Building2 size={20} className="text-indigo-500" />
                      <span>ทีม {sessionUser?.department || 'ฝ่ายงาน'} • จัดสรรแล้ว {deptMetrics.allocatedSeats} ที่นั่ง</span>
                    </h3>
                    <p className="text-xs text-theme-text-muted mt-1 max-w-2xl leading-relaxed">
                      ติดตามการใช้ประโยชน์จาก AI ของพนักงานในฝ่าย ตรวจสอบคำขอที่รอการรับรอง และประเมินความคุ้มค่าเทียบกับชั่วโมงการทำงานจริง
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('request')}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlusCircle size={14} />
                      <span>ยื่นคำขอในนามฝ่าย (FM-001)</span>
                    </button>
                    {isAdminOrManager && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('evaluations')}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-theme-surface border border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sliders size={14} />
                        <span>ประเมินคำขอของทีม ({deptMetrics.pendingCount})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2-Column: Department Initiatives & Team Utilization */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Department Requests & Pipeline */}
                  <div className="lg:col-span-2 bg-theme-surface border border-theme-border/80 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-theme-text flex items-center gap-2">
                          <Layers size={16} className="text-indigo-500" />
                          <span>รายการคำขอและโครงการ AI ในฝ่าย ({myDeptRequests.length} โครงการ)</span>
                        </h4>
                        <p className="text-xs text-theme-text-muted mt-0.5">
                          ติดตามสถานะตั้งแต่การยื่นคำขอจนถึงการอนุมัติ Sandbox
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {myDeptRequests.length === 0 ? (
                        <div className="text-center py-8 text-xs text-theme-text-muted">
                          ยังไม่มีคำขอจากฝ่ายนี้ในระบบ
                        </div>
                      ) : (
                        myDeptRequests.map((req) => (
                          <div key={req.id} className="p-4 rounded-xl bg-theme-surface-secondary/40 border border-theme-border/60 hover:border-theme-border transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-theme-text">{req.title}</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-theme-surface-tertiary">
                                    {req.requested_seats} ที่นั่ง
                                  </span>
                                </div>
                                <div className="text-xs text-theme-text-muted mt-1 flex items-center gap-2">
                                  <span>ผู้ยื่น: {req.requester_name}</span>
                                  {req.position && <span>• {req.position}</span>}
                                </div>
                                <p className="text-xs text-theme-text-secondary mt-1.5 line-clamp-2">
                                  {req.as_is_process}
                                </p>
                              </div>

                              <div className="sm:text-right shrink-0 mt-2 sm:mt-0 flex sm:flex-col items-center sm:items-end justify-between gap-1.5">
                                {req.status === 'approved_sandbox' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    ✓ อนุมัติ Sandbox (90 วัน)
                                  </span>
                                ) : req.status === 'pending_review' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                    ⏱️ รอ CoE ประเมิน
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                    ⏳ Waiting List
                                  </span>
                                )}
                                <span className="text-xs font-mono font-bold text-emerald-500 block">
                                  ลดเวลา {req.target_hours_saved_per_week} ชม./สัปดาห์
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right: Team Productivity Insights & Deliverables */}
                  <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-theme-text flex items-center gap-2 mb-3">
                        <TrendingUp size={16} className="text-emerald-500" />
                        <span>ผลตอบแทนความคุ้มค่า (ROI ของฝ่าย)</span>
                      </h4>
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-theme-surface-secondary/50 border border-theme-border/60">
                          <div className="text-[11px] text-theme-text-muted">มูลค่าประหยัดต่อปี (Estimated Annual ROI)</div>
                          <div className="text-xl font-black text-theme-text font-mono mt-1">
                            {(deptMetrics.monthlySavings * 12).toLocaleString()} บาท
                          </div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            ประหยัดเวลา {deptMetrics.monthlyHours * 12} ชั่วโมงทำงาน/ปี
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-theme-surface-secondary/50 border border-theme-border/60">
                          <div className="text-[11px] text-theme-text-muted">ความสม่ำเสมอในการใช้งาน (Active Days)</div>
                          <div className="text-sm font-bold text-theme-text mt-1">
                            เกณฑ์ขั้นต่ำ 10 วัน/เดือน
                          </div>
                          <div className="text-[10px] text-theme-text-muted mt-0.5">
                            สิทธิ์ที่ไม่มีความเคลื่อนไหวเกิน 14 วัน จะถูก CoE แจ้งเตือนเพื่อหมุนเวียนสิทธิ์
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-theme-border/40">
                      <button
                        type="button"
                        onClick={() => setActiveTab('reports')}
                        className="w-full py-2 rounded-xl text-xs font-bold bg-theme-surface-secondary hover:bg-theme-surface-tertiary border border-theme-border text-theme-text flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <span>ดูรายงานผลงาน FM-002 ของฝ่าย →</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW C: ENTERPRISE COE HUB (Governance & Full Registry) */}
            {effectivePerspective === 'enterprise_coe' && (
              <div className="space-y-6">
                {/* Dormant / Ghost Seat Alert Banner (if any) */}
                {ghostSeats.length > 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldAlert size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-theme-text flex items-center gap-2">
                          <span>⚠️ สัญญาณเตือนสิทธิ์ว่าง / ไม่มีการใช้งาน (Dormant Licenses)</span>
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            {ghostSeats.length} ที่นั่ง
                          </span>
                        </div>
                        <p className="text-[11px] text-theme-text-muted mt-1 max-w-3xl leading-relaxed">
                          ตรวจพบโครงการที่ได้รับอนุมัติแต่ไม่มีความเคลื่อนไหวเกิน 14 วัน หรือยังขาดส่งรายงาน FM-002 — ตามระเบียบ <strong>WI-PI-AI-001 ข้อ 6</strong> คณะกรรมการ CoE สามารถแจ้งเตือนเพื่อหมุนเวียนสิทธิ์ (License Reclamation) ให้ผู้ขอที่อยู่ใน Waiting List
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDashboardView('roster');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold whitespace-nowrap shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      ตรวจสอบทำเนียบ 20 สิทธิ์ →
                    </button>
                  </div>
                )}

            {/* Department Adoption & Recent Deliverables Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Department Adoption Card */}
              <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-500" />
                    <span>การตื่นตัวแยกตามแผนก (Adoption)</span>
                  </h3>
                  <span className="text-xs text-theme-text-muted">
                    {Object.keys(metrics.deptMap).length} แผนก
                  </span>
                </div>
                <div className="space-y-3">
                  {Object.entries(metrics.deptMap).map(([dept, count]) => {
                    const pct = Math.round((count / (metrics.totalRequests || 1)) * 100);
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-theme-text truncate max-w-[200px]" title={dept}>{dept}</span>
                          <span className="font-mono text-theme-text-muted">{count} คำขอ ({pct}%)</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-theme-surface-tertiary overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Success Stories Card */}
              <div className="lg:col-span-2 bg-theme-surface border border-theme-border/80 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-theme-text flex items-center gap-2">
                    <Award size={16} className="text-amber-500" />
                    <span>ผลงานและผลสัมฤทธิ์ล่าสุด (Latest Deliverables)</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className="text-xs text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-1"
                  >
                    <span>ดูรายงานทั้งหมด</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="space-y-3">
                  {reports.length === 0 ? (
                    <div className="text-center py-8 text-xs text-theme-text-muted">
                      ยังไม่มีรายงานผลงานประจำเดือนที่ส่งเข้ามา
                    </div>
                  ) : (
                    reports.slice(0, 3).map((rep) => {
                      const req = requests.find(r => r.id === rep.request_id);
                      return (
                        <div key={rep.id} className="p-4 rounded-xl bg-theme-surface-secondary/50 border border-theme-border/60 hover:border-theme-border transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-theme-text">
                                  {req ? req.title : 'โครงการ AI'}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-500 font-mono">
                                  {rep.report_month}
                                </span>
                              </div>
                              <p className="text-xs text-theme-text-secondary mt-1">
                                {rep.key_deliverables}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-bold text-emerald-500">
                                +{rep.actual_hours_saved_per_week} ชม./สัปดาห์
                              </span>
                              <div className="text-[10px] text-theme-text-muted">
                                ใช้งาน {rep.active_days} วัน
                              </div>
                            </div>
                          </div>
                          {rep.turnaround_time_reduction && (
                            <div className="mt-2 text-[11px] text-theme-text-muted flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{rep.turnaround_time_reduction}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* AI Initiatives Registry Table / 20-Seat Roster */}
            <div className="bg-theme-surface border border-theme-border/80 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-theme-text flex items-center gap-2">
                      {activeDashboardView === 'initiatives' ? (
                        <>
                          <Laptop size={18} className="text-indigo-500" />
                          <span>ทะเบียนโครงการ AI และสถานะคำขอ (All Initiatives)</span>
                        </>
                      ) : (
                        <>
                          <Users size={18} className="text-indigo-500" />
                          <span>ทำเนียบสิทธิ์ 20 ที่นั่งประจำองค์กร (20-Seat Corporate Roster)</span>
                        </>
                      )}
                    </h3>
                    {!isLiveData ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span>ข้อมูลจำลองทดสอบ (Seed Data)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>ฐานข้อมูลจริง (Live Data)</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-theme-text-muted mt-1">
                    {activeDashboardView === 'initiatives'
                      ? 'ติดตามการจัดสรรสิทธิ์และสถานะการพิจารณาคำขอใช้งานของทุกฝ่าย (เมื่อยื่นแบบฟอร์ม FM-001 ข้อมูลจริงจะบันทึกลงระบบทันที)'
                      : 'ตรวจสอบรายชื่อพนักงานที่ถือครองสิทธิ์ทั้ง 20 ที่นั่ง พร้อมสถานะความเคลื่อนไหวและ Active Days'}
                  </p>
                </div>

                {/* View Switcher Toggle */}
                <div className="flex items-center gap-1 p-1 bg-theme-surface-secondary rounded-xl border border-theme-border self-start sm:self-auto shrink-0">
                  <button
                    onClick={() => setActiveDashboardView('initiatives')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                      activeDashboardView === 'initiatives'
                        ? "bg-theme-surface text-theme-text shadow-2xs font-bold"
                        : "text-theme-text-muted hover:text-theme-text"
                    )}
                  >
                    <Layers size={13} />
                    <span>ทะเบียนโครงการ ({requests.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveDashboardView('roster')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                      activeDashboardView === 'roster'
                        ? "bg-indigo-600 text-white shadow-2xs font-bold"
                        : "text-theme-text-muted hover:text-theme-text"
                    )}
                  >
                    <Users size={13} />
                    <span>ทำเนียบ 20 สิทธิ์</span>
                  </button>
                </div>
              </div>

              {activeDashboardView === 'roster' ? (
                <AiSeatRosterGrid
                  requests={requestsForRoster}
                  totalQuota={20}
                  onSelectRequest={(id) => {
                    setSelectedEvalRequestId(id);
                    setActiveTab('evaluations');
                  }}
                  onNavigateTab={(tab) => {
                    if (tab === 'dashboard' || tab === 'request' || tab === 'evaluations' || tab === 'reports' || tab === 'governance') {
                      setActiveTab(tab);
                    }
                  }}
                />
              ) : (
                <>
                  {/* Enhanced Filters & Search Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-theme-surface-secondary/40 border border-theme-border/60">
                    <div className="flex items-center gap-3 flex-1 max-w-md">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                        <input
                          type="text"
                          placeholder="ค้นหาชื่อโครงการ, ผู้เสนอคำขอ, แผนก..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-7 py-1.5 rounded-lg text-xs bg-theme-surface border border-theme-border/80 focus:outline-none focus:border-indigo-500 text-theme-text transition-all"
                        />
                        {searchTerm && (
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-theme-text-muted whitespace-nowrap hidden lg:inline">
                        พบ <strong className="text-theme-text font-mono font-bold">{filteredRequests.length}</strong> จาก {requests.length} โครงการ
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-theme-text-muted hidden sm:inline" />
                        <select
                          value={filterDepartment}
                          onChange={(e) => setFilterDepartment(e.target.value)}
                          className="py-1.5 px-2.5 rounded-lg text-xs bg-theme-surface border border-theme-border/80 text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs font-medium"
                        >
                          <option value="ALL">ทุกแผนก ({departments.length})</option>
                          {departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Sliders size={13} className="text-theme-text-muted hidden sm:inline" />
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="py-1.5 px-2.5 rounded-lg text-xs bg-theme-surface border border-theme-border/80 text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs font-medium"
                        >
                          <option value="ALL">ทุกสถานะ</option>
                          <option value="approved_sandbox">✓ อนุมัติ Sandbox (90 วัน)</option>
                          <option value="pending_review">⏱️ รอพิจารณา (Pending)</option>
                          <option value="waiting_list">⏳ รอคิว (Waiting List)</option>
                          <option value="rejected">✕ ส่งกลับปรับปรุง</option>
                        </select>
                      </div>

                      {(searchTerm || filterDepartment !== 'ALL' || filterStatus !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            setFilterDepartment('ALL');
                            setFilterStatus('ALL');
                          }}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 font-semibold cursor-pointer"
                        >
                          ล้างตัวกรอง
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Initiatives: Desktop Table + Mobile Cards + Pagination */}
                  <div className="border border-theme-border/60 rounded-2xl shadow-2xs overflow-hidden bg-theme-surface">
                    {/* 1. Desktop & Tablet Table View (md:block) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs min-w-[880px]">
                        <thead>
                          <tr className="border-b border-theme-border bg-theme-surface-secondary/70 text-theme-text-muted font-bold text-[11px] uppercase tracking-wider">
                            <th className="py-3 px-3 min-w-[220px]">ชื่อโครงการ & ผู้เสนอคำขอ</th>
                            <th className="py-3 px-3 min-w-[190px] whitespace-nowrap">ฝ่าย / แผนก</th>
                            <th className="py-3 px-3 text-center min-w-[75px] whitespace-nowrap">สิทธิ์ที่ขอ</th>
                            <th className="py-3 px-3 text-right min-w-[110px] whitespace-nowrap">เป้าหมายเวลาที่ลด</th>
                            <th className="py-3 px-3 text-center min-w-[140px] whitespace-nowrap">สถานะคำขอ</th>
                            <th className="py-3 px-3 text-right min-w-[145px] whitespace-nowrap">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme-border/40">
                          {paginatedRequests.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-theme-text-muted">
                                <div className="max-w-xs mx-auto text-center space-y-2">
                                  <Search size={24} className="mx-auto text-theme-text-muted/60" />
                                  <div className="font-semibold text-theme-text text-xs">ไม่พบรายการคำขอที่ตรงกับเงื่อนไข</div>
                                  <p className="text-[11px] text-theme-text-muted">ลองปรับเปลี่ยนคำค้นหา หรือกดล้างตัวกรองเพื่อดูข้อมูลทั้งหมด</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            paginatedRequests.map((req) => (
                              <tr key={req.id} className="hover:bg-theme-surface-secondary/40 transition-colors">
                                <td className="py-3.5 px-3.5 align-top">
                                  <div className="font-bold text-xs text-theme-text hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors leading-snug">
                                    {req.title}
                                  </div>
                                  <div className="text-[11px] text-theme-text-muted flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="font-semibold text-theme-text-secondary whitespace-nowrap">{req.requester_name}</span>
                                    {req.position && <span className="opacity-75 whitespace-nowrap">• {req.position}</span>}
                                  </div>
                                  {req.team_members && req.team_members.length > 1 && (
                                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1 shrink-0">
                                        <Users size={10} />
                                        <span>คณะทำงาน {req.team_members.length} คน:</span>
                                      </span>
                                      <span className="text-[11px] text-theme-text-muted">
                                        {req.team_members.map(m => m.name.split(' ')[0]).join(', ')}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-3.5 align-top">
                                  {(() => {
                                    const { main, sub } = splitDepartmentName(req.department);
                                    return (
                                      <div className="flex flex-col">
                                        <div className="font-semibold text-xs text-theme-text flex items-center gap-1.5 leading-snug">
                                          <Building2 size={13} className="text-indigo-500 shrink-0" />
                                          <span className="whitespace-nowrap">{main}</span>
                                        </div>
                                        {sub && (
                                          <div className="text-[10.5px] text-theme-text-muted mt-0.5 pl-[19px] font-medium tracking-wide whitespace-nowrap">
                                            {sub}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="py-3.5 px-3.5 align-top text-center">
                                  <div className="inline-flex flex-col items-center">
                                    <span className="px-3 py-1 rounded-full font-mono font-bold text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                      {req.requested_seats} ที่นั่ง
                                    </span>
                                    {req.team_members && req.team_members.length > 0 && (
                                      <span className="text-[10px] text-theme-text-muted mt-1 whitespace-nowrap">
                                        {req.team_members.length} สิทธิ์ระบุชื่อ
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3.5 align-top text-right">
                                  <div className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                    {req.target_hours_saved_per_week} ชม./สัปดาห์
                                  </div>
                                  <div className="text-[10px] text-theme-text-muted mt-1 whitespace-nowrap font-mono">
                                    ~{Math.round(req.target_hours_saved_per_week * 4.2)} ชม./เดือน
                                  </div>
                                </td>
                                <td className="py-3.5 px-3.5 align-top text-center">
                                  <div className="inline-flex flex-col items-center">
                                    {req.status === 'approved_sandbox' ? (
                                      <>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 whitespace-nowrap shadow-2xs">
                                          <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                                          <span>อนุมัติ Sandbox</span>
                                        </span>
                                        <span className="text-[10px] text-theme-text-muted mt-1 whitespace-nowrap font-medium">
                                          ระยะเวลา 90 วัน
                                        </span>
                                      </>
                                    ) : req.status === 'waiting_list' ? (
                                      <>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 whitespace-nowrap shadow-2xs">
                                          <span>⏳</span>
                                          <span>Waiting List</span>
                                        </span>
                                        <span className="text-[10px] text-theme-text-muted mt-1 whitespace-nowrap font-medium">
                                          รอโควตารอบถัดไป
                                        </span>
                                      </>
                                    ) : req.status === 'rejected' ? (
                                      <>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 whitespace-nowrap shadow-2xs">
                                          <span>✕</span>
                                          <span>ปรับปรุงข้อเสนอ</span>
                                        </span>
                                        <span className="text-[10px] text-theme-text-muted mt-1 whitespace-nowrap font-medium">
                                          ส่งกลับแก้ไข
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 whitespace-nowrap shadow-2xs">
                                          <span>⏱️</span>
                                          <span>รอตรวจสอบ</span>
                                        </span>
                                        <span className="text-[10px] text-theme-text-muted mt-1 whitespace-nowrap font-medium">
                                          รอพิจารณา CoE
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3.5 align-top text-right">
                                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                    {isAdminOrManager && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedEvalRequestId(req.id);
                                          setActiveTab('evaluations');
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-theme-surface hover:bg-theme-surface-secondary border border-theme-border text-theme-text transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
                                        title="ประเมินเกณฑ์ 100 คะแนน (FM-PI-AI-001)"
                                      >
                                        ประเมินคะแนน
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReportRequestId(req.id);
                                        setActiveTab('reports');
                                      }}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95 flex items-center gap-1"
                                      title="บันทึกผลงานประจำเดือน (FM-002)"
                                    >
                                      <Send size={12} />
                                      <span>ส่งผลงาน</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* 2. Mobile Responsive Card Deck View (block md:hidden) */}
                    <div className="block md:hidden divide-y divide-theme-border/50">
                      {paginatedRequests.length === 0 ? (
                        <div className="p-8 text-center text-theme-text-muted space-y-2">
                          <Search size={24} className="mx-auto text-theme-text-muted/60" />
                          <div className="font-semibold text-theme-text text-xs">ไม่พบรายการคำขอ</div>
                          <p className="text-[11px] text-theme-text-muted">ลองปรับเปลี่ยนคำค้นหาหรือตัวกรอง</p>
                        </div>
                      ) : (
                        paginatedRequests.map((req) => (
                          <div key={req.id} className="p-4 space-y-3 hover:bg-theme-surface-secondary/30 transition-colors">
                            {/* Card Header: Dept & Status */}
                            <div className="flex items-start justify-between gap-2">
                              {(() => {
                                const { main, sub } = splitDepartmentName(req.department);
                                return (
                                  <div className="flex flex-col">
                                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-theme-text">
                                      <Building2 size={12} className="text-indigo-500 shrink-0" />
                                      <span>{main}</span>
                                    </div>
                                    {sub && (
                                      <span className="text-[10px] text-theme-text-muted pl-4 font-medium">
                                        {sub}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                              <div className="shrink-0 text-right">
                                {req.status === 'approved_sandbox' ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                      <CheckCircle2 size={10} className="text-emerald-500" />
                                      <span>อนุมัติ Sandbox</span>
                                    </span>
                                    <div className="text-[9.5px] text-theme-text-muted mt-0.5 font-medium">
                                      ระยะเวลา 90 วัน
                                    </div>
                                  </>
                                ) : req.status === 'waiting_list' ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                      <span>⏳</span>
                                      <span>Waiting List</span>
                                    </span>
                                    <div className="text-[9.5px] text-theme-text-muted mt-0.5 font-medium">
                                      รอรอบถัดไป
                                    </div>
                                  </>
                                ) : req.status === 'rejected' ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                      <span>✕</span>
                                      <span>ปรับปรุง</span>
                                    </span>
                                    <div className="text-[9.5px] text-theme-text-muted mt-0.5 font-medium">
                                      ส่งกลับแก้ไข
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                      <span>⏱️</span>
                                      <span>รอตรวจสอบ</span>
                                    </span>
                                    <div className="text-[9.5px] text-theme-text-muted mt-0.5 font-medium">
                                      รอพิจารณา CoE
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Card Title & Requester */}
                            <div>
                              <h4 className="font-bold text-sm text-theme-text leading-snug">
                                {req.title}
                              </h4>
                              <div className="text-xs text-theme-text-muted mt-1 flex items-center gap-1.5">
                                <span className="font-medium text-theme-text-secondary">{req.requester_name}</span>
                                {req.position && <span className="opacity-75">• {req.position}</span>}
                              </div>
                              {req.team_members && req.team_members.length > 1 && (
                                <div className="text-[11px] text-theme-text-muted mt-1">
                                  คณะทำงาน ({req.team_members.length} คน): {req.team_members.map(m => m.name.split(' ')[0]).join(', ')}
                                </div>
                              )}
                            </div>

                            {/* Card 2-Tile Stats */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="p-2.5 rounded-xl bg-theme-surface-secondary/60 border border-theme-border/50 text-center">
                                <div className="text-[10px] text-theme-text-muted">สิทธิ์ที่ขอ</div>
                                <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                  {req.requested_seats} ที่นั่ง
                                </div>
                              </div>
                              <div className="p-2.5 rounded-xl bg-theme-surface-secondary/60 border border-theme-border/50 text-center">
                                <div className="text-[10px] text-theme-text-muted">เป้าหมายลดเวลา</div>
                                <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  {req.target_hours_saved_per_week} ชม./สัปดาห์
                                </div>
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center gap-2 pt-1">
                              {isAdminOrManager && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEvalRequestId(req.id);
                                    setActiveTab('evaluations');
                                  }}
                                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-theme-surface hover:bg-theme-surface-secondary border border-theme-border text-theme-text text-center transition-all cursor-pointer shadow-2xs"
                                >
                                  ประเมินคะแนน
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setReportRequestId(req.id);
                                  setActiveTab('reports');
                                }}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-center transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1"
                              >
                                <Send size={12} />
                                <span>ส่งผลงาน</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 3. International Pagination Control Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t border-theme-border/60 bg-theme-surface-secondary/40 text-xs">
                      <div className="flex items-center gap-3 text-theme-text-muted">
                        <span>
                          แสดง <strong className="text-theme-text font-mono font-bold">{filteredRequests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> - <strong className="text-theme-text font-mono font-bold">{Math.min(currentPage * pageSize, filteredRequests.length)}</strong> จากทั้งหมด <strong className="text-theme-text font-mono font-bold">{filteredRequests.length}</strong> รายการ
                        </span>
                        <div className="h-4 w-px bg-theme-border/60 hidden sm:block" />
                        <div className="flex items-center gap-1.5">
                          <span className="hidden sm:inline">แถวละ:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="py-1 px-2 rounded-lg bg-theme-surface border border-theme-border text-theme-text font-mono font-bold text-xs focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                          >
                            <option value={5}>5 รายการ</option>
                            <option value={10}>10 รายการ</option>
                            <option value={20}>20 รายการ</option>
                          </select>
                        </div>
                      </div>

                      {/* Pagination Page Buttons */}
                      <div className="flex items-center gap-1 self-center sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-theme-surface hover:bg-theme-surface-secondary border border-theme-border text-theme-text disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                          title="หน้าแรก"
                        >
                          <ChevronsLeft size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-theme-surface hover:bg-theme-surface-secondary border border-theme-border text-theme-text disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                          title="หน้าก่อนหน้า"
                        >
                          <ChevronLeft size={14} />
                        </button>

                        {/* Page number buttons */}
                        <div className="flex items-center gap-1 px-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setCurrentPage(pageNum)}
                              className={cn(
                                "w-8 h-8 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center",
                                currentPage === pageNum
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "bg-theme-surface hover:bg-theme-surface-secondary border border-theme-border text-theme-text shadow-2xs"
                              )}
                            >
                              {pageNum}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-theme-surface hover:bg-theme-surface-secondary border border-theme-border text-theme-text disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                          title="หน้าถัดไป"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-theme-surface hover:bg-theme-surface-secondary border border-theme-border text-theme-text disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                          title="หน้าสุดท้าย"
                        >
                          <ChevronsRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
          </div>
        )}

        {/* Tab 2: Departmental AI Preset & Recommendation Engine */}
        {activeTab === 'presets' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
            <AiDepartmentPresetMatcher
              onApplyPreset={handleApplyDepartmentPreset}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          </div>
        )}

        {/* Tab 3: AI Intake Form (FM-PI-AI-001) */}
        {activeTab === 'request' && (
          <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-5">
            {/* Helper Banner to jump to Department Presets */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Compass size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-theme-text">
                    ไม่แน่ใจว่าหน่วยงานของคุณเหมาะกับ AI รุ่นไหน หรือควรกรอก AI JD อย่างไร?
                  </div>
                  <p className="text-[11px] text-theme-text-muted mt-0.5">
                    ดูชุดข้อมูลสำเร็จรูป (Preset) ของทั้ง 8 ฝ่ายงาน แล้วกดดึงข้อมูลมากรอกฟอร์มนี้ได้ในคลิกเดียว
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0"
              >
                🧭 เลือกจาก Preset รายฝ่าย →
              </button>
            </div>

            <div className="bg-theme-surface border border-theme-border/80 rounded-2xl shadow-sm p-6 sm:p-8">
              <div className="border-b border-theme-border/60 pb-5 mb-6">
                <h2 className="text-xl font-bold text-theme-text">
                  ขอใช้งาน AI
                </h2>
                <p className="text-sm text-theme-text-muted mt-1">
                  ช่องที่มี * ต้องกรอก คณะกรรมการ CoE จะใช้ข้อมูลนี้พิจารณาและแจ้งผลให้ทราบ
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    ['req-sec-1', 'ผู้ขอและรายชื่อ'],
                    ['req-sec-2', 'งานและผลที่คาดหวัง'],
                    ['req-sec-3', 'สรุปและตรวจสอบ'],
                    ['req-sec-4', 'ยืนยันความปลอดภัย'],
                  ].map(([id, label], i) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-xs font-medium text-theme-text transition-colors cursor-pointer"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold inline-flex items-center justify-center">{i + 1}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmitRequest} noValidate className="space-y-6">
                {/* Tier Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-theme-text">รูปแบบบริการ AI ที่ต้องการขอใช้งาน *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setFormTier('virtual_employee')}
                      className={cn(
                        "p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
                        formTier === 'virtual_employee'
                          ? "bg-indigo-500/10 border-indigo-500/60 shadow-xs"
                          : "bg-theme-surface-secondary/40 border-theme-border hover:bg-theme-surface-secondary"
                      )}
                    >
                      <input
                        type="radio"
                        name="formTier"
                        checked={formTier === 'virtual_employee'}
                        onChange={() => setFormTier('virtual_employee')}
                        className="mt-1 text-indigo-600"
                      />
                      <div>
                        <div className="font-bold text-xs text-theme-text flex items-center gap-1.5">
                          <Laptop size={14} className="text-indigo-500" />
                          <span>ทางเลือกที่ 1: Virtual AI Employee (พนักงานเสมือน)</span>
                        </div>
                        <p className="text-[11px] text-theme-text-muted mt-0.5 leading-relaxed">
                          สิทธิ์ Claude Team Premium สำหรับงานซับซ้อนเฉพาะทาง เสมือนว่าจ้างพนักงาน 1 คน มี JD กำกับดูแล
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setFormTier('general_web')}
                      className={cn(
                        "p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
                        formTier === 'general_web'
                          ? "bg-emerald-500/10 border-emerald-500/60 shadow-xs"
                          : "bg-theme-surface-secondary/40 border-theme-border hover:bg-theme-surface-secondary"
                      )}
                    >
                      <input
                        type="radio"
                        name="formTier"
                        checked={formTier === 'general_web'}
                        onChange={() => setFormTier('general_web')}
                        className="mt-1 text-emerald-600"
                      />
                      <div>
                        <div className="font-bold text-xs text-theme-text flex items-center gap-1.5">
                          <Sparkles size={14} className="text-emerald-500" />
                          <span>ทางเลือกที่ 2: AI สำหรับพนักงานทั่วไป (Web UI)</span>
                        </div>
                        <p className="text-[11px] text-theme-text-muted mt-0.5 leading-relaxed">
                          ใช้งานผ่าน Web Platform ภายในองค์กร รวมโมเดล ChatGPT, DeepSeek, Minimax แบบ Pay As You Go
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 1: requester, request details, people who will use AI */}
                <div id="req-sec-1" className="space-y-4 rounded-xl border border-theme-border/70 bg-theme-surface-secondary/30 p-5 scroll-mt-24">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0">1</span>
                    <div>
                      <h3 className="text-sm font-semibold text-theme-text">ผู้ขอและจำนวนสิทธิ์</h3>
                    </div>
                  </div>

                  {/* 1.1 Requester (one line) + supervisor (second line) */}
                  <div className="space-y-3 rounded-lg border border-theme-border/60 bg-theme-surface p-4">
                    <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">1.1 ข้อมูลผู้เสนอคำขอ</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-theme-text-muted mb-1">ชื่อผู้เสนอคำขอ</label>
                        <input
                          type="text"
                          value={sessionUser?.name || ''}
                          disabled
                          className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text opacity-80 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-theme-text-muted mb-1">ฝ่าย / แผนก *</label>
                        <input
                          type="text"
                          value={formDept}
                          onChange={(e) => setFormDept(e.target.value)}
                          placeholder="เช่น จัดซื้อ, บัญชี, HR"
                          className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-theme-text-muted mb-1">ตำแหน่ง</label>
                        <input
                          type="text"
                          value={formPosition}
                          onChange={(e) => setFormPosition(e.target.value)}
                          placeholder="เช่น Senior Officer"
                          className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-theme-text-muted">หัวหน้างาน * (พิมพ์รหัสพนักงาน แล้วกดค้นหา)</label>
                      <AiSupervisorPicker
                        value={formSupervisor}
                        onChange={setFormSupervisor}
                        blockedEmpIds={[sessionUser?.emp_id || sessionUser?.empId || '', ...formTeamMembers.map((m) => m.emp_id)].filter(Boolean)}
                        blockedEmails={[sessionUser?.email || '', ...formTeamMembers.map((m) => m.email || '')].filter(Boolean)}
                      />
                    </div>
                  </div>

                  {/* 1.2 Request details */}
                  <div className="space-y-3 rounded-lg border border-theme-border/60 bg-theme-surface p-4">
                    <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">1.2 รายละเอียดการขอใช้งาน</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-theme-text-muted mb-1">ระยะเวลาที่ขอใช้งาน *</label>
                        <select
                          value={formContractMonths}
                          onChange={(e) => setFormContractMonths(Number(e.target.value))}
                          className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                        >
                          <option value={1}>1 เดือน (ทดลองใช้งานระยะสั้น)</option>
                          <option value={3}>3 เดือน (รอบ Sandbox 90 วัน - แนะนำ)</option>
                          <option value={6}>6 เดือน (โครงการระยะกลาง)</option>
                          <option value={12}>12 เดือน (ประจำปี)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-theme-text-muted mb-1">สิทธิ์ที่ขอ (Seats) *</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={formSeats}
                          onChange={(e) => setFormSeats(Number(e.target.value))}
                          className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text font-mono font-bold focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* AI JD (Only for Virtual Employee) */}
                    {formTier === 'virtual_employee' && (
                      <div>
                        <label className="block text-xs font-medium text-theme-text-muted mb-1">
                          รายละเอียดลักษณะงานของ AI (Job Description - JD ของพนักงานเสมือน) *
                        </label>
                        <textarea
                          rows={2}
                          placeholder="ระบุหน้าที่ความรับผิดชอบของพนักงาน AI เสมือน เช่น ทำหน้าที่ตรวจร่างสัญญาเปรียบเทียบข้อกำหนด, ตรวจสอบ Action Items จากบันทึกการประชุม..."
                          value={formAiJd}
                          onChange={(e) => setFormAiJd(e.target.value)}
                          className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* 1.3 People who will use AI: search first, table once picked */}
                  <div className="space-y-3 rounded-lg border border-theme-border/60 bg-theme-surface p-4">
                    <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">1.3 รายชื่อผู้ที่จะขอใช้งาน</h4>
                    <AiTeamMemberPicker
                      totalSeats={formSeats}
                      members={formTeamMembers}
                      onChange={handleTeamMembersChange}
                      sessionUser={sessionUser}
                      allowPartialAllocation={formAllowPartialAllocation}
                      onAllowPartialChange={setFormAllowPartialAllocation}
                    />
                  </div>
                </div>

                {/* Section 2: tasks (as-is + expected AI help per task) */}
                <div id="req-sec-2" className="space-y-4 rounded-xl border border-theme-border/70 bg-theme-surface-secondary/30 p-5 scroll-mt-24">
                  <AiUseCaseEditor
                    tasks={effectiveTasks}
                    members={formTeamMembers}
                    onChange={setFormTasks}
                    functionOptions={AI_FUNCTION_OPTIONS}
                    showErrors={showFormErrors}
                    heading={
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0">2</span>
                        <div>
                          <h3 className="text-sm font-semibold text-theme-text">งานที่ทำอยู่ตอนนี้ และ AI จะช่วยอะไร</h3>
                          <p className="text-xs text-theme-text-muted mt-0.5">
                            ถ้างานเดียวกันมีหลายคนทำ ให้แยกเป็นงานต่อคน
                          </p>
                        </div>
                      </div>
                    }
                  />
                </div>

                {/* Section 3: summary + checks */}
                <div id="req-sec-3" className="space-y-4 rounded-xl border border-theme-border/70 bg-theme-surface-secondary/30 p-5 scroll-mt-24">
                  {/* Wide: heading + table label stacked on the left, value box spans both rows on the right.
                      Narrow: heading, value box, table label (so the label stays attached to the table). */}
                  <div className="@container grid grid-cols-1 @lg:grid-cols-[1fr_auto] gap-x-3 gap-y-2">
                    <div className="flex items-start gap-3 @lg:col-start-1 @lg:row-start-1">
                      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0">3</span>
                      <div>
                        <h3 className="text-sm font-semibold text-theme-text">สรุปภาระงานและผลที่คาดหวัง</h3>
                      </div>
                    </div>
                    <div className="flex @lg:col-start-2 @lg:row-start-1 @lg:row-span-2">
                      <AiValueEstimateBox tasks={effectiveTasks} members={formTeamMembers} />
                    </div>
                    <p className="text-xs font-semibold text-theme-text @lg:col-start-1 @lg:row-start-2">ภาระงานรายบุคคล</p>
                  </div>

                  <AiRequestSummary
                    members={formTeamMembers}
                    tasks={effectiveTasks}
                    errors={formValidation.errors}
                    warnings={formValidation.warnings}
                    showErrors={showFormErrors}
                  />

                  <div>
                    <label className="block text-xs font-medium text-theme-text mb-1">ผลลัพธ์อื่นที่คาดหวัง (ไม่บังคับ)</label>
                    <input
                      type="text"
                      placeholder="เช่น ลดข้อผิดพลาด, ส่งมอบงานไวขึ้น 2 เท่า"
                      value={formExpectedBenefits}
                      onChange={(e) => setFormExpectedBenefits(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Section 4: Data Governance & PDPA Check */}
                <div id="req-sec-4" className="space-y-4 rounded-xl border border-theme-border/70 bg-theme-surface-secondary/30 p-5 scroll-mt-24">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0">4</span>
                    <div>
                      <h3 className="text-sm font-semibold text-theme-text">ยืนยันความปลอดภัยของข้อมูล</h3>
                      <p className="text-xs text-theme-text-muted mt-0.5">ต้องติ๊กยืนยันก่อนจึงจะส่งคำขอได้</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="pdpa-check"
                        checked={formDataSafetyCertified}
                        onChange={(e) => setFormDataSafetyCertified(e.target.checked)}
                        className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="pdpa-check" className="text-xs text-theme-text cursor-pointer leading-relaxed">
                        <strong className="text-amber-600 dark:text-amber-400 block mb-0.5">ข้อตกลงก่อนส่งคำขอ:</strong>
                        ข้าพเจ้ารับรองว่าข้อมูลที่นำมาใช้งานร่วมกับระบบ AI จะไม่ประกอบด้วยข้อมูลส่วนบุคคลอ่อนไหว (PII) เช่น เลขบัตรประชาชน, เลขที่บัญชีธนาคาร หรือข้อมูลลับทางการค้า เว้นแต่จะได้ทำการ Masking ข้อมูลเรียบร้อยแล้วตามระเบียบปฏิบัติ WI-PI-AI-001
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('home')}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-theme-border hover:bg-theme-surface-tertiary transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRequest}
                    className="px-5 py-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                  >
                    {isSubmittingRequest ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>ส่งคำขอ</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 4: Monthly Deliverable & Impact Report (FM-PI-AI-002) */}
        {activeTab === 'reports' && (
          <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-5">
            <div className="bg-theme-surface border border-theme-border/80 rounded-2xl shadow-sm p-6 sm:p-8">
              <div className="border-b border-theme-border/60 pb-5 mb-6">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    FORM: FM-PI-AI-002
                  </span>
                  <span className="text-xs text-theme-text-muted">กำหนดส่งทุกวันที่ 25 ของทุกเดือน</span>
                </div>
                <h2 className="text-lg font-bold text-theme-text mt-2">
                  แบบฟอร์มรายงานผลสัมฤทธิ์ประจำเดือน (Monthly Impact & Deliverable Report)
                </h2>
                <p className="text-xs text-theme-text-muted mt-1">
                  สำหรับผู้ได้รับสิทธิ์ Sandbox ใช้รายงานผลผลิต ชิ้นงานที่สำเร็จ และเวลาที่ประหยัดได้จริง เพื่อพิจารณาต่ออายุสิทธิ์
                </p>
              </div>

              <form onSubmit={handleSubmitMonthlyReport} className="space-y-6">
                {/* Select Project & Month */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-theme-text mb-1">
                      เลือกโครงการ AI ที่ต้องการรายงานผล *
                    </label>
                    <select
                      required
                      value={activeReportRequestId}
                      onChange={(e) => setReportRequestId(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="">-- เลือกโครงการ AI ที่ได้รับอนุมัติสิทธิ์ --</option>
                      <optgroup label="✓ โครงการที่ได้รับสิทธิ์ Sandbox (Approved)">
                        {requests.filter(r => r.status === 'approved_sandbox' || r.status === 'completed').map(r => (
                          <option key={r.id} value={r.id}>
                            {r.title} ({r.department})
                          </option>
                        ))}
                      </optgroup>
                      {requests.some(r => r.status !== 'approved_sandbox' && r.status !== 'completed') && (
                        <optgroup label="⏳ โครงการสถานะอื่นๆ">
                          {requests.filter(r => r.status !== 'approved_sandbox' && r.status !== 'completed').map(r => (
                            <option key={r.id} value={r.id}>
                              {r.title} ({r.department})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-theme-text mb-1">
                      รอบเดือนที่รายงาน (Report Month) *
                    </label>
                    <input
                      type="month"
                      required
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Auto-Sync with Worklog Box */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Sparkles size={14} />
                      <span>ระบบเชื่อมโยงอัตโนมัติ (Worklog Smart Sync)</span>
                    </div>
                    <p className="text-[11px] text-theme-text-muted mt-0.5">
                      ดึงจำนวนวันที่มีการบันทึกงาน AI และคำนวณชั่วโมงที่ประหยัดได้จาก Daily Worklog ในเดือนนี้
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncingWorklog || !activeReportRequestId}
                    onClick={handleAutoSyncWorklog}
                    className="px-3.5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    {isSyncingWorklog ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>กำลังดึงข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={14} />
                        <span>⚡ ดึงข้อมูลจาก Worklog</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Measured Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-theme-text mb-1">
                      จำนวนวันที่เปิดใช้งานจริงในเดือนนี้ (Active Days) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="31"
                      required
                      value={reportActiveDays}
                      onChange={(e) => setReportActiveDays(Number(e.target.value))}
                      className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-theme-text mb-1">
                      เวลาที่ประหยัดได้จริง (Actual Hours Saved/สัปดาห์) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      value={reportActualHoursSaved}
                      onChange={(e) => setReportActualHoursSaved(Number(e.target.value))}
                      className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text font-mono font-bold text-emerald-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-theme-text mb-1">
                      ความเร็วในการส่งมอบงาน (Turnaround Time)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น เดิมใช้เวลา 3 วัน ลดเหลือ 2 ชั่วโมง"
                      value={reportTurnaround}
                      onChange={(e) => setReportTurnaround(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-theme-text mb-1">
                      การลดข้อผิดพลาด (Error Rate Reduction)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ลดการแก้งานซ้ำซ้อนลง 80%"
                      value={reportErrorRate}
                      onChange={(e) => setReportErrorRate(e.target.value)}
                      className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Key Deliverables */}
                <div>
                  <label className="block text-xs font-medium text-theme-text mb-1">
                    ชิ้นงานสำคัญที่สำเร็จโดยมี AI ช่วยเหลือ (Key Deliverables) *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="ระบุสิ่งที่ส่งมอบได้จริง เช่น ตรวจสอบสัญญาไปแล้ว 15 ฉบับ, สร้าง Agent สรุปข่าวสารอัตโนมัติ..."
                    value={reportDeliverables}
                    onChange={(e) => setReportDeliverables(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-theme-border hover:bg-theme-surface-tertiary transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="px-5 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5"
                  >
                    {isSubmittingReport ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>บันทึกรายงานประจำเดือน (Submit FM-002)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Previous Reports History for activeReportRequestId */}
              {(() => {
                const projectReports = reports.filter(r => r.request_id === activeReportRequestId);
                const req = requests.find(r => r.id === activeReportRequestId);
                return (
                  <div className="mt-8 pt-6 border-t border-theme-border/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                        <Award size={14} className="text-amber-500" />
                        <span>ประวัติรายงานผลสัมฤทธิ์ย้อนหลัง: {req?.title || 'โครงการ AI'}</span>
                      </h3>
                      <span className="text-xs text-theme-text-muted font-mono">
                        {projectReports.length} ฉบับ
                      </span>
                    </div>

                    {projectReports.length === 0 ? (
                      <div className="p-6 rounded-xl border border-dashed border-theme-border text-center text-xs text-theme-text-muted bg-theme-surface-secondary/20">
                        ยังไม่มีประวัติการส่งรายงานย้อนหลังสำหรับโครงการนี้ — ข้อมูลจะปรากฏที่นี่หลังบันทึกรายงานฉบับแรก
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {projectReports.map(rep => (
                          <div
                            key={rep.id}
                            className="p-4 rounded-xl border border-theme-border/70 bg-theme-surface-secondary/30 space-y-2 hover:border-theme-border transition-all"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border/40 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                  รอบเดือน {rep.report_month}
                                </span>
                                <span className="text-xs text-theme-text-muted">
                                  ส่งเมื่อ {new Date(rep.created_at).toLocaleDateString('th-TH')}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="font-mono text-emerald-500 font-bold">
                                  +{rep.actual_hours_saved_per_week} ชม./สัปดาห์
                                </span>
                                <span className="text-theme-text-muted font-mono">
                                  {rep.active_days} วันทำการ
                                </span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                  rep.coe_decision === 'scale' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                                  rep.coe_decision === 'maintain' ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20" :
                                  "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                )}>
                                  CoE: {rep.coe_decision}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-theme-text leading-relaxed">
                              <strong className="text-theme-text-secondary">ชิ้นงานที่ส่งมอบ:</strong> {rep.key_deliverables}
                            </div>
                            {rep.turnaround_time_reduction && (
                              <div className="text-[11px] text-theme-text-muted">
                                <strong>Turnaround:</strong> {rep.turnaround_time_reduction}
                              </div>
                            )}
                            {rep.coe_feedback && (
                              <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border/60 text-xs text-indigo-600 dark:text-indigo-300">
                                <strong>ความเห็น CoE:</strong> {rep.coe_feedback}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab 3: CoE Rubric Evaluation (100 Points) */}
        {activeTab === 'evaluations' && !isAdminOrManager && (
          <div className="max-w-xl mx-auto px-4 py-16 text-center animate-fade-in">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-theme-text">หน้านี้สำหรับผู้ดูแล (CoE) เท่านั้น</h2>
            <p className="mt-1 text-sm text-theme-text-muted">คุณดูสถานะและผลการพิจารณาคำขอของคุณได้ที่หน้าแรก</p>
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="mt-5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              กลับหน้าแรก
            </button>
          </div>
        )}

        {activeTab === 'evaluations' && isAdminOrManager && (
          <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in space-y-6">
            <div className="bg-theme-surface border border-theme-border/80 rounded-2xl shadow-sm p-6 sm:p-8">
              <div className="border-b border-theme-border/60 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      CoE SCORING RUBRIC
                    </span>
                    <span className="text-xs text-theme-text-muted">เกณฑ์ผ่านการคัดเลือก 70/100 คะแนน</span>
                  </div>
                  <h2 className="text-lg font-bold text-theme-text mt-2">
                    เครื่องมือกลั่นกรองคำขอและประเมินคะแนน 4 มิติ
                  </h2>
                  <p className="text-xs text-theme-text-muted mt-1">
                    ประเมินคำขอตามเกณฑ์มาตรฐานเพื่ออนุมัติสิทธิ์ Sandbox 90 วัน หรือจัดเข้า Waiting List
                  </p>
                </div>

                {/* Target Request Selector */}
                <div className="w-full sm:w-72">
                  <label className="block text-[11px] font-medium text-theme-text-muted mb-1">เลือกคำขอที่จะประเมิน</label>
                  <select
                    value={activeEvalRequestId}
                    onChange={(e) => setSelectedEvalRequestId(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <optgroup label="⏱️ คำขอรอพิจารณา (Pending Review)">
                      {requests.filter(r => r.status === 'pending_review').map(r => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.department})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="✓ คำขอที่ประเมินแล้ว (Evaluated)">
                      {requests.filter(r => r.status !== 'pending_review').map(r => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.department})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Selected Request Summary Banner */}
              {(() => {
                const currentReq = requests.find(r => r.id === activeEvalRequestId);
                if (!currentReq) return null;
                const existingEval = evaluations.find(e => e.request_id === currentReq.id);
                return (
                  <div className="p-4 rounded-xl bg-theme-surface-secondary/70 border border-theme-border/60 mb-6 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-theme-text">{currentReq.title}</div>
                        <div className="text-xs text-theme-text-muted mt-0.5">
                          ผู้ยื่น: {currentReq.requester_name} ({currentReq.department}) • สิทธิ์ที่ขอ: {currentReq.requested_seats} Seats
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-indigo-500">
                          Target: {currentReq.target_hours_saved_per_week} ชม./สัปดาห์
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-theme-text-secondary bg-theme-surface p-2.5 rounded-lg border border-theme-border/40">
                      <strong>As-Is Process:</strong> {currentReq.as_is_process}
                    </div>
                    {existingEval ? (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 size={15} />
                          <span>
                            คำขอนี้เคยได้รับการประเมินแล้ว: <strong>{existingEval.total_score}/100 คะแนน</strong> (มติ: {
                              existingEval.decision === 'approve_sandbox' ? 'อนุมัติ Sandbox 90 วัน' :
                              existingEval.decision === 'waiting_list' ? 'รอคิว Waiting List' :
                              existingEval.decision === 'revision_needed' ? 'ส่งกลับปรับแก้' : 'ไม่อนุมัติ'
                            })
                          </span>
                        </div>
                        <span className="text-[11px] text-theme-text-muted">
                          ประเมินเมื่อ {new Date(existingEval.evaluated_at).toLocaleDateString('th-TH')}
                        </span>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
                        <Clock size={14} />
                        <span>คำขอนี้ยังไม่เคยได้รับการประเมินคะแนน (กำลังรอการพิจารณารอบแรก)</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 4 Rubric Sliders & Score Card Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sliders Container */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Dimension 1: Problem Clarity */}
                  <div className="p-4 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-theme-text">1. ความชัดเจนของปัญหา As-Is (เต็ม 25)</span>
                      <span className="font-mono text-sm font-bold text-indigo-500">{evalScoreClarity} / 25</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="25"
                      value={evalScoreClarity}
                      onChange={(e) => setEvalScoreClarity(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-theme-surface-tertiary rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-theme-text-muted mt-1">
                      <span>คลุมเครือ (0-9)</span>
                      <span>ปัญหาทั่วไป (10-19)</span>
                      <span>ระบุคอขวดชัดเจน (20-25)</span>
                    </div>
                  </div>

                  {/* Dimension 2: Business Value & ROI */}
                  <div className="p-4 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-theme-text">2. ความคุ้มค่าทางธุรกิจและ ROI (เต็ม 35)</span>
                      <span className="font-mono text-sm font-bold text-indigo-500">{evalScoreRoi} / 35</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="35"
                      value={evalScoreRoi}
                      onChange={(e) => setEvalScoreRoi(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-theme-surface-tertiary rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-theme-text-muted mt-1">
                      <span>ไม่ชัดเจน (0-19)</span>
                      <span>ลด 2-4 ชม./สัปดาห์ (20-29)</span>
                      <span>ลด &gt; 5 ชม. / มีผลกระทบสูง (30-35)</span>
                    </div>
                  </div>

                  {/* Dimension 3: Readiness */}
                  <div className="p-4 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-theme-text">3. ความพร้อมของบุคลากรและข้อมูล (เต็ม 20)</span>
                      <span className="font-mono text-sm font-bold text-indigo-500">{evalScoreReadiness} / 20</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={evalScoreReadiness}
                      onChange={(e) => setEvalScoreReadiness(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-theme-surface-tertiary rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-theme-text-muted mt-1">
                      <span>ยังไม่มีข้อมูล (0-7)</span>
                      <span>ต้องเตรียมเพิ่ม (8-14)</span>
                      <span>ข้อมูลพร้อมทดสอบทันที (15-20)</span>
                    </div>
                  </div>

                  {/* Dimension 4: Data Safety */}
                  <div className="p-4 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-theme-text">4. ความปลอดภัยข้อมูลและ PDPA (เต็ม 20)</span>
                      <span className="font-mono text-sm font-bold text-indigo-500">{evalScoreSafety} / 20</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={evalScoreSafety}
                      onChange={(e) => setEvalScoreSafety(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-theme-surface-tertiary rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-theme-text-muted mt-1">
                      <span>เสี่ยงข้อมูลรั่ว (0-11)</span>
                      <span>มี Masking แผนชัด (12-17)</span>
                      <span>Internal/Public ปลอดภัย (18-20)</span>
                    </div>
                  </div>
                </div>

                {/* Total Score & Decision Card */}
                <div className="bg-theme-surface-secondary/50 border border-theme-border/80 rounded-2xl p-6 flex flex-col justify-between text-center space-y-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                      คะแนนรวมสุทธิ
                    </span>
                    <div className="text-6xl font-black text-indigo-600 dark:text-indigo-400 font-mono my-2 tracking-tight">
                      {evalTotalScore}
                    </div>
                    <div className="text-xs text-theme-text-muted">
                      จากคะแนนเต็ม 100 คะแนน
                    </div>

                    <div className="mt-4">
                      {evalTotalScore >= 70 ? (
                        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle2 size={16} />
                          <span>✓ ผ่านเกณฑ์การคัดเลือก (≥ 70)</span>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5">
                          <AlertCircle size={16} />
                          <span>✕ ไม่ผ่านเกณฑ์ (ต้องปรับปรุง)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Decision Selector */}
                  <div className="text-left space-y-3">
                    <label className="block text-xs font-bold text-theme-text">มติของคณะกรรมการ CoE *</label>
                    <select
                      value={evalDecision}
                      onChange={(e) => setEvalDecision(e.target.value as 'approve_sandbox' | 'waiting_list' | 'revision_needed' | 'reject')}
                      className="w-full text-xs py-2 px-3 rounded-lg bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 font-bold"
                    >
                      <option value="approve_sandbox">✓ อนุมัติสิทธิ์เข้า Sandbox (90 วัน)</option>
                      <option value="waiting_list">⏳ ผ่านเกณฑ์แต่โควตาเต็ม (Waiting List)</option>
                      <option value="revision_needed">📝 ส่งกลับเพื่อปรับแก้ข้อเสนอ</option>
                      <option value="reject">✕ ไม่อนุมัติคำขอ</option>
                    </select>

                    <textarea
                      rows={2}
                      placeholder="บันทึกข้อเสนอแนะของกรรมการ..."
                      value={evalNotes}
                      onChange={(e) => setEvalNotes(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                    />

                    <button
                      type="button"
                      disabled={isSubmittingEval || !activeEvalRequestId}
                      onClick={handleSubmitEvaluation}
                      className="w-full py-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5"
                    >
                      {isSubmittingEval ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>ยืนยันผลการประเมิน (Submit CoE Decision)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Knowledge & Governance Library (WI-PI-AI-001) */}
        {activeTab === 'governance' && (
          <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in space-y-6">
            <div className="bg-theme-surface border border-theme-border/80 rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">
              <div className="border-b border-theme-border/60 pb-5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    SOP: WI-PI-AI-001
                  </span>
                  <span className="text-xs text-theme-text-muted">Enterprise AI Work Instruction</span>
                </div>
                <h2 className="text-lg font-bold text-theme-text mt-2">
                  ระเบียบปฏิบัติและแนวทางกำกับดูแลการใช้งาน AI ในองค์กร
                </h2>
                <p className="text-xs text-theme-text-muted mt-1">
                  คู่มือมาตรฐานความปลอดภัย การจัดสรรสิทธิ์ และการปฏิบัติตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล (PDPA)
                </p>
              </div>

              {/* 3 Pillars of AI Governance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-theme-text">Sandbox 90 วัน (Seed Pool)</h4>
                  <p className="text-[11px] text-theme-text-muted leading-relaxed">
                    สิทธิ์เริ่มต้นจะถูกจัดสรรในกลุ่ม Seed Pool เป็นเวลา 90 วัน เพื่อทดสอบความคุ้มค่าจริงตามตัวชี้วัดที่ระบุใน FM-001
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-theme-text">รายงานผลสัมฤทธิ์รายเดือน</h4>
                  <p className="text-[11px] text-theme-text-muted leading-relaxed">
                    ส่งแบบฟอร์ม FM-002 ทุกวันที่ 25 ของเดือน หากไม่มีการใช้งานต่อเนื่องเกิน 2 รอบเดือน CoE มีสิทธิ์เรียกคืนสิทธิ์ (Revoke)
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-theme-text">Zero Data Retention & PDPA</h4>
                  <p className="text-[11px] text-theme-text-muted leading-relaxed">
                    โมเดล Enterprise จะไม่นำข้อมูลองค์กรไปเทรนโมเดลต่อ (Opt-out) และต้องทำการ Masking ข้อมูลส่วนบุคคลก่อนส่งเสมอ
                  </p>
                </div>
              </div>

              {/* Package Comparison Table ($20 vs $60) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  <span>ตารางเปรียบเทียบสิทธิประโยชน์ของแพ็กเกจลิขสิทธิ์</span>
                </h3>

                <div className="overflow-x-auto border border-theme-border/60 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-theme-border bg-theme-surface-secondary text-theme-text-muted font-semibold">
                        <th className="py-2.5 px-4">คุณสมบัติการกำกับดูแล</th>
                        <th className="py-2.5 px-4 text-center">Claude Pro ($20)</th>
                        <th className="py-2.5 px-4 text-center">Claude Team ($25)</th>
                        <th className="py-2.5 px-4 text-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                          Claude Enterprise ($60) ★
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/40">
                      <tr>
                        <td className="py-2.5 px-4 font-medium">Context Window</td>
                        <td className="py-2.5 px-4 text-center">200K Tokens</td>
                        <td className="py-2.5 px-4 text-center">200K Tokens</td>
                        <td className="py-2.5 px-4 text-center font-bold text-indigo-500 bg-indigo-500/5">500K Tokens</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium">Single Sign-On (SSO / SCIM)</td>
                        <td className="py-2.5 px-4 text-center text-rose-500">✕</td>
                        <td className="py-2.5 px-4 text-center text-rose-500">✕</td>
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-500 bg-indigo-500/5">✓ SAML 2.0</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium">Role-based Access & Audit Logs</td>
                        <td className="py-2.5 px-4 text-center text-rose-500">✕</td>
                        <td className="py-2.5 px-4 text-center text-amber-500">จำกัด</td>
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-500 bg-indigo-500/5">✓ Export Log ละเอียด</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium">Training on Customer Data</td>
                        <td className="py-2.5 px-4 text-center text-amber-500">ต้อง Opt-out</td>
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-500">ไม่นำไปเทรน</td>
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-500 bg-indigo-500/5">ไม่นำไปเทรน 100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data Safety Rules Card */}
              <div className="p-5 rounded-xl bg-theme-surface-secondary/50 border border-theme-border space-y-3">
                <h4 className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                  <ShieldAlert size={15} className="text-amber-500" />
                  <span>ประเภทข้อมูลที่ห้ามนำเข้าสู่ระบบ AI โดยเด็ดขาด (Prohibited Data)</span>
                </h4>
                <ul className="text-xs text-theme-text-secondary space-y-1.5 list-disc list-inside">
                  <li>รหัสผ่าน, API Keys, Private Keys, Credentials ในระบบทุกประเภท</li>
                  <li>ข้อมูลส่วนบุคคลตามกฎหมาย PDPA เช่น เลขบัตรประชาชน, ข้อมูลประวัติสุขภาพ, สแกนลายนิ้วมือ</li>
                  <li>ความลับทางการค้าขั้นสูงสุด (Trade Secrets) เช่น ข้อมูลดีล M&A หรือตัวเลขการประมูลงานที่ยังไม่เปิดเผย</li>
                </ul>
              </div>

              {/* Core Values: Transform Me & Transform Us 3Ts Framework */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/25 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-500">
                      Corporate Philosophy & Best Practices
                    </span>
                    <h4 className="text-sm font-bold text-theme-text mt-0.5">
                      กรอบขับเคลื่อนคุณค่าองค์กร: Transform Me • Transform Us • 3Ts
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    SOP Best Practices
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-theme-surface/70 border border-theme-border/60 space-y-1.5">
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <span>🌱 Transform Me</span>
                    </div>
                    <div className="text-[11px] font-semibold text-theme-text">ยกระดับศักยภาพตนเอง (Self-Empowerment)</div>
                    <p className="text-[11px] text-theme-text-muted leading-relaxed">
                      เปิดโอกาสให้พนักงานทุกคนฝึกใช้ AI ในการทำงานจริง เพิ่มขีดความสามารถเฉพาะทาง (Upskilling) และลดเวลาทำงานประจำซ้ำซ้อน
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-theme-surface/70 border border-theme-border/60 space-y-1.5">
                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <span>🤝 Transform Us</span>
                    </div>
                    <div className="text-[11px] font-semibold text-theme-text">แบ่งปันข้ามหน่วยธุรกิจ (BU Sharing & KM Days)</div>
                    <p className="text-[11px] text-theme-text-muted leading-relaxed">
                      การเรียนรู้ร่วมกันทั้งองค์กร แต่ละ BU นำ Use Case จริงมาถ่ายทอดข้ามแผนก เพื่อสร้างวัฒนธรรม Continuous Improvement & Self-Learning ที่ยั่งยืน
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-theme-surface/70 border border-theme-border/60 space-y-1.5">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <span>🛡️ 3Ts Foundation</span>
                    </div>
                    <div className="text-[11px] font-semibold text-theme-text">Trust • Transparency • Transformation</div>
                    <p className="text-[11px] text-theme-text-muted leading-relaxed">
                      <strong>Trust:</strong> ปลอดภัย ไร้กังวลข้อมูลรั่วไหล • <strong>Transparency:</strong> ตรวจสอบสิทธิ์และเวลาที่ลดได้จริง • <strong>Transformation:</strong> ยกระดับกระบวนการทำงานทั้งองค์กร
                    </p>
                  </div>
                </div>

                {/* Seat Rotation & Supplier Billing Policy */}
                <div className="p-4 rounded-xl bg-theme-surface/50 border border-theme-border/60 text-xs text-theme-text-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
                  <div className="space-y-0.5">
                    <strong className="text-theme-text block">รอบการตัดจ่ายและการจัดสรรสิทธิ์ (Seat Rotation & Billing Cycle):</strong>
                    <span className="text-[11px] text-theme-text-muted">
                      ระบบตัดรอบจัดสรรสิทธิ์ทุกวันที่ 15 ของเดือนตามรอบวางบิล Supplier หากหน่วยงานใดไม่มีการใช้งานต่อเนื่อง สิทธิ์จะถูกโอนย้ายไปยัง Waiting List อัตโนมัติ
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-theme-surface-secondary border border-theme-border shrink-0 text-center">
                    รอบตัดจ่ายทุกวันที่ 15
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Onboarding Tour Modal */}
        <AiLifecycleOnboardingModal
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setIsOnboardingOpen(false);
          }}
          initialStepIndex={onboardingInitialStep}
        />
      </div>
    </AppLayout>
  );
}
