import { supabase } from './supabase';
import { googleCalendar } from './google-calendar';
import { firstOccurrence, formatYMD, parseYMD, toRRule, type RecurrenceFields } from './routine-recurrence';

/** Private extended property that marks a Google event as a To-do reminder (not a worklog). */
export const ROUTINE_EVENT_PROP = 'worklog_routine_task_id';

interface RoutineTaskRow extends RecurrenceFields {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  save_to_calendar: boolean;
  gcal_event_id: string | null;
}

export type RoutineSyncResult = 'synced' | 'removed' | 'skipped';

const TIME_ZONE = 'Asia/Bangkok';

function hhmmss(value: string): string {
  return value.length === 5 ? `${value}:00` : value.slice(0, 8);
}

function addMinutes(dateStr: string, time: string, minutes: number): { date: string; time: string } {
  const [h, m, s] = hhmmss(time).split(':').map(Number);
  const d = parseYMD(dateStr);
  d.setHours(h, m + minutes, s || 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: formatYMD(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` };
}

function buildPayload(task: RoutineTaskRow, firstDate: string, links: string[]) {
  const timed = Boolean(task.start_time);
  const lines = [
    '⏰ To-do reminder (Worklog)',
    task.description ? `📝 ${task.description}` : null,
    ...links.map((url) => `🔗 ${url}`),
    '',
    'เมื่อถึงวันนี้ ให้เปิดแอปเพื่อบันทึกงานและเลือก Type / Project / Action เพิ่มเติม',
  ].filter((line): line is string => line !== null);

  const event: Record<string, unknown> = {
    summary: `⏰ ${task.title}`,
    description: lines.join('\n'),
    extendedProperties: { private: { [ROUTINE_EVENT_PROP]: task.id } },
    colorId: '5',
  };

  if (timed) {
    const startTime = hhmmss(task.start_time as string);
    let end = task.end_time ? { date: firstDate, time: hhmmss(task.end_time) } : addMinutes(firstDate, startTime, 60);
    if (end.date === firstDate && end.time <= startTime) end = addMinutes(firstDate, startTime, 60);
    event.start = { dateTime: `${firstDate}T${startTime}`, timeZone: TIME_ZONE };
    event.end = { dateTime: `${end.date}T${end.time}`, timeZone: TIME_ZONE };
  } else {
    const next = parseYMD(firstDate);
    next.setDate(next.getDate() + 1);
    event.start = { date: firstDate };
    event.end = { date: formatYMD(next) };
  }

  const rrule = toRRule(task, timed);
  event.recurrence = rrule ? [rrule] : [];
  return event;
}

async function getCalendarTarget(userId: string): Promise<{ calendarId: string } | null> {
  const { data: user } = await supabase
    .from('users')
    .select('gcal_sync_enabled, gcal_calendar_id')
    .eq('id', userId)
    .maybeSingle();
  if (!user?.gcal_sync_enabled) return null;
  return { calendarId: user.gcal_calendar_id || 'primary' };
}

/**
 * Mirrors a routine task to the owner's Google Calendar as ONE recurring event.
 * Creates it, updates it, or removes it when the task no longer belongs on the calendar.
 * The in-app Calendar reads the task row directly, so it needs no sync step.
 */
export async function syncRoutineTaskToGCal(taskId: string, actingUserId: string): Promise<RoutineSyncResult> {
  const { data, error } = await supabase.from('tb_routine_task').select('*').eq('id', taskId).maybeSingle();
  if (error || !data) return 'skipped';
  const task = data as RoutineTaskRow;
  if (task.created_by !== actingUserId) return 'skipped'; // only touch the owner's own Google Calendar

  const target = await getCalendarTarget(actingUserId);
  if (!target) return 'skipped';

  const shouldExist = task.save_to_calendar && task.is_active;
  if (!shouldExist) {
    if (!task.gcal_event_id) return 'skipped';
    await removeEvent(actingUserId, target.calendarId, task.gcal_event_id);
    await supabase.from('tb_routine_task').update({ gcal_event_id: null }).eq('id', task.id);
    return 'removed';
  }

  const firstDate = firstOccurrence(task);
  if (!firstDate) return 'skipped';

  const { data: linkRows } = await supabase
    .from('tb_routine_task_link')
    .select('url')
    .eq('task_id', task.id)
    .order('created_at', { ascending: true });
  const payload = buildPayload(task, firstDate, ((linkRows || []) as { url: string }[]).map((r) => r.url));

  let eventId = task.gcal_event_id;
  if (eventId) {
    try {
      await googleCalendar.updateEvent(actingUserId, target.calendarId, eventId, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/not found|deleted|gone/i.test(message)) throw err;
      eventId = null; // the event was removed on Google's side: recreate it below
    }
  }
  if (!eventId) {
    eventId = await googleCalendar.createEvent(actingUserId, target.calendarId, payload);
    const { error: saveError } = await supabase.from('tb_routine_task').update({ gcal_event_id: eventId }).eq('id', task.id);
    if (saveError) throw saveError;
  }
  return 'synced';
}

async function removeEvent(userId: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await googleCalendar.deleteEvent(userId, calendarId, eventId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/not found|deleted|gone/i.test(message)) throw err;
  }
}

/** Best-effort cleanup before a routine task row is deleted. Never blocks the delete. */
export async function removeRoutineTaskFromGCal(task: { created_by: string; gcal_event_id?: string | null }, actingUserId: string): Promise<void> {
  if (!task.gcal_event_id || task.created_by !== actingUserId) return;
  try {
    const target = await getCalendarTarget(actingUserId);
    if (target) await removeEvent(actingUserId, target.calendarId, task.gcal_event_id);
  } catch (err) {
    console.warn('[Routine GCal] Failed to remove calendar event:', err);
  }
}
