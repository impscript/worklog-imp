import { Sparkles, CheckCircle2 } from 'lucide-react';
import { CHANGELOG } from '../../lib/changelog';

interface UpdateAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Show the full release history instead of just the latest version. */
  showHistory?: boolean;
}

export default function UpdateAnnouncementModal({ isOpen, onClose, showHistory }: UpdateAnnouncementModalProps) {
  if (!isOpen) return null;

  const entries = showHistory ? CHANGELOG : CHANGELOG.slice(0, 1);
  if (entries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm theme-panel border border-theme-border/80 rounded-2xl shadow-2xl p-6 text-center flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-4 shrink-0">
          <Sparkles size={26} />
        </div>

        <h2 className="text-lg font-bold text-theme-text shrink-0">
          {showHistory ? 'อัปเดตที่ผ่านมา' : 'มีอัปเดตใหม่! 🎉'}
        </h2>

        <div className="overflow-y-auto mt-3">
          {entries.map((entry, entryIndex) => (
            <div key={entry.version} className={entryIndex > 0 ? 'mt-5 pt-5 border-t border-theme-border/60' : ''}>
              <p className="text-[11px] text-theme-text-muted mb-2">
                เวอร์ชัน {entry.version} · {entry.date}
              </p>
              <ul className="text-left space-y-2.5">
                {entry.highlights.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-theme-text-secondary">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-500/20 transition-all shrink-0"
        >
          เข้าใจแล้ว
        </button>
      </div>
    </div>
  );
}
