import React, { useMemo } from 'react';
import {
  ArrowLeft,
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Edit3,
  ExternalLink,
  FolderGit2,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
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
import type {
  DossierAccentTheme,
  MemberAppraisalSummary,
  MemberDossierJd,
  MemberDossierProfile,
  MemberDossierStats,
  UserDossierConfig,
} from '../../lib/dossier-types';

export interface MemberEditorialDossierProps {
  member: MemberDossierProfile;
  stats: MemberDossierStats;
  jd: MemberDossierJd | null;
  dossierConfig: UserDossierConfig | null;
  halfYearAppraisal: MemberAppraisalSummary | null;
  endYearAppraisal: MemberAppraisalSummary | null;
  canEdit: boolean;
  onBack: () => void;
  onOpenEditor: () => void;
}

const THEME_TOKENS: Record<
  DossierAccentTheme,
  {
    pillBg: string;
    gradientText: string;
    primaryBtn: string;
    ringStrokeFrom: string;
    ringStrokeTo: string;
    radarStroke: string;
    auraBg: string;
  }
> = {
  indigo: {
    pillBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    gradientText: 'from-indigo-600 via-violet-600 to-cyan-600',
    primaryBtn: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25',
    ringStrokeFrom: '#4f46e5',
    ringStrokeTo: '#06b6d4',
    radarStroke: '#4f46e5',
    auraBg: 'from-indigo-100/70 via-white to-cyan-50/60',
  },
  emerald: {
    pillBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    gradientText: 'from-emerald-600 via-teal-600 to-cyan-600',
    primaryBtn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25',
    ringStrokeFrom: '#059669',
    ringStrokeTo: '#06b6d4',
    radarStroke: '#059669',
    auraBg: 'from-emerald-100/60 via-white to-teal-50/60',
  },
  cyan: {
    pillBg: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
    gradientText: 'from-cyan-600 via-sky-600 to-indigo-600',
    primaryBtn: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/25',
    ringStrokeFrom: '#0891b2',
    ringStrokeTo: '#4f46e5',
    radarStroke: '#0891b2',
    auraBg: 'from-cyan-100/70 via-white to-indigo-50/60',
  },
  violet: {
    pillBg: 'bg-violet-50 text-violet-700 border-violet-200/80',
    gradientText: 'from-violet-600 via-purple-600 to-indigo-600',
    primaryBtn: 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/25',
    ringStrokeFrom: '#7c3aed',
    ringStrokeTo: '#4f46e5',
    radarStroke: '#7c3aed',
    auraBg: 'from-violet-100/70 via-white to-indigo-50/60',
  },
};

const PROJECT_CARD_GRADIENTS = [
  'from-indigo-600 to-violet-600',
  'from-emerald-600 to-teal-600',
  'from-cyan-600 to-sky-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-slate-700 to-indigo-700',
];

export const MemberEditorialDossier: React.FC<MemberEditorialDossierProps> = ({
  member,
  stats,
  jd,
  dossierConfig,
  halfYearAppraisal,
  endYearAppraisal,
  canEdit,
  onBack,
  onOpenEditor,
}) => {
  const accent = THEME_TOKENS[dossierConfig?.accent_theme || 'indigo'];
  const primaryAppraisal = endYearAppraisal || halfYearAppraisal;
  const isPromotionTrack = dossierConfig?.track_mode === 'promotion_track';

  const heroAvatarSrc =
    dossierConfig?.hero_image_url?.trim() || getUserAvatarUrl(member.full_name, member.emp_id);

  const trackLabel = isPromotionTrack
    ? `2026–2027 PROMOTION TRACK${dossierConfig?.target_role ? ` • TARGET: ${dossierConfig.target_role}` : ''}`
    : `2026 PERFORMANCE & CAREER PORTFOLIO • ${member.department || member.company_name || 'DOUBLE A GROUP'}`;

  const heroHeadline =
    dossierConfig?.headline?.trim() ||
    `${member.position || 'Process & Digital Specialist'} — ขับเคลื่อนผลลัพธ์เชิงประจักษ์ด้วยข้อมูลและมาตรฐานการทำงาน`;

  const heroBio =
    dossierConfig?.bio?.trim() ||
    primaryAppraisal?.executiveSummary ||
    (jd?.jd_text ? jd.jd_text.slice(0, 280) + (jd.jd_text.length > 280 ? '…' : '') : '') ||
    `แฟ้มผลงานและบันทึกการปฏิบัติงานอย่างเป็นระบบของ ${member.full_name} ครอบคลุม ${stats.projects.length} โครงการหลัก รวม ${stats.totalHours.toLocaleString()} ชั่วโมงการทำงานจริง`;

  // Merge featured projects (with custom images) + auto-discovered worklog projects
  const featuredProjects = useMemo(
    () => dossierConfig?.featured_projects || [],
    [dossierConfig?.featured_projects]
  );

  const autoProjects = useMemo(() => {
    const featuredNames = new Set(featuredProjects.map((p) => p.project_name.toLowerCase().trim()));
    return stats.projectSummaries.filter((p) => !featuredNames.has(p.name.toLowerCase().trim()));
  }, [featuredProjects, stats.projectSummaries]);

  const radarData = useMemo(() => {
    if (!primaryAppraisal) return [];
    const p = primaryAppraisal.pillars;
    return [
      { axis: `Quantity (${p.quantity})`, score: p.quantity, title: '1. Quantity (ความครบถ้วน)', color: 'bg-cyan-500' },
      { axis: `Quality (${p.quality})`, score: p.quality, title: '2. Quality (คุณภาพและผลลัพธ์)', color: 'bg-indigo-500' },
      { axis: `Learning (${p.learning})`, score: p.learning, title: '3. Learning (การเรียนรู้และส่งต่อ)', color: 'bg-violet-500' },
      { axis: `Accountability (${p.accountability})`, score: p.accountability, title: '4. Accountability (ความรับผิดชอบ)', color: 'bg-amber-500' },
      { axis: `Proactiveness (${p.proactiveness})`, score: p.proactiveness, title: '5. Proactiveness (การคิดและลงมือก่อน)', color: 'bg-emerald-500' },
    ];
  }, [primaryAppraisal]);

  const jdResponsibilities = useMemo(
    () => (Array.isArray(jd?.key_responsibilities) ? jd.key_responsibilities : []),
    [jd]
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sticky Glass Editorial Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="ย้อนกลับ"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900 truncate flex items-center gap-2">
                <span>{member.full_name}</span>
                {member.nickname && (
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {member.nickname}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {member.position || 'Career Portfolio'} • {member.department || member.company_name || 'Double A Group'}
              </div>
            </div>
          </div>

          {/* Smooth Section Anchor Links */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-600">
            <a href="#home" className="hover:text-indigo-600 transition-colors">ภาพรวม</a>
            <a href="#about" className="hover:text-indigo-600 transition-colors">บทบาท &amp; JD</a>
            <a href="#projects" className="hover:text-indigo-600 transition-colors">ผลงานสำคัญ</a>
            <a href="#appraisal" className="hover:text-indigo-600 transition-colors">ผลประเมิน AI</a>
            <a href="#milestones" className="hover:text-indigo-600 transition-colors">ไทม์ไลน์</a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={onOpenEditor}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 transition-all cursor-pointer shadow-2xs"
              >
                <Edit3 size={13} />
                <span className="hidden sm:inline">ปรับแต่ง Portfolio</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${accent.primaryBtn}`}
            >
              <Download size={13} />
              <span>พิมพ์ / PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* 1. EDITORIAL SPLIT HERO SECTION */}
        <section
          id="home"
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${accent.auraBg} border border-slate-200/90 p-6 sm:p-10 lg:p-12 shadow-sm`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Editorial Narrative (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${accent.pillBg}`}>
                <Sparkles size={12} />
                <span>{trackLabel}</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-slate-900 leading-[1.15]">
                  {member.full_name}
                  {member.emp_id && (
                    <span className="ml-2.5 text-base sm:text-lg font-mono font-bold text-slate-400 tabular-nums align-middle">
                      ({member.emp_id})
                    </span>
                  )}
                </h1>
                <p className={`text-base sm:text-lg font-extrabold bg-gradient-to-r ${accent.gradientText} bg-clip-text text-transparent leading-snug`}>
                  {heroHeadline}
                </p>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                {heroBio}
              </p>

              {/* Metadata Pills */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                {member.company_name && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-slate-200/80 font-medium">
                    <Building2 size={13} className="text-slate-400" />
                    <span>{member.company_name}</span>
                  </span>
                )}
                {member.department && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-slate-200/80 font-medium">
                    <Briefcase size={13} className="text-slate-400" />
                    <span>ฝ่าย {member.department}</span>
                  </span>
                )}
                {member.manager_name && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-slate-200/80 font-medium">
                    <ShieldCheck size={13} className="text-slate-400" />
                    <span>หัวหน้างาน: {member.manager_name}</span>
                  </span>
                )}
              </div>

              {/* Quick Scroll CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-1 print:hidden">
                <a
                  href="#projects"
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${accent.primaryBtn}`}
                >
                  <FolderGit2 size={14} />
                  <span>ดูผลงานสำคัญ ({featuredProjects.length + autoProjects.length} โครงการ)</span>
                </a>
                <a
                  href="#appraisal"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-2xs"
                >
                  <Award size={14} className="text-indigo-500" />
                  <span>ดูผลประเมิน HR 5 มิติ</span>
                </a>
              </div>
            </div>

            {/* Right Headshot + 2 Floating Metric Badges (5 cols) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[320px]">
                {/* Main Sculpted Portrait Frame */}
                <div className="relative aspect-[4/4.4] rounded-3xl overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200 border-4 border-white shadow-xl">
                  <img
                    src={heroAvatarSrc}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = getUiAvatarFallbackUrl(member.full_name);
                    }}
                    alt={member.full_name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                {/* Floating Badge 1 (Top-Left): AI Appraisal Score — positioned above face */}
                <div className="absolute -top-6 -left-3 sm:-left-8 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3.5 py-2 shadow-lg flex items-center gap-2.5 whitespace-nowrap">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Award size={16} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500">
                      {primaryAppraisal
                        ? `ผลประเมิน ${primaryAppraisal.cycle === 'end_year' ? 'End-Year' : 'Half-Year'} ${stats.year}`
                        : `Worklog ${stats.year}`}
                    </div>
                    <div className="text-xs font-black text-slate-900 font-mono tabular-nums">
                      {primaryAppraisal
                        ? `${primaryAppraisal.overallScore}% (${primaryAppraisal.level})`
                        : `${stats.totalDays} วันทำงานจริง`}
                    </div>
                  </div>
                </div>

                {/* Floating Badge 2 (Bottom-Right): Key Projects & Hours */}
                <div className="absolute -bottom-5 -right-3 sm:-right-8 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3.5 py-2 shadow-lg flex items-center gap-2.5 whitespace-nowrap">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500">ผลงานส่งมอบปี {stats.year}</div>
                    <div className="text-xs font-black text-slate-900 font-mono tabular-nums">
                      {stats.projects.length} โครงการหลัก • {stats.totalHours.toLocaleString()} ชม.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Metric Executive KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-10 pt-8 border-t border-slate-200/70">
            <div className="bg-white/90 rounded-2xl border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>ชั่วโมงงานสะสม</span>
                <Clock size={14} className="text-indigo-500" />
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900 font-mono tabular-nums">
                {stats.totalHours.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">จาก {stats.totalTasks} บันทึกงานจริง</div>
            </div>

            <div className="bg-white/90 rounded-2xl border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>วันทำงานที่บันทึก</span>
                <Calendar size={14} className="text-emerald-500" />
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900 font-mono tabular-nums">
                {stats.totalDays}
              </div>
              <div className="text-[11px] text-slate-500">
                {primaryAppraisal?.coveragePct != null
                  ? `ความสม่ำเสมอ ${primaryAppraisal.coveragePct}%`
                  : 'บันทึกงานอย่างต่อเนื่อง'}
              </div>
            </div>

            <div className="bg-white/90 rounded-2xl border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>โครงการหลัก (ปี {stats.year})</span>
                <FolderGit2 size={14} className="text-amber-500" />
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900 font-mono tabular-nums">
                {Math.max(stats.projects.length, featuredProjects.length)}
              </div>
              <div className="text-[11px] text-slate-500">
                {stats.supportProjectsCount > 0
                  ? `+ ร่วมสนับสนุนอีก ${stats.supportProjectsCount} งานย่อย`
                  : 'โครงการสำคัญที่รับผิดชอบ'}
              </div>
            </div>

            <div className="bg-white/90 rounded-2xl border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>คะแนนประเมินล่าสุด</span>
                <Award size={14} className="text-violet-500" />
              </div>
              <div className="mt-1 text-2xl font-black text-emerald-700 font-mono tabular-nums">
                {primaryAppraisal ? `${primaryAppraisal.overallScore}/100` : '—'}
              </div>
              <div className="text-[11px] text-slate-500">
                {primaryAppraisal ? `ระดับ "${primaryAppraisal.level}"` : 'รอประเมินจาก AI Half-End Year'}
              </div>
            </div>
          </div>
        </section>

        {/* 2. ABOUT, ROLE SCOPE (JD) & STRENGTHS */}
        <section id="about" className="space-y-5">
          <div className="space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
              ROLE SCOPE &amp; CORE RESPONSIBILITIES
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              บทบาทหน้าที่ความรับผิดชอบและจุดแข็งหลัก
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: JD Overview + Supervisor Quote */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Briefcase size={15} className="text-indigo-600" />
                    <span>ขอบเขตหน้าที่ (Job Description)</span>
                  </h3>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {jd?.position_name || member.position || 'ตำแหน่งงาน'}
                  </span>
                </div>
                {jd?.jd_text ? (
                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {jd.jd_text}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ปฏิบัติงานและขับเคลื่อนโครงการในตำแหน่ง <strong>{member.position || 'พนักงาน'}</strong> ครอบคลุม {stats.projects.length} โครงการหลักในระบบ Worklog
                  </p>
                )}
              </div>

              {dossierConfig?.supervisor_quote?.trim() && (
                <div className="bg-gradient-to-br from-indigo-50/80 to-white rounded-2xl border border-indigo-200/70 p-6 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-700 uppercase tracking-wider">
                    <MessageSquareQuote size={15} />
                    <span>ความเห็นและคำรับรองจากหัวหน้างาน</span>
                  </div>
                  <blockquote className="text-sm text-slate-700 leading-relaxed italic">
                    &ldquo;{dossierConfig.supervisor_quote}&rdquo;
                  </blockquote>
                  {(dossierConfig.supervisor_name || dossierConfig.supervisor_title) && (
                    <div className="text-xs font-bold text-slate-800 pt-1">
                      — {dossierConfig.supervisor_name}
                      {dossierConfig.supervisor_title && (
                        <span className="font-normal text-slate-500"> · {dossierConfig.supervisor_title}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: JD Responsibility Weights + Top Strengths */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-3.5 shadow-2xs">
                <h3 className="text-sm font-extrabold text-slate-900">
                  สัดส่วนน้ำหนักภารกิจหลัก (JD Weights)
                </h3>
                {jdResponsibilities.length > 0 ? (
                  <div className="space-y-3">
                    {jdResponsibilities.map((r, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-700">{r.category}</span>
                          <span className="font-mono font-bold text-indigo-600 tabular-nums shrink-0">
                            {r.weight}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                            style={{ width: `${Math.min(100, r.weight)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    ยังไม่ได้กำหนดตารางน้ำหนัก JD (สามารถบันทึกได้จากหน้า AI Half - End Year)
                  </p>
                )}
              </div>

              {primaryAppraisal && primaryAppraisal.topStrengths.length > 0 && (
                <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200/80 p-5 space-y-2">
                  <div className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
                    <Award size={14} />
                    <span>จุดแข็งสำคัญจากการประเมิน (Top Strengths)</span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside leading-relaxed">
                    {primaryAppraisal.topStrengths.slice(0, 4).map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. KEY PROJECTS & VISUAL SHOWCASE */}
        <section id="projects" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className="space-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                DELIVERED PROJECTS &amp; VISUAL PORTFOLIO
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                ผลงานและโครงการสำคัญที่ส่งมอบ
              </h2>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={onOpenEditor}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer print:hidden"
              >
                <Edit3 size={13} />
                <span>เพิ่มรูปผลงาน / ไฮไลต์โครงการ</span>
              </button>
            )}
          </div>

          {/* Featured Projects with Custom Screenshots / Impact */}
          {featuredProjects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredProjects.map((proj, idx) => (
                <article
                  key={proj.id || idx}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs flex flex-col justify-between print:break-inside-avoid"
                >
                  <div>
                    {proj.image_url ? (
                      <div className="aspect-[16/10] bg-slate-100 overflow-hidden border-b border-slate-100">
                        <img
                          src={proj.image_url}
                          alt={proj.title || proj.project_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`h-28 bg-gradient-to-br ${PROJECT_CARD_GRADIENTS[idx % PROJECT_CARD_GRADIENTS.length]} p-4 flex flex-col justify-between text-white`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                          {proj.category || 'FEATURED PROJECT'}
                        </span>
                        <div className="text-sm font-extrabold line-clamp-2">
                          {proj.project_name}
                        </div>
                      </div>
                    )}
                    <div className="p-5 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                          {proj.category || proj.project_name}
                        </span>
                        {proj.impact_metric && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                            {proj.impact_metric}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                        {proj.title || proj.project_name}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {proj.summary}
                      </p>
                    </div>
                  </div>
                  {proj.live_url && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
                      <a
                        href={proj.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        <span>ดูผลงาน / ระบบจริง</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* Auto-Aggregated Worklog Projects */}
          {autoProjects.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {autoProjects.slice(0, 12).map((proj, idx) => (
                <div
                  key={proj.name}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-2.5 shadow-2xs print:break-inside-avoid"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 bg-gradient-to-r ${PROJECT_CARD_GRADIENTS[idx % PROJECT_CARD_GRADIENTS.length]}`}
                      />
                      <h3 className="text-sm font-extrabold text-slate-900 truncate">
                        {proj.name}
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0 tabular-nums">
                      {proj.totalHours.toFixed(1)} ชม.
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {proj.highlight || 'ส่งมอบและขับเคลื่อนงานต่อเนื่องตามแผน'}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>{proj.taskCount} บันทึกงาน</span>
                    <span className="font-mono">ล่าสุด {proj.latestDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. OFFICIAL AI APPRAISAL (HALF-YEAR -> END-YEAR) */}
        <section id="appraisal" className="space-y-5 print:break-inside-avoid">
          <div className="space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
              OFFICIAL HR PERFORMANCE BENCHMARK
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              ผลการประเมินการปฏิบัติงานด้วย AI (Half-Year &amp; End-Year)
            </h2>
          </div>

          {primaryAppraisal ? (
            <div className="space-y-5">
              {/* Half-Year vs End-Year Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'รอบครึ่งปี (Half-Year)', item: halfYearAppraisal },
                  { label: 'รอบสิ้นปี (End-Year)', item: endYearAppraisal },
                ].map(({ label, item }) => (
                  <div
                    key={label}
                    className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold text-indigo-700">{label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item ? item.period : 'ยังไม่มีข้อมูลผลประเมินในรอบนี้'}
                        </div>
                      </div>
                      {item ? (
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums">
                            {item.overallScore}
                            <span className="text-xs text-slate-400 font-bold">/100</span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-600">
                            ระดับ &quot;{item.level}&quot;
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">
                          รอประเมิน
                        </span>
                      )}
                    </div>
                    {item && (
                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Cpu size={12} className="text-indigo-500" />
                          <span>{item.modelName}</span>
                        </span>
                        {item.isPublic && item.shareToken && (
                          <a
                            href={`/appraisal?share=${item.shareToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            <span>เปิดรายงานทางการ</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Radar Chart + 5-Pillar Score Bars */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <div className="text-xs font-extrabold text-slate-800 mb-2">
                    สมดุลคะแนนประเมิน 5 มิติ ({primaryAppraisal.cycle === 'end_year' ? 'End-Year' : 'Half-Year'})
                  </div>
                  <div className="w-full h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                        <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                        <PolarAngleAxis
                          dataKey="axis"
                          tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                        />
                        <PolarRadiusAxis domain={[0, 20]} tickCount={5} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} />
                        <Radar
                          dataKey="score"
                          stroke={accent.radarStroke}
                          strokeWidth={2.2}
                          fill={accent.radarStroke}
                          fillOpacity={0.22}
                          dot={{ r: 3.5, fill: accent.radarStroke, stroke: '#ffffff', strokeWidth: 1.5 }}
                        />
                        <Tooltip formatter={(value) => [`${String(value)} / 20`, 'คะแนน']} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 shadow-2xs overflow-hidden">
                  {radarData.map((p) => (
                    <div key={p.title} className="px-5 py-3.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">{p.title}</span>
                        <span className="font-mono tabular-nums text-indigo-700">{p.score} / 20</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.color}`}
                          style={{ width: `${Math.min(100, (p.score / 20) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              ยังไม่มีผลประเมิน 5 มิติที่เปิดแชร์สาธารณะ (สร้างและเปิดแชร์ได้ที่เมนู <strong>AI Half - End Year</strong>)
            </div>
          )}
        </section>

        {/* 5. VERIFIED MILESTONES TIMELINE */}
        {stats.recentLogs.length > 0 && (
          <section id="milestones" className="space-y-4 print:break-inside-avoid">
            <div className="space-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                VERIFIED WORKLOG TIMELINE
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                ประวัติการส่งมอบงานล่าสุด
              </h2>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 shadow-2xs overflow-hidden">
              {stats.recentLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="px-5 py-3.5 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span className="font-mono text-[11px] text-slate-400 shrink-0 tabular-nums">
                      {log.work_date}
                    </span>
                    {log.project_name && (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">
                        {log.project_name}
                      </span>
                    )}
                    <span className="text-slate-700 font-medium truncate">{log.task_title}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-500 tabular-nums shrink-0">
                    {log.total_hours} ชม.
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-6 pb-8 text-center text-xs text-slate-400 border-t border-slate-200">
          © 2026 IMP Worklog Ecosystem • {member.company_name || 'Double A Group'}. Verified Portfolio &amp; AI Performance Benchmark.
        </footer>
      </main>
    </div>
  );
};

export default MemberEditorialDossier;
