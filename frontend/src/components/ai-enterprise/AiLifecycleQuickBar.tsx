import { Zap, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LIFECYCLE_STEPS } from './aiLifecycleSteps';

interface AiLifecycleQuickBarProps {
  onOpenModal: (stepIndex?: number) => void;
  onSelectTab?: (tab: 'dashboard' | 'request' | 'evaluations' | 'reports' | 'governance') => void;
  activeTab?: string;
}

export default function AiLifecycleQuickBar({
  onOpenModal
}: AiLifecycleQuickBarProps) {
  return (
    <div className="bg-theme-surface border border-theme-border/80 rounded-xl p-2.5 sm:px-4 sm:py-2.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 transition-all">
      {/* Left: Title & Quick Open */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
          <Zap size={13} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-theme-text flex items-center gap-1.5">
            วงจร AI Lifecycle 4 ขั้นตอน
          </span>
          <span className="hidden sm:inline text-theme-border">•</span>
          <span className="text-[11px] text-theme-text-muted hidden sm:inline">
            SLA: รอบพิจารณาวันที่ 15 | ส่งรายงานวันที่ 25
          </span>
        </div>
        <button
          onClick={() => onOpenModal(0)}
          className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>เปิดดูคู่มือ & ทัวร์แนะนำ</span>
          <ExternalLink size={10} />
        </button>
      </div>

      {/* Right: 4 Compact Clickable Stepper Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {LIFECYCLE_STEPS.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => {
              onOpenModal(idx);
            }}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer group",
              "bg-theme-bg-page/60 hover:bg-indigo-500/10 border-theme-border/70 hover:border-indigo-500/30 text-theme-text-muted hover:text-theme-text"
            )}
            title={`คลิกเพื่อดูรายละเอียด: ${step.title}`}
          >
            <span className="w-4 h-4 rounded-full bg-theme-surface border border-theme-border text-[9px] font-mono font-bold flex items-center justify-center text-theme-text-muted group-hover:text-indigo-500 group-hover:border-indigo-500/40">
              {idx + 1}
            </span>
            <span>{step.id === 'intake' ? 'ยื่นขอ FM-001' : step.id === 'evaluation' ? 'CoE ประเมิน' : step.id === 'execution' ? 'ลุยงานจริง' : 'ส่งผลงาน FM-002'}</span>
            <span className="text-[9px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1 rounded">
              {step.id === 'evaluation' ? 'รอบ 15' : step.id === 'review' ? 'รอบ 25' : 'ตลอดเดือน'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
