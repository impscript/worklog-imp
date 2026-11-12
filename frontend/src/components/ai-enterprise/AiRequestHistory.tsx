import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Search, Sliders, Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AiRequest, AiEvaluation } from '../../pages/AiEnterprisePage';
import { DECISION_LABEL, STATUS_META, STATUS_ORDER, asArray, statusMeta, type AiRequestStatus } from './aiRequestStatus';

export type HistoryStatusFilter = 'all' | AiRequestStatus;

interface AiRequestHistoryProps {
  requests: AiRequest[];
  evaluations: AiEvaluation[];
  isAdmin: boolean;
  /** true when the request belongs to the signed-in user (requester or listed member) */
  isMine: (request: AiRequest) => boolean;
  status: HistoryStatusFilter;
  onStatusChange: (status: HistoryStatusFilter) => void;
  loading: boolean;
  onEvaluate: (requestId: string) => void;
}

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AiRequestHistory({
  requests, evaluations, isAdmin, isMine, status, onStatusChange, loading, onEvaluate,
}: AiRequestHistoryProps) {
  // Admins see everyone's requests by default; members only ever see their own.
  const [scope, setScope] = useState<'mine' | 'all'>(isAdmin ? 'all' : 'mine');
  const effectiveScope = isAdmin ? scope : 'mine';
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const latestEvaluation = useMemo(() => {
    const map = new Map<string, AiEvaluation>();
    [...evaluations]
      .sort((a, b) => new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime())
      .forEach((e) => {
        if (!map.has(e.request_id)) map.set(e.request_id, e);
      });
    return map;
  }, [evaluations]);

  const scoped = useMemo(
    () => (effectiveScope === 'mine' ? requests.filter(isMine) : requests),
    [requests, effectiveScope, isMine]
  );

  const counts = useMemo(() => {
    const c: Record<HistoryStatusFilter, number> = { all: scoped.length, pending_review: 0, approved_sandbox: 0, waiting_list: 0, rejected: 0, completed: 0 };
    scoped.forEach((r) => {
      if (r.status in c) c[r.status] += 1;
    });
    return c;
  }, [scoped]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped
      .filter((r) => status === 'all' || r.status === status)
      .filter(
        (r) =>
          !q ||
          r.title.toLowerCase().includes(q) ||
          (r.requester_name || '').toLowerCase().includes(q) ||
          (r.department || '').toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [scoped, status, search]);

  const shown = rows.slice(0, visible);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-theme-text">ประวัติคำขอ</h2>
          <p className="text-sm text-theme-text-muted mt-0.5">
            {effectiveScope === 'mine' ? 'คำขอที่คุณยื่นหรืออยู่ในรายชื่อผู้ใช้สิทธิ์' : 'คำขอทั้งหมดของ Workspace นี้'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="inline-flex rounded-lg border border-theme-border overflow-hidden text-xs font-semibold" role="group" aria-label="ขอบเขตรายการ">
              {([['all', 'ทั้งหมด'], ['mine', 'ของฉัน']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={scope === value}
                  onClick={() => { setScope(value); setVisible(PAGE_SIZE); }}
                  className={cn(
                    'px-3 py-1.5 cursor-pointer transition-colors',
                    scope === value ? 'bg-indigo-600 text-white' : 'bg-theme-surface text-theme-text-muted hover:text-theme-text'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...STATUS_ORDER] as HistoryStatusFilter[]).map((value) => {
          const label = value === 'all' ? 'ทั้งหมด' : STATUS_META[value].label;
          const active = status === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => { onStatusChange(value); setVisible(PAGE_SIZE); }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer',
                active
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary'
              )}
            >
              {label}
              <span className={cn('tabular-nums', active ? 'text-white/80' : 'text-theme-text-muted')}>{counts[value]}</span>
            </button>
          );
        })}
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
            placeholder="ค้นหาชื่อคำขอ ผู้ขอ หรือฝ่าย"
            aria-label="ค้นหาคำขอ"
            className="w-full text-xs py-2 pl-8 pr-3 rounded-lg bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-theme-border/80 bg-theme-surface p-6 text-sm text-theme-text-muted">กำลังโหลดข้อมูล…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-theme-border bg-theme-surface p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Inbox size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-theme-text">ไม่พบคำขอ</p>
          <p className="mt-1 text-xs text-theme-text-muted">
            {status !== 'all' || search ? 'ลองเปลี่ยนตัวกรองหรือคำค้นหา' : 'ยังไม่มีคำขอในรายการนี้'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-theme-border/80 bg-theme-surface overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-theme-surface-secondary/60 text-theme-text-muted">
              <tr>
                <th className="w-8 px-2 py-2.5" aria-label="ขยาย" />
                <th className="text-left font-semibold px-3 py-2.5">ชื่อคำขอ</th>
                <th className="text-left font-semibold px-3 py-2.5">ฝ่าย / แผนก</th>
                <th className="text-right font-semibold px-3 py-2.5">สิทธิ์</th>
                <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">วันที่ยื่น</th>
                <th className="text-left font-semibold px-3 py-2.5">สถานะ</th>
                <th className="text-left font-semibold px-3 py-2.5">ผลพิจารณา</th>
                {isAdmin && <th className="px-3 py-2.5 w-28" aria-label="การจัดการ" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border/50">
              {shown.map((r) => {
                const meta = statusMeta(r.status);
                const members = asArray<{ name?: string }>(r.team_members);
                const useCases = asArray<{ title?: string }>(r.use_cases);
                const ev = latestEvaluation.get(r.id);
                const open = openId === r.id;
                return (
                  <FragmentRow
                    key={r.id}
                    open={open}
                    colSpan={isAdmin ? 8 : 7}
                    summary={
                      <>
                        <td className="px-2 py-2.5 align-top">
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : r.id)}
                            aria-expanded={open}
                            aria-label={open ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                            className="w-6 h-6 rounded-md inline-flex items-center justify-center text-theme-text-muted hover:bg-theme-surface-secondary cursor-pointer"
                          >
                            <ChevronDown size={15} className={cn('transition-transform', !open && '-rotate-90')} />
                          </button>
                        </td>
                        <td className="px-3 py-2.5 align-top max-w-xs">
                          <button type="button" onClick={() => setOpenId(open ? null : r.id)} className="text-left cursor-pointer">
                            <span className="block font-semibold text-theme-text">{r.title}</span>
                            <span className="block text-[11px] text-theme-text-muted mt-0.5">{r.requester_name}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 align-top text-theme-text">{r.department}</td>
                        <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums">{r.requested_seats}</td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap text-theme-text-muted">{formatDate(r.created_at)}</td>
                        <td className="px-3 py-2.5 align-top">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap', meta.badge)}>
                            <meta.Icon size={12} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top text-theme-text-muted">
                          {ev ? (
                            <>
                              <span className="block text-theme-text">{DECISION_LABEL[ev.decision] ?? ev.decision}</span>
                              <span className="block text-[11px]">คะแนน {Number(ev.total_score)}/100</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-2.5 align-top text-right">
                            <button
                              type="button"
                              onClick={() => onEvaluate(r.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Sliders size={12} />
                              {r.status === 'pending_review' ? 'พิจารณา' : 'ดูผลประเมิน'}
                            </button>
                          </td>
                        )}
                      </>
                    }
                    detail={
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                        <div>
                          <dt className="text-theme-text-muted">สถานะ</dt>
                          <dd className="text-theme-text mt-0.5">{meta.hint}</dd>
                        </div>
                        <div>
                          <dt className="text-theme-text-muted">ผู้ขอ</dt>
                          <dd className="text-theme-text mt-0.5">
                            {r.requester_name}
                            {r.position ? ` · ${r.position}` : ''}
                          </dd>
                        </div>
                        {r.supervisor_name && (
                          <div>
                            <dt className="text-theme-text-muted">หัวหน้าสายงาน</dt>
                            <dd className="text-theme-text mt-0.5">{r.supervisor_name}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-theme-text-muted">รายชื่อผู้ใช้สิทธิ์</dt>
                          <dd className="text-theme-text mt-0.5">
                            {members.length > 0 ? members.map((m) => m?.name).filter(Boolean).join(', ') : r.requester_name}
                          </dd>
                        </div>
                        {useCases.length > 0 && (
                          <div className="sm:col-span-2">
                            <dt className="text-theme-text-muted">งานที่จะให้ AI ช่วย ({useCases.length} งาน)</dt>
                            <dd className="text-theme-text mt-0.5">{useCases.map((u) => u?.title).filter(Boolean).join(' · ')}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-theme-text-muted">เวลาที่คาดว่าจะประหยัด</dt>
                          <dd className="text-theme-text mt-0.5">{Number(r.target_hours_saved_per_week)} ชม./สัปดาห์</dd>
                        </div>
                        {r.expected_benefits && (
                          <div className="sm:col-span-2">
                            <dt className="text-theme-text-muted">ผลลัพธ์อื่นที่คาดหวัง</dt>
                            <dd className="text-theme-text mt-0.5 whitespace-pre-line">{r.expected_benefits}</dd>
                          </div>
                        )}
                        {ev?.evaluation_notes && (
                          <div className="sm:col-span-2">
                            <dt className="text-theme-text-muted">หมายเหตุจากผู้พิจารณา</dt>
                            <dd className="text-theme-text mt-0.5 whitespace-pre-line">{ev.evaluation_notes}</dd>
                          </div>
                        )}
                      </dl>
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > visible && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="px-4 py-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-sm font-medium text-theme-text cursor-pointer"
          >
            แสดงเพิ่ม ({rows.length - visible} รายการ)
          </button>
        </div>
      )}
    </div>
  );
}

/** A table row plus an optional full-width detail row underneath. */
function FragmentRow({ summary, detail, open, colSpan }: { summary: ReactNode; detail: ReactNode; open: boolean; colSpan: number }) {
  return (
    <>
      <tr className={cn('hover:bg-theme-surface-secondary/40 transition-colors', open && 'bg-theme-surface-secondary/30')}>{summary}</tr>
      {open && (
        <tr className="bg-theme-surface-secondary/30">
          <td colSpan={colSpan} className="px-6 pb-4 pt-1">{detail}</td>
        </tr>
      )}
    </>
  );
}
