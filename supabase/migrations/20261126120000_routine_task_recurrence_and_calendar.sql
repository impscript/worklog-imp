-- =============================================================================
-- Routine tasks (To do list): Google-Calendar-style recurrence + calendar reminders
--
--  * start_date / start_time / end_time : when the task begins (times optional = all day)
--  * recurrence_interval                : "every N days/weeks/months/years"
--  * monthly_mode / week_position       : monthly on a day number, or on the Nth / last weekday
--  * recurrence_end_type/_date/_count   : never | on a date | after N occurrences
--  * save_to_calendar / gcal_event_id   : show as a reminder in the in-app Calendar and,
--                                         when Google sync is on, as one recurring Google event
--  * frequency_type 'none'              : one-off (does not repeat)
--
-- Existing rows keep working: every new column is nullable or has a default that
-- reproduces the previous behaviour (interval 1, never ends, not saved to calendar).
-- =============================================================================

ALTER TABLE public.tb_routine_task
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER NOT NULL DEFAULT 1 CHECK (recurrence_interval BETWEEN 1 AND 999),
  ADD COLUMN IF NOT EXISTS monthly_mode TEXT CHECK (monthly_mode IN ('day_of_month', 'nth_weekday')),
  ADD COLUMN IF NOT EXISTS week_position INTEGER CHECK (week_position IN (-1, 1, 2, 3, 4)),
  ADD COLUMN IF NOT EXISTS recurrence_end_type TEXT NOT NULL DEFAULT 'never' CHECK (recurrence_end_type IN ('never', 'on_date', 'after_count')),
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_count INTEGER CHECK (recurrence_count BETWEEN 1 AND 999),
  ADD COLUMN IF NOT EXISTS save_to_calendar BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

ALTER TABLE public.tb_routine_task
  DROP CONSTRAINT IF EXISTS tb_routine_task_frequency_type_check;

ALTER TABLE public.tb_routine_task
  ADD CONSTRAINT tb_routine_task_frequency_type_check
  CHECK (frequency_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly'));

CREATE INDEX IF NOT EXISTS idx_routine_task_calendar
  ON public.tb_routine_task (workspace_id)
  WHERE save_to_calendar = true AND is_active = true;

NOTIFY pgrst, 'reload schema';
