import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { CHANGELOG, getLatestVersion } from '../../lib/changelog';

const SEEN_VERSION_KEY = 'worklog_last_seen_version';

export default function UpdateAnnouncementModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const latestVersion = getLatestVersion();
      const seenVersion = localStorage.getItem(SEEN_VERSION_KEY);
      if (seenVersion !== latestVersion) {
        setIsOpen(true);
      }
    } catch {
      // localStorage unavailable — skip the popup rather than show it every time
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(SEEN_VERSION_KEY, getLatestVersion());
    } catch {
      // ignore
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const latest = CHANGELOG[0];
  if (!latest) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={handleDismiss}>
      <div
        className="w-full max-w-sm theme-panel border border-theme-border/80 rounded-2xl shadow-2xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-4">
          <Sparkles size={26} />
        </div>

        <h2 className="text-lg font-bold text-theme-text">มีอัปเดตใหม่! 🎉</h2>
        <p className="text-[11px] text-theme-text-muted mt-0.5 mb-4">
          เวอร์ชัน {latest.version} · {latest.date}
        </p>

        <ul className="text-left space-y-2.5 mb-6">
          {latest.highlights.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-theme-text-secondary">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleDismiss}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-500/20 transition-all"
        >
          เข้าใจแล้ว
        </button>
      </div>
    </div>
  );
}
