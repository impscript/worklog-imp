import { useState } from 'react';
import { Sparkles, CheckCircle2, X, History, Tag, Calendar } from 'lucide-react';
import { CHANGELOG } from '../../lib/changelog';

interface UpdateAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Show the full release history instead of just the latest version. */
  showHistory?: boolean;
}

// Renders a highlight string, turning **bold** markers into emphasized text so
// the key point of each bullet stands out from the surrounding explanation.
function renderHighlight(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-theme-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function UpdateAnnouncementModal({ isOpen, onClose, showHistory }: UpdateAnnouncementModalProps) {
  const [userSelectedTab, setUserSelectedTab] = useState<'latest' | 'history' | null>(null);

  if (!isOpen) return null;

  const activeTab = userSelectedTab ?? (showHistory ? 'history' : 'latest');
  const latestEntry = CHANGELOG[0];
  const entries = activeTab === 'history' ? CHANGELOG : (latestEntry ? [latestEntry] : []);

  if (entries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        className="w-full max-w-2xl theme-panel border border-theme-border/80 rounded-2xl shadow-2xl p-6 text-left flex flex-col max-h-[88vh] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Top-Right */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 text-theme-text-muted hover:text-theme-text rounded-xl hover:bg-theme-surface-secondary transition-colors"
          title="ปิดหน้าต่าง"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-4 shrink-0 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            {activeTab === 'history' ? <History size={24} /> : <Sparkles size={24} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-theme-text">
                {activeTab === 'history' ? 'ประวัติการอัปเดตระบบ' : 'มีอัปเดตใหม่! 🎉'}
              </h2>
              {latestEntry && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                  v{latestEntry.version}
                </span>
              )}
            </div>
            <p className="text-xs text-theme-text-muted mt-0.5">
              {activeTab === 'history'
                ? `บันทึกรายการปรับปรุงและฟีเจอร์ใหม่ทั้งหมด (${CHANGELOG.length} เวอร์ชัน)`
                : `ระบบได้รับการพัฒนาฟีเจอร์ใหม่เพื่อความสะดวกในการทำงาน`}
            </p>
          </div>
        </div>

        {/* Tabs for switching between Latest and History */}
        <div className="flex items-center gap-2 p-1 bg-theme-surface-secondary/70 rounded-xl mb-3 shrink-0 border border-theme-border/60">
          <button
            type="button"
            onClick={() => setUserSelectedTab('latest')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'latest'
                ? 'bg-theme-panel text-theme-text shadow-sm font-semibold'
                : 'text-theme-text-muted hover:text-theme-text'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'latest' ? 'text-indigo-400' : ''} />
            <span>อัปเดตล่าสุด (v{latestEntry?.version})</span>
          </button>
          <button
            type="button"
            onClick={() => setUserSelectedTab('history')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-theme-panel text-theme-text shadow-sm font-semibold'
                : 'text-theme-text-muted hover:text-theme-text'
            }`}
          >
            <History size={14} className={activeTab === 'history' ? 'text-indigo-400' : ''} />
            <span>ประวัติทั้งหมด ({CHANGELOG.length})</span>
          </button>
        </div>

        {/* Changelog Entries List */}
        <div className="overflow-y-auto pr-1 space-y-3.5 my-1 flex-1 custom-scrollbar">
          {entries.map((entry) => {
            const isLatest = entry.version === latestEntry?.version;
            return (
              <div
                key={entry.version}
                className={`p-4 rounded-xl border transition-all ${
                  isLatest
                    ? 'bg-indigo-500/[0.04] border-indigo-500/25 shadow-sm'
                    : 'bg-theme-surface-secondary/40 border-theme-border/70 hover:border-theme-border'
                }`}
              >
                {/* Entry Header */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-theme-border/50">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      <Tag size={12} />
                      v{entry.version}
                    </span>
                    {isLatest && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        ล่าสุด
                      </span>
                    )}
                    {entry.title && (
                      <span className="text-xs font-semibold text-theme-text">
                        {entry.title}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-theme-text-muted shrink-0">
                    <Calendar size={12} />
                    {entry.date}
                  </span>
                </div>

                {/* Highlights */}
                <ul className="space-y-2">
                  {entry.highlights.map((item, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-xs text-theme-text-secondary leading-relaxed">
                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{renderHighlight(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-theme-border/60 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-theme-text-muted">
            {activeTab === 'latest' ? (
              <button
                type="button"
                onClick={() => setUserSelectedTab('history')}
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors inline-flex items-center gap-1"
              >
                <History size={12} />
                ดูประวัติเวอร์ชันก่อนหน้า
              </button>
            ) : (
              <span>รวม {CHANGELOG.length} เวอร์ชัน</span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-500/20 transition-all active:scale-95"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  );
}
