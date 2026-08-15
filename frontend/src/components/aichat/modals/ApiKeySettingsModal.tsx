import React, { useState } from 'react';
import { X, Key, Eye, EyeOff, ShieldCheck, ExternalLink, Trash2 } from 'lucide-react';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onClearApiKey: () => void;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  onClearApiKey,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(inputKey.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-theme-border/80 bg-theme-surface/95 dark:bg-theme-bg-page/95 shadow-2xl overflow-hidden text-theme-text animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-theme-border/60 bg-theme-surface-secondary/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Key size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-theme-text">ตั้งค่า OpenRouter API Key</h3>
              <p className="text-[11px] text-theme-text-muted">ความปลอดภัย & การเข้าถึงโมเดล AI</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block font-bold text-theme-text text-[11px] uppercase tracking-wider">
              OpenRouter API Key (sk-or-v1-...)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxx"
                className="w-full text-xs font-mono py-2.5 pl-3.5 pr-10 rounded-xl border border-theme-border bg-theme-surface text-theme-text focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-2.5 text-theme-text-muted hover:text-theme-text"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-theme-text-muted">
              ขอรับ API Key ได้ฟรีจาก{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-0.5"
              >
                OpenRouter Keys <ExternalLink size={10} />
              </a>
            </p>
          </div>

          {/* Privacy Note */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>ความปลอดภัยสูงสุด (Client-Only):</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
              API Key ของคุณถูกจัดเก็บไว้ใน LocalStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น ระบบไม่มีการส่งคีย์ไปเก็บยังฐานข้อมูลกลางของบริษัท
            </p>
          </div>

          {apiKey && (
            <button
              type="button"
              onClick={() => {
                onClearApiKey();
                setInputKey('');
                onClose();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-bold text-xs transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>ลบ API Key ออกจากเครื่องนี้</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-theme-border/60 bg-theme-surface-secondary/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text font-bold text-xs transition-all cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            บันทึก API Key
          </button>
        </div>
      </div>
    </div>
  );
};
