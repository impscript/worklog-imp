import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Laptop,
  Bot,
  Target,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LIFECYCLE_STEPS, type StepDetail } from './aiLifecycleSteps';

interface AiLifecycleOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: 'dashboard' | 'request' | 'evaluations' | 'reports' | 'governance') => void;
  initialStepIndex?: number;
}

export default function AiLifecycleOnboardingModal({
  isOpen,
  onClose,
  onSelectTab,
  initialStepIndex = 0
}: AiLifecycleOnboardingModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Sync initialStepIndex when modal opens
  useEffect(() => {
    if (isOpen) {
      void Promise.resolve().then(() => {
        setCurrentStepIndex(initialStepIndex);
      });
    }
  }, [isOpen, initialStepIndex]);

  const handleDismiss = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem('ai_enterprise_tour_dismissed', 'true');
    }
    onClose();
  }, [dontShowAgain, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  if (!isOpen) return null;

  const currentStep: StepDetail = LIFECYCLE_STEPS[currentStepIndex] || LIFECYCLE_STEPS[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === LIFECYCLE_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleDismiss();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleJumpToTab = (tab: 'dashboard' | 'request' | 'evaluations' | 'reports' | 'governance') => {
    handleDismiss();
    onSelectTab(tab);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-4xl bg-theme-surface border border-theme-border/90 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900/20 via-purple-900/15 to-transparent border-b border-theme-border/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-theme-text flex items-center gap-2">
                  แนะนำวงจรการทำงาน: AI Enterprise Lifecycle
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                  Step {currentStepIndex + 1} of 4
                </span>
              </div>
              <p className="text-xs text-theme-text-muted mt-0.5">
                ทำความเข้าใจวงจรการขอสิทธิ์ ประเมินความคุ้มค่า และรายงานผลลัพธ์ตามระเบียบ WI-PI-AI-001
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="w-8 h-8 rounded-lg border border-theme-border/70 hover:bg-theme-surface-tertiary flex items-center justify-center text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            title="ปิดหน้าต่าง (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stepper Tabs Bar (Clickable steps 1-4) */}
        <div className="px-6 py-3 bg-theme-bg-page/70 border-b border-theme-border/50 shrink-0 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 min-w-max">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              const isPassed = idx < currentStepIndex;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border",
                    isActive
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30"
                      : isPassed
                      ? "bg-theme-surface text-theme-text border-theme-border hover:border-indigo-500/40"
                      : "bg-transparent text-theme-text-muted border-transparent hover:text-theme-text"
                  )}
                >
                  <span
                    className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center",
                      isActive
                        ? "bg-white/20 text-white"
                        : isPassed
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-theme-border/60 text-theme-text-muted"
                    )}
                  >
                    {isPassed ? '✓' : idx + 1}
                  </span>
                  <span>{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body: Active Step Detail */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Actionable Guidance (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Step Title Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center font-black font-mono text-sm">
                    0{currentStep.stepNumber}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-theme-text flex items-center gap-2">
                      <span>{currentStep.title}</span>
                    </h4>
                    <p className="text-xs text-theme-text-muted mt-0.5">
                      ผู้รับผิดชอบหลัก: <strong className="text-theme-text">{currentStep.who}</strong>
                    </p>
                  </div>
                </div>

                <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold border", currentStep.pillar3T.badgeClass)}>
                  {currentStep.pillar3T.name} Pillar
                </span>
              </div>

              {/* What & When Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-theme-bg-page/70 border border-theme-border/70">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                    <Target size={12} />
                    เป้าหมายของขั้นตอนนี้ (What)
                  </span>
                  <p className="text-xs text-theme-text mt-1.5 leading-relaxed">
                    {currentStep.what}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-theme-bg-page/70 border border-theme-border/70">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock size={12} />
                    กำหนดการ & SLA (When)
                  </span>
                  <p className="text-xs text-theme-text mt-1.5 leading-relaxed">
                    {currentStep.when}
                  </p>
                </div>
              </div>

              {/* How to Execute (Checklist) */}
              <div>
                <h5 className="text-xs font-bold text-theme-text flex items-center gap-1.5 mb-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>ขั้นตอนการปฏิบัติงาน (How to Execute)</span>
                </h5>
                <div className="space-y-1.5">
                  {currentStep.how.map((instruction, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-theme-bg-page/40 border border-theme-border/50 text-xs text-theme-text-muted"
                    >
                      <span className="w-4 h-4 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed text-theme-text">{instruction}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Values 3Ts */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 flex items-start gap-2.5">
                <Lightbulb size={16} className="text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    หลักการ 3Ts: {currentStep.pillar3T.name}
                  </span>
                  <p className="text-xs text-theme-text-muted mt-0.5">
                    {currentStep.pillar3T.desc}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Insight & Action (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-theme-bg-page/60 border border-theme-border/90 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                {/* Header of Insight */}
                <div className="flex items-center justify-between pb-3 border-b border-theme-border/50">
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    AI Adoption Insight
                  </span>
                  <span className="text-[10px] font-mono text-theme-text-muted">
                    Step 0{currentStep.stepNumber} Simulation
                  </span>
                </div>

                {/* Hero KPI */}
                <div className="mt-3">
                  <span className="text-xs text-theme-text-muted font-medium">
                    {currentStep.sampleMetric.label}
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-theme-text font-mono tracking-tight">
                      {currentStep.sampleMetric.value}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {currentStep.sampleMetric.delta}
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-text-muted mt-0.5">
                    {currentStep.sampleMetric.subtext}
                  </p>
                </div>

                {/* Custom Visualization Per Step */}
                <div className="mt-4 p-3 rounded-xl bg-theme-surface border border-theme-border/60">
                  {currentStep.id === 'intake' && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold text-theme-text flex items-center justify-between">
                        <span>เปรียบเทียบประเภทสิทธิ์ (Tier Allocation)</span>
                        <span className="text-[10px] text-theme-text-muted">โควตา 100%</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-theme-bg-page overflow-hidden flex border border-theme-border/50">
                        <div className="h-full bg-indigo-500 w-[72%]" title="Tier 1: 72%" />
                        <div className="h-full bg-purple-400 w-[28%]" title="Tier 2: 28%" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div className="p-2 rounded-lg bg-theme-bg-page/60 border border-theme-border/40">
                          <div className="flex items-center gap-1.5 text-indigo-500 font-bold text-xs">
                            <Bot size={13} />
                            <span>Tier 1: Claude Team</span>
                          </div>
                          <p className="text-[10px] text-theme-text-muted mt-1 leading-snug">
                            สำหรับงานวิเคราะห์ลึก มี AI JD ชัดเจน
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-theme-bg-page/60 border border-theme-border/40">
                          <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                            <Laptop size={13} />
                            <span>Tier 2: Web Portal</span>
                          </div>
                          <p className="text-[10px] text-theme-text-muted mt-1 leading-snug">
                            ผ่าน chat.futuregreenergy.com
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep.id === 'evaluation' && (
                    <div className="space-y-2 text-[11px]">
                      <div className="font-semibold text-theme-text flex items-center justify-between">
                        <span>Rubric 4 มิติ (คะแนนเต็ม 100)</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">เกณฑ์ผ่าน ≥ 70</span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div>
                          <div className="flex justify-between text-[10px] text-theme-text-muted mb-0.5">
                            <span>1. ความชัดเจนของปัญหา (As-Is Process)</span>
                            <span className="font-mono font-bold">25 คะแนน</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-theme-bg-page overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full w-full" />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-theme-text-muted mb-0.5">
                            <span>2. ความคุ้มค่าและชั่วโมงที่ประหยัด (ROI)</span>
                            <span className="font-mono font-bold">35 คะแนน</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-theme-bg-page overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full w-full" />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-theme-text-muted mb-0.5">
                            <span>3. ความพร้อมของข้อมูล (Readiness)</span>
                            <span className="font-mono font-bold">20 คะแนน</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-theme-bg-page overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full w-full" />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-theme-text-muted mb-0.5">
                            <span>4. ความปลอดภัย & PDPA</span>
                            <span className="font-mono font-bold">20 คะแนน</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-theme-bg-page overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full w-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep.id === 'execution' && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold text-theme-text flex items-center justify-between">
                        <span>แนวโน้มชั่วโมงประหยัดได้ (Weekly Saved)</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">▲ โตขึ้นต่อเนื่อง</span>
                      </div>
                      <div className="h-16 w-full flex items-end">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 200 60" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="modalSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 0 50 Q 50 40, 70 30 T 130 18 T 200 8 L 200 60 L 0 60 Z"
                            fill="url(#modalSparklineGrad)"
                          />
                          <path
                            d="M 0 50 Q 50 40, 70 30 T 130 18 T 200 8"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                          />
                          <circle cx="200" cy="8" r="4" fill="#10b981" className="animate-ping" />
                          <circle cx="200" cy="8" r="3" fill="#10b981" />
                        </svg>
                      </div>
                      <div className="flex justify-between text-[10px] text-theme-text-muted font-mono pt-1 border-t border-theme-border/40">
                        <span>W1: 3.5 ชม.</span>
                        <span>W2: 5.8 ชม.</span>
                        <span>W3: 7.2 ชม.</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">W4: 9.5 ชม.</span>
                      </div>
                    </div>
                  )}

                  {currentStep.id === 'review' && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold text-theme-text flex items-center justify-between">
                        <span>สถานะการใช้งาน & Seat Roaming</span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold">ส่งก่อนวันที่ 25</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-theme-bg-page/60 border border-theme-border/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-theme-text">อัตราการใช้งานประจำเดือน</span>
                          <span className="font-mono font-black text-indigo-500">18 / 22 วันทำการ</span>
                        </div>
                        <div className="h-2 rounded-full bg-theme-surface overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full w-[82%]" />
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-theme-text-muted mt-1">
                          <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                          <span>เกณฑ์คงสิทธิ์: ต้อง Active ≥ 10 วันทำการ/เดือน</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>หากสิทธิ์ไม่ Active ระบบจะ Roam สิทธิ์ให้ Waiting List รอบวันที่ 1 ของเดือนถัดไป</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Action Jump Button */}
                <div className="mt-4 pt-3 border-t border-theme-border/40">
                  <button
                    onClick={() => handleJumpToTab(currentStep.tabTarget)}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>{currentStep.actionLabel}</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-theme-bg-page/90 border-t border-theme-border/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Don't show again toggle */}
          <label className="flex items-center gap-2 text-xs text-theme-text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-theme-border text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span>ไม่ต้องแสดงทัวร์แนะนำนี้อัตโนมัติอีก (สามารถกดเปิดดูได้จากเมนู)</span>
          </label>

          {/* Nav Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleDismiss}
              className="px-3.5 py-1.5 rounded-lg border border-theme-border text-xs font-semibold text-theme-text-muted hover:text-theme-text hover:bg-theme-surface transition-colors cursor-pointer"
            >
              ข้ามไปหน้าทำงาน (Skip)
            </button>

            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-1.5 rounded-lg border border-theme-border text-xs font-semibold text-theme-text hover:bg-theme-surface flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>ย้อนกลับ</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <span>{isLastStep ? 'เข้าใจแล้ว / เริ่มต้นใช้งาน' : 'ถัดไป'}</span>
              {!isLastStep && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
