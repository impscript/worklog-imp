import React from 'react';
import { X, FileText, Table2 } from 'lucide-react';
import type { ChatAttachment } from '../../../lib/chat-files';

interface AttachmentTrayProps {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
}

export const AttachmentTray: React.FC<AttachmentTrayProps> = ({ attachments, onRemove }) => {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-theme-surface/70 border border-theme-border/60 rounded-2xl mb-2 animate-fade-in shadow-xs">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-surface text-xs font-semibold text-theme-text shadow-xs"
        >
          {att.kind === 'image' && att.dataUrl ? (
            <img src={att.dataUrl} alt="" className="w-5 h-5 rounded-md object-cover shrink-0" />
          ) : att.kind === 'pdf' ? (
            <FileText size={14} className="text-rose-500 shrink-0" />
          ) : att.kind === 'spreadsheet' ? (
            <Table2 size={14} className="text-emerald-500 shrink-0" />
          ) : (
            <FileText size={14} className="text-indigo-500 shrink-0" />
          )}

          <span className="truncate max-w-[10rem] text-[11px]">{att.name}</span>

          <button
            type="button"
            onClick={() => onRemove(att.id)}
            className="p-0.5 rounded-md hover:bg-theme-surface-secondary text-theme-text-muted hover:text-rose-500 transition-colors cursor-pointer"
            title="ลบไฟล์นี้"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
};
