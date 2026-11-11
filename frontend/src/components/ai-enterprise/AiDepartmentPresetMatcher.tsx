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
  Shield,
  Laptop,
  Layers,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  LICENSING_ROUTES,
  AI_MODEL_MATRIX,
  DEPARTMENT_AI_PRESETS,
  type DepartmentAiPreset,
  type DepartmentColorTheme,
  type AiLicensingRouteId
} from './aiDepartmentPresets';
import AiNeedsAssessmentWizard from './AiNeedsAssessmentWizard';
import { type AssessmentResult, getSuggestedDepartmentPreset } from './aiQuestionnaireData';

export interface AiDepartmentPresetMatcherProps {
  onApplyPreset: (preset: DepartmentAiPreset) => void;
  onNavigateTab?: (tab: 'dashboard' | 'request' | 'evaluations' | 'reports' | 'governance') => void;
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

// Route color scheme mappings
const ROUTE_COLORS: Record<
  'indigo' | 'purple' | 'emerald' | 'amber',
  {
    bg: string;
    border: string;
    text: string;
    badge: string;
    glow: string;
    bar: string;
  }
> = {
  indigo: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    glow: 'hover:border-indigo-500/50 hover:shadow-indigo-500/10',
    bar: 'bg-indigo-500'
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    glow: 'hover:border-purple-500/50 hover:shadow-purple-500/10',
    bar: 'bg-purple-500'
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    glow: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
    bar: 'bg-emerald-500'
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    glow: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
    bar: 'bg-amber-500'
  }
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
  onApplyPreset,
  onNavigateTab
}: AiDepartmentPresetMatcherProps) {
  // Mode switcher: 'presets' (8 Department Cards & Pricing) vs 'wizard' (5-Step Assessment)
  const [activeMode, setActiveMode] = useState<'wizard' | 'presets'>('presets');

  // Selected department preset (default to accounting_finance)
  const [selectedDeptId, setSelectedDeptId] = useState<string>('accounting_finance');

  // Active tab within department inspector: 'blueprint' (recommended models) vs 'security' (multi-device & ToS)
  const [inspectorTab, setInspectorTab] = useState<'blueprint' | 'security'>('blueprint');

  // Selected route filter for Section 1 (optional highlight)
  const [selectedRouteId, setSelectedRouteId] = useState<AiLicensingRouteId>('subscription_team');

  // Success indicator when user clicks Apply Preset
  const [appliedDeptId, setAppliedDeptId] = useState<string | null>(null);

  // Interactive Seat Count state for dynamic pricing calculation
  const [seatCount, setSeatCount] = useState<number>(3);

  // Accordion toggle for detailed feature matrix table
  const [isFeatureMatrixOpen, setIsFeatureMatrixOpen] = useState<boolean>(false);

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
      {/* HEADER: Enterprise AI Governance & Department Preset Hub      */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/20 via-theme-surface to-purple-950/15 border border-indigo-500/25 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
              <Sparkles size={13} />
              <span>AI Governance & Licensing Guide</span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-theme-text">
              เลือกแพ็กเกจ AI ให้เหมาะกับงานและงบประมาณของทีม
            </h2>
            <p className="text-xs md:text-sm text-theme-text-muted max-w-3xl leading-relaxed">
              เปรียบเทียบ 4 รูปแบบการจัดสรรสิทธิ์ และแนวทางแนะนำประจำ 8 ฝ่ายงาน (บัญชี, จัดซื้อ, กฎหมาย, HR, ช่าง, ไอที)
              พร้อมส่งข้อมูลสถิติไปกรอกแบบฟอร์ม FM-001 ได้ทันทีในคลิกเดียว
            </p>
          </div>

          {onNavigateTab && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onNavigateTab('governance')}
                className="px-3 py-1.5 rounded-xl bg-theme-bg-page/80 hover:bg-theme-bg-page text-theme-text text-xs font-medium border border-theme-border flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ShieldCheck size={14} className="text-indigo-500" />
                <span>ระเบียบ WI-PI-AI-001</span>
              </button>
              <button
                onClick={() => onNavigateTab('request')}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <span>เปิดฟอร์ม FM-001</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

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
            <span>2. ดูคำแนะนำ 8 ฝ่ายงาน (Department Blueprint)</span>
          </button>
        </div>

        <div className="text-[11px] text-theme-text-muted hidden md:flex items-center gap-2 px-3">
          {activeMode === 'wizard' ? (
            <span>💡 ใช้เวลา 1-2 นาที ระบบจะคำนวณแพ็กเกจและจำนวนที่นั่งที่เหมาะสมให้ทันที</span>
          ) : (
            <span>💡 ดูสูตรแนะนำและแนวทางใช้งาน 1 บัญชีหลายเครื่องแยกตามสายงาน</span>
          )}
        </div>
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
          {/* Quick-Start 3-Step Process Guide */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-theme-text">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] shrink-0 font-mono">1</span>
              <span>เลือกฝ่ายของคุณด้านล่าง</span>
              <span className="text-theme-text-muted">➔</span>
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[11px] shrink-0 font-mono">2</span>
              <span>ดูคำแนะนำโมเดล &amp; ค่าใช้จ่าย</span>
              <span className="text-theme-text-muted">➔</span>
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px] shrink-0 font-mono">3</span>
              <span>กดยื่นขอสิทธิ์ FM-001</span>
            </div>
            <div className="text-[11px] text-theme-text-muted">
              ✨ ปรับแต่งเฉพาะทางตามจำนวนพนักงานจริง 8 ฝ่ายงาน
            </div>
          </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: 8 Department Presets Hub & Model Recommendations   */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-indigo-500" />
              <h3 className="text-base sm:text-lg font-bold text-theme-text">
                1. เลือกฝ่ายงานของคุณเพื่อดูคำแนะนำ (8 ฝ่ายงานองค์กร)
              </h3>
            </div>
            <p className="text-xs text-theme-text-muted mt-0.5">
              คลิกเลือกฝ่ายงานของคุณเพื่อดูโมเดลที่แนะนำ, งบประมาณรายเดือน, จำนวนที่นั่งที่เหมาะสม และวิธีกรอกแบบฟอร์มขอจัดสรรสิทธิ์ (FM-001)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-theme-text-muted bg-theme-bg-page/70 px-2.5 py-1 rounded-md border border-theme-border/50">
              8 Corporate Presets
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
                onClick={() => {
                  setSelectedDeptId(preset.id);
                  setSeatCount(preset.recommendedSeats || 3);
                }}
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
                      กดปุ่มเพื่อดึงค่าทั้งหมดของฝ่าย <strong>{selectedPreset.deptName}</strong> ไปกรอกในแบบฟอร์มขอจัดสรรสิทธิ์ (FM-001)
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
                        <span>ดึงข้อมูลเข้าแบบฟอร์ม FM-001 สำเร็จแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Zap size={15} className="text-amber-300" />
                        <span>ใช้ชุด Preset นี้กรอกฟอร์มขอสิทธิ์ FM-001 อัตโนมัติ (1-Click Apply)</span>
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
                    <span>นำค่า Preset นี้ไปกรอก FM-001 ทันที</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: Interactive Pricing & Feature Matrix (Stripe/Linear OS Style) */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme-border/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-indigo-500" />
              <h3 className="text-base sm:text-lg font-bold text-theme-text">
                2. คำนวณงบประมาณและเปรียบเทียบแพ็กเกจ (Interactive Pricing &amp; Feature Matrix)
              </h3>
            </div>
            <p className="text-xs text-theme-text-muted mt-0.5">
              เลื่อนแถบจำนวนที่นั่ง (Seats) เพื่อคำนวณงบประมาณรายเดือนสด พร้อมเปรียบเทียบฟีเจอร์ความคุ้มค่า 4 รูปแบบ
            </p>
          </div>
          <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 self-start sm:self-auto font-bold">
            Interactive Seat Calculator
          </span>
        </div>

        {/* Dynamic Seat Slider & Live Cost Estimator Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-theme-surface to-purple-500/10 border border-indigo-500/25 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Left: Slider & Presets */}
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                  <Users size={14} className="text-indigo-500" />
                  <span>กำหนดจำนวนที่นั่งที่ต้องการยื่นขอ (Seat Allocation)</span>
                </span>
                <span className="text-sm font-black font-mono px-3 py-1 rounded-xl bg-indigo-600 text-white shadow-xs">
                  {seatCount} ที่นั่ง (Seats)
                </span>
              </div>

              {/* Range Slider */}
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={seatCount}
                onChange={(e) => setSeatCount(Number(e.target.value))}
                className="w-full accent-indigo-600 h-2 bg-theme-bg-page/90 rounded-lg cursor-pointer"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-theme-text-muted font-medium">ทางเลือกแนะนำ:</span>
                <button
                  type="button"
                  onClick={() => setSeatCount(2)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    seatCount === 2
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-theme-bg-page/70 hover:bg-theme-bg-page text-theme-text border-theme-border/60"
                  )}
                >
                  2 ที่นั่ง (ขั้นต่ำ ToS)
                </button>
                <button
                  type="button"
                  onClick={() => setSeatCount(selectedPreset.recommendedSeats || 3)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    seatCount === selectedPreset.recommendedSeats
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-theme-bg-page/70 hover:bg-theme-bg-page text-theme-text border-theme-border/60"
                  )}
                >
                  {selectedPreset.recommendedSeats} ที่นั่ง (สูตร {selectedPreset.deptCode})
                </button>
                <button
                  type="button"
                  onClick={() => setSeatCount(5)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    seatCount === 5
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-theme-bg-page/70 hover:bg-theme-bg-page text-theme-text border-theme-border/60"
                  )}
                >
                  5 ที่นั่ง (ทีมทดลองนำร่อง)
                </button>
                <button
                  type="button"
                  onClick={() => setSeatCount(10)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    seatCount === 10
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-theme-bg-page/70 hover:bg-theme-bg-page text-theme-text border-theme-border/60"
                  )}
                >
                  10 ที่นั่ง (ฝ่ายงานขนาดกลาง)
                </button>
                <button
                  type="button"
                  onClick={() => setSeatCount(20)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    seatCount === 20
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-theme-bg-page/70 hover:bg-theme-bg-page text-theme-text border-theme-border/60"
                  )}
                >
                  20 ที่นั่ง (ทั้งแผนก)
                </button>
              </div>
            </div>

            {/* Right: Estimated Budget Callout */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-theme-surface/85 border border-indigo-500/30 flex flex-col justify-between shrink-0 min-w-[260px] shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-theme-text-muted">
                งบประมาณ Claude Team Standard ({seatCount} ที่นั่ง)
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
                  ฿{(seatCount * 25 * 35).toLocaleString()}
                </span>
                <span className="text-xs text-theme-text-muted">/ เดือน</span>
                <span className="text-[11px] font-mono font-semibold text-theme-text-muted ml-auto">
                  (${seatCount * 25})
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-theme-border/50 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center justify-between font-medium">
                <span>ประหยัดเวลารวม:</span>
                <span className="font-bold font-mono">
                  ~{seatCount * (selectedPreset.prefillForm.targetHoursSaved || 12)} ชม./สัปดาห์
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Packaging Cards (Stripe / Linear Pricing Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {LICENSING_ROUTES.map((route) => {
            const isStandard = route.id === 'subscription_team';
            const colors = ROUTE_COLORS[route.colorScheme];
            const isSelected = selectedRouteId === route.id;

            // Compute dynamic monthly total
            let totalThbText = '';
            let totalUsdText = '';
            let formulaText = '';

            if (route.id === 'subscription_team') {
              const usd = seatCount * 25;
              totalThbText = `฿${(usd * 35).toLocaleString()}`;
              totalUsdText = `$${usd}`;
              formulaText = `$25 × ${seatCount} ที่นั่ง (~฿35/$)`;
            } else if (route.id === 'subscription_premium') {
              const usd = seatCount * 100;
              totalThbText = `฿${(usd * 35).toLocaleString()}`;
              totalUsdText = `$${usd}`;
              formulaText = `$100 × ${seatCount} ที่นั่ง`;
            } else if (route.id === 'api_payg') {
              const usd = Math.round(seatCount * 5);
              totalThbText = `~฿${(usd * 35).toLocaleString()}`;
              totalUsdText = `~$${usd}`;
              formulaText = `เฉลี่ย ~$5/คน ตามปริมาณจริง`;
            } else {
              const seats = Math.max(seatCount, 20);
              const usd = seats * 60;
              totalThbText = `~฿${(usd * 35).toLocaleString()}`;
              totalUsdText = `~$${usd}`;
              formulaText = `สัญญารายปี ขั้นต่ำ 20 ที่นั่ง`;
            }

            return (
              <div
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
                className={cn(
                  'p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between relative group h-full',
                  isSelected
                    ? 'lg:-translate-y-2 lg:scale-[1.02] shadow-xl shadow-indigo-500/20 ring-2 ring-indigo-500/50 border-indigo-500 z-10 bg-gradient-to-b from-indigo-500/15 via-theme-surface to-theme-surface'
                    : 'bg-theme-bg-page/75 hover:bg-theme-bg-page border-theme-border/80 hover:border-theme-border opacity-95 hover:opacity-100 hover:-translate-y-1'
                )}
              >
                {/* Popular / Active Ribbon Badge */}
                {isSelected ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-[10px] font-bold shadow-md shadow-indigo-600/30 whitespace-nowrap flex items-center gap-1.5 border border-white/20">
                    <Sparkles size={11} className="text-amber-300 animate-pulse" />
                    <span>{isStandard ? 'แนะนำสูงสุดสำหรับองค์กร' : 'แพ็กเกจที่คุณเลือก'}</span>
                  </div>
                ) : isStandard ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-theme-surface text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shadow-2xs whitespace-nowrap flex items-center gap-1 border border-indigo-500/30">
                    <Sparkles size={11} className="text-amber-500" />
                    <span>ยอดนิยม</span>
                  </div>
                ) : null}

                {/* Top Info */}
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide whitespace-nowrap shrink-0',
                        colors.badge
                      )}
                    >
                      {route.badge}
                    </span>
                    <span className="text-[10px] text-theme-text-muted font-medium truncate text-right">
                      {route.billingType.split('(')[0].trim()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-theme-text leading-snug tracking-tight">
                      {route.name}
                    </h4>
                    {/* Dynamic Cost Projection for Selected Seats */}
                    <div className="mt-2.5 p-3 rounded-xl bg-theme-bg-page/90 border border-theme-border/70 shadow-2xs">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-theme-text tabular-nums">
                          {totalThbText}
                        </span>
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {totalUsdText} / ด.
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-theme-text-muted border-t border-theme-border/40 pt-1">
                        <span>{formulaText}</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          ({seatCount} ที่นั่ง)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-theme-border/50">
                    <p className="text-xs text-theme-text-muted leading-relaxed">
                      <strong className="text-theme-text font-bold">เหมาะกับ:</strong> {route.bestFor}
                    </p>
                  </div>

                  {/* Pros List */}
                  <div className="space-y-1.5 pt-1 min-h-[140px]">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check size={13} />
                      <span>จุดเด่นสำคัญ:</span>
                    </span>
                    <ul className="space-y-1.5">
                      {route.pros.slice(0, 3).map((pro, pIdx) => (
                        <li key={pIdx} className="text-xs text-theme-text flex items-start gap-1.5 leading-relaxed">
                          <CheckCircle2 size={13} className="text-emerald-500 font-bold shrink-0 mt-0.5" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cons List */}
                  <div className="space-y-1 pt-1 min-h-[75px]">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      <span>ข้อควรระวัง:</span>
                    </span>
                    <ul className="space-y-1">
                      {route.cons.slice(0, 2).map((con, cIdx) => (
                        <li key={cIdx} className="text-xs text-theme-text-muted flex items-start gap-1.5 leading-relaxed">
                          <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bottom Action & Security Note */}
                <div className="mt-4 pt-3 border-t border-theme-border/50 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-theme-text-muted flex items-center gap-1 line-clamp-1">
                      <Shield size={11} className={colors.text} />
                      <span>{route.securityLevel.split(',')[0]}</span>
                    </span>
                    <span className={cn('font-mono font-semibold text-[11px]', colors.text)}>
                      {route.id === 'subscription_team'
                        ? 'Team 2+'
                        : route.id === 'subscription_premium'
                        ? '5x Quota'
                        : route.id === 'api_payg'
                        ? 'Pay-As-You-Go'
                        : '20+ Seats'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const mappedLicensingType: DepartmentAiPreset['licensingType'] =
                        route.id === 'subscription_team'
                          ? 'Subscription (Claude Team Standard)'
                          : route.id === 'subscription_premium'
                          ? 'Subscription (Claude Team Premium / Code)'
                          : route.id === 'api_payg'
                          ? 'Pay-Per-Token API / Internal Portal'
                          : 'Hybrid (Team Seat + Internal Portal)';

                      const tailoredPreset: DepartmentAiPreset = {
                        ...selectedPreset,
                        recommendedSeats: seatCount,
                        licensingType: mappedLicensingType,
                        prefillForm: {
                          ...selectedPreset.prefillForm,
                          recommendedSeats: seatCount
                        }
                      };
                      handleApply(tailoredPreset);
                    }}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95",
                      isSelected
                        ? "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-white/20"
                        : "bg-theme-bg-page hover:bg-theme-surface text-theme-text border border-theme-border/80 hover:border-indigo-500/40"
                    )}
                  >
                    <span>{isSelected ? 'เลือกแพ็กเกจนี้ไปยื่นขอ FM-001' : 'เลือกแพ็กเกจนี้'}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accordion Toggle: Full Feature Comparison Matrix */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsFeatureMatrixOpen(!isFeatureMatrixOpen)}
            className="w-full p-4 rounded-2xl bg-theme-surface/75 hover:bg-theme-surface border border-theme-border/80 hover:border-indigo-500/40 flex items-center justify-between text-xs font-bold text-theme-text transition-all cursor-pointer shadow-xs group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shadow-2xs">
                <Layers size={16} />
              </div>
              <div className="text-left">
                <span className="text-sm sm:text-base font-bold text-theme-text block">
                  {isFeatureMatrixOpen
                    ? 'ตารางเปรียบเทียบฟีเจอร์ละเอียด 4 แพ็กเกจ (Detailed Feature Matrix)'
                    : '🔍 เปิดกางดูตารางเปรียบเทียบฟีเจอร์ละเอียดทุกมิติ (Full Feature Matrix)'}
                </span>
                <span className="text-xs text-theme-text-muted font-normal mt-0.5 block">
                  เปรียบเทียบ 12 มิติ: โมเดล, โควตา, ความปลอดภัย ZDR, สิทธิ์ใช้หลายเครื่อง, และระบบแชร์ความรู้
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
              <span>{isFeatureMatrixOpen ? 'ย่อตาราง' : 'คลิกเพื่อกางดู'}</span>
              {isFeatureMatrixOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {/* Full Comparison Table Content */}
          {isFeatureMatrixOpen && (
            <div className="mt-3 rounded-2xl border border-theme-border/80 bg-theme-surface/60 overflow-hidden shadow-sm animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-theme-text border-collapse">
                  <thead>
                    <tr className="border-b border-theme-border/80 bg-theme-bg-page/90 text-[11px] font-bold text-theme-text-muted">
                      <th className="p-3.5 sm:p-4 min-w-[200px]">หัวข้อเปรียบเทียบ (Feature)</th>
                      <th className="p-3.5 sm:p-4 min-w-[190px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border-x border-indigo-500/20">
                        ⭐ Claude Team Standard
                      </th>
                      <th className="p-3.5 sm:p-4 min-w-[190px]">Claude Team Premium</th>
                      <th className="p-3.5 sm:p-4 min-w-[190px]">พอร์ทัลกลาง AI Sandbox</th>
                      <th className="p-3.5 sm:p-4 min-w-[190px]">Claude Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border/50">
                    {/* Category: Models & Processing */}
                    <tr className="bg-theme-bg-page/40 font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                      <td colSpan={5} className="px-4 py-2 uppercase tracking-wider">
                        1. โมเดลและขีดความสามารถประมวลผล (AI Models &amp; Quotas)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">โมเดลหลักที่ใช้ได้</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-medium">
                        Claude 3.5 Sonnet &amp; 3.5 Haiku
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">Sonnet, Haiku, Opus</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">Claude, GPT-4o, Gemini, DeepSeek</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">Claude 3.5 Sonnet &amp; Opus</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">โควตาข้อความรายวัน (Rate Limits)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-medium text-emerald-600 dark:text-emerald-400">
                        มาตรฐานทีม (~100 ข้อความ/5 ชม.)
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted font-bold text-indigo-500">
                        โควตาสูงพิเศษ 5 เท่า
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">ไม่จำกัด (จ่ายตาม Token จริง)</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted font-bold">โควตาระดับองค์กรสูงสุด</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">Claude Code CLI &amp; Terminal Coding</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 text-theme-text-muted">
                        ❌ ต้องต่อผ่าน API เสริม
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ รองรับเต็มรูปแบบ
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">❌ ใช้งานผ่านเว็บพอร์ทัล</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">✅ รองรับผ่าน Enterprise API</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">ความยาวบริบท (Context Window)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-mono">
                        200,000 Tokens (~500 หน้า)
                      </td>
                      <td className="p-3.5 sm:p-4 font-mono text-theme-text-muted">200,000 Tokens</td>
                      <td className="p-3.5 sm:p-4 font-mono text-theme-text-muted">128K - 2,000,000 Tokens</td>
                      <td className="p-3.5 sm:p-4 font-mono font-bold text-indigo-500">500,000 Tokens (ขยายพิเศษ)</td>
                    </tr>

                    {/* Category: Team Collaboration */}
                    <tr className="bg-theme-bg-page/40 font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                      <td colSpan={5} className="px-4 py-2 uppercase tracking-wider">
                        2. การทำงานร่วมกันในทีม (Collaboration &amp; Knowledge Hub)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">คลังโครงการกลาง (Shared Projects)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ มี (แชร์ Prompt &amp; SOP ในฝ่าย)
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ มี (พร้อมแชร์ Code Snippets)
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">❌ ไม่มี (แชตแยกบุคคล)</td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ มี (ระบบ RBAC ระดับองค์กร)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">สิทธิ์ล็อกอินข้ามอุปกรณ์ส่วนบุคคล</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
                        ✅ PC + โน้ตบุ๊ก + มือถือ (ห้ามแชร์รหัส)
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">✅ ข้ามอุปกรณ์ส่วนบุคคลได้</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">✅ เปิดได้ทุกเบราว์เซอร์</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">✅ จัดการผ่าน Corporate SSO</td>
                    </tr>

                    {/* Category: Security & Governance */}
                    <tr className="bg-theme-bg-page/40 font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                      <td colSpan={5} className="px-4 py-2 uppercase tracking-wider">
                        3. ความมั่นคงปลอดภัย &amp; กฎหมาย (Security &amp; Compliance)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">การันตีไม่นำข้อมูลไปเทรน AI (Zero Training)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ รับประกัน 100% ตาม ToS
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">✅ รับประกัน 100%</td>
                      <td className="p-3.5 sm:p-4 text-emerald-600 dark:text-emerald-400">✅ ข้อมูลอยู่บน Internal Gateway</td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">✅ สัญญา Enterprise ZDR</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">การกรองข้อมูลส่วนบุคคล (PII Masking)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 text-theme-text-muted">
                        ผู้ใช้คัดกรองตามแนวปฏิบัติฝ่าย
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">ผู้ใช้คัดกรองตามแนวปฏิบัติ</td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ มีเกราะตรวจจับ Mask อัตโนมัติ
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">มีนโยบาย DLP องค์กรกำกับ</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">ระบบล็อกอินองค์กร (Corporate SSO / Azure AD)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 text-theme-text-muted">
                        ❌ ล็อกอินด้วยอีเมลองค์กร
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">❌ ล็อกอินด้วยอีเมลองค์กร</td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ ซิงค์ระบบยืนยันตัวตนบริษัท
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ รองรับ Azure AD / Okta SCIM
                      </td>
                    </tr>

                    {/* Category: Terms & Billing */}
                    <tr className="bg-theme-bg-page/40 font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                      <td colSpan={5} className="px-4 py-2 uppercase tracking-wider">
                        4. เงื่อนไขสัญญาและงบประมาณ (Commitment &amp; Billing)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">เงื่อนไขจำนวนที่นั่งขั้นต่ำ</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        ขั้นต่ำ 2 ที่นั่ง (Seats)
                      </td>
                      <td className="p-3.5 sm:p-4 font-mono text-theme-text-muted">ขั้นต่ำ 2 ที่นั่ง</td>
                      <td className="p-3.5 sm:p-4 font-mono text-emerald-600 dark:text-emerald-400">ไม่มีขั้นต่ำ (1 คนก็ใช้ได้)</td>
                      <td className="p-3.5 sm:p-4 font-mono text-rose-500 font-bold">ขั้นต่ำ 20 ที่นั่ง (สัญญารายปี)</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">ความคุ้มค่าและฝ่ายงานที่แนะนำ</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-bold text-theme-text">
                        🏆 คุ้มค่าสูงสุดสำหรับ 6 ฝ่ายงานเอกสาร (บัญชี, จัดซื้อ, กฎหมาย, HR, ตรวจสอบ, การตลาด)
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">ฝ่ายไอที (DIT) &amp; นักพัฒนาซอฟต์แวร์</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">พนักงานทั่วไปที่ใช้แปลภาษา/ค้นคว้าเป็นครั้งคราว</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">คณะผู้บริหาร &amp; AI Center of Excellence</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>



      {/* ------------------------------------------------------------- */}
      {/* SECTION 3: Multi-Provider AI Model Matrix (AI_MODEL_MATRIX)   */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-500" />
              <h3 className="text-base sm:text-lg font-bold text-theme-text">
                3. เปรียบเทียบโมเดล 4 ค่ายชั้นนำ (Anthropic • Google • OpenAI • DeepSeek)
              </h3>
            </div>
            <p className="text-xs text-theme-text-muted mt-0.5">
              ประเมินจุดเด่นและลักษณะงานที่เหมาะสม เพื่อเลือกโมเดลที่คุ้มค่าต่องานของแต่ละฝ่าย
            </p>
          </div>
          <span className="text-[11px] font-mono text-theme-text-muted bg-theme-bg-page/70 px-2 py-1 rounded-md border border-theme-border/50 self-start sm:self-auto">
            4 Leading Providers
          </span>
        </div>

        {/* Model Comparison Cards (4 Columns Responsive) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {AI_MODEL_MATRIX.map((model) => {
            const isSonnet = model.id === 'claude-sonnet';

            return (
              <div
                key={model.id}
                className={cn(
                  'p-4 sm:p-5 rounded-2xl border flex flex-col justify-between transition-all duration-200',
                  'bg-theme-bg-page/60 hover:bg-theme-bg-page',
                  isSonnet
                    ? 'border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-xs'
                    : 'border-theme-border/70 hover:border-theme-border'
                )}
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      {model.provider}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-theme-surface border border-theme-border/60 text-theme-text-muted truncate max-w-[150px] text-right">
                      {model.flagshipBadge}
                    </span>
                  </div>

                  {/* Model Name */}
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-theme-text leading-snug">
                      {model.modelName}
                    </h4>
                    <p className="text-xs font-mono text-theme-text-muted mt-0.5">
                      ความยาวบริบท: {model.contextWindow}
                    </p>
                  </div>

                  {/* Business Highlight Box */}
                  <div className="p-2.5 rounded-xl bg-indigo-500/5 dark:bg-indigo-950/30 border border-indigo-500/20 space-y-1">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                      ความเก่งเด่นในงานจริง
                    </span>
                    <p className="text-xs text-theme-text font-medium leading-relaxed">
                      {model.businessHighlight}
                    </p>
                  </div>

                  {/* Strengths */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-theme-text flex items-center gap-1">
                      <Sparkles size={12} className="text-indigo-500" />
                      <span>จุดเด่นสำคัญ:</span>
                    </span>
                    <ul className="space-y-1.5">
                      {model.strengths.slice(0, 3).map((str, sIdx) => (
                        <li key={sIdx} className="text-xs text-theme-text-muted flex items-start gap-1.5 leading-relaxed">
                          <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Ideal Tasks */}
                  <div className="pt-2 border-t border-theme-border/50">
                    <p className="text-xs text-theme-text-muted leading-relaxed">
                      <strong className="text-theme-text font-bold">งานที่เหมาะที่สุด:</strong> {model.idealTasks}
                    </p>
                  </div>
                </div>

                {/* Bottom Route Recommendation */}
                <div className="mt-4 pt-2.5 border-t border-theme-border/50 flex items-center justify-between text-xs">
                  <span className="text-theme-text-muted text-[11px]">ช่องทางจัดสรร:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                    {model.recommendedRoute}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
        </>
      )}
    </div>
  );
}
