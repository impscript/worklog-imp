import React, { useRef, useEffect } from 'react';
import { ArrowUp, Square, Paperclip, RefreshCw, Sliders } from 'lucide-react';
import type { ChatAttachment } from '../../../lib/chat-files';
import { AttachmentTray } from './AttachmentTray';
import { QuickToolChips } from './QuickToolChips';
import { cn } from '../../../lib/utils';

interface PromptInputBarProps {
  input: string;
  setInput: (val: string) => void;
  isGenerating: boolean;
  onSendMessage: () => void;
  onAbortGeneration: () => void;
  // Attachments
  attachments: ChatAttachment[];
  onPickFiles: (files: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  isProcessingFiles: boolean;
  // Tools
  webSearch: boolean;
  onToggleWebSearch: () => void;
  isDrawMode: boolean;
  onToggleDrawMode: () => void;
  onOpenImageStudio: () => void;
  hasWorklogContext: boolean;
  onFetchWorklogContext: () => void;
  onClearWorklogContext?: () => void;
  activeSkillId: string;
  onSelectSkill: (skillId: string) => void;
  placeholder?: string;
}

export const PromptInputBar: React.FC<PromptInputBarProps> = ({
  input,
  setInput,
  isGenerating,
  onSendMessage,
  onAbortGeneration,
  attachments,
  onPickFiles,
  onRemoveAttachment,
  isProcessingFiles,
  webSearch,
  onToggleWebSearch,
  isDrawMode,
  onToggleDrawMode,
  onOpenImageStudio,
  hasWorklogContext,
  onFetchWorklogContext,
  onClearWorklogContext,
  activeSkillId,
  onSelectSkill,
  placeholder,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && (input.trim() || attachments.length > 0)) {
        onSendMessage();
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pb-3">
      {/* Quick Tool Chips */}
      <QuickToolChips
        webSearch={webSearch}
        onToggleWebSearch={onToggleWebSearch}
        isDrawMode={isDrawMode}
        onToggleDrawMode={onToggleDrawMode}
        hasWorklogContext={hasWorklogContext}
        onFetchWorklogContext={onFetchWorklogContext}
        onClearWorklogContext={onClearWorklogContext}
        activeSkillId={activeSkillId}
        onSelectSkill={onSelectSkill}
      />

      {/* Attachment Tray */}
      <AttachmentTray attachments={attachments} onRemove={onRemoveAttachment} />

      {/* Main Input Container */}
      <div className="relative rounded-3xl border border-theme-border-strong bg-theme-surface/90 dark:bg-theme-surface-secondary/80 backdrop-blur-xl shadow-lg focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all p-2 flex flex-col gap-1.5">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.xlsx,.xls,.csv,text/plain,.txt,.md"
          onChange={(e) => onPickFiles(e.target.files)}
        />

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={
            placeholder ||
            (isDrawMode
              ? 'พิมพ์คำอธิบายภาพที่ต้องการสร้าง (เช่น ภาพสรุป KPI ไตรมาส 1 เป็นภาษาไทย)...'
              : 'ถามอะไรก็ได้กับ AI... (Shift+Enter เพื่อขึ้นบรรทัดใหม่)')
          }
          className="w-full resize-none bg-transparent px-3 py-2 text-sm text-theme-text placeholder:text-theme-text-muted focus:outline-none custom-scrollbar leading-relaxed"
          style={{ minHeight: '44px', maxHeight: '200px' }}
        />

        {/* Bottom Bar: Action Buttons */}
        <div className="flex items-center justify-between px-2 pt-1 border-t border-theme-border/40">
          <div className="flex items-center gap-1.5">
            {/* File Upload Button */}
            <button
              type="button"
              disabled={isGenerating || isProcessingFiles}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'p-2 rounded-xl border border-theme-border/70 bg-theme-surface hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-all cursor-pointer select-none',
                isProcessingFiles && 'animate-spin text-indigo-500'
              )}
              title="แนบรูปภาพ / PDF / Excel / CSV / เอกสาร"
            >
              {isProcessingFiles ? <RefreshCw size={15} /> : <Paperclip size={15} />}
            </button>

            {/* If Draw Mode: Image Studio Options button */}
            {isDrawMode && (
              <button
                type="button"
                onClick={onOpenImageStudio}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 text-xs font-bold transition-all cursor-pointer select-none"
              >
                <Sliders size={13} />
                <span>ตั้งค่าสัดส่วน & สไตล์</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Send / Stop Button */}
            {isGenerating ? (
              <button
                type="button"
                onClick={onAbortGeneration}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all cursor-pointer flex items-center justify-center"
                title="หยุดการพิมพ์คำตอบ"
              >
                <Square size={16} className="fill-white" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!input.trim() && attachments.length === 0}
                onClick={onSendMessage}
                className={cn(
                  'p-2 rounded-xl transition-all flex items-center justify-center shadow-md cursor-pointer',
                  input.trim() || attachments.length > 0
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/20 active:scale-95'
                    : 'bg-theme-surface-secondary text-theme-text-muted border border-theme-border/60 cursor-not-allowed opacity-50'
                )}
                title="ส่งข้อความ (Enter)"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
