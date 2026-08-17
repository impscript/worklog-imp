-- Migration: Expand Cost Savings 4D with best-practice calculators
-- Description: Adds direct-savings mode, annual run cost, and support workload calculator fields.

BEGIN;

ALTER TABLE public.tb_project_cost_savings
ADD COLUMN IF NOT EXISTS direct_savings_mode VARCHAR(40) DEFAULT 'cost_reduction',
ADD COLUMN IF NOT EXISTS direct_baseline_cost_annual NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS direct_target_cost_annual NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS incremental_run_cost_annual NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_ticket_baseline_monthly NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_ticket_target_monthly NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_cost_per_ticket NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_hours_per_ticket NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS support_hourly_rate NUMERIC(8,2) DEFAULT 350.00;

COMMIT;
