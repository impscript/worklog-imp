import React from 'react';
import { Download, Maximize2, Palette } from 'lucide-react';

interface ImageResultCardProps {
  altText: string;
  imageUrl: string;
  modelUsed?: string;
  onOpenInCanvas?: (imageUrl: string, title?: string) => void;
}

/* eslint-disable react-refresh/only-export-components */
export function parseImageMarkdown(text: string): { alt: string; url: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('![')) return null;
  const closeAlt = trimmed.indexOf('](');
  if (closeAlt < 2) return null;
  const alt = trimmed.slice(2, closeAlt);
  if (/[\r\n]/.test(alt)) return null;

  const i = closeAlt + 2;
  let url: string;
  if (trimmed.startsWith('data:', i)) {
    const lastParen = trimmed.lastIndexOf(')');
    if (lastParen <= i) return null;
    url = trimmed.slice(i, lastParen);
  } else {
    const closeUrl = trimmed.indexOf(')', i);
    if (closeUrl < 0) return null;
    url = trimmed.slice(i, closeUrl);
  }

  if (!url || (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:'))) {
    return null;
  }
  return { alt: alt || 'Generated image', url };
}

export const ImageResultCard: React.FC<ImageResultCardProps> = ({
  altText,
  imageUrl,
  modelUsed,
  onOpenInCanvas,
}) => {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `worklog-ai-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cleanModelName = modelUsed ? modelUsed.split('/').pop() : 'AI Image';

  return (
    <div className="my-3 max-w-md rounded-2xl border border-theme-border/70 overflow-hidden bg-slate-900/5 dark:bg-slate-950/40 shadow-md transition-all group">
      <div className="relative overflow-hidden bg-slate-950 flex items-center justify-center min-h-[160px]">
        <img
          src={imageUrl}
          alt={altText}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            const sib = (e.target as HTMLImageElement).nextElementSibling;
            if (sib) (sib as HTMLElement).hidden = false;
          }}
          className="w-full h-auto max-h-[480px] object-contain transition-transform duration-300 group-hover:scale-[1.01]"
        />
        <div hidden className="p-4 text-xs text-rose-500 font-semibold text-center">
          ⚠️ โหลดรูปไม่สำเร็จ (URL หมดอายุหรือเสีย)
        </div>

        {/* Hover Quick Actions Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-xs">
          {onOpenInCanvas && (
            <button
              type="button"
              onClick={() => onOpenInCanvas(imageUrl, altText || 'Generated Image')}
              className="p-2.5 rounded-xl bg-white/90 text-slate-900 font-bold text-xs shadow-lg hover:bg-white hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer"
              title="ขยายเต็มหน้าจอ / เปิดใน Canvas"
            >
              <Maximize2 size={14} />
              <span>เปิดดูขนาดใหญ่</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-lg hover:bg-indigo-500 hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer"
            title="ดาวน์โหลดรูปภาพ"
          >
            <Download size={14} />
            <span>ดาวน์โหลด</span>
          </button>
        </div>
      </div>

      {/* Card Info Footer */}
      <div className="p-3 border-t border-theme-border/60 bg-theme-surface/70 flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
            <Palette size={13} />
            <span className="text-[11px] uppercase tracking-wide">{cleanModelName}</span>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold text-[10px] transition-colors cursor-pointer"
          >
            <Download size={11} />
            <span>บันทึกรูป</span>
          </button>
        </div>

        {altText && altText !== 'Generated image' && (
          <div className="text-[10px] text-theme-text-secondary border-t border-theme-border/40 pt-1.5 line-clamp-2 leading-relaxed">
            <span className="font-bold text-theme-text">Prompt: </span>
            {altText}
          </div>
        )}
      </div>
    </div>
  );
};
