-- Migration: Alter col_worklog.total_hours to NUMERIC(7,2)
-- Description: Increases the precision of total_hours in col_worklog from DECIMAL(4,2) (max 99.99)
-- to NUMERIC(7,2) (max 99,999.99) to prevent numeric field overflow during imports or multi-day calculations.

ALTER TABLE public.col_worklog 
  ALTER COLUMN total_hours TYPE NUMERIC(7,2);
