import React, { useState } from 'react';
import { X, Copy, Check, Download, Maximize2, Minimize2, FileText, Palette, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from '../messages/MarkdownRenderer';
import { cn } from '../../../lib/utils';

export interface ArtifactData {
  id: string;
  type: 'document' | 'image' | 'code' | 'worklog';
  title: string;
  content: string;
  timestamp: string;
}

interface ArtifactDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: ArtifactData | null;
}

export const ArtifactDrawer: React.FC<ArtifactDrawerProps> = ({ isOpen, onClose, artifact }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!artifact) return;
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!artifact) return;
    const isImg = artifact.type === 'image';
    const filename = isImg ? `artifact-image-${Date.now()}.png` : `artifact-doc-${Date.now()}.md`;

    const blob = new Blob([artifact.content], { type: isImg ? 'image/png' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = isImg ? artifact.content : url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (!isImg) URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        'h-full border-l border-theme-border/60 bg-theme-surface/95 dark:bg-theme-bg-page/95 backdrop-blur-xl flex flex-col shadow-2xl transition-all duration-300 z-30 shrink-0',
        isExpanded ? 'fixed inset-y-0 right-0 w-full sm:w-4/5 lg:w-3/4' : 'w-80 sm:w-96 lg:w-[450px]'
      )}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-theme-border/60 flex items-center justify-between bg-theme-surface-secondary/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
            {artifact?.type === 'image' ? <Palette size={15} /> : <FileText size={15} />}
          </div>
          <span className="font-extrabold text-xs text-theme-text truncate">
            {artifact?.title || 'Canvas & Artifacts'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {artifact && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                title="คัดลอกเนื้อหา"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                title="ดาวน์โหลดไฟล์"
              >
                <Download size={14} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            title={isExpanded ? 'ย่อขนาด' : 'ขยายเต็มหน้าจอ'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-rose-500 transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {!artifact ? (
          <div className="text-center py-16 text-xs text-theme-text-muted space-y-2">
            <Sparkles size={24} className="mx-auto opacity-40 text-indigo-500" />
            <p className="font-bold">ยังไม่มี Artifact ที่เปิดอยู่</p>
            <p className="text-[11px] leading-relaxed">
              เมื่อ AI สร้างรายงาน เอกสารยาว หรือรูปภาพ คุณสามารถกด "เปิดใน Canvas" เพื่อนำมาพรีวิวในหน้าต่างนี้ได้
            </p>
          </div>
        ) : artifact.type === 'image' ? (
          <div className="flex flex-col items-center justify-center p-2">
            <img
              src={artifact.content}
              alt={artifact.title}
              className="w-full h-auto max-h-[70vh] object-contain rounded-2xl border border-theme-border/60 shadow-lg"
            />
          </div>
        ) : (
          <div className="p-2">
            <MarkdownRenderer content={artifact.content} />
          </div>
        )}
      </div>
    </div>
  );
};
