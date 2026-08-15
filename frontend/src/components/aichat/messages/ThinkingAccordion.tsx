import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ThinkingAccordionProps {
  reasoningText: string;
  durationSeconds?: number;
  isStreaming?: boolean;
}

export const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({
  reasoningText,
  durationSeconds,
  isStreaming = false,
}) => {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);

  // Expanded by default when streaming unless user explicitly toggled
  const isOpen = userToggled !== null ? userToggled : isStreaming;

  if (!reasoningText && !isStreaming) return null;

  return (
    <div className="my-2.5 rounded-2xl border border-violet-500/20 bg-violet-50/40 dark:bg-violet-950/20 overflow-hidden transition-all shadow-xs">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setUserToggled(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-left bg-violet-500/5 hover:bg-violet-500/10 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0">
            <Brain size={13} className={cn(isStreaming && 'animate-pulse text-violet-500')} />
          </div>
          <span className="text-xs font-bold text-violet-800 dark:text-violet-200 truncate">
            {isStreaming ? 'กำลังคิดวิเคราะห์...' : 'กระบวนการคิดวิเคราะห์ (Reasoning Process)'}
          </span>
          {durationSeconds !== undefined && durationSeconds > 0 && (
            <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 shrink-0">
              ⏱️ {durationSeconds}s
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 shrink-0">
          <span className="text-[10px] font-semibold">{isOpen ? 'ซ่อน' : 'ดูรายละเอียด'}</span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {/* Accordion Body */}
      {isOpen && (
        <div className="p-4 border-t border-violet-500/15 bg-theme-surface/50 dark:bg-theme-bg-page/40 text-xs text-theme-text-secondary leading-relaxed font-mono animate-fade-in custom-scrollbar max-h-96 overflow-y-auto">
          {reasoningText ? (
            <MarkdownRenderer content={reasoningText} />
          ) : (
            <div className="flex items-center gap-2 text-violet-500 animate-pulse text-xs font-semibold">
              <Sparkles size={13} />
              <span>โมเดลกำลังประมวลผลความคิดทีละขั้นตอน...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
