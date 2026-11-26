import { useState, useEffect, useCallback } from 'react';
import { X, Save, RefreshCw, Trash2, Repeat, Link2, CalendarCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import { cn } from '../../lib/utils';
import {
  applyPreset,
  detectPreset,
  formatYMD,
  isLastWeekdayOfMonth,
  nthWeekdayOfMonth,
  parseYMD,
  type MonthlyMode,
  type RecurrenceEndType,
  type RecurrenceFields,
  type RecurrenceFreq,
  type RecurrencePreset,
} from '../../lib/routine-recurrence';
import { syncRoutineTaskToGCal } from '../../lib/routine-calendar-sync';

export type RoutineFrequency = RecurrenceFreq;
export type RoutineVisibility = 'only_me' | 'specific';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

export interface RoutineTask extends RecurrenceFields {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  description: string | null;
  frequency_type: RoutineFrequency;
  days_of_week: number[] | null;
  day_of_month: number | null;
  month_of_year: number | null;
  start_time?: string | null;
  end_time?: string | null;
  save_to_calendar?: boolean;
  gcal_event_id?: string | null;
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
const UNITS: Exclude<RoutineFrequency, 'none'>[] = ['daily', 'weekly', 'monthly', 'yearly'];

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
  const [links, setLinks] = useState<string[]>([]);
  const [newLinkInput, setNewLinkInput] = useState('');
  const [startDate, setStartDate] = useState(() => formatYMD(new Date()));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [preset, setPreset] = useState<RecurrencePreset>('daily');
  const [frequencyType, setFrequencyType] = useState<RoutineFrequency>('daily');
  const [interval, setIntervalValue] = useState<number | ''>(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>('day_of_month');
  const [weekPosition, setWeekPosition] = useState<number>(1);
  const [dayOfMonth, setDayOfMonth] = useState<number | ''>(1);
  const [monthOfYear, setMonthOfYear] = useState<number>(1);
  const [endType, setEndType] = useState<RecurrenceEndType>('never');
  const [endDate, setEndDate] = useState('');
  const [endCount, setEndCount] = useState<number | ''>(10);
  const [saveToCalendar, setSaveToCalendar] = useState(false);
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
    setLinks([]);
    setNewLinkInput('');
    const start = task ? (task.start_date || formatYMD(new Date(task.created_at))) : formatYMD(new Date());
    const startObj = parseYMD(start);
    setStartDate(start);
    setStartTime(task?.start_time ? task.start_time.slice(0, 5) : '');
    setEndTime(task?.end_time ? task.end_time.slice(0, 5) : '');
    setPreset(task ? detectPreset(task, startObj) : 'daily');
    setFrequencyType(task?.frequency_type || 'daily');
    setIntervalValue(task?.recurrence_interval || 1);
    setDaysOfWeek(task?.days_of_week || []);
    setMonthlyMode(task?.monthly_mode || 'day_of_month');
    setWeekPosition(task?.week_position ?? nthWeekdayOfMonth(startObj));
    setDayOfMonth(task?.day_of_month || startObj.getDate());
    setMonthOfYear(task?.month_of_year || startObj.getMonth() + 1);
    setEndType(task?.recurrence_end_type || 'never');
    setEndDate(task?.recurrence_end_date || '');
    setEndCount(task?.recurrence_count || 10);
    setSaveToCalendar(task?.save_to_calendar ?? false);
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

  // When editing, prefill its existing links.
  useEffect(() => {
    if (!isOpen || !task) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('tb_routine_task_link')
          .select('url')
          .eq('task_id', task.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (!cancelled) setLinks(((data || []) as { url: string }[]).map((r) => r.url));
      } catch (err) {
        console.error('[RoutineTaskFormModal] Failed to load links:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, task]);

  const selectableMembers = members.filter((m) => !selectedUserIds.includes(m.id));

  const handleAddLink = () => {
    const trimmed = newLinkInput.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    setLinks((prev) => [...prev, normalized]);
    setNewLinkInput('');
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

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

  const startObj = parseYMD(startDate || formatYMD(new Date()));
  const startWeekday = startObj.getDay();
  const startNth = nthWeekdayOfMonth(startObj);
  const startIsLast = isLastWeekdayOfMonth(startObj);

  const presetOptions: RecurrencePreset[] = [
    'none',
    'daily',
    'weekly',
    ...(startNth <= 4 ? (['monthly_nth'] as RecurrencePreset[]) : []),
    ...(startIsLast ? (['monthly_last'] as RecurrencePreset[]) : []),
    'monthly_day',
    'yearly',
    'weekdays',
    'custom',
  ];

  const presetLabel = (p: RecurrencePreset) => {
    const weekday = t(`routineTask.weekdayName${startWeekday}`);
    switch (p) {
      case 'none': return t('routineTask.recNone');
      case 'daily': return t('routineTask.recDaily');
      case 'weekly': return t('routineTask.recWeeklyOn', { weekday });
      case 'monthly_nth': return t('routineTask.recMonthlyNth', { weekday, nth: t(`routineTask.nth${startNth}`) });
      case 'monthly_last': return t('routineTask.recMonthlyLast', { weekday });
      case 'monthly_day': return t('routineTask.recMonthlyDay', { day: startObj.getDate() });
      case 'yearly': return t('routineTask.recYearly', { month: t(`routineTask.month${startObj.getMonth() + 1}`), day: startObj.getDate() });
      case 'weekdays': return t('routineTask.recWeekdays');
      default: return t('routineTask.recCustom');
    }
  };

  const loadRecurrence = (fields: Partial<RecurrenceFields>, anchor: Date) => {
    setFrequencyType((fields.frequency_type as RoutineFrequency) || 'daily');
    setIntervalValue(fields.recurrence_interval || 1);
    setDaysOfWeek(fields.days_of_week || []);
    setMonthlyMode(fields.monthly_mode || 'day_of_month');
    setWeekPosition(fields.week_position ?? nthWeekdayOfMonth(anchor));
    setDayOfMonth(fields.day_of_month || anchor.getDate());
    setMonthOfYear(fields.month_of_year || anchor.getMonth() + 1);
  };

  const handlePresetChange = (next: RecurrencePreset) => {
    setPreset(next);
    if (next === 'custom') {
      if (frequencyType === 'none') loadRecurrence(applyPreset('weekly', startObj), startObj);
      return;
    }
    loadRecurrence(applyPreset(next, startObj), startObj);
    if (next === 'none') setEndType('never');
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (!value || preset === 'custom') return;
    const next = parseYMD(value);
    // Presets are defined relative to the start date ("monthly on the 4th Friday"), so re-derive them.
    const stillValid =
      preset === 'monthly_last' ? isLastWeekdayOfMonth(next) : preset === 'monthly_nth' ? nthWeekdayOfMonth(next) <= 4 : true;
    const target: RecurrencePreset = stillValid ? preset : 'weekly';
    setPreset(target);
    loadRecurrence(applyPreset(target, next), next);
  };

  const handleUnitChange = (unit: Exclude<RoutineFrequency, 'none'>) => {
    setFrequencyType(unit);
    if (unit === 'weekly' && daysOfWeek.length === 0) setDaysOfWeek([startWeekday]);
    if (unit === 'monthly') {
      setMonthlyMode('day_of_month');
      setDayOfMonth(startObj.getDate());
    }
    if (unit === 'yearly') {
      setMonthOfYear(startObj.getMonth() + 1);
      setDayOfMonth(startObj.getDate());
    }
  };

  const monthlyChoice = monthlyMode === 'day_of_month' ? 'day' : weekPosition === -1 ? 'last' : 'nth';
  const handleMonthlyChoice = (choice: string) => {
    if (choice === 'day') {
      setMonthlyMode('day_of_month');
      setDayOfMonth(startObj.getDate());
      return;
    }
    setMonthlyMode('nth_weekday');
    setDaysOfWeek([startWeekday]);
    setWeekPosition(choice === 'last' ? -1 : startNth);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast(t('routineTask.titleRequired'), 'error');
      return;
    }
    if (!startDate) {
      showToast(t('routineTask.startDateRequired'), 'error');
      return;
    }
    if (frequencyType === 'weekly' && daysOfWeek.length === 0) {
      showToast(t('routineTask.daysOfWeekRequired'), 'error');
      return;
    }
    const repeats = frequencyType !== 'none';
    if (repeats && endType === 'on_date' && (!endDate || endDate < startDate)) {
      showToast(t('routineTask.endBeforeStart'), 'error');
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      showToast(t('routineTask.endTimeBeforeStart'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      const isNth = frequencyType === 'monthly' && monthlyMode === 'nth_weekday';
      const payload = {
        workspace_id: workspaceId,
        title: title.trim(),
        description: description.trim() || null,
        frequency_type: frequencyType,
        recurrence_interval: repeats ? Math.max(1, interval === '' ? 1 : interval) : 1,
        days_of_week: frequencyType === 'weekly' || isNth ? daysOfWeek : null,
        day_of_month:
          (frequencyType === 'monthly' && monthlyMode === 'day_of_month') || frequencyType === 'yearly'
            ? (dayOfMonth === '' ? 1 : dayOfMonth)
            : null,
        month_of_year: frequencyType === 'yearly' ? monthOfYear : null,
        monthly_mode: frequencyType === 'monthly' ? monthlyMode : null,
        week_position: isNth ? weekPosition : null,
        start_date: startDate,
        start_time: startTime || null,
        end_time: startTime ? (endTime || null) : null,
        recurrence_end_type: repeats ? endType : 'never',
        recurrence_end_date: repeats && endType === 'on_date' ? endDate : null,
        recurrence_count: repeats && endType === 'after_count' ? Math.max(1, endCount === '' ? 1 : endCount) : null,
        save_to_calendar: saveToCalendar,
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

        // Replace the link list wholesale too, same reasoning as above.
        const { error: deleteLinksError } = await supabase
          .from('tb_routine_task_link')
          .delete()
          .eq('task_id', taskId);
        if (deleteLinksError) throw deleteLinksError;

        if (links.length > 0) {
          const linkRows = links.map((url) => ({ task_id: taskId, url }));
          const { error: insertLinksError } = await supabase.from('tb_routine_task_link').insert(linkRows);
          if (insertLinksError) throw insertLinksError;
        }
      }

      showToast(t('routineTask.saveSuccess'), 'success');

      // Mirror to Google Calendar (create / update / remove). The in-app Calendar reads the row directly.
      if (taskId && (saveToCalendar || task?.save_to_calendar)) {
        try {
          await syncRoutineTaskToGCal(taskId, currentUserId);
        } catch (syncErr: unknown) {
          showToast(t('routineTask.gcalSyncError') + getErrorMessage(syncErr), 'warning');
        }
      }

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
            <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1 flex items-center gap-1">
              <Link2 size={12} />
              {t('routineTask.linkLabel')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLinkInput}
                onChange={(e) => setNewLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLink();
                  }
                }}
                placeholder={t('routineTask.linkPlaceholder')}
                className="flex-1 theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleAddLink}
                disabled={!newLinkInput.trim()}
                className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {t('routineTask.addLink')}
              </button>
            </div>
            {links.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                {links.map((url, index) => (
                  <span
                    key={`${url}-${index}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                  >
                    <Link2 size={11} className="shrink-0" />
                    <span className="truncate flex-1">{url}</span>
                    <button type="button" onClick={() => handleRemoveLink(index)} className="hover:text-rose-500 transition-colors shrink-0">
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                  {t('routineTask.startDateLabel')} *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                  {t('routineTask.startTimeLabel')}
                </label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                  {t('routineTask.endTimeLabel')}
                </label>
                <input
                  type="time"
                  value={endTime}
                  disabled={!startTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all disabled:opacity-40"
                />
              </div>
            </div>
            <p className="text-[10px] text-theme-text-muted -mt-1">{t('routineTask.timeHint')}</p>

            <div>
              <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                {t('routineTask.frequencyLabel')}
              </label>
              <select value={preset} onChange={(e) => handlePresetChange(e.target.value as RecurrencePreset)} className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all">
                {presetOptions.map((p) => (
                  <option key={p} value={p}>{presetLabel(p)}</option>
                ))}
              </select>
            </div>

            {preset === 'custom' && (
              <div className="rounded-xl border border-theme-border/60 bg-theme-surface-secondary/40 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-theme-text-secondary">{t('routineTask.repeatEvery')}</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={interval}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') { setIntervalValue(''); return; }
                      const parsed = Number(raw);
                      if (!Number.isNaN(parsed)) setIntervalValue(parsed);
                    }}
                    onBlur={() => setIntervalValue((prev) => Math.min(999, Math.max(1, prev === '' ? 1 : prev)))}
                    className="w-20 theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  />
                  <select
                    value={frequencyType === 'none' ? 'weekly' : frequencyType}
                    onChange={(e) => handleUnitChange(e.target.value as Exclude<RoutineFrequency, 'none'>)}
                    className="flex-1 theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u === 'daily' ? t('routineTask.unitDay') : u === 'weekly' ? t('routineTask.unitWeek') : u === 'monthly' ? t('routineTask.unitMonth') : t('routineTask.unitYear')}
                      </option>
                    ))}
                  </select>
                </div>

                {frequencyType === 'weekly' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-theme-text-muted mb-1.5 uppercase tracking-wide">
                      {t('routineTask.repeatOnLabel')}
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
                  <select value={monthlyChoice} onChange={(e) => handleMonthlyChoice(e.target.value)} className="w-full theme-field rounded-lg px-3 py-2 text-xs border focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all">
                    <option value="day">{presetLabel('monthly_day')}</option>
                    {startNth <= 4 && <option value="nth">{presetLabel('monthly_nth')}</option>}
                    {startIsLast && <option value="last">{presetLabel('monthly_last')}</option>}
                  </select>
                )}

                {frequencyType === 'yearly' && (
                  <p className="text-[11px] text-theme-text-muted">{presetLabel('yearly')}</p>
                )}
              </div>
            )}

            {frequencyType !== 'none' && (
              <div className="rounded-xl border border-theme-border/60 p-3 space-y-2">
                <label className="block text-[11px] font-semibold text-theme-text-secondary">
                  {t('routineTask.endsLabel')}
                </label>
                <label className="flex items-center gap-2 text-xs text-theme-text">
                  <input type="radio" name="routine-end" checked={endType === 'never'} onChange={() => setEndType('never')} />
                  {t('routineTask.endNever')}
                </label>
                <label className="flex items-center gap-2 text-xs text-theme-text">
                  <input type="radio" name="routine-end" checked={endType === 'on_date'} onChange={() => setEndType('on_date')} />
                  <span className="w-20 shrink-0">{t('routineTask.endOnDate')}</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    disabled={endType !== 'on_date'}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 theme-field rounded-lg px-3 py-1.5 text-xs border outline-none disabled:opacity-40"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-theme-text">
                  <input type="radio" name="routine-end" checked={endType === 'after_count'} onChange={() => setEndType('after_count')} />
                  <span className="w-20 shrink-0">{t('routineTask.endAfter')}</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={endCount}
                    disabled={endType !== 'after_count'}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') { setEndCount(''); return; }
                      const parsed = Number(raw);
                      if (!Number.isNaN(parsed)) setEndCount(parsed);
                    }}
                    onBlur={() => setEndCount((prev) => Math.min(999, Math.max(1, prev === '' ? 1 : prev)))}
                    className="w-20 theme-field rounded-lg px-3 py-1.5 text-xs border outline-none disabled:opacity-40"
                  />
                  <span>{t('routineTask.endOccurrences')}</span>
                </label>
              </div>
            )}

            <label className="flex items-start gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToCalendar}
                onChange={(e) => setSaveToCalendar(e.target.checked)}
                className="mt-0.5 rounded border-slate-500 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-theme-text">
                  <CalendarCheck size={13} className="text-indigo-500" />
                  {t('routineTask.saveToCalendar')}
                </span>
                <span className="block text-[11px] text-theme-text-muted mt-0.5">{t('routineTask.saveToCalendarHint')}</span>
              </span>
            </label>
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
