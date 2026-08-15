import React, { useState } from 'react';
import {
  Sparkles,
  User,
  Copy,
  Check,
  RefreshCw,
  Palette,
  Maximize2,
  FileText,
  Table2,
  Image as ImageIcon,
  Edit3,
} from 'lucide-react';
import type { Message } from '../../../hooks/useChatSessions';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ThinkingAccordion } from './ThinkingAccordion';
import { ImageResultCard, parseImageMarkdown } from './ImageResultCard';
import { cn } from '../../../lib/utils';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  onCopyText: (text: string) => void;
  onRegenerate?: () => void;
  onEditPrompt?: (content: string) => void;
  onGenerateImageFromText?: (text: string) => void;
  onOpenInCanvas?: (content: string, title?: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming = false,
  onCopyText,
  onRegenerate,
  onEditPrompt,
  onGenerateImageFromText,
  onOpenInCanvas,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    onCopyText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Separate think tags if inline in content
  let displayContent = message.content;
  let inlineReasoning = message.reasoningContent || '';

  if (displayContent.includes('<think>') && displayContent.includes('</think>')) {
    const startIdx = displayContent.indexOf('<think>') + 7;
    const endIdx = displayContent.indexOf('</think>');
    inlineReasoning = displayContent.substring(startIdx, endIdx).trim();
    displayContent = (displayContent.substring(0, startIdx - 7) + displayContent.substring(endIdx + 8)).trim();
  } else if (displayContent.includes('<think>') && !displayContent.includes('</think>')) {
    const startIdx = displayContent.indexOf('<think>') + 7;
    inlineReasoning = displayContent.substring(startIdx).trim();
    displayContent = displayContent.substring(0, startIdx - 7).trim();
  }

  const parsedImage = parseImageMarkdown(displayContent);
  const isLengthy = displayContent.length > 500 || displayContent.includes('```');

  return (
    <div
      className={cn(
        'group flex gap-3.5 sm:gap-4 py-4 px-3 sm:px-4 rounded-2xl transition-all select-text',
        isUser
          ? 'bg-theme-surface/50 dark:bg-theme-surface-secondary/25 border border-theme-border/50'
          : 'bg-transparent hover:bg-theme-surface/30'
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-0.5">
        <div
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs border',
            isUser
              ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white border-indigo-400/40'
              : 'bg-gradient-to-tr from-violet-500 to-indigo-500 text-white border-violet-400/40'
          )}
        >
          {isUser ? <User size={15} /> : <Sparkles size={15} />}
        </div>
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header (Role / Model / Time) */}
        <div className="flex items-center justify-between text-[11px] text-theme-text-muted">
          <div className="flex items-center gap-2">
            <span className="font-bold text-theme-text">
              {isUser ? 'คุณ (You)' : message.modelUsed ? message.modelUsed.split('/').pop() : 'AI Assistant'}
            </span>
            <span>·</span>
            <span className="font-mono text-[10px]">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Quick Actions (Copy / Edit) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
              title="คัดลอกข้อความ"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
            {isUser && onEditPrompt && (
              <button
                type="button"
                onClick={() => onEditPrompt(message.content)}
                className="p-1 rounded-lg hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                title="แก้ไขคำถามนี้"
              >
                <Edit3 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Attachment Chips for User */}
        {isUser && message.attachmentMeta && message.attachmentMeta.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5 pb-1">
            {message.attachmentMeta.map((att, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
              >
                {att.kind === 'image' ? (
                  <ImageIcon size={12} />
                ) : att.kind === 'spreadsheet' ? (
                  <Table2 size={12} />
                ) : (
                  <FileText size={12} />
                )}
                <span className="truncate max-w-[14rem]">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Thinking Accordion (For reasoning models) */}
        {!isUser && (inlineReasoning || isStreaming) && (
          <ThinkingAccordion
            reasoningText={inlineReasoning}
            durationSeconds={message.thinkingDurationSeconds}
            isStreaming={isStreaming && !displayContent}
          />
        )}

        {/* Image Render */}
        {parsedImage ? (
          <ImageResultCard
            altText={parsedImage.alt}
            imageUrl={parsedImage.url}
            modelUsed={message.modelUsed}
            onOpenInCanvas={onOpenInCanvas}
          />
        ) : (
          /* Text Markdown Render */
          <div className="text-sm leading-relaxed">
            {isUser ? (
              <p className="whitespace-pre-wrap text-theme-text font-medium">{displayContent}</p>
            ) : (
              <MarkdownRenderer
                content={displayContent || (isStreaming ? '...' : '')}
                onOpenInCanvas={onOpenInCanvas}
              />
            )}
          </div>
        )}

        {/* Assistant Bottom Action Bar */}
        {!isUser && !isStreaming && displayContent && !parsedImage && (
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-secondary hover:text-theme-text border border-theme-border/60 text-[11px] font-semibold transition-all cursor-pointer select-none"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  <span className="text-emerald-500">คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>คัดลอก</span>
                </>
              )}
            </button>

            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-secondary hover:text-theme-text border border-theme-border/60 text-[11px] font-semibold transition-all cursor-pointer select-none"
                title="ตอบใหม่อีกครั้ง"
              >
                <RefreshCw size={12} />
                <span>สร้างใหม่</span>
              </button>
            )}

            {isLengthy && onOpenInCanvas && (
              <button
                type="button"
                onClick={() => onOpenInCanvas(displayContent, 'AI Response Document')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-all cursor-pointer select-none"
              >
                <Maximize2 size={12} />
                <span>เปิดใน Canvas</span>
              </button>
            )}

            {onGenerateImageFromText && displayContent.length > 40 && (
              <button
                type="button"
                onClick={() => onGenerateImageFromText(displayContent)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 text-violet-700 dark:text-violet-300 border border-violet-500/30 text-[11px] font-semibold transition-all cursor-pointer select-none"
              >
                <Palette size={12} />
                <span>สร้างภาพ/Infographic จากข้อความนี้</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
