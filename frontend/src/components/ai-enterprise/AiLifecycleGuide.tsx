import { useState } from 'react';
import { Target, Clock, CheckCircle2, Lightbulb, ArrowRight, Workflow, Bot, Laptop } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AiHubTab } from './aiHubTabs';
import { LIFECYCLE_STEPS, type LifecycleStepId } from './aiLifecycleSteps';

interface AiLifecycleGuideProps {
  isAdmin: boolean;
  onNavigate: (tab: AiHubTab) => void;
}

// CoE scoring rubric (pass mark 70 / 100). Bar width is the share of the 100 points.
const RUBRIC = [
  { label: 'ความชัดเจนของปัญหา (As-Is Process)', score: 25, bar: 'bg-indigo-500' },
  { label: 'ความคุ้มค่าและชั่วโมงที่ประหยัดได้ (ROI)', score: 35, bar: 'bg-purple-500' },
  { label: 'ความพร้อมของข้อมูล (Readiness)', score: 20, bar: 'bg-teal-500' },
  { label: 'ความปลอดภัยข้อมูลและ PDPA', score: 20, bar: 'bg-emerald-500' },
];

const FACTS: Partial<Record<LifecycleStepId, { label: string; value: string }[]>> = {
  execution: [
    { label: 'ระยะสัญญา', value: 'Sandbox 1–3 เดือน' },
    { label: 'ที่ต้องบันทึก', value: 'ชั่วโมงที่ประหยัดได้จริงและภารกิจที่ทำร่วมกับ AI ใน Daily Worklog' },
    { label: 'หลักการ', value: 'ตรวจผลลัพธ์จาก AI ทุกครั้งก่อนส่งมอบงาน (Human-in-the-loop)' },
  ],
  review: [
    { label: 'ส่งรายงาน', value: 'ภายในวันที่ 25 ของทุกเดือน' },
    { label: 'การพิจารณา', value: 'ตรวจเป็นรายเดือน' },
    { label: 'ระงับสิทธิ์เมื่อ', value: 'เดือนที่ผ่านมาไม่ได้ใช้งานเลย แล้วโอนสิทธิ์ให้ Waiting List' },
  ],
};

/** The four-step lifecycle (request → CoE review → use → monthly report), written as a section of the policy manual. */
export default function AiLifecycleGuide({ isAdmin, onNavigate }: AiLifecycleGuideProps) {
  const [index, setIndex] = useState(0);
  const step = LIFECYCLE_STEPS[index] ?? LIFECYCLE_STEPS[0];
  const canJump = !!step.tabTarget && (step.tabTarget !== 'evaluations' || isAdmin);

  return (
    <section aria-labelledby="lifecycle-heading" className="space-y-4">
      <div>
        <h3 id="lifecycle-heading" className="text-xs font-bold uppercase tracking-wider text-theme-text flex items-center gap-1.5">
          <Workflow size={16} className="text-indigo-500" />
          <span>วงจรการทำงาน: AI Enterprise Lifecycle</span>
        </h3>
        <p className="text-xs text-theme-text-muted mt-1">
          ตั้งแต่ยื่นคำขอ ประเมินความคุ้มค่า ใช้งานจริง ไปจนถึงรายงานผลรายเดือนตามระเบียบ WI-PI-AI-001
        </p>
      </div>

      {/* Step selector */}
      <div role="tablist" aria-label="ขั้นตอนของวงจรการทำงาน" className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {LIFECYCLE_STEPS.map((s, i) => {
          const active = i === index;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`lifecycle-tab-${s.id}`}
              aria-selected={active}
              aria-controls="lifecycle-panel"
              onClick={() => setIndex(i)}
              className={cn(
                'flex items-start gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-colors',
                active
                  ? 'border-indigo-500/50 bg-indigo-500/10'
                  : 'border-theme-border/60 bg-theme-surface-secondary/40 hover:border-indigo-500/30'
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-full text-[11px] font-bold inline-flex items-center justify-center shrink-0',
                  active ? 'bg-indigo-600 text-white' : 'bg-theme-border/60 text-theme-text-muted'
                )}
              >
                {s.stepNumber}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-xs font-bold leading-snug', active ? 'text-theme-text' : 'text-theme-text-secondary')}>{s.title}</span>
                <span className="block text-[11px] text-theme-text-muted mt-0.5 leading-snug">{s.subtitle}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected step */}
      <div
        role="tabpanel"
        id="lifecycle-panel"
        aria-labelledby={`lifecycle-tab-${step.id}`}
        className="grid grid-cols-1 lg:grid-cols-5 gap-4"
      >
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-theme-text">
              ขั้นที่ {step.stepNumber}: {step.title}
            </h4>
            <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-bold border', step.pillar3T.badgeClass)}>{step.pillar3T.name}</span>
          </div>
          <p className="text-[11px] text-theme-text-muted -mt-2">
            ผู้รับผิดชอบ: <strong className="text-theme-text">{step.who}</strong>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/50">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Target size={13} /> เป้าหมายของขั้นตอนนี้
              </span>
              <p className="text-xs text-theme-text mt-1.5 leading-relaxed">{step.what}</p>
            </div>
            <div className="p-3.5 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/50">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock size={13} /> กำหนดการ
              </span>
              <p className="text-xs text-theme-text mt-1.5 leading-relaxed">{step.when}</p>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-bold text-theme-text flex items-center gap-1.5 mb-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>ขั้นตอนการปฏิบัติ</span>
            </h5>
            <ol className="space-y-1.5">
              {step.how.map((instruction, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-theme-text leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="lg:col-span-2 space-y-3">
          {step.id === 'intake' && (
            <div className="p-4 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/50 space-y-3">
              <h5 className="text-xs font-bold text-theme-text">เลือกประเภทสิทธิ์ให้ตรงกับงาน</h5>
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <Bot size={14} /> Tier 1: Claude Team
                </div>
                <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">งานวิเคราะห์เชิงลึก งานเฉพาะทาง ต้องมี AI JD ที่ชัดเจน</p>
              </div>
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                  <Laptop size={14} /> Tier 2: Web Portal
                </div>
                <p className="text-[11px] text-theme-text-muted mt-1 leading-relaxed">งานค้นคว้าทั่วไป ใช้งานผ่าน chat.futuregreenergy.com</p>
              </div>
            </div>
          )}

          {step.id === 'evaluation' && (
            <div className="p-4 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/50 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-xs font-bold text-theme-text">เกณฑ์ 4 มิติ (เต็ม 100)</h5>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">ผ่านที่ ≥ 70</span>
              </div>
              <div className="space-y-2.5">
                {RUBRIC.map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between gap-2 text-[11px] text-theme-text-muted mb-1">
                      <span>{r.label}</span>
                      <span className="font-semibold text-theme-text shrink-0">{r.score} คะแนน</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-theme-border/50 overflow-hidden">
                      <div className={cn('h-full rounded-full', r.bar)} style={{ width: `${r.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {FACTS[step.id] && (
            <dl className="p-4 rounded-xl border border-theme-border/60 bg-theme-surface-secondary/50 space-y-2.5">
              {FACTS[step.id]!.map((f) => (
                <div key={f.label}>
                  <dt className="text-[11px] font-bold text-theme-text-muted">{f.label}</dt>
                  <dd className="text-xs text-theme-text mt-0.5 leading-relaxed">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 flex items-start gap-2.5">
            <Lightbulb size={15} className="text-purple-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">หลักการ 3Ts: {step.pillar3T.name}</span>
              <p className="text-[11px] text-theme-text-muted mt-0.5 leading-relaxed">{step.pillar3T.desc}</p>
            </div>
          </div>

          {canJump && step.tabTarget && (
            <button
              type="button"
              onClick={() => onNavigate(step.tabTarget as AiHubTab)}
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-xs font-semibold text-theme-text transition-colors cursor-pointer"
            >
              <span>{step.actionLabel}</span>
              <ArrowRight size={13} />
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
