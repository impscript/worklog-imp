// Google-Calendar-style recurrence for routine tasks (To do list).
// Pure functions only: the same rules drive the "due today" list, the in-app Calendar
// reminders and the RRULE sent to Google Calendar, so the three can never disagree.

export type RecurrenceFreq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type MonthlyMode = 'day_of_month' | 'nth_weekday';
export type RecurrenceEndType = 'never' | 'on_date' | 'after_count';

export interface RecurrenceFields {
  frequency_type: RecurrenceFreq;
  recurrence_interval?: number | null;
  days_of_week?: number[] | null;
  day_of_month?: number | null;
  month_of_year?: number | null;
  monthly_mode?: MonthlyMode | null;
  week_position?: number | null; // 1..4, or -1 for "last"
  start_date?: string | null;
  recurrence_end_type?: RecurrenceEndType | null;
  recurrence_end_date?: string | null;
  recurrence_count?: number | null;
  created_at?: string;
}

export type RecurrencePreset =
  | 'none' | 'daily' | 'weekly' | 'monthly_day' | 'monthly_nth' | 'monthly_last' | 'yearly' | 'weekdays' | 'custom';

const DAY_MS = 86_400_000;
const MAX_SCAN_DAYS = 800;

// ── Date helpers (local calendar dates, "YYYY-MM-DD") ───────────────────────

export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYMD(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function daysBetween(a: Date, b: Date): number {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);
}

const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/** 1..5 — which occurrence of its weekday this date is within its month. */
export function nthWeekdayOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

export function isLastWeekdayOfMonth(date: Date): boolean {
  return date.getDate() + 7 > daysInMonth(date.getFullYear(), date.getMonth());
}

/** Start of the task's recurrence: its start date, or (legacy rows) the day it was created. */
export function anchorDate(task: RecurrenceFields): Date {
  if (task.start_date) return parseYMD(task.start_date);
  if (task.created_at) return startOfDay(new Date(task.created_at));
  return startOfDay(new Date(0));
}

// ── Occurrence rules ────────────────────────────────────────────────────────

function matchesPattern(task: RecurrenceFields, d: Date, anchor: Date): boolean {
  const interval = Math.max(1, task.recurrence_interval ?? 1);

  switch (task.frequency_type) {
    case 'none':
      return daysBetween(anchor, d) === 0;

    case 'daily':
      return daysBetween(anchor, d) % interval === 0;

    case 'weekly': {
      const days = task.days_of_week && task.days_of_week.length > 0 ? task.days_of_week : [anchor.getDay()];
      if (!days.includes(d.getDay())) return false;
      const anchorWeekStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
      return Math.floor(daysBetween(anchorWeekStart, d) / 7) % interval === 0;
    }

    case 'monthly': {
      const months = (d.getFullYear() - anchor.getFullYear()) * 12 + (d.getMonth() - anchor.getMonth());
      if (months < 0 || months % interval !== 0) return false;
      if (task.monthly_mode === 'nth_weekday') {
        const weekday = task.days_of_week?.[0] ?? anchor.getDay();
        if (d.getDay() !== weekday) return false;
        const position = task.week_position ?? nthWeekdayOfMonth(anchor);
        return position === -1 ? isLastWeekdayOfMonth(d) : nthWeekdayOfMonth(d) === position;
      }
      const target = Math.min(task.day_of_month ?? anchor.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
      return d.getDate() === target;
    }

    case 'yearly': {
      const years = d.getFullYear() - anchor.getFullYear();
      if (years < 0 || years % interval !== 0) return false;
      const month0 = (task.month_of_year ?? anchor.getMonth() + 1) - 1;
      if (d.getMonth() !== month0) return false;
      const target = Math.min(task.day_of_month ?? anchor.getDate(), daysInMonth(d.getFullYear(), month0));
      return d.getDate() === target;
    }

    default:
      return false;
  }
}

/** Does the task fall on this calendar day (including start/end limits)? */
export function occursOn(task: RecurrenceFields, date: Date): boolean {
  const d = startOfDay(date);
  const anchor = anchorDate(task);
  if (d < anchor) return false;

  const endType = task.recurrence_end_type ?? 'never';
  if (endType === 'on_date' && task.recurrence_end_date && d > parseYMD(task.recurrence_end_date)) return false;

  if (!matchesPattern(task, d, anchor)) return false;

  if (endType === 'after_count' && task.recurrence_count) {
    let n = 0;
    for (let c = new Date(anchor); c <= d; c.setDate(c.getDate() + 1)) {
      if (matchesPattern(task, c, anchor)) {
        n += 1;
        if (n > task.recurrence_count) return false;
      }
    }
  }
  return true;
}

/** All occurrence dates (YYYY-MM-DD) between two dates, inclusive. */
export function occurrencesInRange(task: RecurrenceFields, fromYMD: string, toYMD: string): string[] {
  const out: string[] = [];
  const to = parseYMD(toYMD);
  let guard = 0;
  for (let c = parseYMD(fromYMD); c <= to && guard < MAX_SCAN_DAYS; c.setDate(c.getDate() + 1), guard += 1) {
    if (occursOn(task, c)) out.push(formatYMD(c));
  }
  return out;
}

/** First date on/after the start date that really matches the pattern (Google needs this as DTSTART). */
export function firstOccurrence(task: RecurrenceFields): string | null {
  const anchor = anchorDate(task);
  for (let i = 0; i < 366 * Math.max(1, task.recurrence_interval ?? 1) + 40 && i < 4000; i += 1) {
    const c = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i);
    if (occursOn(task, c)) return formatYMD(c);
  }
  return null;
}

// ── Google Calendar RRULE ───────────────────────────────────────────────────

const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** RRULE line for the task, or null when it does not repeat. `timed` = event has clock times. */
export function toRRule(task: RecurrenceFields, timed: boolean): string | null {
  if (task.frequency_type === 'none') return null;
  const interval = Math.max(1, task.recurrence_interval ?? 1);
  const anchor = anchorDate(task);
  const parts: string[] = [];

  switch (task.frequency_type) {
    case 'daily':
      parts.push('FREQ=DAILY');
      break;
    case 'weekly': {
      const days = task.days_of_week && task.days_of_week.length > 0 ? task.days_of_week : [anchor.getDay()];
      parts.push('FREQ=WEEKLY', 'WKST=SU', `BYDAY=${[...days].sort().map((d) => RRULE_DAYS[d]).join(',')}`);
      break;
    }
    case 'monthly':
      parts.push('FREQ=MONTHLY');
      if (task.monthly_mode === 'nth_weekday') {
        const weekday = task.days_of_week?.[0] ?? anchor.getDay();
        const position = task.week_position ?? nthWeekdayOfMonth(anchor);
        parts.push(`BYDAY=${position}${RRULE_DAYS[weekday]}`);
      } else {
        const dom = task.day_of_month ?? anchor.getDate();
        // "day 31" means "the last day" for the in-app rule, which is exactly BYMONTHDAY=-1.
        parts.push(`BYMONTHDAY=${dom >= 31 ? -1 : dom}`);
      }
      break;
    case 'yearly':
      parts.push('FREQ=YEARLY', `BYMONTH=${task.month_of_year ?? anchor.getMonth() + 1}`, `BYMONTHDAY=${task.day_of_month ?? anchor.getDate()}`);
      break;
    default:
      return null;
  }

  if (interval > 1) parts.push(`INTERVAL=${interval}`);

  const endType = task.recurrence_end_type ?? 'never';
  if (endType === 'after_count' && task.recurrence_count) {
    parts.push(`COUNT=${task.recurrence_count}`);
  } else if (endType === 'on_date' && task.recurrence_end_date) {
    const ymd = task.recurrence_end_date.replace(/-/g, '');
    // Timed events need a UTC UNTIL; 23:59:59 in Bangkok (UTC+7) is 16:59:59Z the same day.
    parts.push(`UNTIL=${timed ? `${ymd}T165959Z` : ymd}`);
  }

  return `RRULE:${parts.join(';')}`;
}

// ── Presets (the dropdown in the form) ──────────────────────────────────────

/** Field values a preset stands for, given the task's start date. */
export function applyPreset(preset: RecurrencePreset, start: Date): Partial<RecurrenceFields> {
  const base: Partial<RecurrenceFields> = {
    recurrence_interval: 1, days_of_week: null, day_of_month: null, month_of_year: null, monthly_mode: null, week_position: null,
  };
  switch (preset) {
    case 'none': return { ...base, frequency_type: 'none' };
    case 'daily': return { ...base, frequency_type: 'daily' };
    case 'weekly': return { ...base, frequency_type: 'weekly', days_of_week: [start.getDay()] };
    case 'weekdays': return { ...base, frequency_type: 'weekly', days_of_week: [1, 2, 3, 4, 5] };
    case 'monthly_day': return { ...base, frequency_type: 'monthly', monthly_mode: 'day_of_month', day_of_month: start.getDate() };
    case 'monthly_nth':
      return { ...base, frequency_type: 'monthly', monthly_mode: 'nth_weekday', days_of_week: [start.getDay()], week_position: nthWeekdayOfMonth(start) };
    case 'monthly_last':
      return { ...base, frequency_type: 'monthly', monthly_mode: 'nth_weekday', days_of_week: [start.getDay()], week_position: -1 };
    case 'yearly': return { ...base, frequency_type: 'yearly', month_of_year: start.getMonth() + 1, day_of_month: start.getDate() };
    default: return { ...base, frequency_type: 'weekly', days_of_week: [start.getDay()] };
  }
}

const sameDays = (a?: number[] | null, b?: number[] | null) => {
  const x = [...(a || [])].sort().join(',');
  const y = [...(b || [])].sort().join(',');
  return x === y;
};

/** Which dropdown option matches the stored fields (otherwise "custom"). */
export function detectPreset(task: RecurrenceFields, start: Date): RecurrencePreset {
  const candidates: RecurrencePreset[] = ['none', 'daily', 'weekdays', 'weekly', 'monthly_day', 'monthly_nth', 'monthly_last', 'yearly'];
  for (const preset of candidates) {
    const p = applyPreset(preset, start);
    if (p.frequency_type !== task.frequency_type) continue;
    if ((task.recurrence_interval ?? 1) !== 1) continue;
    if (p.frequency_type === 'weekly' && !sameDays(p.days_of_week, task.days_of_week)) continue;
    if (p.frequency_type === 'monthly') {
      if ((task.monthly_mode ?? 'day_of_month') !== p.monthly_mode) continue;
      if (p.monthly_mode === 'day_of_month' && (task.day_of_month ?? 1) !== p.day_of_month) continue;
      if (p.monthly_mode === 'nth_weekday' && (!sameDays(p.days_of_week, task.days_of_week) || (task.week_position ?? 0) !== p.week_position)) continue;
    }
    if (p.frequency_type === 'yearly' && ((task.month_of_year ?? 1) !== p.month_of_year || (task.day_of_month ?? 1) !== p.day_of_month)) continue;
    return preset;
  }
  return 'custom';
}

// ── Human-readable label ────────────────────────────────────────────────────

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "Every 2 weeks on Mon, Fri · until 31 Dec" style summary, fully translated. */
export function describeRecurrence(task: RecurrenceFields, t: Translate): string {
  const interval = Math.max(1, task.recurrence_interval ?? 1);
  const anchor = anchorDate(task);
  const weekdayShort = (d: number) => t(`routineTask.weekday${d}`);
  let label: string;

  switch (task.frequency_type) {
    case 'none':
      label = t('routineTask.recNone');
      break;
    case 'daily':
      label = interval === 1 ? t('routineTask.frequencyDaily') : t('routineTask.recEveryNDays', { n: interval });
      break;
    case 'weekly': {
      const days = task.days_of_week && task.days_of_week.length > 0 ? task.days_of_week : [anchor.getDay()];
      const isWeekdays = interval === 1 && sameDays(days, [1, 2, 3, 4, 5]);
      if (isWeekdays) label = t('routineTask.recWeekdays');
      else if (interval === 1) label = days.map((d) => t(`routineTask.weekdayFull${d}`)).join(', ');
      else label = t('routineTask.recEveryNWeeks', { n: interval, days: days.map(weekdayShort).join(', ') });
      break;
    }
    case 'monthly': {
      const prefix = interval === 1 ? '' : `${t('routineTask.recEveryNMonths', { n: interval })} · `;
      if (task.monthly_mode === 'nth_weekday') {
        const weekday = task.days_of_week?.[0] ?? anchor.getDay();
        const position = task.week_position ?? nthWeekdayOfMonth(anchor);
        label = prefix + (position === -1
          ? t('routineTask.recMonthlyLast', { weekday: t(`routineTask.weekdayName${weekday}`) })
          : t('routineTask.recMonthlyNth', { weekday: t(`routineTask.weekdayName${weekday}`), nth: t(`routineTask.nth${position}`) }));
      } else {
        label = prefix + t('routineTask.everyMonthDay', { day: task.day_of_month ?? anchor.getDate() });
      }
      break;
    }
    case 'yearly': {
      const prefix = interval === 1 ? '' : `${t('routineTask.recEveryNYears', { n: interval })} · `;
      label = prefix + t('routineTask.everyYearDate', {
        day: task.day_of_month ?? anchor.getDate(),
        month: t(`routineTask.month${task.month_of_year ?? anchor.getMonth() + 1}`),
      });
      break;
    }
    default:
      label = '';
  }

  const endType = task.recurrence_end_type ?? 'never';
  if (task.frequency_type !== 'none') {
    if (endType === 'on_date' && task.recurrence_end_date) {
      label += ` · ${t('routineTask.recUntil', { date: task.recurrence_end_date })}`;
    } else if (endType === 'after_count' && task.recurrence_count) {
      label += ` · ${t('routineTask.recCountTimes', { n: task.recurrence_count })}`;
    }
  }
  return label;
}
