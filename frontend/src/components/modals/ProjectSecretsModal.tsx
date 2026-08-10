import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Key, Eye, EyeOff, Copy, Trash2, Check, 
  RefreshCw, Lock, FileCode, Edit2, ShieldAlert
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import { verifySuperAdminPin, logSecretAccess } from '../../lib/security-pin';

export interface ProjectSecret {
  id: string;
  project_id: string;
  workspace_id: string;
  environment: 'production' | 'staging' | 'development' | 'general';
  secret_key: string;
  secret_value: string;
  note?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  users?: {
    full_name: string;
  };
}

interface ProjectSecretsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    project_name: string;
    workspace_id: string;
  };
  sessionUser?: any;
}

const ENV_CONFIG = [
  { id: 'all', label: 'ทั้งหมด (All Envs)' },
  { id: 'production', label: '🟢 Production', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'staging', label: '🟡 Staging', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'development', label: '🔵 Development', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'general', label: '⚙️ General', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
];

export default function ProjectSecretsModal({
  isOpen,
  onClose,
  project,
  sessionUser
}: ProjectSecretsModalProps) {
  const [secrets, setSecrets] = useState<ProjectSecret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeEnv, setActiveEnv] = useState<string>('all');
  const [visibleSecretIds, setVisibleSecretIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // SuperAdmin PIN Verification States
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [authorizedBySuperadminId, setAuthorizedBySuperadminId] = useState<string | undefined>(undefined);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Confirm Delete State
  const [deletingSecretTarget, setDeletingSecretTarget] = useState<{ id: string; keyName: string } | null>(null);
  const [isDeletingSecret, setIsDeletingSecret] = useState(false);

  // Form states
  const [editingSecretId, setEditingSecretId] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'development' | 'general'>('production');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { showToast } = useNotification();

  const fetchSecrets = async () => {
    if (!project?.id) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tb_project_secrets')
        .select(`
          *,
          users:created_by(full_name)
        `)
        .eq('project_id', project.id)
        .order('environment', { ascending: true })
        .order('secret_key', { ascending: true });

      if (error) throw error;
      setSecrets(data || []);
    } catch (err: any) {
      console.error('Error fetching project secrets:', err);
      showToast('ไม่สามารถดึงข้อมูล Secrets ได้: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && project?.id) {
      fetchSecrets();
    } else {
      setIsPinVerified(false);
      setAuthorizedBySuperadminId(undefined);
      setPinInput('');
      setPinError(null);
    }
  }, [isOpen, project?.id]);

  if (!isOpen) return null;

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!pinInput || pinInput.length !== 6) {
      setPinError('กรุณากรอก PIN 6 หลัก');
      return;
    }

    setIsVerifyingPin(true);
    try {
      const res = await verifySuperAdminPin(pinInput);
      if (res.valid) {
        setIsPinVerified(true);
        setAuthorizedBySuperadminId(res.superadminId);
        showToast(`ปลดล็อก Secrets Vault สำเร็จ (อนุมัติโดย SuperAdmin: ${res.superadminName})`, 'success');
        
        await logSecretAccess({
          projectId: project.id,
          workspaceId: project.workspace_id,
          userId: sessionUser?.id || '',
          authorizedBySuperadminId: res.superadminId,
          actionType: 'OPEN_VAULT',
          status: 'SUCCESS'
        });
      } else {
        setPinError(res.error || 'Security PIN ไม่ถูกต้อง');
        await logSecretAccess({
          projectId: project.id,
          workspaceId: project.workspace_id,
          userId: sessionUser?.id || '',
          actionType: 'OPEN_VAULT',
          status: 'FAILED_PIN'
        });
      }
    } catch (err: any) {
      setPinError('เกิดข้อผิดพลาดในการตรวจสอบ PIN');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const toggleVisibility = (id: string, sec?: ProjectSecret) => {
    setVisibleSecretIds(prev => {
      const next = new Set(prev);
      const isNowVisible = !next.has(id);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      if (isNowVisible && sec) {
        logSecretAccess({
          projectId: project.id,
          workspaceId: project.workspace_id,
          userId: sessionUser?.id || '',
          authorizedBySuperadminId,
          actionType: 'REVEAL_SECRET',
          secretKey: sec.secret_key,
          environment: sec.environment,
          status: 'SUCCESS'
        });
      }

      return next;
    });
  };

  const handleCopy = (text: string, id: string, label: string, sec?: ProjectSecret) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`คัดลอก ${label} แล้ว!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);

    if (sec) {
      logSecretAccess({
        projectId: project.id,
        workspaceId: project.workspace_id,
        userId: sessionUser?.id || '',
        authorizedBySuperadminId,
        actionType: 'COPY_SECRET',
        secretKey: sec.secret_key,
        environment: sec.environment,
        status: 'SUCCESS'
      });
    }
  };

  const handleCopyEnvBlock = () => {
    const targetSecrets = activeEnv === 'all'
      ? secrets
      : secrets.filter(s => s.environment === activeEnv);

    if (targetSecrets.length === 0) {
      showToast('ไม่มีรายการ Secret สำหรับคัดลอก', 'warning');
      return;
    }

    const envLines = targetSecrets.map(s => `# ${s.note ? `${s.secret_key}: ${s.note}` : s.secret_key}\n${s.secret_key}=${s.secret_value}`).join('\n\n');
    navigator.clipboard.writeText(envLines);
    showToast(`คัดลอกบล็อก .env (${targetSecrets.length} รายการ) ลงคลิปบอร์ดแล้ว!`, 'success');

    logSecretAccess({
      projectId: project.id,
      workspaceId: project.workspace_id,
      userId: sessionUser?.id || '',
      authorizedBySuperadminId,
      actionType: 'COPY_ENV_BLOCK',
      environment: activeEnv,
      status: 'SUCCESS'
    });
  };

  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = secretKey.trim().toUpperCase().replace(/\s+/g, '_');
    if (!cleanKey) {
      showToast('กรุณาระบุ Secret Key (เช่น DATABASE_URL)', 'warning');
      return;
    }
    if (!secretValue.trim()) {
      showToast('กรุณาระบุ Secret Value', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      if (editingSecretId) {
        // Update
        const { error } = await supabase
          .from('tb_project_secrets')
          .update({
            environment,
            secret_key: cleanKey,
            secret_value: secretValue.trim(),
            note: note.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingSecretId);

        if (error) throw error;
        showToast(`อัปเดต Secret "${cleanKey}" สำเร็จ!`, 'success');
      } else {
        // Create
        const { error } = await supabase
          .from('tb_project_secrets')
          .insert({
            project_id: project.id,
            workspace_id: project.workspace_id,
            environment,
            secret_key: cleanKey,
            secret_value: secretValue.trim(),
            note: note.trim() || null,
            created_by: sessionUser?.id || null
          });

        if (error) throw error;
        showToast(`เพิ่ม Secret "${cleanKey}" สำเร็จ!`, 'success');
      }

      // Reset form
      setEditingSecretId(null);
      setSecretKey('');
      setSecretValue('');
      setNote('');
      fetchSecrets();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการบันทึก Secret: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (sec: ProjectSecret) => {
    setEditingSecretId(sec.id);
    setSecretKey(sec.secret_key);
    setSecretValue(sec.secret_value);
    setEnvironment(sec.environment);
    setNote(sec.note || '');
  };

  const handleCancelEdit = () => {
    setEditingSecretId(null);
    setSecretKey('');
    setSecretValue('');
    setNote('');
  };

  const handleStartDeleteSecret = (id: string, keyName: string) => {
    setDeletingSecretTarget({ id, keyName });
  };

  const handleConfirmDeleteSecret = async () => {
    if (!deletingSecretTarget) return;
    setIsDeletingSecret(true);
    try {
      const { error } = await supabase
        .from('tb_project_secrets')
        .delete()
        .eq('id', deletingSecretTarget.id);

      if (error) throw error;
      showToast(`ลบ Secret "${deletingSecretTarget.keyName}" สำเร็จ`, 'success');
      setSecrets(prev => prev.filter(s => s.id !== deletingSecretTarget.id));
      setDeletingSecretTarget(null);
    } catch (err: any) {
      showToast('ไม่สามารถลบ Secret ได้: ' + err.message, 'error');
    } finally {
      setIsDeletingSecret(false);
    }
  };

  const filteredSecrets = activeEnv === 'all'
    ? secrets
    : secrets.filter(s => s.environment === activeEnv);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-theme-surface dark:bg-theme-surface-modal border border-theme-border/80 rounded-3xl w-full max-w-4xl my-auto max-h-[90vh] shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* PIN Verification Overlay Modal */}
        {!isPinVerified && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-theme-surface border border-theme-border rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
                <Lock size={24} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-theme-text">SuperAdmin Verification</h4>
                <p className="text-xs text-theme-text-secondary mt-1">
                  กรุณากรอก 6-Digit Security PIN ของ SuperAdmin เพื่อเปิดใช้งานคลัง Secrets
                </p>
              </div>

              {pinError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <ShieldAlert size={14} />
                  <span>{pinError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyPin} className="space-y-4">
                <input
                  type="password"
                  maxLength={6}
                  pattern="\d{6}"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full bg-theme-surface-secondary border border-theme-border focus:border-amber-500 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-theme-text focus:outline-none transition-colors"
                  autoFocus
                  required
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-theme-surface-secondary border border-theme-border hover:bg-theme-surface-tertiary text-theme-text-secondary rounded-xl text-xs font-semibold transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingPin || pinInput.length !== 6}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/25"
                  >
                    {isVerifyingPin ? 'กำลังตรวจ...' : 'ยืนยัน PIN'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-theme-border/60 flex items-center justify-between bg-theme-surface-tertiary/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase flex items-center gap-1">
                <Lock size={12} /> In-App Secrets Vault
              </span>
              <h2 className="text-lg font-extrabold text-theme-text truncate max-w-md">
                {project.project_name}
              </h2>
            </div>
            <p className="text-xs text-theme-text-muted mt-0.5">
              คลังจัดเก็บข้อมูลความลับ รหัสผ่าน และไฟล์กำหนดค่า (.env) ภายในองค์กร
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyEnvBlock}
              className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="คัดลอก Key-Value ทั้งหมดในรูปแบบไฟล์ .env"
            >
              <FileCode size={14} />
              <span>Copy .env Block</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-secondary border border-transparent hover:border-theme-border transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Warning banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3 text-amber-400 text-xs">
            <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-bold">นโยบายความปลอดภัย In-House Secrets Vault</p>
              <p className="text-[11px] text-amber-400/80 mt-0.5">
                ข้อมูล Secret ทั้งหมดถูกเข้ารหัสและควบคุมสิทธิ์ผ่าน RLS ภายใน Workspace สมาชิกทั่วไปจะมองไม่เห็นค่าวาลิว โปรดใช้งานด้วยความระมัดระวัง
              </p>
            </div>
          </div>

          {/* Form Create / Edit */}
          <div className="bg-theme-surface-tertiary/60 dark:bg-theme-surface-tertiary/30 border border-amber-500/20 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Key size={15} />
              <span>{editingSecretId ? 'แก้ไข Secret' : 'เพิ่ม Secret ใหม่ประจำโปรเจกต์'}</span>
            </h3>

            <form onSubmit={handleSaveSecret} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Secret Key */}
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary mb-1">Secret Key *</label>
                  <input
                    type="text"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
                    placeholder="เช่น DATABASE_URL"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:normal-case placeholder:font-sans"
                    required
                  />
                </div>

                {/* Secret Value */}
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary mb-1">Secret Value *</label>
                  <input
                    type="password"
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    placeholder="กรอกรหัสผ่าน / Key Value"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-xs font-mono text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                {/* Environment */}
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-secondary mb-1">Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as any)}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-xs font-semibold text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="production">🟢 Production</option>
                    <option value="staging">🟡 Staging</option>
                    <option value="development">🔵 Development</option>
                    <option value="general">⚙️ General</option>
                  </select>
                </div>
              </div>

              {/* Note & Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="คำอธิบายสั้นๆ (Optional) เช่น รหัสผ่านสำหรับต่อ Supabase Production DB"
                  className="flex-1 bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:ring-1 focus:ring-amber-500"
                />

                <div className="flex items-center gap-2 shrink-0">
                  {editingSecretId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-theme-surface border border-theme-border rounded-xl text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-tertiary transition-all"
                    >
                      ยกเลิก
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Check size={14} strokeWidth={3} />
                        <span>{editingSecretId ? 'บันทึกการแก้ไข' : 'เพิ่ม Secret'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Environment Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-theme-border/40 pb-3">
            {ENV_CONFIG.map(env => {
              const count = env.id === 'all'
                ? secrets.length
                : secrets.filter(s => s.environment === env.id).length;
              return (
                <button
                  key={env.id}
                  onClick={() => setActiveEnv(env.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                    activeEnv === env.id
                      ? "bg-amber-500 text-white border-amber-400 shadow-md"
                      : "bg-theme-surface-secondary/40 border-theme-border/50 text-theme-text-secondary hover:text-theme-text"
                  )}
                >
                  <span>{env.label}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                    activeEnv === env.id ? "bg-white/20 text-white" : "bg-theme-surface-tertiary text-theme-text-muted"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secrets List */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-theme-text-muted animate-pulse">
              <RefreshCw size={24} className="animate-spin text-amber-400" />
              <span className="text-xs font-medium">กำลังดึงข้อมูล Secrets...</span>
            </div>
          ) : filteredSecrets.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 bg-theme-surface-secondary/20 rounded-2xl border border-dashed border-theme-border/60 text-center">
              <Lock size={32} className="text-theme-text-muted/40" />
              <p className="text-xs font-bold text-theme-text-secondary">ยังไม่มี Secret ในหมวดหมู่นี้</p>
              <p className="text-[11px] text-theme-text-muted">สามารถเพิ่ม Key-Value ได้ที่ฟอร์มด้านบน</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSecrets.map(sec => {
                const isVisible = visibleSecretIds.has(sec.id);
                const envObj = ENV_CONFIG.find(e => e.id === sec.environment) || ENV_CONFIG[1];

                return (
                  <div
                    key={sec.id}
                    className="bg-theme-surface border border-theme-border/60 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md"
                  >
                    {/* Key Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn(
                          "text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border font-mono",
                          envObj.color || "text-amber-400 bg-amber-500/10 border-amber-500/30"
                        )}>
                          {envObj.label}
                        </span>
                        <h4 className="text-sm font-mono font-extrabold text-amber-400 truncate">
                          {sec.secret_key}
                        </h4>
                      </div>

                      {sec.note && (
                        <p className="text-[11px] text-theme-text-muted">
                          {sec.note}
                        </p>
                      )}
                    </div>

                    {/* Masked Value & Actions */}
                    <div className="flex items-center gap-2 bg-theme-surface-tertiary/80 p-1.5 rounded-xl border border-theme-border/60 shrink-0">
                      <div className="px-3 py-1 font-mono text-xs text-theme-text font-bold truncate max-w-[200px] sm:max-w-[300px]">
                        {isVisible ? sec.secret_value : '••••••••••••••••'}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleVisibility(sec.id, sec)}
                        className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-surface transition-colors"
                        title={isVisible ? "ซ่อนค่าวาลิว" : "แสดงค่าวาลิว"}
                      >
                        {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(sec.secret_value, sec.id, sec.secret_key, sec)}
                        className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                        title="Copy Secret Value"
                      >
                        {copiedId === sec.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(sec)}
                        className="p-1.5 rounded-lg text-theme-text-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        title="แก้ไข Secret นี้"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartDeleteSecret(sec.id, sec.secret_key)}
                        className="p-1.5 rounded-lg text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="ลบ Secret นี้"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Confirm Delete Secret Modal Popup */}
        {deletingSecretTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-theme-surface border border-theme-border rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              
              <div>
                <h4 className="text-lg font-bold text-theme-text">ยืนยันการลบ Secret</h4>
                <p className="text-xs text-theme-text-secondary mt-1">
                  คุณต้องการลบ Secret <span className="font-mono font-bold text-rose-400">"{deletingSecretTarget.keyName}"</span> ใช่หรือไม่?
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingSecretTarget(null)}
                  className="flex-1 py-2.5 bg-theme-surface-secondary border border-theme-border hover:bg-theme-surface-tertiary text-theme-text-secondary rounded-xl text-xs font-semibold transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSecret}
                  disabled={isDeletingSecret}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/25"
                >
                  {isDeletingSecret ? 'กำลังลบ...' : 'ลบ Secret'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-theme-border/60 bg-theme-surface-secondary/40 text-[11px] text-theme-text-muted flex justify-between items-center">
          <span>รวม Secret ทั้งหมด {secrets.length} รายการ</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-theme-surface border border-theme-border rounded-xl text-xs font-bold text-theme-text hover:bg-theme-surface-tertiary transition-all"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
