import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  GraduationCap,
  Trophy,
  Flame,
  Clock,
  Coins,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Award,
  FileCheck2,
} from 'lucide-react';
import {
  getSandboxTelemetry,
  generateGraduationPackage,
  resetSandboxTelemetry,
  type SandboxTelemetryData,
  type EnterpriseGraduationPackage,
} from '../../../lib/sandbox-telemetry';
import { cn } from '../../../lib/utils';

interface SandboxGraduationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGraduateToForm: (pkg: EnterpriseGraduationPackage) => void;
  departmentName?: string;
}

export const SandboxGraduationModal: React.FC<SandboxGraduationModalProps> = ({
  isOpen,
  onClose,
  onGraduateToForm,
  departmentName = 'ฝ่ายงานทั่วไป (Enterprise Unit)',
}) => {
  const [telemetry, setTelemetry] = useState<SandboxTelemetryData>(getSandboxTelemetry);
  const [targetDept, setTargetDept] = useState<string>(departmentName);
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);

  // Reload telemetry when modal opens
  useEffect(() => {
    if (isOpen) {
      setTelemetry(getSandboxTelemetry());
      setShowConfirmReset(false);
    }
  }, [isOpen]);

  // Generate graduation package based on current telemetry
  const graduationPkg = useMemo(() => {
    return generateGraduationPackage(targetDept);
  }, [targetDept, telemetry]);

  // Calculate vote totals and breakdown
  const voteEntries = useMemo(() => {
    return Object.entries(telemetry.votesCount).sort((a, b) => b[1] - a[1]);
  }, [telemetry.votesCount]);

  const totalVotes = useMemo(() => {
    return voteEntries.reduce((sum, [, count]) => sum + count, 0);
  }, [voteEntries]);

  const handleReset = () => {
    resetSandboxTelemetry();
    setTelemetry(getSandboxTelemetry());
    setShowConfirmReset(false);
  };

  const handleGraduate = () => {
    const pkg = generateGraduationPackage(targetDept);
    // บันทึกลง localStorage เพื่อให้ AiEnterprisePage โหลดและ Auto-fill
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ai_enterprise_graduation_package', JSON.stringify(pkg));
      }
    } catch {
      // Ignore
    }
    onGraduateToForm(pkg);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl bg-theme-surface dark:bg-theme-bg-page border border-theme-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-theme-border flex items-start justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <GraduationCap size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-theme-text">
                  สรุปผลลัพธ์ Sandbox & สำเร็จการประเมินสู่ Enterprise License
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Graduation Ready
                </span>
              </div>
              <p className="text-xs text-theme-text-muted mt-1 leading-relaxed">
                นำสถิติการใช้งานจริงและคะแนนโหวตจาก Arena ไปสร้าง Business Case ยื่นขอจัดสรร Dedicated Seat ตามระเบียบ WI-PI-AI-001
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary border border-transparent hover:border-theme-border transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Department Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-theme-surface-secondary/50 border border-theme-border">
            <div className="text-xs">
              <span className="font-bold text-theme-text">ระบุหน่วยงานผู้ขอสิทธิ์:</span>
              <p className="text-theme-text-muted text-[11px] mt-0.5">
                เลือกฝ่ายงานเพื่อปรับแต่งคำชี้แจงเหตุผลทางธุรกิจในแบบฟอร์มขอใช้งาน AI
              </p>
            </div>
            <input
              type="text"
              value={targetDept}
              onChange={(e) => setTargetDept(e.target.value)}
              placeholder="เช่น ฝ่ายบัญชีและการเงิน, ฝ่ายจัดซื้อ..."
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 min-w-[200px]"
            />
          </div>

          {/* 4 Empirical Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-theme-surface border border-theme-border flex flex-col gap-1">
              <div className="flex items-center justify-between text-theme-text-muted">
                <span className="text-[11px] font-bold">คำถามทดสอบ</span>
                <Flame size={14} className="text-orange-500" />
              </div>
              <span className="text-xl font-black text-theme-text">
                {telemetry.totalPrompts.toLocaleString()}
              </span>
              <span className="text-[10px] text-theme-text-muted">ครั้งใน Sandbox</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-theme-surface border border-theme-border flex flex-col gap-1">
              <div className="flex items-center justify-between text-theme-text-muted">
                <span className="text-[11px] font-bold">ปริมาณประมวลผล</span>
                <Sparkles size={14} className="text-indigo-500" />
              </div>
              <span className="text-xl font-black text-theme-text">
                {(telemetry.totalTokens / 1000).toFixed(1)}k
              </span>
              <span className="text-[10px] text-theme-text-muted">Tokens สุทธิ</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-theme-surface border border-theme-border flex flex-col gap-1">
              <div className="flex items-center justify-between text-theme-text-muted">
                <span className="text-[11px] font-bold">ค่าใช้จ่ายทดสอบ</span>
                <Coins size={14} className="text-emerald-500" />
              </div>
              <span className="text-xl font-black text-theme-text text-emerald-600 dark:text-emerald-400">
                ฿{telemetry.estimatedCostBaht.toFixed(2)}
              </span>
              <span className="text-[10px] text-theme-text-muted">Pay-Per-Token</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-theme-surface border border-theme-border flex flex-col gap-1">
              <div className="flex items-center justify-between text-theme-text-muted">
                <span className="text-[11px] font-bold">วันที่ทดสอบจริง</span>
                <Clock size={14} className="text-violet-500" />
              </div>
              <span className="text-xl font-black text-theme-text">
                {Math.max(1, telemetry.activeDays)}
              </span>
              <span className="text-[10px] text-theme-text-muted">วันสะสม</span>
            </div>
          </div>

          {/* Model Preference Arena Breakdown */}
          <div className="p-4 rounded-2xl border border-theme-border bg-theme-surface/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" />
                <h3 className="text-xs sm:text-sm font-black text-theme-text">
                  ผลการประลองใน Arena (Model Win Rate & Votes)
                </h3>
              </div>
              <span className="text-[11px] text-theme-text-muted font-bold">
                รวมโหวต: {totalVotes} ครั้ง
              </span>
            </div>

            {voteEntries.length === 0 ? (
              <p className="text-xs text-theme-text-muted py-3 text-center">
                ยังไม่มีข้อมูลการโหวตผู้ชนะใน Arena (ลองกดโหวต 🏆 บนคำตอบที่ถูกใจในโหมดประลอง)
              </p>
            ) : (
              <div className="space-y-2">
                {voteEntries.map(([modelId, votes]) => {
                  const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                  const isTop = modelId === graduationPkg.topVotedModel;

                  return (
                    <div key={modelId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-theme-text flex items-center gap-1.5">
                          {isTop && <span className="text-amber-500 text-xs">👑</span>}
                          <span>{modelId}</span>
                        </span>
                        <span className="font-mono text-theme-text-muted">
                          {votes} โหวต ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-theme-surface-secondary overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            isTop
                              ? 'bg-gradient-to-r from-amber-500 to-indigo-600'
                              : 'bg-indigo-500/60'
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CoE Graduation Evaluation Card */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-indigo-500 text-white">
                <Award size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-theme-text">
                  ข้อเสนอแนะจัดสรร License จาก AI Center of Excellence (CoE)
                </h3>
                <span className="text-[10px] text-theme-text-muted">
                  คำนวณจากปริมาณงานและโมเดลที่ฝ่ายงานใช้งานแล้วได้ผลลัพธ์ดีที่สุด
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-theme-surface/80 border border-theme-border text-center">
                <span className="text-[10px] font-bold text-theme-text-muted block">โมเดลที่แนะนำสูงสุด</span>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-1 block truncate">
                  {graduationPkg.topVotedModel}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-theme-surface/80 border border-theme-border text-center">
                <span className="text-[10px] font-bold text-theme-text-muted block">จำนวน Seats ที่เหมาะสม</span>
                <span className="text-xs font-black text-theme-text mt-1 block">
                  {graduationPkg.recommendedSeats} ที่นั่ง (Dedicated)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-theme-surface/80 border border-theme-border text-center">
                <span className="text-[10px] font-bold text-theme-text-muted block">เวลาที่คาดว่าจะประหยัดได้</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                  ~{graduationPkg.estimatedHoursSavedWeekly} ชม. / สัปดาห์
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-theme-surface/80 border border-theme-border space-y-1">
              <span className="text-[11px] font-black text-theme-text flex items-center gap-1.5">
                <FileCheck2 size={13} className="text-indigo-500" />
                <span>คำชี้แจงเหตุผลทางธุรกิจ (Empirical Business Justification):</span>
              </span>
              <p className="text-xs text-theme-text-muted leading-relaxed">
                {graduationPkg.empiricalJustification}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-theme-border bg-theme-surface/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {showConfirmReset ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-500 font-bold">ยืนยันล้างข้อมูล Sandbox ทั้งหมด?</span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600 text-white cursor-pointer"
                >
                  ใช่, ล้างข้อมูล
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(false)}
                  className="px-2 py-1 text-xs rounded-lg border border-theme-border text-theme-text-muted cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmReset(true)}
                className="text-xs text-theme-text-muted hover:text-rose-500 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw size={12} />
                <span>ล้างสถิติ Sandbox (Reset)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-theme-border hover:bg-theme-surface-secondary text-theme-text text-xs font-bold cursor-pointer transition-colors"
            >
              ปิดหน้าต่าง
            </button>

            <button
              type="button"
              onClick={handleGraduate}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md hover:shadow-indigo-500/25 cursor-pointer transition-all"
            >
              <span>🚀 นำสถิตินี้ไปขอ License</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
