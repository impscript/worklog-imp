-- The IT salary rate reference is IMP's own internal costing tool, not a
-- system-wide default like holidays or project types. Scope the seeded rows
-- to the Process Improvement workspace (the same workspace id already used
-- elsewhere as IMP's identity) instead of leaving them global, so only that
-- workspace's admins can manage them, and RLS naturally allows their own
-- toggle/edit/delete via the existing "workspace owner" check.

BEGIN;

UPDATE public.tb_master_it_salary_rate
SET workspace_id = 'a59b2075-8ce6-4b95-a4df-1e8ea36a0001'
WHERE workspace_id IS NULL;

COMMIT;
