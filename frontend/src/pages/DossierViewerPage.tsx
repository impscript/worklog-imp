import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Lock,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Briefcase,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatThaiDateRange } from '../lib/appraisalPromptStandards';
import MemberEditorialDossier from '../components/dossier/MemberEditorialDossier';
import DossierEditorModal from '../components/dossier/DossierEditorModal';
import type {
  MemberAppraisalSummary,
  MemberDossierJd,
  MemberDossierProfile,
  MemberDossierStats,
  MemberProjectAggregate,
  UserDossierConfig,
} from '../lib/dossier-types';

const CURRENT_DOSSIER_YEAR = new Date().getFullYear();
const NON_PROJECT_REGEX = /^(งานประจำ|งานทั่วไป|ทั่วไป|others?|support|ma\b|meeting|ประชุม|admin|ธุรการ|training|อบรม|leave|ลา|internal|hr\s*-)/i;

function isSubstantiveProject(agg: MemberProjectAggregate): boolean {
  if (NON_PROJECT_REGEX.test(agg.name.trim())) return false;
  return agg.taskCount >= 3 || agg.totalHours >= 8;
}

function cleanMilestoneText(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .split('\n')[0]
    .replace(/\[.*?\]/g, '')
    .replace(/^[\s:–—-]+/, '')
    .trim();
}

function parseAppraisalRow(
  row: Record<string, unknown>,
  cycle: 'half_year' | 'end_year'
): MemberAppraisalSummary {
  const rawData =
    typeof row.analysis_data === 'string'
      ? (() => {
          try {
            return JSON.parse(row.analysis_data) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : row.analysis_data && typeof row.analysis_data === 'object'
        ? (row.analysis_data as Record<string, unknown>)
        : {};

  const overallScore =
    typeof rawData.overall_score === 'number'
      ? rawData.overall_score
      : typeof row.score === 'number'
        ? row.score
        : 0;

  const level =
    typeof rawData.level === 'string' && rawData.level.trim()
      ? rawData.level
      : overallScore >= 85
        ? 'ดีเยี่ยม'
        : overallScore >= 75
          ? 'ดีมาก'
          : overallScore >= 60
            ? 'มาตรฐาน'
            : 'ต้องพัฒนา';

  const scores =
    rawData.scores && typeof rawData.scores === 'object'
      ? (rawData.scores as Record<string, Record<string, unknown>>)
      : {};
  const fallbackPillar = Math.min(20, Math.max(0, Number(((overallScore / 100) * 20).toFixed(1))));
  const readScore = (k: string) =>
    typeof scores[k]?.score === 'number' ? (scores[k].score as number) : fallbackPillar;

  const stats =
    rawData.worklog_stats && typeof rawData.worklog_stats === 'object'
      ? (rawData.worklog_stats as Record<string, unknown>)
      : null;

  const rawPeriod =
    typeof rawData.period === 'string' && rawData.period.trim()
      ? rawData.period
      : `${String(row.start_date || '-')} ถึง ${String(row.end_date || '-')}`;

  const modelName =
    typeof rawData.ai_model === 'string' && rawData.ai_model.trim()
      ? rawData.ai_model
      : typeof row.engine_model === 'string' && row.engine_model.trim()
        ? row.engine_model
        : 'AI Standard';

  const topStrengths = Array.isArray(rawData.top_strengths)
    ? (rawData.top_strengths as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];

  return {
    id: String(row.id || ''),
    cycle,
    overallScore,
    level,
    confidence: typeof rawData.confidence === 'string' ? rawData.confidence : 'Medium',
    period: formatThaiDateRange(rawPeriod),
    modelName,
    executiveSummary:
      typeof rawData.executive_summary === 'string' ? rawData.executive_summary : undefined,
    coveragePct: typeof stats?.coverage_pct === 'number' ? (stats.coverage_pct as number) : null,
    loggedDays: typeof stats?.logged_days === 'number' ? (stats.logged_days as number) : null,
    businessDays: typeof stats?.business_days === 'number' ? (stats.business_days as number) : null,
    shareToken: typeof row.share_token === 'string' ? row.share_token : null,
    isPublic: Boolean(row.is_public),
    topStrengths,
    pillars: {
      quantity: readScore('quantity'),
      quality: readScore('quality'),
      learning: readScore('learning'),
      accountability: readScore('accountability'),
      proactiveness: readScore('proactiveness'),
    },
  };
}

export default function DossierViewerPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const rawSlug = (slug || '').trim();
  let decodedSlug = rawSlug;
  try {
    decodedSlug = decodeURIComponent(rawSlug);
  } catch {
    // fallback to raw
  }
  const currentSlug = decodedSlug.toLowerCase().trim();
  const isChatchawan =
    !currentSlug ||
    currentSlug === 'chatchawan' ||
    currentSlug === '10005208' ||
    currentSlug === 'portfolio' ||
    currentSlug.includes('chatchawan');

  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Dynamic Member State
  const [member, setMember] = useState<MemberDossierProfile | null>(null);
  const [memberStats, setMemberStats] = useState<MemberDossierStats>({
    year: CURRENT_DOSSIER_YEAR,
    totalHours: 0,
    totalDays: 0,
    totalTasks: 0,
    projects: [],
    supportProjectsCount: 0,
    projectSummaries: [],
    recentLogs: [],
  });
  const [memberJd, setMemberJd] = useState<MemberDossierJd | null>(null);
  const [dossierConfig, setDossierConfig] = useState<UserDossierConfig | null>(null);
  const [halfYearAppraisal, setHalfYearAppraisal] = useState<MemberAppraisalSummary | null>(null);
  const [endYearAppraisal, setEndYearAppraisal] = useState<MemberAppraisalSummary | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Keyboard shortcut listener to forward Cmd+P / Ctrl+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (isChatchawan) {
          try {
            iframeRef.current?.contentWindow?.focus();
            iframeRef.current?.contentWindow?.print();
          } catch {
            window.print();
          }
        } else {
          window.print();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatchawan]);

  useEffect(() => {
    async function initDossier() {
      setIsLoading(true);
      setNotFound(false);

      let ownerSession = false;
      let sessionData: Record<string, unknown> | null = null;
      try {
        const sessionStr = localStorage.getItem('worklog_session');
        if (sessionStr) {
          sessionData = JSON.parse(sessionStr) as Record<string, unknown>;
          const sEmail = typeof sessionData.email === 'string' ? sessionData.email : '';
          if (
            sessionData.empId === '10005208' ||
            sessionData.role === 'admin' ||
            sessionData.role === 'super_admin' ||
            sEmail.includes('chatchawan')
          ) {
            ownerSession = true;
          }
        }
      } catch {
        // invalid session
      }

      if (isChatchawan) {
        setIsOwner(ownerSession);
        try {
          const { data, error } = await supabase
            .from('tb_system_config')
            .select('config_value')
            .eq('config_key', 'chatchawan_dossier_visibility')
            .maybeSingle();

          if (!error && data?.config_value) {
            setIsPublic(data.config_value === 'public');
          } else if (ownerSession) {
            const localVis = localStorage.getItem('chatchawan_dossier_visibility');
            setIsPublic(localVis !== 'private');
          } else {
            setIsPublic(false);
          }
        } catch {
          setIsPublic(ownerSession);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Dynamic Member Lookup for any user in the company
      try {
        let foundUser: MemberDossierProfile | null = null;

        const { data: byNickname } = await supabase
          .from('users')
          .select('*')
          .or(`nickname.ilike.${currentSlug},nickname.ilike.${decodedSlug}`)
          .maybeSingle();

        if (byNickname) {
          foundUser = byNickname as MemberDossierProfile;
        } else {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentSlug);
          let query = supabase.from('users').select('*');
          if (isUuid) {
            query = query.or(`id.eq.${currentSlug},emp_id.eq.${currentSlug}`);
          } else {
            query = query.or(
              `emp_id.eq.${currentSlug},email.ilike.${currentSlug}%,full_name.ilike.%${currentSlug}%`
            );
          }
          const { data: byOther } = await query.maybeSingle();
          if (byOther) foundUser = byOther as MemberDossierProfile;
        }

        if (!foundUser && sessionData) {
          const sEmail = typeof sessionData.email === 'string' ? sessionData.email.toLowerCase() : '';
          const sNick = typeof sessionData.nickname === 'string' ? sessionData.nickname : '';
          const sName = typeof sessionData.name === 'string' ? sessionData.name : '';
          const matchSession =
            sessionData.empId === currentSlug ||
            sEmail.startsWith(currentSlug) ||
            sNick.toLowerCase() === currentSlug ||
            sNick === decodedSlug ||
            sName.toLowerCase().includes(currentSlug);

          if (matchSession) {
            foundUser = {
              id: String(sessionData.id || ''),
              full_name: String(sessionData.name || sessionData.full_name || currentSlug),
              nickname: sNick || undefined,
              position: typeof sessionData.position === 'string' ? sessionData.position : undefined,
              employee_level:
                typeof sessionData.employee_level === 'string' ? sessionData.employee_level : undefined,
              company_name:
                typeof sessionData.company_name === 'string' ? sessionData.company_name : undefined,
              department:
                typeof sessionData.department === 'string' ? sessionData.department : undefined,
              role_start_date:
                typeof sessionData.role_start_date === 'string' ? sessionData.role_start_date : undefined,
              manager_name:
                typeof sessionData.manager_name === 'string' ? sessionData.manager_name : undefined,
              email: sEmail || undefined,
              emp_id: typeof sessionData.empId === 'string' ? sessionData.empId : undefined,
            };
          }
        }

        if (!foundUser) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setMember(foundUser);
        const isUserOwner = Boolean(
          sessionData && (sessionData.id === foundUser.id || sessionData.role === 'admin')
        );
        setIsOwner(isUserOwner);

        let appraisalQuery = supabase
          .from('tb_ai_individual_analysis')
          .select(
            'id, template_id, score, analysis_data, start_date, end_date, engine_model, share_token, is_public, analysis_date, created_at'
          )
          .eq('user_id', foundUser.id)
          .order('analysis_date', { ascending: false, nullsFirst: false })
          .limit(20);
        if (!isUserOwner) {
          appraisalQuery = appraisalQuery.eq('is_public', true);
        }

        const [logsRes, appraisalsRes, jdRes, dossierRes] = await Promise.allSettled([
          supabase
            .from('col_worklog')
            .select('id, work_date, total_hours, project_name, action_name, description')
            .eq('user_id', foundUser.id)
            .gte('work_date', `${CURRENT_DOSSIER_YEAR}-01-01`)
            .lte('work_date', `${CURRENT_DOSSIER_YEAR}-12-31`)
            .order('work_date', { ascending: false }),
          appraisalQuery,
          supabase
            .from('tb_user_jd')
            .select('position_name, jd_text, key_responsibilities')
            .eq('user_id', foundUser.id)
            .maybeSingle(),
          supabase
            .from('tb_user_dossier')
            .select('*')
            .eq('user_id', foundUser.id)
            .maybeSingle(),
        ]);

        // Dossier custom config (gracefully falls back to null if migration not yet applied)
        if (dossierRes.status === 'fulfilled' && dossierRes.value.data && !dossierRes.value.error) {
          const cfg = dossierRes.value.data as UserDossierConfig;
          setDossierConfig(cfg);
          setIsPublic(cfg.is_public);
        } else {
          setDossierConfig(null);
          setIsPublic(true);
        }

        // JD
        if (jdRes.status === 'fulfilled' && jdRes.value.data) {
          const jdRow = jdRes.value.data as {
            position_name?: string;
            jd_text?: string;
            key_responsibilities?: Array<{ category?: string; weight?: number; weight_percentage?: number }>;
          };
          setMemberJd({
            position_name: jdRow.position_name,
            jd_text: jdRow.jd_text,
            key_responsibilities: Array.isArray(jdRow.key_responsibilities)
              ? jdRow.key_responsibilities
                  .filter((r) => typeof r.category === 'string' && r.category.trim().length > 0)
                  .map((r) => ({
                    category: String(r.category).trim(),
                    weight: Number(r.weight ?? r.weight_percentage ?? 0),
                  }))
              : [],
          });
        } else {
          setMemberJd(null);
        }

        // Worklog stats + project aggregates
        const logs = logsRes.status === 'fulfilled' ? logsRes.value.data : null;
        if (logs && logs.length > 0) {
          const totalHours = logs.reduce(
            (sum, item) => sum + (parseFloat(String(item.total_hours || 0)) || 0),
            0
          );
          const uniqueDays = new Set(logs.map((item) => item.work_date)).size;

          const projMap = new Map<string, MemberProjectAggregate>();
          logs.forEach((l) => {
            const pName = (l.project_name || '').trim();
            if (!pName) return;
            const hrs = parseFloat(String(l.total_hours || 0)) || 0;
            const snippet = cleanMilestoneText(l.description) || l.action_name || '';
            const existing = projMap.get(pName);
            if (!existing) {
              projMap.set(pName, {
                name: pName,
                taskCount: 1,
                totalHours: hrs,
                latestDate: l.work_date,
                highlight: snippet,
              });
            } else {
              existing.taskCount += 1;
              existing.totalHours += hrs;
              if (!existing.highlight && snippet) existing.highlight = snippet;
            }
          });

          const allProjectSummaries = Array.from(projMap.values()).sort(
            (a, b) => b.totalHours - a.totalHours
          );
          const keyProjects = allProjectSummaries.filter(isSubstantiveProject);
          const effectiveKeyProjects =
            keyProjects.length > 0 ? keyProjects : allProjectSummaries.slice(0, 6);
          const supportProjectsCount = Math.max(
            0,
            allProjectSummaries.length - effectiveKeyProjects.length
          );

          setMemberStats({
            year: CURRENT_DOSSIER_YEAR,
            totalHours: Math.round(totalHours * 10) / 10,
            totalDays: uniqueDays,
            totalTasks: logs.length,
            projects: effectiveKeyProjects.map((p) => p.name),
            supportProjectsCount,
            projectSummaries: effectiveKeyProjects,
            recentLogs: logs.slice(0, 10).map((l) => ({
              id: l.id,
              work_date: l.work_date,
              task_title:
                cleanMilestoneText(l.description) || l.action_name || l.project_name || 'บันทึกงาน',
              task_description: l.description || undefined,
              total_hours: parseFloat(String(l.total_hours || 0)) || 0,
              project_name: l.project_name,
            })),
          });
        }

        // Appraisals (Half-Year & End-Year)
        const appraisalRows =
          appraisalsRes.status === 'fulfilled' && Array.isArray(appraisalsRes.value.data)
            ? (appraisalsRes.value.data as Record<string, unknown>[])
            : [];

        const latestEndYear = appraisalRows.find((r) => {
          const tpl = String(r.template_id || '');
          const cycle = (r.analysis_data as Record<string, unknown> | null)?.cycle;
          return tpl.startsWith('end_year') || cycle === 'End-Year';
        });
        const latestHalfYear = appraisalRows.find((r) => {
          const tpl = String(r.template_id || '');
          const cycle = (r.analysis_data as Record<string, unknown> | null)?.cycle;
          return tpl.startsWith('half_year') || cycle === 'Half-Year';
        });

        setEndYearAppraisal(latestEndYear ? parseAppraisalRow(latestEndYear, 'end_year') : null);
        setHalfYearAppraisal(latestHalfYear ? parseAppraisalRow(latestHalfYear, 'half_year') : null);
      } catch (err) {
        console.error('Error fetching member dossier:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    initDossier();
  }, [currentSlug, decodedSlug, isChatchawan]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500 font-mono tracking-wider">
          กำลังโหลดแฟ้มผลงาน...
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-20 h-20 bg-indigo-50 border border-indigo-200 rounded-3xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm">
          <Briefcase size={36} />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <span>Dossier Not Found</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 mb-2">
          ไม่พบแฟ้มผลงานสำหรับ &ldquo;{currentSlug}&rdquo;
        </h1>
        <p className="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
          ยังไม่มีการสร้างแฟ้มผลงานในชื่อนี้ หรือรหัสพนักงานไม่ถูกต้อง สมาชิกในทีมสามารถเข้าสู่ระบบเพื่อดูและปรับแต่งแฟ้มผลงานของตนเองได้ที่หน้า Profile
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-5 py-2.5 rounded-xl border border-slate-200 transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>กลับหน้าหลัก</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <span>ไปที่หน้า Profile</span>
          </button>
        </div>
      </div>
    );
  }

  if (isPublic === false && !isOwner) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-20 h-20 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-center text-amber-600 mb-6 shadow-sm">
          <Lock size={36} />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <span>Private Dossier</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-3">
          แฟ้มผลงานนี้ถูกตั้งค่าเป็นส่วนตัว
        </h1>
        <p className="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
          แฟ้มผลงานนี้ถูกตั้งค่าเป็นส่วนตัว ผู้บริหารหรือคณะกรรมการที่ต้องการเข้าถึงข้อมูล โปรดติดต่อเจ้าของข้อมูลโดยตรง
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-5 py-2.5 rounded-xl border border-slate-200 transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>กลับหน้าหลัก</span>
          </button>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <span>เข้าสู่ระบบ</span>
          </button>
        </div>
      </div>
    );
  }

  // Master Portfolio for Chatchawan (Canva Master PDF & Interactive Iframe)
  if (isChatchawan) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-slate-950 relative">
        {isOwner && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-slate-900/85 hover:bg-slate-900 text-slate-200 px-3 py-1.5 rounded-full backdrop-blur-md border border-slate-700/60 shadow-xl transition-all text-xs font-medium">
            <button
              onClick={() => navigate('/profile')}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
              title="กลับไปหน้าตั้งค่าโปรไฟล์ Worklog"
            >
              <ArrowLeft size={13} />
              <span>กลับหน้า Profile</span>
            </button>
            <span className="w-px h-3.5 bg-slate-700 mx-1" />
            {isPublic ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <ShieldCheck size={12} />
                <span>Public</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                <ShieldAlert size={12} />
                <span>Private Preview</span>
              </span>
            )}
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="/dossier/portfolio.html"
          className="w-full h-full border-0 block m-0 p-0"
          title="Chatchawan Tulaphol - Executive Promotion Dossier & Strategic Portfolio"
        />
      </div>
    );
  }

  // Editorial Light Portfolio for All Other Team Members
  return (
    <>
      {member && (
        <MemberEditorialDossier
          member={member}
          stats={memberStats}
          jd={memberJd}
          dossierConfig={dossierConfig}
          halfYearAppraisal={halfYearAppraisal}
          endYearAppraisal={endYearAppraisal}
          canEdit={isOwner}
          onBack={() => navigate(-1)}
          onOpenEditor={() => setIsEditorOpen(true)}
        />
      )}

      {member && (
        <DossierEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          userId={member.id}
          userName={member.full_name}
          initialConfig={dossierConfig}
          availableProjects={memberStats.projects}
          onSaved={(saved) => {
            setDossierConfig(saved);
            setIsPublic(saved.is_public);
          }}
        />
      )}
    </>
  );
}
