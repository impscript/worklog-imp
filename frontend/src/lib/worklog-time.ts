export const DEFAULT_WORK_START_TIME = '08:00';
export const DEFAULT_WORK_END_TIME = '17:00';
export const NEXT_WORKLOG_GAP_MINUTES = 5;

interface WorklogTimeEntry {
  start_time?: string | null;
  end_time?: string | null;
}

export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;

  const parts = timeStr.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = parts.length === 3 ? Number(parts[2]) : 0;

  if (
    Number.isNaN(hours)
    || Number.isNaN(minutes)
    || Number.isNaN(seconds)
    || hours < 0
    || hours > 24
    || minutes < 0
    || minutes > 59
    || seconds < 0
    || seconds >= 60
  ) {
    return null;
  }

  if (hours === 24 && (minutes > 0 || seconds > 0)) return null;
  return (hours * 60) + minutes;
}

function formatMinutesToTime(totalMinutes: number): string {
  const boundedMinutes = Math.max(0, Math.min(totalMinutes, 24 * 60));
  const hours = Math.floor(boundedMinutes / 60);
  const minutes = boundedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getNextDefaultTimeRange(entries: WorklogTimeEntry[]): { startTime: string; endTime: string } {
  const latestEndMinutes = entries.reduce((latest, entry) => {
    const startMinutes = parseTimeToMinutes(entry.start_time);
    const endMinutes = parseTimeToMinutes(entry.end_time);
    const isUnspecifiedAllDayEntry = startMinutes === 0 && endMinutes === 0;
    return endMinutes === null || isUnspecifiedAllDayEntry
      ? latest
      : Math.max(latest, endMinutes);
  }, -1);

  if (latestEndMinutes < 0) {
    return { startTime: DEFAULT_WORK_START_TIME, endTime: DEFAULT_WORK_END_TIME };
  }

  // Keep the suggested entry inside the selected work date at the end-of-day boundary.
  const nextStartMinutes = Math.min(latestEndMinutes + NEXT_WORKLOG_GAP_MINUTES, (24 * 60) - 1);
  const defaultEndMinutes = parseTimeToMinutes(DEFAULT_WORK_END_TIME) || 0;
  const nextEndMinutes = nextStartMinutes < defaultEndMinutes
    ? defaultEndMinutes
    : Math.min(nextStartMinutes + 60, 24 * 60);

  return {
    startTime: formatMinutesToTime(nextStartMinutes),
    endTime: formatMinutesToTime(nextEndMinutes)
  };
}
