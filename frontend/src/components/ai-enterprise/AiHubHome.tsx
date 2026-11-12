import {
  FileCheck2, BookOpen, Bot, ChevronRight, Compass, ArrowRight,
  Laptop, Sparkles, ShieldAlert, HelpCircle, type LucideIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import type { AiRequest, AiMonthlyReport } from '../../pages/AiEnterprisePage';
import type { AiHubTab } from './aiHubTabs';
import { statusMeta } from './aiRequestStatus';
import type { HistoryStatusFilter } from './AiRequestHistory';

interface AiHubHomeProps {
  userName: string;
  myRequests: AiRequest[];
  reports: AiMonthlyReport[];
  isAdmin: boolean;
  pendingCount: number;
  dormantCount: number;
  loading: boolean;
  onNavigate: (tab: AiHubTab) => void;
  /** Opens the request form with the chosen tier already selected. */
  onRequest: (tier: 'virtual_employee' | 'general_web') => void;
  /** Opens the request history page, optionally with a status filter already applied. */
  onOpenHistory: (status?: HistoryStatusFilter) => void;
}

const STEPS = [
  { title: 'เลือกแพ็กเกจ', desc: 'ดูว่าฝ่ายของคุณเหมาะกับ AI แบบไหน' },
  { title: 'กรอกคำขอ', desc: 'บอกว่าจะใช้ AI ช่วยงานอะไร ประหยัดเวลาเท่าไร' },
  { title: 'รอผลพิจารณา', desc: 'CoE ตรวจคำขอและแจ้งผลให้ทราบ' },
  { title: 'ใช้งาน & รายงานผล', desc: 'ใช้ AI แล้วสรุปผลงานให้ CoE ทุกเดือน' },
];

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  tone: string;
  onClick?: () => void;
  to?: string;
  disabledNote?: string;
}

function ActionCard({ icon: Icon, title, desc, tone, onClick, to, disabledNote }: ActionCardProps) {
  const inner = (
    <>
      <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tone)}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-theme-text">{title}</span>
        <span className="block text-xs text-theme-text-muted mt-0.5 leading-relaxed">{disabledNote || desc}</span>
      </span>
      <ChevronRight size={16} className="text-theme-text-muted shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </>
  );
  const cls = 'group w-full flex items-center gap-3 p-4 rounded-xl border border-theme-border/80 bg-theme-surface hover:border-indigo-500/40 hover:shadow-sm transition-all cursor-pointer';

  if (to) {
    return <Link to={to} className={cls}>{inner}</Link>;
  }
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export default function AiHubHome({
  userName, myRequests, reports, isAdmin, pendingCount, dormantCount, loading,
  onNavigate, onRequest, onOpenHistory,
}: AiHubHomeProps) {
  const month = currentMonthKey();
  const approved = myRequests.filter((r) => r.status === 'approved_sandbox');
  const needsReport = approved.filter((r) => !reports.some((rp) => rp.request_id === r.id && rp.report_month === month));
  const firstName = (userName || '').trim().split(/\s+/)[0] || 'คุณ';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* 1. Start here */}
      <section className="rounded-2xl border border-theme-border/80 bg-theme-surface shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5">
          <div className="lg:col-span-3 p-6 sm:p-8 flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">เริ่มต้นที่นี่</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-text mt-2">
              สวัสดี {firstName} อยากใช้ AI ช่วยงานของคุณไหม?
            </h2>
            <p className="text-sm text-theme-text-muted mt-2 leading-relaxed max-w-xl">
              ยื่นคำขอใช้ AI ได้ในไม่กี่นาที ทีม CoE จะพิจารณาและแจ้งผล คุณติดตามสถานะได้ในหน้านี้
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => onNavigate('presets')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Compass size={16} />
                ไม่แน่ใจ? ดูแพ็กเกจที่เหมาะกับฝ่ายฉัน
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 p-6 sm:p-8 bg-theme-surface-secondary/50 border-t lg:border-t-0 lg:border-l border-theme-border/60">
            <p className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">ขั้นตอนทั้งหมด</p>
            <ol className="mt-4 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-theme-text">{s.title}</span>
                    <span className="block text-xs text-theme-text-muted leading-relaxed">{s.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 2. Admin to-do (admins/managers only) */}
      {isAdmin && (pendingCount > 0 || dormantCount > 0) && (
        <section aria-label="งานของผู้ดูแล" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <ShieldAlert size={18} /> งานที่รอผู้ดูแล
          </span>
          {pendingCount > 0 && (
            <button type="button" onClick={() => onOpenHistory('pending_review')} className="inline-flex items-center gap-1.5 text-sm text-theme-text hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer">
              <strong>{pendingCount}</strong> คำขอรอพิจารณา <ArrowRight size={14} />
            </button>
          )}
          {dormantCount > 0 && (
            <button type="button" onClick={() => onNavigate('dashboard')} className="inline-flex items-center gap-1.5 text-sm text-theme-text hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer">
              <strong>{dormantCount}</strong> สิทธิ์ที่ไม่มีความเคลื่อนไหว <ArrowRight size={14} />
            </button>
          )}
        </section>
      )}

      {/* 3. What can I do */}
      <section aria-labelledby="hub-actions">
        <h3 id="hub-actions" className="text-base font-semibold text-theme-text mb-3">คุณต้องการทำอะไร</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ActionCard
            icon={FileCheck2}
            title="ส่งรายงานผลงานรายเดือน"
            desc="สรุปว่า AI ช่วยประหยัดเวลาไปเท่าไร (สำหรับคำขอที่อนุมัติแล้ว)"
            tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            onClick={() => onNavigate('reports')}
          />
          <ActionCard
            icon={Bot}
            title="เปิด AI Chat"
            desc="ใช้ AI ภายในองค์กรได้ทันที ไม่ต้องรออนุมัติ"
            tone="bg-sky-500/10 text-sky-600 dark:text-sky-400"
            to="/ai-chat"
          />
          <ActionCard
            icon={BookOpen}
            title="อ่านคู่มือ & นโยบาย"
            desc="ข้อควรรู้เรื่องความปลอดภัยของข้อมูลและกติกาการใช้งาน"
            tone="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            onClick={() => onNavigate('governance')}
          />
        </div>
      </section>

      {/* 4. My requests */}
      <section aria-labelledby="hub-my-requests">
        <div className="flex items-center justify-between mb-3">
          <h3 id="hub-my-requests" className="text-base font-semibold text-theme-text">คำขอของฉัน</h3>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => onOpenHistory('all')} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
              ดูประวัติคำขอทั้งหมด
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-theme-border/80 bg-theme-surface p-6 text-sm text-theme-text-muted">กำลังโหลดข้อมูล…</div>
        ) : myRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-theme-border bg-theme-surface p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles size={22} />
            </div>
            <p className="mt-3 text-sm font-semibold text-theme-text">คุณยังไม่มีคำขอ</p>
            <p className="mt-1 text-xs text-theme-text-muted">คำขอที่คุณยื่นและสถานะจะแสดงที่นี่</p>
          </div>
        ) : (
          <ul className="rounded-xl border border-theme-border/80 bg-theme-surface divide-y divide-theme-border/60 overflow-hidden">
            {myRequests.map((r) => {
              const meta = statusMeta(r.status);
              const reportDue = needsReport.some((x) => x.id === r.id);
              return (
                <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-theme-text truncate">{r.title}</p>
                    <p className="text-xs text-theme-text-muted mt-0.5">
                      {r.department} · {r.requested_seats} สิทธิ์ · ยื่นเมื่อ {formatDate(r.created_at)}
                    </p>
                    <p className="text-xs text-theme-text-muted mt-1">{meta.hint}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', meta.badge)}>
                      <meta.Icon size={13} />
                      {meta.label}
                    </span>
                    {reportDue && (
                      <button
                        type="button"
                        onClick={() => onNavigate('reports')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        ส่งรายงานเดือนนี้
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 5. Choose a service */}
      <section aria-labelledby="hub-services">
        <h3 id="hub-services" className="text-base font-semibold text-theme-text mb-3">AI ของเรามี 2 แบบ เลือกแบบที่เหมาะกับงาน</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <article className="rounded-xl border border-theme-border/80 bg-theme-surface p-5 flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><Laptop size={18} /></span>
              <div>
                <h4 className="text-sm font-semibold text-theme-text">พนักงาน AI เสมือน (Virtual AI Employee)</h4>
                <p className="text-xs text-theme-text-muted">Claude Team Premium · ต้องขออนุมัติ</p>
              </div>
            </div>
            <p className="text-sm text-theme-text-muted mt-3 leading-relaxed">
              เหมาะกับงานซับซ้อนเฉพาะทาง ได้สิทธิ์ส่วนตัวเสมือนมีผู้ช่วย 1 คน ต้องระบุหน้าที่ของ AI (JD) ให้ชัดเจน
            </p>
            <div className="mt-auto pt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-theme-text-muted">จัดสรรสิทธิ์ & วางบิลทุกวันที่ 15</span>
              <button
                type="button"
                onClick={() => onRequest('virtual_employee')}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                ขอพนักงาน AI
              </button>
            </div>
          </article>

          <article className="rounded-xl border border-theme-border/80 bg-theme-surface p-5 flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><Sparkles size={18} /></span>
              <div>
                <h4 className="text-sm font-semibold text-theme-text">AI สำหรับพนักงานทั่วไป</h4>
                <p className="text-xs text-theme-text-muted">ChatGPT, DeepSeek, Minimax · ใช้ได้ทันที</p>
              </div>
            </div>
            <p className="text-sm text-theme-text-muted mt-3 leading-relaxed">
              ใช้งานผ่านเว็บภายในองค์กร ข้อมูลของคุณไม่ถูกนำไปเทรนโมเดล เหมาะกับงานทั่วไป เช่น สรุปเอกสาร ร่างอีเมล แปลภาษา
            </p>
            <div className="mt-auto pt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-theme-text-muted">คิดค่าบริการตามการใช้งานจริง</span>
              <Link
                to="/ai-chat"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                เปิด AI Chat <ChevronRight size={14} />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* 6. Help */}
      <footer className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-theme-border/60 text-sm text-theme-text-muted">
        <span className="inline-flex items-center gap-1.5"><HelpCircle size={15} /> ใช้งานครั้งแรกและยังไม่แน่ใจ?</span>
        <button type="button" onClick={() => onNavigate('governance')} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
          อ่านคู่มือ & วงจรการทำงาน
        </button>
      </footer>
    </div>
  );
}
