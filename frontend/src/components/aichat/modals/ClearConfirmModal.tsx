import React from 'react';
import { Trash2, Key, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ClearConfirmModalProps {
  isOpen: boolean;
  type: 'history' | 'key' | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({
  isOpen,
  type,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !type) return null;

  const isHistory = type === 'history';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-theme-border/80 bg-theme-surface/95 dark:bg-theme-bg-page/95 p-6 shadow-2xl relative text-theme-text animate-scale-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex gap-4 items-start">
          <div
            className={cn(
              'p-3.5 rounded-2xl shrink-0',
              isHistory ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'
            )}
          >
            {isHistory ? <Trash2 size={24} /> : <Key size={24} />}
          </div>

          <div className="space-y-2 pr-4">
            <h3 className="text-base font-extrabold text-theme-text leading-snug">
              {isHistory ? 'ยืนยันการล้างประวัติการแชททั้งหมด?' : 'ยืนยันการล้าง API Key?'}
            </h3>
            <p className="text-xs text-theme-text-secondary leading-relaxed">
              {isHistory
                ? 'การดำเนินการนี้จะลบประวัติการสนทนาทั้งหมดของคุณออกจากเบราว์เซอร์อย่างถาวร โดยยังคงรักษา API Key ไว้'
                : 'การดำเนินการนี้จะลบ OpenRouter API Key ออกจากเบราว์เซอร์เครื่องนี้'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text transition-all cursor-pointer select-none"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-xl text-white shadow-md transition-all cursor-pointer select-none',
              isHistory ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
            )}
          >
            {isHistory ? 'ล้างประวัติแชท' : 'ล้าง API Key'}
          </button>
        </div>
      </div>
    </div>
  );
};
