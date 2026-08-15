import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ConfirmDialogVariant = 'warning' | 'danger' | 'info' | 'success';

export interface ConfirmDialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  isLoading?: boolean;
}

export const ConfirmDialogModal: React.FC<ConfirmDialogModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  variant = 'warning',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle size={24} className="text-rose-500" />,
          iconBg: 'bg-rose-500/15 border-rose-500/30',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
        };
      case 'info':
        return {
          icon: <Info size={24} className="text-indigo-500" />,
          iconBg: 'bg-indigo-500/15 border-indigo-500/30',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20',
        };
      case 'success':
        return {
          icon: <CheckCircle2 size={24} className="text-emerald-500" />,
          iconBg: 'bg-emerald-500/15 border-emerald-500/30',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
        };
      case 'warning':
      default:
        return {
          icon: <AlertCircle size={24} className="text-amber-500" />,
          iconBg: 'bg-amber-500/15 border-amber-500/30',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md rounded-3xl border border-theme-border/80 bg-theme-surface/95 dark:bg-theme-bg-page/95 shadow-2xl overflow-hidden text-theme-text animate-scale-in">
        {/* Header */}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className={cn('p-3 rounded-2xl border flex items-center justify-center shrink-0', styles.iconBg)}>
              {styles.icon}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-theme-surface-secondary text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-black text-base sm:text-lg text-theme-text tracking-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-theme-text-secondary leading-relaxed">
              {message}
            </p>
            {description && (
              <p className="text-xs text-theme-text-muted leading-relaxed pt-1">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-theme-surface-secondary/40 border-t border-theme-border/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-secondary text-theme-text font-bold text-xs transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              'px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer',
              styles.confirmBtn
            )}
          >
            {isLoading ? 'กำลังดำเนินการ...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
