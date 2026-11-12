import React, { useState, useMemo } from 'react';
import {
  Calculator,
  FileText,
  Sparkles,
  Code2,
  Shield,
  Lock,
  BarChart3,
  Image as ImageIcon,
  Database,
  Users,
  Clock,
  Globe,
  Building,
  Scale,
  BookOpen,
  UserCheck,
  CalendarCheck,
  Zap,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  Check,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Building2,
  Laptop,
  Layers,
  Cpu,
  Coins
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  WIZARD_QUESTIONS,
  evaluateAiNeeds,
  getSuggestedDepartmentPreset,
  type WizardAnswers,
  type AssessmentResult,
  type WizardQuestion
} from './aiQuestionnaireData';
import { getLicensingRouteById } from './aiDepartmentPresets';

export interface AiNeedsAssessmentWizardProps {
  onComplete: (result: AssessmentResult) => void;
  onApplyToFm001?: (result: AssessmentResult) => void;
  onSwitchToDepartmentPresets?: (deptId?: string) => void;
  hideHeader?: boolean;
}

// Icon dictionary for safe dynamic rendering
const ICON_COMPONENT_MAP: Record<string, React.ElementType> = {
  Calculator,
  FileText,
  Sparkles,
  Code2,
  Scale,
  Globe,
  Building,
  Shield,
  Lock,
  BarChart3,
  Image: ImageIcon,
  Database,
  BookOpen,
  UserCheck,
  Users,
  Clock,
  CalendarCheck,
  Zap,
  Laptop
};

function renderWizardIcon(iconName: string, className?: string) {
  const IconComponent = ICON_COMPONENT_MAP[iconName] || Sparkles;
  return <IconComponent className={className} />;
}

// Step labels for the navigation progress bar
const STEP_LABELS = [
  'เป้าหมายงาน',
  'ระดับความลับ',
  'ลักษณะเฉพาะ',
  'การทำงานร่วม',
  'ปริมาณการใช้'
];

export default function AiNeedsAssessmentWizard({
  onComplete,
  onApplyToFm001,
  onSwitchToDepartmentPresets,
  hideHeader = false
}: AiNeedsAssessmentWizardProps) {
  // Current active step (1 to 5)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // User answers accumulator
  const [answers, setAnswers] = useState<WizardAnswers>({});

  // Computed result when completed
  const [result, setResult] = useState<AssessmentResult | null>(null);

  // Success indicator when auto-filled
  const [isApplied, setIsApplied] = useState<boolean>(false);

  // Active question object
  const activeQuestion: WizardQuestion = useMemo(() => {
    return (
      WIZARD_QUESTIONS.find((q) => q.stepNumber === currentStep) ||
      WIZARD_QUESTIONS[0]
    );
  }, [currentStep]);

  // Current answer for the active question
  const currentAnswerKey = activeQuestion.id as keyof WizardAnswers;
  const selectedOptionId = answers[currentAnswerKey];

  // Check if current step has an answer selected
  const isCurrentStepAnswered = Boolean(selectedOptionId);

  // Handlers
  const handleSelectOption = (questionKey: keyof WizardAnswers, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: optionId
    }));
  };

  const handleNextStep = () => {
    if (!isCurrentStepAnswered) return;

    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Completed all 5 steps! Evaluate answers
      const evaluation = evaluateAiNeeds(answers);
      setResult(evaluation);
      onComplete(evaluation);
    }
  };

  const handlePrevStep = () => {
    if (result) {
      // Go back from results view to step 5
      setResult(null);
      setCurrentStep(5);
      return;
    }
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleJumpToStep = (stepNumber: number) => {
    if (stepNumber <= currentStep || result) {
      setResult(null);
      setCurrentStep(stepNumber);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setResult(null);
    setCurrentStep(1);
    setIsApplied(false);
  };

  const handleApply = () => {
    if (!result) return;
    setIsApplied(true);
    if (onApplyToFm001) {
      onApplyToFm001(result);
    } else {
      onComplete(result);
    }
    setTimeout(() => {
      setIsApplied(false);
    }, 3000);
  };

  // Route metadata lookup for the results view
  const licensingRoute = useMemo(() => {
    return result ? getLicensingRouteById(result.matchedRouteId) : undefined;
  }, [result]);

  const suggestedPreset = useMemo(() => {
    return result?.suggestedDepartmentId
      ? getSuggestedDepartmentPreset(result.suggestedDepartmentId)
      : undefined;
  }, [result?.suggestedDepartmentId]);

  return (
    <div className="space-y-6 text-theme-text max-w-5xl mx-auto">
      {/* ------------------------------------------------------------- */}
      {/* TOP HERO BANNER (Hidden when embedded in preset matcher)      */}
      {/* ------------------------------------------------------------- */}
      {!hideHeader && (
        <div className="p-6 md:p-7 rounded-2xl bg-gradient-to-br from-indigo-950/25 via-theme-surface to-purple-950/20 border border-indigo-500/25 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-xs font-semibold">
                <Sparkles size={13} className="text-indigo-400" />
                <span>AI Needs Assessment Wizard • แบบประเมินสิทธิ์ 5 ขั้นตอน</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-theme-text">
                ระบบประเมินความต้องการและจับคู่สิทธิ์ AI องค์กร
              </h2>
              <p className="text-xs md:text-sm text-theme-text-muted max-w-2xl leading-relaxed">
                ตอบคำถามสั้นๆ 5 มิติเพื่อวิเคราะห์สถาปัตยกรรมใบอนุญาต (Licensing Track)
                และโมเดล AI ที่คุ้มค่า สอดคล้องตามระเบียบ WI-PI-AI-001 พร้อมส่งข้อมูลไปกรอกแบบฟอร์มขอใช้งาน AIอัตโนมัติ
              </p>
            </div>

            {onSwitchToDepartmentPresets && (
              <button
                type="button"
                onClick={() => onSwitchToDepartmentPresets()}
                className="px-3.5 py-2 rounded-xl bg-theme-surface/70 hover:bg-theme-surface border border-theme-border/80 text-theme-text text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <Compass size={14} className="text-amber-500" />
                <span>หรือดูพรีเซ็ตตามฝ่ายงาน</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5-STEP INTERACTIVE PROGRESS BAR                                */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-theme-surface/70 border border-theme-border/80 backdrop-blur-md shadow-xs space-y-4">
        {/* Top Header Row of Step Bar */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-semibold text-theme-text">
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/25 font-mono text-[11px]">
              {result ? 'Completed' : `Step ${currentStep} of 5`}
            </span>
            <span className="text-theme-text-secondary hidden sm:inline">
              {result ? 'ผลการประเมินสิทธิ์สมบูรณ์' : activeQuestion.title}
            </span>
          </div>
          <div className="text-[11px] font-mono font-medium text-theme-text-muted tabular-nums">
            {result ? '100%' : `${(currentStep - 1) * 20}%`} เสร็จสิ้น
          </div>
        </div>

        {/* Step Dots & Connector Line */}
        <div className="relative flex items-center justify-between px-2 sm:px-6">
          {/* Background Track Line */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-theme-surface-tertiary rounded-full -z-0" />

          {/* Glowing Animated Progress Line */}
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-indigo-500 via-primary to-emerald-400 rounded-full transition-all duration-500 ease-out -z-0"
            style={{
              width: result
                ? 'calc(100% - 3rem)'
                : `calc(${((currentStep - 1) / 4) * 100}% * ((100% - 3rem) / 100%))`
            }}
          />

          {/* 5 Step Indicator Nodes */}
          {STEP_LABELS.map((label, index) => {
            const stepNum = index + 1;
            const isCompleted = result ? true : stepNum < currentStep;
            const isCurrent = !result && stepNum === currentStep;
            const canClick = isCompleted || isCurrent;

            return (
              <div
                key={stepNum}
                className="relative z-10 flex flex-col items-center group"
              >
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => handleJumpToStep(stepNum)}
                  className={cn(
                    'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300',
                    isCompleted &&
                      'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25 hover:scale-105 cursor-pointer',
                    isCurrent &&
                      'bg-primary text-white ring-4 ring-primary/25 shadow-md shadow-primary/30 scale-110',
                    !isCompleted &&
                      !isCurrent &&
                      'bg-theme-surface-secondary text-theme-text-muted border border-theme-border/80 cursor-not-allowed'
                  )}
                  aria-label={`ไปที่ขั้นตอนที่ ${stepNum}: ${label}`}
                >
                  {isCompleted ? (
                    <Check size={14} className="stroke-[3]" />
                  ) : (
                    <span>{stepNum}</span>
                  )}
                </button>

                {/* Step Subtitle Text */}
                <span
                  className={cn(
                    'text-[10px] sm:text-[11px] font-medium mt-1.5 transition-colors whitespace-nowrap',
                    isCurrent && 'text-primary font-bold',
                    isCompleted && 'text-emerald-500 dark:text-emerald-400 font-semibold',
                    !isCompleted && !isCurrent && 'text-theme-text-muted'
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA: QUESTION STEP OR RESULTS VIEW              */}
      {/* ------------------------------------------------------------- */}
      {!result ? (
        /* ----------------------------------------------------------- */
        /* QUESTION CARD                                               */
        /* ----------------------------------------------------------- */
        <div className="p-6 md:p-8 rounded-2xl bg-theme-surface/75 border border-theme-border/80 backdrop-blur-md shadow-sm space-y-6 transition-all">
          {/* Question Title & Subtitle */}
          <div className="space-y-1.5 border-b border-theme-border/50 pb-5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-primary uppercase tracking-wide">
              <span>คำถามที่ {activeQuestion.stepNumber} จาก 5</span>
              <span>•</span>
              <span>{STEP_LABELS[activeQuestion.stepNumber - 1]}</span>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-theme-text">
              {activeQuestion.title}
            </h3>
            <p className="text-xs md:text-sm text-theme-text-muted leading-relaxed">
              {activeQuestion.subtitle}
            </p>
          </div>

          {/* Interactive Option Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeQuestion.options.map((option) => {
              const isSelected = selectedOptionId === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectOption(currentAnswerKey, option.id)}
                  className={cn(
                    'group relative p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm scale-[1.01]'
                      : 'border-theme-border/70 bg-theme-surface/50 hover:border-primary/50 hover:bg-theme-surface hover:shadow-xs active:scale-[0.99]'
                  )}
                >
                  <div>
                    {/* Top Row: Icon, Title, Badge, and Check Circle */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200',
                            isSelected
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-theme-surface-secondary text-primary/80 border border-theme-border/60 group-hover:text-primary group-hover:border-primary/40'
                          )}
                        >
                          {renderWizardIcon(option.iconName, 'w-5 h-5')}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm sm:text-base font-bold text-theme-text group-hover:text-primary transition-colors">
                            {option.label}
                          </div>
                          {option.badge && (
                            <span
                              className={cn(
                                'text-[11px] px-2.5 py-0.5 rounded-full font-semibold inline-block border',
                                isSelected
                                  ? 'bg-primary/20 text-primary-hover border-primary/30'
                                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                              )}
                            >
                              {option.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selection Radio / Checkmark Indicator */}
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 mt-0.5',
                          isSelected
                            ? 'bg-primary text-white shadow-xs'
                            : 'border border-theme-border/80 group-hover:border-primary/60'
                        )}
                      >
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </div>

                    {/* Option Detailed Description */}
                    <p className="text-xs sm:text-[13px] text-theme-text-muted mt-2.5 leading-relaxed pl-0 sm:pl-13">
                      {option.description}
                    </p>
                  </div>

                  {/* Tags Pill Footer */}
                  {option.tags && option.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3.5 pt-2.5 border-t border-theme-border/30 pl-0 sm:pl-13">
                      {option.tags.map((tag, tIndex) => (
                        <span
                          key={tIndex}
                          className={cn(
                            'text-[11px] px-2.5 py-0.5 rounded-md font-mono font-medium transition-colors',
                            isSelected
                              ? 'bg-primary/20 text-primary-hover border border-primary/30'
                              : 'bg-theme-bg-page/80 text-theme-text-secondary border border-theme-border/60'
                          )}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Step Navigation Controls Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-theme-border/50">
            {/* Back Button */}
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={handlePrevStep}
              className={cn(
                'w-full sm:w-auto px-4 py-2.5 rounded-xl border border-theme-border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                currentStep === 1
                  ? 'opacity-40 cursor-not-allowed bg-theme-surface-secondary/40 text-theme-text-muted'
                  : 'bg-theme-surface hover:bg-theme-surface-secondary text-theme-text cursor-pointer active:scale-95'
              )}
            >
              <ArrowLeft size={14} />
              <span>ย้อนกลับ (Back)</span>
            </button>

            {/* Helper status text */}
            <div className="text-center sm:text-left text-xs text-theme-text-muted">
              {isCurrentStepAnswered ? (
                <span className="text-emerald-500 dark:text-emerald-400 font-medium inline-flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  <span>บันทึกคำตอบเรียบร้อยแล้ว กดถัดไปเพื่อดำเนินการต่อ</span>
                </span>
              ) : (
                <span className="text-amber-500/90 inline-flex items-center gap-1.5">
                  <AlertTriangle size={13} />
                  <span>โปรดเลือกหนึ่งตัวเลือกเพื่อไปยังขั้นตอนถัดไป</span>
                </span>
              )}
            </div>

            {/* Next / Submit Button */}
            <button
              type="button"
              disabled={!isCurrentStepAnswered}
              onClick={handleNextStep}
              className={cn(
                'w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all',
                !isCurrentStepAnswered
                  ? 'opacity-40 cursor-not-allowed bg-theme-surface-secondary text-theme-text-muted border border-theme-border'
                  : currentStep === 5
                  ? 'bg-gradient-to-r from-indigo-600 via-primary to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-primary/25 active:scale-95 cursor-pointer animate-pulse-slow'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 cursor-pointer'
              )}
            >
              <span>
                {currentStep === 5
                  ? 'ดูผลลัพธ์การจับคู่ AI (View Match Result)'
                  : 'ขั้นตอนถัดไป (Next Step)'}
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* ----------------------------------------------------------- */
        /* RESULTS VIEW: MATCHED ROUTE & COMPREHENSIVE BREAKDOWN       */
        /* ----------------------------------------------------------- */
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          {/* 1. CELEBRATION HERO BADGE & TITLE */}
          <div
            className={cn(
              'p-6 md:p-8 rounded-2xl border shadow-md space-y-4 relative overflow-hidden',
              result.matchedRouteId === 'enterprise_zdr' &&
                'bg-gradient-to-br from-emerald-950/30 via-theme-surface to-teal-950/20 border-emerald-500/40',
              result.matchedRouteId === 'subscription_premium' &&
                'bg-gradient-to-br from-purple-950/30 via-theme-surface to-indigo-950/20 border-purple-500/40',
              result.matchedRouteId === 'api_payg' &&
                'bg-gradient-to-br from-amber-950/30 via-theme-surface to-orange-950/20 border-amber-500/40',
              result.matchedRouteId === 'subscription_team' &&
                'bg-gradient-to-br from-indigo-950/30 via-theme-surface to-sky-950/20 border-indigo-500/40'
            )}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                <CheckCircle2 size={14} />
                <span>🎯 ผลการประเมินสิทธิ์และโมเดล AI ที่เหมาะสมกับงานของคุณ</span>
              </div>

              {licensingRoute && (
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-md bg-theme-surface-secondary/80 border border-theme-border/80 text-theme-text-secondary">
                  {licensingRoute.name}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-theme-text">
                {result.summaryTitle}
              </h3>
              <p className="text-xs md:text-sm text-theme-text-muted leading-relaxed max-w-3xl">
                {result.matchReason}
              </p>
            </div>
          </div>

          {/* 2. MATCH METRICS & SPECIFICATIONS CARD (4 KPI Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Metric 1: Licensing Track */}
            <div className="p-4 rounded-xl bg-theme-surface/75 border border-theme-border/80 shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-theme-text-muted text-[11px] font-medium">
                <Layers size={14} className="text-indigo-400" />
                <span>ช่องทางจัดสรรสิทธิ์</span>
              </div>
              <div className="text-sm font-bold text-theme-text truncate">
                {licensingRoute?.name || result.matchedRouteId}
              </div>
              <p className="text-[11px] text-theme-text-muted">
                {licensingRoute?.billingType || 'ตามระเบียบองค์กร'}
              </p>
            </div>

            {/* Metric 2: Primary AI Model */}
            <div className="p-4 rounded-xl bg-theme-surface/75 border border-theme-border/80 shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-theme-text-muted text-[11px] font-medium">
                <Cpu size={14} className="text-purple-400" />
                <span>โมเดล AI หลักที่แนะนำ</span>
              </div>
              <div className="text-sm font-bold text-theme-text truncate">
                {result.primaryModel}
              </div>
              <p className="text-[11px] text-theme-text-muted truncate">
                รอง: {result.secondaryModel}
              </p>
            </div>

            {/* Metric 3: Estimated Cost */}
            <div className="p-4 rounded-xl bg-theme-surface/75 border border-theme-border/80 shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-theme-text-muted text-[11px] font-medium">
                <Coins size={14} className="text-amber-400" />
                <span>ประมาณการงบประมาณ</span>
              </div>
              <div className="text-sm font-bold text-theme-text truncate">
                {result.estimatedCost}
              </div>
              <p className="text-[11px] text-theme-text-muted">
                ไม่มีค่าธรรมเนียมแอบแฝง
              </p>
            </div>

            {/* Metric 4: Recommended Seats */}
            <div className="p-4 rounded-xl bg-theme-surface/75 border border-theme-border/80 shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-theme-text-muted text-[11px] font-medium">
                <Users size={14} className="text-emerald-400" />
                <span>จำนวนที่นั่งแนะนำ (Seats)</span>
              </div>
              <div className="text-sm font-bold text-theme-text">
                {result.recommendedSeats} ที่นั่ง
              </div>
              <p className="text-[11px] text-theme-text-muted">
                ขยายหรือปรับลดได้ตามรอบบิล
              </p>
            </div>
          </div>

          {/* 3. THREE KEY BREAKDOWN SECTIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Section 1: Why This Fits */}
            <div className="p-5 rounded-2xl bg-theme-surface/75 border border-theme-border/80 shadow-xs space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-wide">
                  <Sparkles size={15} />
                  <span>1. ทำไมถึงเหมาะกับคุณ (Why This Fits)</span>
                </div>
                <p className="text-xs text-theme-text-secondary leading-relaxed">
                  {result.matchReason}
                </p>
                <div className="space-y-2 pt-2 border-t border-theme-border/40">
                  <div className="text-[11px] font-semibold text-theme-text">
                    คุณสมบัติเด่นของโมเดลนี้:
                  </div>
                  <ul className="space-y-1.5">
                    {result.keyFeatures.map((feat, fIdx) => (
                      <li
                        key={fIdx}
                        className="text-xs text-theme-text-muted flex items-start gap-2"
                      >
                        <Check size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 2: Security & ZDR Policy */}
            <div className="p-5 rounded-2xl bg-theme-surface/75 border border-theme-border/80 shadow-xs space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-wide">
                  <Shield size={15} />
                  <span>2. ข้อบังคับความปลอดภัย & ZDR</span>
                </div>

                {/* Compliance Alert Box */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                    <AlertTriangle size={13} />
                    <span>ระเบียบ WI-PI-AI-001</span>
                  </div>
                  <p className="text-[11px] text-theme-text-muted leading-relaxed">
                    {result.complianceNotice}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-theme-border/40">
                  <div className="text-[11px] font-semibold text-theme-text">
                    แนวทางปฏิบัติ Zero Data Retention & Masking:
                  </div>
                  <ul className="space-y-1.5 text-xs text-theme-text-muted">
                    <li className="flex items-start gap-2">
                      <Lock size={13} className="text-indigo-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Zero Data Training:</strong> โมเดลระดับองค์กรไม่นำข้อมูลคำสั่งไปเทรนโมเดลสาธารณะ
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Data Masking:</strong> เซนเซอร์เลขบัญชี, บัตรประชาชน และชื่อคู่ค้าก่อนอัปโหลดเสมอ
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 3: Multi-Device & Sharing Rules */}
            <div className="p-5 rounded-2xl bg-theme-surface/75 border border-theme-border/80 shadow-xs space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-500 uppercase tracking-wide">
                  <Laptop size={15} />
                  <span>3. ทริคการใช้งานหลายเครื่อง (Device & Sharing)</span>
                </div>

                <p className="text-xs text-theme-text-secondary leading-relaxed">
                  {result.multiDeviceRule}
                </p>

                <div className="space-y-2 pt-2 border-t border-theme-border/40">
                  <div className="text-[11px] font-semibold text-theme-text">
                    การปฏิบัติตามข้อตกลง ToS & สิทธิการใช้งาน:
                  </div>
                  <ul className="space-y-1.5 text-xs text-theme-text-muted">
                    <li className="flex items-start gap-2">
                      <Check size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>
                        <strong>1 User Multi-Device OK:</strong> ล็อกอินคอมพิวเตอร์และมือถือส่วนตัวได้พร้อมกัน
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Users size={13} className="text-indigo-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Shared Projects:</strong> แบ่งปันผังบัญชี สัญญา และคู่มือผ่านคลังกลางแทนการแจกรหัส
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 4. DEPARTMENT PRESET BRIDGE (If matching department preset exists) */}
          {suggestedPreset && (
            <div className="p-4 rounded-xl bg-theme-surface-secondary/70 border border-theme-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-theme-text">
                    สอดคล้องกับพรีเซ็ตประจำฝ่าย: {suggestedPreset.deptName} ({suggestedPreset.deptCode})
                  </div>
                  <p className="text-[11px] text-theme-text-muted mt-0.5">
                    กำลังคน {suggestedPreset.headcountActual} คน • จัดสรรเริ่มต้น {suggestedPreset.recommendedSeats} ที่นั่ง ({suggestedPreset.licensingType})
                  </p>
                </div>
              </div>

              {onSwitchToDepartmentPresets && (
                <button
                  type="button"
                  onClick={() => onSwitchToDepartmentPresets(suggestedPreset.id)}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 flex items-center gap-1 shrink-0 self-end sm:self-auto cursor-pointer"
                >
                  <span>ดูรายละเอียดพรีเซ็ตฝ่ายนี้</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}

          {/* 5. ACTION BUTTONS FOOTER */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-theme-border/60">
            {/* Secondary Action: Reset Questionnaire */}
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-theme-border/80 bg-theme-surface/70 hover:bg-theme-surface text-theme-text text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <RotateCw size={14} className="text-theme-text-muted" />
              <span>ทำแบบประเมินใหม่อีกครั้ง (Reset)</span>
            </button>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Tertiary Action: Switch to Department Presets */}
              {onSwitchToDepartmentPresets && (
                <button
                  type="button"
                  onClick={() => onSwitchToDepartmentPresets(result.suggestedDepartmentId)}
                  className="px-4 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <Compass size={14} />
                  <span>หรือเลือกดูแนวทางตามฝ่ายงาน (Switch to Presets)</span>
                </button>
              )}

              {/* Primary Action: Send to FM-001 */}
              <button
                type="button"
                onClick={handleApply}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95',
                  isApplied
                    ? 'bg-emerald-600 shadow-emerald-600/25'
                    : 'bg-gradient-to-r from-orange-600 via-amber-600 to-indigo-600 hover:from-orange-500 hover:to-indigo-500 shadow-orange-600/20'
                )}
              >
                {isApplied ? (
                  <>
                    <Check size={14} className="stroke-[3]" />
                    <span>ส่งข้อมูลลงแบบฟอร์มขอใช้งาน AIเรียบร้อยแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} className="fill-current text-amber-200" />
                    <span>⚡ ส่งผลประเมินนี้ไปยังแบบฟอร์มขอใช้งาน AI (Auto-fill Request)</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
