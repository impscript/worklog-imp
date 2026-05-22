import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'primary';
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

interface NotificationContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    options: null,
    resolve: null
  });

  const showToast = useCallback((message: string, type: ToastType = 'success', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve
      });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState({ isOpen: false, options: null, resolve: null });
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />,
            error: <XCircle size={18} className="text-rose-400 shrink-0" />,
            warning: <AlertTriangle size={18} className="text-amber-400 shrink-0" />,
            info: <Info size={18} className="text-indigo-400 shrink-0" />
          };

          const borders = {
            success: "border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-200",
            error: "border-rose-500/20 bg-rose-50 dark:bg-rose-500/5 text-rose-700 dark:text-rose-200",
            warning: "border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 text-amber-700 dark:text-amber-200",
            info: "border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/5 text-indigo-700 dark:text-indigo-200"
          };

          return (
            <div
              key={toast.id}
              className={cn(
                "p-4 rounded-xl border backdrop-blur-xl flex items-start gap-3 shadow-lg pointer-events-auto transition-all duration-300 animate-in slide-in-from-right-10 fade-in",
                borders[toast.type]
              )}
            >
              {icons[toast.type]}
              <div className="flex-1 text-xs font-semibold leading-relaxed">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Asynchronous Confirm Modal Overlay */}
      {confirmState.isOpen && confirmState.options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-theme-surface-modal border border-theme-border/80 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-theme-text">
            <h3 className="text-lg font-bold text-theme-text tracking-tight flex items-center gap-2 mb-2">
              {confirmState.options.type === 'danger' ? (
                <AlertTriangle size={20} className="text-rose-500" />
              ) : (
                <Info size={20} className="text-indigo-400" />
              )}
              <span>{confirmState.options.title}</span>
            </h3>
            
            <p className="text-sm text-theme-text-secondary leading-relaxed mb-6">
              {confirmState.options.message}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2 bg-theme-surface-tertiary hover:bg-theme-surface-tertiary/80 border border-theme-border text-theme-text-secondary text-xs font-semibold rounded-xl transition-all"
              >
                {confirmState.options.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => handleConfirmClose(true)}
                className={cn(
                  "px-4 py-2 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-95",
                  confirmState.options.type === 'danger'
                    ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/10"
                    : "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/10"
                )}
              >
                {confirmState.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
