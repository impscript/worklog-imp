import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AiTeamMember } from './AiTeamMemberPicker';
import { HOURLY_RATE_THB, summarize, type AiUseCase, type FormIssue } from './aiRequestForm';

interface AiRequestSummaryProps {
  members: AiTeamMember[];
  tasks: AiUseCase[];
  errors: FormIssue[];
  warnings: FormIssue[];
  /** Errors are listed only after the user tried to submit, so a fresh form is not covered in red. */
  showErrors: boolean;
}

function jumpTo(targetId?: string) {
  if (!targetId) return;
  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function IssueList({ issues, tone }: { issues: FormIssue[]; tone: 'error' | 'warn' }) {
  const Icon = tone === 'error' ? AlertCircle : AlertTriangle;
  return (
    <ul className="space-y-1.5">
      {issues.map((i, idx) => (
        <li key={`${i.code}-${idx}`}>
          <button
            type="button"
            onClick={() => jumpTo(i.targetId)}
            className={cn(
              'w-full flex items-start gap-2 text-left text-xs rounded-md px-2.5 py-1.5 cursor-pointer transition-colors',
              tone === 'error'
                ? 'text-rose-600 dark:text-rose-300 hover:bg-rose-500/10'
                : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
            )}
          >
            <Icon size={14} className="mt-0.5 shrink-0" />
            <span>{i.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Boxed estimate of the monthly value of the time saved; sits at the right of the section heading. */
export function AiValueEstimateBox({ tasks, members }: { tasks: AiUseCase[]; members: AiTeamMember[] }) {
  const { valuePerMonthThb } = summarize(tasks, members);
  return (
    <div className="ml-auto rounded-lg border border-theme-border/70 bg-theme-surface px-3 py-2 text-right">
      <p className="text-[11px] text-theme-text-muted">มูลค่าโดยประมาณ</p>
      <p className="text-lg font-bold text-theme-text tabular-nums leading-tight">
        {valuePerMonthThb.toLocaleString()}
        <span className="ml-1 text-xs font-medium text-theme-text-muted">บาท/เดือน</span>
      </p>
      <p className="text-[11px] text-theme-text-muted whitespace-nowrap">คิดจากค่าแรง {HOURLY_RATE_THB} บาท/ชม.</p>
    </div>
  );
}

export default function AiRequestSummary({ members, tasks, errors, warnings, showErrors }: AiRequestSummaryProps) {
  const s = summarize(tasks, members);
  const multi = members.length > 1;

  return (
    <div className="space-y-4">
      <div>
        <div className="overflow-x-auto rounded-lg border border-theme-border/70">
          <table className="w-full text-xs">
            <thead className="bg-theme-surface-secondary/60 text-theme-text-muted">
              <tr>
                <th className="text-left font-semibold px-3 py-2">ผู้ใช้</th>
                <th className="text-right font-semibold px-3 py-2">จำนวนงาน</th>
                <th className="text-right font-semibold px-3 py-2">เวลาที่ทำอยู่ (ชม./สัปดาห์)</th>
                <th className="text-right font-semibold px-3 py-2">คาดว่าประหยัด (ชม./สัปดาห์)</th>
                <th className="text-left font-semibold px-3 py-2">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border/50">
              {s.perMember.map((m) => {
                const missing = multi && m.taskCount === 0;
                return (
                  <tr key={m.key} className={missing ? 'bg-rose-500/5' : undefined}>
                    <td className="px-3 py-2 font-medium text-theme-text">{m.name}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{m.taskCount}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{m.hoursBefore.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{m.hoursSaved.toFixed(1)}</td>
                    <td className="px-3 py-2">
                      {missing ? (
                        <span className="inline-flex items-center gap-1 text-rose-500 font-medium">
                          <AlertCircle size={13} /> ยังไม่มีงาน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 size={13} /> พร้อม
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-theme-border bg-theme-surface-secondary/60 font-semibold text-theme-text">
              <tr>
                <td className="px-3 py-2">รวม</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{tasks.length}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{s.hoursBeforePerWeek.toFixed(1)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{s.hoursSavedPerWeek.toFixed(1)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {showErrors && errors.length > 0 && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3" role="alert">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-300 mb-1.5">
            ต้องแก้ {errors.length} รายการก่อนส่งคำขอ (กดที่รายการเพื่อไปยังจุดที่ต้องแก้)
          </p>
          <IssueList issues={errors} tone="error" />
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5">ข้อสังเกต (ส่งคำขอได้ แต่ควรตรวจสอบ)</p>
          <IssueList issues={warnings} tone="warn" />
        </div>
      )}
    </div>
  );
}
