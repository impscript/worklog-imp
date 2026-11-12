import { useState, type ReactNode } from 'react';
import { Plus, Trash2, Lock, AlertCircle, ChevronDown, CheckCircle2, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AiTeamMember } from './AiTeamMemberPicker';
import {
  BASIS_OPTIONS,
  FREQUENCY_UNIT_LABEL,
  HOURLY_RATE_THB,
  WEEKS_PER_MONTH,
  emptyUseCase,
  hoursBeforePerWeek,
  hoursSavedPerWeek,
  memberKey,
  round2,
  validateUseCase,
  type AiUseCase,
  type EstimateBasis,
  type FrequencyUnit,
} from './aiRequestForm';

export interface AiFunctionOption {
  id: string;
  label: string;
  desc: string;
}

interface AiUseCaseEditorProps {
  tasks: AiUseCase[];
  members: AiTeamMember[];
  onChange: (tasks: AiUseCase[]) => void;
  functionOptions: AiFunctionOption[];
  /** Show validation messages inside the cards (turned on after a failed submit). */
  showErrors: boolean;
  /** Section heading, rendered on the left of the row that carries the "filled N/M" counter on the right. */
  heading?: ReactNode;
}

const UNIT_OPTION_LABEL: Record<FrequencyUnit, string> = {
  day: 'ครั้ง/วัน',
  week: 'ครั้ง/สัปดาห์',
  month: 'ครั้ง/เดือน',
};

const INPUT =
  'w-full text-sm py-2 px-3 rounded-lg bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500';
const LABEL = 'block text-xs font-medium text-theme-text mb-1';

function numberValue(n: number): number | '' {
  return Number.isFinite(n) ? n : '';
}

function parseNumber(raw: string): number {
  return raw === '' ? Number.NaN : Number(raw);
}

export default function AiUseCaseEditor({ tasks, members, onChange, functionOptions, showErrors, heading }: AiUseCaseEditorProps) {
  const singleOwner = members.length === 1 ? memberKey(members[0]) : null;
  const defaultOwner = singleOwner ?? '';

  // Ids of collapsed cards. Everything starts expanded; a card that has validation errors is always shown open.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleCard = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setAllCollapsed = (collapse: boolean) => setCollapsed(collapse ? new Set(tasks.map((t) => t.id)) : new Set());
  const completeCount = tasks.filter((t, i) => validateUseCase(t, members, i).length === 0).length;

  const update = (id: string, patch: Partial<AiUseCase>) => {
    onChange(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addTask = () => onChange([...tasks, emptyUseCase(defaultOwner)]);

  const removeTask = (id: string) => {
    if (tasks.length <= 1) return;
    onChange(tasks.filter((t) => t.id !== id));
  };

  const toggleFunction = (t: AiUseCase, fnId: string) => {
    const next = t.ai_functions.includes(fnId) ? t.ai_functions.filter((f) => f !== fnId) : [...t.ai_functions, fnId];
    update(t.id, { ai_functions: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {heading}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <p className="text-xs text-theme-text-muted whitespace-nowrap">
            กรอกครบแล้ว{' '}
            <strong className={cn('tabular-nums', completeCount === tasks.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-text')}>
              {completeCount}/{tasks.length}
            </strong>{' '}
            งาน
          </p>
          {tasks.length > 1 && (
            <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAllCollapsed(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary cursor-pointer"
            >
              <ChevronsDownUp size={14} /> ยุบทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setAllCollapsed(false)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary cursor-pointer"
            >
              <ChevronsUpDown size={14} /> ขยายทั้งหมด
            </button>
          </div>
          )}
        </div>
      </div>

      {tasks.map((t, index) => {
        const taskIssues = validateUseCase(t, members, index);
        const issues = showErrors ? taskIssues : [];
        const isComplete = taskIssues.length === 0;
        const open = !collapsed.has(t.id) || issues.length > 0;
        const ownerName = singleOwner ? members[0].name : members.find((m) => memberKey(m) === t.owner_key)?.name;
        const saved = hoursSavedPerWeek(t);
        const before = hoursBeforePerWeek(t);
        const monthly = saved * WEEKS_PER_MONTH;
        const hasNumbers = t.minutes_before > 0 && t.minutes_after >= 0 && t.minutes_after < t.minutes_before && t.frequency_count > 0;

        return (
          <div
            key={t.id}
            id={`req-task-${t.id}`}
            className={cn(
              'rounded-xl border bg-theme-surface overflow-hidden scroll-mt-24',
              issues.length > 0 ? 'border-rose-500/50' : 'border-theme-border/80'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between gap-2 px-3 py-2 bg-theme-surface-secondary/70',
                open && 'border-b border-theme-border/60'
              )}
            >
              <button
                type="button"
                onClick={() => toggleCard(t.id)}
                aria-expanded={open}
                aria-controls={`req-task-body-${t.id}`}
                className="flex flex-1 min-w-0 items-center gap-2.5 px-1 py-1 text-left cursor-pointer rounded-lg hover:bg-theme-surface-tertiary/60 transition-colors"
              >
                <ChevronDown size={16} className={cn('shrink-0 text-theme-text-muted transition-transform', !open && '-rotate-90')} />
                <span className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold inline-flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-theme-text">
                  {t.title.trim() || <span className="font-normal italic text-theme-text-muted">งานที่ {index + 1} (ยังไม่ระบุชื่องาน)</span>}
                </span>
                {!open && ownerName && (
                  <span className="hidden sm:inline-flex max-w-[10rem] truncate shrink-0 px-2 py-0.5 rounded-md bg-theme-surface-secondary text-[11px] text-theme-text-muted">
                    {ownerName}
                  </span>
                )}
                {!open && isComplete && (
                  <span className="hidden sm:inline shrink-0 text-[11px] text-theme-text-muted tabular-nums">ประหยัด {round2(hoursSavedPerWeek(t))} ชม./สัปดาห์</span>
                )}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium',
                    isComplete
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  )}
                >
                  {isComplete ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {isComplete ? 'กรอกครบแล้ว' : 'กรอกยังไม่ครบ'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeTask(t.id)}
                disabled={tasks.length <= 1}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer shrink-0"
                title={tasks.length <= 1 ? 'ต้องมีอย่างน้อย 1 งาน' : 'ลบงานนี้'}
                aria-label={`ลบงานที่ ${index + 1}`}
              >
                <Trash2 size={14} /> <span className="hidden sm:inline">ลบงานนี้</span>
              </button>
            </div>

            {open && (
              <div id={`req-task-body-${t.id}`} className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className={LABEL}>ชื่องาน *</label>
                    <input
                      type="text"
                      value={t.title}
                      onChange={(e) => update(t.id, { title: e.target.value })}
                      placeholder="เช่น เปรียบเทียบสัญญาจัดซื้อกับมาตรฐานบริษัท"
                      className={INPUT}
                    />
                  </div>

                  <div>
                    <label className={LABEL}>ผู้รับผิดชอบงานนี้ *</label>
                    {singleOwner ? (
                      <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-theme-surface-secondary border border-theme-border text-sm text-theme-text">
                        <Lock size={13} className="text-theme-text-muted shrink-0" />
                        <span className="truncate">{members[0].name}</span>
                        <span className="text-[11px] text-theme-text-muted shrink-0">(อัตโนมัติ)</span>
                      </div>
                    ) : (
                      <select
                        value={t.owner_key}
                        onChange={(e) => update(t.id, { owner_key: e.target.value })}
                        className={INPUT}
                      >
                        <option value="">— เลือกจากรายชื่อในข้อ 1 —</option>
                        {members.map((m) => (
                          <option key={memberKey(m)} value={memberKey(m)}>
                            {m.name}
                            {m.is_lead ? ' (ผู้ขอหลัก)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className={LABEL}>วิธีทำงานตอนนี้ และสิ่งที่ทำให้ช้าหรือผิดพลาด *</label>
                  <textarea
                    rows={3}
                    value={t.as_is_process}
                    onChange={(e) => update(t.id, { as_is_process: e.target.value })}
                    placeholder="เดิมทำอย่างไร ใครทำ ติดขัดตรงไหน เช่น ตรวจสัญญาทีละฉบับด้วยมือ ใช้เวลานาน มักพลาดเงื่อนไขค่าปรับ"
                    className={cn(INPUT, 'resize-y')}
                  />
                </div>

                <div>
                  <label className={cn(LABEL, 'mb-2 font-bold')}>ให้ AI ช่วยเรื่องอะไร * (เลือกได้มากกว่า 1 ข้อ)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {functionOptions.map((opt) => {
                      const checked = t.ai_functions.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors bg-theme-surface-secondary/40 border-theme-border hover:bg-theme-surface-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFunction(t, opt.id)}
                            className="mt-0.5 rounded text-indigo-600"
                          />
                          <span>
                            <span className="block font-semibold">{opt.label}</span>
                            <span className="block text-[11px] text-theme-text-muted mt-0.5">{opt.desc}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className={cn(LABEL, 'mb-2 font-bold')}>ประเมินเวลา</p>
                  {/* @container: the layout follows the width of this card, not the viewport */}
                  <div className="@container space-y-3">
                    <div className="grid grid-cols-2 @xl:grid-cols-[1.5fr_1fr_1fr] gap-3">
                      <div className="col-span-2 @xl:col-span-1 min-w-0">
                        <label className={cn(LABEL, 'whitespace-nowrap')}>ทำบ่อยแค่ไหน *</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={numberValue(t.frequency_count)}
                            onChange={(e) => update(t.id, { frequency_count: parseNumber(e.target.value) })}
                            className={cn(INPUT, 'w-20 shrink-0 font-mono')}
                            aria-label="จำนวนครั้ง"
                          />
                          <select
                            value={t.frequency_unit}
                            onChange={(e) => update(t.id, { frequency_unit: e.target.value as FrequencyUnit })}
                            className={cn(INPUT, 'min-w-0 flex-1')}
                            aria-label="หน่วยความถี่"
                          >
                            {(Object.keys(FREQUENCY_UNIT_LABEL) as FrequencyUnit[]).map((u) => (
                              <option key={u} value={u}>
                                {UNIT_OPTION_LABEL[u]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <label className={cn(LABEL, 'whitespace-nowrap')}>เวลาตอนนี้ *</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={numberValue(t.minutes_before)}
                            onChange={(e) => update(t.id, { minutes_before: parseNumber(e.target.value) })}
                            className={cn(INPUT, 'pr-20 font-mono')}
                            aria-label="เวลาที่ใช้ตอนนี้ (นาทีต่อครั้ง)"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-theme-text-muted">นาที/ครั้ง</span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <label className={cn(LABEL, 'whitespace-nowrap')}>เวลาเมื่อมี AI *</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={numberValue(t.minutes_after)}
                            onChange={(e) => update(t.id, { minutes_after: parseNumber(e.target.value) })}
                            className={cn(INPUT, 'pr-20 font-mono')}
                            aria-label="เวลาที่คาดว่าเหลือเมื่อมี AI (นาทีต่อครั้ง)"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-theme-text-muted">นาที/ครั้ง</span>
                        </div>
                      </div>
                    </div>

                    <div className="max-w-sm">
                      <label className={cn(LABEL, 'whitespace-nowrap')}>ตัวเลขนี้มาจาก</label>
                      <select
                        value={t.basis}
                        onChange={(e) => update(t.id, { basis: e.target.value as EstimateBasis })}
                        className={INPUT}
                      >
                        {BASIS_OPTIONS.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p
                    className={cn(
                      'mt-3 text-xs rounded-md px-3 py-2 border',
                      hasNumbers
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                        : 'bg-theme-surface border-theme-border text-theme-text-muted'
                    )}
                  >
                    {hasNumbers ? (
                      <>
                        คำนวณได้ประหยัด <strong>{round2(saved)} ชม./สัปดาห์</strong> (จาก {round2(before)} ชม.) หรือราว{' '}
                        <strong>{round2(monthly)} ชม./เดือน</strong> ≈ {Math.round(monthly * HOURLY_RATE_THB).toLocaleString()} บาท/เดือน
                        (อิง {HOURLY_RATE_THB} บาท/ชม.)
                      </>
                    ) : (
                      'กรอกความถี่และเวลาให้ครบ ระบบจะคำนวณเวลาที่ประหยัดให้ (เวลาเมื่อมี AI ต้องน้อยกว่าเวลาตอนนี้)'
                    )}
                  </p>
                </div>

                {issues.length > 0 && (
                  <ul className="space-y-1" role="alert">
                    {issues.map((i) => (
                      <li key={i.code} className="flex items-start gap-1.5 text-xs text-rose-500">
                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                        <span>{i.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addTask}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-indigo-500/40 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5 transition-colors cursor-pointer"
      >
        <Plus size={16} /> เพิ่มงาน
      </button>
    </div>
  );
}
