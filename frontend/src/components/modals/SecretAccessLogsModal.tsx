import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Clock, CheckCircle2, XCircle, RefreshCw, User, Lock, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SecretAccessLog {
  id: string;
  project_id: string;
  user_id: string;
  authorized_by_superadmin_id?: string;
  action_type: string;
  secret_key?: string;
  environment?: string;
  status: string;
  created_at: string;
  project?: {
    project_name: string;
  };
  requester?: {
    full_name: string;
    email: string;
  };
  approver?: {
    full_name: string;
  };
}

interface SecretAccessLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SecretAccessLogsModal({ isOpen, onClose }: SecretAccessLogsModalProps) {
  const [logs, setLogs] = useState<SecretAccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_secret_access_logs')
        .select(`
          *,
          project:project_id(project_name),
          requester:user_id(full_name, email),
          approver:authorized_by_superadmin_id(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching secret access logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'OPEN_VAULT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">Open Vault</span>;
      case 'REVEAL_SECRET':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">Reveal Secret</span>;
      case 'COPY_SECRET':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">Copy Secret</span>;
      case 'COPY_ENV_BLOCK':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">Copy .env Block</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-500/15 text-gray-700 dark:text-gray-400 border border-gray-500/30">{action}</span>;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-theme-surface border border-theme-border rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl relative my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border/80 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
              <Shield size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-theme-text flex items-center gap-2">
                <span>Secret Access Audit Logs</span>
              </h3>
              <p className="text-xs text-theme-text-secondary">
                ประวัติการปลดล็อกและคัดลอก Secrets โดยระบุตัวตนผู้ขอและ SuperAdmin เจ้าของ PIN
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="p-2 bg-theme-surface-secondary hover:bg-theme-surface-tertiary border border-theme-border text-theme-text-secondary rounded-xl transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-theme-surface-secondary hover:bg-theme-surface-tertiary border border-theme-border text-theme-text-secondary rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-theme-text-secondary flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin text-indigo-400" />
              <span>กำลังโหลดประวัติ Audit Logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-theme-text-secondary border border-dashed border-theme-border rounded-2xl">
              <Lock size={32} className="mx-auto mb-2 text-theme-text-secondary/50" />
              <p className="text-sm">ยังไม่มีประวัติการปลดล็อก Secrets ในระบบ</p>
            </div>
          ) : (
            <div className="border border-theme-border rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-theme-surface-secondary/50 text-[11px] font-extrabold uppercase text-theme-text-secondary border-b border-theme-border">
                    <th className="py-3 px-4">เวลา (Date/Time)</th>
                    <th className="py-3 px-4">ผู้ขอเข้าถึง (User)</th>
                    <th className="py-3 px-4">กิจกรรม (Action)</th>
                    <th className="py-3 px-4">โปรเจกต์ (Project)</th>
                    <th className="py-3 px-4">อนุมัติโดย (SuperAdmin PIN)</th>
                    <th className="py-3 px-4 text-center">สถานะ (Status)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border text-xs text-theme-text">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-theme-surface-secondary/30 transition-colors">
                      <td className="py-3 px-4 text-theme-text-secondary font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-theme-text-secondary shrink-0" />
                          <span>{new Date(log.created_at).toLocaleString('th-TH')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-indigo-400 shrink-0" />
                          <span>{log.requester?.full_name || 'Unregistered User'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getActionBadge(log.action_type)}
                        {log.secret_key && (
                          <span className="block text-[10px] font-mono text-amber-400 mt-1">
                            Key: {log.secret_key}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {log.project?.project_name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {log.approver?.full_name ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <Key size={12} />
                            <span>{log.approver.full_name}</span>
                          </span>
                        ) : (
                          <span className="text-theme-text-secondary italic">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <CheckCircle2 size={14} />
                            <span>Success</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            <XCircle size={14} />
                            <span>Failed PIN</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-theme-border/80 mt-4">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-theme-surface-secondary border border-theme-border hover:bg-theme-surface-tertiary text-theme-text font-semibold rounded-xl text-sm transition-all"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
