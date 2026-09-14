-- =============================================================================
-- Add a 'yearly' frequency option to routine tasks (a specific month + day
-- each year, e.g. Jan 1). Reuses the existing day_of_month column for the
-- day part and adds month_of_year for the month part.
-- =============================================================================

ALTER TABLE public.tb_routine_task
ADD COLUMN IF NOT EXISTS month_of_year INTEGER CHECK (month_of_year BETWEEN 1 AND 12);

ALTER TABLE public.tb_routine_task
DROP CONSTRAINT IF EXISTS tb_routine_task_frequency_type_check;

ALTER TABLE public.tb_routine_task
ADD CONSTRAINT tb_routine_task_frequency_type_check
CHECK (frequency_type IN ('daily', 'weekly', 'monthly', 'yearly'));

NOTIFY pgrst, 'reload schema';
