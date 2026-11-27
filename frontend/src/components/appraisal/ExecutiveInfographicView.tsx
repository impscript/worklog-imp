import React, { useMemo } from 'react';
import {
  Award,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileText,
  Layers,
  MessageSquareQuote,
  TrendingUp,
} from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { getUserAvatarUrl, getUiAvatarFallbackUrl } from '../../lib/project-management';
import { formatThaiDateRange } from '../../lib/appraisalPromptStandards';

export interface ExecutiveInfographicUser {
  id: string;
  emp_id?: string;
  full_name?: string;
  position?: string;
  department?: string;
}

export interface ExecutiveInfographicResult {
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
  work_status: {
    completed: string[];
    in_progress: string[];
    pending: string[];
    overdue: string[];
  };
  jd_coverage: { item: string; status: 'Found' | 'Missing'; details: string }[];
  top_strengths: string[];
  development_priorities: string[];
  operating_paradigm?: {
    ai_lead: { has_evidence: boolean; count: number; title: string; detail: string; badge: string };
    human_in_the_loop: { has_evidence: boolean; count: number; title: string; detail: string; badge: string };
    expert_in_the_loop: { has_evidence: boolean; count: number; title: string; detail: string; badge: string };
  };
  supervisor_notes?: string;
  ai_model?: string;
}

export interface ExecutiveInfographicViewProps {
  evaluatedUser: ExecutiveInfographicUser | null;
  result: ExecutiveInfographicResult;
  displayStats: {
    total_logs: number;
    logged_days: number;
    business_days: number;
    coverage_pct: number;
  };
  candidateLogsCount?: number;
}

function formatAttendanceText(loggedDays: number, businessDays: number): string {
  if (loggedDays > businessDays) {
    return `${businessDays}/${businessDays} วันทำการ (+${loggedDays - businessDays} วันหยุด)`;
  }
  return `${loggedDays}/${businessDays} วันทำการ`;
}

function splitDeliverable(raw: string): { project: string | null; detail: string } {
  const cleaned = raw.replace(/:\s*:\s*/g, ': ').trim();
  const colonIdx = cleaned.indexOf(':');
  if (colonIdx > 0 && colonIdx < 48) {
    const project = cleaned.slice(0, colonIdx).trim();
    const detail = cleaned.slice(colonIdx + 1).replace(/^[\s:–—-]+/, '').trim();
    if (project && detail) {
      return { project, detail };
    }
  }
  return { project: null, detail: cleaned };
}

function getGradeBadgeClass(score: number): string {
  if (score >= 18) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
  }
  if (score >= 15) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50';
  }
  if (score >= 12) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50';
  }
  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50';
}

export const ExecutiveInfographicView: React.FC<ExecutiveInfographicViewProps> = ({
  evaluatedUser,
  result,
  displayStats,
}) => {
  const thaiPeriod = useMemo(() => formatThaiDateRange(result.period), [result.period]);
  const attendanceText = useMemo(
    () => formatAttendanceText(displayStats.logged_days, displayStats.business_days),
    [displayStats.logged_days, displayStats.business_days]
  );

  // SVG Circular Score Ring geometry
  const ringRadius = 34;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const clampedScore = Math.min(100, Math.max(0, result.overall_score));
  const ringOffset = ringCircumference * (1 - clampedScore / 100);

  // 5 HR Pillars data (used by both Radar Chart and Tonal Breakdown)
  const pillars = useMemo(
    () => [
      {
        key: 'quantity',
        short: 'Quantity',
        axisLabel: `Quantity (${result.scores?.quantity?.score ?? 0})`,
        title: '1. Quantity (ความครบถ้วนของงาน)',
        score: result.scores?.quantity?.score ?? 0,
        max: result.scores?.quantity?.max ?? 20,
        level: result.scores?.quantity?.level ?? '-',
        reason: result.scores?.quantity?.reason ?? '',
        barColor: 'bg-cyan-500',
        scoreText: 'text-cyan-700 dark:text-cyan-400',
      },
      {
        key: 'quality',
        short: 'Quality',
        axisLabel: `Quality (${result.scores?.quality?.score ?? 0})`,
        title: '2. Quality (คุณภาพและผลลัพธ์)',
        score: result.scores?.quality?.score ?? 0,
        max: result.scores?.quality?.max ?? 20,
        level: result.scores?.quality?.level ?? '-',
        reason: result.scores?.quality?.reason ?? '',
        barColor: 'bg-indigo-500',
        scoreText: 'text-indigo-700 dark:text-indigo-400',
      },
      {
        key: 'learning',
        short: 'Learning',
        axisLabel: `Learning (${result.scores?.learning?.score ?? 0})`,
        title: '3. Learning (การเรียนรู้และส่งต่อ)',
        score: result.scores?.learning?.score ?? 0,
        max: result.scores?.learning?.max ?? 20,
        level: result.scores?.learning?.level ?? '-',
        reason: result.scores?.learning?.reason ?? '',
        barColor: 'bg-violet-500',
        scoreText: 'text-violet-700 dark:text-violet-400',
      },
      {
        key: 'accountability',
        short: 'Accountability',
        axisLabel: `Accountability (${result.scores?.accountability?.score ?? 0})`,
        title: '4. Accountability (ความรับผิดชอบ)',
        score: result.scores?.accountability?.score ?? 0,
        max: result.scores?.accountability?.max ?? 20,
        level: result.scores?.accountability?.level ?? '-',
        reason: result.scores?.accountability?.reason ?? '',
        barColor: 'bg-amber-500',
        scoreText: 'text-amber-700 dark:text-amber-400',
      },
      {
        key: 'proactiveness',
        short: 'Proactiveness',
        axisLabel: `Proactiveness (${result.scores?.proactiveness?.score ?? 0})`,
        title: '5. Proactiveness (การคิดและลงมือก่อน)',
        score: result.scores?.proactiveness?.score ?? 0,
        max: result.scores?.proactiveness?.max ?? 20,
        level: result.scores?.proactiveness?.level ?? '-',
        reason: result.scores?.proactiveness?.reason ?? '',
        barColor: 'bg-emerald-500',
        scoreText: 'text-emerald-700 dark:text-emerald-400',
      },
    ],
    [result.scores]
  );

  // JD coverage summary
  const jdFoundCount = useMemo(
    () => (result.jd_coverage || []).filter((item) => item.status === 'Found').length,
    [result.jd_coverage]
  );
  const jdTotalCount = (result.jd_coverage || []).length;

  // Paradigm relative bar proportions
  const aiCount = result.operating_paradigm?.ai_lead.count ?? 0;
  const humanCount = result.operating_paradigm?.human_in_the_loop.count ?? 0;
  const expertCount = result.operating_paradigm?.expert_in_the_loop.count ?? 0;
  const maxParadigmCount = Math.max(1, aiCount, humanCount, expertCount);

  return (
    <div className="rounded-2xl bg-white dark:bg-[#090d16] border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 text-slate-900 dark:text-white space-y-6 shadow-xs print:border-none print:shadow-none print:p-0">
      {/* 1. Executive Hero Header + SVG Circular Score Ring */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <img
            src={getUserAvatarUrl(evaluatedUser?.full_name, evaluatedUser?.emp_id)}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = getUiAvatarFallbackUrl(evaluatedUser?.full_name);
            }}
            alt={evaluatedUser?.full_name || 'Avatar'}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover border-2 border-indigo-200 dark:border-indigo-500/40 shadow-xs shrink-0 bg-slate-100 dark:bg-slate-800"
          />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-cyan-400">
                EXECUTIVE PERFORMANCE APPRAISAL • {result.cycle}
              </span>
              {result.ai_model && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                  <Cpu size={11} className="text-indigo-500" />
                  <span>{result.ai_model}</span>
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-[26px] font-black tracking-tight text-slate-900 dark:text-white flex items-baseline gap-2 flex-wrap">
              <span>{evaluatedUser?.full_name || 'ไม่ระบุชื่อ'}</span>
              {evaluatedUser?.emp_id && (
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  ({evaluatedUser.emp_id})
                </span>
              )}
            </h2>
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {evaluatedUser?.position || 'พนักงาน'}
              </span>
              {evaluatedUser?.department && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span>ฝ่าย {evaluatedUser.department}</span>
                </>
              )}
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                รอบ {thaiPeriod}
              </span>
            </div>
          </div>
        </div>

        {/* SVG Circular Progress Ring Score Card */}
        <div className="flex items-center gap-4 bg-gradient-to-br from-cyan-50/80 via-white to-indigo-50/70 dark:from-cyan-950/30 dark:via-slate-900 dark:to-indigo-950/30 border border-cyan-200/80 dark:border-cyan-500/30 px-5 py-3.5 rounded-2xl shrink-0 w-full lg:w-auto justify-between lg:justify-end">
          <div className="text-left lg:text-right space-y-0.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              คะแนนประเมินรวม
            </div>
            <div className="text-base font-extrabold text-cyan-800 dark:text-cyan-300">
              ระดับ &quot;{result.level}&quot;
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono tabular-nums whitespace-nowrap">
              สม่ำเสมอ {displayStats.coverage_pct}% · {attendanceText}
            </div>
          </div>

          <div className="relative w-[78px] h-[78px] shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
              <defs>
                <linearGradient id="appraisalScoreRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
              <circle
                cx="40"
                cy="40"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6.5"
                className="text-slate-200/80 dark:text-slate-800"
              />
              <circle
                cx="40"
                cy="40"
                r={ringRadius}
                fill="none"
                stroke="url(#appraisalScoreRingGrad)"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {result.overall_score}
              </span>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                / 100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4-KPI Executive Summary Strip (Instant Scan, Zero Clicks) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="px-4 py-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>หลักฐานบันทึกงาน</span>
            <FileText size={13} className="text-indigo-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {displayStats.total_logs.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">รายการ</span>
          </div>
        </div>

        <div className="px-4 py-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>ความสม่ำเสมอ</span>
            <ClipboardCheck size={13} className="text-emerald-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              {displayStats.coverage_pct}%
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              ({displayStats.logged_days} วัน)
            </span>
          </div>
        </div>

        <div className="px-4 py-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>ความครอบคลุม JD</span>
            <Briefcase size={13} className="text-cyan-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {jdTotalCount > 0 ? `${jdFoundCount}/${jdTotalCount}` : 'มาตรฐาน'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {jdTotalCount > 0 ? 'หมวดภารกิจ' : 'ตำแหน่งงาน'}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>ความเชื่อมั่นหลักฐาน</span>
            <Layers size={13} className="text-violet-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">
              {result.confidence}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ({result.role_type === 'manager' ? 'Manager' : 'Officer'})
            </span>
          </div>
        </div>
      </div>

      {/* 3. Concise Executive Summary (Visible Immediately While Scrolling) */}
      {result.executive_summary && (
        <div className="px-4 py-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-100/90 dark:border-indigo-900/50 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
            <MessageSquareQuote size={13} />
            <span>บทสรุปผู้บริหาร (Executive Summary)</span>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">
            {result.executive_summary}
          </p>
        </div>
      )}

      {/* 4. 5-Pillar Performance Profile: Recharts Radar Chart + Tonal Score Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Mebius-style 5-Axis Radar Chart (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-4 flex flex-col justify-between print:break-inside-avoid">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                5-DIMENSION PROFILE
              </div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                สมดุลคะแนนประเมิน 5 มิติ (เต็ม 20)
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-700">
              {result.overall_score}/100
            </span>
          </div>

          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="68%" data={pillars}>
                <defs>
                  <linearGradient id="radarPillarFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.14} />
                  </linearGradient>
                </defs>
                <PolarGrid stroke="#94a3b8" strokeOpacity={0.25} strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="axisLabel"
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 20]}
                  tickCount={5}
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  axisLine={false}
                />
                <Radar
                  name="คะแนน"
                  dataKey="score"
                  stroke="#4f46e5"
                  strokeWidth={2.2}
                  fill="url(#radarPillarFill)"
                  fillOpacity={1}
                  dot={{ r: 3.5, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 1.5 }}
                />
                <Tooltip
                  formatter={(value) => [`${String(value)} / 20`, 'คะแนน']}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    color: '#f8fafc',
                    fontSize: '11px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
            ตัวเลขในวงเล็บแสดงคะแนนจริงแต่ละมิติ (เต็มด้านละ 20 คะแนน)
          </div>
        </div>

        {/* Right: Clean Tonal 5-Pillar Score Breakdown (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
          {pillars.map((p) => (
            <div key={p.key} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {p.title}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getGradeBadgeClass(p.score)}`}
                  >
                    {p.level}
                  </span>
                  <span className={`text-xs font-extrabold font-mono tabular-nums ${p.scoreText}`}>
                    {p.score} / {p.max}
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${p.barColor}`}
                  style={{ width: `${Math.min(100, (p.score / p.max) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {p.reason}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Modern Operating Paradigm (3 Balanced Loops) */}
      <div className="space-y-2.5 print:break-inside-avoid">
        <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <BrainCircuit size={14} className="text-purple-600 dark:text-purple-400" />
          <span>MODERN OPERATING PARADIGM: AI LEAD × HUMAN × EXPERT IN THE LOOP</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {[
            {
              key: 'ai_lead',
              tag: '1. AI LEAD',
              subtag: 'Velocity',
              data: result.operating_paradigm?.ai_lead,
              count: aiCount,
              cardClass: result.operating_paradigm?.ai_lead.has_evidence
                ? 'bg-purple-50/70 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-800/50'
                : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800',
              tagClass: 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300',
              barClass: 'bg-purple-500',
            },
            {
              key: 'human',
              tag: '2. HUMAN IN THE LOOP',
              subtag: 'Context',
              data: result.operating_paradigm?.human_in_the_loop,
              count: humanCount,
              cardClass: result.operating_paradigm?.human_in_the_loop.has_evidence
                ? 'bg-cyan-50/70 dark:bg-cyan-950/20 border-cyan-200/80 dark:border-cyan-800/50'
                : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800',
              tagClass: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300',
              barClass: 'bg-cyan-500',
            },
            {
              key: 'expert',
              tag: '3. EXPERT IN THE LOOP',
              subtag: 'Governance',
              data: result.operating_paradigm?.expert_in_the_loop,
              count: expertCount,
              cardClass: result.operating_paradigm?.expert_in_the_loop.has_evidence
                ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/50'
                : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800',
              tagClass: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300',
              barClass: 'bg-emerald-500',
            },
          ].map((loop) => (
            <div key={loop.key} className={`p-4 rounded-xl border flex flex-col justify-between gap-2.5 ${loop.cardClass}`}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold leading-snug ${loop.tagClass}`}>
                    {loop.tag} ({loop.subtag})
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold tabular-nums shrink-0 whitespace-nowrap bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700">
                    {loop.data?.badge || `${loop.count} รายการ`}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {loop.data?.title || '-'}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {loop.data?.detail || '-'}
                </p>
              </div>
              <div className="w-full h-1 rounded-full bg-white/70 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${loop.barClass}`}
                  style={{ width: `${Math.max(8, Math.round((loop.count / maxParadigmCount) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Strategic Deliverables + Strengths & Development Priorities (Complete Scrollable Story) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:break-inside-avoid">
        {/* Left: Strategic Deliverables with Project Pills */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            STRATEGIC DELIVERABLES &amp; IMPACT
          </div>
          <div className="space-y-2">
            {(result.work_status.completed || []).slice(0, 4).map((item, idx) => {
              const { project, detail } = splitDeliverable(item);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      {project ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 truncate">
                          {project}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          ผลงานส่งมอบ #{idx + 1}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100/90 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
                      COMPLETED
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed pl-5">
                    {detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Strengths + Development Priorities + Supervisor Notes */}
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 space-y-1.5">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Award size={14} />
              <span>จุดแข็งสำคัญ (Top Strengths)</span>
            </div>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
              {(result.top_strengths || []).slice(0, 4).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          {(result.development_priorities || []).length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-1.5">
              <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <TrendingUp size={14} />
                <span>ประเด็นพัฒนาต่อในรอบถัดไป (Development Priorities)</span>
              </div>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
                {result.development_priorities.slice(0, 3).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {result.supervisor_notes && result.supervisor_notes.trim() && (
            <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-800/50 space-y-1">
              <div className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                ความเห็นเพิ่มเติมจากหัวหน้างาน (Supervisor Notes)
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {result.supervisor_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutiveInfographicView;
