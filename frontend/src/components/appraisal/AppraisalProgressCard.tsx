import React, { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Clock,
  Cpu,
  FileSearch,
  Sparkles,
  Lightbulb,
} from 'lucide-react';

export interface AppraisalProgressSampleLog {
  work_date: string;
  project_name?: string;
  description: string;
}

export interface AppraisalProgressCardProps {
  employeeName: string;
  cycleLabel: string;
  periodLabel: string;
  modelName: string;
  logsCount: number;
  loggedDays: number;
  businessDays: number;
  sampleLogs: AppraisalProgressSampleLog[];
  jdCategories: string[];
  analysisPhase: string;
}

const HR_PILLARS = [
  { key: 'quantity', label: 'Quantity', th: 'ความครบถ้วน' },
  { key: 'quality', label: 'Quality', th: 'คุณภาพและผลลัพธ์' },
  { key: 'learning', label: 'Learning', th: 'การเรียนรู้' },
  { key: 'accountability', label: 'Accountability', th: 'ความรับผิดชอบ' },
  { key: 'proactiveness', label: 'Proactiveness', th: 'การคิดและลงมือก่อน' },
] as const;

const HR_MICRO_TIPS: string[] = [
  'เกณฑ์ HR: การระบุ [Result] หรือผลลัพธ์เชิงตัวเลข ช่วยยกระดับคะแนนมิติ Quality ได้ชัดเจนกว่าการลงแค่คำว่า "เสร็จแล้ว"',
  'Zero-Bias Policy: ระบบแยก "ความเพียงพอของหลักฐาน" ออกจาก "ระดับผลงาน" เสมอ เพื่อความเป็นธรรม',
  'วงจร Learning ระดับสูงสุดคือ Learn → Apply → Improve → Share (นำไปใช้จริงและถ่ายทอดต่อในทีม)',
  'Proactiveness วัดจากการป้องกันปัญหาล่วงหน้าและเสนอปรับปรุงกระบวนการ ไม่ใช่แค่การทำงานเร็วตามคำสั่ง',
];

function cleanSnippet(raw: string): string {
  return raw
    .split('\n')[0]
    .replace(/\[.*?\]/g, '')
    .replace(/^[\s:–—-]+/, '')
    .trim();
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const AppraisalProgressCard: React.FC<AppraisalProgressCardProps> = ({
  employeeName,
  cycleLabel,
  periodLabel,
  modelName,
  logsCount,
  loggedDays,
  businessDays,
  sampleLogs,
  jdCategories,
  analysisPhase,
}) => {
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [tickerIdx, setTickerIdx] = useState<number>(0);
  const [tipIdx, setTipIdx] = useState<number>(0);

  // Tick elapsed seconds
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Build real evidence items to cycle through
  const tickerItems = useMemo(() => {
    const items: { kind: 'log' | 'jd'; text: string }[] = [];

    const step = Math.max(1, Math.floor(sampleLogs.length / 12));
    for (let i = 0; i < sampleLogs.length && items.length < 12; i += step) {
      const log = sampleLogs[i];
      const snippet = cleanSnippet(log.description || '');
      if (snippet) {
        const proj = log.project_name?.trim() || 'งานประจำ';
        items.push({
          kind: 'log',
          text: `[${log.work_date}] ${proj} — ${snippet.slice(0, 76)}${snippet.length > 76 ? '…' : ''}`,
        });
      }
    }

    jdCategories.slice(0, 6).forEach((cat) => {
      const cleaned = cat.trim();
      if (cleaned) {
        items.push({
          kind: 'jd',
          text: `เทียบเกณฑ์ JD: ${cleaned}`,
        });
      }
    });

    if (items.length === 0) {
      items.push({
        kind: 'log',
        text: `กำลังวิเคราะห์บันทึกงาน ${logsCount} รายการ ตามเกณฑ์มาตรฐาน HR 5 มิติ`,
      });
    }

    return items;
  }, [sampleLogs, jdCategories, logsCount]);

  // Rotate live evidence ticker every 2.6s
  useEffect(() => {
    if (tickerItems.length <= 1) return;
    const id = window.setInterval(() => {
      setTickerIdx((prev) => (prev + 1) % tickerItems.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [tickerItems.length]);

  // Rotate HR micro-tips every 5s
  useEffect(() => {
    const id = window.setInterval(() => {
      setTipIdx((prev) => (prev + 1) % HR_MICRO_TIPS.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  // Asymptotic progress (smoothly approaches ~93% over ~30s, never freezes at 0 or jumps backwards)
  const progressPct = useMemo(() => {
    const raw = 12 + 81 * (1 - Math.exp(-elapsedSec / 11));
    return Math.min(93, Math.round(raw));
  }, [elapsedSec]);

  // Active pillar index advances every ~3.5s across 0..4
  const activePillarIdx = Math.min(HR_PILLARS.length - 1, Math.floor(elapsedSec / 3.5));
  const currentTicker = tickerItems[tickerIdx % tickerItems.length];

  const attendanceLabel =
    loggedDays > businessDays
      ? `${businessDays}/${businessDays} วันทำการ (+${loggedDays - businessDays} วันหยุด)`
      : `${loggedDays}/${businessDays} วันทำการ`;

  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200/90 dark:border-indigo-500/30 p-6 sm:p-8 shadow-lg space-y-6">
      {/* Subtle animated top accent bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Top Row: Neural Halo + Title + Live Timer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Dual-ring Neural Halo */}
          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-indigo-500/25 via-purple-500/25 to-cyan-400/25 animate-ping [animation-duration:2.6s]" />
            <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400/40 dark:border-indigo-400/30 border-t-indigo-600 dark:border-t-indigo-400 animate-spin [animation-duration:3s]" />
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
              <BrainCircuit size={22} />
            </div>
          </div>

          <div className="text-center sm:text-left space-y-0.5">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                กำลังประมวลผลการประเมินด้วย AI
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                <Cpu size={10} />
                {modelName}
              </span>
            </div>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles size={13} className="animate-pulse shrink-0" />
              <span>{analysisPhase || 'ประมวลผล 5 มิติหลักและวิเคราะห์ด้วย AI...'}</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {employeeName} • {cycleLabel} ({periodLabel}) •{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {logsCount} บันทึกงาน
              </span>{' '}
              • {attendanceLabel}
            </p>
          </div>
        </div>

        {/* Live Elapsed Timer + % */}
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Clock size={14} className="text-indigo-500" />
            <span className="font-mono text-sm font-bold tabular-nums">
              {formatElapsed(elapsedSec)}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Smooth Progress Bar */}
      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 transition-all duration-700 ease-out relative"
          style={{ width: `${progressPct}%` }}
        >
          <div className="absolute inset-0 bg-white/25 animate-pulse" />
        </div>
      </div>

      {/* Live 5-Pillar Scanning Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {HR_PILLARS.map((pillar, idx) => {
          const isDone = idx < activePillarIdx;
          const isActive = idx === activePillarIdx;
          return (
            <div
              key={pillar.key}
              className={`px-3 py-2 rounded-xl border text-left transition-all duration-300 ${
                isDone
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
                  : isActive
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/60 shadow-2xs ring-1 ring-indigo-400/30'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 opacity-65'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-[11px] font-bold truncate ${
                    isDone
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : isActive
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {idx + 1}. {pillar.label}
                </span>
                {isDone ? (
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                )}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {pillar.th}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Evidence Ticker (Real Worklogs & JD) */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
        <FileSearch size={15} className="text-indigo-500 shrink-0" />
        <div className="min-w-0 flex-1 text-xs text-slate-700 dark:text-slate-200 truncate">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400 mr-1.5">
            {currentTicker.kind === 'jd' ? 'ตรวจเทียบ JD:' : 'กำลังอ่านหลักฐาน:'}
          </span>
          <span key={tickerIdx} className="animate-fade-in">
            {currentTicker.text}
          </span>
        </div>
      </div>

      {/* Rotating HR Micro-Tip */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/40 text-[11px] text-slate-600 dark:text-slate-300">
        <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <span key={tipIdx} className="leading-relaxed animate-fade-in">
          {HR_MICRO_TIPS[tipIdx]}
        </span>
      </div>
    </div>
  );
};

export default AppraisalProgressCard;
