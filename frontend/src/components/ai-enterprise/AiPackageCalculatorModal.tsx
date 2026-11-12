import { useEffect, useState } from 'react';
import {
  Calculator,
  Sparkles,
  Users,
  Check,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LICENSING_ROUTES, AI_MODEL_MATRIX, type AiLicensingRouteId } from './aiDepartmentPresets';
import ModalPortal from '../modals/ModalPortal';

const BAHT_PER_USD = 35;
const MAX_SEATS = 9999;

// Route color scheme mappings
const ROUTE_COLORS: Record<
  'indigo' | 'purple' | 'emerald' | 'amber',
  {
    bg: string;
    border: string;
    text: string;
    badge: string;
    glow: string;
    bar: string;
  }
> = {
  indigo: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    glow: 'hover:border-indigo-500/50 hover:shadow-indigo-500/10',
    bar: 'bg-indigo-500'
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    glow: 'hover:border-purple-500/50 hover:shadow-purple-500/10',
    bar: 'bg-purple-500'
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    glow: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
    bar: 'bg-emerald-500'
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    glow: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
    bar: 'bg-amber-500'
  }
};

type Quote = { thb: string; usd: string; formula: string };

/** Monthly estimate for one package. Package minimums (2 seats for Team, 20 for Enterprise) are applied to the billed seats. */
function quoteFor(routeId: AiLicensingRouteId, seats: number): Quote {
  if (seats < 1) return { thb: '-', usd: '-', formula: 'กรอกจำนวนที่นั่งด้านบน' };
  const money = (usd: number, approx = false) => ({
    thb: `${approx ? '~' : ''}${(usd * BAHT_PER_USD).toLocaleString()} บาท`,
    usd: `${approx ? '~' : ''}$${usd.toLocaleString()}`,
  });
  if (routeId === 'subscription_team') {
    const billed = Math.max(seats, 2);
    return { ...money(billed * 25), formula: `$25 × ${billed} ที่นั่ง${billed > seats ? ' (ขั้นต่ำ 2)' : ''}` };
  }
  if (routeId === 'subscription_premium') {
    const billed = Math.max(seats, 2);
    return { ...money(billed * 100), formula: `$100 × ${billed} ที่นั่ง${billed > seats ? ' (ขั้นต่ำ 2)' : ''}` };
  }
  if (routeId === 'api_payg') {
    return { ...money(seats * 5, true), formula: 'เฉลี่ย ~$5/คน ตามปริมาณจริง' };
  }
  const billed = Math.max(seats, 20);
  return { ...money(billed * 60, true), formula: `$60 × ${billed} ที่นั่ง (ขั้นต่ำ 20 / รายปี)` };
}

interface AiPackageCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CalculatorTab = 'budget' | 'models';

/** Seat-based budget calculator, package comparison and model comparison, opened from the AI Hub header. */
export default function AiPackageCalculatorModal({ isOpen, onClose }: AiPackageCalculatorModalProps) {
  const [tab, setTab] = useState<CalculatorTab>('budget');
  const [seatInput, setSeatInput] = useState('2');
  const [selectedRouteId, setSelectedRouteId] = useState<AiLicensingRouteId>('subscription_team');
  const [isFeatureMatrixOpen, setIsFeatureMatrixOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parsed = parseInt(seatInput, 10);
  const seatCount = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, MAX_SEATS) : 0;
  const standard = quoteFor('subscription_team', seatCount);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เครื่องคิดเลขงบประมาณ AI"
          className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-theme-border bg-theme-surface shadow-2xl text-theme-text"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-theme-border/70">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Calculator size={18} />
              </span>
              <div>
                <h2 className="text-base font-bold text-theme-text">เครื่องคิดเลข AI</h2>
                <p className="text-xs text-theme-text-muted">คำนวณงบประมาณรายเดือนและเปรียบเทียบแพ็กเกจ / โมเดล</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="p-2 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-5 pt-3 border-b border-theme-border/70" role="tablist">
            {([
              { id: 'budget', label: 'คำนวณงบประมาณและเปรียบเทียบแพ็กเกจ' },
              { id: 'models', label: 'เปรียบเทียบโมเดล 4 ค่ายชั้นนำ' },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3.5 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px cursor-pointer transition-colors',
                  tab === t.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-theme-text-muted hover:text-theme-text',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {tab === 'budget' && (
              <div className="space-y-5">
                {/* Seat input + headline budget */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-theme-surface to-purple-500/10 border border-indigo-500/25">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="space-y-2 flex-1">
                      <label htmlFor="ai-calc-seats" className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                        <Users size={14} className="text-indigo-500" />
                        <span>จำนวนที่นั่งที่ต้องการ (กรอกเอง)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="ai-calc-seats"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_SEATS}
                          step={1}
                          value={seatInput}
                          onChange={(e) => setSeatInput(e.target.value)}
                          placeholder="เช่น 5"
                          className="w-32 px-3 py-2 rounded-xl bg-theme-bg-page border border-theme-border text-sm font-mono font-bold text-theme-text focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-sm text-theme-text-muted">ที่นั่ง</span>
                      </div>
                      <p className="text-[11px] text-theme-text-muted">
                        หนึ่งที่นั่ง = หนึ่งคนที่ระบุชื่อ · แพ็กเกจ Team ขั้นต่ำ 2 ที่นั่ง · Enterprise ขั้นต่ำ 20 ที่นั่ง (ระบบคิดตามขั้นต่ำให้อัตโนมัติ)
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-theme-surface/85 border border-indigo-500/30 shrink-0 min-w-[260px]">
                      <span className="text-xs font-semibold text-theme-text-muted block">
                        งบประมาณ Claude Team Standard
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {standard.thb.replace(' บาท', '')}
                        </span>
                        <span className="text-xs text-theme-text-muted">บาท / เดือน</span>
                        <span className="text-[11px] font-mono font-semibold text-theme-text-muted ml-auto">({standard.usd})</span>
                      </div>
                      <div className="mt-1 text-[11px] font-mono text-theme-text-muted">{standard.formula} · ~{BAHT_PER_USD} บาท/$</div>
                    </div>
                  </div>
                </div>

        {/* 4 Packaging Cards (Stripe / Linear Pricing Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {LICENSING_ROUTES.map((route) => {
            const isStandard = route.id === 'subscription_team';
            const colors = ROUTE_COLORS[route.colorScheme];
            const isSelected = selectedRouteId === route.id;

            const quote = quoteFor(route.id, seatCount);
            const totalThbText = quote.thb;
            const totalUsdText = quote.usd;
            const formulaText = quote.formula;

            return (
              <div
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
                className={cn(
                  'p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between relative group h-full',
                  isSelected
                    ? 'lg:-translate-y-2 lg:scale-[1.02] shadow-xl shadow-indigo-500/20 ring-2 ring-indigo-500/50 border-indigo-500 z-10 bg-gradient-to-b from-indigo-500/15 via-theme-surface to-theme-surface'
                    : 'bg-theme-bg-page/75 hover:bg-theme-bg-page border-theme-border/80 hover:border-theme-border opacity-95 hover:opacity-100 hover:-translate-y-1'
                )}
              >
                {/* Popular / Active Ribbon Badge */}
                {isSelected ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-[10px] font-bold shadow-md shadow-indigo-600/30 whitespace-nowrap flex items-center gap-1.5 border border-white/20">
                    <Sparkles size={11} className="text-amber-300 animate-pulse" />
                    <span>{isStandard ? 'แนะนำสูงสุดสำหรับองค์กร' : 'แพ็กเกจที่เลือกดู'}</span>
                  </div>
                ) : isStandard ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-theme-surface text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shadow-2xs whitespace-nowrap flex items-center gap-1 border border-indigo-500/30">
                    <Sparkles size={11} className="text-amber-500" />
                    <span>ยอดนิยม</span>
                  </div>
                ) : null}

                {/* Top Info */}
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide whitespace-nowrap shrink-0',
                        colors.badge
                      )}
                    >
                      {route.badge}
                    </span>
                    <span className="text-[10px] text-theme-text-muted font-medium truncate text-right">
                      {route.billingType.split('(')[0].trim()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-theme-text leading-snug tracking-tight">
                      {route.name}
                    </h4>
                    {/* Dynamic Cost Projection for Selected Seats */}
                    <div className="mt-2.5 p-3 rounded-xl bg-theme-bg-page/90 border border-theme-border/70 shadow-2xs">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="text-xl xl:text-2xl font-black font-mono tracking-tight text-theme-text tabular-nums whitespace-nowrap">
                          {totalThbText}
                        </span>
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {totalUsdText} / ด.
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-theme-text-muted border-t border-theme-border/40 pt-1">
                        <span>{formulaText}</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          ({seatCount > 0 ? seatCount : '-'} ที่นั่ง)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-theme-border/50">
                    <p className="text-xs text-theme-text-muted leading-relaxed">
                      <strong className="text-theme-text font-bold">เหมาะกับ:</strong> {route.bestFor}
                    </p>
                  </div>

                  {/* Pros List */}
                  <div className="space-y-1.5 pt-1 min-h-[140px]">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check size={13} />
                      <span>จุดเด่นสำคัญ:</span>
                    </span>
                    <ul className="space-y-1.5">
                      {route.pros.slice(0, 3).map((pro, pIdx) => (
                        <li key={pIdx} className="text-xs text-theme-text flex items-start gap-1.5 leading-relaxed">
                          <CheckCircle2 size={13} className="text-emerald-500 font-bold shrink-0 mt-0.5" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cons List */}
                  <div className="space-y-1 pt-1 min-h-[75px]">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      <span>ข้อควรระวัง:</span>
                    </span>
                    <ul className="space-y-1">
                      {route.cons.slice(0, 2).map((con, cIdx) => (
                        <li key={cIdx} className="text-xs text-theme-text-muted flex items-start gap-1.5 leading-relaxed">
                          <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bottom Action & Security Note */}
                <div className="mt-4 pt-3 border-t border-theme-border/50 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-theme-text-muted flex items-center gap-1 line-clamp-1">
                      <Shield size={11} className={colors.text} />
                      <span>{route.securityLevel.split(',')[0]}</span>
                    </span>
                    <span className={cn('font-mono font-semibold text-[11px]', colors.text)}>
                      {route.id === 'subscription_team'
                        ? 'Team 2+'
                        : route.id === 'subscription_premium'
                        ? '5x Quota'
                        : route.id === 'api_payg'
                        ? 'Pay-As-You-Go'
                        : '20+ Seats'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accordion Toggle: Full Feature Comparison Matrix */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsFeatureMatrixOpen(!isFeatureMatrixOpen)}
            className="w-full p-4 rounded-2xl bg-theme-surface/75 hover:bg-theme-surface border border-theme-border/80 hover:border-indigo-500/40 flex items-center justify-between text-xs font-bold text-theme-text transition-all cursor-pointer shadow-xs group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shadow-2xs">
                <Layers size={16} />
              </div>
              <div className="text-left">
                <span className="text-sm sm:text-base font-bold text-theme-text block">
                  {isFeatureMatrixOpen
                    ? 'ตารางเปรียบเทียบฟีเจอร์ละเอียด 4 แพ็กเกจ (Detailed Feature Matrix)'
                    : '🔍 เปิดกางดูตารางเปรียบเทียบฟีเจอร์ละเอียดทุกมิติ (Full Feature Matrix)'}
                </span>
                <span className="text-xs text-theme-text-muted font-normal mt-0.5 block">
                  เปรียบเทียบ 12 มิติ: โมเดล, โควตา, ความปลอดภัย ZDR, สิทธิ์ใช้หลายเครื่อง, และระบบแชร์ความรู้
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
              <span>{isFeatureMatrixOpen ? 'ย่อตาราง' : 'คลิกเพื่อกางดู'}</span>
              {isFeatureMatrixOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {/* Full Comparison Table Content */}
          {isFeatureMatrixOpen && (
            <div className="mt-3 rounded-2xl border border-theme-border/80 bg-theme-surface/60 overflow-hidden shadow-sm animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-theme-text border-collapse">
                  <thead>
                    <tr className="border-b border-theme-border/80 bg-theme-bg-page/90 text-[11px] font-bold text-theme-text-muted">
                      <th className="p-3.5 sm:p-4 min-w-[200px]">หัวข้อเปรียบเทียบ (Feature)</th>
                      <th className="p-3.5 sm:p-4 min-w-[190px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border-x border-indigo-500/20">
                        ⭐ Claude Team Standard
                      </th>
                      <th className="p-3.5 sm:p-4 min-w-[190px]">Claude Team Premium</th>
                      <th className="p-3.5 sm:p-4 min-w-[190px]">พอร์ทัลกลาง AI Sandbox</th>
                      <th className="p-3.5 sm:p-4 min-w-[190px]">Claude Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border/50">
                    {/* Category: Models & Processing */}
                    <tr className="bg-theme-bg-page/40 font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                      <td colSpan={5} className="px-4 py-2 uppercase tracking-wider">
                        1. โมเดลและขีดความสามารถประมวลผล (AI Models &amp; Quotas)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">โมเดลหลักที่ใช้ได้</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-medium">
                        Claude 3.5 Sonnet &amp; 3.5 Haiku
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">Sonnet, Haiku, Opus</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">Claude, GPT-4o, Gemini, DeepSeek</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">Claude 3.5 Sonnet &amp; Opus</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">โควตาข้อความรายวัน (Rate Limits)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-medium text-emerald-600 dark:text-emerald-400">
                        มาตรฐานทีม (~100 ข้อความ/5 ชม.)
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted font-bold text-indigo-500">
                        โควตาสูงพิเศษ 5 เท่า
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">ไม่จำกัด (จ่ายตาม Token จริง)</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted font-bold">โควตาระดับองค์กรสูงสุด</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">Claude Code CLI &amp; Terminal Coding</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 text-theme-text-muted">
                        ❌ ต้องต่อผ่าน API เสริม
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ รองรับเต็มรูปแบบ
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">❌ ใช้งานผ่านเว็บพอร์ทัล</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">✅ รองรับผ่าน Enterprise API</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">ความยาวบริบท (Context Window)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-mono">
                        200,000 Tokens (~500 หน้า)
                      </td>
                      <td className="p-3.5 sm:p-4 font-mono text-theme-text-muted">200,000 Tokens</td>
                      <td className="p-3.5 sm:p-4 font-mono text-theme-text-muted">128K - 2,000,000 Tokens</td>
                      <td className="p-3.5 sm:p-4 font-mono font-bold text-indigo-500">500,000 Tokens (ขยายพิเศษ)</td>
                    </tr>

                    {/* Category: Team Collaboration */}
                    <tr className="bg-theme-bg-page/40 font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                      <td colSpan={5} className="px-4 py-2 uppercase tracking-wider">
                        2. การทำงานร่วมกันในทีม (Collaboration &amp; Knowledge Hub)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">คลังโครงการกลาง (Shared Projects)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ มี (แชร์ Prompt &amp; SOP ในฝ่าย)
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ มี (พร้อมแชร์ Code Snippets)
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">❌ ไม่มี (แชตแยกบุคคล)</td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ มี (ระบบ RBAC ระดับองค์กร)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">สิทธิ์ล็อกอินข้ามอุปกรณ์ส่วนบุคคล</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
                        ✅ PC + โน้ตบุ๊ก + มือถือ (ห้ามแชร์รหัส)
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">✅ ข้ามอุปกรณ์ส่วนบุคคลได้</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">✅ เปิดได้ทุกเบราว์เซอร์</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">✅ จัดการผ่าน Corporate SSO</td>
                    </tr>

                    {/* Category: Security & Governance */}
                    <tr className="bg-theme-bg-page/40 font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                      <td colSpan={5} className="px-4 py-2 uppercase tracking-wider">
                        3. ความมั่นคงปลอดภัย &amp; กฎหมาย (Security &amp; Compliance)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">การันตีไม่นำข้อมูลไปเทรน AI (Zero Training)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ รับประกัน 100% ตาม ToS
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">✅ รับประกัน 100%</td>
                      <td className="p-3.5 sm:p-4 text-emerald-600 dark:text-emerald-400">✅ ข้อมูลอยู่บน Internal Gateway</td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">✅ สัญญา Enterprise ZDR</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">การกรองข้อมูลส่วนบุคคล (PII Masking)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 text-theme-text-muted">
                        ผู้ใช้คัดกรองตามแนวปฏิบัติฝ่าย
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">ผู้ใช้คัดกรองตามแนวปฏิบัติ</td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ มีเกราะตรวจจับ Mask อัตโนมัติ
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">มีนโยบาย DLP องค์กรกำกับ</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">ระบบล็อกอินองค์กร (Corporate SSO / Azure AD)</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 text-theme-text-muted">
                        ❌ ล็อกอินด้วยอีเมลองค์กร
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">❌ ล็อกอินด้วยอีเมลองค์กร</td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ ซิงค์ระบบยืนยันตัวตนบริษัท
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ✅ รองรับ Azure AD / Okta SCIM
                      </td>
                    </tr>

                    {/* Category: Terms & Billing */}
                    <tr className="bg-theme-bg-page/40 font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                      <td colSpan={5} className="px-4 py-2 uppercase tracking-wider">
                        4. เงื่อนไขสัญญาและงบประมาณ (Commitment &amp; Billing)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">เงื่อนไขจำนวนที่นั่งขั้นต่ำ</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        ขั้นต่ำ 2 ที่นั่ง (Seats)
                      </td>
                      <td className="p-3.5 sm:p-4 font-mono text-theme-text-muted">ขั้นต่ำ 2 ที่นั่ง</td>
                      <td className="p-3.5 sm:p-4 font-mono text-emerald-600 dark:text-emerald-400">ไม่มีขั้นต่ำ (1 คนก็ใช้ได้)</td>
                      <td className="p-3.5 sm:p-4 font-mono text-rose-500 font-bold">ขั้นต่ำ 20 ที่นั่ง (สัญญารายปี)</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 sm:p-4 font-semibold text-theme-text">ความคุ้มค่าและฝ่ายงานที่แนะนำ</td>
                      <td className="p-3.5 sm:p-4 bg-indigo-500/5 border-x border-indigo-500/20 font-bold text-theme-text">
                        🏆 คุ้มค่าสูงสุดสำหรับ 6 ฝ่ายงานเอกสาร (บัญชี, จัดซื้อ, กฎหมาย, HR, ตรวจสอบ, การตลาด)
                      </td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">ฝ่ายไอที (DIT) &amp; นักพัฒนาซอฟต์แวร์</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">พนักงานทั่วไปที่ใช้แปลภาษา/ค้นคว้าเป็นครั้งคราว</td>
                      <td className="p-3.5 sm:p-4 text-theme-text-muted">คณะผู้บริหาร &amp; AI Center of Excellence</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
              </div>
            )}

            {tab === 'models' && (
              <div className="space-y-4">
                <p className="text-xs text-theme-text-muted">
                  ประเมินจุดเด่นและลักษณะงานที่เหมาะสม เพื่อเลือกโมเดลที่คุ้มค่าต่องาน (Anthropic • Google • OpenAI • DeepSeek)
                </p>
        {/* Model Comparison Cards (4 Columns Responsive) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {AI_MODEL_MATRIX.map((model) => {
            const isSonnet = model.id === 'claude-sonnet';

            return (
              <div
                key={model.id}
                className={cn(
                  'p-4 sm:p-5 rounded-2xl border flex flex-col justify-between transition-all duration-200',
                  'bg-theme-bg-page/60 hover:bg-theme-bg-page',
                  isSonnet
                    ? 'border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-xs'
                    : 'border-theme-border/70 hover:border-theme-border'
                )}
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      {model.provider}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-theme-surface border border-theme-border/60 text-theme-text-muted truncate max-w-[150px] text-right">
                      {model.flagshipBadge}
                    </span>
                  </div>

                  {/* Model Name */}
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-theme-text leading-snug">
                      {model.modelName}
                    </h4>
                    <p className="text-xs font-mono text-theme-text-muted mt-0.5">
                      ความยาวบริบท: {model.contextWindow}
                    </p>
                  </div>

                  {/* Business Highlight Box */}
                  <div className="p-2.5 rounded-xl bg-indigo-500/5 dark:bg-indigo-950/30 border border-indigo-500/20 space-y-1">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                      ความเก่งเด่นในงานจริง
                    </span>
                    <p className="text-xs text-theme-text font-medium leading-relaxed">
                      {model.businessHighlight}
                    </p>
                  </div>

                  {/* Strengths */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-theme-text flex items-center gap-1">
                      <Sparkles size={12} className="text-indigo-500" />
                      <span>จุดเด่นสำคัญ:</span>
                    </span>
                    <ul className="space-y-1.5">
                      {model.strengths.slice(0, 3).map((str, sIdx) => (
                        <li key={sIdx} className="text-xs text-theme-text-muted flex items-start gap-1.5 leading-relaxed">
                          <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Ideal Tasks */}
                  <div className="pt-2 border-t border-theme-border/50">
                    <p className="text-xs text-theme-text-muted leading-relaxed">
                      <strong className="text-theme-text font-bold">งานที่เหมาะที่สุด:</strong> {model.idealTasks}
                    </p>
                  </div>
                </div>

                {/* Bottom Route Recommendation */}
                <div className="mt-4 pt-2.5 border-t border-theme-border/50 flex items-center justify-between text-xs">
                  <span className="text-theme-text-muted text-[11px]">ช่องทางจัดสรร:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                    {model.recommendedRoute}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
