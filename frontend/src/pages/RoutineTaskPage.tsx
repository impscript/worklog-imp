import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Repeat, CheckCircle2, Circle, Edit2, Trash2, Users, ListChecks, AlertCircle, Calendar, Link2, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';
import { cn } from '../lib/utils';
import RoutineTaskFormModal, { type RoutineTask } from '../components/modals/RoutineTaskFormModal';

interface SessionUser {
  id: string;
  name?: string;
  nickname?: string;
  activeWorkspaceId?: string;
  workspaceName?: string;
}

const formatDateToYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

function isDueToday(task: RoutineTask, today: Date): boolean {
  if (task.frequency_type === 'daily') return true;
  if (task.frequency_type === 'weekly') {
    return (task.days_of_week || []).includes(today.getDay());
  }
  if (task.frequency_type === 'monthly') {
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(task.day_of_month || 1, lastDayOfMonth);
    return today.getDate() === targetDay;
  }
  if (task.frequency_type === 'yearly') {
    const targetMonth = task.month_of_year || 1;
    const lastDayOfTargetMonth = new Date(today.getFullYear(), targetMonth, 0).getDate();
    const targetDay = Math.min(task.day_of_month || 1, lastDayOfTargetMonth);
    return today.getMonth() + 1 === targetMonth && today.getDate() === targetDay;
  }
  return false;
}

export default function RoutineTaskPage() {
  const { t } = useTranslation();
  const { showToast, showConfirm } = useNotification();
  const navigate = useNavigate();

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [tasks, setTasks] = useState<RoutineTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [assignedNames, setAssignedNames] = useState<Record<string, string[]>>({});
  const [taskLinks, setTaskLinks] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RoutineTask | null>(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem('worklog_session');
    if (sessionStr) {
      try {
        setSessionUser(JSON.parse(sessionStr));
      } catch {
        // ignore malformed session
      }
    }
  }, []);

  const activeWorkspaceId = sessionUser?.activeWorkspaceId;

  const fetchTasks = useCallback(async () => {
    const workspaceId = sessionUser?.activeWorkspaceId;
    const userId = sessionUser?.id;
    if (!workspaceId || !userId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_routine_task')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const taskRows = (data || []) as RoutineTask[];
      setTasks(taskRows);

      const todayStr = formatDateToYMD(new Date());
      const { data: compData, error: compError } = await supabase
        .from('tb_routine_task_completion')
        .select('task_id')
        .eq('completed_date', todayStr)
        .eq('user_id', userId);
      if (compError) throw compError;
      setCompletedTaskIds(new Set(((compData || []) as { task_id: string }[]).map((r) => r.task_id)));

      const specificTaskIds = taskRows.filter((task) => task.visibility === 'specific').map((task) => task.id);
      if (specificTaskIds.length > 0) {
        const { data: visData, error: visError } = await supabase
          .from('tb_routine_task_visibility')
          .select('task_id, users ( full_name, nickname )')
          .in('task_id', specificTaskIds);
        if (visError) throw visError;

        interface RawVisibilityRow {
          task_id: string;
          users?: { full_name?: string | null; nickname?: string | null } | null;
        }

        const names: Record<string, string[]> = {};
        ((visData || []) as unknown as RawVisibilityRow[]).forEach((row) => {
          const displayName = row.users?.full_name || row.users?.nickname || null;
          if (!displayName) return;
          if (!names[row.task_id]) names[row.task_id] = [];
          names[row.task_id].push(displayName);
        });
        setAssignedNames(names);
      } else {
        setAssignedNames({});
      }

      const allTaskIds = taskRows.map((task) => task.id);
      if (allTaskIds.length > 0) {
        const { data: linkData, error: linkError } = await supabase
          .from('tb_routine_task_link')
          .select('task_id, url')
          .in('task_id', allTaskIds)
          .order('created_at', { ascending: true });
        if (linkError) throw linkError;

        const linksByTask: Record<string, string[]> = {};
        ((linkData || []) as { task_id: string; url: string }[]).forEach((row) => {
          if (!linksByTask[row.task_id]) linksByTask[row.task_id] = [];
          linksByTask[row.task_id].push(row.url);
        });
        setTaskLinks(linksByTask);
      } else {
        setTaskLinks({});
      }
    } catch (err: unknown) {
      showToast(t('routineTask.loadError') + getErrorMessage(err), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [sessionUser, showToast, t]);

  useEffect(() => {
    if (activeWorkspaceId && sessionUser?.id) fetchTasks();
  }, [activeWorkspaceId, sessionUser?.id, fetchTasks]);

  const today = useMemo(() => new Date(), []);
  const dueTasks = useMemo(
    () => tasks.filter((task) => isDueToday(task, today)),
    [tasks, today]
  );
  const doneCount = useMemo(
    () => dueTasks.filter((task) => completedTaskIds.has(task.id)).length,
    [dueTasks, completedTaskIds]
  );

  const frequencyLabel = (task: RoutineTask) => {
    if (task.frequency_type === 'daily') return t('routineTask.frequencyDaily');
    if (task.frequency_type === 'weekly') {
      return (task.days_of_week || []).map((d) => t(`routineTask.weekdayFull${d}`)).join(', ');
    }
    if (task.frequency_type === 'yearly') {
      return t('routineTask.everyYearDate', {
        day: task.day_of_month,
        month: t(`routineTask.month${task.month_of_year || 1}`),
      });
    }
    return t('routineTask.everyMonthDay', { day: task.day_of_month });
  };

  const handleToggleComplete = async (task: RoutineTask, isDone: boolean) => {
    if (!sessionUser?.id) return;
    const todayStr = formatDateToYMD(new Date());

    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (isDone) next.add(task.id); else next.delete(task.id);
      return next;
    });

    try {
      if (isDone) {
        const { error } = await supabase.from('tb_routine_task_completion').insert({
          task_id: task.id,
          user_id: sessionUser.id,
          completed_date: todayStr,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tb_routine_task_completion')
          .delete()
          .eq('task_id', task.id)
          .eq('user_id', sessionUser.id)
          .eq('completed_date', todayStr);
        if (error) throw error;
      }
    } catch (err: unknown) {
      setCompletedTaskIds((prev) => {
        const next = new Set(prev);
        if (isDone) next.delete(task.id); else next.add(task.id);
        return next;
      });
      showToast(t('routineTask.saveError') + getErrorMessage(err), 'error');
    }
  };

  const handleCreate = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleLogThisTask = (task: RoutineTask) => {
    const prefillDescription = task.description ? `${task.title}\n${task.description}` : task.title;
    navigate('/log', { state: { prefillDescription } });
  };

  const handleEdit = (task: RoutineTask) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDelete = async (task: RoutineTask) => {
    const ok = await showConfirm({
      title: t('routineTask.deleteConfirmTitle'),
      message: t('routineTask.deleteConfirmMessage'),
      type: 'danger',
    });
    if (!ok) return;

    try {
      const { error } = await supabase.from('tb_routine_task').delete().eq('id', task.id);
      if (error) throw error;
      showToast(t('routineTask.deleteSuccess'), 'success');
      fetchTasks();
    } catch (err: unknown) {
      showToast(t('routineTask.saveError') + getErrorMessage(err), 'error');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-theme-text flex items-center gap-2">
              <Repeat size={20} className="text-indigo-500" />
              {t('routineTask.title')}
            </h1>
            <p className="text-xs text-theme-text-muted mt-0.5">{t('routineTask.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-500/20 transition-all self-start"
          >
            <Plus size={14} />
            {t('routineTask.newTask')}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        ) : !activeWorkspaceId ? (
          <div className="bg-theme-surface border border-theme-border rounded-2xl p-8 text-center text-theme-text-secondary">
            <AlertCircle className="mx-auto text-amber-500 mb-2" size={32} />
            <p className="text-sm">{t('routineTask.loadError')}</p>
          </div>
        ) : (
          <>
            {/* Due Today */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                  <ListChecks size={14} className="text-indigo-500" />
                  {t('routineTask.dueToday')}
                </h2>
                {dueTasks.length > 0 && (
                  <span className="text-[11px] font-semibold text-theme-text-secondary">
                    {t('routineTask.progress', { done: doneCount, total: dueTasks.length })}
                  </span>
                )}
              </div>

              {dueTasks.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-theme-border/70 rounded-xl">
                  <p className="text-xs text-theme-text-muted">{t('routineTask.noTasksDue')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dueTasks.map((task) => {
                    const isDone = completedTaskIds.has(task.id);
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'p-4 rounded-xl border flex items-start gap-3 transition-all',
                          isDone
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-theme-surface border-theme-border hover:border-indigo-500/30'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(task, !isDone)}
                          className="shrink-0 mt-0.5"
                        >
                          {isDone ? (
                            <CheckCircle2 size={20} className="text-emerald-500" />
                          ) : (
                            <Circle size={20} className="text-theme-text-muted hover:text-indigo-500 transition-colors" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-semibold text-theme-text', isDone && 'line-through opacity-60')}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-[11px] text-theme-text-muted mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                          {taskLinks[task.id]?.length > 0 && (
                            <div className="flex flex-col gap-0.5 mt-1">
                              {taskLinks[task.id].map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  <Link2 size={11} className="shrink-0" />
                                  <span className="truncate max-w-[220px]">{url}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20 flex items-center gap-1">
                              <Calendar size={10} />
                              {frequencyLabel(task)}
                            </span>
                            {task.visibility === 'specific' && assignedNames[task.id]?.length > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20 flex items-center gap-1">
                                <Users size={10} />
                                {t('routineTask.assignedTo', { names: assignedNames[task.id].join(', ') })}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleLogThisTask(task)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-2"
                          >
                            <PlusCircle size={12} />
                            {t('routineTask.logThisTask')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* All routine tasks (management), grouped kanban-style by frequency */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Repeat size={14} className="text-indigo-500" />
                {t('routineTask.allTasks')}
              </h2>

              {tasks.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-theme-border/70 rounded-xl">
                  <p className="text-xs text-theme-text-muted">{t('routineTask.noTasksYet')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => {
                    const columnTasks = tasks.filter((task) => task.frequency_type === freq);
                    const columnLabel =
                      freq === 'daily' ? t('routineTask.groupDaily')
                      : freq === 'weekly' ? t('routineTask.groupWeekly')
                      : freq === 'monthly' ? t('routineTask.groupMonthly')
                      : t('routineTask.groupYearly');
                    return (
                      <div key={freq} className="bg-theme-surface-secondary/40 border border-theme-border/60 rounded-2xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={12} className="text-indigo-500" />
                            {columnLabel}
                          </h3>
                          <span className="text-[10px] font-bold text-theme-text-muted bg-theme-surface-tertiary px-1.5 py-0.5 rounded-full">
                            {columnTasks.length}
                          </span>
                        </div>

                        {columnTasks.length === 0 ? (
                          <div className="py-6 text-center border border-dashed border-theme-border/50 rounded-xl">
                            <p className="text-[11px] text-theme-text-muted">{t('routineTask.noTasksYet')}</p>
                          </div>
                        ) : (
                          columnTasks.map((task) => {
                            const isOwner = task.created_by === sessionUser?.id;
                            const names = assignedNames[task.id];
                            return (
                              <div key={task.id} className="p-3 rounded-xl border border-theme-border/80 bg-theme-surface space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold text-theme-text">{task.title}</p>
                                  {isOwner && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleEdit(task)}
                                        className="p-1 rounded border border-theme-border bg-theme-surface-secondary hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-theme-text-muted hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                                        title={t('routineTask.edit')}
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(task)}
                                        className="p-1 rounded border border-theme-border bg-theme-surface-secondary hover:bg-rose-50 dark:hover:bg-rose-500/10 text-theme-text-muted hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                                        title={t('routineTask.delete')}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {task.description && (
                                  <p className="text-[11px] text-theme-text-muted line-clamp-2">{task.description}</p>
                                )}
                                {taskLinks[task.id]?.length > 0 && (
                                  <div className="flex flex-col gap-0.5">
                                    {taskLinks[task.id].map((url) => (
                                      <a
                                        key={url}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                                      >
                                        <Link2 size={11} className="shrink-0" />
                                        <span className="truncate max-w-[180px]">{url}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                                    <Calendar size={10} />
                                    {frequencyLabel(task)}
                                  </span>
                                  {task.visibility === 'specific' && names && names.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                                      <Users size={10} />
                                      {t('routineTask.assignedTo', { names: names.join(', ') })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <RoutineTaskFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        workspaceId={activeWorkspaceId || ''}
        currentUserId={sessionUser?.id || ''}
        task={editingTask}
        onSaved={fetchTasks}
      />
    </AppLayout>
  );
}
