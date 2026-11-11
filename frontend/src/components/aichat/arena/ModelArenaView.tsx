import React, { useState } from 'react';
import {
  Trophy,
  Zap,
  Sparkles,
  Brain,
  Clock,
  Coins,
  Copy,
  Check,
  ChevronDown,
  LayoutGrid,
  Columns,
  Flame,
  FileCheck2,
  GraduationCap
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { MarkdownRenderer } from '../messages/MarkdownRenderer';

export type ArenaProvider = 'anthropic' | 'openai' | 'google' | 'deepseek';

export interface ArenaSlotState {
  id: string; // 'slot_1', 'slot_2', 'slot_3'
  modelId: string;
  modelName: string;
  provider: ArenaProvider;
  content: string;
  status: 'idle' | 'streaming' | 'completed' | 'error';
  latencyMs?: number;
  tokenCount?: number;
  costBaht?: number;
  errorMessage?: string;
  hasVoted?: boolean;
}

export interface ModelArenaViewProps {
  slots: ArenaSlotState[];
  layoutMode: 'dual' | 'tri';
  onChangeLayoutMode: (mode: 'dual' | 'tri') => void;
  onUpdateSlotModel: (slotIndex: number, modelId: string) => void;
  onVoteWinner: (slotIndex: number) => void;
  onApplyBattlePreset: (presetKey: 'speed_budget' | 'flagship_heavy' | 'math_reasoning') => void;
  onOpenTaskKitsModal: () => void;
  onOpenGraduationModal: () => void;
  isGenerating: boolean;
}

export const ARENA_AVAILABLE_MODELS: {
  id: string;
  name: string;
  provider: ArenaProvider;
  tierLabel: string;
  costEstimate: string;
}[] = [
  // Anthropic
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude Sonnet 5.5 / 3.7',
    provider: 'anthropic',
    tierLabel: 'High Precision / Thinking',
    costEstimate: '~0.25 ฿ / ถาม'
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude Haiku 5.5',
    provider: 'anthropic',
    tierLabel: 'Fast & Daily Comms',
    costEstimate: '~0.04 ฿ / ถาม'
  },
  // Google
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 3.8 / 2.5 Flash',
    provider: 'google',
    tierLabel: 'Ultra Speed / 1M Context',
    costEstimate: '~0.02 ฿ / ถาม'
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    tierLabel: 'Deep Multimodal Reasoning',
    costEstimate: '~0.15 ฿ / ถาม'
  },
  // OpenAI
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (Flagship)',
    provider: 'openai',
    tierLabel: 'Creative & Balanced',
    costEstimate: '~0.20 ฿ / ถาม'
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    tierLabel: 'Budget Compact',
    costEstimate: '~0.03 ฿ / ถาม'
  },
  // DeepSeek
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V4 / V3 Flash',
    provider: 'deepseek',
    tierLabel: 'Ultra-Low Cost (~0.005 ฿)',
    costEstimate: '~0.008 ฿ / ถาม'
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1 (Reasoning)',
    provider: 'deepseek',
    tierLabel: 'Chain-of-Thought Math',
    costEstimate: '~0.05 ฿ / ถาม'
  }
];

const PROVIDER_METAS: Record<
  ArenaProvider,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  anthropic: {
    label: 'Anthropic',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500'
  },
  openai: {
    label: 'OpenAI',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500'
  },
  google: {
    label: 'Google',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500'
  },
  deepseek: {
    label: 'DeepSeek',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500'
  }
};

export const ModelArenaView: React.FC<ModelArenaViewProps> = ({
  slots,
  layoutMode,
  onChangeLayoutMode,
  onUpdateSlotModel,
  onVoteWinner,
  onApplyBattlePreset,
  onOpenTaskKitsModal,
  onOpenGraduationModal,
  isGenerating
}) => {
  const [copiedSlotIndex, setCopiedSlotIndex] = useState<number | null>(null);

  const activeSlots = layoutMode === 'dual' ? slots.slice(0, 2) : slots.slice(0, 3);

  const handleCopy = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlotIndex(index);
    setTimeout(() => setCopiedSlotIndex(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-theme-bg-page/50 overflow-hidden">
      {/* ----------------------------------------------------------------- */}
      {/* TOP CONTROL BAR: Presets, Layout Mode & Action Buttons            */}
      {/* ----------------------------------------------------------------- */}
      <div className="px-4 py-2.5 border-b border-theme-border/70 bg-theme-surface/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-500 text-xs font-black">
            <Flame size={13} className="text-amber-500 animate-pulse" />
            <span>AI Arena Sandbox</span>
          </div>

          {/* Quick Battle Presets */}
          <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-theme-border/60">
            <span className="text-[11px] font-bold text-theme-text-muted mr-1">สูตรประลอง:</span>
            <button
              type="button"
              onClick={() => onApplyBattlePreset('speed_budget')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-theme-surface hover:bg-theme-surface-secondary text-theme-text border border-theme-border flex items-center gap-1 transition-all cursor-pointer"
              title="Gemini 3.8 Flash vs Claude Haiku 5.5 vs DeepSeek V4"
            >
              <Zap size={11} className="text-amber-500" />
              <span>⚡ ความเร็วสุดประหยัด</span>
            </button>
            <button
              type="button"
              onClick={() => onApplyBattlePreset('flagship_heavy')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-theme-surface hover:bg-theme-surface-secondary text-theme-text border border-theme-border flex items-center gap-1 transition-all cursor-pointer"
              title="Claude Sonnet 5.5 vs GPT-4o vs Gemini 2.5 Pro"
            >
              <Sparkles size={11} className="text-indigo-500" />
              <span>🏆 เรือธงรอบด้าน</span>
            </button>
            <button
              type="button"
              onClick={() => onApplyBattlePreset('math_reasoning')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-theme-surface hover:bg-theme-surface-secondary text-theme-text border border-theme-border flex items-center gap-1 transition-all cursor-pointer"
              title="Claude Sonnet Thinking vs DeepSeek R1 vs OpenAI o3-mini"
            >
              <Brain size={11} className="text-purple-500" />
              <span>🧮 ตรวจงบ & คิดเลข</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Open Task Kits Modal */}
          <button
            type="button"
            onClick={onOpenTaskKitsModal}
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-theme-surface hover:bg-theme-surface-secondary border border-theme-border text-theme-text flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileCheck2 size={13} className="text-indigo-500" />
            <span className="hidden sm:inline">โจทย์ 8 ฝ่ายงาน</span>
          </button>

          {/* Open Graduation Modal */}
          <button
            type="button"
            onClick={onOpenGraduationModal}
            className="px-3 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="นำผลสถิติ Sandbox ไปขออนุมัติ License FM-001"
          >
            <GraduationCap size={14} className="text-amber-500" />
            <span>ขอสิทธิ์ Enterprise</span>
          </button>

          {/* Layout Mode Toggle (Dual vs Tri) */}
          <div className="flex items-center p-0.5 rounded-xl bg-theme-surface border border-theme-border text-xs">
            <button
              type="button"
              onClick={() => onChangeLayoutMode('dual')}
              className={cn(
                'px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer',
                layoutMode === 'dual'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text'
              )}
              title="แสดง 2 โมเดลเทียบกัน"
            >
              <Columns size={12} />
              <span>2 โมเดล</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeLayoutMode('tri')}
              className={cn(
                'px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer',
                layoutMode === 'tri'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text'
              )}
              title="แสดง 3 โมเดลเทียบกัน"
            >
              <LayoutGrid size={12} />
              <span>3 โมเดล</span>
            </button>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* ARENA COLUMNS GRID                                                */}
      {/* ----------------------------------------------------------------- */}
      <div
        className={cn(
          'flex-1 grid gap-3 p-3 min-h-0 overflow-y-auto sm:overflow-hidden',
          layoutMode === 'dual'
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-3'
        )}
      >
        {activeSlots.map((slot, idx) => {
          const providerMeta = PROVIDER_METAS[slot.provider] || PROVIDER_METAS.anthropic;

          return (
            <div
              key={slot.id}
              className={cn(
                'flex flex-col rounded-2xl border bg-theme-surface/90 dark:bg-theme-surface/40 backdrop-blur-md shadow-xs overflow-hidden transition-all',
                slot.hasVoted
                  ? 'border-amber-500/60 ring-2 ring-amber-500/20'
                  : 'border-theme-border/80'
              )}
            >
              {/* Column Header: Slot Number & Model Selector */}
              <div className="p-3 border-b border-theme-border/60 bg-theme-surface-secondary/40 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-theme-border/60 text-theme-text text-[10px] font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Dropdown Selector */}
                  <div className="relative min-w-0">
                    <select
                      value={slot.modelId}
                      onChange={(e) => onUpdateSlotModel(idx, e.target.value)}
                      disabled={isGenerating}
                      className="text-xs font-black py-1 pl-2 pr-6 rounded-lg border border-theme-border/70 bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none max-w-[170px] sm:max-w-[210px] truncate"
                    >
                      {ARENA_AVAILABLE_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.costEstimate})
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none"
                    />
                  </div>
                </div>

                {/* Provider Badge */}
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0',
                    providerMeta.bg,
                    providerMeta.border,
                    providerMeta.text
                  )}
                >
                  {providerMeta.label}
                </span>
              </div>

              {/* Telemetry Bar: Latency & Cost */}
              <div className="px-3 py-1.5 bg-theme-bg-page/40 border-b border-theme-border/40 text-[10.5px] font-mono text-theme-text-muted flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock size={11} className="text-theme-text-muted" />
                    <span>{slot.latencyMs ? `${(slot.latencyMs / 1000).toFixed(2)}s` : '--'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Coins size={11} className="text-amber-500" />
                    <span>
                      {slot.costBaht !== undefined ? `~${slot.costBaht.toFixed(3)} ฿` : '--'}
                    </span>
                  </span>
                </div>
                {slot.tokenCount ? (
                  <span>{slot.tokenCount.toLocaleString()} tokens</span>
                ) : null}
              </div>

              {/* Message Content Body */}
              <div className="flex-1 p-3.5 overflow-y-auto text-xs leading-relaxed min-h-[180px]">
                {slot.status === 'streaming' && !slot.content ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-theme-text-muted">
                    <span className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <span className="text-[11px] animate-pulse">กำลังประมวลผลคำตอบ...</span>
                  </div>
                ) : slot.errorMessage ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                    ⚠️ {slot.errorMessage}
                  </div>
                ) : slot.content ? (
                  <MarkdownRenderer content={slot.content} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-theme-text-muted/60">
                    <Flame size={24} className="mb-2 text-theme-text-muted/40" />
                    <span className="text-xs font-bold text-theme-text-muted">สังเวียนพร้อมรับคำถาม</span>
                    <span className="text-[10.5px] mt-1 max-w-[200px]">
                      พิมพ์ Prompt ด้านล่าง หรือกดเลือกโจทย์ทดสอบประจำ 8 ฝ่ายงานเพื่อเริ่มประลอง
                    </span>
                  </div>
                )}
              </div>

              {/* Column Footer: Vote & Copy */}
              <div className="p-2.5 border-t border-theme-border/60 bg-theme-surface-secondary/30 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(idx, slot.content)}
                  disabled={!slot.content}
                  className="p-1.5 rounded-lg border border-theme-border/70 bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text text-xs transition-colors cursor-pointer disabled:opacity-40"
                  title="คัดลอกคำตอบ"
                >
                  {copiedSlotIndex === idx ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>

                <button
                  type="button"
                  onClick={() => onVoteWinner(idx)}
                  disabled={!slot.content || isGenerating}
                  className={cn(
                    'px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40',
                    slot.hasVoted
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  )}
                >
                  <Trophy size={12} className={slot.hasVoted ? 'text-white' : 'text-amber-500'} />
                  <span>{slot.hasVoted ? 'ผู้ชนะในรอบนี้!' : 'โหวตค่ายนี้ชนะ'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
