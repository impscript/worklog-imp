import { useState, useEffect, useCallback } from 'react';
import { X, Save, RefreshCw, Trash2, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';

export type RoutineFrequency = 'daily' | 'weekly' | 'monthly';
export type RoutineVisibility = 'only_me' | 'specific';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

export interface RoutineTask {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  description: string | null;
  frequency_type: RoutineFrequency;
  days_of_week: number[] | null;
  day_of_month: number | null;
  visibility: RoutineVisibility;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkspaceMember {
  id: string;
  name: string;
  email?: string;
}

interface RoutineTaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  task: RoutineTask | null;
  onSaved: () => void;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const FREQUENCIES: RoutineFrequency[] = ['daily', 'weekly', 'monthly'];

export default function RoutineTaskFormModal({
  isOpen,
  onClose,
  workspaceId,
  currentUserId,
  task,
  onSaved,
}: RoutineTaskFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useNotification();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequencyType, setFrequencyType] = useState<RoutineFrequency>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState<number | ''>(1);
  const [visibility, setVisibility] = useState<RoutineVisibility>('only_me');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedNewUserId, setSelectedNewUserId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const isEditing = !!task;

  const resetForm = useCallback(() => {
    setTitle(task?.title || '');
    setDescription(task?.description || '');
    setFrequencyType(task?.frequency_type || 'daily');
    setDaysOfWeek(task?.days_of_week || []);
    setDayOfMonth(task?.day_of_month || 1);
    setVisibility(task?.visibility || 'only_me');
    setSelectedUserIds([]);
    setSelectedNewUserId('');
  }, [task]);

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, resetForm]);

  // Load workspace members (for the "specific people" picker), scoped to the
  // active workspace only — never cross-workspace.
  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    let cancelled = false;
    (async () => {
      setIsLoadingMembers(true);
      try {
        const { data, error } = await supabase
          .from('workspace_users')
          .select('user_id, users ( id, full_name, nickname, email )')
          .eq('workspace_id', workspaceId);
        if (error) throw error;
        if (cancelled) return;

        interface RawMemberRow {
          user_id: string;
          users?: { id?: string; full_name?: string | null; nickname?: string | null; email?: string | null } | null;
        }

        const list: WorkspaceMember[] = ((data || []) as unknown as RawMemberRow[])
          .filter((m) => m.users && m.user_id !== currentUserId)
          .map((m) => {
            const u = m.users!;
            const name = u.nickname ? `${u.full_name || ''} (${u.nickname})`.trim() : (u.full_name || u.email || 'User');
            return { id: m.user_id, name, email: u.email || undefined };
          });
        setMembers(list);
      } catch (err) {
        console.error('[RoutineTaskFormModal] Failed to load members:', err);
      } finally {
        if (!cancelled) setIsLoadingMembers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, workspaceId, currentUserId]);

  // When editing a 'specific'-visibility task, prefill its existing share list.
  useEffect(() => {
    if (!isOpen || !task || task.visibility !== 'specific') return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('tb_routine_task_visibility')
          .select('user_id')
          .eq('task_id', task.id);
        if (error) throw error;
        if (!cancelled) setSelectedUserIds(((data || []) as { user_id: string }[]).map((r) => r.user_id));
      } catch (err) {
        console.error('[RoutineTaskFormModal] Failed to load shared users:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, task]);

  const selectableMembers = members.filter((m) => !selectedUserIds.includes(m.id));

  const handleAddMember = () => {
    if (!selectedNewUserId) return;
    setSelectedUserIds((prev) => [...prev, selectedNewUserId]);
    setSelectedNewUserId('');
  };

  const handleRemoveMember = (id: string) => {
    setSelectedUserIds((prev) => prev.filter((uid) => uid !== id));
  };

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast(t('routineTask.titleRequired'), 'error');
      return;
    }
    if (frequencyType === 'weekly' && daysOfWeek.length === 0) {
      showToast(t('routineTask.daysOfWeekRequired'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        title: title.trim(),
        description: description.trim() || null,
        frequency_type: frequencyType,
        days_of_week: frequencyType === 'weekly' ? daysOfWeek : null,
        day_of_month: frequencyType === 'monthly' ? (dayOfMonth === '' ? 1 : dayOfMonth) : null,
        visibility,
        updated_at: new Date().toISOString(),
      };

      let taskId = task?.id;
      if (isEditing && taskId) {
        const { error } = await supabase.from('tb_routine_task').update(payload).eq('id', taskId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('tb_routine_task')
          .insert({ ...payload, created_by: currentUserId })
          .select('id')
          .single();
        if (error) throw error;
        taskId = (data as { id: string }).id;
      }

      if (taskId) {
        // Replace the shared-with list wholesale — simplest way to keep it
        // consistent with the form state, and only the owner is allowed to
        // write these rows (enforced by RLS).
        const { error: deleteError } = await supabase
          .from('tb_routine_task_visibility')
          .delete()
          .eq('task_id', taskId);
        if (deleteError) throw deleteError;

        if (visibility === 'specific' && selectedUserIds.length > 0) {
          const rows = selectedUserIds.map((userId) => ({ task_id: taskId, user_id: userId }));
          const { error: insertError } = await supabase.from('tb_routine_task_visibility').insert(rows);
          if (insertError) throw insertError;
        }
      }

      showToast(t('routineTask.saveSuccess'), 'success');
      onSaved();
      onClose();
    } catch (err: unknown) {
      showToast(t('routineTask.saveError') + getErrorMessage(err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl theme-panel border border-theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border/60 bg-theme-surface-secondary/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Repeat size={18} />
            </div>
            <h2 className="text-base font-bold text-theme-text">
              {isEditing ? t('routineTask.editTask') : t('routineTask.newTask')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-theme-surface-tertiary text-theme-text-muted hover:text-theme-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div>
            <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
              {t('routineTask.titleLabel')} *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('routineTask.titlePlaceholder')}
              className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
              {t('routineTask.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t('routineTask.descriptionPlaceholder')}
              className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all resize-y"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-theme-text-secondary mb-2">
              {t('routineTask.frequencyLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {FREQUENCIES.map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequencyType(freq)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-[11px] font-bold border transition-all',
                    frequencyType === freq
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                      : 'bg-theme-surface border-theme-border text-theme-text-secondary hover:border-indigo-500/40'
                  )}
                >
                  {freq === 'daily' && t('routineTask.frequencyDaily')}
                  {freq === 'weekly' && t('routineTask.frequencyWeekly')}
                  {freq === 'monthly' && t('routineTask.frequencyMonthly')}
                </button>
              ))}
            </div>

            {frequencyType === 'weekly' && (
              <div>
                <label className="block text-[10px] font-semibold text-theme-text-muted mb-1.5 uppercase tracking-wide">
                  {t('routineTask.daysOfWeekLabel')}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDayOfWeek(day)}
                      className={cn(
                        'w-9 h-9 rounded-lg text-[11px] font-bold border transition-all',
                        daysOfWeek.includes(day)
                          ? 'bg-indigo-500 text-white border-indigo-500'
                          : 'bg-theme-surface border-theme-border text-theme-text-secondary hover:border-indigo-500/40'
                      )}
                    >
                      {t(`routineTask.weekday${day}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {frequencyType === 'monthly' && (
              <div className="w-32">
                <label className="block text-[10px] font-semibold text-theme-text-muted mb-1.5 uppercase tracking-wide">
                  {t('routineTask.dayOfMonthLabel')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setDayOfMonth('');
                      return;
                    }
                    const parsed = Number(raw);
                    if (!Number.isNaN(parsed)) setDayOfMonth(parsed);
                  }}
                  onBlur={() => setDayOfMonth((prev) => Math.min(31, Math.max(1, prev === '' ? 1 : prev)))}
                  className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-theme-text-secondary mb-2">
              {t('routineTask.visibilityLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setVisibility('only_me')}
                className={cn(
                  'px-3 py-2 rounded-lg text-[11px] font-bold border transition-all',
                  visibility === 'only_me'
                    ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-theme-surface border-theme-border text-theme-text-secondary hover:border-indigo-500/40'
                )}
              >
                {t('routineTask.visibilityOnlyMe')}
              </button>
              <button
                type="button"
                onClick={() => setVisibility('specific')}
                className={cn(
                  'px-3 py-2 rounded-lg text-[11px] font-bold border transition-all',
                  visibility === 'specific'
                    ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-theme-surface border-theme-border text-theme-text-secondary hover:border-indigo-500/40'
                )}
              >
                {t('routineTask.visibilitySpecific')}
              </button>
            </div>

            {visibility === 'specific' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={selectedNewUserId}
                    onChange={(e) => setSelectedNewUserId(e.target.value)}
                    className="flex-1 theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  >
                    <option value="">{t('routineTask.selectPerson')}</option>
                    {selectableMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}{m.email ? ` (${m.email})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!selectedNewUserId}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {t('routineTask.addPerson')}
                  </button>
                </div>
                {isLoadingMembers ? (
                  <p className="text-[11px] text-theme-text-muted flex items-center gap-1.5">
                    <RefreshCw size={11} className="animate-spin" />
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUserIds.map((uid) => {
                      const member = members.find((m) => m.id === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                        >
                          {member?.name || uid}
                          <button type="button" onClick={() => handleRemoveMember(uid)} className="hover:text-rose-500 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-theme-border/60 bg-theme-surface-secondary/40 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-theme-text-secondary hover:bg-theme-surface-tertiary border border-theme-border transition-all"
          >
            {t('routineTask.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all flex items-center gap-1.5"
          >
            {isSaving ? (
              <><RefreshCw size={13} className="animate-spin" /> {t('routineTask.saving')}</>
            ) : (
              <><Save size={13} /> {t('routineTask.save')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
