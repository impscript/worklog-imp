import { useState } from 'react';
import {
  Calculator,
  Scale,
  Users,
  FileSignature,
  Code2,
  Settings,
  Briefcase,
  ShieldCheck,
  Sparkles,
  Zap,
  ArrowRight,
  RotateCw,
  Building2,
  Lock,
  Laptop,
  Layers,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  DEPARTMENT_AI_PRESETS,
  type DepartmentAiPreset,
  type DepartmentColorTheme
} from './aiDepartmentPresets';
import AiNeedsAssessmentWizard from './AiNeedsAssessmentWizard';
import { type AssessmentResult, getSuggestedDepartmentPreset } from './aiQuestionnaireData';

export interface AiDepartmentPresetMatcherProps {
  onApplyPreset: (preset: DepartmentAiPreset) => void;
}

// Icon mapping for 8 departments
const ICON_MAP = {
  Calculator,
  Scale,
  Users,
  FileSignature,
  Code2,
  Settings,
  Briefcase,
  ShieldCheck
};

// Department semantic color palettes for the 8 Corporate Departments
const DEPT_THEMES: Record<
  DepartmentColorTheme,
  {
    border: string;
    borderHover: string;
    bgTint: string;
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    titleHover: string;
    accentText: string;
    selectedGradient: string;
    selectedRing: string;
    selectedShadow: string;
  }
> = {
  emerald: {
    border: 'border-emerald-500/25 dark:border-emerald-500/30',
    borderHover: 'hover:border-emerald-500/60 hover:shadow-emerald-500/10',
    bgTint: 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05]',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
    titleHover: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    selectedGradient: 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 border-emerald-400',
    selectedRing: 'ring-2 ring-emerald-500/50',
    selectedShadow: 'shadow-md shadow-emerald-700/30'
  },
  amber: {
    border: 'border-amber-500/25 dark:border-amber-500/30',
    borderHover: 'hover:border-amber-500/60 hover:shadow-amber-500/10',
    bgTint: 'bg-amber-500/[0.03] dark:bg-amber-500/[0.05]',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-500/30',
    titleHover: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
    accentText: 'text-amber-600 dark:text-amber-400',
    selectedGradient: 'bg-gradient-to-br from-amber-600 via-amber-700 to-orange-800 border-amber-400',
    selectedRing: 'ring-2 ring-amber-500/50',
    selectedShadow: 'shadow-md shadow-amber-700/30'
  },
  indigo: {
    border: 'border-indigo-500/25 dark:border-indigo-500/30',
    borderHover: 'hover:border-indigo-500/60 hover:shadow-indigo-500/10',
    bgTint: 'bg-indigo-500/[0.03] dark:bg-indigo-500/[0.05]',
    iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
    titleHover: 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    selectedGradient: 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 border-indigo-400',
    selectedRing: 'ring-2 ring-indigo-500/50',
    selectedShadow: 'shadow-md shadow-indigo-700/30'
  },
  rose: {
    border: 'border-rose-500/25 dark:border-rose-500/30',
    borderHover: 'hover:border-rose-500/60 hover:shadow-rose-500/10',
    bgTint: 'bg-rose-500/[0.03] dark:bg-rose-500/[0.05]',
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-500/30',
    titleHover: 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
    accentText: 'text-rose-600 dark:text-rose-400',
    selectedGradient: 'bg-gradient-to-br from-rose-600 via-rose-700 to-pink-900 border-rose-400',
    selectedRing: 'ring-2 ring-rose-500/50',
    selectedShadow: 'shadow-md shadow-rose-700/30'
  },
  cyan: {
    border: 'border-cyan-500/25 dark:border-cyan-500/30',
    borderHover: 'hover:border-cyan-500/60 hover:shadow-cyan-500/10',
    bgTint: 'bg-cyan-500/[0.03] dark:bg-cyan-500/[0.05]',
    iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    badgeBorder: 'border-cyan-500/30',
    titleHover: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
    accentText: 'text-cyan-600 dark:text-cyan-400',
    selectedGradient: 'bg-gradient-to-br from-cyan-600 via-teal-700 to-blue-900 border-cyan-400',
    selectedRing: 'ring-2 ring-cyan-500/50',
    selectedShadow: 'shadow-md shadow-cyan-700/30'
  },
  purple: {
    border: 'border-purple-500/25 dark:border-purple-500/30',
    borderHover: 'hover:border-purple-500/60 hover:shadow-purple-500/10',
    bgTint: 'bg-purple-500/[0.03] dark:bg-purple-500/[0.05]',
    iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    iconColor: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-500/30',
    titleHover: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
    accentText: 'text-purple-600 dark:text-purple-400',
    selectedGradient: 'bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-900 border-purple-400',
    selectedRing: 'ring-2 ring-purple-500/50',
    selectedShadow: 'shadow-md shadow-purple-700/30'
  },
  blue: {
    border: 'border-blue-500/25 dark:border-blue-500/30',
    borderHover: 'hover:border-blue-500/60 hover:shadow-blue-500/10',
    bgTint: 'bg-blue-500/[0.03] dark:bg-blue-500/[0.05]',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-500/30',
    titleHover: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    accentText: 'text-blue-600 dark:text-blue-400',
    selectedGradient: 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 border-blue-400',
    selectedRing: 'ring-2 ring-blue-500/50',
    selectedShadow: 'shadow-md shadow-blue-700/30'
  },
  orange: {
    border: 'border-orange-500/25 dark:border-orange-500/30',
    borderHover: 'hover:border-orange-500/60 hover:shadow-orange-500/10',
    bgTint: 'bg-orange-500/[0.03] dark:bg-orange-500/[0.05]',
    iconBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-500/30',
    titleHover: 'group-hover:text-orange-600 dark:group-hover:text-orange-400',
    accentText: 'text-orange-600 dark:text-orange-400',
    selectedGradient: 'bg-gradient-to-br from-orange-600 via-amber-700 to-yellow-900 border-orange-400',
    selectedRing: 'ring-2 ring-orange-500/50',
    selectedShadow: 'shadow-md shadow-orange-700/30'
  }
};

export default function AiDepartmentPresetMatcher({
  onApplyPreset
}: AiDepartmentPresetMatcherProps) {
  // Mode switcher: 'presets' (8 Department Cards & Pricing) vs 'wizard' (5-Step Assessment)
  const [activeMode, setActiveMode] = useState<'wizard' | 'presets'>('presets');

  // Selected department preset (default to accounting_finance)
  const [selectedDeptId, setSelectedDeptId] = useState<string>('accounting_finance');

  // Active tab within department inspector: 'blueprint' (recommended models) vs 'security' (multi-device & ToS)
  const [inspectorTab, setInspectorTab] = useState<'blueprint' | 'security'>('blueprint');

  // Success indicator when user clicks Apply Preset
  const [appliedDeptId, setAppliedDeptId] = useState<string | null>(null);

  const selectedPreset =
    DEPARTMENT_AI_PRESETS.find((p) => p.id === selectedDeptId) || DEPARTMENT_AI_PRESETS[0];

  const DeptIcon = ICON_MAP[selectedPreset.iconName] || Briefcase;
  const selectedTheme = DEPT_THEMES[selectedPreset.colorTheme] || DEPT_THEMES.indigo;

  const handleApply = (preset: DepartmentAiPreset) => {
    setAppliedDeptId(preset.id);
    onApplyPreset(preset);
    setTimeout(() => {
      setAppliedDeptId(null);
    }, 2500);
  };

  const handleApplyFromWizard = (wizardResult: AssessmentResult) => {
    const basePreset =
      getSuggestedDepartmentPreset(wizardResult.suggestedDepartmentId) ||
      selectedPreset;

    const tailoredPreset: DepartmentAiPreset = {
      ...basePreset,
      recommendedSeats: wizardResult.recommendedSeats,
      prefillForm: {
        ...basePreset.prefillForm,
        title: wizardResult.summaryTitle,
        expectedBenefits: wizardResult.matchReason,
        recommendedSeats: wizardResult.recommendedSeats
      }
    };

    onApplyPreset(tailoredPreset);
  };

  return (
    <div className="space-y-8 text-theme-text">
      {/* ------------------------------------------------------------- */}
      {/* MODE SWITCHER: Smart Wizard vs 8 Department Presets           */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 rounded-2xl bg-theme-surface/70 border border-theme-border/80 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-theme-bg-page border border-theme-border/60 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveMode('wizard')}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
              activeMode === 'wizard'
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "text-theme-text-muted hover:text-theme-text hover:bg-theme-surface/40"
            )}
          >
            <Sparkles size={14} className={activeMode === 'wizard' ? "text-amber-300" : "text-indigo-400"} />
            <span>1. ทำแบบประเมิน (5 คำถามสั้นๆ)</span>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide transition-colors",
                activeMode === 'wizard'
                  ? "bg-white/20 text-white border border-white/30"
                  : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
              )}
            >
              แนะนำ
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('presets')}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
              activeMode === 'presets'
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "text-theme-text-muted hover:text-theme-text hover:bg-theme-surface/40"
            )}
          >
            <Building2 size={14} className={activeMode === 'presets' ? "text-white" : "text-theme-text-muted"} />
            <span>2. ดูคำแนะนำตามฝ่ายงาน (Department Blueprint)</span>
          </button>
        </div>

        {activeMode === 'wizard' && (
          <div className="text-[11px] text-theme-text-muted hidden md:flex items-center gap-2 px-3">
            <span>💡 ใช้เวลา 1-2 นาที ระบบจะคำนวณแพ็กเกจและจำนวนที่นั่งที่เหมาะสมให้ทันที</span>
          </div>
        )}
      </div>

      {activeMode === 'wizard' ? (
        <AiNeedsAssessmentWizard
          hideHeader={true}
          onComplete={() => {}}
          onApplyToFm001={handleApplyFromWizard}
          onSwitchToDepartmentPresets={(deptId) => {
            if (deptId) setSelectedDeptId(deptId);
            setActiveMode('presets');
          }}
        />
      ) : (
        <>
      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: 8 Department Presets Hub & Model Recommendations   */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-indigo-500" />
              <h3 className="text-base sm:text-lg font-bold text-theme-text">
                1. เลือกฝ่ายงานของคุณเพื่อดูคำแนะนำ
              </h3>
            </div>
            <p className="text-xs text-theme-text-muted mt-0.5">
              คลิกเลือกฝ่ายงานของคุณเพื่อดูโมเดลที่แนะนำ, งบประมาณรายเดือน, จำนวนที่นั่งที่เหมาะสม และวิธีกรอกแบบฟอร์มขอจัดสรรสิทธิ์
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-theme-text-muted bg-theme-bg-page/70 px-2.5 py-1 rounded-md border border-theme-border/50">
              Corporate Presets
            </span>
          </div>
        </div>

        {/* 8 Department Cards (2 Rows of 4 Columns - Full Readability, No Truncation, Semantic Colors) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {DEPARTMENT_AI_PRESETS.map((preset) => {
            const IconComp = ICON_MAP[preset.iconName] || Briefcase;
            const isSelected = selectedDeptId === preset.id;
            const deptTheme = DEPT_THEMES[preset.colorTheme] || DEPT_THEMES.indigo;

            return (
              <button
                key={preset.id}
                onClick={() => setSelectedDeptId(preset.id)}
                className={cn(
                  'p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center cursor-pointer group active:scale-[0.98]',
                  isSelected
                    ? cn(deptTheme.selectedGradient, deptTheme.selectedRing, deptTheme.selectedShadow, 'text-white border-t-white/30')
                    : cn('bg-theme-surface/75 hover:bg-theme-surface text-theme-text', deptTheme.border, deptTheme.borderHover, deptTheme.bgTint, 'shadow-2xs hover:shadow-xs')
                )}
              >
                <div className="flex items-center gap-3 w-full">
                  <span
                    className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-2xs',
                      isSelected
                        ? 'bg-white/20 text-white'
                        : cn(deptTheme.iconBg, deptTheme.iconColor)
                    )}
                  >
                    <IconComp size={22} />
                  </span>
                  <div className="min-w-0">
                    <h4
                      className={cn(
                        'text-sm font-bold leading-snug',
                        isSelected ? 'text-white' : cn('text-theme-text', deptTheme.titleHover)
                      )}
                    >
                      {preset.deptName}
                    </h4>
                    <p
                      className={cn(
                        'text-xs leading-tight mt-0.5',
                        isSelected ? 'text-white/85' : 'text-theme-text-muted'
                      )}
                    >
                      {preset.deptNameEn.split('(')[0].trim()}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TACTILE 3D FLIP CARD: Department AI Inspector                */}
        {/* ------------------------------------------------------------- */}
        <div className={cn(
          "rounded-2xl border bg-gradient-to-br from-theme-bg-page via-theme-surface to-theme-bg-page shadow-sm overflow-hidden transition-all duration-300",
          selectedTheme.border
        )}>
          {/* Card Top Control Bar */}
          <div className="p-4 border-b border-theme-border/60 bg-theme-surface/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl border flex items-center justify-center transition-colors",
                selectedTheme.iconBg,
                selectedTheme.iconColor,
                selectedTheme.badgeBorder
              )}>
                <DeptIcon size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-mono font-bold px-2 py-0.5 rounded border",
                    selectedTheme.badgeBg,
                    selectedTheme.badgeText,
                    selectedTheme.badgeBorder
                  )}>
                    {selectedPreset.deptCode}
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-theme-text">
                    {selectedPreset.deptName}
                  </h4>
                </div>
                <p className="text-xs text-theme-text-muted mt-0.5">
                  {selectedPreset.deptNameEn} • Manpower รวมจริง:{' '}
                  <strong className="text-theme-text font-mono tabular-nums">
                    {selectedPreset.headcountActual}
                  </strong>{' '}
                  คน (OC: <span className="font-mono tabular-nums">{selectedPreset.headcountOc}</span>)
                </p>
              </div>
            </div>

            {/* Tactile Segmented Pill Control */}
            <div className="flex items-center p-1 bg-theme-bg-page/80 rounded-xl border border-theme-border/60">
              <button
                type="button"
                onClick={() => setInspectorTab('blueprint')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                  inspectorTab === 'blueprint'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-theme-text-muted hover:text-theme-text'
                )}
              >
                <Sparkles size={13} className={inspectorTab === 'blueprint' ? 'text-amber-300' : 'text-indigo-400'} />
                <span>โมเดล &amp; สิทธิ์ที่แนะนำ</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('security')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                  inspectorTab === 'security'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-theme-text-muted hover:text-theme-text'
                )}
              >
                <Laptop size={13} className={inspectorTab === 'security' ? 'text-white' : 'text-amber-500'} />
                <span>วิธีใช้หลายเครื่อง &amp; ความปลอดภัย</span>
              </button>
            </div>
          </div>

          {/* Card Body: Front vs Back View */}
          <div className="p-5 md:p-6 transition-all duration-300">
            {inspectorTab === 'blueprint' ? (
              /* ======================================================= */
              /* FRONT VIEW: AI Model & Licensing Blueprint              */
              /* ======================================================= */
              <div className="space-y-6">
                {/* Highlight Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-theme-bg-page/70 border border-theme-border/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-muted block">
                      รูปแบบสิทธิ์ที่แนะนำ
                    </span>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1 line-clamp-1">
                      {selectedPreset.licensingType}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-theme-bg-page/70 border border-theme-border/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-muted block">
                      ประมาณการต้นทุน
                    </span>
                    <p className="text-xs font-bold font-mono text-theme-text mt-1 tabular-nums">
                      {selectedPreset.estimatedCostPerSeat}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-theme-bg-page/70 border border-theme-border/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-muted block">
                      โควตาที่นั่งที่แนะนำ (Sandbox)
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-base font-black font-mono text-theme-text tabular-nums">
                        {selectedPreset.recommendedSeats}
                      </span>
                      <span className="text-xs text-theme-text-muted">ที่นั่ง (Seats)</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 ml-auto">
                        สัญญาทดลอง 1-3 ด.
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-theme-bg-page/70 border border-theme-border/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-muted block">
                      เป้าหมายประหยัดเวลาต่อสัปดาห์
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-base font-black font-mono text-emerald-500 tabular-nums">
                        {selectedPreset.prefillForm.targetHoursSaved}
                      </span>
                      <span className="text-xs text-theme-text-muted">ชม./สัปดาห์/คน</span>
                      <span className="text-[10px] text-theme-text-muted ml-auto font-mono">
                        (จากเดิม {selectedPreset.prefillForm.asIsHours} ชม.)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary vs Secondary Models */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Primary Model */}
                  <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                        โมเดลหลัก (Primary Flagship)
                      </span>
                      <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                        ความแม่นยำสูงสุด
                      </span>
                    </div>
                    <h5 className="text-sm sm:text-base font-bold text-theme-text">
                      {selectedPreset.primaryModel}
                    </h5>
                    <p className="text-xs text-theme-text-muted leading-relaxed">
                      ใช้สำหรับการคิดวิเคราะห์ลึก ตรวจสอบความถูกต้องของตัวเลข สัญญา และข้อกฎหมายที่มีความเสี่ยงสูง
                    </p>
                  </div>

                  {/* Secondary Model */}
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                        โมเดลรอง (Secondary Routine)
                      </span>
                      <span className="text-xs font-mono text-purple-600 dark:text-purple-400 font-semibold">
                        ประหยัดโควตา & รวดเร็ว
                      </span>
                    </div>
                    <h5 className="text-sm sm:text-base font-bold text-theme-text">
                      {selectedPreset.secondaryModel}
                    </h5>
                    <p className="text-xs text-theme-text-muted leading-relaxed">
                      ใช้สำหรับงานร่างอีเมลทั่วไป สรุปย่อข้อความ แปลภาษาเบื้องต้น เพื่อช่วยเซฟโควตาข้อความรายวันของทีม
                    </p>
                  </div>
                </div>

                {/* Characteristics & Why This Fits */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-6 p-4 rounded-xl bg-theme-bg-page/50 border border-theme-border/60 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-muted flex items-center gap-1.5">
                      <Briefcase size={12} className="text-indigo-500" />
                      ลักษณะงานและกระบวนการสำคัญของฝ่าย
                    </span>
                    <ul className="space-y-1.5 pt-1">
                      {selectedPreset.workCharacteristics.map((char, cIdx) => (
                        <li key={cIdx} className="text-xs text-theme-text flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{char}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="md:col-span-6 p-4 rounded-xl bg-theme-bg-page/50 border border-theme-border/60 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-muted flex items-center gap-1.5">
                      <Sparkles size={12} className="text-purple-500" />
                      เหตุผลที่ชุดนี้เหมาะสมที่สุด (Why This Fits)
                    </span>
                    <p className="text-xs text-theme-text leading-relaxed pt-1">
                      {selectedPreset.whyThisFits}
                    </p>

                    <div className="mt-3 pt-3 border-t border-theme-border/50">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                        ผลประโยชน์ที่คาดว่าจะได้รับ (Expected Benefits):
                      </span>
                      <p className="text-xs text-theme-text-muted leading-relaxed">
                        {selectedPreset.prefillForm.expectedBenefits}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pro Tricks (Actionable Tips) */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Zap size={12} />
                    เทคนิคขั้นสูงสำหรับผู้ใช้งานในฝ่าย (Pro Tricks for Power Users)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                    {selectedPreset.proTricks.map((trick, tIdx) => (
                      <div
                        key={tIdx}
                        className="p-2.5 rounded-lg bg-theme-surface/80 border border-amber-500/15 text-xs text-theme-text leading-relaxed flex items-start gap-2"
                      >
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {tIdx + 1}
                        </span>
                        <span>{trick}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PRIMARY CTA: 1-Click Apply Preset */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-theme-border/60">
                  <div className="text-xs text-theme-text-muted text-center sm:text-left">
                    <span>
                      กดปุ่มเพื่อดึงค่าทั้งหมดของฝ่าย <strong>{selectedPreset.deptName}</strong> ไปกรอกในแบบฟอร์มขอจัดสรรสิทธิ์
                    </span>
                  </div>

                  <button
                    onClick={() => handleApply(selectedPreset)}
                    className={cn(
                      'w-full sm:w-auto px-5 py-3 rounded-xl text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95',
                      appliedDeptId === selectedPreset.id
                        ? 'bg-emerald-600 shadow-emerald-600/30 ring-2 ring-emerald-500/40'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25 hover:shadow-indigo-600/35'
                    )}
                  >
                    {appliedDeptId === selectedPreset.id ? (
                      <>
                        <Check size={16} />
                        <span>ดึงข้อมูลเข้าแบบฟอร์มขอใช้งาน AIสำเร็จแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Zap size={15} className="text-amber-300" />
                        <span>ใช้ชุด Preset นี้กรอกแบบฟอร์มขอใช้งาน AIอัตโนมัติ (1-Click Apply)</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* ======================================================= */
              /* BACK VIEW: Multi-Device ToS, Shared Projects & ZDR Setup */
              /* ======================================================= */
              <div className="space-y-6">
                {/* Back View Header */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                  <ShieldCheck size={22} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm sm:text-base font-bold text-theme-text">
                      ข้อกำหนดการใช้งานหลายเครื่อง (Multi-Device ToS) และคลังความรู้กลาง (Shared Projects)
                    </h5>
                    <p className="text-xs text-theme-text-muted mt-1 leading-relaxed">
                      แนวทางปฏิบัติที่ถูกต้องตามเงื่อนไขการให้บริการของ Anthropic / OpenAI
                      ป้องกันไม่ให้บัญชีถูกระงับสิทธิ์ และเทคนิคการแชร์ความรู้ข้ามเครื่องอย่างปลอดภัย
                    </p>
                  </div>
                </div>

                {/* 1 Account vs Concurrent Sharing Rule */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* What is Allowed */}
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/25 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-500" />
                      สิ่งที่ทำได้ตามเงื่อนไข (Supported & Allowed)
                    </span>
                    <ul className="space-y-2 pt-1 text-xs text-theme-text">
                      <li className="flex items-start gap-2">
                        <Laptop size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>1 ผู้ถือครองสิทธิ์ (Named User)</strong> สามารถล็อกอินข้ามอุปกรณ์ส่วนตัวได้ ทั้งโน้ตบุ๊กทำงาน คอมพิวเตอร์ตั้งโต๊ะ และสมาร์ตโฟน
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <RotateCw size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          ประวัติการแชตและโครงการ (Projects) ซิงค์ข้ามอุปกรณ์อัตโนมัติแบบเรียลไทม์
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* What is Prohibited */}
                  <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/25 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-rose-500" />
                      สิ่งที่เป็นข้อห้ามเด็ดขาด (Strictly Prohibited by ToS)
                    </span>
                    <ul className="space-y-2 pt-1 text-xs text-theme-text">
                      <li className="flex items-start gap-2">
                        <Users size={14} className="text-rose-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>ห้ามแชร์ Username/Password บัญชีเดียวกัน</strong> ให้เพื่อนร่วมงานหลายคนล็อกอินใช้งานพร้อมกัน (ระบบตรวจจับ Concurrent Sessions และตัดการเชื่อมต่อทันที)
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lock size={14} className="text-rose-500 shrink-0 mt-0.5" />
                        <span>
                          การแชร์รหัสอาจทำให้องค์กรถูกระงับ Workspace และผิดระเบียบความมั่นคงปลอดภัยสารสนเทศ WI-PI-AI-001
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Specific Department Sharing Rule */}
                <div className="p-4 rounded-xl bg-theme-bg-page/70 border border-theme-border/70 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Building2 size={12} />
                    แนวทางการบริหารสิทธิ์เฉพาะของฝ่าย {selectedPreset.deptName}
                  </span>
                  <p className="text-xs text-theme-text leading-relaxed">
                    {selectedPreset.deviceAndSharingRule}
                  </p>
                </div>

                {/* Step-by-Step Shared Projects Guide */}
                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-indigo-500" />
                    <h6 className="text-xs font-bold text-theme-text">
                      ขั้นตอนการตั้งค่า Shared Projects เพื่อแชร์ความรู้โดยไม่ต้องแชร์รหัสผ่าน
                    </h6>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-theme-surface/80 border border-indigo-500/15 space-y-1">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                        STEP 01
                      </span>
                      <h6 className="text-xs font-bold text-theme-text">สร้าง Shared Project</h6>
                      <p className="text-[11px] text-theme-text-muted leading-relaxed">
                        กดสร้าง Project ใน Claude Team เช่น &ldquo;Holding &amp; IP Accounting Hub&rdquo; และกำหนดสิทธิ์การเข้าถึงให้สมาชิกในฝ่าย
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-theme-surface/80 border border-indigo-500/15 space-y-1">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                        STEP 02
                      </span>
                      <h6 className="text-xs font-bold text-theme-text">อัปโหลดผังข้อมูลกลาง</h6>
                      <p className="text-[11px] text-theme-text-muted leading-relaxed">
                        อัปโหลดผังบัญชี (COA), เทมเพลตสัญญา, หรือระเบียบ SOP เข้า Project Knowledge ไม่ต้องแนบไฟล์ซ้ำทุกครั้ง
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-theme-surface/80 border border-indigo-500/15 space-y-1">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                        STEP 03
                      </span>
                      <h6 className="text-xs font-bold text-theme-text">สมาชิกดึงใช้ร่วมกัน</h6>
                      <p className="text-[11px] text-theme-text-muted leading-relaxed">
                        สมาชิกทุกคนในโปรเจกต์สามารถเปิดแชตเพื่อสอบถามข้อมูลจากฐานความรู้เดียวกันได้จากเครื่องของตนเอง
                      </p>
                    </div>
                  </div>
                </div>

                {/* Zero Data Retention & Privacy Note */}
                <div className="p-4 rounded-xl bg-theme-bg-page/70 border border-theme-border/70 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck size={12} />
                    การรับประกันความปลอดภัยข้อมูล &amp; Zero Data Training
                  </span>
                  <p className="text-xs text-theme-text leading-relaxed">
                    {selectedPreset.zdrAndPrivacyNote}
                  </p>
                </div>

                {/* Back View Bottom Action */}
                <div className="pt-2 flex items-center justify-between border-t border-theme-border/60">
                  <button
                    type="button"
                    onClick={() => setInspectorTab('blueprint')}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
                  >
                    <span>← กลับไปดูโมเดลที่แนะนำ</span>
                  </button>

                  <button
                    onClick={() => handleApply(selectedPreset)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Zap size={14} className="text-amber-300" />
                    <span>นำค่า Preset นี้ไปกรอกแบบฟอร์มขอใช้งาน AIทันที</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
